'use strict';
// End-to-end through the console router: auth gate, users, chat send, commands, broadcasts.
// Firestore and Telegram are in-memory fakes.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const signature = require('cookie-signature');

const createConsole = require('../routes/dimazvali-console');

const SECRET = 'test-secret';

// ── fake Firestore with chainable where/orderBy/limit and merge ─────────
function fakeDb() {
  const store = {};
  const coll = n => (store[n] = store[n] || {});
  let seq = 0;
  const snapDoc = (n, id) => ({ id, exists: !!coll(n)[id], data: () => (coll(n)[id] ? { ...coll(n)[id] } : undefined) });
  function query(n, filters, order, lim) {
    return {
      where: (f, op, v) => query(n, filters.concat([[f, op, v]]), order, lim),
      orderBy: (f, dir) => query(n, filters, [f, dir || 'asc'], lim),
      limit: k => query(n, filters, order, k),
      get: async () => {
        const val = x => (x instanceof Date ? x.getTime() : x);
        let ids = Object.keys(coll(n)).filter(id => filters.every(([f, op, v]) => {
          const a = val(coll(n)[id][f]); const b = val(v);
          return op === '==' ? a === b : op === '<' ? a < b : true;
        }));
        if (order) {
          const [f, dir] = order;
          ids.sort((x, y) => { const a = val(coll(n)[x][f]), b = val(coll(n)[y][f]); return (a < b ? -1 : a > b ? 1 : 0) * (dir === 'desc' ? -1 : 1); });
        }
        if (lim != null) ids = ids.slice(0, lim);
        return { docs: ids.map(id => snapDoc(n, id)) };
      },
    };
  }
  return {
    store,
    collection: n => Object.assign(query(n, [], null, null), {
      doc: id => ({
        get: async () => snapDoc(n, id),
        set: async (d, opts) => { coll(n)[id] = opts && opts.merge ? { ...(coll(n)[id] || {}), ...d } : { ...d }; },
        update: async d => { if (!coll(n)[id]) throw new Error('missing ' + id); coll(n)[id] = { ...coll(n)[id], ...d }; },
      }),
      add: async d => { const id = 'id' + (++seq); coll(n)[id] = { ...d }; return { id }; },
    }),
  };
}

// ── fake Telegram over the axios-like http interface ─────────────────────
function fakeHttp() {
  const calls = [];
  let nextId = 100;
  return {
    calls,
    fail: null, // (method, body) => { error_code, description } | null
    async post(url, body) {
      const method = url.split('/').pop();
      const payload = body instanceof FormData ? Object.fromEntries([...body.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '[file]'])) : body;
      calls.push({ method, payload });
      const f = this.fail && this.fail(method, payload);
      if (f) return { data: { ok: false, ...f } };
      if (method === 'getMe') return { data: { ok: true, result: { id: 1, username: 'dimazvalibot', first_name: 'Bot' } } };
      if (method === 'getWebhookInfo') return { data: { ok: true, result: { url: 'https://bot.dimazvali.com/hook', pending_update_count: 0 } } };
      if (method === 'getMyCommands') return { data: { ok: true, result: [] } };
      if (/^send/.test(method)) {
        const chatId = Number(payload.chat_id);
        return { data: { ok: true, result: { message_id: nextId++, chat: { id: chatId, type: 'private' }, text: payload.text, caption: payload.caption } } };
      }
      return { data: { ok: true, result: true } };
    },
    async get() { throw new Error('no files in tests'); },
  };
}

async function setup() {
  const db = fakeDb();
  const http = fakeHttp();
  await db.collection('DIMAZVALIusers').doc('9').set({ id: 9, first_name: 'Dima', username: 'dimazvali', admin: true, createdAt: new Date('2024-01-01') });
  await db.collection('DIMAZVALIusers').doc('5').set({ id: 5, first_name: 'Anna', createdAt: new Date('2025-01-01'), photoSubscribed: true });
  await db.collection('DIMAZVALIusers').doc('6').set({ id: 6, first_name: 'Boris', createdAt: new Date('2025-02-01') });
  await db.collection('DIMAZVALIusers').doc('7').set({ id: 7, first_name: 'Guest', createdAt: new Date('2025-03-01') });
  await db.collection('DIMAZVALIadminTokens').doc('tok-admin').set({ user: 9, active: true });
  await db.collection('DIMAZVALIadminTokens').doc('tok-guest').set({ user: 7, active: true });
  await db.collection('DIMAZVALImessage').add({ createdAt: new Date('2025-05-01T10:00:00Z'), user: 5, text: 'старое входящее', isReply: false });

  const kit = createConsole({
    fb: db, udb: db.collection('DIMAZVALIusers'), messages: db.collection('DIMAZVALImessage'),
    adminTokens: db.collection('DIMAZVALIadminTokens'), token: '123:SECRETtoken', develop: true, http,
  });
  const app = express();
  app.set('views', path.join(__dirname, '..', 'views'));
  app.set('view engine', 'pug');
  app.use(cookieParser(SECRET));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use('/console', kit.router);
  app.use((err, req, res, next) => { res.status(500).send('ERR ' + err.stack); });
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const cookie = tok => 'adminToken=' + encodeURIComponent('s:' + signature.sign(tok, SECRET));
  const req = (p, opts = {}) => fetch(base + p, { redirect: 'manual', ...opts, headers: { cookie: cookie(opts.tok || 'tok-admin'), ...(opts.headers || {}) } });
  const form = (p, data, tok) => req(p, { method: 'POST', tok, body: new URLSearchParams(data), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  return { db, http, kit, server, base, req, form };
}

test('console routes', async t => {
  const ctx = await setup();
  t.after(() => ctx.server.close());
  const { db, http, kit, req, form, base } = ctx;

  await t.test('no cookie → login; login page renders', async () => {
    const r = await fetch(base + '/console/users', { redirect: 'manual' });
    assert.equal(r.status, 302);
    assert.match(r.headers.get('location'), /\/console\/login$/);
    const l = await fetch(base + '/console/login');
    assert.equal(l.status, 200);
    assert.match(await l.text(), /telegram-widget/);
  });

  await t.test('non-admin token → 403', async () => {
    const r = await req('/console/users', { tok: 'tok-guest' });
    assert.equal(r.status, 403);
  });

  await t.test('users list, filters and search', async () => {
    let html = await (await req('/console/users')).text();
    assert.match(html, /Anna/);
    assert.match(html, /Boris/);
    html = await (await req('/console/users?f=photo')).text();
    assert.match(html, /Anna/);
    assert.doesNotMatch(html, /Boris/);
    html = await (await req('/console/users?q=bor')).text();
    assert.match(html, /Boris/);
    assert.doesNotMatch(html, /Anna/);
  });

  await t.test('user card shows old history; send records an admin message', async () => {
    let html = await (await req('/console/users/5')).text();
    assert.match(html, /старое входящее/);
    const r = await form('/console/users/5/send', { text: 'привет <3' });
    assert.equal(r.status, 302);
    const sent = http.calls.find(c => c.method === 'sendMessage');
    assert.equal(sent.payload.chat_id, 5);
    assert.equal(sent.payload.parse_mode, undefined);
    html = await (await req('/console/users/5')).text();
    assert.match(html, /привет &lt;3/);
    const out = Object.values(db.store.DIMAZVALImessage).find(m => m.dir === 'out');
    assert.equal(out.by, 'admin');
    assert.equal(out.adminId, 9);
    assert.equal(out.isReply, true);
  });

  await t.test('send to a user who blocked the bot → error + botBlocked', async () => {
    http.fail = (m, p) => (m === 'sendMessage' && Number(p.chat_id) === 6 ? { error_code: 403, description: 'Forbidden: bot was blocked by the user' } : null);
    const r = await form('/console/users/6/send', { text: 'x' });
    assert.match(decodeURIComponent(r.headers.get('location')), /заблокировал/);
    await new Promise(r => setTimeout(r, 5));
    assert.equal(db.store.DIMAZVALIusers['6'].botBlocked, true);
    http.fail = null;
  });

  await t.test('incoming message clears botBlocked and lands in history', async () => {
    kit.onMessage({ chat: { id: 6, type: 'private' }, from: { id: 6 }, message_id: 1, photo: [{ file_id: 'F1', width: 800 }], caption: 'смотри' });
    await new Promise(r => setTimeout(r, 10));
    assert.equal(db.store.DIMAZVALIusers['6'].botBlocked, false);
    const html = await (await req('/console/users/6')).text();
    assert.match(html, /смотри/);
    assert.match(html, /\/console\/file\/F1/);
  });

  await t.test('flags: toggle photo subscription; cannot un-admin yourself', async () => {
    await form('/console/users/6/flag', { flag: 'photoSubscribed', value: '1' });
    assert.equal(db.store.DIMAZVALIusers['6'].photoSubscribed, true);
    const r = await form('/console/users/9/flag', { flag: 'admin', value: '0' });
    assert.match(decodeURIComponent(r.headers.get('location')), /С себя/);
    assert.equal(db.store.DIMAZVALIusers['9'].admin, true);
  });

  await t.test('commands: save applies the menu and enables custom replies', async () => {
    const html = await (await req('/console/bot')).text();
    assert.match(html, /@dimazvalibot/);
    assert.match(html, /123:…oken/);
    assert.doesNotMatch(html, /SECRETtoken/);
    const r = await form('/console/bot/commands', {
      cmd_0: 'start', desc_0: 'Начать', order_0: '1', on_0: '1',
      cmd_1: 'tours', desc_1: 'Экскурсии', order_1: '2',
      cmd_new: 'links', desc_new: 'Ссылки', order_new: '3', on_new: '1', reply_new: '<b>ссылки</b>',
    });
    assert.match(decodeURIComponent(r.headers.get('location')), /ok=/);
    const set = http.calls.filter(c => c.method === 'setMyCommands').pop();
    assert.deepEqual(set.payload.commands.map(c => c.command), ['start', 'links']);
    assert.equal(db.store.DIMAZVALIconsole.commands.items.length, 3);
    assert.equal(kit.commandFor('/links').reply, '<b>ссылки</b>');
    assert.equal(kit.commandFor('/start'), null);
  });

  await t.test('commands: Telegram rejects the menu → nothing saved', async () => {
    http.fail = m => (m === 'setMyCommands' ? { error_code: 400, description: 'Bad Request: BOT_COMMAND_INVALID' } : null);
    const r = await form('/console/bot/commands', { cmd_0: 'start', desc_0: 'x', on_0: '1', cmd_1: 'tours', desc_1: 'y' });
    http.fail = null;
    assert.match(decodeURIComponent(r.headers.get('location')), /не принял меню/);
    assert.equal(db.store.DIMAZVALIconsole.commands.items.length, 3);
  });

  await t.test('broadcast: create → test → start → done', async () => {
    let r = await form('/console/broadcasts', { text: 'Новые <b>фото</b>', segment: 'photo' });
    assert.equal(r.status, 302);
    const id = r.headers.get('location').match(/broadcasts\/(\w+)/)[1];
    let html = await (await req('/console/broadcasts/' + id)).text();
    assert.match(html, /Отправить себе/);
    r = await form('/console/broadcasts/' + id + '/start', {});
    assert.match(decodeURIComponent(r.headers.get('location')), /Сначала/);
    await form('/console/broadcasts/' + id + '/test', {});
    r = await form('/console/broadcasts/' + id + '/start', {});
    assert.match(decodeURIComponent(r.headers.get('location')), /Запущено: 2/); // Anna + Boris (now subscribed)
    await kit.broadcasts.running;
    const doc = db.store.DIMAZVALIbroadcasts[id];
    assert.equal(doc.status, 'done');
    assert.equal(doc.stats.sent, 2);
    html = await (await req('/console/broadcasts')).text();
    assert.match(html, /готово/);
  });

  await t.test('broadcast: validation error re-renders the form', async () => {
    const r = await form('/console/broadcasts', { text: '', segment: 'all' });
    assert.equal(r.status, 400);
    assert.match(await r.text(), /Нужен текст/);
  });
});
