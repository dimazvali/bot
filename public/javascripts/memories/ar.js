(function() {
  'use strict';
  var gate = document.getElementById('ar-gate');
  var stage = document.getElementById('ar-stage');
  var video = document.getElementById('ar-video');
  var startBtn = document.getElementById('ar-start');
  var errorEl = document.getElementById('ar-error');
  var dataEl = document.getElementById('ar-data');
  var AR_DATA = JSON.parse(dataEl.textContent);

  var state = { lat: null, lng: null, heading: null };

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function startCamera() {
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(function(stream) { video.srcObject = stream; });
  }

  function startGeolocation() {
    return new Promise(function(resolve, reject) {
      if (!navigator.geolocation) return reject(new Error('no geolocation'));
      navigator.geolocation.watchPosition(function(pos) {
        state.lat = pos.coords.latitude;
        state.lng = pos.coords.longitude;
        resolve();
      }, reject, { enableHighAccuracy: true, maximumAge: 1000 });
    });
  }

  function onOrientation(e) {
    var heading = typeof e.webkitCompassHeading === 'number'
      ? e.webkitCompassHeading
      : (e.absolute && e.alpha != null ? (360 - e.alpha) : null);
    if (heading != null) state.heading = heading;
  }

  function startOrientation() {
    var DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      return DOE.requestPermission().then(function(perm) {
        if (perm !== 'granted') throw new Error('orientation denied');
        window.addEventListener('deviceorientation', onOrientation);
      });
    }
    window.addEventListener('deviceorientationabsolute', onOrientation);
    window.addEventListener('deviceorientation', onOrientation);
    return Promise.resolve();
  }

  // Mirrors lib/memories-geometry.js exactly (see its node:test suite for
  // the source of truth on these formulas) — duplicated here because this
  // project has no client-side bundler, so a CommonJS lib can't be shared
  // into a plain <script> tag.
  var EARTH_RADIUS_M = 6371000;
  function toRad(d) { return d * Math.PI / 180; }
  function toDeg(r) { return r * 180 / Math.PI; }
  function haversineMeters(a, b) {
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var lat1 = toRad(a.lat);
    var lat2 = toRad(b.lat);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
  }
  function bearingDegrees(a, b) {
    var lat1 = toRad(a.lat);
    var lat2 = toRad(b.lat);
    var dLng = toRad(b.lng - a.lng);
    var y = Math.sin(dLng) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }
  function angleDiffDegrees(a, b) {
    var diff = (a - b) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff;
  }
  function photoScale(distance, minVisibleDistance, fullSizeDistance, minScale) {
    if (minScale == null) minScale = 0.05;
    if (distance > minVisibleDistance) return 0;
    if (distance <= fullSizeDistance) return 1;
    var span = minVisibleDistance - fullSizeDistance;
    if (span <= 0) return 1;
    return minScale + (1 - minScale) * ((minVisibleDistance - distance) / span);
  }

  var HALF_FOV_DEG = 35; // assumed horizontal field of view half-angle
  var overlay = document.getElementById('ar-overlay');
  var els = {}; // photo id -> <img>

  function ensureEl(photo) {
    if (els[photo.id]) return els[photo.id];
    var img = document.createElement('img');
    img.className = 'ar-photo';
    img.src = photo.url;
    overlay.appendChild(img);
    els[photo.id] = img;
    return img;
  }

  function renderFrame() {
    requestAnimationFrame(renderFrame);
    if (state.lat == null || state.heading == null) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    AR_DATA.photos.forEach(function(photo) {
      var el = ensureEl(photo);
      var distance = haversineMeters(state, photo);
      var bearing = bearingDegrees(state, photo);
      var angleDiff = angleDiffDegrees(bearing, state.heading);
      if (distance > AR_DATA.settings.minVisibleDistance || Math.abs(angleDiff) > HALF_FOV_DEG) {
        el.style.display = 'none';
        return;
      }
      var scale = photoScale(distance, AR_DATA.settings.minVisibleDistance, AR_DATA.settings.fullSizeDistance);
      var naturalW = el.naturalWidth || 1600, naturalH = el.naturalHeight || 1200;
      var maxScale = Math.min(vw / naturalW, vh / naturalH);
      var w = naturalW * maxScale * scale;
      var h = naturalH * maxScale * scale;
      var screenX = vw / 2 + (angleDiff / HALF_FOV_DEG) * (vw / 2);
      var screenY = vh * 0.45;
      el.style.display = 'block';
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      el.style.left = (screenX - w / 2) + 'px';
      el.style.top = (screenY - h / 2) + 'px';
      el.style.opacity = String(Math.max(0.15, scale));
    });
  }

  startBtn.addEventListener('click', function() {
    startBtn.disabled = true;
    errorEl.hidden = true;
    startCamera()
      .then(startOrientation)
      .then(startGeolocation)
      .then(function() {
        gate.hidden = true;
        stage.hidden = false;
        requestAnimationFrame(renderFrame);
      })
      .catch(function(err) {
        startBtn.disabled = false;
        showError('Не удалось получить доступ: ' + err.message + '. Разрешите камеру, геолокацию и датчики ориентации в настройках браузера.');
      });
  });
})();
