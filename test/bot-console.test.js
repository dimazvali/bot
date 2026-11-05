'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { Broadcasts, BroadcastError } = require('../lib/bot-console/broadcasts');
const commands = require('../lib/bot-console/commands');
const { Chats, describe, normalize, sendToUser, uploadMethod } = require('../lib/bot-console/chats');
const { maskToken, TgError } = require('../lib/bot-console/tg');

// ── fakes ─────────────────────────────────────────────────────────────
function memStore(users) {
  const docs = {};
  const blocked = [];
  return {
    docs, blocked,
    list: async () => Object.values(docs).map(d => ({ ...d })),
    get: async id => (docs[id] ? { ...docs[id] } : null),
    save: async (id, d) => { docs[id] = { ...d }; },
    users: async () => users,
    markBlocked: async id => { blocked.push(id); },
  };
}

function fakeTg(behaviour) {
  const calls = [];
  return {
    calls,
    call: async (method, payload, opts) => {
      calls.push({ method, payload, meta: opts && opts.meta });
      const r = behaviour && behaviour(method, payload, calls.length);
      if (r instanceof Error) throw r;
      return r || { message_id: calls.length, chat: { id: payload.chat_id, type: 'private' } };
    },
    sendUpload: async (method, chatId, field, file, extra, meta) => {
      calls.push({ method, payload: { chat_id: chatId, ...extra }, field, file, meta });
      return { message_id: 1 };
    },
  };
}

const USERS = [
  { id: '3', photoSubscribed: true },
  { id: '1' },
  { id: '2', blocked: true, photoSubscribed: true },
  { id: '4', photoSubscribed: true },
  { id: '5', botBlocked: true },
];
const noSleep = async () => {};

// ── broadcasts ────────────────────────────────────────────────────────
test('broadcast: validation', async () => {
  const b = new Broadcasts({ store: memStore(USERS), tg: fakeTg(), sleep: noSleep });
  await assert.rejects(b.create({ text: '', segment: 'all' }, 1), BroadcastError);
  await assert.rejects(b.create({ text: 'hi', segment: 'nope' }, 1), /кому/);
  await assert.rejects(b.create({ text: 'hi', segment: 'all', photoUrl: 'http://x' }, 1), /https/);
  await assert.rejects(b.create({ text: 'hi', segment: 'all', buttonText: 'Go' }, 1), /кнопки/);
  const d = await b.create({ text: ' hi ', segment: 'all', buttonText: 'Go', buttonUrl: 'https://x.y' }, 1);
  assert.equal(d.text, 'hi');
  assert.equal(d.status, 'draft');
});

test('broadcast: recipients by segment, blocked excluded, sorted', async () => {
  const b = new Broadcasts({ store: memStore(USERS), tg: fakeTg(), sleep: noSleep });
  assert.deepEqual(await b.recipients({ segment: 'all' }), [1, 3, 4]);
  assert.deepEqual(await b.recipients({ segment: 'photo' }), [3, 4]);
});

test('broadcast: start requires a test send after the last edit', async () => {
  const store = memStore(USERS);
  const tg = fakeTg();
  const b = new Broadcasts({ store, tg, sleep: noSleep, rateMs: 0 });
  const d = await b.create({ text: 'hi', segment: 'all' }, 9);
  await assert.rejects(b.start(d.id, 9), /Отправить себе/);
  await b.sendTest(d.id, { id: 9, name: 'Dima' });
  assert.equal(tg.calls[0].payload.chat_id, 9);
  await new Promise(r => setTimeout(r, 2));
  await b.update(d.id, { text: 'hi 2', segment: 'all' });
  await assert.rejects(b.start(d.id, 9), /Отправить себе/);
});

test('broadcast: runs to done, counts blocked and failed, marks blocked users', async () => {
  const store = memStore(USERS);
  const tg = fakeTg((method, p) => {
    if (p.chat_id === 3) return new TgError(403, 'Forbidden: bot was blocked by the user');
    if (p.chat_id === 4) return new TgError(400, 'Bad Request: chat not found');
  });
  const b = new Broadcasts({ store, tg, sleep: noSleep, rateMs: 0 });
  const d = await b.create({ text: 'hi', segment: 'all', photoUrl: 'https://x/p.jpg' }, 9);
  await b.sendTest(d.id, { id: 9 });
  const n = await b.start(d.id, 9);
  assert.equal(n, 3);
  await b.running;
  const done = store.docs[d.id];
  assert.equal(done.status, 'done');
  assert.deepEqual(done.stats, { sent: 1, failed: 1, blocked: 1 });
  assert.deepEqual(store.blocked, [3]);
  assert.equal(done.errors[0].userId, 4);
  assert.ok(tg.calls.slice(1).every(c => c.method === 'sendPhoto' && c.payload.caption === 'hi'));
});

test('broadcast: 429 waits and retries the same person', async () => {
  const store = memStore([{ id: '1' }]);
  let first = true;
  const waits = [];
  const tg = fakeTg((m, p) => {
    if (p.chat_id === 1 && first) { first = false; return new TgError(429, 'Too Many Requests', 3); }
  });
  const b = new Broadcasts({ store, tg, rateMs: 0, sleep: async ms => { waits.push(ms); } });
  const d = await b.create({ text: 'x', segment: 'all' }, 9);
  await b.sendTest(d.id, { id: 9 });
  await b.start(d.id, 9);
  await b.running;
  assert.ok(waits.includes(3000));
  assert.equal(store.docs[d.id].stats.sent, 1);
});

test('broadcast: pause stops the loop with progress saved; resume finishes', async () => {
  const users = Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1) }));
  const store = memStore(users);
  let b;
  const tg = fakeTg((m, p) => { if (p.chat_id === 3) b.pause(id); });
  b = new Broadcasts({ store, tg, sleep: noSleep, rateMs: 0 });
  const d = await b.create({ text: 'x', segment: 'all' }, 9);
  var id = d.id;
  await b.sendTest(id, { id: 9 });
  await b.start(id, 9);
  await b.running;
  assert.equal(store.docs[id].status, 'paused');
  assert.equal(store.docs[id].cursor, 3);
  await b.resume(id);
  await b.running;
  assert.equal(store.docs[id].status, 'done');
  assert.equal(store.docs[id].stats.sent, 10);
});

test('broadcast: cancel a paused one', async () => {
  const store = memStore([{ id: '1' }]);
  const b = new Broadcasts({ store, tg: fakeTg(), sleep: noSleep, rateMs: 0 });
  const d = await b.create({ text: 'x', segment: 'all' }, 9);
  await store.save(d.id, { ...store.docs[d.id], status: 'paused', recipients: [1], cursor: 0, stats: { sent: 0, failed: 0, blocked: 0 } });
  await b.cancel(d.id);
  assert.equal(store.docs[d.id].status, 'cancelled');
  await assert.rejects(b.resume(d.id), /Нельзя/);
});

test('broadcast: resumeAll continues a running doc after restart', async () => {
  const store = memStore([]);
  await store.save('a', { id: 'a', text: 'x', segment: 'all', status: 'running', startedAt: 't', recipients: [5, 6], cursor: 1, stats: { sent: 1, failed: 0, blocked: 0 } });
  const tg = fakeTg();
  const b = new Broadcasts({ store, tg, sleep: noSleep, rateMs: 0 });
  await b.resumeAll();
  assert.equal(store.docs.a.status, 'done');
  assert.deepEqual(tg.calls.map(c => c.payload.chat_id), [6]);
});

// ── commands ──────────────────────────────────────────────────────────
test('commands: defaults are built-ins in the menu', () => {
  const items = commands.normalize(null);
  assert.deepEqual(items.map(i => i.command), ['start', 'tours']);
  assert.deepEqual(commands.menuOf(items), [
    { command: 'start', description: 'Начать' },
    { command: 'tours', description: 'Экскурсии' },
  ]);
});

test('commands: form parse — custom command, order, delete, validation', () => {
  const ok = commands.parseForm({
    cmd_0: 'start', desc_0: 'Старт', order_0: '2', on_0: '1',
    cmd_1: 'tours', desc_1: 'Туры', order_1: '3',
    cmd_2: 'links', desc_2: 'Ссылки', order_2: '1', on_2: '1', reply_2: '<b>Мои ссылки</b>',
    cmd_3: 'old', desc_3: 'x', reply_3: 'y', del_3: '1',
    cmd_new: '/Banks', desc_new: 'Реквизиты', order_new: '', reply_new: 'IBAN …',
  });
  assert.ok(ok.items, ok.error);
  assert.deepEqual(ok.items.map(i => i.command), ['links', 'start', 'tours', 'banks']);
  assert.deepEqual(commands.menuOf(ok.items).map(c => c.command), ['links', 'start']);
  assert.equal(ok.items.find(i => i.command === 'tours').inMenu, false);

  assert.match(commands.parseForm({ cmd_new: 'Bad-Name', reply_new: 'x' }).error, /латиница/);
  assert.match(commands.parseForm({ cmd_new: 'x', on_new: '1', reply_new: 'r' }).error, /описания/);
  assert.match(commands.parseForm({ cmd_new: 'x' }).error, /нет ответа/);
  assert.match(commands.parseForm({ cmd_a: 'x', reply_a: 'r', cmd_b: 'x', reply_b: 'r' }).error, /дважды/);
});

test('commands: built-ins survive if their rows vanish from the form', () => {
  const r = commands.parseForm({ cmd_new: 'links', reply_new: 'r' });
  assert.deepEqual(r.items.map(i => i.command).sort(), ['links', 'start', 'tours']);
});

test('commands: match custom only, honours @botname', () => {
  const items = commands.normalize({ items: [{ command: 'links', reply: 'L', inMenu: true, description: 'd' }] });
  assert.equal(commands.match(items, '/links').command, 'links');
  assert.equal(commands.match(items, '/links@DimaZvaliBot', 'dimazvalibot').command, 'links');
  assert.equal(commands.match(items, '/links@other', 'dimazvalibot'), null);
  assert.equal(commands.match(items, '/start'), null);
  assert.equal(commands.match(items, 'links'), null);
  assert.equal(commands.match(items, '/linksx'), null);
});

test('commands: HTML reply falls back to plain text when Telegram cannot parse it', async () => {
  const tg = fakeTg((m, p) => p.parse_mode ? new TgError(400, "Bad Request: can't parse entities") : null);
  await commands.replyToCommand(tg, 5, { reply: '<b>oops' });
  assert.equal(tg.calls.length, 2);
  assert.equal(tg.calls[1].payload.parse_mode, undefined);
});

// ── chats ─────────────────────────────────────────────────────────────
function memCol() {
  const rows = [];
  return {
    rows,
    add: async d => { rows.push(d); return { id: 'm' + rows.length }; },
  };
}

test('chats: describe picks the largest photo ≤1280 and file kinds', () => {
  const p = describe({ caption: 'c', photo: [{ file_id: 'a', width: 90 }, { file_id: 'b', width: 1280 }, { file_id: 'c', width: 2560 }] });
  assert.deepEqual(p, { kind: 'photo', text: 'c', fileId: 'b', mime: 'image/jpeg' });
  assert.equal(describe({ voice: { file_id: 'v', duration: 3 } }).kind, 'voice');
  assert.equal(describe({ document: { file_id: 'd', file_name: 'a.pdf' } }).fileName, 'a.pdf');
  assert.equal(describe({ text: 'hi' }).text, 'hi');
});

test('chats: normalize maps the old message shape', () => {
  const old = normalize('x', { createdAt: new Date('2026-01-01T00:00:00Z'), user: 5, text: 'yo', isReply: true, photo: 'https://p/1.jpg' });
  assert.equal(old.dir, 'out');
  assert.equal(old.by, 'bot');
  assert.equal(old.kind, 'photo');
  assert.equal(old.photoUrl, 'https://p/1.jpg');
  assert.equal(normalize('y', { user: 5, text: 'q', isReply: false }).dir, 'in');
});

test('chats: recordIn ignores groups; recordOut skips groups and non-send methods; events fire', async () => {
  const col = memCol();
  const chats = new Chats({ col });
  const seen = [];
  const off = chats.subscribe(5, m => seen.push(m));
  assert.equal(chats.recordIn({ chat: { id: -100, type: 'group' }, text: 'x' }), null);
  await chats.recordIn({ chat: { id: 5, type: 'private' }, message_id: 7, text: 'hello' });
  chats.recordOut('getMe', {}, {});
  chats.recordOut('sendMessage', { chat_id: -5 }, { chat: { id: -5 }, text: 'x' });
  chats.recordOut('sendMessage', { chat_id: 5 }, { message_id: 8, chat: { id: 5 }, text: 'answer' }, { by: 'admin', adminId: 9, adminName: 'D' });
  await new Promise(r => setTimeout(r, 5));
  off();
  assert.equal(col.rows.length, 2);
  assert.deepEqual(col.rows.map(r => [r.dir, r.isReply, r.by]), [['in', false, 'user'], ['out', true, 'admin']]);
  assert.equal(col.rows[1].adminId, 9);
  assert.deepEqual(seen.map(m => m.text), ['hello', 'answer']);
});

test('chats: sendToUser — empty, plain text, 403 → blocked, long caption split', async () => {
  const admin = { id: 9, name: 'D' };
  await assert.rejects(sendToUser(fakeTg(), 5, { text: '  ' }, admin), /Пустое/);
  const tg = fakeTg();
  await sendToUser(tg, 5, { text: 'a < b' }, admin);
  assert.equal(tg.calls[0].payload.parse_mode, undefined);
  assert.equal(tg.calls[0].meta.by, 'admin');
  const blocked = fakeTg(() => new TgError(403, 'blocked'));
  await assert.rejects(sendToUser(blocked, 5, { text: 'x' }, admin), e => e.blocked === true);
  const tg2 = fakeTg();
  await sendToUser(tg2, 5, { text: 'x'.repeat(1100), file: { buf: Buffer.alloc(10), name: 'a.jpg', type: 'image/jpeg' } }, admin);
  assert.deepEqual(tg2.calls.map(c => c.method), ['sendPhoto', 'sendMessage']);
});

test('uploadMethod by type/extension', () => {
  assert.equal(uploadMethod({ name: 'a.PNG', buf: Buffer.alloc(1) }).method, 'sendPhoto');
  assert.equal(uploadMethod({ name: 'big.jpg', buf: { length: 11e6 } }).method, 'sendDocument');
  assert.equal(uploadMethod({ name: 'a.mp3' }).method, 'sendAudio');
  assert.equal(uploadMethod({ name: 'a.ogg' }).method, 'sendVoice');
  assert.equal(uploadMethod({ name: 'a.zip' }).method, 'sendDocument');
});

test('maskToken', () => {
  assert.equal(maskToken('123:ABCDEFwxyz'), '123:…wxyz');
  assert.equal(maskToken(''), '—');
});
