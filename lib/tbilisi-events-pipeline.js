'use strict';
var collectors = require('./tbilisi-events-collectors');
var extractor = require('./tbilisi-events-extractor');
var dedup = require('./tbilisi-events-dedup');
var data = require('./tbilisi-events-data');
var venues = require('./tbilisi-events-venues');
var enricher = require('./tbilisi-events-enricher');
var images = require('./tbilisi-events-images');

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

async function persistEvent(extracted, sourceLabel, sourceUrl, summary, rawText, imageCandidate) {
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
      if (!existing.imageUrl && imageCandidate) {
        try {
          var merged = await withTimeout(images.fetchAndStore(imageCandidate, existing.id), 30000, 'image fetch');
          await data.updateEvent(existing.id, merged);
        } catch (e) {
          summary.sourceErrors.push({ source: sourceLabel, error: 'image fetch failed: ' + e.message });
        }
      }
      return existing.id;
    }

    var rawExcerpt = rawText ? String(rawText).slice(0, 1500) : null;
    var id = await data.insertEvent(Object.assign({}, extracted, {
      dedupeKey: dedupeKey,
      sources: [sourceEntry],
      rawExcerpt: rawExcerpt,
    }));
    summary.eventsNew++;

    try {
      var venueId = await withTimeout(venues.resolveVenue(extracted.place), 40000, 'venue resolve');
      if (venueId) await data.updateEvent(id, { venueId: venueId });
    } catch (e) {
      summary.sourceErrors.push({ source: sourceLabel, error: 'venue resolve failed: ' + e.message });
    }

    try {
      var enr = await withTimeout(enricher.enrichEvent({
        title: extracted.title, place: extracted.place, rawExcerpt: rawExcerpt,
        type: extracted.type, language: extracted.language,
      }), 60000, 'enrichment');
      await data.updateEvent(id, {
        description: enr.description, type: enr.type, language: enr.language, enrichedAt: new Date(),
      });
    } catch (e) {
      summary.sourceErrors.push({ source: sourceLabel, error: 'enrichment failed: ' + e.message });
    }

    if (imageCandidate) {
      try {
        var img = await withTimeout(images.fetchAndStore(imageCandidate, id), 30000, 'image fetch');
        await data.updateEvent(id, img);
      } catch (e) {
        summary.sourceErrors.push({ source: sourceLabel, error: 'image fetch failed: ' + e.message });
      }
    }
    return id;
  } catch (e) {
    summary.sourceErrors.push({ source: sourceLabel, error: 'persist failed: ' + e.message });
    console.error('[tbilisi-events] ' + sourceLabel + ': persist failed: ' + e.message);
    return null;
  }
}

// onProgress (optional) is called with plain-object events describing where the
// run is: { phase: 'start' | 'source' | 'item' | 'done', ... }. A throwing or
// slow listener must never break the pipeline, so every call is guarded.
async function run(sourcesOverride, onProgress) {
  var emit = typeof onProgress === 'function'
    ? function(ev) { try { onProgress(ev); } catch (e) { /* listener must not break the run */ } }
    : function() {};

  var summary = { sourcesProcessed: 0, sourceErrors: [], eventsFound: 0, eventsNew: 0, eventsMerged: 0, itemsSkipped: 0 };
  var sources = sourcesOverride || await data.getAllSources();
  emit({ phase: 'start', totalSources: sources.length });

  for (var i = 0; i < sources.length; i++) {
    var source = sources[i];
    var pos = { index: i + 1, total: sources.length, label: source.label, type: source.type };
    emit(Object.assign({ phase: 'source', status: 'start' }, pos));

    var structuredCollect = STRUCTURED_COLLECTOR_BY_TYPE[source.type];
    if (structuredCollect) {
      var structuredEvents;
      try {
        structuredEvents = await structuredCollect(source);
      } catch (e) {
        summary.sourceErrors.push({ source: source.label, error: e.message });
        console.error('[tbilisi-events] ' + source.label + ': ' + e.message);
        emit(Object.assign({ phase: 'source', status: 'error', error: e.message }, pos));
        continue;
      }
      summary.sourcesProcessed++;
      emit(Object.assign({ phase: 'source', status: 'collected', items: structuredEvents.length }, pos));
      for (var m = 0; m < structuredEvents.length; m++) {
        var ev = structuredEvents[m];
        var evFingerprint = JSON.stringify([ev.title, ev.date, ev.time, ev.place]);
        var evSeenKey = dedup.seenItemKey(ev.url, evFingerprint);
        if (await data.getSeenItem(evSeenKey)) {
          summary.itemsSkipped++;
          emit(Object.assign({ phase: 'item', index: m + 1, total: structuredEvents.length, skipped: true }, { label: source.label }));
          continue;
        }
        emit(Object.assign({ phase: 'item', index: m + 1, total: structuredEvents.length }, { label: source.label }));
        var evId = await persistEvent(
          { title: ev.title, date: ev.date, time: ev.time, place: ev.place, type: ev.type || null, language: [] },
          source.label, ev.url, summary, null, ev.imageCandidate || null
        );
        await data.markSeenItem(evSeenKey, {
          url: ev.url, contentHash: dedup.computeContentHash(evFingerprint),
          eventIds: evId ? [evId] : [], sourceLabel: source.label,
        });
      }
      emit(Object.assign({ phase: 'source', status: 'done',
        eventsFound: summary.eventsFound, eventsNew: summary.eventsNew,
        eventsMerged: summary.eventsMerged, itemsSkipped: summary.itemsSkipped }, pos));
      continue;
    }

    var collect = COLLECTOR_BY_TYPE[source.type];
    if (!collect) {
      summary.sourceErrors.push({ source: source.label, error: 'unknown source type: ' + source.type });
      console.error('[tbilisi-events] ' + source.label + ': unknown source type: ' + source.type);
      emit(Object.assign({ phase: 'source', status: 'error', error: 'unknown source type: ' + source.type }, pos));
      continue;
    }

    var items;
    try {
      items = await collect(source);
    } catch (e) {
      summary.sourceErrors.push({ source: source.label, error: e.message });
      console.error('[tbilisi-events] ' + source.label + ': ' + e.message);
      emit(Object.assign({ phase: 'source', status: 'error', error: e.message }, pos));
      continue;
    }
    summary.sourcesProcessed++;
    emit(Object.assign({ phase: 'source', status: 'collected', items: items.length }, pos));

    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      var itemSeenKey = dedup.seenItemKey(item.url, item.text || '');
      if (await data.getSeenItem(itemSeenKey)) {
        summary.itemsSkipped++;
        emit(Object.assign({ phase: 'item', index: j + 1, total: items.length, skipped: true }, { label: source.label }));
        continue;
      }
      emit(Object.assign({ phase: 'item', index: j + 1, total: items.length }, { label: source.label }));
      var extractedEvents;
      try {
        extractedEvents = await withTimeout(extractor.extractEvents(item.text, source.label, item.publishedAt), 60000, 'extraction');
      } catch (e) {
        summary.sourceErrors.push({ source: source.label, error: 'extraction failed: ' + e.message });
        console.error('[tbilisi-events] ' + source.label + ': extraction failed: ' + e.message);
        continue;
      }

      var producedIds = [];
      for (var k = 0; k < extractedEvents.length; k++) {
        var pid = await persistEvent(extractedEvents[k], source.label, item.url, summary, item.text, item.imageCandidate || null);
        if (pid) producedIds.push(pid);
      }
      await data.markSeenItem(itemSeenKey, {
        url: item.url, contentHash: dedup.computeContentHash(item.text || ''),
        eventIds: producedIds, sourceLabel: source.label,
      });
    }
    emit(Object.assign({ phase: 'source', status: 'done',
      eventsFound: summary.eventsFound, eventsNew: summary.eventsNew, eventsMerged: summary.eventsMerged }, pos));
  }

  emit({ phase: 'done', summary: summary });
  return summary;
}

module.exports = { run };
