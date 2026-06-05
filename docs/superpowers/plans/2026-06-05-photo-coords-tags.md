# Photo: Координаты и Теги — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить к фотографиям координаты (EXIF или вручную) и теги (справочник + многие-ко-многим), с управлением в админке и фильтрацией на публичном сайте.

**Architecture:** Новый файл `data/photo-tags.json` хранит справочник тегов (slug → label). Каждое фото получает опциональные поля `tags: string[]` и `coords: {lat,lng}`. Новый cache-модуль `lib/photo-tags.js` по образцу `lib/photo-data.js`. Три публичных изменения: страница фото показывает теги, новый маршрут `/tag/:slug` фильтрует галерею.

**Tech Stack:** Node.js/Express, Pug, `exifr` (EXIF GPS extraction), existing `lib/photo-data.js` pattern.

---

## File Map

| Действие | Файл |
|----------|------|
| Create | `data/photo-tags.json` |
| Create | `lib/photo-tags.js` |
| Modify | `routes/photo-admin.js` |
| Modify | `routes/photo.js` |
| Modify | `views/photo/admin/index.pug` |
| Modify | `views/photo/admin/upload.pug` |
| Create | `views/photo/admin/tags.pug` |
| Modify | `views/photo/photo.pug` |
| Create | `views/photo/tag-gallery.pug` |
| Modify | `public/stylesheets/photo/style.css` |

---

## Task 1: Данные — photo-tags.json и lib/photo-tags.js

**Files:**
- Create: `data/photo-tags.json`
- Create: `lib/photo-tags.js`

- [ ] **Step 1: Создать `data/photo-tags.json`**

```json
{}
```

- [ ] **Step 2: Создать `lib/photo-tags.js`**

```js
var fs = require('fs');
var path = require('path');
var TAGS_PATH = path.join(__dirname, '../data/photo-tags.json');
var _cache = null;

function getTags() {
  if (!_cache) { _cache = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8')); }
  return _cache;
}

function saveTags(obj) {
  _cache = obj;
  fs.writeFileSync(TAGS_PATH, JSON.stringify(obj, null, 2), 'utf8');
}

module.exports = { getTags, saveTags };
```

- [ ] **Step 3: Проверить что файлы созданы, сервер стартует без ошибок**

```
node -e "var t = require('./lib/photo-tags'); console.log(t.getTags())"
```
Ожидается: `{}`

- [ ] **Step 4: Commit**

```bash
git add data/photo-tags.json lib/photo-tags.js
git commit -m "feat(photo): add photo-tags data file and cache module"
```

---

## Task 2: Установить exifr

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Установить пакет**

```bash
npm install exifr
```

- [ ] **Step 2: Убедиться что пакет читает GPS**

```bash
node -e "var exifr = require('exifr'); exifr.gps(Buffer.from('')).then(r => console.log('ok:', r)).catch(() => console.log('ok: no gps'))"
```
Ожидается: `ok: null` или `ok: no gps` (не крэшится).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(photo): install exifr for EXIF GPS extraction"
```

---

## Task 3: Админка — управление тегами

**Files:**
- Modify: `routes/photo-admin.js`
- Create: `views/photo/admin/tags.pug`
- Modify: `views/photo/admin/index.pug`
- Modify: `public/stylesheets/photo/style.css`

- [ ] **Step 1: Добавить require `getTags`/`saveTags` в `routes/photo-admin.js`**

В начало файла, после строки `var { getData, saveData } = require('../lib/photo-data');` добавить:

```js
var { getTags, saveTags } = require('../lib/photo-tags');
```

- [ ] **Step 2: Добавить маршруты тегов в `routes/photo-admin.js`**

Перед строкой `module.exports = router;` добавить:

```js
router.get('/tags', requireAuth, (req, res) => {
  var error = req.query.error || null;
  res.render('photo/admin/tags', { tags: getTags(), title: 'Теги — AERO Admin', error });
});

router.post('/tags', requireAuth, (req, res) => {
  var { slug, label } = req.body;
  if (!slug || !label) return res.redirect('/admin/tags');
  var clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, '');
  if (!clean) return res.redirect('/admin/tags');
  var tags = getTags();
  if (!tags[clean]) {
    tags[clean] = { label };
    saveTags(tags);
  }
  res.redirect('/admin/tags');
});

router.post('/tags/:slug/delete', requireAuth, (req, res) => {
  var { slug } = req.params;
  var data = getData();
  var inUse = Object.values(data).some(country =>
    Object.values(country.series).some(series =>
      series.photos.some(p => p.tags && p.tags.includes(slug))
    )
  );
  if (inUse) return res.redirect('/admin/tags?error=inuse');
  var tags = getTags();
  delete tags[slug];
  saveTags(tags);
  res.redirect('/admin/tags');
});
```

- [ ] **Step 3: Создать `views/photo/admin/tags.pug`**

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
        span.admin-logo ТЕГИ

      .admin-section
        h2.admin-title ДОБАВИТЬ ТЕГ
        if error === 'inuse'
          p.admin-error Тег используется в фотографиях, сначала удалите его из фото.
        form.admin-form(method='POST' action='/admin/tags')
          input.admin-input(type='text' name='slug' placeholder='slug (eng, напр. sunrise)')
          input.admin-input(type='text' name='label' placeholder='метка (напр. Рассвет)')
          button.admin-btn(type='submit') + тег

      if Object.keys(tags).length
        .admin-section
          h2.admin-title ВСЕ ТЕГИ (#{Object.keys(tags).length})
          .admin-tag-list
            each tag, slug in tags
              .admin-tag-row
                .admin-tag-info
                  span.admin-tag-slug= slug
                  span.admin-tag-label= tag.label
                form.admin-delete-form(method='POST' action=`/admin/tags/${slug}/delete`)
                  button.admin-btn.admin-btn--danger(type='submit') удалить
```

- [ ] **Step 4: Добавить ссылку на теги в `views/photo/admin/index.pug`**

После строки `a.admin-logout(href='/admin/logout') выйти` добавить:

```pug
        a.admin-link(href='/admin/tags') теги
```

Т.е. блок `.admin-header` станет:

```pug
      .admin-header
        span.admin-logo AERO ADMIN
        a.admin-link(href='/admin/tags') теги
        a.admin-logout(href='/admin/logout') выйти
```

- [ ] **Step 5: Добавить CSS для тегов в `public/stylesheets/photo/style.css`**

В конец файла добавить:

```css
/* admin tags */
.admin-tag-list { display: flex; flex-direction: column; gap: 8px; }
.admin-tag-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.admin-tag-info { display: flex; gap: 12px; flex: 1; align-items: center; }
.admin-tag-slug { font-size: 11px; font-family: monospace; color: var(--text-dim); letter-spacing: 1px; }
.admin-tag-label { font-size: 13px; color: var(--text); }
.admin-error { font-size: 12px; color: #e55; margin-bottom: 12px; }
```

- [ ] **Step 6: Проверить в браузере**

Открыть `http://photo.localhost:3500/admin/tags` — должна открыться страница с формой добавления тега. Добавить тег `sunrise` / `Рассвет`, убедиться что он появляется в списке. Попробовать удалить — должен удалиться без ошибки.

- [ ] **Step 7: Commit**

```bash
git add routes/photo-admin.js views/photo/admin/tags.pug views/photo/admin/index.pug public/stylesheets/photo/style.css
git commit -m "feat(photo): add tags management to admin panel"
```

---

## Task 4: Загрузка фото — теги и координаты

**Files:**
- Modify: `routes/photo-admin.js`
- Modify: `views/photo/admin/upload.pug`
- Modify: `public/stylesheets/photo/style.css`

- [ ] **Step 1: Добавить require `exifr` в `routes/photo-admin.js`**

После строки `var sharp = require('sharp');` добавить:

```js
var exifr = require('exifr');
```

- [ ] **Step 2: Обновить GET upload — передать список тегов**

Найти в `routes/photo-admin.js` блок:
```js
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
```

Заменить на:
```js
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
    tags: getTags(),
  });
});
```

- [ ] **Step 3: Обновить POST upload — сохранять теги и координаты**

Найти в `routes/photo-admin.js` строку:
```js
  var { title, date, desc } = req.body;
```

Заменить на:
```js
  var { title, date, desc } = req.body;
  var tags = req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags]) : [];
  var latRaw = parseFloat(req.body.lat);
  var lngRaw = parseFloat(req.body.lng);
  var coords = null;
  if (!isNaN(latRaw) && !isNaN(lngRaw)) {
    coords = { lat: latRaw, lng: lngRaw };
  } else {
    try {
      var gps = await exifr.gps(req.file.buffer);
      if (gps) coords = { lat: gps.latitude, lng: gps.longitude };
    } catch (e) {}
  }
```

Найти блок `data[country].series[series].photos.push({`:
```js
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
```

Заменить на:
```js
    var photoEntry = {
      id,
      title: title || baseName,
      date: date || '',
      desc: desc || '',
      urls: {
        preview: `${base}/${path800}`,
        full: `${base}/${path2400}`,
      },
    };
    if (tags.length) photoEntry.tags = tags;
    if (coords) photoEntry.coords = coords;
    data[country].series[series].photos.push(photoEntry);
```

- [ ] **Step 4: Обновить `views/photo/admin/upload.pug`**

Заменить полностью содержимое файла на:

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
          .admin-coords
            input.admin-input(type='text' name='lat' placeholder='широта (напр. 41.693)')
            input.admin-input(type='text' name='lng' placeholder='долгота (напр. 44.801)')
          p.admin-hint Координаты заполняются из EXIF автоматически если не заданы вручную.
          if tags && Object.keys(tags).length
            .admin-tags-select
              p.admin-hint ТЕГИ:
              each tag, slug in tags
                label.admin-tag-check
                  input(type='checkbox' name='tags' value=slug)
                  span= tag.label
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
                  if photo.tags && photo.tags.length
                    span.admin-photo-tags= photo.tags.join(', ')
                form.admin-delete-form(method='POST' action=`/admin/${country}/${series}/${photo.id}/delete`)
                  button.admin-btn.admin-btn--danger(type='submit') удалить
```

- [ ] **Step 5: Добавить CSS для полей загрузки**

В конец `public/stylesheets/photo/style.css` добавить:

```css
/* upload form extras */
.admin-coords { display: flex; gap: 8px; }
.admin-coords .admin-input { flex: 1; }
.admin-tags-select { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 8px 0; }
.admin-tag-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); cursor: pointer; }
.admin-tag-check input { cursor: pointer; }
.admin-photo-tags { font-size: 10px; color: var(--text-dim); font-family: monospace; letter-spacing: 1px; }
```

- [ ] **Step 6: Проверить в браузере**

Открыть форму загрузки фото. Должны появиться поля координат и список чекбоксов тегов (если теги есть в справочнике). Загрузить тестовое фото с выбранными тегами, убедиться что в `data/photo.json` у нового фото есть поле `tags`.

- [ ] **Step 7: Commit**

```bash
git add routes/photo-admin.js views/photo/admin/upload.pug public/stylesheets/photo/style.css
git commit -m "feat(photo): add tags and coords to photo upload form"
```

---

## Task 5: Публичный сайт — галерея по тегу

**Files:**
- Modify: `routes/photo.js`
- Create: `views/photo/tag-gallery.pug`

- [ ] **Step 1: Добавить require `getTags` в `routes/photo.js`**

После строки `var { getData } = require('../lib/photo-data');` добавить:

```js
var { getTags } = require('../lib/photo-tags');
```

- [ ] **Step 2: Добавить маршрут `/tag/:slug` в `routes/photo.js`**

Добавить ПЕРЕД маршрутом `router.get('/:country/:series', ...)`. Найти эту строку:

```js
// GET /:country/:series — filtered gallery
```

Вставить перед ней:

```js
// GET /tag/:slug — gallery filtered by tag
router.get('/tag/:slug', (req, res) => {
  var { slug } = req.params;
  var tags = getTags();
  if (!tags[slug]) return res.status(404).render('error', { message: 'Not found', error: {} });
  var photos = getAllPhotos().filter(p => p.tags && p.tags.includes(slug));
  res.render('photo/tag-gallery', {
    data: getData(),
    activeCountry: null,
    activeSeries: null,
    tagLabel: tags[slug].label,
    tagSlug: slug,
    photos,
    title: `${tags[slug].label} — AERO`,
  });
});

```

- [ ] **Step 3: Создать `views/photo/tag-gallery.pug`**

```pug
extends layout

block content
  .gallery-header
    span.gallery-label ТЕГ: #{tagLabel.toUpperCase()} · #{photos.length} фото
  .masonry
    each photo in photos
      a.photo-card(href=`/${photo.countryKey}/${photo.seriesKey}/${photo.id}`)
        img(
          src=photo.urls ? photo.urls.preview : `/images/photo/${photo.countryKey}/${photo.seriesKey}/${photo.file}`
          alt=photo.title
          loading='lazy'
          onerror="this.style.background='#1e1e1e';this.removeAttribute('src')"
        )
        .photo-overlay
          span.photo-title= photo.title
          if photo.date
            span.photo-date= photo.date
```

- [ ] **Step 4: Проверить**

Создать тег в `/admin/tags`, добавить фото с этим тегом через форму загрузки, затем открыть `http://photo.localhost:3500/tag/<slug>` — должна появиться галерея с этим фото.

- [ ] **Step 5: Commit**

```bash
git add routes/photo.js views/photo/tag-gallery.pug
git commit -m "feat(photo): add /tag/:slug public gallery route"
```

---

## Task 6: Публичный сайт — теги на странице фото

**Files:**
- Modify: `routes/photo.js`
- Modify: `views/photo/photo.pug`
- Modify: `public/stylesheets/photo/style.css`

- [ ] **Step 1: Передать `allTags` в шаблон фото**

В `routes/photo.js` найти `res.render('photo/photo', {` (в маршруте `/:country/:series/:id`) и добавить в объект:

```js
    allTags: getTags(),
```

Итого вызов `res.render` станет:

```js
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
    allTags: getTags(),
    title: `${photo.title} — AERO`,
  });
```

- [ ] **Step 2: Обновить `views/photo/photo.pug` — добавить блок тегов**

Найти строку:
```pug
    if photo.desc
      p.photo-page-desc= photo.desc
```

Заменить на:
```pug
    if photo.desc
      p.photo-page-desc= photo.desc
    if photo.tags && photo.tags.length
      .photo-tags
        each tag in photo.tags
          a.photo-tag(href=`/tag/${tag}`)= allTags[tag] ? allTags[tag].label.toUpperCase() : tag.toUpperCase()
```

- [ ] **Step 3: Добавить CSS для тегов на странице фото**

В конец `public/stylesheets/photo/style.css` добавить:

```css
/* photo page tags */
.photo-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.photo-tag {
  font-size: 9px;
  letter-spacing: 2px;
  font-family: monospace;
  color: var(--text-dim);
  border: 1px solid var(--border);
  padding: 3px 10px;
  text-decoration: none;
}
.photo-tag:hover { color: var(--text); border-color: var(--text-muted); }
```

- [ ] **Step 4: Проверить в браузере**

Открыть страницу фото у которого есть теги — должны появиться кнопки-теги под описанием. Кликнуть тег — должна открыться галерея `/tag/:slug` с этим фото.

- [ ] **Step 5: Commit**

```bash
git add routes/photo.js views/photo/photo.pug public/stylesheets/photo/style.css
git commit -m "feat(photo): show clickable tags on photo page"
```
