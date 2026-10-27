'use strict';
// Data for the admin dashboard (/admin): "needs attention" counters + recent shoots.
// Every data source is injected (see routes/photo-admin.js) so this is testable without Firestore.
// A source that throws yields count null — the page shows "—" instead of failing.
var DAY = 24 * 60 * 60 * 1000;
var RECENT_SHOOTS = 12;

// ISO string, 'YYYY-MM-DD', Date or Firestore Timestamp → ms (0 when missing/unparseable)
function toMs(v) {
  if (!v) return 0;
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  var t = Date.parse(v);
  return isNaN(t) ? 0 : t;
}

async function safe(fn) {
  try {
    return await fn();
  } catch (e) {
    console.error('[admin-dashboard]', e.message);
    return null;
  }
}

function coverOf(shoot) {
  var photos = shoot.photos || [];
  var pick = photos.find(function(p) { return p.id === shoot.heroPhotoId; })
    || photos.find(function(p) { return p.id === shoot.ogPhotoId; })
    || photos[0];
  return pick && pick.urls ? (pick.urls.thumb || pick.urls.preview || null) : null;
}

function recentShoots(shootsData) {
  return Object.keys(shootsData).map(function(slug) {
    var s = shootsData[slug];
    return {
      slug: slug,
      label: s.label,
      photoCount: (s.photos || []).length,
      public: !!s.public,
      hasPassword: !!s.password,
      cover: coverOf(s),
      createdAtMs: toMs(s.createdAt),
    };
  }).sort(function(a, b) { return b.createdAtMs - a.createdAtMs; }).slice(0, RECENT_SHOOTS);
}

var HOT_LIMIT = 5;
var HOT_FRAMES = 8;

function thumbOf(photo) {
  return photo && photo.urls ? (photo.urls.thumb || photo.urls.preview || null) : null;
}

function hottest(heat, keep, n) {
  return Object.keys(heat || {})
    .filter(function(k) { return keep(k) && heat[k].level > 0; })
    .sort(function(a, b) { return heat[b].score - heat[a].score; })
    .slice(0, n);
}

// "Горячие сейчас" (lib/photo-shoot-heat.js): shoots, gallery series and single frames with real activity.
async function hotContent(deps) {
  var heat = await deps.getHeat();
  var shootsData = deps.shootsData;
  var photoData = deps.photoData || {};
  var shoots = hottest(heat.shoots, function(slug) { return shootsData[slug]; }, HOT_LIMIT).map(function(slug) {
    var s = shootsData[slug];
    return Object.assign({ slug: slug, label: s.label, cover: coverOf(s), href: '/admin/shoots/' + slug + '/edit#stats' }, heat.shoots[slug]);
  });
  function seriesOf(key) {
    var p = key.split('/');
    var c = photoData[p[0]];
    return c && c.series && c.series[p[1]] ? { country: c, series: c.series[p[1]] } : null;
  }
  var series = hottest(heat.series, seriesOf, HOT_LIMIT).map(function(key) {
    var cs = seriesOf(key);
    return Object.assign({
      key: key, label: cs.series.label, sub: cs.country.label,
      cover: thumbOf((cs.series.photos || [])[0]), href: '/admin/' + key + '/edit#stats',
    }, heat.series[key]);
  });
  // frame keys: 'c/s/id' (gallery) or 'shoot:slug/id'
  function frameOf(key) {
    if (key.indexOf('shoot:') === 0) {
      var sp = key.slice(6).split('/');
      var sh = shootsData[sp[0]];
      var ph = sh && (sh.photos || []).find(function(x) { return x.id === sp[1]; });
      return ph ? { photo: ph, sub: sh.label, href: '/admin/shoots/' + sp[0] + '/photos/' + sp[1] + '/edit#frame-stats' } : null;
    }
    var gp = key.split('/');
    var cs = seriesOf(gp[0] + '/' + gp[1]);
    var gph = cs && (cs.series.photos || []).find(function(x) { return x.id === gp[2]; });
    return gph ? { photo: gph, sub: cs.series.label, href: '/admin/' + key + '/edit#frame-stats' } : null;
  }
  var frames = hottest(heat.photos, frameOf, HOT_FRAMES).map(function(key) {
    var fr = frameOf(key);
    return Object.assign({ key: key, label: fr.photo.title || fr.photo.id, sub: fr.sub, cover: thumbOf(fr.photo), href: fr.href }, heat.photos[key]);
  });
  return { shoots: shoots, series: series, frames: frames };
}

// Reviews/comments + guest points on shoot photos (neither has a "read" flag, so: last 7 days).
async function recentFeedbackCount(deps, now) {
  var since = now - 7 * DAY;
  var comments = (await deps.getComments(500)).filter(function(c) { return toMs(c.createdAt) >= since; }).length;
  var marks = 0;
  Object.keys(deps.shootsData).forEach(function(slug) {
    (deps.shootsData[slug].photos || []).forEach(function(p) {
      (p.annotations || []).forEach(function(a) {
        if (a.source === 'client' && toMs(a.createdAt) >= since) marks++;
      });
    });
  });
  return comments + marks;
}

// "Today" is a Tbilisi calendar day (fixed UTC+4, Georgia has no DST).
var TBILISI_OFFSET = 4 * 60 * 60 * 1000;

function startOfTbilisiDay(ms) {
  return Math.floor((ms + TBILISI_OFFSET) / DAY) * DAY - TBILISI_OFFSET;
}

function period(views, from, to, prevFrom, prevTo) {
  var count = 0, prev = 0;
  views.forEach(function(v) {
    if (v.bot) return;
    if (v.ms >= from && v.ms <= to) count++;
    else if (v.ms >= prevFrom && v.ms <= prevTo) prev++;
  });
  return { count: count, prev: prev, deltaPct: prev ? Math.round((count - prev) / prev * 100) : null };
}

// Today so far vs yesterday up to the same time (a whole yesterday would make every morning look
// like a drop); last 7 days vs the 7 before.
async function viewsSummary(deps, now) {
  var views = await deps.getRecentViews(now - 14 * DAY);
  var today = startOfTbilisiDay(now);
  return {
    today: period(views, today, now, today - DAY, now - DAY),
    week: period(views, now - 7 * DAY, now, now - 14 * DAY, now - 7 * DAY - 1),
  };
}

// deps: { now, shootsData, getCopyrightHits(opts), getComments(limit), listLeads(filter), countAnonFaceGroups(),
//         getRecentViews(sinceMs) → [{ ms, bot }], photoData, getHeat() → { shoots, series, countries, photos } }
async function buildDashboard(deps) {
  var now = deps.now || Date.now();
  deps = Object.assign({ getHeat: async function() { return { shoots: {}, series: {}, photos: {} }; } }, deps, { shootsData: deps.shootsData || {} });
  var counts = await Promise.all([
    safe(async function() { return (await deps.getCopyrightHits({ onlyNew: true })).length; }),
    safe(function() { return recentFeedbackCount(deps, now); }),
    safe(async function() {
      return (await deps.listLeads({ zone: 'hot' })).filter(function(l) { return (l.foundAt || 0) >= now - DAY; }).length;
    }),
    safe(async function() { return deps.countAnonFaceGroups(); }),
    safe(function() { return viewsSummary(deps, now); }),
    safe(function() { return hotContent(deps); }),
  ]);
  return {
    views: counts[4],
    hot: counts[5],
    attention: [
      { key: 'copyright', label: 'Новые использования фото', count: counts[0], href: '/admin/copyright?filter=new' },
      { key: 'feedback', label: 'Отзывы и метки за 7 дней', count: counts[1], href: '/admin/feedback' },
      { key: 'leads', label: 'Горячие лиды за сутки', count: counts[2], href: '/admin/leads' },
      { key: 'faces', label: 'Нераспознанные группы лиц', count: counts[3], href: '/admin/people' },
    ],
    recentShoots: recentShoots(deps.shootsData),
  };
}

module.exports = { buildDashboard: buildDashboard };
