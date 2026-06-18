'use strict';
var cron = require('node-cron');
var ekaData = require('./eka-data');
var ekaBot = require('./eka-bot');

var _db = null;
var _sentReminderIds = new Set();
var _sentReviewIds = new Set();

function init(db) {
  _db = db;
  // pre-seed from Firestore to survive restarts
  db.collection('eka_tours').where('reminderSent', '==', true).get().then(function(snap) {
    snap.docs.forEach(function(d) { _sentReminderIds.add(d.id); });
  }).catch(function(){});
  db.collection('eka_tours').where('reviewSent', '==', true).get().then(function(snap) {
    snap.docs.forEach(function(d) { _sentReviewIds.add(d.id); });
  }).catch(function(){});

  // pre-tour reminder: every 30 minutes
  cron.schedule('*/30 * * * *', function() {
    checkUpcomingTours().catch(function(e) {
      console.error('[eka-reminders] reminder:', e.message);
    });
  });

  // post-tour review request: every day at 20:00
  cron.schedule('0 20 * * *', function() {
    checkPostTourReviews().catch(function(e) {
      console.error('[eka-reminders] review:', e.message);
    });
  });

  console.log('[eka-reminders] started');
}

async function checkUpcomingTours() {
  var now = new Date();
  var windowStart = new Date(now.getTime() + 105 * 60 * 1000); // now + 1h45m
  var windowEnd   = new Date(now.getTime() + 135 * 60 * 1000); // now + 2h15m

  var tours = await ekaData.getTours({ publishedOnly: true });
  var due = tours.filter(function(t) {
    if (t.reminderSent || _sentReminderIds.has(t.id)) return false;
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

async function checkPostTourReviews() {
  var now = new Date();
  // tours that started at least 2 hours ago (so they're likely done by 20:00)
  var cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  var tours = await ekaData.getTours({ publishedOnly: true });
  var due = tours.filter(function(t) {
    if (t.reviewSent || _sentReviewIds.has(t.id)) return false;
    if (!t.date) return false;
    var d = t.date.toDate ? t.date.toDate() : new Date(t.date);
    // tour happened today and started at least 2h ago
    var isToday = d.toDateString() === now.toDateString();
    return isToday && d <= cutoff;
  });

  for (var i = 0; i < due.length; i++) {
    await sendReviewRequest(due[i]).catch(function(e) {
      console.error('[eka-reminders] review tour', due[i].id, e.message);
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

  _sentReminderIds.add(tour.id);
  await _db.collection('eka_tours').doc(tour.id).update({ reminderSent: true });
  console.log('[eka-reminders] reminder sent for tour', tour.id, '→', targets.length, 'guests');
}

async function sendReviewRequest(tour) {
  var requests = await ekaData.getRequests({ tourId: tour.id });
  var seen = {};
  var targets = requests.filter(function(r) {
    if (!r.tg_user_id || r.status === 'declined' || r.status === 'cancelled') return false;
    if (seen[r.tg_user_id]) return false;
    seen[r.tg_user_id] = true;
    return true;
  });

  var nameRu = tour.titleRu || tour.titleEn || 'тур';
  var reviewUrl = process.env.EKA_REVIEW_URL || '';

  var text = '🙏 Надеемся, тур <b>' + nameRu + '</b> вам понравился!\n\nЕсли хотите поделиться впечатлениями — мы будем очень рады отзыву.';
  if (reviewUrl) text += ' Это займёт буквально минуту:\n' + reviewUrl;

  for (var i = 0; i < targets.length; i++) {
    var uid = targets[i].tg_user_id;
    try {
      await ekaBot.sendMessage(uid, text);
    } catch(e) {
      console.error('[eka-reminders] review send to', uid, e.message);
    }
    if (i < targets.length - 1) await new Promise(function(r) { setTimeout(r, 50); });
  }

  _sentReviewIds.add(tour.id);
  await _db.collection('eka_tours').doc(tour.id).update({ reviewSent: true });
  console.log('[eka-reminders] review request sent for tour', tour.id, '→', targets.length, 'guests');
}

module.exports = { init };
