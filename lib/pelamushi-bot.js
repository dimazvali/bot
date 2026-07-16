'use strict';
const axios = require('axios');

let _db = null;
let _token = null;
let _bucket = null;

function init(db, token, bucket) {
  _db = db;
  _token = token;
  _bucket = bucket || null;
}

function api(method, params) {
  if (!_token) return Promise.reject(new Error('pelamushi-bot: not initialized'));
  return axios.post(`https://api.telegram.org/bot${_token}/${method}`, params || {})
    .then((r) => r.data);
}

// Create or update user record; sets active:true. Returns user + isNew flag.
async function registerUser(tgUser) {
  if (!_db || !tgUser || !tgUser.id) return null;
  const ref = _db.collection('pelamushi_bot_users').doc(String(tgUser.id));
  const snap = await ref.get();
  const isNew = !snap.exists;
  const now = new Date();
  const data = {
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
    fetchAvatar(tgUser.id).then((url) => {
      if (url) ref.update({ avatarUrl: url }).catch(() => {});
    }).catch(() => {});
  } else {
    await ref.update(data);
  }
  return Object.assign({ id: String(tgUser.id) }, snap.exists ? snap.data() : {}, data, { isNew });
}

async function fetchAvatar(userId) {
  if (!_token || !_bucket) return null;
  try {
    const photos = await api('getUserProfilePhotos', { user_id: userId, limit: 1 });
    if (!photos.ok || !photos.result.total_count) return null;
    const sizes = photos.result.photos[0];
    const largest = sizes[sizes.length - 1];
    const fileInfo = await api('getFile', { file_id: largest.file_id });
    if (!fileInfo.ok || !fileInfo.result.file_path) return null;
    const fileUrl = `https://api.telegram.org/file/bot${_token}/${fileInfo.result.file_path}`;
    const resp = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const dest = _bucket.file(`pelamushi/bot-avatars/${userId}.jpg`);
    await dest.save(Buffer.from(resp.data), { contentType: 'image/jpeg', public: true });
    return dest.publicUrl();
  } catch (e) {
    console.error('[pelamushi-bot] fetchAvatar:', e.message);
    return null;
  }
}

async function getBotMessages() {
  if (!_db) return {};
  const snap = await _db.collection('pelamushi_settings').doc('bot_messages').get();
  return snap.exists ? snap.data() : {};
}

async function saveBotMessages(data) {
  if (!_db) return;
  await _db.collection('pelamushi_settings').doc('bot_messages').set(data, { merge: true });
}

function markInactive(chatId) {
  if (!_db) return Promise.resolve();
  return _db.collection('pelamushi_bot_users').doc(String(chatId)).set(
    { active: false, updatedAt: new Date() }, { merge: true }
  );
}

function markActive(chatId) {
  if (!_db) return Promise.resolve();
  return _db.collection('pelamushi_bot_users').doc(String(chatId)).set(
    { active: true, updatedAt: new Date() }, { merge: true }
  );
}

function sendMessage(chatId, text, opts) {
  return api('sendMessage', Object.assign(
    { chat_id: String(chatId), text, parse_mode: 'HTML' },
    opts || {}
  ));
}

function sendMedia(chatId, type, media, caption, opts) {
  const method = 'send' + type.charAt(0).toUpperCase() + type.slice(1);
  const params = Object.assign({ chat_id: String(chatId), parse_mode: 'HTML' }, opts || {});
  params[type] = media;
  if (caption) params.caption = caption;
  return api(method, params);
}

function forwardMessage(toChatId, fromChatId, messageId) {
  return api('forwardMessage', { chat_id: toChatId, from_chat_id: fromChatId, message_id: messageId });
}

async function getUsers(filters) {
  if (!_db) return [];
  let query = _db.collection('pelamushi_bot_users');
  if (filters) {
    if (typeof filters.active === 'boolean') query = query.where('active', '==', filters.active);
    if (filters.lang) query = query.where('lang', '==', filters.lang);
  }
  const snap = await query.get();
  return snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
}

// Process incoming Telegram update.
// onNewMessage(fromId, fromLabel, text, rawMsg) — regular user messages.
// onCommand(command, msg) — /command messages (except /start).
// onNewUser(user, msg) — first-ever contact from this Telegram user.
async function handleUpdate(update, onNewMessage, onCommand, onNewUser) {
  try {
    const msg = update.message;
    if (msg && msg.from && !msg.from.is_bot) {
      const user = await registerUser(msg.from);
      if (user.isNew && typeof onNewUser === 'function') {
        onNewUser(user, msg);
      }

      const isStart = msg.text && /^\/start(@\S+)?(\s|$)/i.test(msg.text);
      if (isStart) {
        // Deep-link payload: /start reg_{registrationId}
        const payload = msg.text.replace(/^\/start(@\S+)?\s*/i, '').trim();
        if (payload.startsWith('reg_')) {
          const registrationId = payload.slice(4);
          const regRef = _db.collection('pelamushi_registrations').doc(registrationId);
          const regSnap = await regRef.get();
          if (!regSnap.exists) {
            await sendMessage(msg.chat.id, 'Извините, регистрация не найдена.').catch(() => {});
          } else {
            const regData = regSnap.data();
            if (regData.tg_user_id) {
              await sendMessage(msg.chat.id, 'Извините, эта регистрация уже связана с другим аккаунтом.').catch(() => {});
            } else {
              await regRef.update({ tg_user_id: String(msg.from.id) });
              await sendMessage(msg.chat.id, 'Спасибо! 🎉\n\nЯ привязан к вашей регистрации. Здесь вы будете получать уведомления по вашему событию.').catch(() => {});
            }
          }
        } else {
          const msgs = await getBotMessages();
          const isRu = (msg.from.language_code || '').toLowerCase().startsWith('ru');
          const prefix = user.isNew ? (isRu ? 'welcome_ru' : 'welcome_en') : (isRu ? 'return_ru' : 'return_en');
          const text = msgs[prefix] || '';
          const photoUrl = msgs[prefix + '_photo'] || '';
          if (photoUrl && text) {
            await sendMedia(msg.chat.id, 'photo', photoUrl, text).catch((e) => console.error('[pelamushi-bot] welcome photo send failed:', e.message));
          } else if (photoUrl) {
            await sendMedia(msg.chat.id, 'photo', photoUrl, '').catch((e) => console.error('[pelamushi-bot] welcome photo send failed:', e.message));
          } else if (text) {
            await sendMessage(msg.chat.id, text).catch((e) => console.error('[pelamushi-bot] welcome send failed:', e.message));
          }
        }
      } else if (msg.text && msg.text.startsWith('/') && typeof onCommand === 'function') {
        const cmd = msg.text.split(/\s+/)[0].replace(/@\S+/g, '').toLowerCase().slice(1);
        await onCommand(cmd, msg);
      } else if (typeof onNewMessage === 'function') {
        const from = msg.from;
        const name = [from.first_name, from.last_name].filter(Boolean).join(' ');
        const tag = from.username ? ` (@${from.username})` : ` [id:${from.id}]`;
        const msgText = msg.text || (msg.photo ? '[фото]' : msg.video ? '[видео]' : msg.audio ? '[аудио]' : msg.voice ? '[голосовое]' : '[медиа]');
        await onNewMessage(from.id, name + tag, msgText, msg);
      }
    }

    const chatMember = update.my_chat_member;
    if (chatMember) {
      const status = chatMember.new_chat_member && chatMember.new_chat_member.status;
      if (status === 'kicked' || status === 'left') {
        await markInactive(chatMember.chat.id);
      } else if (status === 'member') {
        await markActive(chatMember.chat.id);
      }
    }
  } catch (e) {
    console.error('[pelamushi-bot] handleUpdate:', e.message);
  }
}

function setWebhook(url) {
  return api('setWebhook', { url, allowed_updates: ['message', 'my_chat_member'] });
}

// Fields Telegram's Bot API actually lets a bot edit about itself.
// Note: there is NO Bot API method to change the bot's own avatar/profile
// photo — that can only be done manually via @BotFather.
//
// name/description/short_description can be localized per Telegram client
// language (setMyName/setMyDescription/setMyShortDescription all accept an
// optional language_code) — pelamushi supports ru/ka/en, so we manage all
// three plus a language-less default (mirrored from the EN text, since EN
// is this site's own fallback language for unmatched Accept-Language).
const PROFILE_LANGS = ['ru', 'ka', 'en'];

async function getBotProfile() {
  const [names, descs, shortDescs, cmds] = await Promise.all([
    Promise.all(PROFILE_LANGS.map((lc) => api('getMyName', { language_code: lc }))),
    Promise.all(PROFILE_LANGS.map((lc) => api('getMyDescription', { language_code: lc }))),
    Promise.all(PROFILE_LANGS.map((lc) => api('getMyShortDescription', { language_code: lc }))),
    api('getMyCommands', {}),
  ]);
  const byLang = (results, field) => {
    const out = {};
    PROFILE_LANGS.forEach((lc, i) => { out[lc] = (results[i].result && results[i].result[field]) || ''; });
    return out;
  };
  return {
    name: byLang(names, 'name'),
    description: byLang(descs, 'description'),
    short_description: byLang(shortDescs, 'short_description'),
    commands: cmds.result || [],
  };
}

async function setBotProfile(data) {
  const calls = [];
  PROFILE_LANGS.forEach((lc) => {
    if (data.name && data.name[lc] !== undefined) calls.push(api('setMyName', { name: data.name[lc], language_code: lc }));
    if (data.description && data.description[lc] !== undefined) calls.push(api('setMyDescription', { description: data.description[lc], language_code: lc }));
    if (data.short_description && data.short_description[lc] !== undefined) calls.push(api('setMyShortDescription', { short_description: data.short_description[lc], language_code: lc }));
  });
  // language-less fallback (shown to clients whose language isn't ru/ka/en) — mirror EN
  if (data.name && data.name.en !== undefined) calls.push(api('setMyName', { name: data.name.en }));
  if (data.description && data.description.en !== undefined) calls.push(api('setMyDescription', { description: data.description.en }));
  if (data.short_description && data.short_description.en !== undefined) calls.push(api('setMyShortDescription', { short_description: data.short_description.en }));
  if (data.commands !== undefined) calls.push(api('setMyCommands', { commands: data.commands }));
  await Promise.all(calls);
}

module.exports = {
  init, setWebhook, registerUser, markInactive, markActive,
  sendMessage, sendMedia, forwardMessage, getUsers,
  getBotMessages, saveBotMessages, getBotProfile, setBotProfile, handleUpdate,
};
