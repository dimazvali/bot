/**
 * One-time seed script: writes photo.json and photo-tags.json to Firestore
 * for both 'dev' and 'prod' environments.
 *
 * Usage: node scripts/seed-photo-firestore.js
 */

require('dotenv').config();

var fs = require('fs');
var path = require('path');
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');

var photoApp = getApps().find(function (a) { return a.name === 'photo'; }) || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: process.env.sssGCPKey.replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
    client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }),
  storageBucket: process.env.PHOTO_BUCKET,
}, 'photo');

var db = getFirestore(photoApp);

var photoData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/photo.json'), 'utf8'));
var tagsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/photo-tags.json'), 'utf8'));

async function seed() {
  var envs = ['dev', 'prod'];

  for (var env of envs) {
    await db.collection('photo_data').doc(env).set(photoData);
    console.log('photo_data/' + env + ' ✓');

    await db.collection('photo_tags').doc(env).set(tagsData);
    console.log('photo_tags/' + env + ' ✓');
  }

  console.log('\nDone. Both dev and prod seeded.');
  process.exit(0);
}

seed().catch(function (err) {
  console.error('Seed failed:', err);
  process.exit(1);
});
