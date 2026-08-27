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

// Grid-step deltas for the 4 cardinal directions, in grid-local (u, v)
// coordinates — dirIdx 0/2 move along u, dirIdx 1/3 move along v.
var GRID_DELTAS = [
  { du: 1, dv: 0 },
  { du: 0, dv: 1 },
  { du: -1, dv: 0 },
  { du: 0, dv: -1 },
];

function axisOf(dirIdx) {
  return dirIdx % 2;
}

// The core collision rule: a street of the given axis/width is blocked by
// any already-claimed *perpendicular* entry that's at least 2 width
// classes thicker. Same-axis entries never block (that's an overlap, not
// a crossing); a thicker or similar-width perpendicular entry doesn't
// block either — only a meaningfully thicker cross street does.
function isBlockedByPerpendicular(entries, axis, width) {
  return entries.some(function(e) { return e.axis !== axis && e.width - width >= 2; });
}

// Grows an orthogonal street grid outward from (x0, y0) on a fixed-step
// lattice (a random whole-grid rotation per call, so it isn't always
// screen-aligned). The click point is an ordinary 4-way crossroads.
// Every new street — the 4 from the origin, and every side street forked
// off at roughly regular intervals — gets its own random width (1-4).
// A thinner street stops wherever its path would cross a *perpendicular*
// street that's at least 2 width classes thicker (a back alley doesn't
// punch through a boulevard); streets of similar width freely cross.
//
// Built in two passes so that rule holds regardless of the order streets
// happened to be generated in:
//   1. Trace the branching topology (who forks off whom, how far each
//      street reaches) with no collision checks at all.
//   2. Replay it thickest-street-first, truncating each street's drawn
//      path the moment it hits an already-claimed, much-thicker,
//      perpendicular node. A single-pass, generation-order-dependent
//      version would let a thin street that happened to be traced before
//      a thick crossing existed sail right through it.
function generateStreetGraph(x0, y0, opts) {
  opts = opts || {};
  var rng = opts.rng || createRng(opts.seed || 1);
  var maxSegments = opts.maxSegments != null ? opts.maxSegments : 1400;
  var maxRadius = opts.maxRadius != null ? opts.maxRadius : 900;
  var stepLen = opts.stepLen != null ? opts.stepLen : 62;
  var minBlockSteps = opts.minBlockSteps != null ? opts.minBlockSteps : 2;
  var forkChance = opts.forkChance != null ? opts.forkChance : 0.16;

  var baseRotation = rng() * (Math.PI / 2); // whole grid's orientation — still deterministic per seed
  var eu = { dx: Math.cos(baseRotation), dy: Math.sin(baseRotation) };
  var ev = { dx: Math.cos(baseRotation + Math.PI / 2), dy: Math.sin(baseRotation + Math.PI / 2) };

  function gridToWorld(u, v) {
    return {
      x: x0 + (u * eu.dx + v * ev.dx) * stepLen,
      y: y0 + (u * eu.dy + v * ev.dy) * stepLen,
    };
  }

  function withinRadius(u, v) {
    var w = gridToWorld(u, v);
    return Math.sqrt((w.x - x0) * (w.x - x0) + (w.y - y0) * (w.y - y0)) <= maxRadius;
  }

  function randWidth() {
    return Math.floor(rng() * 4) + 1; // 1..4
  }

  // ---- Pass 1: topology only — every street's full potential path, no collisions ----
  var streets = []; // { u0, v0, dirIdx, width, path: [{u,v}, ...] } (path excludes the start node)
  var stepBudget = { used: 0 };
  // On a grid this small relative to how many segments are requested, many
  // unrelated lineages pass through the same node — that's normal and is
  // what makes real intersections. But letting every one of them *also*
  // roll to spawn brand new forks there compounds into dozens of near-
  // duplicate streets piling up on whichever nodes happen to get crossed
  // most (the origin included). Cap it at one fork *decision* per node,
  // no matter how many different streets later cross it.
  var forkedFrom = { '0,0': true };

  function trace(u0, v0, dirIdx, width) {
    var delta = GRID_DELTAS[dirIdx];
    var path = [];
    var cu = u0, cv = v0;
    var stepsSinceTurn = 0;
    var first = true;
    // Once a street (the origin's 4, or a fork that won its coin flip) is
    // decided to exist, it always gets at least one step, regardless of the
    // shared budget — otherwise a single direction's own recursive
    // exploration could exhaust maxSegments before its 3 siblings, or a
    // sibling fork, ever take a single step.
    while (first || stepBudget.used < maxSegments) {
      var nu = cu + delta.du, nv = cv + delta.dv;
      if (!withinRadius(nu, nv)) break;
      path.push({ u: nu, v: nv });
      stepBudget.used++;
      cu = nu; cv = nv;
      stepsSinceTurn++;
      first = false;
      var nodeKey = cu + ',' + cv;
      if (stepsSinceTurn >= minBlockSteps && !forkedFrom[nodeKey]) {
        forkedFrom[nodeKey] = true;
        [1, -1].forEach(function(turn) {
          if (stepBudget.used < maxSegments && rng() < forkChance) {
            var newDirIdx = ((dirIdx + turn) % 4 + 4) % 4;
            trace(cu, cv, newDirIdx, randWidth());
          }
        });
        stepsSinceTurn = 0; // regular decision-point spacing, whether or not it forked
      }
    }
    streets.push({ dirIdx: dirIdx, width: width, u0: u0, v0: v0, path: path, fromOrigin: false });
  }

  for (var i = 0; i < 4; i++) {
    trace(0, 0, i, randWidth());
    streets[streets.length - 1].fromOrigin = true;
  }

  // ---- Pass 2: replay thickest-first, truncating on thick perpendicular collisions ----
  streets.sort(function(a, b) { return b.width - a.width; });

  var claimed = {}; // "u,v" -> [{ axis, width }]
  var segments = [];

  streets.forEach(function(street) {
    var axis = axisOf(street.dirIdx);
    var cu = street.u0, cv = street.v0;
    for (var idx = 0; idx < street.path.length; idx++) {
      var node = street.path[idx];
      var key = node.u + ',' + node.v;
      var entries = claimed[key] || (claimed[key] = []);
      // The click point is a guaranteed ordinary crossroads — some unrelated,
      // far-off fork's path could otherwise happen to reach a node right next
      // to the origin before Pass 2 gets to one of the origin's own 4
      // streets, blocking it before it ever really existed. Exempt only that
      // first step; collisions apply normally from the second step onward.
      var exempt = street.fromOrigin && idx === 0;
      var blocked = !exempt && isBlockedByPerpendicular(entries, axis, street.width);
      if (blocked) break;

      var from = gridToWorld(cu, cv);
      var to = gridToWorld(node.u, node.v);
      segments.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, width: street.width });
      entries.push({ axis: axis, width: street.width });
      cu = node.u; cv = node.v;
    }
  });

  return segments;
}

var api = {
  createRng: createRng,
  generateStreetGraph: generateStreetGraph,
  isBlockedByPerpendicular: isBlockedByPerpendicular,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.QRMapGraph = api;
}
