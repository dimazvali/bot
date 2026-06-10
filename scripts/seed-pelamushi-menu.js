/**
 * One-time seed: creates a placeholder Основное меню for Pelamushi café.
 * Usage: node scripts/seed-pelamushi-menu.js
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

const img = (label) =>
  `https://placehold.co/400x300/1C2E4A/F3ECE0?text=${encodeURIComponent(label)}`;

const MENU = {
  name_ru: 'Основное меню',
  name_en: 'Main Menu',
  name_ka: 'მთავარი მენიუ',
  desc_ru: 'Блюда грузинской и европейской кухни',
  desc_en: 'Georgian and European cuisine',
  desc_ka: 'ქართული და ევროპული სამზარეულო',
  slug: 'cafe-menu',
  type: 'permanent',
  active: true,
  cover_url: img('Main Menu'),
  order: 0,
};

const CATEGORIES = [
  { name_ru: 'Завтраки',            name_en: 'Breakfast',          name_ka: 'საუზმე',                   order: 0 },
  { name_ru: 'Хинкали и хачапури',  name_en: 'Khinkali & Khachapuri', name_ka: 'ხინკალი და ხაჭაპური',  order: 1 },
  { name_ru: 'Основные блюда',      name_en: 'Main Dishes',        name_ka: 'მთავარი კერძები',          order: 2 },
  { name_ru: 'Десерты',             name_en: 'Desserts',           name_ka: 'დესერტები',                order: 3 },
  { name_ru: 'Напитки',             name_en: 'Drinks',             name_ka: 'სასმელები',                order: 4 },
];

const ITEMS_BY_CATEGORY = {
  'Завтраки': [
    { name_ru: 'Яичница с помидорами',  name_en: 'Eggs with tomatoes',    name_ka: 'კვერცხი პომიდვრით',    desc_ru: 'Глазунья на оливковом масле со свежими томатами и зеленью',  desc_en: 'Fried eggs with fresh tomatoes and herbs',           desc_ka: 'შემწვარი კვერცხი პომიდვრით და მწვანილით',    price: 12, order: 0 },
    { name_ru: 'Омлет с сыром',         name_en: 'Cheese omelette',        name_ka: 'ყველის ომლეტი',        desc_ru: 'Пышный омлет с сулугуни и свежей зеленью',                   desc_en: 'Fluffy omelette with sulguni cheese and herbs',      desc_ka: 'ფუმფულა ომლეტი სულგუნით და მწვანილით',       price: 13, order: 1 },
    { name_ru: 'Каша на молоке',        name_en: 'Porridge',               name_ka: 'ფაფა რძეზე',           desc_ru: 'Овсяная каша на топлёном молоке с мёдом и ягодами',          desc_en: 'Oatmeal porridge with honey and berries',            desc_ka: 'შვრიის ფაფა თაფლით და კენკრით',              price: 10, order: 2 },
    { name_ru: 'Авокадо-тост',          name_en: 'Avocado toast',          name_ka: 'ავოკადო ტოსტი',        desc_ru: 'Тост с авокадо, рикоттой и яйцом пашот',                     desc_en: 'Toast with avocado, ricotta and poached egg',        desc_ka: 'ტოსტი ავოკადოთი, რიკოტათა და ათქვეფილი კვერცხით', price: 15, order: 3 },
    { name_ru: 'Блинчики с мёдом',      name_en: 'Pancakes with honey',    name_ka: 'ბლინები თაფლით',       desc_ru: 'Тонкие блинчики с домашним мёдом и грецкими орехами',        desc_en: 'Thin pancakes with honey and walnuts',               desc_ka: 'თხელი ბლინები თაფლით და კაკლით',             price: 14, order: 4 },
  ],
  'Хинкали и хачапури': [
    { name_ru: 'Хинкали с говядиной (5 шт)',  name_en: 'Beef khinkali (5 pcs)',       name_ka: 'ხინკალი საქონლით (5 ც.)',  desc_ru: 'Классические хинкали с рубленой говядиной и специями',      desc_en: 'Classic khinkali with minced beef and spices',         desc_ka: 'კლასიკური ხინკალი დაჭრილი საქონლის ხორცით',   price: 15, order: 0 },
    { name_ru: 'Хинкали с грибами (5 шт)',    name_en: 'Mushroom khinkali (5 pcs)',   name_ka: 'სოკოს ხინკალი (5 ც.)',     desc_ru: 'Нежные хинкали с белыми грибами и сыром сулугуни',          desc_en: 'Khinkali with white mushrooms and sulguni',            desc_ka: 'ხინკალი თეთრი სოკოთი და სულგუნით',           price: 14, order: 1 },
    { name_ru: 'Хачапури по-имеретински',     name_en: 'Imeritian khachapuri',        name_ka: 'იმერული ხაჭაპური',         desc_ru: 'Лепёшка с сулугуни, выпеченная в тандыре',                 desc_en: 'Flatbread with sulguni cheese, baked in tandoor',      desc_ka: 'ლავაში სულგუნით, გამომცხვარი ტანდურში',        price: 16, order: 2 },
    { name_ru: 'Хачапури по-аджарски',        name_en: 'Adjarian khachapuri',         name_ka: 'აჭარული ხაჭაპური',         desc_ru: 'Лодочка из теста с сыром, яйцом и маслом',                 desc_en: 'Boat-shaped bread with cheese, egg and butter',        desc_ka: 'ნავის ფორმის პური ყველით, კვერცხით და კარაქით', price: 20, order: 3 },
    { name_ru: 'Лобиани',                     name_en: 'Lobiani',                     name_ka: 'ლობიანი',                  desc_ru: 'Хачапури с пряной фасолью и луком',                        desc_en: 'Khachapuri with spiced beans and onion',               desc_ka: 'ხაჭაპური სანელებლიანი ლობიოთი',               price: 14, order: 4 },
  ],
  'Основные блюда': [
    { name_ru: 'Чахохбили',       name_en: 'Chakhokhbili',        name_ka: 'ჩახოხბილი',       desc_ru: 'Тушёная курица с томатами, луком и грузинскими специями',   desc_en: 'Chicken stew with tomatoes and Georgian spices',     desc_ka: 'ჩაშუშული ქათამი პომიდვრით და ქართული სანელებლებით', price: 28, order: 0 },
    { name_ru: 'Мцвади',          name_en: 'Mtsvadi',             name_ka: 'მწვადი',           desc_ru: 'Шашлык из свинины на углях с луком и гранатом',              desc_en: 'Pork skewers grilled over charcoal with onion',      desc_ka: 'ღორის მწვადი ნახშირზე, ხახვით და ბროწეულით',   price: 35, order: 1 },
    { name_ru: 'Лобио в горшочке',name_en: 'Lobio in clay pot',   name_ka: 'ლობიო ქოთანში',   desc_ru: 'Красная фасоль с грецкими орехами, специями и кинзой',       desc_en: 'Red beans with walnuts, spices and coriander',       desc_ka: 'წითელი ლობიო კაკლით, სანელებლებითა და კინძით',  price: 18, order: 2 },
    { name_ru: 'Пхали ассорти',   name_en: 'Pkhali assorted',     name_ka: 'ფხალი ასორტი',    desc_ru: 'Ассорти из шпината, свёклы и фасоли с орехами и чесноком',  desc_en: 'Spinach, beetroot and bean rolls with walnut',       desc_ka: 'ისპანახის, ჭარხლის და ლობიოს ფხალი კაკლით',   price: 20, order: 3 },
    { name_ru: 'Долма',           name_en: 'Dolma',               name_ka: 'დოლმა',            desc_ru: 'Виноградные листья с бараниной и рисом, с мацони',           desc_en: 'Grape leaves stuffed with lamb and rice, with matsoni', desc_ka: 'ვაზის ფოთლები ბატკნის ხორცით, ბრინჯით, მაწვნით', price: 25, order: 4 },
  ],
  'Десерты': [
    { name_ru: 'Чурчхела',         name_en: 'Churchkhela',       name_ka: 'ჩურჩხელა',          desc_ru: 'Традиционные грузинские сладости из орехов и виноградного сока', desc_en: 'Traditional Georgian sweets with nuts and grape juice', desc_ka: 'ტრადიციული ქართული სიტკბო კაკლით და ყურძნის წვენით', price: 8,  order: 0 },
    { name_ru: 'Козинаки',         name_en: 'Gozinaki',          name_ka: 'გოზინაყი',          desc_ru: 'Грецкие орехи в карамели из мёда',                           desc_en: 'Walnuts in honey caramel',                              desc_ka: 'კაკალი თაფლის კარამელში',                         price: 7,  order: 1 },
    { name_ru: 'Медовый торт',     name_en: 'Honey cake',        name_ka: 'თაფლის ნამცხვარი', desc_ru: 'Многослойный торт с нежным мёдово-сметанным кремом',          desc_en: 'Layered cake with honey and sour cream frosting',       desc_ka: 'მრავალშრიანი ნამცხვარი თაფლ-ნაღების კრემით',    price: 15, order: 2 },
    { name_ru: 'Пирог с вишней',   name_en: 'Cherry pie',        name_ka: 'ალუბლის ღვეზელი',  desc_ru: 'Домашний пирог с кислой вишней и ванильным мороженым',       desc_en: 'Homemade cherry pie with vanilla ice cream',            desc_ka: 'სახლის ღვეზელი ალუბლით და ვანილის ნაყინით',     price: 13, order: 3 },
  ],
  'Напитки': [
    { name_ru: 'Грузинский чай',       name_en: 'Georgian tea',          name_ka: 'ქართული ჩაი',         desc_ru: 'Чай из грузинских горных трав с мёдом',              desc_en: 'Georgian mountain herb tea with honey',             desc_ka: 'ქართული მთის სამკურნალო ბალახებისა თაფლით',    price: 8,  order: 0 },
    { name_ru: 'Американо',            name_en: 'Americano',             name_ka: 'ამერიკანო',           desc_ru: 'Эспрессо, разбавленный горячей водой',               desc_en: 'Espresso with hot water',                           desc_ka: 'ესპრესო ცხელი წყლით',                           price: 10, order: 1 },
    { name_ru: 'Лимонад из тархуна',   name_en: 'Tarragon lemonade',     name_ka: 'ტარხუნის ლიმონათი',  desc_ru: 'Освежающий лимонад из свежего тархуна и лимона',    desc_en: 'Refreshing lemonade with fresh tarragon and lemon', desc_ka: 'გამაგრილებელი ლიმონათი ახალი ტარხუნითა და ლიმონით', price: 12, order: 2 },
    { name_ru: 'Натуральный сок',      name_en: 'Fresh juice',           name_ka: 'ახალი წვენი',         desc_ru: 'Свежевыжатый сок (апельсин / гранат / яблоко)',      desc_en: 'Freshly squeezed juice (orange / pomegranate / apple)', desc_ka: 'ახლად გამოწურული წვენი (ფორთოხალი / ბროწეული / ვაშლი)', price: 13, order: 3 },
    { name_ru: 'Мацони',               name_en: 'Matsoni',               name_ka: 'მაწონი',              desc_ru: 'Традиционный грузинский кисломолочный напиток',      desc_en: 'Traditional Georgian fermented milk drink',         desc_ka: 'ტრადიციული ქართული მჟავე რძის სასმელი',        price: 9,  order: 4 },
  ],
};

async function seed() {
  const menusCol    = db.collection('pelamushi_menus');
  const catsCol     = db.collection('pelamushi_menu_categories');
  const itemsCol    = db.collection('pelamushi_menu_items');

  // Check if already seeded
  const existing = await menusCol.where('slug', '==', MENU.slug).limit(1).get();
  if (!existing.empty) {
    console.log('Меню "cafe-menu" уже существует — пропускаем. ID:', existing.docs[0].id);
    process.exit(0);
  }

  console.log('Создаём меню...');
  const menuRef = await menusCol.add({ ...MENU, created_at: new Date() });
  const menuId = menuRef.id;
  console.log('Меню создано:', menuId);

  for (const catData of CATEGORIES) {
    console.log(`Категория: ${catData.name_ru}`);
    const catRef = await catsCol.add({ ...catData, menu_id: menuId, created_at: new Date() });
    const catId = catRef.id;

    const items = ITEMS_BY_CATEGORY[catData.name_ru] || [];
    for (const item of items) {
      await itemsCol.add({
        ...item,
        menu_id: menuId,
        category_id: catId,
        photo_url: img(item.name_en),
        tags: '',
        active: true,
        created_at: new Date(),
      });
      process.stdout.write('  .');
    }
    console.log(` ${items.length} позиций`);
  }

  console.log('\nГотово! Меню заполнено.');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
