// common-admin.js — overrides for web admin context
// Must load AFTER common.js

function handleSave(s) {
  if (s.data && s.data.hasOwnProperty('success')) {
    toast((s.data.success ? '✓ ' : '✗ ') + (s.data.comment || ''));
  } else {
    toast('✓ Сохранено');
  }
}

function handleError(err) {
  console.warn(err);
  var msg = (err.response && err.response.data)
    ? err.response.data
    : (err.data || err.message || 'Ошибка');
  alert(msg);
}

// Single clean logButton (replaces two duplicate definitions in common.js)
function logButton(collection, id, credit) {
  return ce('button', false, 'thin', credit || 'Логи', {
    onclick: function() {
      var p = preparePopupWeb('logs_' + collection + '_' + id);
      p.append(ce('h2', false, false, 'Загружаем...'));
      load('logs', collection + '_' + id).then(function(logs) {
        p.innerHTML = null;
        p.append(ce('h1', false, false, credit || 'Логи'));
        logs.forEach(function(l) { p.append(logLine(l)); });
      });
    }
  });
}

// Single clean logLine (replaces two duplicate definitions in common.js)
function logLine(l) {
  var c = ce('div', false, 'sDivided');
  c.append(ce('span', false, 'info', drawDate(l.createdAt._seconds * 1000)));
  c.append(ce('p', false, false, l.text));
  if (l.user) {
    c.append(ce('button', false, ['dateButton','dark','inline'], 'Открыть профиль', {
      onclick: function() { showUser(l.user); }
    }));
  }
  return c;
}

// Renders content into #main, clearing previous panel
function renderPanel() {
  var main = document.getElementById('main');
  main.innerHTML = '';
  var div = ce('div', false, 'panel-content');
  main.append(div);
  return div;
}

function picUrl(pic) {
  if (!pic) return null;
  return typeof pic === 'string' ? pic : (pic.w800 || pic.w400 || pic.w1400);
}

function edit(entity, id, attr, type, value, container) {
  var m = modal();
  m.style.position = 'relative';
  var closeBtn = ce('button', false, false, '✕', { onclick: function() { m.remove(); } });
  closeBtn.style.cssText = 'position:absolute;top:0.75rem;right:0.75rem;background:none;color:#999;font-size:1rem;padding:0.2rem 0.4rem;margin:0;border:none;cursor:pointer';
  m.append(closeBtn);
  m.append(ce('h2', false, false, 'Редактировать ' + attr));

  var f;
  if (type === 'textarea') {
    f = ce('textarea', false, false, false, { placeholder: 'Новое значение' });
    f.value = value || '';
  } else {
    f = ce('input', false, false, false, { type: type || 'text', placeholder: 'Новое значение' });
    f.value = value || '';
  }
  m.append(f);
  setTimeout(function() { f.focus(); }, 50);

  m.append(ce('button', false, false, 'Сохранить', {
    onclick: function() {
      axios.put('/' + host + '/admin/' + entity + '/' + id, { attr: attr, value: f.value || null })
        .then(function(d) { handleSave(d); m.remove(); if (container) container.textContent = f.value; })
        .catch(handleError);
    }
  }));

  m.append(ce('button', false, false, 'Удалить', {
    onclick: function() {
      if (!confirm('Удалить значение?')) return;
      axios.put('/' + host + '/admin/' + entity + '/' + id, { attr: attr, value: null })
        .then(function(d) { handleSave(d); m.remove(); if (container) container.textContent = 'добавить'; })
        .catch(handleError);
    }
  }));
}
