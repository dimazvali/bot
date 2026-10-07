'use strict';
var crypto = require('crypto');
var normalize = require('./photo-leads-triggers').normalize;
var SOURCE_TYPES = require('./photo-leads-collectors').SOURCE_TYPES;

var SOURCES = 'photo_lead_sources';
var LEADS = 'photo_leads';
var DAY_MS = 24 * 3600 * 1000;
var DEDUP_WINDOW_MS = 14 * DAY_MS;
var IGNORE_RETENTION_MS = 30 * DAY_MS;
var MAX_CLASSIFY_ATTEMPTS = 3;
var EDITABLE_STATUSES = ['new', 'contacted', 'won', 'dismissed'];

// r/Georgia is the US state — the country is r/Sakartvelo.
var DEFAULT_SOURCES = [
  { type: 'reddit', value: 'tbilisi', city: 'Tbilisi' },
  { type: 'reddit', value: 'Sakartvelo', city: null },
  { type: 'reddit', value: 'Batumi', city: 'Batumi' },
  { type: 'jobsge', value: 'ფოტოგრაფი', city: null },
  { type: 'jobsge', value: 'photographer', city: null },
  { type: 'hrge', value: 'ფოტოგრაფი', city: null },
  { type: 'hrge', value: 'photographer', city: null },
];

var _db = null;
function init(db) { _db = db; }

function sha1(s) { return crypto.createHash('sha1').update(String(s)).digest('hex'); }
function leadId(url) { return sha1(url); }
function textHash(text) { return sha1(normalize(text)); }

function docs(snap) { return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }); }

async function listSources() {
  return docs(await _db.collection(SOURCES).get());
}

async function ensureDefaultSources() {
  if ((await _db.collection(SOURCES).get()).size) return 0;
  for (var i = 0; i < DEFAULT_SOURCES.length; i++) await addSource(DEFAULT_SOURCES[i]);
  return DEFAULT_SOURCES.length;
}

async function addSource(input) {
  var type = String(input.type || '');
  if (SOURCE_TYPES.indexOf(type) === -1) throw new Error('bad source type: ' + type);
  var value = String(input.value || '').trim();
  if (type === 'telegram') value = value.replace(/^@/, '').replace(/^https?:\/\/t\.me\/(s\/)?/, '');
  if (type === 'reddit') value = value.replace(/^\/?r\//, '');
  if (!value) throw new Error('source value is empty');
  var ref = await _db.collection(SOURCES).add({
    type: type, value: value, city: String(input.city || '').trim() || null, active: true,
    lastRunAt: null, lastError: null, consecutiveFailures: 0, createdAt: Date.now(),
  });
  return ref.id;
}

async function setSourceActive(id, active) { await _db.collection(SOURCES).doc(id).update({ active: !!active }); }
async function deleteSource(id) { await _db.collection(SOURCES).doc(id).delete(); }

async function markSourceRun(id, r) {
  var ref = _db.collection(SOURCES).doc(id);
  if (r.ok) return ref.update({ lastRunAt: r.at, lastError: null, consecutiveFailures: 0 });
  var cur = (await ref.get()).data() || {};
  return ref.update({ lastError: String(r.error || 'error'), consecutiveFailures: (cur.consecutiveFailures || 0) + 1 });
}

async function isDuplicate(item, now) {
  if ((await _db.collection(LEADS).doc(leadId(item.url)).get()).exists) return true;
  var same = await _db.collection(LEADS).where('textHash', '==', textHash(item.text)).get();
  return same.docs.some(function(d) { return (d.data().foundAt || 0) >= now - DEDUP_WINDOW_MS; });
}

async function saveLead(item, prefilter, now) {
  var id = leadId(item.url);
  await _db.collection(LEADS).doc(id).set({
    source: item.source, sourceId: item.sourceId || null, url: item.url, text: item.text,
    author: item.author || null, publishedAt: item.publishedAt || null,
    foundAt: now, textHash: textHash(item.text), prefilter: prefilter,
    classification: null, status: 'unclassified', zone: null, attempts: 0, feedback: null,
  });
  return id;
}

async function listUnclassified() {
  return docs(await _db.collection(LEADS).where('status', '==', 'unclassified').get());
}

async function setClassification(id, classification, zone) {
  await _db.collection(LEADS).doc(id).update({ classification: classification, zone: zone, status: 'new' });
}

async function markClassifyFailed(id, message) {
  var ref = _db.collection(LEADS).doc(id);
  var attempts = (((await ref.get()).data() || {}).attempts || 0) + 1;
  if (attempts < MAX_CLASSIFY_ATTEMPTS) return ref.update({ attempts: attempts });
  return ref.update({
    attempts: attempts, status: 'dismissed', zone: 'ignore',
    classification: { isLead: false, score: 0, reason: 'classifier_failed: ' + message },
  });
}

// filter.zone: '' (default: everything except ignore) | 'hot' | 'maybe' | 'ignore' | 'all'
async function listLeads(filter) {
  filter = filter || {};
  var zone = filter.zone || '';
  var snap = (zone && zone !== 'all')
    ? await _db.collection(LEADS).where('zone', '==', zone).get()
    : await _db.collection(LEADS).get();
  return docs(snap)
    .filter(function(l) { return zone || l.zone !== 'ignore'; })
    .filter(function(l) { return !filter.status || l.status === filter.status; })
    .filter(function(l) { return !filter.source || l.source === filter.source; })
    .sort(function(a, b) {
      var sa = a.classification && a.classification.score != null ? a.classification.score : -1;
      var sb = b.classification && b.classification.score != null ? b.classification.score : -1;
      return sb - sa || (b.foundAt || 0) - (a.foundAt || 0);
    });
}

// Admin edits: status (one of EDITABLE_STATUSES) and feedback only.
async function updateLead(id, patch) {
  var clean = {};
  if (EDITABLE_STATUSES.indexOf(patch.status) !== -1) clean.status = patch.status;
  if (patch.feedback === 'not_lead' || patch.feedback === null) clean.feedback = patch.feedback;
  if (Object.keys(clean).length) await _db.collection(LEADS).doc(id).update(clean);
}

async function purgeIgnored(now) {
  var snap = await _db.collection(LEADS).where('zone', '==', 'ignore').get();
  var old = snap.docs.filter(function(d) { return (d.data().foundAt || 0) < now - IGNORE_RETENTION_MS; });
  for (var i = 0; i < old.length; i++) await old[i].ref.delete();
  return old.length;
}

module.exports = {
  init: init, EDITABLE_STATUSES: EDITABLE_STATUSES,
  listSources: listSources, ensureDefaultSources: ensureDefaultSources, addSource: addSource,
  setSourceActive: setSourceActive, deleteSource: deleteSource, markSourceRun: markSourceRun,
  isDuplicate: isDuplicate, saveLead: saveLead, listUnclassified: listUnclassified,
  setClassification: setClassification, markClassifyFailed: markClassifyFailed,
  listLeads: listLeads, updateLead: updateLead, purgeIgnored: purgeIgnored,
};
