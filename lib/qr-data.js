'use strict';
var { FieldValue } = require('firebase-admin/firestore');
var qrFirebase = require('./qr-firebase');

var SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
var PORTAL_SHAPES = ['3:2', '2:3', 'square', 'circle'];
var DEFAULT_PORTAL_SHAPE = 'square';

function validateSlug(slug) {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

function validatePortalShape(shape) {
  return PORTAL_SHAPES.indexOf(shape) !== -1;
}

function normalizePortalShape(shape) {
  return validatePortalShape(shape) ? shape : DEFAULT_PORTAL_SHAPE;
}

function createStore(collection, opts) {
  var incrementBy = (opts && opts.incrementBy) || function(n) { return FieldValue.increment(n); };

  async function getAll() {
    var snap = await collection.get();
    return snap.docs.map(function(d) { return d.data(); });
  }

  async function getBySlug(slug) {
    var doc = await collection.doc(slug).get();
    return doc.exists ? doc.data() : null;
  }

  async function create(entry) {
    if (!validateSlug(entry.slug)) throw new Error('Некорректный slug: используйте латиницу, цифры и дефисы');
    var existing = await collection.doc(entry.slug).get();
    if (existing.exists) throw new Error('Запись с таким slug уже существует');
    var now = Date.now();
    var record = {
      slug: entry.slug,
      title: entry.title || '',
      year: entry.year || '',
      description: entry.description || '',
      address: entry.address || '',
      photo: entry.photo || '',
      portalShape: normalizePortalShape(entry.portalShape),
      views: 0,
      createdAt: now,
      updatedAt: now,
    };
    await collection.doc(entry.slug).set(record);
    return record;
  }

  async function update(slug, patch) {
    var doc = await collection.doc(slug).get();
    if (!doc.exists) throw new Error('Запись не найдена: ' + slug);
    var normalizedPatch = Object.assign({}, patch);
    if ('portalShape' in normalizedPatch) normalizedPatch.portalShape = normalizePortalShape(normalizedPatch.portalShape);
    var updated = Object.assign({}, doc.data(), normalizedPatch, { slug: slug, updatedAt: Date.now() });
    await collection.doc(slug).set(updated);
    return updated;
  }

  async function remove(slug) {
    var doc = await collection.doc(slug).get();
    if (!doc.exists) throw new Error('Запись не найдена: ' + slug);
    await collection.doc(slug).delete();
  }

  async function incrementViews(slug) {
    // Atomic — must not lose updates when two views land close together.
    // Best-effort: if the doc doesn't exist (e.g. deleted concurrently),
    // swallow the error rather than fail the page render over a counter.
    try {
      await collection.doc(slug).update({ views: incrementBy(1) });
    } catch (e) {
      // ignore
    }
  }

  return { getAll: getAll, getBySlug: getBySlug, create: create, update: update, remove: remove, incrementViews: incrementViews };
}

function unavailableCollection() {
  function fail() { throw new Error('QR Firestore недоступен: dimazvali Firebase app не инициализирован'); }
  return { doc: fail, get: fail };
}

var defaultStore = createStore(qrFirebase.db ? qrFirebase.db.collection('qrPhotos') : unavailableCollection());

module.exports = Object.assign({}, defaultStore, {
  createStore: createStore,
  validateSlug: validateSlug,
  validatePortalShape: validatePortalShape,
  PORTAL_SHAPES: PORTAL_SHAPES,
});
