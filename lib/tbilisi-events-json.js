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

module.exports = { extractBalancedJson: extractBalancedJson };
