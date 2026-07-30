# Tbilisi Events Afisha (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a manually-triggered agent that collects Tbilisi event announcements from Telegram, websites, Facebook and Instagram, extracts structured fields with Claude, dedupes against what's already stored, and shows the result as a table at `/tbilisi-events`.

**Architecture:** New independent path-mounted routes (`/tbilisi-events`, `/tbilisi-events/admin`), a new named Firebase app (`tbilisiEvents`, same GCP project as the rest of the codebase) with one Firestore collection (`tbilisiEvents`), and a set of small `lib/tbilisi-events-*.js` modules (data, dedup, extractor, collectors, sources config, pipeline orchestrator) wired together by the admin route's "collect" button.

**Tech Stack:** Node.js/Express/Pug (existing app conventions — `var`, CommonJS, no test framework), `firebase-admin`, `axios` (existing dep), `cheerio` (new dep), `@anthropic-ai/sdk` (existing dep, `claude-haiku-4-5-20251001`), Apify REST API for Facebook/Instagram.

**Spec:** `docs/superpowers/specs/2026-07-30-tbilisi-events-design.md`

---

## Important context for the engineer

- This codebase has **no automated test framework** (no Jest/Mocha/etc anywhere in the repo). Verification below is manual: run small `node -e` snippets or one-off scripts (following the existing `scripts/*.js` convention, e.g. `scripts/seed-photo-firestore.js`) and read the output.
- Firebase is one shared GCP project (`dimazvalimisc`) split into named Firebase Admin SDK "apps" per vertical, each with its own Firestore collection prefix. Copy the exact credential block pattern from `routes/eka.js` — same `project_id`, `private_key_id`, `client_email`, `client_id` fields, only `private_key` changes (from `process.env.sssGCPKey`), and the app name changes (`'tbilisiEvents'` instead of `'eka'`).
- Admin auth: copy the exact pattern from `routes/eka-admin.js` (`requireAuth`, `/login` GET+POST, `/logout`, cookie holding `sha256('tbilisiEvents:' + pass)`), but **skip the Firestore-backed admin list** — in `eka-admin.js` that list (`ekaAdmins`) exists for multi-admin management, which this single-button MVP doesn't need. Auth is just one password in an env var (`TBILISI_EVENTS_ADMIN_PASS`), matching the `EKA_ADMIN_PASS` env-var fallback branch already in `eka-admin.js:75-81`.
- Claude extraction: copy the exact call pattern from `lib/photo-seo.js` (`new Anthropic({ apiKey })`, `model: 'claude-haiku-4-5-20251001'`, parse `message.content[0].text` for a JSON blob via regex).
- New env vars needed (add manually to `.env`, not part of any commit): `TBILISI_EVENTS_ADMIN_PASS`, `APIFY_TOKEN`, `APIFY_FB_ACTOR_ID`, `APIFY_IG_ACTOR_ID`. `ANTHROPIC_API_KEY` and `sssGCPKey` already exist in `.env` (used by other verticals).
- The source list (`lib/tbilisi-events-sources.js`) ships as an empty array — the user will fill it in with real Telegram channels / websites / FB / IG pages after this plan is implemented. Don't invent placeholder sources in that file; do use a known real, public, stable source (e.g. `https://t.me/s/durov`) purely to mechanically verify the Telegram/website collector parsing during Task 5 — that's throwaway verification, not part of what gets committed.
- Facebook/Instagram collectors can be fully implemented (the Apify REST call shape doesn't depend on which actor is chosen), but **cannot be end-to-end verified in this plan** — there's no `APIFY_TOKEN`/actor chosen yet. Task 5's Facebook/Instagram steps note this explicitly; don't skip implementing them, just skip the live-call verification for those two functions.

---

## Task 1: Add `cheerio` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run: `npm install cheerio@^1.0.0`

Expected: `package.json` gains a `"cheerio": "^1.0.0"` line under `dependencies`, `package-lock.json` updates, no errors.

- [ ] **Step 2: Verify it loads**

Run: `node -e "var cheerio = require('cheerio'); console.log(cheerio.load('<p>hi</p>')('p').text())"`
Expected output: `hi`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add cheerio for HTML parsing"
```

---

## Task 2: Firestore data layer

**Files:**
- Create: `lib/tbilisi-events-data.js`

- [ ] **Step 1: Write the module**

```js
'use strict';
var _db = null;

function init(db) {
  _db = db;
}

function eventsCollection() {
  return _db.collection('tbilisiEvents');
}

async function findByDedupeKey(dedupeKey) {
  var snap = await eventsCollection().where('dedupeKey', '==', dedupeKey).limit(1).get();
  if (snap.empty) return null;
  return Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
}

async function insertEvent(event) {
  var now = new Date();
  var doc = Object.assign({}, event, { createdAt: now, updatedAt: now });
  var ref = await eventsCollection().add(doc);
  return ref.id;
}

async function addSourceToEvent(id, source) {
  var ref = eventsCollection().doc(id);
  var snap = await ref.get();
  if (!snap.exists) return;
  var sources = snap.data().sources || [];
  var exists = sources.some(function(s) { return s.url === source.url; });
  if (!exists) sources.push(source);
  await ref.update({ sources: sources, updatedAt: new Date() });
}

async function getAllEvents() {
  var snap = await eventsCollection().orderBy('date').get();
  return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

module.exports = { init, findByDedupeKey, insertEvent, addSourceToEvent, getAllEvents };
```

- [ ] **Step 2: Verify against real Firestore with a scratch script**

Create a temporary file `scratch-verify-data.js` in the project root (delete it after, do not commit):

```js
require('dotenv').config();
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var data = require('./lib/tbilisi-events-data');

var app = getApps().find(function(a) { return a.name === 'tbilisiEvents'; }) || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: (process.env.sssGCPKey || '').replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
    client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }),
}, 'tbilisiEvents');

data.init(getFirestore(app));

(async function() {
  var id = await data.insertEvent({ title: 'Test Event', date: '2026-09-01', time: '20:00', place: 'Test Hall', dedupeKey: 'test event|2026-09-01', sources: [{ label: 'test', url: 'https://example.com/1' }] });
  console.log('inserted', id);

  var found = await data.findByDedupeKey('test event|2026-09-01');
  console.log('found', found);

  await data.addSourceToEvent(id, { label: 'test2', url: 'https://example.com/2' });
  var all = await data.getAllEvents();
  console.log('all events with merged sources', JSON.stringify(all, null, 2));
})();
```

Run: `node scratch-verify-data.js`
Expected: prints an inserted doc id, the found doc matching what was inserted, then the event listed in `getAllEvents()` with two entries in `sources`.

Then delete `scratch-verify-data.js` and manually delete the test document from the `tbilisiEvents` Firestore collection in the Firebase console (or leave it — it'll be visually obvious as a test row once the admin page exists; either way, note it for later cleanup).

- [ ] **Step 3: Commit**

```bash
git add lib/tbilisi-events-data.js
git commit -m "feat: add Firestore data layer for Tbilisi events"
```

---

## Task 3: Dedup key logic

**Files:**
- Create: `lib/tbilisi-events-dedup.js`

- [ ] **Step 1: Write the module**

```js
'use strict';

function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

function computeDedupeKey(title, date) {
  return normalizeTitle(title) + '|' + (date || '');
}

module.exports = { normalizeTitle, computeDedupeKey };
```

- [ ] **Step 2: Verify manually**

Run:
```bash
node -e "var d = require('./lib/tbilisi-events-dedup'); console.log(d.computeDedupeKey('  Концерт X!! ', '2026-08-12')); console.log(d.computeDedupeKey('концерт x', '2026-08-12'));"
```
Expected: both lines print the identical string `концерт x|2026-08-12`.

- [ ] **Step 3: Commit**

```bash
git add lib/tbilisi-events-dedup.js
git commit -m "feat: add dedupe key normalization for Tbilisi events"
```

---

## Task 4: Claude-based event extractor

**Files:**
- Create: `lib/tbilisi-events-extractor.js`

- [ ] **Step 1: Write the module**

```js
'use strict';
var Anthropic = require('@anthropic-ai/sdk');

async function extractEvent(rawText, sourceLabel) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  var client = new Anthropic({ apiKey });

  var message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: 'You are extracting event announcements from social media posts and web pages about Tbilisi, Georgia.\n'
        + 'Source: ' + sourceLabel + '\n'
        + 'Text:\n' + rawText + '\n\n'
        + 'Is this an announcement of a specific public event happening in Tbilisi (concert, exhibition, festival, party, screening, etc)?\n'
        + 'If yes, respond with JSON only, no markdown: {"title":"...","date":"YYYY-MM-DD","time":"HH:MM or null","place":"... or null"}\n'
        + 'If no (it is not an event announcement, or there is not enough info to determine a specific date), respond with exactly: null',
    }],
  });

  var text = message.content[0].text.trim();
  if (text === 'null') return null;
  var match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  var json;
  try {
    json = JSON.parse(match[0]);
  } catch (e) {
    return null;
  }
  if (!json.title || !json.date) return null;
  return {
    title: String(json.title).trim(),
    date: String(json.date).trim(),
    time: (json.time && json.time !== 'null') ? String(json.time).trim() : null,
    place: (json.place && json.place !== 'null') ? String(json.place).trim() : null,
  };
}

module.exports = { extractEvent };
```

- [ ] **Step 2: Verify against the real API with a scratch script**

Create a temporary file `scratch-verify-extractor.js` in the project root (delete after, do not commit):

```js
require('dotenv').config();
var extractor = require('./lib/tbilisi-events-extractor');

(async function() {
  var eventText = '🎸 20 августа в 20:00 в Tbilisi Concert Hall выступит группа X. Билеты по ссылке.';
  var notEventText = 'Доброе утро, друзья! Как ваши дела сегодня?';

  console.log('event case:', await extractor.extractEvent(eventText, 'test channel'));
  console.log('non-event case:', await extractor.extractEvent(notEventText, 'test channel'));
})();
```

Run: `node scratch-verify-extractor.js`
Expected: first line logs an object with `title`, `date: '2026-08-20'`, `time: '20:00'`, `place` containing "Tbilisi Concert Hall"; second line logs `null`.

Delete `scratch-verify-extractor.js` afterward.

- [ ] **Step 3: Commit**

```bash
git add lib/tbilisi-events-extractor.js
git commit -m "feat: add Claude-based event extraction from raw text"
```

---

## Task 5: Source collectors

**Files:**
- Create: `lib/tbilisi-events-collectors.js`

- [ ] **Step 1: Write the module**

```js
'use strict';
var axios = require('axios');
var cheerio = require('cheerio');

async function collectTelegram(channel) {
  var url = 'https://t.me/s/' + channel;
  var res = await axios.get(url, { timeout: 15000 });
  var $ = cheerio.load(res.data);
  var items = [];
  $('.tgme_widget_message').each(function(i, el) {
    var text = $(el).find('.tgme_widget_message_text').text().trim();
    if (!text) return;
    var postPath = $(el).attr('data-post');
    var postUrl = postPath ? 'https://t.me/' + postPath : url;
    items.push({ text: text, url: postUrl });
  });
  return items;
}

async function collectWebsite(pageUrl) {
  var res = await axios.get(pageUrl, { timeout: 15000 });
  var $ = cheerio.load(res.data);
  $('script, style').remove();
  var text = $('body').text().replace(/\s+/g, ' ').trim();
  return [{ text: text, url: pageUrl }];
}

async function collectApifyDataset(actorId, input) {
  var token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN not set');
  var runUrl = 'https://api.apify.com/v2/acts/' + actorId + '/run-sync-get-dataset-items?token=' + token;
  var res = await axios.post(runUrl, input, { timeout: 120000 });
  return res.data;
}

async function collectFacebook(pageUrl) {
  var actorId = process.env.APIFY_FB_ACTOR_ID;
  if (!actorId) throw new Error('APIFY_FB_ACTOR_ID not set');
  var items = await collectApifyDataset(actorId, { startUrls: [{ url: pageUrl }] });
  return items.map(function(item) {
    return { text: item.text || item.caption || JSON.stringify(item), url: item.url || item.postUrl || pageUrl };
  });
}

async function collectInstagram(pageUrl) {
  var actorId = process.env.APIFY_IG_ACTOR_ID;
  if (!actorId) throw new Error('APIFY_IG_ACTOR_ID not set');
  var items = await collectApifyDataset(actorId, { directUrls: [pageUrl] });
  return items.map(function(item) {
    return { text: item.caption || item.text || JSON.stringify(item), url: item.url || pageUrl };
  });
}

module.exports = { collectTelegram, collectWebsite, collectFacebook, collectInstagram };
```

- [ ] **Step 2: Verify `collectTelegram` against a real public channel**

Run: `node -e "require('./lib/tbilisi-events-collectors').collectTelegram('durov').then(function(items){ console.log('count:', items.length); console.log(items[0]); })"`
Expected: `count:` followed by a positive number, and the first item is an object with non-empty `text` and a `url` starting with `https://t.me/`.

- [ ] **Step 3: Verify `collectWebsite` against a real page**

Run: `node -e "require('./lib/tbilisi-events-collectors').collectWebsite('https://example.com').then(function(items){ console.log(items[0].text.substring(0, 200)); })"`
Expected: prints text containing "Example Domain".

- [ ] **Step 4: Note on `collectFacebook`/`collectInstagram`**

These cannot be live-verified yet — no `APIFY_TOKEN` or actor IDs are configured. Confirm only that calling them without the env vars set fails clearly:

Run: `node -e "require('./lib/tbilisi-events-collectors').collectFacebook('https://facebook.com/example').catch(function(e){ console.log('expected error:', e.message); })"`
Expected: `expected error: APIFY_FB_ACTOR_ID not set`

Once the user has an Apify account, a chosen actor, and adds `APIFY_TOKEN`/`APIFY_FB_ACTOR_ID`/`APIFY_IG_ACTOR_ID` to `.env`, this task's live verification should be redone against a real Facebook/Instagram page before relying on this collector — the exact output field names (`text` vs `caption` vs something else) may need adjusting to match whichever actor is chosen.

- [ ] **Step 5: Commit**

```bash
git add lib/tbilisi-events-collectors.js
git commit -m "feat: add Telegram, website, and Apify-based source collectors"
```

---

## Task 6: Source list config

**Files:**
- Create: `lib/tbilisi-events-sources.js`

- [ ] **Step 1: Write the module**

```js
'use strict';

// Each entry: { type: 'telegram' | 'website' | 'facebook' | 'instagram', value: string, label: string }
// telegram: value = channel username without the leading @
// website / facebook / instagram: value = full page URL
module.exports = [];
```

- [ ] **Step 2: Verify it loads**

Run: `node -e "console.log(require('./lib/tbilisi-events-sources'))"`
Expected: `[]`

- [ ] **Step 3: Commit**

```bash
git add lib/tbilisi-events-sources.js
git commit -m "feat: add empty Tbilisi events source list config"
```

---

## Task 7: Pipeline orchestrator

**Files:**
- Create: `lib/tbilisi-events-pipeline.js`

- [ ] **Step 1: Write the module**

```js
'use strict';
var sources = require('./tbilisi-events-sources');
var collectors = require('./tbilisi-events-collectors');
var extractor = require('./tbilisi-events-extractor');
var dedup = require('./tbilisi-events-dedup');
var data = require('./tbilisi-events-data');

var COLLECTOR_BY_TYPE = {
  telegram: function(source) { return collectors.collectTelegram(source.value); },
  website: function(source) { return collectors.collectWebsite(source.value); },
  facebook: function(source) { return collectors.collectFacebook(source.value); },
  instagram: function(source) { return collectors.collectInstagram(source.value); },
};

async function run() {
  var summary = { sourcesProcessed: 0, sourceErrors: [], eventsFound: 0, eventsNew: 0, eventsMerged: 0 };

  for (var i = 0; i < sources.length; i++) {
    var source = sources[i];
    var collect = COLLECTOR_BY_TYPE[source.type];
    if (!collect) {
      summary.sourceErrors.push({ source: source.label, error: 'unknown source type: ' + source.type });
      continue;
    }

    var items;
    try {
      items = await collect(source);
    } catch (e) {
      summary.sourceErrors.push({ source: source.label, error: e.message });
      continue;
    }
    summary.sourcesProcessed++;

    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      var extracted;
      try {
        extracted = await extractor.extractEvent(item.text, source.label);
      } catch (e) {
        summary.sourceErrors.push({ source: source.label, error: 'extraction failed: ' + e.message });
        continue;
      }
      if (!extracted) continue;

      summary.eventsFound++;
      var dedupeKey = dedup.computeDedupeKey(extracted.title, extracted.date);
      var existing = await data.findByDedupeKey(dedupeKey);
      var sourceEntry = { label: source.label, url: item.url };

      if (existing) {
        await data.addSourceToEvent(existing.id, sourceEntry);
        summary.eventsMerged++;
      } else {
        await data.insertEvent(Object.assign({}, extracted, { dedupeKey: dedupeKey, sources: [sourceEntry] }));
        summary.eventsNew++;
      }
    }
  }

  return summary;
}

module.exports = { run };
```

- [ ] **Step 2: Verify with a scratch script and a temporary fake source**

Create a temporary file `scratch-verify-pipeline.js` in the project root (delete after, do not commit). This test temporarily monkey-patches the sources module and the website collector so it doesn't depend on real APIs or `ANTHROPIC_API_KEY` billing beyond one call, and doesn't depend on the source list being filled in yet:

```js
require('dotenv').config();
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var data = require('./lib/tbilisi-events-data');

var app = getApps().find(function(a) { return a.name === 'tbilisiEvents'; }) || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: (process.env.sssGCPKey || '').replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
    client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }),
}, 'tbilisiEvents');
data.init(getFirestore(app));

var sourcesModulePath = require.resolve('./lib/tbilisi-events-sources');
require.cache[sourcesModulePath].exports = [
  { type: 'website', value: 'https://example.com/fake-event-page', label: 'Fake Test Source' },
];

var collectors = require('./lib/tbilisi-events-collectors');
collectors.collectWebsite = async function() {
  return [{ text: '20 сентября в 19:00 в Fake Hall пройдёт тестовое событие Pipeline Smoke Test.', url: 'https://example.com/fake-event-page' }];
};

var pipeline = require('./lib/tbilisi-events-pipeline');

(async function() {
  var summary1 = await pipeline.run();
  console.log('first run:', summary1);
  var summary2 = await pipeline.run();
  console.log('second run (should merge, not duplicate):', summary2);
  var all = await data.getAllEvents();
  console.log('matching events in DB:', all.filter(function(e) { return e.title.indexOf('Pipeline Smoke Test') !== -1; }));
})();
```

Run: `node scratch-verify-pipeline.js`
Expected: `first run` shows `eventsNew: 1, eventsMerged: 0`; `second run` shows `eventsNew: 0, eventsMerged: 1`; the final log shows exactly one matching event with two entries in its `sources` array.

Delete `scratch-verify-pipeline.js` afterward, and manually delete the "Pipeline Smoke Test" document from Firestore.

- [ ] **Step 3: Commit**

```bash
git add lib/tbilisi-events-pipeline.js
git commit -m "feat: add pipeline orchestrator wiring collectors, extractor, and dedup"
```

---

## Task 8: Public route and table view

**Files:**
- Create: `routes/tbilisi-events.js`
- Create: `views/tbilisi-events/list.pug`

- [ ] **Step 1: Write the public route**

This route also owns the Firebase app initialization (matching `routes/eka.js`, which the admin route depends on being loaded first).

```js
'use strict';
var express = require('express');
var router = express.Router();
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var eventsData = require('../lib/tbilisi-events-data');

var tbilisiEventsApp = getApps().find(function(a) { return a.name === 'tbilisiEvents'; }) || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: (process.env.sssGCPKey || '').replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
    client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }),
}, 'tbilisiEvents');

var fb = getFirestore(tbilisiEventsApp);
eventsData.init(fb);

router.get('/', async function(req, res, next) {
  try {
    var events = await eventsData.getAllEvents();
    res.render('tbilisi-events/list', { title: 'Афиша Тбилиси', events: events });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
```

- [ ] **Step 2: Write the table view**

```pug
doctype html
html
  head
    title= title
    meta(charset='utf-8')
    meta(name='viewport' content='width=device-width,initial-scale=1')
    style.
      body { font-family: sans-serif; margin: 2rem; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
      th { background: #f5f5f5; }
  body
    h1= title
    if events.length === 0
      p Пока нет собранных событий.
    else
      table
        thead
          tr
            th Название
            th Дата/время
            th Место
            th Источник(и)
        tbody
          each event in events
            tr
              td= event.title
              td= event.date + (event.time ? ' ' + event.time : '')
              td= event.place || ''
              td
                each source, i in event.sources
                  if i > 0
                    | #{' '}
                  a(href=source.url target='_blank' rel='noopener noreferrer')= source.label
```

- [ ] **Step 3: Mount the route in `app.js`**

Find the block of standalone `app.use('/path', ...)` mounts (around the existing `app.use('/proxy', require('./routes/proxy'));` line) and add:

```js
app.use('/tbilisi-events', require('./routes/tbilisi-events'));
```

- [ ] **Step 4: Verify manually**

Run: `npm start`
Then open `http://localhost:3000/tbilisi-events` (adjust port/host to match how this app is normally run locally — check `bin/www` or existing run instructions if unsure).
Expected: page loads without error, shows "Пока нет собранных событий." (since the source list is still empty and no admin run has happened yet).

- [ ] **Step 5: Commit**

```bash
git add routes/tbilisi-events.js views/tbilisi-events/list.pug app.js
git commit -m "feat: add public Tbilisi events table page"
```

---

## Task 9: Admin route (auth + collect trigger)

**Files:**
- Create: `routes/tbilisi-events-admin.js`
- Create: `views/tbilisi-events/admin/login.pug`
- Create: `views/tbilisi-events/admin/index.pug`

- [ ] **Step 1: Write the admin route**

```js
'use strict';
var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var pipeline = require('../lib/tbilisi-events-pipeline');
var sources = require('../lib/tbilisi-events-sources');

function cookieToken(pass) {
  return crypto.createHash('sha256').update('tbilisiEvents:' + pass).digest('hex');
}

function requireAuth(req, res, next) {
  var val = req.cookies && req.cookies.tbilisiEventsAdminToken;
  var envPass = process.env.TBILISI_EVENTS_ADMIN_PASS;
  if (val && envPass && val === cookieToken(envPass)) return next();
  res.redirect('/tbilisi-events/admin/login');
}

router.get('/login', function(req, res) {
  res.render('tbilisi-events/admin/login', { title: 'Вход — Tbilisi Events Admin', error: null });
});

router.post('/login', express.urlencoded({ extended: false }), function(req, res) {
  var pass = (req.body.pass || '').trim();
  var envPass = process.env.TBILISI_EVENTS_ADMIN_PASS;
  if (!pass || !envPass || pass !== envPass) {
    return res.render('tbilisi-events/admin/login', { title: 'Вход — Tbilisi Events Admin', error: 'Неверный пароль' });
  }
  res.cookie('tbilisiEventsAdminToken', cookieToken(pass), { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.redirect('/tbilisi-events/admin/');
});

router.get('/logout', function(req, res) {
  res.clearCookie('tbilisiEventsAdminToken');
  res.redirect('/tbilisi-events/admin/login');
});

router.get('/', requireAuth, function(req, res) {
  res.render('tbilisi-events/admin/index', { title: 'Tbilisi Events Admin', sourceCount: sources.length, summary: null, error: null });
});

router.post('/collect', requireAuth, async function(req, res) {
  try {
    var summary = await pipeline.run();
    res.render('tbilisi-events/admin/index', { title: 'Tbilisi Events Admin', sourceCount: sources.length, summary: summary, error: null });
  } catch (e) {
    res.render('tbilisi-events/admin/index', { title: 'Tbilisi Events Admin', sourceCount: sources.length, summary: null, error: e.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Write the login view**

```pug
doctype html
html
  head
    title= title
    meta(charset='utf-8')
    meta(name='viewport' content='width=device-width,initial-scale=1')
    style.
      body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      form { border: 1px solid #ddd; padding: 2rem; border-radius: 8px; min-width: 280px; }
      .error { color: #c00; margin-bottom: 1rem; }
      input { display: block; width: 100%; padding: 0.5rem; margin-bottom: 1rem; box-sizing: border-box; }
      button { padding: 0.5rem 1rem; }
  body
    form(method='POST' action='/tbilisi-events/admin/login')
      h2 Tbilisi Events Admin
      if error
        .error= error
      input(type='password' name='pass' placeholder='Пароль' autofocus required)
      button(type='submit') Войти
```

- [ ] **Step 3: Write the dashboard view**

```pug
doctype html
html
  head
    title= title
    meta(charset='utf-8')
    meta(name='viewport' content='width=device-width,initial-scale=1')
    style.
      body { font-family: sans-serif; margin: 2rem; max-width: 700px; }
      button { padding: 0.75rem 1.5rem; font-size: 1rem; cursor: pointer; }
      .error { color: #c00; }
      .summary { margin-top: 1.5rem; border: 1px solid #ddd; padding: 1rem; border-radius: 6px; }
      .summary dt { font-weight: bold; }
      .error-item { color: #c00; }
  body
    h1= title
    p Источников настроено: #{sourceCount}
    form(method='POST' action='/tbilisi-events/admin/collect')
      button(type='submit') Собрать события
    if error
      p.error= error
    if summary
      .summary
        p Источников обработано: #{summary.sourcesProcessed}
        p Событий найдено: #{summary.eventsFound}
        p Новых: #{summary.eventsNew}
        p Объединено с существующими: #{summary.eventsMerged}
        if summary.sourceErrors.length
          h3 Ошибки
          ul
            each err in summary.sourceErrors
              li.error-item #{err.source}: #{err.error}
    p
      a(href='/tbilisi-events' target='_blank') Открыть таблицу событий
```

- [ ] **Step 4: Mount the route in `app.js`**

Add right after the `/tbilisi-events` mount from Task 8 (order matters — `routes/tbilisi-events.js` must load first so the `'tbilisiEvents'` Firebase app already exists when `routes/tbilisi-events-admin.js` is required):

```js
app.use('/tbilisi-events/admin', require('./routes/tbilisi-events-admin'));
```

- [ ] **Step 5: Verify manually**

1. Add `TBILISI_EVENTS_ADMIN_PASS=some-test-password` to `.env`.
2. Run: `npm start`
3. Open `http://localhost:3000/tbilisi-events/admin/` — expect a redirect to `/tbilisi-events/admin/login`.
4. Log in with the wrong password — expect "Неверный пароль".
5. Log in with `some-test-password` — expect redirect to the dashboard showing "Источников настроено: 0".
6. Click "Собрать события" — expect the summary block to show `sourcesProcessed: 0, eventsFound: 0, eventsNew: 0, eventsMerged: 0` and no errors (since the source list is still empty).
7. Visit `/tbilisi-events/admin/logout`, then reload `/tbilisi-events/admin/` — expect redirect back to login.

- [ ] **Step 6: Commit**

```bash
git add routes/tbilisi-events-admin.js views/tbilisi-events/admin/login.pug views/tbilisi-events/admin/index.pug app.js
git commit -m "feat: add Tbilisi events admin login and collect trigger"
```

---

## Task 10: End-to-end verification once real sources are available

This task is a checklist for after the user provides their real source list (Telegram channels, websites, FB/IG pages) — it can't be completed as part of this plan's initial implementation, but is the final acceptance check for the feature.

- [ ] **Step 1:** Fill in `lib/tbilisi-events-sources.js` with 2-3 real sources (start with `telegram`/`website` types, which don't need Apify).
- [ ] **Step 2:** Log into `/tbilisi-events/admin/`, click "Собрать события".
- [ ] **Step 3:** Confirm the summary shows sources processed and events found; check `/tbilisi-events` shows a plausible table.
- [ ] **Step 4:** Click "Собрать события" again without changing sources — confirm `eventsNew` is 0 and `eventsMerged` matches the previous run's `eventsFound` (or close to it, if some posts scrolled out of the Telegram preview window between runs), confirming dedup works across runs.
- [ ] **Step 5:** Once an Apify account and actor are chosen, add `APIFY_TOKEN`/`APIFY_FB_ACTOR_ID`/`APIFY_IG_ACTOR_ID` to `.env`, add a `facebook`/`instagram` source, and re-verify `collectFacebook`/`collectInstagram` against it — adjust the field-name guesses in `lib/tbilisi-events-collectors.js` (`item.text`/`item.caption`/`item.url`/`item.postUrl`) to match whatever that actor actually returns.
- [ ] **Step 6:** Commit the filled-in source list separately:

```bash
git add lib/tbilisi-events-sources.js
git commit -m "feat: add real Tbilisi event sources"
```

---

## Self-Review Notes

- Every spec section (architecture, data model, pipeline steps, admin page, public page, error handling, cross-run dedup, "past events stay forever") is covered by a task above.
- Simplified vs. the spec's literal `tbilisiEventsAdminTokens`/`tbilisiEventsAdmins` collections: those collections in `eka-admin.js` (`ekaAdminTokens`, `ekaAdmins`) turned out to be a dead-code collection declaration and a multi-admin-management feature respectively — neither is needed for a single shared-password button, so this plan uses only an env-var password, consistent with the already-working `EKA_ADMIN_PASS` fallback branch in `eka-admin.js`.
- Facebook/Instagram collector verification is explicitly deferred (Task 5 Step 4, Task 10) since no Apify token/actor exists yet — this matches the spec's "Out of Scope" note that those details are worked out once Apify access is available.
