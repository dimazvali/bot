'use strict';
var crypto = require('crypto');

function cookieToken(pass) {
  return crypto.createHash('sha256').update('qr:' + pass).digest('hex');
}

module.exports = { cookieToken: cookieToken };
