'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const seed = require('../lib/it-cv-quest');
const ed = require('../lib/it-cv-editor');
const { createStore } = require('../lib/it-cv-store');
const makeFakeDb = require('./helpers/fake-firestore');

const fresh = () => ed.clone(seed);

test('seed content passes validation with 3 steps', () => {
  const v = ed.validate(fresh());
  assert.deepEqual(v.errors, []);
  assert.deepEqual(v.warnings, []);
  assert.equal(v.steps, 3);
  assert.equal(v.paths.length, 6 * 3 * 3);
});

test('validate: missing node, empty brief, uneven paths, bad links', () => {
  const q = fresh();
  q.intro.options.push({ id: 'ghost', label: 'Призрак' });
  q.nodes.product.brief = [];
  q.nodes['product-b2b'] = { title: 'B2B', tag: 'b2b', brief: ['x'], final: true }; // path of 2
  q.nodes.photo.link = { href: 'http://insecure', label: 'x' };
  q.contacts.email = 'nope';
  const v = ed.validate(q);
  const all = v.errors.join('\n');
  assert.match(all, /несуществующий узел «ghost»/);
  assert.match(all, /«product»: пустой бриф/);
  assert.match(all, /разной длины/);
  assert.match(all, /«photo»: у ссылки/);
  assert.match(all, /email/);
  assert.equal(v.steps, null);
});

test('validate: cycle is reported, not an infinite loop', () => {
  const q = fresh();
  q.nodes['product-b2b'] = { title: 'x', tag: 'x', brief: ['x'], question: 'again?', options: [{ id: 'product', label: 'loop' }] };
  assert.match(ed.validate(q).errors.join('\n'), /цикл/);
});

test('validate: unreachable node is a warning', () => {
  const q = fresh();
  q.nodes.lonely = { title: 'x', tag: 'x', brief: ['x'], final: true };
  const v = ed.validate(q);
  assert.deepEqual(v.errors, []);
  assert.match(v.warnings.join(), /lonely/);
});

test('parseOptions: id | label, auto ids, errors', () => {
  assert.deepEqual(ed.parseOptions('a | A\n\n b-2|B '), [{ id: 'a', label: 'A' }, { id: 'b-2', label: 'B' }]);
  assert.deepEqual(ed.parseOptions('Просто текст', 'photo'), [{ id: 'photo-1', label: 'Просто текст' }]);
  assert.match(ed.parseOptions('Плохой id | x').error, /латиница/);
  assert.match(ed.parseOptions('a | x\na | y').error, /дважды/);
  assert.match(ed.parseOptions('a |').error, /надписи/);
  assert.equal(ed.optionsToText([{ id: 'a', label: 'A' }]), 'a | A');
});

test('applyIntro: saves fields and creates a question-stub for a new step-1 option', () => {
  const q = fresh();
  const body = {
    eyebrow: 'e', title: 'T', lead: 'L', hint: 'h', question: 'Кого?',
    options: ed.optionsToText(q.intro.options) + '\nteach | Преподавателя',
    pdf: q.contacts.pdf, email: q.contacts.email, telegram: q.contacts.telegram,
  };
  const r = ed.applyIntro(q, body);
  assert.deepEqual(r.created, ['teach']);
  assert.equal(r.quest.intro.title, 'T');
  assert.deepEqual(r.quest.nodes.teach, { title: 'Преподавателя', tag: '', brief: [], question: '', options: [] });
  assert.equal(q.intro.title, 'Дмитрий Шестаков', 'input not mutated');
  assert.match(ed.validate(r.quest).errors.join('\n'), /«teach»: пустой бриф/);
});

test('applyNode: question mode; new options become stubs shaped like siblings', () => {
  const q = fresh();
  const n = q.nodes.photo;
  const r = ed.applyNode(q, 'photo', {
    title: n.title, tag: n.tag, brief: n.brief.join('\n'), statValue: n.stat.value, statLabel: n.stat.label,
    mode: 'question', question: n.question, options: ed.optionsToText(n.options) + '\nphoto-print | Печать',
  });
  assert.deepEqual(r.created, ['photo-print']);
  assert.equal(r.quest.nodes['photo-print'].next, 'format'); // sibling photo-shoot has next: format
  assert.equal(r.quest.nodes.photo.stat.value, '3 роли');
});

test('applyNode: next and final modes; bad next target', () => {
  const q = fresh();
  let r = ed.applyNode(q, 'tech-llm', { title: 'LLM', tag: 'llm', brief: 'a\nb', mode: 'final' });
  assert.equal(r.quest.nodes['tech-llm'].final, true);
  assert.deepEqual(r.quest.nodes['tech-llm'].brief, ['a', 'b']);
  assert.equal(r.quest.nodes['tech-llm'].next, undefined);
  r = ed.applyNode(q, 'tech-llm', { title: 'x', tag: 'x', brief: 'x', mode: 'next', next: 'nope' });
  assert.match(r.error, /выберите узел/);
  r = ed.applyNode(q, 'tech-llm', { title: 'x', tag: 'x', brief: 'x', mode: 'next', next: 'format' });
  assert.equal(r.quest.nodes['tech-llm'].next, 'format');
});

test('deleteNode refuses referenced nodes; addNode validates ids', () => {
  const q = fresh();
  assert.match(ed.deleteNode(q, 'format').error, /ссылаются/);
  const a = ed.addNode(q, 'format-2', 'question');
  assert.deepEqual(a.quest.nodes['format-2'], { question: '', options: [] });
  assert.match(ed.addNode(q, 'format', 'question').error, /уже есть/);
  assert.match(ed.addNode(q, 'Bad Id').error, /латиница/);
  const d = ed.deleteNode(a.quest, 'format-2');
  assert.equal(d.quest.nodes['format-2'], undefined);
});

test('tree: branches, the shared step, orphans', () => {
  const q = fresh();
  q.nodes.lonely = { title: 'x', final: true };
  const t = ed.tree(q);
  assert.equal(t.root.length, 6);
  assert.equal(t.root[0].children.length, 3);
  assert.equal(t.root[0].children[0].via, 'format');
  assert.deepEqual(t.shared.map(s => s.id), ['format']);
  assert.equal(t.shared[0].children.length, 3);
  assert.deepEqual(t.orphans, ['lonely']);
});

test('store: seed until published; draft; publish blocked on errors; publish sets STEPS', async () => {
  const db = makeFakeDb();
  const store = createStore(db);
  let pub = await store.getPublished();
  assert.equal(pub.intro.title, 'Дмитрий Шестаков');
  let d = await store.getDraft();
  assert.equal(d.meta.fromSeed, true);

  const broken = ed.clone(d.quest);
  broken.nodes.product.brief = [];
  await store.saveDraft(broken);
  d = await store.getDraft();
  assert.equal(d.meta.dirty, true);
  const fail = await store.publish();
  assert.ok(fail.errors.length);
  assert.equal(db._store.it_cv_quest.published, undefined);

  const good = ed.clone(d.quest);
  good.nodes.product.brief = ['новый бриф'];
  good.intro.title = 'Новое имя';
  await store.saveDraft(good);
  const ok = await store.publish();
  assert.equal(ok.steps, 3);
  pub = await store.getPublished();
  assert.equal(pub.intro.title, 'Новое имя');
  assert.equal(pub.STEPS, 3);
  d = await store.getDraft();
  assert.equal(d.meta.dirty, false);

  const edit = ed.clone(d.quest);
  edit.intro.hint = 'другое';
  await store.saveDraft(edit);
  await store.discardDraft();
  d = await store.getDraft();
  assert.equal(d.quest.intro.hint, pub.intro.hint);
});
