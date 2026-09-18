'use strict';
var express = require('express');
var router = express.Router();
var { getApps } = require('firebase-admin/app');

// The 'memories' Firebase app is initialized by routes/memories.js, which
// app.js requires first (see the wiring comment there) — mirrors how
// routes/eka-admin.js depends on routes/eka.js loading first.
var memoriesApp = getApps().find(function(a) { return a.name === 'memories'; });
if (!memoriesApp) throw new Error('memories-admin: Firebase "memories" app not initialized — load routes/memories.js first');

router.get('/', function(req, res) {
  res.send('memories-admin: ok');
});

module.exports = router;
