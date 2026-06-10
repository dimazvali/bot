const sharp = require('sharp');
const { storage } = require('./pelamushi-firebase');

const PRESETS = {
  gallery: { width: 1200 },
  cover:   { width: 1600 },
  avatar:  { width: 600, height: 600, fit: 'cover' },
  item:    { width: 800 },
};

async function uploadPhoto(fileBuffer, originalName, folder, preset = 'gallery') {
  if (!storage) throw new Error('Firebase Storage not configured');

  const { width, height, fit } = PRESETS[preset] || PRESETS.gallery;

  const resized = await sharp(fileBuffer)
    .resize(width, height || null, { fit: fit || 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const BUCKET = 'dimazvalimisc.appspot.com';
  const filename = `pelamushi/${folder}/${Date.now()}.jpg`;
  const file = storage.bucket(BUCKET).file(filename);

  await file.save(resized, { contentType: 'image/jpeg', public: true });

  return `https://storage.googleapis.com/${BUCKET}/${filename}`;
}

async function uploadHeroPhoto(fileBuffer) {
  if (!storage) throw new Error('Firebase Storage not configured');
  const BUCKET = 'dimazvalimisc.appspot.com';
  const base = `pelamushi/hero/${Date.now()}`;

  const [lg, sm] = await Promise.all([
    sharp(fileBuffer).resize(1600, null, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
    sharp(fileBuffer).resize(800,  null, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer(),
  ]);

  async function save(buf, suffix) {
    const file = storage.bucket(BUCKET).file(`${base}_${suffix}.jpg`);
    await file.save(buf, { contentType: 'image/jpeg', public: true });
    return `https://storage.googleapis.com/${BUCKET}/${base}_${suffix}.jpg`;
  }

  const [hero_url, hero_url_sm] = await Promise.all([save(lg, 'lg'), save(sm, 'sm')]);
  return { hero_url, hero_url_sm };
}

async function uploadIconPhoto(fileBuffer, folder) {
  if (!storage) throw new Error('Firebase Storage not configured');

  const resized = await sharp(fileBuffer)
    .resize(400, null, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const BUCKET = 'dimazvalimisc.appspot.com';
  const filename = `pelamushi/${folder}/${Date.now()}-icon.png`;
  const file = storage.bucket(BUCKET).file(filename);

  await file.save(resized, { contentType: 'image/png', public: true });

  return `https://storage.googleapis.com/${BUCKET}/${filename}`;
}

module.exports = { uploadPhoto, uploadHeroPhoto, uploadIconPhoto };
