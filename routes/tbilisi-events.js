'use strict';
var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { getStorage } = require('firebase-admin/storage');
var eventsData = require('../lib/tbilisi-events-data');
var images = require('../lib/tbilisi-events-images');
var taxonomy = require('../lib/tbilisi-events-taxonomy');
var i18n = require('../lib/tbilisi-events-i18n');
var teUsers = require('../lib/tbilisi-events-users');
var teMailer = require('../lib/tbilisi-events-mailer');
var views = require('../lib/tbilisi-events-views');

var tbilisiEventsApp = getApps().find(function(a) { return a.name === 'tbilisiEvents'; }) || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: (process.env.sssGCPKey || '').replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
    client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }),
}, 'tbilisiEvents');

var fb = getFirestore(tbilisiEventsApp);
eventsData.init(fb);
images.init(getStorage(tbilisiEventsApp));
teUsers.init(fb);
teMailer.init();

function isSafeUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function sanitizeEvents(events) {
  return (events || []).map(function(event) {
    var sources = (event.sources || []).map(function(source) {
      return { label: source.label, url: source.url, safe: isSafeUrl(source.url) };
    });
    return Object.assign({}, event, { sources: sources });
  });
}

function buildCalendar(events, todayStr, monthStr, selectedDate, monthNames) {
  var monthPrefix = monthStr;
  var year = parseInt(monthStr.slice(0, 4), 10);
  var month = parseInt(monthStr.slice(5, 7), 10) - 1; // 0-indexed

  var counts = {};
  events.forEach(function(e) {
    if (e.date && e.date.slice(0, 7) === monthPrefix) counts[e.date] = (counts[e.date] || 0) + 1;
  });

  var firstOfMonth = new Date(Date.UTC(year, month, 1));
  var daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  var startWeekday = (firstOfMonth.getUTCDay() + 6) % 7; // 0 = Monday

  var cells = [];
  for (var i = 0; i < startWeekday; i++) cells.push(null);
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = monthPrefix + '-' + (d < 10 ? '0' + d : d);
    cells.push({
      date: dateStr, day: d, count: counts[dateStr] || 0,
      isToday: dateStr === todayStr, isPast: dateStr < todayStr, isSelected: dateStr === selectedDate,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  var weeks = [];
  for (var w = 0; w < cells.length; w += 7) weeks.push(cells.slice(w, w + 7));

  var prevDate = new Date(Date.UTC(year, month - 1, 1));
  var nextDate = new Date(Date.UTC(year, month + 1, 1));

  return {
    monthLabel: monthNames[month] + ' ' + year,
    weeks: weeks,
    year: year,
    month: month + 1,
    prevYear: prevDate.getUTCFullYear(),
    prevMonth: prevDate.getUTCMonth() + 1,
    nextYear: nextDate.getUTCFullYear(),
    nextMonth: nextDate.getUTCMonth() + 1,
  };
}

function isoDay(d) {
  return d.getUTCFullYear() + '-'
    + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-'
    + ('0' + d.getUTCDate()).slice(-2);
}

function langQuery(lang) {
  return lang && lang !== 'ru' ? '?lang=' + lang : '';
}

// "Закрыто" / "Закрыто с 15 мар 2026" for a closed venue; null when it operates.
function venueClosedLabel(v, lang) {
  if (!v || !v.closed) return null;
  var ui = i18n.UI[lang];
  return v.closedDate
    ? ui.venueClosedSince + ' ' + i18n.formatShortDay(v.closedDate, lang)
    : ui.venueClosed;
}

// ---- absolute-URL + SEO helpers -------------------------------------------
// TLS terminates at a reverse proxy, so trust X-Forwarded-Proto and assume
// https for the public *.tbiliseli.com hosts.
function siteOrigin(req) {
  var host = req.get('host') || 'events.tbiliseli.com';
  var proto = req.headers['x-forwarded-proto']
    || (/tbiliseli\.com$/i.test(host.split(':')[0]) ? 'https' : req.protocol);
  return proto + '://' + host;
}
function absUrl(req, path) {
  return siteOrigin(req) + req.teBase + (path || '');
}
function xmlEscape(s) {
  return String(s == null ? '' : s).replace(/[<>&'"]/g, function(c) {
    return { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c];
  });
}
function toDateOnly(v) {
  if (!v) return null;
  var d = v && v.toDate ? v.toDate() : new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
var SITE_NAME = 'Tbiliseli Events';
// schema.org graph wrapper — nodes omit their own @context.
function ldGraph(nodes) {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) };
}
function breadcrumbLd(crumbs) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: (crumbs || []).map(function(c, i) {
      var node = { '@type': 'ListItem', position: i + 1, name: c.label };
      if (c.abs) node.item = c.abs;
      return node;
    }),
  };
}
function itemListLd(name, items) {
  return {
    '@type': 'ItemList',
    name: name,
    numberOfItems: items.length,
    itemListElement: items.map(function(it, i) {
      return { '@type': 'ListItem', position: i + 1, url: it.url, name: it.name };
    }),
  };
}

// Mirrors requireAuth in routes/tbilisi-events-admin.js — used only to decide
// whether to show the inline "edit" shortcut on public pages.
async function isAdmin(req) {
  var val = req.cookies && req.cookies.tbilisiEventsAdminToken;
  if (!val) return false;
  var envPass = process.env.TBILISI_EVENTS_ADMIN_PASS;
  if (envPass && val === crypto.createHash('sha256').update('tbilisiEvents:' + envPass).digest('hex')) return true;
  try {
    return !!(await eventsData.getAdminByPasswordHash(val));
  } catch (e) {
    return false;
  }
}

// Attach the display fields the views expect onto a sanitized event.
// `base` is req.teBase ('' on the subdomain, '/tbilisi-events' on the path mount).
function decorateEvent(e, lang, venueById, base) {
  var typeLabelsL = i18n.EVENT_TYPE_LABELS[lang];
  var langLabelsL = i18n.LANGUAGE_LABELS[lang];
  e.venueName = e.venueId && venueById[e.venueId] ? venueById[e.venueId].name : null;
  e.dateShort = i18n.formatShortDay(e.date, lang);
  e.weekdayShort = i18n.weekdayShort(e.date, lang);
  e.desc = i18n.pickDescription(e.description, lang);
  e.typeLabel = e.type ? (typeLabelsL[e.type] || e.type) : '';
  e.langBadge = (e.language || []).map(function(c) { return String(c).toUpperCase(); }).join(' / ');
  e.langLabel = (e.language || []).map(function(c) { return langLabelsL[c] || c; }).join(', ');
  e.primaryUrl = (e.sources.find(function(s) { return s.safe; }) || {}).url || null;
  e.href = base + '/e/' + (e.slug || e.id) + langQuery(lang);
  var vObj = e.venueId ? venueById[e.venueId] : null;
  e.venueHref = vObj ? base + '/venues/' + (vObj.slug || vObj.id || e.venueId) + langQuery(lang) : null;
  e.editorNoteText = i18n.pickDescription(e.editorNote, lang);
  e.cancelledLabel = e.cancelled ? i18n.UI[lang].cancelled : '';
  e.displayTitle = i18n.pickDescription(e.titleI18n, lang) || e.title;
  return e;
}

// Public pages must always reflect the latest data — no shared staleness window —
// but repeat navigation should stay cheap: revalidate every time and let the
// weak ETag on the rendered HTML turn an unchanged load into a 304 (body reused,
// only headers on the wire). Requests carrying the admin cookie get the inline
// "edit" control, so keep those responses out of any shared cache.
router.use(function(req, res, next) {
  req.teBase = req.teBase || '';
  res.locals.base = req.teBase;
  res.locals.loginHref = req.teBase + '/login?next=' + encodeURIComponent(req.originalUrl);
  if (req.method === 'GET') {
    var isAdminReq = !!(req.cookies && req.cookies.tbilisiEventsAdminToken);
    res.set('Cache-Control', isAdminReq ? 'private, no-cache' : 'no-cache');
  }
  next();
});

router.use(teUsers.attachUser);
router.use(require('./tbilisi-events-account'));

// ---- robots.txt + sitemap.xml -------------------------------------------
router.get('/robots.txt', function(req, res) {
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('text/plain').send([
    'User-agent: *',
    'Disallow: /admin',
    'Disallow: /login',
    'Disallow: /auth/',
    'Disallow: /me',
    'Disallow: /suggest',
    'Disallow: /organizer/',
    'Disallow: /favorites',
    '',
    'Sitemap: ' + absUrl(req, '/sitemap.xml'),
    '',
  ].join('\n'));
});

router.get('/sitemap.xml', async function(req, res, next) {
  try {
    var today = new Date().toISOString().slice(0, 10);
    // Keep the map bounded: drop events that ended more than ~6 weeks ago.
    var horizon = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
    var events = (await eventsData.getPublicEvents())
      .filter(function(e) { return !e.date || e.date >= horizon; });
    var venues = await eventsData.getVenues();
    var collections = await eventsData.getPublishedCollections();

    var entries = [
      { loc: absUrl(req, '/'), lastmod: today, changefreq: 'hourly', priority: '1.0' },
      { loc: absUrl(req, '/venues'), lastmod: today, changefreq: 'daily', priority: '0.6' },
      { loc: absUrl(req, '/collections'), lastmod: today, changefreq: 'daily', priority: '0.6' },
    ];
    events.forEach(function(e) {
      entries.push({
        loc: absUrl(req, '/e/' + (e.slug || e.id)),
        lastmod: toDateOnly(e.updatedAt), changefreq: 'weekly', priority: '0.8',
      });
    });
    venues.forEach(function(v) {
      entries.push({
        loc: absUrl(req, '/venues/' + (v.slug || v.id)),
        lastmod: toDateOnly(v.updatedAt), changefreq: 'monthly', priority: '0.5',
      });
    });
    collections.forEach(function(c) {
      entries.push({
        loc: absUrl(req, '/collections/' + (c.slug || c.id)),
        lastmod: toDateOnly(c.updatedAt), changefreq: 'weekly', priority: '0.5',
      });
    });

    var body = entries.map(function(u) {
      var alts = i18n.LANGS.map(function(l) {
        var href = u.loc + (l === 'ru' ? '' : (u.loc.indexOf('?') === -1 ? '?' : '&') + 'lang=' + l);
        return '    <xhtml:link rel="alternate" hreflang="' + l + '" href="' + xmlEscape(href) + '"/>';
      });
      alts.push('    <xhtml:link rel="alternate" hreflang="x-default" href="' + xmlEscape(u.loc) + '"/>');
      return '  <url>\n'
        + '    <loc>' + xmlEscape(u.loc) + '</loc>\n'
        + (u.lastmod ? '    <lastmod>' + u.lastmod + '</lastmod>\n' : '')
        + alts.join('\n') + '\n'
        + (u.changefreq ? '    <changefreq>' + u.changefreq + '</changefreq>\n' : '')
        + (u.priority ? '    <priority>' + u.priority + '</priority>\n' : '')
        + '  </url>';
    }).join('\n');

    res.set('Cache-Control', 'public, max-age=3600');
    res.type('application/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
      + body + '\n</urlset>\n'
    );
  } catch (e) { next(e); }
});

router.get('/', async function(req, res, next) {
  try {
    var lang = i18n.normalizeLang(req.query.lang);
    var t = i18n.UI[lang];
    var typeLabelsL = i18n.EVENT_TYPE_LABELS[lang];

    var events = sanitizeEvents(await eventsData.getPublicEvents());
    var venues = await eventsData.getVenues();
    var venueById = {};
    venues.forEach(function(v) { venueById[v.id] = v; });
    events.forEach(function(e) { decorateEvent(e, lang, venueById, req.teBase); });

    var LIST_CAP = 40;
    var typeParam = taxonomy.EVENT_TYPE_SLUGS.indexOf(req.query.type) !== -1 ? req.query.type : null;
    var today = new Date().toISOString().slice(0, 10);
    var showAll = req.query.all === '1';
    var fullList = req.query.full === '1';
    var dateParam = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : null;

    var yearParam = parseInt(req.query.year, 10);
    var monthParam = parseInt(req.query.month, 10);
    var monthStr;
    if (yearParam && monthParam >= 1 && monthParam <= 12) {
      monthStr = yearParam + '-' + (monthParam < 10 ? '0' + monthParam : monthParam);
    } else if (dateParam) {
      monthStr = dateParam.slice(0, 7);
    } else {
      monthStr = today.slice(0, 7);
    }

    // href builder — every internal link carries the current lang; other params
    // are inherited unless explicitly overridden (pass null to drop one).
    function href(o) {
      o = o || {};
      var p = {};
      p.lang = o.lang !== undefined ? o.lang : lang;
      var all = o.all !== undefined ? o.all : showAll;
      var date = o.date !== undefined ? o.date : dateParam;
      var type = o.type !== undefined ? o.type : typeParam;
      var full = o.full !== undefined ? o.full : fullList;
      var q = [];
      if (p.lang && p.lang !== 'ru') q.push('lang=' + p.lang);
      if (all) q.push('all=1');
      if (full) q.push('full=1');
      if (date) q.push('date=' + date);
      if (type) q.push('type=' + type);
      return req.teBase + '/' + (q.length ? '?' + q.join('&') : '');
    }

    var upcomingAll = events.filter(function(e) { return e.date >= today; });
    var typeUpcoming = typeParam ? upcomingAll.filter(function(e) { return e.type === typeParam; }) : upcomingAll;

    var visibleEvents;
    if (dateParam) {
      visibleEvents = events.filter(function(e) { return e.date === dateParam; });
      if (typeParam) visibleEvents = visibleEvents.filter(function(e) { return e.type === typeParam; });
    } else if (showAll) {
      visibleEvents = typeParam ? events.filter(function(e) { return e.type === typeParam; }) : events.slice();
    } else {
      visibleEvents = typeUpcoming.slice();
    }

    // Hero, on the default / type-filtered view only: an editor's pick first,
    // otherwise the first upcoming event with an image / a description.
    var hero = null;
    if (!dateParam && visibleEvents.length) {
      var picks = visibleEvents.filter(function(e) { return e.editorsPick && !e.cancelled; });
      hero = picks.filter(function(e) { return e.imageUrl; })[0]
        || picks[0]
        || visibleEvents.filter(function(e) { return e.imageUrl; })[0]
        || visibleEvents.filter(function(e) { return e.desc; })[0]
        || visibleEvents[0];
    }
    var listEvents = hero
      ? visibleEvents.filter(function(e) { return e.id !== hero.id; })
      : visibleEvents;
    var totalVisible = visibleEvents.length;

    // Cap the default upcoming list; a single-date view, ?all=1 and ?full=1 are uncapped.
    var listTruncated = false;
    if (!dateParam && !showAll && !fullList && listEvents.length > LIST_CAP) {
      listTruncated = true;
      listEvents = listEvents.slice(0, LIST_CAP);
    }

    // Horizontal date strip: next 14 days, counts from the current type filter.
    var stripCounts = {};
    typeUpcoming.forEach(function(e) { stripCounts[e.date] = (stripCounts[e.date] || 0) + 1; });
    var base = new Date(today + 'T00:00:00Z');
    var dayStrip = [];
    for (var i = 0; i < 14; i++) {
      var dd = new Date(base.getTime() + i * 86400000);
      var ds = isoDay(dd);
      dayStrip.push({
        date: ds,
        wd: i18n.weekdayShort(ds, lang),
        dm: i18n.formatShortDay(ds, lang),
        count: stripCounts[ds] || 0,
        active: ds === dateParam,
        href: href({ date: ds }),
      });
    }

    // Weekend block: the upcoming Saturday + Sunday.
    var weekend = [];
    if (!dateParam) {
      var wkDates = [];
      for (var w = 0; w < 14; w++) {
        var wdt = new Date(base.getTime() + w * 86400000);
        var dow = wdt.getUTCDay();
        if (dow === 6 || dow === 0) {
          wkDates.push(isoDay(wdt));
          if (wkDates.length === 2) break;
        }
      }
      weekend = typeUpcoming
        .filter(function(e) { return wkDates.indexOf(e.date) !== -1; })
        .filter(function(e) { return !hero || e.id !== hero.id; })
        .slice(0, 6)
        .map(function(e) {
          return {
            wd: i18n.formatLongDate(e.date, lang),
            title: e.displayTitle,
            meta: [e.time, e.venueName || e.place, e.typeLabel].filter(Boolean).join(' · '),
            href: e.href,
          };
        });
    }

    // Rubrics grid: event types present in the upcoming set, with counts.
    var rubrics = taxonomy.EVENT_TYPE_SLUGS.map(function(slug) {
      return {
        slug: slug,
        label: typeLabelsL[slug] || slug,
        count: upcomingAll.filter(function(e) { return e.type === slug; }).length,
        href: href({ type: slug, date: null, all: false }),
      };
    }).filter(function(r) { return r.count > 0; });

    var navLinks = [{
      label: t.today, href: href({ type: null, date: null, all: false }), active: !typeParam && !dateParam && !showAll,
    }].concat(taxonomy.EVENT_TYPE_SLUGS.map(function(slug) {
      return { label: typeLabelsL[slug] || slug, href: href({ type: slug, date: null, all: false }), active: typeParam === slug };
    }));

    var langLinks = i18n.LANGS.map(function(c) {
      return { code: c.toUpperCase(), href: href({ lang: c }), active: c === lang };
    });

    // Curated collections strip (published only).
    var homeHeroes = await eventsData.getHeroes();
    var homeHeroById = {};
    homeHeroes.forEach(function(h) { homeHeroById[h.id] = h; });
    var curated = (await eventsData.getPublishedCollections()).map(function(c) {
      var h = c.heroId ? homeHeroById[c.heroId] : null;
      return {
        title: i18n.pickDescription(c.title, lang),
        heroName: h ? i18n.pickDescription(h.name, lang) : '',
        heroImage: h ? (h.imageUrl || null) : null,
        href: req.teBase + '/collections/' + (c.slug || c.id) + langQuery(lang),
      };
    }).filter(function(c) { return c.title; });

    var calendar = buildCalendar(events, today, monthStr, dateParam, i18n.MONTH_NOM[lang]);
    var lq = lang !== 'ru' ? '&lang=' + lang : '';
    calendar.prevHref = req.teBase + '/?year=' + calendar.prevYear + '&month=' + calendar.prevMonth + lq;
    calendar.nextHref = req.teBase + '/?year=' + calendar.nextYear + '&month=' + calendar.nextMonth + lq;
    var calWeekdays = [1, 2, 3, 4, 5, 6, 0].map(function(d) { return i18n.WD_SHORT[lang][d]; });

    res.render('tbilisi-events/list', {
      title: dateParam ? 'events.tbiliseli.com — ' + dateParam : 'events.tbiliseli.com',
      lang: lang,
      t: t,
      jsonLd: ldGraph([
        { '@type': 'WebSite', name: SITE_NAME, url: absUrl(req, '/'), inLanguage: lang },
        { '@type': 'Organization', name: SITE_NAME, url: absUrl(req, '/') },
      ]),
      langLinks: langLinks,
      navLinks: navLinks,
      hero: hero,
      listEvents: listEvents,
      dateParam: dateParam,
      dateHeading: dateParam ? i18n.formatLongDate(dateParam, lang) : null,
      heroDate: hero ? i18n.formatLongDate(hero.date, lang) : null,
      showAll: showAll,
      fullList: fullList,
      listTruncated: listTruncated,
      dayStrip: dayStrip,
      weekend: weekend,
      rubrics: rubrics,
      calendar: calendar,
      calWeekdays: calWeekdays,
      countLabel: i18n.countLabel(totalVisible + (hero ? 1 : 0), lang),
      allUpcomingHref: href({ date: null, all: false, full: false }),
      showAllHref: href({ full: true, date: null }),
      showPastHref: href({ all: true, date: null, full: false }),
      venuesHref: req.teBase + '/venues' + (lang !== 'ru' ? '?lang=' + lang : ''),
      collectionsHref: req.teBase + '/collections' + (lang !== 'ru' ? '?lang=' + lang : ''),
      curated: curated,
      dateLinkFor: function(d) { return href({ date: d }); },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/e/:id', async function(req, res, next) {
  try {
    var lang = i18n.normalizeLang(req.query.lang);
    var t = i18n.UI[lang];
    var all = sanitizeEvents(await eventsData.getPublicEvents());
    var event = all.find(function(x) { return x.slug === req.params.id || x.id === req.params.id; });
    if (!event) return next();
    if (event.slug && req.params.id !== event.slug) {
      return res.redirect(301, req.teBase + '/e/' + event.slug + langQuery(lang));
    }
    if (views.isCountableView(req)) views.recordView('event', event.id, req);
    var isFav = res.locals.user
      ? await eventsData.isFavorited(res.locals.user.uid, 'event', event.id)
      : false;

    var venues = await eventsData.getVenues();
    var venueById = {};
    venues.forEach(function(v) { venueById[v.id] = v; });
    all.forEach(function(e) { decorateEvent(e, lang, venueById, req.teBase); });

    var today = new Date().toISOString().slice(0, 10);
    var venue = event.venueId ? (venueById[event.venueId] || null) : null;

    var sameDay = all.filter(function(e) {
      return e.id !== event.id && e.date === event.date;
    }).slice(0, 6);
    var related = all.filter(function(e) {
      return e.id !== event.id && e.type && e.type === event.type && e.date >= today;
    }).slice(0, 6);
    var venueEventsCount = venue
      ? all.filter(function(e) { return e.venueId === venue.id && e.date >= today; }).length
      : 0;
    var mapQuery = venue
      ? ((venue.lat != null && venue.lng != null) ? venue.lat + ',' + venue.lng : (venue.address || venue.name))
      : null;

    var organizerState = res.locals.user
      ? (await eventsData.getActiveClaim(res.locals.user.uid, 'event', event.id) || {}).status || null
      : null;

    var evUrl = absUrl(req, '/e/' + (event.slug || event.id));
    var crumbs = [{ label: SITE_NAME, href: req.teBase + langQuery(lang), abs: absUrl(req, '/') }];
    if (event.type && event.typeLabel) {
      crumbs.push({
        label: event.typeLabel,
        href: req.teBase + '/?type=' + event.type + (lang !== 'ru' ? '&lang=' + lang : ''),
        abs: absUrl(req, '/?type=' + event.type),
      });
    }
    crumbs.push({ label: event.displayTitle, abs: evUrl });

    var eventLd = {
      '@type': 'Event',
      name: event.displayTitle,
      url: evUrl,
      eventStatus: event.cancelled ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      organizer: { '@type': 'Organization', name: SITE_NAME, url: absUrl(req, '/') },
    };
    if (event.date) {
      var hhmm = /^(\d{2}):(\d{2})/.exec(event.time || '');
      eventLd.startDate = hhmm ? event.date + 'T' + hhmm[1] + ':' + hhmm[2] + ':00+04:00' : event.date;
    }
    if (event.desc) eventLd.description = event.desc;
    if (event.imageUrl) eventLd.image = [event.imageUrl];
    if (venue) {
      eventLd.location = { '@type': 'Place', name: venue.name, url: absUrl(req, '/venues/' + (venue.slug || venue.id)) };
      if (venue.address) eventLd.location.address = venue.address;
      if (venue.lat != null && venue.lng != null) {
        eventLd.location.geo = { '@type': 'GeoCoordinates', latitude: venue.lat, longitude: venue.lng };
      }
    } else if (event.place) {
      eventLd.location = { '@type': 'Place', name: event.place };
    }
    if (event.primaryUrl) {
      eventLd.offers = { '@type': 'Offer', url: event.primaryUrl, availability: 'https://schema.org/InStock' };
    }

    res.render('tbilisi-events/event', {
      title: event.displayTitle + ' — events.tbiliseli.com',
      lang: lang,
      t: t,
      isFavorited: isFav,
      crumbs: crumbs,
      jsonLd: ldGraph([eventLd, breadcrumbLd(crumbs)]),
      langLinks: i18n.LANGS.map(function(c) {
        return { code: c.toUpperCase(), href: req.teBase + '/e/' + (event.slug || event.id) + (c !== 'ru' ? '?lang=' + c : ''), active: c === lang };
      }),
      backHref: req.teBase + langQuery(lang),
      ev: event,
      isAdmin: await isAdmin(req),
      organizerState: organizerState,
      organizerHref: req.teBase + '/organizer/claim?target=event:' + event.id,
      loginHref: req.teBase + '/login?next=' + encodeURIComponent(req.teBase + '/e/' + (event.slug || event.id) + langQuery(lang)),
      editHref: req.teBase + '/admin/events/' + event.id + '/edit',
      dateLong: i18n.formatLongDate(event.date, lang),
      venue: venue,
      venueHref: venue ? req.teBase + '/venues/' + (venue.slug || venue.id) + langQuery(lang) : null,
      venueClosedLabel: venueClosedLabel(venue, lang),
      venueEventsCount: venueEventsCount,
      mapHref: mapQuery ? 'https://maps.google.com/?q=' + encodeURIComponent(mapQuery) : null,
      sameDay: sameDay,
      related: related,
      relatedHref: event.type ? req.teBase + '/?type=' + event.type + (lang !== 'ru' ? '&lang=' + lang : '') : null,
      venuesHref: req.teBase + '/venues' + langQuery(lang),
    });
  } catch (e) { next(e); }
});

router.get('/venues', async function(req, res, next) {
  try {
    var lang = i18n.normalizeLang(req.query.lang);
    var t = i18n.UI[lang];
    var vtl = i18n.VENUE_TYPE_LABELS[lang];
    var today = new Date().toISOString().slice(0, 10);
    var upcoming = (await eventsData.getPublicEvents()).filter(function(e) { return e.date >= today; });
    var upcomingByVenue = {};
    upcoming.forEach(function(e) { if (e.venueId) upcomingByVenue[e.venueId] = (upcomingByVenue[e.venueId] || 0) + 1; });

    var venues = (await eventsData.getVenues()).map(function(v) {
      return Object.assign({}, v, {
        typeLabel: v.type ? (vtl[v.type] || v.type) : '',
        upcomingCount: upcomingByVenue[v.id] || 0,
        closedLabel: venueClosedLabel(v, lang),
        href: req.teBase + '/venues/' + (v.slug || v.id) + langQuery(lang),
      });
    });
    venues.sort(function(a, b) { return (b.upcomingCount - a.upcomingCount) || (b.eventCount || 0) - (a.eventCount || 0); });

    var crumbs = [
      { label: SITE_NAME, href: req.teBase + langQuery(lang), abs: absUrl(req, '/') },
      { label: t.venuesTitle, abs: absUrl(req, '/venues') },
    ];
    res.render('tbilisi-events/venues/list', {
      title: t.venuesTitle + ' — events.tbiliseli.com',
      lang: lang, t: t,
      crumbs: crumbs,
      jsonLd: ldGraph([
        breadcrumbLd(crumbs),
        itemListLd(t.venuesTitle, venues.map(function(v) {
          return { url: absUrl(req, '/venues/' + (v.slug || v.id)), name: v.name };
        })),
      ]),
      langLinks: i18n.LANGS.map(function(c) { return { code: c.toUpperCase(), href: req.teBase + '/venues' + (c !== 'ru' ? '?lang=' + c : ''), active: c === lang }; }),
      backHref: req.teBase + langQuery(lang),
      venues: venues,
    });
  } catch (e) { next(e); }
});

router.get('/venues/:id', async function(req, res, next) {
  try {
    var lang = i18n.normalizeLang(req.query.lang);
    var t = i18n.UI[lang];
    var vtl = i18n.VENUE_TYPE_LABELS[lang];

    var allVenues = await eventsData.getVenues();
    var venueById = {};
    allVenues.forEach(function(v) { venueById[v.id] = v; });

    var venue = allVenues.find(function(v) { return v.slug === req.params.id || v.id === req.params.id; }) || null;
    if (!venue) return next();
    if (venue.slug && req.params.id !== venue.slug) {
      return res.redirect(301, req.teBase + '/venues/' + venue.slug + langQuery(lang));
    }
    if (views.isCountableView(req)) views.recordView('venue', venue.id, req);
    var isFav = res.locals.user
      ? await eventsData.isFavorited(res.locals.user.uid, 'venue', venue.id)
      : false;

    var today = new Date().toISOString().slice(0, 10);
    var all = sanitizeEvents(await eventsData.getPublicEvents());
    all.forEach(function(e) { decorateEvent(e, lang, venueById, req.teBase); });

    var upcoming = all.filter(function(e) { return e.venueId === venue.id && e.date >= today; });
    upcoming.forEach(function(e) {
      e.dBig = i18n.formatShortDay(e.date, lang);
      e.dWd = i18n.weekdayShort(e.date, lang);
    });
    var totalHere = all.filter(function(e) { return e.venueId === venue.id; }).length;

    var mapQuery = (venue.lat != null && venue.lng != null)
      ? venue.lat + ',' + venue.lng
      : (venue.address || venue.name);

    var other = allVenues
      .filter(function(v) { return v.id !== venue.id; })
      .sort(function(a, b) { return (b.eventCount || 0) - (a.eventCount || 0); })
      .slice(0, 4)
      .map(function(v) {
        return {
          name: v.name,
          meta: [v.area, v.type ? (vtl[v.type] || v.type) : null].filter(Boolean).join(' · '),
          imageUrl: v.imageUrl || null,
          href: req.teBase + '/venues/' + (v.slug || v.id) + langQuery(lang),
        };
      });

    var facts = [];
    if (venue.address) facts.push({ k: t.address, v: venue.address });
    if (venue.city) facts.push({ k: t.city, v: taxonomy.cityName(venue.city, lang) });
    var districtLabel = taxonomy.districtName(venue.city, venue.district, lang) || venue.area;
    if (districtLabel) facts.push({ k: t.district, v: districtLabel });
    if (venue.type) facts.push({ k: t.venueType, v: vtl[venue.type] || venue.type });

    var organizerState = res.locals.user
      ? (await eventsData.getActiveClaim(res.locals.user.uid, 'venue', venue.id) || {}).status || null
      : null;

    var venueUrl = absUrl(req, '/venues/' + (venue.slug || venue.id));
    var venueDescText = i18n.pickDescription(venue.description, lang);
    var crumbs = [
      { label: SITE_NAME, href: req.teBase + langQuery(lang), abs: absUrl(req, '/') },
      { label: t.venuesTitle, href: req.teBase + '/venues' + langQuery(lang), abs: absUrl(req, '/venues') },
      { label: venue.name, abs: venueUrl },
    ];
    var placeLd = { '@type': 'Place', name: venue.name, url: venueUrl };
    if (venue.address) placeLd.address = venue.address;
    if (venue.imageUrl) placeLd.image = [venue.imageUrl];
    if (venueDescText) placeLd.description = venueDescText;
    if (venue.lat != null && venue.lng != null) {
      placeLd.geo = { '@type': 'GeoCoordinates', latitude: venue.lat, longitude: venue.lng };
    }

    res.render('tbilisi-events/venues/detail', {
      title: venue.name + ' — events.tbiliseli.com',
      lang: lang, t: t,
      isFavorited: isFav,
      crumbs: crumbs,
      jsonLd: ldGraph([placeLd, breadcrumbLd(crumbs)]),
      langLinks: i18n.LANGS.map(function(c) { return { code: c.toUpperCase(), href: req.teBase + '/venues/' + (venue.slug || venue.id) + (c !== 'ru' ? '?lang=' + c : ''), active: c === lang }; }),
      backHref: req.teBase + '/venues' + langQuery(lang),
      venue: venue,
      venueClosedLabel: venueClosedLabel(venue, lang),
      isAdmin: await isAdmin(req),
      editHref: req.teBase + '/admin/venues/' + venue.id,
      organizerState: organizerState,
      organizerHref: req.teBase + '/organizer/claim?target=venue:' + venue.id,
      loginHref: req.teBase + '/login?next=' + encodeURIComponent(req.teBase + '/venues/' + (venue.slug || venue.id) + langQuery(lang)),
      venueTypeLabel: venue.type ? (vtl[venue.type] || venue.type) : '',
      venueDesc: venueDescText,
      facts: facts,
      upcoming: upcoming,
      upcomingShown: upcoming.slice(0, 8),
      totalHere: totalHere,
      website: venue.website || null,
      mapHref: 'https://maps.google.com/?q=' + encodeURIComponent(mapQuery),
      other: other,
    });
  } catch (e) { next(e); }
});

// ---- curated collections (public) ----------------------------------------
router.get('/collections', async function(req, res, next) {
  try {
    var lang = i18n.normalizeLang(req.query.lang);
    var t = i18n.UI[lang];

    var heroes = await eventsData.getHeroes();
    var heroById = {};
    heroes.forEach(function(h) { heroById[h.id] = h; });

    var publicIds = {};
    (await eventsData.getPublicEvents()).forEach(function(e) { publicIds[e.id] = true; });

    var collections = (await eventsData.getPublishedCollections()).map(function(c) {
      var hero = c.heroId ? heroById[c.heroId] : null;
      return {
        title: i18n.pickDescription(c.title, lang),
        heroName: hero ? i18n.pickDescription(hero.name, lang) : '',
        heroImage: hero ? (hero.imageUrl || null) : null,
        count: (c.eventIds || []).filter(function(id) { return publicIds[id]; }).length,
        slugOrId: c.slug || c.id,
        href: req.teBase + '/collections/' + (c.slug || c.id) + langQuery(lang),
      };
    }).filter(function(c) { return c.title; });

    var crumbs = [
      { label: SITE_NAME, href: req.teBase + langQuery(lang), abs: absUrl(req, '/') },
      { label: t.collectionsTitle, abs: absUrl(req, '/collections') },
    ];
    res.render('tbilisi-events/collections/list', {
      title: t.collectionsTitle + ' — events.tbiliseli.com',
      lang: lang, t: t,
      crumbs: crumbs,
      jsonLd: ldGraph([
        breadcrumbLd(crumbs),
        itemListLd(t.collectionsTitle, collections.map(function(c) {
          return { url: absUrl(req, '/collections/' + c.slugOrId), name: c.title };
        })),
      ]),
      langLinks: i18n.LANGS.map(function(c) { return { code: c.toUpperCase(), href: req.teBase + '/collections' + (c !== 'ru' ? '?lang=' + c : ''), active: c === lang }; }),
      backHref: req.teBase + langQuery(lang),
      collections: collections,
    });
  } catch (e) { next(e); }
});

router.get('/collections/:id', async function(req, res, next) {
  try {
    var lang = i18n.normalizeLang(req.query.lang);
    var t = i18n.UI[lang];

    var col = await eventsData.getCollectionById(req.params.id)
      || await eventsData.getCollectionBySlug(req.params.id);
    if (!col || !col.published) return next();
    if (col.slug && req.params.id !== col.slug) {
      return res.redirect(301, req.teBase + '/collections/' + col.slug + langQuery(lang));
    }
    if (views.isCountableView(req)) views.recordView('collection', col.id, req);

    var hero = col.heroId ? await eventsData.getHeroById(col.heroId) : null;

    var venues = await eventsData.getVenues();
    var venueById = {};
    venues.forEach(function(v) { venueById[v.id] = v; });
    var all = sanitizeEvents(await eventsData.getPublicEvents());
    all.forEach(function(e) { decorateEvent(e, lang, venueById, req.teBase); });
    var byId = {};
    all.forEach(function(e) { byId[e.id] = e; });

    var events = (col.eventIds || []).map(function(id) { return byId[id]; }).filter(Boolean);
    events.forEach(function(e, i) {
      e.pos = (i + 1 < 10 ? '0' : '') + (i + 1);
      e.whenLabel = [
        e.dateShort + (e.weekdayShort ? ', ' + e.weekdayShort : ''),
        e.time,
      ].filter(Boolean).join(' · ');
    });

    // Route map: one numbered pin per distinct venue with coordinates, in
    // collection order. Skipped for events with no located venue.
    var seenVenue = {};
    var mapPins = [];
    events.forEach(function(e) {
      var v = e.venueId ? venueById[e.venueId] : null;
      if (!v || v.lat == null || v.lng == null || seenVenue[v.id]) return;
      seenVenue[v.id] = true;
      mapPins.push({ n: mapPins.length + 1, lat: v.lat, lng: v.lng, label: v.name || '' });
    });

    // Date span of the selection, e.g. "1 сен – 7 сен" (or a single day).
    var dates = events.map(function(e) { return e.date; }).filter(Boolean).sort();
    var range = '';
    if (dates.length) {
      var first = i18n.formatShortDay(dates[0], lang);
      var last = i18n.formatShortDay(dates[dates.length - 1], lang);
      range = first === last ? first : first + ' – ' + last;
    }

    var updatedAt = col.updatedAt && col.updatedAt.toDate ? col.updatedAt.toDate() : (col.updatedAt ? new Date(col.updatedAt) : null);
    var updatedLabel = updatedAt ? i18n.formatShortDay(updatedAt.toISOString().slice(0, 10), lang) : '';

    var heroById = {};
    (await eventsData.getHeroes()).forEach(function(h) { heroById[h.id] = h; });
    var others = (await eventsData.getPublishedCollections())
      .filter(function(c) { return c.id !== col.id; })
      .map(function(c) {
        var h = c.heroId ? heroById[c.heroId] : null;
        return {
          title: i18n.pickDescription(c.title, lang),
          heroName: h ? i18n.pickDescription(h.name, lang) : '',
          count: (c.eventIds || []).length,
          href: req.teBase + '/collections/' + (c.slug || c.id) + langQuery(lang),
        };
      })
      .filter(function(c) { return c.title; })
      .slice(0, 4);

    var colTitle = i18n.pickDescription(col.title, lang);
    var crumbs = [
      { label: SITE_NAME, href: req.teBase + langQuery(lang), abs: absUrl(req, '/') },
      { label: t.collectionsTitle, href: req.teBase + '/collections' + langQuery(lang), abs: absUrl(req, '/collections') },
      { label: colTitle, abs: absUrl(req, '/collections/' + (col.slug || col.id)) },
    ];

    res.render('tbilisi-events/collections/detail', {
      title: colTitle + ' — events.tbiliseli.com',
      lang: lang, t: t,
      crumbs: crumbs,
      jsonLd: ldGraph([
        breadcrumbLd(crumbs),
        itemListLd(colTitle, events.map(function(e) {
          return { url: absUrl(req, '/e/' + (e.slug || e.id)), name: e.displayTitle };
        })),
      ]),
      langLinks: i18n.LANGS.map(function(c) { return { code: c.toUpperCase(), href: req.teBase + '/collections/' + (col.slug || col.id) + (c !== 'ru' ? '?lang=' + c : ''), active: c === lang }; }),
      backHref: req.teBase + '/collections' + langQuery(lang),
      collectionTitle: colTitle,
      curatorNote: i18n.pickDescription(col.curatorNote, lang),
      hero: hero ? {
        name: i18n.pickDescription(hero.name, lang),
        description: i18n.pickDescription(hero.description, lang),
        imageUrl: hero.imageUrl || null,
      } : null,
      events: events,
      count: events.length,
      countLabel: i18n.countLabel(events.length, lang),
      range: range,
      updatedLabel: updatedLabel,
      others: others,
      mapPins: mapPins,
    });
  } catch (e) { next(e); }
});

module.exports = router;
