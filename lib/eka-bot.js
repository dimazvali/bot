'use strict';
var axios = require('axios');
var ekaEvents = require('./eka-events');

var _db = null;
var _token = null;
var _bucket = null;

function init(db, token, bucket) {
  _db = db;
  _token = token;
  _bucket = bucket || null;
}

function api(method, params) {
  if (!_token) return Promise.reject(new Error('eka-bot: not initialized'));
  return axios.post('https://api.telegram.org/bot' + _token + '/' + method, params || {})
    .then(function(r) { return r.data; });
}

// Create or update user record; sets active:true. Returns user + isNew flag.
async function registerUser(tgUser) {
  if (!_db || !tgUser || !tgUser.id) return null;
  var ref = _db.collection('eka_bot_users').doc(String(tgUser.id));
  var snap = await ref.get();
  var isNew = !snap.exists;
  var now = new Date();
  var data = {
    first_name: tgUser.first_name || '',
    last_name: tgUser.last_name || '',
    username: tgUser.username || '',
    lang: tgUser.language_code || 'ru',
    active: true,
    updatedAt: now,
  };
  if (isNew) {
    data.createdAt = now;
    await ref.set(data);
    fetchAvatar(tgUser.id).then(function(url) {
      if (url) ref.update({ avatarUrl: url }).catch(function(){});
    }).catch(function(){});
  } else {
    await ref.update(data);
  }
  return Object.assign({ id: String(tgUser.id) }, snap.exists ? snap.data() : {}, data, { isNew: isNew });
}

async function fetchAvatar(userId) {
  if (!_token || !_bucket) return null;
  try {
    var photos = await api('getUserProfilePhotos', { user_id: userId, limit: 1 });
    if (!photos.ok || !photos.result.total_count) return null;
    var sizes = photos.result.photos[0];
    var largest = sizes[sizes.length - 1];
    var fileInfo = await api('getFile', { file_id: largest.file_id });
    if (!fileInfo.ok || !fileInfo.result.file_path) return null;
    var fileUrl = 'https://api.telegram.org/file/bot' + _token + '/' + fileInfo.result.file_path;
    var resp = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    var dest = _bucket.file('bot/avatars/' + userId + '.jpg');
    await dest.save(Buffer.from(resp.data), { contentType: 'image/jpeg', public: true });
    return dest.publicUrl();
  } catch(e) {
    console.error('[eka-bot] fetchAvatar:', e.message);
    return null;
  }
}

async function getBotMessages() {
  if (!_db) return {};
  var snap = await _db.collection('eka_settings').doc('bot_messages').get();
  return snap.exists ? snap.data() : {};
}

async function saveBotMessages(data) {
  if (!_db) return;
  await _db.collection('eka_settings').doc('bot_messages').set(data, { merge: true });
}

function markInactive(chatId) {
  if (!_db) return Promise.resolve();
  return _db.collection('eka_bot_users').doc(String(chatId)).set(
    { active: false, updatedAt: new Date() }, { merge: true }
  );
}

function markActive(chatId) {
  if (!_db) return Promise.resolve();
  return _db.collection('eka_bot_users').doc(String(chatId)).set(
    { active: true, updatedAt: new Date() }, { merge: true }
  );
}

// Send text message
function sendMessage(chatId, text, opts) {
  return api('sendMessage', Object.assign(
    { chat_id: String(chatId), text: text, parse_mode: 'HTML' },
    opts || {}
  ));
}

// Send media: type = 'photo' | 'video' | 'audio' | 'document' | 'animation'
// media = file_id or URL
function sendMedia(chatId, type, media, caption, opts) {
  var method = 'send' + type.charAt(0).toUpperCase() + type.slice(1);
  var params = Object.assign({ chat_id: String(chatId), parse_mode: 'HTML' }, opts || {});
  params[type] = media;
  if (caption) params.caption = caption;
  return api(method, params);
}

function sendLocation(chatId, lat, lng) {
  return api('sendLocation', { chat_id: String(chatId), latitude: lat, longitude: lng });
}

// Get users; filters: { active: boolean, lang: string }
async function getUsers(filters) {
  if (!_db) return [];
  var query = _db.collection('eka_bot_users');
  if (filters) {
    if (typeof filters.active === 'boolean') query = query.where('active', '==', filters.active);
    if (filters.lang) query = query.where('lang', '==', filters.lang);
  }
  var snap = await query.get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

// Process incoming Telegram update.
// onNewMessage(fromId, fromLabel, text, rawMsg) — called for regular user messages.
// onCommand(command, msg) — called for /command messages (except /start).
async function handleUpdate(update, onNewMessage, onCommand, onNewUser) {
  try {
    var msg = update.message;
    if (msg && msg.from && !msg.from.is_bot) {
      var user = await registerUser(msg.from);
      if (user.isNew && typeof onNewUser === 'function') {
        onNewUser(user, msg);
      }
      var inMediaType = msg.photo ? 'photo' : msg.video ? 'video' : msg.voice ? 'voice' : msg.audio ? 'audio' : msg.document ? 'document' : msg.sticker ? 'sticker' : null;
      var inText = msg.text || msg.caption || '';
      if (inText || inMediaType) {
        var senderName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
        var inMsg = { direction: 'in', text: inText || null, mediaType: inMediaType || null, sentBy: senderName, createdAt: new Date() };
        ekaEvents.emit('bot:message', { userId: String(msg.from.id), message: inMsg });
        saveMessage(msg.from.id, inMsg).catch(function(){});
      }
      var isStart = msg.text && /^\/start(@\S+)?(\s|$)/i.test(msg.text);
      if (isStart) {
        if (!user.isNew) {
          fetchAvatar(msg.from.id).then(function(url) {
            if (url) _db.collection('eka_bot_users').doc(String(msg.from.id)).update({ avatarUrl: url }).catch(function(){});
          }).catch(function(){});
        }
        // Deep-link payload: /start req_{requestId}
        var payload = msg.text.replace(/^\/start(@\S+)?\s*/i, '').trim();
        if (payload.startsWith('req_')) {
          var requestId = payload.slice(4);
          var reqRef = _db.collection('eka_requests').doc(requestId);
          var reqSnap = await reqRef.get();
          if (!reqSnap.exists) {
            await sendMessage(msg.chat.id, 'Извините, заявка не найдена.').catch(function(){});
          } else {
            var reqData = reqSnap.data();
            if (reqData.tg_user_id) {
              await sendMessage(msg.chat.id, 'Извините, это место уже занято — к этой заявке уже привязан другой аккаунт.').catch(function(){});
            } else {
              await reqRef.update({ tg_user_id: String(msg.from.id) });
              var tourName = reqData.tourTitle || '';
              var confirmText = 'Спасибо! 🎉' + (tourName ? '\n\nЯ привязан к вашей заявке на тур «' + tourName + '».' : '') + '\nЯ буду присылать вам обновления, а если появятся вопросы — просто напишите, я передам гиду.';
              await sendMessage(msg.chat.id, confirmText).catch(function(){});
            }
          }
        } else {
          var msgs = await getBotMessages();
          var isRu = (msg.from.language_code || '').toLowerCase().startsWith('ru');
          var prefix = user.isNew ? (isRu ? 'welcome_ru' : 'welcome_en') : (isRu ? 'return_ru' : 'return_en');
          var text = msgs[prefix] || '';
          var photoUrl = msgs[prefix + '_photo'] || '';
          if (photoUrl && text) {
            await sendMedia(msg.chat.id, 'photo', photoUrl, text).catch(function(e) {
              console.error('[eka-bot] welcome photo send failed:', e.message);
            });
          } else if (photoUrl) {
            await sendMedia(msg.chat.id, 'photo', photoUrl, '').catch(function(e) {
              console.error('[eka-bot] welcome photo send failed:', e.message);
            });
          } else if (text) {
            await sendMessage(msg.chat.id, text).catch(function(e) {
              console.error('[eka-bot] welcome send failed:', e.message);
            });
          }
        }
      } else if (msg.text && msg.text.startsWith('/') && typeof onCommand === 'function') {
        var cmd = msg.text.split(/\s+/)[0].replace(/@\S+/g, '').toLowerCase().slice(1);
        await onCommand(cmd, msg);
      } else if (typeof onNewMessage === 'function') {
        var from = msg.from;
        var name = [from.first_name, from.last_name].filter(Boolean).join(' ');
        var tag = from.username ? ' (@' + from.username + ')' : ' [id:' + from.id + ']';
        var msgText = msg.text || (msg.photo ? '[фото]' : msg.video ? '[видео]' : msg.audio ? '[аудио]' : '[медиа]');
        await onNewMessage(from.id, name + tag, msgText, msg);
      }
    }
    // Detect bot block / unblock
    var chatMember = update.my_chat_member;
    if (chatMember) {
      var status = chatMember.new_chat_member && chatMember.new_chat_member.status;
      if (status === 'kicked' || status === 'left') {
        await markInactive(chatMember.chat.id);
      } else if (status === 'member') {
        await markActive(chatMember.chat.id);
      }
    }
  } catch(e) {
    console.error('[eka-bot] handleUpdate:', e.message);
  }
}

function setWebhook(url) {
  return api('setWebhook', { url: url, allowed_updates: ['message', 'my_chat_member'] });
}

async function getBotProfile() {
  var [me, desc, shortDesc, cmds] = await Promise.all([
    api('getMe', {}),
    api('getMyDescription', {}),
    api('getMyShortDescription', {}),
    api('getMyCommands', {}),
  ]);
  return {
    name: me.result.first_name || '',
    username: me.result.username || '',
    description: (desc.result && desc.result.description) || '',
    short_description: (shortDesc.result && shortDesc.result.short_description) || '',
    commands: cmds.result || [],
  };
}

async function setBotProfile(data) {
  var calls = [];
  if (data.name !== undefined) calls.push(api('setMyName', { name: data.name }));
  if (data.description !== undefined) calls.push(api('setMyDescription', { description: data.description }));
  if (data.short_description !== undefined) calls.push(api('setMyShortDescription', { short_description: data.short_description }));
  if (data.commands !== undefined) calls.push(api('setMyCommands', { commands: data.commands }));
  await Promise.all(calls);
}

async function setBotPhoto(buffer, mimetype) {
  var FormData = require('form-data');
  var form = new FormData();
  form.append('photo', buffer, { filename: 'photo.jpg', contentType: mimetype || 'image/jpeg' });
  var resp = await axios.post('https://api.telegram.org/bot' + _token + '/setMyProfilePhoto', form, {
    headers: form.getHeaders(),
  });
  return resp.data;
}

function forwardMessage(toChatId, fromChatId, messageId) {
  return api('forwardMessage', { chat_id: toChatId, from_chat_id: fromChatId, message_id: messageId });
}

async function saveMessage(userId, data) {
  if (!_db || !userId) return;
  return _db.collection('eka_bot_users').doc(String(userId)).collection('messages').add(
    Object.assign({ createdAt: new Date() }, data)
  );
}

module.exports = { init, setWebhook, getBotProfile, setBotProfile, setBotPhoto, registerUser, markInactive, markActive, sendMessage, sendMedia, sendLocation, forwardMessage, saveMessage, getUsers, getBotMessages, saveBotMessages, handleUpdate };
