'use strict';

// Per-shoot Telegram subscribers to the download alerts (lib/photo-downloads.js) and the "shoot opened"
// alert (routes/photo.js GET /shoot/:slug), set by nick in the shoot
// edit form (/admin/shoots/:slug/edit). A bot can only write to a chat id, so a nick is matched against the
// people who pressed Start in @dimazvalibot (DIMAZVALIusers, routes/dimazvali.js) or signed in on the photo
// site via Telegram (photoTgUsers, lib/photo-tg-login.js). A nick nobody matches is kept with tgId null and
// shown as "not found" in the form; saving the shoot again retries it.
//
// Stored on the shoot: downloadWatchers: [{ username, tgId|null, name|null }]

var NICK_RE = /^[a-z0-9_]{4,32}$/i;

// "@asya, https://t.me/Bob_1\nkate" → ['asya', 'Bob_1', 'kate'] (unique case-insensitively, invalid dropped)
function parseNicks(text) {
  var seen = {};
  return String(text || '').split(/[\s,;]+/).map(function(s) {
    return s.trim().replace(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\//i, '').replace(/^@/, '').replace(/\/+$/, '');
  }).filter(function(n) {
    if (!NICK_RE.test(n) || seen[n.toLowerCase()]) return false;
    seen[n.toLowerCase()] = true;
    return true;
  });
}

async function scan(db, name, fields) {
  var col = db.collection(name);
  var snap = await (col.select ? col.select.apply(col, fields) : col).get();
  return snap.docs.map(function(d) { return Object.assign({ _id: d.id }, d.data()); });
}

// nicks → [{ username, tgId, name }]; entries of `previous` already resolved for the same nick are reused,
// so an unchanged list doesn't scan the user collections on every save of the shoot form.
async function resolve(db, nicks, previous) {
  var known = {};
  (previous || []).forEach(function(w) { if (w && w.tgId) known[String(w.username).toLowerCase()] = w; });
  var out = nicks.map(function(n) { return known[n.toLowerCase()] || { username: n, tgId: null, name: null }; });
  if (out.every(function(w) { return w.tgId; })) return out;

  var byNick = {};
  var [botUsers, siteUsers] = await Promise.all([
    scan(db, 'DIMAZVALIusers', ['username', 'first_name', 'last_name']).catch(function(e) { console.error('[download-watchers] bot users:', e.message); return []; }),
    scan(db, 'photoTgUsers', ['username', 'name', 'tgId']).catch(function(e) { console.error('[download-watchers] site users:', e.message); return []; }),
  ]);
  siteUsers.forEach(function(u) {
    if (u.username) byNick[u.username.toLowerCase()] = { tgId: String(u.tgId || u._id), name: u.name || null };
  });
  botUsers.forEach(function(u) { // the bot's own record wins: that person definitely started the bot
    if (u.username) byNick[u.username.toLowerCase()] = { tgId: String(u._id), name: [u.first_name, u.last_name].filter(Boolean).join(' ') || null };
  });
  return out.map(function(w) {
    if (w.tgId) return w;
    var hit = byNick[w.username.toLowerCase()];
    return hit ? { username: w.username, tgId: hit.tgId, name: hit.name } : w;
  });
}

// chat ids that get a shoot's alerts besides the owner (downloads and "shoot opened"): resolved
// watchers only, the owner's own chat dropped so they don't get the message twice
function chatIds(shoot, ownerChatId) {
  var seen = {};
  return ((shoot && shoot.downloadWatchers) || []).map(function(w) { return w && w.tgId ? String(w.tgId) : null; })
    .filter(function(id) {
      if (!id || id === String(ownerChatId) || seen[id]) return false;
      seen[id] = true;
      return true;
    });
}

module.exports = { parseNicks: parseNicks, resolve: resolve, chatIds: chatIds };
