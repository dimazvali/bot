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

var HOT_SHOOTS = 5;

// Top shoots by "heat" (lib/photo-shoot-heat.js) — only ones with a level, i.e. some real activity.
async function hotShoots(deps) {
  var heat = await deps.getShootHeat();
  return Object.keys(heat)
    .filter(function(slug) { return deps.shootsData[slug] && heat[slug].level > 0; })
    .sort(function(a, b) { return heat[b].score - heat[a].score; })
    .slice(0, HOT_SHOOTS)
    .map(function(slug) {
      var s = deps.shootsData[slug];
      return Object.assign({ slug: slug, label: s.label, cover: coverOf(s) }, heat[slug]);
    });
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
//         getRecentViews(sinceMs) → [{ ms, bot }], getShootHeat() → { slug: heat } }
async function buildDashboard(deps) {
  var now = deps.now || Date.now();
  deps = Object.assign({ getShootHeat: async function() { return {}; } }, deps, { shootsData: deps.shootsData || {} });
  var counts = await Promise.all([
    safe(async function() { return (await deps.getCopyrightHits({ onlyNew: true })).length; }),
    safe(function() { return recentFeedbackCount(deps, now); }),
    safe(async function() {
      return (await deps.listLeads({ zone: 'hot' })).filter(function(l) { return (l.foundAt || 0) >= now - DAY; }).length;
    }),
    safe(async function() { return deps.countAnonFaceGroups(); }),
    safe(function() { return viewsSummary(deps, now); }),
    safe(function() { return hotShoots(deps); }),
  ]);
  return {
    views: counts[4],
    hotShoots: counts[5],
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
