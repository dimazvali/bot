// content.js — pages, sections, tags

function showPagesPanel() {
  var panel = renderPanel();
  panel.append(ce('h2', false, false, 'Страницы'));
  panel.append(ce('button', false, false, '+ Добавить страницу', { onclick: addPageForm }));

  load('pages').then(function(pages) {
    pages.filter(function(p) { return p.active; }).forEach(function(p) {
      var row = listContainer(p, true);
      row.append(ce('h3', false, false, p.name, { onclick: function() { openPageEditor(p.id); } }));
      if (p.description) row.append(ce('p', false, false, p.description));
      panel.append(row);
    });
  });
}

function showSectionsPanel() {
  var panel = renderPanel();
  panel.append(ce('h2', false, false, 'Разделы'));
  panel.append(ce('button', false, false, '+ Добавить раздел', { onclick: addSectionForm }));

  load('sections').then(function(sections) {
    sections.filter(function(s) { return s.active; }).forEach(function(s) {
      var row = listContainer(s, true);
      row.append(ce('h3', false, false, s.name, { onclick: function() { openSectionEditor(s.id); } }));
      if (s.description) row.append(ce('p', false, false, s.description));
      panel.append(row);
    });
  });
}

function showTagsPanel() {
  var panel = renderPanel();
  panel.append(ce('h2', false, false, 'Теги'));
  panel.append(ce('button', false, false, '+ Добавить тег', { onclick: addTagForm }));

  load('tags').then(function(tags) {
    tags.filter(function(t) { return t.active; }).forEach(function(t) {
      var row = listContainer(t, true);
      row.append(ce('h3', false, false, t.name, { onclick: function() { openTagEditor(t.id); } }));
      panel.append(row);
    });
  });
}

// TinyMCE options shared across all editors
var tinyOpts = {
  plugins: 'anchor autolink charmap codesample image link lists media searchreplace table visualblocks wordcount',
  toolbar: 'undo redo | blocks | bold italic | link image | align | numlist bullist | removeformat',
};

function openTinyEditor(collection, id, data) {
  var p = preparePopupWeb(collection + '_' + id, false, false, false);

  p.append(ce('h1', false, 'editable', data.name, {
    onclick: function() { edit(collection, id, 'name', 'text', data.name, this); }
  }));
  p.append(ce('p', false, 'editable', data.description || 'добавить описание', {
    onclick: function() { edit(collection, id, 'description', 'textarea', data.description, this); }
  }));

  var editorId = 'editor-' + collection + '-' + id;
  var ta = ce('textarea', editorId);
  ta.value = data.html || '';
  p.append(ta);

  // Destroy existing instance before re-init (fixes multiple-open bug)
  if (tinymce.get(editorId)) tinymce.get(editorId).destroy();
  tinymce.init(Object.assign({ selector: '#' + editorId }, tinyOpts));

  p.append(ce('button', false, ['dark', 'dateButton'], 'Сохранить HTML', {
    onclick: function() {
      var html = tinymce.get(editorId).getContent();
      axios.put('/dimazvali/admin/' + collection + '/' + id, { attr: 'html', value: html })
        .then(handleSave).catch(handleError);
    }
  }));

  p.append(deleteButton(collection, id, !data.active));
}

function openPageEditor(id) {
  load('pages', id).then(function(data) { openTinyEditor('pages', id, data); });
}

function openSectionEditor(id) {
  load('sections', id).then(function(data) { openTinyEditor('sections', id, data); });
}

function openTagEditor(id) {
  load('tags', id).then(function(data) { openTinyEditor('tags', id, data); });
}

function showPageLine(p) {
  var c = listContainer(p, true);
  c.append(ce('h2', false, false, p.name, { onclick: function() { openPageEditor(p.id); } }));
  c.append(ce('p', false, false, p.description));
  return c;
}

function addPageForm() {
  addScreen('pages', 'Новая страница', {
    name:        { placeholder: 'Название' },
    slug:        { placeholder: 'slug' },
    description: { placeholder: 'Описание', type: 'textarea' },
    pic:         { placeholder: 'Картинка' }
  });
}

function addSectionForm() {
  addScreen('sections', 'Новый раздел', {
    name:        { placeholder: 'Название' },
    slug:        { placeholder: 'slug' },
    description: { placeholder: 'Описание', type: 'textarea' },
    pic:         { placeholder: 'Картинка' }
  });
}

function addTagForm() {
  addScreen('tags', 'Новый тег', {
    name:        { placeholder: 'Название' },
    slug:        { placeholder: 'slug' },
    description: { placeholder: 'Описание', type: 'textarea' },
    pic:         { placeholder: 'Картинка' }
  });
}
