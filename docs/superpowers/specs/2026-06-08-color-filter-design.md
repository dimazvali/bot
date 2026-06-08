# Color Filter for Photo Gallery — Design Spec

**Date:** 2026-06-08  
**Project:** photo.dimazvali.com  
**Status:** approved

---

## Goal

Allow visitors to browse all photos filtered by dominant color family — globally across the entire archive, similar to how `/tag/:slug` works for tags.

---

## Data Model

Each photo object in `photo.json` gets one new field:

```json
{
  "id": "tbilisi-sunset",
  "title": "Тбилиси, закат",
  "colorFamily": "orange",
  ...
}
```

**Eight color families** mapped from HSL hue angle:

| Family   | Hue range       | Hex (UI swatch) |
|----------|-----------------|-----------------|
| `red`    | 345–15°         | `#c0392b`       |
| `orange` | 15–45°          | `#e67e22`       |
| `yellow` | 45–75°          | `#f1c40f`       |
| `green`  | 75–165°         | `#27ae60`       |
| `teal`   | 165–210°        | `#1abc9c`       |
| `blue`   | 210–270°        | `#2980b9`       |
| `purple` | 270–345°        | `#8e44ad`       |
| `mono`   | any, S < 15%    | `#888888`       |

`mono` catches black-and-white and desaturated photos regardless of hue.

---

## Color Extraction

**Method:** `sharp(buffer).stats()` — returns `dominant: { r, g, b }`, the most frequent color bucket in the image. More accurate than pixel-average for photos with clear dominant areas (sky, ground, water).

**RGB → HSL conversion** done in JS. Map H angle + S threshold to family string above.

**Extraction happens in two places:**

1. **New uploads** (`routes/photo-admin.js`): add `sharp(req.file.buffer).stats()` to the existing `Promise.all` with the three resizes. Extract color family and add `colorFamily` to `photoEntry` before `saveData`.

2. **Migration** (`scripts/extract-colors.js`): one-time script that:
   - Reads `photo.json`
   - Finds all photos without `colorFamily`
   - Downloads `urls.preview` (800px webp) for each
   - Runs `sharp(buffer).stats()` → maps to family
   - Writes result back to `photo.json`
   - Processes 5 photos in parallel to avoid network overload

---

## Routes

New route in `routes/photo.js`, analogous to `/tag/:slug`:

```
GET /color/:family
```

- Validates `family` is one of the 8 known strings, returns 404 otherwise
- Calls `getAllPhotos()`, filters by `p.colorFamily === family`
- Renders a new `photo/color-gallery.pug` (same structure as `tag-gallery.pug`, with a color swatch and Russian label in the header instead of a tag name)
- Page title: e.g. `СИНИЙ · 42 фото`
- Added to `sitemap.xml`

---

## UI

**Sidebar** — new small section below `.sidebar-nav`, above `.sidebar-footer`:

```
● ● ● ●
● ● ● ●
```

Eight colored circles (24×24px), two rows of four, each linking to `/color/:family`. Active family gets a white ring (`box-shadow: 0 0 0 2px #fff`). Tooltip = family name on hover.

**On mobile** — same circles appear as a horizontally scrollable strip in `.mobile-header`, between the burger and the theme toggle. `overflow-x: auto`, no scrollbar visible (`scrollbar-width: none`).

No changes to gallery template itself — color filter page reuses existing masonry layout.

---

## Migration Script Interface

```bash
node scripts/extract-colors.js
# → Processing 247 photos...
# → [243/247] done
# → 4 skipped (no urls.preview)
# → Saved photo.json
```

Idempotent: skips photos that already have `colorFamily`. Safe to re-run.

---

## What's Not in Scope

- Storing `dominantColor` hex (just `colorFamily` string is enough for filtering)
- Multi-color palette per photo
- Color filter within a specific country/series page (global only)
- Retroactively updating colors when re-uploading a photo (manual admin action if needed)
