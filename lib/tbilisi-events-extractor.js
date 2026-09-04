'use strict';
var Anthropic = require('@anthropic-ai/sdk');
var taxonomy = require('./tbilisi-events-taxonomy');
var extractAndParse = require('./tbilisi-events-json').extractAndParse;

// onUsage (optional) receives the raw `message.usage` object after each LLM call
// so callers can accumulate token spend across a run.
async function extractEvents(rawText, sourceLabel, publishedAt, onUsage) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  var client = new Anthropic({ apiKey });

  var today = new Date().toISOString().slice(0, 10);
  var publishedDate = publishedAt ? new Date(publishedAt).toISOString().slice(0, 10) : null;
  var anchorDate = publishedDate || today;

  var message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: 'You are extracting event announcements from social media posts and web pages about Tbilisi, Georgia.\n'
        + 'Today\'s date is ' + today + '.\n'
        + (publishedDate
          ? 'This message was published on ' + publishedDate + '. Resolve any relative dates in the text ("tomorrow", "this Saturday", "next weekend", a bare day-of-week, or a month/day with no year) relative to that publish date, not today\'s date.\n'
          : 'This message has no known publish date, so resolve relative or year-less dates relative to today\'s date (' + anchorDate + '), assuming the next upcoming occurrence, not a past one.\n')
        + 'Source: ' + sourceLabel + '\n'
        + 'Text:\n' + rawText + '\n\n'
        + 'This text may announce zero, one, or several specific public events happening in Tbilisi (concert, exhibition, festival, party, screening, etc).\n'
        + 'For each such event, extract an object with these fields:\n'
        + '  "title": string\n'
        + '  "date": "YYYY-MM-DD"\n'
        + '  "time": "HH:MM" or null\n'
        + '  "place": venue name as written in the text, or null\n'
        + '  "type": one of ' + JSON.stringify(taxonomy.EVENT_TYPE_SLUGS) + ', or null if unclear\n'
        + '  "language": array of codes for the language(s) the event is CONDUCTED in, each one of ["ka","ru","en","other"]; [] if not stated and not inferable\n'
        + '  "price": short admission-price string as written in the text (e.g. "20 ₾", "вход 15 лари", "бесплатно"), or null if not stated\n'
        + '  "cancelled": true only if the text explicitly says THIS event is cancelled or called off, otherwise false\n'
        + 'Respond with a JSON array only, no markdown, no code fences: e.g. [{"title":"...",...}] for one or more events, or [] if there are none.',
    }],
  });

  if (typeof onUsage === 'function' && message.usage) {
    try { onUsage(message.usage); } catch (e) { /* metrics must not break the run */ }
  }

  var text = message.content[0].text.trim();
  if (text === '[]' || text === 'null') return [];
  var json;
  try {
    json = extractAndParse(text, '[');
  } catch (e) {
    throw new Error('Unexpected extractor response (invalid JSON): ' + text);
  }
  if (json === null) throw new Error('Unexpected extractor response (no JSON array found): ' + text);
  if (!Array.isArray(json)) throw new Error('Unexpected extractor response (not an array): ' + text);

  return json
    .filter(function(item) { return item && item.title && item.date; })
    .map(function(item) {
      return {
        title: String(item.title).trim(),
        date: String(item.date).trim(),
        time: (item.time && item.time !== 'null') ? String(item.time).trim() : null,
        place: (item.place && item.place !== 'null') ? String(item.place).trim() : null,
        type: taxonomy.isValidEventType(item.type) ? item.type : null,
        language: taxonomy.sanitizeLanguages(item.language),
        price: (item.price && item.price !== 'null') ? String(item.price).trim().slice(0, 80) : null,
        cancelled: item.cancelled === true,
      };
    });
}

module.exports = { extractEvents };
