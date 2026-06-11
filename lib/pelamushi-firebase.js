const { getApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

let db, storage, col;

try {
  const app = getApp('dimazvali');
  db      = getFirestore(app);
  storage = getStorage(app);
  col = {
    admins:        db.collection('pelamushi_admins'),
    about:         db.collection('pelamushi_about'),
    team:          db.collection('pelamushi_team'),
    gallery:       db.collection('pelamushi_gallery'),
    menus:         db.collection('pelamushi_menus'),
    categories:    db.collection('pelamushi_menu_categories'),
    items:         db.collection('pelamushi_menu_items'),
    news:          db.collection('pelamushi_news'),
    registrations:   db.collection('pelamushi_registrations'),
    rental:          db.collection('pelamushi_rental'),
    rental_gallery:  db.collection('pelamushi_rental_gallery'),
    rental_requests:     db.collection('pelamushi_rental_requests'),
    rental_request_logs: db.collection('pelamushi_rental_request_logs'),
    bar:             db.collection('pelamushi_bar'),
    bar_gallery:     db.collection('pelamushi_bar_gallery'),
    shop:            db.collection('pelamushi_shop'),
    shop_gallery:    db.collection('pelamushi_shop_gallery'),
    mentions:        db.collection('pelamushi_mentions'),
    translations:    db.collection('pelamushi_translations'),
  };
} catch {
  console.warn('[pelamushi] dimazvali Firebase app not ready — running without Firebase');
  col = {};
}

module.exports = { db, storage, col, Timestamp };
