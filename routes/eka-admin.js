'use strict';
var express = require('express');
var router = express.Router();

router.get('/login', function(req, res) {
  res.send('eka admin login');
});

router.get('/', function(req, res) {
  res.send('eka admin dashboard');
});

module.exports = router;
