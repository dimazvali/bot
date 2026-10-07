'use strict';
var triggers = require('./photo-leads-triggers');
var collectors = require('./photo-leads-collectors');
var classifier = require('./photo-leads-classifier');
var data = require('./photo-leads-data');
var digest = require('./photo-leads-digest');

var DEFAULT_LOOKBACK_MS = 48 * 3600 * 1000;
var FAILING_THRESHOLD = 3;

var _running = false;
function isRunning() { return _running; }

// opts.sourceIds — limit to these sources (admin "run this one").
// opts.deps — { now, collect, classify, send } (send(text) delivers the digest; omitted → no send).
async function run(opts) {
  opts = opts || {};
  if (_running) return { skipped: true };
  _running = true;
  try {
    var d = Object.assign({ now: Date.now, collect: collectors.collect, classify: classifier.classify, send: null }, opts.deps);
    var now = d.now();
    var stats = { sources: 0, seen: 0, duplicates: 0, matched: 0, classified: 0, failed: 0, errors: [] };

    // Leads left unclassified by earlier runs go first in the classify queue.
    var queue = await data.listUnclassified();

    var sources = (await data.listSources()).filter(function(s) {
      return opts.sourceIds ? opts.sourceIds.indexOf(s.id) !== -1 : s.active;
    });
    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      stats.sources++;
      var items;
      try {
        items = await d.collect(source, source.lastRunAt || now - DEFAULT_LOOKBACK_MS);
        await data.markSourceRun(source.id, { ok: true, at: now });
      } catch (e) {
        console.error('[photo-leads] source', source.type + ':' + source.value, e.message);
        stats.errors.push({ source: source.type + ':' + source.value, message: e.message });
        await data.markSourceRun(source.id, { ok: false, error: e.message });
        continue;
      }
      for (var j = 0; j < items.length; j++) {
        var item = items[j];
        stats.seen++;
        if (await data.isDuplicate(item, now)) { stats.duplicates++; continue; }
        var pre = triggers.prefilter(item.text);
        if (!pre) continue;
        stats.matched++;
        var id = await data.saveLead(item, pre, now);
        queue.push(Object.assign({ id: id, prefilter: pre }, item));
      }
    }

    var hot = [];
    var maybeCount = 0;
    for (var k = 0; k < queue.length; k++) {
      var lead = queue[k];
      try {
        var c = await d.classify(lead, lead.prefilter);
        var zone = classifier.zoneFor(c.score);
        await data.setClassification(lead.id, c, zone);
        stats.classified++;
        if (zone === 'hot') hot.push(Object.assign({}, lead, { classification: c }));
        else if (zone === 'maybe') maybeCount++;
      } catch (e) {
        console.error('[photo-leads] classify', lead.url, e.message);
        stats.failed++;
        await data.markClassifyFailed(lead.id, e.message);
      }
    }

    await data.purgeIgnored(now);

    var failing = (await data.listSources()).filter(function(s) {
      return s.active && (s.consecutiveFailures || 0) >= FAILING_THRESHOLD;
    });
    var text = digest.formatDigest({ hot: hot, maybeCount: maybeCount, stats: stats, failing: failing, date: new Date(now) });
    if (d.send) await d.send(text);
    return { stats: stats, hot: hot.length, maybe: maybeCount, text: text };
  } finally {
    _running = false;
  }
}

module.exports = { run: run, isRunning: isRunning };
