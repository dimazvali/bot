// geo.js — cities, landmarks, tours

// Cache for all landmarks and tours (avoids repeated API calls)
var _geoLandmarks = null;
var _geoTours = null;

function loadGeoData(callback) {
  if (_geoLandmarks && _geoTours) { callback(); return; }
  Promise.all([load('landmarks'), load('tours')]).then(function(res) {
    _geoLandmarks = res[0];
    _geoTours = res[1];
    callback();
  });
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

function loadCitiesIntoSidebar() {
  load('cities').then(function(cities) {
    var list = document.getElementById('city-list');
    if (!list) return;
    list.innerHTML = '';

    cities.filter(function(c) { return c.active; }).forEach(function(city) {
      var item = ce('div', false, 'city-item', false, {
        dataset: { id: city.id },
        onclick: function() { navigate('#cities/' + city.id); }
      });
      item.append(ce('span', false, false, '📍 ' + city.name));
      list.append(item);
    });

    // Fallback: landmarks without city
    var allItem = ce('div', false, 'city-item', false, {
      dataset: { id: 'all-landmarks' },
      onclick: function() { navigate('#landmarks'); }
    });
    allItem.append(ce('span', false, false, '📍 Все точки'));
    list.append(allItem);
  });
}

// ── Cities ───────────────────────────────────────────────────────────────────

function showAllCitiesPanel() {
  var panel = renderPanel();
  panel.append(ce('h2', false, false, 'Города'));
  panel.append(ce('button', false, false, '+ Добавить город', { onclick: addCityForm }));

  load('cities').then(function(cities) {
    cities.filter(function(c) { return c.active; }).forEach(function(city) {
      var row = ce('div', false, 'sDivided', false, {
        onclick: function() { navigate('#cities/' + city.id); }
      });
      row.append(ce('h3', false, false, '📍 ' + city.name));
      if (city.description) row.append(ce('p', false, false, city.description));
      panel.append(row);
    });
  });
}

function showCityPanel(id) {
  var panel = renderPanel();

  load('cities', id).then(function(city) {
    var crumb = ce('div', false, 'breadcrumb');
    crumb.append(ce('a', false, 'clickable', '← Города', { onclick: function() { navigate('#cities'); } }));
    panel.append(crumb);

    panel.append(ce('h2', false, 'editable', city.name, {
      onclick: function() { edit('cities', id, 'name', 'text', city.name, this); }
    }));
    panel.append(ce('p', false, 'editable', city.description || 'Добавить описание', {
      onclick: function() { edit('cities', id, 'description', 'textarea', city.description, this); }
    }));
    panel.append(deleteButton('cities', id, !city.active));

    // Landmarks section
    var landmarksHeader = ce('h3', false, false, 'Достопримечательности');
    panel.append(landmarksHeader);
    panel.append(ce('button', false, false, '+ Добавить точку', {
      onclick: function() { addLandmarkForm(id); }
    }));
    var landmarksList = ce('div');
    panel.append(landmarksList);

    // Tours section
    var toursHeader = ce('h3', false, false, 'Экскурсии');
    panel.append(toursHeader);
    panel.append(ce('button', false, false, '+ Добавить экскурсию', {
      onclick: function() { addTourForm(id); }
    }));
    var toursList = ce('div');
    panel.append(toursList);

    loadGeoData(function() {
      var landmarks = _geoLandmarks.filter(function(l) { return l.city === id && l.active; });
      if (!landmarks.length) {
        landmarksList.append(ce('p', false, 'info', 'Нет точек'));
      } else {
        landmarks.forEach(function(l) {
          var row = ce('div', false, 'sDivided', false, {
            onclick: function() { navigate('#landmarks/' + l.id); }
          });
          row.append(ce('span', false, false, '🏛 ' + l.name));
          if (l.visited) row.append(ce('span', false, 'info', l.visited + ' посещений'));
          landmarksList.append(row);
        });
      }

      var tours = _geoTours.filter(function(t) { return t.city === id && t.active; });
      if (!tours.length) {
        toursList.append(ce('p', false, 'info', 'Нет экскурсий'));
      } else {
        tours.forEach(function(t) {
          var row = ce('div', false, 'sDivided', false, {
            onclick: function() { navigate('#tours/' + t.id); }
          });
          row.append(ce('span', false, false, '🚶 ' + t.name));
          toursList.append(row);
        });
      }
    });
  });
}

function addCityForm() {
  addScreen('cities', 'Новый город', {
    name:        { placeholder: 'Название' },
    slug:        { placeholder: 'slug (латиницей)' },
    description: { placeholder: 'Описание', type: 'textarea' },
    pic:         { placeholder: 'Фото (URL)' }
  });
}

// ── Landmarks ────────────────────────────────────────────────────────────────

function showAllLandmarksPanel() {
  var panel = renderPanel();
  panel.append(ce('h2', false, false, '📍 Все точки'));
  panel.append(ce('button', false, false, '+ Добавить точку', {
    onclick: function() { addLandmarkForm(null); }
  }));

  load('landmarks').then(function(landmarks) {
    landmarks.filter(function(l) { return l.active && !l.city; }).forEach(function(l) {
      var row = ce('div', false, 'sDivided', false, {
        onclick: function() { navigate('#landmarks/' + l.id); }
      });
      row.append(ce('span', false, false, '🏛 ' + l.name));
      panel.append(row);
    });
  });
}

function showLandmarkPanel(id) {
  var panel = renderPanel();

  load('landmarks', id).then(function(l) {
    var crumb = ce('div', false, 'breadcrumb');
    if (l.city) {
      crumb.append(ce('a', false, 'clickable', '← ' + l.city, {
        onclick: function() { navigate('#cities/' + l.city); }
      }));
    } else {
      crumb.append(ce('a', false, 'clickable', '← Все точки', {
        onclick: function() { navigate('#landmarks'); }
      }));
    }
    panel.append(crumb);

    var details = ce('div', false, ['details', 'flex']);
    if (l.createdAt) details.append(ce('span', false, 'info', drawDate(l.createdAt._seconds * 1000)));
    details.append(ce('span', false, 'info', 'посещений: ' + (l.visited || 0)));
    panel.append(details);

    panel.append(logButton('landmarks', id));

    panel.append(ce('h2', false, 'editable', l.name, {
      onclick: function() { edit('landmarks', id, 'name', 'text', l.name, this); }
    }));

    [
      { attr: 'description', label: 'Описание',   type: 'textarea' },
      { attr: 'greetings',   label: 'Приветствие', type: 'textarea' },
      { attr: 'goodbyes',    label: 'Прощание',    type: 'textarea' },
      { attr: 'voice',       label: 'Голосовое',   type: 'text' },
      { attr: 'pic',         label: 'Фото (URL)',  type: 'text' },
    ].forEach(function(f) {
      panel.append(ce('p', false, 'editable', f.label + ': ' + (l[f.attr] || 'добавить'), {
        onclick: function() { edit('landmarks', id, f.attr, f.type, l[f.attr] || null, this); }
      }));
    });

    // Google Map
    panel.append(ce('div', 'map'));
    initMap(false, +l.lat, +l.lng);

    // Visit history (lazy)
    var visitSection = ce('div');
    visitSection.append(ce('h3', false, false, 'История посещений'));
    visitSection.append(ce('button', false, false, 'Загрузить', {
      onclick: function() {
        this.remove();
        load('usersLandMarks', false, { landmark: id }).then(function(visits) {
          visits.forEach(function(v) { visitSection.append(visitLine(v)); });
        });
      }
    }));
    panel.append(visitSection);

    panel.append(deleteButton('landmarks', id, !l.active));
  });
}

function addLandmarkForm(cityId) {
  var p = addScreen('landmarks', 'Новая точка', {
    name:        { placeholder: 'Название' },
    city:        { selector: 'cities', placeholder: 'Город', id: cityId },
    description: { placeholder: 'Описание', type: 'textarea' },
    greetings:   { placeholder: 'Текст приветствия' },
    goodbyes:    { placeholder: 'Текст прощания' },
    pic:         { placeholder: 'Фото (URL)' },
    voice:       { placeholder: 'Голосовое (ID файла)' },
    proximity:   { placeholder: 'Радиус срабатывания (м)' }
  });
  p.append(ce('div', 'map'));
  initMap(p.querySelector('form'));
}

// ── Tours ─────────────────────────────────────────────────────────────────────

function showTourPanel(id) {
  var panel = renderPanel();

  load('tours', id).then(function(t) {
    var crumb = ce('div', false, 'breadcrumb');
    if (t.city) {
      crumb.append(ce('a', false, 'clickable', '← ' + t.city, {
        onclick: function() { navigate('#cities/' + t.city); }
      }));
    }
    panel.append(crumb);

    var details = ce('div', false, ['details', 'flex']);
    if (t.createdAt) details.append(ce('span', false, 'info', drawDate(t.createdAt._seconds * 1000)));
    details.append(ce('span', false, 'info', 'запусков: ' + (t.started || 0)));
    panel.append(details);

    panel.append(logButton('tours', id));

    panel.append(ce('h2', false, 'editable', t.name, {
      onclick: function() { edit('tours', id, 'name', 'text', t.name, this); }
    }));

    [
      { attr: 'description', label: 'Описание',  type: 'textarea' },
      { attr: 'voice',       label: 'Голосовое', type: 'text' },
      { attr: 'pic',         label: 'Фото (URL)',type: 'text' },
    ].forEach(function(f) {
      panel.append(ce('p', false, 'editable', f.label + ': ' + (t[f.attr] || 'добавить'), {
        onclick: function() { edit('tours', id, f.attr, f.type, t[f.attr] || null, this); }
      }));
    });

    // Steps
    var stepsDiv = ce('div');
    stepsDiv.append(ce('h3', false, false, 'Точки маршрута'));
    panel.append(stepsDiv);

    load('toursSteps', false, { tour: id }).then(function(steps) {
      steps.sort(function(a, b) { return a.index - b.index; }).forEach(function(step) {
        stepsDiv.append(showStepLine(step));
      });

      stepsDiv.append(ce('button', false, false, '+ Добавить точку', {
        onclick: function() {
          var m = modal('Добавить шаг');
          var sel = selector('landmarks', 'Выберите точку');
          m.append(sel);
          m.append(ce('button', false, false, 'Добавить', {
            onclick: function() {
              if (!sel.value) return;
              axios.post('/dimazvali/admin/toursSteps', { tour: id, landmark: sel.value })
                .then(function() { m.remove(); showTourPanel(id); })
                .catch(handleError);
            }
          }));
        }
      }));
    });

    panel.append(deleteButton('tours', id, !t.active));
  });
}

function addTourForm(cityId) {
  addScreen('tours', 'Новая экскурсия', {
    name:        { placeholder: 'Название' },
    city:        { selector: 'cities', placeholder: 'Город', id: cityId },
    description: { placeholder: 'Описание', type: 'textarea' },
    pic:         { placeholder: 'Фото (URL)' },
    voice:       { placeholder: 'Голосовое начало (ID файла)' }
  });
}
