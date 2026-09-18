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

  startBtn.addEventListener('click', function() {
    startBtn.disabled = true;
    errorEl.hidden = true;
    startCamera()
      .then(startOrientation)
      .then(startGeolocation)
      .then(function() {
        gate.hidden = true;
        stage.hidden = false;
      })
      .catch(function(err) {
        startBtn.disabled = false;
        showError('Не удалось получить доступ: ' + err.message + '. Разрешите камеру, геолокацию и датчики ориентации в настройках браузера.');
      });
  });
})();
