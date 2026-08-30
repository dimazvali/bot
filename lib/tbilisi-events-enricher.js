'use strict';
var Anthropic = require('@anthropic-ai/sdk');
var taxonomy = require('./tbilisi-events-taxonomy');

var MODEL = 'claude-haiku-4-5-20251001';

function s(x) { return (typeof x === 'string' && x.trim()) ? x.trim() : ''; }

// Produces { description: {ru,en,ka}|null, type: <slug>|null, language: string[] }.
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
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: 'You are writing catalogue copy for an events listing about Tbilisi, Georgia.\n\n'
        + 'Event title: ' + (title || '(unknown)') + '\n'
        + 'Venue: ' + (place || '(unknown)') + '\n'
        + 'Source text (may be empty, may be in any language):\n' + (rawExcerpt || '(none)') + '\n\n'
        + 'Write an original, neutral, factual description of this event, 2-4 sentences, in three languages (ru, en, ka). '
        + 'Do not invent facts that are not implied by the title/venue/source text. No marketing hype, no second person.\n'
        + 'Also return:\n'
        + '  "type": one of ' + JSON.stringify(taxonomy.EVENT_TYPE_SLUGS)
        + (haveType ? ' (keep "' + input.type + '" unless clearly wrong)' : '') + '\n'
        + '  "language": array from ["ka","ru","en","other"] for the language(s) the event is conducted in, [] if unknown'
        + (haveLang ? ' (keep ' + JSON.stringify(input.language) + ' unless clearly wrong)' : '') + '\n\n'
        + 'Respond with a JSON object only, no markdown, no code fences:\n'
        + '{"description":{"ru":"...","en":"...","ka":"..."},"type":"...","language":["..."]}',
    }],
  });

  var text = message.content[0].text.trim();
  var fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  // Extract the first balanced {...} object. A plain greedy /\{[\s\S]*\}/ breaks
  // when the model appends a stray trailing brace (Haiku 4.5 does this ~half the time).
  var start = text.indexOf('{');
  var end = -1;
  if (start !== -1) {
    var depth = 0, inStr = false, esc = false;
    for (var i = start; i < text.length; i++) {
      var ch = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') {
        inStr = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
  }
  if (start === -1 || end === -1) throw new Error('Unexpected enricher response (no JSON object): ' + text);
  var json;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    throw new Error('Unexpected enricher response (invalid JSON): ' + text);
  }

  var d = json.description || {};
  var description = null;
  if (s(d.ru) || s(d.en) || s(d.ka)) {
    description = { ru: s(d.ru), en: s(d.en), ka: s(d.ka) };
  }

  var langOut = taxonomy.sanitizeLanguages(json.language);
  return {
    description: description,
    type: taxonomy.isValidEventType(json.type) ? json.type : (haveType ? input.type : null),
    language: langOut.length ? langOut : (haveLang ? input.language : []),
  };
}

module.exports = { enrichEvent: enrichEvent };
