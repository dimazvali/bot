'use strict';
var Anthropic = require('@anthropic-ai/sdk');

async function extractEvent(rawText, sourceLabel) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  var client = new Anthropic({ apiKey });

  var today = new Date().toISOString().slice(0, 10);

  var message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: 'You are extracting event announcements from social media posts and web pages about Tbilisi, Georgia.\n'
        + 'Today\'s date is ' + today + '. Use this to resolve dates that are given without a year (assume the next upcoming occurrence, not a past one).\n'
        + 'Source: ' + sourceLabel + '\n'
        + 'Text:\n' + rawText + '\n\n'
        + 'Is this an announcement of a specific public event happening in Tbilisi (concert, exhibition, festival, party, screening, etc)?\n'
        + 'If yes, respond with JSON only, no markdown: {"title":"...","date":"YYYY-MM-DD","time":"HH:MM or null","place":"... or null"}\n'
        + 'If no (it is not an event announcement, or there is not enough info to determine a specific date), respond with exactly: null',
    }],
  });

  var text = message.content[0].text.trim();
  if (text === 'null') return null;
  var match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Unexpected extractor response (no JSON found): ' + text);
  var json;
  try {
    json = JSON.parse(match[0]);
  } catch (e) {
    throw new Error('Unexpected extractor response (invalid JSON): ' + text);
  }
  if (!json.title || !json.date) throw new Error('Unexpected extractor response (missing title/date): ' + text);
  return {
    title: String(json.title).trim(),
    date: String(json.date).trim(),
    time: (json.time && json.time !== 'null') ? String(json.time).trim() : null,
    place: (json.place && json.place !== 'null') ? String(json.place).trim() : null,
  };
}

module.exports = { extractEvent };
