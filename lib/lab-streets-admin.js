'use strict';
// Review of the street labelling for dimazvali.com/lab/streets/ (Tbilisi, St Petersburg).
//   lab_streets_reviews/{city~hash} — an admin's verdict on one street name: status ok | bad | later,
//     plus optional corrections (category, person's name, foreign / female flags) and a note.
//   labAdmins/{id} — extra admins { name, password_hash, superadmin } (the env LAB_ADMIN_PASS is the superadmin).
// Corrections are applied to the served data at runtime (applyReviews), so they go live without a rebuild.
var crypto = require('crypto');

var REVIEWS = 'lab_streets_reviews';
var ADMINS = 'labAdmins';
var STATUSES = ['ok', 'bad', 'later'];
var FIELDS = ['cat', 'personRu', 'personEn', 'foreign', 'female', 'streetRu'];

function cookieToken(pass) { return crypto.createHash('sha256').update('lab:' + pass).digest('hex'); }

// a street name's stable identity across rebuilds: its local-language name (data.json rows:
// [cat, flags, person ru, person en, street ru, street en, street ka, born, wikidata, person ka])
function streetKey(city, row) { return city === 'spb' ? row[4] || row[5] : row[6] || row[4]; }
function reviewId(city, key) { return city + '~' + crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 20); }

function lengths(data) {
  var len = data.names.map(function () { return 0; });
  data.ways.forEach(function (w) {
    var f = w[2], s = 0;
    for (var i = 2; i < f.length; i += 2) s += Math.hypot(f[i], f[i + 1]);
    len[w[0]] += s * data.q / 1000;
  });
  return len;
}

// a copy of data with the reviewed corrections applied (ways are shared, they never change)
function applyReviews(data, reviews, city) {
  if (!reviews || !Object.keys(reviews).length) return data;
  var names = data.names.map(function (row) {
    var rv = reviews[streetKey(city, row)];
    if (!rv) return row;
    var r = row.slice();
    var c = rv.fix || {};
    if (c.cat && data.cats.indexOf(c.cat) >= 0) r[0] = data.cats.indexOf(c.cat);
    if (c.personRu !== undefined) r[2] = c.personRu || null;
    if (c.personEn !== undefined) r[3] = c.personEn || null;
    if (c.streetRu) r[4] = c.streetRu; // Petersburg 1914: the street's name back then
    var flags = r[1];
    if (c.foreign !== undefined) flags = c.foreign ? flags | 1 : flags & ~1;
    if (c.female !== undefined) flags = c.female ? flags | 2 : flags & ~2;
    if (rv.status === 'ok' || Object.keys(c).length) flags &= ~4; // a human looked at it: no longer a guess
    r[1] = flags;
    return r;
  });
  return Object.assign({}, data, { names: names });
}

// rows for the review queue, longest streets first
// filters: { status: todo|ok|bad|later|all, cat, q, offset, limit }
function listRows(data, reviews, suggestionsByKey, city, filters) {
  filters = filters || {};
  var len = lengths(data);
  var q = String(filters.q || '').trim().toLowerCase();
  var rows = data.names.map(function (r, i) {
    var key = streetKey(city, r), rv = reviews[key] || null;
    return {
      idx: i, key: key, cat: data.cats[r[0]], foreign: !!(r[1] & 1), female: !!(r[1] & 2), guess: !!(r[1] & 4),
      personRu: r[2], personEn: r[3], personKa: r[9] || null, streetRu: r[4], streetEn: r[5], streetKa: r[6],
      born: r[7], wd: r[8], km: Math.round(len[i] * 100) / 100,
      review: rv && { status: rv.status, by: rv.by || null, at: rv.at || null, note: rv.note || '', fix: rv.fix || {} },
      suggestions: (suggestionsByKey && suggestionsByKey[key]) || [],
    };
  }).filter(function (x) {
    // Petersburg 1914: streets that were not there yet are not what is being checked (unless asked for)
    if (x.cat === 'absent' && filters.cat !== 'absent') return false;
    var st = filters.status || 'todo';
    if (st === 'todo' && x.review) return false;
    if (STATUSES.indexOf(st) >= 0 && (!x.review || x.review.status !== st)) return false;
    if (filters.cat && x.cat !== filters.cat) return false;
    if (filters.flag === 'guess' && !x.guess) return false;
    if (filters.flag === 'suggested' && !x.suggestions.length) return false;
    if (q && [x.streetRu, x.streetEn, x.streetKa, x.personRu, x.personEn, x.personKa, x.wd].join(' ').toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).sort(function (a, b) { return b.km - a.km; });
  var offset = Math.max(0, +filters.offset || 0), limit = Math.min(200, Math.max(1, +filters.limit || 50));
  return { total: rows.length, rows: rows.slice(offset, offset + limit) };
}

// how much of the city has been looked at, by street count and by km
function stats(data, reviews, city) {
  var len = lengths(data), out = { names: 0, km: 0, ok: 0, bad: 0, later: 0, todo: 0, okKm: 0, reviewedKm: 0 };
  data.names.forEach(function (r, i) {
    if (data.cats[r[0]] === 'absent') return; // Petersburg 1914: not there yet
    var rv = reviews[streetKey(city, r)];
    out.names++; out.km += len[i];
    if (!rv) { out.todo++; return; }
    out[rv.status]++;
    out.reviewedKm += len[i];
    if (rv.status === 'ok') out.okKm += len[i];
  });
  ['km', 'okKm', 'reviewedKm'].forEach(function (k) { out[k] = Math.round(out[k]); });
  return out;
}

// what an admin may save: a status plus corrections limited to known fields and categories
function cleanReview(body, cats) {
  body = body || {};
  if (STATUSES.indexOf(body.status) < 0) return { error: 'status' };
  var fix = {};
  if (body.cat != null && body.cat !== '') {
    if (cats.indexOf(body.cat) < 0) return { error: 'cat' };
    fix.cat = body.cat;
  }
  ['personRu', 'personEn', 'streetRu'].forEach(function (k) {
    if (body[k] != null) fix[k] = String(body[k]).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 120);
  });
  ['foreign', 'female'].forEach(function (k) { if (typeof body[k] === 'boolean') fix[k] = body[k]; });
  return { status: body.status, fix: fix, note: String(body.note || '').replace(/[\u0000-\u0009\u000b-\u001f<>]/g, '').trim().slice(0, 500) };
}

// ── Firestore ──
function create(db) {
  return {
    loadReviews: async function (city) {
      var snap = await db.collection(REVIEWS).where('city', '==', city).get();
      var out = {};
      snap.docs.forEach(function (d) {
        var x = d.data();
        out[x.key] = Object.assign({}, x, { at: x.at && x.at.toDate ? x.at.toDate().toISOString() : x.at || null });
      });
      return out;
    },
    // corrections accumulate: a later "ok" keeps the earlier fixes unless it sends new ones
    saveReview: async function (city, key, clean, by, prev) {
      var fix = Object.assign({}, prev && prev.fix, clean.fix);
      var doc = { city: city, key: key, status: clean.status, fix: fix, note: clean.note || (prev && prev.note) || '', by: by || null, at: new Date() };
      await db.collection(REVIEWS).doc(reviewId(city, key)).set(doc);
      return Object.assign({}, doc, { at: doc.at.toISOString() });
    },
    loadSuggestions: async function (prefix) {
      var snap = await db.collection(prefix + '_suggestions').where('status', '==', 'new').get();
      return snap.docs.map(function (d) {
        var x = d.data();
        return Object.assign({ id: d.id }, x, { createdAt: x.createdAt && x.createdAt.toDate ? x.createdAt.toDate().toISOString() : x.createdAt || null });
      });
    },
    setSuggestionStatus: function (prefix, id, status, by) {
      return db.collection(prefix + '_suggestions').doc(String(id)).update({ status: status, reviewedBy: by || null, reviewedAt: new Date() });
    },
    getAdminByPasswordHash: async function (hash) {
      var snap = await db.collection(ADMINS).where('password_hash', '==', hash).limit(1).get();
      return snap.empty ? null : Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
    },
    getAdmins: async function () {
      var snap = await db.collection(ADMINS).get();
      return snap.docs.map(function (d) { var x = d.data(); return { id: d.id, name: x.name, superadmin: !!x.superadmin }; });
    },
    insertAdmin: function (name, pass, superadmin) {
      return db.collection(ADMINS).add({ name: name, password_hash: cookieToken(pass), superadmin: !!superadmin, createdAt: new Date() });
    },
    deleteAdmin: function (id) { return db.collection(ADMINS).doc(String(id)).delete(); },
  };
}

module.exports = { create: create, cookieToken: cookieToken, streetKey: streetKey, reviewId: reviewId, applyReviews: applyReviews,
  listRows: listRows, stats: stats, cleanReview: cleanReview, STATUSES: STATUSES, FIELDS: FIELDS };
