// One-off: resize + upload dimazvali home images to Firebase Storage
// Usage: node scripts/upload-dimazvali-home.js
require('dotenv').config();
var fs = require('fs');
var path = require('path');
var sharp = require('sharp');
var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getStorage } = require('firebase-admin/storage');

var app = getApps().find(a => a.name === 'photo') || initializeApp({
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

var bucket = getStorage(app).bucket();
var BASE = 'https://storage.googleapis.com/' + process.env.PHOTO_BUCKET;
var PICS_DIR = path.join(__dirname, '../public/images/dimazvali/pics');

var images = [
  { file: 'ks-05065.jpg', name: 'ks-05065' },
  { file: 'ks-05295.jpg', name: 'ks-05295' },
  { file: 'ks-04803.jpg', name: 'ks-04803' },
  { file: 'ks-04770.jpg', name: 'ks-04770' },
];

// Try both original and uppercase variants
function findFile(name) {
  var variants = [
    path.join(PICS_DIR, name + '.jpg'),
    path.join(PICS_DIR, name.toUpperCase() + '.jpg'),
    path.join(PICS_DIR, name.replace('ks-', 'KS_') + '.jpg'),
  ];
  for (var v of variants) {
    if (fs.existsSync(v)) return v;
  }
  return null;
}

async function uploadImage(name, srcPath) {
  var buf = fs.readFileSync(srcPath);
  var [buf800, buf2400] = await Promise.all([
    sharp(buf).resize({ width: 800,  withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
    sharp(buf).resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer(),
  ]);

  var p800  = 'dimazvali/home/' + name + '-800.webp';
  var p2400 = 'dimazvali/home/' + name + '-2400.webp';

  await Promise.all([
    bucket.file(p800).save(buf800,   { contentType: 'image/webp' }).then(() => bucket.file(p800).makePublic()),
    bucket.file(p2400).save(buf2400, { contentType: 'image/webp' }).then(() => bucket.file(p2400).makePublic()),
  ]);

  return { name, url800: BASE + '/' + p800, url2400: BASE + '/' + p2400 };
}

(async () => {
  for (var img of images) {
    var src = findFile(img.name);
    if (!src) { console.log('NOT FOUND: ' + img.name); continue; }
    process.stdout.write('Uploading ' + img.name + '... ');
    var result = await uploadImage(img.name, src);
    console.log('OK');
    console.log('  800:  ' + result.url800);
    console.log('  2400: ' + result.url2400);
  }
  console.log('\nDone.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
