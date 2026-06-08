// Contact type toggle (request form)
document.addEventListener('DOMContentLoaded', function() {
  var ctOptions = document.querySelectorAll('.ct-option');
  var ctInput = document.getElementById('contactTypeInput');
  var contactInput = document.getElementById('contactInput');
  var contactLabel = document.getElementById('contactLabel');

  if (ctOptions.length && ctInput) {
    var placeholders = { email: 'your@email.com', telegram: '@username', whatsapp: '+995 500 000 000' };
    var labels_ru = { email: 'Email *', telegram: 'Telegram *', whatsapp: 'WhatsApp *' };
    var labels_en = { email: 'Email *', telegram: 'Telegram *', whatsapp: 'WhatsApp *' };
    var lang = document.documentElement.lang || 'ru';

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
