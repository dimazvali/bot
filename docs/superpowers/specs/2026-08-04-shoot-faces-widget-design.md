# Виджет «Найти себя» на публичной странице съёмки

**Дата:** 2026-08-04
**Статус:** Approved

## Суть

На публичной странице `/shoot/:slug` — если у съёмки включён флаг `showFaces` — показать ленту распознанных лиц (именованных и анонимных) под шапкой галереи. Клик по лицу фильтрует сетку фото до тех, где оно встречается. Цель: гости мероприятия быстро находят свои фото, даже если фотограф лично их не знает и не назвал через `/admin/people` ([[2026-07-31-photo-people-recognition-design]]).

---

## Что нового по сравнению с прошлой фичей

Прошлая фича ([[2026-07-31-photo-people-recognition-design]]) распознаёт и группирует только **именованных** людей — лицо, не привязанное вручную к человеку на `/admin/people`, просто лежит неразмеченным (сейчас таких ~1376 из ~1400). Виджет должен показывать **всех**, включая анонимных — фотограф может не знать в лицо всех гостей концерта. Значит нужна ещё одна, более лёгкая форма группировки: не «кто это», а «эти лица похожи друг на друга».

---

## Модель данных

### `shoots/{env}_{slug}` — новое поле

```json
{ "showFaces": true }
```

### `shootPhotos.faces[]` — новое поле на каждом лице

```json
{ "faceId": "...", "boundingBox": {...}, "personId": "people-doc-id-or-null", "matchedFaceId": "aws-face-id-or-null" }
```

`matchedFaceId` — лицо, которое AWS Rekognition посчитал ближайшим совпадением (`SearchFaces`, тот же порог 90%, что сейчас), **независимо от того, привело ли это к именованному человеку**. Раньше это значение вычислялось в `findMatch()`, но использовалось только когда матч приводил к уже названному `personId` — само значение никуда не сохранялось.

---

## Изменения в `lib/photo-people.js`

### `indexAndMatchFaces` — сохранять `matchedFaceId` всегда

```js
async function indexAndMatchFaces(imageBuffer) {
  var faces = await indexFacesForPhoto(imageBuffer);
  for (var i = 0; i < faces.length; i++) {
    var match = await findMatch(faces[i].faceId);
    if (match) {
      faces[i].matchedFaceId = match.faceId;
      var person = getPersonByFaceId(match.faceId);
      if (person) {
        await linkFaceToPerson(person.id, faces[i].faceId);
        faces[i].personId = person.id;
      }
    }
  }
  return faces;
}
```

### Новая функция `groupShootFaces(slug, shoot)`

Группирует все лица одной съёмки в список «людей» — именованных и анонимных:

```js
function groupShootFaces(slug, shoot) {
  var namedGroups = {}; // personId -> group
  var unnamed = [];     // [{ photo, face }]

  shoot.photos.forEach(function(photo) {
    (photo.faces || []).forEach(function(face) {
      if (face.personId) {
        if (!namedGroups[face.personId]) {
          var p = _cache[face.personId];
          namedGroups[face.personId] = { key: 'person:' + face.personId, name: p ? p.name : null, faces: [] };
        }
        namedGroups[face.personId].faces.push({ slug: slug, photoId: photo.id, faceId: face.faceId, boundingBox: face.boundingBox, thumb: photo.urls && photo.urls.preview });
      } else {
        unnamed.push({ photo: photo, face: face });
      }
    });
  });

  // union-find среди анонимных лиц этой съёмки, по цепочкам matchedFaceId
  var parent = {};
  function find(id) {
    if (!(id in parent)) parent[id] = id;
    if (parent[id] !== id) parent[id] = find(parent[id]);
    return parent[id];
  }
  function union(a, b) {
    var ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }
  var unnamedIds = {};
  unnamed.forEach(function(item) { unnamedIds[item.face.faceId] = true; find(item.face.faceId); });
  unnamed.forEach(function(item) {
    var m = item.face.matchedFaceId;
    if (m && unnamedIds[m]) union(item.face.faceId, m);
  });

  var anonGroups = {};
  unnamed.forEach(function(item) {
    var root = find(item.face.faceId);
    if (!anonGroups[root]) anonGroups[root] = { key: 'anon:' + root, name: null, faces: [] };
    anonGroups[root].faces.push({ slug: slug, photoId: item.photo.id, faceId: item.face.faceId, boundingBox: item.face.boundingBox, thumb: item.photo.urls && item.photo.urls.preview });
  });

  return Object.keys(namedGroups).map(function(k) { return namedGroups[k]; })
    .concat(Object.keys(anonGroups).map(function(k) { return anonGroups[k]; }));
}
```

**Важно:** группировка считается **только внутри одной съёмки**, не глобально по сайту. Один и тот же анонимный человек на двух разных съёмках получит две разные анонимные группы — это осознанное упрощение (см. брейнсторм), достаточное, раз виджет живёт на странице конкретной съёмки.

Экспортировать `groupShootFaces` из `lib/photo-people.js`.

---

## Бэкфилл: `matchedFaceId` для уже проиндексированных лиц

`scripts/rematch-pending-faces.js` уже проходит по всем неразмеченным лицам и вызывает `findMatch`. Меняем логику: сохранять `matchedFaceId` **всегда**, когда найден матч — не только когда он приводит к именованному человеку:

```js
var match = await photoPeople.findMatch(item.faceId);
var person = match ? photoPeople.getPersonByFaceId(match.faceId) : null;
var faces = item.photo.faces.map(function(f) {
  if (f.faceId !== item.faceId) return f;
  var updated = Object.assign({}, f, { matchedFaceId: match ? match.faceId : f.matchedFaceId });
  if (person) updated.personId = person.id;
  return updated;
});
await shoots.updatePhotoFaces(item.slug, item.photo.id, faces);
```

(Раньше запись в Firestore происходила только при удачном связывании с человеком — `linked++`; теперь пишем всегда, когда `matchedFaceId` меняется, даже без имени.)

После правки скрипт нужно **перезапустить** ещё раз (`PHOTO_ENV=prod node scripts/rematch-pending-faces.js`), чтобы проставить `matchedFaceId` на ~1376 уже проиндексированных, но неразмеченных лиц. Без этого прогона у старых фото анонимная группировка не сработает (поле просто пустое).

---

## Публичный роут (`routes/photo.js`, `GET /shoot/:slug`)

Добавить `var photoPeople = require('../lib/photo-people');` — без отдельного `initFromFirestore`: кэш уже общий процесс с `routes/photo-admin.js` (тот же паттерн, что уже используется для `shoots` — `routes/photo.js` не переинициализирует `shoots`, просто читает общий кэш).

В обработчике, если `shoot.showFaces`:

```js
var peopleGroups = shoot.showFaces ? photoPeople.groupShootFaces(slug, shoot) : [];
```

Передать `peopleGroups` в `res.render('photo/gallery', { ...,  peopleGroups })`.

---

## Вьюшка (`views/photo/gallery.pug`)

### Лента лиц под шапкой (только если `isShoot && peopleGroups.length`)

Для каждой группы — круглый аватар (та же CSS-математика кропа по `boundingBox`, что уже есть на `/admin/people`), под ним имя (или ничего, если анонимный). Каждая кнопка — `data-person-key`.

### Каждая карточка фото получает `data-person-keys`

Список ключей групп, присутствующих на этом фото (через запятую) — считается в pug на основе `photo.faces` и уже вычисленных `peopleGroups` (нужно сопоставление faceId → group.key, строится один раз перед рендером сетки).

### Клиентский фильтр

Тот же паттерн, что уже есть для `.type-filter` (см. `views/photo/gallery.pug`, скрипт снизу) — `data-hidden` атрибут на карточках. Отличия:
- клик по лицу схлопывает ленту в один чип с кнопкой «✕ все лица» (см. согласованный макет);
- выбор пишется в URL через `history.pushState('?person=' + key)`, без перезагрузки;
- при заходе по прямой ссылке `?person=key` — фильтр применяется сразу при загрузке скриптом (читаем `location.search`).

---

## Админка (`views/photo/admin/shoot-edit.pug`)

Рядом с существующим чекбоксом `public`:

```pug
label.admin-tag-check
  input(type='checkbox' name='showFaces' checked=shoot.showFaces)
  span показывать лица (виджет «найти себя»)
```

Обработчик `POST /shoots/:slug/edit` уже читает `req.body` и передаёт в `shoots.saveShoot` — добавить `showFaces: !!req.body.showFaces` в список полей аналогично тому, как уже обрабатывается `public`.

---

## Что не входит в скоуп

- Глобальная (кросс-съёмочная) анонимная группировка.
- Ручное объединение/разделение анонимных групп через админку (в отличие от именованных людей — там уже есть merge/unlink на `/admin/people`).
- Уведомление гостя, если появилось новое фото с ним (пока просто статическая фильтрация уже загруженной галереи).
