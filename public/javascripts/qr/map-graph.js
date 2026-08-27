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

// Grows a two-tier street network outward from (x0, y0): long, mostly
// straight "avenues" radiating from the origin (barely curving — like
// surveyed roads, not a random walk), each occasionally branching into
// shorter, narrower "side streets" at a deliberate crossroads-like angle.
// That two-tier split (plus long straight runs instead of per-step
// jitter) is what reads as a planned street network rather than organic
// cracks/roots. Bounded by maxRadius/maxSegments so it always terminates.
function generateStreetGraph(x0, y0, opts) {
  opts = opts || {};
  var rng = opts.rng || createRng(opts.seed || 1);
  var maxSegments = opts.maxSegments != null ? opts.maxSegments : 1400;
  var maxRadius = opts.maxRadius != null ? opts.maxRadius : 900;
  var branchCount = opts.branchCount != null ? opts.branchCount : 14;
  var minRunLen = opts.minRunLen != null ? opts.minRunLen : 45;
  var maxRunLen = opts.maxRunLen != null ? opts.maxRunLen : 100;
  var jitter = opts.jitter != null ? opts.jitter : 0.14; // small per-run curve, not per-pixel
  var sideStreetDepth = opts.sideStreetDepth != null ? opts.sideStreetDepth : 4;

  var segments = [];

  function grow(x, y, angle, depthBudget, width, forkChance, widthDecay) {
    if (segments.length >= maxSegments || depthBudget <= 0) return;

    var runLen = minRunLen + rng() * (maxRunLen - minRunLen);
    var newAngle = angle + (rng() - 0.5) * jitter;
    var nx = x + Math.cos(newAngle) * runLen;
    var ny = y + Math.sin(newAngle) * runLen;
    if (Math.sqrt((nx - x0) * (nx - x0) + (ny - y0) * (ny - y0)) > maxRadius) return;

    segments.push({ x1: x, y1: y, x2: nx, y2: ny, width: width });

    if (rng() < 0.85) {
      grow(nx, ny, newAngle, depthBudget - 1, width * widthDecay, forkChance, widthDecay);
    }
    if (rng() < forkChance) {
      var turn = (0.85 + rng() * 1.0) * (rng() < 0.5 ? 1 : -1); // roughly 49-106 degrees, either side
      grow(nx, ny, newAngle + turn, sideStreetDepth, width * 0.6, forkChance * 0.55, 0.9);
    }
  }

  for (var i = 0; i < branchCount; i++) {
    var angle = (i / branchCount) * Math.PI * 2 + (rng() - 0.5) * 0.2;
    grow(x0, y0, angle, 9999, 5, 0.5, 0.985);
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
