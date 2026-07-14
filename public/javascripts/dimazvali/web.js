// web.js — entry point for dimazvali admin

var host = 'dimazvali';
var botLink = 'https://telegram.me/dimazvalibot';
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

// ── All users screen ─────────────────────────────────────────────────────────

function userRow(u) {
  var row = ce('div', false, 'sDivided');
  row.append(ce('h3', false, false, uname(u, u.id), {
    onclick: function() { showUser(u.id); }
  }));
  if (u.admin) row.append(ce('span', false, 'info', 'админ'));
  if (u.blocked) row.append(ce('span', false, 'info', 'заблокирован'));
  return row;
}

function showAllUsersPanel() {
  var panel = renderPanel();
  panel.append(ce('h2', false, false, 'Пользователи'));

  var search = ce('input', false, false, false, { type: 'text', placeholder: 'Поиск по имени или юзернейму' });
  panel.append(search);

  var list = ce('div');
  panel.append(list);

  load('users').then(function(users) {
    function render(filter) {
      list.innerHTML = '';
      var q = (filter || '').toLowerCase();
      users
        .filter(function(u) {
          if (!q) return true;
          return (u.first_name || '').toLowerCase().indexOf(q) > -1 ||
                 (u.last_name || '').toLowerCase().indexOf(q) > -1 ||
                 (u.username || '').toLowerCase().indexOf(q) > -1;
        })
        .forEach(function(u) { list.append(userRow(u)); });
    }

    render('');
    search.addEventListener('input', function() { render(search.value); });
  });
}

// ── Google Maps ───────────────────────────────────────────────────────────────

var map;

function initMap(form, lat, lng) {
  var center = { lat: lat || 41.710950, lng: lng || 44.783232 };
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 15,
    center: center,
    mapTypeId: 'terrain'
  });
  if (lat && lng) addMarker({ lat: lat, lng: lng });
  map.addListener('click', function(event) {
    addMarker(event.latLng);
    if (form) {
      if (form.querySelector('[name="lat"]')) form.querySelector('[name="lat"]').remove();
      if (form.querySelector('[name="lng"]')) form.querySelector('[name="lng"]').remove();
      form.append(ce('input', false, false, false, { type: 'text', name: 'lat', value: event.latLng.lat() }));
      form.append(ce('input', false, false, false, { type: 'text', name: 'lng', value: event.latLng.lng() }));
    }
  });
}

function addMarker(location) {
  new google.maps.Marker({ position: location, map: map });
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

// ── Help panel ────────────────────────────────────────────────────────────────

function showHelpPanel() {
  var panel = renderPanel();
  panel.append(ce('h1', false, false, 'Справка для администраторов'));

  var sections = [
    {
      title: 'Что такое dimazvali',
      body: 'Телеграм-бот-путеводитель по Тбилиси. Пользователь присылает геолокацию — бот определяет ближайшую точку интереса и рассказывает о ней. Кроме этого, бот предлагает пешеходные экскурсии: /tours показывает список активных туров, пользователь выбирает тур и идёт от точки к точке.'
    },
    {
      title: 'Структура данных',
      items: [
        '🏙 Города (Cities) — верхний уровень иерархии. У каждого города есть координаты (lat/lng) — они используются при добавлении новых точек, чтобы карта сразу открывалась в нужном месте.',
        '📍 Точки (Landmarks) — места интереса с координатами, описанием и приветственным текстом. Точки привязаны к городу (поле city). Приветствие (greetings) — это то, что бот скажет, когда пользователь окажется рядом.',
        '🗺 Экскурсии (Tours) — тематические маршруты, собранные из точек. У каждой экскурсии есть город, название, описание и фото.',
        '🔢 Шаги экскурсии (Tour Steps) — связь тура с точками в определённом порядке. Поле index определяет последовательность. Бот ведёт пользователя от шага к шагу, присылая геометку.'
      ]
    },
    {
      title: 'Как работает бот',
      items: [
        'Пользователь отправляет геолокацию → бот ищет ближайшую активную точку и присылает приветствие (текст + фото).',
        '/tours или /start → бот присылает список активных туров в виде кнопок.',
        'Выбор тура → бот показывает описание и кнопку «Начать».',
        'Начало тура → бот фиксирует попытку в коллекции usersTours, присылает геометку первого шага.',
        'Пользователь дошёл до точки → шлёт геолокацию → бот определяет шаг и присылает следующую геометку.'
      ]
    },
    {
      title: 'Что делать с фото',
      body: 'Фотографии загружаются через кнопку «Загрузить фото» прямо в карточке точки или тура. Файл автоматически конвертируется в WebP и сохраняется в трёх размерах (400/800/1400px). В боте используется размер 800px, в маленьких превью — 400px.'
    },
    {
      title: 'Активность',
      body: 'Точки и туры с флагом active: false не видны пользователям. Деактивировать/активировать можно кнопкой в карточке. Удаление — необратимо, лучше деактивировать.'
    },
    {
      title: 'Частые вопросы',
      items: [
        'Точка не появляется в боте — проверьте, что active = true и заполнены lat/lng.',
        'Экскурсия не появляется в /tours — проверьте active = true у самого тура.',
        'Бот молчит на геолокацию — скорее всего, рядом нет активных точек. Проверьте координаты в карточке точки.',
        'Фото не отображается — загрузите через кнопку «Загрузить фото» вместо вставки URL.',
        'Порядок шагов в туре — меняется через клик на номер шага в карточке тура (поле index).'
      ]
    }
  ];

  sections.forEach(function(s) {
    var card = ce('div', false, 'card');
    card.append(ce('h2', false, false, s.title));
    if (s.body) {
      card.append(ce('p', false, false, s.body));
    }
    if (s.items) {
      s.items.forEach(function(item) {
        var row = ce('p');
        row.style.marginBottom = '0.55rem';
        row.textContent = item;
        card.append(row);
      });
    }
    panel.append(card);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  loadCitiesIntoSidebar();
  initRouter();
}

document.addEventListener('DOMContentLoaded', init);
