(function() {
  'use strict';
  var G = window.QRMapGraph;
  var canvas = document.getElementById('qrMapCanvas');
  var ctx = canvas.getContext('2d');

  var INK = '#4a3520';
  var FRAME_DELAY_MS = 16;
  var TARGET_DRAW_FRAMES = 90; // ~1.5s regardless of how many segments there are
  var WIDTH_SCALE = 2.1; // px per width class (generator returns raw 1-4)

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
    ctx.lineWidth = s.width * WIDTH_SCALE;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Smooth curve through a list of points (Chaikin/quadratic-midpoint
  // trick: curve to the midpoint of each pair, using the point itself as
  // the control point) — used for both the river banks and the district
  // blobs so neither reads as a jagged polygon.
  function smoothPathPoints(points) {
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length - 1; i++) {
      var xc = (points[i].x + points[i + 1].x) / 2;
      var yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    var n = points.length;
    ctx.quadraticCurveTo(points[n - 2].x, points[n - 2].y, points[n - 1].x, points[n - 1].y);
  }

  function riverBankPoints(river) {
    var left = [], right = [];
    for (var i = 0; i < river.length; i++) {
      var prev = river[Math.max(0, i - 1)];
      var next = river[Math.min(river.length - 1, i + 1)];
      var tx = next.x - prev.x, ty = next.y - prev.y;
      var len = Math.sqrt(tx * tx + ty * ty) || 1;
      var nx = -ty / len, ny = tx / len; // unit perpendicular
      var hw = river[i].width / 2;
      left.push({ x: river[i].x + nx * hw, y: river[i].y + ny * hw });
      right.push({ x: river[i].x - nx * hw, y: river[i].y - ny * hw });
    }
    return { left: left, right: right };
  }

  function drawRiver(river) {
    if (!river || river.length < 2) return;
    var banks = riverBankPoints(river);
    var ring = banks.left.concat(banks.right.slice().reverse());
    ctx.save();
    ctx.beginPath();
    smoothPathPoints(ring);
    ctx.closePath();
    ctx.fillStyle = 'rgba(100,118,120,0.32)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,85,88,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawDistrict(d) {
    if (!d.points || d.points.length < 3) return;
    ctx.save();
    ctx.beginPath();
    // wrap the first couple of points onto the end so the smoothing curve
    // closes cleanly instead of leaving a seam
    smoothPathPoints(d.points.concat([d.points[0], d.points[1]]));
    ctx.closePath();
    ctx.fillStyle = 'rgba(150,158,120,0.16)';
    ctx.fill();
    ctx.restore();
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

  var STEP_LEN = 62; // must match map-graph.js's own default

  function generateAt(x, y) {
    clear();
    var seed = Math.floor(Math.random() * 2147483647);
    var maxRadius = farthestCornerDistance(x, y);

    // Terrain first (bottom layer): soft district blobs, then the river on
    // top of them, both drawn immediately — only the street reveal animates.
    var districts = G.generateDistricts(canvas.width, canvas.height, { seed: seed + 1, count: 5 });
    districts.forEach(drawDistrict);

    var river = G.generateRiverPath(x, y, canvas.width, canvas.height, { seed: seed + 2 });
    drawRiver(river);

    // Scale the segment budget to the grid's actual area (a circle of
    // radius maxRadius, in stepLen-sized cells) instead of a flat number —
    // a fixed high budget massively oversaturates a small grid (every node
    // crossed by several unrelated streets), which reads as clutter rather
    // than legible blocks.
    var gridCells = Math.PI * Math.pow(maxRadius / STEP_LEN, 2);
    var maxSegments = Math.round(gridCells * 1.3);
    var segments = G.generateStreetGraph(x, y, {
      seed: seed,
      maxRadius: maxRadius,
      maxSegments: maxSegments,
    });
    segments = G.clipStreetsToRiver(segments, river);
    animateSegments(segments);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  canvas.addEventListener('click', function(e) {
    generateAt(e.clientX, e.clientY);
  });
})();
