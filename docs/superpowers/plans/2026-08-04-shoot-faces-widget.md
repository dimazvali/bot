# "Find Yourself" Faces Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/shoot/:slug`, when a shoot has `showFaces` enabled, show a horizontal strip of recognized faces (named and anonymous) under the gallery header; clicking one filters the photo grid to just that person, shareable via a `?person=` URL param.

**Architecture:** A per-shoot, on-the-fly union-find over each face's `matchedFaceId` (already computed by AWS Rekognition at index time, previously discarded when it didn't resolve to a named person) groups anonymous faces into clusters, alongside existing named-person groups. The public route computes this grouping and hands it to the same Pug template that already renders the gallery; a client-side filter script — copied in spirit from the existing `.type-filter` script already in `views/photo/gallery.pug` — toggles photo-card visibility via a `data-hidden` attribute.

**Tech Stack:** Same stack as the rest of this project — Express, Pug, Firestore (`firebase-admin`), no test framework (verification is `node --check`, `pug.compileFile`, and a manual browser check for the interactive parts).

**Spec:** `docs/superpowers/specs/2026-08-04-shoot-faces-widget-design.md`
**Builds on:** `docs/superpowers/specs/2026-07-31-photo-people-recognition-design.md` and its plan, `docs/superpowers/plans/2026-07-31-photo-people-recognition.md` (already implemented — `lib/photo-people.js`, `lib/photo-shoots.js`, `/admin/people`, etc. all already exist).

---

### Task 1: Store `matchedFaceId` and add `groupShootFaces`

**Files:**
- Modify: `lib/photo-people.js`

- [ ] **Step 1: Record `matchedFaceId` on every indexed face, not just named matches**

Find:
```js
async function indexAndMatchFaces(imageBuffer) {
  var faces = await indexFacesForPhoto(imageBuffer);
  for (var i = 0; i < faces.length; i++) {
    var match = await findMatch(faces[i].faceId);
    if (match) {
      var person = getPersonByFaceId(match.faceId);
      if (person) {
        await linkFaceToPerson(person.id, faces[i].faceId);
        faces[i].personId = person.id;
      }
    }
  }
  return faces;
}
```
Replace with:
```js
async function indexAndMatchFaces(imageBuffer) {
  var faces = await indexFacesForPhoto(imageBuffer);
  for (var i = 0; i < faces.length; i++) {
    var match = await findMatch(faces[i].faceId);
    if (match) {
      faces[i].matchedFaceId = match.faceId;
      var person = getPersonByFaceId(match.faceId);
      if (person) {
        await linkFaceToPerson(person.id, faces[i].faceId);
        faces[i].personId = person.id;
      }
    }
  }
  return faces;
}
```

- [ ] **Step 2: Add `groupShootFaces`, above `module.exports`**

```js
function groupShootFaces(slug, shoot) {
  var namedGroups = {}; // personId -> group
  var unnamed = [];     // [{ photo, face }]

  shoot.photos.forEach(function(photo) {
    (photo.faces || []).forEach(function(face) {
      if (face.personId) {
        if (!namedGroups[face.personId]) {
          var p = _cache[face.personId];
          namedGroups[face.personId] = { key: 'person:' + face.personId, name: p ? p.name : null, faces: [] };
        }
        namedGroups[face.personId].faces.push({ slug: slug, photoId: photo.id, faceId: face.faceId, boundingBox: face.boundingBox, thumb: photo.urls && photo.urls.preview });
      } else {
        unnamed.push({ photo: photo, face: face });
      }
    });
  });

  var parent = {};
  function find(id) {
    if (!(id in parent)) parent[id] = id;
    if (parent[id] !== id) parent[id] = find(parent[id]);
    return parent[id];
  }
  function union(a, b) {
    var ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }
  var unnamedIds = {};
  unnamed.forEach(function(item) { unnamedIds[item.face.faceId] = true; find(item.face.faceId); });
  unnamed.forEach(function(item) {
    var m = item.face.matchedFaceId;
    if (m && unnamedIds[m]) union(item.face.faceId, m);
  });

  var anonGroups = {};
  unnamed.forEach(function(item) {
    var root = find(item.face.faceId);
    if (!anonGroups[root]) anonGroups[root] = { key: 'anon:' + root, name: null, faces: [] };
    anonGroups[root].faces.push({ slug: slug, photoId: item.photo.id, faceId: item.face.faceId, boundingBox: item.face.boundingBox, thumb: item.photo.urls && item.photo.urls.preview });
  });

  return Object.keys(namedGroups).map(function(k) { return namedGroups[k]; })
    .concat(Object.keys(anonGroups).map(function(k) { return anonGroups[k]; }));
}
```

- [ ] **Step 3: Export it**

Find:
```js
module.exports = {
  COLLECTION_ID, MATCH_THRESHOLD, ensureCollection, indexFacesForPhoto, findMatch,
  initFromFirestore, getPeopleData, getPersonByFaceId, createPerson, linkFaceToPerson, renamePerson,
  resolvePhotoPeopleNames, indexAndMatchFaces,
};
```
Replace with:
```js
module.exports = {
  COLLECTION_ID, MATCH_THRESHOLD, ensureCollection, indexFacesForPhoto, findMatch,
  initFromFirestore, getPeopleData, getPersonByFaceId, createPerson, linkFaceToPerson, renamePerson,
  resolvePhotoPeopleNames, indexAndMatchFaces, groupShootFaces,
};
```

- [ ] **Step 4: Syntax-check**

Run: `cd "c:\Users\dshestakov\node\bot" && node --check lib/photo-people.js`
Expected: no output

- [ ] **Step 5: Smoke-test `groupShootFaces` against real data**

Run:
```bash
cd "c:\Users\dshestakov\node\bot" && PHOTO_ENV=prod node -e "
require('dotenv').config();
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var shoots = require('./lib/photo-shoots');
var photoPeople = require('./lib/photo-people');
var photoApp = getApps().find(function(a) { return a.name === 'photo'; }) || initializeApp({
  credential: cert({
    type: 'service_account', project_id: 'dimazvalimisc', private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: process.env.sssGCPKey.replace(/\\\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com', client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth', token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }), storageBucket: process.env.PHOTO_BUCKET,
}, 'photo');
var fb = getFirestore(photoApp);
Promise.all([shoots.initFromFirestore(fb), photoPeople.initFromFirestore(fb)]).then(function() {
  var shoot = shoots.getShoot('9line');
  var groups = photoPeople.groupShootFaces('9line', shoot);
  console.log('groups:', groups.length);
  console.log('named:', groups.filter(function(g) { return g.name; }).map(function(g) { return g.name + ' (' + g.faces.length + ')'; }));
  console.log('anon groups:', groups.filter(function(g) { return !g.name; }).length, 'sizes:', groups.filter(function(g) { return !g.name; }).map(function(g) { return g.faces.length; }));
  process.exit(0);
}).catch(function(e){ console.error(e); process.exit(1); });
"
```
Expected: `groups:` some positive number, a `named:` list (at time of writing, at least one person has been named across the shoots, e.g. "Пономарёв"), and an `anon groups:` count with sizes — since `matchedFaceId` isn't backfilled for existing faces yet (that's Task 2), anonymous faces will mostly show as singleton groups (size 1) at this point. That's expected and fine — this step only verifies the function runs and returns sensibly shaped data, not that clustering has already happened.

- [ ] **Step 6: Commit**

```bash
git add lib/photo-people.js
git commit -m "feat: track matchedFaceId and add per-shoot anonymous face grouping"
```

---

### Task 2: Backfill `matchedFaceId`, always record it in the rematch script

**Files:**
- Modify: `scripts/rematch-pending-faces.js`

- [ ] **Step 1: Always persist `matchedFaceId`, not just when it resolves to a named person**

Find:
```js
    try {
      var match = await photoPeople.findMatch(item.faceId);
      var person = match ? photoPeople.getPersonByFaceId(match.faceId) : null;
      if (person) {
        await photoPeople.linkFaceToPerson(person.id, item.faceId);
        var faces = item.photo.faces.map(function(f) {
          return f.faceId === item.faceId ? Object.assign({}, f, { personId: person.id }) : f;
        });
        await shoots.updatePhotoFaces(item.slug, item.photo.id, faces);
        item.photo.faces = faces; // keep in-memory copy consistent for any later iterations on the same photo
        linked++;
        console.log('[' + (linked + unchanged + errors) + '/' + todos.length + '] ' + item.slug + '/' + item.photo.id + '/' + item.faceId + ' -> ' + person.name);
      } else {
        unchanged++;
      }
    } catch (e) {
```
Replace with:
```js
    try {
      var match = await photoPeople.findMatch(item.faceId);
      var person = match ? photoPeople.getPersonByFaceId(match.faceId) : null;
      if (person) await photoPeople.linkFaceToPerson(person.id, item.faceId);
      if (match) {
        var faces = item.photo.faces.map(function(f) {
          if (f.faceId !== item.faceId) return f;
          var updated = Object.assign({}, f, { matchedFaceId: match.faceId });
          if (person) updated.personId = person.id;
          return updated;
        });
        await shoots.updatePhotoFaces(item.slug, item.photo.id, faces);
        item.photo.faces = faces; // keep in-memory copy consistent for any later iterations on the same photo
      }
      if (person) {
        linked++;
        console.log('[' + (linked + unchanged + errors) + '/' + todos.length + '] ' + item.slug + '/' + item.photo.id + '/' + item.faceId + ' -> ' + person.name);
      } else {
        unchanged++;
      }
    } catch (e) {
```

- [ ] **Step 2: Syntax-check**

Run: `cd "c:\Users\dshestakov\node\bot" && node --check scripts/rematch-pending-faces.js`
Expected: no output

- [ ] **Step 3: Smoke-test on 5 pending faces**

Run: `cd "c:\Users\dshestakov\node\bot" && PHOTO_ENV=prod LIMIT=5 node scripts/rematch-pending-faces.js`
Expected: `Re-checking 5 pending faces at threshold 90...`, ending `Done: N newly linked, M still unmatched, 0 errors.` (whatever N/M split occurs on real data — the point is 0 errors, and the code no longer crashes on the new field).

- [ ] **Step 4: Commit**

```bash
git add scripts/rematch-pending-faces.js
git commit -m "feat: always record matchedFaceId in rematch script for anonymous clustering"
```

- [ ] **Step 5: Run the full backfill (not scoped by LIMIT) so existing pending faces get `matchedFaceId`**

Run: `cd "c:\Users\dshestakov\node\bot" && PHOTO_ENV=prod node scripts/rematch-pending-faces.js`

This will take a while (~1300+ faces remaining at 300ms + AWS latency each — expect low tens of minutes). Run it in the background and report the final `Done: ...` summary line when it completes. This is a one-time data backfill, not something to repeat per-deploy.

---

### Task 3: `showFaces` flag — save it from the admin edit form

**Files:**
- Modify: `routes/photo-admin.js:615-633` (the `/shoots/:slug/edit` POST handler)

- [ ] **Step 1: Read and persist `showFaces`**

Find:
```js
router.post('/shoots/:slug/edit', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { slug } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return res.redirect('/admin/shoots');
  if (!shoots.getShoot(slug)) return res.redirect('/admin/shoots');
  var { label, desc, password, public: isPublic } = req.body;
  if (!label || !label.trim()) return res.redirect('/admin/shoots/' + slug + '/edit');
  try {
    await shoots.saveShoot(slug, {
      label: label.trim(),
      desc: (desc || '').trim(),
      password: (password || '').trim(),
      public: !!isPublic,
    });
    res.redirect('/admin/shoots/' + slug + '/edit');
  } catch (e) {
    console.error('[shoots] save error:', e);
    res.redirect('/admin/shoots/' + slug + '/edit?error=' + encodeURIComponent(e.message));
  }
});
```
Replace with:
```js
router.post('/shoots/:slug/edit', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { slug } = req.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return res.redirect('/admin/shoots');
  if (!shoots.getShoot(slug)) return res.redirect('/admin/shoots');
  var { label, desc, password, public: isPublic, showFaces } = req.body;
  if (!label || !label.trim()) return res.redirect('/admin/shoots/' + slug + '/edit');
  try {
    await shoots.saveShoot(slug, {
      label: label.trim(),
      desc: (desc || '').trim(),
      password: (password || '').trim(),
      public: !!isPublic,
      showFaces: !!showFaces,
    });
    res.redirect('/admin/shoots/' + slug + '/edit');
  } catch (e) {
    console.error('[shoots] save error:', e);
    res.redirect('/admin/shoots/' + slug + '/edit?error=' + encodeURIComponent(e.message));
  }
});
```

`lib/photo-shoots.js`'s `saveShoot(slug, fields)` already passes arbitrary fields straight through to Firestore and the in-memory cache (it only strips `photoOrder`/`key`/`env`) — no change needed there.

- [ ] **Step 2: Syntax-check**

Run: `cd "c:\Users\dshestakov\node\bot" && node --check routes/photo-admin.js`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add routes/photo-admin.js
git commit -m "feat: persist showFaces flag from shoot edit form"
```

---

### Task 4: Admin checkbox

**Files:**
- Modify: `views/photo/admin/shoot-edit.pug:23-25`

- [ ] **Step 1: Add the checkbox next to the existing `public` one**

Find:
```pug
          label.admin-tag-check
            input(type='checkbox' name='public' checked=shoot.public)
            span показывать в /shoot и в сайтмапе
          button.admin-btn(type='submit') СОХРАНИТЬ
```
Replace with:
```pug
          label.admin-tag-check
            input(type='checkbox' name='public' checked=shoot.public)
            span показывать в /shoot и в сайтмапе
          label.admin-tag-check
            input(type='checkbox' name='showFaces' checked=shoot.showFaces)
            span показывать лица (виджет «найти себя»)
          button.admin-btn(type='submit') СОХРАНИТЬ
```

- [ ] **Step 2: Verify the template compiles**

Run:
```bash
cd "c:\Users\dshestakov\node\bot" && node -e "
var pug = require('pug');
pug.compileFile('views/photo/admin/shoot-edit.pug');
console.log('OK');
"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add views/photo/admin/shoot-edit.pug
git commit -m "feat: add showFaces checkbox to shoot admin edit form"
```

---

### Task 5: Compute and pass `peopleGroups` on the public route

**Files:**
- Modify: `routes/photo.js:15` (require block)
- Modify: `routes/photo.js:437-474` (the `/shoot/:slug` route)

- [ ] **Step 1: Require `lib/photo-people`**

Find:
```js
var shoots = require('../lib/photo-shoots');
```
Add immediately after:
```js
var photoPeople = require('../lib/photo-people');
```

This does NOT need its own `initFromFirestore(fb)` call — `lib/photo-people.js`'s module-level cache is already populated at process startup by `routes/photo-admin.js` (both routers run in the same Node process, so `require` returns the same cached module instance with its `_cache`/`_db` already set). This matches the existing pattern: `routes/photo.js` already uses `shoots.getData()`/`shoots.getShoot()` without ever calling `shoots.initFromFirestore()` itself.

- [ ] **Step 2: Compute `peopleGroups` and pass it to the template**

Find:
```js
    res.render('photo/gallery', {
      data: getData(),
      activeCountry: null,
      activeSeries: null,
      isShoot: true,
      shootSlug: slug,
      shootLabel: shoot.label,
      photos: shoot.photos,
      activeTags: [],
      title: shoot.label + ' — photo.dimazvali.com',
      desc: shoot.desc || null,
      keywords: null,
      ogImage: shoot.photos.length ? `${BASE}/og/shoot/${slug}.jpg` : null,
      ogUrl: shoot.public ? `${BASE}/shoot/${slug}` : null,
      noindex: !shoot.public,
      breadcrumbs: [
        { name: 'Съёмки', url: BASE + '/shoot' },
        { name: shoot.label, url: `${BASE}/shoot/${slug}` },
      ],
      otherShoots: getOtherOpenShoots(slug),
    });
```
Replace with:
```js
    res.render('photo/gallery', {
      data: getData(),
      activeCountry: null,
      activeSeries: null,
      isShoot: true,
      shootSlug: slug,
      shootLabel: shoot.label,
      photos: shoot.photos,
      activeTags: [],
      title: shoot.label + ' — photo.dimazvali.com',
      desc: shoot.desc || null,
      keywords: null,
      ogImage: shoot.photos.length ? `${BASE}/og/shoot/${slug}.jpg` : null,
      ogUrl: shoot.public ? `${BASE}/shoot/${slug}` : null,
      noindex: !shoot.public,
      breadcrumbs: [
        { name: 'Съёмки', url: BASE + '/shoot' },
        { name: shoot.label, url: `${BASE}/shoot/${slug}` },
      ],
      otherShoots: getOtherOpenShoots(slug),
      peopleGroups: shoot.showFaces ? photoPeople.groupShootFaces(slug, shoot) : [],
    });
```

- [ ] **Step 3: Syntax-check**

Run: `cd "c:\Users\dshestakov\node\bot" && node --check routes/photo.js`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add routes/photo.js
git commit -m "feat: compute peopleGroups for shoots with showFaces enabled"
```

---

### Task 6: The widget itself — CSS, markup, client-side filter

**Files:**
- Modify: `public/stylesheets/photo/style.css`
- Modify: `views/photo/gallery.pug`

- [ ] **Step 1: Add CSS for the widget**

Append to `public/stylesheets/photo/style.css`:
```css
/* ─── FACES WIDGET ("find yourself") ────────────────────────── */
.faces-widget { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 12px; align-items: flex-start; }
.faces-widget-item { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; cursor: pointer; width: 52px; background: none; border: none; padding: 0; }
.faces-widget-avatar { position: relative; width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: var(--border); border: 1.5px solid var(--border); }
.faces-widget-avatar img { position: absolute; max-width: none; }
.faces-widget-name { font-size: 0.5625rem; font-family: monospace; color: var(--text-muted); letter-spacing: .5px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 52px; }
.faces-widget[data-active] .faces-widget-item { display: none; }
.faces-widget[data-active] .faces-widget-item.is-active { display: flex; }
.faces-widget-reset { display: none; font-size: 0.5625rem; font-family: monospace; color: var(--text-dim); border: none; background: none; border-left: 1px solid var(--border); padding-left: 10px; margin-left: 2px; cursor: pointer; align-self: center; white-space: nowrap; }
.faces-widget[data-active] .faces-widget-reset { display: inline; }
```

(`.photo-card[data-hidden] { display: none; }` already exists in this file from the earlier `.type-filter` feature — the widget's client-side filter script reuses that same attribute/rule, nothing more to add for it.)

- [ ] **Step 2: Add the widget markup**

In `views/photo/gallery.pug`, find:
```pug
  if isShoot
    .shoot-collections#shoot-collections(style='display:none')
      span.gallery-label ВАШИ ПОДБОРКИ
      .shoot-collections-list#shoot-collections-list
```
Add immediately before it:
```pug
  if isShoot && peopleGroups && peopleGroups.length
    .faces-widget#faces-widget
      each g in peopleGroups
        - var rf = g.faces[0]
        - var dw = 100 / rf.boundingBox.Width
        - var dh = 100 / rf.boundingBox.Height
        - var lp = -(rf.boundingBox.Left / rf.boundingBox.Width) * 100
        - var tp = -(rf.boundingBox.Top / rf.boundingBox.Height) * 100
        button.faces-widget-item(type='button' data-person-key=g.key)
          .faces-widget-avatar
            img(src=rf.thumb style=`width:${dw}%;height:${dh}%;left:${lp}%;top:${tp}%;`)
          if g.name
            span.faces-widget-name= g.name
      button.faces-widget-reset(type='button') ✕ ВСЕ ЛИЦА
```

- [ ] **Step 3: Build the faceId → group-key lookup and tag each photo card**

Find:
```pug
  -
    var _types = photos.reduce(function(s,p){ s.add(p.type||'copter'); return s; }, new Set());
    var _showFilter = _types.size > 1;
```
Replace with:
```pug
  -
    var _types = photos.reduce(function(s,p){ s.add(p.type||'copter'); return s; }, new Set());
    var _showFilter = _types.size > 1;
    var _faceKeyByFaceId = {};
    if (isShoot && peopleGroups) {
      peopleGroups.forEach(function(g) {
        g.faces.forEach(function(f) { _faceKeyByFaceId[f.faceId] = g.key; });
      });
    }
```

Find:
```pug
      a.photo-card(
        href=isShoot ? `/shoot/${shootSlug}/${photo.id}` : `/${photo.countryKey}/${photo.seriesKey}/${photo.id}`
        data-type=photo.type||'copter'
        data-photo-id=photo.id
      )
```
Replace with:
```pug
      a.photo-card(
        href=isShoot ? `/shoot/${shootSlug}/${photo.id}` : `/${photo.countryKey}/${photo.seriesKey}/${photo.id}`
        data-type=photo.type||'copter'
        data-photo-id=photo.id
        data-person-keys=(isShoot && photo.faces && photo.faces.length) ? Array.from(new Set(photo.faces.map(function(f) { return _faceKeyByFaceId[f.faceId]; }).filter(Boolean))).join(',') : undefined
      )
```

- [ ] **Step 4: Add the client-side filter script**

Find (the existing type-filter script, near the end of the file):
```pug
  if _showFilter
    script.
      (function() {
        var btns = document.querySelectorAll('.type-filter-btn');
        var cards = document.querySelectorAll('.photo-card[data-type]');
        var active = null;
        btns.forEach(function(btn) {
          btn.addEventListener('click', function() {
            var t = btn.dataset.type;
            if (active === t) {
              active = null;
              btns.forEach(function(b){ b.classList.remove('active'); });
              cards.forEach(function(c){ c.removeAttribute('data-hidden'); });
            } else {
              active = t;
              btns.forEach(function(b){ b.classList.toggle('active', b.dataset.type === t); });
              cards.forEach(function(c){ c.toggleAttribute('data-hidden', c.dataset.type !== t); });
            }
          });
        });
      }());
```
Add immediately after it:
```pug

  if isShoot && peopleGroups && peopleGroups.length
    script.
      (function() {
        var widget = document.getElementById('faces-widget');
        if (!widget) return;
        var items = widget.querySelectorAll('.faces-widget-item');
        var resetBtn = widget.querySelector('.faces-widget-reset');
        var cards = document.querySelectorAll('.photo-card[data-person-keys]');
        var active = null;

        function applyFilter(key) {
          active = key;
          if (key) {
            widget.setAttribute('data-active', '');
            items.forEach(function(el) { el.classList.toggle('is-active', el.dataset.personKey === key); });
          } else {
            widget.removeAttribute('data-active');
            items.forEach(function(el) { el.classList.remove('is-active'); });
          }
          cards.forEach(function(c) {
            var keys = (c.dataset.personKeys || '').split(',');
            c.toggleAttribute('data-hidden', !!key && keys.indexOf(key) === -1);
          });
        }

        items.forEach(function(el) {
          el.addEventListener('click', function() {
            var key = el.dataset.personKey;
            var next = active === key ? null : key;
            applyFilter(next);
            var url = new URL(window.location.href);
            if (next) { url.searchParams.set('person', next); } else { url.searchParams.delete('person'); }
            history.pushState({}, '', url);
          });
        });

        if (resetBtn) {
          resetBtn.addEventListener('click', function() {
            applyFilter(null);
            var url = new URL(window.location.href);
            url.searchParams.delete('person');
            history.pushState({}, '', url);
          });
        }

        var initial = new URLSearchParams(window.location.search).get('person');
        if (initial) applyFilter(initial);
      }());
```

- [ ] **Step 5: Verify the template compiles**

Run:
```bash
cd "c:\Users\dshestakov\node\bot" && node -e "
var pug = require('pug');
pug.compileFile('views/photo/gallery.pug');
console.log('OK');
"
```
Expected: `OK`

- [ ] **Step 6: Manual browser check**

Turn on `showFaces` for a real shoot that has at least one named person and some anonymous faces (e.g. `9line`, via `/admin/shoots/9line/edit`), then visit `/shoot/9line` in a browser:
- The strip of face avatars should appear under the gallery header, each showing a zoomed crop of that person's face (not the whole photo).
- Clicking an avatar should collapse the strip to just that one chip + a "✕ ВСЕ ЛИЦА" reset button, and the photo grid should filter to only photos containing that face.
- The URL should update to `?person=...` without a page reload.
- Reloading the page with that URL present should re-apply the same filter on load.
- Clicking "✕ ВСЕ ЛИЦА" should restore the full strip and the full photo grid, and clear the URL param.

- [ ] **Step 7: Commit**

```bash
git add public/stylesheets/photo/style.css views/photo/gallery.pug
git commit -m "feat: add 'find yourself' faces widget to public shoot gallery"
```

---

## After this plan

Turning on `showFaces` for a shoot is a per-shoot admin decision (checkbox on `/admin/shoots/:slug/edit`) — nothing in this plan enables it automatically for any existing shoot. Anonymous face clusters are computed per-shoot only (per the design's explicit scope decision) — the same anonymous person appearing in two different shoots will show as two unrelated, unlabeled avatars, one per shoot. That's expected, not a bug.
