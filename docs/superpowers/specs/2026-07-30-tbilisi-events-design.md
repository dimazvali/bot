# Tbilisi Events Afisha (MVP) — Design Spec

## Goal

An agent that pulls event listings for Tbilisi from Telegram channels, Facebook pages, Instagram pages, and websites, extracts structured event data with an LLM, deduplicates against what's already known, and shows the result as a simple table. Collection is triggered manually from an admin page — no scheduling in the MVP.

## Architecture

**Pattern:** New independent path-based route (not a vhost), mounted alongside existing standalone routes like `/proxy`, `/test`, `/homeless`:

```js
app.use('/tbilisi-events', require('./routes/tbilisi-events'));
app.use('/tbilisi-events/admin', require('./routes/tbilisi-events-admin'));
```

**Firebase:** Same GCP project (`dimazvalimisc`), same credentials (`sssGCPKey`), new named Firebase app `'tbilisiEvents'` (pattern copied from `routes/eka.js`). Firestore collections:
- `tbilisiEvents` — the events table
- `tbilisiEventsAdmins` — admin usernames/password hashes
- `tbilisiEventsAdminTokens` — cookie session tokens

Auth follows the `eka-admin.js` cookie+password pattern exactly (`sha256('tbilisiEvents:' + pass)`, no separate user accounts needed for MVP).

**File structure:**
```
routes/
  tbilisi-events.js          public table page
  tbilisi-events-admin.js    admin login + "collect" trigger

lib/
  tbilisi-events-sources.js     static source list (filled in later by user)
  tbilisi-events-collectors.js  per-source-type raw fetchers
  tbilisi-events-extractor.js   Claude-based extraction of structured events from raw text
  tbilisi-events-dedup.js       normalize + merge duplicates against existing Firestore data
  tbilisi-events-data.js        Firestore read/write for the events collection

views/tbilisi-events/
  list.pug           public table
  admin/login.pug
  admin/index.pug    "Собрать события" button + run result/log
```

**New dependency:** `cheerio` (HTML parsing for Telegram's public preview pages and generic websites). `axios` and `@anthropic-ai/sdk` are already in the project.

**New env vars:** `APIFY_TOKEN` (Apify API token, used only for the Facebook/Instagram collectors).

## Data Model

Firestore collection `tbilisiEvents`, one document per event:

```js
{
  title: string,
  date: string,       // ISO yyyy-mm-dd
  time: string | null,
  place: string | null,
  sources: [ { label: string, url: string } ],  // one entry per source that mentioned this event
  dedupeKey: string,  // normalized title + date, used for duplicate lookup
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

Events are never deleted or filtered by date automatically — past events remain in the table. Manual cleanup (deleting old docs via the Firebase console or a future admin action) is out of scope for the MVP.

## Pipeline (triggered by the admin "Собрать события" button)

1. **Collect.** For each entry in `tbilisi-events-sources.js`, run the matching collector:
   - `telegram`: fetch `https://t.me/s/<channel>`, parse posts with `cheerio` (no login required — this is Telegram's public preview page).
   - `website`: fetch the page with `axios`, strip HTML to text with `cheerio`.
   - `facebook` / `instagram`: call an Apify actor via its REST API with `APIFY_TOKEN`, read back posts/events JSON.

   Each collector call is wrapped in try/catch; a failing source is logged and skipped, the run continues with the rest.

2. **Extract.** Each raw item (post text or page text + its source URL) is sent to Claude with a prompt asking: is this an announcement of a public event happening in Tbilisi? If yes, return `{ title, date, time, place }`; if no, return `null`. Items that don't parse to valid JSON or come back `null` are dropped.

3. **Dedupe.** For every extracted event, compute `dedupeKey = normalize(title) + '|' + date` (normalize = lowercase, trim, collapse whitespace, strip punctuation). Look up existing Firestore docs by `dedupeKey`:
   - No match → insert new doc.
   - Match found → merge: append the new source into `sources` (skip if the same URL is already present), update `updatedAt`. Title/date/time/place are not overwritten by the merge.

   This dedup check is against the full existing collection, not just within the current run, so repeated runs don't create duplicate rows.

4. **Done.** Admin page shows a simple run summary (sources processed, events found/merged, per-source errors) after the synchronous request completes.

## Admin Page

`/tbilisi-events/admin`:
- Login screen (password only, cookie session) — mirrors `eka-admin.js`.
- Dashboard: one button, "Собрать события". Runs the full pipeline synchronously in the request handler and renders the result summary on the same page. No background job/queue in the MVP; if runs become too slow as sources grow, moving this to a background job is a follow-up, not part of this spec.

## Public Table Page

`/tbilisi-events`: reads all docs from `tbilisiEvents`, sorted by `date`, renders a plain HTML table:

| Название | Дата/время | Место | Источник(и) |
|---|---|---|---|

`sources` renders as one or more links per row (label = source name, href = url).

## Error Handling

- Collector failures: per-source try/catch, logged to console, run continues.
- Extraction failures (bad/unparseable LLM response): per-item skip, logged.
- No retries in the MVP — a failed source is simply absent from that run's results; re-running later will pick it up again.

## Testing

The project has no automated test framework. Verification is manual: run the admin "collect" button against a small subset of real sources (1-2 per type) and confirm the resulting Firestore documents and rendered table look correct, then re-run to confirm dedup against existing data works (no duplicate rows, sources merge).

## Out of Scope (MVP)

- Scheduled/cron collection (manual button only for now).
- Deleting or auto-hiding past events.
- Event categories, prices, descriptions, images.
- Cross-run conflict resolution beyond simple title+date dedup (e.g. fuzzy matching for slightly different titles/times).
- Facebook/Instagram implementation details (which Apify actor, its output shape) — to be worked out during implementation once an Apify account/token is available.
