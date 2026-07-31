'use strict';
var Anthropic = require('@anthropic-ai/sdk');

function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeDedupeKey(title, date) {
  return normalizeTitle(title) + '|' + (date || '');
}

async function findMatchingEvent(candidate, existingEvents) {
  if (!existingEvents.length) return null;
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  var client = new Anthropic({ apiKey });

  var list = existingEvents.map(function(e) {
    return 'id=' + e.id + ': "' + e.title + '"' + (e.place ? ' at ' + e.place : '');
  }).join('\n');

  var message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 50,
    messages: [{
      role: 'user',
      content: 'You are deduplicating an events calendar. All events below are already known to be on the same date.\n\n'
        + 'New candidate event: "' + candidate.title + '"' + (candidate.place ? ' at ' + candidate.place : '') + '\n\n'
        + 'Already-known events for this date:\n' + list + '\n\n'
        + 'Is the new candidate the SAME real-world event as one of the already-known events above '
        + '(same event, possibly in a different language, translation, transliteration, or a shortened/expanded title)?\n'
        + 'Respond with exactly the matching event\'s id and nothing else if yes, or exactly the word "none" if it is a genuinely different event.',
    }],
  });

  var text = message.content[0].text.trim();
  if (text === 'none') return null;
  var match = existingEvents.find(function(e) { return e.id === text; });
  return match || null;
}

module.exports = { normalizeTitle, computeDedupeKey, findMatchingEvent };
