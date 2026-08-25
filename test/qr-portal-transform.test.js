'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var T = require('../public/javascripts/qr/portal-transform.js');

test('computeHomographyCoeffs solves identity mapping', function() {
  var src = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  var dst = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  var c = T.computeHomographyCoeffs(src, dst);
  assert.ok(Math.abs(c.a - 1) < 1e-6);
  assert.ok(Math.abs(c.b - 0) < 1e-6);
  assert.ok(Math.abs(c.c - 0) < 1e-6);
  assert.ok(Math.abs(c.d - 0) < 1e-6);
  assert.ok(Math.abs(c.e - 1) < 1e-6);
  assert.ok(Math.abs(c.f - 0) < 1e-6);
  assert.ok(Math.abs(c.g - 0) < 1e-6);
  assert.ok(Math.abs(c.h - 0) < 1e-6);
});

test('computeHomographyCoeffs maps an arbitrary quad correctly (round-trip)', function() {
  var src = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }];
  var dst = [{ x: 50, y: 40 }, { x: 260, y: 10 }, { x: 300, y: 200 }, { x: 20, y: 180 }];
  var c = T.computeHomographyCoeffs(src, dst);
  function project(p) {
    var w = c.g * p.x + c.h * p.y + 1;
    return { x: (c.a * p.x + c.b * p.y + c.c) / w, y: (c.d * p.x + c.e * p.y + c.f) / w };
  }
  src.forEach(function(p, i) {
    var got = project(p);
    assert.ok(Math.abs(got.x - dst[i].x) < 1e-6, 'x mismatch at ' + i);
    assert.ok(Math.abs(got.y - dst[i].y) < 1e-6, 'y mismatch at ' + i);
  });
});

test('matrix3dFromCoeffs formats identity coefficients as an identity matrix3d', function() {
  var str = T.matrix3dFromCoeffs({ a: 1, b: 0, c: 0, d: 0, e: 1, f: 0, g: 0, h: 0 });
  assert.equal(str, 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)');
});

test('computePortalTransform composes homography + matrix3d in one call', function() {
  var src = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  var dst = [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }, { x: 5, y: 15 }];
  var str = T.computePortalTransform(src, dst);
  assert.match(str, /^matrix3d\(/);
});

test('mapCoverPoint maps a wide source cropped horizontally into a square box', function() {
  // source 1000x500 (2:1), box 200x200 (1:1) -> source is wider, cropped left/right
  var center = T.mapCoverPoint({ x: 500, y: 250 }, 1000, 500, 200, 200);
  assert.ok(Math.abs(center.x - 100) < 1e-6);
  assert.ok(Math.abs(center.y - 100) < 1e-6);
  var topLeft = T.mapCoverPoint({ x: 0, y: 0 }, 1000, 500, 200, 200);
  assert.ok(Math.abs(topLeft.x - -100) < 1e-6);
  assert.ok(Math.abs(topLeft.y - 0) < 1e-6);
});

test('mapCoverPoint maps a tall source cropped vertically into a wide box', function() {
  // source 500x1000 (1:2), box 200x100 (2:1) -> source is taller, cropped top/bottom
  var center = T.mapCoverPoint({ x: 250, y: 500 }, 500, 1000, 200, 100);
  assert.ok(Math.abs(center.x - 100) < 1e-6);
  assert.ok(Math.abs(center.y - 50) < 1e-6);
});

test('scaleQuadAroundCenter enlarges a quad around its centroid', function() {
  var points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  var scaled = T.scaleQuadAroundCenter(points, 2);
  assert.deepEqual(scaled, [{ x: -5, y: -5 }, { x: 15, y: -5 }, { x: 15, y: 15 }, { x: -5, y: 15 }]);
});

test('lerp interpolates linearly between two values', function() {
  assert.ok(Math.abs(T.lerp(0, 10, 0.25) - 2.5) < 1e-9);
  assert.ok(Math.abs(T.lerp(10, 0, 0.5) - 5) < 1e-9);
  assert.equal(T.lerp(5, 5, 0.7), 5);
});

test('lerpPoint interpolates x and y independently', function() {
  var p = T.lerpPoint({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5);
  assert.deepEqual(p, { x: 5, y: 10 });
});

test('computeQuadSkew is zero for a perfect axis-aligned rectangle', function() {
  var quad = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  assert.deepEqual(T.computeQuadSkew(quad), { horiz: 0, vert: 0 });
});

test('computeQuadSkew detects horizontal (left-right viewing angle) skew', function() {
  // top-right corner pulled down, as if the marker is foreshortened on the right
  var quad = [{ x: 0, y: 0 }, { x: 10, y: 3 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  var skew = T.computeQuadSkew(quad);
  assert.equal(skew.horiz, 3);
  assert.equal(skew.vert, 0);
});

test('computeQuadSkew detects vertical (up-down viewing angle) skew', function() {
  // bottom-left corner pulled right, as if the marker is foreshortened at the bottom
  var quad = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 4, y: 10 }];
  var skew = T.computeQuadSkew(quad);
  assert.equal(skew.horiz, 0);
  assert.equal(skew.vert, 4);
});
