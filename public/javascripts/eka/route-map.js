(function () {
  var canvas = document.getElementById('route-map');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var D = canvas.dataset;

  var sLat = +D.startLat, sLng = +D.startLng;
  var fLat = +D.finishLat, fLng = +D.finishLng;
  var sName = D.startName || 'A';
  var fName = D.finishName || 'B';

  /* ── Google encoded polyline decoder ── */
  var routePts = null;
  if (D.polyline) {
    var pts = [], idx = 0, lat = 0, lng = 0;
    while (idx < D.polyline.length) {
      var b, shift = 0, result = 0;
      do { b = D.polyline.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);
      shift = 0; result = 0;
      do { b = D.polyline.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : (result >> 1);
      pts.push([lat / 1e5, lng / 1e5]);
    }
    if (pts.length > 1) routePts = pts;
  }

  /* ── path helpers ── */
  function pathLengths(pts) {
    var L = [0];
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i][0] - pts[i-1][0], dy = pts[i][1] - pts[i-1][1];
      L.push(L[i-1] + Math.sqrt(dx*dx + dy*dy));
    }
    return L;
  }

  function posAt(pts, L, t) {
    var target = t * L[L.length - 1];
    for (var i = 1; i < pts.length; i++) {
      if (L[i] >= target) {
        var s = L[i] - L[i-1], u = s > 0 ? (target - L[i-1]) / s : 0;
        return [pts[i-1][0] + u * (pts[i][0] - pts[i-1][0]), pts[i-1][1] + u * (pts[i][1] - pts[i-1][1])];
      }
    }
    return pts[pts.length - 1];
  }

  function strokeTo(pts, L, t) {
    var target = t * L[L.length - 1];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) {
      if (L[i] <= target) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      } else {
        var s = L[i] - L[i-1], u = s > 0 ? (target - L[i-1]) / s : 0;
        ctx.lineTo(pts[i-1][0] + u * (pts[i][0] - pts[i-1][0]), pts[i-1][1] + u * (pts[i][1] - pts[i-1][1]));
        break;
      }
    }
    ctx.stroke();
  }

  function qbez(t, A, cx, cy, B) {
    return [
      (1-t)*(1-t)*A[0] + 2*(1-t)*t*cx + t*t*B[0],
      (1-t)*(1-t)*A[1] + 2*(1-t)*t*cy + t*t*B[1]
    ];
  }

  /* ── projection & setup ── */
  var state = {};

  function project(lat, lng) {
    var b = state.bounds;
    return [
      (lng - b.lngMin) / (b.lngMax - b.lngMin) * state.W,
      state.H - (lat - b.latMin) / (b.latMax - b.latMin) * state.H
    ];
  }

  function setup() {
    state.W = canvas.parentElement.offsetWidth;
    state.H = canvas.parentElement.offsetHeight;
    canvas.width = state.W;
    canvas.height = state.H;

    var srcPts = routePts || [[sLat, sLng], [fLat, fLng]];
    var lats = srcPts.map(function(p) { return p[0]; });
    var lngs = srcPts.map(function(p) { return p[1]; });
    var PAD = 0.3;
    var lr = Math.max(Math.max.apply(null, lats) - Math.min.apply(null, lats), 0.25);
    var lgr = Math.max(Math.max.apply(null, lngs) - Math.min.apply(null, lngs), 0.25);
    state.bounds = {
      latMin: Math.min.apply(null, lats) - lr * PAD,
      latMax: Math.max.apply(null, lats) + lr * PAD,
      lngMin: Math.min.apply(null, lngs) - lgr * PAD,
      lngMax: Math.max.apply(null, lngs) + lgr * PAD
    };

    state.A = project(sLat, sLng);
    state.B = project(fLat, fLng);

    if (routePts) {
      state.canvasPts = routePts.map(function(p) { return project(p[0], p[1]); });
      state.canvasL = pathLengths(state.canvasPts);
    } else {
      state.canvasPts = null;
      state.cx = (state.A[0] + state.B[0]) / 2;
      state.cy = (state.A[1] + state.B[1]) / 2 - state.H * 0.3;
    }
  }

  /* ── draw ── */
  function draw(t) {
    var W = state.W, H = state.H, A = state.A, B = state.B;

    ctx.clearRect(0, 0, W, H);

    /* full dashed path */
    ctx.save();
    ctx.setLineDash([4, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (state.canvasPts) {
      ctx.moveTo(state.canvasPts[0][0], state.canvasPts[0][1]);
      for (var i = 1; i < state.canvasPts.length; i++) {
        ctx.lineTo(state.canvasPts[i][0], state.canvasPts[i][1]);
      }
    } else {
      ctx.moveTo(A[0], A[1]);
      ctx.quadraticCurveTo(state.cx, state.cy, B[0], B[1]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    /* traveled path */
    if (t > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      if (state.canvasPts) {
        strokeTo(state.canvasPts, state.canvasL, t);
      } else {
        ctx.beginPath();
        var p0 = qbez(0, A, state.cx, state.cy, B);
        ctx.moveTo(p0[0], p0[1]);
        var steps = Math.ceil(t * 60) + 1;
        for (var s = 1; s <= steps; s++) {
          var p = qbez(s / steps * t, A, state.cx, state.cy, B);
          ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
      }
    }

    /* endpoint dots */
    function endDot(x, y, alpha) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (alpha * 0.45) + ')';
      ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
    }
    endDot(A[0], A[1], 1);
    endDot(B[0], B[1], t >= 1 ? 1 : 0.35);

    /* moving dot */
    if (t > 0 && t < 1) {
      var pos = state.canvasPts
        ? posAt(state.canvasPts, state.canvasL, t)
        : qbez(t, A, state.cx, state.cy, B);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(pos[0], pos[1], 3, 0, Math.PI * 2); ctx.fill();
    }

    /* labels */
    function drawLabel(x, y, name, lat, lng, alpha) {
      var side = x < W / 2 ? 'right' : 'left';
      var lx = side === 'right' ? x + 14 : x - 14;
      ctx.globalAlpha = alpha;
      ctx.textBaseline = 'middle';
      ctx.textAlign = side === 'right' ? 'left' : 'right';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = '10px Georgia, serif';
      ctx.fillText(name.toUpperCase(), lx, y - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '9px Georgia, serif';
      ctx.fillText(lat.toFixed(3) + '° ' + lng.toFixed(3) + '°', lx, y + 5);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    drawLabel(A[0], A[1], sName, sLat, sLng, 1);
    drawLabel(B[0], B[1], fName, fLat, fLng, t >= 1 ? 1 : 0.35);
  }

  /* ── animation loop ── */
  var t = 0, pause = 0;
  setup();
  draw(0);

  function tick() {
    if (pause > 0) {
      pause--;
    } else if (t < 1) {
      t = Math.min(t + 1 / 160, 1);
      if (t >= 1) pause = 90;
    } else {
      t = 0;
    }
    draw(t);
    requestAnimationFrame(tick);
  }
  tick();

  window.addEventListener('resize', function () { setup(); draw(t); });
})();
