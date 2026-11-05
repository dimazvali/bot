'use strict';
const test = require('node:test');
const assert = require('node:assert');
const quest = require('../lib/it-cv-quest');

const { intro, nodes, STEPS } = quest;

// Walk every path from the intro; return arrays of node ids chosen.
function allPaths() {
  const out = [];
  function walk(options, path) {
    for (const opt of options) {
      const node = nodes[opt.id];
      assert.ok(node, 'missing node ' + opt.id);
      const p = path.concat(opt.id);
      if (node.final) { out.push(p); continue; }
      const asker = node.next ? nodes[node.next] : node;
      assert.ok(asker && asker.options && asker.options.length, 'no next question after ' + opt.id);
      assert.ok(p.length < 10, 'cycle near ' + opt.id);
      walk(asker.options, p);
    }
  }
  walk(intro.options, []);
  return out;
}

test('every path ends in a final node after exactly STEPS choices', () => {
  const paths = allPaths();
  assert.ok(paths.length > 0);
  for (const p of paths) assert.strictEqual(p.length, STEPS, p.join(' → '));
});

test('every chosen node has a title, tag and non-empty brief', () => {
  for (const p of allPaths()) {
    for (const id of p) {
      const n = nodes[id];
      assert.ok(n.title && n.tag, 'title/tag for ' + id);
      assert.ok(Array.isArray(n.brief) && n.brief.length && n.brief.every(Boolean), 'brief for ' + id);
    }
  }
});

test('every node is reachable', () => {
  const seen = new Set();
  for (const p of allPaths()) for (const id of p) { seen.add(id); if (nodes[id].next) seen.add(nodes[id].next); }
  for (const id of Object.keys(nodes)) assert.ok(seen.has(id), 'unreachable node ' + id);
});

test('step-1 options each have between 2 and 4 follow-up options', () => {
  for (const opt of intro.options) {
    const n = nodes[opt.id];
    assert.ok(n.options.length >= 2 && n.options.length <= 4, opt.id);
  }
});
