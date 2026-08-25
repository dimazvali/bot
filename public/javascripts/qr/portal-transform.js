'use strict';

function solveLinearSystem(A, b) {
  var n = b.length;
  var M = A.map(function(row, i) { return row.concat([b[i]]); });
  for (var col = 0; col < n; col++) {
    var pivot = col;
    for (var r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    var tmp = M[col]; M[col] = M[pivot]; M[pivot] = tmp;
    var pivotVal = M[col][col];
    if (Math.abs(pivotVal) < 1e-12) throw new Error('Singular matrix — degenerate point configuration');
    for (var c = col; c <= n; c++) M[col][c] /= pivotVal;
    for (var r2 = 0; r2 < n; r2++) {
      if (r2 === col) continue;
      var factor = M[r2][col];
      for (var c2 = col; c2 <= n; c2++) M[r2][c2] -= factor * M[col][c2];
    }
  }
  return M.map(function(row) { return row[n]; });
}

function computeHomographyCoeffs(src, dst) {
  if (src.length !== 4 || dst.length !== 4) throw new Error('Need exactly 4 point pairs');
  var A = [];
  var b = [];
  for (var i = 0; i < 4; i++) {
    var sx = src[i].x, sy = src[i].y, dx = dst[i].x, dy = dst[i].y;
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }
  var sol = solveLinearSystem(A, b);
  return { a: sol[0], b: sol[1], c: sol[2], d: sol[3], e: sol[4], f: sol[5], g: sol[6], h: sol[7] };
}

function matrix3dFromCoeffs(coeffs) {
  var values = [
    coeffs.a, coeffs.d, 0, coeffs.g,
    coeffs.b, coeffs.e, 0, coeffs.h,
    0, 0, 1, 0,
    coeffs.c, coeffs.f, 0, 1,
  ];
  return 'matrix3d(' + values.join(',') + ')';
}

function computePortalTransform(src, dst) {
  return matrix3dFromCoeffs(computeHomographyCoeffs(src, dst));
}

function mapCoverPoint(point, sourceW, sourceH, boxW, boxH) {
  var sourceAspect = sourceW / sourceH;
  var boxAspect = boxW / boxH;
  var scale, offsetX, offsetY;
  if (sourceAspect > boxAspect) {
    scale = boxH / sourceH;
    offsetX = (sourceW * scale - boxW) / 2;
    offsetY = 0;
  } else {
    scale = boxW / sourceW;
    offsetX = 0;
    offsetY = (sourceH * scale - boxH) / 2;
  }
  return { x: point.x * scale - offsetX, y: point.y * scale - offsetY };
}

function scaleQuadAroundCenter(points, scale) {
  var cx = points.reduce(function(s, p) { return s + p.x; }, 0) / points.length;
  var cy = points.reduce(function(s, p) { return s + p.y; }, 0) / points.length;
  return points.map(function(p) {
    return { x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale };
  });
}

function lerp(a, b, t) {
  return a + t * (b - a);
}

function lerpPoint(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

// Measures how far a tracked quad deviates from a perfect axis-aligned
// rectangle — i.e. how much perspective skew the camera currently sees.
// Zero for a fronto-parallel view; grows as the viewing angle increases.
// Computed directly from the live-tracked marker, so it needs no separate
// sensor (no gyroscope) and is inherently in sync with what's on screen.
// Normalized by the quad's own size so the result stays meaningful
// regardless of how close/far (i.e. how large on screen) the marker is —
// a raw pixel skew would be tiny for a small/distant marker even at a
// sharp viewing angle.
function computeQuadSkew(quad) {
  var tl = quad[0], tr = quad[1], br = quad[2], bl = quad[3];
  var width = ((tr.x - tl.x) + (br.x - bl.x)) / 2;
  var height = ((bl.y - tl.y) + (br.y - tr.y)) / 2;
  var horiz = (tr.y - tl.y) - (br.y - bl.y);
  var vert = (bl.x - tl.x) - (br.x - tr.x);
  return {
    horiz: height ? horiz / height : 0,
    vert: width ? vert / width : 0,
  };
}

var api = {
  computeHomographyCoeffs: computeHomographyCoeffs,
  matrix3dFromCoeffs: matrix3dFromCoeffs,
  computePortalTransform: computePortalTransform,
  mapCoverPoint: mapCoverPoint,
  scaleQuadAroundCenter: scaleQuadAroundCenter,
  lerp: lerp,
  lerpPoint: lerpPoint,
  computeQuadSkew: computeQuadSkew,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.QRPortalTransform = api;
}
