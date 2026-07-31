# Распознавание людей на shoot-фото (AWS Rekognition)

**Дата:** 2026-07-31
**Статус:** Approved

## Суть

При загрузке фото в `/shoot/:slug` — прогонять его через AWS Rekognition, чтобы автоматически узнавать повторяющихся людей (например, музыкантов на разных концертах) и подставлять их имена в AI-генерируемую SEO-подпись ([[2026-06-26-photo-shoots-design]] добавил сами съёмки, эта фича достраивает над ними распознавание лиц). Основная галерея (`/:country/:series`) фичу не затрагивает — там нет повторяющихся именованных людей.

---

## Архитектура и поток данных

Одна глобальная коллекция лиц в AWS Rekognition на весь сайт — `photo-people-{PHOTO_ENV}` (env-суффикс по аналогии с Firestore-документами, чтобы dev не засорял prod-коллекцию).

На каждое shoot-фото:

1. **`IndexFaces(image, collectionId)`** — Rekognition находит все лица на фото, добавляет каждое в коллекцию, возвращает `FaceId` + `BoundingBox` по каждому найденному лицу. Фото без лиц (пейзажи, детали) возвращают пустой список — пропускаем.
2. Для каждого нового `FaceId` — **`SearchFaces(FaceId, collectionId, FaceMatchThreshold=99)`** — ищем совпадение среди уже проиндексированных лиц (кроме самого себя).
3. Если совпадение ≥99% найдено и то лицо уже привязано к `personId` — новое лицо тоже привязывается к этому человеку автоматически.
4. Если совпадений нет, или они ниже порога — лицо остаётся `personId: null`, попадает в очередь на `/admin/people`.

**Компромисс порога:** при 99% один и тот же человек в разных ракурсах/освещении может не схлопнуться в один кластер автоматически — тогда на `/admin/people` появится второй неразмеченный «человек», и admin вручную привязывает его к уже существующему имени через merge-действие (см. ниже). Порог осознанно строгий: цена ложного автоматического имени на чужом лице выше, чем цена лишнего ручного клика.

---

## Модель данных (Firestore)

### Новая коллекция `people/{env}_{personId}`

```json
{
  "env": "prod",
  "name": "Алексей Пономарёв",
  "faceIds": ["aws-face-id-1", "aws-face-id-2"],
  "createdAt": "2026-07-31T12:00:00Z"
}
```

### Новое поле на `shootPhotos/{env}_{slug}_{photoId}`

```json
{
  "faces": [
    { "faceId": "aws-face-id-3", "boundingBox": { "Width": 0.12, "Height": 0.18, "Left": 0.4, "Top": 0.2 }, "personId": "people-doc-id" }
  ]
}
```

`boundingBox` хранится в исходном формате Rekognition (доли от 0 до 1) — используется на `/admin/people` для CSS-масштабирования превью на область лица, без серверной обрезки изображения.

Отсутствие поля `faces` на фото = ещё не проиндексировано (используется как флаг в бэкфилле, тот же паттерн, что `!photo.seo_desc` в `generate-shoot-seo.js`).

---

## `lib/photo-people.js` (новый файл)

По образцу `lib/photo-shoots.js`:

- `ensureCollection()` — идемпотентно создаёт коллекцию Rekognition (`CreateCollection`, игнорирует `ResourceAlreadyExistsException`), вызывается лениво при первом использовании.
- `indexFacesForPhoto(imageBuffer)` → `[{ faceId, boundingBox }]` — вызывает `IndexFaces`.
- `findMatch(faceId)` → `{ faceId, similarity } | null` — вызывает `SearchFaces` с порогом 99.
- `initFromFirestore(db)` / `getPeopleData()` — in-memory кэш всех `people`, тот же паттерн, что в `photo-shoots.js`.
- `getPersonByFaceId(faceId)` — обратный индекс faceId → person (строится из кэша).
- `createPerson(name, faceId)` — создаёт документ `people`, привязывает лицо.
- `linkFaceToPerson(personId, faceId)` — добавляет `faceId` в `people.faceIds` существующего человека.
- `renamePerson(personId, name)`.
- `setPhotoFaces(slug, photoId, faces)` — записывает `faces[]` на `shootPhotos` (аналог `shoots.updatePhotoSeo`).
- `unlinkFace(slug, photoId, faceId)` — сбрасывает `personId` конкретного лица на конкретном фото в `null` (не трогает сам `people`-документ и другие фото — safety valve на случай ошибочного автосопоставления).
- `resolvePhotoPeopleNames(photo)` → `['Алексей Пономарёв']` — по `photo.faces`, только с непустым `personId`. Используется при генерации подписи.

---

## Пайплайн индексации

### При загрузке (`POST /admin/shoots/:slug/upload`, `routes/photo-admin.js`)

Fire-and-forget блок, использует уже готовый `buf800` (не нужен повторный скачивание). **Порядок важен**: сначала лица, потом подпись — потому что подписи нужен уже разрешённый список имён:

```js
(async function() {
  var faces = await photoPeople.indexAndMatchFaces(buf800);       // index + search + auto-link
  await photoPeople.setPhotoFaces(slug, photoEntry.id, faces);
  var knownPeople = photoPeople.resolvePhotoPeopleNames({ faces });
  var result = await generatePhotoSeo(photoEntry, { ..., knownPeople });
  await shoots.updatePhotoSeo(slug, photoEntry.id, result.desc, result.keywords);
})().catch(function(e) { console.error('[auto-faces+seo]', e.message); });
```

### Бэкфилл — `scripts/index-shoot-faces.js` (новый файл)

По образцу `scripts/generate-shoot-seo.js`: проходит по всем shoot-фото без поля `faces`, скачивает preview, индексирует, сохраняет. `LIMIT` и `PUBLIC_ONLY` env-флаги — тот же паттерн, что уже есть.

Запускать **до** `generate-shoot-seo.js` при регенерации подписей, чтобы `knownPeople` было доступно — то есть для уже забэкфиленных 234 публичных фото подписи придётся перегенерировать ещё раз после разметки лиц (см. «Что не входит в скоуп»).

---

## Admin-маршруты (`routes/photo-admin.js`)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/admin/people` | Список: неразмеченные лица + именованные люди |
| POST | `/admin/people/new` | Создать человека из неразмеченного лица (`slug`, `photoId`, `faceId`, `name`) |
| POST | `/admin/people/:personId/link` | Привязать неразмеченное лицо к существующему человеку (merge) |
| POST | `/admin/people/:personId/rename` | Переименовать |
| POST | `/admin/shoots/:slug/photos/:id/faces/:faceId/unlink` | Отвязать лицо от человека (safety valve) |

## Вьюшка

**`views/photo/admin/people.pug`** (новый файл), по образцу `shoot-edit.pug`:

- Блок «Неразмеченные лица» — сетка превью (CSS `background-position`/`background-size` по `boundingBox` поверх `photo.urls.thumb`), под каждым — инпут имени + кнопка «создать», плюс select «или это уже известный человек» → кнопка «привязать».
- Блок «Люди» — список: имя, количество привязанных лиц/фото, ссылка на переименование.

---

## Интеграция с генерацией подписи (`lib/photo-seo.js`)

`generatePhotoSeo(photo, { ..., knownPeople })` — новый необязательный параметр. Если непустой, в промпт добавляется обязательная (не «изредка», как контекст съёмки) инструкция:

```
На фото уверенно распознан(ы): Алексей Пономарёв.
Обязательно назови его/их по имени в подписи, если он/они видны в кадре.
```

Гальерейные (`country/series`) вызовы `generatePhotoSeo` продолжают работать без изменений — параметр опционален.

---

## AWS: что нужно сделать вручную (не автоматизируется)

1. Создать AWS-аккаунт / IAM-пользователя с правами: `rekognition:CreateCollection`, `DescribeCollection`, `IndexFaces`, `SearchFaces`, `ListFaces`, `DeleteFaces`.
2. Добавить в `.env`: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`.
3. Добавить зависимость `@aws-sdk/client-rekognition` в `package.json`.

---

## Обработка ошибок

- Ошибки AWS (сеть, лимиты, throttling) не блокируют загрузку фото — тот же fire-and-forget + `try/catch` + `console.error`, что уже используется для SEO-генерации.
- Таймаут на вызовы Rekognition — 20с (как у `axios.get` в `lib/photo-seo.js`), чтобы не подвесить бэкфилл на одном плохом запросе.

---

## Что не входит в скоуп

- Распознавание лиц в основной галерее (`/:country/:series`).
- Автоматическая перегенерация уже готовых 234 подписей публичных съёмок после разметки людей — это отдельный ручной прогон `generate-shoot-seo.js` (можно повторно вызвать точечно через существующую кнопку «🤖» в редакторе фото или через бэкфилл-скрипт с очисткой конкретных `seo_desc`).
- Просмотр всех фото конкретного человека на публичной части сайта (только в admin).
- Ограничение доступа/приватность самой коллекции лиц за пределами обычной admin-авторизации, которая уже есть на `/admin/*`.
