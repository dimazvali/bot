'use strict';
var Anthropic = require('@anthropic-ai/sdk');
var extractAndParse = require('./tbilisi-events-json').extractAndParse;

var MODEL = 'claude-haiku-4-5-20251001';
var MAX_TEXT = 4000;
var CITIES = ['Tbilisi', 'Batumi', 'Kutaisi', 'other', 'unknown'];

function zoneFor(score) {
  if (score > 75) return 'hot';
  if (score >= 45) return 'maybe';
  return 'ignore';
}

function buildPrompt(item, pre) {
  return 'You screen social-media posts and job ads for a professional photographer based in Tbilisi, Georgia, '
    + 'who wants paid photography work anywhere in Georgia (Tbilisi, Batumi, Kutaisi and other cities).\n'
    + 'Decide whether the text is a LEAD: someone who needs, or will soon need, a photographer.\n'
    + '- direct lead: they ask for / look for / want a recommendation of a photographer or a photoshoot, or post a photographer vacancy.\n'
    + '- indirect lead: a business event that usually needs photography (restaurant / hotel / shop opening, new menu, '
    + 'brand or collection launch, hiring an SMM or content creator, preparing an event, new rental listing) without an explicit request.\n'
    + 'NOT leads (score below 30): a photographer advertising their own services or portfolio; selling or renting photo gear; '
    + 'retoucher / photo-lab vacancies; requests clearly outside Georgia; tourists asking where to take photos; news.\n'
    + 'Score 0-100: 90+ explicit paid request in Georgia with details; 76-89 explicit request; '
    + '45-75 plausible indirect demand or a vague request; below 45 not a lead.\n\n'
    + 'Source: ' + item.source + (item.author ? ' (' + item.author + ')' : '') + '\n'
    + 'Published: ' + (item.publishedAt || 'unknown') + '\n'
    + 'Keyword prefilter: level ' + pre.level + ' (' + (pre.matched || []).join(', ') + ')\n'
    + 'Text:\n<<<\n' + String(item.text || '').slice(0, MAX_TEXT) + '\n>>>\n\n'
    + 'Respond with ONE JSON object only, no markdown:\n'
    + '{"isLead": boolean, "score": integer, "kind": "direct" | "indirect", '
    + '"city": "Tbilisi" | "Batumi" | "Kutaisi" | "other" | "unknown", '
    + '"genre": short English genre (food, hotel, portrait, event, wedding, product, real estate, ...) or null, '
    + '"budget": budget as written in the text or null, '
    + '"summaryRu": "1-2 sentences in Russian: who needs what, where, when", '
    + '"reason": "short English justification"}';
}

function str(v) { return typeof v === 'string' && v.trim() ? v.trim() : null; }

function parseClassification(raw) {
  var o = extractAndParse(raw, '{');
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('classifier: no JSON object in reply');
  var score = Math.round(Number(o.score));
  if (!isFinite(score)) throw new Error('classifier: bad score ' + JSON.stringify(o.score));
  score = Math.max(0, Math.min(100, score));
  var isLead = o.isLead === true;
  if (!isLead) score = Math.min(score, 44); // keep isLead and zone consistent
  return {
    isLead: isLead,
    score: score,
    kind: o.kind === 'direct' ? 'direct' : 'indirect',
    city: CITIES.indexOf(o.city) !== -1 ? o.city : 'unknown',
    genre: str(o.genre),
    budget: str(o.budget),
    summaryRu: str(o.summaryRu) || '',
    reason: str(o.reason) || '',
  };
}

// deps.client (tests) — an object with messages.create like the Anthropic SDK.
async function classify(item, pre, deps) {
  var client = deps && deps.client;
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  var message = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: buildPrompt(item, pre) }],
  });
  var text = (message.content || []).map(function(b) { return b.text || ''; }).join('');
  return parseClassification(text);
}

module.exports = { zoneFor: zoneFor, buildPrompt: buildPrompt, parseClassification: parseClassification, classify: classify };
