'use strict';
var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var pipeline = require('../lib/tbilisi-events-pipeline');
var data = require('../lib/tbilisi-events-data');
var teUsersLib = require('../lib/tbilisi-events-users');
var teNotify = require('../lib/tbilisi-events-notify');
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

// req.teBase is '' when mounted on events.tbiliseli.com, '/tbilisi-events' on the
// path mount (set by app.js). Every generated link/redirect is built from it.
router.use(function(req, res, next) {
  req.teBase = req.teBase || '';
  res.locals.base = req.teBase;
  next();
});

function formatSummary(summary) {
  var text = '📋 <b>Tbilisi Events — сбор завершён</b>\n'
    + 'Источников обработано: ' + summary.sourcesProcessed + '\n'
    + 'Постов пропущено (без изменений): ' + (summary.itemsSkipped || 0) + '\n'
    + 'Событий найдено: ' + summary.eventsFound + '\n'
    + 'Новых: ' + summary.eventsNew + '\n'
    + 'Объединено: ' + summary.eventsMerged;
  if (summary.sourceErrors.length) {
    text += '\n⚠️ Ошибок: ' + summary.sourceErrors.length;
    text += '\n' + summary.sourceErrors.slice(0, 10).map(function(e) { return '• ' + e.source + ': ' + e.error; }).join('\n');
  }
  return text;
}

// --- live progress over SSE -------------------------------------------------
// Only one collect runs at a time in this process. We keep the current (or last)
// run's full event history in memory so a page reload / late-joining EventSource
// can replay it and catch up, then follow live.
var collectClients = new Set();
var currentRun = null;

function sseSend(res, ev) {
  res.write('data: ' + JSON.stringify(ev) + '\n\n');
}

function broadcastCollect(ev) {
  collectClients.forEach(function(res) {
    try { sseSend(res, ev); } catch (e) { /* dead socket, dropped on its close handler */ }
  });
}

function runCollectInBackground(sourcesOverride) {
  if (currentRun && !currentRun.done) return currentRun.id;

  var run = { id: crypto.randomBytes(6).toString('hex'), startedAt: Date.now(), events: [], done: false, summary: null, error: null };
  currentRun = run;

  function emit(ev) {
    ev.t = Date.now();
    run.events.push(ev);
    broadcastCollect(ev);
  }
  emit({ phase: 'accepted', runId: run.id, scope: sourcesOverride ? 'single' : 'all' });

  pipeline.run(sourcesOverride, emit).then(function(summary) {
    run.summary = summary;
    return data.addLog(summary).then(function() { return alertMe({ text: formatSummary(summary), parse_mode: 'HTML' }); });
  }).catch(function(e) {
    run.error = e.message;
    var failedSummary = { sourcesProcessed: 0, eventsFound: 0, eventsNew: 0, eventsMerged: 0, sourceErrors: [{ source: 'pipeline', error: e.message }] };
    if (!run.summary) run.summary = failedSummary;
    emit({ phase: 'error', error: e.message });
    data.addLog(failedSummary).catch(function() {});
    alertMe({ text: '❌ <b>Tbilisi Events — сбор упал с ошибкой</b>\n' + e.message, parse_mode: 'HTML' }).catch(function() {});
  }).finally(function() {
    run.done = true;
    emit({ phase: 'finished', summary: run.summary, error: run.error });
  });

  return run.id;
}

function cookieToken(pass) {
  return crypto.createHash('sha256').update('tbilisiEvents:' + pass).digest('hex');
}

// The env password is the superadmin; extra admins are seeded as docs in the
// `tbilisiEventsAdmins` collection ({ name, password_hash, superadmin }), where
// password_hash === cookieToken(theirPassword). Mirrors routes/eka-admin.js.
async function requireAuth(req, res, next) {
  var val = req.cookies && req.cookies.tbilisiEventsAdminToken;
  if (!val) return res.redirect(req.teBase + '/admin/login');
  var envPass = process.env.TBILISI_EVENTS_ADMIN_PASS;
  if (envPass && val === cookieToken(envPass)) {
    res.locals.adminName = 'admin';
    res.locals.adminId = null;
    res.locals.isSuperadmin = true;
    return next();
  }
  try {
    var admin = await data.getAdminByPasswordHash(val);
    if (admin) {
      res.locals.adminName = admin.name || 'admin';
      res.locals.adminId = admin.id;
      res.locals.isSuperadmin = !!admin.superadmin;
      return next();
    }
  } catch (e) { /* fall through to redirect */ }
  res.redirect(req.teBase + '/admin/login');
}

function requireSuperAdmin(req, res, next) {
  if (res.locals.isSuperadmin) return next();
  res.status(403).send('Доступ запрещён — только для суперадминистратора');
}

router.get('/login', function(req, res) {
  res.render('tbilisi-events/admin/login', { title: 'Вход — Tbilisi Events Admin', error: null });
});

router.post('/login', express.urlencoded({ extended: false }), async function(req, res) {
  var pass = (req.body.pass || '').trim();
  if (!pass) {
    return res.render('tbilisi-events/admin/login', { title: 'Вход — Tbilisi Events Admin', error: 'Введите пароль' });
  }
  var hash = cookieToken(pass);
  var envPass = process.env.TBILISI_EVENTS_ADMIN_PASS;
  var ok = !!(envPass && pass === envPass);
  if (!ok) {
    try {
      ok = !!(await data.getAdminByPasswordHash(hash));
    } catch (e) { /* ok stays false */ }
  }
  if (!ok) {
    return res.render('tbilisi-events/admin/login', { title: 'Вход — Tbilisi Events Admin', error: 'Неверный пароль' });
  }
  res.cookie('tbilisiEventsAdminToken', hash, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.redirect(req.teBase + '/admin/');
});

router.get('/logout', function(req, res) {
  res.clearCookie('tbilisiEventsAdminToken');
  res.redirect(req.teBase + '/admin/login');
});

async function renderIndex(res, extra) {
  var logs = await data.getRecentLogs(20).catch(function() { return []; });
  res.render('tbilisi-events/admin/index', Object.assign({
    title: 'Tbilisi Events Admin', logs: logs, error: null, started: false,
  }, extra));
}

async function renderSources(res, extra) {
  var sources = await data.getAllSources().catch(function() { return []; });
  res.render('tbilisi-events/admin/sources', Object.assign({
    title: 'Источники — Tbilisi Events Admin', sources: sources, sourceError: null,
  }, extra));
}

router.get('/', requireAuth, async function(req, res) {
  await renderIndex(res, { started: req.query.started === '1' });
});

router.get('/sources', requireAuth, async function(req, res) {
  await renderSources(res, {});
});

router.get('/collect/stream', requireAuth, function(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.socket) res.socket.setNoDelay(true);
  res.flushHeaders();

  collectClients.add(res);

  if (currentRun) {
    sseSend(res, { phase: 'snapshot', runId: currentRun.id, done: currentRun.done });
    currentRun.events.forEach(function(ev) { sseSend(res, ev); });
  } else {
    sseSend(res, { phase: 'idle' });
  }

  var heartbeat = setInterval(function() { res.write(': ping\n\n'); }, 25000);
  req.on('close', function() {
    clearInterval(heartbeat);
    collectClients.delete(res);
  });
});

router.post('/collect', requireAuth, function(req, res) {
  runCollectInBackground();
  if (req.get('X-Requested-With')) return res.status(204).end();
  res.redirect(req.teBase + '/admin/?started=1');
});

router.post('/sources/collect', requireAuth, express.urlencoded({ extended: false }), async function(req, res) {
  var sources = await data.getAllSources().catch(function() { return []; });
  var source = sources.find(function(s) { return s.type === req.body.type && s.value === req.body.value; });
  if (source) runCollectInBackground([source]);
  if (req.get('X-Requested-With')) return res.status(204).end();
  res.redirect(req.teBase + '/admin/?started=1');
});

router.post('/sources', requireAuth, express.urlencoded({ extended: false }), async function(req, res) {
  var sourceError = null;
  try {
    await data.addSource({ type: req.body.type, value: req.body.value, label: req.body.label });
  } catch (e) {
    sourceError = e.message;
  }
  if (sourceError) return renderSources(res, { sourceError: sourceError });
  res.redirect(req.teBase + '/admin/sources');
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
  backTo(req, res, req.teBase + '/admin/events');
});

router.post('/events/:id/show', requireAuth, async function(req, res) {
  await data.setEventHidden(req.params.id, false);
  backTo(req, res, req.teBase + '/admin/events');
});

router.post('/events/:id/delete', requireAuth, async function(req, res) {
  await data.deleteEvent(req.params.id);
  backTo(req, res, req.teBase + '/admin/events');
});

router.get('/events/:id/edit', requireAuth, async function(req, res, next) {
  try {
    var event = await data.getEventById(req.params.id);
    if (!event) return next();
    var submitter = (event.submission && event.submission.userId)
      ? await teUsersLib.getUserById(event.submission.userId).catch(function() { return null; })
      : null;
    var venues = await data.getVenues();
    venues.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
    res.render('tbilisi-events/admin/event-edit', {
      title: 'Правка события',
      event: event,
      submitter: submitter,
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
      titleI18n: (b.title_ru || b.title_en || b.title_ka)
        ? { ru: (b.title_ru || '').trim(), en: (b.title_en || '').trim(), ka: (b.title_ka || '').trim() }
        : null,
      editorNote: (b.note_ru || b.note_en || b.note_ka)
        ? { ru: (b.note_ru || '').trim(), en: (b.note_en || '').trim(), ka: (b.note_ka || '').trim() }
        : null,
    };
    var prev = await data.getEventById(req.params.id);
    if (prev && prev.submission && prev.submission.userId && !prev.active && patch.active && prev.submission.status !== 'approved') {
      patch.submission = Object.assign({}, prev.submission, { status: 'approved' });
    }
    await data.updateEvent(req.params.id, patch);
    if (prev && prev.submission && prev.submission.userId) {
      var link = 'https://events.tbiliseli.com/tbilisi-events/e/' + req.params.id;
      if (!prev.active && patch.active && prev.submission.status !== 'approved') {
        teNotify.notifyUser(prev.submission.userId, 'published', { title: patch.title || prev.title, link: link });
      } else if (b.notifyAuthor === 'on') {
        teNotify.notifyUser(prev.submission.userId, 'updated', { title: patch.title || prev.title, link: link });
      }
    }
    res.redirect(req.teBase + '/admin/events');
  } catch (e) { next(e); }
});

router.post('/events/:id/reject-submission', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var ev = await data.getEventById(req.params.id);
    if (!ev || !ev.submission || !ev.submission.userId) return res.redirect(req.teBase + '/admin/events');
    var reason = (req.body.reason || '').trim() || null;
    await data.updateEvent(req.params.id, { active: false, hidden: true, submission: Object.assign({}, ev.submission, { status: 'rejected', rejectReason: reason }) });
    teNotify.notifyUser(ev.submission.userId, 'rejected', { title: ev.title, reason: reason });
    res.redirect(req.teBase + '/admin/events/' + req.params.id + '/edit');
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
    backTo(req, res, req.teBase + '/admin/events');
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
    backTo(req, res, req.teBase + '/admin/events');
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
      researchStarted: req.query.research === '1',
    });
  } catch (e) { next(e); }
});

router.post('/venues', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var name = (req.body.name || '').trim();
    if (!name) return res.redirect(req.teBase + '/admin/venues');
    var id = await data.insertVenue({
      name: name,
      nameKey: venuesLib.normalizeVenueName(name),
      origin: 'manual',
    });
    res.redirect(req.teBase + '/admin/venues/' + id);
  } catch (e) { next(e); }
});

router.get('/venues/:id', requireAuth, async function(req, res, next) {
  try {
    var venue = await data.getVenueById(req.params.id);
    if (!venue) return next();

    var showPast = req.query.past === '1';
    var today = new Date().toISOString().slice(0, 10);
    var venueEvents = await data.getEventsByVenue(venue.id).catch(function() { return []; });

    var upcoming = venueEvents.filter(function(e) { return (e.date || '') >= today; })
      .sort(function(a, b) { return (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''); });
    var past = venueEvents.filter(function(e) { return (e.date || '') < today; })
      .sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });

    res.render('tbilisi-events/admin/venue-detail', {
      title: venue.name + ' — Tbilisi Events Admin',
      venue: venue,
      venueTypeSlugs: taxonomy.VENUE_TYPE_SLUGS,
      venueTypeLabels: taxonomy.VENUE_TYPE_LABELS,
      cities: taxonomy.CITIES,
      districtsByCity: taxonomy.DISTRICTS,
      upcoming: upcoming,
      past: past,
      showPast: showPast,
      totalCount: venueEvents.length,
    });
  } catch (e) { next(e); }
});

router.post('/venues/:id/verify', requireAuth, async function(req, res, next) {
  try {
    var venue = await data.getVenueById(req.params.id);
    if (!venue) return next();
    await data.updateVenue(venue.id, { editorVerified: !venue.editorVerified });
    backTo(req, res, req.teBase + '/admin/venues/' + venue.id);
  } catch (e) { next(e); }
});

router.post('/venues/:id/edit', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var b = req.body;
    var latNum = parseFloat(b.lat);
    var lngNum = parseFloat(b.lng);
    var city = taxonomy.isValidCity(b.city) ? b.city : null;
    var district = (city && taxonomy.isValidDistrict(city, b.district)) ? b.district : null;
    var patch = {
      name: (b.name || '').trim(),
      nameKey: venuesLib.normalizeVenueName((b.name || '').trim()),
      city: city,
      district: district,
      area: (b.area || '').trim() || null,
      address: (b.address || '').trim() || null,
      website: (b.website || '').trim() || null,
      type: taxonomy.isValidVenueType(b.type) ? b.type : null,
      lat: isNaN(latNum) ? null : latNum,
      lng: isNaN(lngNum) ? null : lngNum,
      description: (b.desc_ru || b.desc_en || b.desc_ka)
        ? { ru: (b.desc_ru || '').trim(), en: (b.desc_en || '').trim(), ka: (b.desc_ka || '').trim() }
        : null,
      editorVerified: b.editorVerified === 'on',
    };
    await data.updateVenue(req.params.id, patch);
    backTo(req, res, req.teBase + '/admin/venues/' + req.params.id);
  } catch (e) { next(e); }
});

router.post('/venues/:id/delete', requireAuth, async function(req, res, next) {
  try {
    await data.deleteVenue(req.params.id);
    res.redirect(req.teBase + '/admin/venues');
  } catch (e) { next(e); }
});

router.post('/events/:id/image', requireAuth, venueUpload.single('image'), async function(req, res, next) {
  try {
    if (!req.file) return backTo(req, res, req.teBase + '/admin/events/' + req.params.id + '/edit');
    var url = await images.storeEventImage(req.file.buffer, req.params.id);
    await data.updateEvent(req.params.id, { imageUrl: url });
    backTo(req, res, req.teBase + '/admin/events/' + req.params.id + '/edit');
  } catch (e) { next(e); }
});

router.post('/venues/:id/image', requireAuth, venueUpload.single('image'), async function(req, res, next) {
  try {
    if (req.file && req.file.buffer) {
      var url = await images.storeVenueImage(req.file.buffer, req.params.id);
      await data.updateVenue(req.params.id, { imageUrl: url });
    }
    backTo(req, res, req.teBase + '/admin/venues/' + req.params.id);
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
    backTo(req, res, req.teBase + '/admin/venues/' + venue.id);
  } catch (e) { next(e); }
});

// Turn a researchVenue() result into a patch that only fills EMPTY fields, so a
// re-run never clobbers an admin's manual edits. Low confidence / not found → just
// a note. Returns the patch (always carries researchedAt + researchNote).
function researchPatch(venue, r) {
  var patch = { researchedAt: new Date() };
  if (!r.found || r.confidence === 'low') {
    patch.researchNote = 'не найдено';
    return patch;
  }
  patch.researchNote = r.confidence + (r.canonicalName ? ' · ' + r.canonicalName : '');
  if (!venue.address && r.address) patch.address = r.address;
  if (!venue.area && r.area) patch.area = r.area;
  if (venue.lat == null && r.lat != null) patch.lat = r.lat;
  if (venue.lng == null && r.lng != null) patch.lng = r.lng;
  if (!venue.website && r.website) patch.website = r.website;
  if (!venue.type && r.type) patch.type = r.type;
  if (!venue.description && r.description) patch.description = r.description;
  return patch;
}

function venueNeedsResearch(v) {
  return !v.address || v.lat == null || v.lng == null || !v.type || !v.description;
}

function researchVenuesInBackground() {
  (async function() {
    var venues = await data.getVenues();
    var targets = venues.filter(venueNeedsResearch);
    var filled = 0, notFound = 0, failed = 0;
    for (var i = 0; i < targets.length; i++) {
      var v = targets[i];
      try {
        var patch = researchPatch(v, await venuesLib.researchVenue(v.name));
        if (Object.keys(patch).length > 2) filled++;
        else if (patch.researchNote === 'не найдено') notFound++;
        await data.updateVenue(v.id, patch);
      } catch (e) {
        failed++;
        console.error('[venues research] ' + v.name + ': ' + e.message);
      }
      await new Promise(function(r) { setTimeout(r, 1200); }); // stay courteous to Nominatim + web search
    }
    return { targets: targets.length, filled: filled, notFound: notFound, failed: failed };
  })().then(function(s) {
    alertMe({ parse_mode: 'HTML', text: '🏛 <b>Площадки — авто-заполнение завершено</b>\n'
      + 'Обработано: ' + s.targets + '\nЗаполнено: ' + s.filled + '\nНе найдено: ' + s.notFound + '\nОшибок: ' + s.failed });
  }).catch(function(e) {
    alertMe({ text: '❌ Площадки — авто-заполнение упало: ' + e.message }).catch(function() {});
  });
}

router.post('/venues/:id/research', requireAuth, async function(req, res, next) {
  try {
    var venue = await data.getVenueById(req.params.id);
    if (!venue) return next();
    var patch = researchPatch(venue, await venuesLib.researchVenue(venue.name));
    await data.updateVenue(venue.id, patch);
    backTo(req, res, req.teBase + '/admin/venues/' + venue.id);
  } catch (e) { next(e); }
});

router.post('/venues/research-missing', requireAuth, function(req, res) {
  researchVenuesInBackground();
  res.redirect(req.teBase + '/admin/venues?research=1');
});

router.post('/venues/merge', requireAuth, express.urlencoded({ extended: false }), async function(req, res) {
  try {
    await data.mergeVenues((req.body.fromId || '').trim(), (req.body.toId || '').trim());
  } catch (e) { /* fall through to redirect; error is transient/operator-visible next load */ }
  res.redirect(req.teBase + '/admin/venues');
});

// --- admins (superadmin only) --------------------------------------------
async function renderAdmins(res, extra) {
  var admins = await data.getAdmins().catch(function() { return []; });
  res.render('tbilisi-events/admin/admins', Object.assign({
    title: 'Админы — Tbilisi Events Admin',
    admins: admins,
    currentAdminId: res.locals.adminId,
    adminError: null,
    saved: false,
  }, extra));
}

router.get('/admins', requireAuth, requireSuperAdmin, async function(req, res) {
  await renderAdmins(res, { saved: req.query.saved === '1' });
});

router.post('/admins', requireAuth, requireSuperAdmin, express.urlencoded({ extended: false }), async function(req, res) {
  var adminError = null;
  try {
    var pass = (req.body.password || '').trim();
    if (!pass) throw new Error('Укажите пароль');
    await data.addAdmin({
      name: req.body.name,
      passwordHash: cookieToken(pass),
      superadmin: req.body.superadmin === 'on',
    });
  } catch (e) {
    adminError = e.message;
  }
  if (adminError) return renderAdmins(res, { adminError: adminError });
  res.redirect(req.teBase + '/admin/admins?saved=1');
});

router.post('/admins/:id', requireAuth, requireSuperAdmin, express.urlencoded({ extended: false }), async function(req, res) {
  var patch = { superadmin: req.body.superadmin === 'on' };
  var pass = (req.body.password || '').trim();
  if (pass) patch.passwordHash = cookieToken(pass);
  try {
    await data.updateAdmin(req.params.id, patch);
  } catch (e) { /* fall through to redirect */ }
  res.redirect(req.teBase + '/admin/admins?saved=1');
});

router.post('/admins/:id/delete', requireAuth, requireSuperAdmin, async function(req, res) {
  if (req.params.id !== res.locals.adminId) {
    try {
      await data.deleteAdmin(req.params.id);
    } catch (e) { /* fall through to redirect */ }
  }
  res.redirect(req.teBase + '/admin/admins');
});

// --- heroes & curated collections --------------------------------------------
function i18nBody(b, prefix) {
  return { ru: (b[prefix + '_ru'] || '').trim(), en: (b[prefix + '_en'] || '').trim(), ka: (b[prefix + '_ka'] || '').trim() };
}

async function renderHeroes(res, extra) {
  var heroes = await data.getHeroes().catch(function() { return []; });
  heroes.sort(function(a, b) { return ((a.name && a.name.ru) || '').localeCompare((b.name && b.name.ru) || ''); });
  res.render('tbilisi-events/admin/heroes', Object.assign({ title: 'Герои — Tbilisi Events Admin', heroes: heroes }, extra));
}

router.get('/heroes', requireAuth, async function(req, res) {
  await renderHeroes(res, {});
});

router.post('/heroes', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var name = i18nBody(req.body, 'name');
    if (name.ru || name.en || name.ka) {
      await data.insertHero({ name: name, description: i18nBody(req.body, 'desc') });
    }
    res.redirect(req.teBase + '/admin/heroes');
  } catch (e) { next(e); }
});

router.post('/heroes/:id/edit', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    await data.updateHero(req.params.id, { name: i18nBody(req.body, 'name'), description: i18nBody(req.body, 'desc') });
    res.redirect(req.teBase + '/admin/heroes');
  } catch (e) { next(e); }
});

router.post('/heroes/:id/image', requireAuth, venueUpload.single('image'), async function(req, res, next) {
  try {
    if (req.file && req.file.buffer) {
      var url = await images.storeHeroImage(req.file.buffer, req.params.id);
      await data.updateHero(req.params.id, { imageUrl: url });
    }
    res.redirect(req.teBase + '/admin/heroes');
  } catch (e) { next(e); }
});

router.post('/heroes/:id/delete', requireAuth, async function(req, res, next) {
  try {
    await data.deleteHero(req.params.id);
    res.redirect(req.teBase + '/admin/heroes');
  } catch (e) { next(e); }
});

async function renderCollections(res, extra) {
  var collections = await data.getCollections().catch(function() { return []; });
  var heroes = await data.getHeroes().catch(function() { return []; });
  var heroById = {};
  heroes.forEach(function(h) { heroById[h.id] = h; });
  collections.sort(function(a, b) {
    return ((b.updatedAt && b.updatedAt.toMillis ? b.updatedAt.toMillis() : 0)
      - (a.updatedAt && a.updatedAt.toMillis ? a.updatedAt.toMillis() : 0));
  });
  res.render('tbilisi-events/admin/collections', Object.assign({
    title: 'Подборки — Tbilisi Events Admin',
    collections: collections, heroes: heroes, heroById: heroById,
  }, extra));
}

router.get('/collections', requireAuth, async function(req, res) {
  await renderCollections(res, {});
});

router.get('/collections/:id', requireAuth, async function(req, res, next) {
  try {
    var collection = await data.getCollectionById(req.params.id);
    if (!collection) return next();

    var heroes = await data.getHeroes().catch(function() { return []; });
    var events = await data.getAllEvents().catch(function() { return []; });
    var eventById = {};
    events.forEach(function(e) { eventById[e.id] = e; });

    var ids = collection.eventIds || [];
    var attached = ids.map(function(id) { return { id: id, event: eventById[id] || null }; });
    var inSet = {};
    ids.forEach(function(id) { inSet[id] = true; });

    var available = events
      .filter(function(e) { return !inSet[e.id]; })
      .sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });

    res.render('tbilisi-events/admin/collection-detail', {
      title: ((collection.title && collection.title.ru) || 'Подборка') + ' — Tbilisi Events Admin',
      collection: collection,
      hero: collection.heroId ? (heroes.find(function(h) { return h.id === collection.heroId; }) || null) : null,
      heroes: heroes,
      attached: attached,
      available: available,
    });
  } catch (e) { next(e); }
});

router.post('/collections', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var title = i18nBody(req.body, 'title');
    if (!(title.ru || title.en || title.ka)) return res.redirect(req.teBase + '/admin/collections');
    var id = await data.insertCollection({ title: title, heroId: (req.body.heroId || '').trim() || null });
    res.redirect(req.teBase + '/admin/collections/' + id);
  } catch (e) { next(e); }
});

router.post('/collections/:id/edit', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    await data.updateCollection(req.params.id, {
      title: i18nBody(req.body, 'title'),
      curatorNote: i18nBody(req.body, 'note'),
      heroId: (req.body.heroId || '').trim() || null,
      published: req.body.published === 'on',
    });
    backTo(req, res, req.teBase + '/admin/collections/' + req.params.id);
  } catch (e) { next(e); }
});

async function mutateCollectionEvents(id, fn) {
  var c = await data.getCollectionById(id);
  if (!c) return;
  var ids = (c.eventIds || []).slice();
  var next = fn(ids);
  await data.updateCollection(id, { eventIds: next });
}

router.post('/collections/:id/events/add', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var eventId = (req.body.eventId || '').trim();
    await mutateCollectionEvents(req.params.id, function(ids) {
      if (eventId && ids.indexOf(eventId) === -1) ids.push(eventId);
      return ids;
    });
    backTo(req, res, req.teBase + '/admin/collections/' + req.params.id);
  } catch (e) { next(e); }
});

router.post('/collections/:id/events/remove', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var eventId = (req.body.eventId || '').trim();
    await mutateCollectionEvents(req.params.id, function(ids) {
      return ids.filter(function(x) { return x !== eventId; });
    });
    backTo(req, res, req.teBase + '/admin/collections/' + req.params.id);
  } catch (e) { next(e); }
});

router.post('/collections/:id/events/move', requireAuth, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    var eventId = (req.body.eventId || '').trim();
    var dir = req.body.dir === 'up' ? -1 : 1;
    await mutateCollectionEvents(req.params.id, function(ids) {
      var i = ids.indexOf(eventId);
      var j = i + dir;
      if (i !== -1 && j >= 0 && j < ids.length) {
        var tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
      }
      return ids;
    });
    backTo(req, res, req.teBase + '/admin/collections/' + req.params.id);
  } catch (e) { next(e); }
});

router.post('/collections/:id/delete', requireAuth, async function(req, res, next) {
  try {
    await data.deleteCollection(req.params.id);
    res.redirect(req.teBase + '/admin/collections');
  } catch (e) { next(e); }
});

router.get('/organizer-claims', requireAuth, async function(req, res, next) {
  try {
    var status = req.query.status || '';
    var claims = await data.getOrganizerClaims(status ? { status: status } : {});
    var events = {}, venues = {}, usersById = {};
    for (var i = 0; i < claims.length; i++) {
      var c = claims[i];
      if (c.targetType === 'event' && !events[c.targetId]) events[c.targetId] = await data.getEventById(c.targetId).catch(function() { return null; });
      if (c.targetType === 'venue' && !venues[c.targetId]) venues[c.targetId] = await data.getVenueById(c.targetId).catch(function() { return null; });
      if (!usersById[c.uid]) usersById[c.uid] = await teUsersLib.getUserById(c.uid).catch(function() { return null; });
    }
    res.render('tbilisi-events/admin/organizer-claims', {
      title: 'Организаторы — Tbilisi Events Admin',
      claims: claims, events: events, venues: venues, usersById: usersById, status: status,
    });
  } catch (e) { next(e); }
});

router.post('/organizer-claims/:id/approve', requireAuth, async function(req, res, next) {
  try {
    var c = await data.getOrganizerClaimById(req.params.id);
    if (!c || c.status !== 'new') return res.redirect(req.teBase + '/admin/organizer-claims');
    var target = c.targetType === 'event'
      ? await data.getEventById(c.targetId).catch(function() { return null; })
      : await data.getVenueById(c.targetId).catch(function() { return null; });
    if (target) {
      if (c.targetType === 'event') await data.setEventOrganizer(c.targetId, c.uid);
      else await data.setVenueOrganizer(c.targetId, c.uid);
    }
    await data.decideOrganizerClaim(c.id, 'approved');
    teNotify.notifyUser(c.uid, 'organizer_approved', { title: (target && (target.title || target.name)) || c.targetId });
    res.redirect(req.teBase + '/admin/organizer-claims');
  } catch (e) { next(e); }
});

router.post('/organizer-claims/:id/reject', requireAuth, async function(req, res, next) {
  try {
    var c = await data.getOrganizerClaimById(req.params.id);
    if (!c || c.status !== 'new') return res.redirect(req.teBase + '/admin/organizer-claims');
    await data.decideOrganizerClaim(c.id, 'rejected');
    var target = c.targetType === 'event'
      ? await data.getEventById(c.targetId).catch(function() { return null; })
      : await data.getVenueById(c.targetId).catch(function() { return null; });
    teNotify.notifyUser(c.uid, 'organizer_rejected', { title: (target && (target.title || target.name)) || c.targetId });
    res.redirect(req.teBase + '/admin/organizer-claims');
  } catch (e) { next(e); }
});

router.get('/users', requireAuth, requireSuperAdmin, async function(req, res, next) {
  try {
    var users = await teUsersLib.listUsers();
    users.sort(function(a, b) {
      var am = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
      var bm = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
      return bm - am;
    });
    var allEvents = await data.getAllEvents().catch(function() { return []; });
    var pendingByUser = {};
    allEvents.forEach(function(e) {
      if (e.submission && e.submission.userId) pendingByUser[e.submission.userId] = (pendingByUser[e.submission.userId] || 0) + 1;
    });
    res.render('tbilisi-events/admin/users', { title: 'Пользователи — Tbilisi Events Admin', users: users, pendingByUser: pendingByUser });
  } catch (e) { next(e); }
});

module.exports = router;
