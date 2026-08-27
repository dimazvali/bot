(function() {
  'use strict';
  var G = window.QRMapGraph;
  var canvas = document.getElementById('qrMapCanvas');
  var ctx = canvas.getContext('2d');

  var INK = '#4a3520';
  var DRAW_BATCH = 6;       // segments revealed per animation frame
  var FRAME_DELAY_MS = 16;

  var drawTimer = null;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawSegment(s) {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function animateSegments(segments) {
    if (drawTimer) {
      clearTimeout(drawTimer);
      drawTimer = null;
    }
    var i = 0;
    function step() {
      var end = Math.min(i + DRAW_BATCH, segments.length);
      for (; i < end; i++) drawSegment(segments[i]);
      if (i < segments.length) {
        drawTimer = setTimeout(step, FRAME_DELAY_MS);
      }
    }
    step();
  }

  function generateAt(x, y) {
    clear();
    var segments = G.generateStreetGraph(x, y, {
      seed: Math.floor(Math.random() * 2147483647),
      maxRadius: Math.min(canvas.width, canvas.height) * 0.6,
    });
    animateSegments(segments);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  canvas.addEventListener('click', function(e) {
    generateAt(e.clientX, e.clientY);
  });
})();
