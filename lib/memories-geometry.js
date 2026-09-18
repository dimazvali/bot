'use strict';

var EARTH_RADIUS_M = 6371000;

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }

// Great-circle distance between two {lat,lng} points, in meters.
function haversineMeters(a, b) {
  var dLat = toRad(b.lat - a.lat);
  var dLng = toRad(b.lng - a.lng);
  var lat1 = toRad(a.lat);
  var lat2 = toRad(b.lat);
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Initial compass bearing from a to b, in degrees, 0 = north, clockwise.
function bearingDegrees(a, b) {
  var lat1 = toRad(a.lat);
  var lat2 = toRad(b.lat);
  var dLng = toRad(b.lng - a.lng);
  var y = Math.sin(dLng) * Math.cos(lat2);
  var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Signed difference a-b in degrees, normalized to (-180, 180].
// Used to find how far off-center a bearing is from the device heading.
function angleDiffDegrees(a, b) {
  var diff = (a - b) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

// 0 beyond minVisibleDistance, 1 at/inside fullSizeDistance, linearly
// interpolated (with a small floor so it fades in rather than popping in)
// in between.
function photoScale(distance, minVisibleDistance, fullSizeDistance, minScale) {
  if (minScale == null) minScale = 0.05;
  if (distance > minVisibleDistance) return 0;
  if (distance <= fullSizeDistance) return 1;
  var span = minVisibleDistance - fullSizeDistance;
  if (span <= 0) return 1;
  var t = (minVisibleDistance - distance) / span;
  return minScale + (1 - minScale) * t;
}

module.exports = {
  haversineMeters: haversineMeters,
  bearingDegrees: bearingDegrees,
  angleDiffDegrees: angleDiffDegrees,
  photoScale: photoScale,
};
