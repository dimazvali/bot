'use strict';
var axios = require('axios');

var ADMIN_URL = 'https://photo.dimazvali.com/admin/leads';
var HOT_LIMIT = 10;
var TG_LIMIT = 4096;

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ddmm(d) {
  var p = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Tbilisi' });
  return p.format(d);
}

// r: { hot: [lead with .classification], maybeCount, stats, failing: [source], date }
function formatDigest(r) {
  var blocks = ['📸 <b>Лиды на фото — ' + ddmm(r.date) + '</b>'];
  var hot = r.hot.slice().sort(function(a, b) { return b.classification.score - a.classification.score; });

  if (hot.length) {
    blocks.push('🔥 <b>HOT: ' + hot.length + '</b>');
    hot.slice(0, HOT_LIMIT).forEach(function(l) {
      var c = l.classification;
      var head = ['<b>' + c.score + '</b>', c.city, c.genre].filter(Boolean).map(function(x, i) { return i ? esc(x) : x; }).join(' · ');
      blocks.push(head + '\n' + esc(c.summaryRu)
        + (c.budget ? '\n💰 ' + esc(c.budget) : '')
        + '\n<a href="' + esc(l.url) + '">' + esc(l.source) + ' →</a>');
    });
    if (hot.length > HOT_LIMIT) {
      blocks.push('и ещё ' + (hot.length - HOT_LIMIT) + ' — <a href="' + ADMIN_URL + '?zone=hot">в админке</a>');
    }
  }
  if (r.maybeCount) {
    blocks.push('🤔 MAYBE: ' + r.maybeCount + ' — <a href="' + ADMIN_URL + '?zone=maybe">посмотреть</a>');
  }
  if (!hot.length && !r.maybeCount) blocks.push('Лидов нет.');

  var s = r.stats;
  blocks.push('Источников: ' + s.sources + ' · постов: ' + s.seen + ' · прошли префильтр: ' + s.matched);

  if (r.failing && r.failing.length) {
    blocks.push('⚠️ Падают источники:\n' + r.failing.map(function(f) {
      return esc(f.type + ':' + f.value) + ' — ' + f.consecutiveFailures + ' раз подряд (' + esc(f.lastError) + ')';
    }).join('\n'));
  }
  return blocks.join('\n\n');
}

function splitMessage(text, limit) {
  limit = limit || TG_LIMIT;
  var parts = [];
  var cur = '';
  text.split('\n\n').forEach(function(block) {
    while (block.length > limit) { // a single oversized block: hard-cut
      if (cur) { parts.push(cur); cur = ''; }
      parts.push(block.slice(0, limit));
      block = block.slice(limit);
    }
    var next = cur ? cur + '\n\n' + block : block;
    if (next.length > limit) { parts.push(cur); cur = block; } else cur = next;
  });
  if (cur) parts.push(cur);
  return parts;
}

// Recipients: dimazvali bot admins — same set alertAdmins() in routes/dimazvali.js uses.
async function sendToAdmins(db, token, text, deps) {
  if (!token) throw new Error('dimazvaliToken not set');
  var post = (deps && deps.post) || function(url, body) { return axios.post(url, body, { timeout: 10000 }); };
  var snap = await db.collection('DIMAZVALIusers').where('admin', '==', true).get();
  var parts = splitMessage(text);
  for (var i = 0; i < snap.docs.length; i++) {
    for (var j = 0; j < parts.length; j++) {
      try {
        await post('https://api.telegram.org/bot' + token + '/sendMessage', {
          chat_id: snap.docs[i].id, text: parts[j], parse_mode: 'HTML', disable_web_page_preview: true,
        });
      } catch (e) {
        console.error('[photo-leads] send to', snap.docs[i].id, e.message);
      }
    }
  }
  return snap.docs.length;
}

module.exports = { esc: esc, formatDigest: formatDigest, splitMessage: splitMessage, sendToAdmins: sendToAdmins, ADMIN_URL: ADMIN_URL };
