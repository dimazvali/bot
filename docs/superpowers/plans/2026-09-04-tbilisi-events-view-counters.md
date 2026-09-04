# Tbilisi Events View Counters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Count human page views on the public event / collection / venue detail pages — bumping a `viewCount` field on the entity and appending one row per view to a `tbilisiEventsViews` collection — while excluding bots, non-browser fetchers, and admin previews.

**Architecture:** A new `lib/tbilisi-events-views.js` module decides whether a request counts (`isCountableView`) and performs the two fire-and-forget Firestore writes (`recordView`). The data layer (`lib/tbilisi-events-data.js`) gains `bumpViewCount` (atomic `FieldValue.increment`), `addViewRecord`, and a provisional `getViewRecords` reader. The three public detail route handlers in `routes/tbilisi-events.js` each get one non-awaited call, placed after the "entity exists" and "canonical slug" guards so only canonical `200` renders count.

**Tech Stack:** Node/CommonJS (`var`), Express, `firebase-admin@^10` Firestore, `isbot@^4` (dual CJS/ESM; v5 is ESM-only), `node --test` with `test/helpers/fake-firestore.js`.

---

## Preconditions

The working tree currently has **unrelated uncommitted work** in `lib/tbilisi-events-data.js`, `routes/tbilisi-events.js`, `lib/tbilisi-events-i18n.js`, several `lib/tbilisi-events-*.js`, and many views (an in-flight "admin audit log" + analytics/SEO partials effort). This plan modifies `lib/tbilisi-events-data.js` and `routes/tbilisi-events.js`, which are already dirty.

**Before starting:** commit or stash that in-flight work so each task commit below stays scoped to view counters. Verify with `git status --short` — ideally only `docs/superpowers/**` differs from a clean state, or the unrelated changes are stashed. If the user wants the in-flight work kept in the tree, each task's `git add` must name only the files that task touched (already the case below) and the engineer must `git add -p` the two shared files to stage only view-counter hunks.

The reference spec is `docs/superpowers/specs/2026-09-04-tbilisi-events-view-counters-design.md`.

---

## File Structure

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `test/helpers/fake-firestore.js` | Modify | `doc().update()` applies `FieldValue.increment` sentinels so increment semantics are testable |
| `package.json` | Modify | Add `isbot@^4` dependency |
| `lib/tbilisi-events-data.js` | Modify | `viewCount: 0` in the 3 `*_DEFAULTS`; `viewsCollection`, `bumpViewCount`, `addViewRecord`, `getViewRecords`; exports |
| `lib/tbilisi-events-views.js` | Create | `isCountableView(req)`, `hashIp(req)`, `recordView(type, entityId, req)` |
| `routes/tbilisi-events.js` | Modify | `require` the views module; one non-awaited `recordView` call in each of `/e/:id`, `/venues/:id`, `/collections/:id` |
| `test/tbilisi-events-views.test.js` | Create | Unit tests for the views module |
| `test/tbilisi-events-data.test.js` | Modify | Tests for the new data-layer functions + the fake-firestore increment behaviour |

---

## Task 1: fake-firestore honours `FieldValue.increment`

The fake's `update()` currently does a plain `Object.assign`, so `{ viewCount: FieldValue.increment(1) }` would store the sentinel object instead of adding. Teach it to apply the sentinel. `firebase-admin@^10`'s `FieldValue.increment(n)` returns a `NumericIncrementTransform` instance with a numeric `operand` property (verified: `Object.keys(x) === ['operand']`, `x.constructor.name === 'NumericIncrementTransform'`).

**Files:**
- Modify: `test/helpers/fake-firestore.js` (the `docApi` `update` function, ~lines 25-28)
- Test: `test/tbilisi-events-data.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/tbilisi-events-data.test.js`:

```js
var { FieldValue } = require('firebase-admin/firestore');

test('fake-firestore update() applies FieldValue.increment sentinels', async function() {
  var db = makeFakeDb();
  await db.collection('c').doc('a').set({ n: 5, other: 'x' });
  await db.collection('c').doc('a').update({ n: FieldValue.increment(3) });
  var snap = await db.collection('c').doc('a').get();
  assert.equal(snap.data().n, 8);
  assert.equal(snap.data().other, 'x');
});

test('fake-firestore update() increment creates field from 0 when missing', async function() {
  var db = makeFakeDb();
  await db.collection('c').doc('a').set({ other: 'x' });
  await db.collection('c').doc('a').update({ n: FieldValue.increment(1) });
  var snap = await db.collection('c').doc('a').get();
  assert.equal(snap.data().n, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern="fake-firestore update" 2>&1`
Expected: FAIL — first test reports `n` is an object (the sentinel), not `8`.

- [ ] **Step 3: Implement the sentinel handling**

In `test/helpers/fake-firestore.js`, replace the `update` function inside `docApi` with:

```js
      update: async function(patch) {
        if (!coll(name)[id]) throw new Error('update on missing doc ' + name + '/' + id);
        var current = coll(name)[id];
        var next = Object.assign({}, current);
        Object.keys(patch).forEach(function(k) {
          var v = patch[k];
          if (v != null && typeof v === 'object' && typeof v.operand === 'number'
              && v.constructor && /Increment/.test(v.constructor.name)) {
            next[k] = (typeof current[k] === 'number' ? current[k] : 0) + v.operand;
          } else {
            next[k] = v;
          }
        });
        coll(name)[id] = next;
      },
```

Also extend the header comment block at the top of the file: after the sentence ending `...do not rely on it for deep mutation.` add:

```js
// update() also applies firebase-admin FieldValue.increment(n) sentinels
// (detected by a numeric `operand` + an *Increment* constructor name).
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern="fake-firestore update" 2>&1`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full test file to check nothing regressed**

Run: `node --test test/tbilisi-events-data.test.js 2>&1`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add test/helpers/fake-firestore.js test/tbilisi-events-data.test.js
git commit -m "test: fake-firestore update() applies FieldValue.increment sentinels

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: add `isbot` dependency and `viewCount` defaults

**Files:**
- Modify: `package.json` (`dependencies`)
- Modify: `lib/tbilisi-events-data.js` (`EVENT_DEFAULTS` ~line 91, `VENUE_DEFAULTS` ~line 191, `COLLECTION_DEFAULTS` ~line 345)
- Test: `test/tbilisi-events-data.test.js` (append)

- [ ] **Step 1: Install isbot**

Run: `npm install isbot@^4 2>&1`
Then verify the CommonJS export shape:
Run: `node -e "console.log(typeof require('isbot').isbot)"`
Expected: `function`

If it instead prints `undefined`, run `node -e "console.log(typeof require('isbot'))"`; if THAT is `function`, note it and in Task 4 use `var isbot = require('isbot'); if (typeof isbot !== 'function') isbot = isbot.isbot;`. (Task 4 code below already uses this defensive form.)

- [ ] **Step 2: Write the failing test**

Append to `test/tbilisi-events-data.test.js`:

```js
test('insertEvent / insertVenue / insertCollection seed viewCount 0', async function() {
  var db = makeFakeDb();
  data.init(db);
  var evId = await data.insertEvent({ title: 'V', date: '2026-09-20' });
  assert.equal((await data.getEventById(evId)).viewCount, 0);

  var vId = await data.insertVenue({ name: 'Hall' });
  assert.equal((await data.getVenueById(vId)).viewCount, 0);

  var cId = await data.insertCollection({ title: { ru: 'C', en: 'C', ka: 'C' } });
  var cSnap = await db.collection('tbilisiEventsCollections').doc(cId).get();
  assert.equal(cSnap.data().viewCount, 0);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test --test-name-pattern="seed viewCount 0" 2>&1`
Expected: FAIL — `viewCount` is `undefined`.

- [ ] **Step 4: Add the defaults**

In `lib/tbilisi-events-data.js`:

`EVENT_DEFAULTS` — change the closing lines to include `viewCount`:

```js
var EVENT_DEFAULTS = {
  type: null, language: [], description: null,
  imageUrl: null, imageSourceUrl: null, venueId: null,
  rawExcerpt: null, hidden: false, enrichedAt: null,
  editorsPick: false, active: true, cancelled: false,
  editorNote: null, price: null, titleI18n: null, slug: null,
  parseRunId: null, lastParseRunId: null,
  viewCount: 0,
};
```

`VENUE_DEFAULTS` — add `viewCount: 0` to the object (append it after `editorVerified: false,` / the `closed`/`closedDate` line if present):

```js
  // ...existing VENUE_DEFAULTS fields, keep them all...
  viewCount: 0,
};
```

`COLLECTION_DEFAULTS`:

```js
var COLLECTION_DEFAULTS = {
  title: { ru: '', en: '', ka: '' },
  curatorNote: { ru: '', en: '', ka: '' },
  heroId: null,
  eventIds: [],
  published: false,
  slug: null,
  viewCount: 0,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test --test-name-pattern="seed viewCount 0" 2>&1`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/tbilisi-events-data.js test/tbilisi-events-data.test.js
git commit -m "feat(tbilisi-events): add isbot dep and viewCount:0 entity defaults

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: data layer — `viewsCollection`, `bumpViewCount`, `addViewRecord`, `getViewRecords`

**Files:**
- Modify: `lib/tbilisi-events-data.js` — collection accessor near line 19; new functions after `getAdminLog` (~line 476); exports near line 634
- Test: `test/tbilisi-events-data.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `test/tbilisi-events-data.test.js`:

```js
test('bumpViewCount increments the entity viewCount atomically', async function() {
  var db = makeFakeDb();
  data.init(db);
  var evId = await data.insertEvent({ title: 'E', date: '2026-09-20' });

  await data.bumpViewCount('event', evId);
  await data.bumpViewCount('event', evId);
  assert.equal((await data.getEventById(evId)).viewCount, 2);

  var vId = await data.insertVenue({ name: 'Hall' });
  await data.bumpViewCount('venue', vId);
  assert.equal((await data.getVenueById(vId)).viewCount, 1);
});

test('bumpViewCount rejects an unknown type', async function() {
  var db = makeFakeDb();
  data.init(db);
  await assert.rejects(function() { return data.bumpViewCount('widget', 'x'); }, /unknown view type/i);
});

test('addViewRecord writes a row with defaults + stamps at', async function() {
  var db = makeFakeDb();
  data.init(db);
  await data.addViewRecord({ type: 'event', entityId: 'abc', ipHash: '9f2c', ref: 'google.com', lang: 'ru', path: '/e/abc' });
  var snap = await db.collection('tbilisiEventsViews').get();
  assert.equal(snap.size, 1);
  var row = snap.docs[0].data();
  assert.equal(row.type, 'event');
  assert.equal(row.entityId, 'abc');
  assert.equal(row.ipHash, '9f2c');
  assert.equal(row.ref, 'google.com');
  assert.equal(row.lang, 'ru');
  assert.equal(row.path, '/e/abc');
  assert.ok(row.at instanceof Date);
});

test('addViewRecord fills null defaults for omitted fields', async function() {
  var db = makeFakeDb();
  data.init(db);
  await data.addViewRecord({ type: 'venue', entityId: 'v1' });
  var row = (await db.collection('tbilisiEventsViews').get()).docs[0].data();
  assert.equal(row.ipHash, null);
  assert.equal(row.ref, null);
  assert.equal(row.lang, null);
  assert.equal(row.path, null);
});

test('getViewRecords returns newest-first, optionally filtered by type/entityId', async function() {
  var db = makeFakeDb();
  data.init(db);
  await data.addViewRecord({ type: 'event', entityId: 'a', path: '1' });
  await data.addViewRecord({ type: 'event', entityId: 'b', path: '2' });
  await data.addViewRecord({ type: 'venue', entityId: 'a', path: '3' });

  var all = await data.getViewRecords({});
  assert.equal(all.length, 3);
  // newest first: 'at' is assigned in call order, so path '3' is newest
  assert.equal(all[0].path, '3');

  var evOnly = await data.getViewRecords({ type: 'event' });
  assert.deepEqual(evOnly.map(function(r) { return r.path; }).sort(), ['1', '2']);

  var evA = await data.getViewRecords({ type: 'event', entityId: 'a' });
  assert.equal(evA.length, 1);
  assert.equal(evA[0].path, '1');

  var limited = await data.getViewRecords({ limit: 2 });
  assert.equal(limited.length, 2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern="bumpViewCount|addViewRecord|getViewRecords" 2>&1`
Expected: FAIL — `data.bumpViewCount is not a function`.

- [ ] **Step 3: Add the collection accessor**

In `lib/tbilisi-events-data.js`, after the line
`function organizerClaimsCollection() { return _db.collection('tbilisiEventsOrganizerClaims'); }`
add:

```js
function viewsCollection() { return _db.collection('tbilisiEventsViews'); }
```

- [ ] **Step 4: Add the functions**

In `lib/tbilisi-events-data.js`, immediately after the `getAdminLog` function (right before the `// ---------------- submissions & organizer claims ----------------` comment), add:

```js
// ---------------- view counters ----------------
// Public detail-page view tracking. bumpViewCount is an atomic increment on the
// entity doc; addViewRecord appends one row per view for later graphs.
var VIEW_COLLECTION_BY_TYPE = {
  event: eventsCollection,
  venue: venuesCollection,
  collection: collectionsCollection,
};

async function bumpViewCount(type, id) {
  var coll = VIEW_COLLECTION_BY_TYPE[type];
  if (!coll) throw new Error('unknown view type: ' + type);
  var { FieldValue } = require('firebase-admin/firestore');
  await coll().doc(id).update({ viewCount: FieldValue.increment(1), updatedAt: new Date() });
}

async function addViewRecord(entry) {
  var doc = Object.assign(
    { type: null, entityId: null, ipHash: null, ref: null, lang: null, path: null },
    entry || {},
    { at: new Date() }
  );
  await viewsCollection().add(doc);
}

// Provisional reader for future graph code. Fetches the newest `limit` rows by
// `at` and filters type/entityId/since in JS. Replace with server-side composite
// filters + an index once graph requirements are concrete. Not used on the
// request path.
async function getViewRecords(opts) {
  var o = opts || {};
  var snap = await viewsCollection().orderBy('at', 'desc').limit(o.limit || 1000).get();
  var rows = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  var sinceMs = o.since != null ? +new Date(o.since) : null;
  var filtered = rows.filter(function(r) {
    if (o.type && r.type !== o.type) return false;
    if (o.entityId && r.entityId !== o.entityId) return false;
    if (sinceMs != null) {
      var atDate = r.at && typeof r.at.toDate === 'function' ? r.at.toDate() : r.at;
      if (!atDate || +new Date(atDate) < sinceMs) return false;
    }
    return true;
  });
  return typeof o.limit === 'number' ? filtered.slice(0, o.limit) : filtered;
}
```

- [ ] **Step 5: Export the new functions**

In the `module.exports` object, after the `getAdminLog: getAdminLog,` line add:

```js
  bumpViewCount: bumpViewCount,
  addViewRecord: addViewRecord,
  getViewRecords: getViewRecords,
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test --test-name-pattern="bumpViewCount|addViewRecord|getViewRecords" 2>&1`
Expected: PASS (5 tests).

- [ ] **Step 7: Run the full data test file**

Run: `node --test test/tbilisi-events-data.test.js 2>&1`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add lib/tbilisi-events-data.js test/tbilisi-events-data.test.js
git commit -m "feat(tbilisi-events): data layer for view counters

bumpViewCount (atomic FieldValue.increment on the entity), addViewRecord
(one row per view in tbilisiEventsViews), getViewRecords (provisional
newest-first reader for future graphs).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `lib/tbilisi-events-views.js` — `isCountableView`, `hashIp`, `recordView`

**Files:**
- Create: `lib/tbilisi-events-views.js`
- Create: `test/tbilisi-events-views.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/tbilisi-events-views.test.js`:

```js
'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var views = require('../lib/tbilisi-events-views.js');
var data = require('../lib/tbilisi-events-data.js');

// Minimal Express-ish req. headers keyed lowercase; req.get is case-insensitive.
function fakeReq(opts) {
  var o = opts || {};
  var headers = {};
  Object.keys(o.headers || {}).forEach(function(k) { headers[k.toLowerCase()] = o.headers[k]; });
  return {
    headers: headers,
    cookies: o.cookies || {},
    query: o.query || {},
    path: o.path || '/e/abc',
    ip: o.ip || '203.0.113.7',
    socket: { remoteAddress: o.remoteAddress || '203.0.113.7' },
    hostname: o.hostname || 'events.tbiliseli.com',
    get: function(h) { return headers[String(h).toLowerCase()]; },
  };
}

var CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

test('isCountableView: real browser request counts', function() {
  var req = fakeReq({ headers: { 'user-agent': CHROME, accept: 'text/html,application/xhtml+xml' } });
  assert.equal(views.isCountableView(req), true);
});

test('isCountableView: googlebot does not count', function() {
  var req = fakeReq({ headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', accept: 'text/html' } });
  assert.equal(views.isCountableView(req), false);
});

test('isCountableView: empty user-agent does not count', function() {
  var req = fakeReq({ headers: { 'user-agent': '   ', accept: 'text/html' } });
  assert.equal(views.isCountableView(req), false);
});

test('isCountableView: missing user-agent does not count', function() {
  var req = fakeReq({ headers: { accept: 'text/html' } });
  assert.equal(views.isCountableView(req), false);
});

test('isCountableView: non-html Accept does not count', function() {
  var req = fakeReq({ headers: { 'user-agent': CHROME, accept: 'application/json' } });
  assert.equal(views.isCountableView(req), false);
});

test('isCountableView: missing Accept does not count', function() {
  var req = fakeReq({ headers: { 'user-agent': CHROME } });
  assert.equal(views.isCountableView(req), false);
});

test('isCountableView: admin cookie does not count', function() {
  var req = fakeReq({
    headers: { 'user-agent': CHROME, accept: 'text/html' },
    cookies: { tbilisiEventsAdminToken: 'x' },
  });
  assert.equal(views.isCountableView(req), false);
});

test('hashIp: stable, 16 hex chars, differs by ip', function() {
  var a1 = views.hashIp(fakeReq({ ip: '1.2.3.4' }));
  var a2 = views.hashIp(fakeReq({ ip: '1.2.3.4' }));
  var b = views.hashIp(fakeReq({ ip: '9.9.9.9' }));
  assert.match(a1, /^[0-9a-f]{16}$/);
  assert.equal(a1, a2);
  assert.notEqual(a1, b);
});

test('hashIp: prefers first X-Forwarded-For token', function() {
  var viaXff = views.hashIp(fakeReq({ headers: { 'x-forwarded-for': '5.5.5.5, 10.0.0.1' }, ip: '10.0.0.1' }));
  var direct = views.hashIp(fakeReq({ ip: '5.5.5.5' }));
  assert.equal(viaXff, direct);
});

test('recordView: bumps count once and writes one row; never rejects on failure', async function() {
  var calls = [];
  var origBump = data.bumpViewCount;
  var origAdd = data.addViewRecord;
  data.bumpViewCount = async function(type, id) { calls.push(['bump', type, id]); };
  data.addViewRecord = async function(entry) { calls.push(['add', entry]); };
  try {
    await views.recordView('event', 'abc', fakeReq({
      headers: { 'user-agent': CHROME, accept: 'text/html', referer: 'https://www.google.com/search?q=x' },
      query: { lang: 'en' }, path: '/e/abc',
    }));
    assert.deepEqual(calls[0], ['bump', 'event', 'abc']);
    assert.equal(calls[1][0], 'add');
    var entry = calls[1][1];
    assert.equal(entry.type, 'event');
    assert.equal(entry.entityId, 'abc');
    assert.match(entry.ipHash, /^[0-9a-f]{16}$/);
    assert.equal(entry.ref, 'www.google.com');
    assert.equal(entry.lang, 'en');
    assert.equal(entry.path, '/e/abc');

    // failure is swallowed
    data.bumpViewCount = async function() { throw new Error('firestore down'); };
    await assert.doesNotReject(function() {
      return views.recordView('venue', 'v1', fakeReq({ headers: { 'user-agent': CHROME, accept: 'text/html' } }));
    });
  } finally {
    data.bumpViewCount = origBump;
    data.addViewRecord = origAdd;
  }
});

test('recordView: same-site referer is recorded as null', async function() {
  var seen = null;
  var origAdd = data.addViewRecord;
  var origBump = data.bumpViewCount;
  data.bumpViewCount = async function() {};
  data.addViewRecord = async function(entry) { seen = entry; };
  try {
    await views.recordView('event', 'abc', fakeReq({
      headers: { 'user-agent': CHROME, accept: 'text/html', referer: 'https://events.tbiliseli.com/' },
      hostname: 'events.tbiliseli.com',
    }));
    assert.equal(seen.ref, null);
  } finally {
    data.addViewRecord = origAdd;
    data.bumpViewCount = origBump;
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/tbilisi-events-views.test.js 2>&1`
Expected: FAIL — `Cannot find module '../lib/tbilisi-events-views.js'`.

- [ ] **Step 3: Create the module**

Create `lib/tbilisi-events-views.js`:

```js
'use strict';
var crypto = require('crypto');
var data = require('./tbilisi-events-data');
var i18n = require('./tbilisi-events-i18n');

var isbot = require('isbot');
if (typeof isbot !== 'function') isbot = isbot.isbot;

var IP_SALT = process.env.TBILISI_EVENTS_VIEW_SALT || 'te-views-v1';

// A request counts as a human view unless it is an admin preview, a bot, has no
// User-Agent, or is not asking for HTML (link unfurlers, JSON clients, curl).
function isCountableView(req) {
  if (req.cookies && req.cookies.tbilisiEventsAdminToken) return false;
  var ua = (req.get('user-agent') || '').trim();
  if (!ua) return false;
  if (isbot(ua)) return false;
  var accept = req.get('accept') || '';
  if (accept.indexOf('text/html') === -1) return false;
  return true;
}

function clientIp(req) {
  var xff = req.get && req.get('x-forwarded-for');
  if (xff) {
    var first = String(xff).split(',')[0].trim();
    if (first) return first;
  }
  if (req.ip) return req.ip;
  return (req.socket && req.socket.remoteAddress) || '';
}

// sha256(ip + salt), first 16 hex chars. Not reversible to a raw IP; for coarse
// uniqueness / abuse analysis only.
function hashIp(req) {
  var ip = clientIp(req);
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip + IP_SALT).digest('hex').slice(0, 16);
}

// Referer host, or null when absent, unparseable, or same-site.
function refHost(req) {
  var raw = req.get('referer') || req.get('referrer');
  if (!raw) return null;
  try {
    var host = new URL(raw).hostname;
    if (!host || host === req.hostname) return null;
    return host;
  } catch (e) {
    return null;
  }
}

// Fire-and-forget: callers MUST NOT await in a way that blocks the response.
// Never rejects — a failed write must not affect the page.
async function recordView(type, entityId, req) {
  try {
    await Promise.all([
      data.bumpViewCount(type, entityId),
      data.addViewRecord({
        type: type,
        entityId: entityId,
        ipHash: hashIp(req),
        ref: refHost(req),
        lang: i18n.normalizeLang(req.query && req.query.lang),
        path: req.path || null,
      }),
    ]);
  } catch (e) {
    console.error('[te views] ' + type + '/' + entityId + ': ' + e.message);
  }
}

module.exports = {
  isCountableView: isCountableView,
  hashIp: hashIp,
  recordView: recordView,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/tbilisi-events-views.test.js 2>&1`
Expected: PASS (12 tests).

If `isbot` assertions fail because `isbot('...Googlebot...')` returns `false`, check the installed major version: `node -e "console.log(require('isbot/package.json').version)"`. This plan assumes `4.x`. If npm resolved `5.x` (ESM-only, `require` would already have thrown), reinstall with `npm install isbot@4`.

- [ ] **Step 5: Commit**

```bash
git add lib/tbilisi-events-views.js test/tbilisi-events-views.test.js
git commit -m "feat(tbilisi-events): views module — bot filter + recordView

isCountableView rejects admin previews, bots (isbot), empty UA, and
non-text/html requests. recordView does two fire-and-forget Firestore
writes and never rejects.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: wire `recordView` into the three public detail routes

**Files:**
- Modify: `routes/tbilisi-events.js` — require block (~line 12), and handlers `GET /e/:id` (~line 494), `GET /venues/:id` (~line 639), `GET /collections/:id` (~line 782)

- [ ] **Step 1: Add the require**

In `routes/tbilisi-events.js`, after `var teMailer = require('../lib/tbilisi-events-mailer');` add:

```js
var views = require('../lib/tbilisi-events-views');
```

- [ ] **Step 2: Count event views**

In `GET /e/:id`, find:

```js
    if (event.slug && req.params.id !== event.slug) {
      return res.redirect(301, req.teBase + '/e/' + event.slug + langQuery(lang));
    }
```

Immediately after that block add:

```js
    if (views.isCountableView(req)) views.recordView('event', event.id, req);
```

- [ ] **Step 3: Count venue views**

In `GET /venues/:id`, find:

```js
    if (venue.slug && req.params.id !== venue.slug) {
      return res.redirect(301, req.teBase + '/venues/' + venue.slug + langQuery(lang));
    }
```

Immediately after that block add:

```js
    if (views.isCountableView(req)) views.recordView('venue', venue.id, req);
```

- [ ] **Step 4: Count collection views**

In `GET /collections/:id` the collection local is named `col`. Find:

```js
    if (col.slug && req.params.id !== col.slug) {
      return res.redirect(301, req.teBase + '/collections/' + col.slug + langQuery(lang));
    }
```

This is preceded by `if (!col || !col.published) return next();`. Immediately after the slug-redirect block add:

```js
    if (views.isCountableView(req)) views.recordView('collection', col.id, req);
```

- [ ] **Step 5: Syntax-check the file**

Run: `node --check routes/tbilisi-events.js && echo OK`
Expected: `OK`

- [ ] **Step 6: Run the whole test suite**

Run: `npm test 2>&1`
Expected: all tests pass (no regressions; routes have no unit tests).

- [ ] **Step 7: Manual smoke test**

Start the app on a spare port (run the server as a background process via the harness, not a foreground `&`), pick a real event slug from `/` or the admin events list, then:

```bash
# real browser UA + HTML accept -> should count
curl -s -o /dev/null -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36" -H "Accept: text/html" "http://127.0.0.1:3599/e/<known-event-slug>"
# googlebot -> should NOT count
curl -s -o /dev/null -H "User-Agent: Googlebot/2.1 (+http://www.google.com/bot.html)" -H "Accept: text/html" "http://127.0.0.1:3599/e/<known-event-slug>"
```

Stop the background server when done (target its PID — do not kill node by name). Then in the Firebase console (project `dimazvalimisc`, the `tbilisiEvents` app database) confirm: the event doc's `viewCount` went up by exactly **1**, and `tbilisiEventsViews` has exactly **1** new row with `type: "event"` and the right `entityId`.

- [ ] **Step 8: Commit**

```bash
git add routes/tbilisi-events.js
git commit -m "feat(tbilisi-events): count human views on event/venue/collection pages

One non-awaited views.recordView() call per detail handler, after the
canonical-slug guard so only 200 renders count.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: final verification

- [ ] **Step 1: Full suite**

Run: `npm test 2>&1`
Expected: all pass.

- [ ] **Step 2: Lint the new module for accidental blocking**

Confirm by reading `routes/tbilisi-events.js`: each of the three added lines calls `views.recordView(...)` **without** `await`, and sits after the `return next()` / `return res.redirect(...)` guards. Confirm `lib/tbilisi-events-views.js` `recordView` wraps its body in `try/catch`.

- [ ] **Step 3: Confirm spec coverage**

Re-read `docs/superpowers/specs/2026-09-04-tbilisi-events-view-counters-design.md` and tick off: `viewCount` on all three defaults (Task 2); one row per view (Task 3 `addViewRecord`); `isbot` + empty-UA + non-HTML filter (Task 4); admin-cookie skip (Task 4); XFF-aware `ipHash`, host-only `ref`, `lang`, `path` (Task 4); fire-and-forget wiring after canonical guards in all three routes (Task 5); `getViewRecords` reader present + tested (Task 3); `isbot@^4` dependency (Task 2).

- [ ] **Step 4: Update the spec's status**

Append to the bottom of `docs/superpowers/specs/2026-09-04-tbilisi-events-view-counters-design.md`:

```markdown

## Status

Implemented 2026-09-04. Follow-ups (admin display, graphs, backfill) not started.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-04-tbilisi-events-view-counters-design.md
git commit -m "docs(tbilisi-events): mark view-counters spec implemented

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** all spec sections map to tasks (see Task 6 Step 3). `getViewRecords` shipped as a provisional JS-filter reader because the current `test/helpers/fake-firestore.js` supports only a single `where`/`orderBy` chain and no range operators; the spec already labels it "future graph code only".
- **Type consistency:** `bumpViewCount(type, id)` / `addViewRecord(entry)` / `getViewRecords(opts)` / `isCountableView(req)` / `hashIp(req)` / `recordView(type, entityId, req)` names and signatures are identical across the data module, the views module, the route calls, and all tests. View-record row fields (`type`, `entityId`, `at`, `ipHash`, `ref`, `lang`, `path`) match between `addViewRecord`, `recordView`, and the tests.
- **isbot interop:** Task 2 Step 1 verifies the CJS export shape and Task 4's module uses the defensive `if (typeof isbot !== 'function') isbot = isbot.isbot;` form so it works whether `require('isbot')` yields the function (v3) or `{ isbot }` (v4).
- **Dirty tree:** called out in Preconditions — `lib/tbilisi-events-data.js` and `routes/tbilisi-events.js` already carry unrelated in-flight changes; commit/stash first or stage hunks selectively.
