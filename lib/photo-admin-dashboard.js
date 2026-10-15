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

// deps: { now, shootsData, getCopyrightHits(opts), getComments(limit), listLeads(filter), countAnonFaceGroups() }
async function buildDashboard(deps) {
  var now = deps.now || Date.now();
  deps = Object.assign({}, deps, { shootsData: deps.shootsData || {} });
  var counts = await Promise.all([
    safe(async function() { return (await deps.getCopyrightHits({ onlyNew: true })).length; }),
    safe(function() { return recentFeedbackCount(deps, now); }),
    safe(async function() {
      return (await deps.listLeads({ zone: 'hot' })).filter(function(l) { return (l.foundAt || 0) >= now - DAY; }).length;
    }),
    safe(async function() { return deps.countAnonFaceGroups(); }),
  ]);
  return {
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
