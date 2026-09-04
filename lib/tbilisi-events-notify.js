'use strict';
// Message delivery for tbilisi-events. Every Telegram message — contributor and
// admin alike — goes through @tbiliseli_tour_bot (the "eka" bot, EKA_BOT_TOKEN);
// contributor messages fall back to e-mail (via the tbilisi-events mailer) when
// the user has no Telegram. All sends are fire-and-forget; nothing here throws
// into a request path.
//
// TG messages are sent as PLAIN text (no HTML parse): the `tg` strings carry no
// intentional markup, and interpolated organizer/editor text (title, reason)
// would otherwise make Telegram reject a send with `&`/`<`/unbalanced tags —
// which routeNotify would misread as the user having blocked the bot.
// Admin-facing notifications are triggered inline in the routes; the 5 message
// keys here cover the 4 contributor-facing triggers (publish / reject / update /
// organizer decision).

var axios = require('axios');

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// key -> lang -> function(vars) -> { tg, subject, bodyHtml }
var COPY = {
  published: {
    en: function(v) { return { tg: 'Your event “' + v.title + '” is now published: ' + v.link, subject: 'Your event is published', bodyHtml: '<p>Your event “' + esc(v.title) + '” is now on events.tbiliseli.com.</p><p><a href="' + esc(v.link) + '">Open it</a></p>' }; },
    ru: function(v) { return { tg: 'Ваше событие «' + v.title + '» опубликовано: ' + v.link, subject: 'Событие опубликовано', bodyHtml: '<p>Ваше событие «' + esc(v.title) + '» теперь на events.tbiliseli.com.</p><p><a href="' + esc(v.link) + '">Открыть</a></p>' }; },
    ka: function(v) { return { tg: 'თქვენი განცხადება გამოქვეყნდა: ' + v.link, subject: 'გამოქვეყნდა', bodyHtml: '<p>“' + esc(v.title) + '” — events.tbiliseli.com.</p><p><a href="' + esc(v.link) + '">გახსნა</a></p>' }; },
  },
  rejected: {
    en: function(v) { return { tg: 'Your event “' + v.title + '” was not accepted.' + (v.reason ? ' Reason: ' + v.reason : ''), subject: 'Your event was declined', bodyHtml: '<p>Your event “' + esc(v.title) + '” was not accepted by the editors.</p>' + (v.reason ? '<p>Reason: ' + esc(v.reason) + '</p>' : '') }; },
    ru: function(v) { return { tg: 'Событие «' + v.title + '» отклонено.' + (v.reason ? ' Причина: ' + v.reason : ''), subject: 'Событие отклонено', bodyHtml: '<p>Событие «' + esc(v.title) + '» не принято редакцией.</p>' + (v.reason ? '<p>Причина: ' + esc(v.reason) + '</p>' : '') }; },
    ka: function(v) { return { tg: '“' + v.title + '” — არ დადასტურდა.' + (v.reason ? ' ' + v.reason : ''), subject: 'დახდა', bodyHtml: '<p>“' + esc(v.title) + '” — არ დადასტურდა.</p>' + (v.reason ? '<p>' + esc(v.reason) + '</p>' : '') }; },
  },
  updated: {
    en: function(v) { return { tg: 'The editors updated your event “' + v.title + '”: ' + v.link, subject: 'Your event was updated', bodyHtml: '<p>The editors updated your event “' + esc(v.title) + '”.</p><p><a href="' + esc(v.link) + '">See it</a></p>' }; },
    ru: function(v) { return { tg: 'Редакция обновила ваше событие «' + v.title + '»: ' + v.link, subject: 'Событие обновлено', bodyHtml: '<p>Редакция обновила ваше событие «' + esc(v.title) + '».</p><p><a href="' + esc(v.link) + '">Посмотреть</a></p>' }; },
    ka: function(v) { return { tg: 'რედაქციამ გააახლა: ' + v.link, subject: 'განახლდა', bodyHtml: '<p><a href="' + esc(v.link) + '">' + esc(v.title) + '</a></p>' }; },
  },
  organizer_approved: {
    en: function(v) { return { tg: 'You are now confirmed as the organizer of “' + v.title + '”.', subject: 'Organizer confirmed', bodyHtml: '<p>You are now confirmed as the organizer of “' + esc(v.title) + '” on events.tbiliseli.com.</p>' }; },
    ru: function(v) { return { tg: 'Вы подтверждены как организатор «' + v.title + '».', subject: 'Организатор подтверждён', bodyHtml: '<p>Вы подтверждены как организатор «' + esc(v.title) + '».</p>' }; },
    ka: function(v) { return { tg: 'დადასტურდა: “' + v.title + '”.', subject: 'დადასტურდა', bodyHtml: '<p>“' + esc(v.title) + '”</p>' }; },
  },
  organizer_rejected: {
    en: function(v) { return { tg: 'Your organizer request for “' + v.title + '” was declined.', subject: 'Organizer request declined', bodyHtml: '<p>Your organizer request for “' + esc(v.title) + '” was declined.</p>' }; },
    ru: function(v) { return { tg: 'Заявка на «' + v.title + '» отклонена.', subject: 'Заявка отклонена', bodyHtml: '<p>Заявка на «' + esc(v.title) + '» отклонена.</p>' }; },
    ka: function(v) { return { tg: '”' + v.title + '” — დახდა.', subject: 'დახდა', bodyHtml: '<p>”' + esc(v.title) + '”</p>' }; },
  },
  favVenueEvent: {
    en: function(v) { return { tg: 'New at ' + v.venueName + ': “' + v.eventTitle + '” on ' + v.date + '. ' + v.link, subject: 'New event at ' + v.venueName, bodyHtml: '<p>New at <b>' + esc(v.venueName) + '</b>: “' + esc(v.eventTitle) + '” on ' + esc(v.date) + '.</p><p><a href=”' + esc(v.link) + '”>Open it</a></p>' }; },
    ru: function(v) { return { tg: 'Новое в «' + v.venueName + '»: «' + v.eventTitle + '» ' + v.date + '. ' + v.link, subject: 'Новое событие в «' + v.venueName + '»', bodyHtml: '<p>Новое в «' + esc(v.venueName) + '»: «' + esc(v.eventTitle) + '» ' + esc(v.date) + '.</p><p><a href=”' + esc(v.link) + '”>Открыть</a></p>' }; },
    ka: function(v) { return { tg: 'ახალი ' + v.venueName + '-ში: “' + v.eventTitle + '” — ' + v.date + '. ' + v.link, subject: 'ახალი ღონისძიება — ' + v.venueName, bodyHtml: '<p>”' + esc(v.eventTitle) + '” — ' + esc(v.venueName) + ', ' + esc(v.date) + '.</p><p><a href=”' + esc(v.link) + '”>' + esc(v.link) + '</a></p>' }; },
  },
};

function notifCopy(key, lang, vars) {
  var byLang = COPY[key];
  if (!byLang) return null;
  var fn = byLang[lang] || byLang.en;
  var c = fn(vars || {});
  var mailer = require('./tbilisi-events-mailer');
  var email = mailer.buildNotificationEmail(c.subject, c.bodyHtml, (byLang[lang] ? lang : 'en'));
  return { tg: c.tg, email: email };
}

// True only for Telegram failures that won't fix themselves — the user blocked
// the bot or the account is gone. A 429/5xx/timeout is transient: fall back to
// e-mail this once, but don't brand the user as blocked.
function isPermanentTgFailure(e) {
  if (!e) return false;
  var r = e.response || {};
  var code = r.status || (r.data && r.data.error_code);
  if (code === 403) return true;
  var msg = String((r.data && r.data.description) || e.message || '');
  return /\b403\b/.test(msg) || /blocked by the user|user is deactivated|bot was kicked/i.test(msg);
}

// Testable core. deps = { sendTg(id,text), sendEmail(email,msg), setBlocked(uid,bool) }.
async function routeNotify(user, msgs, deps) {
  if (!user) return;
  if (user.tgUserId) {
    try { await deps.sendTg(String(user.tgUserId), msgs.tg); return; }
    catch (e) {
      if (isPermanentTgFailure(e)) { try { await deps.setBlocked(user.id, true); } catch (e2) {} }
      else { console.error('[te-notify] tg transient, will retry next time:', e && e.message); }
    }
  }
  if (user.email) {
    try { await deps.sendEmail(user.email, msgs.email); } catch (e) { console.error('[te-notify] email', e && e.message); }
  }
}

function realDeps() {
  var ekaBot = require('./eka-bot');
  var mailer = require('./tbilisi-events-mailer');
  var teUsers = require('./tbilisi-events-users');
  return {
    sendTg: function(id, text) { return ekaBot.sendMessage(id, text, { parse_mode: '' }); },
    sendEmail: function(email, msg) { return mailer.sendUserNotification(email, msg); },
    setBlocked: function(uid, b) { return teUsers.setTgBlocked(uid, b); },
  };
}

// Fire-and-forget. key = a COPY key; vars fill the template; uid identifies the user.
function notifyUser(uid, key, vars) {
  var teUsers = require('./tbilisi-events-users');
  teUsers.getUserById(uid).then(function(user) {
    if (!user) return;
    var msgs = notifCopy(key, user.lang || 'en', vars);
    if (!msgs) return;
    return routeNotify(user, msgs, realDeps());
  }).catch(function(e) { console.error('[te-notify] notifyUser', e && e.message); });
}

// Base recipients of admin-facing notifications: comma-separated Telegram chat
// ids in TBILISI_EVENTS_ADMIN_CHAT_ID, or the project owner when it is unset.
// Each admin doc's own `tgId` is added on top (see notifyAdmins).
function envAdminChatIds() {
  return String(process.env.TBILISI_EVENTS_ADMIN_CHAT_ID || '144489840')
    .split(',').map(function(s) { return s.trim(); }).filter(Boolean);
}

// Confirm @tbiliseli_tour_bot can message this chat id by actually sending to it.
// Returns { ok: true } or { ok: false, error: <telegram description> }.
async function verifyTelegramReachable(chatId) {
  var token = process.env.EKA_BOT_TOKEN;
  if (!token) return { ok: false, error: 'EKA_BOT_TOKEN не задан на сервере' };
  try {
    var r = await axios.post('https://api.telegram.org/bot' + token + '/sendMessage', {
      chat_id: String(chatId),
      text: '✅ Telegram-уведомления Tbilisi Events подключены для этого аккаунта.',
      disable_notification: true,
    }, { timeout: 10000 });
    if (r.data && r.data.ok) return { ok: true };
    return { ok: false, error: (r.data && r.data.description) || 'Telegram отклонил отправку' };
  } catch (e) {
    var d = e.response && e.response.data;
    return { ok: false, error: (d && d.description) || e.message };
  }
}

// Admin-facing, always Russian, HTML — delivered through @tbiliseli_tour_bot
// (EKA_BOT_TOKEN), the same bot that carries every contributor notification.
// Sends to the env chat ids plus every admin doc that has a `tgId`.
// Fire-and-forget; never throws into a request path.
function notifyAdmins(html) {
  var sendMessage2 = require('../routes/methods').sendMessage2;
  var token = process.env.EKA_BOT_TOKEN;
  if (!token) { console.error('[te-notify] notifyAdmins: EKA_BOT_TOKEN unset'); return; }
  Promise.resolve()
    .then(function() { return require('./tbilisi-events-data').getAdmins().catch(function() { return []; }); })
    .then(function(admins) {
      var ids = {};
      envAdminChatIds().forEach(function(id) { ids[id] = true; });
      (admins || []).forEach(function(a) { if (a && a.tgId) ids[String(a.tgId)] = true; });
      Object.keys(ids).forEach(function(id) {
        Promise.resolve()
          .then(function() { return sendMessage2({ chat_id: id, text: html, parse_mode: 'HTML' }, false, token); })
          .catch(function(e) { console.error('[te-notify] notifyAdmins', e && e.message); });
      });
    });
}

module.exports = {
  notifCopy: notifCopy, routeNotify: routeNotify, notifyUser: notifyUser,
  notifyAdmins: notifyAdmins, verifyTelegramReachable: verifyTelegramReachable,
};
