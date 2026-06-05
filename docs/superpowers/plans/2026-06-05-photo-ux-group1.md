# Photo UX Group 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пять независимых UX-улучшений: контакты в сайдбаре, CSS-переходы при смене темы, contain-режим фото, Escape → серия, страница страны.

**Architecture:** Все изменения в существующих файлах — `routes/photo.js`, `views/photo/layout.pug`, `views/photo/gallery.pug`, `views/photo/photo.pug`, `public/stylesheets/photo/style.css`, `public/javascripts/photo/main.js`. Новых файлов не создаётся.

**Tech Stack:** Node.js/Express, Pug, vanilla JS, CSS custom properties.

---

## File Map

| Действие | Файл |
|----------|------|
| Modify | `views/photo/layout.pug` |
| Modify | `views/photo/gallery.pug` |
| Modify | `routes/photo.js` |
| Modify | `public/stylesheets/photo/style.css` |
| Modify | `public/javascripts/photo/main.js` |

---

## Task 1: Контакты в подвале сайдбара

**Files:**
- Modify: `views/photo/layout.pug`
- Modify: `public/stylesheets/photo/style.css`

- [ ] **Step 1: Обновить `views/photo/layout.pug` — реструктурировать `.sidebar-footer`**

Найти блок:
```pug
        .sidebar-footer
          a(href='/about') О СЕБЕ
          button.theme-toggle(onclick='toggleTheme()' title='Переключить тему') ◐
```

Заменить на:
```pug
        .sidebar-footer
          .sidebar-contacts
            a(href='mailto:dimazvali@gmail.com') dimazvali@gmail.com
            a(href='https://t.me/dimazvali' target='_blank' rel='noopener') @dimazvali
            a(href='https://instagram.com/dimazvali2' target='_blank' rel='noopener') @dimazvali2
          .sidebar-footer-bottom
            a(href='/about') О СЕБЕ
            button.theme-toggle(onclick='toggleTheme()' title='Переключить тему') ◐
```

- [ ] **Step 2: Обновить CSS в `public/stylesheets/photo/style.css`**

Найти и заменить правила `.sidebar-footer` (строки 93–106):

```css
/* было: */
.sidebar-footer {
  margin-top: auto;
  padding: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

Заменить на:
```css
.sidebar-footer {
  margin-top: auto;
  padding: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sidebar-contacts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sidebar-footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

Правила `.sidebar-footer a` и `.sidebar-footer a:hover` (строки 101–106) не трогать — они применятся ко всем ссылкам в подвале.

- [ ] **Step 3: Проверить в браузере**

Открыть `http://photo.localhost:3500`. Внизу сайдбара должны появиться три строки с контактами, ниже — "О СЕБЕ" и кнопка темы на одной строке.

- [ ] **Step 4: Commit**

```bash
git add views/photo/layout.pug public/stylesheets/photo/style.css
git commit -m "feat(photo): add contact links to sidebar footer"
```

---

## Task 2: CSS-переход при смене темы

**Files:**
- Modify: `public/stylesheets/photo/style.css`

- [ ] **Step 1: Добавить transition в конец `public/stylesheets/photo/style.css`**

```css
/* theme transition */
body,
.sidebar,
.sidebar-logo,
.sidebar-logo a,
.sidebar-logo span,
.sidebar-footer,
.sidebar-contacts,
.sidebar-footer-bottom,
.nav-country,
.nav-series,
.theme-toggle,
.photo-card,
.photo-overlay,
.nav-btn,
.photo-page-back a,
.photo-page-desc,
.gallery-label,
.gallery-header {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
```

- [ ] **Step 2: Проверить в браузере**

Открыть `http://photo.localhost:3500`, нажать кнопку ◐. Смена темы должна быть плавной (не мгновенной).

- [ ] **Step 3: Commit**

```bash
git add public/stylesheets/photo/style.css
git commit -m "feat(photo): add smooth CSS transition on theme switch"
```

---

## Task 3: Contain-режим для изображений

**Files:**
- Modify: `public/stylesheets/photo/style.css`

- [ ] **Step 1: Изменить `.photo-page-image img` в `public/stylesheets/photo/style.css`**

Найти (строка ~181):
```css
.photo-page-image img {
  width: 100%;
  height: auto;
  max-height: 70vh;
  object-fit: cover;
  background: var(--border);
}
```

Заменить на:
```css
.photo-page-image img {
  width: 100%;
  height: auto;
  max-height: 70vh;
  object-fit: contain;
  background: var(--bg);
}
```

- [ ] **Step 2: Проверить в браузере**

Открыть любую страницу фото, например `http://photo.localhost:3500/georgia/tbilisi/img-0013`. Изображение должно отображаться целиком без обрезки.

- [ ] **Step 3: Commit**

```bash
git add public/stylesheets/photo/style.css
git commit -m "feat(photo): use object-fit contain on photo page"
```

---

## Task 4: Escape → страница серии

**Files:**
- Modify: `views/photo/layout.pug`
- Modify: `routes/photo.js`
- Modify: `public/javascripts/photo/main.js`

- [ ] **Step 1: Добавить `data-series-url` в body тега в `views/photo/layout.pug`**

Найти строку:
```pug
  body
```

Заменить на:
```pug
  body(data-series-url=seriesUrl || '')
```

- [ ] **Step 2: Передавать `seriesUrl` из роутера фото**

В `routes/photo.js` найти обработчик `/:country/:series/:id` — `res.render('photo/photo', {`:

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

Добавить `seriesUrl` в объект:

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
    seriesUrl: `/${countryKey}/${seriesKey}`,
    title: `${photo.title} — AERO`,
  });
```

Остальные обработчики не передают `seriesUrl` → `body(data-series-url=seriesUrl || '')` даст пустую строку.

- [ ] **Step 3: Добавить слушатель Escape в `public/javascripts/photo/main.js`**

В конец файла (перед закрывающей `}());`) добавить:

```js
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var url = document.body.getAttribute('data-series-url');
      if (url) location.href = url;
    }
  });
```

Итоговый файл `public/javascripts/photo/main.js`:

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

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var url = document.body.getAttribute('data-series-url');
      if (url) location.href = url;
    }
  });
}());
```

- [ ] **Step 4: Проверить в браузере**

Открыть страницу фото. Нажать Escape — должен произойти переход на страницу серии. На главной странице (и других) Escape не должен ничего делать.

- [ ] **Step 5: Commit**

```bash
git add views/photo/layout.pug routes/photo.js public/javascripts/photo/main.js
git commit -m "feat(photo): navigate to series on Escape key from photo page"
```

---

## Task 5: Страница страны

**Files:**
- Modify: `routes/photo.js`
- Modify: `views/photo/gallery.pug`
- Modify: `views/photo/layout.pug`

- [ ] **Step 1: Добавить маршрут `GET /:country` в `routes/photo.js`**

Найти комментарий:
```js
// GET /:country/:series — filtered gallery
```

Вставить перед ним (новый маршрут `/:country` ДОЛЖЕН быть после `/about` и `/tag/:slug`, и ПЕРЕД `/:country/:series`):

```js
// GET /:country — all photos in a country
router.get('/:country', (req, res) => {
  var data = getData();
  var { country: countryKey } = req.params;
  var country = data[countryKey];
  if (!country) return res.status(404).render('error', { message: 'Not found', error: {} });

  var photos = [];
  for (var seriesKey of Object.keys(country.series)) {
    for (var photo of country.series[seriesKey].photos) {
      photos.push({ countryKey, seriesKey, ...photo });
    }
  }

  res.render('photo/gallery', {
    data,
    activeCountry: countryKey,
    activeSeries: null,
    photos,
    title: `${country.label} — AERO`,
  });
});

```

- [ ] **Step 2: Добавить ветку заголовка для страницы страны в `views/photo/gallery.pug`**

Найти:
```pug
  .gallery-header
    if activeCountry && activeSeries
      - const country = data[activeCountry]
      - const series = country.series[activeSeries]
      span.gallery-label #{country.label.toUpperCase()} · #{series.label.toUpperCase()} · #{photos.length} фото
    else
      span.gallery-label ВСЕ РАБОТЫ · #{photos.length} фото
```

Заменить на:
```pug
  .gallery-header
    if activeCountry && activeSeries
      - const country = data[activeCountry]
      - const series = country.series[activeSeries]
      span.gallery-label #{country.label.toUpperCase()} · #{series.label.toUpperCase()} · #{photos.length} фото
    else if activeCountry
      - const country = data[activeCountry]
      span.gallery-label #{country.label.toUpperCase()} · #{photos.length} фото
    else
      span.gallery-label ВСЕ РАБОТЫ · #{photos.length} фото
```

- [ ] **Step 3: Обновить ссылки стран в сайдбаре `views/photo/layout.pug`**

Найти:
```pug
          each country, countryKey in data
            - var firstSeriesKey = Object.keys(country.series)[0]
            a.nav-country(
              href=`/${countryKey}/${firstSeriesKey}`
              class=activeCountry === countryKey ? 'open' : ''
            )
```

Заменить на:
```pug
          each country, countryKey in data
            a.nav-country(
              href=`/${countryKey}`
              class=activeCountry === countryKey ? 'open' : ''
            )
```

(Убираем `- var firstSeriesKey = ...` и меняем href на `/${countryKey}`.)

- [ ] **Step 4: Проверить в браузере**

1. Открыть `http://photo.localhost:3500` — клик на название страны (например "ГРУЗИЯ") должен вести на `/georgia`, показывать галерею со всеми фото страны и заголовком `ГРУЗИЯ · N фото`.
2. Клик на серию в сайдбаре — по-прежнему открывает страницу серии.
3. Несуществующая страна (`/unknown`) → 404.

- [ ] **Step 5: Commit**

```bash
git add routes/photo.js views/photo/gallery.pug views/photo/layout.pug
git commit -m "feat(photo): add country gallery page and update sidebar links"
```
