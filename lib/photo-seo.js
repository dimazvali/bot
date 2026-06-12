var Anthropic = require('@anthropic-ai/sdk');

var BASE_KEYWORDS = 'аэрофотосъёмка, aerial photography, Дмитрий Шестаков, Dmitry Shestakov, drone photography, документальная фотография';

async function generatePhotoSeo(photo, { countryLabel, seriesLabel, allTags }) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  var client = new Anthropic({ apiKey });

  var tagLabels = (photo.tags || []).map(function(t) { return (allTags[t] && allTags[t].label) || t; }).join(', ');

  var typeLabel = { copter: 'aerial drone photography', camera: 'ground-level camera photography', mobile: 'mobile phone photography' }[photo.type] || 'aerial photography';

  var parts = [
    'Title: ' + photo.title,
    'Series: ' + seriesLabel,
    'Country: ' + countryLabel,
    'Type: ' + typeLabel,
    tagLabels ? 'Tags: ' + tagLabels : null,
    photo.altitude ? 'Altitude: ' + photo.altitude + 'm' : null,
    photo.date ? 'Date: ' + photo.date : null,
  ].filter(Boolean).join('\n');

  var message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: 'You are an SEO copywriter for an aerial photography portfolio.\n'
        + 'Generate for this aerial photo:\n'
        + '1. A meta description in Russian (max 155 chars, natural language, no marketing clichés)\n'
        + '2. SEO keywords (6-8 terms, mix Russian and English, include country and subject matter)\n\n'
        + parts + '\n\n'
        + 'Respond with JSON only, no markdown: {"desc":"...","keywords":"..."}',
    }],
  });

  var text = message.content[0].text.trim();
  var match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response: ' + text);
  var json = JSON.parse(match[0]);
  return {
    desc: (json.desc || '').substring(0, 160).trim(),
    keywords: (json.keywords || '').trim(),
  };
}

function buildPageKeywords(photoList, tagIndex, extra) {
  var tagLabels = [];
  var seen = new Set();
  (photoList || []).forEach(function(p) {
    (p.tags || []).forEach(function(t) {
      if (!seen.has(t) && tagIndex[t]) {
        seen.add(t);
        tagLabels.push(tagIndex[t].label);
      }
    });
  });
  var parts = [BASE_KEYWORDS];
  if (extra && extra.length) parts = parts.concat(extra);
  if (tagLabels.length) parts = parts.concat(tagLabels.slice(0, 5));
  return parts.join(', ');
}

module.exports = { generatePhotoSeo, buildPageKeywords, BASE_KEYWORDS };
