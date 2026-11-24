// Review queue for /lab/streets/admin/: ok / not ok / later per street name, with corrections.
(function () {
  'use strict';
  var BOOT = JSON.parse(document.getElementById('boot').textContent);
  var BASE = BOOT.base;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var CAT_RU = {
    writers: 'Писатели и поэты', royals: 'Цари и святые', science: 'Учёные и врачи', military: 'Военные и герои',
    politics: 'Политики и общественники', stage: 'Театр и кино', artists: 'Художники и архитекторы', music: 'Музыка',
    sport: 'Спорт', person: 'Не знаем, кто это', georgia: 'Края и города Грузии', world: 'Мир', dates: 'Даты и битвы',
    ideas: 'Идеи', nature: 'Природа и вино', service: 'Просто улицы',
  };
  var CAT_RU_SPB = { georgia: 'Города и края России', ideas: 'Идеи, профессии и заводы', nature: 'Реки, острова и природа', politics: 'Политики и революционеры' };
  var CAT_COLOR = {
    writers: '#c0392b', royals: '#b8860b', science: '#2e6fb5', military: '#5b6b2a', politics: '#7d3c98', stage: '#e07b1f',
    artists: '#d0307a', music: '#13998a', sport: '#2f9e44', person: '#8d877d', georgia: '#b39b7d', world: '#5f7281',
    dates: '#7a4e3a', ideas: '#9aa3a8', nature: '#8fae5a', service: '#cbc5b8',
  };
  var DATA_URL = { tbilisi: '/lab/streets/data.json?v=2', spb: '/lab/streets/data-spb.json?v=1' };
  var PUBLIC = { tbilisi: '/lab/streets/', spb: '/lab/streets/spb/' };
  var STATUS_RU = { ok: 'ок', bad: 'не ок', later: 'отложено' };

  var st = { city: localStorage.getItem('lab-admin-city') || BOOT.cities[0].id, rows: [], total: 0, sel: -1, loading: false, stats: {} };
  if (!BOOT.cities.some(function (c) { return c.id === st.city; })) st.city = BOOT.cities[0].id;
  function catName(c) { return (st.city === 'spb' && CAT_RU_SPB[c]) || CAT_RU[c] || c; }
  function cityConf() { return BOOT.cities.filter(function (c) { return c.id === st.city; })[0]; }

  function api(path, body) {
    var opts = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    opts.credentials = 'same-origin';
    return fetch(BASE + '/api/' + path, opts).then(function (r) {
      if (r.status === 401) { location.href = BASE + '/login'; throw new Error('auth'); }
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'http ' + r.status); return j; });
    });
  }

  // ── cities, stats, filters ──
  function renderCities() {
    $('cities').innerHTML = BOOT.cities.map(function (c) {
      return '<button data-c="' + c.id + '" aria-pressed="' + (c.id === st.city) + '">' + esc(c.name) + '</button>';
    }).join('');
    $('cities').querySelectorAll('button').forEach(function (b) {
      b.onclick = function () { st.city = b.dataset.c; localStorage.setItem('lab-admin-city', st.city); renderCities(); fillCats(); renderStats(); loadList(true); loadMap(); };
    });
  }
  function fillCats() {
    var cur = $('f-cat').value;
    $('f-cat').innerHTML = '<option value="">Все категории</option>' + cityConf().cats.map(function (c) {
      return '<option value="' + c + '">' + esc(catName(c)) + '</option>';
    }).join('');
    $('f-cat').value = cur;
  }
  function loadStats() { return api('stats').then(function (s) { st.stats = s; renderStats(); }); }
  function renderStats() {
    var s = st.stats[st.city];
    if (!s) return;
    var done = s.ok + s.bad + s.later;
    $('stats').innerHTML = 'Проверено <b>' + done + '</b> из ' + s.names + ' · ок <b>' + s.ok + '</b> · не ок <b>' + s.bad + '</b> · отложено <b>' + s.later +
      '</b> · по длине ' + Math.round(100 * s.reviewedKm / s.km) + '% (' + s.reviewedKm + ' из ' + s.km + ' км)';
    var w = function (n) { return (100 * n / s.names).toFixed(2) + '%'; };
    $('progress').innerHTML = '<i style="width:' + w(s.ok) + ';background:var(--ok)"></i><i style="width:' + w(s.bad) + ';background:var(--bad)"></i><i style="width:' + w(s.later) + ';background:var(--later)"></i>';
  }
  ['f-status', 'f-cat', 'f-flag'].forEach(function (id) { $(id).onchange = function () { loadList(true); }; });
  var qTimer = 0;
  $('f-q').oninput = function () { clearTimeout(qTimer); qTimer = setTimeout(function () { loadList(true); }, 250); };

  // ── the queue ──
  function query(offset) {
    return 'streets?city=' + st.city + '&status=' + $('f-status').value + '&cat=' + encodeURIComponent($('f-cat').value) +
      '&flag=' + $('f-flag').value + '&q=' + encodeURIComponent($('f-q').value) + '&offset=' + offset + '&limit=60';
  }
  function loadList(reset) {
    if (st.loading) return;
    st.loading = true;
    var offset = reset ? 0 : st.rows.length;
    api(query(offset)).then(function (j) {
      st.rows = reset ? j.rows : st.rows.concat(j.rows);
      st.total = j.total;
      st.loading = false;
      renderList();
      if (reset) select(st.rows.length ? 0 : -1);
    }).catch(function (e) { st.loading = false; $('list').innerHTML = '<p class="more msg err">' + esc(e.message) + '</p>'; });
  }
  function personOf(r) { return r.personRu || r.personEn || r.personKa || ''; }
  function streetOf(r) { return st.city === 'spb' ? r.streetRu || r.streetEn : r.streetRu || r.streetKa; }
  function renderList() {
    var h = st.rows.map(function (r, i) {
      return '<div class="row" data-i="' + i + '" aria-selected="' + (i === st.sel) + '"><span class="dot ' + (r.review ? r.review.status : '') + '"></span>' +
        '<span class="st">' + esc(streetOf(r)) + '</span><span class="km">' + r.km.toFixed(1) + ' км</span>' +
        '<span class="who">' + esc(catName(r.cat)) + (personOf(r) ? ' · ' + esc(personOf(r)) : '') + (r.guess ? ' · догадка' : '') +
        (r.suggestions.length ? ' · 💬 ' + r.suggestions.length : '') + '</span></div>';
    }).join('');
    if (st.rows.length < st.total) h += '<div class="more"><button class="btn" id="more">Ещё (' + (st.total - st.rows.length) + ')</button></div>';
    if (!st.rows.length) h = '<p class="more">Пусто. ' + ($('f-status').value === 'todo' ? 'Всё проверено 🎉' : '') + '</p>';
    $('list').innerHTML = h;
    $('list').querySelectorAll('.row').forEach(function (el) { el.onclick = function () { select(+el.dataset.i); }; });
    if ($('more')) $('more').onclick = function () { loadList(false); };
  }
  function select(i) {
    st.sel = i;
    $('list').querySelectorAll('.row').forEach(function (el) { el.setAttribute('aria-selected', +el.dataset.i === i); });
    var el = $('list').querySelector('.row[data-i="' + i + '"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
    renderDetail(st.rows[i]);
  }

  // ── the detail panel ──
  function renderDetail(r) {
    var d = $('detail');
    if (!r) { d.innerHTML = '<div class="empty">Выберите улицу слева</div>'; return; }
    var fix = (r.review && r.review.fix) || {};
    var alt = [r.streetKa, r.streetEn, r.streetRu].filter(function (x) { return x && x !== streetOf(r); }).join(' · ');
    var h = '<div class="d-alt">' + esc(alt) + '</div><div class="d-street">' + esc(streetOf(r)) + '</div>' +
      '<div>' + (personOf(r) ? esc(personOf(r)) : '<span class="d-alt">человек не указан</span>') + (r.born ? ' <span class="d-alt">· род. ' + r.born + '</span>' : '') +
      (r.wd ? ' · <a href="https://www.wikidata.org/wiki/' + esc(r.wd) + '" target="_blank" rel="noopener">' + esc(r.wd) + ' ↗</a>' : '') + '</div>' +
      '<div><span class="tag" style="background:' + (CAT_COLOR[r.cat] || '#888') + '">' + esc(catName(r.cat)) + '</span>' +
      (r.originalCat && r.originalCat !== r.cat ? '<span class="tag was" title="так было после автоматической разметки">' + esc(catName(r.originalCat)) + '</span>' : '') +
      (r.foreign ? '<span class="tag" style="background:#15120f">иностранец</span>' : '') + (r.female ? '<span class="tag" style="background:#9b2c5a">женщина</span>' : '') +
      (r.guess ? '<span class="tag" style="background:#9a948b">догадка</span>' : '') + ' <span class="d-alt">' + r.km.toFixed(2) + ' км</span></div>' +
      (r.review ? '<div class="d-alt">Вердикт: <b>' + STATUS_RU[r.review.status] + '</b>' + (r.review.by ? ' · ' + esc(r.review.by) : '') +
        (r.review.at ? ' · ' + esc(r.review.at.slice(0, 10)) : '') + (r.review.note ? ' · «' + esc(r.review.note) + '»' : '') + '</div>' : '') +
      '<canvas id="mini"></canvas>' +
      '<a href="' + PUBLIC[st.city] + '?focus=' + encodeURIComponent(r.key) + '" target="_blank" rel="noopener">Показать на карте ↗</a>';
    r.suggestions.forEach(function (s) {
      h += '<div class="sugg" data-id="' + esc(s.id) + '">💬 ' + (s.cat ? '<b>' + esc(catName(s.cat)) + '</b> · ' : '') + esc(s.text || '') +
        (s.contact ? ' <span class="d-alt">(' + esc(s.contact) + ')</span>' : '') + ' <span class="d-alt">' + esc((s.createdAt || '').slice(0, 10)) + '</span>' +
        '<div class="acts"><button class="btn s-use">Подставить в форму</button><button class="btn s-done">Учтено</button><button class="btn s-no">Отклонить</button></div></div>';
    });
    h += '<div class="form">' +
      '<div class="full"><label for="e-cat">Категория</label><select id="e-cat">' + cityConf().cats.map(function (c) {
        return '<option value="' + c + '"' + (c === r.cat ? ' selected' : '') + '>' + esc(catName(c)) + '</option>';
      }).join('') + '</select></div>' +
      '<div><label for="e-ru">Человек (рус.)</label><input type="text" id="e-ru" value="' + esc(r.personRu || '') + '"></div>' +
      '<div><label for="e-en">Человек (англ.)</label><input type="text" id="e-en" value="' + esc(r.personEn || '') + '"></div>' +
      '<div class="full checks"><label><input type="checkbox" id="e-foreign"' + (r.foreign ? ' checked' : '') + '> иностранец</label>' +
      '<label><input type="checkbox" id="e-female"' + (r.female ? ' checked' : '') + '> женщина</label></div>' +
      '<div class="full"><label for="e-note">Заметка</label><input type="text" id="e-note" value="' + esc((r.review && r.review.note) || '') + '" placeholder="что не так, источник…"></div>' +
      '</div>' +
      '<div class="verdict"><button class="ok" data-v="ok">Ок<kbd>1</kbd></button><button class="bad" data-v="bad">Не ок<kbd>2</kbd></button><button class="later" data-v="later">Отложить<kbd>3</kbd></button></div>' +
      '<div class="msg" id="msg"></div>' +
      '<div class="hint">↑/↓ или j/k — соседняя улица · 1/2/3 — вердикт (вместе с правками в форме) · Ctrl+Enter в поле — «ок»</div>';
    d.innerHTML = h;
    d.querySelectorAll('.verdict button').forEach(function (b) { b.onclick = function () { verdict(b.dataset.v); }; });
    d.querySelectorAll('.sugg').forEach(function (el) {
      var s = r.suggestions.filter(function (x) { return x.id === el.dataset.id; })[0];
      el.querySelector('.s-use').onclick = function () {
        if (s.cat) $('e-cat').value = s.cat;
        $('e-note').value = (s.text || '').slice(0, 300);
      };
      el.querySelector('.s-done').onclick = function () { closeSuggestion(r, s, 'applied', el); };
      el.querySelector('.s-no').onclick = function () { closeSuggestion(r, s, 'dismissed', el); };
    });
    d.querySelectorAll('input[type=text]').forEach(function (inp) {
      inp.onkeydown = function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) verdict('ok'); };
    });
    drawMini(r);
  }
  function closeSuggestion(r, s, status, el) {
    api('suggestions/' + encodeURIComponent(s.id), { city: st.city, status: status }).then(function () {
      r.suggestions = r.suggestions.filter(function (x) { return x !== s; });
      el.remove();
      renderList();
    }).catch(function (e) { $('msg').textContent = e.message; $('msg').className = 'msg err'; });
  }

  // a verdict saves the form's corrections too (only what differs from what is shown now)
  function verdict(status) {
    var r = st.rows[st.sel];
    if (!r) return;
    var body = { city: st.city, key: r.key, status: status, note: $('e-note').value };
    if ($('e-cat').value !== r.cat) body.cat = $('e-cat').value;
    if ($('e-ru').value.trim() !== (r.personRu || '')) body.personRu = $('e-ru').value;
    if ($('e-en').value.trim() !== (r.personEn || '')) body.personEn = $('e-en').value;
    if ($('e-foreign').checked !== r.foreign) body.foreign = $('e-foreign').checked;
    if ($('e-female').checked !== r.female) body.female = $('e-female').checked;
    $('msg').textContent = 'Сохраняю…'; $('msg').className = 'msg';
    document.querySelectorAll('.verdict button').forEach(function (b) { b.disabled = true; });
    api('review', body).then(function (j) {
      r.review = j.review;
      if (body.cat) r.cat = body.cat;
      if (body.personRu !== undefined) r.personRu = body.personRu.trim();
      if (body.personEn !== undefined) r.personEn = body.personEn.trim();
      if (body.foreign !== undefined) r.foreign = body.foreign;
      if (body.female !== undefined) r.female = body.female;
      r.guess = false;
      var f = $('f-status').value;
      // the row leaves a status-filtered queue it no longer belongs to; the next one takes its place
      if (f !== 'all' && f !== status) { st.rows.splice(st.sel, 1); st.total--; renderList(); select(Math.min(st.sel, st.rows.length - 1)); }
      else { renderList(); select(Math.min(st.sel + 1, st.rows.length - 1)); }
      loadStats();
      if (st.rows.length < 15 && st.rows.length < st.total) loadList(false);
    }).catch(function (e) {
      $('msg').textContent = 'Не сохранилось: ' + e.message; $('msg').className = 'msg err';
      document.querySelectorAll('.verdict button').forEach(function (b) { b.disabled = false; });
    });
  }

  // ── mini map: the city in grey, the street in red ──
  var maps = {};
  function loadMap() {
    if (maps[st.city]) return Promise.resolve(maps[st.city]);
    var city = st.city;
    return fetch(DATA_URL[city]).then(function (r) { return r.json(); }).then(function (d) {
      var ways = d.ways.map(function (w) {
        var f = w[2], p = [], x = 0, y = 0;
        for (var i = 0; i < f.length; i += 2) { x += f[i]; y += f[i + 1]; p.push(x, y); }
        return { n: w[0], r: w[1], p: p };
      });
      var byKey = {};
      d.names.forEach(function (row, i) { byKey[city === 'spb' ? row[4] || row[5] : row[6] || row[4]] = i; });
      maps[city] = { ways: ways, byKey: byKey };
      if (city === st.city && st.rows[st.sel]) drawMini(st.rows[st.sel]);
      return maps[city];
    });
  }
  function drawMini(r) {
    var cv = $('mini'), m = maps[st.city];
    if (!cv || !m) return;
    var dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, W, H);
    var idx = m.byKey[r.key], mine = m.ways.filter(function (w) { return w.n === idx; });
    if (!mine.length) { ctx.fillStyle = '#9a948b'; ctx.fillText('нет геометрии', 10, 20); return; }
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    mine.forEach(function (w) { for (var i = 0; i < w.p.length; i += 2) { x0 = Math.min(x0, w.p[i]); x1 = Math.max(x1, w.p[i]); y0 = Math.min(y0, w.p[i + 1]); y1 = Math.max(y1, w.p[i + 1]); } });
    var pad = 400; // units of 2 m: ~800 m around the street
    var s = Math.min(W / (x1 - x0 + 2 * pad), H / (y1 - y0 + 2 * pad));
    var ox = (x0 + x1) / 2 - W / 2 / s, oy = (y0 + y1) / 2 - H / 2 / s;
    function path(w) {
      ctx.beginPath();
      for (var i = 0; i < w.p.length; i += 2) { var X = (w.p[i] - ox) * s, Y = (w.p[i + 1] - oy) * s; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
      ctx.stroke();
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#d9d3c6';
    var vx0 = ox, vy0 = oy, vx1 = ox + W / s, vy1 = oy + H / s;
    m.ways.forEach(function (w) {
      if (w.n === idx) return;
      var p = w.p, inView = false;
      for (var i = 0; i < p.length && !inView; i += 2) inView = p[i] >= vx0 && p[i] <= vx1 && p[i + 1] >= vy0 && p[i + 1] <= vy1;
      if (!inView) return;
      ctx.lineWidth = w.r >= 3 ? 2 : w.r === 2 ? 1.4 : 0.8;
      path(w);
    });
    ctx.strokeStyle = '#c9302c'; ctx.lineWidth = 3.5;
    mine.forEach(path);
  }

  // ── keyboard ──
  document.addEventListener('keydown', function (e) {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); if (st.sel < st.rows.length - 1) select(st.sel + 1); }
    else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); if (st.sel > 0) select(st.sel - 1); }
    else if (e.key === '1') verdict('ok');
    else if (e.key === '2') verdict('bad');
    else if (e.key === '3') verdict('later');
  });
  window.addEventListener('resize', function () { if (st.rows[st.sel]) drawMini(st.rows[st.sel]); });

  renderCities();
  fillCats();
  loadStats();
  loadList(true);
  loadMap();
})();
