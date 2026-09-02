'use strict';
// Message delivery for tbilisi-events contributors. Telegram-first (via the eka
// bot), e-mail fallback (via the tbilisi-events mailer). All sends are
// fire-and-forget; nothing here throws into a request path.

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    ka: function(v) { return { tg: '“' + v.title + '” — დახდა.', subject: 'დახდა', bodyHtml: '<p>“' + esc(v.title) + '”</p>' }; },
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

// Testable core. deps = { sendTg(id,text), sendEmail(email,msg), setBlocked(uid,bool) }.
async function routeNotify(user, msgs, deps) {
  if (!user) return;
  if (user.tgUserId) {
    try { await deps.sendTg(String(user.tgUserId), msgs.tg); return; }
    catch (e) {
      try { await deps.setBlocked(user.id, true); } catch (e2) {}
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
    sendTg: function(id, text) { return ekaBot.sendMessage(id, text); },
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

// Admin-facing, always Russian, via the personal alert bot.
function notifyAdmins(html) {
  var alertMe = require('../routes/common').alertMe;
  Promise.resolve().then(function() { return alertMe({ text: html, parse_mode: 'HTML' }); })
    .catch(function(e) { console.error('[te-notify] notifyAdmins', e && e.message); });
}

module.exports = { notifCopy: notifCopy, routeNotify: routeNotify, notifyUser: notifyUser, notifyAdmins: notifyAdmins };
