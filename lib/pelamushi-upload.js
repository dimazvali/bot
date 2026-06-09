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

  const filename = `pelamushi/${folder}/${Date.now()}.jpg`;
  const bucket = storage.bucket(process.env.PELAMUSHI_BUCKET);
  const file = bucket.file(filename);

  await file.save(resized, { contentType: 'image/jpeg', public: true });

  return `https://storage.googleapis.com/${process.env.PELAMUSHI_BUCKET}/${filename}`;
}

module.exports = { uploadPhoto };
