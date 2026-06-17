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
