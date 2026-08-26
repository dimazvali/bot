(function() {
  'use strict';
  var ENTRY = window.QR_ENTRY;

  var fallbackPhoto = document.getElementById('qrFallbackPhoto');
  var arBtn = document.getElementById('qrArBtn');
  var video = document.getElementById('qrVideo');
  var canvas = document.getElementById('qrScanCanvas');
  var hint = document.getElementById('qrHint');
  var portal = document.getElementById('qrPortal');
  var rescanBtn = document.getElementById('qrRescanBtn');
  var portalPhoto = document.getElementById('qrPortalPhoto');
  var liveEl = document.getElementById('qrDebugLive');
  var T = window.QRPortalTransform;

  var DEBUG = !!window.QR_DEBUG;
  function log(msg) { if (window.qrDebugLog) window.qrDebugLog(msg); }

  var PORTAL_SHAPES = {
    '3:2': { w: 270, h: 180, circle: false },
    '2:3': { w: 180, h: 270, circle: false },
    square: { w: 220, h: 220, circle: false },
    circle: { w: 220, h: 220, circle: true },
  };
  var shape = PORTAL_SHAPES[ENTRY.portalShape] || PORTAL_SHAPES.square;
  if (shape.circle) portal.classList.add('qr-portal--circle');

  var SCAN_INTERVAL_MS = 100;
  var SEARCH_HINT_TIMEOUT_MS = 15000;
  var LOST_TIMEOUT_MS = 1200; // how long to hold the portal in place after losing the QR
  var QUAD_SMOOTHING = 0.35;  // per-point EMA factor for the tracked QR corners
  var PORTAL_W = shape.w;
  var PORTAL_H = shape.h;
  var PORTAL_SCALE = 2.6;
  // skew is a normalized ratio (roughly -1..1 for extreme angles), so this
  // is "px of photo shift per unit of skew ratio" — bigger fakes more depth.
  // Horizontal is negative: viewing the marker from the right should reveal
  // what's on the photo's left (the image shifts opposite to where you moved).
  var PHOTO_SKEW_SENS_X = -220;
  var PHOTO_SKEW_SENS_Y = 220;

  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  var scanning = false;
  var lastScanAt = 0;
  var searchStartAt = 0;
  var lastSeenAt = 0;
  var smoothedQuad = null;
  var anchorSkew = null;
  var hasLoggedFirstTrack = false;

  var NATIVE_RECT = [
    { x: 0, y: 0 },
    { x: PORTAL_W, y: 0 },
    { x: PORTAL_W, y: PORTAL_H },
    { x: 0, y: PORTAL_H },
  ];

  function supportsAR() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof window.jsQR === 'function');
  }

  function isExpectedQr(text) {
    return typeof text === 'string' && text.indexOf(ENTRY.slug) !== -1;
  }

  async function startAR() {
    log('AR button clicked');
    arBtn.disabled = true;
    var stream;
    try {
      log('requesting camera...');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      log('camera granted, tracks=' + stream.getTracks().length);
    } catch (e) {
      log('camera FAILED: ' + e.name + ' ' + e.message);
      arBtn.disabled = false;
      arBtn.textContent = 'Нет доступа к камере — повторить';
      return;
    }
    video.srcObject = stream;
    try {
      await video.play();
      log('video playing, ' + video.videoWidth + 'x' + video.videoHeight);
    } catch (e) {
      log('video.play() FAILED: ' + e.name + ' ' + e.message);
    }
    arBtn.style.display = 'none';
    fallbackPhoto.style.display = 'none';
    video.style.display = 'block';
    hint.style.display = 'block';
    hint.textContent = 'Наведите камеру на QR-код на табличке';
    scanning = true;
    searchStartAt = performance.now();
    requestAnimationFrame(scanTick);
  }

  function scanTick(ts) {
    if (!scanning) return;

    if (!smoothedQuad && ts - searchStartAt > SEARCH_HINT_TIMEOUT_MS) {
      hint.textContent = 'Не получается найти QR — поднесите телефон ближе или добавьте света';
    }
    if (smoothedQuad && ts - lastSeenAt > LOST_TIMEOUT_MS) {
      log('QR lost');
      resetTracking();
      hint.style.display = 'block';
      hint.textContent = 'QR потерян — наведите камеру снова';
    }

    if (ts - lastScanAt >= SCAN_INTERVAL_MS && video.videoWidth) {
      lastScanAt = ts;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      var frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var result = window.jsQR(frame.data, frame.width, frame.height);
      if (result && isExpectedQr(result.data)) {
        onTracked(result.location, canvas.width, canvas.height, ts);
      }
    }
    requestAnimationFrame(scanTick);
  }

  function onTracked(location, frameW, frameH, ts) {
    if (!hasLoggedFirstTrack) {
      hasLoggedFirstTrack = true;
      log('QR first tracked');
    }
    lastSeenAt = ts;
    hint.style.display = 'none';

    var rawCorners = [
      location.topLeftCorner,
      location.topRightCorner,
      location.bottomRightCorner,
      location.bottomLeftCorner,
    ];
    var displayCorners = rawCorners.map(function(pt) {
      return T.mapCoverPoint(pt, frameW, frameH, video.clientWidth, video.clientHeight);
    });

    if (!smoothedQuad) {
      smoothedQuad = displayCorners;
    } else {
      smoothedQuad = smoothedQuad.map(function(p, i) {
        return T.lerpPoint(p, displayCorners[i], QUAD_SMOOTHING);
      });
    }

    var skew = T.computeQuadSkew(smoothedQuad);
    if (!anchorSkew) anchorSkew = skew;

    var portalQuad = T.scaleQuadAroundCenter(smoothedQuad, PORTAL_SCALE);
    portal.style.width = PORTAL_W + 'px';
    portal.style.height = PORTAL_H + 'px';
    portal.style.transform = T.computePortalTransform(NATIVE_RECT, portalQuad);
    portal.style.display = 'block';
    rescanBtn.style.display = 'block';

    var dHoriz = skew.horiz - anchorSkew.horiz;
    var dVert = skew.vert - anchorSkew.vert;
    var photoOffsetX = dHoriz * PHOTO_SKEW_SENS_X;
    var photoOffsetY = dVert * PHOTO_SKEW_SENS_Y;
    portalPhoto.style.transform = 'translate(' + photoOffsetX + 'px,' + photoOffsetY + 'px)';

    if (DEBUG && liveEl) {
      liveEl.style.display = 'block';
      liveEl.textContent =
        'skew: ' + skew.horiz.toFixed(3) + ', ' + skew.vert.toFixed(3) + '\n' +
        'anchor: ' + anchorSkew.horiz.toFixed(3) + ', ' + anchorSkew.vert.toFixed(3) + '\n' +
        'delta: ' + dHoriz.toFixed(3) + ', ' + dVert.toFixed(3) + '\n' +
        'photo offset px: ' + photoOffsetX.toFixed(1) + ', ' + photoOffsetY.toFixed(1);
    }
  }

  function resetTracking() {
    smoothedQuad = null;
    anchorSkew = null;
    hasLoggedFirstTrack = false;
    portal.style.display = 'none';
    rescanBtn.style.display = 'none';
  }

  function rescan() {
    log('rescan clicked');
    resetTracking();
    hint.style.display = 'block';
    hint.textContent = 'Наведите камеру на QR-код на табличке';
    searchStartAt = performance.now();
  }

  log('ar.js loaded, supportsAR=' + supportsAR());
  if (supportsAR()) {
    arBtn.addEventListener('click', startAR);
    rescanBtn.addEventListener('click', rescan);
  } else {
    arBtn.style.display = 'none';
  }
})();
