'use strict';

// "Горячесть" of shoots: what people are looking at / taking right now.
//
// Every visitor action has a weight that grows with intent (page view < frame view < frame download <
// archive download). Each counts once per visitor+target+day, one visitor gives a shoot at most
// DAILY_CAP points a day (a client paging through 200 frames of their own wedding must not make it
// "hot" alone), and points halve every HALF_LIFE (score = Σ weight · 0.5^(age / HALF_LIFE)).
// Levels 1–3 are relative to the other shoots (top 10% / next 20% / the rest), with absolute floors
// so a quiet week doesn't hand out three flames for a couple of views.
//
// Pure — events come from photo_views and photoDownloads (see routes/photo-admin.js), tested in
// test/photo-shoot-heat.test.js.

var DAY = 24 * 60 * 60 * 1000;
var WEIGHTS = { shoot: 1, 'shoot-photo': 2, ig: 5, sel: 8, zip: 10 };
var PART = { shoot: 'page', 'shoot-photo': 'frames', ig: 'downloads', sel: 'downloads', zip: 'downloads' };
var HALF_LIFE = 7 * DAY;
var WINDOW = 28 * DAY; // 4 half-lives: an event at the edge still weighs ~6%
var DAILY_CAP = 20;
// on prod (Oct 2026) 1–3 points is "one or two views a few weeks ago" — not worth a flame
var LEVEL_FLOORS = { 3: 20, 2: 8, 1: 3 };

// photo_views doc (already slimmed by the loader) → heat event, or null when it isn't about a shoot
function fromView(v) {
  if (!v || v.bot || !v.ms) return null;
  if (v.entityType === 'shoot') return { kind: 'shoot', slug: v.entityId, target: v.entityId, visitor: v.ip || null, ms: v.ms };
  if (v.entityType === 'shoot-photo') {
    var slug = String(v.entityId || '').split('/')[0];
    return slug ? { kind: 'shoot-photo', slug: slug, target: v.entityId, visitor: v.ip || null, ms: v.ms } : null;
  }
  return null;
}

// photoDownloads doc → heat event (bots/admin are never logged there)
function fromDownload(d) {
  if (!d || !d.ms || !d.slug || !WEIGHTS[d.kind]) return null;
  return { kind: d.kind, slug: d.slug, target: d.kind + ':' + (d.photoId || d.slug), visitor: d.ip || null, ms: d.ms };
}

function emptyHeat() {
  return { score: 0, week: 0, prevWeek: 0, trend: 'flat', level: 0, parts: { page: 0, frames: 0, downloads: 0 } };
}

// events: [{ kind, slug, target, visitor, ms }] → { slug: heat }
function compute(events, opts) {
  opts = opts || {};
  var now = opts.now || Date.now();
  var seen = {};
  var perDay = {};
  var out = {};

  events
    .filter(function(e) { return e && e.ms <= now && e.ms > now - WINDOW; })
    .sort(function(a, b) { return a.ms - b.ms; })
    .forEach(function(e, i) {
      var day = Math.floor(e.ms / DAY);
      // events without a visitor (old download logs) can't be deduped — each counts
      var who = e.visitor || ('anon#' + i);
      var key = day + '|' + who + '|' + e.kind + '|' + e.target;
      if (seen[key]) return;
      seen[key] = true;

      var capKey = day + '|' + who + '|' + e.slug;
      var room = DAILY_CAP - (perDay[capKey] || 0);
      var w = Math.min(WEIGHTS[e.kind], room);
      if (w <= 0) return;
      perDay[capKey] = (perDay[capKey] || 0) + w;

      var h = out[e.slug] || (out[e.slug] = emptyHeat());
      var pts = w * Math.pow(0.5, (now - e.ms) / HALF_LIFE);
      h.score += pts;
      h.parts[PART[e.kind]] += pts;
      if (e.ms > now - 7 * DAY) h.week += w;
      else if (e.ms > now - 14 * DAY) h.prevWeek += w;
    });

  Object.keys(out).forEach(function(slug) {
    var h = out[slug];
    h.score = round1(h.score);
    Object.keys(h.parts).forEach(function(k) { h.parts[k] = round1(h.parts[k]); });
    h.trend = trendOf(h.week, h.prevWeek);
  });
  assignLevels(out);
  return out;
}

function round1(n) { return Math.round(n * 10) / 10; }

// ↑ / ↓ only for a real change: ±25% and at least 3 points apart
function trendOf(week, prev) {
  if (Math.abs(week - prev) < 3) return 'flat';
  if (week > prev * 1.25) return 'up';
  if (week < prev * 0.8) return 'down';
  return 'flat';
}

function assignLevels(heat) {
  var ranked = Object.keys(heat)
    .filter(function(s) { return heat[s].score >= LEVEL_FLOORS[1]; })
    .sort(function(a, b) { return heat[b].score - heat[a].score; });
  ranked.forEach(function(slug, i) {
    var share = i / ranked.length;
    var h = heat[slug];
    var level = share < 0.1 ? 3 : share < 0.3 ? 2 : 1;
    while (level > 1 && h.score < LEVEL_FLOORS[level]) level--;
    h.level = level;
  });
}

// heat for one slug, never undefined (a shoot with no activity)
function of(heat, slug) {
  return (heat && heat[slug]) || emptyHeat();
}

module.exports = {
  compute: compute, fromView: fromView, fromDownload: fromDownload, of: of,
  WEIGHTS: WEIGHTS, HALF_LIFE: HALF_LIFE, WINDOW: WINDOW, DAILY_CAP: DAILY_CAP,
};
