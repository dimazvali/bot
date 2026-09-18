(function() {
  'use strict';
  var gate = document.getElementById('ar-gate');
  var stage = document.getElementById('ar-stage');
  var video = document.getElementById('ar-video');
  var startBtn = document.getElementById('ar-start');
  var errorEl = document.getElementById('ar-error');
  var statusEl = document.getElementById('ar-status');
  var dataEl = document.getElementById('ar-data');
  var AR_DATA = JSON.parse(dataEl.textContent);
  var debugEl = document.getElementById('ar-debug');
  var debugSummaryEl = document.getElementById('ar-debug-summary');
  var debugTextEl = document.getElementById('ar-debug-text');
  var mapEl = document.getElementById('ar-map');
  var mapWidgetEl = document.getElementById('ar-map-widget');
  var mapToggleEl = document.getElementById('ar-map-toggle');

  var state = { lat: null, lng: null, heading: null };

  // Everything the debug panel reads. Kept separate from `state` (which the
  // render loop reads every frame) so debug bookkeeping never has to be
  // fast — it's redrawn on its own slow interval, see renderDebugPanel.
  var debug = {
    camera: { status: 'ожидание' },
    geo: { status: 'ожидание', accuracy: null, lastFixAt: null, reportedHeading: null },
    orientation: { status: 'ожидание', source: null, absolute: null, alpha: null, beta: null, gamma: null, rawHeading: null, webkitCompassHeading: null, lastEventAt: null, sensorApiStatus: null, quaternion: null },
    photos: [],
  };

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function updateLocationStatus() {
    if (statusEl) statusEl.hidden = state.lat != null;
  }

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      debug.camera.status = 'недоступна (нет navigator.mediaDevices)';
      return Promise.reject(new Error('камера недоступна в этом браузере (нужен HTTPS и современный браузер)'));
    }
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(function(stream) {
        video.srcObject = stream;
        debug.camera.status = 'ok';
      })
      .catch(function(err) {
        debug.camera.status = 'ошибка: ' + (err && err.message);
        throw err;
      });
  }

  // Raw deviceorientation readings are noisy on most Android/Chrome combos
  // (no sensor fusion exposed to the web, unlike native apps such as Maps or
  // Telegram) — the alpha value visibly jitters even holding the phone
  // still. Smooth it with a circular exponential moving average: naive
  // averaging of raw degrees breaks at the 0/360 wraparound (avg of 359 and
  // 1 should be ~0, not 180), so we average the unit vector (cos, sin)
  // instead and convert back. Lower HEADING_SMOOTHING = smoother but slower
  // to follow a real turn; tune here if it still feels jittery/laggy.
  //
  // (Tried preferring GPS course-over-ground instead — reverted 2026-09-18:
  // watchPosition only fires ~1/s at best, so a GPS-driven heading lagged
  // noticeably behind an actual turn. Compass-only, smoothed, is more
  // responsive even if occasionally less accurate.)
  var HEADING_SMOOTHING = 0.15;
  var headingSin = null, headingCos = null;
  function smoothHeading(rawDeg) {
    var rad = rawDeg * Math.PI / 180;
    var sin = Math.sin(rad), cos = Math.cos(rad);
    if (headingSin == null) {
      headingSin = sin; headingCos = cos;
    } else {
      headingSin += (sin - headingSin) * HEADING_SMOOTHING;
      headingCos += (cos - headingCos) * HEADING_SMOOTHING;
    }
    return (Math.atan2(headingSin, headingCos) * 180 / Math.PI + 360) % 360;
  }

  // Starts watchPosition (which triggers the permission prompt) and updates
  // `state` on every fix, but does NOT make the caller wait for the first
  // fix to arrive — enableHighAccuracy GPS can take a long time (or never
  // land) indoors/with a weak signal, and the render loop already tolerates
  // state.lat being null until a fix shows up. We only block on an outright
  // permission error, or a 3s timeout if even that never fires.
  function startGeolocation() {
    return new Promise(function(resolve, reject) {
      if (!navigator.geolocation) {
        debug.geo.status = 'нет navigator.geolocation';
        return reject(new Error('нет геолокации в этом браузере'));
      }
      var settled = false;
      navigator.geolocation.watchPosition(function(pos) {
        state.lat = pos.coords.latitude;
        state.lng = pos.coords.longitude;
        debug.geo.status = 'ok';
        debug.geo.accuracy = pos.coords.accuracy;
        debug.geo.lastFixAt = Date.now();
        debug.geo.reportedHeading = (pos.coords.heading != null && !isNaN(pos.coords.heading)) ? pos.coords.heading : null;
        updateLocationStatus();
        if (!settled) { settled = true; resolve(); }
      }, function(err) {
        debug.geo.status = 'ошибка: ' + (err && err.message);
        if (!settled) { settled = true; reject(err); }
      }, { enableHighAccuracy: true, maximumAge: 1000 });
      setTimeout(function() {
        if (!settled) {
          settled = true;
          debug.geo.status = debug.geo.status === 'ожидание' ? 'ждём первый фикс (>3с)' : debug.geo.status;
          resolve();
        }
      }, 3000);
    });
  }

  // Official tilt-compensated compass formula from the W3C DeviceOrientation
  // spec (https://www.w3.org/TR/orientation-event/, Appendix A.1). Plain
  // `360 - alpha` (what we used before) is only correct when the device is
  // held flat — beta/gamma (tilt) shift what alpha actually means, and this
  // is an AR view held up at an angle, not flat, so that was silently wrong
  // whenever the phone wasn't level. This projects the device's "up" vector
  // and reads off its heading, which stays correct under tilt.
  var DEG2RAD = Math.PI / 180;
  function compassHeadingFromEuler(alpha, beta, gamma) {
    var x = beta ? beta * DEG2RAD : 0;
    var y = gamma ? gamma * DEG2RAD : 0;
    var z = alpha ? alpha * DEG2RAD : 0;
    var cX = Math.cos(x), cY = Math.cos(y), cZ = Math.cos(z);
    var sX = Math.sin(x), sY = Math.sin(y), sZ = Math.sin(z);
    var Vx = -cZ * sY - sZ * sX * cY;
    var Vy = -sZ * sY + cZ * sX * cY;
    var heading = Math.atan(Vx / Vy);
    if (Vy < 0) heading += Math.PI;
    else if (Vx < 0) heading += 2 * Math.PI;
    return heading * (180 / Math.PI);
  }

  function onOrientation(e) {
    // iOS Safari gives a true compass heading via webkitCompassHeading —
    // already tilt-compensated by the OS, so used as-is. Everywhere else we
    // compute it from alpha/beta/gamma ourselves (tilt-compensated, see
    // compassHeadingFromEuler above), even when `e.absolute` is false —
    // some Android/Chrome combos never fire `deviceorientationabsolute` at
    // all and report `absolute:false` on plain `deviceorientation`, but the
    // reading still tracks the compass in practice. Better an approximate
    // heading than none; `debug.orientation.absolute` still shows which
    // kind of reading this device is actually giving us.
    var rawHeading = typeof e.webkitCompassHeading === 'number'
      ? e.webkitCompassHeading
      : (e.alpha != null ? compassHeadingFromEuler(e.alpha, e.beta, e.gamma) : null);
    // compassHeadingFromEuler is undefined (0/0) when beta and gamma are
    // both exactly 0 — device lying perfectly flat. Doesn't come up holding
    // a phone up for AR, and real sensor noise means beta/gamma are never
    // exactly 0 anyway, but guard against NaN slipping into state.heading
    // regardless.
    if (rawHeading != null && !isNaN(rawHeading)) state.heading = smoothHeading(rawHeading);
    debug.orientation.status = rawHeading != null ? 'ok' + (e.absolute ? '' : ' (не absolute — приблизительно)') : 'события идут, но heading пуст';
    debug.orientation.source = e.type;
    debug.orientation.absolute = e.absolute;
    debug.orientation.alpha = e.alpha;
    debug.orientation.beta = e.beta;
    debug.orientation.gamma = e.gamma;
    debug.orientation.rawHeading = rawHeading;
    debug.orientation.webkitCompassHeading = typeof e.webkitCompassHeading === 'number' ? e.webkitCompassHeading : null;
    debug.orientation.lastEventAt = Date.now();
  }

  // Quaternion -> compass heading for the Generic Sensor API's
  // AbsoluteOrientationSensor. Its reading is a rotation from a world frame
  // (X=East, Y=North, Z=Up, per the W3C spec) to the device frame; the
  // standard ZYX-yaw extraction below gives the rotation around the Up
  // axis, which — for this East/North world frame — comes out as degrees
  // from East, so we convert to degrees-from-North (compass convention,
  // clockwise) same as everywhere else in this file. This is a standard
  // formula (matches the W3C generic-sensor-demos compass example); if the
  // arrow turns out systematically rotated on a given device, the debug
  // panel shows the raw quaternion so the offset can be diagnosed and fixed
  // here without guessing blind.
  function headingFromQuaternion(q) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var yawRad = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    var yawDeg = yawRad * 180 / Math.PI; // degrees from East, counter-clockwise
    return (360 - (90 - yawDeg) + 360) % 360; // -> degrees from North, clockwise
  }

  // Progressive enhancement for non-iOS: the Generic Sensor API's fused
  // AbsoluteOrientationSensor (accelerometer+gyroscope+magnetometer fusion,
  // done by the OS/browser) is closer to what native apps get than the raw
  // `deviceorientation` event. Support is inconsistent (Chromium-only, and
  // even there can throw or just never report a reading), so this always
  // resolves — true if it started delivering readings, false if we should
  // fall back to deviceorientation(absolute) instead. Never rejects.
  function tryAbsoluteOrientationSensor() {
    return new Promise(function(resolve) {
      if (typeof AbsoluteOrientationSensor === 'undefined') {
        debug.orientation.sensorApiStatus = 'AbsoluteOrientationSensor недоступен в этом браузере';
        return resolve(false);
      }
      var settled = false;
      function finish(ok) { if (!settled) { settled = true; resolve(ok); } }
      var sensor;
      try {
        sensor = new AbsoluteOrientationSensor({ frequency: 30 });
      } catch (e) {
        debug.orientation.sensorApiStatus = 'конструктор упал: ' + (e && e.message);
        return finish(false);
      }
      sensor.addEventListener('reading', function() {
        var q = sensor.quaternion;
        var heading = headingFromQuaternion(q);
        state.heading = smoothHeading(heading);
        debug.orientation.status = 'ok (AbsoluteOrientationSensor)';
        debug.orientation.sensorApiStatus = 'ok';
        debug.orientation.source = 'AbsoluteOrientationSensor';
        debug.orientation.absolute = true;
        debug.orientation.rawHeading = heading;
        debug.orientation.quaternion = [q[0], q[1], q[2], q[3]];
        debug.orientation.lastEventAt = Date.now();
        finish(true);
      });
      sensor.addEventListener('error', function(e) {
        debug.orientation.sensorApiStatus = 'ошибка: ' + (e.error && e.error.name) + (e.error && e.error.message ? ' — ' + e.error.message : '');
        finish(false);
      });
      try {
        sensor.start();
      } catch (e) {
        debug.orientation.sensorApiStatus = 'start() упал: ' + (e && e.message);
        return finish(false);
      }
      // Give it a moment to either report a first reading or error before
      // giving up on it and falling back.
      setTimeout(function() { finish(false); }, 1500);
    });
  }

  function startOrientation() {
    var DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      // iOS: webkitCompassHeading (read inside onOrientation) is already
      // the best available source there — no Generic Sensor API on Safari.
      return DOE.requestPermission().then(function(perm) {
        if (perm !== 'granted') {
          debug.orientation.status = 'доступ отклонён';
          throw new Error('orientation denied');
        }
        debug.orientation.status = 'разрешено, ждём событий';
        window.addEventListener('deviceorientation', onOrientation);
      });
    }
    return tryAbsoluteOrientationSensor().then(function(usedSensorApi) {
      if (usedSensorApi) return; // sensor keeps delivering 'reading' events on its own
      debug.orientation.status = 'не требует запроса, ждём событий (deviceorientation)';
      window.addEventListener('deviceorientationabsolute', onOrientation);
      window.addEventListener('deviceorientation', onOrientation);
    });
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
    var photoDebug = [];
    if (state.lat == null || state.heading == null) {
      debug.photos = photoDebug;
      return;
    }
    var vw = window.innerWidth, vh = window.innerHeight;
    AR_DATA.photos.forEach(function(photo) {
      var el = ensureEl(photo);
      var distance = haversineMeters(state, photo);
      var bearing = bearingDegrees(state, photo);
      var angleDiff = angleDiffDegrees(bearing, state.heading);
      var inFov = Math.abs(angleDiff) <= HALF_FOV_DEG;
      var visible = distance <= AR_DATA.settings.minVisibleDistance && inFov;
      var scale = visible ? photoScale(distance, AR_DATA.settings.minVisibleDistance, AR_DATA.settings.fullSizeDistance) : 0;
      photoDebug.push({ id: photo.id, distance: distance, bearing: bearing, angleDiff: angleDiff, visible: visible, scale: scale });
      if (!visible) {
        el.style.display = 'none';
        return;
      }
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
    debug.photos = photoDebug;
  }

  function fmt(n, digits) {
    return typeof n === 'number' ? n.toFixed(digits == null ? 1 : digits) : String(n);
  }

  function ageSec(ts) {
    return ts == null ? '—' : ((Date.now() - ts) / 1000).toFixed(1) + 'с назад';
  }

  // ---- map widget: user-facing, toggled open/closed — device marker
  // (rotated arrow) + accuracy circle + photo pins. Independent of the
  // debug panel below (that one's readouts, this one's a real feature).
  var mapWidget = null;
  var mapDeviceMarker = null;
  var mapAccuracyCircle = null;
  var mapInited = false;

  function deviceArrowIcon(heading) {
    var deg = heading == null ? 0 : heading;
    return L.divIcon({
      className: '',
      html: '<div class="ar-device-pin" style="transform:rotate(' + deg + 'deg)"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }

  function initMapWidget() {
    if (mapInited || !mapEl || !window.L) return;
    mapInited = true;
    mapWidget = L.map(mapEl, { attributionControl: false, zoomControl: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapWidget);
    var bounds = AR_DATA.photos.map(function(p) { return [p.lat, p.lng]; });
    AR_DATA.photos.forEach(function(p) {
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: '', html: '<div class="mm-pin"></div>', iconSize: [12, 12], iconAnchor: [6, 6] }),
      }).addTo(mapWidget).bindTooltip(p.id.slice(0, 6));
    });
    mapWidget.setView(bounds.length ? bounds[0] : [0, 0], bounds.length ? 17 : 2);
  }

  function updateMapWidget() {
    if (!mapWidget || state.lat == null) return;
    var pos = [state.lat, state.lng];
    if (!mapDeviceMarker) {
      mapDeviceMarker = L.marker(pos, { icon: deviceArrowIcon(state.heading) }).addTo(mapWidget);
      var bounds = AR_DATA.photos.map(function(p) { return [p.lat, p.lng]; }).concat([pos]);
      mapWidget.fitBounds(bounds, { padding: [30, 30], maxZoom: 18 });
    } else {
      mapDeviceMarker.setLatLng(pos);
      mapDeviceMarker.setIcon(deviceArrowIcon(state.heading));
    }
    if (debug.geo.accuracy != null) {
      if (!mapAccuracyCircle) {
        mapAccuracyCircle = L.circle(pos, { radius: debug.geo.accuracy, color: '#4af', weight: 1, fillOpacity: 0.1 }).addTo(mapWidget);
      } else {
        mapAccuracyCircle.setLatLng(pos).setRadius(debug.geo.accuracy);
      }
    }
  }

  if (mapToggleEl && mapWidgetEl) {
    mapToggleEl.addEventListener('click', function() {
      var open = mapWidgetEl.classList.toggle('open');
      if (open) {
        initMapWidget();
        setTimeout(function() { if (mapWidget) mapWidget.invalidateSize(); }, 0);
      }
    });
  }

  function renderDebugPanel() {
    if (!debugSummaryEl || !debugTextEl) return;
    debugSummaryEl.textContent = '🐛 cam:' + debug.camera.status + ' geo:' + debug.geo.status +
      ' heading:' + fmt(state.heading) + '° (тап — свернуть/развернуть)';
    updateMapWidget();
    var lines = [];
    lines.push('Камера: ' + debug.camera.status);
    lines.push('Геолокация: ' + debug.geo.status +
      (debug.geo.accuracy != null ? ' (±' + fmt(debug.geo.accuracy, 0) + 'м)' : '') +
      ' · ' + ageSec(debug.geo.lastFixAt) +
      (debug.geo.reportedHeading != null ? ' · coords.heading=' + fmt(debug.geo.reportedHeading) + '°' : ''));
    lines.push('lat/lng: ' + (state.lat != null ? fmt(state.lat, 6) + ', ' + fmt(state.lng, 6) : '—'));
    lines.push('Ориентация: ' + debug.orientation.status + ' · ' + ageSec(debug.orientation.lastEventAt));
    lines.push('  Sensor API: ' + (debug.orientation.sensorApiStatus || '—'));
    lines.push('  источник=' + debug.orientation.source + ' absolute=' + debug.orientation.absolute +
      ' alpha=' + fmt(debug.orientation.alpha) + ' beta=' + fmt(debug.orientation.beta) + ' gamma=' + fmt(debug.orientation.gamma) +
      ' webkitCompass=' + fmt(debug.orientation.webkitCompassHeading));
    if (debug.orientation.quaternion) {
      lines.push('  quaternion=[' + debug.orientation.quaternion.map(function(n) { return fmt(n, 3); }).join(', ') + ']');
    }
    lines.push('heading сырой: ' + fmt(debug.orientation.rawHeading) + '° · сглаженный (используется): ' + fmt(state.heading) + '°');
    lines.push('Настройки: появление=' + AR_DATA.settings.minVisibleDistance + 'м, 100%=' + AR_DATA.settings.fullSizeDistance + 'м, FOV=±' + HALF_FOV_DEG + '°');
    lines.push('Фото (' + AR_DATA.photos.length + '):');
    if (!debug.photos.length) {
      lines.push('  (ждём координаты/heading)');
    } else {
      debug.photos.forEach(function(p) {
        lines.push('  ' + p.id.slice(0, 6) + ': ' + fmt(p.distance, 0) + 'м, азимут=' + fmt(p.bearing, 0) +
          '°, Δ=' + fmt(p.angleDiff, 0) + '° ' + (p.visible ? 'видно scale=' + fmt(p.scale, 2) : 'скрыто'));
      });
    }
    debugTextEl.textContent = lines.join('\n');
  }
  setInterval(renderDebugPanel, 300);
  if (debugSummaryEl && debugEl) {
    debugSummaryEl.addEventListener('click', function() {
      debugEl.classList.toggle('expanded');
    });
  }

  startBtn.addEventListener('click', function() {
    try {
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
          showError('Не удалось получить доступ: ' + (err && err.message) + '. Разрешите камеру, геолокацию и датчики ориентации в настройках браузера.');
        });
    } catch (err) {
      // Catches synchronous throws (e.g. navigator.mediaDevices missing) that
      // would otherwise escape uncaught and leave the button dead with no
      // visible feedback.
      startBtn.disabled = false;
      showError('Ошибка запуска AR: ' + (err && err.message));
    }
  });
})();
