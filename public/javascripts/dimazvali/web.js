// web.js — entry point for dimazvali admin

var host = 'dimazvali';
var botLink = 'https://t.me/dimazvalibot';
var downLoadedUsers = {};

// ── Utility panels ────────────────────────────────────────────────────────────

function showLogsPanel() {
  var panel = renderPanel();
  panel.append(ce('h2', false, false, 'Логи'));
  if (typeof logs !== 'undefined') {
    logs.forEach(function(l) {
      var row = ce('div', false, 'divided');
      row.append(ce('p', false, 'info', new Date(l.createdAt._seconds * 1000).toLocaleString()));
      row.append(ce('p', false, false, l.text));
      panel.append(row);
    });
  }
}

function showReestrPanel() {
  var panel = renderPanel();
  panel.append(ce('h1', false, false, 'Выписка из реестра'));

  var inp = ce('input', false, false, false, {
    type: 'text',
    placeholder: 'что-то вроде 50:34:0040239:127'
  });
  var body = ce('div');

  var sb = ce('button', false, false, 'Проверить', {
    onclick: function() {
      if (!inp.value) return alert('введите кадастровый номер');
      sb.setAttribute('disabled', true);
      body.innerHTML = '';
      body.append(ce('p', false, false, 'загружаем...'));
      var id = inp.value.split(':');
      axios.get('https://pkk.rosreestr.ru/api/features/1/' + id.map(function(p) { return +p; }).join(':'))
        .then(function(data) {
          body.innerHTML = '';
          var attrs = data.data.feature.attrs;
          Object.keys(attrs).forEach(function(k) {
            if (attrs[k]) {
              var row = ce('p', false, false, k + ': ' + attrs[k]);
              body.append(row);
            }
          });
        })
        .catch(handleError)
        .finally(function() { sb.removeAttribute('disabled'); });
    }
  });

  panel.append(inp);
  panel.append(sb);
  panel.append(body);
}

// ── User detail popup ─────────────────────────────────────────────────────────

function showUser(id) {
  var p = preparePopupWeb('users_' + id, false, false, true);
  load('users', id).then(function(u) {
    p.append(ce('h1', false, false, uname(u, u.id)));

    p.append(ce('p', false, false, u.first_name || 'Имя не указано', {
      onclick: function() { edit('users', u.id, 'first_name', 'text', u.first_name, this); }
    }));
    p.append(ce('p', false, false, 'email: ' + (u.email || 'не указан'), {
      onclick: function() { edit('users', u.id, 'email', 'text', u.email, this); }
    }));

    p.append(toggleButton('users', u.id, 'blocked', u.blocked || false,
      'Разблокировать', 'Заблокировать', ['dateButton', 'dark']));
    p.append(toggleButton('users', u.id, 'admin', u.admin || false,
      'Снять админство', 'Сделать админом', ['dateButton', 'dark']));

    var messenger = ce('div');
    p.append(messenger);
    messenger.append(ce('button', false, ['dark', 'dateButton'], 'Открыть переписку', {
      onclick: function() {
        this.remove();
        load('messages', false, { user: +u.id }).then(function(messages) {
          var mc = ce('div', false, 'messenger');
          messenger.append(mc);
          messages.forEach(function(m) { mc.prepend(messageLine(m)); });

          var txt = ce('textarea');
          messenger.append(txt);
          messenger.append(ce('button', false, ['dark', 'dateButton'], 'Отправить', {
            onclick: function() {
              if (!txt.value) return;
              axios.post('/dimazvali/admin/messages', { text: txt.value, user: u.id })
                .then(function() {
                  toast('Отправлено');
                  txt.value = '';
                }).catch(handleError);
            }
          }));
        });
      }
    }));
  });
}

function messageLine(m) {
  var c = ce('div', false, m.reply ? 'reply' : 'message');
  if (m.createdAt) c.append(ce('span', false, 'info', drawDate(m.createdAt._seconds * 1000, false, { time: true })));
  c.append(ce('p', false, false, m.text));
  return c;
}

// ── Step line (used in tour panel via geo.js) ─────────────────────────────────

function showStepLine(step) {
  var c = listContainer(step, true);
  c.append(ce('h2', false, false, step.landmarkName, {
    onclick: function() { navigate('#landmarks/' + step.landmark); }
  }));
  c.append(ce('p', false, false, 'шаг ' + step.index, {
    onclick: function() { edit('toursSteps', step.id, 'index', 'number', step.index, this); }
  }));
  c.append(deleteButton('toursSteps', step.id));
  return c;
}

function visitLine(v) {
  var c = listContainer(v, true);
  load('users', v.user, false, downLoadedUsers).then(function(u) {
    c.append(ce('h4', false, false, uname(u, u.id), {
      onclick: function() { showUser(u.id); }
    }));
  });
  return c;
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  loadCitiesIntoSidebar();
  initRouter();
}

document.addEventListener('DOMContentLoaded', init);
