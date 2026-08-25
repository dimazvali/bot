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
  var T = window.QRPortalTransform;

  var SCAN_INTERVAL_MS = 100;
  var SCAN_HINT_TIMEOUT_MS = 15000;
  var PORTAL_W = 260;
  var PORTAL_H = 200;
  var PORTAL_SCALE = 2.6;
  var PORTAL_SENS = -5;    // px per degree — keeps the frame world-anchored
  var PHOTO_SENS = -22;    // px per degree — bigger magnitude fakes extra depth behind the frame

  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  var scanning = false;
  var lastScanAt = 0;
  var scanStartAt = 0;
  var anchorQuad = null;
  var anchorOrientation = null;
  var pendingOrientation = null;
  var rafScheduled = false;

  function supportsAR() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof window.jsQR === 'function');
  }

  function isExpectedQr(text) {
    return typeof text === 'string' && text.indexOf(ENTRY.slug) !== -1;
  }

  async function requestOrientationPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        var state = await DeviceOrientationEvent.requestPermission();
        return state === 'granted';
      } catch (e) {
        return false;
      }
    }
    return typeof DeviceOrientationEvent !== 'undefined';
  }

  async function startAR() {
    arBtn.disabled = true;
    await requestOrientationPermission();
    var stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch (e) {
      arBtn.disabled = false;
      arBtn.textContent = 'Нет доступа к камере — повторить';
      return;
    }
    video.srcObject = stream;
    await video.play();
    arBtn.style.display = 'none';
    fallbackPhoto.style.display = 'none';
    video.style.display = 'block';
    hint.style.display = 'block';
    hint.textContent = 'Наведите камеру на QR-код на табличке';
    scanning = true;
    scanStartAt = performance.now();
    requestAnimationFrame(scanTick);
  }

  function scanTick(ts) {
    if (!scanning) return;
    if (ts - scanStartAt > SCAN_HINT_TIMEOUT_MS) {
      hint.textContent = 'Не получается найти QR — поднесите телефон ближе или добавьте света';
    }
    if (ts - lastScanAt >= SCAN_INTERVAL_MS && video.videoWidth) {
      lastScanAt = ts;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      var frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var result = window.jsQR(frame.data, frame.width, frame.height);
      if (result && isExpectedQr(result.data)) {
        onAnchor(result.location, canvas.width, canvas.height);
        return;
      }
    }
    requestAnimationFrame(scanTick);
  }

  function onAnchor(location, frameW, frameH) {
    scanning = false;
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
    anchorQuad = T.scaleQuadAroundCenter(displayCorners, PORTAL_SCALE);
    anchorOrientation = pendingOrientation || { alpha: 0, beta: 0, gamma: 0 };
    window.addEventListener('deviceorientation', onOrientation);

    var nativeRect = [
      { x: 0, y: 0 },
      { x: PORTAL_W, y: 0 },
      { x: PORTAL_W, y: PORTAL_H },
      { x: 0, y: PORTAL_H },
    ];
    portal.style.width = PORTAL_W + 'px';
    portal.style.height = PORTAL_H + 'px';
    portal.style.transform = T.computePortalTransform(nativeRect, anchorQuad);
    portal.style.display = 'block';
    rescanBtn.style.display = 'block';
  }

  function onOrientation(e) {
    if (e.alpha === null) return;
    pendingOrientation = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
    if (!anchorQuad || rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(applyOrientation);
  }

  function applyOrientation() {
    rafScheduled = false;
    if (!anchorQuad || !anchorOrientation || !pendingOrientation) return;
    var dGamma = T.normalizeAngleDelta(pendingOrientation.gamma - anchorOrientation.gamma);
    var dBeta = T.normalizeAngleDelta(pendingOrientation.beta - anchorOrientation.beta);

    var nativeRect = [
      { x: 0, y: 0 },
      { x: PORTAL_W, y: 0 },
      { x: PORTAL_W, y: PORTAL_H },
      { x: 0, y: PORTAL_H },
    ];
    var portalDst = anchorQuad.map(function(p) {
      return { x: p.x + dGamma * PORTAL_SENS, y: p.y + dBeta * PORTAL_SENS };
    });
    portal.style.transform = T.computePortalTransform(nativeRect, portalDst);
    portalPhoto.style.transform = 'translate(' + (dGamma * PHOTO_SENS) + 'px,' + (dBeta * PHOTO_SENS) + 'px)';
  }

  function rescan() {
    anchorQuad = null;
    anchorOrientation = null;
    window.removeEventListener('deviceorientation', onOrientation);
    portal.style.display = 'none';
    rescanBtn.style.display = 'none';
    hint.style.display = 'block';
    hint.textContent = 'Наведите камеру на QR-код на табличке';
    scanning = true;
    scanStartAt = performance.now();
    requestAnimationFrame(scanTick);
  }

  if (supportsAR()) {
    arBtn.addEventListener('click', startAR);
    rescanBtn.addEventListener('click', rescan);
  } else {
    arBtn.style.display = 'none';
  }
})();
