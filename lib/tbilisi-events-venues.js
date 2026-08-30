'use strict';
var Anthropic = require('@anthropic-ai/sdk');
var data = require('./tbilisi-events-data');
var taxonomy = require('./tbilisi-events-taxonomy');

var MODEL = 'claude-haiku-4-5-20251001';

function normalizeVenueName(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Mirrors tbilisi-events-dedup.findMatchingEvent: ask the model whether the
// candidate name refers to one of the venues we already have. Returns a venueId or null.
async function findMatchingVenue(candidateName, venues) {
  if (!venues.length) return null;
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  var client = new Anthropic({ apiKey });

  var list = venues.map(function(v) {
    return 'id=' + v.id + ': "' + v.name + '"' + (v.area ? ' (' + v.area + ')' : '');
  }).join('\n');

  var message = await client.messages.create({
    model: MODEL,
    max_tokens: 50,
    messages: [{
      role: 'user',
      content: 'You are matching a venue name against a list of known venues in Tbilisi, Georgia.\n\n'
        + 'Candidate venue name: "' + candidateName + '"\n\n'
        + 'Known venues:\n' + list + '\n\n'
        + 'Does the candidate refer to the SAME real-world venue as one of the known venues '
        + '(same place, possibly a different language, transliteration, abbreviation, or with/without generic words like "theatre", "hall", "club", "space")?\n'
        + 'Respond with exactly the matching venue\'s id and nothing else if yes, or exactly "none" if it is a different or unknown venue.',
    }],
  });

  var text = message.content[0].text.trim();
  if (text === 'none') return null;
  var hit = venues.find(function(v) { return v.id === text; });
  return hit ? hit.id : null;
}

// Returns a venueId for a free-text place string, creating a stub venue if needed.
// Returns null for an empty place. Increments the resolved venue's eventCount by 1.
async function resolveVenue(placeString) {
  var place = (placeString || '').trim();
  if (!place) return null;
  var nameKey = normalizeVenueName(place);
  if (!nameKey) return null;

  var venues = await data.getVenues();

  var exact = venues.find(function(v) {
    if (v.nameKey === nameKey) return true;
    return (v.aliases || []).some(function(a) { return normalizeVenueName(a) === nameKey; });
  });
  if (exact) {
    await data.bumpVenueEventCount(exact.id, 1);
    return exact.id;
  }

  var fuzzyId = null;
  try {
    fuzzyId = await findMatchingVenue(place, venues);
  } catch (e) {
    fuzzyId = null; // best-effort; fall through to creating a stub
  }
  if (fuzzyId) {
    var v = venues.find(function(x) { return x.id === fuzzyId; });
    var aliases = (v && v.aliases) ? v.aliases.slice() : [];
    if (aliases.indexOf(place) === -1) aliases.push(place);
    await data.updateVenue(fuzzyId, { aliases: aliases });
    await data.bumpVenueEventCount(fuzzyId, 1);
    return fuzzyId;
  }

  return await data.insertVenue({
    name: place,
    nameKey: nameKey,
    aliases: [],
    origin: 'auto',
    eventCount: 1,
  });
}

// Admin "draft description" button: one LLM call from the venue name.
// Returns { description: {ru,en,ka}|null, type: <venue slug>|null, area: string|null }.
async function draftVenueDescription(name) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  var client = new Anthropic({ apiKey });

  var message = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: 'This is the name of a venue in Tbilisi, Georgia: "' + name + '".\n\n'
        + 'If you recognize it, write a short neutral factual description, 2-3 sentences, in three languages (ru, en, ka). '
        + 'If you do not recognize it, return null descriptions.\n'
        + 'Also return:\n'
        + '  "type": one of ' + JSON.stringify(taxonomy.VENUE_TYPE_SLUGS) + ' or null\n'
        + '  "area": the Tbilisi district/neighbourhood if known, else null\n\n'
        + 'Respond with a JSON object only, no markdown:\n'
        + '{"description":{"ru":"...","en":"...","ka":"..."} or null,"type":"...","area":"..."}',
    }],
  });

  var text = message.content[0].text.trim();
  var fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  var match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Unexpected draft response: ' + text);
  var json = JSON.parse(match[0]);

  var d = json.description || null;
  var description = null;
  if (d && (d.ru || d.en || d.ka)) {
    description = {
      ru: (d.ru ? String(d.ru).trim() : ''),
      en: (d.en ? String(d.en).trim() : ''),
      ka: (d.ka ? String(d.ka).trim() : ''),
    };
  }
  return {
    description: description,
    type: taxonomy.isValidVenueType(json.type) ? json.type : null,
    area: (json.area && json.area !== 'null') ? String(json.area).trim() : null,
  };
}

module.exports = {
  normalizeVenueName: normalizeVenueName,
  findMatchingVenue: findMatchingVenue,
  resolveVenue: resolveVenue,
  draftVenueDescription: draftVenueDescription,
};
