'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var { createRng, generateStreetGraph } = require('../public/javascripts/qr/map-graph.js');

test('createRng produces numbers in [0, 1)', function() {
  var rng = createRng(42);
  for (var i = 0; i < 100; i++) {
    var v = rng();
    assert.ok(v >= 0 && v < 1, 'value out of range: ' + v);
  }
});

test('createRng is deterministic for the same seed', function() {
  var a = createRng(7);
  var b = createRng(7);
  for (var i = 0; i < 20; i++) {
    assert.equal(a(), b());
  }
});

test('createRng produces different sequences for different seeds', function() {
  var a = createRng(1);
  var b = createRng(2);
  var same = true;
  for (var i = 0; i < 10; i++) {
    if (a() !== b()) same = false;
  }
  assert.equal(same, false);
});

test('generateStreetGraph is deterministic for the same seed', function() {
  var a = generateStreetGraph(100, 100, { seed: 5 });
  var b = generateStreetGraph(100, 100, { seed: 5 });
  assert.deepEqual(a, b);
});

test('generateStreetGraph produces a non-trivial, bounded number of segments', function() {
  var segments = generateStreetGraph(0, 0, { seed: 1, maxSegments: 1400 });
  assert.ok(segments.length > 20, 'expected a non-trivial map, got ' + segments.length + ' segments');
  assert.ok(segments.length <= 1400);
});

test('generateStreetGraph respects maxSegments across several seeds', function() {
  for (var seed = 1; seed <= 10; seed++) {
    var segments = generateStreetGraph(0, 0, { seed: seed, maxSegments: 50 });
    assert.ok(segments.length <= 50, 'seed ' + seed + ' produced ' + segments.length + ' segments');
  }
});

test('generateStreetGraph keeps every segment endpoint within maxRadius of the origin', function() {
  var x0 = 300, y0 = 300, maxRadius = 250;
  var segments = generateStreetGraph(x0, y0, { seed: 3, maxRadius: maxRadius });
  segments.forEach(function(s) {
    var d1 = Math.sqrt((s.x1 - x0) * (s.x1 - x0) + (s.y1 - y0) * (s.y1 - y0));
    var d2 = Math.sqrt((s.x2 - x0) * (s.x2 - x0) + (s.y2 - y0) * (s.y2 - y0));
    assert.ok(d1 <= maxRadius + 1e-6, 'start point outside radius: ' + d1);
    assert.ok(d2 <= maxRadius + 1e-6, 'end point outside radius: ' + d2);
  });
});

test('generateStreetGraph main avenues reach out close to maxRadius (fill the area, not just a small patch)', function() {
  var x0 = 0, y0 = 0, maxRadius = 500;
  var segments = generateStreetGraph(x0, y0, { seed: 2, maxRadius: maxRadius, maxSegments: 1400 });
  var farthest = segments.reduce(function(max, s) {
    var d = Math.sqrt((s.x2 - x0) * (s.x2 - x0) + (s.y2 - y0) * (s.y2 - y0));
    return Math.max(max, d);
  }, 0);
  assert.ok(farthest > maxRadius * 0.85, 'expected at least one avenue to reach near maxRadius, farthest was ' + farthest);
});

test('generateStreetGraph runs are long and only lightly curved (streets, not a jittery random walk)', function() {
  var segments = generateStreetGraph(0, 0, { seed: 1, maxSegments: 200 });
  segments.forEach(function(s) {
    var len = Math.sqrt((s.x2 - s.x1) * (s.x2 - s.x1) + (s.y2 - s.y1) * (s.y2 - s.y1));
    assert.ok(len >= 45 - 1e-6 && len <= 100 + 1e-6, 'segment length out of expected street-run range: ' + len);
  });
});

test('generateStreetGraph tapers width (side streets narrower than the avenues they branch from)', function() {
  var segments = generateStreetGraph(0, 0, { seed: 1, maxSegments: 300 });
  var widths = segments.map(function(s) { return s.width; });
  var maxWidth = Math.max.apply(null, widths);
  var minWidth = Math.min.apply(null, widths);
  assert.ok(maxWidth > minWidth * 1.5, 'expected a visible width range between avenues and side streets');
});

test('generateStreetGraph with branchCount 0 produces an empty map', function() {
  var segments = generateStreetGraph(0, 0, { seed: 1, branchCount: 0 });
  assert.deepEqual(segments, []);
});
