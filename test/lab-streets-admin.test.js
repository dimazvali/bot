'use strict';
var test = require('node:test');
var assert = require('node:assert');
var A = require('../lib/lab-streets-admin');

var CATS = ['writers', 'royals', 'science', 'military', 'politics', 'stage', 'artists', 'music', 'sport', 'person', 'georgia', 'world', 'dates', 'ideas', 'nature', 'service'];
// rows: [cat, flags, person ru, person en, street ru, street en, street ka, born, wd, person ka]; each way 1 km (500 × q 2 m)
function data() {
  return {
    q: 2, cats: CATS,
    names: [
      [CATS.indexOf('writers'), 0, 'Галактион Табидзе', 'Galaktion Tabidze', 'улица Галактиона Табидзе', 'Galaktion Tabidze St', 'გალაკტიონ ტაბიძის ქუჩა', 1891, 'Q1', 'გალაკტიონ ტაბიძე'],
      [CATS.indexOf('person'), 4, null, null, 'улица Нугзара Шанавы', 'Nugzar Shanava St', 'ნუგზარ შანავას ქუჩა', null, null, null],
      [CATS.indexOf('georgia'), 4, null, null, 'Кахетинское шоссе', 'Kakheti Hwy', 'კახეთის გზატკეცილი', null, null, null],
    ],
    ways: [[0, 1, [0, 0, 500, 0]], [1, 1, [0, 0, 250, 0]], [2, 3, [0, 0, 1500, 0]]],
  };
}
var KEY_SHANAVA = 'ნუგზარ შანავას ქუჩა';

test('street keys: Georgian name for Tbilisi, Russian for Petersburg; review ids are stable and path-safe', function () {
  var d = data();
  assert.strictEqual(A.streetKey('tbilisi', d.names[1]), KEY_SHANAVA);
  assert.strictEqual(A.streetKey('spb', d.names[1]), 'улица Нугзара Шанавы');
  var id = A.reviewId('tbilisi', KEY_SHANAVA);
  assert.match(id, /^tbilisi~[0-9a-f]{20}$/);
  assert.strictEqual(id, A.reviewId('tbilisi', KEY_SHANAVA));
  assert.notStrictEqual(id, A.reviewId('spb', KEY_SHANAVA));
});

test('applyReviews: corrections change category, names and flags; reviewed rows stop being guesses; data is not mutated', function () {
  var d = data();
  var rv = {};
  rv[KEY_SHANAVA] = { status: 'bad', fix: { cat: 'military', personRu: 'Нугзар Шанава', foreign: false, female: false } };
  rv['კახეთის გზატკეცილი'] = { status: 'ok', fix: {} };
  rv['გალაკტიონ ტაბიძის ქუჩა'] = { status: 'later', fix: { cat: 'aliens' } }; // unknown category ignored
  var out = A.applyReviews(d, rv, 'tbilisi');
  assert.deepStrictEqual(out.names[1].slice(0, 4), [CATS.indexOf('military'), 0, 'Нугзар Шанава', null]);
  assert.strictEqual(out.names[2][1], 0, 'ok clears the guess flag');
  assert.strictEqual(out.names[0][0], CATS.indexOf('writers'));
  assert.strictEqual(d.names[1][0], CATS.indexOf('person'), 'original untouched');
  assert.strictEqual(out.ways, d.ways);
  rv[KEY_SHANAVA] = { status: 'ok', fix: { female: true } };
  assert.strictEqual(A.applyReviews(d, rv, 'tbilisi').names[1][1], 2);
  assert.strictEqual(A.applyReviews(d, {}, 'tbilisi'), d);
});

test('listRows: longest first, filters by status, category, flag and text; paginates', function () {
  var d = data();
  var rv = {}; rv['კახეთის გზატკეცილი'] = { status: 'later', fix: {} };
  var sugg = {}; sugg[KEY_SHANAVA] = [{ id: 's1', cat: 'military', text: 'погиб в 2008' }];
  var todo = A.listRows(d, rv, sugg, 'tbilisi', {});
  assert.deepStrictEqual(todo.rows.map(function (r) { return r.key; }), ['გალაკტიონ ტაბიძის ქუჩა', KEY_SHANAVA]);
  assert.strictEqual(todo.rows[0].km, 1);
  assert.strictEqual(A.listRows(d, rv, sugg, 'tbilisi', { status: 'later' }).rows[0].streetEn, 'Kakheti Hwy');
  assert.strictEqual(A.listRows(d, rv, sugg, 'tbilisi', { status: 'all' }).total, 3);
  assert.strictEqual(A.listRows(d, rv, sugg, 'tbilisi', { status: 'all', flag: 'guess' }).total, 2);
  assert.deepStrictEqual(A.listRows(d, rv, sugg, 'tbilisi', { flag: 'suggested' }).rows.map(function (r) { return r.suggestions.length; }), [1]);
  assert.strictEqual(A.listRows(d, rv, sugg, 'tbilisi', { status: 'all', cat: 'writers' }).total, 1);
  assert.strictEqual(A.listRows(d, rv, sugg, 'tbilisi', { status: 'all', q: 'galaktion' }).total, 1);
  assert.strictEqual(A.listRows(d, rv, sugg, 'tbilisi', { status: 'all', limit: 1, offset: 1 }).rows[0].streetEn, 'Galaktion Tabidze St');
});

test('stats count streets and km per status', function () {
  var d = data();
  var rv = {}; rv['კახეთის გზატკეცილი'] = { status: 'ok' }; rv[KEY_SHANAVA] = { status: 'bad' };
  assert.deepStrictEqual(A.stats(d, rv, 'tbilisi'), { names: 3, km: 5, ok: 1, bad: 1, later: 0, todo: 1, okKm: 3, reviewedKm: 4 });
});

test('cleanReview keeps only known statuses, categories and fields', function () {
  assert.deepStrictEqual(A.cleanReview({ status: 'nope' }, CATS), { error: 'status' });
  assert.deepStrictEqual(A.cleanReview({ status: 'ok', cat: 'aliens' }, CATS), { error: 'cat' });
  assert.deepStrictEqual(A.cleanReview({ status: 'bad', cat: 'military', personRu: ' <b>Гела</b> ', foreign: 'yes', female: false, note: 'x\u0001y', evil: 1 }, CATS),
    { status: 'bad', fix: { cat: 'military', personRu: 'bГела/b', female: false }, note: 'xy' });
  assert.deepStrictEqual(A.cleanReview({ status: 'later', cat: '' }, CATS), { status: 'later', fix: {}, note: '' });
});

test('saveReview keeps earlier corrections when a later verdict adds none', async function () {
  var stored = {};
  var db = { collection: function () { return { doc: function (id) { return { set: async function (d) { stored[id] = d; } }; } }; } };
  var store = A.create(db);
  var prev = { fix: { cat: 'military', personRu: 'Нугзар Шанава' }, note: 'погиб в 2008' };
  var saved = await store.saveReview('tbilisi', KEY_SHANAVA, { status: 'ok', fix: { female: false }, note: '' }, 'dima', prev);
  assert.deepStrictEqual(saved.fix, { cat: 'military', personRu: 'Нугзар Шанава', female: false });
  assert.strictEqual(saved.note, 'погиб в 2008');
  assert.strictEqual(stored[A.reviewId('tbilisi', KEY_SHANAVA)].by, 'dima');
});
