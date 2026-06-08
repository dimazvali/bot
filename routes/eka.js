'use strict';
var express = require('express');
var router = express.Router();

router.use('/admin', require('./eka-admin'));

router.get('/', function(req, res) {
  res.redirect('/ru/');
});

router.get('/:lang(ru|en)/', function(req, res) {
  res.send('eka home — ' + req.params.lang);
});

module.exports = router;
