'use strict';
var _db = null;

function init(db) {
  _db = db;
}

// Parse stored string fields into arrays for templates
function parseProject(doc) {
  var p = Object.assign({}, doc);

  // context: paragraphs separated by blank line
  if (typeof p.context === 'string') {
    p.context = p.context.split(/\n\n+/).map(function(s) { return s.trim(); }).filter(Boolean);
  } else if (!p.context) {
    p.context = [];
  }

  // actions: one per line
  if (typeof p.actions === 'string') {
    p.actions = p.actions.split(/\n/).map(function(s) { return s.trim(); }).filter(Boolean);
  } else if (!p.actions) {
    p.actions = [];
  }

  // metrics: one per line "value | label"
  if (typeof p.metrics === 'string') {
    p.metrics = p.metrics.split(/\n/).map(function(s) { return s.trim(); }).filter(Boolean).map(function(s) {
      var i = s.indexOf('|');
      return i === -1
        ? { value: s.trim(), label: '' }
        : { value: s.slice(0, i).trim(), label: s.slice(i + 1).trim() };
    });
  } else if (!p.metrics) {
    p.metrics = [];
  }

  // tags: already array or split string
  if (typeof p.tags === 'string') {
    p.tags = p.tags.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  } else if (!p.tags) {
    p.tags = [];
  }

  return p;
}

async function getProjects(opts) {
  opts = opts || {};
  var snap = await _db.collection('it_projects').get();
  var docs = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
  if (opts.publishedOnly) docs = docs.filter(function(d) { return d.published; });
  docs.sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
  if (opts.parse) docs = docs.map(parseProject);
  return docs;
}

async function getProject(id) {
  var snap = await _db.collection('it_projects').doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function getProjectBySlug(slug) {
  var snap = await _db.collection('it_projects').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return null;
  return Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
}

async function saveProject(id, data) {
  var col = _db.collection('it_projects');
  if (!id || id === 'new') {
    var ref = await col.add(data);
    return ref.id;
  }
  await col.doc(id).set(data, { merge: true });
  return id;
}

async function deleteProject(id) {
  await _db.collection('it_projects').doc(id).delete();
}

module.exports = { init, parseProject, getProjects, getProject, getProjectBySlug, saveProject, deleteProject };
