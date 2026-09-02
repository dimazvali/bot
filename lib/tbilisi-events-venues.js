'use strict';
var Anthropic = require('@anthropic-ai/sdk');
var axios = require('axios');
var data = require('./tbilisi-events-data');
var taxonomy = require('./tbilisi-events-taxonomy');
var tbilisiJson = require('./tbilisi-events-json');
var extractBalancedJson = tbilisiJson.extractBalancedJson;
var parseLooseJson = tbilisiJson.parseLooseJson;

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
  var blob = extractBalancedJson(text, '{');
  if (!blob) throw new Error('Unexpected draft response: ' + text);
  var json = parseLooseJson(blob);

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

// Best-effort geocode of a free-text address via OpenStreetMap Nominatim.
// Keyless; asks for one result, needs a descriptive User-Agent, must stay under
// ~1 req/s (callers space calls out). Returns { lat, lng } or null on any failure.
async function geocodeAddress(query) {
  var q = (query || '').trim();
  if (!q) return null;
  try {
    var res = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: q, format: 'json', limit: 1 },
      headers: { 'User-Agent': 'tbilisi-events-bot/1.0 (venue geocoding)' },
      timeout: 15000,
    });
    var hit = Array.isArray(res.data) && res.data[0];
    if (!hit) return null;
    var lat = parseFloat(hit.lat);
    var lng = parseFloat(hit.lon);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat: lat, lng: lng };
  } catch (e) {
    return null;
  }
}

// Admin "research venue" action: one web-search-enabled LLM call from the venue
// name, then a Nominatim fallback for coordinates. Returns a normalized object;
// the route decides which empty fields to fill. Never renames the venue.
async function researchVenue(name) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  var client = new Anthropic({ apiKey });

  var prompt = 'Venue name as it appears in local Tbilisi event listings: "' + name + '".\n\n'
    + 'Use web search to identify this specific real venue in Tbilisi, Georgia. Prefer the '
    + 'venue\'s official site, Google Maps, Wikipedia, or its main Facebook/Instagram page.\n\n'
    + 'Respond with a JSON object only, no markdown:\n'
    + '{\n'
    + '  "found": true | false,\n'
    + '  "canonicalName": string | null,\n'
    + '  "address": string | null,\n'
    + '  "area": string | null,\n'
    + '  "lat": number | null,\n'
    + '  "lng": number | null,\n'
    + '  "website": string | null,\n'
    + '  "type": one of ' + JSON.stringify(taxonomy.VENUE_TYPE_SLUGS) + ' | null,\n'
    + '  "description": {"ru": string, "en": string, "ka": string} | null,\n'
    + '  "confidence": "high" | "medium" | "low"\n'
    + '}\n'
    + 'description: 2-3 neutral factual sentences per language. If you cannot confidently '
    + 'identify the venue, set "found": false, "confidence": "low", and leave the rest null.';

  var messages = [{ role: 'user', content: prompt }];
  var response;
  for (var iter = 0; iter < 5; iter++) {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: 'You research public venues (concert halls, galleries, theatres, clubs, bars, museums, '
        + 'open-air spaces) in Tbilisi, Georgia, and report verifiable facts found via web search.',
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
      messages: messages,
    });
    if (response.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: response.content });
  }

  var textOut = (response.content || [])
    .filter(function(b) { return b.type === 'text'; })
    .map(function(b) { return b.text; })
    .join('\n')
    .trim();

  var blob = extractBalancedJson(textOut, '{');
  if (!blob) throw new Error('Unexpected research response: ' + textOut.slice(0, 300));
  var j = parseLooseJson(blob);

  function str(v) { return (v && v !== 'null') ? String(v).trim() : null; }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

  var description = null;
  var d = j.description || null;
  if (d && (d.ru || d.en || d.ka)) {
    description = { ru: (d.ru || '').trim(), en: (d.en || '').trim(), ka: (d.ka || '').trim() };
  }

  var address = str(j.address);
  var lat = num(j.lat);
  var lng = num(j.lng);
  if (lat == null || lng == null) {
    var geo = await geocodeAddress(address || (name + ', Tbilisi, Georgia'));
    if (geo) { lat = geo.lat; lng = geo.lng; }
  }

  return {
    found: !!j.found,
    confidence: ['high', 'medium', 'low'].indexOf(j.confidence) !== -1 ? j.confidence : 'low',
    canonicalName: str(j.canonicalName),
    address: address,
    area: str(j.area),
    lat: lat,
    lng: lng,
    website: str(j.website),
    type: taxonomy.isValidVenueType(j.type) ? j.type : null,
    description: description,
  };
}

module.exports = {
  normalizeVenueName: normalizeVenueName,
  findMatchingVenue: findMatchingVenue,
  resolveVenue: resolveVenue,
  draftVenueDescription: draftVenueDescription,
  geocodeAddress: geocodeAddress,
  researchVenue: researchVenue,
};
