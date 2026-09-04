# Tbilisi Events — Navbar Login + Favorites — Design Spec

## Goal

Two bundled deliverables (Phase 1 + Phase 2 of a three-phase plan; Phase 3 —
Telegram notifications for favorited venues — is a separate spec later):

1. **Navbar account link** — every public page's header shows, top-right, either
   the signed-in user's name (→ `/me`) or a "Sign in" link (→ `/login` with a
   `?next=` back to the current page).
2. **Favorites** — signed-in users can favorite an **event** or a **venue** from
   its detail page; their favorites are listed on `/me`. Guests see the button
   but it sends them to login.

Plus a one-line `robots.txt` change.

Stays within the current architecture: named Firebase app (`tbilisiEvents`),
`lib/tbilisi-events-*.js` modules, path-mounted + vhost routers, standalone Pug
pages with inline `<style>`, `var`/CommonJS, `node --test`, near-zero client JS
(the favorites toggle is the one small exception, ~20 lines inline).

## Decisions (from brainstorming)

- **Navbar link scope:** all 6 content templates (`list`, `event`,
  `venues/list`, `venues/detail`, `collections/list`, `collections/detail`), via
  a shared `_account-link.pug` mixin. The auth-flow pages (`login`, `me`,
  `check-email`, `magic-confirm`, `suggest*`) keep their minimal headers.
- **Signed-in display:** `user.name`, falling back to `user.email`. Links to `/me`.
- **Favorites — guest:** button is visible; a guest click is a link to
  `/login?next=<page>` (same pattern as the existing "I'm the organizer" CTA).
- **Favorites — storage:** a dedicated `tbilisiEventsFavorites` collection, one
  doc per (user, entity), doc id `userId_type_entityId`. Mirrors the recently
  added `tbilisiEventsViews` / `tbilisiEventsAdminLog` collections.
- **Favorites — toggle UX:** `fetch`/AJAX against a JSON endpoint; the button
  flips its own state without a reload. A `401` sends the browser to login.

Rejected: adding the link only to the home page (inconsistent); duplicating the
snippet inline in 6 headers (no shared source of truth); a `favorites: []` array
on the user doc (array mutation, doc-size ceiling, no per-item timestamp);
POST-form toggle with full reload (clunky for a control users click repeatedly);
localStorage guest favorites synced on login (much more JS than the codebase
otherwise carries).

## Preconditions

Working tree is currently clean and `main` is at `c618e98`, 144 tests passing.
Implementation happens on a branch `te-login-favorites` cut from the commit that
carries this spec. If the tree is dirty when execution starts, commit or stash
first so task commits stay scoped.

---

## Part 1 — Navbar account link

### 1a. `res.locals.loginHref`

In `routes/tbilisi-events.js`, the existing router-level middleware (the one that
sets `req.teBase` and `res.locals.base`, ~line 201) also sets:

```js
res.locals.loginHref = req.teBase + '/login?next=' + encodeURIComponent(req.originalUrl);
```

`req.originalUrl` is already mount-correct: `/tbilisi-events/e/slug?x=1` under the
path mount, `/e/slug?x=1` under the `events.tbiliseli.com` vhost (where
`req.teBase === ''`). `res.locals.user` is set by `teUsers.attachUser`, which
runs immediately after this middleware, so it is populated by render time.

Note: `routes/tbilisi-events.js` `GET /e/:id` already computes its own `loginHref`
local and passes it to the view; that value (login → back to the same event page)
is equivalent, so the account-link mixin behaves the same there. Leave that local
in place.

### 1b. `views/tbilisi-events/_account-link.pug` (new)

```pug
//- Right-aligned account control for the site header. Reads template locals:
//- user (res.locals.user | null), base (res.locals.base), loginHref, t.
mixin accountLink()
  if user
    a.acct(href=base + '/me' title=user.email)= user.name || user.email
  else
    a.acct(href=loginHref)= t.signIn
```

### 1c. i18n

`lib/tbilisi-events-i18n.js` — add `signIn` to each `UI` language block:

| lang | value |
|------|-------|
| ru   | `Войти` |
| en   | `Sign in` |
| ka   | `შესვლა` |

### 1d. The 6 content templates

For each of `list.pug`, `event.pug`, `venues/list.pug`, `venues/detail.pug`,
`collections/list.pug`, `collections/detail.pug`:

1. Add `include _account-link.pug` (or `../_account-link.pug` for the
   `venues/` and `collections/` subdirs) alongside the other `include`s.
2. In `header.hdr`, immediately **after** the `.langs` block, add `+accountLink()`.
3. In the page's inline `<style>`, after the `.langs{...}` rule, add:

```css
.acct{margin-left:12px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--dark-fg);white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis}
.acct:hover{color:var(--acc)}
```

`.acct` sits to the right of `.langs` (which keeps its `margin-left:auto`), so
the order in the header is `brand … [menu] langs acct`. On `list.pug` the
desktop `details.menu` is unaffected.

No route changes needed for the 6 renders — `user`, `base`, `loginHref`, `t` are
all already in scope (`t` is passed by every render; the rest via `res.locals`).

---

## Part 2 — Favorites

### 2a. Data model — collection `tbilisiEventsFavorites`

One document per (user, entity):

```js
// doc id: `${userId}_${type}_${entityId}`
{
  userId: string,
  type: 'event' | 'venue',
  entityId: string,   // event or venue doc id
  at: Timestamp,
}
```

Deterministic doc id makes toggle a single `set` / `delete` and existence a
single `get` — no queries, no index. `getFavorites` does need a `where('userId',
'==', …)` query (supported by the fake and by Firestore without a composite
index since there is no `orderBy` on it — sorting is done in JS).

### 2b. Data layer — `lib/tbilisi-events-data.js`

Collection accessor, near the other `*Collection()` helpers:

```js
function favoritesCollection() { return _db.collection('tbilisiEventsFavorites'); }
```

New section, placed after the view-counter functions (`getViewRecords`), before
`// ---------------- submissions & organizer claims ----------------`:

```js
// ---------------- favorites ----------------
// One doc per (user, entity): id `${userId}_${type}_${entityId}`, so toggle is a
// single set/delete and a check is a single get.
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

Export `favDocId`, `isFavorited`, `setFavorite`, `getFavorites`.

`doc().delete()` on a non-existent doc is a no-op in both the fake and Firestore,
so toggling "off" something already off does not throw.

### 2c. Toggle endpoint — `routes/tbilisi-events-account.js`

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

- `guardCsrf` = `users.sameOrigin` — the `fetch` is same-origin and sends an
  `Origin` header on POST, so it passes; a cross-site POST is rejected 403.
- `users.requireUser` — for a guest, `wantsJson(req)` is true (the fetch sends
  `Accept: application/json`), so it returns `401 {error:'auth_required'}`
  instead of an HTML redirect.
- Also extend the account router's cache-control middleware regex from
  `/^\/(login|auth|me|suggest)(\/|$)/` to
  `/^\/(login|auth|me|suggest|favorites)(\/|$)/` so the per-user JSON is marked
  `private, no-cache`.

### 2d. `views/tbilisi-events/_favorite.pug` (new)

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

### 2e. `event.pug` + `GET /e/:id`

- Route (`routes/tbilisi-events.js`, `GET /e/:id`): after `event` is resolved and
  the canonical-slug guard, compute
  `var isFavorited = res.locals.user ? await eventsData.isFavorited(res.locals.user.uid, 'event', event.id) : false;`
  and pass `isFavorited: isFavorited` to `res.render`.
- `event.pug`: `include ./_favorite.pug`; inside `.actions`, after the `onSite`
  button, `+favButton('event', ev.id, isFavorited)`; near the end of `body`,
  once, `+favScript()`.
- Add to `event.pug` `<style>`:

```css
.fav{display:inline-flex;align-items:center;gap:6px;font:inherit;font-weight:700;font-size:13px;padding:11px 14px;border:1px solid var(--ink);border-radius:2px;background:var(--paper);color:var(--ink);cursor:pointer}
.fav:hover{background:var(--ink);color:var(--paper)}
.fav[aria-pressed="true"]{background:var(--acc);border-color:var(--acc);color:#fffdf9}
.fav[disabled]{opacity:.5}
```

### 2f. `venues/detail.pug` + `GET /venues/:id`

- Route (`routes/tbilisi-events.js`, `GET /venues/:id`): after `venue` resolved +
  canonical guard, compute
  `var isFavorited = res.locals.user ? await eventsData.isFavorited(res.locals.user.uid, 'venue', venue.id) : false;`
  pass `isFavorited: isFavorited`.
- `venues/detail.pug`: `include ../_favorite.pug`; place
  `+favButton('venue', venue.id, isFavorited)` in the venue header/title area
  (near the venue name); `+favScript()` once near the end of `body`.
- Add the same `.fav` CSS block (2e) to `venues/detail.pug` `<style>`.

### 2g. `/me` — favorites section

- Route (`routes/tbilisi-events-account.js`, `GET /me`): after `user` is loaded,

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

  Pass `favorites: { events: favEvents, venues: favVenues }` and `t` (already
  passed) to `res.render('tbilisi-events/me', …)`. Order is newest-first
  (preserved from `getFavorites` through `filter`/`map`).

- `me.pug`: add a section after the Telegram `.row`, before the "Back to the
  listing / Sign out" footer:

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

- Add to `me.pug` `<style>`:

```css
h2.sec{font-family:var(--disp);text-transform:uppercase;font-size:16px;margin:22px 0 12px}
.fav-list a{display:block;font-size:14px;padding:4px 0;color:var(--ink);border-bottom:1px solid var(--line)}
.fav-list a:last-child{border-bottom:none}
.fav-list a:hover{color:var(--acc)}
.fav-empty{color:var(--muted);font-size:14px}
```

### 2h. i18n — favorites strings

`lib/tbilisi-events-i18n.js` — add to each `UI` language block (alongside
`signIn` from Part 1c):

| key | ru | en | ka |
|-----|----|----|----|
| `favAdd` | `В избранное` | `Save` | `შენახვა` |
| `favRemove` | `В избранном` | `Saved` | `შენახულია` |
| `favTitle` | `Избранное` | `Saved` | `რჩეული` |
| `favEmpty` | `Вы пока ничего не добавили в избранное.` | `You haven’t saved anything yet.` | `ჯერ არაფერი გაქვთ შენახული.` |

(Georgian strings are best-effort; flag for a native review post-merge.)

---

## Part 3 — robots.txt

`routes/tbilisi-events.js`, `GET /robots.txt` — add one line to the array:

```
Disallow: /favorites
```

`/me` is already `Disallow: /me` (a prefix rule, so it also covers `/me/…`), so
"account pages" are already excluded; only the new toggle endpoint needs adding.

---

## Testing

### Unit — `test/tbilisi-events-data.test.js` (append)

- `setFavorite` + `isFavorited`: not favorited → `setFavorite(on)` → favorited →
  `setFavorite(off)` → not favorited; toggling off when already off does not throw.
- `setFavorite` rejects an unknown `type`.
- `getFavorites(uid)`: returns only that user's rows, newest-first; a second
  user's favorites are not included; empty for an unknown user.

### Compile check

`node -e` pug compile of the 6 content templates + `me.pug` + the 2 new partials
(`_account-link.pug`, `_favorite.pug`). A mixin-only partial compiles on its own.

### Route load

`node -e "require('dotenv').config(); require('./routes/tbilisi-events'); require('./routes/tbilisi-events-account'); console.log('routes OK')"`

### Manual smoke (app on a spare port, path mount `/tbilisi-events`)

1. `GET /tbilisi-events/` as a guest → header shows "Войти"; the link points at
   `/tbilisi-events/login?next=%2Ftbilisi-events%2F`.
2. `GET /tbilisi-events/e/<slug>` as a guest → favorite button renders as a link
   to login.
3. Sign in (email magic link on a dev build, or reuse an existing session
   cookie), reload `/e/<slug>` → button is a `<button>`, `aria-pressed="false"`,
   text "В избранное".
4. `POST /tbilisi-events/favorites/toggle` with the session cookie + JSON body
   `{ "type":"event", "entityId":"<id>" }` and `Accept: application/json`
   → `{ ok:true, favorited:true }`; again → `{ ok:true, favorited:false }`.
   Without the cookie → `401`.
5. After favoriting an event and a venue, `GET /tbilisi-events/me` → both appear
   under "Избранное" with working links.
6. `GET /tbilisi-events/robots.txt` → body contains `Disallow: /favorites`.

## Out of scope (Phase 3 and beyond)

- `notifyFavVenues` preference checkbox in `/me`, the Telegram notification
  pipeline for new events at favorited venues, and the `notifCopy` key for it.
- Making the existing Telegram deep-link in `/me` more prominent.
- A global "N people saved this" count on entities.
- Favoriting from list/card views, or favoriting collections.
- localStorage favorites for signed-out visitors.
