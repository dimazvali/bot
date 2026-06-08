# Color Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow visitors to browse all photos filtered by dominant color family via `/color/:family` routes, with color swatches in the sidebar.

**Architecture:** A shared `lib/color-utils.js` module extracts color families using `sharp().stats().dominant` → RGB→HSL→bucket. The color family is stored as `colorFamily` on each photo object (in Firestore + local JSON). A new Express route `/color/:family` filters all photos and renders a dedicated template. A one-time migration script backfills existing photos.

**Tech Stack:** Node.js, Express, sharp (already installed), Pug templates, Firebase Firestore (via existing `saveData`)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `lib/color-utils.js` | Create | RGB→HSL, HSL→family, `extractColorFamily(buffer)` |
| `routes/photo.js` | Modify | `res.locals` middleware, `/color/:family` route, sitemap |
| `views/photo/color-gallery.pug` | Create | Gallery page for a color family |
| `views/photo/layout.pug` | Modify | Color circles in sidebar + mobile strip |
| `public/stylesheets/photo/style.css` | Modify | `.color-dot`, `.sidebar-colors`, `.mobile-colors` |
| `routes/photo-admin.js` | Modify | Extract `colorFamily` at upload + photo-replace |
| `scripts/extract-colors.js` | Create | One-time migration: backfill existing photos |

---

## Task 1: Color utility module

**Files:**
- Create: `lib/color-utils.js`

- [ ] **Step 1: Create the module**

```js
// lib/color-utils.js
'use strict';
var sharp = require('sharp');

var COLOR_FAMILIES = {
  red:    { hex: '#c0392b', label: 'КРАСНЫЙ' },
  orange: { hex: '#e67e22', label: 'ОРАНЖЕВЫЙ' },
  yellow: { hex: '#f1c40f', label: 'ЖЁЛТЫЙ' },
  green:  { hex: '#27ae60', label: 'ЗЕЛЁНЫЙ' },
  teal:   { hex: '#1abc9c', label: 'БИРЮЗОВЫЙ' },
  blue:   { hex: '#2980b9', label: 'СИНИЙ' },
  purple: { hex: '#8e44ad', label: 'ФИОЛЕТОВЫЙ' },
  mono:   { hex: '#888888', label: 'МОНОХРОМ' },
};

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  var d = max - min;
  var s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  var h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToFamily(h, s) {
  if (s < 15) return 'mono';
  if (h >= 345 || h < 15) return 'red';
  if (h < 45) return 'orange';
  if (h < 75) return 'yellow';
  if (h < 165) return 'green';
  if (h < 210) return 'teal';
  if (h < 270) return 'blue';
  return 'purple';
}

async function extractColorFamily(buffer) {
  var stats = await sharp(buffer).stats();
  var { r, g, b } = stats.dominant;
  var { h, s } = rgbToHsl(r, g, b);
  return hslToFamily(h, s);
}

module.exports = { COLOR_FAMILIES, rgbToHsl, hslToFamily, extractColorFamily };
```

- [ ] **Step 2: Verify mapping logic**

Run in the project root:

```bash
node -e "
var { hslToFamily, rgbToHsl } = require('./lib/color-utils');
console.log(hslToFamily(215, 60));  // blue
console.log(hslToFamily(120, 70));  // green
console.log(hslToFamily(350, 80));  // red
console.log(hslToFamily(30, 5));    // mono
console.log(hslToFamily(20, 80));   // orange
"
```

Expected output:
```
blue
green
red
mono
orange
```

- [ ] **Step 3: Verify extractColorFamily with a synthetic buffer**

```bash
node -e "
var sharp = require('sharp');
var { extractColorFamily } = require('./lib/color-utils');
(async () => {
  var buf = await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 30, g: 100, b: 200 } } }).webp().toBuffer();
  console.log(await extractColorFamily(buf)); // blue
  var buf2 = await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 50, g: 160, b: 80 } } }).webp().toBuffer();
  console.log(await extractColorFamily(buf2)); // green
})();
"
```

Expected:
```
blue
green
```

- [ ] **Step 4: Commit**

```bash
git add lib/color-utils.js
git commit -m "feat(photo): add color-utils module with RGB→family extraction"
```

---

## Task 2: Route — middleware, `/color/:family`, sitemap

**Files:**
- Modify: `routes/photo.js`

- [ ] **Step 1: Add require and res.locals middleware**

At the top of `routes/photo.js`, after the existing requires, add:
```js
var { COLOR_FAMILIES } = require('../lib/color-utils');
```

After the line `router.use('/admin', require('./photo-admin'));`, add:
```js
router.use(function(req, res, next) {
  res.locals.colorFamilies = COLOR_FAMILIES;
  res.locals.activeColorFamily = null;
  next();
});
```

- [ ] **Step 2: Add the `/color/:family` route**

Add this route after the `/tag/:slug` route (around line 88) and before `/sitemap.xml`:

```js
// GET /color/:family — gallery filtered by color
router.get('/color/:family', function(req, res) {
  var { family } = req.params;
  if (!COLOR_FAMILIES[family]) return res.status(404).render('error', { message: 'Not found', error: {} });
  var photos = getAllPhotos().filter(function(p) { return p.colorFamily === family; });
  var info = COLOR_FAMILIES[family];
  res.render('photo/color-gallery', {
    data: getData(),
    activeCountry: null,
    activeSeries: null,
    activeColorFamily: family,
    colorLabel: info.label,
    colorHex: info.hex,
    photos,
    title: info.label + ' — photo.dimazvali.com',
    desc: info.label + ' — аэрофотосъёмка Дмитрия Шестакова',
    ogImage: ogImg(photos[0]),
    ogUrl: BASE + '/color/' + family,
    breadcrumbs: [{ name: info.label, url: BASE + '/color/' + family }],
  });
});
```

- [ ] **Step 3: Add color pages to sitemap**

In the `router.get('/sitemap.xml', ...)` handler, after the tags loop, add:

```js
for (var family of Object.keys(COLOR_FAMILIES)) {
  urls.push(base + '/color/' + family);
}
```

- [ ] **Step 4: Commit**

```bash
git add routes/photo.js
git commit -m "feat(photo): add /color/:family route and sitemap entries"
```

---

## Task 3: Color gallery template

**Files:**
- Create: `views/photo/color-gallery.pug`

- [ ] **Step 1: Create the template**

```pug
extends layout

block content
  .gallery-header
    span.gallery-label #{colorLabel} · #{photos.length} фото
  .masonry
    each photo in photos
      a.photo-card(href=`/${photo.countryKey}/${photo.seriesKey}/${photo.id}`)
        img(
          src=photo.urls ? photo.urls.preview : `/images/photo/${photo.countryKey}/${photo.seriesKey}/${photo.file}`
          srcset=photo.urls ? `${photo.urls.thumb || photo.urls.preview} 400w, ${photo.urls.preview} 800w` : undefined
          sizes=photo.urls ? '(max-width: 640px) calc(50vw - 12px), 400px' : undefined
          alt=photo.title
          loading='lazy'
          onerror="this.style.background='#1e1e1e';this.removeAttribute('src')"
        )
        .photo-overlay
          span.photo-title= photo.title
          if photo.date
            span.photo-date= photo.date
```

- [ ] **Step 2: Verify the route renders**

Start the dev server and open `http://localhost:<PORT>/color/blue` in a browser.

Expected: a gallery page with header "СИНИЙ · N фото" (N may be 0 if migration not yet run — that's fine). No crash, no 500 error.

- [ ] **Step 3: Commit**

```bash
git add views/photo/color-gallery.pug
git commit -m "feat(photo): add color-gallery template"
```

---

## Task 4: Sidebar circles + mobile strip (UI)

**Files:**
- Modify: `views/photo/layout.pug`
- Modify: `public/stylesheets/photo/style.css`

- [ ] **Step 1: Add color circles to sidebar in layout.pug**

In `views/photo/layout.pug`, after the closing tag of `nav.sidebar-nav` and before `.sidebar-footer`, add:

```pug
      .sidebar-colors
        each family, key in colorFamilies
          a.color-dot(
            href=`/color/${key}`
            title=family.label
            style=`background:${family.hex}`
            class=activeColorFamily===key?'active':''
          )
```

(Indent to match the existing sidebar structure — two spaces per level, `.sidebar-colors` is a direct child of `aside.sidebar`.)

- [ ] **Step 2: Add mobile color strip in layout.pug**

In `views/photo/layout.pug`, after the closing `header.mobile-header` tag and before `.site`, add:

```pug
    .mobile-colors
      each family, key in colorFamilies
        a.color-dot(
          href=`/color/${key}`
          title=family.label
          style=`background:${family.hex}`
          class=activeColorFamily===key?'active':''
        )
```

- [ ] **Step 3: Add CSS for color dots and strips**

In `public/stylesheets/photo/style.css`, add at the end (before any existing last rule, or append):

```css
/* ─── COLOR FILTER ───────────────────────────────────────────── */
.sidebar-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px 8px;
  border-top: 1px solid var(--border);
}

.color-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: block;
  flex-shrink: 0;
  transition: box-shadow 0.15s;
}

.color-dot:hover,
.color-dot.active {
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 3px var(--text);
}

.mobile-colors {
  display: none;
}

@media (max-width: 640px) {
  .mobile-colors {
    display: flex;
    gap: 10px;
    padding: 8px 16px;
    overflow-x: auto;
    scrollbar-width: none;
    background: var(--bg-sidebar);
    border-bottom: 1px solid var(--border);
  }
  .mobile-colors::-webkit-scrollbar { display: none; }
  .mobile-colors .color-dot { flex-shrink: 0; }
}
```

- [ ] **Step 4: Visually verify**

Open any gallery page on desktop: 8 colored circles should appear in the sidebar between the nav and the footer. Click one → goes to `/color/blue` etc.

On mobile (or narrow browser window): a horizontal strip of circles appears below the header.

On a `/color/:family` page: the matching circle has a white ring around it.

- [ ] **Step 5: Commit**

```bash
git add views/photo/layout.pug public/stylesheets/photo/style.css
git commit -m "feat(photo): add color family circles to sidebar and mobile strip"
```

---

## Task 5: Extract color at upload time

**Files:**
- Modify: `routes/photo-admin.js`

- [ ] **Step 1: Add require**

At the top of `routes/photo-admin.js`, after the existing requires, add:

```js
var { extractColorFamily } = require('../lib/color-utils');
```

- [ ] **Step 2: Add color extraction to the upload Promise.all (first occurrence, ~line 256)**

Find the block:
```js
var [buf400, buf800, buf2400] = await Promise.all([
  sharp(req.file.buffer).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
  sharp(req.file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
  sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
]);
```

Replace with:
```js
var [buf400, buf800, buf2400, colorFamily] = await Promise.all([
  sharp(req.file.buffer).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
  sharp(req.file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
  sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
  extractColorFamily(req.file.buffer),
]);
```

Then find where `photoEntry` is constructed and add before `data[country].series[series].photos.push(photoEntry)`:
```js
if (colorFamily) photoEntry.colorFamily = colorFamily;
```

- [ ] **Step 3: Add color extraction to the photo-replace Promise.all (second occurrence, ~line 499)**

Find the block (inside the `if (req.file)` branch of the edit route):
```js
var [buf400, buf800, buf2400] = await Promise.all([
  sharp(req.file.buffer).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
  sharp(req.file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
  sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
]);
```

Replace with:
```js
var [buf400, buf800, buf2400, colorFamily] = await Promise.all([
  sharp(req.file.buffer).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
  sharp(req.file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
  sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
  extractColorFamily(req.file.buffer),
]);
```

Then after `photo.urls = { ... }` and before `saveData(data)`, add:
```js
if (colorFamily) photo.colorFamily = colorFamily;
```

- [ ] **Step 4: Verify**

Upload a test photo via the admin. Check in `data/photo.json` (or Firestore) that the new photo entry has a `colorFamily` field.

- [ ] **Step 5: Commit**

```bash
git add routes/photo-admin.js
git commit -m "feat(photo): extract colorFamily on upload and photo replace"
```

---

## Task 6: Migration script (backfill existing photos)

**Files:**
- Create: `scripts/extract-colors.js`

- [ ] **Step 1: Create the migration script**

```js
// scripts/extract-colors.js
// Run once on the server: node scripts/extract-colors.js
'use strict';
var https = require('https');
var sharp = require('sharp');
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { initFromFirestore, getData, saveData } = require('../lib/photo-data');
var { extractColorFamily } = require('../lib/color-utils');

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

function downloadBuffer(url) {
  return new Promise(function(resolve, reject) {
    https.get(url, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() { resolve(Buffer.concat(chunks)); });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function run() {
  await initFromFirestore(fb);
  var data = getData();

  var todos = [];
  for (var countryKey of Object.keys(data)) {
    var country = data[countryKey];
    for (var seriesKey of Object.keys(country.series)) {
      for (var photo of country.series[seriesKey].photos) {
        if (!photo.colorFamily && photo.urls && photo.urls.preview) {
          todos.push(photo);
        }
      }
    }
  }

  console.log('Processing ' + todos.length + ' photos...');
  var done = 0, skipped = 0;

  for (var i = 0; i < todos.length; i += 5) {
    var batch = todos.slice(i, i + 5);
    await Promise.all(batch.map(async function(photo) {
      try {
        var buf = await downloadBuffer(photo.urls.preview);
        photo.colorFamily = await extractColorFamily(buf);
        done++;
      } catch (e) {
        skipped++;
        process.stderr.write('\nSkipped ' + photo.id + ': ' + e.message + '\n');
      }
    }));
    process.stdout.write('\r[' + (done + skipped) + '/' + todos.length + '] processed');
  }

  console.log('\nDone: ' + done + ', skipped: ' + skipped);
  saveData(data);
  console.log('Saved. Waiting for Firestore sync...');
  await new Promise(function(r) { setTimeout(r, 5000); });
  console.log('Migration complete.');
}

run().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Commit the script**

```bash
git add scripts/extract-colors.js
git commit -m "feat(photo): add color migration script for existing photos"
```

- [ ] **Step 3: Run the migration on the server**

SSH into the server, navigate to the project root, and run:

```bash
node scripts/extract-colors.js
```

Expected output:
```
[photo-data] loaded from flat Firestore (env=prod, ...)
Processing 247 photos...
[247/247] processed
Done: 243, skipped: 4
Saved. Waiting for Firestore sync...
Migration complete.
```

(Exact numbers will vary. Skipped = photos without `urls.preview`.)

- [ ] **Step 4: Verify results**

Open `/color/blue` (or any family) in the browser — should now show actual photos. Check that counts are non-zero for at least a few families.

---

## Self-Review Checklist

- [x] `colorFamilies` in `res.locals` covers all routes — layout circles work everywhere
- [x] `activeColorFamily` defaults to `null` in middleware, overridden only in `/color/:family` render
- [x] Migration skips photos already having `colorFamily` (idempotent: `!photo.colorFamily`)
- [x] Both upload and photo-replace paths in photo-admin.js are updated
- [x] Sitemap includes all 8 `/color/:family` URLs
- [x] `saveData` in migration triggers Firestore sync because `initFromFirestore` is called first
- [x] No placeholder text or TBDs remain
