// One-off: submit every URL from photo.dimazvali.com/sitemap.xml to IndexNow.
// Usage: node scripts/indexnow-submit-sitemap.js [--dry]
require('dotenv').config();
var axios = require('axios');
var indexnow = require('../lib/indexnow');

(async function() {
  var xml = (await axios.get('https://' + indexnow.HOST + '/sitemap.xml', { timeout: 30000 })).data;
  var urls = Array.from(new Set((xml.match(/<loc>[^<]+<\/loc>/g) || [])
    .map(function(s) { return s.slice(5, -6); })
    .filter(function(u) { return u.indexOf('https://' + indexnow.HOST + '/') === 0; }))); // skip image:loc (bucket)
  console.log('urls:', urls.length);
  if (process.argv.includes('--dry')) { console.log(urls.slice(0, 10).join('\n')); return; }
  var statuses = await indexnow.submit(urls, { raw: true });
  console.log('statuses:', statuses.join(', '), '(200/202 = ok, 403 = key file not verified)');
})().catch(function(e) { console.error(e); process.exit(1); });
