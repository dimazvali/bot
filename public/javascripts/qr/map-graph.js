'use strict';

// Deterministic PRNG (mulberry32) — same seed always produces the same
// map, which makes this testable and lets a click be reproduced on demand.
function createRng(seed) {
  var state = seed >>> 0;
  return function() {
    state = (state + 0x6D2B79F5) | 0;
    var t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Grows a branching, tapering street network outward from (x0, y0) — like
// an old city map's roads radiating from a square. Bounded by maxDepth,
// maxSegments and maxRadius so it always terminates.
function generateStreetGraph(x0, y0, opts) {
  opts = opts || {};
  var rng = opts.rng || createRng(opts.seed || 1);
  var maxDepth = opts.maxDepth != null ? opts.maxDepth : 7;
  var maxSegments = opts.maxSegments != null ? opts.maxSegments : 400;
  var maxRadius = opts.maxRadius != null ? opts.maxRadius : 900;
  var branchCount = opts.branchCount != null ? opts.branchCount : 7;
  var minStep = opts.minStep != null ? opts.minStep : 16;
  var maxStep = opts.maxStep != null ? opts.maxStep : 34;

  var segments = [];

  function grow(x, y, angle, depth, width) {
    if (segments.length >= maxSegments || depth > maxDepth) return;

    var stepLen = minStep + rng() * (maxStep - minStep);
    var newAngle = angle + (rng() - 0.5) * 0.55;
    var nx = x + Math.cos(newAngle) * stepLen;
    var ny = y + Math.sin(newAngle) * stepLen;
    if (Math.sqrt((nx - x0) * (nx - x0) + (ny - y0) * (ny - y0)) > maxRadius) return;

    segments.push({ x1: x, y1: y, x2: nx, y2: ny, width: width, depth: depth });

    if (rng() < 0.9 - depth * 0.03) {
      grow(nx, ny, newAngle, depth + 1, width * 0.94);
    }
    if (depth < maxDepth - 1 && rng() < 0.2 - depth * 0.015) {
      var forkAngle = newAngle + (rng() < 0.5 ? 1 : -1) * (0.7 + rng() * 0.6);
      grow(nx, ny, forkAngle, depth + 1, width * 0.75);
    }
  }

  for (var i = 0; i < branchCount; i++) {
    var angle = (i / branchCount) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    grow(x0, y0, angle, 0, 4.2);
  }

  return segments;
}

var api = {
  createRng: createRng,
  generateStreetGraph: generateStreetGraph,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.QRMapGraph = api;
}
