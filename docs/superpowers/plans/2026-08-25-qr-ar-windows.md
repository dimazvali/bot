# QR AR-окна в прошлое — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `qr.dimazvali.com` — one page per historical photo, reachable and AR-anchored via a physical QR code; pointing the phone camera at the code anchors a "portal" window that reveals the old photo with a tilt-driven parallax effect.

**Architecture:** New isolated Express sub-project mounted via `vhost`, following this repo's existing pattern (`routes/qr.js` + `routes/qr-admin.js` + `views/qr/*` + `lib/qr-*.js`). Data is a flat JSON file (`data/qr-photos.json`) plus locally-stored photos (`public/qr/<slug>/photo.jpg`) — no Firestore, no build step. All AR logic is vanilla client JS (no bundler, matching the rest of the codebase): `jsQR` for one-shot QR detection, a small homography/matrix3d module for perspective "corner-pinning" of the portal, and `deviceorientation` deltas to drive both the portal's on-screen position and an extra offset on the photo inside it (faking depth/parallax).

**Tech Stack:** Node.js + Express + Pug (existing), `multer` + `sharp` (existing deps, image upload/resize), `qrcode` (existing dep, QR PNG generation), vendored `jsQR` (new, static file, no npm dep), Node's built-in test runner `node:test` + `node:assert/strict` (new — repo currently has zero automated tests; this is the lightest possible option, zero new dependencies).

Reference spec: `docs/superpowers/specs/2026-08-25-qr-ar-windows-design.md`

---

## File Structure

```
lib/
  qr-auth.js              — cookieToken(pass) pure hash helper for admin auth
  qr-data.js               — JSON CRUD store for photo entries (slug validation, get/create/update/remove)
  qr-images.js              — save/delete uploaded photo files (sharp resize to public/qr/<slug>/photo.jpg)

routes/
  qr.js                     — public route GET /:slug + mounts qr-admin + static
  qr-admin.js                — admin auth, list/new/edit/delete, QR PNG download

views/qr/
  layout.pug
  photo.pug                 — public AR page
  not-found.pug
  admin/
    layout.pug
    login.pug
    list.pug
    edit.pug

public/javascripts/qr/
  jsQR.js                    — vendored (downloaded once, static asset)
  portal-transform.js         — pure math: homography/matrix3d, cover-fit mapping, quad scaling, angle deltas
  ar.js                       — camera + scan + anchor + orientation-driven parallax (DOM wiring)

public/stylesheets/qr/
  style.css

public/qr/                    — uploaded photos (gitignored)

data/
  qr-photos.json              — seed as `[]`

test/
  qr-auth.test.js
  qr-data.test.js
  qr-images.test.js
  qr-portal-transform.test.js

app.js                        — add vhost mounts for qr.dimazvali.com
.gitignore                    — ignore public/qr/
package.json                  — add "test": "node --test test/" script
```

---

## Task 1: Vendor jsQR

**Files:**
- Create: `public/javascripts/qr/jsQR.js`

- [ ] **Step 1: Download the jsQR UMD build**

```bash
curl -sL -o "public/javascripts/qr/jsQR.js" "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"
```

- [ ] **Step 2: Verify it downloaded correctly (not an HTML error page, exposes global `jsQR`)**

```bash
grep -c "function jsQR" public/javascripts/qr/jsQR.js
```
Expected: a number ≥ 1 (not 0, not a curl/HTML error).

- [ ] **Step 3: Commit**

```bash
git add public/javascripts/qr/jsQR.js
git commit -m "chore: vendor jsQR for client-side QR detection"
```

---

## Task 2: Portal transform math module (TDD)

Pure, framework-free math used both by the browser (`<script>` tag, no bundler) and by Node tests (`require`d directly) — so it must work as plain CommonJS that also attaches to `window`.

**Files:**
- Create: `public/javascripts/qr/portal-transform.js`
- Test: `test/qr-portal-transform.test.js`
- Modify: `package.json` (add `test` script)

- [ ] **Step 1: Add npm test script**

Edit `package.json`, in `"scripts"`:

```json
"scripts": {
  "start": "node ./bin/www",
  "test": "node --test test/"
},
```

- [ ] **Step 2: Write the failing tests**

Create `test/qr-portal-transform.test.js`:

```js
'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var T = require('../public/javascripts/qr/portal-transform.js');

test('computeHomographyCoeffs solves identity mapping', function() {
  var src = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  var dst = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  var c = T.computeHomographyCoeffs(src, dst);
  assert.ok(Math.abs(c.a - 1) < 1e-6);
  assert.ok(Math.abs(c.b - 0) < 1e-6);
  assert.ok(Math.abs(c.c - 0) < 1e-6);
  assert.ok(Math.abs(c.d - 0) < 1e-6);
  assert.ok(Math.abs(c.e - 1) < 1e-6);
  assert.ok(Math.abs(c.f - 0) < 1e-6);
  assert.ok(Math.abs(c.g - 0) < 1e-6);
  assert.ok(Math.abs(c.h - 0) < 1e-6);
});

test('computeHomographyCoeffs maps an arbitrary quad correctly (round-trip)', function() {
  var src = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }];
  var dst = [{ x: 50, y: 40 }, { x: 260, y: 10 }, { x: 300, y: 200 }, { x: 20, y: 180 }];
  var c = T.computeHomographyCoeffs(src, dst);
  function project(p) {
    var w = c.g * p.x + c.h * p.y + 1;
    return { x: (c.a * p.x + c.b * p.y + c.c) / w, y: (c.d * p.x + c.e * p.y + c.f) / w };
  }
  src.forEach(function(p, i) {
    var got = project(p);
    assert.ok(Math.abs(got.x - dst[i].x) < 1e-6, 'x mismatch at ' + i);
    assert.ok(Math.abs(got.y - dst[i].y) < 1e-6, 'y mismatch at ' + i);
  });
});

test('matrix3dFromCoeffs formats identity coefficients as an identity matrix3d', function() {
  var str = T.matrix3dFromCoeffs({ a: 1, b: 0, c: 0, d: 0, e: 1, f: 0, g: 0, h: 0 });
  assert.equal(str, 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)');
});

test('computePortalTransform composes homography + matrix3d in one call', function() {
  var src = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  var dst = [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }, { x: 5, y: 15 }];
  var str = T.computePortalTransform(src, dst);
  assert.match(str, /^matrix3d\(/);
});

test('mapCoverPoint maps a wide source cropped horizontally into a square box', function() {
  // source 1000x500 (2:1), box 200x200 (1:1) -> source is wider, cropped left/right
  var center = T.mapCoverPoint({ x: 500, y: 250 }, 1000, 500, 200, 200);
  assert.ok(Math.abs(center.x - 100) < 1e-6);
  assert.ok(Math.abs(center.y - 100) < 1e-6);
  var topLeft = T.mapCoverPoint({ x: 0, y: 0 }, 1000, 500, 200, 200);
  assert.ok(Math.abs(topLeft.x - -100) < 1e-6);
  assert.ok(Math.abs(topLeft.y - 0) < 1e-6);
});

test('mapCoverPoint maps a tall source cropped vertically into a wide box', function() {
  // source 500x1000 (1:2), box 200x100 (2:1) -> source is taller, cropped top/bottom
  var center = T.mapCoverPoint({ x: 250, y: 500 }, 500, 1000, 200, 100);
  assert.ok(Math.abs(center.x - 100) < 1e-6);
  assert.ok(Math.abs(center.y - 50) < 1e-6);
});

test('scaleQuadAroundCenter enlarges a quad around its centroid', function() {
  var points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  var scaled = T.scaleQuadAroundCenter(points, 2);
  assert.deepEqual(scaled, [{ x: -5, y: -5 }, { x: 15, y: -5 }, { x: 15, y: 15 }, { x: -5, y: 15 }]);
});

test('normalizeAngleDelta wraps deltas into [-180, 180]', function() {
  assert.equal(T.normalizeAngleDelta(350), -10);
  assert.equal(T.normalizeAngleDelta(-350), 10);
  assert.equal(T.normalizeAngleDelta(10), 10);
  assert.equal(T.normalizeAngleDelta(-10), -10);
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
node --test test/qr-portal-transform.test.js
```
Expected: FAIL — `Cannot find module '../public/javascripts/qr/portal-transform.js'`

- [ ] **Step 4: Implement the module**

Create `public/javascripts/qr/portal-transform.js`:

```js
'use strict';

function solveLinearSystem(A, b) {
  var n = b.length;
  var M = A.map(function(row, i) { return row.concat([b[i]]); });
  for (var col = 0; col < n; col++) {
    var pivot = col;
    for (var r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    var tmp = M[col]; M[col] = M[pivot]; M[pivot] = tmp;
    var pivotVal = M[col][col];
    if (Math.abs(pivotVal) < 1e-12) throw new Error('Singular matrix — degenerate point configuration');
    for (var c = col; c <= n; c++) M[col][c] /= pivotVal;
    for (var r2 = 0; r2 < n; r2++) {
      if (r2 === col) continue;
      var factor = M[r2][col];
      for (var c2 = col; c2 <= n; c2++) M[r2][c2] -= factor * M[col][c2];
    }
  }
  return M.map(function(row) { return row[n]; });
}

function computeHomographyCoeffs(src, dst) {
  if (src.length !== 4 || dst.length !== 4) throw new Error('Need exactly 4 point pairs');
  var A = [];
  var b = [];
  for (var i = 0; i < 4; i++) {
    var sx = src[i].x, sy = src[i].y, dx = dst[i].x, dy = dst[i].y;
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }
  var sol = solveLinearSystem(A, b);
  return { a: sol[0], b: sol[1], c: sol[2], d: sol[3], e: sol[4], f: sol[5], g: sol[6], h: sol[7] };
}

function matrix3dFromCoeffs(coeffs) {
  var values = [
    coeffs.a, coeffs.d, 0, coeffs.g,
    coeffs.b, coeffs.e, 0, coeffs.h,
    0, 0, 1, 0,
    coeffs.c, coeffs.f, 0, 1,
  ];
  return 'matrix3d(' + values.join(',') + ')';
}

function computePortalTransform(src, dst) {
  return matrix3dFromCoeffs(computeHomographyCoeffs(src, dst));
}

function mapCoverPoint(point, sourceW, sourceH, boxW, boxH) {
  var sourceAspect = sourceW / sourceH;
  var boxAspect = boxW / boxH;
  var scale, offsetX, offsetY;
  if (sourceAspect > boxAspect) {
    scale = boxH / sourceH;
    offsetX = (sourceW * scale - boxW) / 2;
    offsetY = 0;
  } else {
    scale = boxW / sourceW;
    offsetX = 0;
    offsetY = (sourceH * scale - boxH) / 2;
  }
  return { x: point.x * scale - offsetX, y: point.y * scale - offsetY };
}

function scaleQuadAroundCenter(points, scale) {
  var cx = points.reduce(function(s, p) { return s + p.x; }, 0) / points.length;
  var cy = points.reduce(function(s, p) { return s + p.y; }, 0) / points.length;
  return points.map(function(p) {
    return { x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale };
  });
}

function normalizeAngleDelta(delta) {
  var d = delta % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

var api = {
  computeHomographyCoeffs: computeHomographyCoeffs,
  matrix3dFromCoeffs: matrix3dFromCoeffs,
  computePortalTransform: computePortalTransform,
  mapCoverPoint: mapCoverPoint,
  scaleQuadAroundCenter: scaleQuadAroundCenter,
  normalizeAngleDelta: normalizeAngleDelta,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.QRPortalTransform = api;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
node --test test/qr-portal-transform.test.js
```
Expected: PASS — 8 tests passing.

- [ ] **Step 6: Commit**

```bash
git add public/javascripts/qr/portal-transform.js test/qr-portal-transform.test.js package.json
git commit -m "feat: add portal transform math (homography, cover-fit mapping, angle deltas)"
```

---

## Task 3: `qr-auth.js` — admin password hashing (TDD)

**Files:**
- Create: `lib/qr-auth.js`
- Test: `test/qr-auth.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/qr-auth.test.js`:

```js
'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var { cookieToken } = require('../lib/qr-auth.js');

test('cookieToken is deterministic for the same password', function() {
  assert.equal(cookieToken('secret'), cookieToken('secret'));
});

test('cookieToken differs for different passwords', function() {
  assert.notEqual(cookieToken('secret'), cookieToken('other'));
});

test('cookieToken returns a hex sha256 digest', function() {
  assert.match(cookieToken('x'), /^[0-9a-f]{64}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test test/qr-auth.test.js
```
Expected: FAIL — `Cannot find module '../lib/qr-auth.js'`

- [ ] **Step 3: Implement**

Create `lib/qr-auth.js`:

```js
'use strict';
var crypto = require('crypto');

function cookieToken(pass) {
  return crypto.createHash('sha256').update('qr:' + pass).digest('hex');
}

module.exports = { cookieToken: cookieToken };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test test/qr-auth.test.js
```
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/qr-auth.js test/qr-auth.test.js
git commit -m "feat: add qr admin password hashing helper"
```

---

## Task 4: `qr-data.js` — JSON CRUD store (TDD)

**Files:**
- Create: `lib/qr-data.js`
- Test: `test/qr-data.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/qr-data.test.js`:

```js
'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var os = require('os');
var path = require('path');
var { createStore, validateSlug } = require('../lib/qr-data.js');

function tempDataPath() {
  return path.join(os.tmpdir(), 'qr-data-test-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
}

test('validateSlug accepts lowercase-latin-hyphen slugs only', function() {
  assert.equal(validateSlug('erekle-square'), true);
  assert.equal(validateSlug('Erekle-Square'), false);
  assert.equal(validateSlug('плошадь'), false);
  assert.equal(validateSlug('has spaces'), false);
  assert.equal(validateSlug(''), false);
  assert.equal(validateSlug('-leading-hyphen'), false);
});

test('getAll() on a missing file returns an empty array', function() {
  var store = createStore(tempDataPath());
  assert.deepEqual(store.getAll(), []);
});

test('create() writes a new record and getBySlug() finds it', function() {
  var dataPath = tempDataPath();
  var store = createStore(dataPath);
  var record = store.create({ slug: 'test-place', title: 'Test Place', photo: '/qr/test-place/photo.jpg' });
  assert.equal(record.slug, 'test-place');
  assert.ok(record.createdAt);
  assert.ok(record.updatedAt);
  var found = store.getBySlug('test-place');
  assert.equal(found.title, 'Test Place');
  fs.unlinkSync(dataPath);
});

test('create() rejects an invalid slug', function() {
  var store = createStore(tempDataPath());
  assert.throws(function() { store.create({ slug: 'Bad Slug', title: 'x' }); });
});

test('create() rejects a duplicate slug', function() {
  var dataPath = tempDataPath();
  var store = createStore(dataPath);
  store.create({ slug: 'dup', title: 'A' });
  assert.throws(function() { store.create({ slug: 'dup', title: 'B' }); });
  fs.unlinkSync(dataPath);
});

test('update() merges a patch, keeps the slug, and bumps updatedAt', function() {
  var dataPath = tempDataPath();
  var store = createStore(dataPath);
  var created = store.create({ slug: 'up', title: 'Old' });
  var updated = store.update('up', { title: 'New' });
  assert.equal(updated.title, 'New');
  assert.equal(updated.slug, 'up');
  assert.ok(updated.updatedAt >= created.updatedAt);
  fs.unlinkSync(dataPath);
});

test('update() throws for an unknown slug', function() {
  var store = createStore(tempDataPath());
  assert.throws(function() { store.update('nope', { title: 'x' }); });
});

test('remove() deletes the record', function() {
  var dataPath = tempDataPath();
  var store = createStore(dataPath);
  store.create({ slug: 'gone', title: 'X' });
  store.remove('gone');
  assert.equal(store.getBySlug('gone'), null);
  fs.unlinkSync(dataPath);
});

test('remove() throws for an unknown slug', function() {
  var store = createStore(tempDataPath());
  assert.throws(function() { store.remove('nope'); });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/qr-data.test.js
```
Expected: FAIL — `Cannot find module '../lib/qr-data.js'`

- [ ] **Step 3: Implement**

Create `lib/qr-data.js`:

```js
'use strict';
var fs = require('fs');
var path = require('path');

var SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateSlug(slug) {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

function createStore(dataPath) {
  function readAll() {
    if (!fs.existsSync(dataPath)) return [];
    var raw = fs.readFileSync(dataPath, 'utf8').trim();
    if (!raw) return [];
    return JSON.parse(raw);
  }

  function writeAll(list) {
    fs.writeFileSync(dataPath, JSON.stringify(list, null, 2), 'utf8');
  }

  function getAll() {
    return readAll();
  }

  function getBySlug(slug) {
    return readAll().find(function(e) { return e.slug === slug; }) || null;
  }

  function create(entry) {
    if (!validateSlug(entry.slug)) throw new Error('Некорректный slug: используйте латиницу, цифры и дефисы');
    var list = readAll();
    if (list.some(function(e) { return e.slug === entry.slug; })) {
      throw new Error('Запись с таким slug уже существует');
    }
    var now = Date.now();
    var record = {
      slug: entry.slug,
      title: entry.title || '',
      year: entry.year || '',
      description: entry.description || '',
      address: entry.address || '',
      photo: entry.photo || '',
      createdAt: now,
      updatedAt: now,
    };
    list.push(record);
    writeAll(list);
    return record;
  }

  function update(slug, patch) {
    var list = readAll();
    var idx = list.findIndex(function(e) { return e.slug === slug; });
    if (idx === -1) throw new Error('Запись не найдена: ' + slug);
    var updated = Object.assign({}, list[idx], patch, { slug: list[idx].slug, updatedAt: Date.now() });
    list[idx] = updated;
    writeAll(list);
    return updated;
  }

  function remove(slug) {
    var list = readAll();
    var next = list.filter(function(e) { return e.slug !== slug; });
    if (next.length === list.length) throw new Error('Запись не найдена: ' + slug);
    writeAll(next);
  }

  return { getAll: getAll, getBySlug: getBySlug, create: create, update: update, remove: remove };
}

var defaultStore = createStore(path.join(__dirname, '../data/qr-photos.json'));

module.exports = Object.assign({}, defaultStore, { createStore: createStore, validateSlug: validateSlug });
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/qr-data.test.js
```
Expected: PASS — 9 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/qr-data.js test/qr-data.test.js
git commit -m "feat: add JSON CRUD store for qr photo entries"
```

---

## Task 5: `qr-images.js` — photo upload storage (TDD)

**Files:**
- Create: `lib/qr-images.js`
- Test: `test/qr-images.test.js`

- [ ] **Step 1: Write the failing tests**

Create `test/qr-images.test.js`:

```js
'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('fs');
var os = require('os');
var path = require('path');
var sharp = require('sharp');
var { createImageStore } = require('../lib/qr-images.js');

test('savePhoto writes a resized jpeg and returns its public path', async function() {
  var tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-images-'));
  var store = createImageStore(tmpBase);
  var input = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toBuffer();
  var publicPath = await store.savePhoto('demo-slug', input);
  assert.equal(publicPath, '/qr/demo-slug/photo.jpg');
  var diskPath = path.join(tmpBase, 'demo-slug', 'photo.jpg');
  assert.ok(fs.existsSync(diskPath));
  var meta = await sharp(diskPath).metadata();
  assert.equal(meta.width, 2000);
  assert.equal(meta.format, 'jpeg');
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

test('savePhoto does not enlarge images smaller than the target width', async function() {
  var tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-images-'));
  var store = createImageStore(tmpBase);
  var input = await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
  await store.savePhoto('small-slug', input);
  var meta = await sharp(path.join(tmpBase, 'small-slug', 'photo.jpg')).metadata();
  assert.equal(meta.width, 400);
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

test('deletePhoto removes the slug directory', function() {
  var tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-images-'));
  var store = createImageStore(tmpBase);
  fs.mkdirSync(path.join(tmpBase, 'x'), { recursive: true });
  fs.writeFileSync(path.join(tmpBase, 'x', 'photo.jpg'), 'x');
  store.deletePhoto('x');
  assert.equal(fs.existsSync(path.join(tmpBase, 'x')), false);
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

test('deletePhoto on a missing slug does not throw', function() {
  var tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-images-'));
  var store = createImageStore(tmpBase);
  assert.doesNotThrow(function() { store.deletePhoto('never-existed'); });
  fs.rmSync(tmpBase, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/qr-images.test.js
```
Expected: FAIL — `Cannot find module '../lib/qr-images.js'`

- [ ] **Step 3: Implement**

Create `lib/qr-images.js`:

```js
'use strict';
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');

function createImageStore(baseDir) {
  async function savePhoto(slug, buffer) {
    var dir = path.join(baseDir, slug);
    fs.mkdirSync(dir, { recursive: true });
    var dest = path.join(dir, 'photo.jpg');
    await sharp(buffer)
      .resize({ width: 2000, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toFile(dest);
    return '/qr/' + slug + '/photo.jpg';
  }

  function deletePhoto(slug) {
    var dir = path.join(baseDir, slug);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return { savePhoto: savePhoto, deletePhoto: deletePhoto };
}

var defaultStore = createImageStore(path.join(__dirname, '../public/qr'));

module.exports = Object.assign({}, defaultStore, { createImageStore: createImageStore });
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/qr-images.test.js
```
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/qr-images.js test/qr-images.test.js
git commit -m "feat: add photo upload storage helper (resize + save/delete)"
```

---

## Task 6: `.gitignore` + seed data file

**Files:**
- Modify: `.gitignore`
- Create: `data/qr-photos.json`

- [ ] **Step 1: Add ignore rule**

Edit `.gitignore`, add after the `public/images/books/ask` line:

```
public/qr/
```

- [ ] **Step 2: Seed the empty data file**

Create `data/qr-photos.json`:

```json
[]
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore data/qr-photos.json
git commit -m "chore: seed qr-photos.json and ignore uploaded photo files"
```

---

## Task 7: Admin auth routes + views

**Files:**
- Create: `routes/qr-admin.js`
- Create: `views/qr/admin/layout.pug`
- Create: `views/qr/admin/login.pug`
- Create: `public/stylesheets/qr/style.css`

- [ ] **Step 1: Create the stylesheet**

Create `public/stylesheets/qr/style.css`:

```css
:root {
  --qr-bg: #0b0c0f;
  --qr-fg: #f2f0ea;
  --qr-accent: #d8a24a;
  --qr-muted: #9a978e;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--qr-bg);
  color: var(--qr-fg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.qr-page { max-width: 640px; margin: 0 auto; padding: 16px; }
.qr-header h1 { font-size: 22px; margin: 0 0 4px; }
.qr-year, .qr-address { color: var(--qr-muted); margin: 0 0 2px; font-size: 14px; }
.qr-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 3/4;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  margin: 16px 0;
}
.qr-fallback-photo, .qr-video {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
}
.qr-ar-btn, .qr-rescan-btn {
  position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%);
  background: var(--qr-accent); color: #1a1204; border: none;
  padding: 10px 18px; border-radius: 999px; font-size: 15px; font-weight: 600;
  cursor: pointer;
}
.qr-hint {
  position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.55); color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 13px;
}
.qr-portal {
  position: absolute; top: 0; left: 0;
  width: 260px; height: 200px;
  overflow: hidden;
  transform-origin: 0 0;
  will-change: transform;
}
.qr-portal-photo {
  position: absolute;
  left: -20%; top: -20%;
  width: 140%; height: 140%;
  object-fit: cover;
  will-change: transform;
}
.qr-desc { line-height: 1.5; color: var(--qr-fg); }

.admin-body { background: #14151a; color: #eee; font-family: sans-serif; padding: 24px; }
.admin-login, .admin-edit { max-width: 420px; margin: 40px auto; }
.admin-field { margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
.admin-field input, .admin-field textarea { padding: 8px; border-radius: 6px; border: 1px solid #444; background: #1e1f24; color: #fff; }
.admin-btn { background: #d8a24a; color: #1a1204; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-block; }
.admin-btn-danger { background: #b3413a; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.admin-error { background: #4a1f1f; color: #ffb3b3; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; }
.admin-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
.admin-table th, .admin-table td { text-align: left; padding: 8px; border-bottom: 1px solid #333; }
.admin-thumb { width: 60px; height: 45px; object-fit: cover; border-radius: 4px; }
```

- [ ] **Step 2: Create admin layout and login view**

Create `views/qr/admin/layout.pug`:

```pug
doctype html
html(lang='ru')
  head
    meta(charset='utf-8')
    meta(name='viewport' content='width=device-width,initial-scale=1')
    title= title
    link(rel='stylesheet' href='/stylesheets/qr/style.css')
  body.admin-body
    block content
```

Create `views/qr/admin/login.pug`:

```pug
extends layout

block content
  .admin-login
    h2 qr.dimazvali.com Admin
    if error
      .admin-error= error
    form(method='POST' action='/admin/login')
      .admin-field
        label Пароль
        input(type='password' name='pass' autofocus required)
      button.admin-btn(type='submit') Войти
```

- [ ] **Step 3: Implement the admin router (auth only for now)**

Create `routes/qr-admin.js`:

```js
'use strict';
var express = require('express');
var router = express.Router();
var { cookieToken } = require('../lib/qr-auth');

router.use(express.urlencoded({ extended: false }));

function expectedToken() {
  return process.env.QR_ADMIN_PASS ? cookieToken(process.env.QR_ADMIN_PASS) : null;
}

function requireAuth(req, res, next) {
  var val = req.cookies && req.cookies.qrAdminToken;
  var expected = expectedToken();
  if (expected && val === expected) return next();
  res.redirect('/admin/login');
}

router.get('/login', function(req, res) {
  res.render('qr/admin/login', { title: 'Вход — qr.dimazvali.com Admin', error: null });
});

router.post('/login', function(req, res) {
  var pass = (req.body.pass || '').trim();
  var expected = expectedToken();
  if (!expected || cookieToken(pass) !== expected) {
    return res.render('qr/admin/login', { title: 'Вход — qr.dimazvali.com Admin', error: 'Неверный пароль' });
  }
  res.cookie('qrAdminToken', expected, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.redirect('/admin');
});

router.post('/logout', function(req, res) {
  res.clearCookie('qrAdminToken');
  res.redirect('/admin/login');
});

module.exports = router;
module.exports.requireAuth = requireAuth;
```

- [ ] **Step 4: Manual verification**

Set a password and start the app locally:

```bash
QR_ADMIN_PASS=test123 node ./bin/www
```

Visit `http://qr.localhost:<port>/admin/login` (or add `127.0.0.1 qr.localhost` to your hosts file / test via a direct route temporarily) — confirm wrong password shows the error, correct password sets a cookie and redirects to `/admin` (this will 404 until Task 8 adds the list route — that's expected at this point).

- [ ] **Step 5: Commit**

```bash
git add routes/qr-admin.js views/qr/admin/layout.pug views/qr/admin/login.pug public/stylesheets/qr/style.css
git commit -m "feat: add qr admin login/logout with env-password auth"
```

---

## Task 8: Admin list/create/edit/delete + QR PNG download

**Files:**
- Modify: `routes/qr-admin.js`
- Create: `views/qr/admin/list.pug`
- Create: `views/qr/admin/edit.pug`

- [ ] **Step 1: Create list view**

Create `views/qr/admin/list.pug`:

```pug
extends layout

block content
  .admin-list
    h2 Фотографии
    a.admin-btn(href='/admin/new') + Новая запись
    table.admin-table
      thead
        tr
          th Фото
          th Название
          th Год
          th Slug / URL
          th
      tbody
        each entry in entries
          tr
            td
              img.admin-thumb(src=entry.photo)
            td= entry.title
            td= entry.year
            td
              a(href=`https://qr.dimazvali.com/${entry.slug}` target='_blank')= entry.slug
            td
              a(href=`/admin/${entry.slug}/edit`) Изменить
              |  |
              a(href=`/admin/${entry.slug}/qr.png` target='_blank') QR PNG
              |  |
              form(method='POST' action=`/admin/${entry.slug}/delete` style='display:inline' onsubmit='return confirm("Удалить запись?")')
                button.admin-btn-danger(type='submit') Удалить
```

- [ ] **Step 2: Create edit/new view**

Create `views/qr/admin/edit.pug`:

```pug
extends layout

block content
  .admin-edit
    h2= entry ? 'Редактировать: ' + entry.title : 'Новая запись'
    if error
      .admin-error= error
    form(method='POST' enctype='multipart/form-data')
      .admin-field
        label Slug (латиница, цифры, дефисы — часть URL, после печати QR не меняется)
        if entry
          input(type='text' value=entry.slug disabled)
        else
          input(type='text' name='slug' required pattern='[a-z0-9]+(-[a-z0-9]+)*' value=(entry && entry.slug) || '')
      .admin-field
        label Название
        input(type='text' name='title' required value=(entry && entry.title) || '')
      .admin-field
        label Год / период
        input(type='text' name='year' value=(entry && entry.year) || '')
      .admin-field
        label Адрес / место
        input(type='text' name='address' value=(entry && entry.address) || '')
      .admin-field
        label Описание
        textarea(name='description')= (entry && entry.description) || ''
      .admin-field
        label Фотография (крупнее, чем нужно показать — по краям есть запас для параллакса)
        input(type='file' name='photo' accept='image/*' required=!entry)
      button.admin-btn(type='submit') Сохранить
```

- [ ] **Step 3: Add CRUD routes**

Edit `routes/qr-admin.js`, add near the top (after existing `require`s):

```js
var multer = require('multer');
var QRCode = require('qrcode');
var qrData = require('../lib/qr-data');
var qrImages = require('../lib/qr-images');

var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Только изображения'));
    cb(null, true);
  },
});
```

Add at the end of `routes/qr-admin.js`, before `module.exports = router;`:

```js
router.get('/', requireAuth, function(req, res) {
  res.render('qr/admin/list', { title: 'qr.dimazvali.com Admin', entries: qrData.getAll() });
});

router.get('/new', requireAuth, function(req, res) {
  res.render('qr/admin/edit', { title: 'Новая запись', entry: null, error: null });
});

router.post('/new', requireAuth, upload.single('photo'), async function(req, res) {
  try {
    if (!req.file) throw new Error('Загрузите фотографию');
    var slug = (req.body.slug || '').trim();
    var photoPath = await qrImages.savePhoto(slug, req.file.buffer);
    qrData.create({
      slug: slug,
      title: (req.body.title || '').trim(),
      year: (req.body.year || '').trim(),
      description: (req.body.description || '').trim(),
      address: (req.body.address || '').trim(),
      photo: photoPath,
    });
    res.redirect('/admin');
  } catch (e) {
    res.render('qr/admin/edit', { title: 'Новая запись', entry: req.body, error: e.message });
  }
});

router.get('/:slug/edit', requireAuth, function(req, res) {
  var entry = qrData.getBySlug(req.params.slug);
  if (!entry) return res.status(404).send('Не найдено');
  res.render('qr/admin/edit', { title: 'Редактировать: ' + entry.title, entry: entry, error: null });
});

router.post('/:slug/edit', requireAuth, upload.single('photo'), async function(req, res) {
  try {
    var patch = {
      title: (req.body.title || '').trim(),
      year: (req.body.year || '').trim(),
      description: (req.body.description || '').trim(),
      address: (req.body.address || '').trim(),
    };
    if (req.file) {
      patch.photo = await qrImages.savePhoto(req.params.slug, req.file.buffer);
    }
    qrData.update(req.params.slug, patch);
    res.redirect('/admin');
  } catch (e) {
    var entry = qrData.getBySlug(req.params.slug);
    res.render('qr/admin/edit', { title: 'Редактировать', entry: entry, error: e.message });
  }
});

router.post('/:slug/delete', requireAuth, function(req, res) {
  qrData.remove(req.params.slug);
  qrImages.deletePhoto(req.params.slug);
  res.redirect('/admin');
});

router.get('/:slug/qr.png', requireAuth, function(req, res) {
  var entry = qrData.getBySlug(req.params.slug);
  if (!entry) return res.status(404).send('Не найдено');
  var url = 'https://qr.dimazvali.com/' + entry.slug;
  res.type('png');
  QRCode.toFileStream(res, url, { width: 800, margin: 2 });
});
```

- [ ] **Step 4: Manual verification**

```bash
QR_ADMIN_PASS=test123 node ./bin/www
```

Log in at `/admin/login`, then: create a new entry with a test photo, confirm it appears in the list, confirm `/admin/<slug>/qr.png` downloads a scannable PNG, edit the entry (change title, confirm slug field is disabled and unchanged), delete it and confirm both the JSON record and `public/qr/<slug>/` are gone.

- [ ] **Step 5: Commit**

```bash
git add routes/qr-admin.js views/qr/admin/list.pug views/qr/admin/edit.pug
git commit -m "feat: add qr admin CRUD and QR PNG download"
```

---

## Task 9: Public page (fallback state, no AR yet)

**Files:**
- Create: `routes/qr.js`
- Create: `views/qr/layout.pug`
- Create: `views/qr/photo.pug`
- Create: `views/qr/not-found.pug`

- [ ] **Step 1: Create public layout and views**

Create `views/qr/layout.pug`:

```pug
doctype html
html(lang='ru')
  head
    meta(charset='utf-8')
    meta(name='viewport' content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no')
    title= title
    link(rel='stylesheet' href='/stylesheets/qr/style.css')
    block head
  body
    block content
```

Create `views/qr/not-found.pug`:

```pug
extends layout

block content
  .qr-page
    h1 Страница не найдена
    p Такой фотографии не существует.
```

Create `views/qr/photo.pug`:

```pug
extends layout

block content
  .qr-page
    header.qr-header
      h1= entry.title
      if entry.year
        p.qr-year= entry.year
      if entry.address
        p.qr-address= entry.address
    .qr-stage#qrStage
      img.qr-fallback-photo#qrFallbackPhoto(src=entry.photo alt=entry.title)
      button.qr-ar-btn#qrArBtn(type='button') Смотреть в AR
      video.qr-video#qrVideo(playsinline muted autoplay style='display:none')
      canvas#qrScanCanvas(style='display:none')
      .qr-hint#qrHint(style='display:none') Наведите камеру на QR-код на табличке
      .qr-portal#qrPortal(style='display:none')
        img.qr-portal-photo#qrPortalPhoto(src=entry.photo alt=entry.title)
      button.qr-rescan-btn#qrRescanBtn(type='button' style='display:none') Навести заново
    if entry.description
      p.qr-desc= entry.description

  script(src='/javascripts/qr/jsQR.js')
  script(src='/javascripts/qr/portal-transform.js')
  script.
    window.QR_ENTRY = !{JSON.stringify({ slug: entry.slug, photo: entry.photo })};
```

(The `ar.js` script tag is added in Task 11, once the file exists.)

- [ ] **Step 2: Implement the public router**

Create `routes/qr.js`:

```js
'use strict';
var express = require('express');
var router = express.Router();
var path = require('path');
var qrData = require('../lib/qr-data');

router.use(express.static(path.join(__dirname, '../public')));

// Admin router must be mounted BEFORE the wildcard :slug route
router.use('/admin', require('./qr-admin'));

router.get('/:slug', function(req, res) {
  var entry = qrData.getBySlug(req.params.slug);
  if (!entry) return res.status(404).render('qr/not-found', { title: 'Не найдено' });
  res.render('qr/photo', { title: entry.title + ' — окно в прошлое', entry: entry });
});

module.exports = router;
```

- [ ] **Step 3: Manual verification**

```bash
QR_ADMIN_PASS=test123 node ./bin/www
```

Using an entry created in Task 8, visit `http://qr.localhost:<port>/<slug>` — confirm title/year/address/description render and the fallback photo shows with a "Смотреть в AR" button. Visit an unknown slug — confirm the not-found page renders with a 404 status.

- [ ] **Step 4: Commit**

```bash
git add routes/qr.js views/qr/layout.pug views/qr/photo.pug views/qr/not-found.pug
git commit -m "feat: add qr public photo page"
```

---

## Task 10: Wire into `app.js`

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add vhost mounts**

In `app.js`, after the existing `pelamushi` vhost block (after `app.use(vhost('www.pelamushi.ge', require('./routes/pelamushi')))`), add:

```js
app.use(vhost('qr.dimazvali.com', require('./routes/qr')))
app.use(vhost('qr.*.*', require('./routes/qr')))
app.use(vhost('qr.localhost', require('./routes/qr')))
```

- [ ] **Step 2: Manual verification**

```bash
QR_ADMIN_PASS=test123 node ./bin/www
```

Confirm the app boots without errors and `qr.localhost:<port>/<slug>` still resolves as in Task 9 (now via the real vhost wiring instead of ad-hoc testing).

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: mount qr.dimazvali.com vhost"
```

---

## Task 11: Client AR script — camera + QR scanning

**Files:**
- Create: `public/javascripts/qr/ar.js`
- Modify: `views/qr/photo.pug`

- [ ] **Step 1: Implement support-check, camera start, and the scan loop**

Create `public/javascripts/qr/ar.js`:

```js
(function() {
  'use strict';
  var ENTRY = window.QR_ENTRY;

  var fallbackPhoto = document.getElementById('qrFallbackPhoto');
  var arBtn = document.getElementById('qrArBtn');
  var video = document.getElementById('qrVideo');
  var canvas = document.getElementById('qrScanCanvas');
  var hint = document.getElementById('qrHint');

  var SCAN_INTERVAL_MS = 100;
  var SCAN_HINT_TIMEOUT_MS = 15000;
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  var scanning = false;
  var lastScanAt = 0;
  var scanStartAt = 0;

  function supportsAR() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof window.jsQR === 'function');
  }

  function isExpectedQr(text) {
    return typeof text === 'string' && text.indexOf(ENTRY.slug) !== -1;
  }

  async function startAR() {
    arBtn.disabled = true;
    var stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch (e) {
      arBtn.disabled = false;
      arBtn.textContent = 'Нет доступа к камере — повторить';
      return;
    }
    video.srcObject = stream;
    await video.play();
    arBtn.style.display = 'none';
    fallbackPhoto.style.display = 'none';
    video.style.display = 'block';
    hint.style.display = 'block';
    hint.textContent = 'Наведите камеру на QR-код на табличке';
    scanning = true;
    scanStartAt = performance.now();
    requestAnimationFrame(scanTick);
  }

  function scanTick(ts) {
    if (!scanning) return;
    if (ts - scanStartAt > SCAN_HINT_TIMEOUT_MS) {
      hint.textContent = 'Не получается найти QR — поднесите телефон ближе или добавьте света';
    }
    if (ts - lastScanAt >= SCAN_INTERVAL_MS && video.videoWidth) {
      lastScanAt = ts;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      var frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var result = window.jsQR(frame.data, frame.width, frame.height);
      if (result && isExpectedQr(result.data)) {
        console.log('[qr-ar] anchor QR found', result.location);
        scanning = false;
        hint.style.display = 'none';
        return;
      }
    }
    requestAnimationFrame(scanTick);
  }

  if (supportsAR()) {
    arBtn.addEventListener('click', startAR);
  } else {
    arBtn.style.display = 'none';
  }
})();
```

- [ ] **Step 2: Add the script tag**

Edit `views/qr/photo.pug`, after the existing `window.QR_ENTRY = ...` script block, add:

```pug
  script(src='/javascripts/qr/ar.js')
```

- [ ] **Step 3: Manual verification (real phone required — camera APIs need a secure context)**

Camera access requires HTTPS (or `localhost`). Test either on a phone over your existing HTTPS setup (see `ssl/` in this repo) pointed at `qr.dimazvali.com`, or locally over `https://localhost` with a self-signed cert if that's already how other sub-projects in this repo are tested.

Open the page on a phone, tap "Смотреть в AR", grant camera access, confirm the live camera feed shows full-screen with the "наведите камеру на QR-код" hint. Point it at the entry's own printed/on-screen QR code (e.g. open `/admin/<slug>/qr.png` on a second screen) and confirm the browser console logs `[qr-ar] anchor QR found` with a `location` object once detected.

- [ ] **Step 4: Commit**

```bash
git add public/javascripts/qr/ar.js views/qr/photo.pug
git commit -m "feat: add camera access and QR scan loop to AR page"
```

---

## Task 12: Client AR script — anchor + portal display

**Files:**
- Modify: `public/javascripts/qr/ar.js`

- [ ] **Step 1: Add the portal anchor logic**

Edit `public/javascripts/qr/ar.js` — add near the top (with the other `document.getElementById` lines):

```js
  var portal = document.getElementById('qrPortal');
  var rescanBtn = document.getElementById('qrRescanBtn');
  var T = window.QRPortalTransform;

  var PORTAL_W = 260;
  var PORTAL_H = 200;
  var PORTAL_SCALE = 2.6;

  var anchorQuad = null;
```

Replace the `if (result && isExpectedQr(result.data)) { ... }` block inside `scanTick` with:

```js
      if (result && isExpectedQr(result.data)) {
        onAnchor(result.location, canvas.width, canvas.height);
        return;
      }
```

Add these new functions (after `scanTick`):

```js
  function onAnchor(location, frameW, frameH) {
    scanning = false;
    hint.style.display = 'none';

    var rawCorners = [
      location.topLeftCorner,
      location.topRightCorner,
      location.bottomRightCorner,
      location.bottomLeftCorner,
    ];
    var displayCorners = rawCorners.map(function(pt) {
      return T.mapCoverPoint(pt, frameW, frameH, video.clientWidth, video.clientHeight);
    });
    anchorQuad = T.scaleQuadAroundCenter(displayCorners, PORTAL_SCALE);

    var nativeRect = [
      { x: 0, y: 0 },
      { x: PORTAL_W, y: 0 },
      { x: PORTAL_W, y: PORTAL_H },
      { x: 0, y: PORTAL_H },
    ];
    portal.style.width = PORTAL_W + 'px';
    portal.style.height = PORTAL_H + 'px';
    portal.style.transform = T.computePortalTransform(nativeRect, anchorQuad);
    portal.style.display = 'block';
    rescanBtn.style.display = 'block';
  }

  function rescan() {
    anchorQuad = null;
    portal.style.display = 'none';
    rescanBtn.style.display = 'none';
    hint.style.display = 'block';
    hint.textContent = 'Наведите камеру на QR-код на табличке';
    scanning = true;
    scanStartAt = performance.now();
    requestAnimationFrame(scanTick);
  }
```

At the bottom, in the `if (supportsAR())` block, add the rescan listener:

```js
  if (supportsAR()) {
    arBtn.addEventListener('click', startAR);
    rescanBtn.addEventListener('click', rescan);
  } else {
    arBtn.style.display = 'none';
  }
```

- [ ] **Step 2: Manual verification**

Same setup as Task 11. Point the camera at the printed/displayed QR code — confirm the portal frame appears roughly centered on the QR code's real-world position and roughly matches its rotation/skew as you view it from an angle. Tap "навести заново" — confirm it goes back to scanning mode.

This is a genuine visual-alignment check, not just "does it run" — the portal quad should visibly track the QR's position and skew, not just appear at a fixed spot on screen.

- [ ] **Step 3: Commit**

```bash
git add public/javascripts/qr/ar.js
git commit -m "feat: anchor AR portal to detected QR position and shape"
```

---

## Task 13: Client AR script — orientation-driven parallax

**Files:**
- Modify: `public/javascripts/qr/ar.js`

- [ ] **Step 1: Add orientation permission request to `startAR`**

Edit `public/javascripts/qr/ar.js` — add this function above `startAR`:

```js
  async function requestOrientationPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        var state = await DeviceOrientationEvent.requestPermission();
        return state === 'granted';
      } catch (e) {
        return false;
      }
    }
    return typeof DeviceOrientationEvent !== 'undefined';
  }
```

In `startAR`, right after `arBtn.disabled = true;`, add:

```js
    await requestOrientationPermission();
```

- [ ] **Step 2: Add orientation tracking state and listener**

Add near the other state variables:

```js
  var portalPhoto = document.getElementById('qrPortalPhoto');
  var PORTAL_SENS = -5;    // px per degree — keeps the frame world-anchored
  var PHOTO_SENS = -22;    // px per degree — bigger magnitude fakes extra depth behind the frame
  var anchorOrientation = null;
  var pendingOrientation = null;
  var rafScheduled = false;
```

In `onAnchor`, after `anchorQuad = T.scaleQuadAroundCenter(...)`, add:

```js
    anchorOrientation = pendingOrientation || { alpha: 0, beta: 0, gamma: 0 };
    window.addEventListener('deviceorientation', onOrientation);
```

In `rescan`, after `anchorQuad = null;`, add:

```js
    anchorOrientation = null;
    window.removeEventListener('deviceorientation', onOrientation);
```

Add these two new functions after `onAnchor`:

```js
  function onOrientation(e) {
    if (e.alpha === null) return;
    pendingOrientation = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
    if (!anchorQuad || rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(applyOrientation);
  }

  function applyOrientation() {
    rafScheduled = false;
    if (!anchorQuad || !anchorOrientation || !pendingOrientation) return;
    var dGamma = T.normalizeAngleDelta(pendingOrientation.gamma - anchorOrientation.gamma);
    var dBeta = T.normalizeAngleDelta(pendingOrientation.beta - anchorOrientation.beta);

    var nativeRect = [
      { x: 0, y: 0 },
      { x: PORTAL_W, y: 0 },
      { x: PORTAL_W, y: PORTAL_H },
      { x: 0, y: PORTAL_H },
    ];
    var portalDst = anchorQuad.map(function(p) {
      return { x: p.x + dGamma * PORTAL_SENS, y: p.y + dBeta * PORTAL_SENS };
    });
    portal.style.transform = T.computePortalTransform(nativeRect, portalDst);
    portalPhoto.style.transform = 'translate(' + (dGamma * PHOTO_SENS) + 'px,' + (dBeta * PHOTO_SENS) + 'px)';
  }
```

Also add `window.addEventListener('deviceorientation', onOrientation);` must only be added once — since `startAR` also may run before any anchor, move the permission-only concern out: the listener is added in `onAnchor` (above) which is correct, since orientation deltas are meaningless before there's an anchor to compare against.

- [ ] **Step 2: Manual verification and tuning**

Same phone setup as Task 12. After anchoring, slowly tilt/turn the phone left-right and up-down:
- Confirm the portal frame shifts opposite to the tilt direction (visually "staying" near the real QR location).
- Confirm the photo inside visibly shifts more/differently than the frame, and its edges get clipped by the portal's `overflow: hidden` boundary as you turn — this is the "peek around the corner" effect from the spec.

If the motion feels inverted, too subtle, or too extreme, adjust `PORTAL_SENS` and `PHOTO_SENS` in `public/javascripts/qr/ar.js` and re-test. These constants are expected to need on-device tuning — that's normal, not a bug.

- [ ] **Step 3: Commit**

```bash
git add public/javascripts/qr/ar.js
git commit -m "feat: drive portal and photo parallax from device orientation deltas"
```

---

## Task 14: End-to-end verification checklist

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

```bash
npm test
```
Expected: PASS — all tests across `qr-auth`, `qr-data`, `qr-images`, `qr-portal-transform`.

- [ ] **Step 2: Full manual walkthrough on a real phone**

1. Set `QR_ADMIN_PASS` in `.env`, start the app, confirm `qr.dimazvali.com` (or its local/staging equivalent) is reachable over HTTPS.
2. Log into `/admin`, create a real entry with a real historical photo, title, year, address, description.
3. Download its QR PNG and either print it or display it full-screen on another device.
4. Open the entry's public URL on a phone, tap "Смотреть в AR", grant camera + motion permissions.
5. Point the camera at the QR — confirm the portal anchors, then confirm tilting the phone produces a visible parallax "peek around the corner" effect, and the fallback photo (no-AR path) still renders correctly on a desktop browser without a camera.
6. Confirm the "навести заново" button correctly resets to scanning mode.
7. Edit the entry (change title only, leave photo blank) — confirm the photo file is untouched and the title updates. Delete the entry — confirm both the JSON record and `public/qr/<slug>/` directory are gone, and the public URL now 404s.

- [ ] **Step 3: No commit for this task** — it's verification only. If anything fails, fix it as a follow-up commit referencing which task's code it belongs to.
