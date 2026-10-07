'use strict';
// Moves public images from photo-dimazvalimisc (US-EAST1) to photo-dimazvalimisc-eu
// (europe-west3, Frankfurt), closer to the site's audience. The old bucket is left
// as is, so already-published links (emails, search engines, messengers) keep working.
//
//   node scripts/migrate-photo-bucket.js create          — create the new bucket (idempotent)
//   node scripts/migrate-photo-bucket.js copy [--dry]    — copy objects missing in the new bucket
//   node scripts/migrate-photo-bucket.js rewrite [--dry] — sync missing objects, then rewrite
//                                                          Firestore URLs old bucket → new bucket
//
// Copies get Cache-Control from lib/storage-cache.js (1 year, immutable) and a public ACL.
// Both copy and rewrite are idempotent: safe to re-run (e.g. after uploads made during the switch).
require('dotenv').config();
var { initializeApp, cert } = require('firebase-admin/app');
var { getFirestore, FieldPath } = require('firebase-admin/firestore');
var { getStorage } = require('firebase-admin/storage');
var storageCache = require('../lib/storage-cache');

var OLD = 'photo-dimazvalimisc';
var NEW = 'photo-dimazvalimisc-eu';
var LOCATION = 'europe-west3';
var OLD_PREFIX = 'https://storage.googleapis.com/' + OLD + '/';
var NEW_PREFIX = 'https://storage.googleapis.com/' + NEW + '/';
// Collections that store links to the old bucket (from a full scan, Oct 2026).
var COLLECTIONS = [
  'photos', 'shootPhotos', 'photo_copyright_hits', 'memoryPhotos', 'it_projects',
  'eka_attractions', 'eka_bot_users', 'eka_broadcasts', 'eka_clients', 'eka_directions',
  'eka_images', 'eka_settings', 'eka_galleries', 'eka_tours',
];

var mode = process.argv[2];
var dry = process.argv.indexOf('--dry') !== -1;

var app = initializeApp({
  credential: cert({
    project_id: 'dimazvalimisc',
    private_key: process.env.sssGCPKey.replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
  }),
}, 'migrate-photo-bucket');
var storage = getStorage(app);
var db = getFirestore(app);

async function pool(items, size, fn) {
  var i = 0, done = 0;
  async function worker() {
    while (i < items.length) {
      var item = items[i++];
      await fn(item);
      if (++done % 250 === 0) console.log('  ' + done + '/' + items.length);
    }
  }
  await Promise.all(Array.from({ length: size }, worker));
}

async function create() {
  var bucket = storage.bucket(NEW);
  var [exists] = await bucket.exists();
  if (exists) {
    var [meta] = await bucket.getMetadata();
    console.log('exists:', NEW, meta.location, meta.storageClass);
  } else if (dry) {
    console.log('[dry] would create', NEW, 'in', LOCATION);
    return;
  } else {
    await bucket.create({
      location: LOCATION,
      storageClass: 'STANDARD',
      // fine-grained ACLs: upload code calls file.makePublic() per object
      iamConfiguration: { uniformBucketLevelAccess: { enabled: false }, publicAccessPrevention: 'inherited' },
    });
    console.log('created', NEW, 'in', LOCATION);
  }
  if (dry) return;
  // Everything in this bucket is public anyway — make that explicit at the bucket level too.
  var [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });
  var has = policy.bindings.some(function(b) { return b.role === 'roles/storage.objectViewer' && b.members.indexOf('allUsers') !== -1; });
  if (!has) {
    policy.bindings.push({ role: 'roles/storage.objectViewer', members: ['allUsers'] });
    await bucket.iam.setPolicy(policy);
    console.log('granted allUsers objectViewer');
  }
}

function destMetadata(src) {
  return { contentType: src.metadata.contentType || 'application/octet-stream', cacheControl: storageCache.IMMUTABLE };
}

// Re-applies content type + cache header to every object already in the new bucket
// whose metadata doesn't match the source (repairs the first copy run).
async function fixMeta() {
  var [oldFiles] = await storage.bucket(OLD).getFiles({ autoPaginate: true });
  var [newFiles] = await storage.bucket(NEW).getFiles({ autoPaginate: true });
  var src = {};
  oldFiles.forEach(function(f) { src[f.name] = f; });
  var todo = newFiles.filter(function(f) {
    var s = src[f.name];
    return s && (f.metadata.contentType !== destMetadata(s).contentType || f.metadata.cacheControl !== storageCache.IMMUTABLE);
  });
  console.log('objects with wrong metadata: ' + todo.length + ' of ' + newFiles.length);
  if (dry || !todo.length) return;
  var failed = [];
  await pool(todo, 16, async function(f) {
    try { await f.setMetadata(destMetadata(src[f.name])); }
    catch (e) { failed.push(f.name + ': ' + e.message); }
  });
  if (failed.length) { console.error('FAILED ' + failed.length + ':\n' + failed.slice(0, 20).join('\n')); process.exitCode = 1; }
}

async function copyMissing() {
  var [oldFiles] = await storage.bucket(OLD).getFiles({ autoPaginate: true });
  var [newFiles] = await storage.bucket(NEW).getFiles({ autoPaginate: true });
  var have = {};
  newFiles.forEach(function(f) { have[f.name] = f.metadata.size; });
  var todo = oldFiles.filter(function(f) { return have[f.name] !== f.metadata.size; });
  console.log('old: ' + oldFiles.length + ', new: ' + newFiles.length + ', to copy: ' + todo.length);
  if (dry || !todo.length) return todo.length;
  var failed = [];
  await pool(todo, 16, async function(f) {
    try {
      var dest = storage.bucket(NEW).file(f.name);
      await f.copy(dest, { predefinedAcl: 'publicRead' });
      // copy() here doesn't apply a `metadata` option (copies came out as octet-stream with
      // the default 1h cache), so set it explicitly from the source object.
      await dest.setMetadata(destMetadata(f));
    } catch (e) {
      failed.push(f.name + ': ' + e.message);
    }
  });
  if (failed.length) { console.error('FAILED ' + failed.length + ':\n' + failed.slice(0, 20).join('\n')); process.exitCode = 1; }
  return todo.length - failed.length;
}

// Replaces the old bucket prefix in every string inside a document. Returns the changed
// top-level fields only, or null.
function rewriteDoc(data) {
  var changed = {};
  function walk(v) {
    if (typeof v === 'string') return v.indexOf(OLD_PREFIX) !== -1 ? v.split(OLD_PREFIX).join(NEW_PREFIX) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object' && v.constructor === Object) {
      var o = {};
      Object.keys(v).forEach(function(k) { o[k] = walk(v[k]); });
      return o;
    }
    return v; // Timestamps, GeoPoints, refs, numbers…
  }
  Object.keys(data).forEach(function(k) {
    var next = walk(data[k]);
    if (JSON.stringify(next) !== JSON.stringify(data[k])) changed[k] = next;
  });
  return Object.keys(changed).length ? changed : null;
}

// Only these have subcollections worth scanning (eka_bot_users/<id>/messages).
var WITH_SUBCOLLECTIONS = ['eka_bot_users'];
var PAGE = 500;

async function rewriteCollection(ref, stats) {
  var last = null, page;
  do {
    var q = ref.orderBy(FieldPath.documentId()).limit(PAGE);
    if (last) q = q.startAfter(last);
    page = await q.get();
    var batch = db.batch(), n = 0;
    for (var d of page.docs) {
      var patch = rewriteDoc(d.data());
      if (patch) { n++; if (!dry) batch.update(d.ref, patch); }
      if (WITH_SUBCOLLECTIONS.indexOf(ref.id) !== -1) {
        for (var sub of await d.ref.listCollections()) await rewriteCollection(sub, stats);
      }
    }
    if (n && !dry) await batch.commit();
    stats[ref.path] = (stats[ref.path] || 0) + n;
    last = page.docs[page.size - 1];
  } while (page.size === PAGE); // a short (or empty) page is the last one
}

async function rewrite() {
  var copied = await copyMissing();
  if (process.exitCode) throw new Error('copy failed — not rewriting URLs to objects that may be missing');
  console.log((dry ? '[dry] ' : '') + 'synced ' + copied + ' object(s)');
  var stats = {};
  for (var c of COLLECTIONS) await rewriteCollection(db.collection(c), stats);
  Object.keys(stats).filter(function(k) { return stats[k]; }).forEach(function(k) {
    console.log((dry ? '[dry] would update ' : 'updated ') + String(stats[k]).padStart(5) + '  ' + k);
  });
  console.log('total docs: ' + Object.keys(stats).reduce(function(a, k) { return a + stats[k]; }, 0));
}

var run = { create: create, copy: copyMissing, fixmeta: fixMeta, rewrite: rewrite }[mode];
if (!run) { console.error('usage: node scripts/migrate-photo-bucket.js create|copy|fixmeta|rewrite [--dry]'); process.exit(2); }
run().then(function() { process.exit(process.exitCode || 0); }, function(e) { console.error(e); process.exit(1); });
