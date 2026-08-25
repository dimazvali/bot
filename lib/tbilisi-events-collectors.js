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
      });
    }
  });

  return events;
}

module.exports = { collectTelegram, collectWebsite, collectFacebook, collectFacebookGroup, collectInstagram, collectTkt };
