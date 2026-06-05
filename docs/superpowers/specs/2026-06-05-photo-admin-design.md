# Photo Admin Panel — Design Spec

**Дата:** 2026-06-05  
**Статус:** Approved

## Суть

Админ-панель для управления контентом фото-сайта на поддомене `photo.*`. Позволяет создавать страны и серии, загружать фото с автоматическим ресайзом в WebP и сохранением в Firebase Storage.

---

## Архитектура

Sub-роутер `routes/photo-admin.js` монтируется внутри `routes/photo.js` на `/admin`.

```
routes/photo.js
  └── app.use('/admin', require('./photo-admin'))
```

Firebase инициализируется в `routes/photo.js` (именованный app `'photo'`) и передаётся в admin-роутер. Используется тот же проект `dimazvalimisc`, отдельный bucket `photo-dimazvalimisc`.

`data/photo.json` перестаёт читаться один раз при старте. Вместо этого `routes/photo.js` экспортирует две функции `getData()` / `saveData(obj)` — первая читает файл при каждом вызове (или из in-memory кэша), вторая пишет файл и обновляет кэш. Все роуты (и admin-роутер) используют эти функции.

---

## Авторизация

Та же схема, что в `dimazvali.js`:

1. `GET /admin/login` → форма логина (`views/photo/admin/login.pug`)
2. `POST /admin/login` → сверяет пароль с `process.env.PHOTO_ADMIN_PASS`
3. При успехе: создаёт документ в коллекции `PHOTOadminTokens` → `res.cookie('photoAdminToken', docId, { signed: true })`
4. Auth middleware на всех `/admin/*` (кроме `/login`): читает `req.signedCookies.photoAdminToken` → проверяет наличие в Firestore → 401 если нет
5. `GET /admin/logout` → удаляет токен из Firestore, очищает cookie

`.env` добавляется: `PHOTO_ADMIN_PASS=...`

---

## Admin UI — Страницы

| Роут | Метод | Шаблон | Действие |
|------|-------|--------|----------|
| `/admin` | GET | `admin/index.pug` | Список стран и серий + кнопки |
| `/admin/country` | POST | — | Добавить страну, redirect `/admin` |
| `/admin/series/:country` | POST | — | Добавить серию, redirect `/admin` |
| `/admin/:country/:series/upload` | GET | `admin/upload.pug` | Форма загрузки |
| `/admin/:country/:series/upload` | POST | — | Загрузить фото → Firebase → redirect |
| `/admin/:country/:series/:id` | DELETE | — | Удалить фото из json + Storage |
| `/admin/login` | GET/POST | `admin/login.pug` | Логин |
| `/admin/logout` | GET | — | Логаут |

Все шаблоны в `views/photo/admin/`, монохромный стиль, тот же `style.css`.

---

## Изменения в `data/photo.json`

Фото, загруженные через админку, имеют поле `urls`:

```json
{
  "id": "metelhi-dawn",
  "title": "Метехи на рассвете",
  "date": "Май 2024",
  "desc": "...",
  "urls": {
    "preview": "https://storage.googleapis.com/photo-dimazvalimisc/georgia/tbilisi/metelhi-dawn-800.webp",
    "full": "https://storage.googleapis.com/photo-dimazvalimisc/georgia/tbilisi/metelhi-dawn-2400.webp"
  }
}
```

Старые записи без `urls` (ручные, с полем `file`) продолжают работать через fallback в шаблонах.

### Шаблоны gallery.pug и photo.pug — изменение src:

```pug
// было:
img(src=`/images/photo/${photo.countryKey}/${photo.seriesKey}/${photo.file}`)

// станет:
img(src=photo.urls ? photo.urls.preview : `/images/photo/${photo.countryKey}/${photo.seriesKey}/${photo.file}`)
```

---

## Pipeline загрузки

```
req.file.buffer (multer memoryStorage)
  ↓
sharp → resize(800) → toFormat('webp', { quality: 85 }) → buffer
sharp → resize(2400) → toFormat('webp', { quality: 90 }) → buffer
  ↓
Firebase Storage bucket 'photo-dimazvalimisc'
  path: {country}/{series}/{id}-800.webp
  path: {country}/{series}/{id}-2400.webp
  .makePublic()
  ↓
publicUrl → записывается в data/photo.json
```

**ID генерация:** `slugify(path.basename(originalname, ext))` — кириллица транслитерируется, пробелы → дефис, lowercase. Если ID уже существует в серии → добавить `-2`, `-3` и т.д.

**Ограничения multer:** max 50MB, только `image/*`.

---

## Firebase Storage

- Bucket: `photo-dimazvalimisc` (создаётся вручную в Firebase Console до деплоя)
- Firebase app: именованный `'photo'`, инициализируется в `routes/photo.js` с теми же GCP-ключами (`process.env.sssGCPKey`)
- Публичный доступ: файлы публичны (`.makePublic()` после upload)

---

## Новые зависимости

```bash
npm install sharp multer
```

---

## Что не входит в скоуп

- Редактирование метаданных фото (title, date, desc) через UI — вручную в `data/photo.json`
- Drag-and-drop загрузка
- Batch-загрузка нескольких фото
- Мобильная адаптация админки
- Сортировка фото внутри серии
