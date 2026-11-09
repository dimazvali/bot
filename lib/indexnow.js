// IndexNow (Bing, Yandex, Seznam, Naver…) for photo.dimazvali.com — https://www.bing.com/indexnow/getstarted
// The key file lives at public/<KEY>.txt (its content is the key itself) and is served by express.static;
// routes/photo.js also answers /<KEY>.txt in case the key is overridden via env INDEX_NOW_KEY.
var axios = require('axios');

var KEY = process.env.INDEX_NOW_KEY || 'e3b71bc392c742bb9c4d9b9981874cf7';
var HOST = 'photo.dimazvali.com';
var BASE = 'https://' + HOST;
var MAX_BATCH = 10000; // protocol limit per request

// '/shoot/x' or 'https://photo.dimazvali.com/shoot/x' → both the RU and the /en/ URL (the site is bilingual)
function withEn(urls) {
  var out = [];
  (Array.isArray(urls) ? urls : [urls]).forEach(function(u) {
    var path = String(u).replace(BASE, '') || '/';
    out.push(BASE + path);
    if (!/^\/en(\/|$)/.test(path)) out.push(BASE + '/en' + path);
  });
  return Array.from(new Set(out));
}

// Fire-and-forget by default; returns the promise (resolves to the HTTP status, never rejects).
function submit(urls, opts) {
  var list = (opts && opts.raw) ? urls : withEn(urls);
  var batches = [];
  for (var i = 0; i < list.length; i += MAX_BATCH) batches.push(list.slice(i, i + MAX_BATCH));
  return Promise.all(batches.map(function(batch) {
    return axios.post('https://api.indexnow.org/indexnow', {
      host: HOST,
      key: KEY,
      keyLocation: BASE + '/' + KEY + '.txt',
      urlList: batch,
    }, { timeout: 15000, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
      .then(function(r) { return r.status; })
      .catch(function(e) {
        var status = e.response ? e.response.status : 0;
        console.error('[indexnow]', status || '', e.message);
        return status;
      });
  }));
}

module.exports = { KEY: KEY, HOST: HOST, submit: submit, withEn: withEn };
