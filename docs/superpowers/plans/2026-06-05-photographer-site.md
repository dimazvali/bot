# Photographer Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Монохромный портфолио-сайт для аэрофотографа на поддомене `photo.*`, сайдбар + masonry-галерея, страница снимка, переключатель тёмной/светлой темы.

**Architecture:** Express-роутер `routes/photo.js` подключается через `vhost('photo.*.*')` в `app.js`. Данные — статический `data/photo.json`. Pug-шаблоны в `views/photo/`, стили в `public/stylesheets/photo/style.css`, клиентский JS в `public/javascripts/photo/main.js`.

**Tech Stack:** Node.js, Express, vhost, Pug, vanilla CSS (переменные для тем), vanilla JS.

---

## File Map

| Файл | Действие | Ответственность |
|------|----------|-----------------|
| `data/photo.json` | Создать | Метаданные всех стран, серий, снимков |
| `routes/photo.js` | Создать | Роуты `/`, `/:country/:series`, `/:country/:series/:id`, `/about` |
| `views/photo/layout.pug` | Создать | Базовый шаблон: `<html>`, CSS/JS, sidebar, theme toggle |
| `views/photo/gallery.pug` | Создать | Masonry-сетка, счётчик фото |
| `views/photo/photo.pug` | Создать | Страница одного снимка, навигация пред./след. |
| `views/photo/about.pug` | Создать | Страница «О себе» |
| `public/stylesheets/photo/style.css` | Создать | CSS-переменные тем, сайдбар, masonry, оверлей, страница фото |
| `public/javascripts/photo/main.js` | Создать | Переключатель темы, аккордеон сайдбара |
| `app.js` | Изменить | Добавить два vhost-правила для `photo` |

---

## Task 1: Data — `data/photo.json`

**Files:**
- Create: `data/photo.json`

- [ ] **Создать файл с тестовыми данными**

```json
{
  "georgia": {
    "label": "Грузия",
    "series": {
      "tbilisi": {
        "label": "Тбилиси",
        "photos": [
          {
            "id": "metelhi-dawn",
            "file": "metelhi-dawn.jpg",
            "title": "Метехи на рассвете",
            "date": "Май 2024",
            "desc": "Церковь Метехи и крепость на скале над Курой. 6:15 утра, высота 80 м."
          },
          {
            "id": "kura-summer",
            "file": "kura-summer.jpg",
            "title": "Кура, лето",
            "date": "Июнь 2024",
            "desc": ""
          },
          {
            "id": "old-city-fog",
            "file": "old-city-fog.jpg",
            "title": "Старый город, туман",
            "date": "Март 2024",
            "desc": ""
          }
        ]
      },
      "kakheti": {
        "label": "Кахетия",
        "photos": [
          {
            "id": "alazani-valley",
            "file": "alazani-valley.jpg",
            "title": "Алазанская долина",
            "date": "Октябрь 2024",
            "desc": "Виноградники в октябре, время сбора урожая."
          }
        ]
      }
    }
  },
  "cyprus": {
    "label": "Кипр",
    "series": {
      "coast": {
        "label": "Побережье",
        "photos": [
          {
            "id": "paphos-coast",
            "file": "paphos-coast.jpg",
            "title": "Пафос с воздуха",
            "date": "Февраль 2025",
            "desc": ""
          }
        ]
      }
    }
  }
}
```

- [ ] **Создать папку для изображений-заглушек**

```bash
mkdir -p public/images/photo/georgia/tbilisi
mkdir -p public/images/photo/georgia/kakheti
mkdir -p public/images/photo/cyprus/coast
```

- [ ] **Commit**

```bash
git add data/photo.json
git commit -m "feat(photo): add photo metadata"
```

---

## Task 2: Router — `routes/photo.js`

**Files:**
- Create: `routes/photo.js`

- [ ] **Создать роутер**

```js
var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/photo.json'), 'utf8'));

// Build flat list of all photos for prev/next navigation
function getAllPhotos() {
  const list = [];
  for (const [countryKey, country] of Object.entries(data)) {
    for (const [seriesKey, series] of Object.entries(country.series)) {
      for (const photo of series.photos) {
        list.push({ countryKey, seriesKey, ...photo });
      }
    }
  }
  return list;
}

// GET / — full gallery (all photos)
router.get('/', (req, res) => {
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
  res.render('photo/about', { data, title: 'О себе — AERO' });
});

// GET /:country/:series — filtered gallery
router.get('/:country/:series', (req, res) => {
  const { country: countryKey, series: seriesKey } = req.params;
  const country = data[countryKey];
  if (!country) return res.status(404).render('error', { message: 'Not found', error: {} });
  const series = country.series[seriesKey];
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
  const { country: countryKey, series: seriesKey, id } = req.params;
  const country = data[countryKey];
  if (!country) return res.status(404).render('error', { message: 'Not found', error: {} });
  const series = country.series[seriesKey];
  if (!series) return res.status(404).render('error', { message: 'Not found', error: {} });

  const photos = series.photos;
  const idx = photos.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).render('error', { message: 'Not found', error: {} });

  const photo = photos[idx];
  const prev = idx > 0 ? photos[idx - 1] : null;
  const next = idx < photos.length - 1 ? photos[idx + 1] : null;

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
git commit -m "feat(photo): add photo router"
```

---

## Task 3: Base Layout — `views/photo/layout.pug`

**Files:**
- Create: `views/photo/layout.pug`

- [ ] **Создать базовый шаблон**

```pug
doctype html
html(data-theme='dark')
  head
    title= title
    meta(name='viewport' content='width=device-width, initial-scale=1.0')
    link(rel='stylesheet' href='/stylesheets/photo/style.css')
  body
    .site
      aside.sidebar
        .sidebar-logo
          a(href='/') AERO
          span aerial photography
        nav.sidebar-nav
          each country, countryKey in data
            - var firstSeriesKey = Object.keys(country.series)[0]
            a.nav-country(
              href=`/${countryKey}/${firstSeriesKey}`
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
        .sidebar-footer
          a(href='/about') О СЕБЕ
          button.theme-toggle(onclick='toggleTheme()' title='Переключить тему') ◐
      main.main
        block content
    script(src='/javascripts/photo/main.js')
```

- [ ] **Создать папку views/photo**

```bash
mkdir -p views/photo
```

- [ ] **Commit**

```bash
git add views/photo/layout.pug
git commit -m "feat(photo): add base layout"
```

---

## Task 4: Gallery Template — `views/photo/gallery.pug`

**Files:**
- Create: `views/photo/gallery.pug`

- [ ] **Создать шаблон галереи**

```pug
extends layout

block content
  .gallery-header
    if activeCountry && activeSeries
      - const country = data[activeCountry]
      - const series = country.series[activeSeries]
      span.gallery-label #{country.label.toUpperCase()} · #{series.label.toUpperCase()} · #{photos.length} фото
    else
      span.gallery-label ВСЕ РАБОТЫ · #{photos.length} фото
  .masonry
    each photo in photos
      a.photo-card(href=`/${photo.countryKey}/${photo.seriesKey}/${photo.id}`)
        img(
          src=`/images/photo/${photo.countryKey}/${photo.seriesKey}/${photo.file}`
          alt=photo.title
          loading='lazy'
          onerror="this.style.background='#1e1e1e';this.removeAttribute('src')"
        )
        .photo-overlay
          span.photo-title= photo.title
          if photo.date
            span.photo-date= photo.date
```

- [ ] **Commit**

```bash
git add views/photo/gallery.pug
git commit -m "feat(photo): add gallery template"
```

---

## Task 5: Photo Page Template — `views/photo/photo.pug`

**Files:**
- Create: `views/photo/photo.pug`

- [ ] **Создать шаблон страницы снимка**

```pug
extends layout

block content
  .photo-page
    .photo-page-back
      a(href=`/${countryKey}/${seriesKey}`) ← #{seriesLabel.toUpperCase()}
    .photo-page-image
      img(
        src=`/images/photo/${countryKey}/${seriesKey}/${photo.file}`
        alt=photo.title
        onerror="this.style.background='#1e1e1e';this.removeAttribute('src')"
      )
    .photo-page-info
      .photo-page-meta
        h1.photo-page-title= photo.title
        .photo-page-loc #{countryLabel.toUpperCase()} · #{seriesLabel.toUpperCase()}#{photo.date ? ' · ' + photo.date : ''}
      .photo-page-nav
        if prev
          a.nav-btn(href=`/${countryKey}/${seriesKey}/${prev.id}`) ← ПРЕД.
        if next
          a.nav-btn(href=`/${countryKey}/${seriesKey}/${next.id}`) СЛЕД. →
    if photo.desc
      p.photo-page-desc= photo.desc
```

- [ ] **Commit**

```bash
git add views/photo/photo.pug
git commit -m "feat(photo): add photo page template"
```

---

## Task 6: About Template — `views/photo/about.pug`

**Files:**
- Create: `views/photo/about.pug`

- [ ] **Создать шаблон страницы «О себе»**

```pug
extends layout

block content
  .about-page
    h2.about-title ОБО МНЕ
    p.about-text.
      Снимаю с коптера с 2022 года. Основные направления — города, пейзажи, архитектура.
      Оборудование: DJI Mini 4 Pro.
    .about-contact
      span.about-label КОНТАКТ
      a.about-link(href='mailto:') email
```

- [ ] **Commit**

```bash
git add views/photo/about.pug
git commit -m "feat(photo): add about page"
```

---

## Task 7: CSS — `public/stylesheets/photo/style.css`

**Files:**
- Create: `public/stylesheets/photo/style.css`

- [ ] **Создать папку и CSS-файл**

```bash
mkdir -p public/stylesheets/photo
```

```css
/* ─── ПЕРЕМЕННЫЕ ТЕМ ─────────────────────────────────────────── */
:root, [data-theme="dark"] {
  --bg:          #0d0d0d;
  --bg-sidebar:  #0a0a0a;
  --border:      #1e1e1e;
  --text:        #ccc;
  --text-dim:    #444;
  --text-muted:  #666;
  --accent:      #fff;
  --overlay-bg:  rgba(0,0,0,0.65);
}
[data-theme="light"] {
  --bg:          #f5f5f5;
  --bg-sidebar:  #fff;
  --border:      #e0e0e0;
  --text:        #333;
  --text-dim:    #aaa;
  --text-muted:  #bbb;
  --accent:      #000;
  --overlay-bg:  rgba(255,255,255,0.75);
}

/* ─── RESET ──────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
a { color: inherit; text-decoration: none; }
img { display: block; width: 100%; }

/* ─── LAYOUT ─────────────────────────────────────────────────── */
body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

.site { display: flex; min-height: 100vh; }

/* ─── SIDEBAR ────────────────────────────────────────────────── */
.sidebar {
  width: 160px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  padding: 20px 0;
}

.sidebar-logo {
  padding: 0 16px 20px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}
.sidebar-logo a {
  display: block;
  font-family: monospace;
  font-size: 11px;
  letter-spacing: 4px;
  color: var(--accent);
}
.sidebar-logo span {
  display: block;
  font-size: 8px;
  letter-spacing: 2px;
  color: var(--text-dim);
  margin-top: 2px;
}

.sidebar-nav { flex: 1; }

.nav-country {
  padding: 7px 16px;
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
}
.nav-country:hover { color: var(--text); }
.nav-country.open  { color: var(--accent); }
.nav-country .arrow { font-size: 7px; }

.nav-series {
  display: block;
  padding: 4px 16px 4px 26px;
  font-size: 9px;
  letter-spacing: 1px;
  color: var(--text-dim);
}
.nav-series:hover  { color: var(--text); }
.nav-series.active { color: var(--accent); }

.sidebar-footer {
  margin-top: auto;
  padding: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sidebar-footer a {
  font-size: 8px;
  letter-spacing: 2px;
  color: var(--text-dim);
}
.sidebar-footer a:hover { color: var(--text); }

.theme-toggle {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 12px;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.theme-toggle:hover { color: var(--text); border-color: var(--text-muted); }

/* ─── MAIN ───────────────────────────────────────────────────── */
.main { flex: 1; padding: 24px; overflow: hidden; }

/* ─── GALLERY HEADER ─────────────────────────────────────────── */
.gallery-header { margin-bottom: 16px; }
.gallery-label { font-size: 9px; letter-spacing: 3px; color: var(--text-muted); font-family: monospace; }

/* ─── MASONRY ────────────────────────────────────────────────── */
.masonry {
  columns: 3;
  column-gap: 8px;
}

/* ─── PHOTO CARD ─────────────────────────────────────────────── */
.photo-card {
  display: block;
  break-inside: avoid;
  margin-bottom: 8px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
}
.photo-card img {
  width: 100%;
  height: auto;
  display: block;
  transition: transform 0.3s ease;
  background: var(--border);
  min-height: 80px;
}
.photo-card:hover img { transform: scale(1.02); }

.photo-overlay {
  position: absolute;
  inset: 0;
  background: var(--overlay-bg);
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 12px;
}
.photo-card:hover .photo-overlay { opacity: 1; }

.photo-title { font-size: 10px; letter-spacing: 1px; color: var(--accent); font-family: monospace; }
.photo-date  { font-size: 8px; color: var(--text-muted); margin-top: 2px; }

/* ─── PHOTO PAGE ─────────────────────────────────────────────── */
.photo-page { display: flex; flex-direction: column; gap: 16px; }

.photo-page-back a {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--text-dim);
  font-family: monospace;
}
.photo-page-back a:hover { color: var(--text); }

.photo-page-image img {
  width: 100%;
  height: auto;
  max-height: 70vh;
  object-fit: cover;
  background: var(--border);
}

.photo-page-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
}

.photo-page-title { font-size: 18px; color: var(--accent); letter-spacing: 1px; font-weight: 400; }
.photo-page-loc   { font-size: 9px; letter-spacing: 2px; color: var(--text-dim); font-family: monospace; margin-top: 4px; }

.photo-page-nav { display: flex; gap: 8px; }
.nav-btn {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--text-dim);
  border: 1px solid var(--border);
  padding: 5px 12px;
  font-family: monospace;
  transition: border-color 0.15s, color 0.15s;
}
.nav-btn:hover { color: var(--accent); border-color: var(--text-muted); }

.photo-page-desc { font-size: 13px; color: var(--text-muted); line-height: 1.7; max-width: 560px; }

/* ─── ABOUT PAGE ─────────────────────────────────────────────── */
.about-page { max-width: 480px; padding-top: 12px; }
.about-title { font-size: 11px; letter-spacing: 4px; color: var(--text-muted); font-family: monospace; margin-bottom: 20px; }
.about-text  { font-size: 14px; color: var(--text); line-height: 1.8; margin-bottom: 24px; }
.about-contact { display: flex; flex-direction: column; gap: 6px; }
.about-label { font-size: 9px; letter-spacing: 3px; color: var(--text-dim); font-family: monospace; }
.about-link  { font-size: 13px; color: var(--text); }
.about-link:hover { color: var(--accent); }
```

- [ ] **Commit**

```bash
git add public/stylesheets/photo/style.css
git commit -m "feat(photo): add stylesheet with dark/light theme"
```

---

## Task 8: Client JS — `public/javascripts/photo/main.js`

**Files:**
- Create: `public/javascripts/photo/main.js`

- [ ] **Создать папку и JS-файл**

```bash
mkdir -p public/javascripts/photo
```

```js
(function () {
  var THEME_KEY = 'photo-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  // restore saved theme on load
  var saved = localStorage.getItem(THEME_KEY);
  if (saved) applyTheme(saved);

  window.toggleTheme = function () {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  };
}());
```

- [ ] **Commit**

```bash
git add public/javascripts/photo/main.js
git commit -m "feat(photo): add client JS for theme toggle"
```

---

## Task 9: Wire Up — `app.js`

**Files:**
- Modify: `app.js`

- [ ] **Добавить vhost-правила после существующих (строки 41-48 в app.js)**

Найти блок:
```js
app.use(vhost(`cyprus.*.*`, require('./routes/cyprus')))
app.use(vhost(`dimazvali.*.*`,require('./routes/dimazvali')))
app.use(vhost(`bot.*.*`,require('./routes/dimazvali')))
```

Добавить после:
```js
app.use(vhost('photo.*.*', require('./routes/photo')))
app.use(vhost('photo.localhost', require('./routes/photo')))
```

- [ ] **Перезапустить сервер и проверить `http://photo.localhost:3000/`**

Ожидаемый результат: страница галереи с сайдбаром и пустой masonry-сеткой (фото-заглушки не загружаются, но разметка отображается).

- [ ] **Проверить роуты**

```
http://photo.localhost:3000/               → галерея, все фото
http://photo.localhost:3000/georgia/tbilisi → галерея, только Тбилиси
http://photo.localhost:3000/georgia/tbilisi/metelhi-dawn → страница снимка
http://photo.localhost:3000/about          → страница «О себе»
```

- [ ] **Commit**

```bash
git add app.js
git commit -m "feat(photo): wire up photo subdomain via vhost"
```

---

## Task 10: Реальные фотографии

**Files:**
- Modify: `data/photo.json`

- [ ] **Положить фото в папки**

```
public/images/photo/{country}/{series}/{filename}.jpg
```

Имена файлов должны совпадать с полем `"file"` в `data/photo.json`.

- [ ] **Обновить `data/photo.json`** — добавить реальные страны, серии, описания.

- [ ] **Перезапустить сервер, проверить что снимки отображаются в masonry.**

- [ ] **Commit**

```bash
git add data/photo.json public/images/photo/
git commit -m "feat(photo): add real photos and metadata"
```
