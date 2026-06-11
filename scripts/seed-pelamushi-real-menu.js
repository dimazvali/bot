/**
 * Seed: real Pelamushi café menu.
 * Usage: node scripts/seed-pelamushi-real-menu.js
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
  name_ru: 'Меню',
  name_en: 'Menu',
  name_ka: 'მენიუ',
  desc_ru: '',
  desc_en: '',
  desc_ka: '',
  slug: 'pelamushi-main',
  type: 'permanent',
  active: true,
  cover_url: img('Menu'),
  order: 0,
};

const CATEGORIES = [
  { name_ru: 'Завтраки',                      name_en: 'Breakfast',              name_ka: 'საუზმე',                          order: 0 },
  { name_ru: 'Холодные закуски от шефа',       name_en: "Chef's Cold Appetizers", name_ka: 'ცივი წასახემსებელი შეფისგან',    order: 1 },
  { name_ru: 'Ланч',                           name_en: 'Lunch',                  name_ka: 'ლანჩები',                         order: 2 },
  { name_ru: 'Сладкое',                        name_en: 'Sweets',                 name_ka: 'ტკბილეული',                       order: 3 },
  { name_ru: 'Горячие напитки',                name_en: 'Tea & Coffee',           name_ka: 'ცხელი სასმელები',                 order: 4 },
  { name_ru: 'Алкогольные напитки',            name_en: 'Wine & Cider',           name_ka: 'ალკოჰოლური სასმელები',            order: 5 },
  { name_ru: 'Холодные напитки',               name_en: 'Water & Juice',          name_ka: 'ცივი სასმელები',                  order: 6 },
];

const ITEMS = {
  'Завтраки': [
    {
      name_ru: 'Каша', name_en: 'Porridge', name_ka: 'ფაფა',
      desc_ru: 'Пшеница / овёс, молоко, сулгуни, сахар, масло, зелёное масло, тыквенные семечки',
      desc_en: 'Wheat / oat, milk, sulguni, sugar, butter, herb oil, pumpkin seeds',
      desc_ka: 'ხორბალი / შვრია, რძე, სულგუნი, შაქარი, კარაქი, მწვანე ზეთი, გოგრის თესლი',
      price: 12, order: 0,
    },
    {
      name_ru: 'Французский омлет', name_en: 'French Omelette', name_ka: 'ფრანგული ომლეტი',
      desc_ru: 'Яйцо, салат, черри, тартин, зелёный кремовый сыр',
      desc_en: 'Egg, lettuce, cherry tomato, tartine, herb cream cheese',
      desc_ka: 'კვერცხი, სალათა, ჩერი პომიდორი, ტარტინი, მწვანე კრემ-ყველი',
      price: 16, order: 1,
    },
    {
      name_ru: 'Шакшука', name_en: 'Shakshuka', name_ka: 'შაქშუკა',
      desc_ru: 'Яйцо, помидор, перец, лук, мацони, зелень, специи',
      desc_en: 'Egg, tomato, pepper, onion, matsoni, herbs, spices',
      desc_ka: 'კვერცხი, პომიდორი, წიწაკა, ხახვი, მაწონი, მწვანილი, სანელებლები',
      price: 18, order: 2,
    },
    {
      name_ru: 'Яйца Бенедикт с лососем', name_en: 'Eggs Benedict with Salmon', name_ka: 'ბენედიქტი ორაგულით',
      desc_ru: 'Хлеб хоккайдо, масло, лосось, зелёный кремовый сыр, гуакамоле, яйцо пашот, соус голландез, зелёный лук, чёрный кунжут',
      desc_en: 'Hokkaido bread, butter, salmon, herb cream cheese, guacamole, poached egg, hollandaise, green onion, black sesame',
      desc_ka: 'ჰოკაიდოს პური, კარაქი, ორაგული, მწვანე კრემ-ყველი, გუაკამოლე, კვერცხი პაშოტი, ჰოლანდეზის სოუსი, მწვანე ხახვი, შავი ქუნჯუთი',
      price: 26, order: 3,
    },
    {
      name_ru: 'Яйца Бенедикт с беконом', name_en: 'Eggs Benedict with Bacon', name_ka: 'ბენედიქტი ბეკონით',
      desc_ru: 'Хлеб хоккайдо, масло, бекон, соус шакшука, яйцо пашот, соус голландез, зелёный лук, чёрный перец',
      desc_en: 'Hokkaido bread, butter, bacon, shakshuka sauce, poached egg, hollandaise, green onion, black pepper',
      desc_ka: 'ჰოკაიდოს პური, კარაქი, ბეკონი, შაქშუკას სოუსი, კვერცხი პაშოტი, ჰოლანდეზის სოუსი, მწვანე ხახვი, შავი პილპილი',
      price: 22, order: 4,
    },
    {
      name_ru: 'Тост с авокадо', name_en: 'Avocado Toast', name_ka: 'ავოკადოს ტოსტი',
      desc_ru: 'Хлеб хоккайдо, гуакамоле, зелёный кремовый сыр, яйцо пашот, лимон, чёрный перец, оливковое масло, копчёная паприка, тыквенные семечки',
      desc_en: 'Hokkaido bread, guacamole, herb cream cheese, poached egg, lemon, black pepper, olive oil, smoked paprika, pumpkin seeds',
      desc_ka: 'ჰოკაიდოს პური, გუაკამოლე, მწვანე კრემ-ყველი, კვერცხი პაშოტი, ლიმონი, შავი პილპილი, ზეითუნის ზეთი, შებოლილი პაპრიკა, გოგრის თესლი',
      price: 20, order: 5,
    },
  ],
  'Холодные закуски от шефа': [
    {
      name_ru: 'Куриный паштет с апельсиновым джемом', name_en: 'Chicken Pâté with Orange Marmalade', name_ka: 'ქათმის პაშტეტი ფორთოხლის ჯემით',
      desc_ru: 'Куриная печень, масло, морковь, лук, слива, апельсиновый джем, хлеб тартин',
      desc_en: 'Chicken liver, butter, carrot, onion, plum, orange jam, tartine bread',
      desc_ka: 'ქათმის ღვიძლი, კარაქი, სტაფილო, ხახვი, ქლიავი, ფორთოხლის ჯემი, ტარტინის პური',
      price: 20, order: 0,
    },
  ],
  'Ланч': [
    {
      name_ru: 'Сэндвич с курицей', name_en: 'Chicken Sandwich', name_ka: 'სენდვიჩი ქათმით',
      desc_ru: 'Бриошь, куриное филе, сулгуни, помидор, зелёный кремовый сыр, айсберг, зелёный лук, перечный соус',
      desc_en: 'Brioche, chicken fillet, sulguni, tomato, herb cream cheese, iceberg lettuce, green onion, pepper sauce',
      desc_ka: 'ბრიოში, ქათმის ფილე, სულგუნი, პომიდორი, მწვანე კრემ-ყველი, სალათა აისბერგი, მწვანე ხახვი, წიწაკის სოუსი',
      price: 18, order: 0,
    },
    {
      name_ru: 'Картофельные вафли', name_en: 'Potato Waffles', name_ka: 'კარტოფილის ვაფლი',
      desc_ru: 'На выбор: грибной соус / перечный соус — 18; с паштетом — 20',
      desc_en: 'Mushroom sauce / pepper sauce — 18; with pâté — 20',
      desc_ka: 'დასამატებელი არჩევანით: სოკოს სოუსი / წიწაკის სოუსი — 18; პაშტეტი — 20',
      price: 18, order: 1,
    },
    {
      name_ru: 'Котлета с пюре', name_en: 'Minced Meat Patty with Purée', name_ka: 'კატლეტი პიურეთი',
      desc_ru: 'Котлета, картофельное пюре, зелёный лук, зелёное масло. На выбор: грибной или перечный соус',
      desc_en: 'Patty, mashed potato, green onion, herb oil. Additional: mushroom sauce / pepper sauce',
      desc_ka: 'კატლეტი, კარტოფილის პიურე, მწვანე ხახვი, მწვანე ზეთი. დასამატებელი: სოკოს სოუსი / წიწაკის სოუსი',
      price: 20, order: 2,
    },
    {
      name_ru: 'Куриный строганов с кускусом', name_en: 'Chicken Stroganoff with Couscous', name_ka: 'ქათმის სტროგანოვი კუსკუსით',
      desc_ru: 'Курица, соус строганов, кускус',
      desc_en: 'Chicken, stroganoff sauce, couscous',
      desc_ka: 'ქათამი, სტროგანოფის სოუსი, კუსკუსი',
      price: 20, order: 3,
    },
  ],
  'Сладкое': [
    {
      name_ru: 'Торт дня', name_en: 'Cake of the Day', name_ka: 'დღის ნამცხვარი',
      desc_ru: '', desc_en: '', desc_ka: '',
      price: 12, order: 0,
    },
    {
      name_ru: 'Вафли с мороженым', name_en: 'Waffles with Ice Cream', name_ka: 'ვაფლი ნაყინით',
      desc_ru: 'Шоколад / фундук / ваниль',
      desc_en: 'Chocolate / hazelnut / vanilla',
      desc_ka: 'შოკოლადი / თხილი / ვანილი',
      price: 12, order: 1,
    },
    {
      name_ru: 'Пеламуши', name_en: 'Pelamushi', name_ka: 'ფელამუში',
      desc_ru: 'Саперави / Гранат / Манго-Маракуйя. Подаётся с творогом, мацони и сливочным кремом, с крошкой орехового печенья в солёной карамели',
      desc_en: 'Saperavi / Pomegranate / Mango-Passion Fruit. Served on cottage cheese, matsoni and cream with cookie and walnut crumbs in salted caramel',
      desc_ka: 'საფერავი / ბროწეული / მანგო-მარაკუია. მიირთმევა ნადუღის, მაწვნისა და ნაღების კრემზე, ორცხობილასა და ნიგვზის ნამცეცებთან ერთად მარილიან კარამელში',
      price: 14, order: 2,
    },
  ],
  'Горячие напитки': [
    {
      name_ru: 'Эспрессо', name_en: 'Espresso', name_ka: 'ესპრესო',
      desc_ru: 'Соло — 5 / Допио — 7',
      desc_en: 'Single — 5 / Double — 7',
      desc_ka: 'სინგლ — 5 / დუბლ — 7',
      price: 5, order: 0,
    },
    {
      name_ru: 'Американо', name_en: 'Americano', name_ka: 'ამერიკანო',
      desc_ru: '', desc_en: '', desc_ka: '',
      price: 7, order: 1,
    },
    {
      name_ru: 'Капучино', name_en: 'Cappuccino', name_ka: 'კაპუჩინო',
      desc_ru: 'Маленький — 9 / Большой — 12',
      desc_en: 'Small — 9 / Large — 12',
      desc_ka: 'პატარა — 9 / დიდი — 12',
      price: 9, order: 2,
    },
    {
      name_ru: 'Флэт-уайт', name_en: 'Flat White', name_ka: 'ფლეტ-უაიტი',
      desc_ru: '', desc_en: '', desc_ka: '',
      price: 12, order: 3,
    },
    {
      name_ru: 'Латте макиато', name_en: 'Latte Macchiato', name_ka: 'ლატე',
      desc_ru: '', desc_en: '', desc_ka: '',
      price: 12, order: 4,
    },
    {
      name_ru: 'Бамбл', name_en: 'Bumble', name_ka: 'ბამბლი',
      desc_ru: '', desc_en: '', desc_ka: '',
      price: 12, order: 5,
    },
    {
      name_ru: 'Айс-латте', name_en: 'Ice Latte', name_ka: 'აის-ლატე',
      desc_ru: '', desc_en: '', desc_ka: '',
      price: 12, order: 6,
    },
    {
      name_ru: 'Чай', name_en: 'Tea', name_ka: 'ჩაი',
      desc_ru: 'Чёрный / зелёный / бергамот',
      desc_en: 'Black / green / bergamot',
      desc_ka: 'შავი / მწვანე / ბერგამოტი',
      price: 10, order: 7,
    },
  ],
  'Алкогольные напитки': [
    {
      name_ru: 'Чинури Квеври Дисвели Эстейт', name_en: 'Chinuri Qvevri Disveli Estate', name_ka: 'ჩინური ქვევრი დისველი ესტეით',
      desc_ru: 'Бокал — 20 / Бутылка — 100',
      desc_en: 'Glass — 20 / Bottle — 100',
      desc_ka: 'ჭიქა — 20 / ბოთლი — 100',
      price: 20, order: 0,
    },
    {
      name_ru: 'Хихви Квеври Дисвели Эстейт', name_en: 'Khikhvi Qvevri Disveli Estate', name_ka: 'ხიხვი ქვევრი დისველი ესტეით',
      desc_ru: 'Бокал — 20 / Бутылка — 100',
      desc_en: 'Glass — 20 / Bottle — 100',
      desc_ka: 'ჭიქა — 20 / ბოთლი — 100',
      price: 20, order: 1,
    },
    {
      name_ru: 'Шавкапито Квеври Дисвели Эстейт', name_en: 'Shavkapito Qvevri Disveli Estate', name_ka: 'შავკაპიტო ქვევრი დისველი ესტეით',
      desc_ru: 'Бокал — 25 / Бутылка — 110',
      desc_en: 'Glass — 25 / Bottle — 110',
      desc_ka: 'ჭიქა — 25 / ბოთლი — 110',
      price: 25, order: 2,
    },
    {
      name_ru: 'Царапи из марани Ники', name_en: "Tsarapi from Nika's Winery", name_ka: 'წარაპი ნიკას მარანიდან',
      desc_ru: 'Ркацители, Саперави. Бокал — 18 / Бутылка — 90',
      desc_en: 'Rkatsiteli, Saperavi. Glass — 18 / Bottle — 90',
      desc_ka: 'რქაწითელი, საფერავი. ჭიქა — 18 / ბოთლი — 90',
      price: 18, order: 3,
    },
    {
      name_ru: 'Пет-нат', name_en: 'Pét-Nat', name_ka: 'პეტ-ნატი',
      desc_ru: 'Бокал — 20 / Бутылка — 100',
      desc_en: 'Glass — 20 / Bottle — 100',
      desc_ka: 'ჭიქა — 20 / ბოთლი — 100',
      price: 20, order: 4,
    },
    {
      name_ru: 'Яблочный сидр Закара', name_en: 'Apple Cider Zaqara', name_ka: 'სიდრი ზაქარა ვაშლის',
      desc_ru: '', desc_en: '', desc_ka: '',
      price: 18, order: 5,
    },
    {
      name_ru: 'Вишнёвый сидр Закара', name_en: 'Cherry Cider Zaqara', name_ka: 'სიდრი ზაქარა ალუბლის',
      desc_ru: '', desc_en: '', desc_ka: '',
      price: 18, order: 6,
    },
  ],
  'Холодные напитки': [
    {
      name_ru: 'Сно', name_en: 'Sno', name_ka: 'სნო',
      desc_ru: '', desc_en: '', desc_ka: '',
      price: 8, order: 0,
    },
    {
      name_ru: 'Коби', name_en: 'Kobi', name_ka: 'კობი',
      desc_ru: '', desc_en: '', desc_ka: '',
      price: 8, order: 1,
    },
    {
      name_ru: 'Сок: апельсин / вишня / яблоко', name_en: 'Juice: Orange / Cherry / Apple', name_ka: 'ფორთოხლის, ალუბლის, ვაშლის წვენი',
      desc_ru: '', desc_en: '', desc_ka: '',
      price: 10, order: 2,
    },
    {
      name_ru: 'Свежевыжатый апельсиновый сок', name_en: 'Fresh Orange Juice', name_ka: 'ფორთოხლის ახალგამოწურული წვენი',
      desc_ru: '', desc_en: '', desc_ka: '',
      price: 14, order: 3,
    },
  ],
};

async function seed() {
  const menusCol = db.collection('pelamushi_menus');
  const catsCol  = db.collection('pelamushi_menu_categories');
  const itemsCol = db.collection('pelamushi_menu_items');

  const existing = await menusCol.where('slug', '==', MENU.slug).limit(1).get();
  if (!existing.empty) {
    console.log('Меню "pelamushi-main" уже существует — пропускаем. ID:', existing.docs[0].id);
    process.exit(0);
  }

  console.log('Создаём меню...');
  const menuRef = await menusCol.add({ ...MENU, created_at: new Date() });
  const menuId = menuRef.id;
  console.log('Меню создано:', menuId);

  for (const cat of CATEGORIES) {
    console.log(`Категория: ${cat.name_ru}`);
    const catRef = await catsCol.add({ ...cat, menu_id: menuId, created_at: new Date() });
    const catId = catRef.id;

    const items = ITEMS[cat.name_ru] || [];
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

  console.log('\nГотово!');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
