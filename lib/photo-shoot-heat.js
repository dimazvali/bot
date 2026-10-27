'use strict';

// "Горячесть" of photo.dimazvali.com content: what people are looking at / taking right now.
//
// Units: shoots ('shoot:<slug>'), gallery series ('series:<country>/<series>'), countries ('country:<key>' —
// its own page plus the sum of its series) and single frames (shoot or gallery photos, for "hot frames").
//
// Every visitor action has a weight that grows with intent (page view < frame view < Instagram click /
// comment / review < archive download < print/licence inquiry). Each counts once per visitor+target+day,
// one visitor gives a unit at most DAILY_CAP points a day (a client paging through 200 frames of their own
// wedding must not make it "hot" alone), and points halve every HALF_LIFE (score = Σ weight · 0.5^(age/HALF_LIFE)).
// Levels 1–3 are relative to the other units of the same kind (top 10% / next 20% / the rest), with
// absolute floors so a quiet week doesn't hand out three flames for a couple of views.
//
// Pure — events come from photo_views, photoDownloads and photoComments (see routes/photo-admin.js),
// tested in test/photo-shoot-heat.test.js.

var DAY = 24 * 60 * 60 * 1000;
var WEIGHTS = {
  shoot: 1, 'shoot-photo': 2, country: 1, series: 1, photo: 2,
  igclick: 4, comment: 5, review: 5, ig: 5, sel: 8, zip: 10, inquiry: 10,
};
var PART = {
  shoot: 'page', country: 'page', series: 'page', 'shoot-photo': 'frames', photo: 'frames',
  ig: 'downloads', sel: 'downloads', zip: 'downloads',
  igclick: 'actions', comment: 'actions', review: 'actions', inquiry: 'actions',
};
var HALF_LIFE = 7 * DAY;
var WINDOW = 28 * DAY; // 4 half-lives: an event at the edge still weighs ~6%
var DAILY_CAP = 20;
// on prod (Oct 2026) 1–3 points is "one or two views a few weeks ago" — not worth a flame
var LEVEL_FLOORS = { 3: 20, 2: 8, 1: 3 };

// '/en/georgia/tbilisi/abc' → { unit: 'series:georgia/tbilisi', photo: 'georgia/tbilisi/abc' };
// '/shoot/wed/abc' → { unit: 'shoot:wed', photo: 'shoot:wed/abc' }; unknown paths → null
function unitOfPath(p) {
  var parts = String(p || '').split('?')[0].split('/').filter(Boolean);
  if (parts[0] === 'en') parts.shift();
  if (parts[0] === 'shoot') {
    if (!parts[1]) return null;
    return { unit: 'shoot:' + parts[1], photo: parts[2] ? 'shoot:' + parts[1] + '/' + parts[2] : null };
  }
  if (parts.length < 2 || /^(tag|color|about|admin|og)$/.test(parts[0])) return null;
  return { unit: 'series:' + parts[0] + '/' + parts[1], photo: parts[2] ? parts.slice(0, 3).join('/') : null };
}

// photo_views row (already slimmed by the loader) → heat event, or null when it isn't about content we score
function fromView(v) {
  if (!v || v.bot || !v.ms) return null;
  var id = String(v.entityId || '');
  var who = v.ip || null;
  switch (v.entityType) {
    case 'shoot': return { kind: 'shoot', unit: 'shoot:' + id, target: id, visitor: who, ms: v.ms };
    case 'shoot-photo': {
      var slug = id.split('/')[0];
      return slug ? { kind: 'shoot-photo', unit: 'shoot:' + slug, photo: 'shoot:' + id, target: id, visitor: who, ms: v.ms } : null;
    }
    case 'country': return { kind: 'country', unit: 'country:' + id, target: id, visitor: who, ms: v.ms };
    case 'series': return { kind: 'series', unit: 'series:' + id, target: id, visitor: who, ms: v.ms };
    case 'photo':
    case 'inquiry':
    case 'review': {
      var p = id.split('/');
      if (p.length < 3) return null;
      return { kind: v.entityType, unit: 'series:' + p[0] + '/' + p[1], photo: id, target: id, visitor: who, ms: v.ms };
    }
    case 'instagram': {
      var u = unitOfPath(id);
      return u ? { kind: 'igclick', unit: u.unit, photo: u.photo, target: id, visitor: who, ms: v.ms } : null;
    }
  }
  return null;
}

// photoDownloads row → heat event (bots/admin are never logged there)
function fromDownload(d) {
  if (!d || !d.ms || !d.slug || PART[d.kind] !== 'downloads') return null;
  return {
    kind: d.kind, unit: 'shoot:' + d.slug, photo: d.photoId ? 'shoot:' + d.slug + '/' + d.photoId : null,
    target: d.kind + ':' + (d.photoId || d.slug), visitor: d.ip || null, ms: d.ms,
  };
}

// photoComments row ({ photoId: 'country_series_id' | 'shoot_slug_id', userId, ms }) → heat event
function fromComment(c) {
  if (!c || !c.ms || c.hidden) return null;
  var p = String(c.photoId || '').split('_');
  if (p.length < 3) return null;
  var visitor = c.userId ? 'g:' + c.userId : null;
  if (p[0] === 'shoot') {
    return { kind: 'comment', unit: 'shoot:' + p[1], photo: 'shoot:' + p[1] + '/' + p.slice(2).join('_'), target: c.photoId, visitor: visitor, ms: c.ms };
  }
  return { kind: 'comment', unit: 'series:' + p[0] + '/' + p[1], photo: p[0] + '/' + p[1] + '/' + p.slice(2).join('_'), target: c.photoId, visitor: visitor, ms: c.ms };
}

function emptyHeat() {
  return { score: 0, week: 0, prevWeek: 0, trend: 'flat', level: 0, parts: { page: 0, frames: 0, downloads: 0, actions: 0 } };
}

// events: [{ kind, unit, target, visitor, ms }] → { unit: heat } (levels across all given units)
function compute(events, opts) {
  opts = opts || {};
  var now = opts.now || Date.now();
  var keyOf = opts.key || function(e) { return e.unit; };
  var seen = {};
  var perDay = {};
  var out = {};

  events
    .filter(function(e) { return e && keyOf(e) && e.ms <= now && e.ms > now - WINDOW; })
    .sort(function(a, b) { return a.ms - b.ms; })
    .forEach(function(e, i) {
      var unit = keyOf(e);
      var day = Math.floor(e.ms / DAY);
      // events without a visitor (old download logs) can't be deduped — each counts
      var who = e.visitor || ('anon#' + i);
      var key = day + '|' + who + '|' + e.kind + '|' + e.target;
      if (seen[key]) return;
      seen[key] = true;

      var capKey = day + '|' + who + '|' + unit;
      var room = DAILY_CAP - (perDay[capKey] || 0);
      var w = Math.min(WEIGHTS[e.kind] || 0, room);
      if (w <= 0) return;
      perDay[capKey] = (perDay[capKey] || 0) + w;

      var h = out[unit] || (out[unit] = emptyHeat());
      var pts = w * Math.pow(0.5, (now - e.ms) / HALF_LIFE);
      h.score += pts;
      h.parts[PART[e.kind]] += pts;
      if (e.ms > now - 7 * DAY) h.week += w;
      else if (e.ms > now - 14 * DAY) h.prevWeek += w;
    });

  Object.keys(out).forEach(function(unit) { finish(out[unit]); });
  assignLevels(out);
  return out;
}

function round1(n) { return Math.round(n * 10) / 10; }

function finish(h) {
  h.score = round1(h.score);
  Object.keys(h.parts).forEach(function(k) { h.parts[k] = round1(h.parts[k]); });
  h.trend = trendOf(h.week, h.prevWeek);
  return h;
}

// ↑ / ↓ only for a real change: ±25% and at least 3 points apart
function trendOf(week, prev) {
  if (Math.abs(week - prev) < 3) return 'flat';
  if (week > prev * 1.25) return 'up';
  if (week < prev * 0.8) return 'down';
  return 'flat';
}

function assignLevels(heat) {
  var ranked = Object.keys(heat)
    .filter(function(k) { return heat[k].score >= LEVEL_FLOORS[1]; })
    .sort(function(a, b) { return heat[b].score - heat[a].score; });
  ranked.forEach(function(k, i) {
    var share = i / ranked.length;
    var h = heat[k];
    var level = share < 0.1 ? 3 : share < 0.3 ? 2 : 1;
    while (level > 1 && h.score < LEVEL_FLOORS[level]) level--;
    h.level = level;
  });
}

// unit map → { prefix-less key: heat } for one kind ('shoot:' / 'series:' / 'country:')
function pick(units, prefix) {
  var out = {};
  Object.keys(units).forEach(function(k) { if (k.indexOf(prefix) === 0) out[k.slice(prefix.length)] = units[k]; });
  return out;
}

// Everything the admin shows: { shoots: {slug}, series: {'c/s'}, countries: {c}, photos: {photoKey} }.
// Levels are ranked within each kind; a country is its own page + the sum of its series.
function computeAll(events, opts) {
  var units = compute(events, opts);
  var shoots = pick(units, 'shoot:');
  var series = pick(units, 'series:');
  var countries = pick(units, 'country:');
  assignLevels(shoots);
  assignLevels(series);

  Object.keys(series).forEach(function(sk) {
    var c = sk.split('/')[0];
    var s = series[sk];
    var h = countries[c] || (countries[c] = emptyHeat());
    h.score += s.score; h.week += s.week; h.prevWeek += s.prevWeek;
    Object.keys(h.parts).forEach(function(p) { h.parts[p] += s.parts[p]; });
  });
  Object.keys(countries).forEach(function(c) { finish(countries[c]); countries[c].level = 0; });
  assignLevels(countries);

  var photos = compute(events, Object.assign({}, opts, { key: function(e) { return e.photo; } }));
  return { shoots: shoots, series: series, countries: countries, photos: photos };
}

// heat for one key, never undefined (no activity)
function of(heat, key) {
  return (heat && heat[key]) || emptyHeat();
}

// 1-based place among the keys with any score, null when this one has none
function rankOf(heat, key) {
  var h = of(heat, key);
  if (!h.score) return { rank: null, of: Object.keys(heat || {}).filter(function(k) { return heat[k].score > 0; }).length };
  var keys = Object.keys(heat);
  return {
    rank: keys.filter(function(k) { return heat[k].score > h.score; }).length + 1,
    of: keys.filter(function(k) { return heat[k].score > 0; }).length,
  };
}

module.exports = {
  compute: compute, computeAll: computeAll, fromView: fromView, fromDownload: fromDownload, fromComment: fromComment,
  unitOfPath: unitOfPath, of: of, rankOf: rankOf,
  WEIGHTS: WEIGHTS, HALF_LIFE: HALF_LIFE, WINDOW: WINDOW, DAILY_CAP: DAILY_CAP,
};
