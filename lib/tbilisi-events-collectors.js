'use strict';
var axios = require('axios');
var cheerio = require('cheerio');

var FB_ACTOR_ID = 'apify/facebook-posts-scraper';
var FB_GROUP_ACTOR_ID = 'apify/facebook-groups-scraper';
var IG_ACTOR_ID = 'apify/instagram-scraper';

// Some sources (tkt.ge, biletebi.ge) sit behind Cloudflare, which can 403
// requests that don't look like a real browser. Send realistic headers to
// reduce the odds of being classified as a bot.
var BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9,ka;q=0.8,ru;q=0.7',
};

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

// Apify FB/IG scrapers are billed per scraped post ($0.005/event). Without a cap a
// single run over an active group pulls ~1000 posts and burns the whole monthly
// budget. Bound every run by count and recency — an events collector only cares
// about recent posts anyway. Both knobs are overridable via env.
var APIFY_RESULTS_LIMIT = Number(process.env.APIFY_RESULTS_LIMIT) || 25;
var APIFY_POSTS_NEWER_THAN = process.env.APIFY_POSTS_NEWER_THAN || '3 weeks';

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
  var items = await collectApifyDataset(actorId, {
    startUrls: [{ url: pageUrl }],
    resultsLimit: APIFY_RESULTS_LIMIT,
    onlyPostsNewerThan: APIFY_POSTS_NEWER_THAN,
  });
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
  var items = await collectApifyDataset(IG_ACTOR_ID, {
    directUrls: [pageUrl],
    resultsType: 'posts',
    resultsLimit: APIFY_RESULTS_LIMIT,
  });
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

// Shared by tkt.ge and biletebi.ge: both list events across all of Georgia with
// no clean city/region field (biletebi's venue names are often just a club/hall
// name with no city hint at all — e.g. " RIFF RAFF" — so the event title is
// checked too), so this stays a best-effort keyword blocklist, not exhaustive
// geo-filtering. Biased toward false negatives (an out-of-town venue slipping
// through) over false positives (wrongly hiding a real Tbilisi venue/title with
// an unrecognized name). Georgian city names are kept stem-only (vowel dropped)
// so declined forms match too — e.g. "ქუთაის" also matches "ქუთაისში" ("in
// Kutaisi"), which the old exact "ქუთაისი" form missed.
var GEORGIA_NON_TBILISI_KEYWORDS = [
  'batumi', 'ბათუმ', 'kutaisi', 'ქუთაის', 'shekvetili', 'შეკვეთილ', 'kobuleti', 'ქობულეთ',
  'bakuriani', 'ბაკურიან', 'gudauri', 'გუდაურ', 'mestia', 'მესტ', 'telavi', 'თელავ',
  'sighnaghi', 'signagi', 'სიღნაღ', 'kazbegi', 'stepantsminda', 'ყაზბეგ', 'სტეფანწმინდ',
  'borjomi', 'ბორჯომ', 'ozurgeti', 'ოზურგეთ', 'poti', 'ფოთ', 'senaki', 'სენაკ',
  'rustavi', 'რუსთავ', 'gori', 'გორ', 'akhaltsikhe', 'ახალციხ', 'zugdidi', 'ზუგდიდ', 'ureki', 'ურეკ',
  'mtskheta', 'მცხეთ', 'saguramo', 'საგურამო', 'uplistsikhe', 'უფლისციხ', 'kakheti', 'კახეთ',
  'khodasheni', 'ხოდაშენ', 'madrid', 'lopota', 'kvareli', 'ყვარელ', 'tsinandali', 'წინანდალ',
  'gurjaani', 'გურჯაან',
  'baku city circuit', 'kuala lumpur', 'lisboa', 'abu dhabi', 'fiera di milano', 'düsseldorf',
  'dusseldorf', 'bologna', 'berlin', 'stade de france', 'camp nou', 'palau sant jordi',
];

function isTbilisiVenue(name) {
  var lower = (name || '').toLowerCase();
  return !GEORGIA_NON_TBILISI_KEYWORDS.some(function(kw) { return lower.indexOf(kw) !== -1; });
}

var TKT_GATEWAY = 'https://gateway.tkt.ge';

async function collectTkt() {
  var res = await axios.get(TKT_GATEWAY + '/shows/list', { timeout: 20000, headers: BROWSER_HEADERS });
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

// biletebi.ge is a Next.js app; the event data itself comes from its own
// "listing-api" backend (found by reading the bundled RTK Query API slice —
// there's no public docs). Same shape family as tkt.ge: one JSON endpoint,
// paginated, filterable by category slug and start date. "Listings" covers a
// lot more than events (pools, museums, bus/train tickets, city tours), so
// this only asks for the categories that are actually one-off events, and
// double-checks mainCategorySlug client-side — categorySlugs filters by *any*
// of a listing's tags, so e.g. a tourism listing cross-tagged "education"
// would otherwise slip through.
var BILETEBI_API = 'https://listing-api.biletebi.ge';
var BILETEBI_CATEGORY_TYPE = { concerts: 'concert', theatres: 'theatre', sport: 'sport', education: 'lecture' };
var BILETEBI_MAX_PAGES = 20; // safety cap, matches ~350 events — plenty for "upcoming"
var BILETEBI_TZ_OFFSET_MS = 4 * 60 * 60 * 1000; // Georgia: fixed UTC+4, no DST

// The API returns UTC ISO timestamps; shift to Tbilisi local time before
// slicing out the date/time parts (a raw UTC slice would misdate anything
// within 4h of midnight and always show the wrong hour).
function biletebiLocalDateTime(isoUtc) {
  var d = isoUtc && new Date(isoUtc);
  if (!d || isNaN(d.getTime())) return { date: null, time: null };
  var iso = new Date(d.getTime() + BILETEBI_TZ_OFFSET_MS).toISOString();
  var time = iso.slice(11, 16);
  return { date: iso.slice(0, 10), time: time === '00:00' ? null : time };
}

async function collectBiletebi() {
  var categoryQs = Object.keys(BILETEBI_CATEGORY_TYPE)
    .map(function(c) { return 'categorySlugs=' + encodeURIComponent(c); }).join('&');
  var startDate = encodeURIComponent(new Date().toISOString());
  var events = [];
  var page = 1, pageCount = 1;

  do {
    var url = BILETEBI_API + '/Listings?1=1&' + categoryQs + '&StartDate=' + startDate + '&Paging.Page=' + page;
    var res = await axios.get(url, { timeout: 20000, headers: Object.assign({ 'Referer': 'https://biletebi.ge/' }, BROWSER_HEADERS) });
    var body = res.data || {};
    pageCount = Math.min(body.pageCount || 1, BILETEBI_MAX_PAGES);

    (body.items || []).forEach(function(item) {
      var type = BILETEBI_CATEGORY_TYPE[item.mainCategorySlug];
      if (!type) return;
      var place = item.locationTitle ? item.locationTitle.trim() : '';
      if (!isTbilisiVenue(place) || !isTbilisiVenue(item.title)) return;
      var dt = biletebiLocalDateTime(item.startsAt);
      if (!dt.date) return;
      events.push({
        title: item.title,
        date: dt.date,
        time: dt.time,
        place: place || null,
        url: 'https://biletebi.ge/ka/tickets/' + item.slug,
        imageCandidate: item.thumbnailImageUrl || null,
        type: type,
        price: item.minPrice != null ? item.minPrice : null,
      });
    });

    page++;
  } while (page <= pageCount);

  return events;
}

module.exports = { collectTelegram, collectWebsite, collectFacebook, collectFacebookGroup, collectInstagram, collectTkt, collectBiletebi };
