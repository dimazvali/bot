// Splits the Dzalisa mosaic photo into individual tesserae for /lab/mosaic/.
// Compact watershed on the colour gradient: seeds on a jittered grid ~one per stone, flooded
// by gradient so borders settle on the grout lines between stones.
//
//   node scripts/lab-mosaic/build.js [spacing=4.2] [--debug]
//
// Writes public/lab/mosaic/tesserae.bin (Uint16 label per pixel, little-endian) and
// public/lab/mosaic/tesserae.json ({ w, h, count, sections: [[ids...], ...] }).
// --debug also writes an upscaled boundary overlay to the scratch path given by MOSAIC_DEBUG.
'use strict';
var path = require('path');
var fs = require('fs');
var sharp = require('sharp');

var SRC = path.join(__dirname, '../../public/lab/mosaic/mosaic.png');
var OUT = path.join(__dirname, '../../public/lab/mosaic');
var S = parseFloat(process.argv[2]) || 4.2;     // seed spacing ≈ stone size, px
var COMPACT = 6;                                 // pull of the seed vs. the gradient
var MIN_AREA = 5;                                // smaller blobs merge into a neighbour
var SECTION_STONES = 45;                         // target stones per section

function heap() {
  var pr = [], it = [];
  return {
    size: function () { return pr.length; },
    push: function (p, v) {
      var i = pr.length; pr.push(p); it.push(v);
      while (i > 0) {
        var j = (i - 1) >> 1;
        if (pr[j] <= pr[i]) break;
        var t = pr[i]; pr[i] = pr[j]; pr[j] = t; t = it[i]; it[i] = it[j]; it[j] = t; i = j;
      }
    },
    pop: function () {
      var top = it[0], lp = pr.pop(), lv = it.pop();
      if (pr.length) {
        pr[0] = lp; it[0] = lv;
        var i = 0, n = pr.length;
        for (;;) {
          var l = 2 * i + 1, r = l + 1, m = i;
          if (l < n && pr[l] < pr[m]) m = l;
          if (r < n && pr[r] < pr[m]) m = r;
          if (m === i) break;
          var t = pr[i]; pr[i] = pr[m]; pr[m] = t; t = it[i]; it[i] = it[m]; it[m] = t; i = m;
        }
      }
      return top;
    }
  };
}

async function main() {
  var raw = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  var W = raw.info.width, H = raw.info.height, px = raw.data, N = W * H, i;

  // light blur against JPEG noise, then per-channel Sobel, max over channels
  var blur = new Float32Array(N * 3);
  for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) for (var c = 0; c < 3; c++) {
    var s = 0, wsum = 0;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var xx = Math.min(W - 1, Math.max(0, x + dx)), yy = Math.min(H - 1, Math.max(0, y + dy));
      var wgt = (dx ? 1 : 2) * (dy ? 1 : 2);
      s += px[(yy * W + xx) * 3 + c] * wgt; wsum += wgt;
    }
    blur[(y * W + x) * 3 + c] = s / wsum;
  }
  var grad = new Float32Array(N);
  function B(x, y, c) { x = Math.min(W - 1, Math.max(0, x)); y = Math.min(H - 1, Math.max(0, y)); return blur[(y * W + x) * 3 + c]; }
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    var g = 0;
    for (c = 0; c < 3; c++) {
      var gx = B(x + 1, y - 1, c) + 2 * B(x + 1, y, c) + B(x + 1, y + 1, c) - B(x - 1, y - 1, c) - 2 * B(x - 1, y, c) - B(x - 1, y + 1, c);
      var gy = B(x - 1, y + 1, c) + 2 * B(x, y + 1, c) + B(x + 1, y + 1, c) - B(x - 1, y - 1, c) - 2 * B(x, y - 1, c) - B(x + 1, y - 1, c);
      g = Math.max(g, Math.hypot(gx, gy));
    }
    grad[y * W + x] = g / 8;
  }

  // seeds: hex-ish grid, each nudged to the calmest pixel nearby (a stone's middle, not a seam)
  var seeds = [];
  var rows = Math.round(H / S), cols = Math.round(W / S);
  for (var r = 0; r < rows; r++) for (var q = 0; q < cols; q++) {
    var sx = Math.round((q + 0.5 + (r % 2 ? 0.25 : -0.25)) * W / cols), sy = Math.round((r + 0.5) * H / rows);
    sx = Math.min(W - 1, Math.max(0, sx));
    var best = sy * W + sx, bg = grad[best];
    for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
      var nx = sx + dx, ny = sy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (grad[ny * W + nx] < bg) { bg = grad[ny * W + nx]; best = ny * W + nx; }
    }
    seeds.push(best);
  }

  // compact watershed
  var lab = new Int32Array(N).fill(-1);
  var h = heap();
  seeds.forEach(function (p, i) { h.push(0, p * 65536 + i); });
  var sxArr = seeds.map(function (p) { return p % W; }), syArr = seeds.map(function (p) { return (p / W) | 0; });
  while (h.size()) {
    var v = h.pop(), p = Math.floor(v / 65536), l = v % 65536;
    if (lab[p] >= 0) continue;
    lab[p] = l;
    var x0 = p % W, y0 = (p / W) | 0;
    var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var k = 0; k < 4; k++) {
      var x1 = x0 + nb[k][0], y1 = y0 + nb[k][1];
      if (x1 < 0 || y1 < 0 || x1 >= W || y1 >= H) continue;
      var p1 = y1 * W + x1;
      if (lab[p1] >= 0) continue;
      var d = Math.hypot(x1 - sxArr[l], y1 - syArr[l]) / S;
      h.push(grad[p1] + COMPACT * d * d, p1 * 65536 + l);
    }
  }

  // relabel connected components; merge tiny ones into the neighbour sharing the longest border
  function components() {
    var comp = new Int32Array(N).fill(-1), n = 0, stack = [];
    for (var i = 0; i < N; i++) {
      if (comp[i] >= 0) continue;
      comp[i] = n; stack.push(i);
      while (stack.length) {
        var a = stack.pop(), ax = a % W, ay = (a / W) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
          var bx = ax + o[0], by = ay + o[1];
          if (bx < 0 || by < 0 || bx >= W || by >= H) return;
          var b = by * W + bx;
          if (comp[b] < 0 && lab[b] === lab[a]) { comp[b] = n; stack.push(b); }
        });
      }
      n++;
    }
    return { comp: comp, n: n };
  }
  for (var pass = 0; pass < 4; pass++) {
    var cc = components();
    lab = cc.comp;
    var area = new Int32Array(cc.n);
    for (i = 0; i < N; i++) area[lab[i]]++;
    var border = new Map();
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var a = lab[y * W + x];
      if (area[a] >= MIN_AREA) continue;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
        var bx = x + o[0], by = y + o[1];
        if (bx < 0 || by < 0 || bx >= W || by >= H) return;
        var b = lab[by * W + bx];
        if (b === a) return;
        var m = border.get(a) || new Map(); m.set(b, (m.get(b) || 0) + 1); border.set(a, m);
      });
    }
    if (!border.size) break;
    var target = new Int32Array(cc.n); for (i = 0; i < cc.n; i++) target[i] = i;
    border.forEach(function (m, a) {
      var bestB = -1, bestC = -1;
      m.forEach(function (cnt, b) { if (cnt > bestC) { bestC = cnt; bestB = b; } });
      target[a] = bestB;
    });
    for (i = 0; i < N; i++) lab[i] = target[lab[i]];
  }
  cc = components(); lab = cc.comp;
  var count = cc.n;

  // stone centroids → sections: nearest of ~count/SECTION_STONES seeds on a grid (Voronoi over stones)
  var cx = new Float64Array(count), cy = new Float64Array(count), ar = new Int32Array(count);
  for (i = 0; i < N; i++) { var t = lab[i]; cx[t] += i % W; cy[t] += (i / W) | 0; ar[t]++; }
  for (t = 0; t < count; t++) { cx[t] /= ar[t]; cy[t] /= ar[t]; }
  var nSec = Math.max(1, Math.round(count / SECTION_STONES));
  var sc = Math.max(1, Math.round(Math.sqrt(nSec * W / H))), sr = Math.max(1, Math.round(nSec / sc));
  var secSeeds = [];
  for (r = 0; r < sr; r++) for (q = 0; q < sc; q++) secSeeds.push([(q + 0.5) * W / sc, (r + 0.5) * H / sr]);
  // a few Lloyd steps over stone centroids, so sections are roundish and similar in size
  var secOf = new Int32Array(count);
  for (var it = 0; it < 8; it++) {
    var acc = secSeeds.map(function () { return [0, 0, 0]; });
    for (t = 0; t < count; t++) {
      var bi = 0, bd = Infinity;
      for (var si = 0; si < secSeeds.length; si++) {
        var dd = (cx[t] - secSeeds[si][0]) * (cx[t] - secSeeds[si][0]) + (cy[t] - secSeeds[si][1]) * (cy[t] - secSeeds[si][1]);
        if (dd < bd) { bd = dd; bi = si; }
      }
      secOf[t] = bi; acc[bi][0] += cx[t]; acc[bi][1] += cy[t]; acc[bi][2]++;
    }
    secSeeds = secSeeds.map(function (s, k) { return acc[k][2] ? [acc[k][0] / acc[k][2], acc[k][1] / acc[k][2]] : s; });
  }
  var sections = secSeeds.map(function () { return []; });
  for (t = 0; t < count; t++) sections[secOf[t]].push(t);
  // reading order: top-left first
  sections = sections.filter(function (s) { return s.length; }).map(function (s) {
    var mx = 0, my = 0; s.forEach(function (t) { mx += cx[t]; my += cy[t]; });
    return { ids: s, x: mx / s.length, y: my / s.length };
  }).sort(function (a, b) { return Math.round(a.y / (H / sr)) - Math.round(b.y / (H / sr)) || a.x - b.x; })
    .map(function (s) { return s.ids; });

  var buf = Buffer.alloc(N * 2);
  for (i = 0; i < N; i++) buf.writeUInt16LE(lab[i], i * 2);
  fs.writeFileSync(path.join(OUT, 'tesserae.bin'), buf);
  fs.writeFileSync(path.join(OUT, 'tesserae.json'), JSON.stringify({ w: W, h: H, count: count, sections: sections }));
  var sizes = sections.map(function (s) { return s.length; });
  console.log('stones:', count, 'mean area:', (N / count).toFixed(1), 'px; sections:', sections.length,
    '(' + Math.min.apply(null, sizes) + '–' + Math.max.apply(null, sizes) + ' stones)');

  if (process.argv.indexOf('--debug') >= 0 && process.env.MOSAIC_DEBUG) {
    var Z = 4, out = Buffer.alloc(W * Z * H * Z * 3);
    for (y = 0; y < H * Z; y++) for (x = 0; x < W * Z; x++) {
      var sx0 = (x / Z) | 0, sy0 = (y / Z) | 0, o = (y * W * Z + x) * 3, L0 = lab[sy0 * W + sx0];
      var edge = (x % Z === 0 && sx0 > 0 && lab[sy0 * W + sx0 - 1] !== L0) || (y % Z === 0 && sy0 > 0 && lab[(sy0 - 1) * W + sx0] !== L0);
      for (c = 0; c < 3; c++) out[o + c] = edge ? [255, 255, 0][c] : px[(sy0 * W + sx0) * 3 + c];
    }
    await sharp(out, { raw: { width: W * Z, height: H * Z, channels: 3 } }).png().toFile(process.env.MOSAIC_DEBUG);
    console.log('debug →', process.env.MOSAIC_DEBUG);
  }
}

main().catch(function (e) { console.error(e); process.exit(1); });
