# Photo: UX Group 3 — Admin Content Management Design Spec

**Дата:** 2026-06-05  
**Статус:** Approved

## Суть

Полное управление контентом в админке: архивирование стран и серий, переименование, изменение порядка серий и фотографий (drag-and-drop), редактирование метаданных фотографий после загрузки, удаление серий и стран.

---

## 1. Изменения модели данных

### `data/photo.json`

Два новых необязательных поля:

**`archived`** (boolean) — на уровне страны и серии. Скрывает из публичного сайта, но остаётся видимым в админке.

**`seriesOrder`** (string[]) — на уровне страны. Определяет порядок серий в сайдбаре и на странице страны. Если отсутствует, используется `Object.keys(country.series)`.

```json
{
  "georgia": {
    "label": "Грузия",
    "archived": false,
    "seriesOrder": ["tbilisi", "kutaisi"],
    "series": {
      "tbilisi": {
        "label": "Тбилиси",
        "archived": false,
        "photos": [...]
      }
    }
  }
}
```

Порядок фотографий — уже implicit (позиция в массиве `photos`), схема не меняется.

---

## 2. Фильтрация на публичном сайте

**`routes/photo.js`** — все маршруты, которые итерируют страны и серии, пропускают архивированные:

- Главная галерея (`/`) — не показывает архивированные страны и серии
- Страница страны (`/:country`) — 404 если `archived: true`
- Страница серии (`/:country/:series`) — 404 если страна или серия архивированы
- Страница фото (`/:country/:series/:id`) — 404 если страна или серия архивированы
- Тег-галерея (`/tag/:slug`) — фильтрует фото из архивированных серий
- Сайдбар (передаётся через `data` во все шаблоны) — итерация по `seriesOrder || Object.keys(series)`, пропуск архивированных

Вспомогательная функция `getActiveSeries(country)` в `routes/photo.js`:
```js
function getActiveSeries(country) {
  var order = country.seriesOrder || Object.keys(country.series);
  return order.filter(k => country.series[k] && !country.series[k].archived);
}
```

---

## 3. Новые страницы админки

### 3.1 Редактирование страны — `/admin/country/:key/edit`

**GET** — рендерит форму с:
- Текущим label страны (текстовое поле + кнопка сохранить)
- Кнопкой архивировать/разархивировать (отдельная POST-форма)
- Drag-and-drop списком серий для изменения порядка (SortableJS)
- Кнопкой удалить страну (только если нет серий)

**POST** — обрабатывает переименование label, redirect обратно.

**POST `/admin/country/:key/archive`** — переключает `archived` флаг.

**POST `/admin/country/:key/delete`** — удаляет страну, только если `Object.keys(data[key].series).length === 0`. Иначе — ошибка.

**POST `/admin/country/:key/reorder-series`** — fetch-endpoint. Body: `{ order: ['key1', 'key2'] }`. Сохраняет в `country.seriesOrder`. Отвечает `{ ok: true }`.

### 3.2 Редактирование серии — `/admin/:country/:series/edit`

**GET** — рендерит форму с:
- Текущим label серии (текстовое поле + кнопка сохранить)
- Кнопкой архивировать/разархивировать
- Drag-and-drop списком фотографий (thumbnail + title, SortableJS)
- На каждой фото: кнопка "редактировать" → `/admin/:country/:series/:id/edit` + кнопка удалить
- Кнопкой удалить серию (удаляет все фото из Firebase Storage + из photo.json)

**POST** — переименование label.

**POST `/admin/:country/:series/archive`** — переключает `archived` флаг.

**POST `/admin/:country/:series/delete`** — удаляет все файлы из Firebase Storage (`{id}-800.webp`, `{id}-2400.webp`), удаляет серию из photo.json.

**POST `/admin/:country/:series/reorder-photos`** — fetch-endpoint. Body: `{ order: ['id1', 'id2'] }`. Переставляет массив `photos` в нужном порядке. Отвечает `{ ok: true }`.

### 3.3 Редактирование фотографии — `/admin/:country/:series/:id/edit`

**GET** — форма с полями:
- `title` (text)
- `date` (text)
- `desc` (textarea)
- `instagram` (url)
- `lat`, `lng` (number)
- `tags` (checkboxes из реестра тегов)

**POST** — сохраняет изменения в photo.json. Валидация: `instagram` — только `https://`, `lat/lng` — диапазоны ±90/±180. Redirect → `/admin/:country/:series/edit`.

---

## 4. Изменения в admin index

**`views/photo/admin/index.pug`:**
- К каждой стране: добавить ссылку "редактировать" → `/admin/country/:key/edit`
- К каждой серии: добавить ссылку "редактировать" → `/admin/:country/:series/edit` (рядом с "загрузить")
- Архивированные страны/серии отображаются с меткой `[архив]`

---

## 5. Маршруты

Все маршруты защищены `requireAuth`.

| Метод | Путь | Действие |
|-------|------|----------|
| GET | `/admin/country/:key/edit` | Страница редактирования страны |
| POST | `/admin/country/:key/edit` | Сохранить новый label страны |
| POST | `/admin/country/:key/archive` | Переключить archived |
| POST | `/admin/country/:key/delete` | Удалить страну (если пустая) |
| POST | `/admin/country/:key/reorder-series` | Сохранить порядок серий (fetch) |
| GET | `/admin/:country/:series/edit` | Страница редактирования серии |
| POST | `/admin/:country/:series/edit` | Сохранить новый label серии |
| POST | `/admin/:country/:series/archive` | Переключить archived |
| POST | `/admin/:country/:series/delete` | Удалить серию со всеми фото |
| POST | `/admin/:country/:series/reorder-photos` | Сохранить порядок фото (fetch) |
| GET | `/admin/:country/:series/:id/edit` | Страница редактирования фото |
| POST | `/admin/:country/:series/:id/edit` | Сохранить метаданные фото |

**Порядок регистрации маршрутов в `routes/photo-admin.js`:** маршруты с `/admin/country/` (литеральное слово `country`) должны быть зарегистрированы до `/admin/:country/:series/...` чтобы не конфликтовать.

---

## 6. SortableJS

- Загружается из CDN: `https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js`
- Подключается только в `country-edit.pug` и `series-edit.pug`
- На событии `end` сериализует новый порядок в массив ID и отправляет `fetch POST` на соответствующий reorder-endpoint
- Нет кнопки "сохранить порядок" — сохранение происходит автоматически при каждом перемещении

---

## 7. Новые файлы

| Действие | Файл |
|----------|------|
| Создать | `views/photo/admin/country-edit.pug` |
| Создать | `views/photo/admin/series-edit.pug` |
| Создать | `views/photo/admin/photo-edit.pug` |
| Изменить | `views/photo/admin/index.pug` |
| Изменить | `routes/photo-admin.js` |
| Изменить | `routes/photo.js` |

---

## Что не входит в скоуп

- Изменение slug (ключа) страны или серии — ломает URL
- Перемещение фото из одной серии в другую
- Пакетные операции (выбрать несколько фото)
- Восстановление удалённых фото из Storage
