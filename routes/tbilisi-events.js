'use strict';
var express = require('express');
var router = express.Router();
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { getStorage } = require('firebase-admin/storage');
var eventsData = require('../lib/tbilisi-events-data');
var images = require('../lib/tbilisi-events-images');
var taxonomy = require('../lib/tbilisi-events-taxonomy');

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

router.get('/', async function(req, res, next) {
  try {
    var events = sanitizeEvents(await eventsData.getPublicEvents());
    var venues = await eventsData.getVenues();
    var venueById = {};
    venues.forEach(function(v) { venueById[v.id] = v; });
    events.forEach(function(e) { e.venueName = e.venueId && venueById[e.venueId] ? venueById[e.venueId].name : null; });
    var typeParam = taxonomy.EVENT_TYPE_SLUGS.indexOf(req.query.type) !== -1 ? req.query.type : null;
    var today = new Date().toISOString().slice(0, 10);
    var showAll = req.query.all === '1';
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

    var visibleEvents;
    if (dateParam) {
      visibleEvents = events.filter(function(e) { return e.date === dateParam; });
    } else {
      visibleEvents = showAll ? events : events.filter(function(e) { return e.date >= today; });
    }
    if (typeParam) visibleEvents = visibleEvents.filter(function(e) { return e.type === typeParam; });

    var keep = [];
    if (showAll) keep.push('all=1');
    if (dateParam) keep.push('date=' + dateParam);
    function typeHref(slug) {
      var parts = keep.slice();
      if (slug) parts.push('type=' + slug);
      return '/tbilisi-events' + (parts.length ? '?' + parts.join('&') : '');
    }
    var typeLinks = [{ label: 'все', href: typeHref(null), active: !typeParam }].concat(
      taxonomy.EVENT_TYPE_SLUGS.map(function(slug) {
        return { label: taxonomy.EVENT_TYPE_LABELS[slug], href: typeHref(slug), active: typeParam === slug };
      })
    );

    res.render('tbilisi-events/list', {
      title: dateParam ? 'Афиша Тбилиси — ' + dateParam : 'Афиша Тбилиси',
      events: visibleEvents,
      showAll: showAll,
      dateParam: dateParam,
      monthNames: MONTH_NAMES,
      calendar: buildCalendar(events, today, monthStr, dateParam),
      typeLinks: typeLinks,
      typeParam: typeParam,
      eventTypeLabels: taxonomy.EVENT_TYPE_LABELS,
      languageLabels: taxonomy.LANGUAGE_LABELS,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
