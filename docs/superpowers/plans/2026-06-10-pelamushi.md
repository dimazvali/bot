# Pelamushi Café Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a trilingual (KA/EN/RU) website for Pelamushi inclusive café on pelamushi.ge, with public pages and a Firebase-backed admin panel, as a new vhost in the existing Express app.

**Architecture:** New vhost `pelamushi.*.*` added to `app.js`, served by `routes/pelamushi.js` (public) and `routes/pelamushi-admin.js` (admin). Firebase Firestore for content, Firebase Storage for images, Firebase Auth for admin login. Pug templates under `views/pelamushi/`. Language is part of the URL: `/:lang/(about|menu|news)`.

**Tech Stack:** Node.js, Express, Pug, Firebase Admin SDK (firestore, storage, auth), express-fileupload, sharp, node-fetch (CSV export).

---

## File Map

| File | Responsibility |
|---|---|
| `app.js` | Register pelamushi vhost |
| `routes/pelamushi.js` | Public routes + lang middleware |
| `routes/pelamushi-admin.js` | Admin CRUD routes |
| `lib/pelamushi-firebase.js` | All Firestore read/write helpers |
| `lib/pelamushi-upload.js` | sharp resize → Firebase Storage upload |
| `lib/pelamushi-auth.js` | Admin session middleware |
| `locales/pelamushi/en.json` | English UI strings |
| `locales/pelamushi/ka.json` | Georgian UI strings |
| `locales/pelamushi/ru.json` | Russian UI strings |
| `views/pelamushi/layout.pug` | Public base layout (nav, footer) |
| `views/pelamushi/index.pug` | Homepage |
| `views/pelamushi/about.pug` | About page |
| `views/pelamushi/menu-list.pug` | Menu list page |
| `views/pelamushi/menu.pug` | Single menu page |
| `views/pelamushi/news-list.pug` | News list page |
| `views/pelamushi/news-item.pug` | News article + registration form |
| `views/pelamushi/admin/layout.pug` | Admin base layout |
| `views/pelamushi/admin/login.pug` | Login page |
| `views/pelamushi/admin/dashboard.pug` | Admin dashboard |
| `views/pelamushi/admin/about.pug` | Edit mission + gallery + team |
| `views/pelamushi/admin/menus.pug` | Menus list |
| `views/pelamushi/admin/menu-edit.pug` | Edit menu + categories + items |
| `views/pelamushi/admin/news.pug` | News list |
| `views/pelamushi/admin/news-edit.pug` | Edit news article |
| `views/pelamushi/admin/registrations.pug` | Event registrations list |
| `public/stylesheets/pelamushi/web.css` | Public site styles |
| `public/stylesheets/pelamushi/admin.css` | Admin styles |

---

## Task 1: Vhost Registration + Firebase Init

**Files:**
- Modify: `app.js`
- Create: `routes/pelamushi.js`
- Create: `lib/pelamushi-firebase.js`

- [ ] **Step 1: Add vhost entries to app.js**

In `app.js`, after the existing vhost declarations (around line 53), add:

```js
app.use(vhost('pelamushi.*.*', require('./routes/pelamushi')))
app.use(vhost('pelamushi.localhost', require('./routes/pelamushi')))
```

- [ ] **Step 2: Create Firebase helper with app initialization**

Create `lib/pelamushi-firebase.js`:

```js
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const app = initializeApp({
  credential: cert({
    type: 'service_account',
    project_id: process.env.PELAMUSHI_PROJECT_ID,
    private_key_id: process.env.PELAMUSHI_KEY_ID,
    private_key: process.env.PELAMUSHI_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.PELAMUSHI_CLIENT_EMAIL,
    client_id: process.env.PELAMUSHI_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.PELAMUSHI_CERT_URL,
  }),
  storageBucket: process.env.PELAMUSHI_BUCKET,
}, 'pelamushi');

const db = getFirestore(app);
const storage = getStorage(app);

const col = {
  admins:      db.collection('pelamushi_admins'),
  about:       db.collection('pelamushi_about'),
  team:        db.collection('pelamushi_team'),
  gallery:     db.collection('pelamushi_gallery'),
  menus:       db.collection('pelamushi_menus'),
  categories:  db.collection('pelamushi_menu_categories'),
  items:       db.collection('pelamushi_menu_items'),
  news:        db.collection('pelamushi_news'),
  registrations: db.collection('pelamushi_registrations'),
};

module.exports = { db, storage, col, Timestamp };
```

- [ ] **Step 3: Add required env vars to .env**

Add to `.env`:

```
PELAMUSHI_PROJECT_ID=
PELAMUSHI_KEY_ID=
PELAMUSHI_PRIVATE_KEY=
PELAMUSHI_CLIENT_EMAIL=
PELAMUSHI_CLIENT_ID=
PELAMUSHI_CERT_URL=
PELAMUSHI_BUCKET=
```

Fill these from the Firebase Console → Project Settings → Service Accounts → Generate new private key.

- [ ] **Step 4: Create skeleton public router**

Create `routes/pelamushi.js`:

```js
const express = require('express');
const router = express.Router();
const { col, Timestamp } = require('../lib/pelamushi-firebase');

const LANGS = ['en', 'ka', 'ru'];

const locales = {
  en: require('../locales/pelamushi/en.json'),
  ka: require('../locales/pelamushi/ka.json'),
  ru: require('../locales/pelamushi/ru.json'),
};

// Language param middleware — fires for ANY route containing :lang
router.param('lang', (req, res, next, lang) => {
  if (!LANGS.includes(lang)) return res.status(404).send('Not found');
  res.locals.lang = lang;
  res.locals.t = locales[lang];
  next();
});

// Root redirect by Accept-Language
router.get('/', (req, res) => {
  const accept = req.headers['accept-language'] || '';
  let lang = 'en';
  if (accept.includes('ka')) lang = 'ka';
  else if (accept.includes('ru')) lang = 'ru';
  res.redirect(`/${lang}`);
});

// Language switcher
router.get('/lang/:code', (req, res) => {
  const code = req.params.code;
  if (!LANGS.includes(code)) return res.redirect('/');
  res.cookie('pelamushi_lang', code, { maxAge: 365 * 24 * 3600 * 1000 });
  const ref = req.headers.referer || `/${code}`;
  // swap lang segment in the referring URL
  const swapped = ref.replace(/\/(en|ka|ru)(\/|$)/, `/${code}$2`);
  res.redirect(swapped);
});

module.exports = router;
```

- [ ] **Step 5: Verify server starts without errors**

```bash
node ./bin/www
```

Expected: no crash, no `Error: Cannot find module` messages.

- [ ] **Step 6: Commit**

```bash
git add app.js routes/pelamushi.js lib/pelamushi-firebase.js .env
git commit -m "feat(pelamushi): add vhost, Firebase init, skeleton router"
```

---

## Task 2: Locales + i18n Strings

**Files:**
- Create: `locales/pelamushi/en.json`
- Create: `locales/pelamushi/ka.json`
- Create: `locales/pelamushi/ru.json`

- [ ] **Step 1: Create locale directory**

```bash
mkdir -p locales/pelamushi
```

- [ ] **Step 2: Create English locale**

Create `locales/pelamushi/en.json`:

```json
{
  "nav": {
    "about": "About Us",
    "menu": "Menu",
    "news": "News"
  },
  "footer": {
    "address": "60 Paliashvili St, Tbilisi",
    "tagline": "Inclusive transitional employment café"
  },
  "home": {
    "quote": "The world isn't perfectly level, but with the right support and environment, you can be in balance and be visible.",
    "about_link": "About Us",
    "menu_link": "Our Menu",
    "news_link": "News & Events"
  },
  "about": {
    "title": "About Us",
    "interior": "Interior",
    "team": "Our Team"
  },
  "menu": {
    "title": "Menu",
    "back": "← All Menus"
  },
  "news": {
    "title": "News & Events",
    "read_more": "Read more",
    "event_badge": "Event",
    "register": "Register",
    "registration_title": "Register for this event",
    "field_name": "Your name",
    "field_email": "Email",
    "field_phone": "Phone (optional)",
    "submit": "Register",
    "success": "Thank you! We have received your registration."
  },
  "admin": {
    "dashboard": "Dashboard",
    "about": "About",
    "menus": "Menus",
    "news": "News",
    "logout": "Log out",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "add": "Add",
    "upload_photo": "Upload photo"
  }
}
```

- [ ] **Step 3: Create Georgian locale**

Create `locales/pelamushi/ka.json`:

```json
{
  "nav": {
    "about": "ჩვენს შესახებ",
    "menu": "მენიუ",
    "news": "სიახლეები"
  },
  "footer": {
    "address": "პალიაშვილის ქ. 60, თბილისი",
    "tagline": "ინკლუზიური კაფე გარდამავალი დასაქმებისთვის"
  },
  "home": {
    "quote": "სამყარო სრულყოფილად ბრტყელი არ არის, მაგრამ სწორი მხარდაჭერითა და გარემოთი შეგიძლია ბალანსში იყო და ხილული გახდე.",
    "about_link": "ჩვენს შესახებ",
    "menu_link": "მენიუ",
    "news_link": "სიახლეები"
  },
  "about": {
    "title": "ჩვენს შესახებ",
    "interior": "ინტერიერი",
    "team": "ჩვენი გუნდი"
  },
  "menu": {
    "title": "მენიუ",
    "back": "← ყველა მენიუ"
  },
  "news": {
    "title": "სიახლეები",
    "read_more": "სრულად",
    "event_badge": "ღონისძიება",
    "register": "რეგისტრაცია",
    "registration_title": "დარეგისტრირდი",
    "field_name": "სახელი",
    "field_email": "ელ-ფოსტა",
    "field_phone": "ტელეფონი (არასავალდებულო)",
    "submit": "გაგზავნა",
    "success": "გმადლობთ! თქვენი რეგისტრაცია მიღებულია."
  },
  "admin": {
    "dashboard": "მთავარი",
    "about": "ჩვენს შესახებ",
    "menus": "მენიუები",
    "news": "სიახლეები",
    "logout": "გასვლა",
    "save": "შენახვა",
    "cancel": "გაუქმება",
    "delete": "წაშლა",
    "add": "დამატება",
    "upload_photo": "ფოტოს ატვირთვა"
  }
}
```

- [ ] **Step 4: Create Russian locale**

Create `locales/pelamushi/ru.json`:

```json
{
  "nav": {
    "about": "О нас",
    "menu": "Меню",
    "news": "Новости"
  },
  "footer": {
    "address": "ул. Палиашвили, 60, Тбилиси",
    "tagline": "Инклюзивное кафе транзитного трудоустройства"
  },
  "home": {
    "quote": "Мир не идеально ровный, но при правильной опоре и среде можно быть в балансе и быть видимым.",
    "about_link": "О нас",
    "menu_link": "Меню",
    "news_link": "Новости"
  },
  "about": {
    "title": "О нас",
    "interior": "Интерьер",
    "team": "Команда"
  },
  "menu": {
    "title": "Меню",
    "back": "← Все меню"
  },
  "news": {
    "title": "Новости",
    "read_more": "Читать далее",
    "event_badge": "Мероприятие",
    "register": "Записаться",
    "registration_title": "Запись на мероприятие",
    "field_name": "Ваше имя",
    "field_email": "Email",
    "field_phone": "Телефон (необязательно)",
    "submit": "Записаться",
    "success": "Спасибо! Ваша заявка принята."
  },
  "admin": {
    "dashboard": "Дашборд",
    "about": "О нас",
    "menus": "Меню",
    "news": "Новости",
    "logout": "Выйти",
    "save": "Сохранить",
    "cancel": "Отмена",
    "delete": "Удалить",
    "add": "Добавить",
    "upload_photo": "Загрузить фото"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add locales/pelamushi/
git commit -m "feat(pelamushi): add EN/KA/RU locales"
```

---

## Task 3: CSS — Public Styles

**Files:**
- Create: `public/stylesheets/pelamushi/web.css`

- [ ] **Step 1: Create CSS directory**

```bash
mkdir -p public/stylesheets/pelamushi
```

- [ ] **Step 2: Create web.css**

Create `public/stylesheets/pelamushi/web.css`:

```css
/* ── Variables ─────────────────────────────────────────── */
:root {
  --cream:   #F3ECE0;
  --navy:    #1C2E4A;
  --blue:    #97B8C9;
  --charcoal:#2E2E2E;
  --tan:     #A37C54;
  --terra:   #B25B3C;
  --white:   #ffffff;
}

/* ── Reset & base ──────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Noto Sans', 'Noto Sans Georgian', sans-serif;
  background: var(--cream);
  color: var(--charcoal);
  font-size: 16px;
  line-height: 1.6;
}

h1, h2, h3 {
  font-family: 'Noto Serif', 'Noto Serif Georgian', serif;
  color: var(--navy);
}

a { color: var(--navy); text-decoration: none; }
a:hover { color: var(--terra); }

img { display: block; max-width: 100%; height: auto; }

/* ── Layout ────────────────────────────────────────────── */
.container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
.section    { padding: 3rem 0; }

/* ── Navigation ────────────────────────────────────────── */
.site-nav {
  background: var(--cream);
  border-bottom: 1px solid rgba(28,46,74,0.1);
  position: sticky; top: 0; z-index: 100;
}
.site-nav .inner {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  max-width: 1200px; margin: 0 auto;
}
.site-nav .logo img { height: 40px; }
.site-nav .links {
  display: flex; gap: 2rem; align-items: center;
  font-size: 0.8rem; letter-spacing: 0.1em; text-transform: uppercase;
}
.site-nav .links a { color: var(--navy); }
.site-nav .links a:hover { color: var(--terra); }
.lang-switch {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  display: flex; gap: 0.5rem;
}
.lang-switch a { color: var(--tan); }
.lang-switch a.active { color: var(--navy); font-weight: 600; }
.burger { display: none; background: none; border: none; cursor: pointer; }
.burger span {
  display: block; width: 22px; height: 2px;
  background: var(--navy); margin: 4px 0;
}
@media (max-width: 768px) {
  .burger { display: block; }
  .site-nav .links { display: none; flex-direction: column; }
  .site-nav .links.open { display: flex; position: absolute; top: 100%; left: 0; right: 0; background: var(--cream); padding: 1rem 1.5rem; border-bottom: 1px solid rgba(28,46,74,0.1); }
}

/* ── Hero ──────────────────────────────────────────────── */
.hero {
  position: relative;
  min-height: 480px;
  background-size: cover; background-position: center;
  display: flex; align-items: center; justify-content: center;
  text-align: center;
  color: var(--cream);
}
.hero::after {
  content: '';
  position: absolute; inset: 0;
  background: rgba(28,46,74,0.58);
}
.hero-content {
  position: relative; z-index: 1;
  padding: 2rem;
}
.hero-content img { height: 80px; margin: 0 auto 1.5rem; filter: brightness(0) invert(1); }
.hero-content blockquote {
  font-family: 'Noto Serif', 'Noto Serif Georgian', serif;
  font-style: italic;
  font-size: 1.25rem;
  max-width: 640px;
  line-height: 1.7;
  color: rgba(243,236,224,0.92);
}

/* ── Section cards ─────────────────────────────────────── */
.section-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  padding: 3rem 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}
@media (max-width: 900px) { .section-cards { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) { .section-cards { grid-template-columns: 1fr; } }

.section-card {
  background: var(--white);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  display: flex; flex-direction: column;
}
.section-card .card-body { padding: 1.25rem 1.5rem 1.5rem; flex: 1; display: flex; flex-direction: column; }
.section-card h3 { margin-bottom: 0.5rem; }
.section-card p  { color: var(--tan); font-size: 0.9rem; flex: 1; }
.section-card .card-link {
  margin-top: 1rem;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--terra);
}

/* ── Event highlight ───────────────────────────────────── */
.event-highlight {
  background: var(--navy);
  color: var(--cream);
  padding: 2rem 1.5rem;
  border-radius: 8px;
  max-width: 1200px;
  margin: 0 auto 3rem;
  display: flex; align-items: center; justify-content: space-between; gap: 2rem;
  flex-wrap: wrap;
}
.event-highlight h3 { color: var(--blue); margin-bottom: 0.5rem; }
.event-highlight p  { font-size: 0.9rem; color: rgba(243,236,224,0.85); }
.btn {
  display: inline-block;
  padding: 0.6rem 1.5rem;
  border-radius: 4px;
  font-family: 'Noto Sans', sans-serif;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  cursor: pointer;
  border: none;
  text-transform: uppercase;
}
.btn-terra { background: var(--terra); color: var(--white); }
.btn-terra:hover { background: #9d4f35; color: var(--white); }
.btn-navy  { background: var(--navy);  color: var(--cream); }

/* ── Photo grid ────────────────────────────────────────── */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
@media (max-width: 900px) { .photo-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) { .photo-grid { grid-template-columns: 1fr; } }
.photo-grid .photo-item { aspect-ratio: 4/3; overflow: hidden; border-radius: 6px; }
.photo-grid .photo-item img { width: 100%; height: 100%; object-fit: cover; }

/* ── Team cards ────────────────────────────────────────── */
.team-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
}
@media (max-width: 900px) { .team-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) { .team-grid { grid-template-columns: 1fr 1fr; } }
.team-card { text-align: center; }
.team-card .avatar {
  width: 100%; aspect-ratio: 1/1;
  border-radius: 50%; overflow: hidden;
  margin: 0 auto 0.75rem;
}
.team-card .avatar img { width: 100%; height: 100%; object-fit: cover; }
.team-card .name { font-family: 'Noto Serif', serif; font-size: 1rem; color: var(--navy); }
.team-card .role { font-size: 0.8rem; color: var(--tan); }

/* ── Menu list ─────────────────────────────────────────── */
.menu-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}
@media (max-width: 900px) { .menu-cards { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) { .menu-cards { grid-template-columns: 1fr; } }

.menu-card {
  background: var(--white);
  border-radius: 8px;
  padding: 2rem 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
}
.menu-card h3 { margin-bottom: 0.4rem; }
.menu-card p  { color: var(--tan); font-size: 0.9rem; }
.event-badge {
  display: inline-block;
  background: var(--blue);
  color: var(--navy);
  font-size: 0.7rem;
  padding: 0.15rem 0.6rem;
  border-radius: 20px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}

/* ── Menu items ────────────────────────────────────────── */
.menu-category { margin-bottom: 3rem; }
.menu-category h3 {
  font-size: 1.1rem;
  color: var(--navy);
  border-bottom: 1px solid rgba(28,46,74,0.15);
  padding-bottom: 0.5rem;
  margin-bottom: 1.5rem;
}
.menu-items-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
@media (max-width: 900px) { .menu-items-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 600px) { .menu-items-grid { grid-template-columns: 1fr; } }

.menu-item {
  background: var(--white);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}
.menu-item .item-photo { aspect-ratio: 4/3; overflow: hidden; }
.menu-item .item-photo img { width: 100%; height: 100%; object-fit: cover; }
.menu-item .item-body { padding: 0.9rem 1rem 1rem; }
.menu-item .item-name {
  font-family: 'Noto Serif', 'Noto Serif Georgian', serif;
  font-size: 1rem; color: var(--navy); margin-bottom: 0.3rem;
}
.menu-item .item-desc { font-size: 0.82rem; color: var(--tan); margin-bottom: 0.5rem; }
.menu-item .item-price { font-size: 0.9rem; color: var(--terra); font-weight: 600; }
.menu-item .item-tags { margin-top: 0.4rem; display: flex; flex-wrap: wrap; gap: 0.3rem; }
.tag {
  font-size: 0.7rem; padding: 0.1rem 0.5rem;
  background: var(--cream); border-radius: 20px; color: var(--tan);
}

/* ── News list ─────────────────────────────────────────── */
.news-list { display: flex; flex-direction: column; gap: 1.5rem; }
.news-card {
  background: var(--white);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  display: flex;
}
@media (max-width: 600px) { .news-card { flex-direction: column; } }
.news-card .card-photo { width: 280px; flex-shrink: 0; aspect-ratio: 16/9; overflow: hidden; }
.news-card .card-photo img { width: 100%; height: 100%; object-fit: cover; }
.news-card .card-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; }
.news-card .card-date { font-size: 0.78rem; color: var(--tan); margin-bottom: 0.4rem; }
.news-card h3 { margin-bottom: 0.5rem; }
.news-card .card-excerpt { font-size: 0.88rem; color: var(--charcoal); flex: 1; }
.news-card .read-more { margin-top: 0.75rem; font-size: 0.8rem; color: var(--terra); text-transform: uppercase; letter-spacing: 0.07em; }
@media (max-width: 600px) { .news-card .card-photo { width: 100%; } }

/* ── News article ──────────────────────────────────────── */
.article { max-width: 760px; margin: 0 auto; }
.article .cover { aspect-ratio: 16/9; overflow: hidden; border-radius: 8px; margin-bottom: 2rem; }
.article .cover img { width: 100%; height: 100%; object-fit: cover; }
.article .article-meta { font-size: 0.82rem; color: var(--tan); margin-bottom: 1rem; }
.article h1 { font-size: 2rem; margin-bottom: 1.25rem; line-height: 1.3; }
.article .article-body { font-size: 1rem; line-height: 1.75; }
.article .article-body p  { margin-bottom: 1rem; }
.article .article-body img { border-radius: 6px; margin: 1rem 0; }

/* ── Registration form ─────────────────────────────────── */
.registration-form {
  background: var(--white);
  border-radius: 8px;
  padding: 2rem;
  margin-top: 3rem;
  max-width: 480px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
}
.registration-form h3 { margin-bottom: 1.25rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.82rem; color: var(--tan); margin-bottom: 0.3rem; }
.form-group input {
  width: 100%; padding: 0.6rem 0.75rem;
  border: 1px solid rgba(28,46,74,0.2);
  border-radius: 4px;
  font-family: inherit; font-size: 0.9rem;
  background: var(--cream);
}
.form-group input:focus { outline: none; border-color: var(--blue); }
.success-msg {
  background: rgba(151,184,201,0.2);
  border-left: 3px solid var(--blue);
  padding: 1rem 1.25rem;
  border-radius: 4px;
  color: var(--navy);
}

/* ── Footer ────────────────────────────────────────────── */
.site-footer {
  background: var(--navy);
  color: rgba(243,236,224,0.7);
  padding: 2.5rem 1.5rem;
  margin-top: 4rem;
  font-size: 0.85rem;
  text-align: center;
}
.site-footer .footer-logo img { height: 36px; filter: brightness(0) invert(1); margin: 0 auto 1rem; opacity: 0.8; }
.site-footer a { color: var(--blue); }

/* ── Page header ───────────────────────────────────────── */
.page-header {
  background: var(--navy);
  color: var(--cream);
  padding: 3rem 1.5rem;
  text-align: center;
}
.page-header h1 { color: var(--cream); margin-bottom: 0.25rem; }
.page-header p  { color: var(--blue); font-size: 0.9rem; }
```

- [ ] **Step 3: Commit**

```bash
git add public/stylesheets/pelamushi/web.css
git commit -m "feat(pelamushi): add public CSS"
```

---

## Task 4: Base Layout Template

**Files:**
- Create: `views/pelamushi/layout.pug`

- [ ] **Step 1: Create views directory**

```bash
mkdir -p views/pelamushi/admin
```

- [ ] **Step 2: Create layout.pug**

Create `views/pelamushi/layout.pug`:

```pug
doctype html
html(lang=lang)
  head
    meta(charset='utf-8')
    meta(name='viewport' content='width=device-width, initial-scale=1.0')
    title #{pageTitle ? pageTitle + ' | ' : ''}ფელამუში · Pelamushi
    meta(name='description' content=pageDesc || t.footer.tagline)
    link(rel='icon' href='/images/pelamushi/logo1.png')
    link(rel='preconnect' href='https://fonts.googleapis.com')
    link(rel='preconnect' href='https://fonts.gstatic.com')
    link(rel='stylesheet' href='https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600&family=Noto+Sans+Georgian:wght@400;600&family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Noto+Serif+Georgian:ital,wght@0,400;0,700;1,400&display=swap')
    link(rel='stylesheet' href='/stylesheets/pelamushi/web.css')
    block head

  body
    nav.site-nav
      .inner
        a.logo(href=`/${lang}`)
          img(src='/images/pelamushi/logo1.png' alt='Pelamushi')
        .links#nav-links
          a(href=`/${lang}/about`) #{t.nav.about}
          a(href=`/${lang}/menu`) #{t.nav.menu}
          a(href=`/${lang}/news`) #{t.nav.news}
          .lang-switch
            each code in ['ka', 'en', 'ru']
              a(href=`/lang/${code}` class=lang === code ? 'active' : '') #{code.toUpperCase()}
        button.burger(onclick='document.getElementById("nav-links").classList.toggle("open")' aria-label='Menu')
          span
          span
          span

    block content

    footer.site-footer
      .footer-logo
        img(src='/images/pelamushi/logo1.png' alt='Pelamushi')
      p #{t.footer.address}
      p #{t.footer.tagline}

    block scripts
```

- [ ] **Step 3: Commit**

```bash
git add views/pelamushi/layout.pug
git commit -m "feat(pelamushi): add base layout template"
```

---

## Task 5: Homepage

**Files:**
- Create: `views/pelamushi/index.pug`
- Modify: `routes/pelamushi.js` (add homepage route)

- [ ] **Step 1: Add homepage route to routes/pelamushi.js**

Append to `routes/pelamushi.js` before `module.exports`:

```js
router.get('/:lang', async (req, res) => {
  const { lang } = res.locals;

  const aboutDoc = await col.about.doc('main').get();
  const about = aboutDoc.exists ? aboutDoc.data() : {};

  const now = new Date();
  const eventsSnap = await col.news
    .where('registration_enabled', '==', true)
    .orderBy('event_date', 'asc')
    .limit(1)
    .get();

  let upcomingEvent = null;
  eventsSnap.forEach(doc => {
    const d = doc.data();
    const eventDate = d.event_date ? d.event_date.toDate() : null;
    if (eventDate && eventDate >= now) upcomingEvent = { id: doc.id, ...d };
  });

  res.render('pelamushi/index', {
    about,
    upcomingEvent,
  });
});
```

- [ ] **Step 2: Create index.pug**

Create `views/pelamushi/index.pug`:

```pug
extends layout

block content
  .hero(style=`background-image: url('/images/pelamushi/hero.jpg')`)
    .hero-content
      img(src='/images/pelamushi/logo3.png' alt='Pelamushi')
      blockquote #{t.home.quote}

  if upcomingEvent
    .container
      .event-highlight
        div
          h3 #{upcomingEvent['title_' + lang]}
          p
            | #{upcomingEvent.event_date ? new Date(upcomingEvent.event_date.toDate()).toLocaleDateString(lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-GB', {day:'numeric', month:'long', year:'numeric'}) : ''}
        a.btn.btn-terra(href=`/${lang}/news/${upcomingEvent.slug}`) #{t.news.register}

  .section-cards
    .section-card
      .card-body
        h3 #{t.home.about_link}
        p #{about['mission_' + lang] ? about['mission_' + lang].substring(0,120) + '…' : ''}
        a.card-link(href=`/${lang}/about`) #{t.nav.about} →
    .section-card
      .card-body
        h3 #{t.home.menu_link}
        p
        a.card-link(href=`/${lang}/menu`) #{t.nav.menu} →
    .section-card
      .card-body
        h3 #{t.home.news_link}
        p
        a.card-link(href=`/${lang}/news`) #{t.nav.news} →
```

- [ ] **Step 3: Add a placeholder hero image**

Place any JPEG as `public/images/pelamushi/hero.jpg` (will be replaced with real interior photo).

- [ ] **Step 4: Verify homepage loads**

Start server, open `http://pelamushi.localhost:3500/ka`. Expected: page renders with nav, hero section, three cards. No server errors in console.

- [ ] **Step 5: Commit**

```bash
git add routes/pelamushi.js views/pelamushi/index.pug
git commit -m "feat(pelamushi): homepage route and template"
```

---

## Task 6: About Page

**Files:**
- Create: `views/pelamushi/about.pug`
- Modify: `routes/pelamushi.js`

- [ ] **Step 1: Add about route**

Append to `routes/pelamushi.js` before `module.exports`:

```js
router.get('/:lang/about', async (req, res) => {
  const { lang } = res.locals;

  const [aboutDoc, teamSnap, gallerySnap] = await Promise.all([
    col.about.doc('main').get(),
    col.team.where('active', '==', true).orderBy('order').get(),
    col.gallery.orderBy('order').get(),
  ]);

  const about = aboutDoc.exists ? aboutDoc.data() : {};
  const team = teamSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const gallery = gallerySnap.docs.map(d => ({ id: d.id, ...d.data() }));

  res.render('pelamushi/about', { about, team, gallery, pageTitle: res.locals.t.about.title });
});
```

- [ ] **Step 2: Create about.pug**

Create `views/pelamushi/about.pug`:

```pug
extends layout

block content
  .page-header
    h1 #{t.about.title}

  .container.section
    if about['mission_' + lang]
      p.lead(style='font-size:1.15rem; max-width:720px; line-height:1.8; color:var(--charcoal)')
        != about['mission_' + lang]

  if gallery.length
    .container.section
      h2(style='margin-bottom:1.5rem') #{t.about.interior}
      .photo-grid
        each photo in gallery
          .photo-item
            img(src=photo.photo_url alt=photo['caption_' + lang] || '')

  if team.length
    .container.section
      h2(style='margin-bottom:1.5rem') #{t.about.team}
      .team-grid
        each member in team
          .team-card
            .avatar
              img(src=member.photo_url alt=member.name)
            .name #{member.name}
            .role #{member['role_' + lang]}
```

- [ ] **Step 3: Verify about page loads**

Open `http://pelamushi.localhost:3500/ka/about`. Expected: page header, empty sections (no data yet — that's fine). No 500 errors.

- [ ] **Step 4: Commit**

```bash
git add views/pelamushi/about.pug routes/pelamushi.js
git commit -m "feat(pelamushi): about page"
```

---

## Task 7: Menu Pages

**Files:**
- Create: `views/pelamushi/menu-list.pug`
- Create: `views/pelamushi/menu.pug`
- Modify: `routes/pelamushi.js`

- [ ] **Step 1: Add menu routes**

Append to `routes/pelamushi.js` before `module.exports`:

```js
router.get('/:lang/menu', async (req, res) => {
  const { lang } = res.locals;
  const now = new Date();

  const snap = await col.menus.where('active', '==', true).orderBy('order').get();
  const menus = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(m => {
      if (m.type === 'event' && m.date_to) {
        return m.date_to.toDate() >= now;
      }
      return true;
    });

  res.render('pelamushi/menu-list', { menus, pageTitle: res.locals.t.menu.title });
});

router.get('/:lang/menu/:slug', async (req, res) => {
  const { lang } = res.locals;
  const { slug } = req.params;

  const menuSnap = await col.menus.where('slug', '==', slug).limit(1).get();
  if (menuSnap.empty) return res.status(404).send('Menu not found');

  const menuDoc = menuSnap.docs[0];
  const menu = { id: menuDoc.id, ...menuDoc.data() };

  const [catsSnap, itemsSnap] = await Promise.all([
    col.categories.where('menu_id', '==', menu.id).orderBy('order').get(),
    col.items.where('menu_id', '==', menu.id).where('active', '==', true).orderBy('order').get(),
  ]);

  const categories = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const itemsAll   = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // group items by category
  const grouped = categories.map(cat => ({
    ...cat,
    items: itemsAll.filter(i => i.category_id === cat.id),
  }));
  // items without a category
  const uncategorized = itemsAll.filter(i => !i.category_id);

  res.render('pelamushi/menu', {
    menu,
    grouped,
    uncategorized,
    pageTitle: menu['name_' + lang],
  });
});
```

- [ ] **Step 2: Create menu-list.pug**

Create `views/pelamushi/menu-list.pug`:

```pug
extends layout

block content
  .page-header
    h1 #{t.menu.title}

  .container.section
    .menu-cards
      each m in menus
        a.menu-card(href=`/${lang}/menu/${m.slug}` style='display:block; text-decoration:none')
          if m.type === 'event'
            span.event-badge #{t.news.event_badge}
          h3 #{m['name_' + lang]}
          if m['desc_' + lang]
            p #{m['desc_' + lang]}
```

- [ ] **Step 3: Create menu.pug**

Create `views/pelamushi/menu.pug`:

```pug
extends layout

block content
  .page-header
    h1 #{menu['name_' + lang]}
    if menu['desc_' + lang]
      p #{menu['desc_' + lang]}

  .container.section
    a(href=`/${lang}/menu}` style='font-size:.85rem;color:var(--tan)') #{t.menu.back}

  .container.section
    each cat in grouped
      if cat.items.length
        .menu-category
          h3 #{cat['name_' + lang]}
          .menu-items-grid
            each item in cat.items
              .menu-item
                if item.photo_url
                  .item-photo
                    img(src=item.photo_url alt=item['name_' + lang])
                .item-body
                  .item-name #{item['name_' + lang]}
                  if item['desc_' + lang]
                    .item-desc #{item['desc_' + lang]}
                  .item-price #{item.price} ₾
                  if item.tags && item.tags.length
                    .item-tags
                      each tag in item.tags
                        span.tag #{tag}

    if uncategorized.length
      .menu-category
        .menu-items-grid
          each item in uncategorized
            .menu-item
              if item.photo_url
                .item-photo
                  img(src=item.photo_url alt=item['name_' + lang])
              .item-body
                .item-name #{item['name_' + lang]}
                if item['desc_' + lang]
                  .item-desc #{item['desc_' + lang]}
                .item-price #{item.price} ₾
                if item.tags && item.tags.length
                  .item-tags
                    each tag in item.tags
                      span.tag #{tag}
```

- [ ] **Step 4: Verify menu pages load**

Open `http://pelamushi.localhost:3500/en/menu`. Expected: menu list page renders, no server errors.

- [ ] **Step 5: Commit**

```bash
git add views/pelamushi/menu-list.pug views/pelamushi/menu.pug routes/pelamushi.js
git commit -m "feat(pelamushi): menu list and detail pages"
```

---

## Task 8: News Pages + Registration

**Files:**
- Create: `views/pelamushi/news-list.pug`
- Create: `views/pelamushi/news-item.pug`
- Modify: `routes/pelamushi.js`

- [ ] **Step 1: Add news routes**

Append to `routes/pelamushi.js` before `module.exports`:

```js
router.get('/:lang/news', async (req, res) => {
  const { lang } = res.locals;
  const snap = await col.news.orderBy('published_at', 'desc').get();
  const articles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.render('pelamushi/news-list', { articles, pageTitle: res.locals.t.news.title });
});

router.get('/:lang/news/:slug', async (req, res) => {
  const { lang } = res.locals;
  const snap = await col.news.where('slug', '==', req.params.slug).limit(1).get();
  if (snap.empty) return res.status(404).send('Not found');
  const article = { id: snap.docs[0].id, ...snap.docs[0].data() };
  const registered = req.query.registered === '1';
  res.render('pelamushi/news-item', { article, registered, pageTitle: article['title_' + lang] });
});

router.post('/:lang/news/:slug/register', async (req, res) => {
  const { lang } = res.locals;
  const { name, email, phone } = req.body;
  if (!name || !email) return res.status(400).send('Missing fields');

  const snap = await col.news.where('slug', '==', req.params.slug).limit(1).get();
  if (snap.empty) return res.status(404).send('Not found');
  const newsId = snap.docs[0].id;

  await col.registrations.add({
    news_id: newsId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: (phone || '').trim(),
    created_at: new Date(),
  });

  res.redirect(`/${lang}/news/${req.params.slug}?registered=1`);
});
```

- [ ] **Step 2: Create news-list.pug**

Create `views/pelamushi/news-list.pug`:

```pug
extends layout

block content
  .page-header
    h1 #{t.news.title}

  .container.section
    .news-list
      each article in articles
        a.news-card(href=`/${lang}/news/${article.slug}` style='text-decoration:none;color:inherit')
          if article.photo_url
            .card-photo
              img(src=article.photo_url alt=article['title_' + lang])
          .card-body
            if article.registration_enabled
              span.event-badge #{t.news.event_badge}
            .card-date
              | #{article.published_at ? new Date(article.published_at.toDate()).toLocaleDateString(lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-GB', {day:'numeric', month:'long', year:'numeric'}) : ''}
            h3 #{article['title_' + lang]}
            .card-excerpt #{(article['body_' + lang] || '').replace(/<[^>]+>/g, '').substring(0, 160)}…
            span.read-more #{t.news.read_more} →
```

- [ ] **Step 3: Create news-item.pug**

Create `views/pelamushi/news-item.pug`:

```pug
extends layout

block content
  .container.section
    .article
      if article.photo_url
        .cover
          img(src=article.photo_url alt=article['title_' + lang])
      .article-meta
        | #{article.published_at ? new Date(article.published_at.toDate()).toLocaleDateString(lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-GB', {day:'numeric', month:'long', year:'numeric'}) : ''}
        if article.author
          |  · #{article.author}
      h1 #{article['title_' + lang]}
      .article-body
        != article['body_' + lang]

      if article.registration_enabled
        .registration-form
          if registered
            .success-msg #{t.news.success}
          else
            h3 #{t.news.registration_title}
            if article.event_date
              p(style='color:var(--tan);font-size:.85rem;margin-bottom:1rem')
                | #{new Date(article.event_date.toDate()).toLocaleDateString(lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}
            form(action=`/${lang}/news/${article.slug}/register` method='POST')
              .form-group
                label #{t.news.field_name} *
                input(type='text' name='name' required)
              .form-group
                label #{t.news.field_email} *
                input(type='email' name='email' required)
              .form-group
                label #{t.news.field_phone}
                input(type='tel' name='phone')
              button.btn.btn-terra(type='submit') #{t.news.submit}
```

- [ ] **Step 4: Verify news pages load**

Open `http://pelamushi.localhost:3500/ru/news`. Expected: empty list, no server errors. POST to register should redirect back with `?registered=1`.

- [ ] **Step 5: Commit**

```bash
git add views/pelamushi/news-list.pug views/pelamushi/news-item.pug routes/pelamushi.js
git commit -m "feat(pelamushi): news list, article, and registration form"
```

---

## Task 9: File Upload Helper

**Files:**
- Create: `lib/pelamushi-upload.js`

- [ ] **Step 1: Create upload helper**

Create `lib/pelamushi-upload.js`:

```js
const sharp = require('sharp');
const path = require('path');
const { storage } = require('./pelamushi-firebase');

const bucket = storage.bucket(process.env.PELAMUSHI_BUCKET);

const PRESETS = {
  gallery:  { width: 1200 },
  cover:    { width: 1600 },
  avatar:   { width: 600, height: 600, fit: 'cover' },
  item:     { width: 800 },
};

async function uploadPhoto(fileBuffer, originalName, folder, preset = 'gallery') {
  const { width, height, fit } = PRESETS[preset] || PRESETS.gallery;

  const resized = await sharp(fileBuffer)
    .resize(width, height || null, { fit: fit || 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const ext = '.jpg';
  const filename = `pelamushi/${folder}/${Date.now()}${ext}`;
  const file = bucket.file(filename);

  await file.save(resized, { contentType: 'image/jpeg', public: true });
  await file.makePublic();

  return `https://storage.googleapis.com/${process.env.PELAMUSHI_BUCKET}/${filename}`;
}

module.exports = { uploadPhoto };
```

- [ ] **Step 2: Verify module loads**

In Node.js REPL:
```bash
node -e "require('./lib/pelamushi-upload'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add lib/pelamushi-upload.js
git commit -m "feat(pelamushi): add Firebase Storage upload helper"
```

---

## Task 10: Admin Auth Middleware + Login

**Files:**
- Create: `lib/pelamushi-auth.js`
- Create: `routes/pelamushi-admin.js`
- Create: `views/pelamushi/admin/layout.pug`
- Create: `views/pelamushi/admin/login.pug`
- Create: `public/stylesheets/pelamushi/admin.css`
- Modify: `app.js`

- [ ] **Step 1: Create admin auth middleware**

Create `lib/pelamushi-auth.js`:

```js
const { initializeApp: initAuth } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { col } = require('./pelamushi-firebase');

// reuse the already-initialized 'pelamushi' app
const { getApp } = require('firebase-admin/app');
const auth = getAuth(getApp('pelamushi'));

let adminEmails = null;

async function loadAdminEmails() {
  const snap = await col.admins.get();
  adminEmails = new Set(snap.docs.map(d => d.id));
}

loadAdminEmails().catch(console.error);
// refresh every 5 minutes
setInterval(() => loadAdminEmails().catch(console.error), 5 * 60 * 1000);

async function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies.pelamushi_token;
  if (!token) return res.redirect('/admin/login');

  try {
    const decoded = await auth.verifyIdToken(token);
    if (!adminEmails || !adminEmails.has(decoded.email)) {
      res.clearCookie('pelamushi_token');
      return res.redirect('/admin/login?err=forbidden');
    }
    res.locals.adminEmail = decoded.email;
    next();
  } catch {
    res.clearCookie('pelamushi_token');
    res.redirect('/admin/login?err=expired');
  }
}

module.exports = { requireAdmin };
```

- [ ] **Step 2: Create admin CSS**

Create `public/stylesheets/pelamushi/admin.css`:

```css
:root {
  --cream: #F3ECE0; --navy: #1C2E4A; --blue: #97B8C9;
  --charcoal: #2E2E2E; --tan: #A37C54; --terra: #B25B3C;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Noto Sans', sans-serif; background: #f5f5f5; color: var(--charcoal); }
a { color: var(--navy); text-decoration: none; }
.admin-wrap { display: flex; min-height: 100vh; }
.admin-sidebar {
  width: 220px; background: var(--navy); color: var(--cream);
  padding: 1.5rem 0; flex-shrink: 0;
}
.admin-sidebar .logo { padding: 0 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
.admin-sidebar .logo img { height: 36px; filter: brightness(0) invert(1); }
.admin-sidebar nav { padding: 1rem 0; }
.admin-sidebar nav a {
  display: block; padding: 0.65rem 1.25rem;
  font-size: 0.85rem; color: rgba(243,236,224,0.8);
  letter-spacing: 0.05em;
}
.admin-sidebar nav a:hover, .admin-sidebar nav a.active { color: var(--cream); background: rgba(255,255,255,0.08); }
.admin-main { flex: 1; padding: 2rem; }
.admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.admin-header h1 { font-size: 1.4rem; color: var(--navy); }
.admin-header .topbar { font-size: 0.8rem; color: var(--tan); }
.card { background: #fff; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 1.5rem; }
.card h2 { font-size: 1rem; margin-bottom: 1rem; color: var(--navy); }
.form-row { margin-bottom: 1rem; }
.form-row label { display: block; font-size: 0.78rem; color: var(--tan); margin-bottom: 0.3rem; }
.form-row input, .form-row textarea, .form-row select {
  width: 100%; padding: 0.55rem 0.75rem;
  border: 1px solid #ddd; border-radius: 4px;
  font-family: inherit; font-size: 0.9rem; background: #fafafa;
}
.form-row textarea { min-height: 140px; resize: vertical; }
.form-row input:focus, .form-row textarea:focus { outline: none; border-color: var(--blue); }
.lang-tabs { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.lang-tab { padding: 0.3rem 0.75rem; border: 1px solid #ddd; border-radius: 4px; font-size: 0.78rem; cursor: pointer; background: #fff; }
.lang-tab.active { background: var(--navy); color: #fff; border-color: var(--navy); }
.btn { display: inline-block; padding: 0.55rem 1.25rem; border-radius: 4px; font-size: 0.85rem; cursor: pointer; border: none; }
.btn-primary { background: var(--terra); color: #fff; }
.btn-secondary { background: var(--navy); color: #fff; }
.btn-danger { background: #c0392b; color: #fff; }
.btn-sm { padding: 0.3rem 0.75rem; font-size: 0.78rem; }
.table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.table th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 2px solid #eee; color: var(--tan); font-weight: 600; }
.table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #f0f0f0; }
.table tr:hover td { background: #fafafa; }
.stat-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
.stat-card { background: #fff; border-radius: 8px; padding: 1.25rem; box-shadow: 0 1px 4px rgba(0,0,0,0.08); text-align: center; }
.stat-card .num { font-size: 2rem; font-weight: 700; color: var(--navy); }
.stat-card .label { font-size: 0.78rem; color: var(--tan); margin-top: 0.25rem; }
.alert { padding: 0.75rem 1rem; border-radius: 4px; margin-bottom: 1rem; font-size: 0.88rem; }
.alert-success { background: rgba(151,184,201,0.2); border-left: 3px solid var(--blue); color: var(--navy); }
.alert-error { background: rgba(178,91,60,0.1); border-left: 3px solid var(--terra); color: var(--terra); }
.login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--navy); }
.login-card { background: var(--cream); border-radius: 12px; padding: 2.5rem 2rem; width: 360px; }
.login-card .logo { text-align: center; margin-bottom: 1.5rem; }
.login-card .logo img { height: 48px; }
.login-card h2 { text-align: center; margin-bottom: 1.5rem; font-size: 1.1rem; color: var(--navy); }
```

- [ ] **Step 3: Create admin layout**

Create `views/pelamushi/admin/layout.pug`:

```pug
doctype html
html
  head
    meta(charset='utf-8')
    meta(name='viewport' content='width=device-width, initial-scale=1.0')
    title Admin | Pelamushi
    link(rel='stylesheet' href='/stylesheets/pelamushi/admin.css')
    block head
  body
    .admin-wrap
      .admin-sidebar
        .logo
          img(src='/images/pelamushi/logo1.png' alt='Pelamushi')
        nav
          a(href='/admin') Дашборд
          a(href='/admin/about') О нас
          a(href='/admin/menus') Меню
          a(href='/admin/news') Новости
          a(href='/admin/logout' style='margin-top:2rem;color:rgba(243,236,224,0.5)') Выйти
      .admin-main
        .admin-header
          h1 #{title || 'Admin'}
          .topbar #{adminEmail}
        block content
    block scripts
```

- [ ] **Step 4: Create login page**

Create `views/pelamushi/admin/login.pug`:

```pug
doctype html
html
  head
    meta(charset='utf-8')
    title Login | Pelamushi Admin
    link(rel='stylesheet' href='/stylesheets/pelamushi/admin.css')
    script(src='https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js')
    script(src='https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js')
  body
    .login-wrap
      .login-card
        .logo
          img(src='/images/pelamushi/logo1.png' alt='Pelamushi')
        h2 Вход в админку
        if error
          .alert.alert-error #{error}
        .form-row
          label Email
          input#email(type='email' placeholder='admin@example.com')
        .form-row
          label Пароль
          input#password(type='password' placeholder='••••••••')
        button.btn.btn-primary(onclick='login()' style='width:100%') Войти

    script.
      firebase.initializeApp({
        apiKey: "#{firebaseApiKey}",
        authDomain: "#{firebaseProjectId}.firebaseapp.com",
        projectId: "#{firebaseProjectId}",
      });

      async function login() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
          const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
          const token = await cred.user.getIdToken();
          document.cookie = `pelamushi_token=${token}; path=/; max-age=3600; samesite=strict`;
          window.location.href = '/admin';
        } catch (e) {
          alert('Ошибка: ' + e.message);
        }
      }
```

- [ ] **Step 5: Create admin router skeleton**

Create `routes/pelamushi-admin.js`:

```js
const express = require('express');
const router = express.Router();
const { col, Timestamp } = require('../lib/pelamushi-firebase');
const { requireAdmin } = require('../lib/pelamushi-auth');
const { uploadPhoto } = require('../lib/pelamushi-upload');

const FIREBASE_API_KEY   = process.env.PELAMUSHI_WEB_API_KEY;
const FIREBASE_PROJECT_ID = process.env.PELAMUSHI_PROJECT_ID;

// Login (no auth required)
router.get('/login', (req, res) => {
  res.render('pelamushi/admin/login', {
    error: req.query.err || null,
    firebaseApiKey: FIREBASE_API_KEY,
    firebaseProjectId: FIREBASE_PROJECT_ID,
  });
});

router.get('/logout', (req, res) => {
  res.clearCookie('pelamushi_token');
  res.redirect('/admin/login');
});

// All routes below require admin
router.use(requireAdmin);

// Dashboard
router.get('/', async (req, res) => {
  const [menusSnap, newsSnap, regsSnap, teamSnap] = await Promise.all([
    col.menus.get(),
    col.news.get(),
    col.registrations.get(),
    col.team.get(),
  ]);
  res.render('pelamushi/admin/dashboard', {
    title: 'Дашборд',
    stats: {
      menus: menusSnap.size,
      news:  newsSnap.size,
      registrations: regsSnap.size,
      team:  teamSnap.size,
    },
  });
});

module.exports = router;
```

- [ ] **Step 6: Add PELAMUSHI_WEB_API_KEY to .env**

```
PELAMUSHI_WEB_API_KEY=   # From Firebase Console → Project Settings → General → Web API Key
```

- [ ] **Step 7: Confirm admin router mount**

The admin router is mounted in Task 14 Step 1 via `router.use('/admin', require('./pelamushi-admin'))` inside `routes/pelamushi.js`. No changes to `app.js` needed for the admin — it shares the `pelamushi.*.*` vhost.

- [ ] **Step 8: Create dashboard template**

Create `views/pelamushi/admin/dashboard.pug`:

```pug
extends layout

block content
  .stat-cards
    .stat-card
      .num #{stats.menus}
      .label Меню
    .stat-card
      .num #{stats.news}
      .label Публикаций
    .stat-card
      .num #{stats.registrations}
      .label Регистраций
    .stat-card
      .num #{stats.team}
      .label Сотрудников
```

- [ ] **Step 9: Verify admin login page loads**

Open `http://pelamushi.localhost:3500/admin/login`. Expected: login form renders. No server errors.

- [ ] **Step 10: Commit**

```bash
git add lib/pelamushi-auth.js lib/pelamushi-upload.js routes/pelamushi-admin.js views/pelamushi/admin/ public/stylesheets/pelamushi/admin.css .env
git commit -m "feat(pelamushi): admin auth, login, dashboard"
```

---

## Task 11: Admin — About / Gallery / Team

**Files:**
- Create: `views/pelamushi/admin/about.pug`
- Modify: `routes/pelamushi-admin.js`

- [ ] **Step 1: Add about admin routes**

Append to `routes/pelamushi-admin.js` before `module.exports`:

```js
// ── About ────────────────────────────────────────────────
router.get('/about', async (req, res) => {
  const [aboutDoc, teamSnap, gallerySnap] = await Promise.all([
    col.about.doc('main').get(),
    col.team.orderBy('order').get(),
    col.gallery.orderBy('order').get(),
  ]);
  res.render('pelamushi/admin/about', {
    title: 'О нас',
    about: aboutDoc.exists ? aboutDoc.data() : {},
    team: teamSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    gallery: gallerySnap.docs.map(d => ({ id: d.id, ...d.data() })),
    saved: req.query.saved === '1',
  });
});

router.post('/about/mission', async (req, res) => {
  const { mission_en, mission_ka, mission_ru } = req.body;
  await col.about.doc('main').set(
    { mission_en, mission_ka, mission_ru, updated_at: new Date() },
    { merge: true }
  );
  res.redirect('/admin/about?saved=1');
});

router.post('/about/gallery/add', async (req, res) => {
  if (!req.files || !req.files.photo) return res.redirect('/admin/about');
  const url = await uploadPhoto(req.files.photo.data, req.files.photo.name, 'gallery', 'gallery');
  const snap = await col.gallery.orderBy('order', 'desc').limit(1).get();
  const nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
  await col.gallery.add({ photo_url: url, caption_en: '', caption_ka: '', caption_ru: '', order: nextOrder });
  res.redirect('/admin/about');
});

router.post('/about/gallery/:id/delete', async (req, res) => {
  await col.gallery.doc(req.params.id).delete();
  res.redirect('/admin/about');
});

router.post('/about/team/add', async (req, res) => {
  const { name, role_en, role_ka, role_ru } = req.body;
  const snap = await col.team.orderBy('order', 'desc').limit(1).get();
  const nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
  let photo_url = '';
  if (req.files && req.files.photo) {
    photo_url = await uploadPhoto(req.files.photo.data, req.files.photo.name, 'team', 'avatar');
  }
  await col.team.add({ name, role_en, role_ka, role_ru, photo_url, order: nextOrder, active: true });
  res.redirect('/admin/about');
});

router.post('/about/team/:id/delete', async (req, res) => {
  await col.team.doc(req.params.id).delete();
  res.redirect('/admin/about');
});
```

- [ ] **Step 2: Create about.pug**

Create `views/pelamushi/admin/about.pug`:

```pug
extends layout

block content
  if saved
    .alert.alert-success Сохранено

  .card
    h2 Миссия
    form(action='/admin/about/mission' method='POST')
      .form-row
        label Текст (EN)
        textarea(name='mission_en') #{about.mission_en}
      .form-row
        label Текст (KA)
        textarea(name='mission_ka') #{about.mission_ka}
      .form-row
        label Текст (RU)
        textarea(name='mission_ru') #{about.mission_ru}
      button.btn.btn-primary(type='submit') Сохранить

  .card
    h2 Галерея интерьера
    .photo-grid(style='grid-template-columns:repeat(4,1fr);gap:.75rem;margin-bottom:1rem')
      each photo in gallery
        div(style='position:relative')
          img(src=photo.photo_url style='width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px')
          form(action=`/admin/about/gallery/${photo.id}/delete` method='POST' style='position:absolute;top:.3rem;right:.3rem')
            button.btn.btn-danger.btn-sm(type='submit') ×
    form(action='/admin/about/gallery/add' method='POST' enctype='multipart/form-data')
      .form-row
        label Добавить фото
        input(type='file' name='photo' accept='image/*')
      button.btn.btn-secondary.btn-sm(type='submit') Загрузить

  .card
    h2 Команда
    table.table
      tr
        th Имя
        th Роль (RU)
        th
      each member in team
        tr
          td #{member.name}
          td #{member.role_ru}
          td
            form(action=`/admin/about/team/${member.id}/delete` method='POST')
              button.btn.btn-danger.btn-sm(type='submit') Удалить
    form(action='/admin/about/team/add' method='POST' enctype='multipart/form-data')
      h3(style='margin:1rem 0 .75rem;font-size:.9rem') Добавить сотрудника
      .form-row
        label Имя
        input(name='name')
      .form-row
        label Роль (EN / KA / RU)
        input(name='role_en' placeholder='EN')
        input(name='role_ka' placeholder='KA' style='margin-top:.4rem')
        input(name='role_ru' placeholder='RU' style='margin-top:.4rem')
      .form-row
        label Фото
        input(type='file' name='photo' accept='image/*')
      button.btn.btn-secondary.btn-sm(type='submit') Добавить
```

- [ ] **Step 3: Verify about admin page loads**

Open `http://pelamushi.localhost:3500/admin/about` (after logging in). Expected: three sections render, no errors.

- [ ] **Step 4: Commit**

```bash
git add routes/pelamushi-admin.js views/pelamushi/admin/about.pug
git commit -m "feat(pelamushi): admin about/gallery/team CRUD"
```

---

## Task 12: Admin — Menus CRUD

**Files:**
- Create: `views/pelamushi/admin/menus.pug`
- Create: `views/pelamushi/admin/menu-edit.pug`
- Modify: `routes/pelamushi-admin.js`

- [ ] **Step 1: Add menus admin routes**

Append to `routes/pelamushi-admin.js` before `module.exports`:

```js
// ── Menus ────────────────────────────────────────────────
router.get('/menus', async (req, res) => {
  const snap = await col.menus.orderBy('order').get();
  res.render('pelamushi/admin/menus', {
    title: 'Меню',
    menus: snap.docs.map(d => ({ id: d.id, ...d.data() })),
  });
});

router.post('/menus/new', async (req, res) => {
  const { name_en, name_ka, name_ru, desc_en, desc_ka, desc_ru, slug, type } = req.body;
  const snap = await col.menus.orderBy('order', 'desc').limit(1).get();
  const nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
  await col.menus.add({
    name_en, name_ka, name_ru,
    desc_en: desc_en || '', desc_ka: desc_ka || '', desc_ru: desc_ru || '',
    slug, type: type || 'permanent',
    active: true, order: nextOrder,
    created_at: new Date(),
  });
  res.redirect('/admin/menus');
});

router.get('/menus/:id', async (req, res) => {
  const [menuDoc, catsSnap, itemsSnap] = await Promise.all([
    col.menus.doc(req.params.id).get(),
    col.categories.where('menu_id', '==', req.params.id).orderBy('order').get(),
    col.items.where('menu_id', '==', req.params.id).orderBy('order').get(),
  ]);
  if (!menuDoc.exists) return res.status(404).send('Not found');
  res.render('pelamushi/admin/menu-edit', {
    title: 'Редактировать меню',
    menu: { id: menuDoc.id, ...menuDoc.data() },
    categories: catsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    items: itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    saved: req.query.saved === '1',
  });
});

router.post('/menus/:id', async (req, res) => {
  const { name_en, name_ka, name_ru, desc_en, desc_ka, desc_ru, slug, type, active } = req.body;
  await col.menus.doc(req.params.id).update({
    name_en, name_ka, name_ru,
    desc_en: desc_en || '', desc_ka: desc_ka || '', desc_ru: desc_ru || '',
    slug, type, active: active === 'on',
  });
  res.redirect(`/admin/menus/${req.params.id}?saved=1`);
});

router.post('/menus/:id/categories/add', async (req, res) => {
  const { name_en, name_ka, name_ru } = req.body;
  const snap = await col.categories.where('menu_id', '==', req.params.id).orderBy('order', 'desc').limit(1).get();
  const nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
  await col.categories.add({ menu_id: req.params.id, name_en, name_ka, name_ru, order: nextOrder });
  res.redirect(`/admin/menus/${req.params.id}`);
});

router.post('/menus/:id/categories/:catId/delete', async (req, res) => {
  await col.categories.doc(req.params.catId).delete();
  res.redirect(`/admin/menus/${req.params.id}`);
});

router.post('/menus/:id/items/add', async (req, res) => {
  const { name_en, name_ka, name_ru, desc_en, desc_ka, desc_ru, price, category_id, tags } = req.body;
  const snap = await col.items.where('menu_id', '==', req.params.id).orderBy('order', 'desc').limit(1).get();
  const nextOrder = snap.empty ? 0 : snap.docs[0].data().order + 1;
  let photo_url = '';
  if (req.files && req.files.photo) {
    photo_url = await uploadPhoto(req.files.photo.data, req.files.photo.name, 'items', 'item');
  }
  const tagsArr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  await col.items.add({
    menu_id: req.params.id,
    category_id: category_id || '',
    name_en, name_ka, name_ru,
    desc_en: desc_en || '', desc_ka: desc_ka || '', desc_ru: desc_ru || '',
    price: parseFloat(price) || 0,
    photo_url, tags: tagsArr,
    active: true, order: nextOrder,
  });
  res.redirect(`/admin/menus/${req.params.id}`);
});

router.post('/menus/:id/items/:itemId/delete', async (req, res) => {
  await col.items.doc(req.params.itemId).delete();
  res.redirect(`/admin/menus/${req.params.id}`);
});

router.post('/menus/:id/items/:itemId/toggle', async (req, res) => {
  const doc = await col.items.doc(req.params.itemId).get();
  await col.items.doc(req.params.itemId).update({ active: !doc.data().active });
  res.redirect(`/admin/menus/${req.params.id}`);
});
```

- [ ] **Step 2: Create menus.pug**

Create `views/pelamushi/admin/menus.pug`:

```pug
extends layout

block content
  .card
    h2 Создать меню
    form(action='/admin/menus/new' method='POST')
      .form-row
        label Slug (URL, латиница, без пробелов)
        input(name='slug' placeholder='cafe-menu')
      .form-row
        label Тип
        select(name='type')
          option(value='permanent') Постоянное
          option(value='event') Гест-шифт / событие
      .form-row
        label Название EN / KA / RU
        input(name='name_en' placeholder='EN')
        input(name='name_ka' placeholder='KA' style='margin-top:.4rem')
        input(name='name_ru' placeholder='RU' style='margin-top:.4rem')
      .form-row
        label Описание EN / KA / RU
        textarea(name='desc_en' placeholder='EN' style='min-height:60px')
        textarea(name='desc_ka' placeholder='KA' style='min-height:60px;margin-top:.4rem')
        textarea(name='desc_ru' placeholder='RU' style='min-height:60px;margin-top:.4rem')
      button.btn.btn-primary(type='submit') Создать

  .card
    h2 Существующие меню
    table.table
      tr
        th Название (RU)
        th Slug
        th Тип
        th Активно
        th
      each m in menus
        tr
          td #{m.name_ru}
          td #{m.slug}
          td #{m.type}
          td #{m.active ? '✓' : '—'}
          td
            a.btn.btn-secondary.btn-sm(href=`/admin/menus/${m.id}`) Открыть
```

- [ ] **Step 3: Create menu-edit.pug**

Create `views/pelamushi/admin/menu-edit.pug`:

```pug
extends layout

block content
  if saved
    .alert.alert-success Сохранено

  a(href='/admin/menus' style='font-size:.82rem;color:var(--tan)') ← Все меню

  .card(style='margin-top:1rem')
    h2 Настройки меню
    form(action=`/admin/menus/${menu.id}` method='POST')
      .form-row
        label Slug
        input(name='slug' value=menu.slug)
      .form-row
        label Тип
        select(name='type')
          option(value='permanent' selected=menu.type==='permanent') Постоянное
          option(value='event' selected=menu.type==='event') Гест-шифт / событие
      .form-row
        label Название EN / KA / RU
        input(name='name_en' value=menu.name_en placeholder='EN')
        input(name='name_ka' value=menu.name_ka placeholder='KA' style='margin-top:.4rem')
        input(name='name_ru' value=menu.name_ru placeholder='RU' style='margin-top:.4rem')
      .form-row
        label Описание EN / KA / RU
        textarea(name='desc_en' style='min-height:80px') #{menu.desc_en}
        textarea(name='desc_ka' style='min-height:80px;margin-top:.4rem') #{menu.desc_ka}
        textarea(name='desc_ru' style='min-height:80px;margin-top:.4rem') #{menu.desc_ru}
      .form-row
        label
          input(type='checkbox' name='active' checked=menu.active)
          |  Активно
      button.btn.btn-primary(type='submit') Сохранить

  .card
    h2 Категории
    table.table
      tr
        th Название (RU)
        th
      each cat in categories
        tr
          td #{cat.name_ru}
          td
            form(action=`/admin/menus/${menu.id}/categories/${cat.id}/delete` method='POST')
              button.btn.btn-danger.btn-sm(type='submit') Удалить
    form(action=`/admin/menus/${menu.id}/categories/add` method='POST')
      .form-row
        input(name='name_en' placeholder='Название EN')
        input(name='name_ka' placeholder='KA' style='margin-top:.4rem')
        input(name='name_ru' placeholder='RU' style='margin-top:.4rem')
      button.btn.btn-secondary.btn-sm(type='submit') Добавить категорию

  .card
    h2 Позиции
    table.table
      tr
        th Фото
        th Название (RU)
        th Категория
        th Цена
        th Активно
        th
      each item in items
        tr
          td
            if item.photo_url
              img(src=item.photo_url style='width:48px;height:36px;object-fit:cover;border-radius:3px')
          td #{item.name_ru}
          td
            - const cat = categories.find(c => c.id === item.category_id)
            | #{cat ? cat.name_ru : '—'}
          td #{item.price} ₾
          td
            form(action=`/admin/menus/${menu.id}/items/${item.id}/toggle` method='POST' style='display:inline')
              button.btn.btn-sm(type='submit' style=`background:${item.active ? '#27ae60' : '#bbb'};color:#fff`) #{item.active ? '✓' : '—'}
          td
            form(action=`/admin/menus/${menu.id}/items/${item.id}/delete` method='POST' style='display:inline')
              button.btn.btn-danger.btn-sm(type='submit') ×
    h3(style='margin:1.5rem 0 .75rem;font-size:.9rem') Добавить позицию
    form(action=`/admin/menus/${menu.id}/items/add` method='POST' enctype='multipart/form-data')
      .form-row
        label Категория
        select(name='category_id')
          option(value='') — без категории —
          each cat in categories
            option(value=cat.id) #{cat.name_ru}
      .form-row
        label Название EN / KA / RU
        input(name='name_en' placeholder='EN')
        input(name='name_ka' placeholder='KA' style='margin-top:.4rem')
        input(name='name_ru' placeholder='RU' style='margin-top:.4rem')
      .form-row
        label Описание EN / KA / RU
        textarea(name='desc_en' placeholder='EN' style='min-height:60px')
        textarea(name='desc_ka' placeholder='KA' style='min-height:60px;margin-top:.4rem')
        textarea(name='desc_ru' placeholder='RU' style='min-height:60px;margin-top:.4rem')
      .form-row
        label Цена (₾)
        input(name='price' type='number' step='0.5' placeholder='12')
      .form-row
        label Теги (через запятую)
        input(name='tags' placeholder='вегетарианское, без глютена')
      .form-row
        label Фото
        input(type='file' name='photo' accept='image/*')
      button.btn.btn-primary(type='submit') Добавить позицию
```

- [ ] **Step 4: Verify menus admin works**

Open `/admin/menus`, create a test menu, open it, add a category and item. Verify item appears in the public menu page `/:lang/menu/:slug`.

- [ ] **Step 5: Commit**

```bash
git add routes/pelamushi-admin.js views/pelamushi/admin/menus.pug views/pelamushi/admin/menu-edit.pug
git commit -m "feat(pelamushi): admin menus CRUD"
```

---

## Task 13: Admin — News CRUD + Registrations Export

**Files:**
- Create: `views/pelamushi/admin/news.pug`
- Create: `views/pelamushi/admin/news-edit.pug`
- Create: `views/pelamushi/admin/registrations.pug`
- Modify: `routes/pelamushi-admin.js`

- [ ] **Step 1: Add news admin routes**

Append to `routes/pelamushi-admin.js` before `module.exports`:

```js
// ── News ────────────────────────────────────────────────
router.get('/news', async (req, res) => {
  const snap = await col.news.orderBy('published_at', 'desc').get();
  res.render('pelamushi/admin/news', {
    title: 'Новости',
    articles: snap.docs.map(d => ({ id: d.id, ...d.data() })),
  });
});

router.get('/news/new', (req, res) => {
  res.render('pelamushi/admin/news-edit', { title: 'Новая публикация', article: {}, saved: false });
});

router.post('/news/new', async (req, res) => {
  const data = buildArticleData(req.body);
  if (req.files && req.files.photo) {
    data.photo_url = await uploadPhoto(req.files.photo.data, req.files.photo.name, 'news', 'cover');
  }
  const ref = await col.news.add(data);
  res.redirect(`/admin/news/${ref.id}?saved=1`);
});

router.get('/news/:id', async (req, res) => {
  const doc = await col.news.doc(req.params.id).get();
  if (!doc.exists) return res.status(404).send('Not found');
  res.render('pelamushi/admin/news-edit', {
    title: 'Редактировать',
    article: { id: doc.id, ...doc.data() },
    saved: req.query.saved === '1',
  });
});

router.post('/news/:id', async (req, res) => {
  const data = buildArticleData(req.body);
  if (req.files && req.files.photo) {
    data.photo_url = await uploadPhoto(req.files.photo.data, req.files.photo.name, 'news', 'cover');
  }
  await col.news.doc(req.params.id).update(data);
  res.redirect(`/admin/news/${req.params.id}?saved=1`);
});

router.post('/news/:id/delete', async (req, res) => {
  await col.news.doc(req.params.id).delete();
  res.redirect('/admin/news');
});

router.get('/news/:id/registrations', async (req, res) => {
  const [articleDoc, regsSnap] = await Promise.all([
    col.news.doc(req.params.id).get(),
    col.registrations.where('news_id', '==', req.params.id).orderBy('created_at', 'desc').get(),
  ]);
  if (!articleDoc.exists) return res.status(404).send('Not found');
  const registrations = regsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (req.query.export === 'csv') {
    const rows = ['Имя,Email,Телефон,Дата', ...registrations.map(r =>
      `"${r.name}","${r.email}","${r.phone || ''}","${r.created_at ? new Date(r.created_at.toDate()).toISOString() : ''}"`
    )];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="registrations-${req.params.id}.csv"`);
    return res.send('﻿' + rows.join('\n')); // BOM for Excel
  }

  res.render('pelamushi/admin/registrations', {
    title: 'Регистрации',
    article: { id: articleDoc.id, ...articleDoc.data() },
    registrations,
  });
});

function buildArticleData(body) {
  const { title_en, title_ka, title_ru, body_en, body_ka, body_ru, slug, author, published_at, registration_enabled, event_date } = body;
  return {
    title_en, title_ka, title_ru,
    body_en: body_en || '', body_ka: body_ka || '', body_ru: body_ru || '',
    slug, author: author || '',
    published_at: published_at ? new Date(published_at) : new Date(),
    registration_enabled: registration_enabled === 'on',
    event_date: event_date ? new Date(event_date) : null,
  };
}
```

- [ ] **Step 2: Create news.pug**

Create `views/pelamushi/admin/news.pug`:

```pug
extends layout

block content
  .card(style='margin-bottom:1rem')
    a.btn.btn-primary(href='/admin/news/new') + Создать публикацию

  .card
    table.table
      tr
        th Заголовок (RU)
        th Дата
        th Регистрация
        th
      each a in articles
        tr
          td #{a.title_ru}
          td #{a.published_at ? new Date(a.published_at.toDate()).toLocaleDateString('ru-RU') : '—'}
          td #{a.registration_enabled ? '✓' : '—'}
          td
            a.btn.btn-secondary.btn-sm(href=`/admin/news/${a.id}`) Открыть
            if a.registration_enabled
              |  
              a.btn.btn-sm(href=`/admin/news/${a.id}/registrations` style='background:var(--blue);color:var(--navy)') Регистрации
```

- [ ] **Step 3: Create news-edit.pug**

Create `views/pelamushi/admin/news-edit.pug`:

```pug
extends layout

block content
  if saved
    .alert.alert-success Сохранено

  - const isNew = !article.id
  - const action = isNew ? '/admin/news/new' : `/admin/news/${article.id}`

  a(href='/admin/news' style='font-size:.82rem;color:var(--tan)') ← Все публикации

  .card(style='margin-top:1rem')
    form(action=action method='POST' enctype='multipart/form-data')
      .form-row
        label Slug (латиница, без пробелов)
        input(name='slug' value=article.slug || '')
      .form-row
        label Дата публикации
        input(name='published_at' type='date' value=article.published_at ? new Date(article.published_at.toDate ? article.published_at.toDate() : article.published_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
      .form-row
        label Автор
        input(name='author' value=article.author || '')
      .form-row
        label Обложка
        if article.photo_url
          img(src=article.photo_url style='height:80px;border-radius:4px;margin-bottom:.5rem')
        input(type='file' name='photo' accept='image/*')

      hr(style='margin:1.5rem 0')

      .form-row
        label Заголовок EN
        input(name='title_en' value=article.title_en || '')
      .form-row
        label Текст EN (HTML)
        textarea(name='body_en') #{article.body_en}

      hr(style='margin:1.5rem 0')

      .form-row
        label Заголовок KA
        input(name='title_ka' value=article.title_ka || '')
      .form-row
        label Текст KA (HTML)
        textarea(name='body_ka') #{article.body_ka}

      hr(style='margin:1.5rem 0')

      .form-row
        label Заголовок RU
        input(name='title_ru' value=article.title_ru || '')
      .form-row
        label Текст RU (HTML)
        textarea(name='body_ru') #{article.body_ru}

      hr(style='margin:1.5rem 0')

      .form-row
        label
          input(type='checkbox' name='registration_enabled' checked=article.registration_enabled)
          |  Включить регистрацию
      .form-row
        label Дата мероприятия (если есть регистрация)
        input(name='event_date' type='datetime-local' value=article.event_date ? new Date(article.event_date.toDate ? article.event_date.toDate() : article.event_date).toISOString().slice(0,-8) : '')

      .form-row(style='display:flex;gap:.75rem;margin-top:1.5rem')
        button.btn.btn-primary(type='submit') Сохранить
        if !isNew
          a.btn.btn-danger(href=`/admin/news/${article.id}/delete` onclick='return confirm("Удалить?")') Удалить

    if !isNew
      form(action=`/admin/news/${article.id}/delete` method='POST' style='display:none')#deleteForm
      script.
        document.querySelector('[href$="/delete"]')?.addEventListener('click', e => {
          e.preventDefault();
          if (confirm('Удалить публикацию?')) document.getElementById('deleteForm').submit();
        });
```

- [ ] **Step 4: Create registrations.pug**

Create `views/pelamushi/admin/registrations.pug`:

```pug
extends layout

block content
  a(href='/admin/news' style='font-size:.82rem;color:var(--tan)') ← Все публикации

  .card(style='margin-top:1rem')
    h2 #{article.title_ru}
    p(style='color:var(--tan);font-size:.85rem;margin-bottom:1.5rem') #{registrations.length} регистраций
    a.btn.btn-secondary.btn-sm(href=`/admin/news/${article.id}/registrations?export=csv`) Скачать CSV

    if registrations.length
      table.table(style='margin-top:1rem')
        tr
          th Имя
          th Email
          th Телефон
          th Дата
        each r in registrations
          tr
            td #{r.name}
            td #{r.email}
            td #{r.phone || '—'}
            td #{r.created_at ? new Date(r.created_at.toDate()).toLocaleDateString('ru-RU') : '—'}
    else
      p(style='color:var(--tan);margin-top:1rem') Регистраций пока нет
```

- [ ] **Step 5: Verify full news flow**

1. Open `/admin/news/new`, create a test article with registration enabled, set event date
2. Open the public article page `/:lang/news/:slug` — verify registration form appears
3. Submit the form — verify redirect to `?registered=1`, success message shown
4. Open `/admin/news/:id/registrations` — verify entry appears
5. Click "Скачать CSV" — verify file downloads with correct data

- [ ] **Step 6: Commit**

```bash
git add routes/pelamushi-admin.js views/pelamushi/admin/news.pug views/pelamushi/admin/news-edit.pug views/pelamushi/admin/registrations.pug
git commit -m "feat(pelamushi): admin news CRUD and registrations export"
```

---

## Task 14: Firestore Indexes + Final Wiring

**Files:**
- Modify: `routes/pelamushi.js` (fix `/:lang/*` middleware for nested paths)

- [ ] **Step 1: Mount admin router inside public router**

In `routes/pelamushi.js`, add this line near the top (after the `locales` block, before the `router.param`):

```js
router.use('/admin', require('./pelamushi-admin'));
```

- [ ] **Step 2: Create required Firestore composite indexes**

In Firebase Console → Firestore → Indexes, create these composite indexes:

| Collection | Fields | Order |
|---|---|---|
| `pelamushi_news` | `registration_enabled` ASC, `event_date` ASC | — |
| `pelamushi_menu_items` | `menu_id` ASC, `active` ASC, `order` ASC | — |
| `pelamushi_registrations` | `news_id` ASC, `created_at` DESC | — |
| `pelamushi_team` | `active` ASC, `order` ASC | — |

Or let Firebase auto-create them by running the app and clicking the error links in the console logs.

- [ ] **Step 3: Add .gitignore entry for brainstorm files**

```bash
echo '.superpowers/' >> .gitignore
git add .gitignore
```

- [ ] **Step 4: End-to-end smoke test**

Visit each URL and confirm no 500 errors:
- `http://pelamushi.localhost:3500/` → redirects to `/ka`
- `http://pelamushi.localhost:3500/ka` → homepage
- `http://pelamushi.localhost:3500/en/about` → about page
- `http://pelamushi.localhost:3500/ru/menu` → menu list
- `http://pelamushi.localhost:3500/ka/news` → news list
- `http://pelamushi.localhost:3500/admin` → redirects to login (if not logged in)
- `http://pelamushi.localhost:3500/admin/login` → login page
- `http://pelamushi.localhost:3500/lang/en` → switches language

- [ ] **Step 5: Final commit**

```bash
git add routes/pelamushi.js .gitignore
git commit -m "feat(pelamushi): final wiring, Firestore index notes, lang middleware fix"
```
