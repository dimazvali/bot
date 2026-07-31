var Anthropic = require('@anthropic-ai/sdk');
var axios = require('axios');

var BASE_KEYWORDS = 'аэрофотосъёмка, aerial photography, Дмитрий Шестаков, Dmitry Shestakov, drone photography, документальная фотография';

async function fetchImageBase64(url) {
  var response = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
  return {
    data: Buffer.from(response.data).toString('base64'),
    mediaType: (response.headers['content-type'] || 'image/webp').split(';')[0],
  };
}

async function generatePhotoSeo(photo, { countryLabel, seriesLabel, allTags, shootDesc, previousCaptions, knownPeople }) {
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  var client = new Anthropic({ apiKey, timeout: 30000 });

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

  var imageUrl = photo.urls && (photo.urls.preview || photo.urls.full);
  var image = imageUrl ? await fetchImageBase64(imageUrl) : null;

  var content = [];
  if (image) {
    content.push({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } });
  }
  var eventContext = shootDesc
    ? 'Контекст события: ' + shootDesc + '. Место/название события можно иногда упомянуть, если это уместно к конкретному кадру — но не в каждой подписи подряд, иначе получится шаблонно.\n\n'
    : '';
  var peopleContext = (knownPeople && knownPeople.length)
    ? 'На фото уверенно распознан(ы): ' + knownPeople.join(', ') + '. Обязательно назови его/их по имени в подписи, если он/они видны в кадре.\n\n'
    : '';
  var sequenceContext = (previousCaptions && previousCaptions.length)
    ? 'Подписи предыдущих кадров этой же съёмки, по порядку (это не шаблон для копирования — не повторяй формулировки, но если по ним видно, как разворачивается событие, можешь это отразить):\n'
      + previousCaptions.map(function(c) { return '- ' + c; }).join('\n') + '\n\n'
    : '';

  content.push({
    type: 'text',
    text: 'Посмотри на фотографию и опиши, что на ней изображено — конкретную сцену, деталь, предмет.\n\n'
      + 'Стиль: сухо, точно, безоценочно — одна главная деталь, без перечисления через запятую всего, что видно на фото. '
      + 'Без иронии, без комментариев от себя, без выводов и обобщений, без рекламных штампов вроде "потрясающий вид" или "завораживающий кадр". '
      + 'Одно короткое законченное предложение. Максимум 110 символов, на русском.\n\n'
      + eventContext
      + peopleContext
      + sequenceContext
      + 'Также сгенерируй SEO keywords (6-8 терминов, смесь русского и английского, включая страну и предмет съёмки).\n\n'
      + 'Метаданные фото ниже — только для тебя, не пересказывай их дословно (название файла, теги и т.п. не должны попасть в текст как есть), но используй как подсказку:\n' + parts + '\n\n'
      + 'Ответь только JSON, без markdown: {"desc":"...","keywords":"..."}',
  });

  var message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content }],
  });

  var text = message.content[0].text.trim();
  var match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response: ' + text);
  var json = JSON.parse(match[0]);
  return {
    desc: truncateDesc(json.desc, 150),
    keywords: (json.keywords || '').trim(),
  };
}

function truncateDesc(text, maxLen) {
  text = (text || '').trim();
  if (text.length <= maxLen) return text;
  var cut = text.slice(0, maxLen);
  var lastStop = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
  if (lastStop > maxLen * 0.5) return cut.slice(0, lastStop + 1).trim();
  var lastComma = Math.max(cut.lastIndexOf(','), cut.lastIndexOf(';'), cut.lastIndexOf(':'));
  if (lastComma > maxLen * 0.5) return cut.slice(0, lastComma).trim() + '.';
  var lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.6) cut = cut.slice(0, lastSpace);
  return cut.trim();
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
