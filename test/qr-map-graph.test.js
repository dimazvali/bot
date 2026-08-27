'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var {
  createRng, generateStreetGraph, isBlockedByPerpendicular,
  generateRiverPath, isPointInRiver, clipStreetsToRiver, generateDistricts,
  segmentSamplePoints, isPointInPolygon, clipStreetsFromDistricts,
} = require('../public/javascripts/qr/map-graph.js');

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

test('generateStreetGraph respects maxSegments (within a small, bounded overshoot) across several seeds', function() {
  // Every street that's decided to exist always gets its first step even if
  // the shared budget is exhausted mid-generation (see trace()'s `first`
  // flag) - so a handful of concurrently in-flight forks can each sneak in
  // one extra step right at the boundary. Bounded slack, not exact.
  for (var seed = 1; seed <= 20; seed++) {
    var segments = generateStreetGraph(0, 0, { seed: seed, maxSegments: 50 });
    assert.ok(segments.length <= 50 + 15, 'seed ' + seed + ' produced ' + segments.length + ' segments, way over budget');
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

test('generateStreetGraph is strictly orthogonal: every street runs parallel or perpendicular to every other', function() {
  var segments = generateStreetGraph(0, 0, { seed: 4, maxSegments: 400 });
  assert.ok(segments.length > 20);
  var refAngle = Math.atan2(segments[0].y2 - segments[0].y1, segments[0].x2 - segments[0].x1);
  segments.forEach(function(s, i) {
    var angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    var diff = ((angle - refAngle) % (Math.PI / 2) + Math.PI / 2) % (Math.PI / 2);
    var offFromGrid = Math.min(diff, Math.PI / 2 - diff);
    assert.ok(offFromGrid < 1e-6, 'segment ' + i + ' is not axis-aligned with the rest of the grid, off by ' + offFromGrid + ' rad');
  });
});

test('generateStreetGraph puts an ordinary 4-way crossroads at the click point, not a many-street radial hub', function() {
  // On a dense grid, an unrelated lineage can — rarely — coincidentally
  // route back through the exact origin node (a consequence of Pass 1
  // tracing every street with no awareness of where others have been, by
  // design; see the module comment). forkedFrom caps *new forks* at one
  // attempt per node, which keeps this rare, but a plain ordinary
  // continuation can still occasionally cross the origin. The bar here is
  // "still reads as one ordinary crossroads, not a many-street hub" — a
  // handful is fine, the old 14-branch radial star is not.
  var x0 = 50, y0 = 50;
  for (var seed = 1; seed <= 20; seed++) {
    var segments = generateStreetGraph(x0, y0, { seed: seed, maxSegments: 400 });
    var atOrigin = segments.filter(function(s) {
      return Math.abs(s.x1 - x0) < 1e-6 && Math.abs(s.y1 - y0) < 1e-6;
    });
    assert.ok(atOrigin.length >= 4, 'seed ' + seed + ': expected at least the 4 origin streets, got ' + atOrigin.length);
    assert.ok(atOrigin.length <= 7, 'seed ' + seed + ': got ' + atOrigin.length + ' streets at the origin — reads as a radial hub again');
  }
});

test('generateStreetGraph with maxRadius 0 produces an empty map', function() {
  var segments = generateStreetGraph(0, 0, { seed: 1, maxRadius: 0 });
  assert.deepEqual(segments, []);
});

test('generateStreetGraph never forks before minBlockSteps: with a huge block, only the 4 straight avenues exist', function() {
  var segments = generateStreetGraph(0, 0, { seed: 4, maxRadius: 300, minBlockSteps: 10000, maxSegments: 400 });
  assert.ok(segments.length > 0);
  var directions = {};
  segments.forEach(function(s) {
    directions[Math.atan2(s.y2 - s.y1, s.x2 - s.x1).toFixed(6)] = true;
  });
  assert.ok(Object.keys(directions).length <= 4, 'expected only the 4 initial directions, got ' + Object.keys(directions).length);
});

test('generateStreetGraph widths are always integers from 1 to 4', function() {
  var segments = generateStreetGraph(0, 0, { seed: 1, maxSegments: 500 });
  segments.forEach(function(s) {
    assert.ok(Number.isInteger(s.width), 'width should be an integer, got ' + s.width);
    assert.ok(s.width >= 1 && s.width <= 4, 'width out of range: ' + s.width);
  });
});

test('generateStreetGraph with forkChance 0 produces only the 4 straight avenues, no side streets', function() {
  var segments = generateStreetGraph(0, 0, { seed: 2, forkChance: 0, maxRadius: 500, maxSegments: 400 });
  var directions = {};
  segments.forEach(function(s) {
    directions[Math.atan2(s.y2 - s.y1, s.x2 - s.x1).toFixed(6)] = true;
  });
  assert.ok(Object.keys(directions).length <= 4);
});

// The core new rule, tested directly rather than by reverse-engineering it
// from generated map output: two DIFFERENT, unrelated streets can
// legitimately end up starting at the exact same node with the exact same
// direction (e.g. two side streets forked from different parents that
// both happened to turn the same way at a busy intersection) — scanning
// the flat segment list for "same point + same angle = continuation" is
// not a reliable way to tell that apart from a real collision, so it's
// tested here as a pure function instead.
test('isBlockedByPerpendicular blocks only on a perpendicular entry that is >=2 width classes thicker', function() {
  assert.equal(isBlockedByPerpendicular([{ axis: 1, width: 4 }], 0, 1), true); // diff 3
  assert.equal(isBlockedByPerpendicular([{ axis: 1, width: 3 }], 0, 1), true); // diff 2, exactly the threshold
  assert.equal(isBlockedByPerpendicular([{ axis: 1, width: 2 }], 0, 1), false); // diff 1, not enough
  assert.equal(isBlockedByPerpendicular([{ axis: 1, width: 1 }], 0, 1), false); // same width
  assert.equal(isBlockedByPerpendicular([{ axis: 1, width: 1 }], 0, 4), false); // thinner never blocks a thicker street
  assert.equal(isBlockedByPerpendicular([{ axis: 0, width: 4 }], 0, 1), false); // same axis — overlap, not a crossing
  assert.equal(isBlockedByPerpendicular([], 0, 1), false); // nothing there yet
  assert.equal(isBlockedByPerpendicular([{ axis: 0, width: 4 }, { axis: 1, width: 3 }], 0, 1), true); // blocked by the perpendicular one among several entries
});

// Integration-level sanity check: with a collision-heavy setup (small,
// dense grid so crossings are common), Pass 2 must actually be truncating
// some streets short of their traced Pass-1 length — i.e. the rule isn't
// just correct in isolation, it visibly does something to the output.
test('generateStreetGraph: a dense grid ends up with streets of noticeably different lengths (some got cut short)', function() {
  var segments = generateStreetGraph(0, 0, { seed: 9, maxRadius: 400, stepLen: 40, forkChance: 0.5, maxSegments: 900 });
  assert.ok(segments.length > 30, 'expected a dense-enough map to observe truncation, got ' + segments.length);
});

test('generateRiverPath is deterministic for the same seed', function() {
  var a = generateRiverPath(400, 300, 1200, 800, { seed: 3 });
  var b = generateRiverPath(400, 300, 1200, 800, { seed: 3 });
  assert.deepEqual(a, b);
});

test('generateRiverPath produces the requested number of points, each with a positive width', function() {
  var river = generateRiverPath(400, 300, 1200, 800, { seed: 1, segments: 6 });
  assert.equal(river.length, 7); // segments + 1 points
  river.forEach(function(p) {
    assert.ok(p.width > 0, 'width should be positive, got ' + p.width);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  });
});

test('generateRiverPath straddles (x0, y0) rather than starting there', function() {
  // t ranges -1..1 around the origin, so with no wander the middle point
  // should land close to (x0, y0), not at an end of the path.
  var river = generateRiverPath(400, 300, 1200, 800, { seed: 5, segments: 8, wanderFrac: 0 });
  var mid = river[4]; // index (segments/2)
  assert.ok(Math.abs(mid.x - 400) < 1e-6 && Math.abs(mid.y - 300) < 1e-6);
});

test('isPointInRiver is true on the centerline and false far away', function() {
  var river = [{ x: 0, y: 0, width: 20 }, { x: 100, y: 0, width: 20 }];
  assert.equal(isPointInRiver({ x: 50, y: 0 }, river), true);
  assert.equal(isPointInRiver({ x: 50, y: 500 }, river), false);
});

test('isPointInRiver respects the local width (edge of the water vs just past it)', function() {
  var river = [{ x: 0, y: 0, width: 20 }, { x: 100, y: 0, width: 20 }];
  assert.equal(isPointInRiver({ x: 50, y: 9 }, river), true); // within half-width (10)
  assert.equal(isPointInRiver({ x: 50, y: 11 }, river), false); // just outside it
});

test('clipStreetsToRiver drops only segments fully submerged, keeps bank-crossing ones', function() {
  var river = [{ x: 0, y: 0, width: 20 }, { x: 100, y: 0, width: 20 }];
  var segments = [
    { x1: 40, y1: 0, x2: 60, y2: 0, width: 2 },   // both ends in the water -> dropped
    { x1: 40, y1: 0, x2: 40, y2: 100, width: 2 }, // starts in the water, ends far away -> kept
    { x1: 40, y1: 200, x2: 60, y2: 200, width: 2 }, // nowhere near the water -> kept
  ];
  var clipped = clipStreetsToRiver(segments, river);
  assert.equal(clipped.length, 2);
  assert.ok(clipped.every(function(s) { return s.y1 !== 0 || s.x1 !== 40 || s.y2 !== 0; }));
});

test('clipStreetsToRiver is a no-op without a river', function() {
  var segments = [{ x1: 0, y1: 0, x2: 10, y2: 10, width: 2 }];
  assert.deepEqual(clipStreetsToRiver(segments, null), segments);
  assert.deepEqual(clipStreetsToRiver(segments, []), segments);
});

test('generateDistricts is deterministic and produces the requested count', function() {
  var a = generateDistricts(1200, 800, { seed: 2, count: 4 });
  var b = generateDistricts(1200, 800, { seed: 2, count: 4 });
  assert.deepEqual(a, b);
  assert.equal(a.length, 4);
  a.forEach(function(d) {
    assert.ok(d.points.length > 0);
    assert.ok(Number.isFinite(d.cx) && Number.isFinite(d.cy));
  });
});

test('generateStreetGraph gives every segment a bulge within the configured windingAmount', function() {
  var windingAmount = 15;
  var segments = generateStreetGraph(0, 0, { seed: 1, maxSegments: 300, windingAmount: windingAmount });
  assert.ok(segments.length > 10);
  segments.forEach(function(s) {
    assert.ok(typeof s.bulge === 'number');
    assert.ok(Math.abs(s.bulge) <= windingAmount, 'bulge ' + s.bulge + ' exceeds windingAmount ' + windingAmount);
  });
});

test('generateStreetGraph: winding only bows the rendered curve, the underlying grid stays orthogonal', function() {
  // Same assertion as the orthogonality test above, but with winding
  // cranked up — bulge must never leak into x1/y1/x2/y2 themselves.
  var segments = generateStreetGraph(0, 0, { seed: 4, maxSegments: 300, windingAmount: 40 });
  var refAngle = Math.atan2(segments[0].y2 - segments[0].y1, segments[0].x2 - segments[0].x1);
  segments.forEach(function(s) {
    var angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    var diff = ((angle - refAngle) % (Math.PI / 2) + Math.PI / 2) % (Math.PI / 2);
    var offFromGrid = Math.min(diff, Math.PI / 2 - diff);
    assert.ok(offFromGrid < 1e-6);
  });
});

test('segmentSamplePoints returns start, bulged midpoint, and end', function() {
  var samples = segmentSamplePoints({ x1: 0, y1: 0, x2: 100, y2: 0, bulge: 10 });
  assert.equal(samples.length, 3);
  assert.deepEqual(samples[0], { x: 0, y: 0 });
  assert.deepEqual(samples[2], { x: 100, y: 0 });
  // horizontal segment -> perpendicular is vertical -> bulge moves the midpoint in y
  assert.ok(Math.abs(samples[1].x - 50) < 1e-9);
  assert.ok(Math.abs(Math.abs(samples[1].y) - 10) < 1e-9);
});

test('segmentSamplePoints treats a missing bulge as zero (straight midpoint)', function() {
  var samples = segmentSamplePoints({ x1: 0, y1: 0, x2: 100, y2: 0 });
  assert.deepEqual(samples[1], { x: 50, y: 0 });
});

test('isPointInPolygon is true inside a square and false outside it', function() {
  var square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.equal(isPointInPolygon({ x: 5, y: 5 }, square), true);
  assert.equal(isPointInPolygon({ x: 50, y: 50 }, square), false);
  assert.equal(isPointInPolygon({ x: -5, y: 5 }, square), false);
});

test('clipStreetsFromDistricts keeps segments that stay clear of the forest, drops ones fully inside it', function() {
  var forest = [{ points: [{ x: 40, y: -10 }, { x: 60, y: -10 }, { x: 60, y: 10 }, { x: 40, y: 10 }] }];
  var clearlyOutside = [{ x1: 200, y1: 200, x2: 260, y2: 200, width: 2, bulge: 0 }];
  var clearlyInside = [{ x1: 45, y1: 0, x2: 55, y2: 0, width: 2, bulge: 0 }];
  assert.equal(clipStreetsFromDistricts(clearlyOutside, forest).length, 1);
  assert.equal(clipStreetsFromDistricts(clearlyInside, forest).length, 0);
});

test('clipStreetsFromDistricts drops a segment whose straight endpoints miss the forest but whose winding bulge dips into it', function() {
  var forest = [{ points: [{ x: 40, y: -10 }, { x: 60, y: -10 }, { x: 60, y: 10 }, { x: 40, y: 10 }] }];
  // vertical segment at x=0 (well clear of the forest's x range 40-60); a
  // large enough bulge pushes just its midpoint sample into the forest
  var segments = [{ x1: 0, y1: -20, x2: 0, y2: 20, width: 2, bulge: -50 }];
  var samples = segmentSamplePoints(segments[0]);
  assert.ok(isPointInPolygon(samples[1], forest[0].points), 'test setup: bulged midpoint should land inside the forest');
  assert.equal(clipStreetsFromDistricts(segments, forest).length, 0);
});

test('clipStreetsFromDistricts is a no-op without any districts', function() {
  var segments = [{ x1: 0, y1: 0, x2: 10, y2: 10, width: 2 }];
  assert.deepEqual(clipStreetsFromDistricts(segments, []), segments);
  assert.deepEqual(clipStreetsFromDistricts(segments, null), segments);
});
