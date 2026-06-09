# Pelamushi Café Website — Design Spec

**Date:** 2026-06-10  
**Project:** Сайт для социального кафе Pelamushi, Тбилиси, ул. Палиашвили 60  
**Domain:** pelamushi.ge (текущий статик будет заменён)  
**Stack:** Node.js + Express + Pug, Firebase Admin SDK, Firestore, Firebase Storage, Firebase Auth

---

## 1. Контекст и миссия

Pelamushi — инклюзивное кафе транзитного трудоустройства. Нанимает людей с особенностями развития, обучает работе в зале, помогает с дальнейшим трудоустройством в обычных кафе. Тон сайта: достоинство, а не жалость — тепло, человечность, надежда.

Фирменная цитата: *«Мир не идеально ровный, но при правильной опоре и среде можно быть в балансе и быть видимым.»*

---

## 2. Архитектура

### Подключение к существующему Express-приложению

```js
// app.js
app.use(vhost('pelamushi.*.*', require('./routes/pelamushi')))
app.use(vhost('pelamushi.localhost', require('./routes/pelamushi')))
```

### Структура файлов

```
routes/
  pelamushi.js            — публичные страницы + lang middleware
  pelamushi-admin.js      — CRUD-маршруты админки

views/pelamushi/
  layout.pug              — базовый шаблон (nav, footer)
  index.pug               — главная
  about.pug               — о нас
  menu-list.pug           — список меню
  menu.pug                — конкретное меню
  news-list.pug           — список статей
  news-item.pug           — статья
  admin/
    layout.pug
    dashboard.pug
    about.pug
    menus.pug
    menu-edit.pug
    news.pug
    news-edit.pug
    team.pug
    gallery.pug

locales/pelamushi/
  en.json                 — статичные UI-строки (nav, кнопки)
  ka.json
  ru.json
```

---

## 3. Роутинг

### Публичный

| Маршрут | Страница |
|---|---|
| `GET /` | Redirect по Accept-Language → `/ka`, `/en` или `/ru`; fallback `/en` |
| `GET /:lang` | Главная |
| `GET /:lang/about` | О нас |
| `GET /:lang/menu` | Список активных меню |
| `GET /:lang/menu/:slug` | Конкретное меню |
| `GET /:lang/news` | Список статей |
| `GET /:lang/news/:slug` | Статья |
| `POST /:lang/news/:slug/register` | Форма регистрации на мероприятие |
| `GET /lang/:code` | Смена языка (ставит куку `lang`, redirect back) |

`lang` ∈ `{ en, ka, ru }`. Middleware проверяет значение и возвращает 404 для неизвестного.

### Админка

| Маршрут | Действие |
|---|---|
| `GET /admin` | Дашборд |
| `GET/POST /admin/login` | Логин через Firebase Auth |
| `GET /admin/about` | Редактировать тексты, галерею, команду |
| `GET /admin/menus` | Список меню |
| `GET/POST /admin/menus/new` | Создать меню |
| `GET/POST /admin/menus/:id` | Редактировать меню |
| `POST /admin/menus/:id/items` | Добавить позицию |
| `POST /admin/menus/:id/items/:itemId` | Редактировать позицию |
| `DELETE /admin/menus/:id/items/:itemId` | Удалить позицию |
| `GET /admin/news` | Список статей |
| `GET/POST /admin/news/new` | Создать статью |
| `GET/POST /admin/news/:id` | Редактировать статью |
| `GET /admin/news/:id/registrations` | Список регистраций + экспорт CSV |

**Auth middleware:** Firebase ID Token в http-only куке `pelamushi_token`. Whitelist разрешённых email в коллекции `pelamushi_admins`. При истечении токена → redirect на `/admin/login`.

---

## 4. Модель данных Firebase (плоские коллекции)

### `pelamushi_admins`
```
id (email), created_at
```

### `pelamushi_about`
```
id: "main"
mission_en, mission_ka, mission_ru
updated_at
```

### `pelamushi_team`
```
id, name, role_en/ka/ru, photo_url, order, active
```

### `pelamushi_gallery`
```
id, photo_url, caption_en/ka/ru, order
```

### `pelamushi_menus`
```
id, slug
name_en, name_ka, name_ru
desc_en, desc_ka, desc_ru
type          — "permanent" | "event"
active        — bool
order         — int
date_from?    — timestamp (для event-меню)
date_to?      — timestamp (для event-меню; прячем после окончания)
created_at
```

### `pelamushi_menu_categories`
```
id, menu_id
name_en, name_ka, name_ru
order
```

### `pelamushi_menu_items`
```
id, menu_id, category_id
name_en, name_ka, name_ru
desc_en, desc_ka, desc_ru
price         — number (GEL)
photo_url
tags          — string[]
active        — bool
order         — int
```

### `pelamushi_news`
```
id, slug
title_en, title_ka, title_ru
body_en, body_ka, body_ru   — HTML (textarea в админке)
photo_url
published_at  — timestamp (когда статья опубликована)
event_date?   — timestamp (дата мероприятия; только если registration_enabled)
author
registration_enabled — bool
```

### `pelamushi_registrations`
```
id, news_id
name, email, phone?
created_at
```

---

## 5. i18n

- Язык — часть URL: `/:lang/...`
- Redirect с `/` по `Accept-Language` header; приоритет: ka > ru > en; fallback en
- Смена языка: `GET /lang/ka` → ставит куку `lang=ka`, делает redirect на аналогичный URL другого языка
- Переводы UI (nav, кнопки, плейсхолдеры) — в `locales/pelamushi/{en,ka,ru}.json`
- Контент (тексты страниц, меню, новости) — поля `*_en`, `*_ka`, `*_ru` в Firestore
- Middleware кладёт `res.locals.lang` и `res.locals.t` (объект переводов) для всех шаблонов

---

## 6. Страницы

### Главная `/:lang/`
- **Герой:** фото интерьера + overlay `rgba(28,46,74,0.58)`, logo3.png (белый), цитата миссии
- **Блок миссии:** 2–3 предложения из `pelamushi_about.mission_*`
- **Три карточки:** О нас / Меню / Новости — иллюстрация + краткий текст + ссылка
- **Ближайшее событие:** если есть `news` с `registration_enabled=true` и `event_date >= now` — отдельный блок с кнопкой «Записаться»

### О нас `/:lang/about`
- Текст миссии (из Firestore)
- Галерея интерьера: сетка 3 колонки → 2 → 1, соотношение 4:3
- Команда: карточки с фото (квадрат), именем, ролью

### Список меню `/:lang/menu`
- Плитки активных меню: название, описание, тип
- Event-меню с `date_to < now` скрыты автоматически

### Меню `/:lang/menu/:slug`
- Название + описание меню
- Позиции по категориям: фото (4:3), название (Noto Serif), описание, цена терракотой, теги

### Новости `/:lang/news`
- Карточки: обложка (16:9), дата, заголовок, начало текста, бейдж «Мероприятие» если `registration_enabled`

### Статья `/:lang/news/:slug`
- Полный HTML-текст с обложкой
- Если `registration_enabled`: форма внизу — имя (обязательно), email (обязательно), телефон (опционально), кнопка «Записаться». POST → запись в `pelamushi_registrations` → redirect на `/:lang/news/:slug?registered=1` → показываем сообщение об успехе вместо формы

---

## 7. Загрузка фото

- `express-fileupload` (уже в проекте) принимает файл
- `sharp` ресайзит: галерея → 1200px по ширине, команда → 600×600, обложки → 1600px
- Загружается в Firebase Storage в папку `pelamushi/{коллекция}/{id}/`
- `photo_url` (публичный URL из Storage) пишется в Firestore

---

## 8. Визуальный дизайн

### Цвета
| Переменная | HEX | Использование |
|---|---|---|
| `--cream` | `#F3ECE0` | Основной фон |
| `--navy` | `#1C2E4A` | Заголовки, кнопки, overlay |
| `--blue` | `#97B8C9` | Акценты, hover, теги |
| `--charcoal` | `#2E2E2E` | Основной текст |
| `--tan` | `#A37C54` | Вторичный текст |
| `--terra` | `#B25B3C` | CTA-кнопки, цены |

### Шрифты (Google Fonts)
- **Noto Serif / Noto Serif Georgian** — заголовки, цитаты, названия блюд
- **Noto Sans / Noto Sans Georgian** — навигация, подписи, тело текста, UI

### Компоненты
- **Навигация:** кремовый фон, logo1.png слева, ссылки Noto Sans uppercase letter-spacing, переключатель `KA · EN · RU` справа. На мобиле — бургер-меню.
- **Герой:** `background-image` + `::after` overlay `rgba(28,46,74,0.58)`, logo3.png инвертированный
- **Кнопки:** терракота (`#B25B3C`) — главные действия; нэви (`#1C2E4A`) — вторичные
- **Карточки:** белый фон на кремовом, `box-shadow: 0 2px 8px rgba(0,0,0,0.08)`, border-radius 8px
- **Фото:** соотношение 4:3 (галерея, меню), 1:1 (команда), 16:9 (обложки новостей); border-radius 6px
- **Типографика:** h1–h2 Noto Serif, h3–h6 Noto Serif или Noto Sans Bold, body Noto Sans 16px/1.6

### Адаптивность
- Mobile-first
- Breakpoints: 768px (tablet), 1200px (desktop)
- Колонки: 1 → 2 → 3 (галерея, карточки меню)

---

## 9. Что остаётся за рамками этого спека

- Уведомления при регистрации (email / Telegram) — отложено
- Система бронирования столиков — не в scope
- Интеграция с соцсетями (Instagram feed) — не в scope
