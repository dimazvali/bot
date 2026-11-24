// Побратимы — the world's twin-town graph (Wikidata P190) on a map, plus a "handshakes" game.
// data.json is built by scripts/lab-twins/build.js; nodes are sorted by fame (Wikipedia sitelinks).
(function () {
  'use strict';

  var T = {
    ru: {
      title: 'Побратимы', tagline: 'города-побратимы всего мира', modeMap: 'Карта', modeGame: 'Рукопожатия', back: '← все проекты',
      loading: 'Загружаем 20 тысяч городов…', loadErr: 'Не получилось загрузить данные. Обновите страницу.',
      search: 'Найти город…', lede: 'У каждого города есть побратимы, у побратимов — свои. Выберите город и посмотрите, как расходятся связи.',
      twins: function (n) { return n + ' ' + plural(n, 'побратим', 'побратима', 'побратимов'); },
      ring: function (n) { return n === 1 ? '1 рукопожатие' : n + ' ' + plural(n, 'рукопожатие', 'рукопожатия', 'рукопожатий'); },
      ringShort: function (n) { return n + ' ' + plural(n, 'шаг', 'шага', 'шагов'); },
      reach: function (n, total) { return 'Через побратимов отсюда можно дойти до <b>' + fmt(n) + '</b> ' + plural(n, 'города', 'городов', 'городов') + ' из ' + fmt(total) + '.'; },
      farthest: function (name, d) { return 'Дальше всех — <span class="link" data-go="' + name[1] + '">' + esc(name[0]) + '</span>: ' + d + ' ' + plural(d, 'рукопожатие', 'рукопожатия', 'рукопожатий') + '.'; },
      isolated: 'Этот город не связан с большой сетью: его побратимы дружат только друг с другом.',
      direct: 'Побратимы', showAll: function (n) { return 'Показать все ' + n; },
      top: 'Самые общительные', pathTo: 'Путь до другого города', pathFrom: 'Откуда',
      play: 'Сыграть отсюда', noPath: 'Пути нет: города в разных сетях.',
      path: function (d) { return d + ' ' + plural(d, 'рукопожатие', 'рукопожатия', 'рукопожатий'); },
      daily: function (n) { return 'Задача дня №' + n; }, custom: 'Своя задача', random: 'Случайная задача',
      from: 'Вы в городе', to: 'Нужно добраться до', moves: 'Ходов', best: 'можно за',
      pickNext: 'Куда дальше? Побратимы этого города:', filter: 'Фильтр…',
      undo: '← Шаг назад', hint: 'Подсказка', giveUp: 'Сдаться', newGame: 'Новая задача', share: 'Поделиться', copied: 'Скопировано!',
      won: 'Добрались!', lost: 'Вот кратчайший путь',
      result: function (m, b) { return m === b ? 'За ' + m + ' — это оптимально.' : 'За ' + m + ', а можно было за ' + b + '.'; },
      hints: function (n) { return n ? ' Подсказок: ' + n + '.' : ''; },
      optimal: 'Один из кратчайших путей:',
      gameLede: 'Доберитесь от одного города до другого, переходя только по побратимским связям. Чем меньше ходов, тем лучше.',
      shareText: function (a, b, m, best, n) { return 'Побратимы' + (n ? ' №' + n : '') + ': ' + a + ' → ' + b + ' за ' + m + ' (оптимум ' + best + ')'; },
      custStart: 'Старт', custEnd: 'Финиш', custGo: 'Играть',
      about: 'Данные: Wikidata, свойство P190, собраны ' + '{built}' + '. Связь засчитана, если её указал хотя бы один из городов. Пять связей Тбилиси добавлены по Википедии. Побратимы и партнёры не различаются, разорванные связи могут остаться.',
      tipTwins: function (n) { return n + ' ' + plural(n, 'связь', 'связи', 'связей'); },
      tapHint: 'Нажмите на точку на карте или найдите город в поиске.'
    },
    en: {
      title: 'Twin towns', tagline: 'sister cities of the whole world', modeMap: 'Map', modeGame: 'Handshakes', back: '← all projects',
      loading: 'Loading 20,000 cities…', loadErr: 'Could not load the data. Please reload.',
      search: 'Find a city…', lede: 'Every city has twin towns, and they have their own. Pick a city and watch the ties spread.',
      twins: function (n) { return n + ' twin ' + (n === 1 ? 'town' : 'towns'); },
      ring: function (n) { return n + ' ' + (n === 1 ? 'handshake' : 'handshakes'); },
      ringShort: function (n) { return n + ' ' + (n === 1 ? 'step' : 'steps'); },
      reach: function (n, total) { return 'Through twin towns you can reach <b>' + fmt(n) + '</b> of ' + fmt(total) + ' cities from here.'; },
      farthest: function (name, d) { return 'The farthest is <span class="link" data-go="' + name[1] + '">' + esc(name[0]) + '</span>: ' + d + ' handshakes away.'; },
      isolated: 'This city is not linked to the big network: its twins only twin with each other.',
      direct: 'Twin towns', showAll: function (n) { return 'Show all ' + n; },
      top: 'Most connected', pathTo: 'Path to another city', pathFrom: 'From',
      play: 'Play from here', noPath: 'No path: the cities are in separate networks.',
      path: function (d) { return d + ' ' + (d === 1 ? 'handshake' : 'handshakes'); },
      daily: function (n) { return 'Daily puzzle #' + n; }, custom: 'Custom puzzle', random: 'Random puzzle',
      from: 'You are in', to: 'Get to', moves: 'Moves', best: 'doable in',
      pickNext: 'Where next? This city\'s twin towns:', filter: 'Filter…',
      undo: '← Step back', hint: 'Hint', giveUp: 'Give up', newGame: 'New puzzle', share: 'Share', copied: 'Copied!',
      won: 'You made it!', lost: 'Here is the shortest path',
      result: function (m, b) { return m === b ? 'In ' + m + ' — that\'s optimal.' : 'In ' + m + '; it could be done in ' + b + '.'; },
      hints: function (n) { return n ? ' Hints used: ' + n + '.' : ''; },
      optimal: 'One of the shortest paths:',
      gameLede: 'Get from one city to another moving only along twin-town ties. The fewer moves, the better.',
      shareText: function (a, b, m, best, n) { return 'Twin towns' + (n ? ' #' + n : '') + ': ' + a + ' → ' + b + ' in ' + m + ' (best ' + best + ')'; },
      custStart: 'Start', custEnd: 'Finish', custGo: 'Play',
      about: 'Data: Wikidata property P190, fetched {built}. A tie counts if either city lists it. Five Tbilisi ties were added from Wikipedia. Twin towns and partner cities are not told apart, and ended ties may linger.',
      tipTwins: function (n) { return n + ' ' + (n === 1 ? 'tie' : 'ties'); },
      tapHint: 'Tap a dot on the map or search for a city.'
    }
  };
  function plural(n, one, few, many) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  }
  var lang = 'ru';
  function fmt(n) { return n.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function t(k) { return T[lang][k]; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  var canvas = document.getElementById('map'), ctx = canvas.getContext('2d');
  var panel = document.getElementById('panel'), tip = document.getElementById('tip'), loading = document.getElementById('loading');

  // ---------- data ----------
  var D, N, adj, X, Y, giant, giantSize, normNames, TBILISI = -1, qIndex = new Map();
  function name(i) { return lang === 'ru' ? (D.nodes.ru[i] || D.nodes.en[i]) : D.nodes.en[i]; }
  function country(i) { var c = D.nodes.c[i]; return c < 0 ? '' : D.countries[c][lang === 'ru' ? 0 : 1]; }
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ё/g, 'е').replace(/[-‐–—'’.,()]/g, ' '); }

  function bfs(src, parent) {
    var d = new Int16Array(N).fill(-1); d[src] = 0;
    var q = new Int32Array(N), h = 0, tl = 0; q[tl++] = src;
    while (h < tl) { var u = q[h++], a = adj[u]; for (var k = 0; k < a.length; k++) { var v = a[k]; if (d[v] < 0) { d[v] = d[u] + 1; if (parent) parent[v] = u; q[tl++] = v; } } }
    return d;
  }

  // Equal Earth projection, in projection units (x ∈ ±2.7, y ∈ ±1.32), y up
  var A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2, RAD = Math.PI / 180;
  function proj(lon, lat, out) {
    var th = Math.asin(M * Math.sin(lat * RAD)), l2 = th * th, l6 = l2 * l2 * l2;
    out[0] = lon * RAD * Math.cos(th) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)));
    out[1] = th * (A1 + A2 * l2 + l6 * (A3 + A4 * l2));
    return out;
  }
  var LAND = [];
  function prepare(data) {
    D = data; N = D.nodes.id.length;
    adj = Array.from({ length: N }, function () { return []; });
    for (var k = 0; k < D.edges.length; k += 2) { adj[D.edges[k]].push(D.edges[k + 1]); adj[D.edges[k + 1]].push(D.edges[k]); }
    for (var i = 0; i < N; i++) adj[i].sort(function (a, b) { return a - b; }); // fame order
    X = new Float32Array(N); Y = new Float32Array(N);
    var p = [0, 0];
    for (i = 0; i < N; i++) { proj(D.nodes.lon[i], D.nodes.lat[i], p); X[i] = p[0]; Y[i] = -p[1]; qIndex.set(D.nodes.id[i], i); }
    TBILISI = qIndex.has(994) ? qIndex.get(994) : 0;
    // giant component = the one Tbilisi is in (it is the largest)
    var d = bfs(TBILISI); giant = new Uint8Array(N); giantSize = 0;
    for (i = 0; i < N; i++) if (d[i] >= 0) { giant[i] = 1; giantSize++; }
    LAND = D.land.map(function (r) { var o = new Float32Array(r.length); for (var j = 0; j < r.length; j += 2) { proj(r[j], r[j + 1], p); o[j] = p[0]; o[j + 1] = -p[1]; } return o; });
    normNames = [];
    for (i = 0; i < N; i++) normNames.push(norm(D.nodes.en[i] + ' | ' + (D.nodes.ru[i] || '')));
  }

  // ---------- view ----------
  var W = 0, H = 0, dpr = 1, view = { k: 1, x: 0, y: 0 }, base = 1;
  function resize() {
    var r = canvas.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
    var first = !W; W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    base = Math.min(W / 5.6, H / 2.8);
    if (first) fitWorld();
    draw();
  }
  function fitWorld() {
    var mobile = W < 700, ph = mobile ? H * 0.52 : 0, pw = mobile ? 0 : 392;
    view.k = 1; view.x = pw / 2 + W / 2; view.y = (H - ph) / 2;
  }
  function sx(i) { return view.x + X[i] * base * view.k; }
  function sy(i) { return view.y + Y[i] * base * view.k; }
  function zoomAt(f, cx, cy) {
    var k = Math.max(0.8, Math.min(60, view.k * f)); f = k / view.k;
    view.x = cx - (cx - view.x) * f; view.y = cy - (cy - view.y) * f; view.k = k; draw();
  }
  function centerOn(i, minK) {
    var mobile = W < 700, cx = mobile ? W / 2 : 392 + (W - 392) / 2, cy = mobile ? H * 0.24 : H / 2;
    if (minK && view.k < minK) view.k = minK;
    view.x = cx - X[i] * base * view.k; view.y = cy - Y[i] * base * view.k; draw();
  }

  // ---------- state ----------
  var mode = 'map';
  var S = { sel: -1, dist: null, parent: null, maxRing: 3, counts: [], pathEnd: -1, path: null, showAll: false, anim: 0 };
  var G = null; // game: { start, target, cur, route:[], dT, hints, done, lost, daily, closer:Set }

  function select(i, opts) {
    S.sel = i; S.parent = new Int32Array(N).fill(-1); S.dist = bfs(i, S.parent);
    S.counts = []; var far = -1, fd = 0;
    for (var j = 0; j < N; j++) { var d = S.dist[j]; if (d > 0) { S.counts[d] = (S.counts[d] || 0) + 1; if (d > fd || (d === fd && far > j)) { fd = d; far = j; } } }
    S.far = far; S.farD = fd; S.path = null; S.pathEnd = -1; S.showAll = false;
    S.anim = performance.now();
    if (!opts || opts.center !== false) centerOn(i, 1.6);
    setURL();
    renderPanel(); animate();
  }
  function shortest(from, to) { // path from→to, preferring famous intermediate cities
    var d = bfs(to); if (d[from] < 0) return null;
    var p = [from], u = from;
    while (u !== to) { var a = adj[u]; for (var k = 0; k < a.length; k++) if (d[a[k]] === d[u] - 1) { u = a[k]; break; } p.push(u); }
    return p;
  }

  // ---------- drawing ----------
  var COL = { r1: '#d23f26', r2: '#d99a1e', r3: '#2f8a86', far: '#8f897d', none: '#c9c2b4', land: '#e4ddcf', ink: '#15120f', ok: '#2f8f4e' };
  var arcCache = new Map();
  function arcPts(a, b) { // great-circle polyline in projection units, split at the antimeridian
    var key = a < b ? a * N + b : b * N + a, c = arcCache.get(key);
    if (c) return a < b ? c : c.rev;
    var lo1 = D.nodes.lon[a] * RAD, la1 = D.nodes.lat[a] * RAD, lo2 = D.nodes.lon[b] * RAD, la2 = D.nodes.lat[b] * RAD;
    var v1 = [Math.cos(la1) * Math.cos(lo1), Math.cos(la1) * Math.sin(lo1), Math.sin(la1)], v2 = [Math.cos(la2) * Math.cos(lo2), Math.cos(la2) * Math.sin(lo2), Math.sin(la2)];
    var dot = Math.max(-1, Math.min(1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2])), om = Math.acos(dot), so = Math.sin(om);
    var n = Math.max(2, Math.ceil(om / (2.5 * RAD))), pts = [], p = [0, 0];
    for (var s = 0; s <= n; s++) {
      var f = s / n, x, y, z;
      if (so < 1e-6) { x = v1[0]; y = v1[1]; z = v1[2]; } else {
        var ka = Math.sin((1 - f) * om) / so, kb = Math.sin(f * om) / so;
        x = ka * v1[0] + kb * v2[0]; y = ka * v1[1] + kb * v2[1]; z = ka * v1[2] + kb * v2[2];
      }
      proj(Math.atan2(y, x) / RAD, Math.asin(Math.max(-1, Math.min(1, z))) / RAD, p);
      pts.push(p[0], -p[1]);
    }
    var res = { f: pts, rev: null };
    var rv = []; for (s = pts.length - 2; s >= 0; s -= 2) rv.push(pts[s], pts[s + 1]); res.rev = { f: rv };
    arcCache.set(key, res);
    return a < b ? res : res.rev;
  }
  function strokeArc(a, b, prog) {
    var pts = arcPts(a, b).f, n = pts.length / 2, upto = Math.max(1, Math.floor((n - 1) * prog) + 1);
    var s = base * view.k, px = view.x, py = view.y;
    ctx.moveTo(px + pts[0] * s, py + pts[1] * s);
    for (var k = 1; k < upto; k++) {
      var x = px + pts[2 * k] * s, y = py + pts[2 * k + 1] * s;
      if (Math.abs(pts[2 * k] - pts[2 * k - 2]) > 2) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  function ease(x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); }
  var raf = 0;
  function animate() { if (!raf) raf = requestAnimationFrame(function step() { raf = 0; var more = draw(); if (more) animate(); }); }

  function draw() {
    if (!D || !W) return false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, W, H);
    var s = base * view.k;
    // land
    ctx.beginPath();
    for (var r = 0; r < LAND.length; r++) {
      var L = LAND[r]; ctx.moveTo(view.x + L[0] * s, view.y + L[1] * s);
      for (var j = 2; j < L.length; j += 2) ctx.lineTo(view.x + L[j] * s, view.y + L[j + 1] * s);
      ctx.closePath();
    }
    ctx.fillStyle = COL.land; ctx.fill();
    var more = mode === 'map' ? drawMap() : drawGame();
    return more;
  }
  function visible(x, y) { return x > -20 && y > -20 && x < W + 20 && y < H + 20; }
  function dotsAll(color, size) {
    ctx.fillStyle = color;
    for (var i = 0; i < N; i++) { var x = sx(i), y = sy(i); if (visible(x, y)) ctx.fillRect(x - size / 2, y - size / 2, size, size); }
  }
  function dot(i, r, fill, stroke) {
    var x = sx(i), y = sy(i); ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  var placed = [];
  function label(i, txt, opts) {
    opts = opts || {};
    var x = sx(i), y = sy(i); if (!visible(x, y)) return;
    ctx.font = (opts.bold ? '700 ' : '400 ') + (opts.size || 11) + 'px "JetBrains Mono", monospace';
    var off = opts.dx || 7, w = ctx.measureText(txt).width, h = (opts.size || 11) + 4, lx = x + off, ly = y - h / 2;
    if (lx + w > W - 4) lx = x - off - w;
    if (!opts.force) for (var k = 0; k < placed.length; k++) { var p = placed[k]; if (lx < p[0] + p[2] && lx + w > p[0] && ly < p[1] + p[3] && ly + h > p[1]) return; }
    placed.push([lx - 2, ly, w + 4, h]);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(244,241,234,.9)'; ctx.lineJoin = 'round';
    ctx.textBaseline = 'middle'; ctx.strokeText(txt, lx, y); ctx.fillStyle = opts.color || COL.ink; ctx.fillText(txt, lx, y);
  }

  function ringColor(d) { return d === 1 ? COL.r1 : d === 2 ? COL.r2 : d === 3 ? COL.r3 : d > 3 ? COL.far : COL.none; }
  function drawMap() {
    placed = [];
    if (S.sel < 0) { dotsAll('#8f897d', 2); return false; }
    var now = performance.now(), el = (now - S.anim) / 1000, more = el < 2.2;
    var p1 = ease(el / 0.7), p2 = ease((el - 0.5) / 0.9), p3 = ease((el - 1.1) / 0.8);
    var dist = S.dist, i, x, y, d, sz;
    // background dots: unreachable, then far
    for (var pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? COL.far : COL.none;
      for (i = 0; i < N; i++) { d = dist[i]; if (pass ? !(d > S.maxRing || (d > 0 && d > 3)) : d >= 0) continue; x = sx(i); y = sy(i); if (visible(x, y)) ctx.fillRect(x - 1, y - 1, 2, 2); }
    }
    // ring 3 dots
    if (S.maxRing >= 3) { ctx.globalAlpha = p3; ctx.fillStyle = COL.r3; for (i = 0; i < N; i++) if (dist[i] === 3) { x = sx(i); y = sy(i); if (visible(x, y)) ctx.fillRect(x - 1.5, y - 1.5, 3, 3); } ctx.globalAlpha = 1; }
    // ring 2 arcs (BFS tree) + dots
    if (S.maxRing >= 2) {
      ctx.beginPath(); var cnt = 0;
      for (i = 0; i < N && cnt < 4000; i++) if (dist[i] === 2) { strokeArc(S.parent[i], i, p2); cnt++; }
      ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(217,154,30,.28)'; ctx.stroke();
      ctx.fillStyle = COL.r2; ctx.globalAlpha = p2;
      for (i = 0; i < N; i++) if (dist[i] === 2) { x = sx(i); y = sy(i); if (visible(x, y)) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); } }
      ctx.globalAlpha = 1;
    }
    // ring 1 arcs + dots
    ctx.beginPath();
    var a = adj[S.sel];
    for (var k = 0; k < a.length; k++) strokeArc(S.sel, a[k], p1);
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(210,63,38,.75)'; ctx.stroke();
    for (k = 0; k < a.length; k++) dot(a[k], 3.6 * p1 + 0.01, COL.r1, '#f4f1ea');
    // path to another city
    if (S.path) {
      ctx.beginPath(); for (k = 1; k < S.path.length; k++) strokeArc(S.path[k - 1], S.path[k], 1);
      ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.stroke();
      for (k = 1; k < S.path.length; k++) dot(S.path[k], 4.5, k === S.path.length - 1 ? COL.ink : '#f4f1ea', COL.ink);
    }
    dot(S.sel, 6.5, COL.ink, '#f4f1ea');
    // labels: selection, path, ring 1 in fame order, then ring 2 when zoomed in
    label(S.sel, name(S.sel), { bold: true, size: 13, force: true });
    if (S.path) for (k = 1; k < S.path.length; k++) label(S.path[k], name(S.path[k]), { bold: true, force: true });
    if (p1 > 0.9) for (k = 0; k < a.length; k++) label(a[k], name(a[k]), { color: '#8a2a18' });
    if (view.k > 3 && p2 > 0.9 && S.maxRing >= 2) for (i = 0; i < N && placed.length < 160; i++) if (dist[i] === 2) label(i, name(i), { size: 10, color: '#7a5510' });
    if (hover >= 0) dot(hover, 6, null, COL.ink);
    return more;
  }

  function drawGame() {
    placed = [];
    if (!G) { dotsAll('#8f897d', 2); return false; }
    var now = performance.now(), el = (now - G.anim) / 1000, more = el < 0.9, p1 = ease(el / 0.7);
    dotsAll(COL.none, 2);
    var cur = G.cur, a = adj[cur], k;
    if (!G.done) {
      ctx.beginPath(); for (k = 0; k < a.length; k++) strokeArc(cur, a[k], p1);
      ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(217,154,30,.6)'; ctx.stroke();
      for (k = 0; k < a.length; k++) dot(a[k], 3.4, G.closer && G.closer.has(a[k]) ? COL.ok : COL.r2, '#f4f1ea');
    }
    // route so far
    ctx.beginPath(); for (k = 1; k < G.route.length; k++) strokeArc(G.route[k - 1], G.route[k], 1);
    ctx.lineWidth = 2.6; ctx.strokeStyle = COL.r1; ctx.stroke();
    if (G.done && G.best) {
      ctx.beginPath(); for (k = 1; k < G.best.length; k++) strokeArc(G.best[k - 1], G.best[k], 1);
      ctx.setLineDash([6, 5]); ctx.lineWidth = 2.4; ctx.strokeStyle = COL.ink; ctx.stroke(); ctx.setLineDash([]);
      for (k = 1; k < G.best.length - 1; k++) { dot(G.best[k], 4, '#f4f1ea', COL.ink); }
    }
    for (k = 0; k < G.route.length; k++) dot(G.route[k], 4, COL.r1, '#f4f1ea');
    dot(G.target, 7.5, COL.ink, '#f4f1ea'); dot(G.target, 11, null, COL.ink);
    dot(cur, 6.5, COL.r1, COL.ink);
    label(G.target, '⚑ ' + name(G.target), { bold: true, size: 13, force: true, dx: 15 });
    if (cur !== G.target) label(cur, name(cur), { bold: true, size: 13, force: true });
    if (G.done && G.best) for (k = 1; k < G.best.length - 1; k++) label(G.best[k], name(G.best[k]), { bold: true });
    for (k = 0; k < G.route.length - 1; k++) label(G.route[k], name(G.route[k]), { color: '#8a2a18' });
    if (!G.done && p1 > 0.9) for (k = 0; k < a.length; k++) label(a[k], name(a[k]), { color: '#7a5510', size: 10 });
    if (hover >= 0) dot(hover, 6, null, COL.ink);
    return more;
  }

  // ---------- panel ----------
  var listLimit = 24;
  function cityRow(i, cls) {
    return '<li' + (cls ? ' class="' + cls + '"' : '') + '><button type="button" data-go="' + i + '">' + esc(name(i)) + '</button><small>' + esc(country(i)) + '</small></li>';
  }
  function searchBox(id, ph) {
    return '<div class="search"><input type="search" id="' + id + '" placeholder="' + esc(ph) + '" autocomplete="off" spellcheck="false"><ul class="sugg" hidden></ul></div>';
  }
  function renderPanel() {
    panel.hidden = false;
    if (mode === 'game') return renderGame();
    var h = searchBox('q', t('search'));
    if (S.sel < 0) { panel.innerHTML = h + '<p class="lede">' + t('lede') + '</p>'; bindPanel(); return; }
    var i = S.sel, a = adj[i];
    h += '<h2>' + esc(name(i)) + '</h2><div class="sub">' + esc(country(i)) + (country(i) ? ' · ' : '') + t('twins')(a.length) + '</div>';
    var reach = 0; for (var d = 1; d < S.counts.length; d++) reach += S.counts[d] || 0;
    h += '<div class="rings">';
    var cols = [null, COL.r1, COL.r2, COL.r3];
    for (d = 1; d <= 3; d++) h += '<button type="button" data-ring="' + d + '" aria-pressed="' + (S.maxRing >= d) + '"><b>' + fmt(S.counts[d] || 0) + '</b><span><i style="background:' + cols[d] + '"></i>' + t('ringShort')(d) + '</span></button>';
    var restN = 0; for (d = 4; d < S.counts.length; d++) restN += S.counts[d] || 0;
    h += '<button type="button" disabled><b>' + fmt(restN) + '</b><span><i style="background:' + COL.far + '"></i>4+</span></button></div>';
    if (reach < 50 && !giant[i]) h += '<p class="note">' + t('isolated') + '</p>';
    else {
      h += '<p class="note">' + t('reach')(reach + 1, N) + ' ';
      if (S.far >= 0) h += t('farthest')([name(S.far) + (country(S.far) ? ' (' + country(S.far) + ')' : ''), S.far], S.farD);
      h += '</p>';
    }
    h += '<div class="row"><button class="btn" type="button" data-act="play">' + t('play') + '</button></div>';
    h += '<h3>' + t('pathTo') + '</h3>' + searchBox('q2', t('search'));
    if (S.pathEnd >= 0) {
      if (!S.path) h += '<p class="note">' + t('noPath') + '</p>';
      else h += '<div class="goal">' + esc(name(S.pathEnd)) + ' <span>' + t('path')(S.path.length - 1) + '</span></div><div class="route">' + S.path.map(function (j, k) { return (k ? '<em>→</em>' : '') + '<span class="' + (k === S.path.length - 1 ? 'end' : '') + '">' + esc(name(j)) + '</span>'; }).join('') + '</div>';
    }
    h += '<h3>' + t('direct') + ' · ' + a.length + '</h3><ul class="list">';
    var lim = S.showAll ? a.length : Math.min(a.length, listLimit);
    for (var k = 0; k < lim; k++) h += cityRow(a[k]);
    h += '</ul>';
    if (lim < a.length) h += '<div class="more"><span class="link" data-act="all">' + t('showAll')(a.length) + '</span></div>';
    h += '<h3>' + t('top') + '</h3><ul class="list">' + topList().map(function (j) { return '<li><button type="button" data-go="' + j + '">' + esc(name(j)) + '</button><small>' + adj[j].length + '</small></li>'; }).join('') + '</ul>';
    h += '<p class="about">' + esc(t('about').replace('{built}', D.built)) + '</p>';
    panel.innerHTML = h; bindPanel();
  }
  var topCache = null;
  function topList() { if (!topCache) { topCache = []; for (var i = 0; i < N; i++) topCache.push(i); topCache.sort(function (a, b) { return adj[b].length - adj[a].length; }); topCache = topCache.slice(0, 10); } return topCache; }

  function bindPanel() {
    panel.querySelectorAll('.search input').forEach(function (inp) { bindSearch(inp); });
  }
  panel.addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]'), act = e.target.closest('[data-act]'), ring = e.target.closest('[data-ring]');
    if (go) {
      var i = +go.getAttribute('data-go');
      if (mode === 'map') select(i); else move(i);
    } else if (ring) {
      var r = +ring.getAttribute('data-ring'); S.maxRing = S.maxRing === r ? r - 1 : r; if (S.maxRing < 1) S.maxRing = 1; renderPanel(); draw();
    } else if (act) {
      var a = act.getAttribute('data-act');
      if (a === 'all') { S.showAll = true; renderPanel(); }
      else if (a === 'play') { setMode('game', true); newGame(S.sel, S.pathEnd >= 0 && S.path ? S.pathEnd : pickTarget(S.sel, Math.random)); }
      else if (a === 'undo') undo();
      else if (a === 'hint') hint();
      else if (a === 'giveup') giveUp();
      else if (a === 'new') newGame();
      else if (a === 'daily') dailyGame();
      else if (a === 'share') share(act);
      else if (a === 'allg') { G.showAll = true; renderGame(); }
    }
  });

  function bindSearch(inp) {
    var ul = inp.nextElementSibling, items = [], sel = 0;
    function show() {
      var q = norm(inp.value.trim()); items = [];
      if (q.length >= 1) {
        var pre = [], sub = [];
        for (var i = 0; i < N && pre.length < 8; i++) {
          var s = normNames[i], at = s.indexOf(q);
          if (at < 0) continue;
          if (at === 0 || s.charAt(at - 1) === ' ') pre.push(i); else if (sub.length < 8) sub.push(i);
        }
        items = pre.concat(sub).slice(0, 8);
      }
      sel = 0;
      ul.innerHTML = items.map(function (i, k) { return '<li data-k="' + k + '" aria-selected="' + (k === sel) + '"><span>' + esc(name(i)) + '</span><small>' + esc(country(i)) + '</small></li>'; }).join('');
      ul.hidden = !items.length;
    }
    function pick(k) {
      var i = items[k]; if (i === undefined) return;
      ul.hidden = true; inp.value = '';
      if (inp.id === 'q') select(i);
      else if (inp.id === 'q2') { S.pathEnd = i; S.path = shortest(S.sel, i); renderPanel(); draw(); }
      else if (inp.id === 'gs') { inp.value = name(i); inp.dataset.pick = i; }
      else if (inp.id === 'ge') { inp.value = name(i); inp.dataset.pick = i; }
    }
    inp.addEventListener('input', show);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length); ul.querySelectorAll('li').forEach(function (li, k) { li.setAttribute('aria-selected', k === sel); }); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(sel); }
      else if (e.key === 'Escape') { ul.hidden = true; }
    });
    ul.addEventListener('mousedown', function (e) { var li = e.target.closest('li'); if (li) { e.preventDefault(); pick(+li.getAttribute('data-k')); } });
    inp.addEventListener('blur', function () { setTimeout(function () { ul.hidden = true; }, 150); });
  }

  // ---------- game ----------
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
  var POOL = 1200; // puzzle cities: the most famous ones in the big network
  function poolCity(rand) { for (var t2 = 0; t2 < 200; t2++) { var i = Math.floor(rand() * POOL); if (giant[i] && adj[i].length >= 3) return i; } return TBILISI; }
  function pickTarget(start, rand) {
    var d = bfs(start), cand = [];
    for (var i = 0; i < POOL; i++) if (d[i] >= 3 && d[i] <= 5 && adj[i].length >= 2) cand.push(i);
    if (!cand.length) for (i = 0; i < N; i++) if (d[i] >= 2) { cand.push(i); if (cand.length > 50) break; }
    return cand.length ? cand[Math.floor(rand() * cand.length)] : TBILISI;
  }
  var EPOCH = Date.UTC(2026, 10, 24);
  function dayNo() { var n = new Date(); return Math.floor((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - EPOCH) / 864e5) + 1; }
  function dailyGame() {
    var no = dayNo(), r = rng(no * 7919 + 13), s = no === 1 ? TBILISI : poolCity(r);
    newGame(s, pickTarget(s, r), no);
  }
  function newGame(start, target, daily) {
    if (start === undefined) { start = poolCity(Math.random); target = pickTarget(start, Math.random); }
    if (target === undefined) target = pickTarget(start, Math.random);
    var dT = bfs(target);
    if (dT[start] < 0) { // separate networks: keep the start, pick a reachable finish instead
      noPathNote = true; target = pickTarget(start, Math.random); dT = bfs(target);
      if (dT[start] < 0) { start = TBILISI; target = pickTarget(start, Math.random); dT = bfs(target); }
    }
    G = { start: start, target: target, cur: start, route: [start], dT: dT, hints: 0, done: false, lost: false, daily: daily || 0, closer: null, best: null, opt: dT[start], anim: performance.now(), showAll: false };
    fitBoth(start, target);
    setURL(); renderGame(); animate();
  }
  var noPathNote = false;
  function fitBoth(a, b) { fitList([a, b]); }
  function fitList(list) {
    var mobile = W < 700, pw = mobile ? 0 : 392, ph = mobile ? H * 0.52 : 0;
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    list.forEach(function (i) { x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); y0 = Math.min(y0, Y[i]); y1 = Math.max(y1, Y[i]); });
    var aw = W - pw - 80, ah = H - ph - 80;
    var k = Math.min(aw / Math.max(0.05, (x1 - x0) * base), ah / Math.max(0.05, (y1 - y0) * base));
    view.k = Math.max(0.9, Math.min(3.2, k * 0.7));
    view.x = pw + (W - pw) / 2 - (x0 + x1) / 2 * base * view.k; view.y = (H - ph) / 2 - (y0 + y1) / 2 * base * view.k;
  }
  function move(i) {
    if (!G || G.done) return;
    if (adj[G.cur].indexOf(i) < 0) return;
    G.cur = i; G.route.push(i); G.closer = null; G.anim = performance.now(); G.showAll = false;
    if (i === G.target) { G.done = true; G.best = G.opt === G.route.length - 1 ? null : shortestFromDist(G.start); gtag('event', 'twins_win', { moves: G.route.length - 1, best: G.opt }); fitList(G.route.concat(G.best || [])); }
    else if (!visibleNode(i) || !visibleNode(G.target)) fitBoth(i, G.target);
    renderGame(); animate();
  }
  function visibleNode(i) { var x = sx(i), y = sy(i), mobile = W < 700; return x > (mobile ? 30 : 420) && x < W - 30 && y > 30 && y < (mobile ? H * 0.46 : H - 30); }
  function shortestFromDist(from) { var d = G.dT, p = [from], u = from; if (d[u] < 0) return null; while (d[u] > 0) { var a = adj[u]; for (var k = 0; k < a.length; k++) if (d[a[k]] === d[u] - 1) { u = a[k]; break; } p.push(u); } return p; }
  function undo() { if (!G || G.done || G.route.length < 2) return; G.route.pop(); G.cur = G.route[G.route.length - 1]; G.closer = null; G.anim = performance.now(); renderGame(); animate(); }
  function hint() {
    if (!G || G.done) return; var d = G.dT, a = adj[G.cur]; G.closer = new Set();
    for (var k = 0; k < a.length; k++) if (d[a[k]] >= 0 && d[a[k]] < d[G.cur]) G.closer.add(a[k]);
    G.hints++; renderGame(); draw();
  }
  function giveUp() { if (!G || G.done) return; G.done = true; G.lost = true; G.best = shortestFromDist(G.cur); fitList(G.route.concat(G.best || [])); renderGame(); draw(); }
  function share(btn) {
    var url = 'https://dimazvali.com/lab/twins/?from=Q' + D.nodes.id[G.start] + '&to=Q' + D.nodes.id[G.target] + (lang === 'en' ? '&lang=en' : '');
    var txt = t('shareText')(name(G.start), name(G.target), G.route.length - 1, G.opt, G.daily) + '\n' + url;
    var done = function () { btn.textContent = t('copied'); };
    if (navigator.share && /Mobi/.test(navigator.userAgent)) navigator.share({ text: txt }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, function () {});
  }
  function renderGame() {
    panel.hidden = false;
    if (!G) dailyGame();
    var h = '', a = adj[G.cur], moves = G.route.length - 1;
    if (G.closer) a = a.filter(function (j) { return G.closer.has(j); }).concat(a.filter(function (j) { return !G.closer.has(j); })); // hinted cities first
    h += '<div class="sub">' + (G.daily ? t('daily')(G.daily) : t('custom')) + '</div>';
    if (noPathNote) { h += '<p class="note">' + t('noPath') + '</p>'; noPathNote = false; }
    h += '<div class="sub">' + t('to') + '</div><div class="goal">⚑ ' + esc(name(G.target)) + ' <span>' + esc(country(G.target)) + '</span></div>';
    h += '<div class="route">' + G.route.map(function (j, k) { return (k ? '<em>→</em>' : '') + '<span class="' + (j === G.target ? 'end' : k === G.route.length - 1 ? 'cur' : '') + '">' + esc(name(j)) + '</span>'; }).join('') + '</div>';
    h += '<div class="score">' + t('moves') + ': <b>' + moves + '</b> · ' + t('best') + ' <b>' + G.opt + '</b>' + (G.hints ? ' · ' + t('hint') + ': ' + G.hints : '') + '</div>';
    if (G.done) {
      h += '<div class="win' + (G.lost ? ' lost' : '') + '"><h4>' + (G.lost ? t('lost') : t('won')) + '</h4>';
      if (!G.lost) h += '<div>' + t('result')(moves, G.opt) + t('hints')(G.hints) + '</div>';
      if (G.best) h += '<div class="note">' + (G.lost ? '' : t('optimal')) + '</div><div class="route">' + G.best.map(function (j, k) { return (k ? '<em>→</em>' : '') + '<span>' + esc(name(j)) + '</span>'; }).join('') + '</div>';
      h += '<div class="row">' + (G.lost ? '' : '<button class="btn primary" type="button" data-act="share">' + t('share') + '</button>') + '<button class="btn" type="button" data-act="new">' + t('newGame') + '</button></div></div>';
    } else {
      h += '<div class="row"><button class="btn" type="button" data-act="undo"' + (G.route.length < 2 ? ' disabled' : '') + '>' + t('undo') + '</button><button class="btn" type="button" data-act="hint">' + t('hint') + '</button><button class="btn" type="button" data-act="giveup">' + t('giveUp') + '</button></div>';
      h += '<h3>' + t('from') + ' ' + esc(name(G.cur)) + '</h3><div class="sub" style="margin-bottom:6px">' + t('pickNext') + '</div>';
      if (a.length > 14) h += '<input class="filter" id="gf" type="search" placeholder="' + esc(t('filter')) + '" autocomplete="off">';
      var seen = new Set(G.route), lim = G.showAll ? a.length : Math.min(a.length, 40);
      h += '<ul class="list" id="gl">';
      for (var k = 0; k < lim; k++) h += cityRow(a[k], G.closer && G.closer.has(a[k]) ? 'closer' : seen.has(a[k]) ? 'seen' : '');
      h += '</ul>';
      if (lim < a.length) h += '<div class="more"><span class="link" data-act="allg">' + t('showAll')(a.length) + '</span></div>';
    }
    h += '<h3>' + t('custom') + '</h3>' + searchBox('gs', t('custStart')) + searchBox('ge', t('custEnd'));
    h += '<div class="row" style="margin-top:0"><button class="btn" type="button" id="gcust">' + t('custGo') + '</button><button class="btn" type="button" data-act="new">' + t('random') + '</button>' + (G.daily ? '' : '<button class="btn" type="button" data-act="daily">' + t('daily')(dayNo()) + '</button>') + '</div>';
    h += '<p class="lede" style="margin-top:14px;font-size:14px">' + t('gameLede') + '</p>';
    panel.innerHTML = h; bindPanel();
    var gf = document.getElementById('gf');
    if (gf) gf.addEventListener('input', function () {
      var q = norm(gf.value.trim()), ul = document.getElementById('gl'), seen = new Set(G.route), out = '';
      for (var k = 0, c = 0; k < a.length && c < 60; k++) if (!q || normNames[a[k]].indexOf(q) >= 0) { out += cityRow(a[k], G.closer && G.closer.has(a[k]) ? 'closer' : seen.has(a[k]) ? 'seen' : ''); c++; }
      ul.innerHTML = out;
    });
    document.getElementById('gcust').addEventListener('click', function () {
      var s = document.getElementById('gs').dataset.pick, e = document.getElementById('ge').dataset.pick;
      if (s === undefined) return;
      s = +s; e = e === undefined ? undefined : +e;
      if (e !== undefined && (e === s)) return;
      newGame(s, e);
    });
  }

  // ---------- mode / lang / url ----------
  function setMode(m, quiet) {
    mode = m;
    document.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === m); });
    if (quiet) return;
    if (m === 'game') { if (!G) dailyGame(); else { fitBoth(G.cur, G.target); renderGame(); } }
    else { renderPanel(); if (S.sel >= 0) centerOn(S.sel); }
    setURL(); draw();
  }
  function setLang(l) {
    lang = l; document.documentElement.lang = l; store('twins-lang', l);
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lang') === l); });
    document.querySelectorAll('[data-i]').forEach(function (el) { var v = T[l][el.getAttribute('data-i')]; if (typeof v === 'string') el.textContent = v; });
    if (D) { renderPanel(); draw(); }
  }
  function setURL() {
    var q = new URLSearchParams();
    if (mode === 'game' && G) { q.set('from', 'Q' + D.nodes.id[G.start]); q.set('to', 'Q' + D.nodes.id[G.target]); }
    else if (S.sel >= 0 && S.sel !== TBILISI) q.set('city', 'Q' + D.nodes.id[S.sel]);
    if (mode === 'game' && G && G.daily) { q.delete('from'); q.delete('to'); q.set('play', 'daily'); }
    var p = new URLSearchParams(location.search); if (p.get('lang')) q.set('lang', p.get('lang'));
    var s = q.toString(); history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
  }
  function byQ(v) { var m = /^Q?(\d+)$/i.exec(v || ''); return m && qIndex.has(+m[1]) ? qIndex.get(+m[1]) : -1; }

  // ---------- input ----------
  var hover = -1, drag = null, pinch = null, moved = false;
  function nearest(px, py) {
    var best = -1, bd = 14 * 14;
    var prefer = null;
    if (mode === 'game' && G && !G.done) prefer = adj[G.cur];
    else if (mode === 'map' && S.sel >= 0) prefer = adj[S.sel];
    if (prefer) for (var k = 0; k < prefer.length; k++) { var i = prefer[k], dx = sx(i) - px, dy = sy(i) - py, d = dx * dx + dy * dy; if (d < bd * 1.6) { bd = d / 1.6; best = i; } }
    if (mode === 'game' && best >= 0) return best;
    if (mode === 'game') return -1;
    for (i = 0; i < N; i++) { dx = sx(i) - px; dy = sy(i) - py; d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  function pos(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function showTip(i, x, y) {
    if (i < 0) { tip.hidden = true; return; }
    tip.innerHTML = esc(name(i)) + ' <small>' + esc(country(i)) + ' · ' + t('tipTwins')(adj[i].length) + (mode === 'map' && S.sel >= 0 && S.dist[i] > 0 ? ' · ' + t('ring')(S.dist[i]) : '') + '</small>';
    tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.hidden = false;
  }
  var pointers = new Map();
  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, pos(e)); moved = false;
    if (pointers.size === 1) { var p = pos(e); drag = { x: p[0], y: p[1], vx: view.x, vy: view.y }; canvas.classList.add('drag'); }
    else if (pointers.size === 2) { var ps = [...pointers.values()]; pinch = { d: Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]), k: view.k }; drag = null; }
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = pos(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2) {
      var ps = [...pointers.values()], d = Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]);
      zoomAt(pinch.k * d / pinch.d / view.k, (ps[0][0] + ps[1][0]) / 2, (ps[0][1] + ps[1][1]) / 2); moved = true; return;
    }
    if (drag) {
      if (Math.abs(p[0] - drag.x) + Math.abs(p[1] - drag.y) > 4) moved = true;
      if (moved) { view.x = drag.vx + p[0] - drag.x; view.y = drag.vy + p[1] - drag.y; tip.hidden = true; draw(); }
      return;
    }
    if (e.pointerType === 'mouse' && D) {
      var i = nearest(p[0], p[1]);
      if (i !== hover) { hover = i; draw(); }
      canvas.classList.toggle('hot', i >= 0); showTip(i, p[0], p[1]);
    }
  });
  function up(e) {
    var p = pos(e); pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && !moved && D) {
      var i = nearest(p[0], p[1]);
      if (i >= 0) { if (mode === 'map') select(i, { center: false }); else move(i); }
      if (e.pointerType !== 'mouse') { showTip(i, p[0], p[1]); setTimeout(function () { tip.hidden = true; }, 1600); }
    }
    drag = null; canvas.classList.remove('drag');
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', function (e) { pointers.delete(e.pointerId); drag = null; pinch = null; });
  canvas.addEventListener('pointerleave', function () { if (hover >= 0) { hover = -1; draw(); } tip.hidden = true; });
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); var p = pos(e); zoomAt(Math.exp(-e.deltaY * 0.0015), p[0], p[1]); }, { passive: false });
  document.getElementById('zin').addEventListener('click', function () { zoomAt(1.6, W / 2, H / 2); });
  document.getElementById('zout').addEventListener('click', function () { zoomAt(1 / 1.6, W / 2, H / 2); });
  document.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); }); });
  document.querySelectorAll('[data-lang]').forEach(function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); }); });
  window.addEventListener('resize', resize);

  // ---------- boot ----------
  var qs = new URLSearchParams(location.search);
  var l0 = qs.get('lang') || store('twins-lang') || ((navigator.language || 'ru').slice(0, 2) === 'ru' ? 'ru' : (navigator.language || '').slice(0, 2) === 'ka' ? 'ru' : 'en');
  setLang(l0 === 'en' ? 'en' : 'ru');
  fetch('/lab/twins/data.json?v=1').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (data) {
    prepare(data); loading.remove(); resize();
    var from = byQ(qs.get('from')), to = byQ(qs.get('to'));
    if (qs.get('play') === 'daily' || from >= 0) {
      setMode('game', true);
      if (from >= 0) newGame(from, to >= 0 && to !== from ? to : undefined); else dailyGame();
      var c = byQ(qs.get('city')); select(c >= 0 ? c : TBILISI, { center: false }); mode = 'game'; renderGame(); fitBoth(G.cur, G.target); draw();
    } else {
      var c2 = byQ(qs.get('city')); select(c2 >= 0 ? c2 : TBILISI, { center: c2 >= 0 });
    }
  }).catch(function () { loading.textContent = t('loadErr'); });
})();
