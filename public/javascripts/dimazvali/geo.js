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
    panel.append(ce('p', false, 'editable', 'lat: ' + (city.lat || 'не задано'), {
      onclick: function() { edit('cities', id, 'lat', 'number', city.lat, this); }
    }));
    panel.append(ce('p', false, 'editable', 'lng: ' + (city.lng || 'не задано'), {
      onclick: function() { edit('cities', id, 'lng', 'number', city.lng, this); }
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
    lat:         { placeholder: 'Широта (lat)', type: 'number' },
    lng:         { placeholder: 'Долгота (lng)', type: 'number' },
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
    ].forEach(function(f) {
      panel.append(ce('p', false, 'editable', f.label + ': ' + (l[f.attr] || 'добавить'), {
        onclick: function() { edit('landmarks', id, f.attr, f.type, l[f.attr] || null, this); }
      }));
    });
    panel.append(picWidget('landmarks', id, l.pic));
    panel.append(galleryWidget('landmarks', id));

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
    voice:       { placeholder: 'Голосовое (ID файла)' },
    proximity:   { placeholder: 'Радиус срабатывания (м)' }
  });
  p.append(ce('div', 'map'));
  var form = p.querySelector('form');
  if (cityId) {
    load('cities', cityId).then(function(city) {
      initMap(form, city.lat ? +city.lat : null, city.lng ? +city.lng : null);
    });
  } else {
    initMap(form);
  }
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
    ].forEach(function(f) {
      panel.append(ce('p', false, 'editable', f.label + ': ' + (t[f.attr] || 'добавить'), {
        onclick: function() { edit('tours', id, f.attr, f.type, t[f.attr] || null, this); }
      }));
    });
    panel.append(picWidget('tours', id, t.pic));

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
          m.style.cssText += ';min-width:min(560px,90vw);max-height:80vh;overflow-y:auto';

          var alreadyAdded = {};
          steps.forEach(function(s) { alreadyAdded[s.landmark] = true; });

          loadGeoData(function() {
            var cityLandmarks = _geoLandmarks.filter(function(l) {
              return l.active && (!t.city || l.city === t.city);
            });
            cityLandmarks.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });

            if (!cityLandmarks.length) {
              m.append(ce('p', false, 'info', 'Нет точек в этом городе'));
              return;
            }

            var grid = ce('div');
            grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:0.75rem';

            cityLandmarks.forEach(function(l) {
              var added = alreadyAdded[l.id];
              var card = ce('div');
              card.style.cssText = 'border-radius:6px;overflow:hidden;cursor:' + (added ? 'default' : 'pointer') +
                ';border:1px solid #e4e4e8;opacity:' + (added ? '0.4' : '1') +
                ';transition:box-shadow 0.12s';

              var thumb = ce('div');
              thumb.style.cssText = 'height:80px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:1.5rem';
              var url = picUrl(l.pic);
              if (url) {
                var img = ce('img');
                img.src = url;
                img.style.cssText = 'width:100%;height:80px;object-fit:cover;display:block';
                thumb.append(img);
              } else {
                thumb.textContent = '📍';
              }
              card.append(thumb);

              var label = ce('div');
              label.style.cssText = 'padding:6px 8px;font-size:0.78rem;font-weight:500;line-height:1.3';
              label.textContent = l.name;
              if (added) {
                var badge = ce('span');
                badge.style.cssText = 'display:block;font-size:0.68rem;color:#888;font-weight:400';
                badge.textContent = 'уже добавлена';
                label.append(badge);
              }
              card.append(label);

              if (!added) {
                card.onmouseenter = function() { card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.14)'; };
                card.onmouseleave = function() { card.style.boxShadow = ''; };
                card.onclick = function() {
                  card.style.opacity = '0.5';
                  axios.post('/dimazvali/admin/toursSteps', { tour: id, landmark: l.id })
                    .then(function() { m.remove(); showTourPanel(id); })
                    .catch(function(err) { handleError(err); card.style.opacity = '1'; });
                };
              }
              grid.append(card);
            });

            m.append(grid);
          });
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
    voice:       { placeholder: 'Голосовое начало (ID файла)' }
  });
}

function picWidget(collection, id, currentPic) {
  var wrap = ce('div', false, 'pic-widget');

  var thumb = ce('div', false, 'pic-thumb');
  wrap.append(thumb);

  var status = ce('span', false, 'info', '');
  var inp = ce('input', false, false, false, { type: 'file', accept: 'image/*' });
  inp.style.display = 'none';

  var btn = ce('button', false, false, 'Загрузить фото', {
    onclick: function() { inp.click(); }
  });

  var delBtn = ce('button', false, false, 'Удалить', {
    onclick: function() {
      if (!confirm('Удалить фото?')) return;
      delBtn.setAttribute('disabled', true);
      axios.delete('/dimazvali/admin/pic/' + collection + '/' + id).then(function() {
        renderThumb(null);
        status.textContent = '✓ Удалено';
        delBtn.removeAttribute('disabled');
        _geoLandmarks = null;
        _geoTours = null;
      }).catch(function(err) {
        handleError(err);
        delBtn.removeAttribute('disabled');
      });
    }
  });
  delBtn.style.cssText = 'margin-left:4px';

  function renderThumb(url) {
    thumb.innerHTML = '';
    if (url) {
      var img = ce('img');
      img.src = url;
      img.style.cssText = 'width:120px;height:80px;object-fit:cover;border-radius:6px;display:block';
      thumb.append(img);
      delBtn.style.display = '';
    } else {
      thumb.style.cssText = 'width:120px;height:80px;background:#eee;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#999';
      thumb.textContent = 'нет фото';
      delBtn.style.display = 'none';
    }
  }

  renderThumb(picUrl(currentPic));

  inp.addEventListener('change', function() {
    if (!inp.files || !inp.files[0]) return;
    status.textContent = 'Загружаем...';
    btn.setAttribute('disabled', true);

    var fd = new FormData();
    fd.append('pic', inp.files[0]);
    fd.append('collection', collection);
    fd.append('id', id);

    axios.post('/dimazvali/admin/upload-image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(function(r) {
      var urls = r.data;
      return axios.put('/dimazvali/admin/' + collection + '/' + id, {
        attr: 'pic',
        value: urls
      }).then(function() {
        renderThumb(urls.w800 || urls.w400);
        status.textContent = '✓ Сохранено';
        btn.removeAttribute('disabled');
        _geoLandmarks = null;
        _geoTours = null;
      });
    }).catch(function(err) {
      handleError(err);
      status.textContent = '';
      btn.removeAttribute('disabled');
    });
  });

  wrap.append(btn);
  wrap.append(delBtn);
  wrap.append(inp);
  wrap.append(status);
  return wrap;
}

function galleryWidget(collection, id) {
  var wrap = ce('div', false, 'gallery-widget');
  wrap.style.cssText = 'margin-top:0.75rem';

  var grid = ce('div', false, 'gallery-grid');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px';
  wrap.append(grid);

  var dragged = null;
  var dragOver = null;

  function persistOrder() {
    var order = Array.prototype.map.call(grid.children, function(box) { return box.dataset.imageId; });
    axios.put('/dimazvali/admin/gallery-images/' + collection + '/' + id + '/order', { order: order }).catch(handleError);
  }

  function addThumb(item) {
    var box = ce('div', false, 'gallery-thumb', false, { draggable: true });
    box.style.cssText = 'position:relative;width:100px;height:70px;cursor:move';
    box.dataset.imageId = item.id;

    var img = ce('img');
    img.src = item.w400 || item.w800 || item.w1400;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:6px;display:block';
    box.append(img);

    var del = ce('button', false, false, '✕', {
      onclick: function() {
        if (!confirm('Удалить фото?')) return;
        del.setAttribute('disabled', true);
        axios.delete('/dimazvali/admin/gallery-image/' + item.id).then(function() {
          box.remove();
        }).catch(function(err) {
          handleError(err);
          del.removeAttribute('disabled');
        });
      }
    });
    del.style.cssText = 'position:absolute;top:2px;right:2px;width:20px;height:20px;line-height:1;padding:0;border-radius:50%;border:none;background:rgba(0,0,0,0.6);color:#fff;cursor:pointer;font-size:12px';
    box.append(del);

    var captionLabel = ce('div', false, 'gallery-caption', item.caption || 'подпись…');
    captionLabel.style.cssText = 'position:absolute;left:0;right:0;bottom:0;font-size:10px;line-height:1.3;padding:2px 4px;background:rgba(0,0,0,0.55);color:' + (item.caption ? '#fff' : '#ccc') + ';cursor:text;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:0 0 6px 6px';
    captionLabel.addEventListener('click', function() {
      var captionInp = ce('input', false, false, false, { type: 'text', value: item.caption || '' });
      captionInp.style.cssText = 'position:absolute;left:0;right:0;bottom:0;width:100%;font-size:10px;padding:2px 4px;box-sizing:border-box;border:none';
      box.replaceChild(captionInp, captionLabel);
      captionInp.focus();

      function save() {
        var value = captionInp.value.trim() || null;
        axios.put('/dimazvali/admin/gallery-image/' + item.id + '/caption', { caption: value }).then(function() {
          item.caption = value;
          captionLabel.textContent = value || 'подпись…';
          captionLabel.style.color = value ? '#fff' : '#ccc';
          box.replaceChild(captionLabel, captionInp);
        }).catch(function(err) {
          handleError(err);
          box.replaceChild(captionLabel, captionInp);
        });
      }
      captionInp.addEventListener('blur', save);
      captionInp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') captionInp.blur();
      });
    });
    box.append(captionLabel);

    box.addEventListener('dragstart', function() { dragged = box; });
    box.addEventListener('dragenter', function() { dragOver = box; });
    box.addEventListener('dragend', function() {
      if (dragged && dragOver && dragged !== dragOver) {
        grid.insertBefore(dragged, dragOver);
        persistOrder();
      }
      dragged = null;
      dragOver = null;
    });

    grid.append(box);
  }

  var zone = ce('div', false, 'gallery-dropzone', 'Перетащите фото или нажмите для выбора');
  zone.style.cssText = 'border:2px dashed #ccc;border-radius:6px;padding:12px;text-align:center;font-size:12px;color:#999;cursor:pointer;width:220px;box-sizing:border-box';

  var inp = ce('input', false, false, false, { type: 'file', accept: 'image/*', multiple: true });
  inp.style.display = 'none';

  var status = ce('span', false, 'info', '');
  status.style.cssText = 'display:block;margin-top:4px';

  function uploadFiles(files) {
    status.textContent = 'Загружаем ' + files.length + '...';
    var done = 0;
    var failed = 0;
    Array.prototype.forEach.call(files, function(file) {
      var fd = new FormData();
      fd.append('pic', file);
      fd.append('collection', collection);
      fd.append('id', id);
      axios.post('/dimazvali/admin/upload-gallery-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }).then(function(r) {
        addThumb(r.data);
      }).catch(function(err) {
        failed++;
        handleError(err);
      }).then(function() {
        done++;
        if (done === files.length) {
          status.textContent = failed ? ('✓ Готово, ошибок: ' + failed) : '✓ Готово';
        }
      });
    });
  }

  zone.addEventListener('click', function() { inp.click(); });
  inp.addEventListener('change', function() {
    if (inp.files && inp.files.length) uploadFiles(inp.files);
    inp.value = '';
  });
  zone.addEventListener('dragover', function(e) {
    e.preventDefault();
    zone.style.background = '#f5f5f5';
  });
  zone.addEventListener('dragleave', function() {
    zone.style.background = '';
  });
  zone.addEventListener('drop', function(e) {
    e.preventDefault();
    zone.style.background = '';
    if (e.dataTransfer.files && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  });

  wrap.append(zone);
  wrap.append(inp);
  wrap.append(status);

  axios.get('/dimazvali/admin/gallery-images/' + collection + '/' + id).then(function(r) {
    r.data.forEach(addThumb);
  }).catch(handleError);

  return wrap;
}
