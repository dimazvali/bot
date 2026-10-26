'use strict';

// Per-shoot statistics for the "Статистика" tab of /admin/shoots/:slug/edit.
//
// Views come from photo_views (one doc per hit, see lib/photo-stats.js): the shoot page itself
// (entityType 'shoot', entityId slug) and its frames ('shoot-photo', 'slug/photoId'). Frames are
// fetched with `entityId in [...]` chunks of 30 (Firestore's `in` limit) so the query reuses the
// same env+entityType+entityId+timestamp index as /admin/stats/entity — no new index needed.

var DAY_MS = 24 * 60 * 60 * 1000;
var IN_CHUNK = 30;
var OWN_HOST_RE = /(^|\.)dimazvali\.com$|^localhost$|(^|\.)localhost$/i;

function refererHost(ref) {
  if (!ref) return null;
  try { return new URL(ref).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return null; }
}

// events: [{ entityType, entityId, ms, bot, deviceType, path, referer, ip }]
// → numbers for the tab. Pure, so it's tested without Firestore.
function summarize(events, opts) {
  var days = opts.days;
  var now = opts.now || Date.now();
  var slug = opts.slug;

  var byDay = {};
  var devices = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
  var lang = { ru: 0, en: 0 };
  var referers = {};
  var photoCounts = {};
  var visitors = {};
  var total = { page: 0, photos: 0 };
  var bots = 0;

  events.forEach(function(e) {
    if (e.bot) { bots++; return; }
    if (!e.ms) return;
    var isPage = e.entityType === 'shoot';
    var day = new Date(e.ms).toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = { page: 0, photos: 0 };
    byDay[day][isPage ? 'page' : 'photos']++;
    total[isPage ? 'page' : 'photos']++;
    devices[devices[e.deviceType] !== undefined ? e.deviceType : 'unknown']++;
    lang[/^\/en(\/|$)/.test(e.path || '') ? 'en' : 'ru']++;
    if (e.ip) visitors[e.ip] = true;
    var host = refererHost(e.referer);
    // internal navigation (gallery → frame) isn't a traffic source
    if (!host || !OWN_HOST_RE.test(host)) {
      var key = host || 'прямые / без referer';
      referers[key] = (referers[key] || 0) + 1;
    }
    if (!isPage) {
      var pid = String(e.entityId || '').slice(slug.length + 1);
      if (pid) photoCounts[pid] = (photoCounts[pid] || 0) + 1;
    }
  });

  var allDays = [];
  for (var i = days - 1; i >= 0; i--) {
    var d = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
    var v = byDay[d] || { page: 0, photos: 0 };
    allDays.push({ day: d, page: v.page, photos: v.photos });
  }

  function top(obj, n) {
    return Object.keys(obj)
      .map(function(k) { return { key: k, count: obj[k] }; })
      .sort(function(a, b) { return b.count - a.count; })
      .slice(0, n);
  }

  return {
    days: days,
    total: total,
    bots: bots,
    visitors: Object.keys(visitors).length,
    allDays: allDays,
    maxDay: Math.max.apply(null, allDays.map(function(x) { return x.page + x.photos; }).concat([1])),
    devices: devices,
    lang: lang,
    referers: top(referers, 8),
    topPhotos: top(photoCounts, 10).map(function(x) { return { id: x.key, count: x.count }; }),
  };
}

// Loads photo_views for the shoot page + its frames over the last `days` days.
async function loadEvents(db, env, slug, photoIds, days, now) {
  var since = new Date((now || Date.now()) - days * DAY_MS);
  function q(entityType, field, op, value) {
    return db.collection('photo_views')
      .where('env', '==', env)
      .where('entityType', '==', entityType)
      .where(field, op, value)
      .where('timestamp', '>=', since)
      .orderBy('timestamp', 'desc')
      .limit(5000)
      .select('entityType', 'entityId', 'timestamp', 'bot', 'deviceType', 'path', 'referer', 'ip')
      .get();
  }
  var queries = [q('shoot', 'entityId', '==', slug)];
  for (var i = 0; i < photoIds.length; i += IN_CHUNK) {
    var ids = photoIds.slice(i, i + IN_CHUNK).map(function(id) { return slug + '/' + id; });
    queries.push(q('shoot-photo', 'entityId', 'in', ids));
  }
  var snaps = await Promise.all(queries);
  var events = [];
  snaps.forEach(function(snap) {
    snap.docs.forEach(function(doc) {
      var d = doc.data();
      events.push({
        entityType: d.entityType, entityId: d.entityId, ms: d.timestamp ? d.timestamp.toMillis() : 0,
        bot: !!d.bot, deviceType: d.deviceType, path: d.path, referer: d.referer, ip: d.ip,
      });
    });
  });
  return events;
}

module.exports = { summarize: summarize, loadEvents: loadEvents, refererHost: refererHost };
