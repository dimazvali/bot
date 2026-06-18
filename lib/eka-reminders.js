'use strict';
var cron = require('node-cron');
var ekaData = require('./eka-data');
var ekaBot = require('./eka-bot');

var _db = null;
var _sentTourIds = new Set();

function init(db) {
  _db = db;
  // pre-seed sent set from Firestore so we survive restarts cleanly
  db.collection('eka_tours').where('reminderSent', '==', true).get().then(function(snap) {
    snap.docs.forEach(function(d) { _sentTourIds.add(d.id); });
  }).catch(function(){});
  // run every 5 minutes
  cron.schedule('*/5 * * * *', function() {
    checkUpcomingTours().catch(function(e) {
      console.error('[eka-reminders]', e.message);
    });
  });
  console.log('[eka-reminders] started');
}

async function checkUpcomingTours() {
  var now = new Date();
  var windowStart = new Date(now.getTime() + 115 * 60 * 1000); // now + 1h55m
  var windowEnd   = new Date(now.getTime() + 125 * 60 * 1000); // now + 2h05m

  var tours = await ekaData.getTours({ publishedOnly: true });
  var due = tours.filter(function(t) {
    if (t.reminderSent || _sentTourIds.has(t.id)) return false;
    if (!t.date) return false;
    var d = t.date.toDate ? t.date.toDate() : new Date(t.date);
    return d >= windowStart && d <= windowEnd;
  });

  for (var i = 0; i < due.length; i++) {
    await sendReminder(due[i]).catch(function(e) {
      console.error('[eka-reminders] tour', due[i].id, e.message);
    });
  }
}

async function sendReminder(tour) {
  var requests = await ekaData.getRequests({ tourId: tour.id });
  var seen = {};
  var targets = requests.filter(function(r) {
    if (!r.tg_user_id || r.status === 'declined' || r.status === 'cancelled') return false;
    if (seen[r.tg_user_id]) return false;
    seen[r.tg_user_id] = true;
    return true;
  });

  if (!targets.length) {
    await _db.collection('eka_tours').doc(tour.id).update({ reminderSent: true });
    return;
  }

  var nameRu = tour.titleRu || tour.titleEn || 'тур';
  var meetRu = tour.meetingPointRu || tour.meetingPointEn || '';
  var hasCoords = tour.meetingPointLat && tour.meetingPointLng;

  var text = '⏰ Напоминаем: через 2 часа вас ждёт тур <b>' + nameRu + '</b>!';
  if (meetRu) text += '\n\n📍 Место сбора: ' + meetRu;

  for (var i = 0; i < targets.length; i++) {
    var uid = targets[i].tg_user_id;
    try {
      await ekaBot.sendMessage(uid, text);
      if (hasCoords) {
        await ekaBot.sendLocation(uid, tour.meetingPointLat, tour.meetingPointLng);
      }
    } catch(e) {
      console.error('[eka-reminders] send to', uid, e.message);
    }
    if (i < targets.length - 1) await new Promise(function(r) { setTimeout(r, 50); });
  }

  _sentTourIds.add(tour.id);
  await _db.collection('eka_tours').doc(tour.id).update({ reminderSent: true });
  console.log('[eka-reminders] sent reminder for tour', tour.id, '→', targets.length, 'guests');
}

module.exports = { init };
