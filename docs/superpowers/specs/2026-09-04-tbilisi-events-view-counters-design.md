# Tbilisi Events — View Counters — Design Spec

## Goal

Count human page views for the three public detail pages — **events**, **collections**, **venues** — while excluding crawlers and bots. Each counted view:

1. increments a denormalized `viewCount` field on the entity document, and
2. appends one row to a `tbilisiEventsViews` collection, so per-day / per-source graphs can be built later.

Stays within the current architecture: named Firebase app (`tbilisiEvents`), `lib/tbilisi-events-*.js` modules, path-mounted routes in `routes/tbilisi-events.js`, `var`/CommonJS, `node --test`.

## Decisions (from brainstorming)

- **Time-series storage:** one row per counted view (max flexibility for later aggregation). Not daily buckets.
- **Bot filtering:** `isbot` package **plus** empty-UA and non-`text/html` `Accept` rejection.
- **Dedup:** none. Every countable GET of a canonical detail URL is `+1`.
- **Admin views:** not counted (admin-token cookie present → skip).

Rejected: daily bucket counters (compact but no hourly/source detail); per-visitor dedup window (closer to "unique views" but needs cookie/Firestore TTL bookkeeping the user does not want); a counting middleware (would run before the handler knows the entity exists / is canonical).

## Data Model

### Collections `tbilisiEvents`, `tbilisiEventsCollections`, `tbilisiEventsVenues` — added field

```js
{
  // ...existing fields
  viewCount: 0,   // total counted human views; incremented via FieldValue.increment(1)
}
```

Added to `EVENT_DEFAULTS`, `COLLECTION_DEFAULTS`, `VENUE_DEFAULTS`. Existing documents have no field; `FieldValue.increment(1)` creates it (`0 → 1`). All reads use `x.viewCount || 0`.

### New collection `tbilisiEventsViews` — one document per counted view

```js
{
  type: 'event' | 'venue' | 'collection',
  entityId: string,          // doc id of the viewed entity
  at: Timestamp,             // server-side new Date()
  ipHash: string | null,     // sha256(ip + salt).slice(0,16); not reversible to raw IP
  ref: string | null,        // referer host only, e.g. 'google.com'; null if absent/same-site
  lang: string | null,       // resolved UI lang for the request ('ru'|'en'|'ka')
  path: string | null,       // req.path, for debugging
}
```

Auto-id documents. Never read on the request path. `getViewRecords()` (below) is the only reader and exists for future graph code.

## New module `lib/tbilisi-events-views.js`

CommonJS, `var`. Depends on `isbot`, `crypto`, and `./tbilisi-events-data`.

### `isCountableView(req)` → boolean

Returns `false` (do not count) when **any** of:

- `req.cookies && req.cookies.tbilisiEventsAdminToken` is set — admin preview.
- `ua` (`req.get('user-agent')`) is falsy or empty after trim.
- `isbot(ua)` is `true` (`isbot@^4`, named export: `var isbot = require('isbot').isbot`).
- `req.get('accept')` does not contain `text/html` — non-browser fetchers (curl, link unfurlers that send `*/*`, JSON clients).

Otherwise returns `true`. No dedup, no rate state.

### `hashIp(req)` → string

`sha256(ip + salt)` hex, first 16 chars. `salt` = `process.env.TBILISI_EVENTS_VIEW_SALT || 'te-views-v1'`. Purpose: coarse uniqueness / abuse analysis later without storing raw IPs.

`ip` resolution: the app does **not** set Express `trust proxy`, so `req.ip` is the socket peer (the reverse proxy in production). Take the first token of `X-Forwarded-For` when present, else `req.ip`, else `req.socket.remoteAddress`; trim, and treat empty as `null` → `ipHash: null`. Do not enable `trust proxy` app-wide as part of this feature (out of scope, affects the whole app).

### `recordView(type, entityId, req)` → Promise<void>

Fire-and-forget helper. Callers invoke **without `await`**. Implementation:

```
try {
  await Promise.all([
    data.bumpViewCount(type, entityId),
    data.addViewRecord({
      type: type,
      entityId: entityId,
      ipHash: hashIp(req),
      ref: refHost(req),          // module-local: parse req.get('referer'), return host or null; null if host === req.hostname
      lang: i18n.normalizeLang(req.query.lang),
      path: req.path,
    }),
  ]);
} catch (e) {
  console.error('[te views] ' + type + '/' + entityId + ': ' + e.message);
}
```

Must never reject — a failed write must not affect the page response.

### Exports

`{ isCountableView, recordView }` (plus `hashIp` for tests).

## Data layer additions — `lib/tbilisi-events-data.js`

- `function viewsCollection() { return _db.collection('tbilisiEventsViews'); }`
- **`bumpViewCount(type, id)`** — maps `type` to the right collection accessor
  (`event`→`eventsCollection`, `venue`→`venuesCollection`, `collection`→`collectionsCollection`;
  unknown type throws). Then
  `await coll().doc(id).update({ viewCount: FieldValue.increment(1), updatedAt: new Date() })`.
  `FieldValue` via `require('firebase-admin/firestore')`, matching `lib/photo-shoots.js`.
  - Note: `updatedAt` bump on every view is acceptable here (detail pages are not sorted by `updatedAt`); if implementation finds a sort dependency, drop `updatedAt` from this write.
- **`addViewRecord(entry)`** — mirrors `addAdminLog`:
  ```js
  var doc = Object.assign(
    { type: null, entityId: null, ipHash: null, ref: null, lang: null, path: null },
    entry || {},
    { at: new Date() }
  );
  await viewsCollection().add(doc);
  ```
- **`getViewRecords(opts)`** — `opts = { type, entityId, since, limit }`, all optional.
  Builds `viewsCollection()` query: `.where('type','==',type)` and/or `.where('entityId','==',entityId)` when given,
  `.where('at','>=',since)` when given, `.orderBy('at','desc').limit(opts.limit || 500)`.
  Returns `snap.docs.map(d => Object.assign({ id: d.id }, d.data()))`. For future graph code only.
- Add `viewCount: 0` to `EVENT_DEFAULTS`, `COLLECTION_DEFAULTS`, `VENUE_DEFAULTS`.
- Export `bumpViewCount`, `addViewRecord`, `getViewRecords`.

## Route wiring — `routes/tbilisi-events.js`

`var views = require('../lib/tbilisi-events-views');` at the top with the other requires.

In each of `GET /e/:id`, `GET /venues/:id`, `GET /collections/:id`, immediately **after** the
canonical-slug 301 check and **before** assembling render data:

```js
if (views.isCountableView(req)) views.recordView('event', event.id, req);
```

(`'venue', venue.id` / `'collection', collection.id` respectively.)

- No `await` — the render must not wait on Firestore writes.
- Placed after the `if (!entity) return next()` and `if (slug mismatch) return res.redirect(301, …)` guards, so only canonical `200` renders are counted; `404`s and redirects are not.

## Dependency

Add `"isbot": "^4"` to `package.json` `dependencies` and `npm install`. `isbot` v5 is ESM-only; v4 is dual CJS/ESM and works with `require`.

## Testing — `test/tbilisi-events-views.test.js` (`node --test`)

`isCountableView` (build fake `req` with `get`, `cookies`, `query`):

| UA | Accept | admin cookie | expected |
|----|--------|--------------|----------|
| `Mozilla/5.0 … Chrome/120` | `text/html,…` | no | `true` |
| `Googlebot/2.1 (+http://www.google.com/bot.html)` | `text/html` | no | `false` |
| `` (empty) | `text/html` | no | `false` |
| Chrome UA | `application/json` | no | `false` |
| Chrome UA | `text/html` | **yes** | `false` |

`recordView` with an injected fake data layer (pass via module seam — see implementation note):
- calls `bumpViewCount` once with the given `type`/`id`;
- calls `addViewRecord` once with an object carrying `type`, `entityId`, and a 16-char `ipHash`;
- when the fake `bumpViewCount` rejects, `recordView` still resolves (no unhandled rejection).

`hashIp`: same `req` twice → same hash; length 16; differs when IP differs.

Implementation note: `recordView` needs `data` to be swappable in the test. Either (a) `require` the real `./tbilisi-events-data` and monkey-patch its exported functions in the test, matching how `tbilisi-events-data.test.js` handles `_db`, or (b) accept an optional injected deps object. Pick whichever matches the existing test style; (a) is expected.

## Out of scope (follow-ups)

- Admin UI showing `viewCount` on list/detail pages.
- Admin analytics page with view graphs over time (would consume `getViewRecords`).
- Historical backfill (no data before ship; counts start at deploy).
- Rate-limiting / per-visitor dedup / bounce filtering.

## Status

Implemented 2026-09-04 on branch `te-view-counters` (plan:
`docs/superpowers/plans/2026-09-04-tbilisi-events-view-counters.md`). Smoke-tested
against a live event page: a Chrome UA hit incremented `viewCount` by 1 and wrote
one `tbilisiEventsViews` row; Googlebot and a bare `curl` (no `text/html`) did not
count. Follow-ups (admin display, graphs, backfill) not started.
