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

  // the query isn't the name (ru/en) or slug of an existing tag — offer to create it
  function canCreate(options, query) {
    var q = norm(query).replace(/\s+/g, ' ');
    if (!q) return false;
    return !options.some(function(o) {
      return norm(o.label) === q || norm(o.label_en) === q || norm(o.slug) === q;
    });
  }

  function init(el) {
    var name = el.getAttribute('data-name') || 'tags';
    var createUrl = el.getAttribute('data-create-url');
    var creating = false;
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

    // isNew: just created from here — link to its page to fill in the type, EN name, description
    function addChip(o, isNew) {
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
      if (isNew) {
        chip.classList.add('tag-chip--new');
        var edit = document.createElement('a');
        edit.className = 'tag-chip-edit';
        edit.href = '/admin/tags/' + encodeURIComponent(o.slug);
        edit.target = '_blank'; // a new tab: this form may hold unsaved changes
        edit.rel = 'noopener';
        edit.textContent = 'дооформить ↗';
        chip.appendChild(edit);
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
      var items = list.querySelectorAll('li[data-slug], li[data-create]');
      if (!items.length) return;
      active = (i + items.length) % items.length;
      items.forEach(function(li, ix) { li.classList.toggle('is-active', ix === active); li.setAttribute('aria-selected', ix === active ? 'true' : 'false'); });
      input.setAttribute('aria-activedescendant', items[active].id);
      items[active].scrollIntoView({ block: 'nearest' });
    }

    function render() {
      shown = filterTags(options, input.value, selected(), 10);
      var offerCreate = !!createUrl && canCreate(options, input.value);
      list.textContent = '';
      if (!shown.length && !offerCreate) {
        if (!input.value.trim()) { close(); return; }
        var empty = document.createElement('li');
        empty.className = 'tag-picker-empty';
        empty.textContent = 'тег уже выбран';
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
      if (offerCreate) {
        var cr = document.createElement('li');
        cr.id = listId + '-create';
        cr.className = 'tag-picker-create';
        cr.setAttribute('role', 'option');
        cr.setAttribute('data-create', '1');
        cr.textContent = '+ создать тег «' + input.value.trim().replace(/\s+/g, ' ') + '»';
        list.appendChild(cr);
      }
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      active = -1;
      if ((shown.length || offerCreate) && input.value.trim()) setActive(0);
    }

    function create() {
      var label = input.value.trim().replace(/\s+/g, ' ');
      if (!label || creating) return;
      creating = true;
      input.disabled = true;
      fetch(createUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ label: label }),
      })
        .then(function(r) { return r.json().catch(function() { return {}; }).then(function(d) { if (!r.ok || !d.ok) throw new Error(d.error || 'не удалось создать тег'); return d; }); })
        .then(function(d) {
          var o = d.tag;
          if (!bySlug[o.slug]) { options.push(o); bySlug[o.slug] = o; }
          if (selected().indexOf(o.slug) === -1) addChip(bySlug[o.slug], d.created);
          input.value = '';
        })
        .catch(function(err) { alert(err.message); })
        .then(function() {
          creating = false;
          input.disabled = false;
          input.focus();
          render();
        });
    }

    function choose(li) {
      if (li.hasAttribute('data-create')) create();
      else pick(li.getAttribute('data-slug'));
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
        var items = list.querySelectorAll('li[data-slug], li[data-create]');
        if (!list.hidden && active >= 0 && items[active]) choose(items[active]);
      }
      else if (e.key === 'Escape') { if (!list.hidden) { e.preventDefault(); close(); } }
      else if (e.key === 'Backspace' && !input.value) {
        var chips = box.querySelectorAll('.tag-chip');
        if (chips.length) { chips[chips.length - 1].remove(); if (!list.hidden) render(); }
      }
    });
    // mousedown, not click: fires before the input's blur closes the list
    list.addEventListener('mousedown', function(e) {
      var li = e.target.closest('li[data-slug], li[data-create]');
      if (!li) return;
      e.preventDefault();
      choose(li);
    });
    box.addEventListener('click', function(e) {
      var x = e.target.closest('.tag-chip-x');
      if (x) { x.closest('.tag-chip').remove(); input.focus(); return; }
      if (e.target === box) input.focus();
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { filterTags: filterTags, canCreate: canCreate };
  } else {
    root.document.querySelectorAll('[data-tag-picker]').forEach(init);
  }
}(this));
