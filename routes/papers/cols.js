const {
    initializeApp,
    applicationDefault,
    cert
} = require('firebase-admin/app');

const { getFirestore } = require('firebase-admin/firestore');
const { devlog } = require('../common');



let gcp = initializeApp({
    credential: cert({
        "type":             "service_account",
        "project_id":       "paperstuff-620fa",
        "private_key_id":   "c01abf8b7c2531fe0e33fae7955c1b3978ba8dc3",
        "private_key":      process.env.paperGCPkey.replace(/\\n/g, '\n'),
        "client_email":     "firebase-adminsdk-g7u75@paperstuff-620fa.iam.gserviceaccount.com",
        "client_id":        "117123513251467365122",
        "auth_uri":         "https://accounts.google.com/o/oauth2/auth",
        "token_uri":        "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-g7u75%40paperstuff-620fa.iam.gserviceaccount.com"
    }),
    databaseURL: "https://rrspecialsapi.firebaseio.com"
}, 'paper');

let fb =                  getFirestore(gcp);

devlog(fb)

const admins =            fb.collection('admins');
const entries =           fb.collection('entries');
const adminTokens =       fb.collection('adminTokens');
const authors =           fb.collection(`authors`);
const bookings =          fb.collection(`bookings`);
const books =             fb.collection('books');
const classes =           fb.collection(`classes`);
const classesOffers =     fb.collection(`classesOffers`);
const coffee =            fb.collection(`coffee`);
const courses =           fb.collection(`courses`);
const coworking =         fb.collection(`coworking`);
const coworkingRules =    fb.collection('cooorkingRules');
const deposits=           fb.collection('deposits');
const eventTypes =        fb.collection('eventTypes');
const gallery =           fb.collection('gallery');
const halls =             fb.collection(`halls`);
const invites =           fb.collection(`invites`);
const invoices =          fb.collection('invoices');
const logs =              fb.collection('logs');
const messages =          fb.collection('userMessages');
const mra =               fb.collection(`meetingRoom`);
const news =              fb.collection('news');
const plans =             fb.collection(`plans`);
const plansRequests =     fb.collection(`plansRequests`);
const plansUsers =        fb.collection(`plansUsers`);
const podcastRecords =    fb.collection(`podcastRecords`);
const polls =             fb.collection('polls');
const pollsAnswers =      fb.collection('pollsAnswers')
const promos =            fb.collection(`promos`);
const randomCoffeeIterations = fb.collection('randomCoffeeIterations');
const randomCoffees =     fb.collection('randomCoffees');
const roomsBlocked =      fb.collection('roomsBlocked');
const settings=           fb.collection('settings');
const standAlone =        fb.collection('standAlone');
const subscriptions =     fb.collection(`subscriptions`);
const tokens =            fb.collection('tokens');
const udb =               fb.collection('users');
const userClasses =       fb.collection(`userClasses`);
const userClassesQ =      fb.collection(`userClassesQ`);
const userClassesWL =     fb.collection(`userClassesWL`);
const userEntries =       fb.collection('userEntries');
const userTags =          fb.collection('userTags');
const views =             fb.collection(`views`);
const wineList =          fb.collection('wineList');


module.exports = {
    fb,

    admins,
    adminTokens,
    authors,
    bookings,
    books,
    classes,
    classesOffers,
    coffee,
    courses,
    coworking,
    coworkingRules,
    deposits,
    entries,
    eventTypes,
    halls,
    invites,
    invoices,
    logs,
    messages,
    mra,
    news,
    plans,
    plansRequests,
    plansUsers,
    polls,
    pollsAnswers,
    promos,
    randomCoffeeIterations,
    randomCoffees,
    roomsBlocked,
    settings,
    standAlone,
    subscriptions,
    tokens,
    udb,
    userClasses,
    userClassesQ,
    userClassesWL,
    userEntries,
    userTags,
    views,
    wineList,
    podcastRecords,
}