'use strict';
var collectors = require('./tbilisi-events-collectors');
var extractor = require('./tbilisi-events-extractor');
var dedup = require('./tbilisi-events-dedup');
var data = require('./tbilisi-events-data');

var COLLECTOR_BY_TYPE = {
  telegram: function(source) { return collectors.collectTelegram(source.value); },
  website: function(source) { return collectors.collectWebsite(source.value); },
  facebook: function(source) { return collectors.collectFacebook(source.value); },
  facebook_group: function(source) { return collectors.collectFacebookGroup(source.value); },
  instagram: function(source) { return collectors.collectInstagram(source.value); },
};

// Sources that already return structured {title,date,time,place,url} events
// via their own API, so the free-text LLM extraction step is skipped for them.
var STRUCTURED_COLLECTOR_BY_TYPE = {
  tkt: function() { return collectors.collectTkt(); },
};

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(function(resolve, reject) {
      setTimeout(function() { reject(new Error(label + ' timed out after ' + ms + 'ms')); }, ms);
    }),
  ]);
}

async function persistEvent(extracted, sourceLabel, sourceUrl, summary) {
  summary.eventsFound++;
  try {
    var dedupeKey = dedup.computeDedupeKey(extracted.title, extracted.date);
    var existing = await data.findByDedupeKey(dedupeKey);
    if (!existing) {
      var sameDateEvents = await data.getEventsByDate(extracted.date);
      existing = await withTimeout(dedup.findMatchingEvent(extracted, sameDateEvents), 30000, 'dedup match');
    }
    var sourceEntry = { label: sourceLabel, url: sourceUrl };

    if (existing) {
      await data.addSourceToEvent(existing.id, sourceEntry);
      summary.eventsMerged++;
    } else {
      await data.insertEvent(Object.assign({}, extracted, { dedupeKey: dedupeKey, sources: [sourceEntry] }));
      summary.eventsNew++;
    }
  } catch (e) {
    summary.sourceErrors.push({ source: sourceLabel, error: 'persist failed: ' + e.message });
    console.error('[tbilisi-events] ' + sourceLabel + ': persist failed: ' + e.message);
  }
}

async function run(sourcesOverride) {
  var summary = { sourcesProcessed: 0, sourceErrors: [], eventsFound: 0, eventsNew: 0, eventsMerged: 0 };
  var sources = sourcesOverride || await data.getAllSources();

  for (var i = 0; i < sources.length; i++) {
    var source = sources[i];

    var structuredCollect = STRUCTURED_COLLECTOR_BY_TYPE[source.type];
    if (structuredCollect) {
      var structuredEvents;
      try {
        structuredEvents = await structuredCollect(source);
      } catch (e) {
        summary.sourceErrors.push({ source: source.label, error: e.message });
        console.error('[tbilisi-events] ' + source.label + ': ' + e.message);
        continue;
      }
      summary.sourcesProcessed++;
      for (var m = 0; m < structuredEvents.length; m++) {
        var ev = structuredEvents[m];
        await persistEvent({ title: ev.title, date: ev.date, time: ev.time, place: ev.place }, source.label, ev.url, summary);
      }
      continue;
    }

    var collect = COLLECTOR_BY_TYPE[source.type];
    if (!collect) {
      summary.sourceErrors.push({ source: source.label, error: 'unknown source type: ' + source.type });
      console.error('[tbilisi-events] ' + source.label + ': unknown source type: ' + source.type);
      continue;
    }

    var items;
    try {
      items = await collect(source);
    } catch (e) {
      summary.sourceErrors.push({ source: source.label, error: e.message });
      console.error('[tbilisi-events] ' + source.label + ': ' + e.message);
      continue;
    }
    summary.sourcesProcessed++;

    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      var extractedEvents;
      try {
        extractedEvents = await withTimeout(extractor.extractEvents(item.text, source.label, item.publishedAt), 60000, 'extraction');
      } catch (e) {
        summary.sourceErrors.push({ source: source.label, error: 'extraction failed: ' + e.message });
        console.error('[tbilisi-events] ' + source.label + ': extraction failed: ' + e.message);
        continue;
      }

      for (var k = 0; k < extractedEvents.length; k++) {
        await persistEvent(extractedEvents[k], source.label, item.url, summary);
      }
    }
  }

  return summary;
}

module.exports = { run };
