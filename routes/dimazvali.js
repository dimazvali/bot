const ngrok2 = process.env.ngrok2;
const ngrok = process.env.ngrok;
const host = `dimazvali`
const token = process.env.dimazvaliToken;
var express = require('express');
var router = express.Router();
var axios = require('axios');
var cors = require('cors')
var fs = require('fs')
var path = require('path');


const {
    dimazvali,
    getDoc,
    uname,
    drawDate,
    devlog,
    letterize,
    letterize2,
    shuffle,
    handleQuery,
    handleDoc,
    handleError,
    cur,
    sudden,
    ifBefore,
} = require('./common.js')


const {
    sendMessage2,
    getUser,
    greeting
} = require('./methods.js');

var cron = require('node-cron');

const qs = require('qs');
const {
    createHash,
    createHmac
} = require('node:crypto');


router.use(cors())

const {
    initializeApp,
    applicationDefault,
    cert
} = require('firebase-admin/app');

const {
    getFirestore,
    Timestamp,
    FieldValue
} = require('firebase-admin/firestore');

const {
    getStorage,
    getDownloadURL
} = require('firebase-admin/storage');



const {
    ObjectStreamToJSON
} = require('sitemap');

const { texts } = require('./dimazvaliTexts.js');

let gcp = initializeApp({
    credential: cert({
        "type": "service_account",
        "project_id": "dimazvalimisc",
        "private_key_id": "5eb5025afc0fe53b63f518ba071f89e7b7ce03af",
        "private_key": process.env.sssGCPKey.replace(/\\n/g, '\n'),
        "client_email": "firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com",
        "client_id": "110523994931477712119",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com"
    }),
    databaseURL: "https://rrspecialsapi.firebaseio.com"
}, 'dimazvali');

let fb = getFirestore(gcp);
let s = getStorage(gcp)

var photoTgNotifier = require('../lib/photo-tg-notifier');
photoTgNotifier.init(fb, token);

function picUrl(pic) {
  if (!pic) return null;
  return typeof pic === 'string' ? pic : (pic.w800 || pic.w400 || pic.w1400);
}

// s.bucket(`dimazvalimisc`)
//     .upload(__dirname + `/../public/sounds/123.mp3`)
//     .then(s=>{
//         console.log(s)
//     })
//     .catch(err=>{
//         console.log(err)
//     })

let bucket = s.bucket('dimazvalimisc.appspot.com')

var multer = require('multer')
var sharp = require('sharp')
var upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

var UPLOAD_SIZES = [400, 800, 1400]
async function uploadImageSizes(buffer, storagePath) {
  var urls = {}
  await Promise.all(UPLOAD_SIZES.map(async function(w) {
    var webp = await sharp(buffer).resize(w, null, { withoutEnlargement: true }).webp({ quality: 85 }).toBuffer()
    var file = bucket.file(storagePath.replace('{w}', w))
    await file.save(webp, { metadata: { contentType: 'image/webp' } })
    await file.makePublic()
    urls['w' + w] = 'https://storage.googleapis.com/' + bucket.name + '/' + file.name
  }))
  return urls
}


setTimeout(function () {
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=https://bot.dimazvali.com/hook`).then(() => {
        console.log(`dimazvali hook set on ${ngrok}`)
    }).catch(handleError)
}, 1000)

let adminTokens = fb.collection('DIMAZVALIadminTokens');
let pages = fb.collection('DIMAZVALIpages');
let sections = fb.collection('DIMAZVALIsections');
let views = fb.collection(`DIMAZVALIviews`);
let logs = fb.collection(`DIMAZVALIlogs`);
let udb = fb.collection(`DIMAZVALIusers`);

function isAdmin(id) {
    return getUser(id, udb).then(function(u) {
        return !!(u && u.admin);
    });
}
let settings = fb.collection(`DIMAZVALIsettings`);
let tags = fb.collection(`DIMAZVALItags`);
let landMarks = fb.collection(`DIMAZVALIlandMarks`);
let tours = fb.collection(`DIMAZVALItours`);
let toursSteps = fb.collection(`DIMAZVALItoursSteps`);
let messages = fb.collection(`DIMAZVALImessage`);
let usersTours = fb.collection(`DIMAZVALIusersTours`);
let usersLandmarks = fb.collection(`DIMAZVALIusersLandmarks`);
let cities = fb.collection(`DIMAZVALIcities`);
let images = fb.collection(`DIMAZVALIimages`);

let authors = fb.collection(`NEVAauthors`);
let programs = fb.collection(`NEVAprograms`);
let shows = fb.collection(`NEVAshows`);

let tgStat= fb.collection(`tgStats`);

let savedLandmarks = {};
let savedSteps = {};
let savedUsers = {};
let savedLandmarkImages = {};


landMarks.get().then(col => {
    handleQuery(col).forEach(l => {
        savedLandmarks[l.id] = l
    })
})

images.where('ownerType', '==', 'landmarks').get().then(col => {
    handleQuery(col).forEach(img => {
        if (!savedLandmarkImages[img.ownerId]) savedLandmarkImages[img.ownerId] = []
        savedLandmarkImages[img.ownerId].push(img)
    })
    Object.keys(savedLandmarkImages).forEach(id => {
        savedLandmarkImages[id].sort((a, b) => a.createdAt._seconds - b.createdAt._seconds)
    })
})

toursSteps.get().then(col => {
    handleQuery(col).forEach(l => {
        savedSteps[l.id] = l
    })
})

let savedSettings = {};

settings.doc(`bot`).get().then(d => {
    if (d.exists) {
        savedSettings = d.data()
    } else {
        settings.doc(`bot`).set({ createdAt: new Date() })
    }
})

function botText(field, fallback, vars) {
    let t = savedSettings[field] || fallback
    if (vars) Object.keys(vars).forEach(k => { t = t.replace(`{${k}}`, vars[k]) })
    return t
}

const datatypes = {
    shows: {
        col: shows,
        newDoc: newEntity,
        extras: [`program`]
    },
    programs: {
        col: programs,
        newDoc: newEntity,
        extras: [`author`]
    },
    authors: {
        col: authors,
        newDoc: newEntity
    },
    cities: {
        col: cities,
        newDoc: newCity
    },
    tours: {
        col: tours,
        newDoc: newTour
    },
    toursSteps: {
        col: toursSteps,
        newDoc: newTourStep
    },
    landmarks: {
        col: landMarks,
        newDoc: newLandMark
    },
    sections: {
        col: sections,
        newDoc: newSection
    },
    users: {
        col: udb,
    },
    settings: {
        col: settings,
    },
    pages: {
        col: pages,
        newDoc: newPage
    },
    tags: {
        col: tags,
        newDoc: newTag
    }
}

function newEntity(req, res, admin, extra) {
    if (!req.body.name) return res.status(400).send(`no name`)

    let o = {
        createdAt: new Date(),
        createdBy: +admin.id,
        active: true,
        description: req.body.description || null,
        name: req.body.name || null,
        pic: req.body.pic || null,
    }

    if (extra) extra.forEach(t => {
        o[t] = req.body[t] || null
    })

    datatypes[req.params.method].col.add(o).then(rec => {
        res.redirect(`/${host}/web?page=${req.params.method}_${rec.id}`)
        log({
            admin: +admin.id,
            [req.params.method]: rec.id,
            text: `${uname(admin,admin.id)} создает ${req.params.method} ${req.body.name}`
        })
    })
}

function dist(lat, long, toLat, toLong) {
    let lonKm = 111.32 * Math.cos((lat + toLat) / 2 * Math.PI / 180)
    return +(Math.sqrt(Math.pow((lat - toLat) * 111.11, 2) + Math.pow((long - toLong) * lonKm, 2))).toFixed(3)
}

let alertedUsers = {

}


router.post(`/rlo`, (req, res) => {
    res.sendStatus(200)
})

function handleLocation(userId, loc) {

    let sUser = savedUsers[userId]

    if (!sUser) {
        sUser = getUser(userId, udb)
    }


    Promise.resolve(sUser).then(sUser => {


        if (!alertedUsers[userId]) alertedUsers[userId] = {};

        {

            let accuracy = loc.horizontal_accuracy || 0;

            Object.keys(savedLandmarks).forEach(key => {

                let place = savedLandmarks[key];

                let distance = dist(loc.latitude, loc.longitude, +place.lat, +place.lng) * 1000

                try {
                    if (distance - accuracy < (place.proximity || 50)) {

                        devlog(`пользователь прибыл в точку ${place.name}`)

                        if (!alertedUsers[userId][place.id]) {

                            let m = {
                                chat_id: userId,
                                parse_mode: `Markdown`,
                                text: `*${place.name}*\n${place.greetings||place.description}`
                            }

                            var placePic = picUrl(place.pic);
                            if (placePic) { m.caption = m.text; m.photo = placePic; }

                            var gallery = savedLandmarkImages[place.id] || [];
                            var sendEp = placePic ? 'sendPhoto' : false;
                            var sendBody = m;

                            if (gallery.length) {
                                var media = [];
                                var rest = gallery;
                                if (placePic) {
                                    media.push({ type: 'photo', media: placePic, caption: m.text, parse_mode: 'Markdown' });
                                } else {
                                    media.push({ type: 'photo', media: picUrl(gallery[0]), caption: m.text, parse_mode: 'Markdown' });
                                    rest = gallery.slice(1);
                                }
                                rest.slice(0, 10 - media.length).forEach(function(img) {
                                    media.push({ type: 'photo', media: picUrl(img) });
                                });
                                if (media.length > 1) {
                                    sendEp = 'sendMediaGroup';
                                    sendBody = { chat_id: userId, media: media };
                                } else if (!placePic) {
                                    // Telegram's sendMediaGroup requires 2-10 items; a single
                                    // gallery photo with no main photo falls back to sendPhoto.
                                    m.caption = m.text;
                                    m.photo = picUrl(gallery[0]);
                                    sendEp = 'sendPhoto';
                                    sendBody = m;
                                }
                            }


                            usersLandmarks.add({
                                createdAt: new Date(),
                                user: +sUser.id,
                                landmark: place.id
                            })

                            landMarks.doc(place.id).update({
                                visited: FieldValue.increment(1)
                            })

                            alertedUsers[userId][place.id] = true;

                            sendMessage2(sendBody, sendEp, token, messages, { text: m.text }).then(() => {
                                if (place.voice) sendMessage2({
                                    chat_id: userId,
                                    voice: place.voice
                                }, `sendVoice`, token, messages)
                            }).then(() => {
                                if (sUser.currentTour) {
                                    let route = Object.keys(savedSteps)
                                        .filter(s => savedSteps[s].tour == sUser.currentTour)
                                        .sort((a, b) => savedSteps[a].index - savedSteps[b].index)


                                    let index = route.map(s => savedSteps[s].landmark)

                                    devlog(index)

                                    let curIndex = index.indexOf(place.id)

                                    devlog(curIndex)

                                    if (curIndex > -1) {
                                        if ((curIndex + 1) < index.length) {

                                            // sendStep(savedLandmarks[index[curIndex+1]],userId)
                                            sendStep(savedSteps[route[curIndex + 1]], userId)
                                            // getDoc(landMarks,index[]).then(l=>{

                                            // })
                                        } else {
                                            sendMessage2({
                                                chat_id: userId,
                                                text: botText(`tourFinishedText`, `Это последняя точка маршрута. Спасибо, что были с нами. Не прощаемся.`)
                                            }, false, token)

                                            usersTours.doc(sUser.currentAttempt).update({
                                                finishedAt: new Date()
                                            })

                                            udb.doc(userId.toString()).update({
                                                currentAttempt: null,
                                                currentTour: null
                                            })
                                        }
                                    } else {
                                        devlog(`Это точка не на маршруте`)
                                    }
                                }
                            })



                        }

                    } else {

                        if (alertedUsers[userId][place.id]) {
                            if (place.goodbyes) sendMessage2({
                                chat_id: userId,
                                text: place.goodbyes
                            }, false, token, messages)
                        }

                        alertedUsers[userId][place.id] = false
                    }
                } catch (error) {
                    console.log(error)
                }
            })
        }
    })
}



router.post(`/hook`, (req, res) => {

    res.sendStatus(200)

    let user = {}



    devlog(JSON.stringify(req.body))

    var from = (req.body.message || req.body.edited_message || req.body.callback_query || req.body.inline_query || {}).from;
    if (from) {
        getUser(from.id, udb).then(function(u) {
            if (!u) registerUser(from);
        });
    }

    if (req.body.edited_message && req.body.edited_message.location) {
        handleLocation(req.body.edited_message.from.id, req.body.edited_message.location)
    }

    if (req.body.callback_query) {
        let user = req.body.callback_query.from;
        let inc = req.body.callback_query.data.split('_')
        switch (inc[0]) {
            case `tour`: {
                return getDoc(tours, inc[1]).then(t => {

                    if (!t) return sendMessage2({
                        callback_query_id: req.body.callback_query.id,
                        show_alert: true,
                        text: `${sudden.sad()}, такой экскурсии нет!`
                    }, 'answerCallbackQuery', token)

                    if (!inc[2]) {
                        sendMessage2({
                            callback_query_id: req.body.callback_query.id,
                            show_alert: true,
                            text: `${sudden.fine()}!`
                        }, 'answerCallbackQuery', token)

                        sendTour(user, t)
                    } else {
                        if (inc[2] == `start`) {
                            startTour(user, t)
                        }
                        if (inc[2] == `stop`) {
                            stopTour(user, t)
                        }
                    }

                })
            }
            default: {
                return sendMessage2({
                    callback_query_id: req.body.callback_query.id,
                    show_alert: true,
                    text: `${sudden.sad()}, такая команда не предусмотрена!`
                }, 'answerCallbackQuery', token)
            }
        }
    }

    if(req.body.inline_query){
        let q = req.body.inline_query
        
        sendMessage2({
            inline_query_id:q.id,
            results: [{
                type:       `article`,
                id:         `pets`,
                title:      `Pet-projects`,
                description: `Занятные шутки моего производства.`,
                input_message_content: {
                    parse_mode: `Markdown`,
                    message_text: texts.pets
                }
            },{
                type:       `article`,
                id:         `banks`,
                title:      `Реквизиты`,
                description: `Хотите заплатить мне? Без проблем!`,
                input_message_content: {
                    parse_mode: `Markdown`,
                    message_text: texts.banks
                }
            },{
                type:               `article`,
                id:                 `SMZ`,
                title:              `СМЗ`,
                description:        `Для приличной бухгалтерии с российской пропиской.`,
                input_message_content: {
                    parse_mode:     `Markdown`,
                    message_text:   texts.smz
                }
            },{
                type:               `article`,
                id:                 `links`,
                title:              `Следы присутствия`,
                description:        `Соцсети и не только.`,
                input_message_content: {
                    parse_mode:     `Markdown`,
                    message_text:   texts.links
                }
            }]
        },`answerInlineQuery`,token)
    }

    if (req.body.message) {
        let msg = req.body.message;
        let uid = msg.from && msg.from.id;

        if (msg.location) {
            handleLocation(uid, msg.location);
        }

        if (msg.text && uid) {
            let text = msg.text.trim();
            if (text === `/start photo_sub`) {
                udb.doc(uid.toString()).set({ photoSubscribed: true }, { merge: true });
                sendMessage2({ chat_id: uid, text: `✓ Вы подписаны на новые фото` }, false, token, messages);
            } else if (text === `/start` || text === `/tours`) {
                sendTours(uid);
            } else {
                messages.add({
                    createdAt: new Date(),
                    user: +uid,
                    text: text,
                    isReply: false
                })
                alertAdmins({
                    text: `💬 Новое сообщение от ${uname(msg.from, uid)}:\n${text}`,
                    user_id: uid
                })
            }
        }
    }

})

function sendTour(user, tour, res) {
    let m = {
        chat_id: user.id,
        parse_mode: `Markdown`,
        text: `*${tour.name}*:\n ${tour.description || `Изините, описание пока не готово`}.`,
        reply_markup: {
            inline_keyboard: [
                [{
                    text: `Начать`,
                    callback_data: `tour_${tour.id}_start`
                }]
            ]
        }
    }
    var tourPic = picUrl(tour.pic);
    if (tourPic) { m.caption = m.text; m.photo = tourPic; }
    sendMessage2(m, tourPic ? 'sendPhoto' : false, token, messages)

    if (res) res.sendStatus(200)
}

function stopTour() {

}

function startTour(user, tour, res, admin) {
    usersTours.add({
        createdAt: new Date(),
        active: true,
        tour: tour.id,
        tourName: tour.name,
        user: user.id,
        userName: uname(user, user.id),
        admin: admin ? +admin.id : null
    }).then(rec => {
        getUser(user.id, udb).then(u => {

            if (u.currentTour) stopTour(u, u.currentTour);

            udb.doc(user.id.toString()).update({
                currentTour: tour.id,
                currentAttempt: rec.id
            })

            if (!savedUsers[user.id]) savedUsers[user.id] = user
            savedUsers[user.id].currentTour = tour.id

            tours.doc(tour.id).update({
                started: FieldValue.increment(1)
            })

            log({
                user: +user.id,
                tours: tour.id,
                text: `${uname(user,user.id)} начинает экскурсию ${tour.name}`
            })

            if (tour.voice) {
                sendMessage2({
                    chat_id: user.id,
                    voice: tour.voice
                }, `sendVoice`, token)
            } else {
                devlog(`аудио нет`)
            }

            toursSteps
                .where(`tour`, '==', tour.id)
                // .orderBy(`index`,`asc`)
                // .limit(1)
                .get()
                .then(col => {
                    sendStep(handleQuery(col).sort((a, b) => a.index - b.index)[0], user.id)
                })

        })
    })

    if (res) res.sendStatus(200)
}

function sendStep(step, userId) {
    getDoc(landMarks, step.landmark).then(l => {
        sendMessage2({
            chat_id: userId,
            text: botText(`stepTransitionText`, `Держим курс на {name}. Сейчас я пришлю точку на карте.`, { name: l.name })
        }, false, token, messages).then(() => {
            sendMessage2({
                chat_id: userId,
                latitude: l.lat,
                longitude: l.lng
            }, `sendLocation`, token)
        })

    })

}

function sendTours(uid) {
    tours
        .where(`active`, '==', true)
        .get()
        .then(col => {
            if (!col.docs.length) return sendMessage2({
                chat_id: uid,
                text: botText(`noToursText`, `Боюсь, нам сейчас нечего вам показать (но мы исправимся и напишем об этом).`)
            }, false, token, messages)

            sendMessage2({
                chat_id: uid,
                text: `${sudden.fine()}! ` + botText(`toursIntroText`, `Вот, куда мы можем вас отвести:`),
                reply_markup: {
                    inline_keyboard: handleQuery(col).map(t => {
                        return [{
                            text: t.name,
                            callback_data: `tour_${t.id}`
                        }]
                    })
                }
            }, false, token, messages)

        })
}


router.get(`/auth`, (req, res) => {
    res.render(`${host}/auth`)
})

router.post(`/auth`, (req, res) => {

    data_check_string = Object.keys(req.body)
        .filter(key => key !== 'hash')
        .sort()
        .map(key => `${key}=${req.body[key]}`)
        .join('\n')

    devlog(data_check_string)

    const secretKey = createHash('sha256')
        .update(token)
        .digest();

    const hmac = createHmac('sha256', secretKey)
        .update(data_check_string)
        .digest('hex');

    devlog(req.body.hash)
    devlog(hmac)

    if (req.body.hash == hmac) {

        isAdmin(req.body.id.toString())
            .then(s => {

                if (!s) return res.sendStatus(403)

                adminTokens.add({
                    createdAt: new Date(),
                    user: +req.body.id,
                    active: true
                }).then(c => {
                    res.cookie('adminToken', c.id, {
                        maxAge: 24 * 60 * 60 * 1000,
                        signed: true,
                        httpOnly: true,
                    }).sendStatus(200)
                })
            })

        // res.sendStatus(200)
    } else {
        res.sendStatus(403)
    }

})


router.all(`/api/:method/:id`, (req, res) => {
    switch (req.params.method) {
        case `showstarted`: {
            return shows
                .doc(req.params.id)
                .update({
                    played: FieldValue.increment(1)
                })
                .then(() => {
                    res.sendStatus(200)
                })
                .catch(err => {
                    res.status(400).send(err.message)
                })
        }
        default: {
            res.sendStatus(404)
        }
    }
})

router.post('/admin/upload-image', upload.single('pic'), function(req, res) {
  if (!req.signedCookies.adminToken) return res.status(401).send('Вы кто вообще?')
  if (!req.file) return res.status(400).send('no file')
  var collection = req.body.collection
  var id = req.body.id
  if (!collection || !id) return res.status(400).send('collection and id required')

  adminTokens.doc(req.signedCookies.adminToken).get().then(function(doc) {
    if (!doc.exists) return res.sendStatus(403)
    var token = handleDoc(doc)
    getUser(token.user, udb).then(function(admin) {
      if (!admin.admin) return res.sendStatus(403)
      var storagePath = 'media/' + collection + '/' + id + '_{w}.webp'
      uploadImageSizes(req.file.buffer, storagePath).then(function(urls) {
        res.json(urls)
      }).catch(function(err) {
        console.error('upload error', err)
        res.status(500).send(err.message)
      })
    })
  })
})

router.post('/admin/upload-gallery-image', upload.single('pic'), function(req, res) {
  if (!req.signedCookies.adminToken) return res.status(401).send('Вы кто вообще?')
  if (!req.file) return res.status(400).send('no file')
  var collection = req.body.collection
  var id = req.body.id
  if (!collection || !id) return res.status(400).send('collection and id required')

  adminTokens.doc(req.signedCookies.adminToken).get().then(function(doc) {
    if (!doc.exists) return res.sendStatus(403)
    var token = handleDoc(doc)
    getUser(token.user, udb).then(function(admin) {
      if (!admin.admin) return res.sendStatus(403)
      var docRef = images.doc()
      var storagePath = 'media/' + collection + '/' + docRef.id + '_{w}.webp'
      uploadImageSizes(req.file.buffer, storagePath).then(function(urls) {
        var data = {
          ownerType: collection,
          ownerId: id,
          w400: urls.w400,
          w800: urls.w800,
          w1400: urls.w1400,
          createdAt: new Date(),
          createdBy: +admin.id
        }
        return docRef.set(data).then(function() {
          var item = { id: docRef.id, w400: data.w400, w800: data.w800, w1400: data.w1400 }
          if (collection === 'landmarks') {
            if (!savedLandmarkImages[id]) savedLandmarkImages[id] = []
            savedLandmarkImages[id].push(item)
          }
          res.json(item)
        })
      }).catch(function(err) {
        console.error('gallery upload error', err)
        res.status(500).send(err.message)
      })
    })
  })
})

router.get('/admin/gallery-images/:collection/:id', function(req, res) {
  if (!req.signedCookies.adminToken) return res.status(401).send('Вы кто вообще?')
  adminTokens.doc(req.signedCookies.adminToken).get().then(function(doc) {
    if (!doc.exists) return res.sendStatus(403)
    var token = handleDoc(doc)
    getUser(token.user, udb).then(function(admin) {
      if (!admin.admin) return res.sendStatus(403)
      images
        .where('ownerType', '==', req.params.collection)
        .where('ownerId', '==', req.params.id)
        .get()
        .then(function(col) {
          var list = handleQuery(col).sort(function(a, b) {
            return a.createdAt._seconds - b.createdAt._seconds
          })
          res.json(list.map(function(l) {
            return { id: l.id, w400: l.w400, w800: l.w800, w1400: l.w1400 }
          }))
        })
        .catch(function(err) {
          console.error('gallery list error', err)
          res.status(500).send(err.message)
        })
    })
  })
})

router.delete('/admin/gallery-image/:imageId', function(req, res) {
  if (!req.signedCookies.adminToken) return res.status(401).send('Вы кто вообще?')
  adminTokens.doc(req.signedCookies.adminToken).get().then(function(doc) {
    if (!doc.exists) return res.sendStatus(403)
    var token = handleDoc(doc)
    getUser(token.user, udb).then(function(admin) {
      if (!admin.admin) return res.sendStatus(403)
      var ref = images.doc(req.params.imageId)
      ref.get().then(function(doc2) {
        if (!doc2.exists) return res.sendStatus(404)
        var data = handleDoc(doc2)
        bucket.deleteFiles({ prefix: 'media/' + data.ownerType + '/' + data.id + '_' }).catch(function(err) {
          console.error('gallery gcs cleanup error', err)
        }).then(function() {
          return ref.delete()
        }).then(function() {
          if (data.ownerType === 'landmarks' && savedLandmarkImages[data.ownerId]) {
            savedLandmarkImages[data.ownerId] = savedLandmarkImages[data.ownerId].filter(function(i) {
              return i.id !== data.id
            })
          }
          res.json({ success: true })
        })
      })
    })
  })
})

router.get(`/admin/botStatus`, (req, res) => {
    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {
        if (!doc.exists) return res.sendStatus(403)
        let adminTokenRecord = handleDoc(doc)
        getUser(adminTokenRecord.user, udb).then(admin => {
            if (!admin.admin) return res.sendStatus(403)
            Promise.all([
                axios.get(`https://api.telegram.org/bot${token}/getWebhookInfo`),
                axios.get(`https://api.telegram.org/bot${token}/getMe`)
            ]).then(results => {
                let wh = results[0].data.result
                let me = results[1].data.result
                res.json({
                    username: me.username,
                    webhookUrl: wh.url,
                    pendingUpdateCount: wh.pending_update_count,
                    lastErrorMessage: wh.last_error_message || null,
                    lastErrorDate: wh.last_error_date ? new Date(wh.last_error_date * 1000).toISOString() : null,
                    environment: process.env.develop == `true` ? `TEST` : `PROD`
                })
            }).catch(err => {
                console.error(`[botStatus]`, err.message)
                res.status(502).json({ error: `unavailable` })
            })
        })
    })
})

router.all(`/admin/:method/:id`, (req, res) => {
    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {

        if (!doc.exists) return res.sendStatus(403)

        let token = handleDoc(doc)

        getUser(token.user, udb).then(admin => {

            if (!admin.admin) return res.sendStatus(403)

            switch (req.params.method) {
                case `logs`: {
                    devlog(`Запрос логов`)
                    let q = req.params.id.split('_')

                    return logs
                        .where(q[0], '==', Number(q[1]) ? +q[1] : q[1])
                        .get()
                        .then(col => {
                            res.json(handleQuery(col, true))
                        })
                }

                default: {

                    if (!datatypes[req.params.method]) return res.sendStatus(404)

                    let ref = datatypes[req.params.method].col.doc(req.params.id)

                    if (req.method == `GET`) return ref.get().then(d => {
                        d.exists ? res.json(handleDoc(d)) : res.sendStatus(404)
                    })
                    if (req.method == `PUT`) return updateEntity(req, res, ref, admin)
                    if (req.method == `DELETE`) return deleteEntity(req, res, ref, admin)
                    return res.sendStatus(404)
                }
            }
        })

    })
})

router.all(`/admin/:method`, upload.any(), (req, res) => {

    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)

    adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {

        if (!doc.exists) return res.sendStatus(403)

        let token = handleDoc(doc)

        getUser(token.user, udb).then(admin => {

            if (!admin.admin) return res.sendStatus(403)

            switch (req.params.method) {

                case `shows`: {
                    let q = shows;
                    if (req.query.program) q = q.where(`program`, '==', req.query.program)
                    return q.get().then(col => res.json(handleQuery(col, true)))
                }

                case `usersLandMarks`: {
                    if (req.method == `GET`) return usersLandmarks.where(`landmark`, '==', req.query.landmark).get().then(col => res.json(handleQuery(col, true)))
                }
                case `toursSteps`: {
                    if (req.method == `GET`) {
                        let q = toursSteps;
                        if (req.query.tour) q = q.where(`tour`, '==', req.query.tour);
                        return q.get().then(col => res.json(handleQuery(col, true)));
                    }
                    if (req.method == `POST`) return datatypes[req.params.method].newDoc(req, res, admin, datatypes[req.params.method].extras)
                    return res.sendStatus(404)
                }
                case `messages`: {
                    if (req.method == `GET`) {
                        let q = messages;
                        if (req.query.user) q = q.where(`user`, '==', +req.query.user);
                        return q.orderBy(`createdAt`, `desc`).limit(100).get().then(col => res.json(handleQuery(col, true)));
                    }
                    if (req.method == `POST`) return datatypes[req.params.method] ? datatypes[req.params.method].newDoc(req, res, admin) : res.sendStatus(404)
                    return res.sendStatus(404)
                }
                default: {
                    if (!datatypes[req.params.method]) return res.sendStatus(404)
                    if (req.method == `GET`) return datatypes[req.params.method].col.get().then(col => res.json(handleQuery(col, true)))
                    if (req.method == `POST`) return datatypes[req.params.method].newDoc(req, res, admin, datatypes[req.params.method].extras)
                    return res.sendStatus(404)
                }
            }
        })
    })
})

function updateEntity(req, res, ref, admin) {
    ref.update({
        [req.body.attr]: req.body.value || null,
        updatedAt: new Date(),
        updatedBy: +admin.id
    }).then(s => {
        res.json({
            success: true
        })
        if (req.params.method.toLowerCase() == `landmarks`) {
            getDoc(landMarks, req.params.id).then(l => {
                savedLandmarks[l.id] = l;
            })
        }
        if (req.params.method.toLowerCase() == `settings`) {
            getDoc(settings, req.params.id).then(s => {
                savedSettings = s;
            })
        }
        log({
            admin: +admin.id,
            [req.params.method]: req.params.id,
            text: `Обновлен ${req.params.method} / ${req.params.id}.\n${req.body.attr} стало ${req.body.value}`
        })
    })
}


function newCity(req, res, admin) {
    
    if (!req.body.name) return res.status(400).send(`no name`)

    cities.doc(req.body.slug).get().then(s => {

        if (s.exists) return res.status(400).send(`слаг уже занят`)

        cities.doc(req.body.slug).set({
            createdAt: new Date(),
            createdBy: +admin.id,
            active: true,
            description: req.body.description || null,
            name: req.body.name || null,
            pic: req.body.pic || null,
            lat: req.body.lat ? +req.body.lat : null,
            lng: req.body.lng ? +req.body.lng : null,
        }).then(rec => {
            res.redirect(`/${host}/web?page=cities_${rec.id}`)
            log({
                admin: +admin.id,
                cities: req.body.slug,
                text: `${uname(admin,admin.id)} создает город ${req.body.name}`
            })
        })

    })
}



function newTour(req, res, admin) {
    if (!req.body.name) return res.status(400).send(`no name`)
    tours.add({
        createdAt: new Date(),
        createdBy: +admin.id,
        active: true,
        city: req.body.city || null,
        description: req.body.description || null,
        name: req.body.name || null,
        pic: req.body.pic || null,
        voice: req.body.voice || null
    }).then(rec => {
        res.redirect(`/${host}/web?page=tours_${rec.id}`)
        log({
            admin: +admin.id,
            tours: rec.id,
            text: `${uname(admin,admin.id)} создает экскурсию ${req.body.name}`
        })
    })
}


function newTourStep(req, res, admin) {
    if (!req.body.tour) return res.status(400).send(`no tour`)
    if (!req.body.landmark) return res.status(400).send(`no step`)

    getDoc(tours, req.body.tour).then(t => {
        if (!t) return res.sendStatus(404)
        if (!t.active) return res.status(400).send(`Этот тур деактивирован`)
        getDoc(landMarks, req.body.landmark).then(s => {
            if (!s) return res.sendStatus(404)
            if (!s.active) return res.status(400).send(`Этот шаг деактивирован`)
            toursSteps
                .where(`tour`, '==', req.body.tour)
                .where(`active`, '==', true)
                .get()
                .then(col => {
                    let before = handleQuery(col).map(s => s.landmark)
                    if (before.indexOf(req.body.landmark) > -1) return res.status(400).send(`Эта точка уже добавлена в маршрут`)
                    toursSteps.add({
                        active: true,
                        tour: req.body.tour,
                        landmark: req.body.landmark,
                        landmarkName: s.name,
                        admin: +admin.id,
                        createdAt: new Date(),
                        index: col.docs.length + 1
                    }).then(rec => {
                        res.redirect(`/${host}/web?page=tours_${req.body.tour}`)
                        log({
                            silent: true,
                            admin: +admin.id,
                            tours: req.body.tour,
                            toursSteps: rec.id,
                            text: `${uname(admin,admin.id)} добавляет точку ${s.name} к маршруту ${t.name}`
                        })
                        tours.doc(req.body.tour).update({
                            steps: FieldValue.increment(1)
                        })
                    })
                })
        })
    })
}

function newLandMark(req, res, admin) {
    if (!req.body.name) return res.status(400).send(`no name`)
    if (!req.body.lat) return res.status(400).send(`no lat`)
    if (!req.body.lng) return res.status(400).send(`no lng`)

    landMarks.add({
        createdAt: new Date(),
        createdBy: +admin.id,
        active: true,
        city: req.body.city || null,
        description: req.body.description || null,
        name: req.body.name || null,
        pic: req.body.pic || null,
        greetings: req.body.greetings || null,
        goodbyes: req.body.goodbyes || null,
        lat: req.body.lat || null,
        lng: req.body.lng || null,
        voice: req.body.voice || null
    }).then(rec => {

        res.redirect(`/${host}/web?page=landmarks_${rec.id}`)

        getDoc(landMarks, rec.id).then(l => {
            savedLandmarks[rec.id] = l
        })

        // updateLandMark(rec.id)

        log({
            admin: +admin.id,
            landmarks: rec.id,
            text: `${uname(admin,admin.id)} создает точку ${req.body.name}`
        })
    })
}

function newSection(req, res, admin) {
    if (!req.body.slug) return res.status(400).send(`no slug`)
    if (!req.body.name) return res.status(400).send(`no name`)

    sections.doc(req.body.slug).get().then(s => {

        if (s.exists) return res.status(400).send(`слаг уже занят`)

        sections.doc(req.body.slug.toString()).set({
            createdAt: new Date(),
            createdBy: +admin.id,
            active: true,
            slug: req.body.slug,
            id: req.body.slug,
            name: req.body.name || null,
            description: req.body.description || null,
            html: req.body.html || null
        }).then(rec => {
            res.redirect(`/${host}/web?page=sections_${req.body.slug}`)
            log({
                admin: +admin.id,
                text: `${uname(admin,admin.id)} создает раздел ${req.body.name}`
            })
        })
    })
}


function newPage(req, res, admin) {

    if (!req.body.slug) return res.status(400).send(`no slug`)
    if (!req.body.name) return res.status(400).send(`no name`)

    pages.doc(req.body.slug).get().then(s => {

        if (s.exists) return res.status(400).send(`слаг уже занят`)

        pages.doc(req.body.slug.toString()).set({
            createdAt: new Date(),
            createdBy: +admin.id,
            active: true,
            slug: req.body.slug,
            id: req.body.slug,
            name: req.body.name || null,
            description: req.body.description || null,
            html: req.body.html || null
        }).then(rec => {
            res.redirect(`/${host}/web?page=pages_${req.body.slug}`)
            log({
                admin: +admin.id,
                text: `${uname(admin,admin.id)} создает страницу ${req.body.name}`
            })
        })
    })
}

function newTag(req, res, admin) {

    if (!req.body.slug) return res.status(400).send(`no slug`)
    if (!req.body.name) return res.status(400).send(`no name`)

    tags.doc(req.body.slug).get().then(s => {

        if (s.exists) return res.status(400).send(`слаг уже занят`)

        tags.doc(req.body.slug.toString()).set({
            createdAt: new Date(),
            createdBy: +admin.id,
            active: true,
            slug: req.body.slug,
            id: req.body.slug,
            name: req.body.name || null,
            description: req.body.description || null,
            html: req.body.html || null
        }).then(rec => {
            res.redirect(`/${host}/web?tags=pages_${req.body.slug}`)
            log({
                admin: +admin.id,
                text: `${uname(admin,admin.id)} создает тег ${req.body.name}`
            })
        })
    })
}


function alertAdmins(mess) {
    let message = {
        text: mess.text
    }
    if (mess.type == 'newUser') {
        message.reply_markup = {
            inline_keyboard: [
                [{
                    text: 'Заблокировать',
                    callback_data: `user_block_${mess.user_id}`
                }],
                [{
                    text: `Сделать сотрудником`,
                    callback_data: `user_insider_${mess.user_id}`
                }],
                [{
                    text: `Сделать админом`,
                    callback_data: `user_admin_${mess.user_id}`
                }]
            ]
        }
    } else if (mess.type == 'logRecord') {
        message.reply_markup = {
            inline_keyboard: [
                [{
                    text: 'Отписаться от уведомлений',
                    callback_data: `admin_log_unsubscribe`
                }]
            ]
        }
    }

    udb.where(`admin`, '==', true).get().then(admins => {
        admins.docs.forEach(a => {
            message.chat_id = a.id
            if (mess.type != 'stopLog' || !a.data().stopLog) {

                if (!process.env.develop || a.id == dimazvali) sendMessage2(message, false, token)
            }
        })
    })
}

function newPage(req, res, admin) {

    if (!req.body.slug) return res.status(400).send(`no slug`)
    if (!req.body.name) return res.status(400).send(`no name`)

    pages.where(`slug`, '==', req.body.slug).get().then(col => {
        if (col.docs.length) return res.status(400).send(`слаг уже занят`)

        pages.doc(req.body.slug.toString()).set({
            createdAt: new Date(),
            createdBy: +admin.id,
            active: true,
            slug: req.body.slug,
            id: req.body.slug,
            name: req.body.name || null,
            description: req.body.description || null,
            html: req.body.html || null
        }).then(rec => {
            res.redirect(`/${host}/web?page=pages_${rec.id}`)
            log({
                admin: +admin.id,
                text: `${uname(admin,admin.id)} создает страницу ${req.body.name}`
            })
        })

    })


}

function registerUser(u) {
    u.createdAt = new Date();
    u.active = true;
    u.blocked = false;
    udb.doc(u.id.toString()).set(u).then(rec => {
        sendMessage2({
            chat_id: u.id,
            text: botText(`welcomeText`, `Добро пожаловать. Напишите, пожалуйста, чем могу быть полезен?..`)
        }, false, token, messages)
        log({
            user: +u.id,
            text: `Новый пользователь: ${uname(u,u.id)}`
        })
    })
}


function log(o) {

    o.createdAt = new Date();

    logs.add(o).then(r => {

        if (!o.silent) {
            alertAdmins({
                text: o.text,
            })
        }

    })
}


router.get(`/web`, (req, res) => {
    if (process.env.develop == `true`) return logs
        .orderBy(`createdAt`, 'desc')
        .limit(100)
        .get()
        .then(col => {
            res.cookie('adminToken', process.env.adminToken, {
                maxAge: 24 * 60 * 60 * 1000,
                signed: true,
                httpOnly: true,
            }).render(`${host}/web`, {
                wysykey: process.env.wysykey,
                start: req.query.page,
                logs: handleQuery(col),
                // token: req.signedCookies.adminToken
            })
        })

    if (!req.signedCookies.adminToken) return res.redirect(`${process.env.ngrok}/auth`)

    adminTokens
        .doc(req.signedCookies.adminToken)
        .get()
        .then(data => {
            if (!data.exists) return res.sendStatus(403)

            if (data.data().active) {
                logs
                    .orderBy(`createdAt`, 'desc')
                    .limit(100)
                    .get()
                    .then(col => {
                        res.render(`${host}/web`, {
                            wysykey: process.env.wysykey,
                            logs: handleQuery(col),
                            // token: req.signedCookies.adminToken
                        })
                    })


            }
        })
})


router.get(`/`, (req, res) => {
    res.render(`${host}/home`)
})


router.get(`/neva`, (req, res) => {
    programs
        .where(`active`, '==', true)
        .get()
        .then(col => {
            res.render(`${host}/neva`, {
                programs: handleQuery(col, false, true)
            })
        })
})

router.get(`/neva/:program`, (req, res) => {
    programs
        .doc(req.params.program)
        .get()
        .then(p => {

            if (!p.exists) return res.sendStatus(404)
            p = handleDoc(p)
            shows
                .where(`program`, '==', req.params.program)
                .where(`active`, '==', true)
                .get()
                .then(col => {
                    res.render(`${host}/program`, {
                        name: `${p.name} | Радио Нева FM | dimazvali.com`,
                        description: `Временный архив передачи ${p.name}.`,
                        program: p,
                        shows: handleQuery(col, true)
                    })  
                })
        })

})


router.post(`/tgStats`,(req,res)=>{
    
    devlog(JSON.stringify(req.body));

    res.send(`TGSTAT_VERIFY_CODE_48410463`)
    
    tgStat.add(req.body).then(rec=>{
        axios.post(`https://script.google.com/macros/s/AKfycbzH0XoahcMjrhdn3gHnEGbnZJgYrmatkf1iPCwW7dZ9aiHISpCRnsWJli8wwQWJuFaP6Q/exec`,req.body)
        .then(s=>{
            tgStat.doc(rec.id).update({
                parsed: true
            })
        }).catch(err=>{
            console.log(err)
        })

        // ifBefore(tgStat,{text: req.body.text}).then(b=>{
        //     if(!b || !b.length){
        //         axios
                
        //     }
        // })

        
    })

    
    
})


router.get(`/robots.txt`, (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send('User-agent: *\nAllow: /\n');
})

router.use(express.static(path.join(__dirname, '../public')))

router.get(`/:page`, (req, res) => {
    let ref = pages.doc(req.params.page);
    ref.get().then(p => {
        if (!p.exists) return res.sendStatus(404)
        views.add({
            page: req.params.page,
            createdAt: new Date(),
        })
        ref.update({
            views: FieldValue.increment(1)
        })
        res.render(`${host}/page`, p.data())
    })
})

sendMessage2({
    chat_id: dimazvali,
    text: `reboot ${process.env.develop ? `TEST` : `PROD`}`
}, false, token)


// var data = JSON.parse(fs.readFileSync('done1716899941314.json', 'utf8'));

// let final = data
//     .filter(t=>t[6]+t[7]+t[8])
//     .map(line => line.join('||'))
//     .join('\n')

//     fs.writeFile(`done` + Number(new Date()) + ".txt", final, function (err) {

//         if (err) {
//             return console.log(err);
//         }
//         console.log("The file was saved!");
//     });


function parseUk() {

    console.log(`поехали`);

    function objectify(array, key) {
        let o = {};
        array.filter(i => i.hasOwnProperty(key)).forEach(i => {
            o[i[key]] = i
        })

        return o;
    }

    let vocabularues = [];

    vocabularues.push(axios.get(`https://api.uktradeinfo.com/sitc`).then(r => r.data))
    vocabularues.push(axios.get(`https://api.uktradeinfo.com/country`).then(r => r.data))
    vocabularues.push(axios.get(`https://api.uktradeinfo.com/FlowType`).then(r => r.data))

    let data = [];

    function upload(url, codes, countries, flowTypes) {
        console.log(`Загружаем ${url}`)
        axios.get(url).then(r => {

            fs.writeFile(`raw` + Number(new Date()) + ".json", JSON.stringify(r.data.value), function (err) {

                if (err) {
                    return console.log(err);
                }
                console.log("The file was saved!");
            });

            data = data.concat(r.data.value)

            if (r.data[`@odata.nextLink`]) {

                console.log(`переходим к ${r.data[`@odata.nextLink`]}`)

                upload(r.data[`@odata.nextLink`], codes, countries, flowTypes)
            } else {
                console.log(`загрузили полностью`)
                convert(data, codes, countries, flowTypes)
            }
        })
    }

    function convert(data, codes, countries, flowTypes) {

        console.log(data.length);

        let final = []

        let uniqueCodes = [...new Set(data.map(r => r.CommoditySitcId))];

        uniqueCodes.forEach(id => {

            let dataset = data.filter(r => r.CommoditySitcId == id)
            let countriesUnique = [...new Set(dataset.map(r => r.CountryId))]

            countriesUnique.forEach(countryId => {
                let countryDataSet = dataset.filter(r => r.CountryId == countryId);
                let portsUnique = [...new Set(countryDataSet.map(c => c.PortId))]

                portsUnique.forEach(portId => {

                    let portData = countryDataSet.filter(r => r.PortId == portId);
                    let flowTypesUnique = [...new Set(portData.map(r => r.FlowTypeId))]
                    flowTypesUnique.forEach(type => {
                        let flowTypeData = portData.filter(r => r.FlowTypeId == type);
                        final.push([
                            id,
                            codes[id] ? codes[id].SitcDesc : 'unknown code',
                            countries[countryId]['Area1a'] == 'European Union' ? 'EU' : 'NON EU',
                            countries[countryId]['Area1a'].trim(),
                            countries[countryId]['CountryName'].trim(),
                            portId,
                            flowTypeData.reduce((a, b) => a + (b.value || 0), 0),
                            flowTypeData.reduce((a, b) => a + (b.NetMass || 0), 0),
                            flowTypeData.reduce((a, b) => a + (b.SuppUnit || 0), 0),
                            flowTypes[type].FlowTypeDescription.trim(),
                            2015,
                            'December'
                        ])
                    })
                })
            })
        })

        console.log(`done`)

        fs.writeFile(`doneSep` + Number(new Date()) + ".txt", final.filter(t => t[6] + t[7] + t[8]).map(line => line.join('|')).join('\n'), function (err) {

            if (err) {
                return console.log(err);
            }
            console.log("The file was saved!");
        });
    }

    Promise.all(vocabularues).then(vocabularues => {

        console.log(`загрузили справочники`)

        let codes = objectify(vocabularues[0].value, `CommoditySitcId`)
        let countries = objectify(vocabularues[1].value, `CountryId`)
        let flowTypes = objectify(vocabularues[2].value, `FlowTypeId`)

        upload(`https://api.uktradeinfo.com/ots?$filter=MonthId%20eq%20201512%20and%20(FlowTypeId%20eq%203%20or%20FlowTypeId%20eq%201)`, codes, countries, flowTypes)

    })

}

// parseUk()


function parseRaw(){
    let data = [];
    let i = 1;
    while (i<6){
        let d = JSON.parse(fs.readFileSync(`raw${i}.json`,`utf8`))
        data = data.concat(d)
        i++
    }
    console.log(data.length)

    let vocabularues = [];

    vocabularues.push(axios.get(`https://api.uktradeinfo.com/sitc`).then(r => r.data))
    vocabularues.push(axios.get(`https://api.uktradeinfo.com/country`).then(r => r.data))
    
    function objectify(array, key) {
        let o = {};
        array.filter(i => i.hasOwnProperty(key)).forEach(i => {
            o[i[key]] = i
        })

        return o;
    }

    Promise.all(vocabularues).then(v=>{
        let codes = objectify(v[0].value, `CommoditySitcId`)
        let countries = objectify(v[1].value, `CountryId`)

        let r = {};
        
        data.forEach(line=>{
            if(!r[line.CommoditySitcId]) r[line.CommoditySitcId] ={}
            if(!r[line.CommoditySitcId][line.CountryId]) r[line.CommoditySitcId][line.CountryId] = {};
            if(!r[line.CommoditySitcId][line.CountryId][line.PortId]) r[line.CommoditySitcId][line.CountryId][line.PortId] = 0;

            r[line.CommoditySitcId][line.CountryId][line.PortId] ++
        })

        Object.keys(r).forEach(code=>{
            Object.keys(r[code]).forEach(country=>{
                Object.keys(r[code][country]).forEach(port=>{
                    if(r[code][country][port]>1){
                        console.log(
                            (codes[code] ? codes[code].SitcDesc : 'unknown code'),
                            countries[country]['CountryName'].trim(),
                            port,
                            `${r[code][country][port]} запись`
                        )
                    }
                })
                
            })
        })

    })
    
}



// parseRaw()

module.exports = router;