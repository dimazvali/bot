'use strict';
var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var pipeline = require('../lib/tbilisi-events-pipeline');
var data = require('../lib/tbilisi-events-data');
var alertMe = require('./common').alertMe;
var taxonomy = require('../lib/tbilisi-events-taxonomy');
var enricher = require('../lib/tbilisi-events-enricher');
var images = require('../lib/tbilisi-events-images');
var venuesLib = require('../lib/tbilisi-events-venues');
var multer = require('multer');
var venueUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function backTo(req, res, fallback) {
  res.redirect(req.get('referer') || fallback);
}

function formatSummary(summary) {
  var text = '📋 <b>Tbilisi Events — сбор завершён</b>\n'
    + 'Источников обработано: ' + summary.sourcesProcessed + '\n'
    + 'Событий найдено: ' + summary.eventsFound + '\n'
    + 'Новых: ' + summary.eventsNew + '\n'
    + 'Объединено: ' + summary.eventsMerged;
  if (summary.sourceErrors.length) {
    text += '\n⚠️ Ошибок: ' + summary.sourceErrors.length;
    text += '\n' + summary.sourceErrors.slice(0, 10).map(function(e) { return '• ' + e.source + ': ' + e.error; }).join('\n');
  }
  return text;
}

function runCollectInBackground(sourcesOverride) {
  pipeline.run(sourcesOverride).then(function(summary) {
    return data.addLog(summary).then(function() { return alertMe({ text: formatSummary(summary), parse_mode: 'HTML' }); });
  }).catch(function(e) {
    var failedSummary = { sourcesProcessed: 0, eventsFound: 0, eventsNew: 0, eventsMerged: 0, sourceErrors: [{ source: 'pipeline', error: e.message }] };
    data.addLog(failedSummary).catch(function() {});
    alertMe({ text: '❌ <b>Tbilisi Events — сбор упал с ошибкой</b>\n' + e.message, parse_mode: 'HTML' }).catch(function() {});
  });
}

function cookieToken(pass) {
  return crypto.createHash('sha256').update('tbilisiEvents:' + pass).digest('hex');
}

function requireAuth(req, res, next) {
  var val = req.cookies && req.cookies.tbilisiEventsAdminToken;
  var envPass = process.env.TBILISI_EVENTS_ADMIN_PASS;
  if (val && envPass && val === cookieToken(envPass)) return next();
  res.redirect('/tbilisi-events/admin/login');
}

router.get('/login', function(req, res) {
  res.render('tbilisi-events/admin/login', { title: 'Вход — Tbilisi Events Admin', error: null });
});

router.post('/login', express.urlencoded({ extended: false }), function(req, res) {
  var pass = (req.body.pass || '').trim();
  var envPass = process.env.TBILISI_EVENTS_ADMIN_PASS;
  if (!pass || !envPass || pass !== envPass) {
    return res.render('tbilisi-events/admin/login', { title: 'Вход — Tbilisi Events Admin', error: 'Неверный пароль' });
  }
  res.cookie('tbilisiEventsAdminToken', cookieToken(pass), { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.redirect('/tbilisi-events/admin/');
});

router.get('/logout', function(req, res) {
  res.clearCookie('tbilisiEventsAdminToken');
  res.redirect('/tbilisi-events/admin/login');
});

async function renderIndex(res, extra) {
  var sources = await data.getAllSources().catch(function() { return []; });
  var logs = await data.getRecentLogs(20).catch(function() { return []; });
  res.render('tbilisi-events/admin/index', Object.assign({
    title: 'Tbilisi Events Admin', sources: sources, logs: logs, error: null, sourceError: null, started: false,
  }, extra));
}

router.get('/', requireAuth, async function(req, res) {
  await renderIndex(res, { started: req.query.started === '1' });
});

router.post('/collect', requireAuth, function(req, res) {
  runCollectInBackground();
  res.redirect('/tbilisi-events/admin/?started=1');
});

router.post('/sources/collect', requireAuth, express.urlencoded({ extended: false }), async function(req, res) {
  var sources = await data.getAllSources().catch(function() { return []; });
  var source = sources.find(function(s) { return s.type === req.body.type && s.value === req.body.value; });
  if (source) runCollectInBackground([source]);
  res.redirect('/tbilisi-events/admin/?started=1');
});

router.post('/sources', requireAuth, express.urlencoded({ extended: false }), async function(req, res) {
  var sourceError = null;
  try {
    await data.addSource({ type: req.body.type, value: req.body.value, label: req.body.label });
  } catch (e) {
    sourceError = e.message;
  }
  await renderIndex(res, { sourceError: sourceError });
});

router.get('/events', requireAuth, async function(req, res, next) {
  try {
    var filters = {
      source: req.query.source || '',
      type: req.query.type || '',
      status: req.query.status || 'all',
      dateFrom: req.query.dateFrom || '',
      dateTo: req.query.dateTo || '',
      q: req.query.q || '',
    };
    var events = await data.getEvents(filters);
    events.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var venues = await data.getVenues();
    var venueById = {};
    venues.forEach(function(v) { venueById[v.id] = v; });
    var sources = await data.getAllSources().catch(function() { return []; });
    res.render('tbilisi-events/admin/events', {
      title: 'События — Tbilisi Events Admin',
      events: events,
      venueById: venueById,
      sources: sources,
      filters: filters,
      eventTypeSlugs: taxonomy.EVENT_TYPE_SLUGS,
      eventTypeLabels: taxonomy.EVENT_TYPE_LABELS,
      languageLabels: taxonomy.LANGUAGE_LABELS,
    });
  } catch (e) { next(e); }
});

router.post('/events/:id/hide', requireAuth, async function(req, res) {
  await data.setEventHidden(req.params.id, true);
  backTo(req, res, '/tbilisi-events/admin/events');
});

router.post('/events/:id/show', requireAuth, async function(req, res) {
  await data.setEventHidden(req.params.id, false);
  backTo(req, res, '/tbilisi-events/admin/events');
});

router.post('/events/:id/delete', requireAuth, async function(req, res) {
  await data.deleteEvent(req.params.id);
  backTo(req, res, '/tbilisi-events/admin/events');
});

router.get('/events/:id/edit', requireAuth, async function(req, res, next) {
  try {
    var event = await data.getEventById(req.params.id);
    if (!event) return next();
    var venues = await data.getVenues();
    venues.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
    res.render('tbilisi-events/admin/event-edit', {
      title: 'Правка события',
      event: event,
      venues: venues,
      eventTypeSlugs: taxonomy.EVENT_TYPE_SLUGS,
      eventTypeLabels: taxonomy.EVENT_TYPE_LABELS,
      languageSlugs: taxonomy.LANGUAGE_SLUGS,
      languageLabels: taxonomy.LANGUAGE_LABELS,
      error: null,
    });
  } catch (e) { next(e); }
});

router.post('/events/:id/edit', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var b = req.body;
    var langs = [].concat(b.language || []);
    var patch = {
      title: (b.title || '').trim(),
      date: (b.date || '').trim(),
      time: (b.time || '').trim() || null,
      place: (b.place || '').trim() || null,
      type: taxonomy.isValidEventType(b.type) ? b.type : null,
      language: taxonomy.sanitizeLanguages(langs),
      venueId: (b.venueId || '').trim() || null,
      description: (b.desc_ru || b.desc_en || b.desc_ka)
        ? { ru: (b.desc_ru || '').trim(), en: (b.desc_en || '').trim(), ka: (b.desc_ka || '').trim() }
        : null,
      editorsPick: b.editorsPick === 'on',
      active: b.active === 'on',
      cancelled: b.cancelled === 'on',
      price: (b.price || '').trim() || null,
      editorNote: (b.note_ru || b.note_en || b.note_ka)
        ? { ru: (b.note_ru || '').trim(), en: (b.note_en || '').trim(), ka: (b.note_ka || '').trim() }
        : null,
    };
    await data.updateEvent(req.params.id, patch);
    res.redirect('/tbilisi-events/admin/events');
  } catch (e) { next(e); }
});

router.post('/events/:id/reenrich', requireAuth, async function(req, res, next) {
  try {
    var event = await data.getEventById(req.params.id);
    if (!event) return next();
    try {
      var enr = await enricher.enrichEvent({
        title: event.title, place: event.place, rawExcerpt: event.rawExcerpt || '',
        type: event.type, language: event.language,
      });
      await data.updateEvent(event.id, {
        description: enr.description, type: enr.type, language: enr.language, enrichedAt: new Date(),
      });
    } catch (e) { /* leave a note via flash-less redirect; admin can retry */ }
    if (event.imageSourceUrl && !event.imageUrl) {
      try {
        var img = await images.fetchAndStore(event.imageSourceUrl, event.id);
        await data.updateEvent(event.id, img);
      } catch (e) { /* ignore */ }
    }
    backTo(req, res, '/tbilisi-events/admin/events');
  } catch (e) { next(e); }
});

router.post('/events/:id/fetch-image', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var event = await data.getEventById(req.params.id);
    if (!event) return next();
    var url = (req.body.url || '').trim() || event.imageSourceUrl;
    if (url) {
      var img = await images.fetchAndStore(url, event.id);
      await data.updateEvent(event.id, img);
    }
    backTo(req, res, '/tbilisi-events/admin/events');
  } catch (e) { next(e); }
});

router.get('/venues', requireAuth, async function(req, res, next) {
  try {
    var venues = await data.getVenues();
    venues.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
    res.render('tbilisi-events/admin/venues', {
      title: 'Площадки — Tbilisi Events Admin',
      venues: venues,
      venueTypeSlugs: taxonomy.VENUE_TYPE_SLUGS,
      venueTypeLabels: taxonomy.VENUE_TYPE_LABELS,
      error: null,
    });
  } catch (e) { next(e); }
});

router.post('/venues', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var name = (req.body.name || '').trim();
    if (name) {
      await data.insertVenue({
        name: name,
        nameKey: venuesLib.normalizeVenueName(name),
        origin: 'manual',
      });
    }
    res.redirect('/tbilisi-events/admin/venues');
  } catch (e) { next(e); }
});

router.post('/venues/:id/edit', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var b = req.body;
    var latNum = parseFloat(b.lat);
    var lngNum = parseFloat(b.lng);
    var patch = {
      name: (b.name || '').trim(),
      nameKey: venuesLib.normalizeVenueName((b.name || '').trim()),
      area: (b.area || '').trim() || null,
      address: (b.address || '').trim() || null,
      website: (b.website || '').trim() || null,
      type: taxonomy.isValidVenueType(b.type) ? b.type : null,
      lat: isNaN(latNum) ? null : latNum,
      lng: isNaN(lngNum) ? null : lngNum,
      description: (b.desc_ru || b.desc_en || b.desc_ka)
        ? { ru: (b.desc_ru || '').trim(), en: (b.desc_en || '').trim(), ka: (b.desc_ka || '').trim() }
        : null,
    };
    await data.updateVenue(req.params.id, patch);
    res.redirect('/tbilisi-events/admin/venues');
  } catch (e) { next(e); }
});

router.post('/venues/:id/delete', requireAuth, async function(req, res, next) {
  try {
    await data.deleteVenue(req.params.id);
    res.redirect('/tbilisi-events/admin/venues');
  } catch (e) { next(e); }
});

router.post('/venues/:id/image', requireAuth, venueUpload.single('image'), async function(req, res, next) {
  try {
    if (req.file && req.file.buffer) {
      var url = await images.storeVenueImage(req.file.buffer, req.params.id);
      await data.updateVenue(req.params.id, { imageUrl: url });
    }
    res.redirect('/tbilisi-events/admin/venues');
  } catch (e) { next(e); }
});

router.post('/venues/:id/draft-description', requireAuth, async function(req, res, next) {
  try {
    var venue = await data.getVenueById(req.params.id);
    if (!venue) return next();
    var draft = await venuesLib.draftVenueDescription(venue.name);
    var patch = {};
    if (draft.description) patch.description = draft.description;
    if (draft.type && !venue.type) patch.type = draft.type;
    if (draft.area && !venue.area) patch.area = draft.area;
    if (Object.keys(patch).length) await data.updateVenue(venue.id, patch);
    res.redirect('/tbilisi-events/admin/venues');
  } catch (e) { next(e); }
});

router.post('/venues/merge', requireAuth, express.urlencoded({ extended: false }), async function(req, res) {
  try {
    await data.mergeVenues((req.body.fromId || '').trim(), (req.body.toId || '').trim());
  } catch (e) { /* fall through to redirect; error is transient/operator-visible next load */ }
  res.redirect('/tbilisi-events/admin/venues');
});

module.exports = router;
