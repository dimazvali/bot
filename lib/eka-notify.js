'use strict';
var { sendMessage2 } = require('../routes/methods');

var _db = null;

function init(db) {
  _db = db;
}

async function notify(type, text) {
  if (!_db) return;
  var token = process.env.EKA_BOT_TOKEN;
  if (!token) return;
  try {
    var snap = await _db.collection('ekaAdmins').get();
    var targets = snap.docs
      .map(function(d) { return Object.assign({ id: d.id }, d.data()); })
      .filter(function(a) { return a.tg_id && a['notify_' + type]; });
    await Promise.all(targets.map(function(a) {
      return sendMessage2({ chat_id: String(a.tg_id), text: text, parse_mode: 'HTML' }, false, token).catch(function() {});
    }));
  } catch(e) {}
}

module.exports = { init, notify };
