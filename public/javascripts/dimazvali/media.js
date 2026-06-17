// media.js — Neva FM: authors, programs, shows

function showAuthorsPanel() {
  var panel = renderPanel();
  panel.append(ce('h2', false, false, 'Ведущие'));
  panel.append(ce('button', false, false, '+ Добавить', { onclick: addAuthorForm }));
  load('authors').then(function(authors) {
    authors.filter(function(a) { return a.active; }).forEach(function(a) {
      var row = listContainer(a, true);
      row.append(ce('h2', false, false, a.name, { onclick: function() { showAuthor(a.id); } }));
      if (a.description) row.append(ce('p', false, false, a.description));
      panel.append(row);
    });
  });
}

function showProgramsPanel() {
  var panel = renderPanel();
  panel.append(ce('h2', false, false, 'Программы'));
  panel.append(ce('button', false, false, '+ Добавить', { onclick: addProgramForm }));
  load('programs').then(function(programs) {
    programs.filter(function(p) { return p.active; }).forEach(function(p) {
      var row = listContainer(p, true);
      row.append(ce('h2', false, false, p.name, { onclick: function() { showProgram(p.id); } }));
      if (p.description) row.append(ce('p', false, false, p.description));
      panel.append(row);
    });
  });
}

function showShowsPanel() {
  var panel = renderPanel();
  panel.append(ce('h2', false, false, 'Выпуски'));
  load('shows').then(function(shows) {
    shows.filter(function(s) { return s.active; }).forEach(function(s) {
      var row = listContainer(s, true, { played: 'прослушано' });
      row.append(ce('h2', false, false, s.name, { onclick: function() { showShow(s.id); } }));
      if (s.description) row.append(ce('p', false, false, s.description));
      panel.append(row);
    });
  });
}

function addAuthorForm() {
  addScreen('authors', 'Новый автор', {
    name:        { placeholder: 'Имя' },
    slug:        { placeholder: 'slug' },
    description: { placeholder: 'Описание', type: 'textarea' },
    pic:         { placeholder: 'Фото (URL)' }
  });
}

function addProgramForm() {
  addScreen('programs', 'Новая программа', {
    name:        { placeholder: 'Название' },
    slug:        { placeholder: 'slug' },
    author:      { selector: 'authors', placeholder: 'Автор' },
    description: { placeholder: 'Описание', type: 'textarea' },
    pic:         { placeholder: 'Картинка' }
  });
}

function showAuthor(id) {
  var p = preparePopupWeb('authors_' + id, false, false, true);
  load('authors', id).then(function(s) {
    p.append(ce('h1', false, false, s.name, {
      onclick: function() { edit('authors', id, 'name', 'text', s.name, this); }
    }));
    p.append(ce('p', false, false, s.description || 'Добавьте описание', {
      onclick: function() { edit('authors', id, 'description', 'textarea', s.description, this); }
    }));
    p.append(deleteButton('authors', id, !s.active));
  });
}

function showProgram(id) {
  var c = preparePopupWeb('programs_' + id, false, false, true);
  load('programs', id).then(function(p) {
    var details = ce('div', false, 'details');
    if (p.createdAt) details.append(ce('span', false, 'info', drawDate(p.createdAt._seconds * 1000)));
    c.append(details);
    c.append(ce('h1', false, 'editable', p.name, {
      onclick: function() { edit('programs', id, 'name', 'text', p.name, this); }
    }));
    c.append(ce('p', false, 'editable', p.description || 'Добавьте описание', {
      onclick: function() { edit('programs', id, 'description', 'textarea', p.description, this); }
    }));
    var showsContainer = ce('div');
    c.append(showsContainer);
    load('shows', false, { program: id }).then(function(shows) {
      shows.forEach(function(s) {
        var row = listContainer(s, true);
        row.append(ce('h2', false, false, s.name, { onclick: function() { showShow(s.id); } }));
        showsContainer.append(row);
      });
    });
  });
}

function showShow(id) {
  var c = preparePopupWeb('shows_' + id, false, false, true);
  load('shows', id).then(function(s) {
    var details = ce('div', false, 'details');
    if (s.createdAt) details.append(ce('span', false, 'info', drawDate(s.createdAt._seconds * 1000)));
    details.append(ce('span', false, 'info', 'прослушано: ' + (s.played || 0)));
    c.append(details);
    c.append(ce('h1', false, 'editable', s.name, {
      onclick: function() { edit('shows', id, 'name', 'text', s.name, this); }
    }));
    c.append(ce('p', false, 'editable', s.description || 'Добавьте описание', {
      onclick: function() { edit('shows', id, 'description', 'textarea', s.description, this); }
    }));
    c.append(ce('p', false, false, 'Ссылка: ' + (s.url || 'не задана'), {
      onclick: function() { edit('shows', id, 'url', 'text', s.url || null, this); }
    }));
  });
}
