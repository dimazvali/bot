'use strict';
// Validation and form → data logic for the CV quest editor (it.dimazvali.com/admin/cv).
// The quest shape is documented in lib/it-cv-quest.js. All functions are pure:
// they take a quest and return a new one (or errors), so they're unit-tested
// without Firestore (test/it-cv-editor.test.js).

var ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
var MAX_DEPTH = 6;

function clone(q) { return JSON.parse(JSON.stringify(q)); }

// The node whose question follows the brief of `node` (itself, or its `next`)
function askerOf(quest, node) {
  return node.next ? quest.nodes[node.next] : node;
}

function hasQuestion(n) {
  return !!(n && n.question && Array.isArray(n.options) && n.options.length);
}

function isHttps(v) { return /^https:\/\/\S+$/.test(String(v || '')); }

// → { errors: [], warnings: [], steps, paths }
// errors block publishing; warnings don't.
function validate(quest) {
  var errors = [];
  var warnings = [];
  var nodes = (quest && quest.nodes) || {};
  var intro = (quest && quest.intro) || {};
  var c = (quest && quest.contacts) || {};

  if (!intro.title) errors.push('Вступление: нет заголовка');
  if (!hasQuestion(intro)) errors.push('Вступление: нужен вопрос и хотя бы один вариант');
  if (c.pdf && !isHttps(c.pdf)) errors.push('Контакты: PDF — ссылка https://');
  if (c.telegram && !isHttps(c.telegram)) errors.push('Контакты: Telegram — ссылка https://');
  if (c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) errors.push('Контакты: email выглядит неправильно');

  var paths = [];
  var checked = {};
  var reached = {};

  function checkChosen(id) {
    if (checked[id]) return;
    checked[id] = true;
    var n = nodes[id];
    var where = '«' + id + '»';
    if (!n.title) errors.push(where + ': нет заголовка');
    if (!n.tag) errors.push(where + ': нет тега');
    if (!Array.isArray(n.brief) || !n.brief.filter(Boolean).length) errors.push(where + ': пустой бриф');
    if (n.link && (!isHttps(n.link.href) || !n.link.label)) errors.push(where + ': у ссылки нужны https-адрес и подпись');
    if (n.pdf && !isHttps(n.pdf)) errors.push(where + ': PDF — ссылка https://');
    if (n.stat && (!n.stat.value || !n.stat.label)) errors.push(where + ': у цифры нужны и значение, и подпись');
  }

  function walk(asker, askerName, path) {
    if (!hasQuestion(asker)) { errors.push(askerName + ': нет вопроса или вариантов'); return; }
    asker.options.forEach(function(opt) {
      if (!opt.label) errors.push(askerName + ': у варианта «' + opt.id + '» нет надписи');
      var n = nodes[opt.id];
      if (!n) { errors.push(askerName + ': вариант ведёт в несуществующий узел «' + opt.id + '»'); return; }
      reached[opt.id] = true;
      var p = path.concat(opt.id);
      if (p.length > MAX_DEPTH) { errors.push('Слишком длинный путь (цикл?): ' + p.join(' → ')); return; }
      checkChosen(opt.id);
      if (n.final) { paths.push(p); return; }
      if (n.next) {
        reached[n.next] = true;
        if (!nodes[n.next]) { errors.push('«' + opt.id + '»: «дальше» ведёт в несуществующий узел «' + n.next + '»'); return; }
        walk(nodes[n.next], '«' + n.next + '»', p);
      } else {
        walk(n, '«' + opt.id + '»', p);
      }
    });
  }
  if (hasQuestion(intro)) walk(intro, 'Вступление', []);

  var lengths = {};
  paths.forEach(function(p) { lengths[p.length] = (lengths[p.length] || 0) + 1; });
  var distinct = Object.keys(lengths).map(Number);
  if (distinct.length > 1) {
    var short = paths.filter(function(p) { return p.length !== Math.max.apply(null, distinct); }).slice(0, 3);
    errors.push('Пути разной длины (' + distinct.join(', ') + ' шага) — прогресс-бар сломается. Например: ' + short.map(function(p) { return p.join(' → '); }).join('; '));
  }
  if (!paths.length && !errors.length) errors.push('Ни один путь не заканчивается финалом');

  Object.keys(nodes).forEach(function(id) {
    if (!reached[id]) warnings.push('«' + id + '» ни откуда не достижим');
  });

  return { errors: dedupe(errors), warnings: warnings, steps: distinct.length === 1 ? distinct[0] : null, paths: paths };
}

function dedupe(a) { return a.filter(function(x, i) { return a.indexOf(x) === i; }); }

// "id | надпись" per line → [{ id, label }] | { error }
function parseOptions(text, prefix) {
  var out = [];
  var lines = String(text || '').split(/\r?\n/).map(function(s) { return s.trim(); }).filter(Boolean);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var bar = line.indexOf('|');
    var id, label;
    if (bar === -1) { id = (prefix ? prefix + '-' : '') + (i + 1); label = line; }
    else { id = line.slice(0, bar).trim().toLowerCase(); label = line.slice(bar + 1).trim(); }
    if (!ID_RE.test(id)) return { error: 'Строка ' + (i + 1) + ': id «' + id + '» — латиница, цифры и дефис' };
    if (!label) return { error: 'Строка ' + (i + 1) + ': нет надписи' };
    if (out.some(function(o) { return o.id === id; })) return { error: 'id «' + id + '» встречается дважды' };
    out.push({ id: id, label: label });
  }
  return out;
}

function optionsToText(options) {
  return (options || []).map(function(o) { return o.id + ' | ' + o.label; }).join('\n');
}

function lines(text) {
  return String(text || '').split(/\r?\n/).map(function(s) { return s.trim(); }).filter(Boolean);
}

// Options pointing to nodes that don't exist yet → stub nodes shaped like their siblings:
// same `next` / `final` / own-question mode. With no siblings: a question node after the
// intro, a final node elsewhere.
function addStubs(quest, options, parentIsIntro) {
  var nodes = quest.nodes;
  var sibling = null;
  options.forEach(function(o) { if (!sibling && nodes[o.id]) sibling = nodes[o.id]; });
  var created = [];
  options.forEach(function(o) {
    if (nodes[o.id]) return;
    var stub = { title: o.label, tag: '', brief: [] };
    if (sibling && sibling.final) stub.final = true;
    else if (sibling && sibling.next) stub.next = sibling.next;
    else if (sibling || parentIsIntro) { stub.question = ''; stub.options = []; }
    else stub.final = true;
    nodes[o.id] = stub;
    created.push(o.id);
  });
  return created;
}

function applyIntro(quest, body) {
  var q = clone(quest);
  var opts = parseOptions(body.options, 'q');
  if (opts.error) return { error: 'Варианты: ' + opts.error };
  q.intro = {
    eyebrow: String(body.eyebrow || '').trim(),
    title: String(body.title || '').trim(),
    lead: String(body.lead || '').trim(),
    hint: String(body.hint || '').trim(),
    question: String(body.question || '').trim(),
    options: opts,
  };
  q.contacts = {
    pdf: String(body.pdf || '').trim(),
    email: String(body.email || '').trim(),
    telegram: String(body.telegram || '').trim(),
  };
  var created = addStubs(q, opts, true);
  return { quest: q, created: created };
}

// body.mode: 'question' (own question + options) | 'next' (body.next — shared node) | 'final'
function applyNode(quest, id, body) {
  var q = clone(quest);
  var prev = q.nodes[id];
  if (!prev) return { error: 'Нет узла «' + id + '»' };
  var n = {};
  ['title', 'tag'].forEach(function(k) { var v = String(body[k] || '').trim(); if (v) n[k] = v; });
  var brief = lines(body.brief);
  if (brief.length) n.brief = brief;
  if (body.statValue || body.statLabel) n.stat = { value: String(body.statValue || '').trim(), label: String(body.statLabel || '').trim() };
  if (body.linkHref || body.linkLabel) n.link = { href: String(body.linkHref || '').trim(), label: String(body.linkLabel || '').trim() };
  if (String(body.pdf || '').trim()) n.pdf = String(body.pdf).trim();

  var created = [];
  if (body.mode === 'final') {
    n.final = true;
  } else if (body.mode === 'next') {
    var target = String(body.next || '').trim();
    if (!q.nodes[target]) return { error: '«Дальше»: выберите узел' };
    if (target === id) return { error: '«Дальше» не может вести в этот же узел' };
    n.next = target;
  } else {
    var opts = parseOptions(body.options, id);
    if (opts.error) return { error: 'Варианты: ' + opts.error };
    n.question = String(body.question || '').trim();
    n.options = opts;
    q.nodes[id] = n;
    created = addStubs(q, opts, false);
    return { quest: q, created: created };
  }
  q.nodes[id] = n;
  return { quest: q, created: created };
}

// New standalone node (e.g. a shared step like `format`)
function addNode(quest, id, kind) {
  id = String(id || '').trim().toLowerCase();
  if (!ID_RE.test(id)) return { error: 'id — латиница, цифры и дефис' };
  if (quest.nodes[id]) return { error: 'Узел «' + id + '» уже есть' };
  var q = clone(quest);
  q.nodes[id] = kind === 'question' ? { question: '', options: [] } : { title: '', tag: '', brief: [], final: true };
  return { quest: q };
}

// Who points at this node (options and `next`)
function referencesTo(quest, id) {
  var refs = [];
  if ((quest.intro.options || []).some(function(o) { return o.id === id; })) refs.push('Вступление');
  Object.keys(quest.nodes).forEach(function(k) {
    var n = quest.nodes[k];
    if (n.next === id) refs.push('«' + k + '» (дальше)');
    if ((n.options || []).some(function(o) { return o.id === id; })) refs.push('«' + k + '»');
  });
  return refs;
}

function deleteNode(quest, id) {
  if (!quest.nodes[id]) return { error: 'Нет узла «' + id + '»' };
  var refs = referencesTo(quest, id);
  if (refs.length) return { error: 'На «' + id + '» ссылаются: ' + refs.join(', ') + '. Сначала уберите эти варианты.' };
  var q = clone(quest);
  delete q.nodes[id];
  return { quest: q };
}

// Tree for the overview page: [{ id, label, node, children: [...], shared }]
function tree(quest) {
  var nodes = quest.nodes;
  function build(asker, depth, seen) {
    if (!hasQuestion(asker) || depth > MAX_DEPTH) return [];
    return asker.options.map(function(o) {
      var n = nodes[o.id];
      var item = { id: o.id, label: o.label, node: n || null, children: [], via: null };
      if (!n || n.final || seen.indexOf(o.id) > -1) return item;
      if (n.next) {
        item.via = n.next;
        // shared step: listed once, at the bottom
        return item;
      }
      item.children = build(n, depth + 1, seen.concat(o.id));
      return item;
    });
  }
  var shared = {};
  Object.keys(nodes).forEach(function(k) { if (nodes[k].next) shared[nodes[k].next] = true; });
  return {
    root: build(quest.intro, 1, []),
    shared: Object.keys(shared).filter(function(k) { return nodes[k]; }).map(function(k) {
      return { id: k, node: nodes[k], children: build(nodes[k], 1, [k]) };
    }),
    orphans: Object.keys(nodes).filter(function(k) { return !referencesTo(quest, k).length; }),
  };
}

module.exports = {
  validate: validate, parseOptions: parseOptions, optionsToText: optionsToText,
  applyIntro: applyIntro, applyNode: applyNode, addNode: addNode, deleteNode: deleteNode,
  referencesTo: referencesTo, tree: tree, askerOf: askerOf, clone: clone,
};
