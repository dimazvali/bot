# Photo Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить защищённую Telegram-стилем админ-панель для управления странами, сериями и загрузки фото с ресайзом в WebP на Firebase Storage.

**Architecture:** Sub-роутер `routes/photo-admin.js` монтируется в `routes/photo.js` на `/admin`. Данные хранятся в `data/photo.json` через `lib/photo-data.js` с in-memory кэшем. Firebase Storage (`dimazvalimisc`, bucket из env) принимает ресайзнутые WebP через `sharp`+`multer`.

**Tech Stack:** Node.js, Express, firebase-admin (уже установлен), sharp (новый), multer (новый), Pug.

---

## File Map

| Файл | Действие | Ответственность |
|------|----------|-----------------|
| `lib/photo-data.js` | Создать | getData() / saveData() с кэшем |
| `routes/photo.js` | Изменить | Использовать getData(), монтировать admin-роутер |
| `routes/photo-admin.js` | Создать | Auth + все admin-роуты |
| `views/photo/admin/login.pug` | Создать | Форма логина |
| `views/photo/admin/index.pug` | Создать | Список стран/серий + формы создания |
| `views/photo/admin/upload.pug` | Создать | Форма загрузки фото |
| `views/photo/gallery.pug` | Изменить | Fallback на photo.urls.preview |
| `views/photo/photo.pug` | Изменить | Fallback на photo.urls.full |
| `public/stylesheets/photo/style.css` | Изменить | Стили для admin-страниц |

---

## Task 1: Установить зависимости

**Files:** `package.json`

- [ ] **Установить sharp и multer**

```bash
cd C:\Users\dshestakov\node\bot
npm install sharp multer
```

Ожидаемый результат: `added N packages` без ошибок.

- [ ] **Добавить переменные окружения в `.env`**

Открыть `C:\Users\dshestakov\node\bot\.env` и добавить в конец:

```
PHOTO_ADMIN_PASS=замени_на_свой_пароль
PHOTO_BUCKET=photo-dimazvalimisc
```

- [ ] **Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(photo-admin): install sharp and multer"
```

---

## Task 2: `lib/photo-data.js` — кэш данных

**Files:**
- Create: `lib/photo-data.js`

- [ ] **Создать директорию и файл**

```bash
mkdir -p lib
```

```js
// lib/photo-data.js
var fs = require('fs');
var path = require('path');

var DATA_PATH = path.join(__dirname, '../data/photo.json');
var _cache = null;

function getData() {
  if (!_cache) {
    _cache = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  }
  return _cache;
}

function saveData(obj) {
  _cache = obj;
  fs.writeFileSync(DATA_PATH, JSON.stringify(obj, null, 2), 'utf8');
}

module.exports = { getData, saveData };
```

- [ ] **Commit**

```bash
git add lib/photo-data.js
git commit -m "feat(photo-admin): add photo-data cache module"
```

---

## Task 3: Обновить `routes/photo.js`

**Files:**
- Modify: `routes/photo.js`

- [ ] **Заменить содержимое файла**

```js
var express = require('express');
var router = express.Router();
var path = require('path');
var { getData } = require('../lib/photo-data');

router.use(express.static(path.join(__dirname, '../public')));

// Admin router must be mounted BEFORE wildcard routes
router.use('/admin', require('./photo-admin'));

function getAllPhotos() {
  var data = getData();
  var list = [];
  for (var countryKey of Object.keys(data)) {
    var country = data[countryKey];
    for (var seriesKey of Object.keys(country.series)) {
      var series = country.series[seriesKey];
      for (var photo of series.photos) {
        list.push({ countryKey, seriesKey, ...photo });
      }
    }
  }
  return list;
}

// GET / — full gallery (all photos)
router.get('/', (req, res) => {
  var data = getData();
  res.render('photo/gallery', {
    data,
    activeCountry: null,
    activeSeries: null,
    photos: getAllPhotos(),
    title: 'AERO',
  });
});

// GET /about
router.get('/about', (req, res) => {
  res.render('photo/about', { data: getData(), title: 'О себе — AERO' });
});

// GET /:country/:series — filtered gallery
router.get('/:country/:series', (req, res) => {
  var data = getData();
  var { country: countryKey, series: seriesKey } = req.params;
  var country = data[countryKey];
  if (!country) return res.status(404).render('error', { message: 'Not found', error: {} });
  var series = country.series[seriesKey];
  if (!series) return res.status(404).render('error', { message: 'Not found', error: {} });

  res.render('photo/gallery', {
    data,
    activeCountry: countryKey,
    activeSeries: seriesKey,
    photos: series.photos.map(p => ({ countryKey, seriesKey, ...p })),
    title: `${series.label} · ${country.label} — AERO`,
  });
});

// GET /:country/:series/:id — single photo page
router.get('/:country/:series/:id', (req, res) => {
  var data = getData();
  var { country: countryKey, series: seriesKey, id } = req.params;
  var country = data[countryKey];
  if (!country) return res.status(404).render('error', { message: 'Not found', error: {} });
  var series = country.series[seriesKey];
  if (!series) return res.status(404).render('error', { message: 'Not found', error: {} });

  var photos = series.photos;
  var idx = photos.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).render('error', { message: 'Not found', error: {} });

  var photo = photos[idx];
  var prev = idx > 0 ? photos[idx - 1] : null;
  var next = idx < photos.length - 1 ? photos[idx + 1] : null;

  res.render('photo/photo', {
    data,
    activeCountry: countryKey,
    activeSeries: seriesKey,
    photo,
    prev,
    next,
    countryKey,
    seriesKey,
    countryLabel: country.label,
    seriesLabel: series.label,
    title: `${photo.title} — AERO`,
  });
});

module.exports = router;
```

- [ ] **Commit**

```bash
git add routes/photo.js
git commit -m "feat(photo-admin): refactor photo router to use getData cache"
```

---

## Task 4: `routes/photo-admin.js`

**Files:**
- Create: `routes/photo-admin.js`

- [ ] **Создать файл**

```js
var express = require('express');
var router = express.Router();
var path = require('path');
var multer = require('multer');
var sharp = require('sharp');
var { getData, saveData } = require('../lib/photo-data');

var { initializeApp, getApps } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { getStorage } = require('firebase-admin/storage');
var { cert } = require('firebase-admin/app');

// Initialize Firebase app named 'photo' (reuse if already initialized)
var photoApp = getApps().find(a => a.name === 'photo') || initializeApp({
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
var bucket = getStorage(photoApp).bucket();
var adminTokens = fb.collection('PHOTOadminTokens');

var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only images allowed'));
    cb(null, true);
  },
});

function slugify(str) {
  var map = {
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'j',
    к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
    х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
  };
  return str.toLowerCase()
    .split('').map(c => map[c] !== undefined ? map[c] : c).join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function uniqueId(base, existingIds) {
  if (!existingIds.includes(base)) return base;
  var n = 2;
  while (existingIds.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────

async function requireAuth(req, res, next) {
  var tokenId = req.signedCookies && req.signedCookies.photoAdminToken;
  if (!tokenId) return res.redirect('/admin/login');
  try {
    var doc = await adminTokens.doc(tokenId).get();
    if (!doc.exists) return res.redirect('/admin/login');
    next();
  } catch (e) {
    res.redirect('/admin/login');
  }
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────

router.get('/login', (req, res) => {
  res.render('photo/admin/login', { title: 'Вход — AERO Admin', error: null });
});

router.post('/login', async (req, res) => {
  var { pass } = req.body;
  if (!pass || pass !== process.env.PHOTO_ADMIN_PASS) {
    return res.render('photo/admin/login', { title: 'Вход — AERO Admin', error: 'Неверный пароль' });
  }
  var doc = await adminTokens.add({ createdAt: new Date() });
  res.cookie('photoAdminToken', doc.id, { signed: true, httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.redirect('/admin');
});

router.get('/logout', async (req, res) => {
  var tokenId = req.signedCookies && req.signedCookies.photoAdminToken;
  if (tokenId) {
    try { await adminTokens.doc(tokenId).delete(); } catch (e) {}
  }
  res.clearCookie('photoAdminToken');
  res.redirect('/admin/login');
});

// ── INDEX — список стран и серий ──────────────────────────────────────────────

router.get('/', requireAuth, (req, res) => {
  res.render('photo/admin/index', { data: getData(), title: 'AERO Admin' });
});

// ── CREATE COUNTRY ────────────────────────────────────────────────────────────

router.post('/country', requireAuth, (req, res) => {
  var { key, label } = req.body;
  if (!key || !label) return res.redirect('/admin');
  var data = getData();
  var k = slugify(key);
  if (!data[k]) {
    data[k] = { label, series: {} };
    saveData(data);
  }
  res.redirect('/admin');
});

// ── CREATE SERIES ─────────────────────────────────────────────────────────────

router.post('/series/:country', requireAuth, (req, res) => {
  var { country } = req.params;
  var { key, label } = req.body;
  if (!key || !label) return res.redirect('/admin');
  var data = getData();
  if (!data[country]) return res.redirect('/admin');
  var k = slugify(key);
  if (!data[country].series[k]) {
    data[country].series[k] = { label, photos: [] };
    saveData(data);
  }
  res.redirect('/admin');
});

// ── UPLOAD FORM ───────────────────────────────────────────────────────────────

router.get('/:country/:series/upload', requireAuth, (req, res) => {
  var { country, series } = req.params;
  var data = getData();
  if (!data[country] || !data[country].series[series]) return res.redirect('/admin');
  res.render('photo/admin/upload', {
    title: 'Загрузка — AERO Admin',
    country,
    series,
    seriesLabel: data[country].series[series].label,
    countryLabel: data[country].label,
    photos: data[country].series[series].photos,
  });
});

// ── UPLOAD PHOTO ──────────────────────────────────────────────────────────────

router.post('/:country/:series/upload', requireAuth, upload.single('photo'), async (req, res) => {
  var { country, series } = req.params;
  var { title, date, desc } = req.body;
  var data = getData();

  if (!data[country] || !data[country].series[series]) return res.redirect('/admin');
  if (!req.file) return res.redirect(`/admin/${country}/${series}/upload`);

  try {
    var baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    var existingIds = data[country].series[series].photos.map(p => p.id);
    var id = uniqueId(slugify(baseName), existingIds);

    var [buf800, buf2400] = await Promise.all([
      sharp(req.file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
      sharp(req.file.buffer).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
    ]);

    var path800 = `${country}/${series}/${id}-800.webp`;
    var path2400 = `${country}/${series}/${id}-2400.webp`;

    await Promise.all([
      bucket.file(path800).save(buf800, { contentType: 'image/webp' }).then(() => bucket.file(path800).makePublic()),
      bucket.file(path2400).save(buf2400, { contentType: 'image/webp' }).then(() => bucket.file(path2400).makePublic()),
    ]);

    var base = `https://storage.googleapis.com/${process.env.PHOTO_BUCKET}`;
    data[country].series[series].photos.push({
      id,
      title: title || baseName,
      date: date || '',
      desc: desc || '',
      urls: {
        preview: `${base}/${path800}`,
        full: `${base}/${path2400}`,
      },
    });
    saveData(data);

    res.redirect(`/admin/${country}/${series}/upload`);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('Ошибка при загрузке: ' + err.message);
  }
});

// ── DELETE PHOTO ──────────────────────────────────────────────────────────────

router.post('/:country/:series/:id/delete', requireAuth, async (req, res) => {
  var { country, series, id } = req.params;
  var data = getData();
  if (!data[country] || !data[country].series[series]) return res.redirect('/admin');

  var photos = data[country].series[series].photos;
  var idx = photos.findIndex(p => p.id === id);
  if (idx === -1) return res.redirect('/admin');

  var photo = photos[idx];
  if (photo.urls) {
    try {
      await Promise.all([
        bucket.file(`${country}/${series}/${id}-800.webp`).delete(),
        bucket.file(`${country}/${series}/${id}-2400.webp`).delete(),
      ]);
    } catch (e) {}
  }

  data[country].series[series].photos.splice(idx, 1);
  saveData(data);
  res.redirect('/admin');
});

module.exports = router;
```

- [ ] **Commit**

```bash
git add routes/photo-admin.js
git commit -m "feat(photo-admin): add admin router with auth, CRUD, upload"
```

---

## Task 5: Admin Pug templates

**Files:**
- Create: `views/photo/admin/login.pug`
- Create: `views/photo/admin/index.pug`
- Create: `views/photo/admin/upload.pug`

- [ ] **Создать директорию**

```bash
mkdir -p views/photo/admin
```

- [ ] **Создать `views/photo/admin/login.pug`**

```pug
doctype html
html(data-theme='dark')
  head
    title= title
    meta(name='viewport' content='width=device-width, initial-scale=1.0')
    link(rel='stylesheet' href='/stylesheets/photo/style.css')
  body
    .admin-login
      .admin-login-box
        .admin-logo AERO
        span.admin-sub ADMIN
        if error
          p.admin-error= error
        form(method='POST' action='/admin/login')
          input.admin-input(type='password' name='pass' placeholder='пароль' autofocus)
          button.admin-btn(type='submit') ВОЙТИ
```

- [ ] **Создать `views/photo/admin/index.pug`**

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
        span.admin-logo AERO ADMIN
        a.admin-logout(href='/admin/logout') выйти

      .admin-section
        h2.admin-title СТРАНЫ
        each country, countryKey in data
          .admin-country
            .admin-country-name #{country.label} (#{countryKey})
            .admin-series-list
              each series, seriesKey in country.series
                .admin-series-row
                  span.admin-series-name #{series.label} (#{seriesKey}) — #{series.photos.length} фото
                  a.admin-link(href=`/admin/${countryKey}/${seriesKey}/upload`) загрузить
            form.admin-form(method='POST' action=`/admin/series/${countryKey}`)
              input.admin-input(type='text' name='key' placeholder='ключ (eng)')
              input.admin-input(type='text' name='label' placeholder='название')
              button.admin-btn(type='submit') + серия

        form.admin-form.admin-form--country(method='POST' action='/admin/country')
          h3.admin-subtitle ДОБАВИТЬ СТРАНУ
          input.admin-input(type='text' name='key' placeholder='ключ (eng, напр. georgia)')
          input.admin-input(type='text' name='label' placeholder='название (напр. Грузия)')
          button.admin-btn(type='submit') + страна
```

- [ ] **Создать `views/photo/admin/upload.pug`**

Роутер должен передавать `photos` в шаблон — добавить в GET `/:country/:series/upload`:
```js
photos: data[country].series[series].photos,
```

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
        span.admin-logo #{countryLabel} · #{seriesLabel}

      .admin-section
        h2.admin-title ЗАГРУЗИТЬ ФОТО
        p.admin-hint Файл будет конвертирован в WebP и загружен в Firebase Storage в двух размерах (800px и 2400px).
        form.admin-form(method='POST' action=`/admin/${country}/${series}/upload` enctype='multipart/form-data')
          input.admin-input(type='file' name='photo' accept='image/*' required)
          input.admin-input(type='text' name='title' placeholder='название снимка')
          input.admin-input(type='text' name='date' placeholder='дата (напр. Май 2024)')
          textarea.admin-input(name='desc' placeholder='описание (необязательно)' rows='3')
          button.admin-btn(type='submit') ЗАГРУЗИТЬ

      if photos && photos.length
        .admin-section
          h2.admin-title ФОТО В СЕРИИ (#{photos.length})
          .admin-photo-list
            each photo in photos
              .admin-photo-row
                if photo.urls
                  img.admin-thumb(src=photo.urls.preview alt=photo.title)
                .admin-photo-info
                  span.admin-photo-title= photo.title
                  span.admin-photo-id= photo.id
                form.admin-delete-form(method='POST' action=`/admin/${country}/${series}/${photo.id}/delete`)
                  button.admin-btn.admin-btn--danger(type='submit') удалить
```

- [ ] **Commit**

```bash
git add views/photo/admin/
git commit -m "feat(photo-admin): add admin Pug templates"
```

---

## Task 6: Обновить gallery.pug и photo.pug (fallback на Firebase URLs)

**Files:**
- Modify: `views/photo/gallery.pug`
- Modify: `views/photo/photo.pug`

- [ ] **Обновить `views/photo/gallery.pug`** — изменить src у img:

Было:
```pug
        img(
          src=`/images/photo/${photo.countryKey}/${photo.seriesKey}/${photo.file}`
          alt=photo.title
          loading='lazy'
          onerror="this.style.background='#1e1e1e';this.removeAttribute('src')"
        )
```

Стало:
```pug
        img(
          src=photo.urls ? photo.urls.preview : `/images/photo/${photo.countryKey}/${photo.seriesKey}/${photo.file}`
          alt=photo.title
          loading='lazy'
          onerror="this.style.background='#1e1e1e';this.removeAttribute('src')"
        )
```

- [ ] **Обновить `views/photo/photo.pug`** — изменить src у img:

Было:
```pug
      img(
        src=`/images/photo/${countryKey}/${seriesKey}/${photo.file}`
        alt=photo.title
        onerror="this.style.background='#1e1e1e';this.removeAttribute('src')"
      )
```

Стало:
```pug
      img(
        src=photo.urls ? photo.urls.full : `/images/photo/${countryKey}/${seriesKey}/${photo.file}`
        alt=photo.title
        onerror="this.style.background='#1e1e1e';this.removeAttribute('src')"
      )
```

- [ ] **Commit**

```bash
git add views/photo/gallery.pug views/photo/photo.pug
git commit -m "feat(photo-admin): add Firebase URL fallback in gallery and photo templates"
```

---

## Task 7: CSS для admin-страниц

**Files:**
- Modify: `public/stylesheets/photo/style.css`

- [ ] **Добавить в конец `public/stylesheets/photo/style.css`**

```css
/* ─── ADMIN ──────────────────────────────────────────────────── */
.admin-login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}
.admin-login-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 240px;
}
.admin-logo { font-family: monospace; font-size: 13px; letter-spacing: 4px; color: var(--accent); }
.admin-sub  { font-size: 9px; letter-spacing: 3px; color: var(--text-dim); font-family: monospace; }
.admin-error { font-size: 11px; color: #c44; font-family: monospace; }

.admin-wrap { max-width: 720px; margin: 0 auto; padding: 24px; }

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.admin-logout, .admin-back { font-size: 9px; letter-spacing: 2px; color: var(--text-dim); font-family: monospace; }
.admin-logout:hover, .admin-back:hover { color: var(--text); }

.admin-section { margin-bottom: 32px; }
.admin-title { font-size: 9px; letter-spacing: 3px; color: var(--text-muted); font-family: monospace; margin-bottom: 16px; }
.admin-subtitle { font-size: 9px; letter-spacing: 2px; color: var(--text-dim); font-family: monospace; margin-bottom: 10px; margin-top: 24px; }
.admin-hint { font-size: 11px; color: var(--text-dim); margin-bottom: 16px; line-height: 1.6; }

.admin-country { margin-bottom: 24px; padding: 14px; border: 1px solid var(--border); }
.admin-country-name { font-size: 11px; color: var(--accent); font-family: monospace; letter-spacing: 1px; margin-bottom: 10px; }
.admin-series-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.admin-series-row { display: flex; justify-content: space-between; align-items: center; }
.admin-series-name { font-size: 10px; color: var(--text); }
.admin-link { font-size: 9px; letter-spacing: 1px; color: var(--text-dim); font-family: monospace; border: 1px solid var(--border); padding: 3px 8px; }
.admin-link:hover { color: var(--accent); border-color: var(--text-muted); }

.admin-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; }
.admin-form--country { margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border); flex-direction: column; align-items: flex-start; }

.admin-input {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 6px 10px;
  font-size: 11px;
  font-family: monospace;
  outline: none;
  width: 100%;
}
.admin-input:focus { border-color: var(--text-muted); }
textarea.admin-input { resize: vertical; }

.admin-btn {
  background: none;
  border: 1px solid var(--text-dim);
  color: var(--text);
  padding: 6px 16px;
  font-size: 9px;
  letter-spacing: 2px;
  font-family: monospace;
  cursor: pointer;
  white-space: nowrap;
}
.admin-btn:hover { border-color: var(--accent); color: var(--accent); }
.admin-btn--danger { border-color: #3a1a1a; color: #c44; }
.admin-btn--danger:hover { border-color: #c44; color: #f55; }

.admin-photo-list { display: flex; flex-direction: column; gap: 8px; }
.admin-photo-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border: 1px solid var(--border);
}
.admin-thumb { width: 80px; height: 50px; object-fit: cover; background: var(--border); flex-shrink: 0; }
.admin-photo-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.admin-photo-title { font-size: 11px; color: var(--text); }
.admin-photo-id { font-size: 9px; color: var(--text-dim); font-family: monospace; }
.admin-delete-form { flex-shrink: 0; }
```

- [ ] **Commit**

```bash
git add public/stylesheets/photo/style.css
git commit -m "feat(photo-admin): add admin CSS"
```

---

## Task 8: Проверка

- [ ] **Перезапустить сервер**

- [ ] **Проверить логин**

Открыть `http://photo.localhost:3500/admin/login` → ввести пароль из `.env` → должен перенаправить на `/admin`.

- [ ] **Проверить создание страны**

На странице `/admin` заполнить форму «Добавить страну» → нажать `+ страна` → страна должна появиться в списке.

- [ ] **Проверить создание серии**

В блоке страны заполнить форму `+ серия` → серия должна появиться.

- [ ] **Проверить загрузку фото**

Перейти на `/admin/{country}/{series}/upload` → выбрать JPG/PNG → заполнить название → нажать ЗАГРУЗИТЬ.

Ожидаемый результат: фото появляется в Firebase Storage bucket, запись добавляется в `data/photo.json` с полем `urls`, фото видно в галерее на `http://photo.localhost:3500/{country}/{series}`.

- [ ] **Проверить удаление**

На главной админки нажать «удалить» (POST `/:country/:series/:id/delete`) → фото пропадает из json и Storage.
