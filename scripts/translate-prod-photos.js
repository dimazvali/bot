'use strict';
// Hand-translated EN fields for the REAL prod country/series/photo dataset
// (routes/photo.js "gallery" data — distinct from the shoots collection, which
// was already translated separately). Written directly by Claude, no API calls.
// Only fills fields currently empty — safe to re-run. Run: PHOTO_ENV=prod node <this file>
require('dotenv').config({ path: 'C:/Users/dshestakov/node/bot/.env' });

var { initializeApp, getApps, cert } = require('firebase-admin/app');
var { getFirestore } = require('firebase-admin/firestore');
var photoData = require('C:/Users/dshestakov/node/bot/lib/photo-data');

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

var COUNTRY_LABELS = {
  georgia: 'Georgia',
  kz: 'Kazakhstan',
  montenegro: 'Montenegro',
  portraits: 'Portraits',
};

var SERIES_LABELS = {
  'georgia/batumi': 'Batumi',
  'georgia/hevsureti': 'Khevsureti',
  'georgia/kutaisi': 'Kutaisi',
  'georgia/mtsheta': 'Mtskheta',
  'georgia/pankisi': 'Pankisi',
  'georgia/samegrelo': 'Samegrelo',
  'georgia/tbilisi': 'Tbilisi',
  'kz/almaty': 'Almaty',
  'kz/charyn': 'Charyn Canyon',
  'montenegro/kotor': 'Kotor',
  'portraits/news': 'News',
  'portraits/outdoors': 'Street',
  'portraits/studio': 'Studio',
};

// key: "country/series/photoId" -> { title_en?, desc_en? }
var PHOTOS = {
  'georgia/batumi/dji-fly-20260312-182322-174-1773325565022-photo-optimized': {
    title_en: 'Medea',
    desc_en: "Possibly the definitive monument to Georgian women's urge to leave their native shores. And then come back. And boil someone. Or ship them off. Or stab them. The ways of Colchian women are inscrutable.",
  },
  'georgia/batumi/dji-fly-20260311-181456-64-1773238727064-photo-optimized': {
    title_en: 'Pontic shore',
    desc_en: 'Pontus Euxinus (Πόντος Εὔξενος, "the Hospitable Sea") is, it seems, the best name this sea has ever had — better than Black, Russian, Great, Georgian, or any of its many other aliases.',
  },
  'georgia/batumi/dji-fly-20260312-174722-156-1773323498033-photo-optimized': {
    title_en: 'Anchovynauts',
    desc_en: 'They say the humble kilka gets +50 to market value, +100 to charisma, and a couple more hit points the moment it starts calling itself a European anchovy (Engraulis encrasicolus).',
  },
  'georgia/batumi/dji-fly-20260311-181226-58-1773238684554-photo-optimized': {
    title_en: 'Off-season',
    desc_en: 'Not many popular places gain more from the absence of people than Batumi. Well — Saint Petersburg. Well — Eden…',
  },
  'georgia/batumi/dji-fly-20260312-182116-170-1773325348393-photo-optimized': {
    desc_en: "The Tsar Cannon doesn't fire, the Tsar Bell doesn't ring, and the tallest Ferris wheel in Georgia, naturally, doesn't turn. But it's better this way.",
  },
  'georgia/batumi/dji-fly-20260312-182638-198-1773325718831-photo-optimized': {
    title_en: 'Medea 2',
    desc_en: "Even Medea's sea view got built over. Good luck waiting for suitors to arrive by sea after that.",
  },
  'georgia/batumi/dji-fly-20260312-165320-88-1773320298089-photo-optimized': {
    title_en: 'The Ferris wheel in Batumi',
    desc_en: "Rumor has it the wheel's main riders are developers — binoculars in hand, maps under arm, scouting the coastline for the last empty plots.",
  },
  'georgia/batumi/dji-fly-20260312-165900-120-1773320712131-photo-optimized': {
    title_en: 'The Ferris wheel',
  },

  'georgia/hevsureti/dji-fly-20250823-173544-554-1755956274563-photo-optimized': { title_en: 'Kistani fortress' },
  'georgia/hevsureti/dji-fly-20250823-172348-552-1755955496471-photo-optimized': { title_en: 'Kistani village', desc_en: 'The road to Shatili' },
  'georgia/hevsureti/dji-fly-20250823-172204-549-1755955403803-photo-optimized': { title_en: 'Kistani' },
  'georgia/hevsureti/dji-fly-20250824-161102-610-1756038008807-photo-optimized': { title_en: 'Kistani' },

  'georgia/kutaisi/dji-fly-20260105-161616-573-1767615386037-photo-optimized': { title_en: 'The Rioni by the white bridge' },
  'georgia/kutaisi/dji-fly-20260105-165908-578-1767617958055-photo-optimized': { title_en: 'View of the Rioni beyond the dam' },
  'georgia/kutaisi/dji-fly-20260105-173526-628-1767620140205-photo-optimized': { title_en: 'Mtsvanekvavila Church' },
  'georgia/kutaisi/dji-fly-20260105-172800-603-1767619762741-photo-optimized': { title_en: 'Kutaisi under snow', desc_en: 'The old Jewish quarter.' },
  'georgia/kutaisi/dji-fly-20260105-172954-611-1767619870234-photo-optimized': { title_en: 'Mtsvanekvavila under snow', desc_en: 'January 2026' },
  'georgia/kutaisi/dji-fly-20250831-173848-758-1756676228397-photo-optimized': { title_en: 'The Rioni by the white bridge' },
  'georgia/kutaisi/dji-fly-20260106-123628-665-1767688941873-photo-optimized': { title_en: 'Kutaisi before sunset' },

  'georgia/mtsheta/dji-fly-20260124-154640-923-1769255271622-photo-optimized': { title_en: 'View of Jvari from the water' },
  'georgia/mtsheta/dji-fly-20260124-152616-907-1769254150677-photo-optimized': {
    title_en: 'The Mtkvari in winter',
    desc_en: 'Remember, pedestrian: the river that Mtskheta actually faces is the Mtkvari (aka the Kura).',
  },
  'georgia/mtsheta/dji-fly-20260124-154416-920-1769255141104-photo-optimized': {
    title_en: 'Jvari from the Mtkvari',
    desc_en: 'Fun fact: according to Google Maps, this is exactly the spot where the Kura becomes the Mtkvari for about a hundred meters (only to turn back into the Kura closer to Tbilisi).',
  },
  'georgia/mtsheta/dji-fly-20260124-152416-901-1769254115803-photo-optimized': {
    title_en: 'Svetitskhoveli in recursion',
    desc_en: "Georgia is a country where agile has well and truly won. And not just in labor law for migrants (or, say, road construction) — architecture too, going back to the most ancient times.\r\nSvetitskhoveli is considered the country's oldest cathedral, though in its current form it was actually rebuilt later than Bagrati Cathedral in Kutaisi. To make up for it, they put replicas of the earlier versions on the roof ridge. And inside, they show you frescoes with jellyfish.",
  },

  'georgia/pankisi/dji-fly-20260510-172130-503-1778419845999-photo-optimized': { title_en: 'Amphitheater' },
  'georgia/pankisi/dji-0473': { title_en: 'Pankisi gorge' },

  'georgia/samegrelo/dji-0610': { title_en: 'Canyon' },
  'georgia/samegrelo/dji-0573': { title_en: 'Balda' },
  'georgia/samegrelo/dji-0624': { title_en: 'Patara Vodopadi' },
  'georgia/samegrelo/dji-0617': { title_en: 'Go left' },
  'georgia/samegrelo/dji-0616-2': { title_en: 'Go right' },

  'georgia/tbilisi/1': {
    title_en: 'View of Metekhi Bridge at low water',
    desc_en: 'In early June 2026 the water level in the Mtkvari dropped sharply — revealing the outlines of old Tbilisi.',
  },
  'georgia/tbilisi/2': {
    title_en: "2 meters below the Mtkvari's usual level",
    desc_en: 'In early June 2026 the water level in the Mtkvari dropped sharply — revealing the outlines of old Tbilisi.',
  },
  'georgia/tbilisi/3': {
    title_en: 'Rope workers on the hot air balloon',
    desc_en: 'Rope-access workers cleaning a popular tourist attraction in Rike Park.',
  },
  'georgia/tbilisi/4': {
    title_en: 'Pleasure boats by the Palace of Justice',
    desc_en: "With the Mtkvari's water level down, the tourist boats were moored on a sandbank.",
  },
  'georgia/tbilisi/5': {
    title_en: 'Snowy Chronicles of Georgia',
    desc_en: "View of Zurab Tsereteli's most monumental monument, and the Tbilisi Sea.",
  },
  'georgia/tbilisi/6': {
    title_en: 'Tbilisi Sea',
    desc_en: 'Also known as the Tbilisi Reservoir — the last refuge for sailors in a city where even the lakes are named after tortoises.',
  },
  'georgia/tbilisi/7': {
    title_en: 'Metekhi in spring',
    desc_en: 'View of the historic city center during the coldest spring of the 21st century.',
  },
  'georgia/tbilisi/8': {
    title_en: "Preparations for Ilia II's burial",
    desc_en: 'The day I personally got acquainted with Georgian state security.',
  },
  'georgia/tbilisi/9': {
    title_en: 'Memorial for Ilia II at Sameba',
    desc_en: 'For three days, people from all over Georgia stood in an endless line to pay their respects to the Patriarch.',
  },
  'georgia/tbilisi/10': {
    title_en: 'Samgori cable car',
    desc_en: 'The lower cabin of an abandoned cable car that once connected the Samgori and Vazisubani districts.',
  },
  'georgia/tbilisi/dji-fly-20251004-172428-35-1759584293867-photo-optimized': {
    title_en: 'New bridge in Vere Park',
    desc_en: 'Gives off Moscow vibes.',
  },
  'georgia/tbilisi/temp-image-for-default-share-png': { title_en: 'Panorama of Rike Park' },
  'georgia/tbilisi/dji-fly-20250803-191336-310-1754234028934-photo-optimized': {
    title_en: 'Kojori in August',
    desc_en: 'View north from the fortress.',
  },
  'georgia/tbilisi/dji-fly-20260307-163208-945-1772886838874-photo-optimized': { title_en: 'Yacht on the Tbilisi Sea' },
  'georgia/tbilisi/dji-fly-20260307-162332-912-1772886365129-photo-optimized': {
    title_en: 'Green',
    desc_en: 'Yachts on the Tbilisi Sea.',
  },
  'georgia/tbilisi/dji-fly-20260211-113620-286-1770795437065-photo-optimized': {
    title_en: "Sameba's dome under snow",
    desc_en: "Rare days when snow in Tbilisi not only falls but can't get back up.\r\nAccording to old-timers (and old paintings), winters here used to be properly Orthodox before the 1980s: kids sledded, professors strolled in felt boots. Something shifted in the 2020s — spring 2022 will live on in city legend. Winter 2026 lives on in the albums of a thousand photographers and the tourists who sympathize with them.",
  },
  'georgia/tbilisi/dji-fly-20260213-034524-416-1770940053802-photo-optimized': {
    title_en: 'Mother Georgia and the TV Tower',
    desc_en: "Mother Georgia carries a sword, but she's always smiling.",
  },
  'georgia/tbilisi/3c9f8124-60fd-4aac-8d20-5a23f5a0ff76': {
    title_en: 'Boris Paichadze Stadium',
    desc_en: 'The football was good that day.',
  },
  'georgia/tbilisi/dji-fly-20250906-134542-935-1757152270258-photo-optimized': {
    title_en: 'Tennis courts',
    desc_en: 'Tbilisi is remarkably deft at absorbing Western trends and codes. Suddenly there are mannered tennis courts in the middle of Chugureti. Soy cows out to pasture in Vazisubani. A wine pipeline nearing completion in Sololaki. And who knows which of this is a joke, which is already built, and which shows up a year or two from now.',
  },
  'georgia/tbilisi/dji-fly-20250906-185526-967-1757171925648-photo-optimized': {
    title_en: 'Chronicles of Georgia, from the inside',
    desc_en: "By city legend (too good to disprove), Zurab Tsereteli wanted to gift the city the Chronicles of Georgia monument to stand on Freedom Square — replacing Lenin, who lived and lived, then wasn't (unlike Sakartvelo). Which Persian relatives the administration invoked to convince the artist that a hilltop by the sea would at least give him better visibility, the editors don't know. But some Eastern tradition was clearly involved.",
  },
  'georgia/tbilisi/dji-fly-20260130-011548-62-1769721379569-photo-optimized': {
    title_en: 'Agmashenebeli',
    desc_en: "The oldest of Tbilisi's straight streets keeps stubbornly returning to the 19th century: cobblestones keep sprouting, cars keep getting turned away. Next thing you know, the Mushtaidi area will be full of German tourists who never left.",
  },
  'georgia/tbilisi/dji-fly-20260127-204202-973-1769532223386-photo-optimized-2': {
    desc_en: 'Half a century ago Andrei Bitov, in his "Georgian Album", already said everything you can still feel and understand in Tbilisi today. One thing that irritated him in particular was the high-rise in the city center: the solemnly Soviet "Iveria". It has since settled in too — with a grim interruption in the \'90s, when refugees from Abkhazia lived there — and now, in new glass and under a new name, the Iveria still disrupts the skyline. Though these days it has competition.',
  },
  'georgia/tbilisi/dji-fly-20260228-145344-665-1772276664019-photo-optimized': {
    title_en: 'Vake Park',
    desc_en: 'Urbanists say the best way to lay out footpaths is not to lay them out at all — watch where people trample a trail, then pave that.',
  },
  'georgia/tbilisi/dji-fly-20260228-145454-667-1772276677270-photo-optimized': { title_en: 'Vake Park 2' },
  'georgia/tbilisi/dji-fly-20260228-145612-671-1772276719537-photo-optimized': { title_en: 'Statue of Victory' },
  'georgia/tbilisi/dji-fly-20260228-145714-674-1772276725437-photo-optimized': { title_en: 'Meskhi Stadium' },
  'georgia/tbilisi/dji-fly-20260304-212114-824-1772645058372-photo-optimized': { title_en: 'Embankment of the Hundred Thousand Martyrs' },
  'georgia/tbilisi/dji-fly-20260307-162840-934-1772886727496-photo-optimized': { title_en: 'By the green sea' },
  'georgia/tbilisi/dji-fly-20260130-194540-104-1769787994561-photo-optimized': { title_en: "Heroes' Square" },
  'georgia/tbilisi/dji-fly-20260221-223356-612-1771699171280-photo-optimized': { title_en: 'Melikishvili Avenue' },
  'georgia/tbilisi/img-1549-3': { title_en: 'View of Betlemi from Rike Park' },
  'georgia/tbilisi/img-1556-hdr': { title_en: 'Betlemi at night' },
  'georgia/tbilisi/img-3764-hdr': { title_en: 'Bridge of Peace at night' },
  'georgia/tbilisi/img-1541': { title_en: 'Bridge of Peace' },

  'horeca/pelamushi/234a6701': { title_en: 'Shakshuka' },
  'horeca/pelamushi/234a6896': { title_en: 'Croque' },
  'horeca/pelamushi/kellomaki-coctail': {
    desc_en: 'aka "goodbye, Komarovo" — Danya Alexandrov\'s free variation on the "free Ingria" theme from the legendary bar Khroniki.',
  },
  'horeca/pelamushi/margarita': { title_en: 'Margarita', desc_en: 'for those who remember how it all used to be' },

  'kz/almaty/dji-fly-20251016-122444-196-1760599729359-photo-optimized': { title_en: 'Shymbulak' },
  'kz/almaty/dji-fly-20260425-153212-419-1777113302139-photo-optimized': {
    title_en: 'Big Almaty Lake',
    desc_en: "Big Almaty Lake — the main water source for Almaty. Fly a drone here without clearance and you can collect the full combo: \r\n— a fine for flying without a permit (now required for every camera drone)\r\n— confiscation for flying in the border zone\r\n— deportation for flying over a specially protected area.\r\n\r\n\"but hey, you'll save on the taxi back\" (c)",
  },
  'kz/almaty/dji-fly-20251016-133556-214-1760603797046-photo-optimized': { title_en: 'Medeu' },
  'kz/almaty/dji-fly-20251014-132952-122-1760430641193-photo-optimized': { title_en: 'Lake Issyk' },
  'kz/almaty/dji-fly-20251014-114842-82-1760424696110-photo-optimized': { title_en: 'The Issyk river' },
  'kz/almaty/dji-fly-20251014-120034-88-1760425253026-photo-optimized': { title_en: 'The road to Issyk' },
  'kz/almaty/dji-fly-20251014-131430-103-1760429806421-photo-optimized': { title_en: 'Lake Issyk' },
  'kz/almaty/dji-fly-20251014-145126-138-1760435606984-photo-optimized': { title_en: 'Lake Issyk' },
  'kz/almaty/dji-fly-20260422-131254-359-1776845836542-photo-optimized': { title_en: 'Lake Kaindy' },
  'kz/almaty/dji-fly-20260422-132120-388-1776846221720-photo-optimized': { title_en: 'Lake Kaindy' },

  'kz/charyn/2': { title_en: 'Canyon of Castles 1' },
  'kz/charyn/3': { title_en: 'Canyon of Castles 2' },
  'kz/charyn/1': { title_en: 'Canyon of Castles 3' },
  'kz/charyn/4': { title_en: 'Canyon without Castles' },

  'montenegro/kotor/dji-fly-20251203-104858-437-1764965525663-photo-optimized': { title_en: "St. Tryphon's Cathedral" },
  'montenegro/kotor/dji-fly-20251203-111158-461-1764756730434-photo-optimized': { title_en: 'Yachts in the Bay of Kotor' },
  'montenegro/kotor/dji-fly-20251203-112032-484-1764965209370-photo-optimized': { title_en: 'Our Lady of Health Church' },
  'montenegro/kotor/dji-fly-20251203-111748-470-1764757144607-photo-optimized': { title_en: 'Kotor. Marina' },
  'montenegro/kotor/dji-fly-20251203-112114-488-1764965194031-photo-optimized': { title_en: 'Bay of Kotor' },

  'portraits/news/ploschadi-svobody-zanyata-silami-politsii': { title_en: 'Freedom Square occupied by police forces' },
  'portraits/news/barrikady-u-parlamentskogo-kvartala-tbilisi': { title_en: "Barricades by Tbilisi's parliamentary quarter" },
  'portraits/news/demonstranty-greyutsya-u-otkrytogo-ognya-na-prospekte-rustaveli': { title_en: 'Demonstrators warm themselves by an open fire on Rustaveli Avenue' },
  'portraits/news/demonstrant-v-oblake-slezotochivogo-gaza-vyrazhaet-nesoglasie-s-dejstviyami-pravitelstva': { title_en: "A demonstrator in a cloud of tear gas voices dissent with the government's actions" },
  'portraits/news/prohozhij-na-ploschadi-svobody': { title_en: 'A passerby on Freedom Square' },
  'portraits/news/prohozhie-na-rustaveli-vo-vremya-protestov': { title_en: 'Passersby on Rustaveli during the protests' },
  'portraits/news/protestnyj-puzyr': {
    title_en: 'Protest bubble',
    desc_en: "Street protesters blow soap bubbles on Heroes' Square shortly before the crackdown.",
  },
  'portraits/news/the-wild-one': { desc_en: 'Bikers supported the protest their own way — with endless rides.' },
  'portraits/news/protestuyuschij-smotrit-na-potuhshie-barrikady': { title_en: 'A protester looks at the burnt-out barricades' },
  'portraits/news/marsh-u-dvortsa-yustitsii': { title_en: 'March by the Palace of Justice' },
  'portraits/news/dixit': { desc_en: 'Author unknown.' },
  'portraits/news/razgon-mitinga-mezhdu-zdaniyami-parlamentov-gruzii': { title_en: "Rally dispersed between Georgia's two parliament buildings" },

  'portraits/outdoors/ee-zovut-masha': { title_en: 'Her name is Masha', desc_en: 'A shoot for Paper Karuli' },
  'portraits/outdoors/ee-zovut-masha-2': { title_en: 'Her name is Masha', desc_en: 'A shoot for Paper Kartuli.' },
  'portraits/outdoors/ee-zovut-masha-3': { title_en: 'Her name is Masha', desc_en: 'A shoot for Paper Kartuli.' },
  'portraits/outdoors/ee-zovut-masha-4': { title_en: 'Her name is Masha', desc_en: 'A shoot for Paper Kartuli.' },
  'portraits/outdoors/': { desc_en: 'An intellectual in its natural habitat.' },
  'portraits/outdoors/-2': { desc_en: "An aerial shot of the street from a bird's-eye view. Urban landscape, architecture, and street life through a drone's lens." },
  'portraits/outdoors/megrelskie-duhi': {
    title_en: 'Megrelian spirits',
    desc_en: "Street portraits from the Megrelian Spirits series. Aerial photography, May 2026. People's lives seen from a bird's-eye view.",
  },
  'portraits/outdoors/danya-aleksandrov-otkryvaet-kafe-pelamushi': {
    title_en: 'Danya Alexandrov opens the Pelamushi café',
    desc_en: 'A portrait of Danya Alexandrov and his café, Pelamushi. Aerial street photography, March 2026.',
  },
  'portraits/outdoors/stanislav-eliseev': {
    title_en: 'Stanislav Eliseev',
    desc_en: 'Portraits from 513 meters up. Aerial photography of Stanislav Eliseev, January 2023. Street scenes from a drone.',
  },
  'portraits/outdoors/filip-parker': {
    title_en: 'Philip Parker',
    desc_en: 'The Surgeon General warns you in every language on earth.',
  },
  'portraits/outdoors/svadba-v-signahi': {
    title_en: 'A wedding in Sighnaghi',
    desc_en: 'A wedding in Sighnaghi: an aerial view of the Georgian town from 750 meters up. January 2023.',
  },
  'portraits/outdoors/timofej-hmelev-s-obratnoj-storony-stojki': {
    title_en: 'Timofey Khmelev on the other side of the bar',
    desc_en: 'Bar Gamotsema / გამოცემა',
  },
  'portraits/outdoors/marusya': { title_en: 'Marusya', desc_en: 'Nicknamed "wild goose"' },
  'portraits/outdoors/egor-antoschenko-na-privale': {
    title_en: 'Egor Antoshchenko at a rest stop',
    desc_en: 'A portrait of Egor Antoshchenko taking a break. Aerial drone photography, May 2026. From the street photography series.',
  },
  'portraits/outdoors/napolovinu-pust': {
    title_en: 'Half empty',
    desc_en: "Aerial photography of the city's streets. A view from above of empty roads and urban development. A photo project by Egor Antoshchenko.",
  },
  'portraits/outdoors/egor-antoschenko': {
    title_en: 'Egor Antoshchenko',
    desc_en: 'A street-photography portrait series by Egor Antoshchenko. May 2026. Authentic portraits of people in an urban setting.',
  },
  'portraits/outdoors/egor-antoschenko-2': {
    title_en: 'Egor Antoshchenko',
    desc_en: 'A portrait series by Egor Antoshchenko shot on city streets. Natural light, genuine emotion, and urban context in every frame.',
  },
  'portraits/outdoors/drum-machine': { desc_en: "Street photography of a drum machine from a bird's-eye view. A shot from the portrait series, May 2026." },
  'portraits/outdoors/amanda': { desc_en: "A portrait of Amanda from a bird's-eye view. Aerial photography from the street portrait series, May 2026." },
  'portraits/outdoors/megruli-ranger': { desc_en: "A portrait of a Megrelian ranger from a bird's-eye view. Aerial photography from the Georgia street-portrait series, May 2026." },
  'portraits/outdoors/megruli-ranger-2': { desc_en: "A portrait from a bird's-eye view. Lilia Yugova, captured in a series of street shots. Aerial photography in the portrait genre." },
  'portraits/outdoors/duhi-megrelii': {
    title_en: 'Spirits of Megrelia',
    desc_en: "Aerial photography of Megrelia. Portraits of the region's streets and people, shot in May 2026.",
  },
  'portraits/outdoors/eka-eliseeva-v-tsvetah-pervoj-respubliki': {
    title_en: 'Eka Eliseeva in the colors of the First Republic',
    desc_en: "That's what a good guide gets you.",
  },
  'portraits/outdoors/duhi-megrelii-2': {
    title_en: 'Spirits of Megrelia',
    desc_en: "Portraits of Megrelia's streets. Photography by Lilia Yugova. Atmospheric shots of the Georgian region, capturing its spirit and character.",
  },
  'portraits/outdoors/dato': {
    title_en: 'Dato',
    desc_en: 'Dato is a staff member at the inclusive café Pelamushi.',
  },
  'portraits/outdoors/-3': { title_en: 'Turtle' },
  'portraits/outdoors/asiny-hroniki': {
    title_en: "Asya's Chronicles",
    desc_en: "The kid, at Chronicles (but there's a catch)",
  },
  'portraits/outdoors/more-na-gore': { title_en: 'Sea on a mountain' },
  'portraits/outdoors/maugli': { title_en: 'Mowgli' },
};

function apply() {
  return photoData.initFromFirestore(fb).then(function() {
    var data = photoData.getData();
    var countriesDone = 0, seriesDone = 0, photosDone = 0, skipped = 0, missing = [];

    Object.keys(COUNTRY_LABELS).forEach(function(ck) {
      if (data[ck] && !data[ck].label_en) { data[ck].label_en = COUNTRY_LABELS[ck]; countriesDone++; }
    });

    Object.keys(SERIES_LABELS).forEach(function(key) {
      var parts = key.split('/');
      var ck = parts[0], sk = parts[1];
      if (data[ck] && data[ck].series[sk] && !data[ck].series[sk].label_en) {
        data[ck].series[sk].label_en = SERIES_LABELS[key];
        seriesDone++;
      }
    });

    Object.keys(PHOTOS).forEach(function(key) {
      var parts = key.split('/');
      var ck = parts[0], sk = parts[1], pid = parts.slice(2).join('/');
      var series = data[ck] && data[ck].series[sk];
      if (!series) { missing.push(key + ' (series not found)'); return; }
      var photo = series.photos.find(function(p) { return p.id === pid; });
      if (!photo) { missing.push(key + ' (photo not found)'); return; }
      var wanted = PHOTOS[key];
      var changed = false;
      if (wanted.title_en && !photo.title_en) { photo.title_en = wanted.title_en; changed = true; }
      if (wanted.desc_en && !photo.desc_en) { photo.desc_en = wanted.desc_en; changed = true; }
      if (changed) photosDone++; else skipped++;
    });

    photoData.saveData(data);

    console.log('countries updated:', countriesDone, '/', Object.keys(COUNTRY_LABELS).length);
    console.log('series updated:', seriesDone, '/', Object.keys(SERIES_LABELS).length);
    console.log('photos updated:', photosDone, '/', Object.keys(PHOTOS).length, '(already had translation:', skipped, ')');
    if (missing.length) { console.log('NOT FOUND (' + missing.length + '):'); missing.forEach(function(m) { console.log(' -', m); }); }
  });
}

apply().then(function() { setTimeout(function() { process.exit(0); }, 2000); }).catch(function(e) { console.error('ERROR', e); process.exit(1); });
