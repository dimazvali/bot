'use strict';
// One-off import: pulls the 4 georgia/tbilisi photos from the prod photo
// project that actually have real coords, and creates a "Тбилиси" memory
// from them. Run once; not part of the app's request path.
require('dotenv').config();
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var memoriesData = require('../lib/memories-data');

var CREDENTIAL = cert({
  type: 'service_account',
  project_id: 'dimazvalimisc',
  private_key_id: '5eb5025afc0fe53b63f518ba071f89e7b7ce03af',
  private_key: (process.env.sssGCPKey || '').replace(/\\n/g, '\n'),
  client_email: 'firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com',
  client_id: '110523994931477712119',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com',
});

var memoriesApp = getApps().find(function(a) { return a.name === 'memories'; }) || initializeApp({ credential: CREDENTIAL }, 'memories');
var probeApp = getApps().find(function(a) { return a.name === 'import-probe'; }) || initializeApp({ credential: CREDENTIAL }, 'import-probe');

var fb = getFirestore(memoriesApp);
var probeDb = getFirestore(probeApp);
memoriesData.init(fb);

async function main() {
  var photoSnap = await probeDb.collection('photos')
    .where('env', '==', 'prod')
    .where('countryKey', '==', 'georgia')
    .where('seriesKey', '==', 'tbilisi')
    .get();

  var withCoords = photoSnap.docs
    .map(function(d) { return d.data(); })
    .filter(function(p) { return p.coords && typeof p.coords.lat === 'number'; });

  console.log('Found ' + withCoords.length + ' tbilisi photos with real coords.');

  var existing = await memoriesData.getMemoryBySlug('tbilisi');
  var memoryId;
  if (existing) {
    memoryId = existing.id;
    console.log('Reusing existing memory "tbilisi" (' + memoryId + ')');
  } else {
    memoryId = await memoriesData.insertMemory({
      name: 'Тбилиси',
      description: 'Дрон-фото и виды Тбилиси из проекта photo.dimazvali.com — точки с реальными координатами.',
    });
    console.log('Created memory "tbilisi" (' + memoryId + ')');
  }

  for (var p of withCoords) {
    var id = await memoriesData.insertMemoryPhoto({
      memoryId: memoryId,
      lat: p.coords.lat,
      lng: p.coords.lng,
      caption: p.title || '',
      urls: {
        w400: p.urls.preview,
        w800: p.urls.preview,
        w2400: p.urls.full,
      },
    });
    console.log('  + ' + p.title + ' (' + p.coords.lat + ', ' + p.coords.lng + ') -> ' + id);
  }

  console.log('Done. Memory id: ' + memoryId);
  process.exit(0);
}

main().catch(function(e) { console.error(e); process.exit(1); });
