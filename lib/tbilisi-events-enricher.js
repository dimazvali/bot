'use strict';
var Anthropic = require('@anthropic-ai/sdk');
var taxonomy = require('./tbilisi-events-taxonomy');
var extractBalancedJson = require('./tbilisi-events-json').extractBalancedJson;

var MODEL = 'claude-haiku-4-5-20251001';

function s(x) { return (typeof x === 'string' && x.trim()) ? x.trim() : ''; }

// Produces { description: {ru,en,ka}|null, titleI18n: {ru,en,ka}|null, type: <slug>|null, language: string[] }.
// Runs once per de-duplicated event. Throws only on a malformed LLM response.
async function enrichEvent(input) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  var client = new Anthropic({ apiKey });

  var title = s(input.title);
  var place = s(input.place);
  var rawExcerpt = s(input.rawExcerpt);
  var haveType = taxonomy.isValidEventType(input.type);
  var haveLang = Array.isArray(input.language) && input.language.length > 0;

  var message = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: 'You are writing catalogue copy for an events listing about Tbilisi, Georgia.\n\n'
        + 'Event title: ' + (title || '(unknown)') + '\n'
        + 'Venue: ' + (place || '(unknown)') + '\n'
        + 'Source text (may be empty, may be in any language):\n' + (rawExcerpt || '(none)') + '\n\n'
        + 'Write an original, neutral, factual description of this event, 2-4 sentences, in three languages (ru, en, ka). '
        + 'Do not invent facts that are not implied by the title/venue/source text. No marketing hype, no second person.\n'
        + 'Also return:\n'
        + '  "titleI18n": the event title rendered naturally in {"ru","en","ka"} — translate or transliterate the given title, keep proper names and band/show names as they are commonly written\n'
        + '  "type": one of ' + JSON.stringify(taxonomy.EVENT_TYPE_SLUGS)
        + (haveType ? ' (keep "' + input.type + '" unless clearly wrong)' : '') + '\n'
        + '  "language": array from ["ka","ru","en","other"] for the language(s) the event is conducted in, [] if unknown'
        + (haveLang ? ' (keep ' + JSON.stringify(input.language) + ' unless clearly wrong)' : '') + '\n\n'
        + 'Respond with a JSON object only, no markdown, no code fences:\n'
        + '{"description":{"ru":"...","en":"...","ka":"..."},"titleI18n":{"ru":"...","en":"...","ka":"..."},"type":"...","language":["..."]}',
    }],
  });

  var text = message.content[0].text.trim();
  var blob = extractBalancedJson(text, '{');
  if (!blob) throw new Error('Unexpected enricher response (no JSON object): ' + text);
  var json;
  try {
    json = JSON.parse(blob);
  } catch (e) {
    throw new Error('Unexpected enricher response (invalid JSON): ' + text);
  }

  var d = json.description || {};
  var description = null;
  if (s(d.ru) || s(d.en) || s(d.ka)) {
    description = { ru: s(d.ru), en: s(d.en), ka: s(d.ka) };
  }

  var ti = json.titleI18n || {};
  var titleI18n = null;
  if (s(ti.ru) || s(ti.en) || s(ti.ka)) {
    titleI18n = { ru: s(ti.ru), en: s(ti.en), ka: s(ti.ka) };
  }

  var langOut = taxonomy.sanitizeLanguages(json.language);
  return {
    description: description,
    titleI18n: titleI18n,
    type: taxonomy.isValidEventType(json.type) ? json.type : (haveType ? input.type : null),
    language: langOut.length ? langOut : (haveLang ? input.language : []),
  };
}

module.exports = { enrichEvent: enrichEvent };
