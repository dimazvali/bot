const ngrok2 = process.env.ngrok2;
const ngrok = process.env.ngrok;
const host = `dimazvali`
const token = process.env.dimazvaliToken;
var express = require('express');
var router = express.Router();
var axios = require('axios');
var cors = require('cors')
var fs = require('fs');


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

// s.bucket(`dimazvalimisc`)
//     .upload(__dirname + `/../public/sounds/123.mp3`)
//     .then(s=>{
//         console.log(s)
//     })
//     .catch(err=>{
//         console.log(err)
//     })

setTimeout(function () {
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/dimazvali/hook`).then(() => {
        console.log(`dimazvali hook set on ${ngrok}`)
    }).catch(handleError)
}, 1000)


let adminTokens = fb.collection('DIMAZVALIadminTokens');
let pages = fb.collection('DIMAZVALIpages');
let sections = fb.collection('DIMAZVALIsections');
let views = fb.collection(`DIMAZVALIviews`);
let logs = fb.collection(`DIMAZVALIlogs`);
let udb = fb.collection(`DIMAZVALIusers`);
let settings = fb.collection(`DIMAZVALIsettings`);
let tags = fb.collection(`DIMAZVALItags`);
let landMarks = fb.collection(`DIMAZVALIlandMarks`);
let tours = fb.collection(`DIMAZVALItours`);
let toursSteps = fb.collection(`DIMAZVALItoursSteps`);
let messages = fb.collection(`DIMAZVALImessage`);
let usersTours = fb.collection(`DIMAZVALIusersTours`);
let usersLandmarks = fb.collection(`DIMAZVALIusersLandmarks`);
let cities = fb.collection(`DIMAZVALIcities`);

let authors = fb.collection(`NEVAauthors`);
let programs = fb.collection(`NEVAprograms`);
let shows = fb.collection(`NEVAshows`);

let tgStat= fb.collection(`tgStats`);

let savedLandmarks = {};
let savedSteps = {};
let savedUsers = {};


landMarks.get().then(col => {
    handleQuery(col).forEach(l => {
        savedLandmarks[l.id] = l
    })
})

toursSteps.get().then(col => {
    handleQuery(col).forEach(l => {
        savedSteps[l.id] = l
    })
})

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
    return +(Math.sqrt(Math.pow((lat - toLat) * 111.11, 2) + Math.pow((long - toLong) * 55.8, 2))).toFixed(3)
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

        if (loc.horizontal_accuracy < 30) {

            Object.keys(savedLandmarks).forEach(key => {

                let place = savedLandmarks[key];

                let distance = dist(loc.latitude, loc.longitude, +place.lat, +place.lng) * 1000

                try {
                    if (distance - loc.horizontal_accuracy < (place.proximity || 50)) {

                        devlog(`пользователь прибыл в точку ${place.name}`)

                        if (!alertedUsers[userId][place.id]) {

                            let m = {
                                chat_id: userId,
                                parse_mode: `Markdown`,
                                text: `*${place.name}*\n${place.greetings||place.description}`
                            }

                            if (place.pic) {
                                m.caption = m.text
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

                            sendMessage2(m, m.pic ? 'sendPhoto' : false, token, messages).then(() => {
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
                                        if ((curIndex + 1) <= index.length) {

                                            // sendStep(savedLandmarks[index[curIndex+1]],userId)
                                            sendStep(savedSteps[route[curIndex + 1]], userId)
                                            // getDoc(landMarks,index[]).then(l=>{

                                            // })
                                        } else {
                                            sendMessage2({
                                                chat_id: userId,
                                                text: `Это последняя точка маршрута. Спасибо, что были с нами. Не прощаемся.`
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

    if (req.body.message) {

        user = req.body.message.from

        // udb.doc(user.id.toString()).get().then(u => {

        //     if (!u.exists) registerUser(user)

        //     u = handleDoc(u);

        //     if(req.body.message.text){
        //         let txt = req.body.message.text;
        //         if(!txt.indexOf(`/tours`)) sendTours(u.id)
        //         // if(!txt.indexOf(`/near`)) sendTours(u.id)

        //     }



        //     if(req.body.message.voice && u.admin){
        //         // devlog(`Это голосовое`)
        //         sendMessage2({
        //             chat_id: u.id,
        //             parse_mode: `Markdown`,
        //             text: '```'+req.body.message.voice.file_id+'```'
        //         },false,token,messages).then(d=>console.log(d))
        //     }

        //     if(req.body.message.text){
        //         if(!req.body.message.text.indexOf(`/start`)){
        //             let inc = req.body.message.text.split(' ')
        //             if(inc[1]){
        //                 let attr = inc[1].split('_');
        //                 if(attr[0] == `tour`){
        //                     getDoc(tours,attr[1]).then(t=>{
        //                         if(t && t.active){
        //                             sendTour(user, t)
        //                         }
        //                     })
        //                 }
        //             }
        //         }
        //     }
        // })
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
    if (tour.pic) {
        m.caption = m.text;
        m.photo = tour.pic;
    }
    sendMessage2(m, tour.pic ? `sendPhoto` : false, token, messages)

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
            text: `Держим курс на ${l.name}. Сейчас я пришлю точку на карте.`
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
                text: `Боюсь, нам сейчас нечего вам показать (но мы исправимся и напишем об этом).`
            }, false, token, messages)

            sendMessage2({
                chat_id: uid,
                text: `${sudden.fine()}! Вот, куда мы можем вас отвести:`,
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

router.all(`/admin/:method`, (req, res) => {

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
                case `about`: {
                    if (req.method == `GET`) return settings.doc(`about`).get().then(d => res.json(handleDoc(d, true)))
                    if (req.method == `PUT`) return updateEntity(req, res, settings.doc(`about`), admin)
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
            // voice:          req.body.voice || null
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
            text: `Добро пожаловать. Напишите, пожалуйста, чем могу быть полезен?..`
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
    getDoc(settings, `start`).then(about => {
        devlog(about)
        pages
            .where(`active`, '==', true)
            .get()
            .then(col => {
                about.pages = handleQuery(col, true)
                res.render(`${host}/start`,
                    about
                )
            })
    })
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


router.post(`/tgStatsg`,(req,res)=>{
    
    devlog(JSON.stringify(req.body));

    res.send(`TGSTAT_VERIFY_CODE_48410463`)
    
    tgStat.add(req.body).then(rec=>{
        axios
        .post(`https://script.google.com/macros/s/AKfycbzH0XoahcMjrhdn3gHnEGbnZJgYrmatkf1iPCwW7dZ9aiHISpCRnsWJli8wwQWJuFaP6Q/exec`,req.body)
        .then(s=>{
            
            devlog(s.data)
            
            tgStat.doc(rec.id).update({
                parsed: true
            })

            
        })
    })

    
    
})


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