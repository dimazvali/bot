'use strict';
// Browser caching for public images in Cloud Storage.
//
// Images are cached for a year and marked immutable, so repeat visitors never
// download the same file twice. That is only safe because a URL never changes
// content: uploads that can overwrite an existing path (replacing a photo, fixed
// names like eka's profile photo) store the URL with `?v=<time>`, which Cloud
// Storage ignores but browsers treat as a new file.

var IMMUTABLE = 'public, max-age=31536000, immutable';

// Options for file.save(): content type + the cache header.
function saveOptions(contentType, extra) {
  return Object.assign({ contentType: contentType, metadata: { cacheControl: IMMUTABLE } }, extra || {});
}

function versioned(url, v) {
  if (!url) return url;
  return url.replace(/\?v=[^&#]*$/, '') + '?v=' + (v || Date.now().toString(36));
}

module.exports = { IMMUTABLE: IMMUTABLE, saveOptions: saveOptions, versioned: versioned };
