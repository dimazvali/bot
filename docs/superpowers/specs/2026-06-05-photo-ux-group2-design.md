# Photo: UX Group 2 — Design Spec

**Дата:** 2026-06-05  
**Статус:** Approved

## Суть

Четыре независимых фичи: авто-тема, shimmer-skeletons, кнопка Share, кнопка Instagram.

---

## 1. Авто-тема (auto-theme)

### Логика приоритетов

При каждой загрузке страницы тема определяется так:

1. **localStorage** (`photo-theme`) — если есть сохранённое значение, применяем его. Стоп.
2. **`prefers-color-scheme`** — если `window.matchMedia('(prefers-color-scheme: dark)')` поддерживается, берём системную тему. Стоп.
3. **Время суток** — fallback: 07:00–21:00 = `light`, иначе = `dark`.

При клике ◐ → `toggleTheme()` по-прежнему сохраняет в localStorage (ручная настройка перекрывает авто).

Дополнительно: слушаем `matchMedia.addEventListener('change', ...)`. Если localStorage пуст — обновляем тему в реальном времени при смене системной настройки.

### Изменения

**`public/javascripts/photo/main.js`** — полная замена логики инициализации темы:

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

  // follow system preference changes when no manual override
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) {
    mq.addEventListener('change', function () {
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
}());
```

Ключевые отличия от текущего кода:
- `initTheme()` не сохраняет в localStorage при auto-определении (сохраняет только `applyTheme`)
- `toggleTheme()` вызывает `applyTheme()` → сохраняет в localStorage
- `mq.addEventListener('change', ...)` реагирует на смену системной темы только если нет ручной настройки

---

## 2. Shimmer Skeletons + Lazy-load

### CSS

Добавить `--shimmer-base` и `--shimmer-highlight` в обе темы в `public/stylesheets/photo/style.css`:

```css
:root, [data-theme="dark"] {
  /* ... existing vars ... */
  --shimmer-base:      #1a1a1a;
  --shimmer-highlight: #2c2c2c;
}
[data-theme="light"] {
  /* ... existing vars ... */
  --shimmer-base:      #e4e4e4;
  --shimmer-highlight: #f0f0f0;
}
```

Добавить shimmer-анимацию и стили карточки (в конец файла):

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

### JS

В `public/javascripts/photo/main.js` добавить в конец IIFE (перед закрывающей `}()`):

```js
  // skeleton fade-in on image load
  document.querySelectorAll('.masonry .photo-card img').forEach(function (img) {
    if (img.complete && img.naturalWidth) {
      img.classList.add('loaded');
    } else {
      img.addEventListener('load', function () { img.classList.add('loaded'); });
    }
  });
```

`img.naturalWidth` проверяет что картинка реально загружена (не просто `complete` от ошибки).

---

## 3. Кнопка Share

### Шаблон

В `views/photo/photo.pug` — добавить кнопку после блока тегов:

```pug
    .photo-actions
      button.action-btn(onclick='sharePhoto()') ПОДЕЛИТЬСЯ
```

### JS

В `public/javascripts/photo/main.js` добавить функцию `sharePhoto`:

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

### CSS

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

---

## 4. Кнопка Instagram

### Хранение

Поле `instagram` (URL публикации) хранится в `photo.json` как строка. Пустая строка / отсутствие поля = кнопка не показывается.

### Форма загрузки

В `views/photo/admin/upload.pug` добавить поле после `desc`:

```pug
          input.admin-input(type='url' name='instagram' placeholder='ссылка на публикацию в instagram (необязательно)')
```

### Admin POST handler

В `routes/photo-admin.js`, POST `/:country/:series/upload` — читать `req.body.instagram` и добавлять в `photoEntry` если не пусто:

```js
var instagramUrl = req.body.instagram ? req.body.instagram.trim() : '';
// ...
if (instagramUrl) photoEntry.instagram = instagramUrl;
```

### Шаблон фото

В `views/photo/photo.pug` — добавить ссылку-кнопку в `.photo-actions` рядом с Share:

```pug
    .photo-actions
      button.action-btn(onclick='sharePhoto()') ПОДЕЛИТЬСЯ
      if photo.instagram
        a.action-btn(href=photo.instagram target='_blank' rel='noopener') INSTAGRAM
```

---

## Что не входит в скоуп

- Кнопка сброса темы в «авто» через UI (ручная настройка через ◐ только)
- Instagram-кнопка для существующих фото (редактирование — в Group 3)
- Share для страниц галереи (только страница фото)
- Skeleton на странице фото (только masonry-галереи)
