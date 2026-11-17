'use strict';
// Share cards for the /blackout mini-game ("Kaladze Simulator").
//   it_blackout_shares/{id} — one per finished shift that asked for it; id = hash of the shift id,
//   so re-sending the same shift returns the same link.
// The card is a 1200×630 PNG drawn server-side after the Claude Design mock: sharp renders each text
// run with Pango straight from the bundled font files (assets/fonts/blackout), so nothing depends on
// the fonts installed on the server.
var crypto = require('crypto');
var path = require('path');
var sharp = require('sharp');

var COL = 'it_blackout_shares';
var FONTS = path.join(__dirname, '..', 'assets', 'fonts', 'blackout');
var UNBOUNDED = path.join(FONTS, 'Unbounded.ttf');
var PLEX = path.join(FONTS, 'IBMPlexMono-SemiBold.ttf');
var GEORGIAN = path.join(FONTS, 'NotoSansGeorgian.ttf');
var W = 1200, H = 630;
var BG = '#f2cf3b';  // oklch(0.86 0.16 95) from the mock
var INK = '#0c0d10';
var PAPER = '#f3f1ec';

var DISTRICTS = {
  gldani: 'Gldani', nadzaladevi: 'Nadzaladevi', didube: 'Didube', chughureti: 'Chughureti', saburtalo: 'Saburtalo',
  vake: 'Vake', mtatsminda: 'Mtatsminda', krtsanisi: 'Krtsanisi', isani: 'Isani', samgori: 'Samgori',
};
// what "went dark" says after the district, by the outage that ended the shift
// (non-breaking spaces: a long district wraps after the comma, never inside "no water")
var CAUSES = { light: 'block 9', water: 'no water', gas: 'boiler lit' };

var db = null;

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function clock(ms) {
  var s = Math.max(0, Math.round((ms || 0) / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// the three strings the card shows
function cardText(share) {
  var n = share.fixes;
  return {
    time: clock(share.durationMs),
    fixed: n + (n === 1 ? ' outage' : ' outages'),
    lost: (DISTRICTS[share.district] || 'Tbilisi') + ', ' + (CAUSES[share.cause] || CAUSES.light),
  };
}

function shareId(sid) { return crypto.createHash('sha256').update('share:' + sid).digest('base64url').slice(0, 10); }

// one Pango text run → { input, width, height }. size in px (dpi 72 → 1pt = 1px); spacing in em
async function run(text, fontfile, font, size, color, spacing, wrapWidth) {
  var markup = '<span foreground="' + color + '"' + (spacing ? ' letter_spacing="' + Math.round(spacing * size * 1024) + '"' : '') + '>' + esc(text) + '</span>';
  var opts = { text: markup, font: font + ' ' + size, fontfile: fontfile, rgba: true, dpi: 72 };
  if (wrapWidth) { opts.width = wrapWidth; opts.wrap = 'word'; }
  var r = await sharp({ text: opts }).png().toBuffer({ resolveWithObject: true });
  return { input: r.data, width: r.info.width, height: r.info.height };
}

async function renderCard(share) {
  var t = cardText(share);
  var layers = await Promise.all([
    run('Kaladze Simulator', PLEX, 'IBM Plex Mono SemiBold', 22, INK),
    run('I kept Tbilisi running for', UNBOUNDED, 'Unbounded Ultra-Bold', 44, INK, -0.02),
    run(t.time, UNBOUNDED, 'Unbounded Heavy', 220, INK, -0.05),
    run('კალაძის სიმულა', GEORGIAN, 'Noto Sans Georgian Heavy', 56, '#ffffff', -0.01),
    run('fixed', PLEX, 'IBM Plex Mono SemiBold', 20, INK),
    run(t.fixed, UNBOUNDED, 'Unbounded Ultra-Bold', 36, INK, 0, 340),
    run('went dark', PLEX, 'IBM Plex Mono SemiBold', 20, INK),
    run(t.lost, UNBOUNDED, 'Unbounded Ultra-Bold', 36, INK, 0, 340),
    run('Beat my time →', UNBOUNDED, 'Unbounded Ultra-Bold', 26, PAPER),
    run('it.dimazvali.com/blackout', PLEX, 'IBM Plex Mono SemiBold', 22, INK),
  ]);
  var brand = layers[0], head = layers[1], time = layers[2], ka = layers[3];
  // long shifts ("12:34") would run into the right column: shrink the clock to fit 52…760px
  var timeSize = 220, timeTop = 185;
  if (time.width > 708) {
    timeSize = Math.floor(220 * 708 / time.width);
    time = await run(t.time, UNBOUNDED, 'Unbounded Heavy', timeSize, INK, -0.05);
    timeTop = 185 + Math.round((220 - timeSize) * 0.55); // keep it centred on the same line
  }
  var fixedLabel = layers[4], fixedVal = layers[5], lostLabel = layers[6], lostVal = layers[7];
  var cta = layers[8], url = layers[9];

  // right column: two blocks, each a 3px rule, label, value; offsets matched against the mock
  // (Pango's line boxes are tighter than the browser's, hence the larger gaps than the CSS says)
  var colX = W - 64 - 340;
  var rule1 = 64;
  var fixedLabelY = rule1 + 24;
  var fixedValY = fixedLabelY + fixedLabel.height + 17;
  var rule2 = fixedValY + fixedVal.height + 18;
  var lostLabelY = rule2 + 24;
  var lostValY = lostLabelY + lostLabel.height + 17;

  var pillW = cta.width + 80, pillH = 72, pillY = H - 48 - pillH;
  var shapes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">'
    + '<rect x="' + colX + '" y="' + rule1 + '" width="340" height="3" fill="' + INK + '"/>'
    + '<rect x="' + colX + '" y="' + rule2 + '" width="340" height="3" fill="' + INK + '"/>'
    + '<rect x="64" y="' + pillY + '" width="' + pillW + '" height="' + pillH + '" rx="36" fill="' + INK + '"/>'
    + '</svg>');

  return sharp({ create: { width: W, height: H, channels: 4, background: BG } })
    .composite([
      { input: shapes, top: 0, left: 0 },
      { input: brand.input, top: 62, left: 64 },
      { input: head.input, top: 97, left: 64 },
      { input: time.input, top: timeTop, left: 52 },
      // the Georgian title runs off the right edge, like "…სიმულა|ტორი" in the mock
      { input: ka.input, top: 405, left: Math.max(0, W - ka.width - 6) },
      { input: fixedLabel.input, top: fixedLabelY, left: colX },
      { input: fixedVal.input, top: fixedValY, left: colX },
      { input: lostLabel.input, top: lostLabelY, left: colX },
      { input: lostVal.input, top: lostValY, left: colX },
      { input: cta.input, top: pillY + Math.round((pillH - cta.height) / 2), left: 64 + 40 },
      { input: url.input, top: H - 72 - url.height - 3, left: W - 64 - url.width },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function isInt(n, min, max) { return Number.isInteger(n) && n >= min && n <= max; }

// Is a reported shift result believable enough to put on a card? Same idea as the high-score checks:
// the score fits the scoring rules for that many fixes, and the shift took at least as long as the game
// needs to spawn that many outages, yet no longer than the real time since the shift token was issued.
// rules: { maxScore(fixes), minDurationMs(fixes), fixesPerLevel }
function plausible(body, startedAt, now, rules) {
  var fixes = Number(body.fixes), score = Number(body.score), level = Number(body.level), dur = Number(body.durationMs);
  if (!isInt(fixes, 0, 1e5) || !isInt(score, 0, 1e7) || !isInt(level, 1, 1e4) || !isInt(dur, 0, 6 * 3600 * 1000)) return null;
  if (level !== 1 + Math.floor(fixes / rules.fixesPerLevel) || score > rules.maxScore(fixes)) return null;
  if (dur < rules.minDurationMs(fixes) || dur > now - startedAt + 5000) return null;
  return { fixes: fixes, score: score, level: level, durationMs: dur, district: String(body.district || ''), cause: String(body.cause || '') };
}

// ── promo tile (800×600) for the photo.dimazvali.com galleries, after the "Grid tile" Claude Design mock.
// Static: scripts/build-blackout-tile.js renders it once per language into public/images/blackout/.
var TILE_TEXT = {
  en: { kicker: 'mini-game · Tbilisi', where: 'Vake · no power', desc: 'Power, water, gas — fix it before the city runs out of patience.', cta: 'Play →' },
  ru: { kicker: 'мини-игра · Тбилиси', where: 'Ваке · нет света', desc: 'Свет, вода, газ — почини, пока у города не кончилось терпение.', cta: 'Играть →' },
};

async function renderTile(lang) {
  var tt = TILE_TEXT[lang] || TILE_TEXT.en;
  var TW = 800, TH = 600;
  var layers = await Promise.all([
    run(tt.kicker, PLEX, 'IBM Plex Mono SemiBold', 20, INK),
    run('Kaladze', UNBOUNDED, 'Unbounded Heavy', 66, INK, -0.035),
    run('Simulator', UNBOUNDED, 'Unbounded Heavy', 66, INK, -0.035),
    run('კალაძის სიმულა', GEORGIAN, 'Noto Sans Georgian Heavy', 48, '#ffffff'),
    run(tt.where, PLEX, 'IBM Plex Mono SemiBold', 15, '#8a8c93'),
    run('0:09', UNBOUNDED, 'Unbounded Heavy', 64, PAPER),
    run('მეცხრე ბლოკი იწვის', GEORGIAN, 'Noto Sans Georgian Heavy', 14, BG),
    run(tt.desc, UNBOUNDED, 'Unbounded Medium', 26, INK, 0, 704),
    run(tt.cta, UNBOUNDED, 'Unbounded Ultra-Bold', 22, PAPER),
  ]);
  var kicker = layers[0], l1 = layers[1], l2 = layers[2], ka = layers[3];
  var where = layers[4], time = layers[5], kaSmall = layers[6], desc = layers[7], cta = layers[8];
  var cx = TW - 48 - 110, cy = 44 + 110; // the dark "timer" disc
  var pillW = cta.width + 72, pillH = 64, pillY = TH - 44 - pillH;
  var shapes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + TW + '" height="' + TH + '">'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="110" fill="' + INK + '"/>'
    + '<rect x="48" y="' + pillY + '" width="' + pillW + '" height="' + pillH + '" rx="32" fill="' + INK + '"/>'
    + '</svg>');
  var centred = function (img, centreY) { return { input: img.input, top: Math.round(centreY - img.height / 2), left: Math.round(cx - img.width / 2) }; };
  return sharp({ create: { width: TW, height: TH, channels: 4, background: BG } })
    .composite([
      { input: shapes, top: 0, left: 0 },
      { input: kicker.input, top: 50, left: 48 },
      { input: l1.input, top: 87, left: 48 },
      { input: l2.input, top: 146, left: 48 },
      // the Georgian title runs off the right edge, as in the mock
      { input: ka.input, top: 266, left: Math.max(0, TW - ka.width - 4) },
      centred(where, 105),
      centred(time, 156),
      centred(kaSmall, 205),
      { input: desc.input, top: 376, left: 48 },
      { input: cta.input, top: pillY + Math.round((pillH - cta.height) / 2), left: 48 + 36 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// a share for a finished shift; returns its id (same id for the same shift)
async function createShare(sid, data) {
  var id = shareId(sid);
  var ref = db.collection(COL).doc(id);
  var doc = await ref.get();
  if (!doc.exists) {
    await ref.set({
      durationMs: data.durationMs, fixes: data.fixes, score: data.score, level: data.level,
      district: DISTRICTS[data.district] ? data.district : null,
      cause: CAUSES[data.cause] ? data.cause : 'light',
      lang: data.lang === 'en' ? 'en' : 'ru',
      at: new Date(),
    });
  }
  return id;
}

async function getShare(id) {
  if (!/^[A-Za-z0-9_-]{10}$/.test(String(id || ''))) return null;
  var doc = await db.collection(COL).doc(id).get();
  return doc.exists ? doc.data() : null;
}

module.exports = {
  init: function (firestore) { db = firestore; return module.exports; },
  renderCard: renderCard,
  renderTile: renderTile,
  cardText: cardText,
  createShare: createShare,
  getShare: getShare,
  plausible: plausible,
  shareId: shareId,
  DISTRICTS: DISTRICTS,
  CAUSES: CAUSES,
};
