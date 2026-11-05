'use strict';
// Bot console for @dimazvalibot: users, conversations, broadcasts, bot settings & commands.
// Mounted by routes/dimazvali.js at /console (bot.dimazvali.com/console).
// Structure and logic ported from libo-guides-bot (src/admin, src/broadcasts.js, src/chat.js,
// src/bot-control.js) onto Express + pug + Firestore.
//
// Auth: the bot's existing Telegram-widget login (POST /auth → signed adminToken cookie →
// DIMAZVALIadminTokens doc → DIMAZVALIusers doc with admin: true). The old /web panel stays.

var express = require('express');
var multer = require('multer');

var { createTg, maskToken } = require('../lib/bot-console/tg');
var { Chats, ChatError, sendToUser } = require('../lib/bot-console/chats');
var { Broadcasts, BroadcastError, SEGMENTS } = require('../lib/bot-console/broadcasts');
var commands = require('../lib/bot-console/commands');

var PAGE_SIZE = 50;
var HOOK_URL = 'https://bot.dimazvali.com/hook';

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v._seconds != null) return new Date(v._seconds * 1000);
  var d = new Date(v);
  return isNaN(d) ? null : d;
}

function fmtDate(v) {
  var d = toDate(v);
  if (!d) return '—';
  return d.toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function displayName(u) {
  var name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return name || (u.username ? '@' + u.username : 'id ' + u.id);
}

module.exports = function createConsole(deps) {
  var fb = deps.fb;
  var udb = deps.udb;
  var adminTokens = deps.adminTokens;
  var token = deps.token;
  var develop = !!deps.develop;
  var log = deps.log || function() {};
  var botUsername = deps.botUsername || 'dimazvalibot';

  var broadcastsCol = fb.collection('DIMAZVALIbroadcasts');
  var consoleCol = fb.collection('DIMAZVALIconsole');

  var chats = new Chats({ col: deps.messages });
  var tg = createTg(token, { http: deps.http, onSent: function(m, p, r, meta) { chats.recordOut(m, p, r, meta); } });

  async function markBotBlocked(userId) {
    await udb.doc(String(userId)).set({ botBlocked: true, botBlockedAt: new Date() }, { merge: true });
  }

  var broadcasts = new Broadcasts({
    tg: tg,
    log: function(text) { log({ silent: true, text: text }); },
    store: {
      list: async function() { var s = await broadcastsCol.get(); return s.docs.map(function(d) { return d.data(); }); },
      get: async function(id) { var d = await broadcastsCol.doc(id).get(); return d.exists ? d.data() : null; },
      save: function(id, doc) { return broadcastsCol.doc(id).set(doc); },
      users: async function() {
        var s = await udb.get();
        return s.docs.map(function(d) { var u = d.data(); return { id: d.id, blocked: !!u.blocked, botBlocked: !!u.botBlocked, photoSubscribed: u.photoSubscribed === true }; });
      },
      markBlocked: markBotBlocked,
    },
  });

  // Commands live in memory for the hook; loaded once, replaced on save
  var commandItems = commands.normalize(null);
  consoleCol.doc('commands').get().then(function(d) {
    if (d.exists) commandItems = commands.normalize(d.data());
  }).catch(function(err) { console.warn('[bot-console] commands not loaded:', err.message); });

  // After a restart: continue broadcasts that were running. Not from a dev machine —
  // it shares the production Firestore and would double-send.
  if (!develop) setTimeout(function() { broadcasts.resumeAll(); }, 5000);

  // ── hook integration (called from routes/dimazvali.js /hook) ─────────────
  function onMessage(msg) {
    if (!msg || !msg.chat || msg.chat.type !== 'private') return;
    chats.recordIn(msg);
    // Wrote to the bot again → evidently unblocked it
    udb.doc(String(msg.chat.id)).get().then(function(d) {
      if (d.exists && d.data().botBlocked) return udb.doc(String(msg.chat.id)).update({ botBlocked: false });
    }).catch(function() {});
  }

  function commandFor(text) { return commands.match(commandItems, text, botUsername); }

  function replyCommand(chatId, item) {
    return commands.replyToCommand(tg, chatId, item).catch(function(err) {
      if (err.code === 403) return markBotBlocked(chatId);
      console.warn('[bot-console] /' + item.command + ' reply failed:', err.description || err.message);
    });
  }

  // ── router ───────────────────────────────────────────────────────────────
  var router = express.Router();
  var upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 45 * 1024 * 1024 } });

  router.use(function(req, res, next) {
    res.locals.base = req.baseUrl;
    res.locals.fmtDate = fmtDate;
    res.locals.displayName = displayName;
    res.locals.flash = { ok: req.query.ok || null, error: req.query.error || null };
    next();
  });

  function go(res, path, kind, text) {
    var url = res.locals.base + path;
    if (kind) url += (url.indexOf('?') > -1 ? '&' : '?') + kind + '=' + encodeURIComponent(text);
    res.redirect(url);
  }

  router.get('/login', function(req, res) {
    res.render('dimazvali/console/login', { botUsername: botUsername, authUrl: req.baseUrl.replace(/\/console$/, '') + '/auth' });
  });

  router.get('/logout', function(req, res) {
    var id = req.signedCookies.adminToken;
    if (id) adminTokens.doc(id).update({ active: false }).catch(function() {});
    res.clearCookie('adminToken');
    go(res, '/login');
  });

  // Auth gate for everything below
  router.use(async function(req, res, next) {
    try {
      var tokenId = req.signedCookies.adminToken;
      if (!tokenId && develop && process.env.adminToken) {
        tokenId = process.env.adminToken;
        res.cookie('adminToken', tokenId, { maxAge: 24 * 3600 * 1000, signed: true, httpOnly: true });
      }
      if (!tokenId) return go(res, '/login');
      var t = await adminTokens.doc(tokenId).get();
      if (!t.exists || t.data().active === false) return go(res, '/login');
      var u = await udb.doc(String(t.data().user)).get();
      if (!u.exists || !u.data().admin) return res.status(403).render('dimazvali/console/login', { botUsername: botUsername, authUrl: req.baseUrl.replace(/\/console$/, '') + '/auth', error: 'Этот аккаунт — не админ бота' });
      var data = Object.assign({ id: u.id }, u.data());
      res.locals.admin = { id: Number(u.id), name: displayName(data) };
      next();
    } catch (err) { next(err); }
  });

  router.get('/', function(req, res) { go(res, '/users'); });

  // ── users ────────────────────────────────────────────────────────────────
  var FILTERS = {
    all: { label: 'Все', fn: function() { return true; } },
    photo: { label: 'Подписчики фото', fn: function(u) { return u.photoSubscribed === true; } },
    admins: { label: 'Админы', fn: function(u) { return !!u.admin; } },
    botBlocked: { label: 'Заблокировали бота', fn: function(u) { return !!u.botBlocked; } },
  };

  router.get('/users', async function(req, res, next) {
    try {
      var snap = await udb.get();
      var all = snap.docs.map(function(d) { return Object.assign({}, d.data(), { id: d.id }); });
      var counts = {};
      Object.keys(FILTERS).forEach(function(k) { counts[k] = all.filter(FILTERS[k].fn).length; });
      var f = FILTERS[req.query.f] ? req.query.f : 'all';
      var q = String(req.query.q || '').trim().toLowerCase().replace(/^@/, '');
      var list = all.filter(FILTERS[f].fn).filter(function(u) {
        if (!q) return true;
        return [u.id, u.username, u.first_name, u.last_name].filter(Boolean).join(' ').toLowerCase().indexOf(q) > -1;
      });
      list.sort(function(a, b) { return ((toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0)); });
      var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      var page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
      res.render('dimazvali/console/users', {
        nav: 'users', users: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        total: list.length, page: page, pages: pages, f: f, q: req.query.q || '', filters: FILTERS, counts: counts,
      });
    } catch (err) { next(err); }
  });

  router.get('/users/:id', async function(req, res, next) {
    try {
      var d = await udb.doc(req.params.id).get();
      if (!d.exists) return res.status(404).render('dimazvali/console/notfound', { nav: 'users', what: 'Пользователь не найден' });
      var user = Object.assign({}, d.data(), { id: d.id });
      var history = await chats.history(user.id, { before: req.query.before || null });
      res.render('dimazvali/console/user', { nav: 'users', user: user, history: history });
    } catch (err) { next(err); }
  });

  // Live updates for an open user card
  router.get('/users/:id/stream', function(req, res) {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    res.write('retry: 5000\n\n');
    var off = chats.subscribe(req.params.id, function(m) { res.write('data: ' + JSON.stringify(m) + '\n\n'); });
    var ping = setInterval(function() { res.write(': ping\n\n'); }, 25000);
    req.on('close', function() { clearInterval(ping); off(); });
  });

  router.post('/users/:id/send', upload.single('file'), async function(req, res, next) {
    var back = '/users/' + req.params.id;
    try {
      var file = req.file ? { buf: req.file.buffer, name: req.file.originalname, type: req.file.mimetype } : null;
      await sendToUser(tg, Number(req.params.id), { text: req.body.text, file: file }, res.locals.admin);
      await chats.flush(req.params.id);
      go(res, back + '#bottom');
    } catch (err) {
      if (err instanceof ChatError) {
        if (err.blocked) markBotBlocked(req.params.id).catch(function() {});
        return go(res, back, 'error', err.message);
      }
      next(err);
    }
  });

  router.post('/users/:id/flag', async function(req, res, next) {
    try {
      var flag = req.body.flag;
      if (['admin', 'photoSubscribed', 'blocked'].indexOf(flag) === -1) return go(res, '/users/' + req.params.id, 'error', 'Нет такого флага');
      if (flag === 'admin' && Number(req.params.id) === res.locals.admin.id) return go(res, '/users/' + req.params.id, 'error', 'С себя админа не снять');
      var on = req.body.value === '1';
      await udb.doc(req.params.id).update({ [flag]: on });
      log({ silent: true, admin: res.locals.admin.id, user: Number(req.params.id), text: res.locals.admin.name + ': ' + flag + ' → ' + on + ' для ' + req.params.id });
      go(res, '/users/' + req.params.id, 'ok', 'Сохранено');
    } catch (err) { next(err); }
  });

  // Telegram file preview (photos, stickers) — proxied, the token never reaches the browser
  router.get('/file/:fileId', async function(req, res) {
    try {
      var f = await tg.fileStream(req.params.fileId);
      if (f.contentType) res.type(f.contentType);
      else if (/\.webp$/.test(f.path)) res.type('image/webp');
      else if (/\.jpe?g$/.test(f.path)) res.type('image/jpeg');
      res.set('Cache-Control', 'private, max-age=86400');
      f.stream.pipe(res);
    } catch (err) {
      res.status(404).end();
    }
  });

  // ── broadcasts ───────────────────────────────────────────────────────────
  async function segmentCounts() {
    var out = {};
    for (var k of Object.keys(SEGMENTS)) out[k] = await broadcasts.countRecipients({ segment: k });
    return out;
  }

  router.get('/broadcasts', async function(req, res, next) {
    try {
      res.render('dimazvali/console/broadcasts', {
        nav: 'broadcasts', list: await broadcasts.list(), segments: SEGMENTS, counts: await segmentCounts(), form: {},
      });
    } catch (err) { next(err); }
  });

  router.post('/broadcasts', async function(req, res, next) {
    try {
      var doc = await broadcasts.create(req.body, res.locals.admin.id);
      log({ silent: true, admin: res.locals.admin.id, text: res.locals.admin.name + ' создаёт рассылку ' + doc.id });
      go(res, '/broadcasts/' + doc.id, 'ok', 'Черновик сохранён. Теперь «Отправить себе»');
    } catch (err) {
      if (!(err instanceof BroadcastError)) return next(err);
      res.status(400).render('dimazvali/console/broadcasts', {
        nav: 'broadcasts', list: await broadcasts.list(), segments: SEGMENTS, counts: await segmentCounts(),
        form: req.body, formError: err.message,
      });
    }
  });

  router.get('/broadcasts/:id', async function(req, res, next) {
    try {
      var doc = await broadcasts.get(req.params.id);
      if (!doc) return res.status(404).render('dimazvali/console/notfound', { nav: 'broadcasts', what: 'Рассылка не найдена' });
      var count = doc.status === 'draft' ? await broadcasts.countRecipients(doc) : (doc.recipients || []).length;
      res.render('dimazvali/console/broadcast', { nav: 'broadcasts', doc: doc, segments: SEGMENTS, count: count });
    } catch (err) { next(err); }
  });

  var ACTIONS = {
    update: function(id, req, admin) { return broadcasts.update(id, req.body).then(function() { return 'Сохранено. Отправьте себе ещё раз'; }); },
    test: function(id, req, admin) { return broadcasts.sendTest(id, admin).then(function() { return 'Отправлено вам в Telegram — посмотрите, как выглядит'; }); },
    start: function(id, req, admin) { return broadcasts.start(id, admin.id).then(function(n) { return 'Запущено: ' + n + ' получателей'; }); },
    pause: function(id) { return broadcasts.pause(id).then(function() { return 'Пауза'; }); },
    resume: function(id) { return broadcasts.resume(id).then(function() { return 'Продолжаем'; }); },
    cancel: function(id) { return broadcasts.cancel(id).then(function() { return 'Отменено'; }); },
  };

  router.post('/broadcasts/:id/:action', async function(req, res, next) {
    var action = ACTIONS[req.params.action];
    var back = '/broadcasts/' + req.params.id;
    if (!action) return go(res, back, 'error', 'Нет такого действия');
    try {
      var msg = await action(req.params.id, req, res.locals.admin);
      log({ silent: true, admin: res.locals.admin.id, text: res.locals.admin.name + ': рассылка ' + req.params.id + ' — ' + req.params.action });
      go(res, back, 'ok', msg);
    } catch (err) {
      if (err instanceof BroadcastError) return go(res, back, 'error', err.message);
      next(err);
    }
  });

  // ── bot ──────────────────────────────────────────────────────────────────
  router.get('/bot', async function(req, res, next) {
    try {
      var status = { tokenMasked: maskToken(token), hookUrl: HOOK_URL };
      try {
        var r = await Promise.all([tg.call('getMe'), tg.call('getWebhookInfo'), tg.call('getMyCommands')]);
        status.me = r[0]; status.webhook = r[1]; status.liveMenu = r[2];
      } catch (err) {
        status.error = err.description || err.message;
      }
      res.render('dimazvali/console/bot', {
        nav: 'bot', status: status, items: commandItems, menu: commands.menuOf(commandItems), develop: develop,
      });
    } catch (err) { next(err); }
  });

  router.post('/bot/webhook', async function(req, res) {
    var url = String(req.body.url || HOOK_URL).trim();
    if (!/^https:\/\/\S+$/.test(url)) return go(res, '/bot', 'error', 'Адрес вебхука — https://…');
    try {
      await tg.call('setWebhook', { url: url });
      log({ silent: true, admin: res.locals.admin.id, text: res.locals.admin.name + ' ставит вебхук ' + url });
      go(res, '/bot', 'ok', 'Вебхук: ' + url);
    } catch (err) {
      go(res, '/bot', 'error', 'Телеграм: ' + (err.description || err.message));
    }
  });

  router.post('/bot/commands', async function(req, res, next) {
    var parsed = commands.parseForm(req.body);
    if (parsed.error) return go(res, '/bot', 'error', parsed.error);
    try {
      // Telegram first: if it rejects the menu, nothing is saved
      await tg.call('setMyCommands', { commands: commands.menuOf(parsed.items) });
    } catch (err) {
      return go(res, '/bot', 'error', 'Телеграм не принял меню: ' + (err.description || err.message));
    }
    try {
      await consoleCol.doc('commands').set({ items: parsed.items, updatedAt: new Date(), updatedBy: res.locals.admin.id });
      commandItems = parsed.items;
      log({ silent: true, admin: res.locals.admin.id, text: res.locals.admin.name + ' обновляет команды бота' });
      go(res, '/bot', 'ok', 'Команды сохранены, меню в Telegram обновлено');
    } catch (err) { next(err); }
  });

  // Try a custom command's reply on yourself before users see it
  router.post('/bot/commands/:command/test', async function(req, res) {
    var item = commandItems.find(function(i) { return i.command === req.params.command && !i.builtin; });
    if (!item) return go(res, '/bot', 'error', 'Нет такой команды');
    try {
      await commands.replyToCommand(tg, res.locals.admin.id, item);
      go(res, '/bot', 'ok', 'Ответ /' + item.command + ' отправлен вам');
    } catch (err) {
      go(res, '/bot', 'error', 'Телеграм: ' + (err.description || err.message));
    }
  });

  return {
    router: router,
    onMessage: onMessage,
    commandFor: commandFor,
    replyCommand: replyCommand,
    chats: chats,
    broadcasts: broadcasts,
  };
};
