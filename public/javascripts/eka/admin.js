'use strict';
(function () {
  function parseRuDate(str) {
    var m = str.match(/^(\d{1,2})\.(\d{2})\.(\d{4})$/);
    return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
  }

  function cellText(row, col) {
    var cell = row.cells[col];
    return cell ? cell.textContent.trim() : '';
  }

  function compareValues(aText, bText, asc) {
    // Date (dd.mm.yyyy)
    var aDate = parseRuDate(aText);
    var bDate = parseRuDate(bText);
    if (aDate && bDate) return asc ? aDate - bDate : bDate - aDate;

    // Number (strip currency/units, keep first number found)
    var aNum = parseFloat((aText.match(/[\d]+[,.]?[\d]*/)||[''])[0].replace(',', '.'));
    var bNum = parseFloat((bText.match(/[\d]+[,.]?[\d]*/)||[''])[0].replace(',', '.'));
    if (!isNaN(aNum) && !isNaN(bNum) && aText !== '' && bText !== '') {
      return asc ? aNum - bNum : bNum - aNum;
    }

    // String
    var cmp = aText.localeCompare(bText, 'ru', { sensitivity: 'base' });
    return asc ? cmp : -cmp;
  }

  function initTable(table) {
    var ths = Array.from(table.querySelectorAll('thead th'));
    var tbody = table.querySelector('tbody');
    if (!tbody || !ths.length) return;

    var state = { col: -1, asc: true };

    ths.forEach(function (th, col) {
      th.classList.add('sort-th');
      th.addEventListener('click', function () {
        if (state.col === col) {
          state.asc = !state.asc;
        } else {
          state.col = col;
          state.asc = true;
        }
        ths.forEach(function (h) { h.removeAttribute('data-sort'); });
        th.setAttribute('data-sort', state.asc ? 'asc' : 'desc');
        sortTable(tbody, col, state.asc);
      });
    });
  }

  var DETAIL_CLASSES = ['req-detail', 'rev-detail'];

  function isDetail(row) {
    return DETAIL_CLASSES.some(function (c) { return row.classList.contains(c); });
  }

  function sortTable(tbody, col, asc) {
    // Collect primary rows, pairing each with its optional detail sibling
    var rows = Array.from(tbody.children);
    var groups = [];
    var i = 0;
    while (i < rows.length) {
      if (isDetail(rows[i])) { i++; continue; }
      var detail = (rows[i + 1] && isDetail(rows[i + 1])) ? rows[i + 1] : null;
      groups.push({ row: rows[i], detail: detail });
      i += detail ? 2 : 1;
    }

    groups.sort(function (a, b) {
      return compareValues(cellText(a.row, col), cellText(b.row, col), asc);
    });

    groups.forEach(function (g) {
      tbody.appendChild(g.row);
      if (g.detail) tbody.appendChild(g.detail);
    });
  }

  document.querySelectorAll('.admin-table').forEach(initTable);

  // Highlight active nav link
  (function() {
    var path = location.pathname;
    var links = document.querySelectorAll('.admin-nav a');
    var best = null, bestLen = 0;
    links.forEach(function(a) {
      var href = a.getAttribute('href');
      if (!href) return;
      var matches = href === '/admin/'
        ? (path === '/admin/' || path === '/admin')
        : (path === href || path.startsWith(href + '/'));
      if (matches && href.length > bestLen) { best = a; bestLen = href.length; }
    });
    if (best) best.classList.add('active');
  })();
})();
