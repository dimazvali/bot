'use strict';
// One-off helper for the admin layout migration (docs/superpowers/plans/2026-10-15-photo-admin-layout.md):
// turns a standalone admin page (doctype/html/head/body/.admin-wrap/.admin-header) into
// `extends layout` with blocks. The old .admin-header subtree is returned/printed separately —
// its parts go into block breadcrumbs / block actions by hand.
// Usage: node scripts/admin-pug-to-layout.js <page.pug> <navKey>   (rewrites the file, prints the old header)
var fs = require('fs');

// head children the layout already provides
var LAYOUT_HEAD = [/^title\b/, /^meta\(charset/, /^meta\(name='viewport'/, /^meta\(name='robots'/, /stylesheets\/photo\/style\.css/];

function indentOf(line) { return line.match(/^ */)[0].length; }

// index after the subtree that starts at line i (next non-blank line indented <= line i)
function subtreeEnd(lines, i) {
  var ind = indentOf(lines[i]);
  for (var j = i + 1; j < lines.length; j++) {
    if (lines[j].trim() && indentOf(lines[j]) <= ind) return j;
  }
  return lines.length;
}

function shift(lines, from, to) {
  return lines.map(function(l) { return l.trim() ? ' '.repeat(to) + l.slice(from) : ''; });
}

// children (as [start, end) ranges) of the node at line i
function children(lines, i) {
  var out = [];
  var end = subtreeEnd(lines, i);
  var j = i + 1;
  while (j < end) {
    if (!lines[j].trim()) { j++; continue; }
    var e = subtreeEnd(lines, j);
    out.push([j, e]);
    j = e;
  }
  return out;
}

function trimTrailingBlank(lines) {
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines;
}

function convert(src, navKey) {
  var lines = src.replace(/\r\n/g, '\n').split('\n');
  if (/^extends\b/.test(lines[0])) throw new Error('already extends a layout');
  var pre = [], head = [], content = [], scripts = [], header = [];

  var i = 0;
  while (i < lines.length && !/^doctype\b/.test(lines[i])) {
    if (lines[i].trim()) pre.push(lines[i].trim());
    i++;
  }
  var htmlLine = lines.findIndex(function(l, k) { return k > i && /^html\b/.test(l); });
  if (htmlLine === -1) throw new Error('no html root');

  children(lines, htmlLine).forEach(function(r) {
    var name = lines[r[0]].trim();
    if (name === 'head') {
      children(lines, r[0]).forEach(function(c) {
        var first = lines[c[0]].trim();
        if (LAYOUT_HEAD.some(function(re) { return re.test(first); })) return;
        head = head.concat(shift(lines.slice(c[0], c[1]), 4, 2));
      });
    } else if (name === 'body') {
      children(lines, r[0]).forEach(function(c) {
        var first = lines[c[0]].trim();
        if (/^\.admin-wrap\b/.test(first)) {
          children(lines, c[0]).forEach(function(w) {
            var wl = lines.slice(w[0], w[1]);
            if (/^\.admin-header\b/.test(lines[w[0]].trim())) {
              // header children keep their nesting (indent 8 → 0), so they can be pasted into a block
              header = header.concat(shift(wl.slice(1), 8, 0).filter(Boolean));
            } else {
              content = content.concat(shift(wl, 6, 2));
            }
          });
        } else {
          scripts = scripts.concat(shift(lines.slice(c[0], c[1]), 4, 2));
        }
      });
    }
  });

  var out = ['extends layout', 'block vars'];
  pre.forEach(function(l) { out.push('  ' + l); });
  out.push("  - var nav = '" + navKey + "'");
  if (head.length) out = out.concat(['block head'], trimTrailingBlank(head));
  out = out.concat(['block content'], trimTrailingBlank(content));
  if (scripts.length) out = out.concat(['block scripts'], trimTrailingBlank(scripts));
  return { pug: out.join('\n') + '\n', header: header };
}

module.exports = { convert: convert };

if (require.main === module) {
  var file = process.argv[2], navKey = process.argv[3];
  if (!file || !navKey) {
    console.error('usage: node scripts/admin-pug-to-layout.js <page.pug> <navKey>');
    process.exit(1);
  }
  var r = convert(fs.readFileSync(file, 'utf8'), navKey);
  fs.writeFileSync(file, r.pug);
  console.log('converted ' + file + '\nold header (move into breadcrumbs/actions):\n' + r.header.map(function(l) { return '  ' + l; }).join('\n'));
}
