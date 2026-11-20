// "Чьи улицы Тбилиси" — the Tbilisi road network split by who the streets are named after.
// Data: data.json, built by scripts/tbilisi-streets/6-build.js from OSM + Wikidata.
(function () {
  'use strict';

  // ── categories ──
  // people first (these are the game's answers), then everything that is not a person
  var CAT = {
    writers:  { c: '#c0392b', ru: 'Писатели и поэты',        en: 'Writers & poets',        gru: 'писателей',            gen: 'Writers’',            opt: ['Писатель или поэт', 'A writer or poet'] },
    royals:   { c: '#b8860b', ru: 'Цари и святые',           en: 'Kings & saints',         gru: 'царей и святых',       gen: 'Kings’ and saints’',  opt: ['Царь или святой', 'A king or a saint'] },
    science:  { c: '#2e6fb5', ru: 'Учёные и врачи',          en: 'Scientists & doctors',   gru: 'учёных',               gen: 'Scientists’',         opt: ['Учёный или врач', 'A scientist or doctor'] },
    military: { c: '#5b6b2a', ru: 'Военные и герои',         en: 'Soldiers & heroes',      gru: 'военных',              gen: 'Soldiers’',           opt: ['Военный или герой', 'A soldier or hero'] },
    politics: { c: '#7d3c98', ru: 'Политики и общественники', en: 'Politicians & public figures', gru: 'политиков',     gen: 'Politicians’',        opt: ['Политик или общественник', 'A politician or public figure'] },
    stage:    { c: '#e07b1f', ru: 'Театр и кино',            en: 'Stage & screen',         gru: 'актёров и режиссёров', gen: 'Actors’',             opt: ['Актёр или режиссёр', 'An actor or director'] },
    artists:  { c: '#d0307a', ru: 'Художники и архитекторы', en: 'Artists & architects',   gru: 'художников',           gen: 'Artists’',            opt: ['Художник или архитектор', 'An artist or architect'] },
    music:    { c: '#13998a', ru: 'Музыка',                  en: 'Music',                  gru: 'музыкантов',           gen: 'Musicians’',          opt: ['Композитор или музыкант', 'A composer or musician'] },
    sport:    { c: '#2f9e44', ru: 'Спорт',                   en: 'Sport',                  gru: 'спортсменов',          gen: 'Athletes’',           opt: ['Спортсмен', 'An athlete'] },
    person:   { c: '#8d877d', ru: 'Не знаем, кто это',       en: 'People we don’t know yet', gru: 'неизвестных людей',  gen: 'Unknown people’s' },
    georgia:  { c: '#b39b7d', ru: 'Края и города Грузии',    en: 'Georgian places',        gru: 'грузинских мест',      gen: 'Georgian places’' },
    world:    { c: '#5f7281', ru: 'Мир',                     en: 'The world',              gru: 'других стран',         gen: 'The world’s' },
    dates:    { c: '#7a4e3a', ru: 'Даты и битвы',            en: 'Dates & battles',        gru: 'дат и битв',           gen: 'Dates’ and battles’' },
    ideas:    { c: '#9aa3a8', ru: 'Идеи',                    en: 'Ideas',                  gru: 'идей',                 gen: 'Ideas’' },
    nature:   { c: '#8fae5a', ru: 'Природа и вино',          en: 'Nature & wine',          gru: 'природы и вина',       gen: 'Nature’s' },
    service:  { c: '#cbc5b8', ru: 'Просто улицы',            en: 'Just streets',           gru: 'просто улиц',          gen: 'Plain' },
  };
  var PEOPLE = ['writers', 'royals', 'science', 'military', 'politics', 'stage', 'artists', 'music', 'sport'];

  var T = {
    ru: {
      title: 'Чьи улицы Тбилиси', map: 'Карта', game: 'Угадайка',
      loading: 'Загружаем 2000 км улиц…',
      lead: 'Все именованные улицы города, разложенные по тем, в честь кого они названы. Нажмите на категорию, чтобы увидеть её Тбилиси, или на улицу — чтобы узнать, кто это.',
      total: '{km} км улиц с именами', people: 'Люди', things: 'Не люди', all: 'Весь Тбилиси',
      cityOf: 'Тбилиси {x}', share: '{p}% улиц · {km} км', foreign: 'Иностранцы', female: 'Женщины',
      foreignTag: 'иностранец', femaleTag: 'женщина', guessTag: 'догадка', born: 'род. {y}', wiki: 'Wikidata →',
      note: 'Данные: OpenStreetMap (ODbL) и Wikidata. Профессии определены автоматически и вычитаны вручную у самых длинных улиц — ошибки возможны. «Не знаем, кто это» — люди без статьи в грузинской Википедии; часто это погибшие в войнах 1990-х и 2008 года.',
      hint: 'колесо — масштаб, перетаскивание — сдвиг',
      round: 'Вопрос {n} из {t}', ask: 'В честь кого названа эта улица?', next: 'Дальше', finish: 'Итог',
      right: 'Верно!', wrongIs: 'Нет — это {cat}.', again: 'Ещё раз', shareBtn: 'Поделиться', copied: 'Скопировано',
      result: 'из {t}', best: 'Лучший результат: {b}', start: 'Начать', gameLead: 'Покажем улицу на карте — угадайте, кем был человек, в честь которого её назвали. 10 вопросов.',
      ranks: ['Турист', 'Гость из Кутаиси', 'Таксист со стажем', 'Краевед', 'Ходячая энциклопедия Сололаки'],
      shareText: 'Я угадал {s} из {t} в «Чьих улицах Тбилиси»: ',
      unknownPerson: 'Человек, о котором мы пока ничего не знаем',
      classic: '10 вопросов', endless: 'На выживание', endlessGo: 'На выживание →',
      endlessLead: 'Вопросы без конца, до первой ошибки. Чем дальше, тем незаметнее улицы. Лучшие серии попадают в таблицу.',
      streak: 'Серия', over: 'Ошибка — серия окончена', yourStreak: 'Ваша серия', nick: 'Имя для таблицы',
      save: 'В таблицу рекордов', saved: 'Сохранено', top: 'Топ-10 на выживание', noTop: 'Пока никого — станьте первым.',
      tooFast: 'Слишком быстрые ответы — эта серия в таблицу не попадёт.', netErr: 'Нет связи с сервером. Попробуйте ещё раз.',
      perfect: 'Вы ответили на все вопросы, что у нас есть!', shareEndless: 'Моя серия в «Чьих улицах Тбилиси» — {s} подряд: ',
    },
    en: {
      title: 'Whose Streets, Tbilisi?', map: 'Map', game: 'Quiz',
      loading: 'Loading 2,000 km of streets…',
      lead: 'Every named street in the city, split by who it is named after. Tap a category to see its Tbilisi, or a street to see who it is.',
      total: '{km} km of named streets', people: 'People', things: 'Not people', all: 'All of Tbilisi',
      cityOf: '{x} Tbilisi', share: '{p}% of streets · {km} km', foreign: 'Foreigners', female: 'Women',
      foreignTag: 'foreigner', femaleTag: 'woman', guessTag: 'guess', born: 'b. {y}', wiki: 'Wikidata →',
      note: 'Data: OpenStreetMap (ODbL) and Wikidata. Occupations were matched automatically and hand-checked for the longest streets — mistakes are possible. “People we don’t know yet” have no Georgian Wikipedia article; many died in the wars of the 1990s and 2008.',
      hint: 'wheel to zoom, drag to pan',
      round: 'Question {n} of {t}', ask: 'Who is this street named after?', next: 'Next', finish: 'Result',
      right: 'Correct!', wrongIs: 'No — {cat}.', again: 'Play again', shareBtn: 'Share', copied: 'Copied',
      result: 'of {t}', best: 'Best: {b}', start: 'Start', gameLead: 'We show a street on the map — guess who the person it is named after was. 10 questions.',
      ranks: ['Tourist', 'Weekend visitor', 'Seasoned taxi driver', 'Local historian', 'Walking encyclopedia of Sololaki'],
      shareText: 'I got {s} of {t} in “Whose Streets, Tbilisi?”: ',
      unknownPerson: 'Someone we know nothing about yet',
      classic: '10 questions', endless: 'Endless', endlessGo: 'Go endless →',
      endlessLead: 'Questions keep coming until your first mistake, and the streets get more obscure. The best streaks make the table.',
      streak: 'Streak', over: 'Wrong — the streak is over', yourStreak: 'Your streak', nick: 'Name for the table',
      save: 'Save my record', saved: 'Saved', top: 'Endless top 10', noTop: 'Nobody yet — be the first.',
      tooFast: 'Answers came too fast — this streak can’t go into the table.', netErr: 'Can’t reach the server. Please try again.',
      perfect: 'You answered every question we have!', shareEndless: 'My streak in “Whose Streets, Tbilisi?”: {s} in a row: ',
    },
  };
  var ROUNDS = 10;

  // ── helpers ──
  var $ = function (id) { return document.getElementById(id); };
  function fill(s, v) { return s.replace(/\{(\w+)\}/g, function (m, k) { return v[k]; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function fmtKm(v) { return v >= 100 ? Math.round(v).toLocaleString(lang) : v.toLocaleString(lang, { maximumFractionDigits: 1 }); }
  function track(ev, p) { try { window.gtag && gtag('event', ev, p || {}); } catch (e) { /* no analytics */ } }

  var qLang = new URLSearchParams(location.search).get('lang');
  var lang = qLang === 'en' || qLang === 'ru' ? qLang : (lsGet('streets-lang') || ((navigator.language || 'ru').slice(0, 2) === 'ru' ? 'ru' : 'en'));
  function t(k) { return T[lang][k]; }
  function catName(c) { return CAT[c][lang]; }

  // ── data ──
  var D, CATS, ways = [], names = [], totalKm = 0;
  // way: {n: name index, r: rank, p: Float32Array of absolute coords, x0,y0,x1,y1}
  // name: {cat, flags, pru, pen, sru, sen, ska, born, wd, ways: [], len, bbox}

  function decode(data) {
    D = data; CATS = data.cats;
    names = data.names.map(function (r) {
      return { cat: CATS[r[0]], foreign: !!(r[1] & 1), female: !!(r[1] & 2), guess: !!(r[1] & 4),
        pru: r[2], pen: r[3], sru: r[4], sen: r[5], ska: r[6], born: r[7], wd: r[8], ways: [], len: 0,
        bbox: [Infinity, Infinity, -Infinity, -Infinity] };
    });
    data.ways.forEach(function (w) {
      var f = w[2], p = new Float32Array(f.length), x = 0, y = 0, len = 0;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (var i = 0; i < f.length; i += 2) {
        var nx = x + f[i], ny = y + f[i + 1];
        if (i) len += Math.hypot(nx - x, ny - y);
        x = nx; y = ny; p[i] = x; p[i + 1] = y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      var way = { n: w[0], r: w[1], p: p, x0: x0, y0: y0, x1: x1, y1: y1, len: len * data.q / 1000 };
      ways.push(way);
      var nm = names[w[0]];
      nm.ways.push(way); nm.len += way.len;
      nm.bbox = [Math.min(nm.bbox[0], x0), Math.min(nm.bbox[1], y0), Math.max(nm.bbox[2], x1), Math.max(nm.bbox[3], y1)];
    });
    CATS.forEach(function (c) { totalKm += data.km[c]; });
    buildGrid();
  }

  // spatial grid of segments for hit-testing
  var GRID = 150, grid = {};
  function buildGrid() {
    ways.forEach(function (w, wi) {
      for (var i = 2; i < w.p.length; i += 2) {
        var ax = w.p[i - 2], ay = w.p[i - 1], bx = w.p[i], by = w.p[i + 1];
        var gx0 = Math.floor(Math.min(ax, bx) / GRID), gx1 = Math.floor(Math.max(ax, bx) / GRID);
        var gy0 = Math.floor(Math.min(ay, by) / GRID), gy1 = Math.floor(Math.max(ay, by) / GRID);
        for (var gx = gx0; gx <= gx1; gx++) for (var gy = gy0; gy <= gy1; gy++) {
          var k = gx + ':' + gy;
          (grid[k] || (grid[k] = [])).push(wi * 65536 + i);
        }
      }
    });
  }
  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    var u = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
    return Math.hypot(px - ax - u * dx, py - ay - u * dy);
  }
  function hit(wx, wy, r) {
    var best = null, bd = r;
    var gx0 = Math.floor((wx - r) / GRID), gx1 = Math.floor((wx + r) / GRID), gy0 = Math.floor((wy - r) / GRID), gy1 = Math.floor((wy + r) / GRID);
    for (var gx = gx0; gx <= gx1; gx++) for (var gy = gy0; gy <= gy1; gy++) {
      var cell = grid[gx + ':' + gy];
      if (!cell) continue;
      for (var j = 0; j < cell.length; j++) {
        var wi = Math.floor(cell[j] / 65536), i = cell[j] % 65536, p = ways[wi].p;
        if (!visibleWay(ways[wi])) continue;
        var d = segDist(wx, wy, p[i - 2], p[i - 1], p[i], p[i + 1]);
        if (d < bd) { bd = d; best = ways[wi]; }
      }
    }
    return best;
  }

  // ── view ──
  var cv = $('map'), ctx = cv.getContext('2d'), dpr = 1, W = 0, H = 0;
  var view = { s: 1, x: 0, y: 0 }; // screen = (world - x) * s
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    draw();
  }
  function fit(b, pad, animate) {
    var bw = Math.max(b[2] - b[0], 600), bh = Math.max(b[3] - b[1], 600);
    var s = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh);
    var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    var target = { s: s, x: cx - W / 2 / s, y: cy - H / 2 / s };
    if (!animate) { view = target; draw(); return; }
    var from = { s: view.s, x: view.x, y: view.y }, t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / 450), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      // interpolate the centre and the log of the scale, so the zoom feels even
      var s1 = Math.exp(Math.log(from.s) + (Math.log(target.s) - Math.log(from.s)) * e);
      var fcx = from.x + W / 2 / from.s, tcx = target.x + W / 2 / target.s;
      var fcy = from.y + H / 2 / from.s, tcy = target.y + H / 2 / target.s;
      view = { s: s1, x: fcx + (tcx - fcx) * e - W / 2 / s1, y: fcy + (tcy - fcy) * e - H / 2 / s1 };
      draw();
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function zoomAt(sx, sy, k) {
    var ns = Math.max(0.02, Math.min(4, view.s * k));
    var wx = view.x + sx / view.s, wy = view.y + sy / view.s;
    view = { s: ns, x: wx - sx / ns, y: wy - sy / ns };
    draw();
  }

  // ── what is shown ──
  var st = { mode: 'map', cat: null, foreign: false, female: false, sel: null, game: null };
  function filtered() { return st.cat || st.foreign || st.female; }
  function matches(nm) {
    if (st.cat && nm.cat !== st.cat) return false;
    if (st.foreign && !nm.foreign) return false;
    if (st.female && !nm.female) return false;
    return true;
  }
  function visibleWay(w) { return st.mode === 'game' ? false : (!filtered() || matches(names[w.n])); }

  var raf = 0;
  function draw() { if (!raf) raf = requestAnimationFrame(render); }
  function render() {
    raf = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var s = view.s, vx0 = view.x, vy0 = view.y, vx1 = vx0 + W / s, vy1 = vy0 + H / s;
    var zoomW = Math.max(0.6, Math.min(3.2, Math.sqrt(s * 6)));
    var groups = {}; // "color|width" → Path2D
    function add(w, color, width) {
      if (w.x1 < vx0 || w.x0 > vx1 || w.y1 < vy0 || w.y0 > vy1) return;
      var key = color + '|' + width, path = groups[key] || (groups[key] = new Path2D());
      var p = w.p;
      path.moveTo((p[0] - vx0) * s, (p[1] - vy0) * s);
      for (var i = 2; i < p.length; i += 2) path.lineTo((p[i] - vx0) * s, (p[i + 1] - vy0) * s);
    }
    var widths = [0, 0.7, 1.2, 1.9];
    var game = st.mode === 'game' && st.game && st.game.cur;
    var revealed = game && st.game.answered;
    var order = []; // draw the highlighted layer last
    for (var i = 0; i < ways.length; i++) {
      var w = ways[i], nm = names[w.n], wd = widths[w.r] * zoomW;
      if (game) {
        if (nm === game.name) { order.push(w); continue; }
        add(w, '#d9d3c6', wd * 0.8);
      } else if (st.mode !== 'map' || !filtered()) {
        add(w, CAT[nm.cat].c, wd);
      } else if (matches(nm)) {
        order.push(w);
      } else {
        add(w, '#ddd7cb', wd * 0.8);
      }
    }
    order.forEach(function (w) {
      var nm = names[w.n];
      var color = game ? (revealed ? CAT[nm.cat].c : '#15120f') : CAT[nm.cat].c;
      add(w, color, Math.max(2.2, widths[w.r] * zoomW * 1.6));
    });
    if (st.sel && !game) st.sel.ways.forEach(function (w) { add(w, '#15120f', Math.max(3.5, widths[w.r] * zoomW * 2.4)); });
    // stable z-order: thin base first, then by insertion (highlight/selection were added last)
    Object.keys(groups).forEach(function (k) {
      var parts = k.split('|');
      ctx.strokeStyle = parts[0]; ctx.lineWidth = +parts[1];
      ctx.stroke(groups[k]);
    });
    if (game) { // a pulsing ring around a short street so it is findable
      var b = game.name.bbox, cx = ((b[0] + b[2]) / 2 - vx0) * s, cy = ((b[1] + b[3]) / 2 - vy0) * s;
      var rr = Math.max(28, Math.hypot(b[2] - b[0], b[3] - b[1]) * s / 2 + 18);
      ctx.strokeStyle = 'rgba(21,18,15,.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // ── pointer: pan, pinch, wheel, tap ──
  var ptrs = {}, drag = null, moved = false;
  cv.addEventListener('pointerdown', function (e) {
    cv.setPointerCapture(e.pointerId);
    ptrs[e.pointerId] = { x: e.offsetX, y: e.offsetY };
    moved = false;
    drag = { x: e.offsetX, y: e.offsetY, vx: view.x, vy: view.y, s: view.s, d: pinchDist() };
    cv.classList.add('drag');
  });
  function pinchDist() {
    var k = Object.keys(ptrs);
    if (k.length < 2) return 0;
    return Math.hypot(ptrs[k[0]].x - ptrs[k[1]].x, ptrs[k[0]].y - ptrs[k[1]].y);
  }
  cv.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return;
    ptrs[e.pointerId] = { x: e.offsetX, y: e.offsetY };
    var k = Object.keys(ptrs);
    if (k.length === 2) {
      var d = pinchDist();
      if (!drag.d) { drag = { x: e.offsetX, y: e.offsetY, vx: view.x, vy: view.y, s: view.s, d: d }; return; }
      var mx = (ptrs[k[0]].x + ptrs[k[1]].x) / 2, my = (ptrs[k[0]].y + ptrs[k[1]].y) / 2;
      zoomAt(mx, my, d / drag.d * drag.s / view.s);
      moved = true;
      return;
    }
    var dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    if (moved) { view.x = drag.vx - dx / view.s; view.y = drag.vy - dy / view.s; draw(); }
  });
  function up(e) {
    var wasTap = !moved && Object.keys(ptrs).length === 1;
    delete ptrs[e.pointerId];
    cv.classList.remove('drag');
    if (Object.keys(ptrs).length) { var k = Object.keys(ptrs)[0]; drag = { x: ptrs[k].x, y: ptrs[k].y, vx: view.x, vy: view.y, s: view.s, d: 0 }; return; }
    if (wasTap && e.type === 'pointerup') tap(e.offsetX, e.offsetY, e.pointerType === 'touch' ? 16 : 9);
  }
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });
  $('zin').onclick = function () { zoomAt(W / 2, H / 2, 1.6); };
  $('zout').onclick = function () { zoomAt(W / 2, H / 2, 1 / 1.6); };

  function tap(sx, sy, rpx) {
    if (st.mode !== 'map') return;
    var w = hit(view.x + sx / view.s, view.y + sy / view.s, rpx / view.s);
    st.sel = w ? names[w.n] : null;
    showCard(st.sel);
    draw();
    if (w) track('streets_tap', { cat: st.sel.cat });
  }

  // ── street card ──
  function streetName(nm) { return (lang === 'ru' ? nm.sru || nm.sen : nm.sen || nm.sru) || nm.ska; }
  function personName(nm) {
    if (nm.cat === 'person' && !nm.pru && !nm.pen) return t('unknownPerson');
    return lang === 'ru' ? nm.pru || nm.pen : nm.pen || nm.pru;
  }
  function tags(nm) {
    var h = '<span class="tag" style="background:' + CAT[nm.cat].c + '">' + esc(catName(nm.cat)) + '</span>';
    if (nm.foreign) h += '<span class="tag" style="background:#15120f">' + t('foreignTag') + '</span>';
    if (nm.female) h += '<span class="tag" style="background:#9b2c5a">' + t('femaleTag') + '</span>';
    if (nm.guess) h += '<span class="tag" style="background:#9a948b">' + t('guessTag') + '</span>';
    return h;
  }
  function whoLine(nm) {
    var who = personName(nm), extra = [];
    if (nm.born) extra.push(fill(t('born'), { y: nm.born < 0 ? -nm.born + (lang === 'ru' ? ' до н. э.' : ' BC') : nm.born }));
    var h = who ? '<div class="who">' + esc(who) + (extra.length ? ' <span class="muted">· ' + extra.join(' · ') + '</span>' : '') + '</div>' : '';
    if (nm.wd) h += '<div class="who"><a href="https://www.wikidata.org/wiki/' + esc(nm.wd) + '" target="_blank" rel="noopener">' + t('wiki') + '</a></div>';
    return h;
  }
  function showCard(nm) {
    var el = $('card');
    if (!nm) { el.hidden = true; return; }
    el.innerHTML = '<button class="x" aria-label="×">×</button>' +
      '<div class="ka">' + esc(nm.ska) + '</div><div class="street">' + esc(streetName(nm)) + '</div>' +
      whoLine(nm) + '<div>' + tags(nm) + '</div>';
    el.hidden = false;
    el.querySelector('.x').onclick = function () { st.sel = null; el.hidden = true; draw(); };
  }

  // ── side panel: map mode ──
  // every counter follows the active filters: category rows count only foreigners/women when those
  // are on, and the filter buttons count only inside the chosen category
  function kmOf(pred) { var s = 0; names.forEach(function (n) { if (pred(n)) s += n.len; }); return s; }
  function passFlags(n, skip) { return (skip === 'foreign' || !st.foreign || n.foreign) && (skip === 'female' || !st.female || n.female); }
  function pct(v) { return (100 * v / allKm).toFixed(1).replace('.', lang === 'ru' ? ',' : '.'); }
  var allKm = 0;
  function renderMapSide() {
    var side = $('side');
    if (!allKm) allKm = kmOf(function () { return true; });
    var catKm = {};
    CATS.forEach(function (c) { catKm[c] = kmOf(function (n) { return n.cat === c && passFlags(n); }); });
    var selKm = kmOf(matches);
    var head = st.cat ? fill(t('cityOf'), { x: lang === 'ru' ? CAT[st.cat].gru : CAT[st.cat].gen }) : t('all');
    if (!st.cat && (st.foreign || st.female)) head = [st.foreign ? t('foreign') : '', st.female ? t('female') : ''].filter(Boolean).join(' + ');
    var h = '<h1>' + esc(head) + '</h1>';
    if (filtered()) {
      h += '<div class="total">' + fill(t('share'), { p: pct(selKm), km: fmtKm(selKm) }) + '</div>';
    } else {
      h += '<p class="lead">' + t('lead') + '</p><div class="total">' + fill(t('total'), { km: fmtKm(allKm) }) + '</div>';
    }
    function flagKm(f) { return kmOf(function (n) { return n[f] && (!st.cat || n.cat === st.cat) && passFlags(n, f); }); }
    h += '<div class="filters">' +
      '<button data-f="foreign" aria-pressed="' + st.foreign + '">' + t('foreign') + ' · ' + fmtKm(flagKm('foreign')) + ' км</button>' +
      '<button data-f="female" aria-pressed="' + st.female + '">' + t('female') + ' · ' + fmtKm(flagKm('female')) + ' км</button></div>';
    var maxKm = Math.max.apply(null, CATS.map(function (c) { return catKm[c]; })) || 1;
    function row(c) {
      return '<button class="cat" data-c="' + c + '" aria-pressed="' + (st.cat === c) + '"' + (catKm[c] ? '' : ' style="opacity:.4"') + '><i style="background:' + CAT[c].c + '"></i>' +
        '<b>' + esc(catName(c)) + '</b><em>' + fmtKm(catKm[c]) + '</em>' +
        '<span class="bar"><span style="width:' + (100 * catKm[c] / maxKm).toFixed(1) + '%;background:' + CAT[c].c + '"></span></span></button>';
    }
    var ppl = CATS.filter(function (c) { return PEOPLE.indexOf(c) >= 0 || c === 'person'; }).sort(function (a, b) { return catKm[b] - catKm[a]; });
    var oth = CATS.filter(function (c) { return ppl.indexOf(c) < 0; }).sort(function (a, b) { return catKm[b] - catKm[a]; });
    // keep "unknown people" at the bottom of the people list
    ppl.splice(ppl.indexOf('person'), 1); ppl.push('person');
    h += '<div class="group">' + t('people') + '</div>' + ppl.map(row).join('');
    h += '<div class="group">' + t('things') + '</div>' + oth.map(row).join('');
    h += '<p class="note">' + t('note') + '</p>';
    side.innerHTML = lang === 'en' ? h.replace(/ км</g, ' km<') : h;
    side.querySelectorAll('.cat').forEach(function (b) {
      b.onclick = function () {
        var c = b.getAttribute('data-c');
        st.cat = st.cat === c ? null : c;
        if (st.sel && !matches(st.sel)) { st.sel = null; showCard(null); }
        renderMapSide(); draw();
        if (st.cat) track('streets_cat', { cat: st.cat });
      };
    });
    side.querySelectorAll('[data-f]').forEach(function (b) {
      b.onclick = function () {
        var f = b.getAttribute('data-f');
        st[f] = !st[f];
        if (st.sel && !matches(st.sel)) { st.sel = null; showCard(null); }
        renderMapSide(); draw();
      };
    });
  }

  // ── game ──
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function pickQuestions() {
    // people with a known occupation, weighted towards longer (better-known) streets
    var pool = names.filter(function (n) { return PEOPLE.indexOf(n.cat) >= 0 && !n.guess && n.len > 0.25 && (n.pru || n.pen); });
    var picked = [], used = {}, cats = {};
    var tries = 0;
    while (picked.length < ROUNDS && tries++ < 5000) {
      var tot = 0;
      pool.forEach(function (n) { tot += Math.sqrt(n.len); });
      var r = Math.random() * tot, n = null;
      for (var i = 0; i < pool.length; i++) { r -= Math.sqrt(pool[i].len); if (r <= 0) { n = pool[i]; break; } }
      if (!n || used[personName(n)]) continue;
      if ((cats[n.cat] || 0) >= 3) continue; // not ten writers in a row
      used[personName(n)] = 1; cats[n.cat] = (cats[n.cat] || 0) + 1;
      picked.push(n);
    }
    return picked;
  }
  function newGame() {
    st.game = { qs: pickQuestions(), i: 0, score: [], answered: false, cur: null };
    st.sel = null; showCard(null);
    nextQuestion();
    track('streets_game_start');
  }
  function nextQuestion() {
    var g = st.game;
    if (g.i >= g.qs.length) return renderGameEnd();
    var name = g.qs[g.i];
    var opts = shuffle(PEOPLE.filter(function (c) { return c !== name.cat; })).slice(0, 3).concat([name.cat]);
    g.cur = { name: name, opts: shuffle(opts) };
    g.answered = false;
    renderGameSide();
    fit(name.bbox, 60, true);
  }
  function scoreBar(g) {
    var h = '<div class="score">';
    for (var i = 0; i < ROUNDS; i++) h += '<i class="' + (g.score[i] === true ? 'ok' : g.score[i] === false ? 'no' : '') + '"></i>';
    return h + '</div>';
  }
  function renderGameSide() {
    var g = st.game, q = g.cur, side = $('side');
    var h = '<div class="game">' + scoreBar(g) + '<h2>' + fill(t('round'), { n: g.i + 1, t: g.qs.length }) + '</h2>' +
      '<div class="q">' + esc(streetName(q.name)) + '</div><div class="q-ka">' + esc(q.name.ska) + '</div>' +
      '<p class="muted">' + t('ask') + '</p><div class="opts">';
    q.opts.forEach(function (c) {
      h += '<button data-c="' + c + '"><i style="background:' + CAT[c].c + '"></i>' + esc(CAT[c].opt[lang === 'ru' ? 0 : 1]) + '</button>';
    });
    h += '</div><div id="reveal"></div></div>';
    side.innerHTML = h;
    side.querySelectorAll('.opts button').forEach(function (b) { b.onclick = function () { answer(b.getAttribute('data-c')); }; });
    side.scrollTop = 0;
  }
  function answer(c) {
    var g = st.game, q = g.cur;
    if (g.answered) return;
    g.answered = true;
    var ok = c === q.name.cat;
    g.score.push(ok);
    $('side').querySelectorAll('.opts button').forEach(function (b) {
      var bc = b.getAttribute('data-c');
      b.disabled = true;
      if (bc === q.name.cat) b.classList.add('right');
      else if (bc === c) b.classList.add('wrong');
    });
    var last = g.i + 1 >= g.qs.length;
    $('reveal').innerHTML = '<div class="reveal"><b>' + (ok ? t('right') : esc(fill(t('wrongIs'), { cat: CAT[q.name.cat].opt[lang === 'ru' ? 0 : 1].toLowerCase() }))) + '</b>' +
      whoLine(q.name) + '<div>' + tags(q.name) + '</div></div>' +
      '<button class="primary" id="next">' + (last ? t('finish') : t('next')) + '</button>';
    $('next').onclick = function () { g.i++; nextQuestion(); };
    $('next').focus({ preventScroll: true });
    scoreRefresh();
    draw();
  }
  function scoreRefresh() { var el = $('side').querySelector('.score'); if (el) el.outerHTML = scoreBar(st.game); }
  function renderGameEnd() {
    var g = st.game, s = g.score.filter(Boolean).length, best = Math.max(+lsGet('streets-best') || 0, s);
    lsSet('streets-best', String(best));
    g.cur = null;
    var rank = t('ranks')[Math.min(4, Math.floor(s / 2.5))];
    $('side').innerHTML = '<div class="game">' + scoreBar(g) + '<h2>' + t('finish') + '</h2>' +
      '<div class="big">' + s + ' <span class="muted" style="font-size:22px">' + fill(t('result'), { t: g.qs.length }) + '</span></div>' +
      '<div class="q">' + esc(rank) + '</div><p class="muted">' + fill(t('best'), { b: best }) + '</p>' +
      '<button class="primary" id="go-endless">' + t('endlessGo') + '</button>' +
      '<p class="muted" style="margin:8px 0 0">' + t('endlessLead') + '</p>' +
      '<button class="primary ghost" id="share">' + t('shareBtn') + '</button>' +
      '<button class="primary ghost" id="again">' + t('again') + '</button></div>';
    $('go-endless').onclick = startEndless;
    $('again').onclick = newGame;
    $('share').onclick = function () {
      var url = location.origin + location.pathname + '#game';
      var text = fill(t('shareText'), { s: s, t: g.qs.length }) + g.score.map(function (x) { return x ? '🟩' : '🟥'; }).join('');
      if (navigator.share) navigator.share({ text: text, url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + url).then(function () { $('share').textContent = t('copied'); });
      track('streets_share', { score: s });
    };
    fit(D.bbox, 20, true);
    track('streets_game_end', { score: s });
  }
  function renderGameIntro() {
    $('side').innerHTML = '<div class="game"><h1>' + t('game') + '</h1><p class="lead">' + t('gameLead') + '</p>' +
      (lsGet('streets-best') ? '<p class="muted">' + fill(t('best'), { b: lsGet('streets-best') }) + '</p>' : '') +
      '<button class="primary" id="start">' + t('classic') + '</button>' +
      '<p class="lead" style="margin-top:22px">' + t('endlessLead') + '</p>' +
      '<button class="primary ghost" id="endless">' + t('endless') + '</button>' +
      '<div id="top"></div></div>';
    $('start').onclick = newGame;
    $('endless').onclick = startEndless;
    loadTop();
  }

  // ── endless run: questions come from the server, which also checks the answers ──
  function deviceId() {
    var d = lsGet('streets-device');
    if (!d || !/^[A-Za-z0-9-]{16,64}$/.test(d)) {
      d = window.crypto && crypto.randomUUID ? crypto.randomUUID()
        : (Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 32);
      lsSet('streets-device', d);
    }
    return d;
  }
  var API = '/lab/streets/';
  function api(path, body) {
    var opts = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    return fetch(API + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok && !j.error) j.error = 'http'; return j; });
    });
  }
  function topHtml(list) {
    if (!list || !list.length) return '<p class="muted">' + t('noTop') + '</p>';
    return '<ol class="top">' + list.map(function (r) {
      return '<li' + (r.me ? ' class="me"' : '') + '><span>' + r.rank + '</span><b>' + esc(r.nick) + '</b><em>' + r.streak + '</em></li>';
    }).join('') + '</ol>';
  }
  function loadTop() {
    api('scores?d=' + encodeURIComponent(deviceId())).then(function (j) {
      var el = $('top');
      if (el && j.top) el.innerHTML = '<div class="group">' + t('top') + '</div>' + topHtml(j.top);
    }).catch(function () { /* the table is optional */ });
  }
  function startEndless() {
    st.game = { endless: true, streak: 0, answered: false, cur: null, run: null };
    st.sel = null; showCard(null);
    $('side').innerHTML = '<p class="muted">…</p>';
    api('run', { deviceId: deviceId() }).then(function (r) {
      if (!r.run || !r.q) throw new Error(r.error || 'run');
      st.game.run = r.run;
      endlessQuestion(r.q);
      track('streets_endless_start');
    }).catch(function () { $('side').innerHTML = '<p class="muted">' + t('netErr') + '</p><button class="primary" id="retry">' + t('again') + '</button>'; $('retry').onclick = startEndless; });
  }
  function endlessQuestion(q) {
    var g = st.game;
    g.cur = { name: names[q.n], opts: q.opts };
    g.answered = false;
    renderEndlessSide();
    fit(g.cur.name.bbox, 60, true);
  }
  function renderEndlessSide() {
    var g = st.game, q = g.cur;
    var h = '<div class="game"><h2>' + t('streak') + '</h2><div class="big" style="font-size:44px">' + g.streak + '</div>' +
      '<div class="q">' + esc(streetName(q.name)) + '</div><div class="q-ka">' + esc(q.name.ska) + '</div>' +
      '<p class="muted">' + t('ask') + '</p><div class="opts">';
    q.opts.forEach(function (c) {
      h += '<button data-c="' + c + '"><i style="background:' + CAT[c].c + '"></i>' + esc(CAT[c].opt[lang === 'ru' ? 0 : 1]) + '</button>';
    });
    h += '</div><div id="reveal"></div></div>';
    $('side').innerHTML = h;
    $('side').querySelectorAll('.opts button').forEach(function (b) { b.onclick = function () { answerEndless(b.getAttribute('data-c')); }; });
  }
  function answerEndless(c) {
    var g = st.game;
    if (g.answered || g.busy) return;
    g.busy = true;
    var btns = $('side').querySelectorAll('.opts button');
    btns.forEach(function (b) { b.disabled = true; });
    api('answer', { run: g.run, cat: c }).then(function (r) {
      g.busy = false;
      if (r.error) throw new Error(r.error);
      g.answered = true;
      g.streak = r.streak;
      btns.forEach(function (b) {
        var bc = b.getAttribute('data-c');
        if (bc === r.cat) b.classList.add('right'); else if (bc === c) b.classList.add('wrong');
      });
      var name = g.cur.name;
      var over = !r.correct || !r.q;
      var head = r.correct ? (r.q ? t('right') : t('perfect')) : t('over');
      $('reveal').innerHTML = '<div class="reveal"><b>' + esc(head) + '</b>' + whoLine(name) + '<div>' + tags(name) + '</div></div>' +
        '<button class="primary" id="next">' + (over ? t('finish') : t('next')) + '</button>';
      $('next').onclick = function () { if (over) renderEndlessEnd(); else endlessQuestion(r.q); };
      $('next').focus({ preventScroll: true });
      var big = $('side').querySelector('.big'); if (big) big.textContent = g.streak;
      draw();
    }).catch(function () {
      g.busy = false;
      btns.forEach(function (b) { b.disabled = false; });
      $('reveal').innerHTML = '<p class="muted">' + t('netErr') + '</p>';
    });
  }
  function renderEndlessEnd() {
    var g = st.game, s = g.streak, best = Math.max(+lsGet('streets-best-endless') || 0, s);
    lsSet('streets-best-endless', String(best));
    g.cur = null; g.over = true;
    var h = '<div class="game"><h2>' + t('yourStreak') + '</h2><div class="big">' + s + '</div>' +
      '<p class="muted">' + fill(t('best'), { b: best }) + '</p>';
    if (s >= 1 && !g.saved) {
      h += '<label class="muted" for="nick">' + t('nick') + '</label>' +
        '<input id="nick" maxlength="20" autocomplete="nickname" value="' + esc(lsGet('streets-nick') || '') + '">' +
        '<button class="primary" id="save">' + t('save') + '</button><p class="muted" id="saveMsg"></p>';
    }
    h += '<button class="primary ghost" id="share">' + t('shareBtn') + '</button>' +
      '<button class="primary ghost" id="again">' + t('again') + '</button><div id="top"></div></div>';
    $('side').innerHTML = h;
    $('again').onclick = startEndless;
    $('share').onclick = function () {
      var url = location.origin + location.pathname + '#game';
      var text = fill(t('shareEndless'), { s: s });
      if (navigator.share) navigator.share({ text: text, url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text + url).then(function () { $('share').textContent = t('copied'); });
      track('streets_share', { streak: s, mode: 'endless' });
    };
    if ($('save')) $('save').onclick = function () {
      var nick = $('nick').value.trim();
      if (!nick) { $('nick').focus(); return; }
      lsSet('streets-nick', nick);
      $('save').disabled = true;
      api('scores', { run: g.run, deviceId: deviceId(), nick: nick }).then(function (r) {
        if (r.error === 'time') { $('saveMsg').textContent = t('tooFast'); return; }
        if (r.error) { $('saveMsg').textContent = t('netErr'); $('save').disabled = false; return; }
        g.saved = true;
        $('save').textContent = t('saved');
        $('top').innerHTML = '<div class="group">' + t('top') + '</div>' + topHtml(r.top);
      }).catch(function () { $('saveMsg').textContent = t('netErr'); $('save').disabled = false; });
    };
    loadTop();
    fit(D.bbox, 20, true);
    track('streets_endless_end', { streak: s });
  }
  function renderGame() {
    var g = st.game;
    if (!g) return renderGameIntro();
    if (g.endless) {
      if (g.cur && !g.answered) return renderEndlessSide();
      if (g.over || !g.cur) return renderEndlessEnd();
      return; // answered, waiting for "next": keep the reveal as it is
    }
    if (g.cur && !g.answered) return renderGameSide();
    if (!g.cur) return renderGameEnd();
  }

  // ── chrome ──
  function setMode(m) {
    st.mode = m;
    $('tab-map').setAttribute('aria-pressed', m === 'map');
    $('tab-game').setAttribute('aria-pressed', m === 'game');
    if (m === 'map') { st.game = null; renderMapSide(); history.replaceState(null, '', location.pathname + location.search); }
    else { st.sel = null; showCard(null); renderGame(); history.replaceState(null, '', '#game'); }
    draw();
  }
  function applyLang() {
    document.documentElement.lang = lang;
    document.title = t('title') + ' — dimazvali.com';
    document.querySelector('.logo').firstChild.nodeValue = t('title');
    $('tab-map').textContent = t('map');
    $('tab-game').textContent = t('game');
    $('hint').textContent = t('hint');
    document.querySelectorAll('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang); });
  }
  document.querySelectorAll('.lang button').forEach(function (b) {
    b.onclick = function () {
      lang = b.getAttribute('data-lang'); lsSet('streets-lang', lang); applyLang();
      if (!D) return;
      if (st.mode === 'map') { renderMapSide(); showCard(st.sel); }
      else renderGame();
    };
  });
  $('tab-map').onclick = function () { setMode('map'); };
  $('tab-game').onclick = function () { setMode('game'); };
  window.addEventListener('resize', resize);
  document.addEventListener('keydown', function (e) {
    if (st.mode !== 'game' || !st.game || !st.game.cur || e.target.tagName === 'INPUT') return;
    if (!st.game.answered && /^[1-4]$/.test(e.key)) (st.game.endless ? answerEndless : answer)(st.game.cur.opts[+e.key - 1]);
    else if (st.game.answered && (e.key === 'Enter' || e.key === ' ') && $('next')) { e.preventDefault(); $('next').click(); }
  });

  applyLang();
  $('side').innerHTML = '<p class="muted">' + t('loading') + '</p>';
  resize();
  fetch('data.json?v=1').then(function (r) { return r.json(); }).then(function (data) {
    decode(data);
    fit(D.bbox, 12, false);
    setMode(location.hash === '#game' ? 'game' : 'map');
  }).catch(function (e) {
    $('side').innerHTML = '<p class="muted">Не получилось загрузить данные: ' + esc(e.message) + '</p>';
  });
})();
