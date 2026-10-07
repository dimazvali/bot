'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var c = require('../lib/photo-leads-collectors.js');

var REDDIT_RSS = '<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom">'
  + '<entry><author><name>/u/anna</name></author>'
  + '<content type="html">&lt;div class=&quot;md&quot;&gt;&lt;p&gt;Paid portrait shoot, Vake&lt;/p&gt;&lt;/div&gt; &amp;#32; submitted by &amp;#32; &lt;a href=&quot;x&quot;&gt;/u/anna&lt;/a&gt; [link] [comments]</content>'
  + '<link href="https://www.reddit.com/r/tbilisi/comments/abc/need_photographer/" />'
  + '<published>2026-10-06T10:00:00+00:00</published><title>Need a photographer</title></entry>'
  + '<entry><author><name>/u/bob</name></author><content type="html">old</content>'
  + '<link href="https://www.reddit.com/r/tbilisi/comments/old/x/" />'
  + '<published>2026-09-01T10:00:00+00:00</published><title>Old post</title></entry>'
  + '</feed>';

var JOBS_HTML = '<table><tr><td></td><td>'
  + '<a href="/ge/?view=jobs&id=756903" class="vip">ფოტოგრაფი ერთჯერადი მომსახურებისთვის</a>'
  + '<i> - ზუგდიდი</i>'
  + '<a href="/ge/?view=jobs&id=756903" target="_blank"><img src="/i/newwindow.gif"></a></td>'
  + '<td></td><td><a href="/ge/?view=client&client=hotel-iberia-palace">სასტუმრო Iberia Palace</a></td>'
  + '<td>29 სექტემბერი</td><td>29 ოქტომბერი</td></tr></table>';

var HR_HTML = '<html><script id="ng-state" type="application/json">'
  + JSON.stringify({
    '111': { b: { data: { announcements: { items: [{
      announcementId: 494502, title: 'ფოტოგრაფი', customerName: 'Promoride',
      locations: ['ყვარელი'], publishDate: '2026-09-21T14:49:38.347',
    }] } } } },
    'cache:1': { success: true, data: { localities: [] } },
  })
  + '</script></html>';

test('parseRedditRss extracts title + body without the "submitted by" tail', function() {
  var items = c.parseRedditRss(REDDIT_RSS);
  assert.equal(items.length, 2);
  assert.equal(items[0].url, 'https://www.reddit.com/r/tbilisi/comments/abc/need_photographer/');
  assert.equal(items[0].text, 'Need a photographer\nPaid portrait shoot, Vake');
  assert.equal(items[0].author, '/u/anna');
  assert.equal(items[0].publishedAt, '2026-10-06T10:00:00+00:00');
});

test('parseJobsGe dedups the two links per row and joins title, company, city', function() {
  var items = c.parseJobsGe(JOBS_HTML);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://jobs.ge/ge/?view=jobs&id=756903');
  assert.equal(items[0].text, 'ფოტოგრაფი ერთჯერადი მომსახურებისთვის — სასტუმრო Iberia Palace — ზუგდიდი');
  assert.equal(items[0].author, 'სასტუმრო Iberia Palace');
  assert.equal(items[0].publishedAt, null);
});

test('parseHrGe reads announcements from ng-state and adds the +04:00 site offset', function() {
  var items = c.parseHrGe(HR_HTML);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://www.hr.ge/announcement/494502');
  assert.equal(items[0].text, 'ფოტოგრაფი — Promoride — ყვარელი');
  assert.equal(items[0].publishedAt, '2026-09-21T14:49:38.347+04:00');
});

test('parseHrGe throws when ng-state is missing (layout change must surface)', function() {
  assert.throws(function() { c.parseHrGe('<html></html>'); }, /ng-state/);
});

test('collect(reddit) drops entries older than since and tags the source', async function() {
  var since = Date.parse('2026-10-01T00:00:00Z');
  var items = await c.collect({ id: 's1', type: 'reddit', value: 'tbilisi' }, since, {
    get: async function(url) {
      assert.equal(url, 'https://www.reddit.com/r/tbilisi/new/.rss');
      return { data: REDDIT_RSS };
    },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'reddit');
  assert.equal(items[0].sourceId, 's1');
});

test('collect(telegram) pages back with before= until it reaches since', async function() {
  var calls = [];
  var pages = {
    first: [
      { url: 'https://t.me/chan/120', text: 'a', publishedAt: '2026-10-06T10:00:00Z' },
      { url: 'https://t.me/chan/121', text: 'b', publishedAt: '2026-10-06T11:00:00Z' },
    ],
    120: [
      { url: 'https://t.me/chan/100', text: 'old', publishedAt: '2026-09-01T10:00:00Z' },
      { url: 'https://t.me/chan/119', text: 'c', publishedAt: '2026-10-05T10:00:00Z' },
    ],
  };
  var since = Date.parse('2026-10-01T00:00:00Z');
  var items = await c.collect({ id: 't1', type: 'telegram', value: 'chan' }, since, {
    fetchTelegramPage: async function(channel, opts) {
      calls.push(opts ? opts.before : 'first');
      return pages[opts ? opts.before : 'first'] || [];
    },
  });
  assert.deepEqual(calls, ['first', 120]);
  assert.deepEqual(items.map(function(i) { return i.text; }), ['a', 'b', 'c']);
  assert.equal(items[0].author, '@chan');
});

test('collect rejects unknown source types', async function() {
  await assert.rejects(c.collect({ type: 'myspace', value: 'x' }, 0, {}), /unknown source type/);
});
