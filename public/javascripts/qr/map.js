(function() {
  'use strict';
  var G = window.QRMapGraph;
  var canvas = document.getElementById('qrMapCanvas');
  var ctx = canvas.getContext('2d');

  var INK = '#4a3520';
  var FRAME_DELAY_MS = 16;
  var TARGET_DRAW_FRAMES = 90; // ~1.5s regardless of how many segments there are

  var drawTimer = null;

  // Distance from (x, y) to the farthest viewport corner — the map needs
  // to reach every corner of the screen, not just a fixed-size patch
  // around wherever was clicked.
  function farthestCornerDistance(x, y) {
    var corners = [
      { x: 0, y: 0 }, { x: canvas.width, y: 0 },
      { x: 0, y: canvas.height }, { x: canvas.width, y: canvas.height },
    ];
    return corners.reduce(function(max, c) {
      return Math.max(max, Math.sqrt((c.x - x) * (c.x - x) + (c.y - y) * (c.y - y)));
    }, 0);
  }

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
    var batchSize = Math.max(6, Math.ceil(segments.length / TARGET_DRAW_FRAMES));
    var i = 0;
    function step() {
      var end = Math.min(i + batchSize, segments.length);
      for (; i < end; i++) drawSegment(segments[i]);
      if (i < segments.length) {
        drawTimer = setTimeout(step, FRAME_DELAY_MS);
      }
    }
    step();
  }

  function generateAt(x, y) {
    clear();
    var maxRadius = farthestCornerDistance(x, y);
    var segments = G.generateStreetGraph(x, y, {
      seed: Math.floor(Math.random() * 2147483647),
      maxRadius: maxRadius,
      branchCount: Math.max(14, Math.round(maxRadius / 55)),
      maxSegments: 2600,
    });
    animateSegments(segments);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  canvas.addEventListener('click', function(e) {
    generateAt(e.clientX, e.clientY);
  });
})();
