'use strict';

function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeDedupeKey(title, date) {
  return normalizeTitle(title) + '|' + (date || '');
}

module.exports = { normalizeTitle, computeDedupeKey };
