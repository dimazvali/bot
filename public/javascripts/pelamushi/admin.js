(function () {
  function initDropZones() {
    document.querySelectorAll('input[type=file][accept*=image]').forEach(function (input) {
      if (input.closest('.drop-zone')) return; // already upgraded

      // Build wrapper
      var zone = document.createElement('div');
      zone.className = 'drop-zone';

      // Placeholder content
      var placeholder = document.createElement('div');
      placeholder.className = 'drop-zone-placeholder';
      placeholder.innerHTML =
        '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>' +
        '<path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>' +
        '<span>Перетащите файл или нажмите для выбора</span>';

      // Preview element
      var preview = document.createElement('img');
      preview.className = 'drop-zone-preview';
      preview.style.display = 'none';

      zone.appendChild(placeholder);
      zone.appendChild(preview);

      input.parentNode.insertBefore(zone, input);
      zone.appendChild(input); // move input inside zone (hidden via CSS)

      function showPreview(file) {
        if (!file || !file.type.startsWith('image/')) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          preview.src = e.target.result;
          preview.style.display = 'block';
          placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
      }

      // Click zone → open file dialog
      zone.addEventListener('click', function (e) {
        if (e.target === input) return;
        input.click();
      });

      // Input change (normal select)
      input.addEventListener('change', function () {
        if (input.files[0]) showPreview(input.files[0]);
      });

      // Drag events
      zone.addEventListener('dragover', function (e) {
        e.preventDefault();
        zone.classList.add('dragover');
      });
      zone.addEventListener('dragleave', function (e) {
        if (!zone.contains(e.relatedTarget)) zone.classList.remove('dragover');
      });
      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('dragover');
        var file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        var dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        showPreview(file);
      });
    });
  }

  function initSortableTables() {
    document.querySelectorAll('th[data-sort]').forEach(function (th) {
      th.style.cursor = 'pointer';
      th.style.userSelect = 'none';
      th.style.whiteSpace = 'nowrap';

      var arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      arrow.textContent = ' ↕';
      arrow.style.opacity = '0.3';
      arrow.style.fontSize = '0.75em';
      th.appendChild(arrow);

      th.addEventListener('click', function () {
        var table = th.closest('table');
        var tbody = table.querySelector('tbody');
        var ths = Array.from(th.parentNode.querySelectorAll('th[data-sort]'));
        var colIndex = Array.from(th.parentNode.children).indexOf(th);
        var type = th.dataset.sort;
        var asc = th.dataset.sortDir !== 'asc';
        th.dataset.sortDir = asc ? 'asc' : 'desc';

        // Reset other headers
        ths.forEach(function (h) {
          if (h !== th) {
            delete h.dataset.sortDir;
            var a = h.querySelector('.sort-arrow');
            if (a) { a.textContent = ' ↕'; a.style.opacity = '0.3'; }
          }
        });
        arrow.textContent = asc ? ' ↑' : ' ↓';
        arrow.style.opacity = '1';

        var rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort(function (a, b) {
          var aText = (a.cells[colIndex] && a.cells[colIndex].textContent.trim()) || '';
          var bText = (b.cells[colIndex] && b.cells[colIndex].textContent.trim()) || '';
          var cmp;
          if (type === 'num') {
            cmp = (parseFloat(aText) || 0) - (parseFloat(bText) || 0);
          } else {
            cmp = aText.localeCompare(bText, undefined, { sensitivity: 'base' });
          }
          return asc ? cmp : -cmp;
        });
        rows.forEach(function (r) { tbody.appendChild(r); });
      });
    });
  }

  function init() {
    initDropZones();
    initSortableTables();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
