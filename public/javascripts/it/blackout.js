// "Тбилиси без света" — whack-a-mole on the Tbilisi district map.
(function () {
  'use strict';

  var TYPES = {
    light: { without: 'без света', key: '1' },
    water: { without: 'без воды', key: '2' },
    gas: { without: 'без газа', key: '3' },
  };
  var LIVES = 5;
  var FIXES_PER_LEVEL = 10;
  var RING_R = 24;
  var RING_C = 2 * Math.PI * RING_R;
  var SVGNS = 'http://www.w3.org/2000/svg';

  // Difficulty curve: first only light, then faster, then water, then gas.
  function levelConfig(level) {
    var types = ['light'];
    if (level >= 3) types.push('water');
    if (level >= 5) types.push('gas');
    return {
      types: types,
      spawnEvery: Math.max(450, 1900 - (level - 1) * 160),
      lifetime: Math.max(2200, 5200 - (level - 1) * 280),
      maxActive: Math.min(9, 1 + level),
    };
  }
  var LEVEL_NEWS = {
    2: 'Уровень 2 — отключают чаще',
    3: 'Новое: отключили воду! Нужен сантехник — кнопка 2',
    4: 'Уровень 4 — аварии идут пачками',
    5: 'Новое: газ! Газовщик — кнопка 3',
  };

  var $ = function (id) { return document.getElementById(id); };
  var districtEls = {};
  var centers = {};
  Array.prototype.forEach.call(document.querySelectorAll('.district'), function (el) {
    var id = el.getAttribute('data-id');
    districtEls[id] = el;
    var label = $('l-' + id);
    centers[id] = { x: +label.getAttribute('x'), y: +label.getAttribute('y') - 46, label: label };
  });
  var districtIds = Object.keys(districtEls);

  var badgesG = $('badges');
  var fxG = $('fx');
  var toolButtons = document.querySelectorAll('.tool');

  var state = null;
  var rafId = 0;
  var lastTs = 0;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function readBest() { return +lsGet('blackout-best') || 0; }
  function writeBest(v) { lsSet('blackout-best', String(v)); }

  // ── high scores (server-side top-10, one row per device) ──
  var deviceId = lsGet('blackout-device');
  if (!deviceId || !/^[A-Za-z0-9-]{16,64}$/.test(deviceId)) {
    deviceId = window.crypto && crypto.randomUUID ? crypto.randomUUID()
      : 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    lsSet('blackout-device', deviceId);
  }
  var topList = null; // last fetched top-10

  function renderScores(list) {
    topList = list;
    document.querySelectorAll('.scores').forEach(function (box) {
      var ol = box.querySelector('ol');
      var empty = box.querySelector('.empty');
      ol.innerHTML = '';
      if (!list) { empty.textContent = 'таблица не загрузилась'; empty.hidden = false; return; }
      empty.textContent = 'пока пусто — будь первым';
      empty.hidden = list.length > 0;
      list.forEach(function (r) {
        var li = document.createElement('li');
        if (r.me) li.className = 'me';
        [['n', r.rank], ['nick', r.nick], ['s', r.score]].forEach(function (c) {
          var span = document.createElement('span');
          span.className = c[0];
          span.textContent = c[1];
          li.appendChild(span);
        });
        ol.appendChild(li);
      });
    });
  }

  function fetchScores() {
    return fetch('/blackout/scores?d=' + encodeURIComponent(deviceId), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { renderScores(j.top); return j.top; })
      .catch(function () { renderScores(null); return null; });
  }

  function qualifies(list, score) {
    if (!list || score <= 0) return false;
    var mine = list.filter(function (r) { return r.me; })[0];
    if (mine && mine.score >= score) return false; // this device already has a better row
    return list.length < 10 || score > list[list.length - 1].score;
  }

  function offerNick(result) {
    fetchScores().then(function (list) {
      if (!qualifies(list, result.score)) return;
      var form = $('nickForm');
      $('nickInput').value = lsGet('blackout-nick') || '';
      $('nickErr').textContent = '';
      $('nickBtn').disabled = false;
      form.hidden = false;
      form.onsubmit = function (e) {
        e.preventDefault();
        var nick = $('nickInput').value.trim();
        if (!nick) return;
        $('nickBtn').disabled = true;
        fetch('/blackout/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: deviceId, nick: nick, score: result.score, level: result.level, fixes: result.fixes }),
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            if (!res.ok) throw new Error(res.j && res.j.error === 'rate' ? 'Слишком часто, попробуй позже' : 'Не получилось сохранить');
            lsSet('blackout-nick', nick);
            form.hidden = true;
            renderScores(res.j.top);
          })
          .catch(function (err) {
            $('nickErr').textContent = err.message || 'Нет связи';
            $('nickBtn').disabled = false;
          });
      };
      if (window.matchMedia('(hover: hover)').matches) $('nickInput').focus();
    });
  }

  function newState() {
    return {
      running: true, time: 0, nextSpawn: 600, score: 0, level: 1, fixes: 0, lives: LIVES,
      combo: 0, tool: 'light', unlocked: { light: true }, active: {}, // key "district:type" -> outage
    };
  }

  // ── rendering helpers ──
  function renderHud() {
    $('score').textContent = state.score;
    $('level').textContent = state.level;
    var lives = $('lives');
    if (lives.children.length !== LIVES) {
      lives.innerHTML = '';
      for (var i = 0; i < LIVES; i++) lives.appendChild(document.createElement('i'));
    }
    for (var j = 0; j < LIVES; j++) lives.children[j].classList.toggle('off', j >= state.lives);
    $('combo').textContent = state.combo >= 5 ? '×' + comboMult() + ' комбо' : '';
  }

  function comboMult() { return Math.min(4, 1 + Math.floor(state.combo / 5)); }

  function outagesIn(id) {
    var list = [];
    for (var k in state.active) if (state.active[k].id === id) list.push(state.active[k]);
    return list.sort(function (a, b) { return a.start - b.start; });
  }

  // District fill shows the oldest (most urgent) outage; badges sit side by side at the centre.
  function renderDistrict(id) {
    var list = outagesIn(id);
    var el = districtEls[id];
    el.classList.remove('light', 'water', 'gas');
    if (list.length) el.classList.add(list[0].type);
    centers[id].label.classList.toggle('on', list.length > 0);
    var c = centers[id];
    list.forEach(function (o, i) {
      var x = c.x + (i - (list.length - 1) / 2) * 58;
      o.el.setAttribute('transform', 'translate(' + x + ' ' + c.y + ')');
    });
  }

  function makeBadge(type) {
    var g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'badge ' + type);
    var inner = document.createElementNS(SVGNS, 'g');
    inner.setAttribute('class', 'pop');
    var bg = document.createElementNS(SVGNS, 'circle');
    bg.setAttribute('r', RING_R + 3); bg.setAttribute('class', 'bg');
    var ring = document.createElementNS(SVGNS, 'circle');
    ring.setAttribute('r', RING_R); ring.setAttribute('class', 'ring');
    ring.setAttribute('stroke-dasharray', RING_C.toFixed(1));
    var ico = document.createElementNS(SVGNS, 'use');
    ico.setAttribute('href', '#i-' + type); ico.setAttribute('class', 'ico');
    ico.setAttribute('x', -14); ico.setAttribute('y', -14); ico.setAttribute('width', 28); ico.setAttribute('height', 28);
    inner.appendChild(bg); inner.appendChild(ring); inner.appendChild(ico);
    g.appendChild(inner);
    badgesG.appendChild(g);
    return { el: g, ring: ring };
  }

  function floatText(id, text, color) {
    var c = centers[id];
    var t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('class', 'float');
    t.setAttribute('x', c.x); t.setAttribute('y', c.y - 34);
    t.setAttribute('fill', color);
    t.textContent = text;
    fxG.appendChild(t);
    setTimeout(function () { t.remove(); }, 850);
  }

  function flash(id, cls) {
    var el = districtEls[id];
    el.classList.remove(cls);
    void el.getBBox(); // restart the animation
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 650);
  }

  var bannerTimer = 0;
  function banner(text) {
    var b = $('banner');
    b.textContent = text;
    b.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { b.hidden = true; }, 2600);
  }

  // ── tools ──
  function setTool(type) {
    if (!state || !state.unlocked[type]) return;
    state.tool = type;
    toolButtons.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-type') === type); });
  }

  function unlockTypes() {
    levelConfig(state.level).types.forEach(function (t) {
      if (state.unlocked[t]) return;
      state.unlocked[t] = true;
      var btn = document.querySelector('.tool[data-type="' + t + '"]');
      btn.hidden = false;
      btn.classList.add('new');
      setTimeout(function () { btn.classList.remove('new'); }, 2200);
    });
  }

  function resetTools() {
    toolButtons.forEach(function (b) {
      var t = b.getAttribute('data-type');
      b.hidden = t !== 'light';
      b.classList.toggle('active', t === 'light');
    });
  }

  // ── game logic ──
  function spawn() {
    var cfg = levelConfig(state.level);
    if (Object.keys(state.active).length >= cfg.maxActive) return;
    var candidates = [];
    districtIds.forEach(function (id) {
      cfg.types.forEach(function (t) { if (!state.active[id + ':' + t]) candidates.push([id, t]); });
    });
    if (!candidates.length) return;
    var pick = candidates[Math.floor(Math.random() * candidates.length)];
    var badge = makeBadge(pick[1]);
    // a little jitter so outages don't all expire in lockstep
    var life = cfg.lifetime * (0.85 + Math.random() * 0.3);
    state.active[pick[0] + ':' + pick[1]] = { id: pick[0], type: pick[1], start: state.time, life: life, el: badge.el, ring: badge.ring };
    renderDistrict(pick[0]);
  }

  function removeOutage(key) {
    var o = state.active[key];
    delete state.active[key];
    o.el.remove();
    renderDistrict(o.id);
    return o;
  }

  function hitDistrict(id) {
    if (!state || !state.running) return;
    var key = id + ':' + state.tool;
    var o = state.active[key];
    if (o) {
      var left = 1 - (state.time - o.start) / o.life;
      state.combo++;
      var pts = (10 + Math.round(10 * left)) * comboMult();
      state.score += pts;
      state.fixes++;
      removeOutage(key);
      flash(id, 'fixed');
      floatText(id, '+' + pts, 'var(--ink)');
      if (state.fixes % FIXES_PER_LEVEL === 0) levelUp();
    } else if (outagesIn(id).length) {
      state.combo = 0;
      floatText(id, 'не тот мастер', 'var(--bad)');
    } else {
      state.combo = 0;
    }
    renderHud();
  }

  function levelUp() {
    state.level++;
    unlockTypes();
    banner(LEVEL_NEWS[state.level] || ('Уровень ' + state.level + ' — держись'));
  }

  function expire(key) {
    var o = removeOutage(key);
    state.lives--;
    state.combo = 0;
    flash(o.id, 'missed');
    floatText(o.id, TYPES[o.type].without, 'var(--bad)');
    renderHud();
    if (state.lives <= 0) gameOver();
  }

  function tick(ts) {
    rafId = requestAnimationFrame(tick);
    var dt = Math.min(100, ts - (lastTs || ts));
    lastTs = ts;
    if (!state || !state.running) return;
    state.time += dt;

    if (state.time >= state.nextSpawn) {
      spawn();
      // occasionally a second outage lands at the same moment
      if (state.level >= 4 && Math.random() < 0.25) spawn();
      state.nextSpawn = state.time + levelConfig(state.level).spawnEvery * (0.7 + Math.random() * 0.6);
    }

    for (var k in state.active) {
      var o = state.active[k];
      var p = (state.time - o.start) / o.life;
      if (p >= 1) { expire(k); if (!state.running) return; continue; }
      o.ring.setAttribute('stroke-dashoffset', (RING_C * p).toFixed(1));
    }
  }

  function clearBoard() {
    badgesG.innerHTML = '';
    fxG.innerHTML = '';
    districtIds.forEach(function (id) {
      districtEls[id].classList.remove('light', 'water', 'gas', 'missed', 'fixed');
      centers[id].label.classList.remove('on');
    });
  }

  function start() {
    clearBoard();
    state = newState();
    resetTools();
    renderHud();
    $('start').hidden = true;
    $('over').hidden = true;
    document.body.classList.add('playing');
    banner('Отключают свет. Успевай!');
    lastTs = 0;
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function gameOver() {
    state.running = false;
    document.body.classList.remove('playing');
    var best = readBest();
    var record = state.score > best;
    if (record) writeBest(state.score);
    var s = state.score;
    $('overTitle').textContent = s < 400 ? 'Город встал' : s < 1500 ? 'Ну, бывало и хуже' : s < 4000 ? 'Почти как в Европе' : 'Тбилиси светится';
    $('finalScore').textContent = s;
    $('overText').textContent = 'Уровень ' + state.level + ', починено аварий: ' + state.fixes + '. '
      + (record ? 'Новый рекорд!' : 'Рекорд: ' + best + '.');
    $('nickForm').hidden = true;
    $('over').hidden = false;
    offerNick({ score: s, level: state.level, fixes: state.fixes });
    if (window.gtag) window.gtag('event', 'blackout_over', { score: s, level: state.level });
  }

  // ── input ──
  $('districts').addEventListener('pointerdown', function (e) {
    var id = e.target.getAttribute && e.target.getAttribute('data-id');
    if (id) hitDistrict(id);
  });
  toolButtons.forEach(function (b) {
    b.addEventListener('click', function () { setTool(b.getAttribute('data-type')); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return; // typing a nick
    for (var t in TYPES) if (e.key === TYPES[t].key) setTool(t);
    if ((e.key === 'Enter' || e.key === ' ') && (!state || !state.running)) { e.preventDefault(); start(); }
  });
  // mouse wheel cycles through unlocked tools
  document.addEventListener('wheel', function (e) {
    if (!state || !state.running) return;
    var list = Object.keys(TYPES).filter(function (t) { return state.unlocked[t]; });
    var i = list.indexOf(state.tool) + (e.deltaY > 0 ? 1 : -1);
    setTool(list[(i + list.length) % list.length]);
  }, { passive: true });

  var hammer = $('hammer');
  document.addEventListener('pointermove', function (e) {
    hammer.style.transform = 'translate(' + (e.clientX - 16) + 'px,' + (e.clientY - 12) + 'px)';
  });
  document.addEventListener('pointerdown', function () {
    hammer.classList.remove('hit');
    void hammer.getBBox();
    hammer.classList.add('hit');
  });

  // pause while the tab is hidden: freeze game time
  document.addEventListener('visibilitychange', function () { lastTs = 0; });

  $('startBtn').addEventListener('click', start);
  $('againBtn').addEventListener('click', start);
  fetchScores();
  rafId = requestAnimationFrame(tick);
})();
