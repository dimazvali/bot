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

module.exports = { db: db, bucket: bucket };
