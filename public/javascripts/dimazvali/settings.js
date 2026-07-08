// settings.js — bot text settings + read-only webhook status

var settingsFields = [
  { key: 'welcomeText', label: 'Приветствие новому пользователю' },
  { key: 'noToursText', label: 'Нет активных туров' },
  { key: 'toursIntroText', label: 'Текст перед списком туров' },
  { key: 'tourFinishedText', label: 'Конец маршрута' },
  { key: 'stepTransitionText', label: 'Переход к следующей точке ({name} подставится автоматически)' },
  { key: 'about', label: 'Текст "О гиде" (about)' }
];

function showSettingsPanel() {
  var panel = renderPanel();
  panel.append(ce('h2', false, false, 'Настройки бота'));

  load('settings', 'bot').then(function(data) {
    renderSettingsFields(panel, data || {});
  }).catch(function() {
    renderSettingsFields(panel, {});
  });

  var statusSection = ce('div', false, 'card');
  statusSection.append(ce('h2', false, false, 'Статус'));
  var statusBody = ce('div');
  statusSection.append(statusBody);
  panel.append(statusSection);

  axios.get('/' + host + '/admin/botStatus').then(function(res) {
    var s = res.data;
    statusBody.append(ce('p', false, false, 'Бот: @' + s.username));
    statusBody.append(ce('p', false, false, 'Окружение: ' + s.environment));
    statusBody.append(ce('p', false, false, 'Webhook: ' + s.webhookUrl));
    statusBody.append(ce('p', false, false, 'Необработанных обновлений: ' + s.pendingUpdateCount));
    if (s.lastErrorMessage) {
      statusBody.append(ce('p', false, false, '⚠ Последняя ошибка (' + s.lastErrorDate + '): ' + s.lastErrorMessage));
    }
  }).catch(function() {
    statusBody.append(ce('p', false, false, '⚠ не удалось получить статус'));
  });
}

function renderSettingsFields(panel, data) {
  settingsFields.forEach(function(f) {
    var row = ce('div', false, 'sDivided');
    row.append(ce('h3', false, false, f.label));
    row.append(ce('p', false, 'editable', data[f.key] || 'не задано', {
      onclick: function() { edit('settings', 'bot', f.key, 'textarea', data[f.key], this); }
    }));
    panel.append(row);
  });
}
