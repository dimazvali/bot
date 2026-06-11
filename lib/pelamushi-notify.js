const { sendMessage2 } = require('../routes/methods');
const token = process.env.dimazvaliToken;

async function notify(type, text) {
  if (!token) return;
  try {
    const { col } = require('./pelamushi-firebase');
    const cache = require('./pelamushi-cache');

    let admins = cache.get('admins_list');
    if (admins === undefined) {
      if (!col.admins) return;
      const snap = await col.admins.get();
      admins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      cache.set('admins_list', admins, 5 * 60 * 1000);
    }

    const targets = admins.filter(a => a.tg_id && a[`notify_${type}`]);
    await Promise.all(targets.map(a =>
      sendMessage2({ chat_id: String(a.tg_id), text, parse_mode: 'HTML' }, false, token).catch(() => {})
    ));
  } catch { /* never crash the request */ }
}

module.exports = { notify };
