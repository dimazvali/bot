'use strict';
// Conversation history for the bot console (ported from libo-guides-bot src/chat.js).
//
// Storage is the bot's existing DIMAZVALImessage collection, so old history shows up too.
// Old docs: { createdAt, user, text, isReply, photo, messageId } (routes/methods.js sendMessage2).
// New docs add: dir (in|out), by (user|bot|admin), kind, fileId, fileName, mime, duration,
//   adminId, adminName, broadcast. isReply is kept in sync (= dir === 'out') for the old /web panel.
// New entries are also emitted to open console tabs (Server-Sent Events).

var EventEmitter = require('node:events').EventEmitter;

// Bot API methods that put something into a chat
var SEND_METHODS = new Set([
  'sendMessage', 'sendPhoto', 'sendAudio', 'sendVoice', 'sendVideo', 'sendDocument',
  'sendAnimation', 'sendSticker', 'sendMediaGroup', 'copyMessage', 'sendLocation', 'sendVenue',
]);

// A Telegram message → flat record for the history
function describe(msg) {
  var text = msg.text || msg.caption || '';
  if (msg.photo && msg.photo.length) {
    var sizes = msg.photo.slice().sort(function(a, b) { return a.width - b.width; });
    var fit = sizes.filter(function(s) { return s.width <= 1280; });
    var pick = fit.length ? fit[fit.length - 1] : sizes[0];
    return { kind: 'photo', text: text, fileId: pick.file_id, mime: 'image/jpeg' };
  }
  function file(kind, f, mime) {
    var r = { kind: kind, text: text, fileId: f.file_id, fileName: f.file_name || null, mime: f.mime_type || mime || null };
    if (f.duration) r.duration = f.duration;
    return r;
  }
  if (msg.voice) return file('voice', msg.voice, 'audio/ogg');
  if (msg.audio) return file('audio', msg.audio, 'audio/mpeg');
  if (msg.video) return file('video', msg.video, 'video/mp4');
  if (msg.video_note) return file('video_note', msg.video_note, 'video/mp4');
  if (msg.animation) return file('animation', msg.animation, 'video/mp4');
  if (msg.sticker) {
    var still = !msg.sticker.is_animated && !msg.sticker.is_video;
    return { kind: 'sticker', text: msg.sticker.emoji || '', fileId: still ? msg.sticker.file_id : null, mime: 'image/webp' };
  }
  if (msg.document) return file('document', msg.document);
  if (msg.venue) return { kind: 'location', text: [msg.venue.title, msg.venue.address].filter(Boolean).join(', ') };
  if (msg.location) return { kind: 'location', text: msg.location.latitude + ', ' + msg.location.longitude };
  if (msg.contact) return { kind: 'contact', text: [msg.contact.first_name, msg.contact.last_name, msg.contact.phone_number].filter(Boolean).join(' ') };
  return { kind: 'text', text: text };
}

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v._seconds != null) return new Date(v._seconds * 1000);
  return new Date(v);
}

// Firestore doc (old or new shape) → what the console renders
function normalize(id, d) {
  var dir = d.dir || (d.isReply ? 'out' : 'in');
  var at = toDate(d.createdAt);
  var kind = d.kind || (d.photo ? 'photo' : 'text');
  return {
    id: id,
    at: at ? at.toISOString() : null,
    dir: dir,
    by: d.by || (dir === 'in' ? 'user' : 'bot'),
    kind: kind,
    text: d.text || '',
    fileId: d.fileId || null,
    fileName: d.fileName || null,
    photoUrl: typeof d.photo === 'string' && /^https?:\/\//.test(d.photo) ? d.photo : null,
    adminName: d.adminName || null,
    broadcast: d.broadcast || null,
  };
}

class Chats {
  // col — the DIMAZVALImessage collection (anything with add/where/orderBy/limit/get)
  constructor(opts) {
    this.col = opts.col;
    this.events = new EventEmitter();
    this.events.setMaxListeners(100);
    this.pending = {};
  }

  // Incoming private message from a user
  recordIn(msg) {
    if (!msg || !msg.chat || (msg.chat.type && msg.chat.type !== 'private')) return null;
    return this.add(msg.chat.id, Object.assign({ dir: 'in', by: 'user', messageId: msg.message_id || null }, describe(msg)));
  }

  // Outgoing: called by the tg client after a successful send. meta.by — who really sent it
  recordOut(method, payload, result, meta) {
    meta = meta || {};
    if (!SEND_METHODS.has(method) || meta.noHistory) return;
    var list = Array.isArray(result) ? result : [result];
    var self = this;
    list.forEach(function(m) {
      var chatId = (m && m.chat && m.chat.id) || (payload && payload.chat_id);
      if (!(Number(chatId) > 0)) return; // people only; groups have negative ids
      var body = m && m.chat ? describe(m) : {};
      var entry = Object.assign({ dir: 'out', by: meta.by || 'bot', messageId: (m && m.message_id) || null }, body);
      if (meta.adminId) { entry.adminId = Number(meta.adminId); entry.adminName = meta.adminName || null; }
      if (meta.broadcast) entry.broadcast = meta.broadcast;
      self.add(chatId, entry);
    });
  }

  add(userId, entry) {
    var doc = Object.assign({ createdAt: new Date(), user: Number(userId), isReply: entry.dir === 'out' }, entry);
    Object.keys(doc).forEach(function(k) { if (doc[k] === undefined) delete doc[k]; });
    var self = this;
    var p = Promise.resolve()
      .then(function() { return self.col.add(doc); })
      .then(function(ref) {
        var item = normalize(ref && ref.id, doc);
        self.events.emit('chat:' + doc.user, item);
        return item;
      })
      .catch(function(err) { console.warn('[bot-console] chat history not saved:', err.message); return null; });
    // Remember the last write per user so a page reload after sending can wait for it
    var key = doc.user;
    var pending = this.pending;
    pending[key] = p;
    p.then(function() { if (pending[key] === p) delete pending[key]; });
    return p;
  }

  // Resolves once the latest history write for this user is done
  flush(userId) {
    return this.pending[Number(userId)] || Promise.resolve();
  }

  // Newest first from Firestore; returned oldest → newest for rendering.
  // before — ISO time: page back through older messages
  async history(userId, opts) {
    opts = opts || {};
    var limit = opts.limit || 100;
    var q = this.col.where('user', '==', Number(userId));
    if (opts.before) q = q.where('createdAt', '<', new Date(opts.before));
    var snap = await q.orderBy('createdAt', 'desc').limit(limit).get();
    var items = snap.docs.map(function(d) { return normalize(d.id, d.data()); });
    return { items: items.reverse(), more: snap.docs.length === limit };
  }

  subscribe(userId, fn) {
    var name = 'chat:' + Number(userId);
    this.events.on(name, fn);
    var events = this.events;
    return function() { events.off(name, fn); };
  }
}

class ChatError extends Error {
  constructor(message, opts) {
    super(message);
    this.blocked = !!(opts && opts.blocked);
  }
}

// Which method to upload a file with: photos as photos (≤10 MB), mp3/m4a as audio,
// ogg as voice, mp4 as video, everything else as a document
function uploadMethod(file) {
  var name = String(file.name || '').toLowerCase();
  var ext = name.split('.').pop();
  var type = file.type || '';
  var size = (file.buf && file.buf.length) || 0;
  if (/^image\/(jpeg|png)$/.test(type) || ['jpg', 'jpeg', 'png'].indexOf(ext) > -1) {
    return size <= 10e6 ? { method: 'sendPhoto', field: 'photo' } : { method: 'sendDocument', field: 'document' };
  }
  if (type === 'audio/mpeg' || type === 'audio/mp4' || ext === 'mp3' || ext === 'm4a') return { method: 'sendAudio', field: 'audio' };
  if (type === 'audio/ogg' || ext === 'ogg' || ext === 'oga') return { method: 'sendVoice', field: 'voice' };
  if (type === 'video/mp4' || ext === 'mp4') return { method: 'sendVideo', field: 'video' };
  return { method: 'sendDocument', field: 'document' };
}

// Message to a user from the console: text, a file, or a file with a caption.
// Plain text (no parse_mode) so "<" and "&" typed by the admin never break the send.
async function sendToUser(tg, userId, input, admin) {
  var text = String((input && input.text) || '').replace(/\r\n/g, '\n').trim();
  var file = (input && input.file) || null;
  if (!text && !file) throw new ChatError('Пустое сообщение');
  if (text.length > 4096 && !file) throw new ChatError('Текст длиннее 4096 знаков — разбейте на несколько сообщений');
  var meta = { by: 'admin', adminId: admin.id, adminName: admin.name || null };
  try {
    if (!file) return await tg.call('sendMessage', { chat_id: userId, text: text, link_preview_options: { is_disabled: true } }, { meta: meta });
    var how = uploadMethod(file);
    var caption = text.length <= 1024 ? text : '';
    var result = await tg.sendUpload(how.method, userId, how.field, file, caption ? { caption: caption } : {}, meta);
    if (text && !caption) await tg.call('sendMessage', { chat_id: userId, text: text }, { meta: meta });
    return result;
  } catch (err) {
    if (err.code === 403) throw new ChatError('Не доставлено: человек заблокировал бота', { blocked: true });
    if (err.code === 400) throw new ChatError('Телеграм не принял: ' + (err.description || err.message));
    throw err;
  }
}

module.exports = {
  Chats: Chats, ChatError: ChatError, sendToUser: sendToUser,
  describe: describe, normalize: normalize, uploadMethod: uploadMethod, SEND_METHODS: SEND_METHODS,
};
