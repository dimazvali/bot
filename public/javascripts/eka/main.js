// Contact type toggle (request form) — scoped per <form> so a page can hold more than one
document.addEventListener('DOMContentLoaded', function() {
  var placeholders = { email: 'your@email.com', telegram: '@username', whatsapp: '+995 500 000 000' };
  var labels_ru = { email: 'Email *', telegram: 'Telegram *', whatsapp: 'WhatsApp *' };
  var labels_en = { email: 'Email *', telegram: 'Telegram *', whatsapp: 'WhatsApp *' };
  var lang = document.documentElement.lang || 'ru';

  document.querySelectorAll('form').forEach(function(form) {
    var ctOptions = form.querySelectorAll('.ct-option');
    var ctInput = form.querySelector('.contact-type-value');
    var contactInput = form.querySelector('.contact-input');
    var contactLabel = form.querySelector('.contact-label');
    if (!ctOptions.length || !ctInput) return;

    ctOptions.forEach(function(btn) {
      btn.addEventListener('click', function() {
        ctOptions.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var ct = btn.getAttribute('data-ct');
        ctInput.value = ct;
        if (contactInput) contactInput.placeholder = placeholders[ct] || '';
        if (contactLabel) contactLabel.textContent = (lang === 'ru' ? labels_ru[ct] : labels_en[ct]) || ct;
      });
    });
  });

  // Request box tabs ("Book" / "Ask a question")
  document.querySelectorAll('.request-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var box = tab.closest('.request-box');
      if (!box) return;
      box.querySelectorAll('.request-tab').forEach(function(t) { t.classList.remove('active'); });
      box.querySelectorAll('.request-panel').forEach(function(p) { p.classList.remove('active'); });
      tab.classList.add('active');
      var panel = box.querySelector('.request-panel[data-panel="' + tab.getAttribute('data-tab') + '"]');
      if (panel) panel.classList.add('active');
    });
  });

  // Populate UTM hidden inputs from sessionStorage
  var utmRaw = sessionStorage.getItem('eka_utms');
  if (utmRaw) {
    try {
      var utms = JSON.parse(utmRaw);
      document.querySelectorAll('form').forEach(function(form) {
        Object.keys(utms).forEach(function(k) {
          var inp = form.querySelector('input[name="' + k + '"]');
          if (inp) inp.value = utms[k];
        });
      });
    } catch(e) {}
  }

  // Admin drag-to-reorder (directions)
  var dragList = document.getElementById('directionsList');
  if (dragList) {
    var dragging = null;
    dragList.querySelectorAll('[draggable]').forEach(function(row) {
      row.addEventListener('dragstart', function() { dragging = row; row.style.opacity = '0.4'; });
      row.addEventListener('dragend', function() { dragging = null; row.style.opacity = ''; });
      row.addEventListener('dragover', function(e) { e.preventDefault(); dragList.insertBefore(dragging, row); });
    });
    var saveOrderBtn = document.getElementById('saveOrderBtn');
    if (saveOrderBtn) {
      saveOrderBtn.addEventListener('click', function() {
        var ids = Array.from(dragList.querySelectorAll('[data-id]')).map(function(r) { return r.getAttribute('data-id'); });
        fetch('/admin/directions/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: ids }),
        }).then(function() { saveOrderBtn.textContent = '✓'; });
      });
    }
  }
});
