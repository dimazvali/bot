'use strict';
var sources = require('./tbilisi-events-sources');
var collectors = require('./tbilisi-events-collectors');
var extractor = require('./tbilisi-events-extractor');
var dedup = require('./tbilisi-events-dedup');
var data = require('./tbilisi-events-data');

var COLLECTOR_BY_TYPE = {
  telegram: function(source) { return collectors.collectTelegram(source.value); },
  website: function(source) { return collectors.collectWebsite(source.value); },
  facebook: function(source) { return collectors.collectFacebook(source.value); },
  instagram: function(source) { return collectors.collectInstagram(source.value); },
};

async function run() {
  var summary = { sourcesProcessed: 0, sourceErrors: [], eventsFound: 0, eventsNew: 0, eventsMerged: 0 };

  for (var i = 0; i < sources.length; i++) {
    var source = sources[i];
    var collect = COLLECTOR_BY_TYPE[source.type];
    if (!collect) {
      summary.sourceErrors.push({ source: source.label, error: 'unknown source type: ' + source.type });
      continue;
    }

    var items;
    try {
      items = await collect(source);
    } catch (e) {
      summary.sourceErrors.push({ source: source.label, error: e.message });
      continue;
    }
    summary.sourcesProcessed++;

    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      var extracted;
      try {
        extracted = await extractor.extractEvent(item.text, source.label);
      } catch (e) {
        summary.sourceErrors.push({ source: source.label, error: 'extraction failed: ' + e.message });
        continue;
      }
      if (!extracted) continue;

      summary.eventsFound++;
      var dedupeKey = dedup.computeDedupeKey(extracted.title, extracted.date);
      var existing = await data.findByDedupeKey(dedupeKey);
      var sourceEntry = { label: source.label, url: item.url };

      if (existing) {
        await data.addSourceToEvent(existing.id, sourceEntry);
        summary.eventsMerged++;
      } else {
        await data.insertEvent(Object.assign({}, extracted, { dedupeKey: dedupeKey, sources: [sourceEntry] }));
        summary.eventsNew++;
      }
    }
  }

  return summary;
}

module.exports = { run };
