// Dionysus & Ariadne — restore the Dzalisa mosaic one tessera at a time.
// The photo is pre-split into stones (scripts/lab-mosaic/build.js → tesserae.bin/json) and the stones
// into ~45-stone sections. Overview: the whole floor, unrestored sections pale. Pick a section,
// it zooms in, its stones lie around it, each one goes back into its own socket.
(function () {
  'use strict';

  var PAD = 6;              // css px around a cached stone, room for its shadow
  var STORE = 'lab-mosaic-v2';

  var T = {
    ru: {
      title: 'Дионис и Ариадна', sub: 'реставрация мозаики Дзалиси',
      pickHint: 'Выберите участок — и верните его камешки на место',
      overview: function (a, n, s, sn) { return 'Восстановлено участков: <b>' + a + '</b> из ' + n + ' · камешков: ' + s + ' из ' + sn; },
      section: function (k, a, n) { return 'Участок ' + k + ' · <b>' + a + '</b> из ' + n + ' камешков'; },
      random: 'Случайный участок', aboutBtn: 'О мозаике', back: '← Вся мозаика', hint: 'Подсказка',
      secDone: 'Участок восстановлен', secLine: function (a, n) { return 'Готово ' + a + ' из ' + n + ' участков.'; },
      next: 'Следующий', all: 'Вся мозаика', allDone: 'Мозаика восстановлена!', reset: 'Начать заново',
      aboutTitle: 'Дионис и Ариадна',
      about: 'Римская напольная мозаика III века н. э. из Дзалиси — древней Залиссы, которую упоминает Птолемей. ' +
        'Город в Мухранской долине раскапывают с 1971 года. Подписи над героями по-гречески: ',
      stones: 'Здесь она разобрана на 4 тысячи камешков, распознанных по фотографии.',
      caption: 'Дзалиси, Мухранская долина · III в. н. э.',
      loading: 'Раскладываем камешки…', confirmReset: 'Стереть весь прогресс?'
    },
    en: {
      title: 'Dionysus and Ariadne', sub: 'restoring the Dzalisa mosaic',
      pickHint: 'Pick a section and put its stones back',
      overview: function (a, n, s, sn) { return 'Sections restored: <b>' + a + '</b> of ' + n + ' · stones: ' + s + ' of ' + sn; },
      section: function (k, a, n) { return 'Section ' + k + ' · <b>' + a + '</b> of ' + n + ' stones'; },
      random: 'Random section', aboutBtn: 'About', back: '← Whole mosaic', hint: 'Hint',
      secDone: 'Section restored', secLine: function (a, n) { return a + ' of ' + n + ' sections done.'; },
      next: 'Next', all: 'Whole mosaic', allDone: 'Mosaic restored!', reset: 'Start over',
      aboutTitle: 'Dionysus and Ariadne',
      about: 'A Roman floor mosaic of the 3rd century AD from Dzalisa — the ancient Zalissa mentioned by Ptolemy, ' +
        'in Georgia’s Mukhrani valley, excavated since 1971. The Greek captions above the couple read: ',
      stones: 'Here it is taken apart into some 4,000 stones traced from a photograph.',
      caption: 'Dzalisa, Mukhrani valley, Georgia · 3rd c. AD',
      loading: 'Laying out the stones…', confirmReset: 'Erase all progress?'
    },
    ka: {
      title: 'დიონისე და არიადნა', sub: 'ძალისის მოზაიკის რესტავრაცია',
      pickHint: 'აირჩიეთ მონაკვეთი და ქვები თავის ადგილზე დააბრუნეთ',
      overview: function (a, n, s, sn) { return 'აღდგენილი მონაკვეთები: <b>' + a + '</b> / ' + n + ' · ქვები: ' + s + ' / ' + sn; },
      section: function (k, a, n) { return 'მონაკვეთი ' + k + ' · <b>' + a + '</b> / ' + n + ' ქვა'; },
      random: 'შემთხვევითი მონაკვეთი', aboutBtn: 'მოზაიკის შესახებ', back: '← მთელი მოზაიკა', hint: 'მინიშნება',
      secDone: 'მონაკვეთი აღდგენილია', secLine: function (a, n) { return 'მზადაა ' + a + ' / ' + n + ' მონაკვეთი.'; },
      next: 'შემდეგი', all: 'მთელი მოზაიკა', allDone: 'მოზაიკა აღდგენილია!', reset: 'თავიდან დაწყება',
      aboutTitle: 'დიონისე და არიადნა',
      about: 'რომაული იატაკის მოზაიკა (ახ. წ. III ს.) ძალისიდან — პტოლემაიოსის მიერ მოხსენიებული ზალისა მუხრანის ველზე; ' +
        'გათხრები 1971 წლიდან მიმდინარეობს. ბერძნული წარწერები: ',
      stones: 'აქ ის ფოტოდან ამოცნობილ 4 ათასამდე ქვად არის დაშლილი.',
      caption: 'ძალისა, მუხრანის ველი · ახ. წ. III ს.',
      loading: 'ქვებს ვალაგებთ…', confirmReset: 'წავშალოთ მთელი პროგრესი?'
    }
  };

  var $ = function (id) { return document.getElementById(id); };
  var cv = $('c'), ctx = cv.getContext('2d'), main = $('main');
  var layer = document.createElement('canvas');   // static part of the section view
  var comp = document.createElement('canvas');    // the floor at source resolution: restored = photo, rest = pale
  var img = new Image();

  var lang = pickLang();
  var D = null;          // stone data
  var P = loadProgress();
  var L = { cw: 0, ch: 0, dpr: 1, s: 1, ox: 0, oy: 0 };  // screen = o + source * s
  var mode = 'loading';
  var S = null;          // current section session
  var hover = -1, drag = null, press = null, dirty = true, hint = false, audio = null;

  // ---------- storage (per-viewer only) ----------
  function sget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function loadProgress() {
    try {
      var p = JSON.parse(sget(STORE));
      if (p && Array.isArray(p.restored)) return { restored: p.restored, partial: p.partial || {} };
    } catch (e) { /* fresh */ }
    return { restored: [], partial: {} };
  }
  function saveProgress() { sset(STORE, JSON.stringify(P)); }
  function isRestored(s) { return P.restored.indexOf(s) >= 0; }

  function pickLang() {
    var q = (location.search.match(/[?&]lang=(ru|en|ka)/) || [])[1];
    if (q) return q;
    var s = sget('lab-mosaic-lang');
    if (s && T[s]) return s;
    var n = (navigator.language || 'ru').toLowerCase();
    if (n.indexOf('ka') === 0) return 'ka';
    if (/^(ru|uk|be|kk|hy|az)/.test(n)) return 'ru';
    return 'en';
  }

  // ---------- data ----------
  function prepare(meta, bin) {
    var W = meta.w, H = meta.h, N = W * H, n = meta.count;
    var lab = new Uint16Array(bin);
    var x0 = new Int16Array(n).fill(32767), y0 = new Int16Array(n).fill(32767), x1 = new Int16Array(n), y1 = new Int16Array(n);
    var cx = new Float32Array(n), cy = new Float32Array(n), area = new Int32Array(n);
    for (var i = 0; i < N; i++) {
      var t = lab[i], x = i % W, y = (i / W) | 0;
      if (x < x0[t]) x0[t] = x; if (x > x1[t]) x1[t] = x;
      if (y < y0[t]) y0[t] = y; if (y > y1[t]) y1[t] = y;
      cx[t] += x + 0.5; cy[t] += y + 0.5; area[t]++;
    }
    for (t = 0; t < n; t++) { cx[t] /= area[t]; cy[t] /= area[t]; }
    var secOf = new Int32Array(n);
    meta.sections.forEach(function (ids, s) { ids.forEach(function (id) { secOf[id] = s; }); });

    // section borders as pixel-edge segments: one path for all, one per section for the hover outline
    var all = new Path2D(), per = meta.sections.map(function () { return new Path2D(); });
    function sec(x, y) { return x < 0 || y < 0 || x >= W || y >= H ? -1 : secOf[lab[y * W + x]]; }
    function seg(a, b, xa, ya, xb, yb) {
      if (a >= 0) { per[a].moveTo(xa, ya); per[a].lineTo(xb, yb); }
      if (b >= 0) { per[b].moveTo(xa, ya); per[b].lineTo(xb, yb); }
      if (a >= 0 && b >= 0) { all.moveTo(xa, ya); all.lineTo(xb, yb); }
    }
    for (y = 0; y < H; y++) for (x = 0; x <= W; x++) { var a = sec(x - 1, y), b = sec(x, y); if (a !== b) seg(a, b, x, y, x, y + 1); }
    for (y = 0; y <= H; y++) for (x = 0; x < W; x++) { a = sec(x, y - 1); b = sec(x, y); if (a !== b) seg(a, b, x, y, x + 1, y); }
    var sc = meta.sections.map(function (ids) {
      var mx = 0, my = 0; ids.forEach(function (id) { mx += cx[id]; my += cy[id]; });
      return [mx / ids.length, my / ids.length];
    });

    // source pixels
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'); g.drawImage(img, 0, 0);
    var src = g.getImageData(0, 0, W, H).data;
    // a tessera is one stone of one colour: average its inner pixels (edges are smeared with grout)
    var acc = new Float64Array(n * 4), accAll = new Float64Array(n * 4);
    for (i = 0; i < N; i++) {
      t = lab[i]; x = i % W; y = (i / W) | 0;
      var inner = x > 0 && y > 0 && x < W - 1 && y < H - 1 &&
        lab[i - 1] === t && lab[i + 1] === t && lab[i - W] === t && lab[i + W] === t;
      var A = inner ? acc : accAll;
      A[t * 4] += src[i * 4]; A[t * 4 + 1] += src[i * 4 + 1]; A[t * 4 + 2] += src[i * 4 + 2]; A[t * 4 + 3]++;
    }
    var color = [];
    for (t = 0; t < n; t++) {
      var B = acc[t * 4 + 3] >= 2 ? acc : accAll, k = t * 4, cnt = B[k + 3] + (B === accAll ? acc[k + 3] : 0);
      var r0 = B[k] + (B === accAll ? acc[k] : 0), g0 = B[k + 1] + (B === accAll ? acc[k + 1] : 0), b0 = B[k + 2] + (B === accAll ? acc[k + 2] : 0);
      color.push('rgb(' + Math.round(r0 / cnt) + ',' + Math.round(g0 / cnt) + ',' + Math.round(b0 / cnt) + ')');
    }
    return { W: W, H: H, n: n, lab: lab, color: color, x0: x0, y0: y0, x1: x1, y1: y1, cx: cx, cy: cy, secOf: secOf,
      sections: meta.sections, secPath: per, borders: all, secCenter: sc, src: src };
  }

  function buildComp() {
    var W = D.W, H = D.H;
    comp.width = W; comp.height = H;
    var g = comp.getContext('2d'), out = g.createImageData(W, H), o = out.data, s = D.src;
    var done = new Uint8Array(D.sections.length);
    P.restored.forEach(function (k) { done[k] = 1; });
    for (var i = 0; i < W * H; i++) {
      var j = i * 4, r = s[j], gg = s[j + 1], b = s[j + 2];
      if (done[D.secOf[D.lab[i]]]) { o[j] = r; o[j + 1] = gg; o[j + 2] = b; }
      else {
        var l = 0.3 * r + 0.59 * gg + 0.11 * b;
        o[j] = 0.68 * 226 + 0.32 * (0.6 * l + 0.4 * r);
        o[j + 1] = 0.68 * 218 + 0.32 * (0.6 * l + 0.4 * gg);
        o[j + 2] = 0.68 * 203 + 0.32 * (0.6 * l + 0.4 * b);
      }
      o[j + 3] = 255;
    }
    g.putImageData(out, 0, 0);
  }

  // ---------- layout ----------
  function resize() {
    var r = main.getBoundingClientRect();
    L.cw = r.width; L.ch = r.height; L.dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = layer.width = Math.round(L.cw * L.dpr);
    cv.height = layer.height = Math.round(L.ch * L.dpr);
    if (mode === 'overview') layoutOverview();
    else if (mode === 'section') layoutSection(false);
    dirty = true;
  }
  function layoutOverview() {
    var portrait = L.cw < L.ch;
    L.s = portrait ? (L.cw - 32) / D.W : Math.min((L.cw - 64) / D.W, (L.ch - 110) / D.H);
    L.ox = (L.cw - D.W * L.s) / 2;
    L.oy = portrait ? 44 : Math.max(40, (L.ch - D.H * L.s) / 2);
  }
  function layoutSection(fresh) {
    var v = S.view, portrait = L.cw < L.ch * 1.1;
    var oldS = L.s;
    if (portrait) {
      L.s = Math.min((L.cw - 32) / v.w, L.ch * 0.46 / v.h, 22);
      L.ox = (L.cw - v.w * L.s) / 2 - v.x * L.s; L.oy = 44 - v.y * L.s;
    } else {
      L.s = Math.min(L.cw * 0.48 / v.w, (L.ch - 100) * 0.85 / v.h, 22);
      L.ox = (L.cw - v.w * L.s) / 2 - v.x * L.s; L.oy = (L.ch - v.h * L.s) / 2 - v.y * L.s;
    }
    if (fresh || oldS !== L.s || !S.built) { S.stones.forEach(buildStone); S.built = true; }
    if (fresh) scatter(); else S.stones.forEach(clampStone);
    renderLayer();
  }

  // ---------- stones ----------
  var scratch = document.createElement('canvas');
  function maskFor(t, x0, y0, w, h, Zd) {
    // the stone's pixels, upscaled through a blur and re-thresholded: round, slightly shrunk (grout shows)
    scratch.width = w; scratch.height = h;
    var sg = scratch.getContext('2d'), id = sg.createImageData(w, h), d = id.data;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var X = x0 + x, Y = y0 + y;
      if (X >= 0 && Y >= 0 && X < D.W && Y < D.H && D.lab[Y * D.W + X] === t) d[(y * w + x) * 4 + 3] = 255;
    }
    sg.putImageData(id, 0, 0);
    var c = document.createElement('canvas');
    c.width = Math.ceil(w * Zd); c.height = Math.ceil(h * Zd);
    var g = c.getContext('2d');
    g.filter = 'blur(' + (Zd * 0.55).toFixed(1) + 'px)';
    g.imageSmoothingEnabled = true;
    g.drawImage(scratch, 0, 0, c.width, c.height);
    g.filter = 'none';
    var m = g.getImageData(0, 0, c.width, c.height), md = m.data;
    for (var i = 3; i < md.length; i += 4) md[i] = Math.max(0, Math.min(255, (md[i] - 150) * 14 + 128));
    g.putImageData(m, 0, 0);
    return c;
  }
  function buildStone(st) {
    var t = st.t, Zd = L.s * L.dpr;
    st.x0 = D.x0[t] - 1; st.y0 = D.y0[t] - 1; st.w = D.x1[t] - D.x0[t] + 3; st.h = D.y1[t] - D.y0[t] + 3;
    var mask = maskFor(t, st.x0, st.y0, st.w, st.h, Zd);
    // the stone itself: its own colour, a whisper of the photo for texture, a bevel
    var c = document.createElement('canvas'); c.width = mask.width; c.height = mask.height;
    var g = c.getContext('2d');
    g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = D.color[t]; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.22;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, st.x0, st.y0, st.w, st.h, 0, 0, c.width, c.height);
    g.globalAlpha = 1;
    var gr = g.createLinearGradient(0, 0, c.width, c.height);
    gr.addColorStop(0, 'rgba(255,250,235,.22)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(30,20,10,.28)');
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    st.img = c;
    st.mask = mask;
    buildSocket(st);
  }
  function buildSocket(st) {
    var c = st.sock || document.createElement('canvas');
    c.width = st.mask.width; c.height = st.mask.height;
    var g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(st.mask, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#e6dfd1'; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = hint ? 0.75 : 0.32;
    g.drawImage(img, st.x0, st.y0, st.w, st.h, 0, 0, c.width, c.height);
    g.globalAlpha = 1;
    st.sock = c;
  }
  function stoneRect(st) {
    return { x: L.ox + (st.x0 + st.dx) * L.s, y: L.oy + (st.y0 + st.dy) * L.s, w: st.w * L.s, h: st.h * L.s };
  }
  function clampStone(st) {
    if (st.locked) return;
    var r = stoneRect(st);
    var nx = Math.min(L.cw - r.w * 0.6, Math.max(-r.w * 0.4, r.x)), ny = Math.min(L.ch - r.h * 0.6, Math.max(-r.h * 0.4, r.y));
    st.dx += (nx - r.x) / L.s; st.dy += (ny - r.y) / L.s;
  }
  function overlap(a, b) {
    return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  }
  function scatter() {
    var v = S.view;
    var vr = { x: L.ox + v.x * L.s - 10, y: L.oy + v.y * L.s - 10, w: v.w * L.s + 20, h: v.h * L.s + 20 };
    var ui = [{ x: 0, y: 0, w: Math.min(L.cw, 340), h: 36 }, { x: L.cw - 300, y: L.ch - 60, w: 300, h: 60 }];
    var taken = [];
    shuffle(S.stones.filter(function (st) { return !st.locked; })).forEach(function (st) {
      var w = st.w * L.s, h = st.h * L.s, best = null, score0 = Infinity;
      for (var k = 0; k < 50; k++) {
        var c = { x: 4 + Math.random() * Math.max(1, L.cw - w - 8), y: 4 + Math.random() * Math.max(1, L.ch - h - 8), w: w, h: h };
        var sc = overlap(c, vr) * 6 + overlap(c, ui[0]) * 3 + overlap(c, ui[1]) * 3;
        for (var q = 0; q < taken.length; q++) sc += overlap(c, taken[q]);
        if (sc < score0) { score0 = sc; best = c; if (!sc) break; }
      }
      taken.push(best);
      st.dx = (best.x - L.ox) / L.s - st.x0; st.dy = (best.y - L.oy) / L.s - st.y0;
    });
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function renderLayer() {
    var g = layer.getContext('2d'), v = S.view, s = L.s;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, layer.width, layer.height);
    g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    var vx = L.ox + v.x * s, vy = L.oy + v.y * s;
    g.save();
    g.beginPath(); g.rect(vx, vy, v.w * s, v.h * s); g.clip();
    g.fillStyle = '#d9d3c6'; g.fillRect(vx, vy, v.w * s, v.h * s);
    g.imageSmoothingQuality = 'high';
    g.drawImage(comp, L.ox, L.oy, D.W * s, D.H * s);
    // the bed: grout-coloured under the whole section
    g.drawImage(S.bed, L.ox + v.x * s, L.oy + v.y * s, v.w * s, v.h * s);
    S.stones.forEach(function (st) {
      var x = L.ox + st.x0 * s, y = L.oy + st.y0 * s;
      g.drawImage(st.locked ? st.img : st.sock, x, y, st.w * s, st.h * s);
    });
    g.restore();
    g.strokeStyle = '#15120f'; g.lineWidth = 1;
    g.strokeRect(vx - 0.5, vy - 0.5, v.w * s + 1, v.h * s + 1);
  }

  // ---------- modes ----------
  function enterOverview() {
    mode = 'overview'; S = null; drag = null; hover = -1;
    $('card').hidden = true;
    layoutOverview();
    syncUI();
    dirty = true;
  }

  function enterSection(k) {
    var ids = D.sections[k], part = P.partial[k] || [];
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ids.forEach(function (t) {
      x0 = Math.min(x0, D.x0[t]); y0 = Math.min(y0, D.y0[t]); x1 = Math.max(x1, D.x1[t] + 1); y1 = Math.max(y1, D.y1[t] + 1);
    });
    var m = 4;
    S = { k: k, stones: ids.map(function (t) {
      return { t: t, locked: part.indexOf(t) >= 0, dx: 0, dy: 0, flash: 0 };
    }), view: { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m }, built: false };
    var bed = document.createElement('canvas'), v = S.view;
    bed.width = v.w; bed.height = v.h;
    var bg = bed.getContext('2d'), bid = bg.createImageData(v.w, v.h), bd = bid.data;
    for (var y = 0; y < v.h; y++) for (var x = 0; x < v.w; x++) {
      var X = v.x + x, Y = v.y + y;
      if (X < 0 || Y < 0 || X >= D.W || Y >= D.H || D.secOf[D.lab[Y * D.W + X]] !== k) continue;
      var o = (y * v.w + x) * 4;
      bd[o] = 122; bd[o + 1] = 110; bd[o + 2] = 96; bd[o + 3] = 255;
    }
    bg.putImageData(bid, 0, 0);
    S.bed = bed;
    S.order = S.stones.filter(function (st) { return !st.locked; });
    S.placed = S.stones.length - S.order.length;
    mode = 'section'; drag = null;
    $('card').hidden = true;
    layoutSection(true);
    syncUI();
    dirty = true;
    if (window.gtag) gtag('event', 'mosaic_section', { section: k });
  }

  function lockStone(st) {
    st.locked = true; st.dx = 0; st.dy = 0; st.flash = performance.now();
    S.order.splice(S.order.indexOf(st), 1);
    S.placed++;
    var part = P.partial[S.k] || (P.partial[S.k] = []);
    part.push(st.t);
    click();
    if (S.placed === S.stones.length) {
      delete P.partial[S.k];
      if (!isRestored(S.k)) P.restored.push(S.k);
      buildComp();
      if (window.gtag) gtag('event', 'mosaic_section_done', { section: S.k, restored: P.restored.length });
      var k = S.k;
      setTimeout(function () { if (S && S.k === k) showSectionDone(); }, 700);
    }
    saveProgress();
    renderLayer();
  }

  function nextSection(from) {
    var best = -1, bd = Infinity, c = from >= 0 ? D.secCenter[from] : null;
    for (var s = 0; s < D.sections.length; s++) {
      if (isRestored(s)) continue;
      var d = c ? Math.hypot(D.secCenter[s][0] - c[0], D.secCenter[s][1] - c[1]) : Math.random();
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // ---------- cards ----------
  function aboutHtml(tr) {
    return '<p class="about">' + tr.about + '<span class="greek">ΑΡΙΑΔΝΗ · ΔΙΟΝΥϹΟϹ</span>. ' + tr.stones + '</p>';
  }
  function card(html) {
    $('card').innerHTML = '<button class="x" id="x" aria-label="×">×</button>' + html;
    $('card').hidden = false;
    $('x').onclick = function () { $('card').hidden = true; };
  }
  function showSectionDone() {
    var tr = T[lang], n = D.sections.length, a = P.restored.length;
    if (a === n) return showAllDone();
    card('<h2>' + tr.secDone + '</h2><div class="res">' + tr.secLine(a, n) + '</div>' +
      '<div class="row"><button class="primary ghost" id="c-all">' + tr.all + '</button>' +
      '<button class="primary" id="c-next">' + tr.next + '</button></div>');
    $('c-all').onclick = enterOverview;
    $('c-next').onclick = function () { var s = nextSection(S ? S.k : -1); if (s >= 0) enterSection(s); };
  }
  function showAllDone() {
    var tr = T[lang];
    if (mode !== 'overview') enterOverview();
    card('<h2>' + tr.allDone + '</h2>' + aboutHtml(tr) +
      '<div class="row"><button class="primary ghost" id="c-reset">' + tr.reset + '</button></div>');
    $('c-reset').onclick = resetAll;
    if (window.gtag) gtag('event', 'mosaic_all_done');
  }
  function showAbout() {
    var tr = T[lang], any = P.restored.length || Object.keys(P.partial).length;
    card('<h2>' + tr.aboutTitle + '</h2>' + aboutHtml(tr) +
      (any ? '<div class="row"><button class="primary ghost" id="c-reset">' + tr.reset + '</button></div>' : ''));
    if (any) $('c-reset').onclick = resetAll;
  }
  function resetAll() {
    if (!window.confirm(T[lang].confirmReset)) return;
    P = { restored: [], partial: {} };
    saveProgress(); buildComp(); enterOverview();
  }

  // ---------- UI ----------
  function syncUI() {
    var tr = T[lang];
    document.documentElement.lang = lang;
    $('t-title').textContent = tr.title;
    $('t-sub').textContent = tr.sub;
    $('caption').textContent = tr.caption;
    Array.prototype.forEach.call(document.querySelectorAll('#langs button'), function (b) {
      b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false');
    });
    var b1 = $('b1'), b2 = $('b2');
    if (mode === 'section') {
      b1.textContent = tr.back; b1.removeAttribute('aria-pressed');
      b2.textContent = tr.hint; b2.setAttribute('aria-pressed', hint ? 'true' : 'false');
    } else {
      b1.textContent = tr.aboutBtn; b1.removeAttribute('aria-pressed');
      b2.textContent = tr.random; b2.removeAttribute('aria-pressed');
    }
    $('caption').hidden = mode === 'section';
    updateStatus();
  }
  function updateStatus() {
    var tr = T[lang];
    if (mode === 'loading') { $('status').textContent = tr.loading; return; }
    if (mode === 'section') { $('status').innerHTML = tr.section(S.k + 1, S.placed, S.stones.length); return; }
    var stones = 0;
    P.restored.forEach(function (k) { stones += D.sections[k].length; });
    Object.keys(P.partial).forEach(function (k) { stones += P.partial[k].length; });
    $('status').innerHTML = (P.restored.length || stones ? tr.overview(P.restored.length, D.sections.length, stones, D.n) : tr.pickHint);
  }

  $('b1').onclick = function () { if (mode === 'section') enterOverview(); else if (mode === 'overview') showAbout(); };
  $('b2').onclick = function () {
    if (mode === 'section') {
      hint = !hint; S.stones.forEach(buildSocket); renderLayer(); syncUI(); dirty = true;
    } else if (mode === 'overview') {
      var s = nextSection(-1); if (s >= 0) enterSection(s);
    }
  };
  Array.prototype.forEach.call(document.querySelectorAll('#langs button'), function (b) {
    b.onclick = function () { lang = b.dataset.lang; sset('lab-mosaic-lang', lang); syncUI(); };
  });

  // ---------- input ----------
  function local(e) {
    var r = cv.getBoundingClientRect();
    var sx = e.clientX - r.left, sy = e.clientY - r.top;
    return { sx: sx, sy: sy, x: (sx - L.ox) / L.s, y: (sy - L.oy) / L.s };
  }
  function secAt(pt) {
    var x = Math.floor(pt.x), y = Math.floor(pt.y);
    if (x < 0 || y < 0 || x >= D.W || y >= D.H) return -1;
    return D.secOf[D.lab[y * D.W + x]];
  }
  function stoneAt(pt, touch) {
    for (var i = S.order.length - 1; i >= 0; i--) {
      var st = S.order[i], x = Math.floor(pt.x - st.dx), y = Math.floor(pt.y - st.dy);
      if (x >= 0 && y >= 0 && x < D.W && y < D.H && D.lab[y * D.W + x] === st.t) return st;
    }
    // small stones, fat fingers: nearest stone centre within reach
    var reach = touch ? 26 : 10, best = null, bd = reach * reach;
    for (i = S.order.length - 1; i >= 0; i--) {
      st = S.order[i];
      var cx = L.ox + (D.cx[st.t] + st.dx) * L.s, cy = L.oy + (D.cy[st.t] + st.dy) * L.s;
      var d = (cx - pt.sx) * (cx - pt.sx) + (cy - pt.sy) * (cy - pt.sy);
      if (d < bd) { bd = d; best = st; }
    }
    return best;
  }

  cv.addEventListener('pointerdown', function (e) {
    if (drag) return;
    var pt = local(e);
    if (mode === 'overview') { press = { x: pt.sx, y: pt.sy, id: e.pointerId }; return; }
    if (mode !== 'section') return;
    var st = stoneAt(pt, e.pointerType === 'touch');
    if (!st) return;
    e.preventDefault();
    drag = { st: st, gx: pt.x - st.dx, gy: pt.y - st.dy, id: e.pointerId, touch: e.pointerType === 'touch' };
    S.order.splice(S.order.indexOf(st), 1); S.order.push(st);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    cv.style.cursor = 'grabbing';
    dirty = true;
  });
  cv.addEventListener('pointermove', function (e) {
    var pt = local(e);
    if (mode === 'overview') {
      var h = secAt(pt);
      if (h >= 0 && isRestored(h)) h = -1;
      if (h !== hover) { hover = h; dirty = true; }
      cv.style.cursor = hover >= 0 ? 'pointer' : 'default';
      return;
    }
    if (mode !== 'section') return;
    if (!drag) {
      if (e.pointerType === 'mouse') cv.style.cursor = stoneAt(pt, false) ? 'grab' : 'default';
      return;
    }
    if (e.pointerId !== drag.id) return;
    drag.st.dx = pt.x - drag.gx; drag.st.dy = pt.y - drag.gy;
    clampStone(drag.st);
    dirty = true;
  });
  function up(e) {
    var pt = local(e);
    if (mode === 'overview' && press && press.id === e.pointerId) {
      var moved = Math.hypot(pt.sx - press.x, pt.sy - press.y) > 10;
      press = null;
      var s = secAt(pt);
      if (!moved && s >= 0 && !isRestored(s)) enterSection(s);
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    var st = drag.st, thr = Math.max(drag.touch ? 22 : 15, L.s * 1.6);
    drag = null;
    cv.style.cursor = 'grab';
    if (Math.hypot(st.dx, st.dy) * L.s < thr) lockStone(st);
    updateStatus();
    dirty = true;
  }
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', function (e) { press = null; up(e); });
  cv.addEventListener('pointerleave', function () { if (mode === 'overview' && hover >= 0) { hover = -1; dirty = true; } });

  function click() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var len = Math.floor(audio.sampleRate * 0.05), buf = audio.createBuffer(1, len, audio.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
      var src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
      src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 2400 + Math.random() * 1200; f.Q.value = 3; g.gain.value = 0.6;
      src.connect(f); f.connect(g); g.connect(audio.destination);
      src.start();
    } catch (e) { /* silent */ }
  }

  // ---------- render ----------
  function frame(now) {
    requestAnimationFrame(frame);
    if (mode === 'loading') return;
    var anim = false;
    if (mode === 'section') for (var i = 0; i < S.stones.length; i++) if (S.stones[i].flash && now - S.stones[i].flash < 400) { anim = true; break; }
    if (!dirty && !anim) return;
    dirty = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    if (mode === 'overview') {
      ctx.drawImage(comp, L.ox, L.oy, D.W * L.s, D.H * L.s);
      ctx.save();
      ctx.translate(L.ox, L.oy); ctx.scale(L.s, L.s);
      ctx.strokeStyle = 'rgba(21,18,15,.16)'; ctx.lineWidth = 1 / L.s; ctx.stroke(D.borders);
      if (hover >= 0) {
        ctx.strokeStyle = '#15120f'; ctx.lineWidth = 2.5 / L.s; ctx.stroke(D.secPath[hover]);
      }
      ctx.restore();
      ctx.strokeStyle = '#15120f'; ctx.lineWidth = 1;
      ctx.strokeRect(L.ox - 0.5, L.oy - 0.5, D.W * L.s + 1, D.H * L.s + 1);
      return;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    S.stones.forEach(function (st) {
      var a = st.flash ? 1 - (now - st.flash) / 400 : 0;
      if (a <= 0) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.6;
      ctx.drawImage(st.mask, L.ox + st.x0 * L.s, L.oy + st.y0 * L.s, st.w * L.s, st.h * L.s);
      ctx.restore();
    });
    S.order.forEach(function (st) {
      var r = stoneRect(st), lifted = drag && drag.st === st;
      ctx.save();
      ctx.shadowColor = 'rgba(40,25,10,' + (lifted ? 0.4 : 0.35) + ')';
      ctx.shadowBlur = (lifted ? 10 : 1.5) * L.dpr; ctx.shadowOffsetY = (lifted ? 5 : 1.5) * L.dpr;
      var k = lifted ? 1.08 : 1, w = r.w * k, h = r.h * k;
      ctx.drawImage(st.img, r.x - (w - r.w) / 2, r.y - (h - r.h) / 2, w, h);
      ctx.restore();
    });
  }

  // ---------- boot ----------
  window.addEventListener('resize', resize);
  syncUI();
  resize();
  var imgReady = new Promise(function (res, rej) { img.onload = res; img.onerror = rej; img.src = 'mosaic.png?v=2'; });
  Promise.all([
    fetch('tesserae.json?v=5').then(function (r) { return r.json(); }),
    fetch('tesserae.bin?v=5').then(function (r) { return r.arrayBuffer(); }),
    imgReady
  ]).then(function (res) {
    D = prepare(res[0], res[1]);
    P.restored = P.restored.filter(function (k) { return k < D.sections.length; });
    buildComp();
    mode = 'overview';
    resize();
    enterOverview();
    requestAnimationFrame(frame);
  }).catch(function (e) {
    $('status').textContent = String(e && e.message || e);
  });
})();
