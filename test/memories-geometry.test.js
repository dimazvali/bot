'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var { haversineMeters, bearingDegrees, angleDiffDegrees, photoScale } = require('../lib/memories-geometry.js');

test('haversineMeters returns 0 for identical points', function() {
  assert.equal(haversineMeters({ lat: 41.7, lng: 44.8 }, { lat: 41.7, lng: 44.8 }), 0);
});

test('haversineMeters: 1 degree of latitude is about 111km', function() {
  var d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  assert.ok(Math.abs(d - 111195) < 500, 'got ' + d);
});

test('bearingDegrees: due north is 0', function() {
  var b = bearingDegrees({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  assert.ok(Math.abs(b - 0) < 0.01, 'got ' + b);
});

test('bearingDegrees: due east is 90', function() {
  var b = bearingDegrees({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
  assert.ok(Math.abs(b - 90) < 0.5, 'got ' + b);
});

test('bearingDegrees: due south is 180', function() {
  var b = bearingDegrees({ lat: 1, lng: 0 }, { lat: 0, lng: 0 });
  assert.ok(Math.abs(b - 180) < 0.5, 'got ' + b);
});

test('angleDiffDegrees: wraps around the 180/-180 boundary', function() {
  assert.equal(angleDiffDegrees(10, 350), 20);
  assert.equal(angleDiffDegrees(350, 10), -20);
});

test('angleDiffDegrees: no wraparound for small diffs', function() {
  assert.equal(angleDiffDegrees(100, 90), 10);
});

test('photoScale: 0 beyond minVisibleDistance', function() {
  assert.equal(photoScale(300, 200, 50), 0);
});

test('photoScale: 1 at and inside fullSizeDistance', function() {
  assert.equal(photoScale(50, 200, 50), 1);
  assert.equal(photoScale(10, 200, 50), 1);
});

test('photoScale: interpolates strictly between the two thresholds', function() {
  var s = photoScale(125, 200, 50); // halfway between 200 and 50
  assert.ok(s > 0.05 && s < 1, 'got ' + s);
});

test('photoScale: never returns exactly 0 for a visible-but-far photo (fades in, not pops in)', function() {
  var s = photoScale(199, 200, 50);
  assert.ok(s > 0);
});

// Wall-orientation viewing angle (public/javascripts/memories/ar.js) is
// built directly from these two primitives — composed here, not a separate
// function, but the composition's direction matters: it's the bearing FROM
// the photo TO the viewer, compared against the photo's own outward-facing
// bearing, not the other way around. These pin that down.
test('wall orientation: viewer due East of a photo facing East sees it straight-on', function() {
  var photo = { lat: 0, lng: 0 };
  var viewer = { lat: 0, lng: 1 }; // due east of the photo
  var bearingFromPhotoToViewer = bearingDegrees(photo, viewer);
  var viewAngle = angleDiffDegrees(bearingFromPhotoToViewer, /* orientation */ 90);
  assert.ok(Math.abs(viewAngle) < 0.5, 'got ' + viewAngle);
});

test('wall orientation: viewer level with an East-facing wall sees it edge-on (~90)', function() {
  var photo = { lat: 0, lng: 0 };
  var viewer = { lat: 1, lng: 0 }; // due north of the photo
  var bearingFromPhotoToViewer = bearingDegrees(photo, viewer);
  var viewAngle = angleDiffDegrees(bearingFromPhotoToViewer, /* orientation */ 90);
  assert.ok(Math.abs(Math.abs(viewAngle) - 90) < 0.5, 'got ' + viewAngle);
});

test('wall orientation: viewer due West of an East-facing wall is behind it (~180)', function() {
  var photo = { lat: 0, lng: 0 };
  var viewer = { lat: 0, lng: -1 }; // due west of the photo
  var bearingFromPhotoToViewer = bearingDegrees(photo, viewer);
  var viewAngle = angleDiffDegrees(bearingFromPhotoToViewer, /* orientation */ 90);
  // ar.js doesn't hide the card at this angle anymore — it shows the back
  // face (.ar-photo-back) instead. This just confirms the angle itself.
  assert.ok(Math.abs(viewAngle) > 150, 'got ' + viewAngle);
});
