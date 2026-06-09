const { initializeApp, cert, getApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

let db, storage, col;

if (process.env.PELAMUSHI_PROJECT_ID) {
  let app;
  try {
    app = getApp('pelamushi');
  } catch {
    app = initializeApp({
      credential: cert({
        type: 'service_account',
        project_id: process.env.PELAMUSHI_PROJECT_ID,
        private_key_id: process.env.PELAMUSHI_KEY_ID,
        private_key: (process.env.PELAMUSHI_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        client_email: process.env.PELAMUSHI_CLIENT_EMAIL,
        client_id: process.env.PELAMUSHI_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.PELAMUSHI_CERT_URL,
      }),
      storageBucket: process.env.PELAMUSHI_BUCKET,
    }, 'pelamushi');
  }

  db = getFirestore(app);
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
    registrations: db.collection('pelamushi_registrations'),
  };
} else {
  console.warn('[pelamushi] Firebase env vars not set — running without Firebase');
  col = {};
}

module.exports = { db, storage, col, Timestamp };
