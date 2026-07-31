'use strict';
var axios = require('axios');
var cheerio = require('cheerio');

var FB_ACTOR_ID = 'apify/facebook-posts-scraper';
var FB_GROUP_ACTOR_ID = 'apify/facebook-groups-scraper';
var IG_ACTOR_ID = 'apify/instagram-scraper';

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
    var publishedAt = $(el).find('time').attr('datetime') || null;
    items.push({ text: text, url: postUrl, publishedAt: publishedAt });
  });
  return items;
}

async function collectWebsite(pageUrl) {
  var res = await axios.get(pageUrl, { timeout: 15000 });
  var $ = cheerio.load(res.data);
  $('script, style').remove();
  var text = $('body').text().replace(/\s+/g, ' ').trim();
  return [{ text: text, url: pageUrl, publishedAt: null }];
}

async function collectApifyDataset(actorId, input) {
  var token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN not set');
  var normalizedActorId = actorId.replace('/', '~');
  var runUrl = 'https://api.apify.com/v2/actors/' + normalizedActorId + '/run-sync-get-dataset-items';
  var res = await axios.post(runUrl, input, { timeout: 310000, headers: { Authorization: 'Bearer ' + token } });
  return res.data;
}

async function collectFacebookStartUrls(actorId, pageUrl) {
  var items = await collectApifyDataset(actorId, { startUrls: [{ url: pageUrl }] });
  return items.map(function(item) {
    return {
      text: item.text || item.caption || JSON.stringify(item),
      url: item.url || item.postUrl || pageUrl,
      publishedAt: item.time || item.timestamp || null,
    };
  });
}

async function collectFacebook(pageUrl) {
  return collectFacebookStartUrls(FB_ACTOR_ID, pageUrl);
}

async function collectFacebookGroup(groupUrl) {
  return collectFacebookStartUrls(FB_GROUP_ACTOR_ID, groupUrl);
}

async function collectInstagram(pageUrl) {
  var items = await collectApifyDataset(IG_ACTOR_ID, { directUrls: [pageUrl], resultsType: 'posts' });
  return items.map(function(item) {
    return {
      text: item.caption || item.text || JSON.stringify(item),
      url: item.url || pageUrl,
      publishedAt: item.timestamp || item.time || null,
    };
  });
}

module.exports = { collectTelegram, collectWebsite, collectFacebook, collectFacebookGroup, collectInstagram };
