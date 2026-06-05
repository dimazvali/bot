# Photo: UX Group 1 — Design Spec

**Дата:** 2026-06-05  
**Статус:** Approved

## Суть

Пять независимых UX-улучшений публичного сайта и сайдбара:
1. Контакты в подвале сайдбара
2. CSS-переход при смене темы
3. Contain-режим для изображений на странице фото
4. Escape → переход на страницу серии
5. Страница страны (все фото страны галереей)

---

## 1. Контакты в подвале сайдбара

### Изменения

**`views/photo/layout.pug`** — `.sidebar-footer` получает три новых ссылки:

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

**`public/stylesheets/photo/style.css`** — переделать `.sidebar-footer`:

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
/* .sidebar-footer a и .sidebar-footer a:hover остаются без изменений */
```

---

## 2. CSS-переход при смене темы

**`public/stylesheets/photo/style.css`** — добавить `transition` к элементам которые меняют цвет при смене темы:

```css
body,
.sidebar,
.sidebar-logo,
.nav-country,
.nav-series,
.sidebar-footer,
.theme-toggle,
.photo-card,
.photo-overlay,
.nav-btn,
.photo-page-back a,
.photo-page-desc,
.gallery-label {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
```

Изображения (`img`), шрифтовые размеры и layout не анимируются.

---

## 3. Contain-режим для изображений

На странице фото изображение должно масштабироваться целиком (без обрезки), вписываясь в блок.

**`public/stylesheets/photo/style.css`** — изменить `.photo-page-image img`:

```css
.photo-page-image img {
  width: 100%;
  height: auto;
  max-height: 70vh;
  object-fit: contain;       /* было: cover */
  background: var(--bg);     /* было: var(--border) */
}
```

Фон меняется с `--border` на `--bg` чтобы поля вокруг изображения сливались с фоном страницы.

---

## 4. Escape → страница серии

**`views/photo/photo.pug`** — добавить `data-series-url` на `body`:

```pug
body(data-series-url=`/${countryKey}/${seriesKey}`)
```

(Заменяет текущий `body` без атрибутов, который наследуется из `layout.pug`. Поскольку `photo.pug` использует `extends layout`, нужно добавить отдельный `block` для атрибутов тела или вынести через переменную.)

Конкретная реализация: передать `seriesUrl` из роутера в шаблон и поместить его в `data`-атрибут через блок в layout. В `layout.pug`:

```pug
body(data-series-url=seriesUrl || '')
```

В `routes/photo.js`, в обработчике `/:country/:series/:id`:
```js
seriesUrl: `/${countryKey}/${seriesKey}`,
```
Во всех остальных обработчиках `seriesUrl` не передаётся (будет `''`).

**`public/javascripts/photo/main.js`** — добавить слушатель:

```js
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    var url = document.body.getAttribute('data-series-url');
    if (url) location.href = url;
  }
});
```

---

## 5. Страница страны

### Маршрут

В `routes/photo.js` добавить `GET /:country` **после** `/about` и `/tag/:slug`, но **перед** `/:country/:series`:

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

### Заголовок галереи

`gallery.pug` — добавить ветку для `activeCountry` без `activeSeries`:

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

### Сайдбар

В `layout.pug` — ссылка на страну меняется с `/${countryKey}/${firstSeriesKey}` на `/${countryKey}`:

```pug
a.nav-country(
  href=`/${countryKey}`
  class=activeCountry === countryKey ? 'open' : ''
)
```

Переменная `firstSeriesKey` больше не нужна — убрать `- var firstSeriesKey = ...`.

### Поведение сайдбара

Клик на страну → `/country` (галерея всех фото). Серии в сайдбаре раскрываются так же — `activeCountry === countryKey`. Текущий маршрут `/:country/:series` (серия) продолжает работать без изменений.

---

## Что не входит в скоуп

- Анимация скрытия/раскрытия серий в сайдбаре
- Пагинация на странице страны
- Сортировка фото по сериям на странице страны
