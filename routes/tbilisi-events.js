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

var MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function buildCalendar(events, todayStr, monthStr, selectedDate) {
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
    monthLabel: MONTH_NAMES[month] + ' ' + year,
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

// Mirrors requireAuth in routes/tbilisi-events-admin.js — used only to decide
// whether to show the inline "edit" shortcut on public pages.
function isAdmin(req) {
  var val = req.cookies && req.cookies.tbilisiEventsAdminToken;
  var envPass = process.env.TBILISI_EVENTS_ADMIN_PASS;
  if (!val || !envPass) return false;
  return val === crypto.createHash('sha256').update('tbilisiEvents:' + envPass).digest('hex');
}

// Attach the display fields the views expect onto a sanitized event.
function decorateEvent(e, lang, venueById) {
  var typeLabelsL = i18n.EVENT_TYPE_LABELS[lang];
  var langLabelsL = i18n.LANGUAGE_LABELS[lang];
  e.venueName = e.venueId && venueById[e.venueId] ? venueById[e.venueId].name : null;
  e.desc = i18n.pickDescription(e.description, lang);
  e.typeLabel = e.type ? (typeLabelsL[e.type] || e.type) : '';
  e.langBadge = (e.language || []).map(function(c) { return String(c).toUpperCase(); }).join(' / ');
  e.langLabel = (e.language || []).map(function(c) { return langLabelsL[c] || c; }).join(', ');
  e.primaryUrl = (e.sources.find(function(s) { return s.safe; }) || {}).url || null;
  e.href = '/tbilisi-events/e/' + e.id + langQuery(lang);
  e.venueHref = e.venueId ? '/tbilisi-events/venues/' + e.venueId + langQuery(lang) : null;
  e.editorNoteText = i18n.pickDescription(e.editorNote, lang);
  e.cancelledLabel = e.cancelled ? i18n.UI[lang].cancelled : '';
  e.displayTitle = i18n.pickDescription(e.titleI18n, lang) || e.title;
  return e;
}

router.get('/', async function(req, res, next) {
  try {
    var lang = i18n.normalizeLang(req.query.lang);
    var t = i18n.UI[lang];
    var typeLabelsL = i18n.EVENT_TYPE_LABELS[lang];

    var events = sanitizeEvents(await eventsData.getPublicEvents());
    var venues = await eventsData.getVenues();
    var venueById = {};
    venues.forEach(function(v) { venueById[v.id] = v; });
    events.forEach(function(e) { decorateEvent(e, lang, venueById); });

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
      return '/tbilisi-events' + (q.length ? '?' + q.join('&') : '');
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

    var calendar = buildCalendar(events, today, monthStr, dateParam);
    var lq = lang !== 'ru' ? '&lang=' + lang : '';
    calendar.prevHref = '/tbilisi-events?year=' + calendar.prevYear + '&month=' + calendar.prevMonth + lq;
    calendar.nextHref = '/tbilisi-events?year=' + calendar.nextYear + '&month=' + calendar.nextMonth + lq;
    var calWeekdays = [1, 2, 3, 4, 5, 6, 0].map(function(d) { return i18n.WD_SHORT[lang][d]; });

    res.render('tbilisi-events/list', {
      title: dateParam ? 'events.tbiliseli.com — ' + dateParam : 'events.tbiliseli.com',
      lang: lang,
      t: t,
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
      venuesHref: '/tbilisi-events/venues' + (lang !== 'ru' ? '?lang=' + lang : ''),
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
    var event = all.find(function(x) { return x.id === req.params.id; });
    if (!event) return next();

    var venues = await eventsData.getVenues();
    var venueById = {};
    venues.forEach(function(v) { venueById[v.id] = v; });
    all.forEach(function(e) { decorateEvent(e, lang, venueById); });

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

    res.render('tbilisi-events/event', {
      title: event.displayTitle + ' — events.tbiliseli.com',
      lang: lang,
      t: t,
      langLinks: i18n.LANGS.map(function(c) {
        return { code: c.toUpperCase(), href: '/tbilisi-events/e/' + event.id + (c !== 'ru' ? '?lang=' + c : ''), active: c === lang };
      }),
      backHref: '/tbilisi-events' + langQuery(lang),
      ev: event,
      isAdmin: isAdmin(req),
      editHref: '/tbilisi-events/admin/events/' + event.id + '/edit',
      dateLong: i18n.formatLongDate(event.date, lang),
      venue: venue,
      venueHref: venue ? '/tbilisi-events/venues/' + venue.id + langQuery(lang) : null,
      venueEventsCount: venueEventsCount,
      mapHref: mapQuery ? 'https://maps.google.com/?q=' + encodeURIComponent(mapQuery) : null,
      sameDay: sameDay,
      related: related,
      relatedHref: event.type ? '/tbilisi-events?type=' + event.type + (lang !== 'ru' ? '&lang=' + lang : '') : null,
      venuesHref: '/tbilisi-events/venues' + langQuery(lang),
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
        href: '/tbilisi-events/venues/' + v.id + langQuery(lang),
      });
    });
    venues.sort(function(a, b) { return (b.upcomingCount - a.upcomingCount) || (b.eventCount || 0) - (a.eventCount || 0); });

    res.render('tbilisi-events/venues/list', {
      title: t.venuesTitle + ' — events.tbiliseli.com',
      lang: lang, t: t,
      langLinks: i18n.LANGS.map(function(c) { return { code: c.toUpperCase(), href: '/tbilisi-events/venues' + (c !== 'ru' ? '?lang=' + c : ''), active: c === lang }; }),
      backHref: '/tbilisi-events' + langQuery(lang),
      venues: venues,
    });
  } catch (e) { next(e); }
});

router.get('/venues/:id', async function(req, res, next) {
  try {
    var lang = i18n.normalizeLang(req.query.lang);
    var t = i18n.UI[lang];
    var vtl = i18n.VENUE_TYPE_LABELS[lang];

    var venue = await eventsData.getVenueById(req.params.id);
    if (!venue) return next();

    var allVenues = await eventsData.getVenues();
    var venueById = {};
    allVenues.forEach(function(v) { venueById[v.id] = v; });

    var today = new Date().toISOString().slice(0, 10);
    var all = sanitizeEvents(await eventsData.getPublicEvents());
    all.forEach(function(e) { decorateEvent(e, lang, venueById); });

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
          href: '/tbilisi-events/venues/' + v.id + langQuery(lang),
        };
      });

    var facts = [];
    if (venue.address) facts.push({ k: t.address, v: venue.address });
    if (venue.area) facts.push({ k: t.district, v: venue.area });
    if (venue.type) facts.push({ k: t.venueType, v: vtl[venue.type] || venue.type });

    res.render('tbilisi-events/venues/detail', {
      title: venue.name + ' — events.tbiliseli.com',
      lang: lang, t: t,
      langLinks: i18n.LANGS.map(function(c) { return { code: c.toUpperCase(), href: '/tbilisi-events/venues/' + venue.id + (c !== 'ru' ? '?lang=' + c : ''), active: c === lang }; }),
      backHref: '/tbilisi-events/venues' + langQuery(lang),
      venue: venue,
      venueTypeLabel: venue.type ? (vtl[venue.type] || venue.type) : '',
      venueDesc: i18n.pickDescription(venue.description, lang),
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

module.exports = router;
