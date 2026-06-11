/**
 * Seed: shop menu items for CsyVba1lSIxbmR2q8dNJ
 * Usage: node scripts/seed-pelamushi-shop-menu.js
 */
require('dotenv').config();

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = getApps().find(a => a.name === 'dimazvali') || initializeApp({
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
  databaseURL: 'https://rrspecialsapi.firebaseio.com',
}, 'dimazvali');

const db = getFirestore(app);

const MENU_ID = 'CsyVba1lSIxbmR2q8dNJ';

const CATEGORIES = [
  {
    name_ru: 'Дом социальной терапии',
    name_en: 'Social Therapy House',
    name_ka: 'სოციალური თერაპიის სახლი',
    order: 0,
    items: [
      { name_ru: 'Деревянные украшения',        name_en: 'Wooden Decorations',       name_ka: 'ხის სამკაული',              price: 12, order: 0 },
      { name_ru: 'Свечка "конус"',              name_en: 'Cone Candle',               name_ka: 'სანთელი "კონუსი"',          price: 12, order: 1 },
      { name_ru: 'Заколка',                     name_en: 'Hair Clip',                 name_ka: 'თმის სამაგრი მეტალზე',      price: 12, order: 2 },
      { name_ru: 'Сумка',                       name_en: 'Bag',                       name_ka: 'ჩანთა',                     price: 30, order: 3 },
      { name_ru: 'Детская книжка развивалка',   name_en: "Children's Activity Book",  name_ka: 'საბავშო წიგნი',             price: 75, order: 4 },
      { name_ru: 'Браслет из камней',           name_en: 'Stone Bracelet',            name_ka: 'სამაჯური',                  price: 45, order: 5 },
      { name_ru: 'Кольцо',                      name_en: 'Ring',                      name_ka: 'ბეჭედი',                    price: 12, order: 6 },
      { name_ru: 'Тетрадь большая',             name_en: 'Large Notebook',            name_ka: 'რვეული დიდი',               price: 12, order: 7 },
      { name_ru: 'Браслет из дерева',           name_en: 'Wooden Bracelet',           name_ka: 'ხის სამაჯური',              price: 25, order: 8 },
    ],
  },
  {
    name_ru: 'Recycleaf / Bebias / Babale / Poteria',
    name_en: 'Recycleaf / Bebias / Babale / Poteria',
    name_ka: 'Recycleaf / Bebias / Babale / Poteria',
    order: 1,
    items: [
      { name_ru: 'Крестики-нолики',    name_en: 'Tic-Tac-Toe',       name_ka: 'ტიკ-ტაკ-ტოუ',         price: 55, order: 0 },
      { name_ru: 'Маленькая палитра',  name_en: 'Small Palette',      name_ka: 'პატარა პალიტრა',       price: 40, order: 1 },
      { name_ru: 'Серёжки зелёные',    name_en: 'Green Earrings',     name_ka: 'საყურეები მწვანე',      price: 40, order: 2 },
      { name_ru: 'Серёжки голубые',    name_en: 'Blue Earrings',      name_ka: 'საყურეები ლურჯი',       price: 40, order: 3 },
      { name_ru: 'Серёжки сердечки',   name_en: 'Heart Earrings',     name_ka: 'საყურეები გულები',      price: 40, order: 4 },
      { name_ru: 'Брелки лимоны',      name_en: 'Lemon Keychains',    name_ka: 'ბრელოკი ლიმონი',        price: 40, order: 5 },
      { name_ru: 'Подвески голубые',   name_en: 'Blue Pendants',      name_ka: 'სამკაული ლურჯი',        price: 45, order: 6 },
      { name_ru: 'Подвески красные',   name_en: 'Red Pendants',       name_ka: 'სამკაული წითელი',       price: 45, order: 7 },
    ],
  },
];

const UNCATEGORIZED = [
  { name_ru: 'Шапка "Бебиас"',                  name_en: '"Bebias" Hat',               name_ka: 'ქუდი "ბებიას"',                  price: 50, order: 0 },
  { name_ru: 'Фигурка ангела "Бабале"',          name_en: '"Babale" Angel Figure',      name_ka: 'ანგელოზის ფიგურა "ბაბალე"',     price: 20, order: 1 },
  { name_ru: 'Керамическая чашка "Потерия"',     name_en: '"Poteria" Ceramic Cup',      name_ka: 'კერამიკული ჭიქა "პოტერია"',     price: 50, order: 2 },
  { name_ru: 'Керамическая пиала "Бабале"',      name_en: '"Babale" Ceramic Bowl',      name_ka: 'კერამიკული ფიალა "ბაბალე"',     price: 50, order: 3 },
];

async function seed() {
  const catsCol  = db.collection('pelamushi_menu_categories');
  const itemsCol = db.collection('pelamushi_menu_items');

  // Check menu exists
  const menuDoc = await db.collection('pelamushi_menus').doc(MENU_ID).get();
  if (!menuDoc.exists) {
    console.error('Меню не найдено:', MENU_ID);
    process.exit(1);
  }
  console.log('Меню:', menuDoc.data().name_ru || menuDoc.data().name_en || MENU_ID);

  // Check for existing categories to avoid duplicates
  const existingCats = await catsCol.where('menu_id', '==', MENU_ID).get();
  if (!existingCats.empty) {
    console.log(`Уже есть ${existingCats.size} категорий в этом меню — продолжаем добавлять...`);
  }

  for (const cat of CATEGORIES) {
    // Check if category with same name_ru already exists
    const dup = existingCats.docs.find(d => d.data().name_ru === cat.name_ru);
    if (dup) {
      console.log(`Категория "${cat.name_ru}" уже есть (${dup.id}) — пропускаем`);
      continue;
    }

    console.log(`\nКатегория: ${cat.name_ru}`);
    const { items, ...catData } = cat;
    const catRef = await catsCol.add({ ...catData, menu_id: MENU_ID, created_at: new Date() });
    console.log(`  → ${catRef.id}`);

    for (const item of items) {
      await itemsCol.add({
        ...item,
        menu_id: MENU_ID,
        category_id: catRef.id,
        photo_url: '',
        tags: '',
        active: true,
        created_at: new Date(),
      });
      process.stdout.write('  .');
    }
    console.log(` ${items.length} позиций`);
  }

  // Uncategorized items
  console.log('\nПозиции без категории:');
  for (const item of UNCATEGORIZED) {
    await itemsCol.add({
      ...item,
      menu_id: MENU_ID,
      category_id: '',
      photo_url: '',
      tags: '',
      active: true,
      created_at: new Date(),
    });
    process.stdout.write('  .');
  }
  console.log(` ${UNCATEGORIZED.length} позиций`);

  console.log('\nГотово!');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
