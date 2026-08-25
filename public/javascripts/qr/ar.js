(function() {
  'use strict';
  var ENTRY = window.QR_ENTRY;

  var fallbackPhoto = document.getElementById('qrFallbackPhoto');
  var arBtn = document.getElementById('qrArBtn');
  var video = document.getElementById('qrVideo');
  var canvas = document.getElementById('qrScanCanvas');
  var hint = document.getElementById('qrHint');

  var SCAN_INTERVAL_MS = 100;
  var SCAN_HINT_TIMEOUT_MS = 15000;
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  var scanning = false;
  var lastScanAt = 0;
  var scanStartAt = 0;

  function supportsAR() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof window.jsQR === 'function');
  }

  function isExpectedQr(text) {
    return typeof text === 'string' && text.indexOf(ENTRY.slug) !== -1;
  }

  async function startAR() {
    arBtn.disabled = true;
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
        console.log('[qr-ar] anchor QR found', result.location);
        scanning = false;
        hint.style.display = 'none';
        return;
      }
    }
    requestAnimationFrame(scanTick);
  }

  if (supportsAR()) {
    arBtn.addEventListener('click', startAR);
  } else {
    arBtn.style.display = 'none';
  }
})();
