'use strict';
// Bot commands for the console "Бот" page (menu logic ported from libo-guides-bot
// src/bot-control.js, plus custom commands with a text reply).
//
// Stored as { items: [{ command, description, inMenu, order, reply?, builtin? }] }.
// Built-in commands are handled in routes/dimazvali.js (/start, /tours): they can be put in
// the menu and described, but have no editable reply and cannot be deleted.
// Custom commands answer with `reply` (Telegram HTML; falls back to plain text if Telegram
// rejects the markup — see replyToCommand).

var BUILTIN = [
  { command: 'start', description: 'Начать', builtin: true },
  { command: 'tours', description: 'Экскурсии', builtin: true },
];

var NAME_RE = /^[a-z0-9_]{1,32}$/;
// Commands the hook already uses for something else — not available as custom ones
var RESERVED = ['start', 'tours'];

// Stored doc (or nothing) → full list: built-ins first-class, stored order kept
function normalize(stored) {
  var items = (stored && Array.isArray(stored.items)) ? stored.items : [];
  var byName = {};
  items.forEach(function(i) { if (i && i.command) byName[i.command] = i; });
  var out = BUILTIN.map(function(b, i) {
    var s = byName[b.command] || {};
    return {
      command: b.command,
      description: s.description || b.description,
      inMenu: s.inMenu != null ? !!s.inMenu : true,
      order: Number.isFinite(s.order) ? s.order : i + 1,
      builtin: true,
    };
  });
  items.forEach(function(i) {
    if (!i || !i.command || RESERVED.indexOf(i.command) > -1) return;
    out.push({
      command: i.command,
      description: i.description || '',
      inMenu: !!i.inMenu,
      order: Number.isFinite(i.order) ? i.order : 100,
      reply: i.reply || '',
    });
  });
  return sortItems(out);
}

function sortItems(items) {
  return items
    .map(function(x, i) { return { x: x, i: i }; })
    .sort(function(a, b) { return (a.x.order - b.x.order) || (a.i - b.i); })
    .map(function(w) { return w.x; });
}

// What setMyCommands gets
function menuOf(items) {
  return sortItems(items.filter(function(i) { return i.inMenu; }))
    .map(function(i) { return { command: i.command, description: i.description }; });
}

// Console form → { items } | { error }.
// Fields per row n: cmd_n, desc_n, order_n, on_n (='1'), reply_n, del_n (='1').
// Existing rows carry their command in cmd_n; the "new" row uses cmd_new etc.
function parseForm(body) {
  body = body || {};
  var rows = [];
  var keys = Object.keys(body).filter(function(k) { return /^cmd_/.test(k); });
  keys.forEach(function(k) {
    var n = k.slice(4);
    var command = String(body[k] || '').trim().replace(/^\//, '').toLowerCase();
    if (!command) return;
    if (body['del_' + n] === '1') return;
    rows.push({
      n: n,
      command: command,
      description: String(body['desc_' + n] || '').trim(),
      order: Number.parseFloat(body['order_' + n]),
      inMenu: body['on_' + n] === '1',
      reply: String(body['reply_' + n] || '').replace(/\r\n/g, '\n').trim(),
    });
  });

  var seen = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!NAME_RE.test(r.command)) return { error: '/' + r.command + ': команда — латиница в нижнем регистре, цифры и _, до 32 знаков' };
    if (seen[r.command]) return { error: '/' + r.command + ' встречается дважды' };
    seen[r.command] = true;
    var builtin = RESERVED.indexOf(r.command) > -1;
    if (r.inMenu && !r.description) return { error: 'У /' + r.command + ' нет описания — Телеграм не примет меню' };
    if (r.description.length > 256) return { error: 'Описание /' + r.command + ' длиннее 256 знаков' };
    if (!builtin && !r.reply) return { error: 'У /' + r.command + ' нет ответа' };
    if (r.reply.length > 4096) return { error: 'Ответ /' + r.command + ' длиннее 4096 знаков' };
  }
  // Built-ins can't be deleted: if a row vanished, keep it as stored defaults
  var items = rows.map(function(r, i) {
    var o = {
      command: r.command,
      description: r.description,
      inMenu: r.inMenu,
      order: Number.isFinite(r.order) ? r.order : 100 + i,
    };
    if (RESERVED.indexOf(r.command) === -1) o.reply = r.reply;
    return o;
  });
  return { items: normalize({ items: items }) };
}

// "/cmd", "/cmd args", "/cmd@botname" → custom item, or null
function match(items, text, botUsername) {
  var m = String(text || '').trim().match(/^\/([a-zA-Z0-9_]+)(?:@(\w+))?(?:\s|$)/);
  if (!m) return null;
  if (m[2] && botUsername && m[2].toLowerCase() !== String(botUsername).toLowerCase()) return null;
  var name = m[1].toLowerCase();
  for (var i = 0; i < items.length; i++) {
    if (items[i].command === name && !items[i].builtin && items[i].reply) return items[i];
  }
  return null;
}

// Send a custom command's reply. HTML first; if Telegram rejects the markup (400 "can't parse"),
// send the same text without parse_mode so the user still gets an answer.
async function replyToCommand(tg, chatId, item) {
  var payload = { chat_id: chatId, text: item.reply, parse_mode: 'HTML', link_preview_options: { is_disabled: true } };
  try {
    return await tg.call('sendMessage', payload, { meta: { by: 'bot' } });
  } catch (err) {
    if (err.code === 400 && /parse/i.test(err.description || '')) {
      delete payload.parse_mode;
      return tg.call('sendMessage', payload, { meta: { by: 'bot' } });
    }
    throw err;
  }
}

module.exports = {
  BUILTIN: BUILTIN, normalize: normalize, menuOf: menuOf, parseForm: parseForm,
  match: match, replyToCommand: replyToCommand,
};
