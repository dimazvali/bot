'use strict';
var axios = require('axios');
var cheerio = require('cheerio');

async function collectTelegram(channel) {
  var url = 'https://t.me/s/' + channel;
  var res = await axios.get(url, { timeout: 15000 });
  var $ = cheerio.load(res.data);
  var items = [];
  $('.tgme_widget_message').each(function(i, el) {
    var text = $(el).find('.tgme_widget_message_text').text().trim();
    if (!text) return;
    var postPath = $(el).attr('data-post');
    var postUrl = postPath ? 'https://t.me/' + postPath : url;
    items.push({ text: text, url: postUrl });
  });
  return items;
}

async function collectWebsite(pageUrl) {
  var res = await axios.get(pageUrl, { timeout: 15000 });
  var $ = cheerio.load(res.data);
  $('script, style').remove();
  var text = $('body').text().replace(/\s+/g, ' ').trim();
  return [{ text: text, url: pageUrl }];
}

async function collectApifyDataset(actorId, input) {
  var token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN not set');
  var normalizedActorId = actorId.replace('/', '~');
  var runUrl = 'https://api.apify.com/v2/actors/' + normalizedActorId + '/run-sync-get-dataset-items';
  var res = await axios.post(runUrl, input, { timeout: 310000, headers: { Authorization: 'Bearer ' + token } });
  return res.data;
}

async function collectFacebook(pageUrl) {
  var actorId = process.env.APIFY_FB_ACTOR_ID;
  if (!actorId) throw new Error('APIFY_FB_ACTOR_ID not set');
  var items = await collectApifyDataset(actorId, { startUrls: [{ url: pageUrl }] });
  return items.map(function(item) {
    return { text: item.text || item.caption || JSON.stringify(item), url: item.url || item.postUrl || pageUrl };
  });
}

async function collectInstagram(pageUrl) {
  var actorId = process.env.APIFY_IG_ACTOR_ID;
  if (!actorId) throw new Error('APIFY_IG_ACTOR_ID not set');
  var items = await collectApifyDataset(actorId, { directUrls: [pageUrl] });
  return items.map(function(item) {
    return { text: item.caption || item.text || JSON.stringify(item), url: item.url || pageUrl };
  });
}

module.exports = { collectTelegram, collectWebsite, collectFacebook, collectInstagram };
