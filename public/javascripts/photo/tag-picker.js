// Admin tag picker: chips + text input with suggestions. Markup: views/photo/admin/_tag-picker.pug.
// filterTags is also exported for node (test/photo-tag-picker.test.js).
(function(root) {
  'use strict';

  var TYPE_LABELS = { person: 'человек', location: 'локация' };

  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').trim(); }

  // 0 — a field starts with q; 1 — a word in a field starts with q; 2 — q somewhere inside; -1 — no match
  function score(o, q) {
    var best = -1;
    [o.label, o.label_en, o.slug].forEach(function(f) {
      f = norm(f);
      if (!f) return;
      var s = f.indexOf(q) === 0 ? 0
        : f.split(/[\s\-_.,/]+/).some(function(w) { return w.indexOf(q) === 0; }) ? 1
        : f.indexOf(q) !== -1 ? 2 : -1;
      if (s !== -1 && (best === -1 || s < best)) best = s;
    });
    return best;
  }

  function filterTags(options, query, selected, limit) {
    var q = norm(query);
    var taken = {};
    (selected || []).forEach(function(s) { taken[s] = true; });
    return options
      .filter(function(o) { return !taken[o.slug]; })
      .map(function(o) { return { o: o, s: q ? score(o, q) : 0 }; })
      .filter(function(x) { return x.s !== -1; })
      .sort(function(a, b) {
        return a.s - b.s || (b.o.uses || 0) - (a.o.uses || 0) || String(a.o.label).localeCompare(String(b.o.label), 'ru');
      })
      .slice(0, limit || 10)
      .map(function(x) { return x.o; });
  }

  function init(el) {
    var name = el.getAttribute('data-name') || 'tags';
    var box = el.querySelector('.tag-picker-box');
    var input = el.querySelector('.tag-picker-input');
    var list = el.querySelector('.tag-picker-list');
    var options = [];
    try { options = JSON.parse(el.querySelector('[data-tag-options]').textContent); } catch (e) {}
    var bySlug = {};
    options.forEach(function(o) { bySlug[o.slug] = o; });
    var shown = [];
    var active = -1;
    var listId = 'tag-picker-list-' + Math.random().toString(36).slice(2, 8);
    list.id = listId;
    input.setAttribute('aria-controls', listId);

    function selected() {
      return Array.prototype.map.call(box.querySelectorAll('.tag-chip'), function(c) { return c.getAttribute('data-slug'); });
    }

    function addChip(o) {
      var chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.setAttribute('data-slug', o.slug);
      var lab = document.createElement('span');
      lab.className = 'tag-chip-label';
      lab.textContent = o.label;
      chip.appendChild(lab);
      if (TYPE_LABELS[o.type]) {
        var ty = document.createElement('span');
        ty.className = 'tag-chip-type';
        ty.textContent = TYPE_LABELS[o.type];
        chip.appendChild(ty);
      }
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'tag-chip-x';
      x.setAttribute('aria-label', 'убрать тег ' + o.label);
      x.textContent = '×';
      chip.appendChild(x);
      var hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = name;
      hidden.value = o.slug;
      chip.appendChild(hidden);
      box.insertBefore(chip, input);
    }

    function close() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    }

    function setActive(i) {
      var items = list.querySelectorAll('li');
      if (!items.length) return;
      active = (i + items.length) % items.length;
      items.forEach(function(li, ix) { li.classList.toggle('is-active', ix === active); li.setAttribute('aria-selected', ix === active ? 'true' : 'false'); });
      input.setAttribute('aria-activedescendant', items[active].id);
      items[active].scrollIntoView({ block: 'nearest' });
    }

    function render() {
      shown = filterTags(options, input.value, selected(), 10);
      list.textContent = '';
      if (!shown.length) {
        if (!input.value.trim()) { close(); return; }
        var empty = document.createElement('li');
        empty.className = 'tag-picker-empty';
        empty.textContent = 'нет такого тега — создайте его в разделе «Теги»';
        list.appendChild(empty);
      }
      shown.forEach(function(o, i) {
        var li = document.createElement('li');
        li.id = listId + '-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('data-slug', o.slug);
        var lab = document.createElement('span');
        lab.className = 'tag-opt-label';
        lab.textContent = o.label;
        li.appendChild(lab);
        var meta = [];
        if (o.label_en && norm(o.label_en) !== norm(o.label)) meta.push(o.label_en);
        if (TYPE_LABELS[o.type]) meta.push(TYPE_LABELS[o.type]);
        meta.push(o.uses || 0);
        var m = document.createElement('span');
        m.className = 'tag-opt-meta';
        m.textContent = meta.join(' · ');
        li.appendChild(m);
        list.appendChild(li);
      });
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      active = -1;
      if (shown.length && input.value.trim()) setActive(0);
    }

    function pick(slug) {
      var o = bySlug[slug];
      if (!o || selected().indexOf(slug) !== -1) return;
      addChip(o);
      input.value = '';
      render();
      input.focus();
    }

    input.addEventListener('focus', render);
    input.addEventListener('input', render);
    input.addEventListener('blur', function() { setTimeout(close, 150); });
    input.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) render(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter') {
        // never submit the whole form from here
        if (input.value.trim() || !list.hidden) e.preventDefault();
        if (active >= 0 && shown[active]) pick(shown[active].slug);
      }
      else if (e.key === 'Escape') { if (!list.hidden) { e.preventDefault(); close(); } }
      else if (e.key === 'Backspace' && !input.value) {
        var chips = box.querySelectorAll('.tag-chip');
        if (chips.length) { chips[chips.length - 1].remove(); if (!list.hidden) render(); }
      }
    });
    // mousedown, not click: fires before the input's blur closes the list
    list.addEventListener('mousedown', function(e) {
      var li = e.target.closest('li[data-slug]');
      if (!li) return;
      e.preventDefault();
      pick(li.getAttribute('data-slug'));
    });
    box.addEventListener('click', function(e) {
      var x = e.target.closest('.tag-chip-x');
      if (x) { x.closest('.tag-chip').remove(); input.focus(); return; }
      if (e.target === box) input.focus();
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { filterTags: filterTags };
  } else {
    root.document.querySelectorAll('[data-tag-picker]').forEach(init);
  }
}(this));
