# Tbilisi Events — Navbar Login + Favorites — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-right account link to every public page's header (signed-in name → `/me`, guest → `/login?next=…`), and let signed-in users favorite events/venues from their detail pages, listed on `/me`. Plus one `robots.txt` line.

**Architecture:** A shared `_account-link.pug` mixin reads `res.locals` (`user`, `base`, `loginHref` — the last added once in the router middleware) and is called in the 6 content templates' headers. Favorites live in a dedicated `tbilisiEventsFavorites` collection, one deterministic-id doc per (user, entity); a `POST /favorites/toggle` JSON endpoint on the account router toggles them, and a small inline `_favorite.pug` script drives the button. `/me` and the two detail routes gain a per-request `isFavorited` / favorites lookup.

**Tech Stack:** Node/CommonJS (`var`), Express, `firebase-admin@^10` Firestore, Pug (standalone pages, inline `<style>`), `node --test` + `test/helpers/fake-firestore.js`. Reference spec: `docs/superpowers/specs/2026-09-04-tbilisi-events-login-favorites-design.md`.

---

## Preconditions

Work on a branch `te-login-favorites` cut from `main` (currently `c618e98`, 144 tests green, tree clean). If the tree is dirty at start, commit/stash unrelated work first.

```bash
git checkout -b te-login-favorites
npm test   # baseline: 144 pass
```

---

## File Structure

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `lib/tbilisi-events-i18n.js` | Modify | `signIn`, `favAdd`, `favRemove`, `favTitle`, `favEmpty` in `UI.ru/en/ka` |
| `routes/tbilisi-events.js` | Modify | `res.locals.loginHref` in the base middleware; `isFavorited` in `GET /e/:id` and `GET /venues/:id`; `robots.txt` line |
| `views/tbilisi-events/_account-link.pug` | Create | `mixin accountLink()` |
| `views/tbilisi-events/_favorite.pug` | Create | `mixin favButton(type, entityId, isFav)`, `mixin favScript()` |
| `views/tbilisi-events/{list,event}.pug` + `{venues,collections}/{list,detail}.pug` | Modify | include + `+accountLink()` + `.acct` CSS (6 files) |
| `views/tbilisi-events/event.pug`, `views/tbilisi-events/venues/detail.pug` | Modify | `+favButton(...)` in `.actions`, `+favScript()`, `.fav` CSS |
| `views/tbilisi-events/me.pug` | Modify | favorites section + CSS |
| `lib/tbilisi-events-data.js` | Modify | `favoritesCollection`, `favDocId`, `isFavorited`, `setFavorite`, `getFavorites` + exports |
| `routes/tbilisi-events-account.js` | Modify | `POST /favorites/toggle`; `/me` favorites lookup; cache regex |
| `test/tbilisi-events-data.test.js` | Modify | favorites data-layer tests |

---

## Task 1: i18n strings

**Files:**
- Modify: `lib/tbilisi-events-i18n.js` — end of `UI.ru` block (after the `mapPoints: 'точек',` line, ~line 25), `UI.en` (~line 42), `UI.ka` (~line 59)

- [ ] **Step 1: Add the keys**

After the `collectionsTitle: … mapPoints: 'точек',` line in the **ru** block, add a new line:

```js
    signIn: 'Войти', favAdd: 'В избранное', favRemove: 'В избранном', favTitle: 'Избранное', favEmpty: 'Вы пока ничего не добавили в избранное.',
```

After the equivalent line in the **en** block:

```js
    signIn: 'Sign in', favAdd: 'Save', favRemove: 'Saved', favTitle: 'Saved', favEmpty: 'You haven’t saved anything yet.',
```

After the equivalent line in the **ka** block:

```js
    signIn: 'შესვლა', favAdd: 'შენახვა', favRemove: 'შენახულია', favTitle: 'რჩეული', favEmpty: 'ჯერ არაფერი გაქვთ შენახული.',
```

- [ ] **Step 2: Verify it parses**

Run: `node -e "var i=require('./lib/tbilisi-events-i18n'); console.log(i.UI.ru.signIn, '|', i.UI.en.favAdd, '|', i.UI.ka.favTitle)"`
Expected: `Войти | Save | რჩეული`

- [ ] **Step 3: Commit**

```bash
git add lib/tbilisi-events-i18n.js
git commit -m "feat(tbilisi-events): i18n strings for navbar login + favorites

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `res.locals.loginHref` + `_account-link.pug`

**Files:**
- Modify: `routes/tbilisi-events.js` — the base router middleware (`req.teBase = req.teBase || '';` … `res.locals.base = req.teBase;`, ~line 201-208)
- Create: `views/tbilisi-events/_account-link.pug`

- [ ] **Step 1: Add `res.locals.loginHref`**

In `routes/tbilisi-events.js`, find:

```js
  req.teBase = req.teBase || '';
  res.locals.base = req.teBase;
```

Change to:

```js
  req.teBase = req.teBase || '';
  res.locals.base = req.teBase;
  res.locals.loginHref = req.teBase + '/login?next=' + encodeURIComponent(req.originalUrl);
```

- [ ] **Step 2: Create the partial**

Create `views/tbilisi-events/_account-link.pug`:

```pug
//- Right-aligned account control for the site header. Reads template locals:
//- user (res.locals.user | null), base (res.locals.base), loginHref, t.
mixin accountLink()
  if user
    a.acct(href=base + '/me' title=user.email)= user.name || user.email
  else
    a.acct(href=loginHref)= t.signIn
```

- [ ] **Step 3: Syntax-check the route + compile the partial**

Run: `node --check routes/tbilisi-events.js && echo OK`
Expected: `OK`

Run: `node -e "require('pug').compileFile('views/tbilisi-events/_account-link.pug'); console.log('partial compiles')"`
Expected: `partial compiles`

- [ ] **Step 4: Commit**

```bash
git add routes/tbilisi-events.js views/tbilisi-events/_account-link.pug
git commit -m "feat(tbilisi-events): loginHref local + account-link header mixin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: wire `+accountLink()` into the 6 content templates

Each of the 6 has a `header.hdr` ending in a `.langs` block. `list.pug` uses `include _account-link.pug`; the four files under `venues/` and `collections/` use `include ../_account-link.pug`; `event.pug` uses `include ./_account-link.pug`.

**Files:**
- Modify: `views/tbilisi-events/list.pug`, `views/tbilisi-events/event.pug`, `views/tbilisi-events/venues/list.pug`, `views/tbilisi-events/venues/detail.pug`, `views/tbilisi-events/collections/list.pug`, `views/tbilisi-events/collections/detail.pug`

- [ ] **Step 1: `list.pug`**

Add near the top, with the other includes (after `include _suggest-link.pug`):

```pug
include _account-link.pug
```

In `header.hdr`, the `.langs` block is:

```pug
        .langs
          each l in langLinks
            a(href=l.href class=l.active ? 'lang on' : 'lang')= l.code
```

Immediately after it (same 8-space indent as `.langs`), add:

```pug
        +accountLink()
```

In the inline `<style>`, after the line `.langs{margin-left:auto;display:flex;gap:3px}`, add:

```css
      .acct{margin-left:12px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--dark-fg);white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis}
      .acct:hover{color:var(--acc)}
```

- [ ] **Step 2: `event.pug`**

Add with the other includes (after `include ./_crumbs.pug`):

```pug
include ./_account-link.pug
```

In `header.hdr` the block is:

```pug
        .langs
          each l in langLinks
            a(href=l.href class=l.active ? 'lang on' : 'lang')= l.code
```

Immediately after it (8-space indent), add:

```pug
        +accountLink()
```

In `<style>`, after `.langs{margin-left:auto;display:flex;gap:3px}` (line ~41), add the same two `.acct` rules from Step 1.

- [ ] **Step 3: `venues/list.pug`**

Add with the includes (after `include ../_crumbs.pug`):

```pug
include ../_account-link.pug
```

After the `.langs` / `each l in langLinks` / `a(href=l.href …)` block in `header.hdr` (8-space indent), add:

```pug
        +accountLink()
```

In `<style>`, after `.langs{margin-left:auto;display:flex;gap:3px}`, add the two `.acct` rules.

- [ ] **Step 4: `venues/detail.pug`**

Same as Step 3 but this file. Add `include ../_account-link.pug` with the includes; `+accountLink()` after the `.langs` block in `header.hdr`; the two `.acct` rules after `.langs{…}` (line ~41) in `<style>`.

- [ ] **Step 5: `collections/list.pug`**

Add `include ../_account-link.pug` with the includes; `+accountLink()` after the `.langs` block; the two `.acct` rules after `.langs{…}` in `<style>`.

- [ ] **Step 6: `collections/detail.pug`**

Add `include ../_account-link.pug` with the includes; `+accountLink()` after the `.langs` block; the two `.acct` rules after `.langs{…}` in `<style>`.

- [ ] **Step 7: Compile all 6**

Run:

```bash
node -e "var pug=require('pug');['list','event','venues/list','venues/detail','collections/list','collections/detail'].forEach(function(f){try{pug.compileFile('views/tbilisi-events/'+f+'.pug');console.log('OK  '+f)}catch(e){console.log('ERR '+f+': '+e.message.split('\n')[0])}})"
```

Expected: `OK  list` … `OK  collections/detail` (6 lines, no `ERR`).

- [ ] **Step 8: Commit**

```bash
git add views/tbilisi-events/list.pug views/tbilisi-events/event.pug views/tbilisi-events/venues/list.pug views/tbilisi-events/venues/detail.pug views/tbilisi-events/collections/list.pug views/tbilisi-events/collections/detail.pug
git commit -m "feat(tbilisi-events): account link in the header of all content pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: favorites data layer

**Files:**
- Modify: `lib/tbilisi-events-data.js` — accessor after `viewsCollection()` (line ~21); functions after `getViewRecords` (before `// ---------------- submissions & organizer claims ----------------`); exports after `getViewRecords: getViewRecords,` (~line 698)
- Test: `test/tbilisi-events-data.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `test/tbilisi-events-data.test.js`:

```js
test('setFavorite / isFavorited toggle a favorite on and off', async function() {
  var db = makeFakeDb();
  data.init(db);
  assert.equal(await data.isFavorited('u1', 'event', 'e1'), false);

  var r1 = await data.setFavorite('u1', 'event', 'e1', true);
  assert.equal(r1, true);
  assert.equal(await data.isFavorited('u1', 'event', 'e1'), true);

  var r2 = await data.setFavorite('u1', 'event', 'e1', false);
  assert.equal(r2, false);
  assert.equal(await data.isFavorited('u1', 'event', 'e1'), false);

  // toggling off when already off does not throw
  await data.setFavorite('u1', 'event', 'e1', false);
});

test('setFavorite rejects an unknown type', async function() {
  var db = makeFakeDb();
  data.init(db);
  await assert.rejects(function() { return data.setFavorite('u1', 'widget', 'x', true); }, /bad key/i);
});

test('getFavorites returns only the user rows, newest-first', async function() {
  var db = makeFakeDb();
  data.init(db);
  var gap = function() { return new Promise(function(r) { setTimeout(r, 2); }); };
  await data.setFavorite('u1', 'event', 'e1', true);
  await gap();
  await data.setFavorite('u1', 'venue', 'v9', true);
  await gap();
  await data.setFavorite('u2', 'event', 'e1', true); // other user

  var favs = await data.getFavorites('u1');
  assert.equal(favs.length, 2);
  assert.equal(favs[0].type, 'venue');   // v9 is newest
  assert.equal(favs[0].entityId, 'v9');
  assert.equal(favs[1].entityId, 'e1');
  favs.forEach(function(f) { assert.equal(f.userId, 'u1'); });

  assert.deepEqual(await data.getFavorites('nobody'), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern="setFavorite|getFavorites|isFavorited" test/tbilisi-events-data.test.js 2>&1 | grep -E "not ok|^# (tests|pass|fail)"`
Expected: FAIL — `data.setFavorite is not a function`.

- [ ] **Step 3: Add the collection accessor**

In `lib/tbilisi-events-data.js`, after:

```js
function viewsCollection() { return _db.collection('tbilisiEventsViews'); }
```

add:

```js
function favoritesCollection() { return _db.collection('tbilisiEventsFavorites'); }
```

- [ ] **Step 4: Add the functions**

Immediately after the `getViewRecords` function (and its closing `}`), before the `// ---------------- submissions & organizer claims ----------------` comment, add:

```js
// ---------------- favorites ----------------
// One doc per (user, entity): id `${userId}_${type}_${entityId}`, so toggle is a
// single set/delete and a check is a single get. getFavorites sorts in JS to
// avoid a composite index.
var FAVORITE_TYPES = ['event', 'venue'];
function favDocId(userId, type, entityId) { return userId + '_' + type + '_' + entityId; }

async function isFavorited(userId, type, entityId) {
  if (!userId || FAVORITE_TYPES.indexOf(type) === -1 || !entityId) return false;
  var snap = await favoritesCollection().doc(favDocId(userId, type, entityId)).get();
  return snap.exists;
}

async function setFavorite(userId, type, entityId, on) {
  if (!userId || FAVORITE_TYPES.indexOf(type) === -1 || !entityId) {
    throw new Error('setFavorite: bad key');
  }
  var ref = favoritesCollection().doc(favDocId(userId, type, entityId));
  if (on) await ref.set({ userId: userId, type: type, entityId: entityId, at: new Date() });
  else await ref.delete();
  return !!on;
}

async function getFavorites(userId) {
  if (!userId) return [];
  var snap = await favoritesCollection().where('userId', '==', userId).get();
  var rows = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  rows.sort(function(a, b) {
    var am = a.at && a.at.toDate ? a.at.toDate().getTime() : +new Date(a.at || 0);
    var bm = b.at && b.at.toDate ? b.at.toDate().getTime() : +new Date(b.at || 0);
    return bm - am; // newest first
  });
  return rows;
}
```

- [ ] **Step 5: Export them**

In `module.exports`, after `getViewRecords: getViewRecords,` add:

```js
  favDocId: favDocId,
  isFavorited: isFavorited,
  setFavorite: setFavorite,
  getFavorites: getFavorites,
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test --test-name-pattern="setFavorite|getFavorites|isFavorited" test/tbilisi-events-data.test.js 2>&1 | grep -E "not ok|^# (tests|pass|fail)"`
Expected: PASS (3 tests).

- [ ] **Step 7: Full data test file**

Run: `node --test test/tbilisi-events-data.test.js 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add lib/tbilisi-events-data.js test/tbilisi-events-data.test.js
git commit -m "feat(tbilisi-events): favorites data layer

tbilisiEventsFavorites collection, deterministic doc id per (user,type,
entity); isFavorited (one get), setFavorite (set/delete), getFavorites
(user-scoped, JS-sorted newest-first).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `POST /favorites/toggle` endpoint

**Files:**
- Modify: `routes/tbilisi-events-account.js` — cache regex (~line 29); new route after the `GET /me` handler (~line 131)

- [ ] **Step 1: Widen the cache-control regex**

Change:

```js
  if (/^\/(login|auth|me|suggest)(\/|$)/.test(req.path)) res.set('Cache-Control', 'private, no-cache');
```

to:

```js
  if (/^\/(login|auth|me|suggest|favorites)(\/|$)/.test(req.path)) res.set('Cache-Control', 'private, no-cache');
```

- [ ] **Step 2: Add the route**

Immediately after the `router.get('/me', …)` handler's closing `});` (~line 131), add:

```js
router.post('/favorites/toggle', express.json(), guardCsrf, users.requireUser, async function(req, res) {
  try {
    var type = String((req.body && req.body.type) || '');
    var entityId = String((req.body && req.body.entityId) || '').trim();
    if (['event', 'venue'].indexOf(type) === -1 || !entityId) {
      return res.status(400).json({ ok: false, error: 'bad_request' });
    }
    var exists = type === 'event'
      ? await eventsData.getEventById(entityId)
      : await eventsData.getVenueById(entityId);
    if (!exists) return res.status(404).json({ ok: false, error: 'not_found' });
    var uid = res.locals.user.uid;
    var now = await eventsData.isFavorited(uid, type, entityId);
    await eventsData.setFavorite(uid, type, entityId, !now);
    res.json({ ok: true, favorited: !now });
  } catch (e) {
    console.error('[te-account] favorites/toggle', e.message);
    res.status(500).json({ ok: false });
  }
});
```

- [ ] **Step 3: Syntax + load check**

Run: `node --check routes/tbilisi-events-account.js && echo OK`
Expected: `OK`

Run: `node -e "require('dotenv').config(); require('./routes/tbilisi-events'); require('./routes/tbilisi-events-account'); console.log('routes OK')" 2>&1 | grep -v punycode | grep -v trace-deprecation`
Expected: `routes OK`

- [ ] **Step 4: Commit**

```bash
git add routes/tbilisi-events-account.js
git commit -m "feat(tbilisi-events): POST /favorites/toggle endpoint

express.json + guardCsrf + requireUser; validates type/entity, toggles
the favorite, returns { ok, favorited }. Guests get 401 JSON.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `_favorite.pug`

**Files:**
- Create: `views/tbilisi-events/_favorite.pug`

- [ ] **Step 1: Create the partial**

Create `views/tbilisi-events/_favorite.pug`:

```pug
//- Favorite toggle for an event or venue detail page. Locals: user, base,
//- loginHref, t. `type` is 'event' | 'venue'.
mixin favButton(type, entityId, isFav)
  if user
    button.fav(type='button' data-fav-type=type data-fav-id=entityId aria-pressed=(isFav ? 'true' : 'false'))
      span.fav-star= isFav ? '★' : '☆'
      span.fav-txt= isFav ? t.favRemove : t.favAdd
  else
    a.fav(href=loginHref)
      span.fav-star ☆
      span.fav-txt= t.favAdd

//- Emit once per page, after any +favButton calls.
mixin favScript()
  script.
    (function () {
      var base = !{JSON.stringify(base)};
      var loginHref = !{JSON.stringify(loginHref)};
      var addTxt = !{JSON.stringify(t.favAdd)}, remTxt = !{JSON.stringify(t.favRemove)};
      var btns = document.querySelectorAll('button.fav[data-fav-type]');
      Array.prototype.forEach.call(btns, function (btn) {
        btn.addEventListener('click', function () {
          btn.disabled = true;
          fetch(base + '/favorites/toggle', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'accept': 'application/json' },
            body: JSON.stringify({
              type: btn.getAttribute('data-fav-type'),
              entityId: btn.getAttribute('data-fav-id')
            })
          }).then(function (r) {
            if (r.status === 401) { location.href = loginHref; return null; }
            return r.json();
          }).then(function (j) {
            if (j && j.ok) {
              var on = !!j.favorited;
              btn.setAttribute('aria-pressed', on ? 'true' : 'false');
              var txt = btn.querySelector('.fav-txt'); if (txt) txt.textContent = on ? remTxt : addTxt;
              var star = btn.querySelector('.fav-star'); if (star) star.textContent = on ? '★' : '☆';
            }
          }).catch(function () {}).then(function () { btn.disabled = false; });
        });
      });
    })();
```

- [ ] **Step 2: Compile it**

Run: `node -e "require('pug').compileFile('views/tbilisi-events/_favorite.pug'); console.log('compiles')"`
Expected: `compiles`

- [ ] **Step 3: Commit**

```bash
git add views/tbilisi-events/_favorite.pug
git commit -m "feat(tbilisi-events): _favorite.pug — favButton + favScript mixins

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: favorite button on event + venue pages

**Files:**
- Modify: `routes/tbilisi-events.js` — `GET /e/:id` and `GET /venues/:id`
- Modify: `views/tbilisi-events/event.pug`, `views/tbilisi-events/venues/detail.pug`

- [ ] **Step 1: `GET /e/:id` — compute `isFavorited`**

In `routes/tbilisi-events.js`, in the `GET /e/:id` handler, after the canonical-slug redirect guard (`if (event.slug && req.params.id !== event.slug) { … }`) and before the render, add:

```js
    var isFav = res.locals.user
      ? await eventsData.isFavorited(res.locals.user.uid, 'event', event.id)
      : false;
```

In the `res.render('tbilisi-events/event', { … })` object, add a line:

```js
      isFavorited: isFav,
```

- [ ] **Step 2: `GET /venues/:id` — compute `isFavorited`**

In the `GET /venues/:id` handler, after its canonical-slug guard (`if (venue.slug && req.params.id !== venue.slug) { … }`) and before the render, add:

```js
    var isFav = res.locals.user
      ? await eventsData.isFavorited(res.locals.user.uid, 'venue', venue.id)
      : false;
```

In the `res.render('tbilisi-events/venues/detail', { … })` object, add:

```js
      isFavorited: isFav,
```

- [ ] **Step 3: `event.pug` — include, button, script, CSS**

Add with the includes (after `include ./_crumbs.pug`):

```pug
include ./_favorite.pug
```

In the `.actions` block, after the `if ev.primaryUrl` / `a.btn.solid(...)` lines, add (14-space indent, sibling of `if ev.primaryUrl`):

```pug
              +favButton('event', ev.id, isFavorited)
```

At the very end of `body`, after the `if isAdmin` / `a.admin-edit(...)` block (4-space indent, last child of `body`):

```pug
    +favScript()
```

In `<style>`, after the `.acct:hover{color:var(--acc)}` line added in Task 3 Step 2, add:

```css
      .fav{display:inline-flex;align-items:center;gap:6px;font:inherit;font-weight:700;font-size:13px;padding:11px 14px;border:1px solid var(--ink);border-radius:2px;background:var(--paper);color:var(--ink);cursor:pointer}
      .fav:hover{background:var(--ink);color:var(--paper)}
      .fav[aria-pressed="true"]{background:var(--acc);border-color:var(--acc);color:#fffdf9}
      .fav[disabled]{opacity:.5}
```

- [ ] **Step 4: `venues/detail.pug` — include, button, script, CSS**

Add with the includes (after `include ../_crumbs.pug`):

```pug
include ../_favorite.pug
```

In the `.actions` block (which contains `a.btn.solid(href=mapHref …)= t.routeMap`), after that line add (12-space indent, sibling of the `a.btn.solid`):

```pug
            +favButton('venue', venue.id, isFavorited)
```

At the end of `body`, after the `if isAdmin` / `a.admin-edit(...)` block (4-space indent):

```pug
    +favScript()
```

In `<style>`, after the `.acct:hover{color:var(--acc)}` line from Task 3 Step 4, add the same four `.fav` rules from Step 3.

- [ ] **Step 5: Syntax + compile**

Run: `node --check routes/tbilisi-events.js && echo OK`
Expected: `OK`

Run: `node -e "var pug=require('pug');['event','venues/detail'].forEach(function(f){pug.compileFile('views/tbilisi-events/'+f+'.pug');console.log('OK '+f)})"`
Expected: `OK event` / `OK venues/detail`

- [ ] **Step 6: Full suite (no regressions)**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add routes/tbilisi-events.js views/tbilisi-events/event.pug views/tbilisi-events/venues/detail.pug
git commit -m "feat(tbilisi-events): favorite button on event and venue pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: favorites section on `/me`

**Files:**
- Modify: `routes/tbilisi-events-account.js` — `GET /me` handler
- Modify: `views/tbilisi-events/me.pug`

- [ ] **Step 1: `/me` — load favorites**

In `routes/tbilisi-events-account.js`, in the `GET /me` handler, after `var tg = await users.ensureTgLinkToken(user.id);` and before `res.render(…)`, add:

```js
    var favRows = await eventsData.getFavorites(user.id);
    var favEvents = (await Promise.all(
      favRows.filter(function (r) { return r.type === 'event'; })
             .map(function (r) { return eventsData.getEventById(r.entityId); })
    )).filter(function (e) { return e && !e.hidden; })
      .map(function (e) { return { title: e.title, href: req.teBase + '/e/' + (e.slug || e.id) }; });
    var favVenues = (await Promise.all(
      favRows.filter(function (r) { return r.type === 'venue'; })
             .map(function (r) { return eventsData.getVenueById(r.entityId); })
    )).filter(Boolean)
      .map(function (v) { return { title: v.name, href: req.teBase + '/venues/' + (v.slug || v.id) }; });
```

In the `res.render('tbilisi-events/me', { … })` object, add:

```js
      favorites: { events: favEvents, venues: favVenues },
```

- [ ] **Step 2: `me.pug` — section + CSS**

In `me.pug` `<style>` (inside the `style.` block), add before the closing (after `form{display:inline}`):

```css
      h2.sec{font-family:var(--disp);text-transform:uppercase;font-size:16px;margin:22px 0 12px}
      .fav-list a{display:block;font-size:14px;padding:4px 0;color:var(--ink);border-bottom:1px solid var(--line)}
      .fav-list a:last-child{border-bottom:none}
      .fav-list a:hover{color:var(--acc)}
      .fav-empty{color:var(--muted);font-size:14px}
```

In the body, after the Telegram `.row` block (the one that starts `.row` / `.k Telegram`) and before the `p(style='margin-top:20px')` footer paragraph, add (6-space indent, sibling of `.row`):

```pug
      h2.sec= t.favTitle
      if favorites.events.length || favorites.venues.length
        if favorites.events.length
          .row
            .k= t.category
            .fav-list
              each f in favorites.events
                a(href=f.href)= f.title
        if favorites.venues.length
          .row
            .k= t.venues
            .fav-list
              each f in favorites.venues
                a(href=f.href)= f.title
      else
        p.fav-empty= t.favEmpty
```

- [ ] **Step 3: Syntax + compile + load**

Run: `node --check routes/tbilisi-events-account.js && echo OK`
Expected: `OK`

Run: `node -e "require('pug').compileFile('views/tbilisi-events/me.pug'); console.log('me.pug compiles')"`
Expected: `me.pug compiles`

- [ ] **Step 4: Commit**

```bash
git add routes/tbilisi-events-account.js views/tbilisi-events/me.pug
git commit -m "feat(tbilisi-events): favorites section on the account page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: robots.txt

**Files:**
- Modify: `routes/tbilisi-events.js` — `GET /robots.txt` handler

- [ ] **Step 1: Add the Disallow line**

In the `res.type('text/plain').send([ … ])` array, after `'Disallow: /organizer/',` add:

```js
    'Disallow: /favorites',
```

- [ ] **Step 2: Verify**

Run: `node --check routes/tbilisi-events.js && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add routes/tbilisi-events.js
git commit -m "feat(tbilisi-events): robots.txt — disallow /favorites

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: final verification

- [ ] **Step 1: Full suite**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail|cancelled|skipped)"`
Expected: all pass (147 = 144 baseline + 3 favorites data tests).

- [ ] **Step 2: Compile every touched template**

Run:

```bash
node -e "var pug=require('pug');['list','event','me','venues/list','venues/detail','collections/list','collections/detail','_account-link','_favorite'].forEach(function(f){try{pug.compileFile('views/tbilisi-events/'+f+'.pug');console.log('OK  '+f)}catch(e){console.log('ERR '+f+': '+e.message.split('\n')[0])}})"
```

Expected: 9 `OK` lines, no `ERR`.

- [ ] **Step 3: Route load**

Run: `node -e "require('dotenv').config(); require('./routes/tbilisi-events'); require('./routes/tbilisi-events-account'); console.log('routes OK')" 2>&1 | grep -E "routes OK|Error"`
Expected: `routes OK`

- [ ] **Step 4: Manual smoke (app on a spare port)**

Start the app as a background process on `PORT=3599` (target its PID to stop it; do not kill node by name). Pick a real event slug and venue slug (from `/` and `/venues` or the admin lists). With `BASE=http://127.0.0.1:3599/tbilisi-events`:

1. `curl -s "$BASE/" -H "Accept: text/html" -H "User-Agent: Mozilla/5.0"` → HTML contains `class="acct"` and the text `Войти` (guest).
2. `curl -s "$BASE/e/<slug>" -H "Accept: text/html" -H "User-Agent: Mozilla/5.0"` → HTML contains `class="fav"` and `href=".../login?next="` (guest button is a link).
3. `curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/favorites/toggle" -H "Content-Type: application/json" -H "Accept: application/json" -H "Origin: http://127.0.0.1:3599" -d '{"type":"event","entityId":"<id>"}'` → `401` (no session cookie).
4. `curl -s "$BASE/robots.txt"` → body contains `Disallow: /favorites`.

If a signed-in session cookie is available (dev build `develop=true`, magic-link, or an existing `teUser` cookie), also verify: authed `POST /favorites/toggle` returns `{"ok":true,"favorited":true}` then `{"ok":true,"favorited":false}`; `GET /me` lists the favorited item.

Stop the background server.

- [ ] **Step 5: Update the spec status**

Append to `docs/superpowers/specs/2026-09-04-tbilisi-events-login-favorites-design.md`:

```markdown

## Status

Phase 1 + Phase 2 implemented 2026-09-04 on branch `te-login-favorites`
(plan: `docs/superpowers/plans/2026-09-04-tbilisi-events-login-favorites.md`).
Georgian i18n strings are best-effort — flag for a native review. Phase 3
(Telegram notifications for favorited venues) not started.
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-09-04-tbilisi-events-login-favorites-design.md
git commit -m "docs(tbilisi-events): mark login + favorites spec implemented

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** Part 1a → Task 2 Step 1; 1b → Task 2 Step 2; 1c → Task 1; 1d → Task 3. Part 2a/2b → Task 4; 2c → Task 5; 2d → Task 6; 2e → Task 7 (event); 2f → Task 7 (venue); 2g → Task 8; 2h → Task 1. Part 3 (robots) → Task 9. Testing section → Tasks 4 (unit) + 10 (compile/load/smoke).
- **Type consistency:** `favDocId` / `isFavorited` / `setFavorite` / `getFavorites` names and signatures match across `lib/tbilisi-events-data.js`, its exports, `routes/tbilisi-events-account.js`, `routes/tbilisi-events.js`, and the tests. The render key is `isFavorited:` in both detail routes and the mixin param is `isFav` (the template passes `isFavorited` → `+favButton('event', ev.id, isFavorited)`), consistent with Task 7 Steps 1–4. Favorite row fields `userId, type, entityId, at` are identical in `setFavorite`, `getFavorites`, and the tests.
- **Placeholder scan:** no TBD/TODO. `<slug>` / `<id>` in Task 10 Step 4 are runtime values the operator substitutes, not plan gaps.
- **Fake-firestore:** `getFavorites` uses a single `where('userId','==',…)` (supported); `setFavorite` uses `doc().set()` / `doc().delete()` (supported; delete on a missing doc is a no-op). No fake changes needed.
- **`event.pug` `.actions` indent:** the file indents `.actions` children at 14 spaces (`if ev.primaryUrl`); `venues/detail.pug` indents `.actions` children at 12. Steps 3–4 of Task 7 state each explicitly.
