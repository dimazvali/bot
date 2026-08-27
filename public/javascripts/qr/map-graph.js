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

// Grows an orthogonal street grid outward from (x0, y0). The click point
// is an ordinary 4-way crossroads — not a hub many streets radiate from —
// and every street runs in one of exactly 4 directions, 90 degrees apart
// (a random whole-grid rotation per call, so it isn't always screen-
// aligned, but every street is still parallel or perpendicular to every
// other one). Main avenues run long and mostly uninterrupted; shorter,
// narrower side streets peel off perpendicular to them at intervals,
// forming blocks. Bounded by maxRadius/maxSegments so it always
// terminates.
function generateStreetGraph(x0, y0, opts) {
  opts = opts || {};
  var rng = opts.rng || createRng(opts.seed || 1);
  var maxSegments = opts.maxSegments != null ? opts.maxSegments : 1400;
  var maxRadius = opts.maxRadius != null ? opts.maxRadius : 900;
  var minRunLen = opts.minRunLen != null ? opts.minRunLen : 50;
  var maxRunLen = opts.maxRunLen != null ? opts.maxRunLen : 85;
  var sideStreetDepth = opts.sideStreetDepth != null ? opts.sideStreetDepth : 6;

  var baseRotation = rng() * (Math.PI / 2); // whole grid's orientation — still deterministic per seed

  var segments = [];

  function dirVector(dirIdx) {
    var angle = baseRotation + dirIdx * (Math.PI / 2);
    return { dx: Math.cos(angle), dy: Math.sin(angle) };
  }

  function grow(x, y, dirIdx, depthBudget, width, continueChance, crossChance) {
    if (segments.length >= maxSegments || depthBudget <= 0) return;

    var runLen = minRunLen + rng() * (maxRunLen - minRunLen);
    var dir = dirVector(dirIdx);
    var nx = x + dir.dx * runLen;
    var ny = y + dir.dy * runLen;
    if (Math.sqrt((nx - x0) * (nx - x0) + (ny - y0) * (ny - y0)) > maxRadius) return;

    segments.push({ x1: x, y1: y, x2: nx, y2: ny, width: width });

    if (rng() < continueChance) {
      grow(nx, ny, dirIdx, depthBudget - 1, width * 0.99, continueChance, crossChance);
    }

    [1, -1].forEach(function(turn) {
      if (rng() < crossChance) {
        var newDirIdx = ((dirIdx + turn) % 4 + 4) % 4; // 90-degree turn, either side
        grow(nx, ny, newDirIdx, sideStreetDepth, width * 0.62, continueChance * 0.82, crossChance * 0.6);
      }
    });
  }

  for (var i = 0; i < 4; i++) {
    grow(x0, y0, i, 9999, 5, 0.93, 0.4);
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
