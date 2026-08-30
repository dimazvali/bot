'use strict';
var Anthropic = require('@anthropic-ai/sdk');
var taxonomy = require('./tbilisi-events-taxonomy');

function stripCodeFence(text) {
  var fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : text;
}

async function extractEvents(rawText, sourceLabel, publishedAt) {
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
        + 'Respond with a JSON array only, no markdown, no code fences: e.g. [{"title":"...",...}] for one or more events, or [] if there are none.',
    }],
  });

  var text = stripCodeFence(message.content[0].text.trim());
  if (text === '[]' || text === 'null') return [];
  var match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Unexpected extractor response (no JSON array found): ' + text);
  var json;
  try {
    json = JSON.parse(match[0]);
  } catch (e) {
    throw new Error('Unexpected extractor response (invalid JSON): ' + text);
  }
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
      };
    });
}

module.exports = { extractEvents };
