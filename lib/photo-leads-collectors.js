'use strict';
var axios = require('axios');
var cheerio = require('cheerio');
var teCollectors = require('./tbilisi-events-collectors');

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
var TG_MAX_PAGES = 10;

function httpGet(url) {
  return axios.get(url, { timeout: 20000, headers: { 'User-Agent': UA, 'Accept-Language': 'ka,en;q=0.9,ru;q=0.8' } });
}

function isOlder(publishedAt, since) {
  if (!publishedAt) return false;
  var t = Date.parse(publishedAt);
  return !isNaN(t) && t < since;
}

// Reddit blocks /new.json for servers (403) but serves the Atom feed.
function parseRedditRss(xml) {
  var $ = cheerio.load(xml, { xmlMode: true });
  var items = [];
  $('entry').each(function(i, el) {
    var e = $(el);
    var title = e.children('title').text().trim();
    var body = cheerio.load(e.children('content').text()).root().text()
      .replace(/\s+/g, ' ').replace(/\s*submitted by[\s\S]*$/, '').trim();
    items.push({
      url: e.children('link').attr('href') || null,
      text: body && body !== title ? title + '\n' + body : title,
      author: e.find('author > name').text().trim() || null,
      publishedAt: e.children('published').text().trim() || e.children('updated').text().trim() || null,
    });
  });
  return items;
}

// jobs.ge has two links per row (title + "open in new window"); keep one per id.
// Dates are Georgian month names — not parsed, dedup handles re-seen rows.
function parseJobsGe(html) {
  var $ = cheerio.load(html);
  var seen = {};
  var items = [];
  $('a[href*="view=jobs&id="]').each(function(i, a) {
    var $a = $(a);
    var title = $a.text().trim();
    var m = /id=(\d+)/.exec($a.attr('href') || '');
    if (!title || !m || seen[m[1]]) return;
    seen[m[1]] = true;
    var tr = $a.closest('tr');
    var city = tr.find('i').first().text().replace(/^\s*-\s*/, '').trim();
    var company = tr.find('a[href*="view=client"]').first().text().trim();
    items.push({
      url: 'https://jobs.ge/ge/?view=jobs&id=' + m[1],
      text: [title, company, city].filter(Boolean).join(' — '),
      author: company || null,
      publishedAt: null,
    });
  });
  return items;
}

// hr.ge is Angular SSR: search results sit in the ng-state transfer JSON.
function parseHrGe(html) {
  var m = /<script id="ng-state" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('hr.ge: ng-state not found');
  var state = JSON.parse(m[1]);
  var items = [];
  Object.keys(state).forEach(function(k) {
    var v = state[k];
    var list = v && v.b && v.b.data && v.b.data.announcements && v.b.data.announcements.items;
    if (!Array.isArray(list)) return;
    list.forEach(function(a) {
      var pd = a.publishDate || null;
      if (pd && !/(Z|[+-]\d\d:?\d\d)$/.test(pd)) pd += '+04:00'; // site TZ is GMT+4
      items.push({
        url: 'https://www.hr.ge/announcement/' + a.announcementId,
        text: [a.title, a.customerName, (a.locations || []).join(', ')].filter(Boolean).join(' — '),
        author: a.customerName || null,
        publishedAt: pd,
      });
    });
  });
  return items;
}

function postId(url) {
  var m = /^https:\/\/t\.me\/[A-Za-z0-9_]+\/(\d+)$/.exec(url || '');
  return m ? Number(m[1]) : null;
}

async function collectTelegram(source, since, deps) {
  var fetchPage = deps.fetchTelegramPage || teCollectors.collectTelegram;
  var out = [];
  var before = null;
  for (var page = 0; page < TG_MAX_PAGES; page++) {
    var items = await fetchPage(source.value, before ? { before: before } : undefined);
    if (!items.length) break;
    var reachedOld = false;
    var minId = null;
    items.forEach(function(it) {
      var id = postId(it.url);
      if (id !== null && (minId === null || id < minId)) minId = id;
      if (isOlder(it.publishedAt, since)) { reachedOld = true; return; }
      out.push({ url: it.url, text: it.text, author: '@' + source.value, publishedAt: it.publishedAt || null });
    });
    if (reachedOld || minId === null) break;
    before = minId;
  }
  return out;
}

async function collectReddit(source, since, deps) {
  var sleep = deps.sleep || function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
  var url = 'https://www.reddit.com/r/' + encodeURIComponent(source.value) + '/new/.rss';
  var waits = [10000, 30000];
  var res;
  for (var attempt = 0; ; attempt++) {
    try {
      res = await deps.get(url);
      break;
    } catch (e) {
      var status = e && e.response && e.response.status;
      if (status !== 429 || attempt >= waits.length) throw e;
      await sleep(waits[attempt]);
    }
  }
  return parseRedditRss(res.data).filter(function(it) { return !isOlder(it.publishedAt, since); });
}

async function collectJobsGe(source, since, deps) {
  var res = await deps.get('https://jobs.ge/?page=1&q=' + encodeURIComponent(source.value));
  return parseJobsGe(res.data);
}

async function collectHrGe(source, since, deps) {
  var res = await deps.get('https://www.hr.ge/search-posting?q=' + encodeURIComponent(source.value));
  return parseHrGe(res.data).filter(function(it) { return !isOlder(it.publishedAt, since); });
}

var COLLECTORS = { telegram: collectTelegram, reddit: collectReddit, jobsge: collectJobsGe, hrge: collectHrGe };

// deps (tests): { get(url) → {data}, fetchTelegramPage(channel, opts) → items }
async function collect(source, since, deps) {
  var fn = COLLECTORS[source.type];
  if (!fn) throw new Error('unknown source type: ' + source.type);
  var d = Object.assign({ get: httpGet }, deps || {});
  var items = await fn(source, since, d);
  return items
    .filter(function(it) { return it.url && it.text; })
    .map(function(it) {
      return {
        source: source.type, sourceId: source.id || null,
        url: it.url, text: it.text, author: it.author || null, publishedAt: it.publishedAt || null,
      };
    });
}

module.exports = {
  SOURCE_TYPES: Object.keys(COLLECTORS),
  collect: collect,
  parseRedditRss: parseRedditRss,
  parseJobsGe: parseJobsGe,
  parseHrGe: parseHrGe,
};
