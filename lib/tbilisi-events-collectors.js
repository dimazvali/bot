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
    var wrapStyle = $(el).find('.tgme_widget_message_photo_wrap').first().attr('style') || '';
    var m = wrapStyle.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/i);
    var imageCandidate = m ? m[1] : null;
    items.push({ text: text, url: postUrl, publishedAt: publishedAt, imageCandidate: imageCandidate });
  });
  return items;
}

async function collectWebsite(pageUrl) {
  var res = await axios.get(pageUrl, { timeout: 15000 });
  var $ = cheerio.load(res.data);
  $('script, style').remove();
  var text = $('body').text().replace(/\s+/g, ' ').trim();
  return [{ text: text, url: pageUrl, publishedAt: null, imageCandidate: null }];
}

function sleep(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }

var APIFY_TERMINAL_STATUSES = ['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'];
var APIFY_RUN_BUDGET_MS = 9 * 60 * 1000;
var APIFY_POLL_INTERVAL_MS = 5000;

// Facebook/Instagram scrapers routinely run past Apify's own run-sync-get-dataset-items
// cap (300s wall time, after which Apify's gateway itself returns 408 even though the
// run keeps going server-side) — so start the run async and poll for completion instead,
// which has no such ceiling.
async function collectApifyDataset(actorId, input) {
  var token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN not set');
  var normalizedActorId = actorId.replace('/', '~');
  var headers = { Authorization: 'Bearer ' + token };

  var startRes = await axios.post(
    'https://api.apify.com/v2/actors/' + normalizedActorId + '/runs?waitForFinish=60',
    input,
    { timeout: 70000, headers: headers }
  );
  var run = startRes.data.data;
  var deadline = Date.now() + APIFY_RUN_BUDGET_MS;

  while (APIFY_TERMINAL_STATUSES.indexOf(run.status) === -1) {
    if (Date.now() > deadline) {
      throw new Error('Apify run timed out after ' + Math.round(APIFY_RUN_BUDGET_MS / 1000) + 's (' + actorId + ')');
    }
    await sleep(APIFY_POLL_INTERVAL_MS);
    var statusRes = await axios.get('https://api.apify.com/v2/actor-runs/' + run.id, { timeout: 15000, headers: headers });
    run = statusRes.data.data;
  }

  if (run.status !== 'SUCCEEDED') {
    throw new Error('Apify run ' + run.status.toLowerCase() + ' (' + actorId + ')');
  }

  var itemsRes = await axios.get('https://api.apify.com/v2/datasets/' + run.defaultDatasetId + '/items', { timeout: 30000, headers: headers });
  return itemsRes.data;
}

async function collectFacebookStartUrls(actorId, pageUrl) {
  var items = await collectApifyDataset(actorId, { startUrls: [{ url: pageUrl }] });
  return items.map(function(item) {
    var media = item.media && item.media[0];
    var imageCandidate =
      (media && (media.thumbnail || (media.photo_image && media.photo_image.uri) || media.uri)) ||
      item.imageUrl || item.image || null;
    return {
      text: item.text || item.caption || JSON.stringify(item),
      url: item.url || item.postUrl || pageUrl,
      publishedAt: item.time || item.timestamp || null,
      imageCandidate: imageCandidate,
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
    var imageCandidate = item.displayUrl || (item.images && item.images[0]) || item.thumbnailUrl || null;
    return {
      text: item.caption || item.text || JSON.stringify(item),
      url: item.url || pageUrl,
      publishedAt: item.timestamp || item.time || null,
      imageCandidate: imageCandidate,
    };
  });
}

var TKT_GATEWAY = 'https://gateway.tkt.ge';

// tkt.ge covers all of Georgia (and occasionally abroad) with no city/region field on
// venues, so this is a best-effort keyword blocklist, not exhaustive geo-filtering.
// It's biased toward false negatives (letting an out-of-town venue slip through) over
// false positives (wrongly hiding a real Tbilisi venue with an unrecognized name).
var TKT_NON_TBILISI_KEYWORDS = [
  'batumi', 'ბათუმი', 'kutaisi', 'ქუთაისი', 'shekvetili', 'შეკვეთილი', 'kobuleti', 'ქობულეთი',
  'bakuriani', 'ბაკურიანი', 'gudauri', 'გუდაური', 'mestia', 'მესტია', 'telavi', 'თელავი',
  'sighnaghi', 'signagi', 'სიღნაღი', 'kazbegi', 'stepantsminda', 'ყაზბეგი', 'სტეფანწმინდა',
  'borjomi', 'ბორჯომი', 'ozurgeti', 'ოზურგეთი', 'poti', 'ფოთი', 'senaki', 'სენაკი',
  'rustavi', 'რუსთავი', 'gori', 'გორი', 'akhaltsikhe', 'ახალციხე', 'zugdidi', 'ზუგდიდი', 'ureki', 'ურეკი',
  'mtskheta', 'მცხეთა', 'saguramo', 'საგურამო', 'uplistsikhe', 'უფლისციხე', 'kakheti', 'კახეთი',
  'khodasheni', 'ხოდაშენი', 'madrid', 'lopota', 'kvareli', 'ყვარელი', 'tsinandali', 'წინანდალი',
  'baku city circuit', 'kuala lumpur', 'lisboa', 'abu dhabi', 'fiera di milano', 'düsseldorf',
  'dusseldorf', 'bologna', 'berlin', 'stade de france', 'camp nou', 'palau sant jordi',
];

function isTbilisiVenue(name) {
  var lower = (name || '').toLowerCase();
  return !TKT_NON_TBILISI_KEYWORDS.some(function(kw) { return lower.indexOf(kw) !== -1; });
}

async function collectTkt() {
  var res = await axios.get(TKT_GATEWAY + '/shows/list', { timeout: 20000 });
  var shows = (res.data && res.data.shows) || [];
  var events = [];

  shows.forEach(function(show) {
    var showUrl = 'https://tkt.ge/show/' + show.showId + '/' + show.slug;
    var showImage = (show.desktopImage || show.mobileImage)
      ? 'https://static.tkt.ge/img/' + (show.desktopImage || show.mobileImage)
      : null;

    if (show.venues && show.venues.length) {
      show.venues.forEach(function(venue) {
        if (!isTbilisiVenue(venue.name)) return;
        (venue.eventInfos || []).forEach(function(info) {
          if (!info.eventDate) return;
          events.push({
            title: show.name,
            date: info.eventDate.slice(0, 10),
            time: info.eventDate.slice(11, 16),
            place: venue.name,
            url: showUrl,
            imageCandidate: showImage,
          });
        });
      });
    } else if (show.fromDate) {
      var time = show.fromDate.slice(11, 16);
      events.push({
        title: show.name,
        date: show.fromDate.slice(0, 10),
        time: time === '00:00' ? null : time,
        place: null,
        url: showUrl,
        imageCandidate: showImage,
      });
    }
  });

  return events;
}

module.exports = { collectTelegram, collectWebsite, collectFacebook, collectFacebookGroup, collectInstagram, collectTkt };
