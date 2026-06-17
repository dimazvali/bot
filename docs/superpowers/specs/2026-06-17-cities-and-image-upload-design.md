# Cities Assignment + Image Upload — Design Spec
Date: 2026-06-17
Status: Approved

## Context

`bot.dimazvali.com/web` — admin panel for the dimazvali Telegram geo-tour bot.
Three cities in Firestore (`DIMAZVALIcities`): Москва, Санкт-Петербург, Тбилиси.
Existing landmarks have `lat`/`lng` but `city: null` — sidebar tree is empty.
Existing `pic` field is a plain URL string; need multi-size WebP upload.

---

## Part 1: City Assignment Script

### Goal
One-time script assigns `city` (slug of the nearest city document) to every landmark that has `lat`/`lng` but no `city`.

### Algorithm
Haversine distance from each landmark to three hard-coded city centers:

| City | lat | lng |
|------|-----|-----|
| Москва | 55.7558 | 37.6173 |
| Санкт-Петербург | 59.9311 | 30.3609 |
| Тбилиси | 41.6938 | 44.8015 |

Script first fetches all `DIMAZVALIcities` docs to build a map `{ name → id (slug) }`, then matches by name. Landmarks without `lat`/`lng` are skipped with a log line.

### File
`scripts/assign-cities.js` — standalone Node.js script, run once with `node scripts/assign-cities.js`.
Reads env vars from `.env` (same as the main app) using `dotenv`.
Uses the same Firebase Admin SDK init as `routes/dimazvali.js`.

### Output
Dry-run mode by default (`DRY_RUN=true`): prints proposed assignments without writing.
Set `DRY_RUN=false` to apply. Example output:

```
Нарикала          → tbilisi   (2.3 km)
Мцхета            → tbilisi   (18.1 km)
Петропавловская   → spb       (1.1 km)
[DRY_RUN] No writes performed.
```

### No migration needed
Existing landmarks with `city` already set are skipped.

---

## Part 2: Image Upload with Resize

### Schema change
`pic` field changes from `string | null` to `{ w400, w800, w1400 } | null`.

**Backward compatibility helper** added to `common-admin.js`:
```js
function picUrl(pic) {
  if (!pic) return null;
  return typeof pic === 'string' ? pic : (pic.w800 || pic.w400 || pic.w1400);
}
```

### Backend endpoint
`POST /dimazvali/admin/upload-image`
- Auth: same admin middleware as other admin routes
- `multer` memoryStorage, field name `pic`, max 20 MB, images only
- `req.body.collection` + `req.body.id` determine the storage path
- `sharp` resizes to 3 widths as WebP quality 85:

| Width | Key |
|-------|-----|
| 400px | `w400` |
| 800px | `w800` |
| 1400px | `w1400` |

- Storage path: `media/{collection}/{id}_{w}.webp`
- Bucket: `getStorage(gcp).bucket('dimazvalimisc.appspot.com')` — explicit name avoids default-bucket issues (gcp is the dimazvali Firebase app initialized in routes/dimazvali.js)
- Files made public; returns `{ w400: url, w800: url, w1400: url }`
- On success: also calls `PUT /dimazvali/admin/{collection}/{id}` internally to save `pic` — **or** returns JSON and lets the client do the PUT (chosen approach: return JSON, client PUTs)

### Frontend — pic widget (geo.js)

Replaces the `edit('...', id, 'pic', 'text', ...)` pattern in `showLandmarkPanel` and `showTourPanel`.

New function `picWidget(collection, id, currentPic)` returns a DOM element:

```
[thumbnail 80×80 or grey placeholder]  [Загрузить фото ↑]
                                        file input (hidden)
```

- Click "Загрузить фото" → triggers hidden `<input type="file" accept="image/*">`
- On file change → show "Загружаем..." → POST FormData to `/dimazvali/admin/upload-image`
- On success → PUT `pic` to `/dimazvali/admin/{collection}/{id}` → update thumbnail in place
- Error → `handleError`

Thumbnail uses `picUrl(currentPic)` to handle old string values gracefully.

### Frontend — add forms

`pic` field **removed** from `addLandmarkForm` and `addTourForm` field lists.
After entity creation the user uploads via the panel's pic widget.

### Bot-side fixes (routes/dimazvali.js)

Two places updated to use `picUrl()` helper (defined inline in the route file):

**Landmark greeting** (line ~268):
```js
// Before (buggy — m.photo never set):
if (place.pic) { m.caption = m.text }
sendMessage2(m, m.pic ? 'sendPhoto' : false, ...)

// After:
var placePic = picUrl(place.pic);
if (placePic) { m.caption = m.text; m.photo = placePic; }
sendMessage2(m, placePic ? 'sendPhoto' : false, ...)
```

**Tour start** (line ~484):
```js
// Before:
if (tour.pic) { m.caption = m.text; m.photo = tour.pic; }
sendMessage2(m, tour.pic ? 'sendPhoto' : false, ...)

// After:
var tourPic = picUrl(tour.pic);
if (tourPic) { m.caption = m.text; m.photo = tourPic; }
sendMessage2(m, tourPic ? 'sendPhoto' : false, ...)
```

`picUrl` defined once near the top of `routes/dimazvali.js`:
```js
function picUrl(pic) {
  if (!pic) return null;
  return typeof pic === 'string' ? pic : (pic.w800 || pic.w400 || pic.w1400);
}
```

### Files touched

| Action | File | Change |
|--------|------|--------|
| Create | `scripts/assign-cities.js` | City assignment script |
| Modify | `routes/dimazvali.js` | `picUrl` helper + fix 2 pic usages + upload endpoint |
| Modify | `public/javascripts/dimazvali/common-admin.js` | Add `picUrl` helper |
| Modify | `public/javascripts/dimazvali/geo.js` | `picWidget()`, remove pic from add forms |

### Out of scope
- Upload for Pages/Sections/Tags/Authors/Programs/Shows (secondary sections, low traffic)
- City coordinates stored in Firestore
- Image deletion from Storage
