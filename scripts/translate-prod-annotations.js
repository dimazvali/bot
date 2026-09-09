'use strict';
// Hand-translated EN text for existing photo annotations (both the
// country/series 'photos' collection and shoot 'shootPhotos'). Only fills
// text_en that's currently empty — safe to re-run.
// Run: PHOTO_ENV=prod node scripts/translate-prod-annotations.js
require('dotenv').config();

var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var photoData = require('../lib/photo-data');
var shoots = require('../lib/photo-shoots');

var photoApp = getApps().find(function(a) { return a.name === 'photo'; }) || initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: 'dimazvalimisc',
    private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
    private_key: process.env.sssGCPKey.replace(/\\n/g, '\n'),
    client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
    client_id: '110523994931477712119',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
  }),
  storageBucket: process.env.PHOTO_BUCKET,
}, 'photo');

var fb = getFirestore(photoApp);

// key: "country/series/photoId/annotId" -> text_en
var PHOTO_ANNOTATIONS = {
  'georgia/tbilisi/1/1781271882994': 'Pillars of the old bridge (historically there were actually two of them here, at a slight angle to each other)',
  'georgia/tbilisi/1/1781271894702': 'Foundation of a caravanserai.',
  'georgia/tbilisi/2/1781272006160': 'Here you can see the stream outflow that once gave the Abanotubani gorge its nickname — "the laundry gorge".',
  'georgia/tbilisi/6/1781272168524': "Shota Rustaveli Airport is somewhere around here, so pilots on final approach get to enjoy the view — at the drone pilots' expense.",
  'georgia/tbilisi/temp-image-for-default-share-png/1784895443598': 'The "Jugs" concert complex, built for 2012, is slated for demolition in 2026 (to be replaced by a hotel).\nUnfortunately, it never actually worked as intended. It did, however, inspire a wealth of more-or-less crude folk nicknames — mostly of a homoerotic bent.',
  'georgia/tbilisi/temp-image-for-default-share-png/1784895568574': 'The Public Service Hall, aka "Mushrooms" — another (though, in importance, the first) project by Massimiliano and Doriana Fuksas in Tbilisi. Unlike the "Jugs", what it faces is more likely administrative neglect. As of 2026 the roof already seems to be leaking. But the quality of service remains top-notch.',
  'georgia/tbilisi/temp-image-for-default-share-png/1784895675123': 'The Presidential Palace — one of two projects by Michele De Lucchi — hasn\'t escaped the vagaries of fate either. In any case, it served its intended purpose only briefly and has since been repurposed for other administrative needs.',
  'georgia/tbilisi/temp-image-for-default-share-png/1784895787534': "The Bridge of Peace (the same De Lucchi as the Presidential Palace) suspiciously resembles the House of Books on Nevsky Prospekt — in its abundance of glass, and in its sheer showiness against the city's fabric. But above all, in being doomed to become a symbol of the city right around the time most residents who once laughed at the design stop caring about it at all.",
  'portraits/news/ploschadi-svobody-zanyata-silami-politsii/1784297590183': 'St. George the Victorious',
  'portraits/news/protestuyuschij-smotrit-na-potuhshie-barrikady/1784297614072': 'It burned here.',
  'portraits/news/protestuyuschij-smotrit-na-potuhshie-barrikady/1784297634154': 'They put it out from behind the gates. With water mixed with tear gas.',
  'portraits/news/razgon-mitinga-mezhdu-zdaniyami-parlamentov-gruzii/1784298573497': 'the current parliament',
  'portraits/news/razgon-mitinga-mezhdu-zdaniyami-parlamentov-gruzii/1784298592791': 'the parliament of the First Republic (Vorontsov Palace)',
};

// key: "shootSlug/photoId/annotId" -> text_en
var SHOOT_ANNOTATIONS = {
  'mtatsminda-260625/img-2157/1782562947763': 'glasses nicked',
};

async function applyPhotoAnnotations() {
  await photoData.initFromFirestore(fb);
  var data = photoData.getData();
  var done = 0, missing = [];

  Object.keys(PHOTO_ANNOTATIONS).forEach(function(key) {
    var parts = key.split('/');
    var ck = parts[0], sk = parts[1], pid = parts[2], annotId = parts[3];
    var series = data[ck] && data[ck].series[sk];
    var photo = series && series.photos.find(function(p) { return p.id === pid; });
    var annot = photo && photo.annotations && photo.annotations.find(function(a) { return a.id === annotId; });
    if (!annot) { missing.push(key); return; }
    if (annot.text_en) return;
    annot.text_en = PHOTO_ANNOTATIONS[key];
    done++;
  });

  photoData.saveData(data);
  console.log('[photos] annotations updated:', done, '/', Object.keys(PHOTO_ANNOTATIONS).length);
  if (missing.length) console.log('[photos] NOT FOUND:', missing.join(', '));
}

async function applyShootAnnotations() {
  await shoots.initFromFirestore(fb);
  var data = shoots.getData();
  var env = process.env.PHOTO_ENV || 'dev';
  var done = 0, missing = [];

  for (var key of Object.keys(SHOOT_ANNOTATIONS)) {
    var parts = key.split('/');
    var slug = parts[0], pid = parts[1], annotId = parts[2];
    var shoot = data[slug];
    var photo = shoot && shoot.photos.find(function(p) { return p.id === pid; });
    var annot = photo && photo.annotations && photo.annotations.find(function(a) { return a.id === annotId; });
    if (!annot) { missing.push(key); continue; }
    if (annot.text_en) continue;
    annot.text_en = SHOOT_ANNOTATIONS[key];
    await fb.collection('shootPhotos').doc(env + '_' + slug + '_' + pid).update({ annotations: photo.annotations });
    done++;
  }

  console.log('[shoots] annotations updated:', done, '/', Object.keys(SHOOT_ANNOTATIONS).length);
  if (missing.length) console.log('[shoots] NOT FOUND:', missing.join(', '));
}

applyPhotoAnnotations()
  .then(applyShootAnnotations)
  .then(function() { setTimeout(function() { process.exit(0); }, 2000); })
  .catch(function(e) { console.error('ERROR', e); process.exit(1); });
