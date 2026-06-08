# Eka Georgia Guide — Design Spec

## Goal

A bilingual (RU/EN) website for Georgian tour guide Eka Eliseeva at `eka.dimazvali.com`. Visitors browse destinations and tours, submit booking requests. Eka manages everything via an admin panel.

## Architecture

**Pattern:** Follow `photo.js` / `photo-admin.js` exactly. New vhost on existing Node.js/Express server.

```
app.use(vhost('eka.*.*', require('./routes/eka')))
app.use(vhost('eka.localhost', require('./routes/eka')))
```

**Firebase:** Same project (`dimazvalimisc`), same credentials (`sssGCPKey`). Separate Firestore collections prefixed `eka_`. Same Firebase Storage bucket, path prefix `eka/`.

**Auth:** Cookie-based admin auth, same pattern as `photo-admin.js` (`ekaAdminToken` signed cookie, `ekaAdminTokens` Firestore collection).

**File structure:**
```
routes/
  eka.js              public router
  eka-admin.js        admin router

lib/
  eka-data.js         Firestore CRUD for directions + tours (with in-memory cache)
  eka-mailer.js       email/notification to Eka on new request

views/eka/
  layout.pug          base layout (lang switcher, nav, footer)
  home.pug            homepage
  direction.pug       direction page
  tour.pug            tour detail page
  about.pug           about Eka page
  request-sent.pug    confirmation after form submit
  admin/
    login.pug
    index.pug         dashboard
    directions.pug    directions list
    direction-edit.pug
    tours.pug         tours list
    tour-edit.pug
    requests.pug      requests list

public/stylesheets/eka/style.css
public/javascripts/eka/main.js
```

## Visual Design

- **Style:** Minimalist / editorial. White background, thin borders (#e8e8e8), generous whitespace.
- **Headings font:** Playfair Display (Google Fonts), weights 400 and 500.
- **Body font:** Helvetica Neue / Arial, 14px base.
- **Palette:** Black (#111) / mid-grey (#666, #999, #bbb) / border (#e8e8e8). No accent color — typographic contrast only.
- **Buttons:** thin border, letter-spacing, uppercase, 9–10px.

## Routing and Internationalisation

Language is in the URL. All public routes are prefixed `/ru/` or `/en/`.

```
GET /                     → redirect to /ru/ or /en/ based on Accept-Language (default: ru)
GET /ru/                  homepage RU
GET /en/                  homepage EN
GET /ru/directions/:slug  direction page RU
GET /en/directions/:slug  direction page EN
GET /ru/tours/:id         tour page RU
GET /en/tours/:id         tour page EN
GET /ru/about             about page RU
GET /en/about             about page EN
POST /ru/request          submit request (direction interest or tour booking)
POST /en/request          submit request
```

Each page includes `<link rel="alternate" hreflang="ru" href="...">` and `<link rel="alternate" hreflang="en" href="...">` in `<head>`. The lang switcher in the nav toggles between `/ru/...` and `/en/...` for the current page.

The `lang` param is extracted from the URL prefix by the router and passed to Pug as `res.locals.lang`. All templates use `lang === 'ru' ? textRu : textEn` inline.

## Data Model (Firestore)

### `eka_directions`

| Field | Type | Notes |
|---|---|---|
| `id` | string | auto Firestore ID |
| `slug` | string | URL-friendly, unique (e.g. `kazbegi`) |
| `titleRu` | string | |
| `titleEn` | string | |
| `descRu` | string | short intro paragraph |
| `descEn` | string | |
| `extraTextRu` | string | optional longer text shown after gallery |
| `extraTextEn` | string | |
| `heroImage` | string | Storage URL of 1400px WebP |
| `heroImageSizes` | object | `{ w400, w800, w1400, w2400 }` Storage URLs |
| `gallery` | array | each item: `{ w400, w800, w1400, w2400 }` |
| `metaDurationRu` | string | e.g. `1–2 дня` |
| `metaDurationEn` | string | e.g. `1–2 days` |
| `metaGroupSize` | string | e.g. `до 8 человек / up to 8 people` |
| `metaSeasonRu` | string | e.g. `Май — Октябрь` |
| `metaSeasonEn` | string | e.g. `May — October` |
| `metaDistanceRu` | string | e.g. `150 км от Тбилиси` |
| `metaDistanceEn` | string | |
| `published` | boolean | false = hidden from public |
| `order` | number | display order on homepage |

### `eka_tours`

| Field | Type | Notes |
|---|---|---|
| `id` | string | auto Firestore ID |
| `directionId` | string | FK → `eka_directions` |
| `directionSlug` | string | denormalised for URL building |
| `titleRu` | string | |
| `titleEn` | string | |
| `descRu` | string | |
| `descEn` | string | |
| `date` | timestamp | start date |
| `durationRu` | string | e.g. `1 день` |
| `durationEn` | string | e.g. `1 day` |
| `price` | number | |
| `currency` | string | `USD` / `GEL` / `RUB` |
| `maxParticipants` | number | |
| `published` | boolean | |

### `eka_requests`

| Field | Type | Notes |
|---|---|---|
| `id` | string | auto Firestore ID |
| `type` | string | `tour` or `direction` |
| `tourId` | string? | set when type = `tour` |
| `directionId` | string? | set when type = `direction` |
| `directionSlug` | string? | for display in admin |
| `tourTitle` | string? | denormalised for display |
| `name` | string | |
| `contactType` | string | `email` / `telegram` / `whatsapp` |
| `contact` | string | value of the chosen contact |
| `preferredDates` | string | free text, optional |
| `message` | string | optional |
| `lang` | string | `ru` / `en` |
| `status` | string | `new` / `contacted` / `done` |
| `createdAt` | timestamp | |

## Image Processing

Upload via `multer` (memory storage) + `sharp`. Four WebP sizes generated per image:

| Name | Width | Use |
|---|---|---|
| `w400` | 400px | mobile thumbnails, gallery small |
| `w800` | 800px | mobile full-width, tablet |
| `w1400` | 1400px | desktop content width |
| `w2400` | 2400px | retina / HiDPI |

Storage paths:
- Hero: `eka/directions/{id}/hero-{width}.webp`
- Gallery: `eka/directions/{id}/gallery-{index}-{width}.webp`

All images served via `<picture>` with `srcset` so the browser picks the right size:
```html
<picture>
  <source media="(max-width: 400px)" srcset="{w400}">
  <source media="(max-width: 800px)" srcset="{w800}">
  <source media="(max-width: 1400px)" srcset="{w1400}">
  <img src="{w2400}" alt="...">
</picture>
```

## Public Pages

### Homepage (`/ru/` and `/en/`)

- **Nav:** logo (Playfair), links (Направления / Туры / О себе), RU/EN switcher
- **Hero section:** large photo of Eka (left half) + name, short bio, two CTAs (right half)
- **Directions grid:** 3-column grid of direction cards with hero image, title, tour count
- **Upcoming tours list:** next 5 published tours, sorted by date, with date / title / price / group size
- **Footer:** name + social links (Telegram, WhatsApp, Instagram, Email)

### Direction page (`/ru/directions/:slug`)

1. Breadcrumb: Главная / Направления / {title}
2. Full-width hero image (`<picture>` srcset)
3. Intro section: title + description (left), meta facts (right: distance, duration, group size, season)
4. Gallery grid (all gallery images)
5. Extra text block (optional — shown only if `extraTextRu`/`extraTextEn` is set)
6. Upcoming tours for this direction (if any)
7. "Хочу сюда" request form (always shown, even when tours exist)

### Tour page (`/ru/tours/:id`)

- Direction breadcrumb
- Tour title (Playfair, large)
- Meta: date, duration, price, group size
- Description
- Request / booking form (name, contact type, contact, message)

### About page (`/ru/about`)

- Photo of Eka (float left)
- Extended bio text (RU/EN)
- Contact links

### Request confirmation (`/ru/request-sent`)

- Simple "Заявка отправлена" message
- Link back to homepage

## Request Form Behaviour

- Both direction and tour pages have the same form component (Pug mixin)
- Fields: name (required), contact type radio (Email / Telegram / WhatsApp), contact value (required), preferred dates (optional free text), message (optional)
- On submit: `POST /ru/request` or `POST /en/request`
- Server saves to `eka_requests`, fires `eka-mailer.js` notification to Eka, redirects to `/ru/request-sent`
- Validation: name and contact required; if missing → redirect back with `?err=1`

## Email Notifications (`lib/eka-mailer.js`)

- Uses same Nodemailer + Gmail SMTP pattern as `lib/photo-mailer.js`
- `init()` creates transporter
- `sendRequestNotification(request)` sends to Eka's email (env var `EKA_NOTIFY_EMAIL`) with request details
- Dark HTML email template consistent with photo-mailer style

## Admin Panel (`/admin`)

### Login
Same pattern as photo-admin: password (`EKA_ADMIN_PASS` env var), signed cookie `ekaAdminToken`.

### Dashboard (`/admin/`)
- Count of new (unread) requests
- List of next 5 upcoming tours
- Quick links to create direction / create tour

### Directions (`/admin/directions`)
- Table: title, published status, tour count, Edit button
- "New direction" button
- Drag-to-reorder (updates `order` field via `POST /admin/directions/reorder`)

### Direction edit (`/admin/directions/:id/edit` and `/admin/directions/new`)
- Fields: titleRu, titleEn, descRu, descEn, extraTextRu, extraTextEn, slug
- Meta fields: duration, group size, season, distance (RU + EN each)
- Hero image upload (generates 4 sizes)
- Gallery image upload (multiple, generates 4 sizes each, shows existing with delete)
- Published toggle
- Save / Delete buttons

### Tours (`/admin/tours`)
- Table: date, direction, title, price, published
- "New tour" button
- Past tours shown with muted style

### Tour edit (`/admin/tours/:id/edit` and `/admin/tours/new`)
- Fields: direction (select), titleRu, titleEn, descRu, descEn
- date (date picker), durationRu, durationEn, price, currency (select), maxParticipants
- Published toggle

### Requests (`/admin/requests`)
- Table: date, type, direction/tour, name, contact, status
- Filter tabs: All / New / Contacted / Done
- Click row → expand details, change status

## `lib/eka-data.js`

Simple in-memory cache pattern (same as `photo-data.js` but reading from Firestore directly — no local JSON file fallback since data structure is relational):

```js
// directions
async function getDirections()           // returns cached array, sorted by order
async function getDirection(id)
async function saveDirection(id, data)
async function deleteDirection(id)

// tours
async function getTours(opts)            // opts: { directionId?, upcomingOnly? }
async function getTour(id)
async function saveTour(id, data)
async function deleteTour(id)

// requests
async function saveRequest(data)         // returns new doc id
async function getRequests(opts)         // opts: { status? }
async function updateRequestStatus(id, status)

async function init(db)                  // called on startup, populates cache
```

Cache is invalidated on every write. Directions and tours are cached. Requests are always read from Firestore (not cached, volume is low).

## Environment Variables

| Var | Purpose |
|---|---|
| `sssGCPKey` | GCP service account private key (shared with photo) |
| `PHOTO_BUCKET` | Firebase Storage bucket (shared with photo) |
| `EKA_ADMIN_PASS` | Admin panel password |
| `EKA_NOTIFY_EMAIL` | Eka's email for request notifications |
| `GMAIL_USER` | Gmail sender (shared with photo-mailer) |
| `GMAIL_PASS` | Gmail app password (shared with photo-mailer) |

## Out of Scope

- Online payment
- User accounts / registration
- Multi-language rich text editor
- Comments or reviews
- Map integration
- Calendar / availability system
