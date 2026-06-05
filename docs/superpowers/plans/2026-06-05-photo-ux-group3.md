# Photo UX Group 3 — Admin Content Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полное управление контентом в админке: архивирование, переименование, drag-and-drop сортировка серий и фотографий, редактирование метаданных фотографий.

**Architecture:** Два новых поля в `photo.json` (`archived`, `seriesOrder`), семь задач: фильтрация публичных роутов, ссылки редактирования в индексе, страницы редактирования страны/серии/фото с SortableJS drag-and-drop. Все новые маршруты в `routes/photo-admin.js`. Маршруты `/country/:key/...` должны регистрироваться ДО `/:country/:series/...` чтобы избежать конфликта путей.

**Tech Stack:** Node.js/Express, Pug, SortableJS 1.15.0 (CDN), vanilla JS (fetch), CSS custom properties.

---

## File Map

| Действие | Файл |
|----------|------|
| Modify | `routes/photo.js` |
| Modify | `views/photo/layout.pug` |
| Modify | `views/photo/admin/index.pug` |
| Modify | `public/stylesheets/photo/style.css` |
| Modify | `routes/photo-admin.js` |
| Create | `views/photo/admin/country-edit.pug` |
| Create | `views/photo/admin/series-edit.pug` |
| Create | `views/photo/admin/photo-edit.pug` |

---

## Task 1: Фильтрация архивированных элементов на публичном сайте

**Files:**
- Modify: `routes/photo.js`
- Modify: `views/photo/layout.pug`

- [ ] **Step 1: Добавить `getActiveSeries` в `routes/photo.js`**

Найти строку:
```js
function getAllPhotos() {
```

Вставить ПЕРЕД ней:
```js
function getActiveSeries(country) {
  var order = country.seriesOrder || Object.keys(country.series);
  return order.filter(k => country.series[k] && !country.series[k].archived);
}
```

- [ ] **Step 2: Обновить `getAllPhotos()` — пропускать архивированные**

Найти:
```js
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
```

Заменить на:
```js
function getAllPhotos() {
  var data = getData();
  var list = [];
  for (var countryKey of Object.keys(data)) {
    var country = data[countryKey];
    if (country.archived) continue;
    for (var seriesKey of getActiveSeries(country)) {
      var series = country.series[seriesKey];
      for (var photo of series.photos) {
        list.push({ countryKey, seriesKey, ...photo });
      }
    }
  }
  return list;
}
```

- [ ] **Step 3: 404 для архивированных в `GET /:country`**

В `routes/photo.js`, в блоке `router.get('/:country', ...)` найти:
```js
  var country = data[countryKey];
  if (!country) return res.status(404).render('error', { message: 'Not found', error: {} });

  var photos = [];
  for (var seriesKey of Object.keys(country.series)) {
    for (var photo of country.series[seriesKey].photos) {
```

Заменить на:
```js
  var country = data[countryKey];
  if (!country || country.archived) return res.status(404).render('error', { message: 'Not found', error: {} });

  var photos = [];
  for (var seriesKey of getActiveSeries(country)) {
    for (var photo of country.series[seriesKey].photos) {
```

- [ ] **Step 4: 404 для архивированных в `GET /:country/:series`**

В блоке `router.get('/:country/:series', ...)` найти:
```js
  var country = data[countryKey];
  if (!country) return res.status(404).render('error', { message: 'Not found', error: {} });
  var series = country.series[seriesKey];
  if (!series) return res.status(404).render('error', { message: 'Not found', error: {} });
```

Заменить на:
```js
  var country = data[countryKey];
  if (!country || country.archived) return res.status(404).render('error', { message: 'Not found', error: {} });
  var series = country.series[seriesKey];
  if (!series || series.archived) return res.status(404).render('error', { message: 'Not found', error: {} });
```

- [ ] **Step 5: 404 для архивированных в `GET /:country/:series/:id`**

В блоке `router.get('/:country/:series/:id', ...)` найти:
```js
  var country = data[countryKey];
  if (!country) return res.status(404).render('error', { message: 'Not found', error: {} });
  var series = country.series[seriesKey];
  if (!series) return res.status(404).render('error', { message: 'Not found', error: {} });
```

Заменить на:
```js
  var country = data[countryKey];
  if (!country || country.archived) return res.status(404).render('error', { message: 'Not found', error: {} });
  var series = country.series[seriesKey];
  if (!series || series.archived) return res.status(404).render('error', { message: 'Not found', error: {} });
```

- [ ] **Step 6: Обновить сайдбар в `views/photo/layout.pug`**

Найти:
```pug
          each country, countryKey in data
            a.nav-country(
              href=`/${countryKey}`
              class=activeCountry === countryKey ? 'open' : ''
            )
              span.arrow= activeCountry === countryKey ? '▾' : '▸'
              | &nbsp;
              = country.label.toUpperCase()
            if activeCountry === countryKey
              each series, seriesKey in country.series
                a.nav-series(
                  href=`/${countryKey}/${seriesKey}`
                  class=activeSeries === seriesKey ? 'active' : ''
                ) #{series.label}
```

Заменить на:
```pug
          each country, countryKey in data
            if !country.archived
              - var seriesOrder = country.seriesOrder || Object.keys(country.series)
              a.nav-country(
                href=`/${countryKey}`
                class=activeCountry === countryKey ? 'open' : ''
              )
                span.arrow= activeCountry === countryKey ? '▾' : '▸'
                | &nbsp;
                = country.label.toUpperCase()
              if activeCountry === countryKey
                each seriesKey in seriesOrder
                  - var series = country.series[seriesKey]
                  if series && !series.archived
                    a.nav-series(
                      href=`/${countryKey}/${seriesKey}`
                      class=activeSeries === seriesKey ? 'active' : ''
                    ) #{series.label}
```

- [ ] **Step 7: Commit**

```bash
git add routes/photo.js views/photo/layout.pug
git commit -m "feat(photo): filter archived countries and series from public site"
```

---

## Task 2: Ссылки редактирования в admin index + CSS

**Files:**
- Modify: `views/photo/admin/index.pug`
- Modify: `public/stylesheets/photo/style.css`

- [ ] **Step 1: Добавить CSS в конец `public/stylesheets/photo/style.css`**

```css
/* admin content management */
.admin-series-actions { display: flex; gap: 6px; }
.admin-archived { font-size: 9px; letter-spacing: 2px; color: var(--text-dim); font-family: monospace; margin-left: 6px; }
.admin-sort-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.admin-sort-item { display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid var(--border); }
.admin-sort-handle { cursor: grab; color: var(--text-dim); font-size: 16px; flex-shrink: 0; line-height: 1; }
.admin-sort-handle:active { cursor: grabbing; }
.admin-sort-actions { display: flex; gap: 6px; margin-left: auto; }
```

- [ ] **Step 2: Обновить `views/photo/admin/index.pug`**

Найти:
```pug
        each country, countryKey in data
          .admin-country
            .admin-country-name #{country.label} (#{countryKey})
            .admin-series-list
              each series, seriesKey in country.series
                .admin-series-row
                  span.admin-series-name #{series.label} (#{seriesKey}) — #{series.photos.length} фото
                  a.admin-link(href=`/admin/${countryKey}/${seriesKey}/upload`) загрузить
```

Заменить на:
```pug
        each country, countryKey in data
          .admin-country
            .admin-country-name
              span= `${country.label} (${countryKey})`
              if country.archived
                span.admin-archived [архив]
              a.admin-link(href=`/admin/country/${countryKey}/edit` style='margin-left:auto') редактировать
            .admin-series-list
              each series, seriesKey in country.series
                .admin-series-row
                  span.admin-series-name
                    = `${series.label} (${seriesKey}) — ${series.photos.length} фото`
                    if series.archived
                      span.admin-archived [архив]
                  .admin-series-actions
                    a.admin-link(href=`/admin/${countryKey}/${seriesKey}/upload`) загрузить
                    a.admin-link(href=`/admin/${countryKey}/${seriesKey}/edit`) редактировать
```

- [ ] **Step 3: Commit**

```bash
git add views/photo/admin/index.pug public/stylesheets/photo/style.css
git commit -m "feat(photo): add edit links and archived indicators to admin index"
```

---

## Task 3: Страница редактирования страны (без drag-and-drop)

**Files:**
- Create: `views/photo/admin/country-edit.pug`
- Modify: `routes/photo-admin.js` (добавить 4 маршрута ПЕРЕД `POST /series/:country`)

- [ ] **Step 1: Создать `views/photo/admin/country-edit.pug`**

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
        span.admin-logo= country.label
        if error
          span.admin-error= error

      .admin-section
        h2.admin-title ПЕРЕИМЕНОВАТЬ
        form.admin-form(method='POST' action=`/admin/country/${countryKey}/edit`)
          input.admin-input(type='text' name='label' value=country.label placeholder='название страны')
          button.admin-btn(type='submit') СОХРАНИТЬ

      .admin-section
        h2.admin-title ВИДИМОСТЬ
        form.admin-form(method='POST' action=`/admin/country/${countryKey}/archive`)
          button.admin-btn(type='submit')= country.archived ? 'РАЗАРХИВИРОВАТЬ' : 'АРХИВИРОВАТЬ'
        p.admin-hint Архивированная страна скрыта на публичном сайте, но доступна в админке.

      if seriesKeys.length
        .admin-section
          h2.admin-title ПОРЯДОК СЕРИЙ
          p.admin-hint Перетащите серии для изменения порядка отображения.
          ul#series-list.admin-sort-list(data-url=`/admin/country/${countryKey}/reorder-series`)
            each seriesKey in seriesKeys
              - var s = country.series[seriesKey]
              li.admin-sort-item(data-id=seriesKey)
                span.admin-sort-handle ⠿
                span= `${s.label} (${seriesKey})`
                if s.archived
                  span.admin-archived [архив]

      if canDelete
        .admin-section
          h2.admin-title УДАЛИТЬ СТРАНУ
          form.admin-form(method='POST' action=`/admin/country/${countryKey}/delete`)
            button.admin-btn.admin-btn--danger(type='submit') УДАЛИТЬ
      else
        .admin-section
          p.admin-hint Страну можно удалить только если у неё нет серий. Сначала удалите все серии.
```

- [ ] **Step 2: Добавить 4 маршрута в `routes/photo-admin.js`**

Найти строку:
```js
router.post('/series/:country', requireAuth, (req, res) => {
```

Вставить ПЕРЕД ней:
```js
router.get('/country/:key/edit', requireAuth, (req, res) => {
  var { key } = req.params;
  var data = getData();
  var country = data[key];
  if (!country) return res.redirect('/admin');
  var seriesKeys = country.seriesOrder || Object.keys(country.series);
  res.render('photo/admin/country-edit', {
    title: `${country.label} — AERO Admin`,
    countryKey: key,
    country,
    seriesKeys,
    canDelete: Object.keys(country.series).length === 0,
    error: req.query.error || null,
  });
});

router.post('/country/:key/edit', requireAuth, (req, res) => {
  var { key } = req.params;
  var { label } = req.body;
  if (!label || !label.trim()) return res.redirect(`/admin/country/${key}/edit`);
  var data = getData();
  if (!data[key]) return res.redirect('/admin');
  data[key].label = label.trim();
  saveData(data);
  res.redirect(`/admin/country/${key}/edit`);
});

router.post('/country/:key/archive', requireAuth, (req, res) => {
  var { key } = req.params;
  var data = getData();
  if (!data[key]) return res.redirect('/admin');
  data[key].archived = !data[key].archived;
  saveData(data);
  res.redirect(`/admin/country/${key}/edit`);
});

router.post('/country/:key/delete', requireAuth, (req, res) => {
  var { key } = req.params;
  var data = getData();
  if (!data[key]) return res.redirect('/admin');
  if (Object.keys(data[key].series).length > 0) {
    return res.redirect(`/admin/country/${key}/edit?error=Удалите все серии перед удалением страны`);
  }
  delete data[key];
  saveData(data);
  res.redirect('/admin');
});
```

- [ ] **Step 3: Commit**

```bash
git add routes/photo-admin.js views/photo/admin/country-edit.pug
git commit -m "feat(photo): add country edit page with rename, archive, and delete"
```

---

## Task 4: Drag-and-drop сортировка серий

**Files:**
- Modify: `routes/photo-admin.js` (добавить 1 маршрут ПЕРЕД `POST /series/:country`)
- Modify: `views/photo/admin/country-edit.pug` (добавить SortableJS)

- [ ] **Step 1: Добавить маршрут reorder-series**

Найти:
```js
router.post('/series/:country', requireAuth, (req, res) => {
```

Вставить ПЕРЕД ней:
```js
router.post('/country/:key/reorder-series', requireAuth, express.json(), (req, res) => {
  var { key } = req.params;
  var { order } = req.body;
  var data = getData();
  if (!data[key] || !Array.isArray(order)) return res.status(400).json({ ok: false });
  var validKeys = Object.keys(data[key].series);
  if (!order.every(k => validKeys.includes(k))) return res.status(400).json({ ok: false });
  data[key].seriesOrder = order;
  saveData(data);
  res.json({ ok: true });
});
```

- [ ] **Step 2: Добавить SortableJS в `views/photo/admin/country-edit.pug`**

В конце файла добавить (после последней секции, перед закрывающим тегом `body` — в Pug это просто в конце файла на том же уровне отступа, что `.admin-wrap`):
```pug
    script(src='https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js')
    script.
      var list = document.getElementById('series-list');
      if (list) {
        var reorderUrl = list.getAttribute('data-url');
        Sortable.create(list, {
          handle: '.admin-sort-handle',
          animation: 150,
          onEnd: function() {
            var order = Array.from(list.querySelectorAll('.admin-sort-item')).map(function(el) {
              return el.getAttribute('data-id');
            });
            fetch(reorderUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order: order }),
            });
          },
        });
      }
```

- [ ] **Step 3: Commit**

```bash
git add routes/photo-admin.js views/photo/admin/country-edit.pug
git commit -m "feat(photo): add drag-and-drop series reordering in country edit"
```

---

## Task 5: Страница редактирования серии (без drag-and-drop)

**Files:**
- Create: `views/photo/admin/series-edit.pug`
- Modify: `routes/photo-admin.js` (добавить 4 маршрута В КОНЕЦ файла, ПОСЛЕ `/tags/:slug/delete`)

Важно: `/:country/:series/delete` должен быть зарегистрирован ПОСЛЕ `/tags/:slug/delete`, иначе запрос `POST /admin/tags/slug/delete` будет перехвачен с `country=tags`.

- [ ] **Step 1: Создать `views/photo/admin/series-edit.pug`**

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
        a.admin-back(href=`/admin/country/${countryKey}/edit`) ← назад
        span.admin-logo #{countryLabel} · #{series.label}

      .admin-section
        h2.admin-title ПЕРЕИМЕНОВАТЬ
        form.admin-form(method='POST' action=`/admin/${countryKey}/${seriesKey}/edit`)
          input.admin-input(type='text' name='label' value=series.label placeholder='название серии')
          button.admin-btn(type='submit') СОХРАНИТЬ

      .admin-section
        h2.admin-title ВИДИМОСТЬ
        form.admin-form(method='POST' action=`/admin/${countryKey}/${seriesKey}/archive`)
          button.admin-btn(type='submit')= series.archived ? 'РАЗАРХИВИРОВАТЬ' : 'АРХИВИРОВАТЬ'
        p.admin-hint Архивированная серия скрыта на публичном сайте, но доступна в админке.

      if series.photos.length
        .admin-section
          h2.admin-title ФОТО (#{series.photos.length})
          p.admin-hint Перетащите для изменения порядка.
          ul#photo-list.admin-sort-list(data-url=`/admin/${countryKey}/${seriesKey}/reorder-photos`)
            each photo in series.photos
              li.admin-sort-item(data-id=photo.id)
                span.admin-sort-handle ⠿
                if photo.urls
                  img.admin-thumb(src=photo.urls.preview alt=photo.title)
                .admin-photo-info
                  span.admin-photo-title= photo.title
                  span.admin-photo-id= photo.id
                .admin-sort-actions
                  a.admin-link(href=`/admin/${countryKey}/${seriesKey}/${photo.id}/edit`) ред.
                  form(method='POST' action=`/admin/${countryKey}/${seriesKey}/${photo.id}/delete`)
                    button.admin-btn.admin-btn--danger(type='submit') удалить

      .admin-section
        h2.admin-title УДАЛИТЬ СЕРИЮ
        p.admin-hint Все фотографии будут удалены из Firebase Storage без возможности восстановления.
        form.admin-form(method='POST' action=`/admin/${countryKey}/${seriesKey}/delete`)
          button.admin-btn.admin-btn--danger(type='submit') УДАЛИТЬ СЕРИЮ
```

- [ ] **Step 2: Добавить 4 маршрута в конец `routes/photo-admin.js` перед `module.exports`**

```js
router.get('/:country/:series/edit', requireAuth, (req, res) => {
  var { country, series: seriesKey } = req.params;
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  res.render('photo/admin/series-edit', {
    title: `${data[country].series[seriesKey].label} — AERO Admin`,
    countryKey: country,
    countryLabel: data[country].label,
    seriesKey,
    series: data[country].series[seriesKey],
  });
});

router.post('/:country/:series/edit', requireAuth, (req, res) => {
  var { country, series: seriesKey } = req.params;
  var { label } = req.body;
  if (!label || !label.trim()) return res.redirect(`/admin/${country}/${seriesKey}/edit`);
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  data[country].series[seriesKey].label = label.trim();
  saveData(data);
  res.redirect(`/admin/${country}/${seriesKey}/edit`);
});

router.post('/:country/:series/archive', requireAuth, (req, res) => {
  var { country, series: seriesKey } = req.params;
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  data[country].series[seriesKey].archived = !data[country].series[seriesKey].archived;
  saveData(data);
  res.redirect(`/admin/${country}/${seriesKey}/edit`);
});

router.post('/:country/:series/delete', requireAuth, async (req, res) => {
  var { country, series: seriesKey } = req.params;
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  var photos = data[country].series[seriesKey].photos;
  await Promise.all(photos.map(function(p) {
    return Promise.all([
      bucket.file(`${country}/${seriesKey}/${p.id}-800.webp`).delete().catch(function() {}),
      bucket.file(`${country}/${seriesKey}/${p.id}-2400.webp`).delete().catch(function() {}),
    ]);
  }));
  if (data[country].seriesOrder) {
    data[country].seriesOrder = data[country].seriesOrder.filter(function(k) { return k !== seriesKey; });
  }
  delete data[country].series[seriesKey];
  saveData(data);
  res.redirect('/admin');
});
```

- [ ] **Step 3: Commit**

```bash
git add routes/photo-admin.js views/photo/admin/series-edit.pug
git commit -m "feat(photo): add series edit page with rename, archive, and delete"
```

---

## Task 6: Drag-and-drop сортировка фотографий

**Files:**
- Modify: `routes/photo-admin.js` (добавить 1 маршрут перед `module.exports`)
- Modify: `views/photo/admin/series-edit.pug` (добавить SortableJS)

- [ ] **Step 1: Добавить маршрут reorder-photos в конец `routes/photo-admin.js` перед `module.exports`**

```js
router.post('/:country/:series/reorder-photos', requireAuth, express.json(), (req, res) => {
  var { country, series: seriesKey } = req.params;
  var { order } = req.body;
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey] || !Array.isArray(order)) {
    return res.status(400).json({ ok: false });
  }
  var photos = data[country].series[seriesKey].photos;
  var photoMap = {};
  photos.forEach(function(p) { photoMap[p.id] = p; });
  var validIds = photos.map(function(p) { return p.id; });
  if (!order.every(function(id) { return validIds.includes(id); })) {
    return res.status(400).json({ ok: false });
  }
  data[country].series[seriesKey].photos = order.map(function(id) { return photoMap[id]; });
  saveData(data);
  res.json({ ok: true });
});
```

- [ ] **Step 2: Добавить SortableJS в `views/photo/admin/series-edit.pug`**

В конце файла:
```pug
    script(src='https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js')
    script.
      var list = document.getElementById('photo-list');
      if (list) {
        var reorderUrl = list.getAttribute('data-url');
        Sortable.create(list, {
          handle: '.admin-sort-handle',
          animation: 150,
          onEnd: function() {
            var order = Array.from(list.querySelectorAll('.admin-sort-item')).map(function(el) {
              return el.getAttribute('data-id');
            });
            fetch(reorderUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order: order }),
            });
          },
        });
      }
```

- [ ] **Step 3: Commit**

```bash
git add routes/photo-admin.js views/photo/admin/series-edit.pug
git commit -m "feat(photo): add drag-and-drop photo reordering in series edit"
```

---

## Task 7: Страница редактирования фотографии

**Files:**
- Create: `views/photo/admin/photo-edit.pug`
- Modify: `routes/photo-admin.js` (добавить 2 маршрута перед `module.exports`)

- [ ] **Step 1: Создать `views/photo/admin/photo-edit.pug`**

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
        a.admin-back(href=`/admin/${countryKey}/${seriesKey}/edit`) ← назад
        span.admin-logo= photo.title

      .admin-section
        h2.admin-title РЕДАКТИРОВАТЬ ФОТО
        if photo.urls
          img(src=photo.urls.preview alt=photo.title style='width:240px;height:auto;display:block;margin-bottom:16px;')
        form.admin-form(method='POST' action=`/admin/${countryKey}/${seriesKey}/${photo.id}/edit`)
          input.admin-input(type='text' name='title' value=photo.title placeholder='название снимка')
          input.admin-input(type='text' name='date' value=photo.date placeholder='дата (напр. Май 2024)')
          textarea.admin-input(name='desc' placeholder='описание (необязательно)' rows='3')= photo.desc || ''
          input.admin-input(type='url' name='instagram' value=photo.instagram || '' placeholder='ссылка на публикацию в instagram (необязательно)')
          .admin-coords
            input.admin-input(type='text' name='lat' value=(photo.coords ? photo.coords.lat : '') placeholder='широта (напр. 41.693)')
            input.admin-input(type='text' name='lng' value=(photo.coords ? photo.coords.lng : '') placeholder='долгота (напр. 44.801)')
          if tags && Object.keys(tags).length
            .admin-tags-select
              p.admin-hint ТЕГИ:
              each tag, slug in tags
                label.admin-tag-check
                  input(type='checkbox' name='tags' value=slug checked=(photo.tags && photo.tags.includes(slug)))
                  span= tag.label
          button.admin-btn(type='submit') СОХРАНИТЬ
```

- [ ] **Step 2: Добавить 2 маршрута в конец `routes/photo-admin.js` перед `module.exports`**

```js
router.get('/:country/:series/:id/edit', requireAuth, (req, res) => {
  var { country, series: seriesKey, id } = req.params;
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  var photo = data[country].series[seriesKey].photos.find(function(p) { return p.id === id; });
  if (!photo) return res.redirect('/admin');
  res.render('photo/admin/photo-edit', {
    title: `${photo.title} — AERO Admin`,
    countryKey: country,
    seriesKey,
    photo,
    tags: getTags(),
  });
});

router.post('/:country/:series/:id/edit', requireAuth, (req, res) => {
  var { country, series: seriesKey, id } = req.params;
  var { title, date, desc } = req.body;
  var instagramUrl = req.body.instagram ? req.body.instagram.trim() : '';
  if (instagramUrl && !instagramUrl.startsWith('https://')) instagramUrl = '';
  var data = getData();
  if (!data[country] || !data[country].series[seriesKey]) return res.redirect('/admin');
  var photos = data[country].series[seriesKey].photos;
  var idx = photos.findIndex(function(p) { return p.id === id; });
  if (idx === -1) return res.redirect('/admin');
  var photo = photos[idx];
  var knownTags = getTags();
  var rawTags = req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags]) : [];
  var tags = rawTags.filter(function(s) { return knownTags[s]; });
  var latRaw = parseFloat(req.body.lat);
  var lngRaw = parseFloat(req.body.lng);
  photo.title = title ? title.trim() : photo.title;
  photo.date = date ? date.trim() : '';
  photo.desc = desc ? desc.trim() : '';
  if (instagramUrl) { photo.instagram = instagramUrl; } else { delete photo.instagram; }
  if (!isNaN(latRaw) && !isNaN(lngRaw) && Math.abs(latRaw) <= 90 && Math.abs(lngRaw) <= 180) {
    photo.coords = { lat: latRaw, lng: lngRaw };
  } else {
    delete photo.coords;
  }
  if (tags.length) { photo.tags = tags; } else { delete photo.tags; }
  saveData(data);
  res.redirect(`/admin/${country}/${seriesKey}/edit`);
});
```

- [ ] **Step 3: Commit**

```bash
git add routes/photo-admin.js views/photo/admin/photo-edit.pug
git commit -m "feat(photo): add photo edit page with full metadata editing"
```
