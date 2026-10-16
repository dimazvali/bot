// Click-to-sort for admin tables: every `th.admin-table-sortable` in a `table.admin-table` sorts its
// column by the cells' data-value (data-type="number" on the th for numeric columns). Uses the
// header's cellIndex, so non-sortable columns (covers, actions) can sit anywhere.
document.querySelectorAll('table.admin-table').forEach(function(table) {
  table.querySelectorAll('th.admin-table-sortable').forEach(function(th) {
    th.addEventListener('click', function() {
      var col = th.cellIndex;
      var tbody = table.querySelector('tbody');
      var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
      var numeric = th.dataset.type === 'number';
      var asc = th.dataset.dir !== 'asc';
      table.querySelectorAll('th.admin-table-sortable').forEach(function(h) { delete h.dataset.dir; });
      th.dataset.dir = asc ? 'asc' : 'desc';
      rows.sort(function(a, b) {
        var av = a.children[col].dataset.value || '';
        var bv = b.children[col].dataset.value || '';
        var cmp = numeric ? (parseFloat(av) || 0) - (parseFloat(bv) || 0) : av.toLowerCase().localeCompare(bv.toLowerCase(), 'ru');
        return asc ? cmp : -cmp;
      });
      rows.forEach(function(r) { tbody.appendChild(r); });
    });
  });
});
