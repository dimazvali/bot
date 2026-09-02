'use strict';

// Pull the first balanced JSON value (object or array) out of an LLM response.
// A plain greedy /\{[\s\S]*\}/ breaks when the model appends a stray trailing
// bracket — Haiku 4.5 does this fairly often — so scan for the matching close
// bracket instead, string/escape aware. `opener` is '{' or '['.
function extractBalancedJson(raw, opener) {
  var text = String(raw || '').trim();
  var fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  var open = opener || '{';
  var close = open === '[' ? ']' : '}';
  var start = text.indexOf(open);
  if (start === -1) return null;

  var depth = 0, inStr = false, esc = false;
  for (var i = start; i < text.length; i++) {
    var ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// JSON.parse after repairing the two malformations Haiku 4.5 emits most often:
// trailing commas before } or ], and raw newlines / tabs inside string values
// (invalid per spec). Both fixes run in one string-aware pass. Throws like
// JSON.parse if the text is still not valid JSON.
function parseLooseJson(blob) {
  var text = String(blob || '');
  var out = '';
  var inStr = false, esc = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (inStr) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') { out += ch; inStr = false; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
      out += ch;
      continue;
    }
    if (ch === '"') { out += ch; inStr = true; continue; }
    if (ch === ',') {
      var j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === '}' || text[j] === ']') continue; // drop the trailing comma
    }
    out += ch;
  }
  return JSON.parse(out);
}

// Extract the first balanced object/array and parse it leniently.
function extractAndParse(raw, opener) {
  var blob = extractBalancedJson(raw, opener);
  if (!blob) return null;
  return parseLooseJson(blob);
}

module.exports = {
  extractBalancedJson: extractBalancedJson,
  parseLooseJson: parseLooseJson,
  extractAndParse: extractAndParse,
};
