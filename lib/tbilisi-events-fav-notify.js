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
    // Set the dedup flag before fanning out, not after: two overlapping calls
    // for the same event can still both read it unset and both send (no
    // transaction here), and a mid-loop crash leaves some favoriters unnotified
    // with no retry. Accepted — this is a notification, not a payment or
    // safety path, and both real callers only fire once per event in practice.
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
