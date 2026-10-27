'use strict';

// Statistics of a page + its frames for the "Статистика" tabs of the admin: a shoot
// (/admin/shoots/:slug/edit) or a gallery series (/admin/:country/:series/edit).
//
// Views come from photo_views (one doc per hit, see lib/photo-stats.js): the page itself
// (entityType 'shoot' / 'series') and its frames ('shoot-photo' 'slug/photoId' / 'photo' 'c/s/photoId'),
// plus visitor actions logged there too (gallery 'inquiry' / 'review', same ids as the frames). Frames are
// fetched with `entityId in [...]` chunks of 30 (Firestore's `in` limit) so the query reuses the
// same env+entityType+entityId+timestamp index as /admin/stats/entity — no new index needed.

var ACTION_TYPES = { inquiry: 1, review: 1 };

// what to load / how to read it for each kind of page
function shootSpec(slug, photoIds) {
  return { pageType: 'shoot', pageId: slug, frameType: 'shoot-photo', prefix: slug + '/', frameIds: photoIds, actionTypes: [] };
}
function seriesSpec(countryKey, seriesKey, photoIds) {
  var id = countryKey + '/' + seriesKey;
  return { pageType: 'series', pageId: id, frameType: 'photo', prefix: id + '/', frameIds: photoIds, actionTypes: ['inquiry', 'review'] };
}

var DAY_MS = 24 * 60 * 60 * 1000;
var IN_CHUNK = 30;
var OWN_HOST_RE = /(^|\.)dimazvali\.com$|^localhost$|(^|\.)localhost$/i;

function refererHost(ref) {
  if (!ref) return null;
  try { return new URL(ref).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return null; }
}

// events: [{ entityType, entityId, ms, bot, deviceType, path, referer, ip }]
// → numbers for the tab. Pure, so it's tested without Firestore.
// opts: { days, now?, slug (shoot) | prefix + pageType (any page) }
function summarize(events, opts) {
  var days = opts.days;
  var now = opts.now || Date.now();
  var prefix = opts.prefix || (opts.slug + '/');
  var pageType = opts.pageType || 'shoot';

  var byDay = {};
  var devices = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
  var lang = { ru: 0, en: 0 };
  var referers = {};
  var photoCounts = {};
  var visitors = {};
  var total = { page: 0, photos: 0 };
  var actions = { inquiry: 0, review: 0 };
  var bots = 0;

  events.forEach(function(e) {
    if (e.bot) { bots++; return; }
    if (!e.ms) return;
    if (ACTION_TYPES[e.entityType]) { actions[e.entityType]++; return; }
    var isPage = e.entityType === pageType;
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
      var pid = String(e.entityId || '').slice(prefix.length);
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
    actions: actions,
  };
}

// Loads photo_views for the shoot page + its frames over the last `days` days.
function loadEvents(db, env, slug, photoIds, days, now) {
  return loadSpecEvents(db, env, shootSpec(slug, photoIds), days, now);
}

// spec: shootSpec() / seriesSpec() — the page, its frames and the frame-level actions
async function loadSpecEvents(db, env, spec, days, now) {
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
  var queries = [q(spec.pageType, 'entityId', '==', spec.pageId)];
  for (var i = 0; i < spec.frameIds.length; i += IN_CHUNK) {
    var ids = spec.frameIds.slice(i, i + IN_CHUNK).map(function(id) { return spec.prefix + id; });
    [spec.frameType].concat(spec.actionTypes).forEach(function(type) { queries.push(q(type, 'entityId', 'in', ids)); });
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

module.exports = {
  summarize: summarize, loadEvents: loadEvents, loadSpecEvents: loadSpecEvents,
  shootSpec: shootSpec, seriesSpec: seriesSpec, refererHost: refererHost,
};
