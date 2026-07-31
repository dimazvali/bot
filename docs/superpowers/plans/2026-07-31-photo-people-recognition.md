# Face Recognition for Shoot Photos (AWS Rekognition) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically recognize recurring named people across `/shoot/:slug` photos using AWS Rekognition, let an admin label them once on a `/admin/people` screen, and feed confirmed names into the AI-generated SEO caption prompt.

**Architecture:** One global AWS Rekognition face collection for the whole site. On shoot-photo upload (and via a backfill script for the 780 existing shoot photos), `IndexFaces` finds faces and `SearchFaces` (99% threshold) checks for a match to an already-named person. Matches auto-link; non-matches wait in an admin review queue. A new Firestore `people` collection maps names to Rekognition `FaceId`s; a new `faces` array field on `shootPhotos` docs maps each photo's detected faces to a `personId`.

**Tech Stack:** `@aws-sdk/client-rekognition` (AWS SDK v3), Firestore (existing `firebase-admin`), Express + Pug (existing admin patterns), no test framework in this repo — verification is `node --check` plus small live smoke tests against real Firestore/AWS, matching how `lib/photo-seo.js` and `scripts/generate-shoot-seo.js` were built and verified earlier in this project.

**Spec:** `docs/superpowers/specs/2026-07-31-photo-people-recognition-design.md`

**Note on two deviations from the spec:**
1. The spec described `setPhotoFaces`/`unlinkFace` as living in `lib/photo-people.js`. This plan instead puts the `shootPhotos.faces` read/write (`updatePhotoFaces`) in `lib/photo-shoots.js`, matching that module's existing ownership of the `shootPhotos` collection and cache (same pattern as `updatePhotoSeo`). `lib/photo-people.js` owns only the `people` collection and AWS Rekognition calls. Functionally identical to the spec; just a cleaner module boundary.
2. The spec's route table lists `POST /admin/people/:personId/link`. This plan uses `POST /admin/people/link` with `personId` as a form field instead, so the "merge into existing person" `<select>` in the pending-face form can post directly without client-side JS rewriting the form action. Same behavior, simpler markup.

---

### Prerequisite (manual, not an agent task — do this before Task 5 can be smoke-tested)

1. In the AWS Console, create an IAM user (or role) with a policy granting: `rekognition:CreateCollection`, `rekognition:DescribeCollection`, `rekognition:IndexFaces`, `rekognition:SearchFaces`, `rekognition:ListFaces`, `rekognition:DeleteFaces`.
2. Generate an access key for that user.
3. Add to `.env` (same file as the other secrets already there):
   ```
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=us-east-1
   ```
   (Any Rekognition-supported region works; `us-east-1` is a safe default if there's no other preference.)

Tasks 1-4 below don't need this (they either don't call AWS or fail gracefully without credentials). Task 5 onward requires it.

---

### Task 1: Add the AWS SDK dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run: `cd "c:\Users\dshestakov\node\bot" && npm install @aws-sdk/client-rekognition --save`
Expected: `package.json` gains a new `"@aws-sdk/client-rekognition": "^3.x.x"` line in `dependencies`, `node_modules/@aws-sdk/client-rekognition` exists.

- [ ] **Step 2: Verify it installed cleanly**

Run: `node -e "require('@aws-sdk/client-rekognition'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @aws-sdk/client-rekognition dependency"
```

---

### Task 2: `lib/photo-people.js` — Rekognition client and face operations

**Files:**
- Create: `lib/photo-people.js`

- [ ] **Step 1: Write the Rekognition client + collection + index/search functions**

```js
var { RekognitionClient, CreateCollectionCommand, IndexFacesCommand, SearchFacesCommand } = require('@aws-sdk/client-rekognition');
var sharp = require('sharp');

var COLLECTION_ID = 'photo-people-' + (process.env.PHOTO_ENV || 'prod');
var MATCH_THRESHOLD = 99;

var _client = null;
var _collectionReady = false;

function getClient() {
  if (!_client) {
    _client = new RekognitionClient({ region: process.env.AWS_REGION });
  }
  return _client;
}

async function ensureCollection() {
  if (_collectionReady) return;
  var client = getClient();
  try {
    await client.send(new CreateCollectionCommand({ CollectionId: COLLECTION_ID }));
  } catch (e) {
    if (e.name !== 'ResourceAlreadyExistsException') throw e;
  }
  _collectionReady = true;
}

async function indexFacesForPhoto(imageBuffer) {
  await ensureCollection();
  // Rekognition only accepts JPEG/PNG; shoot photos are stored as WebP, so
  // convert here rather than pushing this constraint onto every caller.
  var jpegBuffer = await sharp(imageBuffer).jpeg().toBuffer();
  var client = getClient();
  var result = await client.send(new IndexFacesCommand({
    CollectionId: COLLECTION_ID,
    Image: { Bytes: jpegBuffer },
    DetectionAttributes: [],
  }));
  return (result.FaceRecords || []).map(function(r) {
    return { faceId: r.Face.FaceId, boundingBox: r.Face.BoundingBox };
  });
}

async function findMatch(faceId) {
  var client = getClient();
  var result = await client.send(new SearchFacesCommand({
    CollectionId: COLLECTION_ID,
    FaceId: faceId,
    FaceMatchThreshold: MATCH_THRESHOLD,
    MaxFaces: 1,
  }));
  var match = (result.FaceMatches || [])[0];
  if (!match) return null;
  return { faceId: match.Face.FaceId, similarity: match.Similarity };
}

module.exports = { COLLECTION_ID, ensureCollection, indexFacesForPhoto, findMatch };
```

- [ ] **Step 2: Syntax-check**

Run: `cd "c:\Users\dshestakov\node\bot" && node --check lib/photo-people.js`
Expected: no output (success)

- [ ] **Step 3: Smoke-test against one real shoot photo (requires the Prerequisite AWS setup above)**

Run:
```bash
cd "c:\Users\dshestakov\node\bot" && PHOTO_ENV=prod node -e "
require('dotenv').config();
var axios = require('axios');
var pp = require('./lib/photo-people');
axios.get('https://storage.googleapis.com/photo-dimazvalimisc/shoots/9line/img-3818-800.webp', { responseType: 'arraybuffer' })
  .then(function(r) { return pp.indexFacesForPhoto(Buffer.from(r.data)); })
  .then(function(faces) { console.log(JSON.stringify(faces, null, 2)); })
  .catch(function(e) { console.error(e); process.exit(1); });
"
```
(If that exact URL 404s, substitute any real `photo.urls.preview` value from a recent `9line` log line in this session.)

Expected: JSON array with at least one `{ faceId: "...", boundingBox: { Width, Height, Left, Top } }` (this photo has a visible musician's face).

- [ ] **Step 4: Commit**

```bash
git add lib/photo-people.js
git commit -m "feat: add AWS Rekognition client for face indexing"
```

---

### Task 3: `lib/photo-people.js` — Firestore-backed people cache and matching

**Files:**
- Modify: `lib/photo-people.js`

- [ ] **Step 1: Add the people cache, CRUD functions, and the combined index+match helper**

Append to `lib/photo-people.js`, above the `module.exports` line:

```js
function getEnv() { return process.env.PHOTO_ENV || 'prod'; }

var _db = null;
var _cache = null;   // { [personId]: { id, name, faceIds } }
var _faceIndex = null; // { [faceId]: personId }

async function initFromFirestore(db) {
  _db = db;
  var env = getEnv();
  var snap = await db.collection('people').where('env', '==', env).get();
  _cache = {};
  _faceIndex = {};
  snap.docs.forEach(function(doc) {
    var d = doc.data();
    _cache[doc.id] = { id: doc.id, name: d.name, faceIds: d.faceIds || [] };
    (d.faceIds || []).forEach(function(fid) { _faceIndex[fid] = doc.id; });
  });
}

function getPeopleData() { return _cache || {}; }

function getPersonByFaceId(faceId) {
  var personId = (_faceIndex || {})[faceId];
  return personId ? _cache[personId] : null;
}

async function createPerson(name, faceId) {
  var env = getEnv();
  var ref = await _db.collection('people').add({ env: env, name: name, faceIds: [faceId], createdAt: new Date().toISOString() });
  _cache[ref.id] = { id: ref.id, name: name, faceIds: [faceId] };
  _faceIndex[faceId] = ref.id;
  return _cache[ref.id];
}

async function linkFaceToPerson(personId, faceId) {
  var person = _cache[personId];
  if (!person) throw new Error('Person not found: ' + personId);
  if (person.faceIds.indexOf(faceId) === -1) person.faceIds.push(faceId);
  await _db.collection('people').doc(personId).update({ faceIds: person.faceIds });
  _faceIndex[faceId] = personId;
}

async function renamePerson(personId, name) {
  var person = _cache[personId];
  if (!person) throw new Error('Person not found: ' + personId);
  person.name = name;
  await _db.collection('people').doc(personId).update({ name: name });
}

function resolvePhotoPeopleNames(photo) {
  var names = (photo.faces || [])
    .filter(function(f) { return f.personId; })
    .map(function(f) { var p = _cache[f.personId]; return p ? p.name : null; })
    .filter(Boolean);
  return names.filter(function(name, i) { return names.indexOf(name) === i; });
}

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

- [ ] **Step 2: Update `module.exports`**

Replace:
```js
module.exports = { COLLECTION_ID, ensureCollection, indexFacesForPhoto, findMatch };
```
With:
```js
module.exports = {
  COLLECTION_ID, ensureCollection, indexFacesForPhoto, findMatch,
  initFromFirestore, getPeopleData, getPersonByFaceId, createPerson, linkFaceToPerson, renamePerson,
  resolvePhotoPeopleNames, indexAndMatchFaces,
};
```

- [ ] **Step 3: Syntax-check**

Run: `cd "c:\Users\dshestakov\node\bot" && node --check lib/photo-people.js`
Expected: no output

- [ ] **Step 4: Smoke-test the full create → match → resolve cycle**

Run (uses the same Firebase init block pattern already used in `scripts/generate-shoot-seo.js`):
```bash
cd "c:\Users\dshestakov\node\bot" && PHOTO_ENV=prod node -e "
require('dotenv').config();
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var pp = require('./lib/photo-people');
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
pp.initFromFirestore(fb).then(async function() {
  var person = await pp.createPerson('Test Person', 'fake-face-id-123');
  console.log('created:', person);
  console.log('lookup by face:', pp.getPersonByFaceId('fake-face-id-123'));
  console.log('resolve names:', pp.resolvePhotoPeopleNames({ faces: [{ faceId: 'fake-face-id-123', personId: person.id }] }));
  await fb.collection('people').doc(person.id).delete();
  console.log('cleaned up test doc');
  process.exit(0);
}).catch(function(e){ console.error(e); process.exit(1); });
"
```
Expected: `created:` object with the new id, `lookup by face:` the same object, `resolve names: [ 'Test Person' ]`, then `cleaned up test doc`.

- [ ] **Step 5: Commit**

```bash
git add lib/photo-people.js
git commit -m "feat: add people cache and face-to-person matching to photo-people"
```

---

### Task 4: `lib/photo-shoots.js` — persist per-photo face data

**Files:**
- Modify: `lib/photo-shoots.js:146` (insert before `async function addAnnotation`, next to the existing `updatePhotoSeo`)

- [ ] **Step 1: Add `updatePhotoFaces`**

Find this existing function (added earlier in this project for SEO captions):
```js
async function updatePhotoSeo(slug, photoId, seoDesc, seoKeywords) {
  var env = getEnv();
  var safe = { seo_desc: seoDesc || '', seo_keywords: seoKeywords || '' };
  await _db.collection('shootPhotos').doc(env + '_' + slug + '_' + photoId).update(safe);
  if (_cache && _cache[slug]) {
    var photo = _cache[slug].photos.find(function(p) { return p.id === photoId; });
    if (photo) Object.assign(photo, safe);
  }
}
```
Add immediately after it:
```js
async function updatePhotoFaces(slug, photoId, faces) {
  var env = getEnv();
  await _db.collection('shootPhotos').doc(env + '_' + slug + '_' + photoId).update({ faces: faces });
  if (_cache && _cache[slug]) {
    var photo = _cache[slug].photos.find(function(p) { return p.id === photoId; });
    if (photo) photo.faces = faces;
  }
}
```

- [ ] **Step 2: Export it**

In the `module.exports` line at the bottom of the file, change:
```js
module.exports = { initFromFirestore, getData, getShoot, createShoot, saveShoot, addPhoto, updatePhoto, updatePhotoSeo, removePhoto, reorderPhotos, addAnnotation, moveAnnotation, removeAnnotation, deleteShoot, addCollection, getCollections };
```
To:
```js
module.exports = { initFromFirestore, getData, getShoot, createShoot, saveShoot, addPhoto, updatePhoto, updatePhotoSeo, updatePhotoFaces, removePhoto, reorderPhotos, addAnnotation, moveAnnotation, removeAnnotation, deleteShoot, addCollection, getCollections };
```

- [ ] **Step 3: Syntax-check**

Run: `cd "c:\Users\dshestakov\node\bot" && node --check lib/photo-shoots.js`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add lib/photo-shoots.js
git commit -m "feat: add updatePhotoFaces to photo-shoots"
```

---

### Task 5: Wire face indexing into the upload flow

**Files:**
- Modify: `routes/photo-admin.js:15` (require block)
- Modify: `routes/photo-admin.js:52` (init block)
- Modify: `routes/photo-admin.js` — the `/shoots/:slug/upload` fire-and-forget block

- [ ] **Step 1: Require the new module**

Find:
```js
var shoots = require('../lib/photo-shoots');
```
Add immediately after:
```js
var photoPeople = require('../lib/photo-people');
```

- [ ] **Step 2: Initialize its Firestore cache at startup**

Find:
```js
shoots.initFromFirestore(fb).catch(console.error);
```
Add immediately after:
```js
photoPeople.initFromFirestore(fb).catch(console.error);
```

- [ ] **Step 3: Replace the upload fire-and-forget block to index faces before generating the caption**

Find (this is the block added earlier in this project):
```js
    // Auto-generate SEO desc+keywords async (fire-and-forget)
    (function() {
      var { generatePhotoSeo } = require('../lib/photo-seo');
      var previousCaptions = shoot.photos
        .filter(function(p) { return p.seo_desc; })
        .slice(-6)
        .map(function(p) { return p.seo_desc; });
      generatePhotoSeo(photoEntry, {
        countryLabel: shoot.label,
        seriesLabel: shoot.label,
        allTags: {},
        shootDesc: shoot.desc,
        previousCaptions: previousCaptions,
      }).then(function(result) {
        return shoots.updatePhotoSeo(slug, photoEntry.id, result.desc, result.keywords);
      }).catch(function(e) { console.error('[auto-seo]', e.message); });
    }());
```
Replace with:
```js
    // Index faces, then auto-generate SEO desc+keywords (fire-and-forget, faces first so names are known)
    (async function() {
      try {
        var faces = await photoPeople.indexAndMatchFaces(buf800);
        await shoots.updatePhotoFaces(slug, photoEntry.id, faces);
        var knownPeople = photoPeople.resolvePhotoPeopleNames({ faces: faces });

        var { generatePhotoSeo } = require('../lib/photo-seo');
        var previousCaptions = shoot.photos
          .filter(function(p) { return p.seo_desc; })
          .slice(-6)
          .map(function(p) { return p.seo_desc; });
        var result = await generatePhotoSeo(photoEntry, {
          countryLabel: shoot.label,
          seriesLabel: shoot.label,
          allTags: {},
          shootDesc: shoot.desc,
          previousCaptions: previousCaptions,
          knownPeople: knownPeople,
        });
        await shoots.updatePhotoSeo(slug, photoEntry.id, result.desc, result.keywords);
      } catch (e) {
        console.error('[auto-faces+seo]', e.message);
      }
    }());
```

- [ ] **Step 4: Syntax-check**

Run: `cd "c:\Users\dshestakov\node\bot" && node --check routes/photo-admin.js`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add routes/photo-admin.js
git commit -m "feat: index shoot-photo faces on upload before generating caption"
```

---

### Task 6: Feed recognized names into the caption prompt

**Files:**
- Modify: `lib/photo-seo.js`

- [ ] **Step 1: Accept `knownPeople` and add it to the prompt**

Find:
```js
async function generatePhotoSeo(photo, { countryLabel, seriesLabel, allTags, shootDesc, previousCaptions }) {
```
Replace with:
```js
async function generatePhotoSeo(photo, { countryLabel, seriesLabel, allTags, shootDesc, previousCaptions, knownPeople }) {
```

Find:
```js
  var eventContext = shootDesc
    ? 'Контекст события: ' + shootDesc + '. Место/название события можно иногда упомянуть, если это уместно к конкретному кадру — но не в каждой подписи подряд, иначе получится шаблонно.\n\n'
    : '';
```
Add immediately after it:
```js
  var peopleContext = (knownPeople && knownPeople.length)
    ? 'На фото уверенно распознан(ы): ' + knownPeople.join(', ') + '. Обязательно назови его/их по имени в подписи, если он/они видны в кадре.\n\n'
    : '';
```

Find:
```js
      + eventContext
      + sequenceContext
```
Replace with:
```js
      + eventContext
      + peopleContext
      + sequenceContext
```

- [ ] **Step 2: Syntax-check**

Run: `cd "c:\Users\dshestakov\node\bot" && node --check lib/photo-seo.js`
Expected: no output

- [ ] **Step 3: Smoke-test that a supplied name actually appears in the caption**

Run:
```bash
cd "c:\Users\dshestakov\node\bot" && PHOTO_ENV=prod node -e "
require('dotenv').config();
var { generatePhotoSeo } = require('./lib/photo-seo');
generatePhotoSeo(
  { title: 'test', urls: { preview: 'https://storage.googleapis.com/photo-dimazvalimisc/shoots/9line/img-3818-800.webp' }, type: 'camera' },
  { countryLabel: '9line', seriesLabel: '9line', allTags: {}, knownPeople: ['Тест Тестов'] }
).then(function(r) { console.log(r); }).catch(function(e) { console.error(e); process.exit(1); });
"
```
(Substitute a real `preview` URL from this session's logs if that exact one 404s.)
Expected: `desc` field contains the literal string `Тест Тестов`.

- [ ] **Step 4: Commit**

```bash
git add lib/photo-seo.js
git commit -m "feat: mention recognized people by name in generated captions"
```

---

### Task 7: Pass `knownPeople` from the manual regenerate button too

**Files:**
- Modify: `routes/photo-admin.js` — the `/shoots/:slug/photos/:id/generate-seo` route

- [ ] **Step 1: Resolve and pass known people**

Find:
```js
  try {
    var { generatePhotoSeo } = require('../lib/photo-seo');
    var idx = shoot.photos.findIndex(function(p) { return p.id === id; });
    var previousCaptions = shoot.photos
      .slice(0, idx)
      .filter(function(p) { return p.seo_desc; })
      .slice(-6)
      .map(function(p) { return p.seo_desc; });
    var result = await generatePhotoSeo(photo, {
      countryLabel: shoot.label,
      seriesLabel: shoot.label,
      allTags: {},
      shootDesc: shoot.desc,
      previousCaptions: previousCaptions,
    });
```
Replace with:
```js
  try {
    var { generatePhotoSeo } = require('../lib/photo-seo');
    var idx = shoot.photos.findIndex(function(p) { return p.id === id; });
    var previousCaptions = shoot.photos
      .slice(0, idx)
      .filter(function(p) { return p.seo_desc; })
      .slice(-6)
      .map(function(p) { return p.seo_desc; });
    var result = await generatePhotoSeo(photo, {
      countryLabel: shoot.label,
      seriesLabel: shoot.label,
      allTags: {},
      shootDesc: shoot.desc,
      previousCaptions: previousCaptions,
      knownPeople: photoPeople.resolvePhotoPeopleNames(photo),
    });
```

- [ ] **Step 2: Syntax-check**

Run: `cd "c:\Users\dshestakov\node\bot" && node --check routes/photo-admin.js`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add routes/photo-admin.js
git commit -m "feat: pass known people to the manual caption regenerate button"
```

---

### Task 8: Admin routes for `/admin/people`

**Files:**
- Modify: `routes/photo-admin.js` — add near the other `/shoots/*` routes (after the `generate-seo` route from Task 7)

- [ ] **Step 1: Add the four routes**

```js
router.get('/people', requireAuth, function(req, res) {
  var shootsData = shoots.getData();
  var pending = [];
  var facesByFaceId = {};
  Object.keys(shootsData).forEach(function(slug) {
    shootsData[slug].photos.forEach(function(photo) {
      (photo.faces || []).forEach(function(face) {
        var entry = { slug: slug, photoId: photo.id, thumb: photo.urls && photo.urls.thumb, boundingBox: face.boundingBox, faceId: face.faceId };
        facesByFaceId[face.faceId] = entry;
        if (!face.personId) pending.push(entry);
      });
    });
  });
  var people = Object.values(photoPeople.getPeopleData()).map(function(p) {
    return Object.assign({}, p, {
      faces: p.faceIds.map(function(fid) { return facesByFaceId[fid]; }).filter(Boolean),
    });
  });
  res.render('photo/admin/people', { title: 'Люди — AERO Admin', pending: pending, people: people });
});

router.post('/people/new', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { slug, photoId, faceId, name } = req.body;
  if (!slug || !photoId || !faceId || !name || !name.trim()) return res.redirect('/admin/people');
  var shoot = shoots.getShoot(slug);
  var photo = shoot && shoot.photos.find(function(p) { return p.id === photoId; });
  if (!photo) return res.redirect('/admin/people');
  var person = await photoPeople.createPerson(name.trim(), faceId);
  var faces = photo.faces.map(function(f) { return f.faceId === faceId ? Object.assign({}, f, { personId: person.id }) : f; });
  await shoots.updatePhotoFaces(slug, photoId, faces);
  res.redirect('/admin/people');
});

router.post('/people/link', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { personId, slug, photoId, faceId } = req.body;
  if (!personId || !slug || !photoId || !faceId) return res.redirect('/admin/people');
  var shoot = shoots.getShoot(slug);
  var photo = shoot && shoot.photos.find(function(p) { return p.id === photoId; });
  if (!photo) return res.redirect('/admin/people');
  await photoPeople.linkFaceToPerson(personId, faceId);
  var faces = photo.faces.map(function(f) { return f.faceId === faceId ? Object.assign({}, f, { personId: personId }) : f; });
  await shoots.updatePhotoFaces(slug, photoId, faces);
  res.redirect('/admin/people');
});

router.post('/people/:personId/rename', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
  var { personId } = req.params;
  var name = (req.body.name || '').trim();
  if (!name) return res.redirect('/admin/people');
  await photoPeople.renamePerson(personId, name);
  res.redirect('/admin/people');
});

router.post('/shoots/:slug/photos/:id/faces/:faceId/unlink', requireAuth, async (req, res) => {
  var { slug, id, faceId } = req.params;
  var shoot = shoots.getShoot(slug);
  var photo = shoot && shoot.photos.find(function(p) { return p.id === id; });
  if (!photo) return res.redirect('/admin/people');
  var faces = (photo.faces || []).map(function(f) { return f.faceId === faceId ? Object.assign({}, f, { personId: null }) : f; });
  await shoots.updatePhotoFaces(slug, id, faces);
  res.redirect('/admin/people');
});
```

- [ ] **Step 2: Syntax-check**

Run: `cd "c:\Users\dshestakov\node\bot" && node --check routes/photo-admin.js`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add routes/photo-admin.js
git commit -m "feat: add /admin/people routes for naming and merging recognized faces"
```

---

### Task 9: `/admin/people` view

**Files:**
- Create: `views/photo/admin/people.pug`
- Modify: `views/photo/admin/index.pug` (nav link)
- Modify: `public/stylesheets/photo/style.css` (face-crop styles)

- [ ] **Step 1: Add the nav link**

In `views/photo/admin/index.pug`, find:
```pug
          a.admin-nav-link(href='/admin/shoots') съёмки
```
Add immediately after:
```pug
          a.admin-nav-link(href='/admin/people') люди
```

- [ ] **Step 2: Add CSS for the face-crop thumbnail and layout**

Append to `public/stylesheets/photo/style.css`:
```css
.face-crop { position: relative; width: 80px; height: 80px; overflow: hidden; background: var(--border); flex-shrink: 0; }
.face-crop img { position: absolute; max-width: none; }
.people-grid { display: flex; flex-wrap: wrap; gap: 16px; }
.person-pending { display: flex; flex-direction: column; gap: 6px; align-items: center; width: 100px; }
.person-named { display: flex; align-items: flex-start; gap: 12px; padding: 10px; border: 1px solid var(--border); margin-bottom: 8px; }
.person-named-info { display: flex; flex-direction: column; gap: 6px; }
```

- [ ] **Step 3: Write the view**

The face-crop uses pure CSS percentage math on Rekognition's fractional `boundingBox` (`Width`/`Height`/`Left`/`Top`, each 0-1) — no server-side image cropping needed. Displayed width = `100% / bw`, left offset = `-(bl/bw) * 100%`, and symmetrically for height/top.

```pug
doctype html
html(data-theme='dark')
  head
    title= title
    meta(name='viewport' content='width=device-width, initial-scale=1.0')
    link(rel='stylesheet' href='/stylesheets/photo/style.css')
  body
    .admin-wrap
      .admin-header
        a.admin-back(href='/admin') ← назад
        span.admin-logo ЛЮДИ

      .admin-section
        h2.admin-title НЕРАЗМЕЧЕННЫЕ ЛИЦА (#{pending.length})
        if !pending.length
          p.admin-hint Нет неразмеченных лиц.
        else
          .people-grid
            each face in pending
              - var dispW = 100 / face.boundingBox.Width
              - var dispH = 100 / face.boundingBox.Height
              - var leftPct = -(face.boundingBox.Left / face.boundingBox.Width) * 100
              - var topPct = -(face.boundingBox.Top / face.boundingBox.Height) * 100
              .person-pending
                .face-crop
                  img(src=face.thumb style=`width:${dispW}%;height:${dispH}%;left:${leftPct}%;top:${topPct}%;`)
                form.admin-form(method='POST' action='/admin/people/new' style='width:100%;gap:4px;')
                  input(type='hidden' name='slug' value=face.slug)
                  input(type='hidden' name='photoId' value=face.photoId)
                  input(type='hidden' name='faceId' value=face.faceId)
                  input.admin-input(type='text' name='name' placeholder='имя' style='font-size:0.625rem;padding:4px;')
                  button.admin-btn.admin-btn--sm(type='submit') создать
                if people.length
                  form.admin-form(method='POST' action='/admin/people/link' style='width:100%;gap:4px;')
                    input(type='hidden' name='slug' value=face.slug)
                    input(type='hidden' name='photoId' value=face.photoId)
                    input(type='hidden' name='faceId' value=face.faceId)
                    select.admin-input(name='personId' style='font-size:0.625rem;padding:4px;')
                      option(value='' disabled selected) это уже...
                      each person in people
                        option(value=person.id)= person.name
                    button.admin-btn.admin-btn--sm(type='submit') привязать

      .admin-section
        h2.admin-title ЛЮДИ (#{people.length})
        if !people.length
          p.admin-hint Пока никто не назван.
        else
          each person in people
            .person-named
              .face-crop(style='width:56px;height:56px;')
                if person.faces.length
                  - var pf = person.faces[0]
                  - var dispW = 100 / pf.boundingBox.Width
                  - var dispH = 100 / pf.boundingBox.Height
                  - var leftPct = -(pf.boundingBox.Left / pf.boundingBox.Width) * 100
                  - var topPct = -(pf.boundingBox.Top / pf.boundingBox.Height) * 100
                  img(src=pf.thumb style=`width:${dispW}%;height:${dispH}%;left:${leftPct}%;top:${topPct}%;`)
              .person-named-info
                form(method='POST' action=`/admin/people/${person.id}/rename` style='display:flex;gap:6px;')
                  input.admin-input(type='text' name='name' value=person.name style='font-size:0.75rem;padding:4px;width:160px;')
                  button.admin-btn.admin-btn--sm(type='submit') переименовать
                span.admin-photo-id= person.faces.length + ' фото'
                .people-grid
                  each f in person.faces
                    .face-crop(style='width:48px;height:48px;')
                      - var dw = 100 / f.boundingBox.Width
                      - var dh = 100 / f.boundingBox.Height
                      - var lp = -(f.boundingBox.Left / f.boundingBox.Width) * 100
                      - var tp = -(f.boundingBox.Top / f.boundingBox.Height) * 100
                      img(src=f.thumb style=`width:${dw}%;height:${dh}%;left:${lp}%;top:${tp}%;`)
                      form(method='POST' action=`/admin/shoots/${f.slug}/photos/${f.photoId}/faces/${f.faceId}/unlink` style='position:absolute;top:0;right:0;margin:0;')
                        button.admin-btn.admin-btn--danger(type='submit' style='padding:0 4px;font-size:0.5625rem;' title='это не он') ✕
```

- [ ] **Step 4: Verify the template compiles**

Run:
```bash
cd "c:\Users\dshestakov\node\bot" && node -e "
var pug = require('pug');
pug.compileFile('views/photo/admin/people.pug');
pug.compileFile('views/photo/admin/index.pug');
console.log('OK');
"
```
Expected: `OK`

- [ ] **Step 5: Manual visual check**

Start the app (`npm start` or however it's normally run locally), log into `/admin`, visit `/admin/people`. With no faces indexed yet it should show "Нет неразмеченных лиц." / "Пока никто не назван." without errors. Re-check after Task 10's smoke test has indexed a few real photos — face crops should visibly frame a face, not the whole photo.

- [ ] **Step 6: Commit**

```bash
git add views/photo/admin/people.pug views/photo/admin/index.pug public/stylesheets/photo/style.css
git commit -m "feat: add /admin/people screen for naming recognized faces"
```

---

### Task 10: Backfill script for existing shoot photos

**Files:**
- Create: `scripts/index-shoot-faces.js`

- [ ] **Step 1: Write the script**

```js
'use strict';
// Indexes faces for previously uploaded shoot photos that don't have them yet.
// Run: PHOTO_ENV=prod node scripts/index-shoot-faces.js
// Optional: LIMIT=5 to cap how many photos to process, PUBLIC_ONLY=1 to scope to public shoots.
require('dotenv').config();

var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var axios = require('axios');
var shoots = require('../lib/photo-shoots');
var photoPeople = require('../lib/photo-people');

var photoApp = getApps().find(function(a) { return a.name === 'photo'; }) || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: process.env.sssGCPKey.replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
    client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }),
  storageBucket: process.env.PHOTO_BUCKET,
}, 'photo');

var fb = getFirestore(photoApp);

async function run() {
  await shoots.initFromFirestore(fb);
  await photoPeople.initFromFirestore(fb);
  var data = shoots.getData();

  var publicOnly = process.env.PUBLIC_ONLY === '1';
  var todos = [];
  Object.keys(data).forEach(function(slug) {
    var shoot = data[slug];
    if (publicOnly && !shoot.public) return;
    shoot.photos.forEach(function(photo) {
      if (photo.urls && !photo.faces) todos.push({ slug: slug, photo: photo });
    });
  });

  var limit = parseInt(process.env.LIMIT, 10);
  if (!isNaN(limit)) todos = todos.slice(0, limit);

  console.log('Indexing faces for ' + todos.length + ' shoot photos...');
  var done = 0, errors = 0;

  for (var i = 0; i < todos.length; i++) {
    var item = todos[i];
    try {
      var response = await axios.get(item.photo.urls.preview, { responseType: 'arraybuffer', timeout: 20000 });
      var buf = Buffer.from(response.data);
      var faces = await photoPeople.indexAndMatchFaces(buf);
      await shoots.updatePhotoFaces(item.slug, item.photo.id, faces);
      done++;
      var names = photoPeople.resolvePhotoPeopleNames({ faces: faces });
      console.log('[' + (done + errors) + '/' + todos.length + '] ' + item.slug + '/' + item.photo.id + ': ' + faces.length + ' faces' + (names.length ? ' (' + names.join(', ') + ')' : ''));
    } catch (e) {
      errors++;
      console.error('[' + (done + errors) + '/' + todos.length + '] ERROR ' + item.slug + '/' + item.photo.id + ': ' + e.message);
    }
    await new Promise(function(r) { setTimeout(r, 300); });
  }

  console.log('Done: ' + done + ', errors: ' + errors);
}

run().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Syntax-check**

Run: `cd "c:\Users\dshestakov\node\bot" && node --check scripts/index-shoot-faces.js`
Expected: no output

- [ ] **Step 3: Smoke-test on 3 real photos**

Run: `cd "c:\Users\dshestakov\node\bot" && PHOTO_ENV=prod LIMIT=3 node scripts/index-shoot-faces.js`
Expected: `Indexing faces for 3 shoot photos...`, three `[n/3] slug/photoId: N faces` lines with no `ERROR`, ending `Done: 3, errors: 0`.

- [ ] **Step 4: Commit**

```bash
git add scripts/index-shoot-faces.js
git commit -m "feat: add backfill script to index faces for existing shoot photos"
```

---

## After this plan

Running the full backfill (`PHOTO_ENV=prod node scripts/index-shoot-faces.js`, no `LIMIT`) is a manual follow-up, not part of this plan — same as how `generate-shoot-seo.js` was built first and run separately. After a first backfill pass, visit `/admin/people`, name a few recurring people (e.g. Аксёнов, Пономарёв), then re-run `scripts/generate-shoot-seo.js` after clearing `seo_desc` on the affected photos so their captions pick up the names (per the spec's "Что не входит в скоуп").
