'use strict';
var { getApp } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { getStorage } = require('firebase-admin/storage');

var db = null;
var bucket = null;

try {
  var app = getApp('dimazvali');
  db = getFirestore(app);
  bucket = getStorage(app).bucket('dimazvalimisc.appspot.com');
} catch (e) {
  console.warn('[qr] dimazvali Firebase app not ready — running without Firebase');
}

// Same shared Firebase project/bucket as prod — separated by naming (a
// different Firestore collection, a different Storage path prefix), not a
// different project, matching the `process.env.develop` convention used
// throughout the rest of this repo. Keeps local/ngrok testing from ever
// touching real qr.dimazvali.com content.
var isDev = process.env.develop == 'true';

module.exports = { db: db, bucket: bucket, isDev: isDev };
