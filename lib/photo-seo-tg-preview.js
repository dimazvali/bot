'use strict';
// TEMPORARY: sends every freshly generated SEO caption to Dima in Telegram (photo preview +
// RU/EN texts + keywords), to eyeball the quality of the Sonnet captions.
// Turn off: toggle on the admin index page (/admin, setting `seoTgPreview` in lib/photo-settings.js).
// Remove for good: delete this file, its single call in lib/photo-seo.js (generatePhotoSeo),
// the toggle route + form (routes/photo-admin.js, views/photo/admin/index.pug) and the setting.
var axios = require('axios');
var photoSettings = require('./photo-settings');

var DIMA_CHAT_ID = 144489840;
var BASE = 'https://photo.dimazvali.com';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function send(photo, result, ctx) {
  var token = process.env.dimazvaliToken;
  if (!photoSettings.get('seoTgPreview') || !token) return;
  var imageUrl = photo.urls && (photo.urls.preview || photo.urls.thumb);
  var link = ctx.shootSlug ? BASE + '/admin/shoots/' + ctx.shootSlug + '/photos/' + photo.id + '/edit' : null;
  var caption = [
    '<b>📝 SEO</b> · ' + esc(ctx.label || '') + ' · ' + esc(photo.title || photo.id),
    '',
    '🇷🇺 ' + esc(result.desc),
    '🇬🇧 ' + esc(result.descEn),
    '',
    '<i>' + esc(result.keywords) + '</i>',
    link ? '\n' + link : '',
  ].join('\n').slice(0, 1024); // Telegram caption limit

  var method = imageUrl ? 'sendPhoto' : 'sendMessage';
  var body = imageUrl
    ? { chat_id: DIMA_CHAT_ID, photo: imageUrl, caption: caption, parse_mode: 'HTML' }
    : { chat_id: DIMA_CHAT_ID, text: caption, parse_mode: 'HTML', disable_web_page_preview: true };
  axios.post('https://api.telegram.org/bot' + token + '/' + method, body, { timeout: 15000 })
    .catch(function(e) { console.error('[seo-tg-preview]', e.response ? JSON.stringify(e.response.data) : e.message); });
}

module.exports = { send };
