const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const serverTiming = require('../lib/server-timing');

function makeApp(cache) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-'));
  fs.writeFileSync(path.join(dir, 'page.pug'), 'p= msg');
  const app = express();
  app.set('views', dir);
  app.set('view engine', 'pug');
  if (cache) app.enable('view cache');
  app.use(serverTiming);
  app.get('/plain', (req, res) => res.render('page', { msg: 'hi' }));
  app.get('/cb', (req, res) => res.render('page', { msg: 'cb' }, (err, html) => res.send('[' + html + ']')));
  app.get('/missing', (req, res) => res.render('nope'));
  app.get('/json', (req, res) => res.json({ ok: true }));
  app.use((err, req, res, next) => res.status(500).send('err'));
  return app;
}

async function withServer(app, fn) {
  const srv = app.listen(0);
  await new Promise(r => srv.once('listening', r));
  try { return await fn('http://127.0.0.1:' + srv.address().port); } finally { srv.close(); }
}

test('render sets Server-Timing and still sends the html', async () => {
  await withServer(makeApp(true), async (base) => {
    const r = await fetch(base + '/plain');
    assert.strictEqual(await r.text(), '<p>hi</p>');
    const st = r.headers.get('server-timing');
    assert.match(st, /^app;dur=\d+\.\d, render;dur=\d+\.\d, cache;desc="on"$/);
  });
});

test('reports cache off and honours a caller callback', async () => {
  await withServer(makeApp(false), async (base) => {
    const r = await fetch(base + '/cb');
    assert.strictEqual(await r.text(), '[<p>cb</p>]');
    assert.match(r.headers.get('server-timing'), /cache;desc="off"/);
  });
});

test('render errors still reach the error handler; non-render responses get no header', async () => {
  await withServer(makeApp(true), async (base) => {
    const r = await fetch(base + '/missing');
    assert.strictEqual(r.status, 500);
    assert.strictEqual(r.headers.get('server-timing'), null);
    const j = await fetch(base + '/json');
    assert.strictEqual(j.headers.get('server-timing'), null);
  });
});
