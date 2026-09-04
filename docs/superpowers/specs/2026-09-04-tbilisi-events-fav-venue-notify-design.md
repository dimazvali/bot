# Tbilisi Events — Telegram Notifications for Favorited Venues — Design Spec

## Goal

Phase 3 of the login/favorites roadmap (Phase 1 navbar login + Phase 2 favorites
already shipped, spec: `2026-09-04-tbilisi-events-login-favorites-design.md`).

Let a signed-in user opt in, on `/me`, to a notification ("Telegram, falling
back to email — this already happens automatically") whenever a new event is
added at a venue they favorited. Reuses the existing Telegram-linking flow and
`notifyUser`/`notifCopy`/`routeNotify` delivery machinery unchanged.

## Decisions (from brainstorming)

- **Trigger points — both:** a venue can gain a new public event two ways, and
  both should notify:
  1. the auto-collect pipeline (`lib/tbilisi-events-pipeline.js`) inserting a
     brand-new event and resolving its venue;
  2. an admin approving a user-submitted event (`routes/tbilisi-events-admin.js`,
     the existing `publishing` branch), which flips a previously-hidden event
     to public.
- **Dedup:** a `favVenueNotifiedAt` timestamp on the event doc, set (fire first,
  ask questions never) before the fan-out loop runs, so a retry or a second
  trigger for the same event never double-sends.
- **Delivery:** reuse `teNotify.notifyUser(uid, key, vars)` as-is — it already
  tries Telegram first and falls back to email, so opting in does **not**
  require Telegram to be linked.
- **Preference UI:** a plain auto-submitting checkbox form on `/me` (not the
  AJAX pattern used for the favorite button) — this is a settings toggle a
  user sets once, not a control clicked repeatedly, so it matches the rest of
  `/me`'s plain-form style (Unlink Telegram, Sign out).
- **Scope:** favorited **venues** only (not favorited events — an event doesn't
  get new events). No digest/frequency settings, no backfill notification for
  events that already existed when a venue was favorited.

Rejected: sweeping `run()`'s `summary.newEventIds` at the end of a parse run
(coarser — misses the submission-approval path entirely, and re-derives what
`persistEvent` already knows per-event); requiring Telegram to be linked before
the checkbox can be enabled (the email fallback already exists and works
without it — no reason to block on it).

## Data model — additions

### `tbilisiEvents` — one field

```js
{
  // ...existing fields
  favVenueNotifiedAt: Timestamp | null,  // set once the venue-favorite fan-out has run for this event
}
```

Not added to `EVENT_DEFAULTS` (it's write-once-late, like `researchedAt` on
venues) — absence means "not yet notified," which is exactly the check needed.

### `tbilisiEventsUsers` — one field

```js
{
  // ...existing fields
  notifyFavVenues: boolean,  // absent/false = opted out (the default for every existing and new user)
}
```

## New data-layer function — `lib/tbilisi-events-data.js`

```js
// Every userId that has favorited this (type, entityId). Filters `type` in JS
// (the fake — and a real composite-index-free query — support only one
// `where`), matching the getViewRecords precedent.
async function getFavoritingUsers(type, entityId) {
  var snap = await favoritesCollection().where('entityId', '==', entityId).get();
  return snap.docs.map(function(d) { return d.data(); })
    .filter(function(r) { return r.type === type; })
    .map(function(r) { return r.userId; });
}
```

Export it alongside the other favorites functions.

## New user-layer function — `lib/tbilisi-events-users.js`

Mirrors `setTgBlocked`:

```js
async function setNotifyFavVenues(uid, on) {
  await usersCol().doc(uid).update({ notifyFavVenues: !!on });
}
```

Export it.

## `notifCopy` — new key `favVenueEvent` (`lib/tbilisi-events-notify.js`)

Vars: `{ venueName, eventTitle, date, link }`. Added to the `COPY` object
alongside `published`/`rejected`/`updated`/`organizer_approved`/`organizer_rejected`,
same three-language shape:

```js
favVenueEvent: {
  en: function(v) { return { tg: 'New at ' + v.venueName + ': “' + v.eventTitle + '” on ' + v.date + '. ' + v.link, subject: 'New event at ' + v.venueName, bodyHtml: '<p>New at <b>' + esc(v.venueName) + '</b>: “' + esc(v.eventTitle) + '” on ' + esc(v.date) + '.</p><p><a href="' + esc(v.link) + '">Open it</a></p>' }; },
  ru: function(v) { return { tg: 'Новое в «' + v.venueName + '»: «' + v.eventTitle + '» ' + v.date + '. ' + v.link, subject: 'Новое событие в «' + v.venueName + '»', bodyHtml: '<p>Новое в «' + esc(v.venueName) + '»: «' + esc(v.eventTitle) + '» ' + esc(v.date) + '.</p><p><a href="' + esc(v.link) + '">Открыть</a></p>' }; },
  ka: function(v) { return { tg: 'ახალი ' + v.venueName + '-ში: “' + v.eventTitle + '” — ' + v.date + '. ' + v.link, subject: 'ახალი ღონისძიება — ' + v.venueName, bodyHtml: '<p>“' + esc(v.eventTitle) + '” — ' + esc(v.venueName) + ', ' + esc(v.date) + '.</p><p><a href="' + esc(v.link) + '">' + esc(v.link) + '</a></p>' }; },
},
```

The existing "every key renders for every lang" test (`test/tbilisi-events-notify.test.js`)
iterates a hardcoded key list — add `'favVenueEvent'` there, with `venueName`/
`eventTitle`/`date` added to its shared `vars` fixture.

## New module — `lib/tbilisi-events-fav-notify.js`

```js
'use strict';
var data = require('./tbilisi-events-data');
var teUsers = require('./tbilisi-events-users');
var teNotify = require('./tbilisi-events-notify');

var PUBLIC_ORIGIN = process.env.TBILISI_EVENTS_BASE_URL || 'https://events.tbiliseli.com';

// Fire-and-forget: ping everyone who favorited this event's venue and opted
// in. Idempotent — no-ops if the event has no venue or was already notified.
async function notifyFavoritedVenue(eventId) {
  try {
    var event = await data.getEventById(eventId);
    if (!event || !event.venueId || event.favVenueNotifiedAt) return;
    var venue = await data.getVenueById(event.venueId);
    if (!venue) return;
    await data.updateEvent(event.id, { favVenueNotifiedAt: new Date() });
    var userIds = await data.getFavoritingUsers('venue', event.venueId);
    var link = PUBLIC_ORIGIN + '/e/' + (event.slug || event.id);
    for (var i = 0; i < userIds.length; i++) {
      try {
        var user = await teUsers.getUserById(userIds[i]);
        if (!user || !user.notifyFavVenues) continue;
        teNotify.notifyUser(user.id, 'favVenueEvent', {
          venueName: venue.name, eventTitle: event.title, date: event.date, link: link,
        });
      } catch (e) { console.error('[te fav-notify] user ' + userIds[i] + ': ' + e.message); }
    }
  } catch (e) {
    console.error('[te fav-notify] event ' + eventId + ': ' + e.message);
  }
}

module.exports = { notifyFavoritedVenue: notifyFavoritedVenue };
```

`data.updateEvent(event.id, { favVenueNotifiedAt: new Date() })` runs **before**
the fan-out loop (per the Decisions section) — a concurrent second call for the
same event id will already see `favVenueNotifiedAt` set and return early, at
the cost of a user missing a notification if the process crashes mid-loop
(acceptable; not a payment or safety path).

## Hook 1 — auto-collect pipeline (`lib/tbilisi-events-pipeline.js`)

In `persistEvent`, right after the venue is resolved for a brand-new event:

```js
try {
  var venueId = await withTimeout(venues.resolveVenue(extracted.place), 40000, 'venue resolve');
  if (venueId) await data.updateEvent(id, { venueId: venueId });
} catch (e) {
  summary.sourceErrors.push({ source: sourceLabel, error: 'venue resolve failed: ' + e.message });
}
```

add, right after the `if (venueId) await data.updateEvent(id, { venueId: venueId });` line:

```js
if (venueId) favNotify.notifyFavoritedVenue(id); // fire-and-forget
```

(`favNotify` required at the top of the file, alongside the existing `venues`/`enricher`/`images` requires.)

## Hook 2 — submission approval (`routes/tbilisi-events-admin.js`)

In the events-edit POST handler, the existing `publishing` branch:

```js
var publishing = !!(prev && prev.submission && prev.submission.userId && !prev.active && patch.active && prev.submission.status !== 'approved');
if (publishing) {
  patch.submission = Object.assign({}, prev.submission, { status: 'approved' });
  patch.hidden = false; // a submission is created hidden:true — reveal it on publish
}
await data.updateEvent(req.params.id, patch);
```

right after that `updateEvent` call, add:

```js
if (publishing) favNotify.notifyFavoritedVenue(req.params.id);
```

`notifyFavoritedVenue` re-fetches the event, so it sees the just-applied
`venueId`/`title` (whether or not the admin edited them in the same submit) and
no-ops cleanly if there is no venue. (`favNotify` required at the top of the
file, alongside `teNotify`.)

## `/me` — preference checkbox

### Route (`routes/tbilisi-events-account.js`)

- `GET /me`: pass `notifyFavVenues: !!user.notifyFavVenues` to the render (the
  `user` doc is already loaded).
- New route, near `POST /me/telegram/unlink`:

```js
router.post('/me/notify-fav-venues', users.requireUser, guardCsrf, express.urlencoded({ extended: false }), async function(req, res, next) {
  try {
    await users.setNotifyFavVenues(res.locals.user.uid, req.body.on === 'on');
    res.redirect(req.teBase + '/me');
  } catch (e) { next(e); }
});
```

### View (`views/tbilisi-events/me.pug`)

A new `.row` after the Telegram row, before the favorites `h2.sec`:

```pug
.row
  .k Notifications
  label(style='display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer')
    form(method='POST' action=base + '/me/notify-fav-venues' style='display:contents')
      input(type='checkbox' name='on' value='on' checked=notifyFavVenues onchange='this.form.submit()')
      | Notify me about new events at my favorite venues
  if notifyFavVenues && !tgLinked
    p(style='margin-top:8px;color:var(--muted);font-size:12px') You'll get these by email until you link Telegram below.
```

(`style='display:contents'` keeps the `<form>` from breaking the flex layout of
its `label` parent — the only layout-only inline style added; every other rule
in `me.pug` already lives in the page's `<style>` block, so this one line is a
deliberate, narrow exception rather than a new pattern.)

## Testing

### `test/tbilisi-events-notify.test.js`

- Add `'favVenueEvent'` to the "every key renders for every lang" key list, and
  `venueName`/`eventTitle`/`date` to its shared `vars`.
- One direct test: `notifCopy('favVenueEvent', 'ru', {...})` contains the venue
  name and event title in both `tg` and `email.html`.

### `test/tbilisi-events-users.test.js`

- `setNotifyFavVenues` flips the flag, mirroring the existing `setTgBlocked` test.

### `test/tbilisi-events-data.test.js`

- `getFavoritingUsers('venue', id)` returns the userIds that favorited that
  venue, not events, and not other venues; empty for a venue nobody favorited.

### `test/tbilisi-events-fav-notify.test.js` (new)

Inject fakes for `data`, `teUsers`, `teNotify` the same way
`tbilisi-events-notify.test.js` injects `deps` into `routeNotify` — since
`notifyFavoritedVenue` calls the real modules directly, tests monkey-patch their
exported functions before the call and restore them in a `finally`, matching
`test/tbilisi-events-views.test.js`'s `recordView` test:

- no `venueId` on the event → no-op, no calls.
- `favVenueNotifiedAt` already set → no-op.
- normal case: marks `favVenueNotifiedAt`, calls `notifyUser` once per opted-in
  favoriting user, skips a favoriting user with `notifyFavVenues` falsy.
- a `notifyUser`-adjacent user lookup throwing for one user does not stop the
  loop for the others.

### Manual smoke

On the running app: favorite a venue as a signed-in user, enable the
notification checkbox, then either (a) trigger a tiny parser run against a
source that yields an event at that venue, or (b) create+approve a submission
at that venue — confirm one Telegram/email send and `favVenueNotifiedAt` set on
the event; confirm a second save/approval does not resend.

## Out of scope

- Digest/frequency controls, unsubscribe-per-venue, backfill notifications.
- Notifying about favorited **events** (only venues, per this spec).
- A dedicated `/me` page section styling upgrade beyond the one checkbox row.
