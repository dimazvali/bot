/**
 * Batch AI SEO generation for all photos without seo_keywords.
 * Usage:
 *   node scripts/generate-photo-seo.js           — process all without seo_keywords
 *   node scripts/generate-photo-seo.js --all      — regenerate everything
 *   node scripts/generate-photo-seo.js --dry-run  — preview only
 */
require('dotenv').config();

var fs = require('fs');
var path = require('path');
var { generatePhotoSeo } = require('../lib/photo-seo');

var DRY_RUN = process.argv.includes('--dry-run');
var FORCE_ALL = process.argv.includes('--all');
var DELAY_MS = 300; // avoid hammering the API

var DATA_PATH = path.join(__dirname, '../data/photo.json');

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  var data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

  // Collect all tags for label lookup
  var tagsPath = path.join(__dirname, '../data/photo-tags.json');
  var allTags = fs.existsSync(tagsPath) ? JSON.parse(fs.readFileSync(tagsPath, 'utf8')) : {};

  var total = 0, processed = 0, skipped = 0, errors = 0;

  for (var countryKey of Object.keys(data)) {
    var country = data[countryKey];
    if (country.archived) continue;

    for (var seriesKey of Object.keys(country.series || {})) {
      var series = country.series[seriesKey];
      if (series.archived) continue;

      for (var photo of (series.photos || [])) {
        total++;
        var needsSeo = FORCE_ALL || !photo.seo_keywords;
        if (!needsSeo) { skipped++; continue; }

        var label = photo.title + ' / ' + series.label + ' / ' + country.label;
        if (DRY_RUN) {
          console.log('[dry-run] would generate:', label);
          processed++;
          continue;
        }

        process.stdout.write('  ' + label + ' … ');
        try {
          var result = await generatePhotoSeo(photo, {
            countryLabel: country.label,
            seriesLabel: series.label,
            allTags,
          });
          if (!photo.desc) photo.desc = result.desc;
          photo.seo_keywords = result.keywords;
          console.log('ok');
          processed++;
          await sleep(DELAY_MS);
        } catch (e) {
          console.log('ERROR:', e.message);
          errors++;
          await sleep(1000);
        }
      }
    }
  }

  if (!DRY_RUN && processed > 0) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log('\nСохранено в data/photo.json');
  }

  console.log(`\nИтого: ${total} фото | обработано: ${processed} | пропущено: ${skipped} | ошибок: ${errors}`);
}

main().catch(function(e) { console.error(e); process.exit(1); });
