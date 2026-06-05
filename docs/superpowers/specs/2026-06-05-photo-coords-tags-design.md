# Photo: Координаты и Теги — Design Spec

**Дата:** 2026-06-05  
**Статус:** Approved

## Суть

Добавить к фотографиям два новых поля:
- **Координаты** — lat/lng из EXIF при загрузке (или вручную), хранятся в метаданных, публично не отображаются
- **Теги** — многие-ко-многим через глобальный справочник; на странице фото показываются как кликабельные ссылки, ведут на фильтрованную галерею

---

## Структура данных

### `data/photo-tags.json` — справочник тегов

Новый файл. Ключ — URL-slug (латиница, дефис), значение — отображаемая метка.

```json
{
  "sunrise": { "label": "Рассвет" },
  "city": { "label": "Город" },
  "river": { "label": "Река" }
}
```

### `data/photo.json` — изменения в объекте фото

Добавляются два новых опциональных поля:

```json
{
  "id": "metelhi-dawn",
  "title": "Метехи на рассвете",
  "date": "Май 2024",
  "desc": "...",
  "coords": { "lat": 41.6938, "lng": 44.8015 },
  "tags": ["sunrise", "city"],
  "urls": {
    "preview": "https://storage.googleapis.com/...",
    "full": "https://storage.googleapis.com/..."
  }
}
```

- `coords` — `{ lat: float, lng: float }` или отсутствует/`null`
- `tags` — массив slug-строк; может быть пустым или отсутствовать

Обратная совместимость: старые записи без этих полей продолжают работать.

---

## `lib/photo-tags.js` — кэш-модуль

По аналогии с `lib/photo-data.js`:

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

---

## EXIF-извлечение координат

Пакет: `exifr` (`npm install exifr`).

При POST загрузки фото, после `multer` и до `sharp`:

```js
var exifr = require('exifr');
var gps = await exifr.gps(req.file.buffer);
// gps = { latitude: 41.69, longitude: 44.80 } или undefined
```

Результат сохраняется в `coords: { lat, lng }` или `null` если GPS отсутствует.

Администратор может переопределить через ручные поля формы (lat/lng). При наличии EXIF — поля предзаполнены через hidden-инпуты (на GET формы EXIF не доступен, поля заполняются только после выбора файла — через JS на клиенте, либо только на сервере при POST).

**Реализация:** EXIF читается на POST. Если форма присылает непустые `lat`/`lng` — используются они. Если поля пустые — используется EXIF. Если EXIF нет и поля пусты — `coords: null`.

---

## Admin UI

### Существующая форма загрузки — `/admin/:country/:series/upload`

Добавляются поля:

```
Координаты (опционально, заполняется из EXIF):
  Широта: [___________]   Долгота: [___________]

Теги:
  [x] Рассвет   [ ] Город   [x] Река
  (список checkbox из photo-tags.json)
```

На странице списка фото (upload.pug) под каждым фото отображаются теги.

### Новый раздел — `/admin/tags`

| Роут | Метод | Действие |
|------|-------|----------|
| `/admin/tags` | GET | Список всех тегов + форма добавления |
| `/admin/tags` | POST | Создать тег (slug + label), redirect `/admin/tags` |
| `/admin/tags/:slug` | DELETE | Удалить тег (только если не используется ни одним фото) |

Шаблон: `views/photo/admin/tags.pug`.

Ссылка на раздел тегов добавляется на `admin/index.pug`.

**Slug-генерация:** при создании тега slug вводится вручную (только `[a-z0-9-]`) или автоматически из label через транслитерацию + slugify. Дублирование slug → ошибка с сообщением.

---

## Публичный сайт

### Страница фото — `views/photo/photo.pug`

Под описанием добавляется блок тегов (если `photo.tags` не пуст):

```
Описание...

[РАССВЕТ]  [ГОРОД]  [РЕКА]
```

Каждый тег — `<a href="/tag/sunrise">РАССВЕТ</a>`. Метка берётся из справочника тегов.

CSS: `.photo-tags` — строка ссылок, тот же монохромный стиль (uppercase, letter-spacing, border).

### Галерея по тегу — новый маршрут

```
GET /tag/:slug
```

- Роутер: `routes/photo.js`, монтируется ДО `/:country/:series` чтобы `/tag/...` не попал в wildcard
- Собирает все фото из всех серий, у которых `photo.tags && photo.tags.includes(slug)`
- Рендерит `views/photo/tag-gallery.pug` (extends layout, header: `ТЕГ: РАССВЕТ · N фото`)
- Если тег не найден в справочнике → 404

Сайдбар не изменяется (теги там не отображаются).

---

## Что не входит в скоуп

- Отображение координат на публичном сайте (карта, geotag)
- Редактирование тегов/координат существующих фото через UI (только при загрузке)
- Поиск по нескольким тегам одновременно
- Сортировка тегов по популярности
- Предпросмотр EXIF на клиенте (JS-парсинг в браузере)
