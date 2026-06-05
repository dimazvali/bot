# Photo UX Group 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Авто-тема, shimmer-skeletons, кнопка Share, кнопка Instagram на странице фото.

**Architecture:** `main.js` переписывается целиком (авто-тема + skeleton JS + share), CSS получает shimmer-переменные и анимацию, `photo.pug` получает блок `.photo-actions`, Instagram-поле добавляется в форму загрузки и обработчик.

**Tech Stack:** Vanilla JS (`matchMedia`, `navigator.share`, `navigator.clipboard`), CSS custom properties, `@keyframes`, Node.js/Express, Pug.

---

## File Map

| Действие | Файл |
|----------|------|
| Modify (full rewrite) | `public/javascripts/photo/main.js` |
| Modify | `public/stylesheets/photo/style.css` |
| Modify | `views/photo/photo.pug` |
| Modify | `views/photo/admin/upload.pug` |
| Modify | `routes/photo-admin.js` |

---

## Task 1: Авто-тема (main.js)

**Files:**
- Modify: `public/javascripts/photo/main.js` (full rewrite)

- [ ] **Step 1: Заменить `public/javascripts/photo/main.js` полностью**

```js
(function () {
  var THEME_KEY = 'photo-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  function getAutoTheme() {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.media !== 'not all') {
      return mq.matches ? 'dark' : 'light';
    }
    var h = new Date().getHours();
    return (h >= 7 && h < 21) ? 'light' : 'dark';
  }

  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      return;
    }
    document.documentElement.setAttribute('data-theme', getAutoTheme());
  }

  initTheme();

  var mqDark = window.matchMedia('(prefers-color-scheme: dark)');
  if (mqDark.addEventListener) {
    mqDark.addEventListener('change', function () {
      if (!localStorage.getItem(THEME_KEY)) {
        document.documentElement.setAttribute('data-theme', getAutoTheme());
      }
    });
  }

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

  document.querySelectorAll('.masonry .photo-card img').forEach(function (img) {
    if (img.complete && img.naturalWidth) {
      img.classList.add('loaded');
    } else {
      img.addEventListener('load', function () { img.classList.add('loaded'); });
      img.addEventListener('error', function () { img.classList.add('loaded'); });
    }
  });
}());
```

Важные детали:
- `initTheme()` не вызывает `applyTheme()` (не пишет в localStorage при авто-определении) — только ставит атрибут
- `applyTheme()` вызывается только при ручном переключении → только тогда сохраняется в localStorage
- `mq.media !== 'not all'` — проверка поддержки `prefers-color-scheme` (Safari < 12 возвращает `'not all'`)
- `onerror` обработчик на img делает `img.classList.add('loaded')` — иначе битые картинки останутся невидимыми при opacity:0
- Escape key listener сохранён из Group 1

- [ ] **Step 2: Проверить в браузере**

Открыть `http://photo.localhost:3500` в режиме инкогнито (нет localStorage). Тема должна соответствовать системной (`prefers-color-scheme`). Нажать ◐ — тема сохраняется. Перезагрузить — сохранённая тема восстанавливается.

- [ ] **Step 3: Commit**

```bash
git add public/javascripts/photo/main.js
git commit -m "feat(photo): add auto-theme with system preference and time-of-day fallback"
```

---

## Task 2: Shimmer Skeletons CSS

**Files:**
- Modify: `public/stylesheets/photo/style.css`

- [ ] **Step 1: Добавить shimmer-переменные в тёмную тему**

В `public/stylesheets/photo/style.css` найти блок:
```css
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
```

Добавить две переменные перед закрывающей `}`:
```css
  --shimmer-base:      #1a1a1a;
  --shimmer-highlight: #2c2c2c;
```

- [ ] **Step 2: Добавить shimmer-переменные в светлую тему**

Найти блок:
```css
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
```

Добавить перед закрывающей `}`:
```css
  --shimmer-base:      #e4e4e4;
  --shimmer-highlight: #f0f0f0;
```

- [ ] **Step 3: Добавить skeleton-анимацию и стили в конец файла**

```css
/* skeletons */
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.photo-card {
  background: linear-gradient(
    90deg,
    var(--shimmer-base) 25%,
    var(--shimmer-highlight) 50%,
    var(--shimmer-base) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite linear;
}

.photo-card img {
  opacity: 0;
  transition: opacity 0.4s ease;
}

.photo-card img.loaded {
  opacity: 1;
}
```

Примечание: `.photo-card` уже имеет правило с `position`, `overflow`, `cursor` — новые свойства `background` и `animation` добавятся без конфликта.

- [ ] **Step 4: Проверить в браузере**

Открыть галерею `http://photo.localhost:3500`. При загрузке карточки должны показывать мерцающий серый placeholder. При загрузке изображения оно плавно появляется (opacity 0→1).

- [ ] **Step 5: Commit**

```bash
git add public/stylesheets/photo/style.css
git commit -m "feat(photo): add shimmer skeleton animation to gallery cards"
```

---

## Task 3: Кнопка Share

**Files:**
- Modify: `views/photo/photo.pug`
- Modify: `public/javascripts/photo/main.js`
- Modify: `public/stylesheets/photo/style.css`

- [ ] **Step 1: Добавить блок `.photo-actions` в `views/photo/photo.pug`**

Найти в конце файла:
```pug
    if photo.tags && photo.tags.length
      .photo-tags
        each tag in photo.tags
          a.photo-tag(href=`/tag/${tag}`)= allTags[tag] ? allTags[tag].label.toUpperCase() : tag.toUpperCase()
```

Добавить после этого блока:
```pug
    .photo-actions
      button.action-btn(onclick='sharePhoto()') ПОДЕЛИТЬСЯ
```

- [ ] **Step 2: Добавить функцию `sharePhoto` в `public/javascripts/photo/main.js`**

Найти в конце IIFE (перед последней строкой `}());`) и добавить:

```js
  window.sharePhoto = function () {
    var title = document.title;
    var url = location.href;
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        var btn = document.querySelector('.action-btn[onclick="sharePhoto()"]');
        if (btn) {
          var orig = btn.textContent;
          btn.textContent = 'СКОПИРОВАНО';
          setTimeout(function () { btn.textContent = orig; }, 2000);
        }
      });
    }
  };
```

- [ ] **Step 3: Добавить CSS в конец `public/stylesheets/photo/style.css`**

```css
/* action buttons on photo page */
.photo-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.action-btn {
  font-size: 9px;
  letter-spacing: 2px;
  font-family: monospace;
  color: var(--text-dim);
  border: 1px solid var(--border);
  background: none;
  padding: 3px 10px;
  cursor: pointer;
}
.action-btn:hover { color: var(--text); border-color: var(--text-muted); }
```

- [ ] **Step 4: Проверить в браузере**

Открыть страницу фото. Под описанием/тегами должна появиться кнопка ПОДЕЛИТЬСЯ. На мобильном Chrome/Safari должен открываться системный шит. На desktop Chrome — копирует URL, кнопка кратко меняет текст на СКОПИРОВАНО.

- [ ] **Step 5: Commit**

```bash
git add views/photo/photo.pug public/javascripts/photo/main.js public/stylesheets/photo/style.css
git commit -m "feat(photo): add share button to photo page"
```

---

## Task 4: Кнопка Instagram

**Files:**
- Modify: `views/photo/admin/upload.pug`
- Modify: `routes/photo-admin.js`
- Modify: `views/photo/photo.pug`

- [ ] **Step 1: Добавить поле `instagram` в форму загрузки**

В `views/photo/admin/upload.pug` найти поле desc:
```pug
          textarea.admin-input(name='desc' placeholder='описание (необязательно)' rows='3')
```

Добавить после него:
```pug
          input.admin-input(type='url' name='instagram' placeholder='ссылка на публикацию в instagram (необязательно)')
```

- [ ] **Step 2: Читать и сохранять `instagram` в POST обработчике**

В `routes/photo-admin.js` найти строку в POST `/:country/:series/upload`:
```js
  var { title, date, desc } = req.body;
```

Добавить после неё:
```js
  var instagramUrl = req.body.instagram ? req.body.instagram.trim() : '';
```

Найти блок построения `photoEntry` (перед `data[country].series[series].photos.push(photoEntry)`):
```js
    if (tags.length) photoEntry.tags = tags;
    if (coords) photoEntry.coords = coords;
```

Добавить строку:
```js
    if (tags.length) photoEntry.tags = tags;
    if (coords) photoEntry.coords = coords;
    if (instagramUrl) photoEntry.instagram = instagramUrl;
```

- [ ] **Step 3: Показывать кнопку Instagram в `views/photo/photo.pug`**

Найти:
```pug
    .photo-actions
      button.action-btn(onclick='sharePhoto()') ПОДЕЛИТЬСЯ
```

Заменить на:
```pug
    .photo-actions
      button.action-btn(onclick='sharePhoto()') ПОДЕЛИТЬСЯ
      if photo.instagram
        a.action-btn(href=photo.instagram target='_blank' rel='noopener') INSTAGRAM
```

- [ ] **Step 4: Проверить**

Загрузить фото через `/admin` с заполненным полем instagram. Открыть страницу фото — должна появиться кнопка INSTAGRAM рядом с ПОДЕЛИТЬСЯ. Для фото без instagram — кнопка не отображается.

- [ ] **Step 5: Commit**

```bash
git add views/photo/admin/upload.pug routes/photo-admin.js views/photo/photo.pug
git commit -m "feat(photo): add instagram link button to photo page"
```
