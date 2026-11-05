'use strict';
// CV quest content in Firestore: it_cv_quest/draft (edited in /admin/cv) and
// it_cv_quest/published (served at /cv). Publishing validates the draft first
// (lib/it-cv-editor.js) — a broken tree never reaches the public page.
// Nothing published yet → the seed in lib/it-cv-quest.js.

var seed = require('./it-cv-quest');
var editor = require('./it-cv-editor');

var CACHE_MS = 60 * 1000;

function createStore(db) {
  var col = db.collection('it_cv_quest');
  var cache = null; // { quest, at }

  function strip(d) {
    return { intro: d.intro, nodes: d.nodes, contacts: d.contacts || {}, STEPS: d.STEPS };
  }

  function seedQuest() { return editor.clone(seed); }

  async function getPublished() {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.quest;
    var quest = seedQuest();
    try {
      var d = await col.doc('published').get();
      if (d.exists) quest = strip(d.data());
    } catch (e) {
      console.warn('[it-cv] published quest not loaded, using seed:', e.message);
      if (cache) return cache.quest;
    }
    cache = { quest: quest, at: Date.now() };
    return quest;
  }

  // Draft → else published → else seed. meta: { publishedAt, draftAt, dirty }
  async function getDraft() {
    var snaps = await Promise.all([col.doc('draft').get(), col.doc('published').get()]);
    var draft = snaps[0].exists ? snaps[0].data() : null;
    var pub = snaps[1].exists ? snaps[1].data() : null;
    var quest = draft ? strip(draft) : pub ? strip(pub) : seedQuest();
    return {
      quest: quest,
      meta: {
        draftAt: draft ? draft.updatedAt || null : null,
        publishedAt: pub ? pub.publishedAt || null : null,
        dirty: !!draft && (!pub || JSON.stringify(strip(draft)) !== JSON.stringify(strip(pub))),
        fromSeed: !draft && !pub,
      },
    };
  }

  async function saveDraft(quest) {
    await col.doc('draft').set(Object.assign(strip(quest), { updatedAt: new Date() }));
  }

  // → { errors } or { steps }
  async function publish() {
    var quest = (await getDraft()).quest;
    var v = editor.validate(quest);
    if (v.errors.length) return { errors: v.errors };
    quest.STEPS = v.steps;
    await col.doc('published').set(Object.assign(strip(quest), { publishedAt: new Date() }));
    await col.doc('draft').set(Object.assign(strip(quest), { updatedAt: new Date() }));
    cache = null;
    return { steps: v.steps };
  }

  async function discardDraft() {
    await col.doc('draft').delete();
  }

  return { getPublished: getPublished, getDraft: getDraft, saveDraft: saveDraft, publish: publish, discardDraft: discardDraft };
}

// Shared instance (routes/it.js calls init; routes/it-admin.js uses the same one,
// so publishing drops the public page's cache right away)
var shared = null;
function init(db) { shared = createStore(db); return shared; }
function store() {
  if (!shared) throw new Error('it-cv-store: init(db) not called');
  return shared;
}

module.exports = { createStore: createStore, init: init, store: store };
