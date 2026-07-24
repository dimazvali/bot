const sharp = require('sharp');
const { storage } = require('./pelamushi-firebase');

const BUCKET = 'dimazvalimisc.appspot.com';

const PRESETS = {
  gallery: { width: 1200 },
  cover:   { width: 1600 },
  avatar:  { width: 600, height: 600, fit: 'cover', lossless: true },
  item:    { width: 800 },
};

async function uploadPhoto(fileBuffer, originalName, folder, preset = 'gallery') {
  if (!storage) throw new Error('Firebase Storage not configured');

  const { width, height, fit, lossless } = PRESETS[preset] || PRESETS.gallery;

  const resized = await sharp(fileBuffer)
    .resize(width, height || null, { fit: fit || 'inside', withoutEnlargement: true })
    .webp(lossless ? { lossless: true } : { quality: 85 })
    .toBuffer();

  const filename = `pelamushi/${folder}/${Date.now()}.webp`;
  const file = storage.bucket(BUCKET).file(filename);
  await file.save(resized, { contentType: 'image/webp', public: true });

  return `https://storage.googleapis.com/${BUCKET}/${filename}`;
}

async function uploadHeroPhoto(fileBuffer) {
  if (!storage) throw new Error('Firebase Storage not configured');
  const base = `pelamushi/hero/${Date.now()}`;

  const [lg, sm] = await Promise.all([
    sharp(fileBuffer).resize(1600, null, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
    sharp(fileBuffer).resize(800,  null, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
  ]);

  async function save(buf, suffix) {
    const file = storage.bucket(BUCKET).file(`${base}_${suffix}.webp`);
    await file.save(buf, { contentType: 'image/webp', public: true });
    return `https://storage.googleapis.com/${BUCKET}/${base}_${suffix}.webp`;
  }

  const [hero_url, hero_url_sm] = await Promise.all([save(lg, 'lg'), save(sm, 'sm')]);
  return { hero_url, hero_url_sm };
}

async function uploadIconPhoto(fileBuffer, folder) {
  if (!storage) throw new Error('Firebase Storage not configured');

  const resized = await sharp(fileBuffer)
    .resize(400, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ lossless: true })
    .toBuffer();

  const filename = `pelamushi/${folder}/${Date.now()}-icon.webp`;
  const file = storage.bucket(BUCKET).file(filename);
  await file.save(resized, { contentType: 'image/webp', public: true });

  return `https://storage.googleapis.com/${BUCKET}/${filename}`;
}

// Generic file upload — no image processing, keeps the original bytes/type.
// Used for arbitrary attachments (PDFs, docs, etc.), not just photos.
async function uploadFile(fileBuffer, originalName, folder, mimetype) {
  if (!storage) throw new Error('Firebase Storage not configured');

  const safeName = (originalName || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const filename = `pelamushi/${folder}/${Date.now()}-${safeName}`;
  const file = storage.bucket(BUCKET).file(filename);
  await file.save(fileBuffer, {
    public: true,
    contentType: mimetype || 'application/octet-stream',
  });

  return `https://storage.googleapis.com/${BUCKET}/${filename}`;
}

module.exports = { uploadPhoto, uploadHeroPhoto, uploadIconPhoto, uploadFile };
