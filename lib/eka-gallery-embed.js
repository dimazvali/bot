'use strict';

var SHORTCODE_RE = /\[gallery:([a-zA-Z0-9]+)\]/g;

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function renderGalleryHtml(images) {
  if (!images || !images.length) return '';
  var items = images.map(function(img, i) {
    var caption = escapeHtml(img.caption || '');
    var full = escapeHtml(img.w1400 || img.w800 || img.w400 || '');
    var thumb = escapeHtml(img.w800 || img.w400 || '');
    var srcset = [img.w400 && (img.w400 + ' 400w'), img.w800 && (img.w800 + ' 800w'), img.w1400 && (img.w1400 + ' 1400w'), img.w2400 && (img.w2400 + ' 2400w')].filter(Boolean).join(', ');
    return '<div class="tour-embed-gallery-item" data-lb="' + i + '" data-src="' + full + '" data-srcset="' + escapeHtml(srcset) + '" data-caption="' + caption + '">'
      + '<img src="' + thumb + '" alt="' + caption + '" loading="lazy">'
      + '</div>';
  }).join('');
  return '<div class="tour-embed-gallery">' + items + '</div>';
}

// Replaces [gallery:ID] shortcodes inside already-sanitized description HTML
// with a rendered image grid. IDs reference the `eka_galleries` collection;
// images are looked up via the generic eka_images ownerId/role scoping.
async function renderGalleryShortcodes(html, ekaData) {
  if (!html) return html;
  var ids = [];
  var m;
  SHORTCODE_RE.lastIndex = 0;
  while ((m = SHORTCODE_RE.exec(html))) {
    if (ids.indexOf(m[1]) === -1) ids.push(m[1]);
  }
  if (!ids.length) return html;

  var htmlById = {};
  await Promise.all(ids.map(async function(id) {
    try {
      var images = await ekaData.getImages({ ownerId: id, role: 'gallery' });
      htmlById[id] = renderGalleryHtml(images);
    } catch (e) {
      htmlById[id] = '';
    }
  }));

  var result = html;
  ids.forEach(function(id) {
    var fragment = htmlById[id];
    var wrappedRe = new RegExp('<p>\\s*\\[gallery:' + id + '\\]\\s*(?:<br\\s*/?>)?\\s*</p>', 'gi');
    if (wrappedRe.test(result)) {
      result = result.replace(wrappedRe, fragment);
    } else {
      result = result.replace(new RegExp('\\[gallery:' + id + '\\]', 'g'), fragment);
    }
  });
  return result;
}

module.exports = { renderGalleryShortcodes: renderGalleryShortcodes };
