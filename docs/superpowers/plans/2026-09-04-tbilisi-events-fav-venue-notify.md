# Tbilisi Events — Favorited-Venue Telegram Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user opt in, on `/me`, to a Telegram/email ping whenever a new public event lands at a venue they favorited.

**Architecture:** A new `lib/tbilisi-events-fav-notify.js` module (`notifyFavoritedVenue(eventId)`) fans out to every user who favorited an event's venue and opted in, via the existing `teNotify.notifyUser`. It is called, fire-and-forget, from the two places an event becomes public: the auto-collect pipeline (`persistEvent` in `lib/tbilisi-events-pipeline.js`) and admin approval of a user submission (`routes/tbilisi-events-admin.js`). Dedup is a `favVenueNotifiedAt` timestamp set on the event before the fan-out loop runs. The opt-in is a plain auto-submitting checkbox on `/me`.

**Tech Stack:** Node/CommonJS (`var`), Express, `firebase-admin@^10` Firestore, Pug, `node --test` + `test/helpers/fake-firestore.js`. Reference spec: `docs/superpowers/specs/2026-09-04-tbilisi-events-fav-venue-notify-design.md`.

---

## Preconditions

Work on a branch `te-fav-venue-notify` cut from `main` (currently at the login+favorites merge, 147 tests green, tree clean — verify with `git status --short` before branching).

```bash
git checkout -b te-fav-venue-notify
npm test   # baseline: 147 pass
```

---

## File Structure

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `lib/tbilisi-events-data.js` | Modify | `getFavoritingUsers(type, entityId)` |
| `lib/tbilisi-events-users.js` | Modify | `setNotifyFavVenues(uid, on)` |
| `lib/tbilisi-events-notify.js` | Modify | `COPY.favVenueEvent` (en/ru/ka) |
| `lib/tbilisi-events-fav-notify.js` | Create | `notifyFavoritedVenue(eventId)` |
| `lib/tbilisi-events-pipeline.js` | Modify | call the fan-out after a new event's venue resolves |
| `routes/tbilisi-events-admin.js` | Modify | call the fan-out when a submission is approved/published |
| `routes/tbilisi-events-account.js` | Modify | `POST /me/notify-fav-venues`; pass `notifyFavVenues` to `/me` |
| `views/tbilisi-events/me.pug` | Modify | notification checkbox row |
| `test/tbilisi-events-data.test.js` | Modify | `getFavoritingUsers` tests |
| `test/tbilisi-events-users.test.js` | Modify | `setNotifyFavVenues` test |
| `test/tbilisi-events-notify.test.js` | Modify | `favVenueEvent` in the per-lang render test + a dedicated test |
| `test/tbilisi-events-fav-notify.test.js` | Create | `notifyFavoritedVenue` tests |

---

## Task 1: `getFavoritingUsers` data-layer function

**Files:**
- Modify: `lib/tbilisi-events-data.js` — after the `getFavorites` function (end of the `// ---------------- favorites ----------------` section), and in `module.exports` after `getFavorites: getFavorites,`
- Test: `test/tbilisi-events-data.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `test/tbilisi-events-data.test.js`:

```js
test('getFavoritingUsers returns userIds for that (type, entityId) only', async function() {
  var db = makeFakeDb();
  data.init(db);
  await data.setFavorite('u1', 'venue', 'v1', true);
  await data.setFavorite('u2', 'venue', 'v1', true);
  await data.setFavorite('u3', 'venue', 'v2', true);   // other venue
  await data.setFavorite('u4', 'event', 'v1', true);   // same entityId, different type

  var ids = await data.getFavoritingUsers('venue', 'v1');
  assert.deepEqual(ids.sort(), ['u1', 'u2']);

  assert.deepEqual(await data.getFavoritingUsers('venue', 'nobody'), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern="getFavoritingUsers" test/tbilisi-events-data.test.js 2>&1 | grep -E "not ok|^# (tests|pass|fail)"`
Expected: FAIL — `data.getFavoritingUsers is not a function`.

- [ ] **Step 3: Implement it**

In `lib/tbilisi-events-data.js`, immediately after the `getFavorites` function's closing `}` (before `// ---------------- submissions & organizer claims ----------------`), add:

```js
// Every userId that has favorited this (type, entityId). Filters `type` in JS
// (a single `where` on `entityId`, matching the getViewRecords precedent —
// avoids a composite index).
async function getFavoritingUsers(type, entityId) {
  var snap = await favoritesCollection().where('entityId', '==', entityId).get();
  return snap.docs.map(function(d) { return d.data(); })
    .filter(function(r) { return r.type === type; })
    .map(function(r) { return r.userId; });
}
```

In `module.exports`, after `getFavorites: getFavorites,` add:

```js
  getFavoritingUsers: getFavoritingUsers,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern="getFavoritingUsers" test/tbilisi-events-data.test.js 2>&1 | grep -E "not ok|^# (tests|pass|fail)"`
Expected: PASS (1 test).

- [ ] **Step 5: Full data test file**

Run: `node --test test/tbilisi-events-data.test.js 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/tbilisi-events-data.js test/tbilisi-events-data.test.js
git commit -m "feat(tbilisi-events): getFavoritingUsers data-layer function

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `setNotifyFavVenues` user-layer function

**Files:**
- Modify: `lib/tbilisi-events-users.js` — after `setTgBlocked`, and in `module.exports` after `setTgBlocked: setTgBlocked,` (check the exact export line — it may be named differently; search for `setTgBlocked` in the exports block and add the new line directly below it)
- Test: `test/tbilisi-events-users.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/tbilisi-events-users.test.js`:

```js
test('setNotifyFavVenues flips the flag', async function() {
  var db = makeFakeDb();
  users.init(db);
  var u = await users.upsertEmailUser('nfv@b.com', 'en');
  assert.equal((await users.getUserById(u.id)).notifyFavVenues, undefined);
  await users.setNotifyFavVenues(u.id, true);
  assert.equal((await users.getUserById(u.id)).notifyFavVenues, true);
  await users.setNotifyFavVenues(u.id, false);
  assert.equal((await users.getUserById(u.id)).notifyFavVenues, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern="setNotifyFavVenues" test/tbilisi-events-users.test.js 2>&1 | grep -E "not ok|^# (tests|pass|fail)"`
Expected: FAIL — `users.setNotifyFavVenues is not a function`.

- [ ] **Step 3: Implement it**

In `lib/tbilisi-events-users.js`, immediately after:

```js
async function setTgBlocked(uid, blocked) {
  await usersCol().doc(uid).update({ tgBlocked: !!blocked });
}
```

add:

```js
async function setNotifyFavVenues(uid, on) {
  await usersCol().doc(uid).update({ notifyFavVenues: !!on });
}
```

In `module.exports`, find the line exporting `setTgBlocked` (e.g. `setTgBlocked: setTgBlocked,`) and add directly after it:

```js
  setNotifyFavVenues: setNotifyFavVenues,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern="setNotifyFavVenues" test/tbilisi-events-users.test.js 2>&1 | grep -E "not ok|^# (tests|pass|fail)"`
Expected: PASS.

- [ ] **Step 5: Full users test file**

Run: `node --test test/tbilisi-events-users.test.js 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/tbilisi-events-users.js test/tbilisi-events-users.test.js
git commit -m "feat(tbilisi-events): setNotifyFavVenues user preference toggle

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `notifCopy` — `favVenueEvent` key

**Files:**
- Modify: `lib/tbilisi-events-notify.js` — in the `COPY` object, after the `organizer_rejected` entry (~line 44-48, right before the object's closing `};`)
- Test: `test/tbilisi-events-notify.test.js` — the per-lang key list (~line 21) and its `vars` fixture; append a dedicated test

- [ ] **Step 1: Write the failing tests**

In `test/tbilisi-events-notify.test.js`, change:

```js
  ['published', 'rejected', 'updated', 'organizer_approved', 'organizer_rejected'].forEach(function(key) {
    langs.forEach(function(lang) {
      var m = notify.notifCopy(key, lang, { title: 'T', link: 'https://x/e/1', reason: 'R' });
```

to:

```js
  ['published', 'rejected', 'updated', 'organizer_approved', 'organizer_rejected', 'favVenueEvent'].forEach(function(key) {
    langs.forEach(function(lang) {
      var m = notify.notifCopy(key, lang, { title: 'T', link: 'https://x/e/1', reason: 'R', venueName: 'Fabrika', eventTitle: 'Jazz Night', date: '2026-09-20' });
```

Then append a new test at the end of the file:

```js
test('notifCopy: favVenueEvent mentions the venue and event', function() {
  var ru = notify.notifCopy('favVenueEvent', 'ru', { venueName: 'Fabrika', eventTitle: 'Jazz Night', date: '2026-09-20', link: 'https://x/e/1' });
  assert.ok(ru.tg.indexOf('Fabrika') !== -1);
  assert.ok(ru.tg.indexOf('Jazz Night') !== -1);
  assert.ok(ru.email.html.indexOf('Fabrika') !== -1);
  assert.ok(ru.email.html.indexOf('Jazz Night') !== -1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/tbilisi-events-notify.test.js 2>&1 | grep -E "not ok|^# (tests|pass|fail)"`
Expected: FAIL — `favVenueEvent should render` (key not found → `notifCopy` returns `null`).

- [ ] **Step 3: Add the copy**

In `lib/tbilisi-events-notify.js`, in the `COPY` object, immediately after the `organizer_rejected` entry's closing `},` (right before the object's own closing `};`), add:

```js
  favVenueEvent: {
    en: function(v) { return { tg: 'New at ' + v.venueName + ': “' + v.eventTitle + '” on ' + v.date + '. ' + v.link, subject: 'New event at ' + v.venueName, bodyHtml: '<p>New at <b>' + esc(v.venueName) + '</b>: “' + esc(v.eventTitle) + '” on ' + esc(v.date) + '.</p><p><a href="' + esc(v.link) + '">Open it</a></p>' }; },
    ru: function(v) { return { tg: 'Новое в «' + v.venueName + '»: «' + v.eventTitle + '» ' + v.date + '. ' + v.link, subject: 'Новое событие в «' + v.venueName + '»', bodyHtml: '<p>Новое в «' + esc(v.venueName) + '»: «' + esc(v.eventTitle) + '» ' + esc(v.date) + '.</p><p><a href="' + esc(v.link) + '">Открыть</a></p>' }; },
    ka: function(v) { return { tg: 'ახალი ' + v.venueName + '-ში: “' + v.eventTitle + '” — ' + v.date + '. ' + v.link, subject: 'ახალი ღონისძიება — ' + v.venueName, bodyHtml: '<p>“' + esc(v.eventTitle) + '” — ' + esc(v.venueName) + ', ' + esc(v.date) + '.</p><p><a href="' + esc(v.link) + '">' + esc(v.link) + '</a></p>' }; },
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/tbilisi-events-notify.test.js 2>&1 | grep -E "not ok|^# (tests|pass|fail)"`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add lib/tbilisi-events-notify.js test/tbilisi-events-notify.test.js
git commit -m "feat(tbilisi-events): favVenueEvent notification copy (en/ru/ka)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `lib/tbilisi-events-fav-notify.js`

**Files:**
- Create: `lib/tbilisi-events-fav-notify.js`
- Create: `test/tbilisi-events-fav-notify.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/tbilisi-events-fav-notify.test.js`:

```js
'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var data = require('../lib/tbilisi-events-data.js');
var teUsers = require('../lib/tbilisi-events-users.js');
var teNotify = require('../lib/tbilisi-events-notify.js');
var favNotify = require('../lib/tbilisi-events-fav-notify.js');

// notifyFavoritedVenue calls the real modules directly (like recordView calling
// data.bumpViewCount/addViewRecord) — monkey-patch their exports for the
// duration of each test and restore in `finally`.
function withStubs(stubs, fn) {
  var saved = {};
  Object.keys(stubs).forEach(function(mod) {
    saved[mod] = {};
    Object.keys(stubs[mod]).forEach(function(k) {
      saved[mod][k] = stubs[mod].__target[k];
      stubs[mod].__target[k] = stubs[mod][k];
    });
  });
  return Promise.resolve().then(fn).finally(function() {
    Object.keys(stubs).forEach(function(mod) {
      Object.keys(saved[mod]).forEach(function(k) { stubs[mod].__target[k] = saved[mod][k]; });
    });
  });
}

test('notifyFavoritedVenue: no venueId on the event -> no-op', async function() {
  var calls = [];
  await withStubs({
    data: { __target: data, getEventById: async function() { return { id: 'e1', venueId: null }; } },
    teNotify: { __target: teNotify, notifyUser: function() { calls.push('notify'); } },
  }, async function() {
    await favNotify.notifyFavoritedVenue('e1');
  });
  assert.deepEqual(calls, []);
});

test('notifyFavoritedVenue: already notified -> no-op', async function() {
  var calls = [];
  await withStubs({
    data: { __target: data, getEventById: async function() { return { id: 'e1', venueId: 'v1', favVenueNotifiedAt: new Date() }; } },
    teNotify: { __target: teNotify, notifyUser: function() { calls.push('notify'); } },
  }, async function() {
    await favNotify.notifyFavoritedVenue('e1');
  });
  assert.deepEqual(calls, []);
});

test('notifyFavoritedVenue: marks the event, notifies opted-in favoriters only', async function() {
  var updateCalls = [];
  var notifyCalls = [];
  await withStubs({
    data: {
      __target: data,
      getEventById: async function() { return { id: 'e1', venueId: 'v1', title: 'Jazz Night', date: '2026-09-20', slug: 'jazz-night', favVenueNotifiedAt: null }; },
      getVenueById: async function() { return { id: 'v1', name: 'Fabrika' }; },
      updateEvent: async function(id, patch) { updateCalls.push([id, patch]); },
      getFavoritingUsers: async function() { return ['u1', 'u2', 'u3']; },
    },
    teUsers: {
      __target: teUsers,
      getUserById: async function(id) {
        if (id === 'u1') return { id: 'u1', notifyFavVenues: true };
        if (id === 'u2') return { id: 'u2', notifyFavVenues: false };
        return null; // u3: no such user
      },
    },
    teNotify: { __target: teNotify, notifyUser: function(uid, key, vars) { notifyCalls.push([uid, key, vars]); } },
  }, async function() {
    await favNotify.notifyFavoritedVenue('e1');
  });
  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0][0], 'e1');
  assert.ok(updateCalls[0][1].favVenueNotifiedAt instanceof Date);
  assert.equal(notifyCalls.length, 1);
  assert.deepEqual(notifyCalls[0][0], 'u1');
  assert.equal(notifyCalls[0][1], 'favVenueEvent');
  assert.equal(notifyCalls[0][2].venueName, 'Fabrika');
  assert.equal(notifyCalls[0][2].eventTitle, 'Jazz Night');
  assert.match(notifyCalls[0][2].link, /\/e\/jazz-night$/);
});

test('notifyFavoritedVenue: one user lookup throwing does not stop the others', async function() {
  var notifyCalls = [];
  await withStubs({
    data: {
      __target: data,
      getEventById: async function() { return { id: 'e1', venueId: 'v1', title: 'T', date: 'd', favVenueNotifiedAt: null }; },
      getVenueById: async function() { return { id: 'v1', name: 'V' }; },
      updateEvent: async function() {},
      getFavoritingUsers: async function() { return ['u1', 'u2']; },
    },
    teUsers: {
      __target: teUsers,
      getUserById: async function(id) {
        if (id === 'u1') throw new Error('boom');
        return { id: 'u2', notifyFavVenues: true };
      },
    },
    teNotify: { __target: teNotify, notifyUser: function(uid) { notifyCalls.push(uid); } },
  }, async function() {
    await favNotify.notifyFavoritedVenue('e1');
  });
  assert.deepEqual(notifyCalls, ['u2']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/tbilisi-events-fav-notify.test.js 2>&1 | grep -E "Cannot find module|not ok|^# (tests|pass|fail)"`
Expected: FAIL — `Cannot find module '../lib/tbilisi-events-fav-notify.js'`.

- [ ] **Step 3: Create the module**

Create `lib/tbilisi-events-fav-notify.js`:

```js
'use strict';
var data = require('./tbilisi-events-data');
var teUsers = require('./tbilisi-events-users');
var teNotify = require('./tbilisi-events-notify');

var PUBLIC_ORIGIN = process.env.TBILISI_EVENTS_BASE_URL || 'https://events.tbiliseli.com';

// Fire-and-forget: ping everyone who favorited this event's venue and opted
// in. Idempotent — no-ops if the event has no venue or was already notified.
async function notifyFavoritedVenue(eventId) {
  try {
    var event = await data.getEventById(eventId);
    if (!event || !event.venueId || event.favVenueNotifiedAt) return;
    var venue = await data.getVenueById(event.venueId);
    if (!venue) return;
    await data.updateEvent(event.id, { favVenueNotifiedAt: new Date() });
    var userIds = await data.getFavoritingUsers('venue', event.venueId);
    var link = PUBLIC_ORIGIN + '/e/' + (event.slug || event.id);
    for (var i = 0; i < userIds.length; i++) {
      try {
        var user = await teUsers.getUserById(userIds[i]);
        if (!user || !user.notifyFavVenues) continue;
        teNotify.notifyUser(user.id, 'favVenueEvent', {
          venueName: venue.name, eventTitle: event.title, date: event.date, link: link,
        });
      } catch (e) { console.error('[te fav-notify] user ' + userIds[i] + ': ' + e.message); }
    }
  } catch (e) {
    console.error('[te fav-notify] event ' + eventId + ': ' + e.message);
  }
}

module.exports = { notifyFavoritedVenue: notifyFavoritedVenue };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/tbilisi-events-fav-notify.test.js 2>&1 | grep -E "not ok|^# (tests|pass|fail)"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tbilisi-events-fav-notify.js test/tbilisi-events-fav-notify.test.js
git commit -m "feat(tbilisi-events): notifyFavoritedVenue fan-out module

Marks the event favVenueNotifiedAt before fanning out, notifies only
opted-in favoriters of the event's venue, tolerates a single user
lookup failing.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: hook into the auto-collect pipeline

**Files:**
- Modify: `lib/tbilisi-events-pipeline.js`

- [ ] **Step 1: Require the module**

Add, alongside the existing requires:

```js
var favNotify = require('./tbilisi-events-fav-notify');
```

- [ ] **Step 2: Call it after the venue resolves**

Find:

```js
    try {
      var venueId = await withTimeout(venues.resolveVenue(extracted.place), 40000, 'venue resolve');
      if (venueId) await data.updateEvent(id, { venueId: venueId });
    } catch (e) {
      summary.sourceErrors.push({ source: sourceLabel, error: 'venue resolve failed: ' + e.message });
    }
```

Change to:

```js
    try {
      var venueId = await withTimeout(venues.resolveVenue(extracted.place), 40000, 'venue resolve');
      if (venueId) {
        await data.updateEvent(id, { venueId: venueId });
        favNotify.notifyFavoritedVenue(id); // fire-and-forget
      }
    } catch (e) {
      summary.sourceErrors.push({ source: sourceLabel, error: 'venue resolve failed: ' + e.message });
    }
```

- [ ] **Step 3: Syntax + require check**

Run: `node --check lib/tbilisi-events-pipeline.js && echo OK`
Expected: `OK`

Run: `node -e "require('dotenv').config(); require('./lib/tbilisi-events-pipeline'); console.log('pipeline OK')" 2>&1 | grep -E "pipeline OK|Error"`
Expected: `pipeline OK`

- [ ] **Step 4: Full suite (no regressions)**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/tbilisi-events-pipeline.js
git commit -m "feat(tbilisi-events): notify favorited-venue watchers on new auto-collected events

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: hook into submission approval

**Files:**
- Modify: `routes/tbilisi-events-admin.js`

- [ ] **Step 1: Require the module**

Add, alongside the existing requires (near `var teNotify = require('../lib/tbilisi-events-notify');`):

```js
var favNotify = require('../lib/tbilisi-events-fav-notify');
```

- [ ] **Step 2: Call it when a submission is published**

Find:

```js
    var publishing = !!(prev && prev.submission && prev.submission.userId && !prev.active && patch.active && prev.submission.status !== 'approved');
    if (publishing) {
      patch.submission = Object.assign({}, prev.submission, { status: 'approved' });
      patch.hidden = false; // a submission is created hidden:true — reveal it on publish
    }
    await data.updateEvent(req.params.id, patch);
```

Change to:

```js
    var publishing = !!(prev && prev.submission && prev.submission.userId && !prev.active && patch.active && prev.submission.status !== 'approved');
    if (publishing) {
      patch.submission = Object.assign({}, prev.submission, { status: 'approved' });
      patch.hidden = false; // a submission is created hidden:true — reveal it on publish
    }
    await data.updateEvent(req.params.id, patch);
    if (publishing) favNotify.notifyFavoritedVenue(req.params.id); // fire-and-forget
```

- [ ] **Step 3: Syntax + require check**

Run: `node --check routes/tbilisi-events-admin.js && echo OK`
Expected: `OK`

Run: `node -e "require('dotenv').config(); require('./routes/tbilisi-events-admin'); console.log('admin routes OK')" 2>&1 | grep -E "admin routes OK|Error"`
Expected: `admin routes OK`

- [ ] **Step 4: Full suite**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add routes/tbilisi-events-admin.js
git commit -m "feat(tbilisi-events): notify favorited-venue watchers on submission approval

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `/me` preference checkbox

**Files:**
- Modify: `routes/tbilisi-events-account.js` — `GET /me` render, new `POST /me/notify-fav-venues`
- Modify: `views/tbilisi-events/me.pug`

- [ ] **Step 1: Pass the flag + add the route**

In `routes/tbilisi-events-account.js`, in the `GET /me` handler's `res.render('tbilisi-events/me', { … })` object, add:

```js
      notifyFavVenues: !!user.notifyFavVenues,
```

Immediately after the `GET /me` handler's closing `});` and before `router.post('/favorites/toggle', …)`, add:

```js
router.post('/me/notify-fav-venues', users.requireUser, guardCsrf, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    await users.setNotifyFavVenues(res.locals.user.uid, req.body.on === 'on');
    res.redirect(req.teBase + '/me');
  } catch (e) { next(e); }
});
```

- [ ] **Step 2: `me.pug` — checkbox row**

In `me.pug`, find the Telegram `.row` block, which ends right before `h2.sec= t.favTitle`:

```pug
          else
            p(style='margin-top:10px;color:var(--muted);font-size:13px') Reload to get a link.
      h2.sec= t.favTitle
```

Insert a new `.row` between them:

```pug
          else
            p(style='margin-top:10px;color:var(--muted);font-size:13px') Reload to get a link.
      .row
        .k Notifications
        label(style='display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer')
          form(method='POST' action=base + '/me/notify-fav-venues' style='display:contents')
            input(type='checkbox' name='on' value='on' checked=notifyFavVenues onchange='this.form.submit()')
          | Notify me about new events at my favorite venues
        if notifyFavVenues && !tgLinked
          p(style='margin-top:8px;color:var(--muted);font-size:12px') You'll get these by email until you link Telegram above.
      h2.sec= t.favTitle
```

- [ ] **Step 3: Syntax + compile + route load**

Run: `node --check routes/tbilisi-events-account.js && echo OK`
Expected: `OK`

Run: `node -e "require('pug').compileFile('views/tbilisi-events/me.pug'); console.log('me.pug compiles')"`
Expected: `me.pug compiles`

Run: `node -e "require('dotenv').config(); require('./routes/tbilisi-events'); require('./routes/tbilisi-events-account'); console.log('routes OK')" 2>&1 | grep -E "routes OK|Error"`
Expected: `routes OK`

- [ ] **Step 4: Render-check both checkbox states**

Run:

```bash
node -e "
var pug=require('pug');
var i18n=require('./lib/tbilisi-events-i18n');
var base={lang:'ru',t:i18n.UI.ru,base:'/tbilisi-events',user:{email:'a@b.com'},tgLinked:false,tgBlocked:false,tgDeepLink:null,title:'x',favorites:{events:[],venues:[]}};
function render(nfv,tg){ try{ var h=pug.renderFile('views/tbilisi-events/me.pug', Object.assign({},base,{notifyFavVenues:nfv,tgLinked:tg})); var m=h.match(/<input[^>]*name=\"on\"[^>]*>/); var hint=h.indexOf('until you link Telegram')!==-1; return (m?m[0]:'(none)')+' | hint='+hint; }catch(e){return 'ERR '+e.message.split('\n')[0];} }
console.log('off        :', render(false,false));
console.log('on, no tg  :', render(true,false));
console.log('on, tg     :', render(true,true));
"
```

Expected: line 1 has no `checked` attribute and `hint=false`; line 2 has `checked=\"checked\"` and `hint=true`; line 3 has `checked=\"checked\"` and `hint=false`.

- [ ] **Step 5: Commit**

```bash
git add routes/tbilisi-events-account.js views/tbilisi-events/me.pug
git commit -m "feat(tbilisi-events): notify-fav-venues checkbox on /me

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: final verification

- [ ] **Step 1: Full suite**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail|cancelled|skipped)"`
Expected: all pass (147 baseline + 1 getFavoritingUsers + 1 setNotifyFavVenues + 2 notifCopy + 4 fav-notify = 155).

- [ ] **Step 2: Compile + route-load check**

Run:

```bash
node -e "require('pug').compileFile('views/tbilisi-events/me.pug'); console.log('me.pug OK')"
node --check lib/tbilisi-events-pipeline.js && echo "pipeline OK"
node --check routes/tbilisi-events-admin.js && echo "admin OK"
node -e "require('dotenv').config(); require('./routes/tbilisi-events'); require('./routes/tbilisi-events-admin'); require('./routes/tbilisi-events-account'); console.log('routes OK')" 2>&1 | grep -E "routes OK|Error"
```

Expected: all four print their respective `OK` line.

- [ ] **Step 3: Manual smoke (app on a spare port, real Firestore)**

Using the same signed-cookie technique as the Phase 1+2 smoke test (`cookie-signature` + `process.env.papersToken` + `users.upsertEmailUser`), on a throwaway test user:

1. `POST /favorites/toggle` `{type:'venue', entityId:'<a real venue id>'}` with the session cookie → favorited.
2. `POST /me/notify-fav-venues` with body `on=on` and the session cookie → redirects to `/me`; `GET /me` now shows the checkbox checked.
3. Directly call `require('./lib/tbilisi-events-fav-notify').notifyFavoritedVenue('<a real event id at that venue>')` from a one-off script (after temporarily setting that event's `favVenueNotifiedAt` to `null` if it was already set) — confirm in the server logs / Telegram that a message went out, and that the event's `favVenueNotifiedAt` is now set.
4. Call it again for the same event id — confirm no second send (log shows nothing, `favVenueNotifiedAt` unchanged).
5. Toggle the venue favorite and the notification checkbox back off; delete the throwaway user doc — leave no test data behind.

- [ ] **Step 4: Update the spec status**

Append to `docs/superpowers/specs/2026-09-04-tbilisi-events-fav-venue-notify-design.md`:

```markdown

## Status

Implemented 2026-09-04 on branch `te-fav-venue-notify` (plan:
`docs/superpowers/plans/2026-09-04-tbilisi-events-fav-venue-notify.md`).
Smoke-tested against live Firestore + the real notify pipeline: fan-out fires
once per event (dedup via `favVenueNotifiedAt`), skips opted-out/missing users,
and the `/me` checkbox persists and shows the email-fallback hint when
Telegram isn't linked.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-04-tbilisi-events-fav-venue-notify-design.md
git commit -m "docs(tbilisi-events): mark fav-venue-notify spec implemented

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** data fn → Task 1; user fn → Task 2; notifCopy → Task 3; fan-out module → Task 4; pipeline hook → Task 5; submission-approval hook → Task 6; `/me` UI → Task 7; testing + smoke → Tasks 1-4 (unit) + 8 (integration/manual).
- **Type consistency:** `getFavoritingUsers(type, entityId)`, `setNotifyFavVenues(uid, on)`, `notifyFavoritedVenue(eventId)` names/signatures match between their definitions, call sites (pipeline, admin route), and tests. The `favVenueEvent` vars object (`venueName`, `eventTitle`, `date`, `link`) is identical across `notifCopy`, `notifyFavoritedVenue`, and the tests.
- **Placeholder scan:** no TBD/TODO. `<a real venue id>` / `<a real event id …>` in Task 8 Step 3 are operator-substituted runtime values, not gaps.
- **Fake-firestore:** `getFavoritingUsers` uses a single `where('entityId','==',…)`, already supported; no fake changes needed for this plan.
- **Fire-and-forget discipline:** both hook call sites (`favNotify.notifyFavoritedVenue(...)`) are un-awaited, matching `notifyFavoritedVenue`'s own internal `try/catch` that never rejects into a caller.
