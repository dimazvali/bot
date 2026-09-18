'use strict';
var express = require('express');
var router = express.Router();
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var { getStorage } = require('firebase-admin/storage');
var memoriesData = require('../lib/memories-data');
var memoriesPhotos = require('../lib/memories-photos');

var BUCKET = 'dimazvalimisc.appspot.com';

// Same project/credentials as photo-admin.js and tbilisi-events.js — this
// Firestore already hosts several services side by side via collection-name
// prefixes (see lib/memories-data.js). A distinct named app just keeps this
// service's Firestore/Storage handles separate in-process.
var memoriesApp = getApps().find(function(a) { return a.name === 'memories'; }) || initializeApp({
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
}, 'memories');

var fb = getFirestore(memoriesApp);
memoriesData.init(fb);
memoriesPhotos.init(getStorage(memoriesApp).bucket(BUCKET));

router.get('/', function(req, res) {
  res.send('memories: ok');
});

module.exports = router;
