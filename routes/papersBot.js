var express =   require('express');
var router =    express.Router();
var axios =     require('axios');
var cors =      require('cors')
var sha256 =    require('sha256');
var common =    require('./common');
const m =       require('./methods.js');
var QRCode =    require('qrcode')
var cron =      require('node-cron');
var FormData =  require('form-data');
var modals =    require('./modals.js').modals
const qs =      require('qs');
var uname =     require('./common').uname;
var drawDate =  require('./common').drawDate;
const { createHash,createHmac } = require('node:crypto');
const devlog = require(`./common`).devlog

const {
    Parser
} = require('json2csv');

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
    getDatabase
} = require('firebase-admin/database');
const {
    text,
    query,
    json
} = require('express');
const {
    factchecktools_v1alpha1
} = require('googleapis');
const {
    sendAt
} = require('cron');
const { ObjectStreamToJSON } = require('sitemap');



let gcp = initializeApp({
    credential: cert({
        "type": "service_account",
        "project_id": "paperstuff-620fa",
        "private_key_id": "c01abf8b7c2531fe0e33fae7955c1b3978ba8dc3",
        "private_key": process.env.paperGCPkey.replace(/\\n/g, '\n'),
        "client_email": "firebase-adminsdk-g7u75@paperstuff-620fa.iam.gserviceaccount.com",
        "client_id": "117123513251467365122",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-g7u75%40paperstuff-620fa.iam.gserviceaccount.com"
    }),
    databaseURL: "https://rrspecialsapi.firebaseio.com"
}, 'paper');

let fb = getFirestore(gcp);


let token =         process.env.papersToken
let paymentToken =  process.env.papersPaymentToken

let ngrok = process.env.ngrok

let sheet = process.env.papersSheet

// setTimeout(function(){
//     axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/paper/hook`).then(()=>{
//         console.log(`papers hook set on ${ngrok}`)
//     }).catch(handleError)   
// },1000)


let rules = {
    "ru": [],
    "en": []
}

// axios.get(`https://script.googleusercontent.com/macros/echo?user_content_key=8ueAKyluy0wuRZ4gK-jYG1wliibQFso2esjvTmXknHNccnnqWbx9WR87tyn_8NGCexpTF-qyb44z3NK84Pr7U1g6MxN26kZ1m5_BxDlH2jW0nuo2oDemN9CCS2h10ox_1xSncGQajx_ryfhECjZEnFu2t8qra_k6h-c-IrXBLuGe4Knck_n4W9ZqXPr5xbqRychS1TFgEQNGcQZg4Ud1WotKUAj2b7nNRcVf8Rejry2ONuo323X-2Un_HSoeWndfjC_srxjkgLU&lib=MMewcMQsLAdLM797F3opR7PSxH8z8Wjql`).then(d=>{
//     console.log(d.data)
//     rules = JSON.parse(d.data)
// })

let udb =               fb.collection('users');
let messages =          fb.collection('userMessages');
let admins =            fb.collection('admins');
let halls =             fb.collection(`halls`);
let classes =           fb.collection(`classes`);
let userClasses =       fb.collection(`userClasses`);
let userClassesWL =     fb.collection(`userClassesWL`);
let bookings =          fb.collection(`bookings`);
let coworking =         fb.collection(`coworking`);
let mra =               fb.collection(`meetingRoom`);
let logs =              fb.collection('logs');
let userEntries =       fb.collection('userEntries');
let news =              fb.collection('news');
let eventTypes =        fb.collection('eventTypes');
let coworkingRules =    fb.collection('cooorkingRules');
let tokens =            fb.collection('tokens');
let adminTokens =       fb.collection('adminTokens');
let userTags =          fb.collection('userTags');
let roomsBlocked =      fb.collection('roomsBlocked');
let polls =             fb.collection('polls');
let pollsAnswers =      fb.collection('pollsAnswers')
let plans =             fb.collection(`plans`);
let plansUsers =        fb.collection(`plansUsers`);
let authors =           fb.collection(`authors`);
let userClassesQ =      fb.collection(`userClassesQ`);
let coffee =            fb.collection(`coffee`);
let promos =            fb.collection(`promos`);
let invites =           fb.collection(`invites`);
let plansRequests =     fb.collection(`plansRequests`);
let classesOffers =     fb.collection(`classesOffers`);


coworkingRules.get().then(col => {
    col.docs.forEach(l => {
        rules[l.id] = l.data().rules
    })
})
let eTypes = {}

eventTypes.get().then(col => {
    common.handleQuery(col).forEach(m => {
        eTypes[m.en] = m
    })
})

router.post(`/invite`,(req,res)=>{
    if(!req.body.occupation)        return res.status(400).send(`occupation is missing`)
    if(!req.body.about)             return res.status(400).send(`about is missing`)
    // if(!req.body.plan)             return res.status(400).send(`about is missing`)

    return invites.add({
        createdAt:  new Date(),
        active:     true,
        name:       req.body.name || null,
        occupation: req.body.occupation,
        about:      req.body.about,
        plan:       req.body.plan || null
    }).then(rec=>{
        res.send(`https://t.me/paperstuffbot/app?startapp=invite_${rec.id}`)
    }).catch(err=>{
        res.status(500).send(err.message)
    })
})

router.get('/oauth', (req, res) => {
    if (req.query.code) {

        let data = qs.stringify({
            'client_id': process.env.paperBotId,
            'client_secret': process.env.paperBotSecret,
            'code': req.query.code,
            'redirect_uri': process.env.ngrok + '/paper/oauth',
            'state': 'qwdqwd'
        });

        axios.post(`https://slack.com/api/oauth.v2.access`, data, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }).then(s => {
            tokens.add(s.data)
            res.redirect(`https://app.slack.com/client/${s.data.team.id}/${s.data.incoming_webhook.channel_id}`)
        }).catch(err => {
            console.log(err)
            res.send(err.message)
        })
    }

})

router.post(`/oauth`, (req, res) => {
    console.log(req.body);
    res.json(req.body)
})


router.get(`/web`,(req,res)=>{
    if(process.env.develop == `true`) return logs
        .orderBy(`createdAt`,'desc')
        .limit(100)
        .get()
        .then(col=>{
            res.cookie('adminToken', process.env.adminToken, {
                maxAge: 24 * 60 * 60 * 1000,
                signed: true,
                httpOnly: true,
            }).render(`papers/web`,{
                logs: common.handleQuery(col),
                // token: req.signedCookies.adminToken
            })
        }) 

    if(!req.signedCookies.adminToken) return res.redirect(`${process.env.ngrok}/paper/auth`)
    
    adminTokens
        .doc(req.signedCookies.adminToken)
        .get()
        .then(data=>{
            if(!data.exists) res.sendStatus(403)
            if(data.data().active){
                logs
                    .orderBy(`createdAt`,'desc')
                    .limit(100)
                    .get()
                    .then(col=>{
                        res.render(`papers/web`,{
                            logs: common.handleQuery(col),
                            // token: req.signedCookies.adminToken
                        })
                    })
                

            }
        })
})

router.get(`/auth`,(req,res)=>{
    res.render(`papers/auth`)
})

router.post(`/auth`,(req,res)=>{
    
    console.log(Object.keys(req.body).sort())

    data_check_string=Object.keys(req.body)
        .filter(key => key !== 'hash')
        .sort()
        .map(key=>`${key}=${req.body[key]}`)
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

    if(req.body.hash == hmac){

        isAdmin(req.body.id.toString())
            .then(s=>{
                
                if(!s) return res.sendStatus(403)
                
                adminTokens.add({
                    createdAt:  new Date(),
                    user:       +req.body.id,
                    active: true 
                }).then(c=>{
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

// udb.get().then(col=>{
//     common.handleQuery(col).forEach((d,i)=>{
//         setTimeout(()=>{
//             d.intention = 'newUser'
//             d.createdAt = new Date(d.createdAt._seconds*1000).toISOString()
//             axios.post(sheet, Object.keys(d).map(k => `${k}=${d[k]}`).join('&'), {
//                 headers: {
//                     "Content-Type": "application/x-www-form-urlencoded"
//                 }
//             }).then(d => {
//                 console.log(d.data)
//             }).catch(err => {
//                 console.log(err.message)
//             })
//         },i*1500)

//     })
// })




// udb.get().then(col=>{
//     common.handleQuery(col).filter(u=>u.insider || u.fellow).forEach((u,i)=>{
//         setTimeout(function(){
//             m.sendMessage2({
//                 chat_id: u.id,
//                 photo: `https://cdn1.intermedia.ru/img/news_x400/379053.jpg`,
//                 parse_mode: `HTML`,
//                 disable_notification:true,
//                 caption: `Друзья! Завтра, в 20:00, ждем всех своих на показ «Сказки» Александра Сокурова. Место действия: <s>лимб</s> бар Papers. Вход свободный, бар — как всегда.`
//             },`sendPhoto`,token)
//             devlog(i)
//         },i*200)
//     })
// })


// classes.doc(`6IWjjV0bDcmr6E1nQTJw`).get().then(d=>console.log(JSON.stringify(d.data())))

classes.add({
    "date": "2023-12-25T16:00:00.000Z",
    "author": "Станислав Елисеев, Дмитрий Шестаков",
    "active": true,
    "hall": "BrXsFWF4tE7K36SHQIS6",
    "type": "event",
    "duration": "120",
    "noRegistration": false,
    "createdAt": {
        "_seconds": 1702916655,
        "_nanoseconds": 208000000
    },
    "price": 0,
    "name": "Показ «Сказки» Александра Сокурова",
    "hallName": "Gamotsema bar",
    "admins": false,
    "capacity": 60,
    "updatedBy": "slack_tyapin",
    "description": "Собрались как-то Сталин, Гитлер, Муссолини и Черчилль...",
    "pic": "https://firebasestorage.googleapis.com/v0/b/paperstuff-620fa.appspot.com/o/classes%2Fsokurov.webp?alt=media&token=98499b07-91e3-4a35-b05e-085863f2112f",
    "updatedAt": {
        "_seconds": 1703433292,
        "_nanoseconds": 491000000
    }
}).then(s=>console.log(s.id))



router.get('/app', (req, res) => {
    res.render('papers/app', {
        user:   req.query.id,
        start:  req.query.start || req.query.tgWebAppStartParam,
        translations: translations,
        rules: rules
    })
})


router.get('/admin', (req, res) => {
    res.render('papers/admin', {
        user: req.query.id,
        start: req.query.start,
        translations: translations
    })
})


router.post(`/pourMeWine`, (req, res) => {
    if (!req.query.id) return res.status(401).send(`Вы кто вообще?`)
    udb.doc(req.query.id).get().then(user => {
        if (!user.exists) return res.status(401).send(`Вы кто вообще?`)

        user = user.data();

        if (!user.admin) return res.status(403).send(`Вам сюда нельзя`)

        fb.collection('wineList').add({
            user: req.body.user,
            left: req.body.glasses,
            createdBy: +req.query.id,
            createdAt: new Date()
        }).then(rec => {

            udb.doc(req.body.user.toString()).get().then(gifted => {
                log({
                    text: `Админ @${user.username} наливает гостю ${uname(gifted.data(), gifted.id)} ${req.body.glasses} бокалов вина`,
                    user: req.body.user,
                    admin: +req.query.id
                })
            })

            res.sendStatus(200)

            m.sendMessage2({
                chat_id: req.body.user,
                caption: `Поздравяем! Вы оформили абонемент на вино в Гамоцеме.\n${common.letterize(req.body.glasses,'ходка')} в вашем распоряжении.\nuse it wisely`,
                photo: process.env.ngrok + `/paper/qr?id=${rec.id}&entity=wineList`
            }, 'sendPhoto', token)
        })
    })
})

function alertWithdrawal(user, id, sum, reason) {
    if (sum > 0) sum = sum * -1;
    udb.doc(user.id || id).update({
        deposit: FieldValue.increment(sum)
    }).then(() => {
        log({
            user: user.id || id,
            text: `Со счета пользователя ${uname(user,(user.id||id))} списывается ${common.cur(sum,'GEL')} по статье ${reason}`
        })
    })
}


router.post(`/sendMe/:type`, (req, res) => {
    switch (req.params.type) {
        case 'address': {
            m.sendMessage2({
                chat_id: req.body.user,
                "longitude": 44.78321832242679,
                "latitude": 41.71100813134866,
                "title": "Papers (Hotel Iliani)",
                "address": translations.iliani.en
            }, 'sendVenue', token)
        }
        default: {
            res.sendStatus(404)
        }
    }
})

router.all(`/admin/:method`, (req, res) => {
    if (!req.query.id && !req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    
    if(!req.query.id) req.query.id = adminTokens.doc(req.signedCookies.adminToken).get().then(doc=>{
        if(!doc.exists) return false
        doc = common.handleDoc(doc)
        if(!doc.active) return false
        return doc.user
    })

    Promise.resolve(req.query.id).then(adminId=>{
        if(!adminId) return res.sendStatus(403)
        
        req.query.id = adminId.toString()
        
        devlog(req.query.id)

        udb.doc(req.query.id).get().then(user => {
            if (!user.exists) return res.status(401).send(`Вы кто вообще?`)
            user = user.data();
            if (!(user.admin || user.insider)) return res.status(403).send(`Вам сюда нельзя`)
            switch (req.params.method) {
                case `stats`:{
                    switch(req.query.type){
                        case `cowork`:{
                            let fields = [
                                'date',
                                'visits',
                                'newcomers'
                            ];

                            let opts = {
                                fields
                            };
                
                            const parser = new Parser(opts);

                            return coworking
                            .where(`active`,'==',true)
                            .get()
                            .then(col=>{
                                let data = common.handleQuery(col).sort((a,b)=>a.date>b.date?1:-1)
                                devlog(data.map(r=>r.date))
                                let result = {};
                                let userIndex = [];
                                data.forEach(record=>{
                                    if(!result[record.date]) result[record.date] = {
                                        visits: 0,
                                        newcomers: 0
                                    }
                        
                                    result[record.date].visits ++
                        
                                    if(userIndex.indexOf(record.user) == -1) {
                                        result[record.date].newcomers ++
                                        userIndex.push(record.user)
                                    }
                        
                        
                                })
                                
                                let csv = parser.parse(Object.keys(result).map(date=>{
                                    return {
                                        date: date,
                                        visits: result[date].visits,
                                        newcomers: result[date].newcomers
                                    }
                                }), opts);
                        
                                res.attachment('cowork_'+Number(new Date())+'.csv');
                                res.status(200).send(csv);

                            })
                            
                            

                        }
                    }
                    
                }
                case `channel`:{
                    return classes.doc(req.query.class).get().then(c=>{
                        if(!c.exists) return res.sendStatus(404)
                        let lang = `ru`
                        let h = c.data();
                        let kbd = [
                            [{
                                text: translations.book[lang] || translations.book.en,
                                callback_data: 'class_' + req.query.class
                            }]
                        ]
                        let message = {
                            chat_id: -1002103011599,
                            text: `${common.drawDate(h.date,false,{time:true})}, ${h.duration} ${translations.minutes[lang] ||  translations.minutes.en}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description}\n${h.price? `${translations.fee[lang] ||  translations.fee.en} ${common.cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`,
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: kbd
                            }
                        }
                        if (h.pic) {
                            message.caption = message.text.slice(0, 1000)
                            message.photo = h.pic
                            // delete message.text
                        }
                        m.sendMessage2(message, (h.pic ? 'sendPhoto' : false), token)
                    })
                }
                case `ticket`:{
                    
                    if(!req.query.ticket) return res.sendStatus(400)

                    return userClasses.doc(req.query.ticket).get().then(t=>{
                        if(!t.exists) return res.sendStatus(404)
                        userClasses.doc(req.query.ticket).update({
                            [req.body.attr]: req.body.value
                        }).then(s=>{
                            res.sendStatus(200)
                        }).catch(err=>{
                            res.status(500).send(err.message)
                        })
                    })
                }
                case `announce`:{
                    devlog(req.body)
                    let list = userClasses.where(`class`,`==`,req.body.class);
                    if(req.body.type == `all`) list = list.where('active', '==', true)
                    if(req.body.type == `inside`) list = list.where('status', '==', `used`)
                    if(req.body.type == `outside`) list = list.where('status', '!=', `used`)
                    
                    return list.get()
                    .then(tickets=>{
                        common.handleQuery(tickets).forEach(t=>{
                            
                            devlog(t);

                            m.sendMessage2({
                                chat_id: t.user,
                                text: req.body.text,
                                reply_markup: {
                                    inline_keyboard: [
                                        [{
                                            text: translations.openClass.en,
                                            web_app: {
                                                url: process.env.ngrok + '/paper/app/start=class_'+req.body.class
                                            }
                                        }]
                                    ]
                                }
                            }, false, token)
                        })
                        res.sendStatus(200)
                    })
                    .catch(handleError)
                }
                case 'feedBack':{
                    if(!req.query.class) res.sendStatus(404)
                    feedBackRequest(req.query.class)
                    res.sendStatus(200)
                    break;
                }
                case `q`:{
                    return userClassesQ
                        .where(`class`,'==',req.query.class)
                        .get()
                        .then(col=>{
                            let fin = [];
    
                            common.handleQuery(col).forEach(q=>{
                                fin.push(m.getUser(q.user,udb).then(u=>{
                                    let t = q;
                                        q.userData = u;
                                    return t;
                                }))
                            })
    
                            Promise.all(fin).then(data=>{
                                res.json(data)
                            })
    
                            
                        })
                }
                case `authors`:{
                    switch (req.method){
                        case `GET`:{
                            return authors
                                .where(`active`,'==',true)
                                .get().then(col=>{
                                    res.json(common.handleQuery(col))
                                })
                        }
                        case 'POST':{
                            
                            if(!req.body.name) return res.json({success: false, comment: `no name provided`})
                            if(!req.body.txt) return res.json({success: false, comment: `no description provided`})
                            
                            return authors.add({
                                createdAt:      new Date(),
                                createdBy:      +req.query.id,
                                name:           req.body.name,
                                description:    req.body.description,
                                pic:            req.body.pic || null
                            }).then(s=>{
                                res.json({success:true,comment: `Автор ${req.body.name} создан. Можно добавить еще.`})
                            }).catch(err=>{
                                res.json({success: false, comment: err.message})
                            })
                        }
                    }
                    break;
                }
                case `news`: {
                    return news.orderBy('createdAt', 'DESC').get().then(col => {
                        res.json(common.handleQuery(col))
                    }).catch(err => {
                        res.status(500).send(err.message)
                    })
                }
                case `subscribe`:{
                    if(!req.body.plan || !req.body.user) {
                        return res.status(400).send(`plan or user missing`)
                    }
                    return plans.doc(req.body.plan).get().then(p=>{
                        if(!p.exists || !p.data().active) return res.status(404).send(`plan is not available`)
                        
                        p = p.data();
    
                        m.getUser(req.body.user,udb).then(user=>{
    
                            if(!user) return res.status(400).send(`Нет такого пользователя`)
    
                            if(user.blocked) return res.status(400).send(`Пользователь заблокирован`)
    
                            plansUsers.add({
                                user:       +req.body.user,
                                createdAt:  new Date(),
                                to:         new Date(+new Date()+p.days*24*60*60*1000),
                                visitsLeft: p.visits,
                                eventsLeft: p.events,
                                createdBy:  +req.query.id,
                                name:       p.name,
                                active:     true,
                                plan:       req.body.plan
                            }).then(s=>{
                                res.send(`Подписка оформлена`)
    
                                common.devlog(user)
    
                                m.sendMessage2({
                                    chat_id: user.id,
                                    text: translations.planConfirmed(p)[user.language_code] || translations.planConfirmed(p).en
                                },false,token)
    
                                log({
                                    text: `Админ @id${req.query.id} выдает подписку «${p.name}» (${common.cur(p.price,'GEL')}) пользователю ${req.body.user}`,
                                    admin: +req.query.id,
                                    user:   req.body.user,
                                    silent: true
                                })
                            }).catch(err=>{
                                console.log(err);
                                res.status(500).send(err.message)
                            })
                        })
                    })
                }
                case `qr`: {
                    if (!req.query.data) return res.sendStatus(404)
                    let inc = req.query.data.split('_')
    
                    if (inc[1] == 'coworking') {
                        fb.collection(inc[1]).doc(inc[0]).get().then(d => {
    
                            if (!d.exists) return res.sendStatus(404)
    
                            d = d.data();
    
    
                            switch (req.method) {
                                case 'GET': {
    
    
    
                                    m.getUser(d.user, udb).then(user => {
                                        d.user = user;
                                        if (user.blocked) {
                                            d.alert = `Этот человек в черном списке!!!`
                                        }
                                        halls.doc(d.hall).get().then(h => {
                                            d.hall = h.data()
    
                                            common.devlog(user.id)
    
                                            plansUsers
                                                .where('user','==',+user.id)
                                                .where('active','==',true)
                                                .get().then(col=>{
                                                    
                                                    common.devlog(col.docs)
    
                                                    let plan = common.handleQuery(col)[0]
    
                                                    common.devlog(plan)
    
                                                    if(plan && plan.visitsLeft){
                                                        
                                                        // plansUsers.doc(plan.id).update({
                                                        //     visitsLeft: FieldValue.increment(-1)
                                                        // })
    
                                                        common.devlog(`подписка есть`)
    
                                                        res.json({
                                                            alert: `Гость  на подписке (у него еще ${plan.visitsLeft} посещений)`,
                                                            data: d
                                                        })
    
                                                    } else {
    
                                                        common.devlog(`подписки нет`)
    
                                                        res.json({
                                                            alert: d.alert || null,
                                                            data: d
                                                        })
                                                    }
                                                })
    
                                            
                                        })
    
                                    })
    
                                    break;
                                }
                                case 'POST': {
    
                                    m.getUser(d.user, udb).then(user => {
                                        d.user = user;
    
                                        let toPay = null;
    
                                        let withdraw = 0;
    
                                        if (d.paymentNeeded && !d.payed) {
                                            toPay = 30;
                                        }
    
                                        if (user.deposit) {
                                            if (user.deposit > 30) {
                                                toPay = 0
                                                alertWithdrawal(user, false, 30, `coworking`)
                                            } else {
                                                toPay = 30 - user.deposit;
                                                alertWithdrawal(user, false, user.deposit, `coworking`)
                                            }
                                        }
    
                                        fb.collection(inc[1]).doc(inc[0]).update({
                                            payed: d.paymentNeeded ? true : false,
                                            status: 'used'
                                        })
                                        
    
                                        common.devlog(user.id)
    
                                        plansUsers
                                            .where('user','==',+user.id)
                                            .where('active','==',true)
                                            .get().then(col=>{
                                                let plan = common.handleQuery(col)[0]
                                                
                                                common.devlog(plan)
    
                                                if(plan && plan.visitsLeft){
                                                    
                                                    plansUsers.doc(plan.id).update({
                                                        visitsLeft: FieldValue.increment(-1)
                                                    })
    
                                                    res.json({
                                                        success: true,
                                                        alert: `Посещение вычтено из подписки.`
                                                    })
    
                                                } else {
                                                    res.json({
                                                        success: true,
                                                        alert: toPay ? `К оплате на месте: ${common.cur(toPay,'GEL')}` : `Оплата не требуется.`
                                                    })
                                                }
                                            })
    
                                        
    
                                    })
    
    
                                    break;
                                }
                            }
                        })
                    } else if (inc[1] == 'wineList') {
                        fb.collection(inc[1]).doc(inc[0]).get().then(d => {
    
                            if (!d.exists) return res.sendStatus(404)
    
                            d = d.data();
    
    
                            switch (req.method) {
                                case 'GET': {
                                    res.json({data:d})
                                    break;
                                }
                                case 'POST': {
                                    if (d.left) {
                                        fb.collection(inc[1])
                                            .doc(inc[0])
                                            .update({
                                                left: FieldValue.increment(-1),
                                                updatedAt: new Date(),
                                                statusBy: req.query.id
                                            }).then(() => {
                                                res.sendStatus(201)
                                                if (d.left - 1) {
                                                    m.sendMessage2({
                                                        photo: process.env.ngrok + `/paper/qr?id=${inc[0]}&entity=wineList`,
                                                        chat_id: d.user,
                                                        caption: `Ваш депозит убыл. На балансе ${common.letterize(d.left-1, 'ходка')}`
                                                    }, 'sendPhoto', token)
                                                } else {
                                                    m.sendMessage2({
                                                        photo: process.env.ngrok + `/paper/qr?id=${inc[0]}&entity=wineList`,
                                                        chat_id: d.user,
                                                        caption: `Приплыли. Депозит на нуле. Пора домой`
                                                    }, 'sendPhoto', token)
                                                }
    
                                            }).catch(err => {
                                                console.log(err)
                                                res.sendStatus(500).send(err.message)
                                            })
                                    } else {
                                        res.status(403).send(`Этому больше не наливать`)
                                    }
                                    break;
    
                                }
                            }
    
                        })
    
                    } else if (inc[1] == 'promos') {
                        fb.collection(inc[1]).doc(inc[0]).get().then(d => {
    
                            if (!d.exists) return res.sendStatus(404)
    
                            d = d.data();
    
    
                            switch (req.method) {
                                case 'GET': {
                                    common.devlog(d)
                                    res.json({data:d})
                                    break;
                                }
                                case 'POST': {
                                    if (d.left) {
                                        fb.collection(inc[1])
                                            .doc(inc[0])
                                            .update({
                                                left: FieldValue.increment(-1),
                                                updatedAt: new Date(),
                                                statusBy: req.query.id
                                            }).then(() => {
                                                res.sendStatus(200)
    
                                            }).catch(err => {
                                                console.log(err)
                                                res.sendStatus(500).send(err.message)
                                            })
                                    } else {
                                        res.status(403).send(`Этому больше не наливать`)
                                    }
                                    break;
    
                                }
                            }
    
                        })
    
                    } else if (inc[1] == `planRequests`) {
    
                        switch(req.method){
                            case 'GET':{
                                return plansRequests.doc(inc[0]).get().then(r=>{
                                    let data = [];
                                    if(!r.exists) return res.status(500).send(`Такой заявки нет в базе данных`)
                                    r = r.data();
                                    data.push(m.getUser(r.user,udb).then(u=>u))
                                    data.push(plans.doc(r.plan).get().then(p=>p.data()))
                                    Promise.all(data).then(data=>{
                                        res.json({
                                            data:{
                                                user: data[0],
                                                plan: data[1]
                                            }
                                            
                                        })
                                    })
                                }).catch(err=>{
                                    console.log(err)
                                    res.status(500).send(err.message)
                                })
    
                                break;
                            }
                            case 'POST':{
                                return plansRequests.doc(inc[0]).get().then(r=>{
                                    if(!r.exists) return res.status(500).send(`Такой заявки нет в базе данных`)
                                    r = r.data();
                                    plans.doc(r.plan).get().then(p=>{
                                        p = p.data()
                                        
                                        plansUsers.add({
                                            user:       r.user,
                                            createdAt:  new Date(),
                                            to:         new Date(+new Date()+p.days*24*60*60*1000),
                                            visitsLeft: p.visits,
                                            eventsLeft: p.events,
                                            createdBy:  +req.query.id,
                                            name:       p.name,
                                            active:     true,
                                            plan:       r.plan
                                        }).then(()=>{
                                            m.getUser(r.user,udb).then(user=>{
                                                m.sendMessage2({
                                                    chat_id: r.user,
                                                    text: translations.planConfirmed(p)[user.language_code] || translations.planConfirmed(p).en
                                                },false,token)
                                                log({
                                                    text: `Админ @id${req.query.id} выдает подписку «${p.name}» (${common.cur(p.price,'GEL')}) пользователю ${uname(user,r.user)}`,
                                                    admin: +req.query.id,
                                                    user:   r.user,
                                                    silent: true
                                                })
            
                                                res.sendStatus(200)
            
                                            })
            
                                            
                                        })
                                    })
                                    
                                })
                            }
                        }
                        
                    } else {
                        switch (req.method) {
    
    
                            case 'GET': {
                                return fb.collection(inc[1])
                                    .doc(inc[0])
                                    .get()
                                    .then(d => {
                                        if (!d.exists) {
                                            res.send({
                                                success: false,
                                                alert: `Такого билета нет в природе`
                                            })
                                        }
                                        classes.doc(d.data().class).get().then(c => {
                                            c = c.data()
    
                                            if (!c.active) return res.json(res.json({
                                                success: false,
                                                data: d.data(),
                                                alert: `Мероприятие было отменено!`
                                            }))
    
                                            d = d.data();
    
                                            d.date = common.drawDate(c.date, 'ru', {
                                                time: true
                                            })
                                            
                                            d.hall = c.hallName
    
                                            plansUsers
                                                .where('user','==',+d.user)
                                                .where('active','==',true)
                                                .get().then(col=>{
                                                    let plan = common.handleQuery(col)[0]
                                                    if(plan && plan.eventsLeft){
                                                        
                                                        plansUsers.doc(plan.id).update({
                                                            eventsLeft: FieldValue.increment(-1)
                                                        })
    
                                                        res.json({
                                                            alert: `Посещение по подписке (осталось ${plan.eventsLeft-1})`,
                                                            success: true,
                                                            data: d
                                                        })
    
                                                    } else {
                                                        res.json({
                                                            success: true,
                                                            data: d
                                                        })
                                                    }
                                                })
                                                
    
    
                                            
                                        })
    
                                    })
                            }
                            case 'POST': {
    
                                fb.collection(inc[1])
                                    .doc(inc[0])
                                    .update({
                                        status: 'used',
                                        known: true,
                                        updatedAt: new Date(),
                                        statusBy: req.query.id
                                    }).then(() => {
                                        res.sendStatus(200)
    
    
    
                                    }).catch(err => {
                                        res.status(500).send(err.message)
                                    })
                                if (inc[1] == 'userClasses') {
                                    fb.collection(inc[1])
                                        .doc(inc[0])
                                        .get()
                                        .then(t => {
                                            
                                            let userid =  t.data().user;
    
                                            plansUsers
                                                .where('user','==',+userid)
                                                .where('active','==',true)
                                                .get().then(col=>{
                                                    let plan = common.handleQuery(col)[0]
                                                    if(plan && plan.eventsLeft){
                                                        plansUsers.doc(plan.id).update({
                                                            eventsLeft: FieldValue.increment(-1)
                                                        })
                                                    }
                                                })
    
                                            m.getUser(userid, udb).then(user => {
                                                m.sendMessage2({
                                                    chat_id: user.id,
                                                    text: translations.welcomeOnPremise[user.language_code] || translations.welcomeOnPremise.en,
                                                    reply_markup:{
                                                        inline_keyboard: [
                                                            [{
                                                                text: translations.openClass[user.language_code] || translations.openClass.en,
                                                                web_app: {
                                                                    url: process.env.ngrok + '/paper/app/start=class_'+req.body.class
                                                                }
                                                            }]
                                                        ]
                                                    }
                                                    
                                                }, false, token)
    
                                                classes.doc(t.data().class).get().then(cl=>{
                                                    if(cl.data().welcome){
                                                        m.sendMessage2({
                                                            chat_id: user.id,
                                                            text: cl.data().welcome
                                                        }, false, token)
                                                    }
                                                })
    
    
    
                                            })
    
                                        })
                                }
                            }
                        }
                    }
                    break;
    
    
    
                }
                case 'check': {
                    return res.json(user)
                }
    
                case 'classes': {
                    return classes
                        .where('active', '==', true)
                        .orderBy('date', 'desc')
                        .get()
                        .then(col => {
                            res.json(common.handleQuery(col))
                        })
                }
    
                case 'class': {
                    if (!req.query.class) return res.sendStatus(404)
                    return userClasses
                        .where('active', '==', true)
                        .where('class', '==', req.query.class)
                        .get()
                        .then(col => {
                            res.json(common.handleQuery(col))
                        })
                }

                case 'classWL': {
                    if (!req.query.class) return res.sendStatus(404)
                    return userClassesWL
                        .where('active', '==', true)
                        .where('class', '==', req.query.class)
                        .get()
                        .then(col => {
                            col = common.handleQuery(col)
                            let usersData = [];
                            let usersToCome = col.map(r=>r.user)
                            usersToCome.forEach(u=>{
                                usersData.push(m.getUser(u,udb))
                            })

                            Promise.all(usersData).then(usersData=>{
                                res.json(col.map(r=>{
                                    let t = r;
                                    t.user = usersData.filter(u=>u.id == t.user)[0]
                                    return t;
                                }))
                            })

                            
                        })
                }

                case 'user': {
    
                    if (!req.query.user) return res.sendStatus(404)
    
                    switch (req.query.data) {
                        case 'profile':{
                            return udb.doc(req.query.user).get().then(u=>{
                                if(!u.exists) return res.sendStatus(404)
                                return res.json(common.handleDoc(u))
                            })
                        }
                        case 'subscriptions': {
                            return subscriptions
                                .where('user', '==', +req.query.user)
                                .orderBy('createdAt', 'DESC')
                                .get()
                                .then(col => {
                                    res.json(common.handleQuery(col))
                                })
                        }
                        case 'messages': {
                            return messages
                                .where('user', '==', +req.query.user)
                                .orderBy('createdAt', 'DESC')
                                .get()
                                .then(col => {
                                    res.json(common.handleQuery(col))
                                })
                        }
                        case 'lections': {
                            return userClasses
                                .where('user', '==', +req.query.user)
                                .where('active', '==', true)
                                .orderBy('createdAt', 'DESC')
                                .get()
                                .then(col => {
                                    res.json(common.handleQuery(col))
                                })
                        }
                    }
                }
                case 'users': {
                    switch (req.method) {
                        case 'GET': {
    
                            let data = [];
                            data.push(udb
                                .orderBy((req.query.order || 'createdAt'), (req.query.direction || 'ASC'))
                                .get()
                                .then(d => common.handleQuery(d)))
    
                            data.push(plansUsers
                                .where('active','==',true)
                                .get()
                                .then(col=>common.handleQuery(col)))
    
                            data.push(plans
                                .where('active','==',true)
                                .get()
                                .then(col=>common.handleQuery(col)))
    
                            return Promise.all(data).then(data=>{
                                res.json({
                                    users: data[0],
                                    plans: data[1],
                                    plansA:data[2]
                                })
                            })
                        }
                        case 'POST': {
                            udb.doc(req.body.user.toString()).update({
                                [req.body.field]: req.body.value,
                                updatedAt: new Date(),
                                updatedBy: +req.query.id
                            }).then(() => {
                                let actors = []
    
                                actors.push(udb.doc(req.body.user.toString()).get().then(u => u.data()))
                                actors.push(udb.doc(req.query.id.toString()).get().then(u => u.data()))
                                Promise.all(actors).then(actors => {
    
                                    log({
                                        text: `Админ @${actors[1].username} ${interprete(req.body.field,req.body.value)} @${actors[0].username || req.body.user}`,
                                        user: req.body.user,
                                        admin: +req.query.id
                                    })
    
                                    if (req.body.value) {
                                        if (req.body.field == 'insider') {
                                            m.sendMessage2({
                                                chat_id: req.body.user,
                                                text: translations.congrats[actors[0].language_code] || translations.congrats.en
                                            }, false, token)
                                        }
    
                                        if (req.body.field == 'admin') {
                                            m.sendMessage2({
                                                chat_id: req.body.user,
                                                text: `Поздравляем, вы зарегистрированы как админ приложения.`
                                            }, false, token)
                                        }
    
                                        if (req.body.field == 'fellow') {
                                            m.sendMessage2({
                                                chat_id: req.body.user,
                                                text: translations.fellow[actors[0].language_code] || translations.fellow.en
                                            }, false, token)
                                        }
                                    }
                                })
                            })
                        }
    
                    }
    
                }
                case 'logs': {
                    return logs
                        .orderBy('createdAt', 'DESC')
                        .limit(req.query.offset ? +req.query.offset : 50)
                        // .limitToFirst(req.query.offset? +req.query.offset : 50)
                        .get()
                        .then(col => {
                            res.json(common.handleQuery(col))
                        })
                }
                default:
                    res.sendStatus(404)
            }
    
        })
    })

    


})

router.get('/qr', async (req, res) => {
    if (req.query.class) {
        let n = +new Date()
        QRCode.toFile(__dirname + `/../public/images/papers/qr/invite_${req.query.class}.png`, `https://t.me/paperstuffbot?start=class_${req.query.class}`, {
            color: {
                dark: req.query.dark || '#075B3F',
                light: req.query.light || '#ffffff',
            },
            maskPattern: req.query.m || 0,
            type: 'png',
        }).then(s => {
            res.sendFile(`invite_${req.query.class}` + '.png', {
                root: './public/images/papers/qr/'
            })
        }).catch(err => {
            console.log(err)
            res.sendStatus(500)
        })
    } else if (req.query.id && req.query.entity) {
        QRCode.toFile(__dirname + `/../public/images/papers/qr/${req.query.id}_${req.query.entity}.png`, `${req.query.id}_${req.query.entity}`, {
            color: {
                dark: req.query.dark || '#075B3F',
                light: req.query.light || '#ffffff',
            },
            maskPattern: req.query.m || 0,
            type: 'png',
        }).then(s => {
            res.sendFile(`${req.query.id}_${req.query.entity}` + '.png', {
                root: './public/images/papers/qr/'
            })
        }).catch(err => {
            console.log(err)
            res.sendStatus(500)
        })
    } else {
        res.status(500).send(`no place provided`)
    }
})


function alertNewClassesOffers(){
    axios.get(`https://api.trello.com/1/lists/6551e8f31844b130a4db500a/cards?key=${process.env.kahaTrelloKey}&token=${process.env.kahaTrelloToken}`).then(data=>{
        data.data.forEach(card=>{
            classesOffers.doc(card.id).get().then(d=>{
                if(!d.exists){
                    m.sendMessage2({
                        chat_id: 487598913,
                        text: `Увага! Новая лекция предложена, но не рассмотрена по существу:\n${card.name}: ${card.desc}\n${card.shortUrl}`
                    },false,token)
                }
            })
        })
    })
}


if(!process.env.develop){
    cron.schedule(`55,25 9-23 * * *`, () => {
        // :55, :25 каждый час с 9 до 23
        alertSoonMR()
    })
    
    
    cron.schedule(`0 5 * * *`, () => {
        alertSoonCoworking()
        alertAdminsCoworking()
    })
    
    cron.schedule(`0 11 * * *`, () => {
        alertSoonClasses()
    })
    
    
    cron.schedule(`0 5 * * *`, () => {
        common.getNewUsers(udb,1).then(newcomers=>{
            log({
                text: `Новых пользователей за сутки: ${newcomers}`
            })
        })
    })
    
    cron.schedule(`0 5 * * 1`, () => {
        common.getNewUsers(udb,7).then(newcomers=>{
            log({
                text: `Новых пользователей за неделю: ${newcomers}`
            })
        })
    })
    
    cron.schedule(`0 5 1 * *`, () => {
        common.getNewUsers(udb,30).then(newcomers=>{
            log({
                text: `Новых пользователей за месяц: ${newcomers}`
            })
        })
    })
}


router.get(`/mini`,(req,res)=>{
    
    classes
        .where(`active`,'==',true)
        .where(`date`,'>',new Date().toISOString())
        .get()
        .then(col=>{

            res.render(`papers/main`,{
                classes:        common.handleQuery(col),
                translations:   translations,
                coworkingRules: coworkingRules,
                drawDate:(d)=>  drawDate(d),
                lang: req.language.split('-')[0]
            })
        })
})

let siteSectionsTypes = {
    classes:{
        title: `Афиша`,
        data: classes,
    }
}

router.get(`/mini/:section`,(req,res)=>{
    if(req.params.section == `classes`){
        return classes
            .where(`active`,'==',true)
            .where(`date`,'>',new Date().toISOString())
            .get()
            .then(col=>{
                res.render(`papers/classes`,{
                    classes:            common.handleQuery(col),
                    translations:       translations,
                    coworkingRules:     coworkingRules,
                    drawDate:(d)=>      drawDate(d),
                    lang:               req.language.split('-')[0],
                    cur:(p)=>           common.cur(p)
                })
            })
    }
    res.sendStatus(404)
})

router.get(`/mini/:section/:id`,(req,res)=>{
    if(req.params.section == `classes`){
        
        devlog(`classes`)

        return common.getDoc(classes,req.params.id).then(c=>{
            
            devlog(c)

            if(!c) return res.sendStatus(404)
            
            res.render(`papers/class`,{
                cl:                 c,
                translations:       translations,
                coworkingRules:     coworkingRules,
                drawDate:(d)=>      drawDate(d),
                lang:               req.language.split('-')[0],
                cur:(p)=>           common.cur(p)
            })
        })
    }
    
    devlog(req.params.section)

    res.sendStatus(404)
})


if(process.env.develop){
    router.get('/test', (req, res) => {
        alertNewClassesOffers()
        // feedBackRequest(req.query.class);
//         coworking
//             .where(`active`,'==',true)
//             .get()
//             .then(col=>{
//                 let users = [... new Set(common.handleQuery(col).map(r=>+r.user))] 
//                 common.devlog(users)
//                 common.devlog(users.length)
//                 let toSend = []
//                 users.forEach(u=>{
//                     toSend.push(m.getUser(u,udb))
//                 })
//                 Promise.all(toSend).then(users=>{
//                     let clear = users.map(u=>{
//                         return {
//                             id: u.id,
//                             lang: u.language_code,
//                             name: u.first_name
//                         }
//                     })

//                     clear.forEach((u,i)=>{
//                         setTimeout(()=>{
//                             m.sendMessage2({
//                                 chat_id: u.id,
//                                 caption:`Хей-хо, ${u.name}!

// Настоящее сообщение создано и/или распространено баром Gamotsema, который по-прежнему работает в пространстве Papers, но с завтрашнего дня открывается с 14 часов во все будни кроме понедельника. Теперь у нас снова есть кофе, к которому добавились домашние лимонады — оранжад и зеленый чай с тоником. До конца августа по билету в коворкинг вы сможете в любой день выпить белое вино за 6 лари вместо 8, а кофе, как и в пространстве наверху, вам полагается бесплатно. Домашние лимонады мы отдаем за 5 лари. Так что рабочий перерыв в саду с бокалом холодного ркацители или стаканом лимонада на наших собственных сиропах и фрешах теперь не мечта, а реальность!
                                
// Ну и не забывайте, что по вечерам у нас всегда можно взять коктейльную классику или специалитеты, вина и пиво, чтобы слегка прийти в себя по дороге домой. Гаихаре!`,
//                                 photo: `https://firebasestorage.googleapis.com/v0/b/paperstuff-620fa.appspot.com/o/gamotsema%2FIMG_0309%20(2).JPG?alt=media&token=b0c8a2c4-481b-467b-81e6-34b286162c5a`
//                             },'sendPhoto',token)
//                         },i*100)
//                     })
//                 })
//             })
        res.sendStatus(200)
    })
}




// udb.get().then(col=>{
//     col.docs.forEach((u,i)=>{
//         setTimeout(function(){
//             let m = u.data();
//                 m.intention = 'newUser'
//                 m.id = u.id
//             axios.post(sheet,Object.keys(m).map(k=>`${k}=${m[k]}`).join('&'),{headers:{ "Content-Type": "application/x-www-form-urlencoded" }}).then(d=>{
//                 console.log(d.data)
//             }).catch(err=>{
//                 console.log(err.message)
//             })
//         },i*2500)

//     })
// })


function feedBackRequest(c){
    classes.doc(c).get().then(l=>{
        userClasses
            .where(`class`,'==',c)
            .where('active','==',true)
            .where('status','==','used')
            .get()
            .then(col=>{
                common.handleQuery(col).forEach(ticket=>{
                    common.devlog(ticket.user)
                    m.getUser(ticket.user,udb).then(user=>{
                        m.sendMessage2({
                            chat_id: ticket.user,
                            text: translations.feedBackRequest(ticket)[user.language_code] || translations.feedBackRequest(ticket).en,
                            reply_markup:{
                                inline_keyboard:[

                                    [
                                        {
                                            text: `1`,
                                            callback_data: `feedback_ticket_${ticket.id}_1`
                                        },
                                        {
                                            text: `2`,
                                            callback_data: `feedback_ticket_${ticket.id}_2`
                                        },
                                        {
                                            text: `3`,
                                            callback_data: `feedback_ticket_${ticket.id}_3`
                                        },
                                        {
                                            text: `4`,
                                            callback_data: `feedback_ticket_${ticket.id}_4`
                                        },
                                        {
                                            text: `5`,
                                            callback_data: `feedback_ticket_${ticket.id}_5`
                                        }
                                    ]
                                    
                                ]
                            }
                        },false,token)
                        
                        messages.add({
                            user: ticket.user,
                            text: translations.feedBackRequest(ticket)[user.language_code] || translations.feedBackRequest(ticket).en,
                            createdAt: new Date(),
                            isReply: true
                        })
                        
                    })
                    
                })
                classes.doc(c).update({
                    feedBackSent: new Date()
                })
            })
    })
}

function alertAdminsCoworking() {
    let date = new Date().toISOString().split('T')[0]
    coworking
        .where('active', '==', true)
        .where('date', '==', date)
        .get()
        .then(col => {
            let records = common.handleQuery(col);
            let toBePayed = records.filter(r => r.paymentNeeded && !r.payed)
            let payed = records.filter(r => r.payed)
            let free = records.filter(r => !r.paymentNeeded)
            if (records.length) {
                hallsData = [];
                [...new Set(records.map(r => r.hall))].forEach(id => {
                    hallsData.push(halls.doc(id).get().then(h => {
                        let t = h.data()
                        t.id = h.id;
                        return t
                    }))
                })
                Promise.all(hallsData).then(hd => {

                    let users = [];

                    [...new Set(records.map(r => r.user))].forEach(id => {
                        users.push(udb.doc(id.toString()).get().then(h => {
                            let t = h.data()
                            t.id = h.id;
                            return t
                        }))
                    })



                    let hallsReady = {};


                    hd.forEach(hall => {
                        hallsReady[hall.id] = hall
                    })

                    Promise.all(users).then(users => {

                        let uReady = {};

                        users.forEach(u => {
                            uReady[u.id] = u
                        })

                        axios.post(process.env.papersHook, {
                            blocks: modals.coworkingReport(toBePayed, payed, free, hallsReady, uReady)
                        }).then(s => {
                            if (process.env.develop == 'true') console.log(s.data)
                        }).catch(err => {
                            console.log(err)
                        })
                    })

                })
            } else {
                alertAdmins({
                    text: `На сегодня записей в коворкинг нет.`
                })
            }
        })
}

function alertSoonClasses() {
    classes
        .where('active', '==', true)
        .where('date', '==', new Date().toISOString().split('T')[0])
        .get()
        .then(col => {
            common.handleQuery(col).forEach(record => {
                remindOfClass(record)
            })
        }).catch(err => {
            console.log(err)
        })
}

function alertSoonCoworking() {
    coworking
        .where('active', '==', true)
        .where('date', '==', new Date().toISOString().split('T')[0])
        .get()
        .then(col => {
            common.handleQuery(col).forEach(record => {
                remindOfCoworking(record)
            })
        }).catch(err => {
            console.log(err)
        })
}


function remindOfClass(rec) {
    udb.doc(rec.user.toString()).get().then(user => {
        m.sendMessage2({
            chat_id: rec.user,
            text: translations.lectureReminder(rec)[user.language_code] || translations.lectureReminder(rec).en,
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                        callback_data: `unclass_${rec.id}`
                    }]
                ]
            }
        }, false, token)
    })
}

function remindOfCoworking(rec) {
    udb.doc(rec.user.toString()).get().then(user => {
        user = user.data();

        halls.doc(rec.hall).get().then(hall => {
            hall = hall.data();
            let message = {
                chat_id: rec.user,
                text: translations.coworkingReminder(hall)[user.language_code] || translations.coworkingReminder(hall).en,
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                            callback_data: `ca_cancel_${rec.id}`
                        }]
                    ]
                }
            }
            // if (!rec.isPayed && rec.paymentNeeded) {
            //     message.reply_markup.inline_keyboard.push([{
            //         text: translations.pay(30)[user.language_code] || translations.pay(30).en,
            //         callback_data: `pay_coworking_${rec.id}`
            //     }])
            // }
            m.sendMessage2(message, false, token)
        })

    })
}

function alertSoonMR() {

    let h = +new Date().toTimeString().split(' ')[0].split(':')[0] + 1
    mra
        .where('active', '==', true)
        .where('date', '==', new Date().toISOString().split('T')[0])
        .where('time', '>', h + ':00')
        .orderBy('time', 'asc')
        .limit(1)
        .get()
        .then(col => {
            col = common.handleQuery(col)
            if (col.length) {
                let rec = col[0];
                if (new Date(rec.date + ' ' + rec.time) - new Date() < 10 * 60 * 1000) {
                    udb.doc(rec.user.toString()).get().then(u => {
                        let udata = u.data()

                        m.sendMessage2({
                            chat_id: rec.user,
                            text: translations.mrReminder((h + 1) + ':00')[udata.language_code] || translations.mrReminder((h + 1) + ':00').en,
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: translations.coworkingBookingCancel[udata.language_code] || translations.coworkingBookingCancel.en,
                                        callback_data: `mr_unbook_${rec.id}`
                                    }]
                                ]
                            }
                        }, false, token)
                    })

                }
            }
        }).catch(err => {
            console.log(err)
        })
}

let users = {}

function bookClass(user, classId, res, id) {

    common.devlog(user)

    if (!user) {
        user = udb.doc(id.toString()).get().then(u => {
            let t = u.data();
            t.id = id
            return t
        })
    }



    Promise.resolve(user).then(user => {
        common.devlog(user)
        userClasses
            .where('user', '==', user.id)
            .where('active', '==', true)
            .where('class', '==', classId)
            .get().then(col => {
                if (!col.docs.length) {
                    
                    common.devlog(`Записей еще нет`)

                    classes.doc(classId).get().then(c => {

                        if (!c.exists){
                            if(res) return res.sendStatus(404)
                            return false
                        }

                        let d = {
                            user:       +user.id,
                            userName:   `${user.first_name} ${user.last_name} (${user.username})`,
                            active:     true,
                            createdAt:  new Date(),
                            className:  c.data().name,
                            class:      classId
                        }

                        plansUsers
                            .where(`user`,'==',+user.id)
                            .where(`active`,'==',true)
                            .get()
                            .then(col=>{
                                
                                let sub = common.handleQuery(col)[0]

                                let subData = sub ? `подписка: ${sub.name}` : ``

                                userClasses
                                    .where('class', '==', classId)
                                    .where('active','==',true)
                                    .get()
                                    .then(col=>{
                                        let line = col.docs.length;
                                        let capacity = c.data().capacity
                                        let seatsData = '';
                                        
                                        if(capacity){
                                            if(line<capacity){

                                                seatsData = `осталось мест: ${capacity-(line+1)} из ${capacity}`
                                                userClasses.add(d).then(record => {

                                                    d.id = record.id;
                        
                                                    d.intention = 'newClassRecord';
                        
                                                    if (c.data().price) {
                                                        if (res) {
                                                            res.json({
                                                                success: true,
                                                                text: `lectureConfirm`
                                                            })
                                                        }

                                                        m.sendMessage2({
                                                            chat_id: user.id,
                                                            photo: process.env.ngrok + `/paper/qr?id=${record.id}&entity=userClasses`,
                                                            caption: translations.lectureInvite(c.data())[user.language_code] || translations.lectureInvite(c.data()).en,
                                                            reply_markup: {
                                                                inline_keyboard: [
                                                                    [{
                                                                        text: `${translations.coworkingBookingCancel[user.language_code] ||  translations.coworkingBookingCancel.en}`,
                                                                        callback_data: 'unclass_' + record.id
                                                                    }]
                                                                    // ВЕРНУТЬ С ПЛАТЕЖАМИ
                                                                    // [{
                                                                    //     text: translations.pay(common.cur(c.data().price, 'GEL'))[user.language_code] || translations.pay(common.cur(c.data().price, 'GEL')).en,
                                                                    //     callback_data: 'pay_' + d.id
                                                                    // }],
                                                                    // [{
                                                                    //     text: translations.payOnSite[user.language_code] || translations.payOnSite.en,
                                                                    //     callback_data: 'payOnSite_' + d.id
                                                                    // }]
                                                                ]
                                                                //     ,
                                                                //     [{
                                                                //         text: translations.yourCode[user.language_code] || translations.yourCode.en,
                                                                //         url: process.env.ngrok + `/paper/qr?id=${record.id}&entity=userClasses`
                                                                //     }]
                                                                // ]
                                                            }
                                                        }, 'sendPhoto', token).then(data => {
                                                            m.sendMessage2({
                                                                chat_id: user.id,
                                                                message_id: data.result.message_id
                                                            }, 'pinChatMessage', token)
                                                        })
                                                    } else {
                        
                                                        if (res) {
                                                            res.json({
                                                                success: true,
                                                                text: `lectureConfirm`
                                                            })
                                                        }
                                                        // m.sendMessage2({
                                                        //     chat_id: user.id,
                                                        //     text: translations.lectureInvite[user.language_code](c.data()) || translations.lectureInvite.en(c.data()),
                                                        // }, false, token)
                        
                                                        m.sendMessage2({
                                                            chat_id: user.id,
                                                            photo: process.env.ngrok + `/paper/qr?id=${record.id}&entity=userClasses`,
                                                            caption: translations.lectureInvite(c.data())[user.language_code] || translations.lectureInvite(c.data()).en,
                                                            reply_markup: {
                                                                inline_keyboard: [
                                                                    [{
                                                                        text: `${translations.coworkingBookingCancel[user.language_code] ||  translations.coworkingBookingCancel.en}`,
                                                                        callback_data: 'unclass_' + record.id
                                                                    }]
                                                                    // ВЕРНУТЬ С ПЛАТЕЖАМИ
                                                                    // [{
                                                                    //     text: translations.pay(common.cur(c.data().price, 'GEL'))[user.language_code] || translations.pay(common.cur(c.data().price, 'GEL')).en,
                                                                    //     callback_data: 'pay_' + d.id
                                                                    // }],
                                                                    // [{
                                                                    //     text: translations.payOnSite[user.language_code] || translations.payOnSite.en,
                                                                    //     callback_data: 'payOnSite_' + d.id
                                                                    // }]
                                                                ]
                                                                //     ,
                                                                //     [{
                                                                //         text: translations.yourCode[user.language_code] || translations.yourCode.en,
                                                                //         url: process.env.ngrok + `/paper/qr?id=${record.id}&entity=userClasses`
                                                                //     }]
                                                                // ]
                                                            }
                                                        }, 'sendPhoto', token).then(data => {
                                                            m.sendMessage2({
                                                                chat_id: user.id,
                                                                message_id: data.result.message_id
                                                            }, 'pinChatMessage', token)
                                                        })
                                                    }

                                                    let t = Object.keys(d).map(k => `${k}=${d[k]}`).join('&')
                                                    axios.post(sheet, t, {
                                                        headers: {
                                                            "Content-Type": "application/x-www-form-urlencoded"
                                                        }
                                                    })
                                                    log({
                                                        text: `${uname(user, user.id)} просит место на лекцию ${c.data().name}\n${seatsData}`,
                                                        user: user.id,
                                                        class: c.id,
                                                        ticket: record.id
                                                    })

                        
                                                }).catch(err => {
                                                    console.log(err)
                                                })
                                            } else {
                                                seatsData = `*овербукинг:* забронировано ${line} мест из ${capacity}`

                                                userClassesWL.add({
                                                    createdAt:  new Date(),
                                                    active:     true,
                                                    user:       +user.id,
                                                    class:      classId,
                                                    className:  c.data().name
                                                })


                                                if (res) {
                                                    res.json({
                                                        success: false,
                                                        text: `noSeatsLeft`
                                                    })
                                                } else {
                                                    m.sendMessage2({
                                                        chat_id: user.id,
                                                        text: translations.noSeatsLeft[user.language_code] 
                                                    }, false, token)
                                                }

                                                log({
                                                    text: `${uname(user, user.id)} НЕ ПОЛУЧАЕТ место на лекцию ${c.data().name}\n${seatsData}`,
                                                    user: user.id,
                                                    class: c.id
                                                })

                                            }
                                        } else {

                                            seatsData = `всего забронировано мест: ${line}`

                                            userClasses.add(d).then(record => {

                                                d.id = record.id;
                    
                                                d.intention = 'newClassRecord';
                    
                                                if (c.data().price) {
                                                    if (res) {
                                                        res.json({
                                                            success: true,
                                                            text: `lectureConfirm`
                                                        })
                                                    }
                                                    m.sendMessage2({
                                                        chat_id: user.id,
                                                        photo: process.env.ngrok + `/paper/qr?id=${record.id}&entity=userClasses`,
                                                        caption: translations.lectureInvite(c.data())[user.language_code] || translations.lectureInvite(c.data()).en,
                                                        reply_markup: {
                                                            inline_keyboard: [
                                                                [{
                                                                    text: `${translations.coworkingBookingCancel[user.language_code] ||  translations.coworkingBookingCancel.en}`,
                                                                    callback_data: 'unclass_' + record.id
                                                                }]
                                                                // ВЕРНУТЬ С ПЛАТЕЖАМИ
                                                                // [{
                                                                //     text: translations.pay(common.cur(c.data().price, 'GEL'))[user.language_code] || translations.pay(common.cur(c.data().price, 'GEL')).en,
                                                                //     callback_data: 'pay_' + d.id
                                                                // }],
                                                                // [{
                                                                //     text: translations.payOnSite[user.language_code] || translations.payOnSite.en,
                                                                //     callback_data: 'payOnSite_' + d.id
                                                                // }]
                                                            ]
                                                            //     ,
                                                            //     [{
                                                            //         text: translations.yourCode[user.language_code] || translations.yourCode.en,
                                                            //         url: process.env.ngrok + `/paper/qr?id=${record.id}&entity=userClasses`
                                                            //     }]
                                                            // ]
                                                        }
                                                    }, 'sendPhoto', token).then(data => {
                                                        m.sendMessage2({
                                                            chat_id: user.id,
                                                            message_id: data.result.message_id
                                                        }, 'pinChatMessage', token)
                                                    })
                                                } else {
                    
                                                    if (res) {
                                                        res.json({
                                                            success: true,
                                                            text: `lectureConfirm`
                                                        })
                                                    }
                                                    // m.sendMessage2({
                                                    //     chat_id: user.id,
                                                    //     text: translations.lectureInvite[user.language_code](c.data()) || translations.lectureInvite.en(c.data()),
                                                    // }, false, token)
                    
                                                    m.sendMessage2({
                                                        chat_id: user.id,
                                                        photo: process.env.ngrok + `/paper/qr?id=${record.id}&entity=userClasses`,
                                                        caption: translations.lectureInvite(c.data())[user.language_code] || translations.lectureInvite(c.data()).en,
                                                        reply_markup: {
                                                            inline_keyboard: [
                                                                [{
                                                                    text: `${translations.coworkingBookingCancel[user.language_code] ||  translations.coworkingBookingCancel.en}`,
                                                                    callback_data: 'unclass_' + record.id
                                                                }]
                                                                // ВЕРНУТЬ С ПЛАТЕЖАМИ
                                                                // [{
                                                                //     text: translations.pay(common.cur(c.data().price, 'GEL'))[user.language_code] || translations.pay(common.cur(c.data().price, 'GEL')).en,
                                                                //     callback_data: 'pay_' + d.id
                                                                // }],
                                                                // [{
                                                                //     text: translations.payOnSite[user.language_code] || translations.payOnSite.en,
                                                                //     callback_data: 'payOnSite_' + d.id
                                                                // }]
                                                            ]
                                                            //     ,
                                                            //     [{
                                                            //         text: translations.yourCode[user.language_code] || translations.yourCode.en,
                                                            //         url: process.env.ngrok + `/paper/qr?id=${record.id}&entity=userClasses`
                                                            //     }]
                                                            // ]
                                                        }
                                                    }, 'sendPhoto', token).then(data => {
                                                        m.sendMessage2({
                                                            chat_id: user.id,
                                                            message_id: data.result.message_id
                                                        }, 'pinChatMessage', token)
                                                    })
                                                }
                                                let t = Object.keys(d).map(k => `${k}=${d[k]}`).join('&')
                                                axios.post(sheet, t, {
                                                    headers: {
                                                        "Content-Type": "application/x-www-form-urlencoded"
                                                    }
                                                })
                                                log({
                                                    text: `${uname(user, user.id)} просит место на лекцию ${c.data().name}\n${seatsData}`,
                                                    user: user.id,
                                                    class: c.id,
                                                    ticket: record.id
                                                })

                    
                                            }).catch(err => {
                                                console.log(err)
                                            })
                                        }
                                    })
                            })

                        
                    })
                } else {

                    if (res) {
                        res.json({
                            success: false,
                            text: 'alreadyBookedClass'
                        })
                    } else {
                        m.sendMessage2({
                            chat_id: user.id,
                            text: translations.alreadyBookedClass[user.language_code] || translations.alreadyBookedClass.en
                        }, false, token)
                    }

                }
            }).catch(err=>{
                console.log(`ошибка bookClass`)
                console.log(err)
            })
    })
}


function alertAdmins(mess) {
    let message = {
        text: mess.text
    }

    let slack = []

    if (mess.type == 'incoming') {
        slack.push({
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": `Что-то непонятное`,
                "emoji": true
            }
        })

        slack.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: mess.text
            }
        })

        slack.push({
            "dispatch_action": true,
            "type": "input",
            "element": {
                "type": "plain_text_input",
                "action_id": "message_" + mess.user_id
            },
            "label": {
                "type": "plain_text",
                "text": "Быстрый ответ",
                "emoji": true
            }
        })

        slack.push({
            "type": "actions",
            "elements": [{
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Заблокировать",
                    "emoji": true
                },
                "value": mess.user_id.toString(),
                "action_id": "user_block"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": `открыть профиль`,
                    "emoji": true
                },
                "value": mess.user_id.toString(),
                "action_id": "userDetails"
            }]
        })


        axios.post(process.env.papersHook, {
            blocks: slack
        }).then(s => {
            if (process.env.develop == 'true') console.log(s.data)
        }).catch(err => {
            console.log(`ошибка отправки сообщения в слак`)
            console.log(err)
        })
    } else if (mess.type == 'newUser') {
        slack.push({
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": `Новый пользователь!`,
                "emoji": true
            }
        })

        slack.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: mess.text
            }
        })

        slack.push({
            "dispatch_action": true,
            "type": "input",
            "element": {
                "type": "plain_text_input",
                "action_id": "message_" + mess.user_id
            },
            "label": {
                "type": "plain_text",
                "text": "Быстрый ответ",
                "emoji": true
            }
        })

        slack.push({
            "type": "actions",
            "elements": [{
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Заблокировать",
                    "emoji": true
                },
                "value": mess.user_id.toString(),
                "style": "danger",
                "action_id": "user_block"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Сделать сотрудником",
                    "emoji": true
                },
                "value": mess.user_id.toString(),
                "action_id": "user_insider"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Сделать админом",
                    "emoji": true
                },
                "style": "primary",
                "value": mess.user_id.toString(),
                "action_id": "user_admin"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Сделать fellows",
                    "emoji": true
                },
                "value": mess.user_id.toString(),
                "style": "primary",
                "action_id": "user_fellow"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Сделать знакомым",
                    "emoji": true
                },
                "value": mess.user_id.toString(),
                "style": "primary",
                "action_id": "user_known"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Снять бонус на коворкинг",
                    "emoji": true
                },
                "value": mess.user_id.toString(),
                "action_id": "user_unBonus"
            }]
        })


        axios.post(process.env.papersHook, {
            blocks: slack
        }).then(s => {
            if (process.env.develop == 'true') console.log(s.data)
        }).catch(err => {
            console.log(err)
        })

        message.reply_markup = {
            inline_keyboard: [
                [{
                    text: 'Заблокировать',
                    callback_data: `user_block_${mess.user_id}`
                }],
                [{
                    text: `Включить в fellows`,
                    callback_data: `user_fellow_${mess.user_id}`
                }],
                [{
                    text: `Сделать сотрудником`,
                    callback_data: `user_insider_${mess.user_id}`
                }],
                [{
                    text: `Сделать админом`,
                    callback_data: `user_admin_${mess.user_id}`
                }],
                [{
                    text: `Снять бонус на коворкинг`,
                    callback_data: `user_bonus_${mess.user_id}`
                }]
            ]
        }
    } else if (mess.type == 'logRecord') {

        slack.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: mess.text
            }
        })

        if (mess.user) {
            slack.push({
                "dispatch_action": true,
                "type": "input",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "message_" + mess.user
                },
                "label": {
                    "type": "plain_text",
                    "text": "Быстрый ответ",
                    "emoji": true
                }
            })

            slack.push({
                "type": "actions",
                "elements": [{
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": `открыть профиль`,
                        "emoji": true
                    },
                    "value": mess.user.toString(),
                    "action_id": "userDetails"
                }]
            })
        }


        axios.post(process.env.papersHook, {
            blocks: slack
        }).then(s => {
            if (process.env.develop == 'true') console.log(s.data)
        }).catch(err => {
            console.log(err)
        })

        message.reply_markup = {
            inline_keyboard: [
                [{
                    text: 'Отписаться от уведомлений',
                    callback_data: `admin_log_unsubscribe`
                }]
            ]
        }
    } else if (mess.type == 'class') {
        slack.push({
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": `Занятия`,
                "emoji": true
            }
        })
        slack.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: mess.text
            }
        })

        slack.push({
            "type": "actions",
            "elements": [{
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Открыть лекцию",
                    "emoji": true
                },
                "value": mess.id.toString(),
                "style": "primary",
                "action_id": "lectureDetails"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": `открыть профиль`,
                    "emoji": true
                },
                "value": mess.user.toString(),
                "action_id": "userDetails"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": `открыть билет`,
                    "emoji": true
                },
                "value": mess.ticket,
                "action_id": "ticketDetails"
            }]
        })


        axios.post(process.env.papersHook, {
            blocks: slack
        }).then(s => {
            if (process.env.develop == 'true') console.log(s.data)
        }).catch(err => {
            console.log(err)
        })
    }

    udb.where(`admin`, '==', true).get().then(admins => {
        admins.docs.forEach(a => {
            message.chat_id = a.id
            if (mess.type != 'stopLog' || !a.data().stopLog) m.sendMessage2(message, false, token)
        })
    })
}

function registerUser(u) {

    u.createdAt = new Date();
    u.active = true;
    u.blocked = false;
    u.bonus = true;

    users[u.id] = u;

    axios.post(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
        "chat_id": u.id,
        "menu_button": {
            "type": "web_app",
            "text": translations.app[u.language_code] || translations.app.en,
            "web_app": {
                "url": process.env.ngrok+"/paper/app"
            }
        }
    })

    udb.doc(u.id.toString()).set(u).then(() => {

        m.sendMessage2({
            chat_id: u.id,
            text: translations.intro[u.language_code] || translations.intro.en,
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: translations.introButton[u.language_code] || translations.introButton.en,
                        web_app: {
                            url: process.env.ngrok + '/paper/app?lang=' + u.language_code
                        }
                    }]
                ]
            }
        }, false, token)

        let d = u;
        d.intention = 'newUser'
        d.id = u.id
        d.createdAt = new Date().toISOString()

        axios.post(sheet, Object.keys(d).map(k => `${k}=${d[k]}`).join('&'), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        }).then(d => {
            // console.log(d.data)
        }).catch(err => {
            console.log(err.message)
        })

        udb.get().then(col=>{

            // if(col.docs.length != 1000){
            //     m.sendMessage2({
            //         chat_id: u.id,
            //         text: `Вы ${col.docs.length}-й подписчик, поздравляем! Теперь вы в курсе всех новостей Papers.`
            //     },false,token)
            // } else {
            //     m.sendMessage2({
            //         chat_id: u.id,
            //         text: `Вы 1000-й подписчик, поздравляем! В честь круглой цифры дарим вам абонемент в коворкинг на 6 дней и билет на любое мероприятие в Papers. Мы скоро свяжемся с вами и расскажем, как воспользоваться подарком.`
            //     },false,token)
            // }

            alertAdmins({
                type: 'newUser',
                text: `Новый пользователь бота (№${col.docs.length}):\n${JSON.stringify(u,null,2)}`,
                user_id: u.id
            })
        })

        

    }).catch(err => {
        console.log(err)
    })


}

function sendMeetingRoom(user) {
    let shift = 0;
    let dates = []
    while (shift < 7) {
        dates.push(new Date(+new Date() + shift * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        shift++
    }
    m.sendMessage2({
        chat_id: user.id,
        text: translations.chooseDate[user.language_code] || translations.chooseDate,
        reply_markup: {
            inline_keyboard: dates.map(d => {
                return [{
                    text: d,
                    callback_data: `mr_date_${d}`
                }]
            })
        }
    }, false, token)
}

function sendCoworking(user) {
    halls
        .where(`active`, '==', true)
        .where('isMeetingRoom', '==', false)
        .where('isCoworking', '==', true)
        .get().then(col => {
            m.sendMessage2({
                chat_id: user.id,
                text: translations.coworkingStart[user.language_code] || translations.coworkingStart.en,
                reply_markup: {
                    inline_keyboard: col.docs.map(h => {
                        return [{
                            text: `${h.data().name}`,
                            callback_data: `coworking_${h.id}`
                        }]
                    })
                }
            }, false, token)


        })
}

function sendHalls(id, lang) {
    halls
        .where(`active`, '==', true)
        .where('isMeetingRoom', '==', false)
        .where('isCoworking', '==', false)
        .get().then(col => {
            col.docs.forEach(h => {
                m.sendMessage2({
                    chat_id: id,
                    caption: `<b>${h.data().name}</b>\n${h.data().description}`,
                    photo: h.data().pics,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: translations.bookHall[lang] || translations.bookHall.en,
                                callback_data: 'book_' + h.id
                            }, {
                                text: translations.hallSchedule[lang] || translations.hallSchedule.en,
                                callback_data: `inquire_${h.id}`
                            }]
                        ]
                    }
                }, 'sendPhoto', token)
            })
        })
}




const translations = {
    openClass:{
        ru: `открыть событие`,
        en: `open app`
    },
    review: {
        ru: `Оставьте отзыв`,
        en: `Review`
    },
    askForReview: {
        ru: `Добавьте пару слов, нам страшно интересно.`,
        en: `Review is well appreciated.`
    },
    notYourTicket: {
        ru: `Извините, но это не ваш билет.`,
        en: `Sorry, but that's not your ticket.`
    },
    noTicket: {
        ru: `Извините, такого билета не существует.`,
        en: `Sorry, there's no such ticket.`
    },
    thanks:{
        ru: `Спасибо!`,
        en: `Thank you!`
    },
    spareTicket:(name)=>{
        return {
            ru: `Кажется, вы хотели сходить на мероприятие «${name}», но не хватило мест?\nХорошие новости: билет как раз освободился.`,
            en: `Looks like you wanted to attent ${name}, but we've run out of spare seats. Good news: a ticket had just been spared.`
        }
    },
    planConfirmed:(plan)=>{
        return {
            ru: `Поздравляем! Вы оформили подписку на план ${plan.name}. Он будет действовать в течение ${plan.days} дней.`,
            en: `Congratulations! You've bought a plan for ${plan.visits} visits and ${plan.events}. Feel free to use it in the next ${plan.days} days.`
        }
    },
    feedBackRequest:(ticket)=>{
        return {
            ru: `Здравствуйте! Как вам наше мероприятие (${ticket.className})? Поставьте оценку (это вполне анонимно).`,
            en: `Hello! Please, rate the event (${ticket.className}).`
        }
    },
    notifications: {
        ru: `Получать сообщения о новых событиях`,
        en: `Subscribe to upcomning events`
    },
    unsubscribe: {
        ru: `Отписаться от новостей`,
        en: 'Unsubscribe'
    },
    unsubscribeMessage: {
        ru: `Итак, вы отписаны. Но всегда можете передумать — и подписаться на новые лекции через приложение (раздел «Профиль»).`,
        en: `You won't get any messages about upcoming events. If can turn them on again in Profile section of the built-in app.`
    },
    toKnow: {
        en: `30 GEL per day. The first day is for free.`,
        ru: `Стоимость — 30 лари в день, первый тестовый день — бесплатно.`
    },
    iliani: {
        en: '1/10 Veriko Anjaparidze St, Tbilisi, Georgia',
        ru: `Тбилиси, Улица Верико Анджапаридзе, 1/10.`,
        ka: `1/10 ვერიკო ანჯაფარიძის ქუჩა, თბილისი`
    },
    address: {
        en: 'Address',
        ru: 'Адрес'
    },
    contacts: {
        ru: `Контакты`,
        en: `Contacts`
    },
    undeposit: (v, left) => {
        return {
            ru: `С вашего счета было списано ${common.cur(+v,'GEL')}.`,
            en: `${common.cur(+v,'GEL')} was withdrawn from your account.`
        }
    },
    deposit: (v, left) => {
        return {
            ru: `На ваш счет было зачислено ${common.cur(+v,'GEL')}.`,
            en: `${common.cur(+v,'GEL')} was deposited on your account`
        }
    },
    welcomeOnPremise: {
        ru: `Добро пожаловать! Ваш билет был принят.\nЕсли произошла ошибка и вы не находитесь в Papers, пожалуйста, напишите об этом.\nВопросы лектору (или организаторам) вы можете задать через приложение, на странице мероприятия.\nТам же вы сможете поставить оценку и оставить отзыв о мероприятии (они очень важны для нас).`,
        en: `Glad to see you on premise.\nIf there's been a mistake and you are not in Papers Space right now, please, write about immediately.`
    },
    roomBlocked: {
        ru: `Извините, в этот день комната закрыта на спецобслуживание.`,
        en: `We're sorry, but the room is closed on that day.`
    },
    coworkingBookingConfirmedBonus: {
        ru: `Ждем вас по адресу 1 Veriko Anjaparidze (вход под вывеской ILIANI Hotel), c 9:00 до 21:00.  Если у вас будут вопросы, пишите прямо в чат-бот, и наш администратор вам ответит.`,
        en: 'We are waiting for you at 1 Veriko Anjaparidze (entrance under the sign of ILIANI Hotel), from 9:00 to 21:00. If you have any questions, write directly to the chatbot and our administrator will answer you.',
        ka: `გელოდებით ვერიკო ანჯაფარიძის 1-ში (შესასვლელი სასტუმრო ილიანის ნიშნით), 9:00-დან 21:00 საათამდე. თუ თქვენ გაქვთ რაიმე შეკითხვები, მოგვწერეთ პირდაპირ ჩატბოტზე და ჩვენი ადმინისტრატორი გიპასუხებთ.`
    },
    coworkingInit: {
        ru: `Прежде чем записаться, пожалуйста, заполните профиль. Помимо всего, напишите 3 предложения о себе: мы будем рады узнать, с кем мы делим пространство.`,
        en: `Please complete your profile before enrolling. Above all, write 3 sentences about yourself: we'd love to know who we're sharing the space with.`,
        ka: `გთხოვთ შეავსოთ თქვენი პროფილი რეგისტრაციამდე. უპირველეს ყოვლისა, დაწერეთ 3 წინადადება თქვენს შესახებ: ჩვენ გვსურს ვიცოდეთ ვისთან ერთად ვიზიარებთ სივრცეს.`
    },
    app: {
        ru: `Приложение`,
        en: 'App',
        ka: `App`
    },
    about: {
        en: `About`,
        ru: `Пару слов о себе`
    },
    media: {
        en: `Journalism`,
        ru: `Журналистика`
    },
    lawyer: {
        en: `Law`,
        ru: `Юриспруденция`
    },
    advertisement: {
        en: `PR & Advertisement`,
        ru: `Реклама и PR`
    },
    it: {
        en: `IT`,
        ru: `IT`
    },
    other: {
        en: `Other`,
        ru: `Другое`
    },

    profileSubTitle: {
        en: `Nice to meet you, by the way.`,
        ru: `Видим вас как наяву.`
    },
    dataMissing: {
        ru: `Прежде чем записаться, пожалуйста, заполните профиль. Помимо всего, напишите 3 предложения о себе: мы будем рады узнать, с кем мы делим пространство.`,
        en: `Please complete your profile before enrolling. Above all, write 3 sentences about yourself: we'd love to know who we're sharing the space with.`,
        ka: `გთხოვთ შეავსოთ თქვენი პროფილი რეგისტრაციამდე. უპირველეს ყოვლისა, დაწერეთ 3 წინადადება თქვენს შესახებ: ჩვენ გვსურს ვიცოდეთ ვისთან ერთად ვიზიარებთ სივრცეს.`
    },
    fellow: {
        ru: `Поздравляем! Вы зарегистрированы в программе fellows!`,
        en: `Congrats! You're in the fellows team!`
    },
    coworkingBookingDetails: (date, name, lang) => {
        return {
            ru: `Вы записались в коворкинг (${translations.room[lang] || translations.room.en} ${name}) на ${drawDate(date,lang)}.`,
            en: `You booked a place at ${translations.room[lang] || translations.room.en} ${name} on ${drawDate(date,lang)}.`
        }
    },
    save: {
        ru: `Сохранить`,
        en: 'Save and close'
    },
    saved: {
        ru: `Записано!`,
        en: 'Saved'
    },
    seats: {
        ru: `мест`,
        en: 'seats'
    },
    floor: {
        ru: `Этаж`,
        en: 'Floor'
    },
    room: {
        ru: `Кабинет`,
        en: 'Room'
    },
    mr: {
        ru: `Переговорка`,
        en: 'Meeting room'
    },
    bookOn: (d) => {
        return {
            ru: `Забронировать на ${d}`,
            en: `Book on ${d}`
        }
    },
    unbookOn: (d) => {
        return {
            ru: `Снять бронь на ${d}`,
            en: `Cancel on ${d}`
        }
    },
    enlisted: {
        ru: `вы записаны`,
        en: `your are in`
    },
    noOccupationProvided: {
        ru: 'Прежде, чем записаться в коворкинг, вам надо указать сферу своей деятельности. Пожалуйста, перейдите в "профиль" и внесите контактные данные',
        en: 'You haven\'t set your occupation yet. Please, provide your contacts in the Profile section.'
    },
    noEmailProvided: {
        ru: 'Прежде, чем записаться в коворкинг, вам надо указать свою почту. Пожалуйста, перейдите в "профиль" и внесите контактные данные',
        en: 'You haven\'t set your email yet. Please, provide your contacts in the Profile section.'
    },
    email: {
        ru: 'email',
        en: 'email'
    },
    name: {
        ru: 'Имя',
        en: 'First name',
        ka: 'სახელი'
    },
    sname: {
        ru: 'Фамилия',
        en: 'Family name',
        ka: 'გვარი'
    },
    occupation: {
        ru: 'укажите род деятельности',
        en: 'what\'s you occupation',
        ka: 'საქმიანობის სფერო'
    },
    loading: {
        ru: 'Загружаем данные',
        en: 'Loading data',
        ka: 'ვტვირთავთ ინფორმაციას'
    },
    profile: {
        ru: 'Профиль',
        en: 'Profile',
        ka: 'პროფილი'
    },
    coworkingRules: {
        ru: 'Смотреть правила',
        en: 'See rules',
        ka: 'იხილეთ წესები'
    },
    classClosed: (c) => {
        return {
            en: `We are sorry to inform you, that ${eTypes[c.type].en} ${c.name} was cancelled. Stay tuned, we're gonna come up with even better events.`,
            ru: `Случилось страшное: ${eTypes[c.type].ru} «${c.name}» отменяется.\nНадеемся увидеть вас на других мероприятиях. Остаемся на связи.`,
            ka: `ბოდიშს გიხდით გაცნობებთ, რომ ${eTypes[c.type].ka} ${c.name} გაუქმდა. თვალყური ადევნეთ, ჩვენ კიდევ უფრო კარგ მოვლენებს მოვაწყობთ`
        }
    },
    yourCode: {
        ru: 'Ваш код (вместо билета, лучше него)',
        en: `Your entrance code`,
        ka: 'თქვენი ბილეთის კოდი'
    },
    newLecture: (l) => {
        return {
            ru: `Отличные новости! Мы подготовили ${eTypes[l.type].nom}: «${l.name}».${l.author ? ` Ее проведет ${l.author}` : ''}, ${new Date(l.date).toLocaleDateString()}.\nНачало в ${new Date(l.date).toLocaleTimeString(
                'ru-RU',{
                    timeZone: 'Asia/Tbilisi'
                }
            )}${l.price?`\nСтоимость: ${common.cur(l.price,'GEL')}`:''}`,
            en: `Hello there! We have a new ${eTypes[l.type].en} coming: ${l.name} by ${l.author} on ${new Date(l.date).toLocaleDateString()}.`,
            ka: `გაუმარჯოს! ჩვენ გვაქვს ახალი ${eTypes[l.type].ka} მომავალი: ${l.name} ${l.author}-ის მიერ ${new Date(l.date).toLocaleDateString()}`
        }
    },
    tellMeMore: {
        ru: 'Подробнее',
        en: 'More',
        ka: 'დამატებითი ინფორმაცია'
    },
    coworkingReminder: (hall) => {
        return {
            ru: `Доброе утро! Просто напоминаю, что сегодня вас ждут в коворкинге. Комната ${hall.name}, ${hall.floor} этаж.`,
            en: `Good morning! Looking forward to meet you at our coworking. Room ${hall.name}, on the ${hall.floor}.`,
            ka: `დილა მშვიდობისა! გახსენებთ, რომ დღეს თქვენ ხართ ჩაწერილი კოვორკინგში. ოთახი ${hall.name}, ${hall.floor} სართული`
        }
    },
    mrReminder: (t) => {
        return {
            ru: `Напоминаем, что через пару минут (в ${t}) для вас забронирована переговорка.`,
            en: `Just to remind you, that you have booked a meeting room on ${t}.`,
            ka: `შეგახსენებთ, რომ 2 წუთში ${t}-ზე თქვენ გაქვთ ჩაწერა საკონფერენციო ოთახში`
        }
    },
    schedule: {
        ru: 'Афиша мероприятий',
        en: 'Events',
        ka: 'განრიგი'
    },
    coworking: {
        ru: 'Записаться в коворкинг',
        en: 'Coworking',
        ka: 'კოვორკინგი'
    },
    mr: {
        ru: 'Переговорка',
        en: 'Meeting Room',
        ka: 'საკონფერენციო ოთახი'
    },
    paymentTitleClass: (l) => {
        return {
            ru: `Оплата лекции ${l.name}`,
            en: `Payment for the lecture ${l.name}`,
            ka: `ლექციის გადახდა ${l.name}`
        }
    },
    nosais: {
        ru: `Извините, я не знаю такой команды. Уведомлю админа; кажется, что-то пошло не так...`,
        en: `Beg your pardon, I have no idea what to do about this task. I shall talk to my master...`,
        ka: 'გიხდით ბოდიშს, ასეთ ბრძანებას ვერ ვიგებ. ადმინისტრატორზე გადაგრთავთ.'
    },
    congrats: {
        en: 'Welcome aboard! You are registered as coworker.',
        ru: 'Поздравляем, вы зарегистрированы как сотрудник papers',
        ka: 'გილოცავთ, თქვენ დარეგისტრირდით როგორც Papers-ის თანამშრომელი'
    },
    book: {
        ru: 'Записаться',
        en: 'Book a place',
        ka: 'ჩაწერვა'
    },
    noFee: {
        ru: 'Вход бесплатный ',
        en: 'Free admittance',
        ka: 'უფასო შესვლა'
    },
    fee: {
        ru: 'Стоимость ',
        en: 'Entry fee ',
        ka: 'შესვლა'
    },
    hall: {
        ru: 'Зал',
        en: 'Hall'
    },
    author: {
        ru: 'Спикер',
        en: 'Speaker',
        ka: 'ავტორი'
    },
    minutes: {
        ru: 'минут',
        en: 'minutes',
        ka: 'წუთი'
    },
    bookHall: {
        ru: 'Забронировать зал',
        en: 'Book the space',
        ka: 'ოთახია დაჯავშნა'
    },
    hallSchedule: {
        ru: 'Посмотреть график',
        en: 'Schedule',
        ka: 'განრიგის ნახვა'
    },
    intro: {
        ru: `Добро пожаловать в пространство PAPERS от Paper Kartuli. Тут можно забронировать место в коворкинге или переговорке, посмотреть расписание лекций, — или сразу пройти в бар.\nУдобнее всего пользоваться ботом с помощью приложения: вот эта кнопочка внизу (или в нижнем левом углу).Вы можете записаться на бесплатный тестовый день в коворкинге. Следующие дни — по стандартному тарифу (30 GEL в день, оплата на месте). Для аренды переговорки или ивент-пространства, напишите прямо в наш чат-бот, и наш администратор вам ответит.`,
        en: `Welcome to the PAPERS space by Paper Kartuli. Here you can book a place in a coworking or meeting room, see the lecture schedule, or go straight to the bar.\nThe most convenient way to use the bot is through the application: this button is at the bottom (or in the lower left corner). You can sign up for a free test day in a coworking space. The following days - at the standard rate (30 GEL per day, payable locally). To rent a meeting room or event space, write directly to our chatbot, and our administrator will answer you.`,
        ka: 'კეთილი იყოს თქვენი მობრძანება Paper Kartuli-ის PAPERS სივრცეში, აქ შეგიძლიათ დაჯავშნოთ ადგილი კოვორკინგში ან შეხვედრების ოთახში, ნახოთ ლექციების განრიგი ან პირდაპირ ბარში ჩაბრძანდეთ. ბოტის გამოყენების ყველაზე მოსახერხებელი გზაა აპლიკაციის საშუალებით: ეს არის ქვედა ღილაკი (ან ქვედა მარცხენა კუთხეში) შეგიძლიათ დარეგისტრირდეთ უფასო ტესტის დღეს კოვორკინგის სივრცეში. მომდევნო დღეებში - სტანდარტული ღირებულობით (დღეში 30 ლარი, გადასახდელი ადგილობრივად). შეხვედრების ოთახის ან ღონისძიების სივრცის დასაქირავებლად მოგვწერეთ პირდაპირ ჩვენს ჩატბოტში და ჩვენი ადმინისტრატორი გიპასუხებთ.'
    },
    introButton: {
        ru: `Открыть приложение`,
        en: `release the kraken!`,
        ka: 'აპლიკაციის გახსნა'
    },
    payOnSite: {
        ru: `Оплачу на месте.`,
        en: `I'll pay on premise.`,
        ka: 'ადგილზე გადავიხდი'
    },
    pay: (v) => {
        return {
            ru: `Оплатить ${v}`,
            en: `Pay ${v}`,
            ka: `გადახდა ${v}`
        }
    },
    lectureInvite: (l) => {
        return {
            ru: `Отлично! Ждем вас на лекции «${l.name}».${l.price?`\n\nОбратите внимание: к оплате на месте ${common.cur(l.price,'GEL')}`:''}`,
            en: `Great! Looking forward to meeting you. ${l.price?`\n\nBeware: entrance fee is ${common.cur(l.price,'GEL')}`:''}`,
            ka: `დიდი! გელოდებით ლექციაზე "${l.name}"`
        }
    },
    lectureReminder: (l) => {
        return {
            ru: `Напоминаем, что сегодня в ${l.time} мы ждем вас на лекции ${l.name}.${(l.price&&!l.payed)?`\n\nОбратите внимание: к оплате на месте ${common.cur(l.price,'GEL')}`:''}`,
            en: `Let me remind you of upcoming event today: ${l.name} at ${l.time}. ${l.price?`\n\nBeware: entrance fee is ${common.cur(l.price,'GEL')}`:''}`,
            ka: `შეგახსენებთ, რომ დღეს ${l.time}-ზე გელოდებით ლექციაზე ${l.name}`
        }
    },
    lectureConfirm: {
        ru: `Отлично! Ждем вас на лекции. Подробнее в сообщениях.`,
        en: `Great! Looking forward to meet you. You'll get a message with all necessary details.`
    },
    alreadyCancelled: {
        ru: 'Эта запись уже отменена',
        en: 'This record had already been cancelled'
    },
    hallNotAvailable: {
        ru: 'Извиние, это помещение более недоступно',
        en: `Sorry, this space is no available any more.`
    },
    letsTryAgain: {
        en: `One more time?`,
        ru: 'Попробуем еще разок?'
    },
    error: {
        en: 'We\'re sorry. An unexpected error occured. Sheep happened',
        ru: `Непредвиденная ошибка. Мы уже уведомили админа.`
    },
    bookingCancelled: {
        en: 'Your booking was cancelled',
        ru: `Запись отменена`
    },
    timeSelected: (d) => {
        return {
            ru: 'Время: ' + d,
            en: `Time: ${d}`
        }
    },
    dateSelected: (d) => {
        return {
            ru: 'Выбранная дата: ' + d,
            en: `Date chosen: ${d}`
        }
    },
    onIt: {
        ru: 'Секундочку',
        en: 'Just a sec...'
    },
    coworkingBookingCancel: {
        ru: 'Отменить бронь',
        en: 'Cancel booking'
    },
    coworkingBookingConfirmed: {
        ru: 'Это время забронировано за вами',
        en: 'You are in!'
    },
    youArBanned: {
        ru: 'Извините, вам будут не рады...',
        en: 'Sorry, we can\'t let you in...'
    },
    noSeatsLeft: {
        ru: 'Простите, но свободных мест не осталось. Мы напишем, если они появятся.',
        en: `We are sorry — no seats lefts. We'll let you know if a spare ticket shows up.`
    },
    alreadyBooked: {
        ru: 'Это место уже захвачено, мон колонель!',
        en: 'You have already booked a place.'
    },
    alreadyBookedClass: {
        ru: 'Извините, но вы уже записывались на эту лекцию.',
        en: 'You have already booked a place.'
    },
    seats: {
        ru: `мест`,
        en: 'seats'
    },
    chooseDate: {
        ru: `Выберите день`,
        en: `Choose a date`
    },
    chooseTime: {
        ru: `Выберите время`,
        en: `Choose time`
    },
    coworkingStart: {
        ru: `Выберите зал, в котором хотели бы работать.`,
        en: `Choose a space to work in.`
    },
    noSchedule: {
        ru: 'Извините, пока что тут пусто. Мы пришлем весточку, когда добавим что-то новое.',
        en: `Ooops! Nothing to show yet. Stay tuned.`
    },
    noClasses: {
        ru: 'Извините, дорогой друг. Вы еще не записывались. Или мы что-то забыли...\nНажмите /classes — мы покажем расписание на ближайшие дни',
        en: `Ooops! Nothing to show yet. Press /classes to see upcoming events.`
    },
    noAppointment: {
        ru: `Извините, такой записи в природе не существует`,
        en: 'Sorry, we have no idea of the appointment. Where did you get it?..'
    },
    unAuthorized: {
        ru: 'Терпеть не можем это говорить, но... у вас нет права на совершение этой операции.',
        en: `Sorry, you are not authorized to perform the action.`
    },
    appointmentCancelled: {
        ru: 'Культура отмены — тоже культура. Ваша запись снята',
        en: 'Cancel culture marching. You\'re free to go'
    },
    alreadyPayed: {
        ru: 'Вай мэ, дорогой товарищ, ваш билет уже оплачен.',
        en: 'That\'s sweet, but you have already payed for the ticket'
    },
    paymentDesc: {
        ru: `После покупки билета вы получите код — просто покажите его при входе.`,
        en: `Once the payment is through you get a code. Just show it at the reception.`
    },
    userBlocked: {
        ru: `Извините, ваш аккаунт был заблокирован.`,
        en: `Sorry, but your account was blocked.`
    }
}

function log(o) {
    o.createdAt = new Date()

    logs.add(o).then(r => {

        alertAdmins({
            text:   o.text,
            type:   (o.class && o.user) ? 'class' : 'logRecord',
            id:     o.class,
            user:   o.user || o.user_id || null,
            ticket: o.ticket
        })

        // if(process.env.develop != 'true'){
        //     if(!o.silent){
        //         alertAdmins({
        //             text:   o.text,
        //             type:   o.class? 'class' : 'logRecord',
        //             id:     o.class
        //         })
        //     }
        // }

        axios.post(sheet, `text=${o.text}`, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        })
    })
}


function sendUserClasses(id, lang, past) {
    userClasses
        .where('user', '==', id)
        .where('active', '==', true)
        .get().then(col => {
            let d = []
            col.docs.forEach(record => {
                d.push(classes.doc(record.data().class).get().then(cl => {
                    let t = cl.data()
                    t.id = cl.id;
                    t.appointment = record.id
                    return t
                }))
            })

            Promise.all(d).then(data => {
                if (!data.length) {
                    m.sendMessage2({
                        chat_id: id,
                        text: translations.noClasses[lang] || translations.noClasses.en
                    }, false, token)
                } else {
                    data.forEach(h => {
                        let message = {
                            chat_id: id,
                            text: `${common.drawDate(h.date(),false,{time:true})}, ${h.duration} ${translations.minutes[lang] ||  translations.minutes.en}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description}\n${h.price? `${translations.fee[lang] ||  translations.fee.en} ${common.cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`,
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: `${translations.coworkingBookingCancel[lang] ||  translations.coworkingBookingCancel.en}`,
                                        callback_data: 'unclass_' + h.appointment
                                    }]
                                ]
                            }
                        }
                        if (h.noRegistration) {
                            delete message.reply_markup
                        }

                        h.pic = process.env.ngrok + `/paper/qr?id=${h.appointment}&entity=userClasses`

                        if (h.pic) {
                            message.caption = message.text.slice(0, 900)
                            message.photo = h.pic
                            // delete message.text
                        }

                        m.sendMessage2(message, (h.pic ? 'sendPhoto' : false), token)
                    })
                }

            })
        })
}

function sendClasses(id, lang) {
    classes
        .where(`active`, '==', true)
        .where('date', '>=', new Date(+new Date()-2*60*60*1000).toISOString())
        .orderBy('date')
        .get().then(col => {
            col.docs.forEach(h => {

                t = h.id
                h = h.data()
                h.id = t

                let message = {
                    chat_id: id,
                    text: `${common.drawDate(h.date,false,{time:true})}, ${h.duration} ${translations.minutes[lang] ||  translations.minutes.en}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description}\n${h.price? `${translations.fee[lang] ||  translations.fee.en} ${common.cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: translations.book[lang] || translations.book.en,
                                callback_data: 'class_' + h.id
                            }]
                        ]
                    }
                }

                if (h.noRegistration) {
                    delete message.reply_markup
                }

                if (h.pic) {
                    message.caption = message.text.slice(0, 1000)
                    message.photo = h.pic
                    // delete message.text
                }

                m.sendMessage2(message, (h.pic ? 'sendPhoto' : false), token)
            })
        })
}

function showBookings(id) {

}

function interprete(field, value) {
    switch (field) {
        case 'admin': {
            return value ? `делает админом` : `снимает админство с`
        }
        case 'insider':
            return value ? `делает сотрудником` : `убирает из сотрудников`
        case 'blocked':
            return value ? `добавляет в ЧС` : `убирает из бана`
        case 'fellow':
            return value ? `включает в программу fellows` : `убирает из fellows`
        default:
            return `делает что-то необычно: поле ${field} становится ${value}`
    }
}

router.post(`/news`, (req, res) => {
    isAdmin(req.query.id).then(p => {

        if (p || req.headers.secret == process.env.paperSlackToken) {

            if (req.body.text && req.body.name) {
                news.add({
                    text:       req.body.text,
                    createdBy:  +req.query.id || req.body.by,
                    createdAt: new Date(),
                    name: req.body.name,
                    inline_keyboard: req.body.inline_keyboard || null
                }).then(ref => {

                    log({
                        text: `Админ @id${req.query.id} стартует рассылку с рабочим названием «${req.body.name}».`,
                        admin: +req.query.id,
                        silent: true
                    })

                    udb.get().then(col => {

                        let s = []

                        col.docs.forEach(u => {

                            let message = {
                                chat_id: u.id,
                                text: req.body.text
                            }

                            if (req.body.silent) {
                                message.disable_notification = true
                            }

                            if (req.body.inline_keyboard) {
                                message.reply_markup = {
                                    inline_keyboard: req.body.inline_keyboard
                                }
                            }
                            let pass = true;

                            if (req.body.filter) {


                                let field = req.body.filter.split('_')[0]
                                let value = req.body.filter.split('_')[1] == 'true' ? true : false;
                                if (u.data()[field] != value) {
                                    pass = false
                                }


                            }
                            // u.id == common.dimazvali &&  
                            if (pass) {
                                s.push(m.sendMessage2(message, false, token).then(() => true).catch(err => false))

                                messages.add({
                                    user: u.id,
                                    text: message.text || message.caption,
                                    createdAt: new Date(),
                                    isReply: true
                                })
                            }



                        })

                        Promise.all(s).then(line => {
                            res.json({
                                success: line.filter(m => m),
                                decline: line.filter(m => !m)
                            })

                            news.doc(ref.id).update({
                                recieved: line.filter(m => m).length
                            })
                        })
                    })
                })


            } else {
                res.sendStatus(400)
            }

        } else {
            res.sendStatus(403)
        }

    })

})

function isAdmin(id) {
    return udb.doc(id || 'noWay').get().then(a => {
        if (!a.exists) return false
        if (a.data().admin) return true
        return false
    }).catch(err => {
        return false
    })
}

function checkUser(id) {
    return udb.doc(id.toString()).get().then(u => {
        return !u.data().blocked
    }).catch(err => {

        alertAdmins({
            text: `ошибка проверки пользователя: ${err.message}`
        })

        return false;

    })
}

function sorry(user, type) {
    m.sendMessage2({
        chat_id: user.id,
        text: translations.userBlocked[user.language_code] || translations.userBlocked.en
    }, false, token)

    if (type) {
        alertAdmins({
            text: `Пользвателю ${uname(user, user.id)} было отказано в ${type}.`
        })
    }
}

router.post(`/slack/loader`, (req, res) => {
    let data = JSON.parse(req.body.payload)

    if (process.env.develop == 'true') console.log(data)

    switch (data.block_id) {
        case 'hall': {
            halls.where('active', '==', true).get().then(h => {

                res.json({
                    options: common.handleQuery(h).map(hall => {
                        return {
                            "text": {
                                "type": "plain_text",
                                "text": hall.name.toString()
                            },
                            "value": hall.id
                        }
                    })
                })
            })
            break;
        }
        case 'lectures': {
            classes
                .where('active', '==', true)
                .where('date', '>=', new Date())
                .get()
                .then(col => {
                    res.json({
                        options: common.handleQuery(col).map(lecture => {
                            return {
                                "text": {
                                    "type": "plain_text",
                                    "text": lecture.name
                                },
                                "value": lecture.id
                            }
                        })
                    })
                    // common.handleQuery(col).forEach(record => {
                    //     remindOfClass(record)
                    // })
                }).catch(err => {
                    console.log(err)
                })
            break;
        }
        default: {
            return res.json({
                options: []
            })
        }
    }
})


router.post(`/slack/q`, (req, res) => {
    res.status(200).send()
    return axios.post(
        'https://slack.com/api/views.open', {
            trigger_id: req.body.trigger_id,
            view: modals.newQ
        }, {
            headers: {
                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                'Content-Type': 'application/json',
            }
        }
    ).then(s => {
        if (process.env.develop == 'true') console.log(s.data)
    }).catch(err => {
        console.log(err.message)
    })
})


router.post(`/slack/qs`, (req, res) => {
    res.status(200).send()
    polls.get().then(col => {
        return axios.post(
            'https://slack.com/api/views.open', {
                trigger_id: req.body.trigger_id,
                view: modals.qList(common.handleQuery(col))
            }, {
                headers: {
                    'Authorization': 'Bearer ' + process.env.paperSlackToken,
                    'Content-Type': 'application/json',
                }
            }
        ).then(s => {
            if (process.env.develop == 'true') console.log(s.data)
        }).catch(err => {
            console.log(err.message)
        })
    })


})

router.post(`/slack/lecture`, (req, res) => {
    res.status(200).send()
    return axios.post(
        'https://slack.com/api/views.open', {
            trigger_id: req.body.trigger_id,
            view: modals.newLecture
        }, {
            headers: {
                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                'Content-Type': 'application/json',
            }
        }
    ).then(s => {
        if (process.env.develop == 'true') console.log(s.data)
    }).catch(err => {
        console.log(err.message)
    })
})

router.post(`/slack/users`, (req, res) => {
    res.status(200).send()
    udb.get().then(u => {
        return axios.post(
            'https://slack.com/api/views.open', {
                trigger_id: req.body.trigger_id,
                view: modals.users(common.handleQuery(u))
            }, {
                headers: {
                    'Authorization': 'Bearer ' + process.env.paperSlackToken,
                    'Content-Type': 'application/json',
                }
            }
        ).then(s => {
            if (process.env.develop == 'true') console.log(s.data)
        }).catch(err => {
            console.log(err.message)
        })
    })

})



router.get('/alertClass/:class', (req, res) => {
    classes.doc(req.params.class).get().then(cl => {
        let h = cl.data();
        h.id = req.params.class
        udb.get().then(col => {

            let users = common.handleQuery(col)

            users.forEach(u => {
                console.log(u.id)
                if (!u.noSpam) {

                    lang = u.language_code

                    let kbd = [
                        [{
                            text: translations.book[lang] || translations.book.en,
                            callback_data: 'class_' + h.id
                        }]
                    ]



                    if (h.noRegistration) {
                        kbd = []
                    }

                    kbd.push([{
                        text: translations.unsubscribe[lang] || translations.unsubscribe.en,
                        callback_data: `unsubscribe`
                    }])

                    let message = {
                        chat_id: u.id,
                        text: `${common.drawDate(h.date,false,{time:true})}, ${h.duration} ${translations.minutes[lang] ||  translations.minutes.en}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description}\n${h.price? `${translations.fee[lang] ||  translations.fee.en} ${common.cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: kbd
                        }
                    }

                    if (h.pic) {
                        message.caption = message.text.slice(0, 1000)
                        message.photo = h.pic
                        // delete message.text
                    }
                    // if(u.admin ) 
                    m.sendMessage2(message, (h.pic ? 'sendPhoto' : false), token)
                }
            })
        })
    })

})

router.post(`/slack/mr`, (req, res) => {
    res.status(200).send()
    console.log(modals.mr())
    return axios.post(
        'https://slack.com/api/views.open', {
            trigger_id: req.body.trigger_id,
            view: modals.mrDate()
        }, {
            headers: {
                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                'Content-Type': 'application/json',
            }
        }
    ).then(s => {
        if (process.env.develop == 'true') console.log(s.data)
    }).catch(err => {
        console.log(err.message)
    })

})


router.post(`/slack/tags`, (req, res) => {
    res.status(200).send(`Загружаем теги...`)
    userTags.get().then(col => {
        return axios.post(
            'https://slack.com/api/views.open', {
                trigger_id: req.body.trigger_id,
                view: modals.tags(common.handleQuery(col))
            }, {
                headers: {
                    'Authorization': 'Bearer ' + process.env.paperSlackToken,
                    'Content-Type': 'application/json',
                }
            }
        ).then(s => {
            if (process.env.develop == 'true') console.log(s.data)
        }).catch(err => {
            console.log(err.message)
        })
    })

})


router.post('/slack/campaign', (req, res) => {
    res.status(200).send()
    return axios.post(
        'https://slack.com/api/views.open', {
            trigger_id: req.body.trigger_id,
            view: modals.campaign
        }, {
            headers: {
                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                'Content-Type': 'application/json',
            }
        }
    ).then(s => {
        if (process.env.develop == 'true') console.log(s.data)
    }).catch(err => {
        console.log(err.message)
    })
})


router.post(`/slack/lecturesList`, (req, res) => {
    res.status(200).send()
    return axios.post(
        'https://slack.com/api/views.open', {
            trigger_id: req.body.trigger_id,
            view: modals.lectures
        }, {
            headers: {
                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                'Content-Type': 'application/json',
            }
        }
    ).then(s => {
        if (process.env.develop == 'true') console.log(s.data)
    }).catch(err => {
        console.log(err.message)
    })
})

router.post(`/slack/lectures`, (req, res) => {
    res.sendStatus(200);
    classes
        .where(`active`, '==', true)
        // .where('date', '>=', new Date().toISOString())
        .orderBy('date', 'desc')
        .limit(20)
        .get().then(col => {

            return axios.post(
                'https://slack.com/api/views.open', {
                    trigger_id: req.body.trigger_id,
                    view: modals.lecturesList(common.handleQuery(col))
                }, {
                    headers: {
                        'Authorization': 'Bearer ' + process.env.paperSlackToken,
                        'Content-Type': 'application/json',
                    }
                }
            ).then(s => {
                if (process.env.develop == 'true') console.log(s.data)
            }).catch(err => {
                console.log(err.message)
            })

        })

})

router.post(`/slack/coworking`, (req, res) => {
    res.send(`Сейчас откроется коворкинг...`);
    halls
        .where(`isCoworking`, '==', true)
        .where('active', '==', true)
        .orderBy('name', 'asc')
        .get().then(col => {

            return axios.post(
                'https://slack.com/api/views.open', {
                    trigger_id: req.body.trigger_id,
                    view: modals.coworking(common.handleQuery(col))
                }, {
                    headers: {
                        'Authorization': 'Bearer ' + process.env.paperSlackToken,
                        'Content-Type': 'application/json',
                    }
                }
            ).then(s => {
                if (process.env.develop == 'true') console.log(s.data)
            }).catch(err => {
                console.log(err.message)
            })

        })

})

router.post('/slack', (req, res) => {
    let data = {}

    if (req.body.payload) {
        data = JSON.parse(req.body.payload)
    } else {
        data = req.body
    }

    if (process.env.develop == 'true') console.log(req.body.payload)

    switch (data.type) {
        case "block_actions": {
            let a = data.actions[0];
            let inc = a.action_id.split('_')


            if (process.env.develop == 'true') console.log(inc)

            switch (inc[0]) {

                case 'pollDetails': {
                    let d = []

                    d.push(polls.doc(a.value).get().then(d => d.data()))
                    d.push(pollsAnswers.where('q', '==', a.value).get().then(col => common.handleQuery(col)))

                    return Promise.all(d).then(d => {

                        let users = [];

                        if (d[1].length) {
                            d[1].forEach(u => {
                                users.push(m.getUser(u.user, udb))
                            })
                        }

                        Promise.all(users).then(u => {
                            console.log(u)
                            axios.post(
                                'https://slack.com/api/views.update',
                                modals.qDetails(data.view.id, a.value, d[0], d[1], u), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            )
                        })


                    })

                    break;
                }

                case 'deposit': {
                    return udb.doc(inc[1]).get().then(u => {
                        let user = u.data()
                        if (user.active && !user.blocked) {

                            if (+a.value == 0 || +a.value < 0) return axios.post(
                                'https://slack.com/api/views.update',
                                modals.err(data.view.id, `Некорректная сумма депозита!`), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            )
                            udb.doc(inc[1]).update({
                                deposit: FieldValue.increment(+a.value)
                            }).then(() => {
                                axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.omniSuccess(data.view.id, `Депозит ${common.cur(+a.value,'GEL')} успешно зачислен на счет пользовател ${common.uname(user,inc[1])}`), {
                                        headers: {
                                            'Content-type': 'application/json',
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                                        }
                                    }
                                )
                                m.sendMessage2({
                                    chat_id: inc[1],
                                    text: translations.deposit(+a.value)[user.language_code] || translations.deposit(+a.value).en
                                }, false, token)

                                log({
                                    text: `Админ ${data.user.username} зачисляет пользователю ${common.uname(user,inc[1])} депозит в ${common.cur(+a.value,'GEL')}`,
                                    user: +inc[1]
                                })
                            })
                        } else {
                            axios.post(
                                'https://slack.com/api/views.update',
                                modals.err(data.view.id, `Этот пользователь заблокирован или не найден`), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            )
                        }
                    })

                }

                case 'undeposit': {
                    return udb.doc(inc[1]).get().then(u => {
                        let user = u.data()
                        if (user.active && !user.blocked) {

                            if (+a.value == 0 || +a.value < 0 || user.deposit < +a.value) return axios.post(
                                'https://slack.com/api/views.update',
                                modals.err(data.view.id, `Некорректная сумма списания (или текущего депозита недостаточно)!`), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            )
                            udb.doc(inc[1]).update({
                                deposit: FieldValue.increment(-Number(a.value))
                            }).then(() => {
                                axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.omniSuccess(data.view.id, `Депозит ${common.cur(+a.value,'GEL')} успешно списан со счета пользователя ${common.uname(user,inc[1])}`), {
                                        headers: {
                                            'Content-type': 'application/json',
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                                        }
                                    }
                                )
                                m.sendMessage2({
                                    chat_id: inc[1],
                                    text: translations.undeposit(+a.value)[user.language_code] || translations.undeposit(+a.value).en
                                }, false, token)

                                log({
                                    text: `Админ ${data.user.username} списывает с депозита пользователя ${common.uname(user,inc[1])} ${common.cur(+a.value,'GEL')}`,
                                    user: +inc[1]
                                })
                            })
                        } else {
                            axios.post(
                                'https://slack.com/api/views.update',
                                modals.err(data.view.id, `Этот пользователь заблокирован или не найден`), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            )
                        }
                    })

                }

                case 'coworkingRecord': {
                    switch (inc[1]) {
                        case 'free': {
                            coworking.doc(a.value).update({
                                paymentNeeded: false
                            }).then(() => {

                                axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.omniSuccess(data.view.id, `Твори добро!`), {
                                        headers: {
                                            'Content-type': 'application/json',
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                                        }
                                    }
                                )

                                coworking.doc(a.value).get().then(record => {
                                    record = record.data()
                                    let d = [];
                                    d.push(m.getUser(record.user, udb))
                                    d.push(halls.doc(record.hall).get().then(d => d.data()))
                                    Promise.all(d).then(d => {
                                        log({
                                            text: `Админ @${data.user.username} дарит день в коворкинге пользователю ${common.uname(d[0],record.user)}. ${record.date} @ ${d[1].name}`
                                        })
                                    })
                                })
                            })
                            break;
                        }
                        case 'cancel': {
                            coworking.doc(a.value).update({
                                active: false
                            }).then(() => {

                                axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.omniSuccess(data.view.id, `Твори добро!`), {
                                        headers: {
                                            'Content-type': 'application/json',
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                                        }
                                    }
                                )

                                coworking.doc(a.value).get().then(record => {
                                    record = record.data()
                                    let d = [];
                                    d.push(m.getUser(record.user, udb))
                                    d.push(halls.doc(record.hall).get().then(d => d.data()))
                                    Promise.all(d).then(d => {
                                        log({
                                            text: `Админ @${data.user.username} отменяет запись пользователя ${common.uname(d[0],record.user)} в коворкинг на ${record.date}`
                                        })
                                    })
                                })
                            })
                            break;
                        }
                        default: {
                            coworking.doc(a.value).get().then(record => {
                                record = record.data()
                                let d = [];
                                d.push(m.getUser(record.user, udb))
                                d.push(halls.doc(record.hall).get().then(d => d.data()))
                                Promise.all(d).then(d => {
                                    if (data.view) {
                                        axios.post(
                                            'https://slack.com/api/views.update',
                                            modals.coworkingRecord(data.view.id, record, a.value, d[0], d[1]), {
                                                headers: {
                                                    'Content-type': 'application/json',
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                }
                                            }
                                        ).then(s => {
                                            if (process.env.develop == 'true') console.log(s.data)
                                        }).catch(err => {
                                            console.log(err.message)
                                        })
                                    } else {
                                        axios.post(
                                            'https://slack.com/api/views.open', {
                                                trigger_id: data.trigger_id,
                                                view: modals.coworkingRecord(false, record, a.value, d[0], d[1])
                                            }, {
                                                headers: {
                                                    'Content-type': 'application/json',
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                }
                                            }
                                        ).then(s => {
                                            if (process.env.develop == 'true') console.log(s.data)
                                        }).catch(err => {
                                            console.log(err.message)
                                        })
                                    }
                                })
                            })
                            break;
                        }
                    }
                    break;
                }

                case 'ticket': {
                    switch (inc[1]) {
                        case 'used':{
                            return userClasses.doc(a.value).update({
                                status: 'used'
                            }).then(() => {

                                userClasses.doc(a.value).get().then(doc=>{
                                    
                                    let user = doc.data().user;

                                    udb.doc(user.toString()).update({
                                        classes: FieldValue.increment(1)
                                    })

                                    plansUsers
                                        .where('user','==',+user)
                                        .where('active','==',true)
                                        .get().then(col=>{
                                            let plan = common.handleQuery(col)[0]
                                            if(plan && plan.eventsLeft){
                                                
                                                plansUsers.doc(plan.id).update({
                                                    eventsLeft: FieldValue.increment(-1)
                                                })
                                            }
                                        })
                                })
                                res.send('ok')
                            })
                        }
                        case 'comment': {
                            return userClasses.doc(a.block_id).update({
                                comment: a.value
                            }).then(() => {
                                res.send('ok')
                            })
                        }
                        case 'cancel': {
                            return userClasses.doc(a.value).update({
                                active: false
                            }).then(() => {
                                res.send('ok')
                            })
                        }
                        case 'free': {
                            return userClasses.doc(a.value).update({
                                isFree: true
                            }).then(() => {
                                res.send('ok')
                            })
                        }
                        default: {
                            return res.sendStatus(404)
                        }
                    }
                }
                case 'ticketDetails': {
                    res.send('ok')
                    return userClasses.doc(a.value).get().then(t => {
                        t = t.data();
                        t.id = a.value;
                        m.getUser(t.user, udb).then(user => {
                            let admin = {};
                            if (t.statusBy) {
                                admin = m.getUser(t.statusBy, udb)
                            }
                            Promise.resolve(admin).then(admin => {

                                classes.doc(t.class).get().then(c => {

                                    if (data.view) {
                                        axios.post(
                                            'https://slack.com/api/views.update',
                                            modals.ticketDetails(data.view.id, t, user, c.data(), admin), {
                                                headers: {
                                                    'Content-type': 'application/json',
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                }
                                            }
                                        ).then(s => {
                                            if (process.env.develop == 'true') console.log(s.data)
                                        }).catch(err => {
                                            console.log(err.message)
                                        })
                                    } else {
                                        axios.post(
                                            'https://slack.com/api/views.open', {
                                                trigger_id: data.trigger_id,
                                                view: modals.ticketDetails(false, t, user, c.data(), admin)
                                            }, {
                                                headers: {
                                                    'Content-type': 'application/json',
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                }
                                            }
                                        ).then(s => {
                                            if (process.env.develop == 'true') console.log(s.data)
                                        }).catch(err => {
                                            console.log(err.message)
                                        })
                                    }

                                })
                            })
                        })
                    })
                }
                case 'closeRoom': {
                    console.log(a.selected_option.value, a.block_id)
                    switch (a.selected_option.value) {
                        case '0': {
                            return roomsBlocked.add({
                                active: true,
                                room: a.block_id.split('_')[0],
                                date: a.block_id.split('_')[1],
                                createdAt: new Date(),
                                createdBy: data.user.username
                            }).then(s => {
                                res.sendStatus(200)
                                halls.doc(a.block_id.split('_')[0]).get().then(h => {
                                    log({
                                        text: `Админ ${data.user.username} закрывает комнату ${h.data().name} на ${a.block_id.split('_')[1]}`
                                    })
                                })

                            }).catch(handleError)
                        }
                        case '1': {
                            return roomsBlocked
                                .where('active', '==', true)
                                .where('room', '==', a.block_id.split('_')[0])
                                .where('date', '==', a.block_id.split('_')[1])
                                .get()
                                .then(col => {
                                    col.docs.forEach(d => {
                                        roomsBlocked.doc(d.id).update({
                                            active: false,
                                            updatedAt: new Date(),
                                            updatedBy: data.user.username
                                        })
                                    })
                                    res.sendStatus(200)
                                    halls.doc(a.block_id.split('_')[0]).get().then(h => {
                                        log({
                                            text: `Админ ${data.user.username} открывает комнату ${h.data().name} на ${a.block_id.split('_')[1]}`
                                        })
                                    })
                                }).catch(handleError)

                        }
                    }
                }
                case 'mr': {
                    return mra
                        .where('date', '==', a.selected_date)
                        .get()
                        .then(col => {
                            let records = common.handleQuery(col)
                            let userList = [...new Set(records.map(r => r.user))]
                            udb.where('id', 'in', userList.length ? userList : [common.dimazvali]).get().then(users => {
                                axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.mrDate(data.view.id, a.selected_date, records, common.handleQuery(users)), {
                                        headers: {
                                            'Content-type': 'application/json',
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                                        }
                                    }
                                ).then(s => {
                                    if (process.env.develop == 'true') console.log(s.data)
                                }).catch(err => {
                                    console.log(err.message)
                                })
                            })
                        })
                }
                case 'tagMessage': {
                    return userTags.doc(inc[1]).get().then(tag => {
                        if (!tag.exists) return res.sendStatus(404)
                        tag = tag.data();

                        Object.keys(tag).forEach(id => {
                            if (id != 'name') m.sendMessage2({
                                chat_id: id,
                                text: a.value
                            }, false, token)
                        })

                        log({
                            text: `Админ ${data.user.username} отправляет рассылку по тегу «${inc[1]}»:\n${a.value}`
                        })
                        axios.post(
                            'https://slack.com/api/views.update',
                            modals.omniSuccess(data.view.id, `Ваше сообщение расходится на ${Object.keys(tag).length} пользователей.`), {
                                headers: {
                                    'Content-type': 'application/json',
                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                }
                            }
                        )

                    })
                }
                case 'tag': {
                    return userTags.doc(inc[1]).get().then(d => {

                        udb.where('id', 'in', [...new Set(Object.keys(d.data()).map(r => +r))]).get().then(users => {
                            axios.post(
                                'https://slack.com/api/views.update',
                                modals.tagDetails(data.view.id, d, common.handleQuery(users)), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            ).then(s => {
                                if (process.env.develop == 'true') console.log(s.data)
                            }).catch(err => {
                                console.log(err.message)
                            })
                        })


                    })
                }
                case 'coworkingMess': {
                    switch (inc[1]) {
                        case 'confirmBooking':{
                            let ref = coworking.doc(inc[2])
                            ref.get().then(r=>{
                                let rec = r.data();
                                if(rec){
                                    if(rec.status != 'used'){
                                        ref.update({
                                            status: 'used'
                                        })

                                        plansUsers
                                            .where('user','==',rec.user)
                                            .where('active','==',true)
                                            .get().then(col=>{
                                                let plan = common.handleQuery(col)[0]
                                                if(plan && plan.visitsLeft){
                                                    plansUsers.doc(plan.id).update({
                                                        visitsLeft: FieldValue.increment(-1)
                                                    })
                                                    axios.post(
                                                        'https://slack.com/api/views.update',
                                                        modals.omniSuccess(data.view.id, `Вы отметили, что гость пришел. Оплата не требуется (использована подписка).`), {
                                                            headers: {
                                                                'Content-type': 'application/json',
                                                                'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                            }
                                                        }
                                                    ).then(s => {
                                                        if (process.env.develop == 'true') console.log(s.data)
                                                    }).catch(err => {
                                                        console.log(err.message)
                                                    })
                                                } else {
                                                    if(!rec.paymentNeeded) {
                                                        axios.post(
                                                            'https://slack.com/api/views.update',
                                                            modals.omniSuccess(data.view.id, `Вы отметили, что гость пришел. Оплата не требуется.`), {
                                                                headers: {
                                                                    'Content-type': 'application/json',
                                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                                }
                                                            }
                                                        ).then(s => {
                                                            if (process.env.develop == 'true') console.log(s.data)
                                                        }).catch(err => {
                                                            console.log(err.message)
                                                        })
                                                    } else {
                                                        m.getUser(rec.user,udb).then(user=>{
                                                            axios.post(
                                                                'https://slack.com/api/views.update',
                                                                modals.omniSuccess(data.view.id, `Вы отметили, что гость пришел.\nПерейдем к оплате. На счете пользователя ${common.cur(user.deposit||0,'GEL')}.`), {
                                                                    headers: {
                                                                        'Content-type': 'application/json',
                                                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                                    }
                                                                }
                                                            ).then(s => {
                                                                if (process.env.develop == 'true') console.log(s.data)
                                                            }).catch(err => {
                                                                console.log(err.message)
                                                            })
                                                        })
                                                    }
                                                }
                                            })

                                


                                        

                                    } else {
                                        axios.post(
                                            'https://slack.com/api/views.update',
                                            modals.err(data.view.id, `Запись уже находится в статусе "Были".`), {
                                                headers: {
                                                    'Content-type': 'application/json',
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                }
                                            }
                                        ).then(s => {
                                            if (process.env.develop == 'true') console.log(s.data)
                                        }).catch(err => {
                                            console.log(err.message)
                                        })
                                    }
                                } else {
                                    axios.post(
                                        'https://slack.com/api/views.update',
                                        modals.err(data.view.id, `Такой записи в базе нет.`), {
                                            headers: {
                                                'Content-type': 'application/json',
                                                'Authorization': 'Bearer ' + process.env.paperSlackToken
                                            }
                                        }
                                    ).then(s => {
                                        if (process.env.develop == 'true') console.log(s.data)
                                    }).catch(err => {
                                        console.log(err.message)
                                    })
                                }
                                
                            })
                            break;
                        }
                        case 'cancelBooking': {
                            return coworking.doc(inc[2]).update({
                                active: false,
                                updatedAt: new Date(),
                                updatedBy: `slack_${data.user.username}`
                            }).then(() => {
                                res.sendStatus(200)
                            }).catch(handleError)
                        }
                        default:
                            return res.sendStatus(404)
                    }
                    break;

                }
                case 'coworking': {
                    console.log(inc[2])
                    return coworking
                        .where('hall', '==', inc[1])
                        .where('active', '==', true)
                        .where('date', '>=', a.selected_date || new Date().toISOString().split('T')[0])
                        .get()
                        .then(reservations => {
                            reservations = common.handleQuery(reservations);
                            let days = {}
                            let shift = 0

                            while (shift < 8) {
                                let date = new Date((a.selected_date ? +new Date(a.selected_date) : +new Date()) + shift * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                                let temp = reservations.filter(r => r.date == date)
                                days[date] = temp
                                shift++
                            }

                            let usersToCome = [...new Set(reservations.map(r => r.user))]

                            roomsBlocked
                                .where('room', '==', inc[1])
                                .where('active', '==', true)
                                .where('date', '>=', a.selected_date ? a.selected_date : new Date().toISOString().split('T')[0])
                                .get()
                                .then(blocks => {
                                    udb.where('id', 'in', usersToCome.length ? usersToCome : [common.dimazvali]).get().then(users => {

                                        halls.doc(inc[1]).get().then(h => {
                                            let hall = h.data()
                                            hall.id = h.id;
                                            axios.post(
                                                'https://slack.com/api/views.update',
                                                modals.coworkingDetails(data.view.id, days, hall, common.handleQuery(users), common.handleQuery(blocks), a.selected_date), {
                                                    headers: {
                                                        'Content-type': 'application/json',
                                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                    }
                                                }
                                            ).then(s => {
                                                if (process.env.develop == 'true') console.log(s.data)
                                            }).catch(err => {
                                                console.log(err.message)
                                            })
                                        })

                                    })
                                })






                        })
                    break;
                }
                case 'updateUser': {
                    return udb.doc(data.view.callback_id).update({
                        [a.block_id]: a.value
                    }).then(() => res.sendStatus(200)).catch(err => {
                        res.sendStatus(500)
                    })
                }
                case 'userDetails': {
                    return udb.doc(a.value).get().then(u => {

                        let udata = []

                        udata.push(userClasses
                            .where('active', '==', true)
                            .where('user', '==', +a.value)
                            .get()
                            .then(col => {
                                return common.handleQuery(col).sort((a, b) => b.createdAt._seconds - a.createdAt._seconds)
                            }))

                        udata.push(messages
                            .where('user', '==', +a.value)
                            .orderBy('createdAt', 'desc')
                            .limit(10)
                            .get()
                            .then(col => {
                                return common.handleQuery(col)
                            }))




                        Promise.all(udata).then(udata => {

                            console.log(JSON.stringify(modals.userDetails(false, u, udata[0], udata[1])))
                            if (data.view) {
                                axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.userDetails(data.view.id, u, udata[0], udata[1]), {
                                        headers: {
                                            'Content-type': 'application/json',
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                                        }
                                    }
                                ).then(s => {
                                    if (process.env.develop == 'true') console.log(s.data)
                                }).catch(err => {
                                    console.log(err.message)
                                })
                            } else {
                                return axios.post(
                                    'https://slack.com/api/views.open', {
                                        trigger_id: data.trigger_id,
                                        view: modals.userDetails(false, u, udata[0], udata[1])
                                    }, {
                                        headers: {
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                            'Content-Type': 'application/json',
                                        }
                                    }
                                ).then(s => {
                                    if (process.env.develop == 'true') console.log(s.data)
                                }).catch(err => {
                                    console.log(err.message)
                                })
                            }
                        })



                    })
                }
                case 'message': {

                    m.sendMessage2({
                        chat_id: a.action_id.split('_')[1],
                        text: `🧙: ` + a.value
                    }, false, token).then(() => {

                        axios.post(`https://slack.com/api/chat.postMessage`, {
                            channel: data.container.channel_id,
                            thread_ts: data.container.message_ts,
                            text: `@${data.user.name} пишет: ${a.value}`
                        }, {
                            headers: {
                                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                'Content-Type': 'application/json'
                            }
                        }).then(d => {
                            console.log(d)
                            res.sendStatus(200)
                        }).catch(err => {
                            console.log(err)
                        })

                    })

                    break;
                }
                case 'user': {
                    udb.doc(a.value).get().then(u => {
                        if (!u.exists) {
                            return axios.post(`https://slack.com/api/chat.postMessage`, {
                                channel: data.container.channel_id,
                                thread_ts: data.container.message_ts,
                                text: `Такого пользователя в базе нет`
                            }, {
                                headers: {
                                    'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                    'Content-Type': 'application/json'
                                }
                            }).then(d => {
                                console.log(d)
                                res.sendStatus(200)
                            }).catch(err => {
                                console.log(err)
                            })
                        }
                        switch (a.action_id.split('_')[1]) {
                            case 'block': {
                                if (u.data().blocked) {
                                    return axios.post(`https://slack.com/api/chat.postMessage`, {
                                        channel: data.container.channel_id,
                                        thread_ts: data.container.message_ts,
                                        text: `Пользователь уже заблокирован`
                                    }, {
                                        headers: {
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                            'Content-Type': 'application/json'
                                        }
                                    }).then(d => {
                                        console.log(d)
                                        res.sendStatus(200)
                                    }).catch(err => {
                                        console.log(err)
                                    })
                                } else {
                                    return udb.doc(a.value).update({
                                        blocked: true,
                                        updatedBy: `slack_${data.user.userName}`
                                    }).then(() => {
                                        res.sendStatus(200)
                                        axios.post(`https://slack.com/api/chat.postMessage`, {
                                            channel: data.container.channel_id,
                                            thread_ts: data.container.message_ts,
                                            text: `Пользователь заблокирован`
                                        }, {
                                            headers: {
                                                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                                'Content-Type': 'application/json'
                                            }
                                        })
                                        log({
                                            user: u.id,
                                            text: `Админ ${data.user.username} блокирует пользователя ${uname(u.data(),u.id)}`
                                        })
                                    })
                                    
                                }
                            }
                            case 'admin': {
                                udb.doc(a.value).update({
                                    admin: true,
                                    updatedBy: `slack_${data.user.username}`
                                }).then(() => {
                                    res.sendStatus(200)
                                })
                                axios.post(`https://slack.com/api/chat.postMessage`, {
                                    channel: data.container.channel_id,
                                    thread_ts: data.container.message_ts,
                                    text: `Пользователь стал админом`
                                }, {
                                    headers: {
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                        'Content-Type': 'application/json'
                                    }
                                })
                                log({
                                    user: u.id,
                                    text: `Админ ${data.user.username} сделал ${uname(u.data(),u.id)} админом`
                                })
                                m.sendMessage2({
                                    chat_id: u.id,
                                    text: `Поздравляем, вы зарегистрированы как админ приложения`
                                }, false, token)
                                break;
                            }
                            case 'insider': {
                                udb.doc(a.value).update({
                                    insider: true,
                                    updatedBy: `slack_${data.user.userName}`
                                }).then(() => {
                                    res.sendStatus(200)
                                })
                                axios.post(`https://slack.com/api/chat.postMessage`, {
                                    channel: data.container.channel_id,
                                    thread_ts: data.container.message_ts,
                                    text: `Пользователь стал сотрудником`
                                }, {
                                    headers: {
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                        'Content-Type': 'application/json'
                                    }
                                })
                                log({
                                    user: u.id,
                                    text: `Админ ${data.user.userName} сделал ${uname(u.data(),u.id)} сотрудником`
                                })
                                m.sendMessage2({
                                    chat_id: u.id,
                                    text: translations.congrats[u.data().language_code] || translations.congrats.en
                                }, false, token)
                                break;
                            }

                            case 'fellow': {
                                udb.doc(a.value).update({
                                    fellow: true,
                                    updatedBy: `slack_${data.user.userName}`
                                }).then(() => {
                                    res.sendStatus(200)
                                })
                                axios.post(`https://slack.com/api/chat.postMessage`, {
                                    channel: data.container.channel_id,
                                    thread_ts: data.container.message_ts,
                                    text: `Пользователь стал участником fellows`
                                }, {
                                    headers: {
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                        'Content-Type': 'application/json'
                                    }
                                })
                                log({
                                    user: u.id,
                                    text: `Админ ${data.user.userName} сделал ${uname(u.data(),u.id)} участником программы fellows`
                                })
                                m.sendMessage2({
                                    chat_id: u.id,
                                    text: translations.fellow[u.data().language_code] || translations.fellow.en
                                }, false, token)
                                break;
                            }

                            default: {
                                res.sendStatus(404)
                            }
                        }

                    })

                    break;
                }

                case 'usersPaginator': {
                    switch (a.block_id) {
                        case 'all': {
                            let offset = +a.selected_option.value.split('_')[0]
                            let limit = +a.selected_option.value.split('_')[1]

                            return udb.orderBy('createdAt')
                                .limit(offset + limit)
                                .get().then(col => {
                                    return axios.post(
                                        'https://slack.com/api/views.update',
                                        modals.filteredUsers(data.view.id, common.handleQuery(col).splice(offset, limit), a.block_id), {
                                            headers: {
                                                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                                'Content-Type': 'application/json',
                                            }
                                        }
                                    ).then(s => {
                                        if (process.env.develop == 'true') console.log(s.data)
                                    }).catch(err => {
                                        console.log(err.message)
                                    })
                                }).catch(err => {
                                    console.log(err)
                                })
                        }
                        default: {
                            return udb.where(a.block_id, '==', true).get().then(col => {
                                return axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.filteredUsers(data.view.id, common.handleQuery(col), a.action_id.split('_')[2]), {
                                        headers: {
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                            'Content-Type': 'application/json',
                                        }
                                    }
                                ).then(s => {
                                    if (process.env.develop == 'true') console.log(s.data)
                                }).catch(err => {
                                    console.log(err.message)
                                })
                            }).catch(err => {
                                console.log(err)
                            })
                        }
                    }
                }
                case 'users': {
                    switch (inc[1]) {
                        case 'filtered': {
                            switch (inc[2]) {
                                case 'all': {
                                    return udb.orderBy('createdAt').offset(inc[3] || 0).limit(inc[4] || 50).get().then(col => {
                                        return axios.post(
                                            'https://slack.com/api/views.update',
                                            modals.filteredUsers(data.view.id, common.handleQuery(col), a.action_id.split('_')[2]), {
                                                headers: {
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                                    'Content-Type': 'application/json',
                                                }
                                            }
                                        ).then(s => {
                                            if (process.env.develop == 'true') console.log(s.data)
                                        }).catch(err => {
                                            console.log(err.message)
                                        })
                                    }).catch(err => {
                                        console.log(err)
                                    })
                                }
                                default: {
                                    return udb.where(a.action_id.split('_')[2], '==', true).get().then(col => {
                                        return axios.post(
                                            'https://slack.com/api/views.update',
                                            modals.filteredUsers(data.view.id, common.handleQuery(col), a.action_id.split('_')[2]), {
                                                headers: {
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                                    'Content-Type': 'application/json',
                                                }
                                            }
                                        ).then(s => {
                                            if (process.env.develop == 'true') console.log(s.data)
                                        }).catch(err => {
                                            console.log(err.message)
                                        })
                                    }).catch(err => {
                                        console.log(err)
                                    })
                                }
                            }
                        }
                    }
                }
                case 'lectures': {
                    classes.doc(a.selected_option.value).get().then(l => {
                        l = l.data();

                        axios.post(`https://slack.com/api/views.update`, modals.lecture(l), {
                            headers: {
                                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                'Content-Type': 'application/json'
                            }
                        }).then(d => {
                            console.log(d)
                        }).catch(err => {
                            console.log(err)
                        })
                    })
                    break;
                }
                case 'lecture': {
                    switch (a.action_id.split('_')[1]) {
                        case 'cancel': {
                            return classes.doc(a.value).get().then(c => {
                                if (!c.exists) {
                                    return axios.post(`https://slack.com/api/chat.postMessage`, {
                                        channel: data.container.channel_id,
                                        thread_ts: data.container.message_ts,
                                        text: `Извините, этой лекции не существует в базе данных`
                                    }, {
                                        headers: {
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                            'Content-Type': 'application/json'
                                        }
                                    }).then(d => {
                                        res.sendStatus(200)
                                    }).catch(err => {
                                        console.log(err)
                                    })
                                }

                                if (!c.data().active) {
                                    return axios.post(`https://slack.com/api/chat.postMessage`, {
                                        channel: data.container.channel_id || process.env.papersHook,
                                        thread_ts: data.container.message_ts,
                                        text: `Извините, эта лекция уже отменена`
                                    }, {
                                        headers: {
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                            'Content-Type': 'application/json'
                                        }
                                    }).then(d => {
                                        console.log(d)
                                        res.sendStatus(200)
                                    }).catch(err => {
                                        console.log(err)
                                    })
                                }

                                return classes.doc(a.value).update({
                                    active: false,
                                    updatedBy: `slack_${data.user.username}`,
                                    updatedAt: new Date()
                                }).then(() => {
                                    axios.post(`https://slack.com/api/chat.postMessage`, {
                                        channel: data.container.channel_id || process.env.papersHook,
                                        thread_ts: data.container.message_ts,
                                        text: `${data.user.username} отменяет лекцию`
                                    }, {
                                        headers: {
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                            'Content-Type': 'application/json'
                                        }
                                    }).then(d => {
                                        console.log(d)
                                        res.sendStatus(200)
                                    }).catch(err => {
                                        console.log(err)
                                    })

                                    if (data.container.view_id) {
                                        axios.post(
                                            'https://slack.com/api/views.update',
                                            modals.omniSuccess(data.view.id, `Лекция отменена. Участники получат соответствующие уведомления.`), {
                                                headers: {
                                                    'Content-type': 'application/json',
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                }
                                            }
                                        )
                                    }
                                })
                            })
                        }
                        case 'announce': {
                            return userClasses
                                .where('class', '==', a.action_id.split('_')[2])
                                .where('active', '==', true)
                                .get()
                                .then(col => {
                                    col.docs.forEach(record => {
                                        m.sendMessage2({
                                            chat_id: record.data().user,
                                            text: a.value
                                        }, false, token)
                                    })
                                    res.sendStatus(200)
                                }).catch(handleError)
                        }
                        case 'lecture_announceNoShow_': {
                            return userClasses
                                .where('class', '==', a.action_id.split('_')[2])
                                .where('active', '==', true)
                                .get()
                                .then(col => {
                                    common.handleQuery(col)
                                    .filter(r => r.status != 'used')
                                    .forEach(record => {

                                        m.sendMessage2({
                                            chat_id: record.data().user,
                                            text: a.value,
                                            reply_markup: {
                                                inline_keyboard: [
                                                    [{
                                                        text: translations.openClass.en,
                                                        web_app: {
                                                            url: process.env.ngrok + '/paper/app/start=classes'
                                                        }
                                                    }]
                                                ]
                                            }
                                        }, false, token)
                                    })
                                    res.sendStatus(200)
                                }).catch(handleError)
                        }
                        case 'alert': {
                            switch (inc[2]) {
                                case 'admins': {

                                    classes.doc(inc[3]).get().then(cl => {
                                        let h = cl.data();
                                        h.id = inc[3]

                                        udb
                                            .where('admin', '==', true)
                                            .get()
                                            .then(col => {
                                                common.handleQuery(col).forEach(u => {
                                                    lang = u.language_code

                                                    let kbd = [
                                                        [{
                                                            text: translations.book[lang] || translations.book.en,
                                                            callback_data: 'class_' + h.id
                                                        }]
                                                    ]



                                                    if (h.noRegistration) {
                                                        kbd = []
                                                    }

                                                    kbd.push([{
                                                        text: translations.unsubscribe[lang] || translations.unsubscribe.en,
                                                        callback_data: `unsubscribe`
                                                    }])

                                                    let message = {
                                                        chat_id: u.id,
                                                        text: `${common.drawDate(h.date,false,{time:true})}, ${h.duration} ${translations.minutes[lang] ||  translations.minutes.en}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description}\n${h.price? `${translations.fee[lang] ||  translations.fee.en} ${common.cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`,
                                                        parse_mode: 'HTML',
                                                        reply_markup: {
                                                            inline_keyboard: kbd
                                                        }
                                                    }

                                                    if (h.pic) {
                                                        message.caption = message.text.slice(0, 1000)
                                                        message.photo = h.pic
                                                        // delete message.text
                                                    }
                                                    m.sendMessage2(message, (h.pic ? 'sendPhoto' : false), token)
                                                })
                                            })
                                    })

                                    break;
                                }
                                case 'all': {
                                    classes.doc(inc[3]).get().then(cl => {
                                        let h = cl.data();
                                        h.id = inc[3]

                                        let users = udb.where('active', '==', true)

                                        if (h.admins) {
                                            users = users.where('admin', '==', true)
                                        } else if (h.fellows) {
                                            users = users.where('fellow', '==', true)
                                        }

                                        users
                                            .get()
                                            .then(col => {
                                                common.handleQuery(col).forEach((u,i) => {

                                                    if (!u.noSpam) {
                                                        lang = u.language_code

                                                        let kbd = [
                                                            [{
                                                                text: translations.book[lang] || translations.book.en,
                                                                callback_data: 'class_' + h.id
                                                            }]
                                                        ]



                                                        if (h.noRegistration) {
                                                            kbd = []
                                                        }

                                                        kbd.push([{
                                                            text: translations.unsubscribe[lang] || translations.unsubscribe.en,
                                                            callback_data: `unsubscribe`
                                                        }])

                                                        let message = {
                                                            chat_id: u.id,
                                                            text: `${common.drawDate(h.date,false,{time:true})}, ${h.duration} ${translations.minutes[lang] ||  translations.minutes.en}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description}\n${h.price? `${translations.fee[lang] ||  translations.fee.en} ${common.cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`,
                                                            parse_mode: 'HTML',
                                                            reply_markup: {
                                                                inline_keyboard: kbd
                                                            }
                                                        }

                                                        if (h.pic) {
                                                            message.caption = message.text.slice(0, 1000)
                                                            message.photo = h.pic
                                                            // delete message.text
                                                        }
                                                        setTimeout(function(){
                                                            m.sendMessage2(message, (h.pic ? 'sendPhoto' : false), token).then(s=>{
                                                                if(!s) {
                                                                    udb.doc(u.id.toString()).update({active:false})
                                                                } else {
                                                                    udb.doc(u.id.toString()).update({testTag:new Date()})
                                                                }
                                                            })
                                                        },i*200)
                                                    
                                                    }
                                                    
                                                })
                                                res.sendStatus(200)
                                            })


                                    })
                                    break
                                }
                            }
                            break;
                        }
                        case 'update': {
                            return classes.doc(inc[2]).get().then(l => {
                                if (!l.exists) return res.sendStatus(404)

                                console.log(JSON.stringify(modals.lectureUpdate(data.view.id, l.data(), l.id)))

                                return axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.lectureUpdate(data.view.id, l.data(), l.id), {
                                        headers: {
                                            'Content-type': 'application/json',
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                                        }
                                    }
                                ).then(s => {
                                    if (process.env.develop == 'true') console.log(s.data)
                                }).catch(err => {
                                    console.log(err.message)
                                })
                            })
                        }
                        default:
                            return res.sendStatus(404)
                    }
                    break;
                }
                case 'coworkingHall': {

                    data.actions[0].action_id = 'coworking_' + a.selected_option.value

                    axios.post(process.env.apihost + '/paper/slack', data)
                    return res.send('ok')
                }
                case 'lectureDetails': {
                    let d = [];
                    d.push(classes.doc(a.value).get().then(c => {
                        let t = c.data()
                        t.id = a.value
                        return t;
                    }))
                    d.push(userClasses.where('class', '==', a.value)
                        // .orderBy('createdAt','asc')
                        .get().then(col => common.handleQuery(col)))

                    Promise.all(d).then(d => {
                        if (data.view) {
                            axios.post(
                                'https://slack.com/api/views.update',
                                modals.lectureDetails(data.view.id, d[0], d[1]), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            ).then(s => {
                                if (process.env.develop == 'true') console.log(s.data)
                            }).catch(err => {
                                console.log(err.message)
                            })
                        } else {
                            axios.post(
                                'https://slack.com/api/views.open', {
                                    trigger_id: data.trigger_id,
                                    view: modals.lectureDetails(false, d[0], d[1])
                                }, {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            ).then(s => {
                                if (process.env.develop == 'true') console.log(s.data)
                            }).catch(err => {
                                console.log(err.message)
                            })
                        }

                    })
                    break;
                }
                default: {
                    return res.sendStatus(404)
                }
            }
            break;
        }
        case 'view_submission': {

            if (!data.view.callback_id.indexOf('lectureUpdate_')) {

                axios.post(
                    'https://slack.com/api/views.update',
                    modals.inprogress, {
                        headers: {
                            'Content-type': 'application/json',
                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                        }
                    }
                )

                let lid = data.view.callback_id.split('lectureUpdate_')[1]
                let nl = data.view.state.values;
                let l = {
                    date: new Date(nl.date.date.selected_date + ' ' + nl.time.time.selected_time).toISOString(),
                    name: nl.name.name.value,
                    author: nl.author.author.value,
                    duration: nl.duration.duration.value,
                    price: +nl.price.price.value || 0,
                    description: nl.description.description.value,
                    fellows: nl.extras.extras.selected_options.filter(o => o.value == 'fellows').length ? true : false,
                    admins: nl.extras.extras.selected_options.filter(o => o.value == 'admins').length ? true : false,
                    noRegistration: nl.extras.extras.selected_options.filter(o => o.value == 'noRegistration').length ? true : false,
                    updatedAt: new Date(),
                    updatedBy: `slack_${data.user.username}`,
                    capacity: +nl.capacity.capacity.value || 0,
                    pic: nl.pic.pic.value || null,
                }

                return classes.doc(lid).update(l).then(() => {

                    res.sendStatus(200)

                    return axios.post(
                        'https://slack.com/api/views.update',
                        modals.omniSuccess(data.view.id, `Отлично! Лекция Обновлена.`), {
                            headers: {
                                'Content-type': 'application/json',
                                'Authorization': 'Bearer ' + process.env.paperSlackToken
                            }
                        }
                    )
                }).catch(handleError)
            }

            switch (data.view.callback_id) {

                case 'newClass': {

                    res.sendStatus(200)

                    axios.post(
                        'https://slack.com/api/views.update',
                        modals.inprogress, {
                            headers: {
                                'Content-type': 'application/json',
                                'Authorization': 'Bearer ' + process.env.paperSlackToken
                            }
                        }
                    )

                    let nl = data.view.state.values;

                    let capacity = nl.capacity.capacity.value || null;

                    if (!capacity) {
                        capacity = halls.doc(nl.hall.hall.selected_option.value).get().then(h => h.data().capacity)
                    }

                    return Promise.resolve(capacity).then(capacity => {
                        let l = {
                            active:         true,
                            date:           new Date(nl.date.date.selected_date + ' ' + nl.time.time.selected_time).toISOString(),
                            type:           nl.type.type.selected_option.value,
                            hall:           nl.hall.hall.selected_option.value,
                            hallName:       decodeURIComponent(nl.hall.hall.selected_option.text.text),
                            name:           nl.name.name.value,
                            author:         nl.author.author.value,
                            duration:       nl.duration.duration.value,
                            price:          +nl.price.price.value || 0,
                            description:    nl.description.description.value,
                            pic:            nl.pic.pic.value || null,
                            fellows:        nl.extras.extras.selected_options.filter(o => o.value == 'fellows').length ? true : false,
                            admins:         nl.extras.extras.selected_options.filter(o => o.value == 'admins').length ? true : false,
                            noRegistration: nl.extras.extras.selected_options.filter(o => o.value == 'noRegistration').length ? true : false,
                            createdAt:      new Date(),
                            capacity:       capacity || null
                        }


                        return classes.add(l).then(record => {

                            log({
                                class: record.id,
                                text: `На ${l.date} назначена новая лекция: ${l.name}.`
                            })

                            if (nl.extras.extras.selected_options.filter(o => o.value == 'alert').length) {
                                udb.get().then(col => {

                                    let users = common.handleQuery(col)

                                    users.forEach(u => {
                                        if ((process.env.develop == 'true' && u.tester) || process.env.develop != 'true') {
                                            if (l.pic) {

                                                let ikbd = [
                                                    [{
                                                        text: translations.tellMeMore[u.language_code] || translations.tellMeMore.en,
                                                        web_app: {
                                                            url: process.env.ngrok + '/paper/app?start=classes'
                                                        }
                                                    }]
                                                ]

                                                if (!l.noRegistration) {
                                                    ikbd.push([{
                                                        text: translations.book[u.language_code] || translations.book.en,
                                                        callback_data: `class_${record.id}`
                                                    }])
                                                }
                                                m.sendMessage2({
                                                    chat_id: u.id,
                                                    photo: l.pic,
                                                    caption: translations.newLecture(l)[u.language_code] || translations.newLecture(l).en,
                                                    reply_markup: {
                                                        inline_keyboard: ikbd
                                                    }
                                                }, 'sendPhoto', token)
                                            } else {

                                                let ikbd = [
                                                    [{
                                                        text: translations.tellMeMore[u.language_code] || translations.tellMeMore.en,
                                                        web_app: {
                                                            url: process.env.ngrok + '/paper/app?start=classes'
                                                        }
                                                    }]
                                                ]

                                                if (!l.noRegistration) {
                                                    ikbd.push([{
                                                        text: translations.book[u.language_code] || translations.book.en,
                                                        callback_data: `class_${record.id}`
                                                    }])
                                                }

                                                m.sendMessage2({
                                                    chat_id: u.id,
                                                    text: translations.newLecture(l)[u.language_code] || translations.newLecture(l).en,
                                                    reply_markup: {
                                                        inline_keyboard: ikbd
                                                    }
                                                }, false, token)
                                            }
                                        }



                                    })
                                })
                            }
                            return axios.post(
                                'https://slack.com/api/views.update',
                                modals.omniSuccess(data.view.id, `Отлично! Лекция создана. Вот ее код (на всякий случай): ${record.id}.`), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            )


                        }).catch(err => {
                            console.log(err)
                            return res.sendStatus(500)
                        })
                    })



                    // log({
                    //     class: record.id,
                    //     text: `На ${l.date} назначена новая лекция: ${l.name}.`
                    // })

                    break;
                }

                case 'newQ': {
                    let nl = data.view.state.values;
                    let q = {
                        name: nl.name.name.value,
                        by: data.user.username,
                        text: nl.text.text.value,
                        createdAt: new Date(),
                        active: true
                    }

                    polls.add(q).then(rec => {
                        axios.post(
                            'https://slack.com/api/views.update',
                            modals.omniSuccess(data.view.id, `Вопрос задан и начал расходиться по fellows.`), {
                                headers: {
                                    'Content-type': 'application/json',
                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                }
                            }
                        )
                    })

                    udb
                        .where('active', '==', true)
                        .where('fellow', '==', true)
                        .get()
                        .then(col => {
                            common.handleQuery(col).forEach(u => {

                                m.sendMessage2({
                                    chat_id: u.id,
                                    text: `Добрый день! Коллега ${data.user.username} просит ответить на вопрос ${nl.name.name.value}\n${nl.text.text.value}.\nОтветить вы сможете через приложение.`
                                }, false, token)


                            })
                        })






                    return res.send('ok')
                }

                case 'newCampaign': {

                    let nl = data.view.state.values;

                    let message = {
                        text: nl.text.text.value,
                        by: data.user.username,
                        name: nl.name.name.value,
                        silent: !nl.extras.extras.selected_options.lenth
                    }

                    if (nl.type.type.selected_option.value != 'all') {
                        message.filter = nl.type.type.selected_option.value + '_true'
                    }

                    return axios.post(process.env.apihost + `/paper/news`, message, {
                        headers: {
                            secret: process.env.paperSlackToken
                        }
                    }).then(s => {
                        res.sendStatus(200)
                        axios.post(
                            'https://slack.com/api/views.update',
                            modals.omniSuccess(data.view.id, `Отлично! Ваше сообщение доставлено ${s.data.success.length} раз.`), {
                                headers: {
                                    'Content-type': 'application/json',
                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                }
                            }
                        )
                    }).catch(err => {
                        res.sendStatus(500)
                        return axios.post(
                            'https://slack.com/api/views.update',
                            modals.err(data.view.id, `Что-то пошло не так: ${err.message}`), {
                                headers: {
                                    'Content-type': 'application/json',
                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                }
                            }
                        )
                    })



                    break;
                }

                default: {
                    return res.sendStatus(400)
                }
            }
        }
        default:
            return res.sendStatus(404)
    }
})

router.all(`/trello`,(req,res)=>{
    devlog(JSON.stringify(req.body))
    if(req.body.action.type == `createCard`){
        let card = req.body.action.data.card;

        m.sendMessage2({
            chat_id: 487598913,
            text: `Увага! Новая лекция предложена, но не рассмотрена по существу:\n${card.name}: ${card.desc}\n${card.shortUrl}`
        },false,token)
    }
    res.sendStatus(200)
})

router.post('/hook', (req, res) => {
    
    res.sendStatus(200)

    let user = {}

    if (process.env.develop == 'true') console.log(JSON.stringify(req.body, null, 2))

    if (req.body.message) {
        user = req.body.message.from

        udb.doc(user.id.toString()).get().then(u => {
            
            
            if (!u.exists) registerUser(user)

            if(!u.data().active){
                udb.doc(user.id.toString()).update({
                    active: true,
                    stopped: null
                }).then(s=>{
                    log({
                        text: `Пользователь id ${user.id} возвращается`
                    })  
                })
            }

            if (req.body.message.text && req.body.message.text.indexOf('/start campaign') == 0) {
                userTags.add({
                    user:       user.id,
                    tag:        req.body.message.text.split('/start campaign_')[1],
                    createdAt:  new Date()
                })
            }

            if (req.body.message.text && req.body.message.text.indexOf('/start promo') == 0) {
                
                let campaign = req.body.message.text.split('/start promo_')[1]
                
                userTags.add({
                    user:       user.id,
                    tag:        campaign,
                    createdAt:  new Date()
                })

                promos.doc(campaign).get().then(p=>{
                    if(p.exists){
                        if(p.data().active){
                            m.sendMessage2({
                                chat_id: user.id,
                                photo: process.env.ngrok + `/paper/qr?id=${campaign}&entity=promos`,
                                caption: p.data().description
                            },'sendPhoto',token)
                        } else {
                            m.sendMessage2({
                                chat_id: user.id,
                                text: `Извините, это предложение более недоступно...`
                            },'sendPhoto',token)
                        }
                    }
                })
            }

            if (req.body.message.text && req.body.message.text.indexOf('/start coworking') == 0) {
                let campaign = req.body.message.text.split('_')[1]
                if (campaign) userTags.doc(campaign).update({
                    [campaign]: {
                        [user.id]: new Date()
                    }
                }).then().catch(err => {
                    userTags.doc(campaign).set({
                        [user.id]: new Date()
                    })
                })
                setTimeout(function () {
                    udb.doc(user.id.toString()).update({
                        [`tags.${campaign}`]: new Date()
                    })
                }, 2000)
                m.sendMessage2({
                    chat_id: user.id,
                    text: translations.coworkingInit[user.language_code] || translations.coworkingInit.en,
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: `Начать`,
                                web_app: {
                                    url: process.env.ngrok + '/paper/app?start=profile'
                                }
                            }]
                        ]
                    }
                }, false, token)
            }

            if (req.body.message.text && req.body.message.text.indexOf('/start class') == 0) {

                let cid = req.body.message.text.split('_')[1]

                classes.doc(cid).get().then(h => {

                    let lang = req.body.message.from.language_code;
                    t = h.id
                    h = h.data()
                    h.id = t

                    let message = {
                        chat_id: user.id,
                        text: `${drawDate(h.date,lang,{time:true})}, ${h.duration} ${translations.minutes[lang] ||  translations.minutes.en}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description.slice(0,800)}\n${h.price? `${translations.fee[lang] ||  translations.fee.en}: ${common.cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: translations.book[lang] || translations.book.en,
                                    callback_data: 'class_' + h.id
                                }]
                            ]
                        }
                    }

                    if (h.pic) {
                        message.caption = message.text
                        message.photo = h.pic
                        // delete message.text
                    }

                    m.sendMessage2(message, (h.pic ? 'sendPhoto' : false), token)
                })


            }



            if (req.body.message.text) {
                messages.add({
                    user: user.id,
                    text: req.body.message.text || null,
                    createdAt: new Date(),
                    isReply: false
                })

                switch (req.body.message.text) {
                    case '/halls':
                        checkUser(user.id).then(p => {
                            if (p) return sendHalls(user.id, user.language_code)
                            sorry(user, `просмотре данных о залах`)
                        })
                        break;
                    case '/classes':
                        checkUser(user.id).then(p => {
                            if (p) return sendClasses(user.id, user.language_code)
                            sorry(user, `просмотре данных о лекциях`)
                        })

                        break;
                    case '/test':
                        m.sendMessage2({
                            chat_id: user.id,
                            text: `Приложенька с дева`,
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: `test`,
                                        web_app: {
                                            url: `${process.env.ngrok}/paper/app`
                                        }
                                    }]
                                ]
                            }
                        }, false, token)

                        m.sendMessage2({
                            chat_id: user.id,
                            text: `админка с дева`,
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: `test`,
                                        web_app: {
                                            url: `${process.env.ngrok}/paper/admin`
                                        }
                                    }]
                                ]
                            }
                        }, false, token)
                        break;
                    case '/pro':
                        m.sendMessage2({
                            chat_id: user.id,
                            text: `Привет, коллежка!`,
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: `test`,
                                        web_app: {
                                            url: `${process.env.ngrok}/paper/admin`
                                        }
                                    }]
                                ]
                            }
                        }, false, token)
                        break;
                    case '/coworking':
                        checkUser(user.id).then(p => {
                            if (p) return sendCoworking(user)
                            sorry(user, `доступе к коворкингу`)
                        })

                        break;
                    case '/myclasses':
                        checkUser(user.id).then(p => {
                            if (p) return sendUserClasses(user.id, user.language_code)
                            sorry(user)
                        })

                        break;
                    case '/meetingroom':
                        checkUser(user.id).then(p => {
                            if (p) return sendMeetingRoom(user)
                            sorry(user, 'доступе к переговорке')
                        })


                        break;
                    case '/bookings':
                        checkUser(user.id).then(p => {
                            if (p) return showBookings(user.id)
                            sorry(user)
                        })


                        break;
                    default:


                        if (req.body.message.text.indexOf('/start')) {

                            alertAdmins({
                                text: `${uname(u.data(),u.id)} пишет что-то странное: ${req.body.message.text}`,
                                type: 'incoming',
                                user_id: user.id
                            })
                        }

                        break;
                }
            }

            if (req.body.message.photo) {
                udb.where('admin','==',true).get().then(col=>{
                    common.handleQuery(col).forEach(a=>{
                            m.sendMessage2({
                                chat_id: a.id,
                                caption: `фото от ${uname(u.data(),u.id)}`,
                                photo: req.body.message.photo[0].file_id
                            }, 'sendPhoto', token)
                        })
                })
            }

        }).catch(err => {
            console.log(err)
        })
    }

    if (req.body.callback_query) {
        user = req.body.callback_query.from;

        let inc = req.body.callback_query.data.split('_')

        if (inc[0] == 'unsubscribe') {
            udb.doc(user.id.toString()).update({
                noSpam: true
            }).then(() => {
                m.sendMessage2({
                    callback_query_id: req.body.callback_query.id,
                    show_alert: true,
                    text: translations.unsubscribeMessage[user.language_code] || translations.unsubscribeMessage.en
                }, 'answerCallbackQuery', token)
            }).catch(err => {
                m.sendMessage2({
                    callback_query_id: req.body.callback_query.id,
                    show_alert: true,
                    text: err.message
                }, 'answerCallbackQuery', token)
            })
        }

        if (inc[0] == 'admin') {
            switch (inc[1]) {
                case 'log': {
                    console.log('обновления подписок', inc[2])
                    switch (inc[2]) {
                        case 'unsubscribe': {
                            isAdmin(user.id.toString()).then(proof => {

                                if (!proof) return m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Простите великодушно, но вы же не админ. Как вы вообще получили эту кнопку?..`
                                }, 'answerCallbackQuery', token)



                                udb.doc(user.id.toString()).update({
                                    stopLog: true
                                }).then(() => {

                                    m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        show_alert: true,
                                        text: `Вы отписаны от фоновых уведомлений.\nЧтобы вернуть их, нажмите на ту же кнопку.`
                                    }, 'answerCallbackQuery', token).then(() => {
                                        m.sendMessage2({
                                            chat_id: user.id,
                                            message_id: req.body.callback_query.message.message_id,
                                            reply_markup: {
                                                inline_keyboard: [
                                                    [{
                                                        text: 'Подписаться на обновления',
                                                        callback_data: `admin_log_subscribe`
                                                    }]
                                                ]
                                            }
                                        }, 'editMessageReplyMarkup', token)
                                    })

                                }).catch(err => {
                                    console.log(err)
                                })
                            }).catch(err => {
                                console.log(err)
                            })
                            break;
                        }
                        case 'subscribe': {
                            isAdmin(user.id.toString()).then(proof => {
                                if (!proof) return m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Простите великодушно, но вы же не админ. Как вы вообще получили эту кнопку?..`
                                }, 'answerCallbackQuery', token)
                                udb.doc(user.id.toString()).update({
                                    stopLog: false
                                }).then(() => {
                                    return m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        show_alert: true,
                                        text: `Вы подписались на  фоновые уведомления.\nЧтобы отключить их, нажмите на ту же кнопку.`
                                    }, 'answerCallbackQuery', token).then(() => {
                                        m.sendMessage2({
                                            chat_id: user.id,
                                            message_id: req.body.callback_query.message.message_id,
                                            reply_markup: {
                                                inline_keyboard: [
                                                    [{
                                                        text: 'Отписаться от обновлений',
                                                        callback_data: `admin_log_unsubscribe`
                                                    }]
                                                ]
                                            }
                                        }, 'editMessageReplyMarkup', token)
                                    })

                                })
                            })
                            break;
                        }

                        default:
                            break;

                    }
                    break;
                }
                default: {
                    break;
                }
            }
        }

        if (inc[0] == 'user') {
            isAdmin(user.id.toString()).then(proof => {
                if (!proof) return m.sendMessage2({
                    callback_query_id: req.body.callback_query.id,
                    show_alert: true,
                    text: `Простите великодушно, но вы же не админ. Как вы вообще получили эту кнопку?..`
                }, 'answerCallbackQuery', token)

                udb.doc(inc[2]).get().then(userdata => {

                    userdata = userdata.data();

                    switch (inc[1]) {
                        case 'block': {
                            udb.doc(inc[2]).update({
                                blocked: true,
                                updatedAt: new Date(),
                                updatedBy: +user.id
                            }).then(() => {

                                udb.doc(inc[2]).get().then(u => {
                                    let m = u.data()
                                    m.intention = `updateUser`;
                                    m.id = u.id
                                    axios.post(sheet, Object.keys(m).map(k => `${k}=${m[k]}`).join('&'), {
                                        headers: {
                                            "Content-Type": "application/x-www-form-urlencoded"
                                        }
                                    })
                                })

                                log({
                                    text: `Админ @${user.username} заблокировал пользователя ${uname(userdata,inc[2])}`,
                                    user: +inc[2],
                                    admin: user.id
                                })

                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Пользователь заблокирован.`
                                }, 'answerCallbackQuery', token)
                            })
                            break;
                        }

                        case 'fellow': {
                            udb.doc(inc[2]).update({
                                fellow: true,
                                updatedAt: new Date(),
                                updatedBy: +user.id
                            }).then(() => {


                                log({
                                    text: `Админ @${user.username} сделал пользователя ${uname(userdata,inc[2])} участником fellows`,
                                    user: +inc[2],
                                    admin: user.id
                                })

                                udb.doc(inc[2]).get().then(u => {
                                    let m = u.data()
                                    m.intention = `updateUser`;
                                    m.id = u.id
                                    axios.post(sheet, Object.keys(m).map(k => `${k}=${m[k]}`).join('&'), {
                                        headers: {
                                            "Content-Type": "application/x-www-form-urlencoded"
                                        }
                                    })
                                })

                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Пользователь отмечен как участник fellows.`
                                }, 'answerCallbackQuery', token)

                                m.sendMessage2({
                                    chat_id: inc[2],
                                    text: translations.fellow[userdata.language_code] || translations.fellow.en
                                }, false, token)
                            })
                            break;
                        }

                        case 'insider': {
                            udb.doc(inc[2]).update({
                                insider: true,
                                updatedAt: new Date(),
                                updatedBy: +user.id
                            }).then(() => {


                                log({
                                    text: `Админ @${user.username} сделал пользователя ${uname(userdata,inc[2])} сотрудником`,
                                    user: +inc[2],
                                    admin: user.id
                                })

                                udb.doc(inc[2]).get().then(u => {
                                    let m = u.data()
                                    m.intention = `updateUser`;
                                    m.id = u.id
                                    axios.post(sheet, Object.keys(m).map(k => `${k}=${m[k]}`).join('&'), {
                                        headers: {
                                            "Content-Type": "application/x-www-form-urlencoded"
                                        }
                                    })
                                })

                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Пользователь отмечен как сотрудник.`
                                }, 'answerCallbackQuery', token)
                                m.sendMessage2({
                                    chat_id: inc[2],
                                    text: translations.congrats[userdata.language_code] || translations.congrats.en
                                }, false, token)
                            })
                            break;
                        }
                        case 'admin': {
                            udb.doc(inc[2]).update({
                                admin: true,
                                updatedAt: new Date(),
                                updatedBy: +user.id
                            }).then(() => {

                                log({
                                    text: `Админ @${user.username} сделал пользователя ${uname(userdata,inc[2])} равным себе`,
                                    user: +inc[2],
                                    admin: user.id
                                })

                                udb.doc(inc[2]).get().then(u => {
                                    let m = u.data()
                                    m.intention = `updateUser`;
                                    m.id = u.id
                                    axios.post(sheet, Object.keys(m).map(k => `${k}=${m[k]}`).join('&'), {
                                        headers: {
                                            "Content-Type": "application/x-www-form-urlencoded"
                                        }
                                    })
                                })

                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Пользователь отмечен как админ.`
                                }, 'answerCallbackQuery', token)

                                m.sendMessage2({
                                    chat_id: inc[2],
                                    text: 'Поздравляем, вы зарегистрированы как админ приложения'
                                }, false, token)

                            })
                            break;
                        }
                        case 'bonus': {
                            udb.doc(inc[2]).update({
                                bonus: false,
                                updatedAt: new Date(),
                                updatedBy: +user.id
                            }).then(() => {
                                log({
                                    text: `Админ @${user.username} снимает бонус коворкинга с пользователя ${uname(userdata,inc[2])} равным себе`,
                                    user: +inc[2],
                                    admin: user.id
                                })
                            })
                            break;
                        }
                        default:
                            return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: translations.nosais[req.body.callback_query.from.language_code] || translations.nosais.en
                            }, 'answerCallbackQuery', token)
                    }
                })


            })
        }

        if (inc[0] == 'mr') {


            switch (inc[1]) {

                case 'repeat': {
                    sendMeetingRoom(user)
                }
                case 'date': {

                    return mra
                        .where('active', '==', true)
                        .where('date', '==', inc[2])
                        .get()
                        .then(data => {

                            tt = common.handleQuery(data).sort((a, b) => b.time - a.time)
                            let shift = 0;
                            let start = new Date().setHours(10, 0, 0);
                            let ts = [];


                            while (shift < 10) {
                                let h = [];
                                let time = new Date(+start + shift * 60 * 60 * 1000).toTimeString().split(' ')[0].split(':').slice(0, 2).join(':')
                                let time2 = new Date(+start + shift * 60 * 60 * 1000 + 30 * 60 * 1000).toTimeString().split(' ')[0].split(':').slice(0, 2).join(':')

                                h.push({
                                    text: `${tt.filter(s=>s.time == time).length ? '❌' : '✔️'} ${time}`,
                                    callback_data: `mr_book_${inc[2]}_${time}`
                                }, {
                                    text: `${tt.filter(s=>s.time == time2).length ? '❌' : '✔️'} ${time2}`,
                                    callback_data: `mr_book_${inc[2]}_${time2}`
                                })

                                ts.push(h)

                                shift++
                            }



                            m.sendMessage2({
                                chat_id: user.id,
                                text: (translations.dateSelected(inc[2])[user.language_code] || translations.dateSelected(inc[2]).en) + '\n' + (translations.chooseTime[user.language_code] || translations.chooseTime.en),
                                message_id: req.body.callback_query.message.message_id
                            }, 'editMessageText', token).then(() => {
                                m.sendMessage2({
                                    chat_id: user.id,
                                    message_id: req.body.callback_query.message.message_id,
                                    reply_markup: {
                                        inline_keyboard: ts
                                    }
                                }, 'editMessageReplyMarkup', token)
                            })
                        }).catch(err => {
                            console.log(err)
                        })

                    break;
                }
                case 'book': {

                    return bookMR(inc[2], inc[3], user.id, req.body.callback_query)
                    // return mra
                    //     .where('date', '==', inc[2])
                    //     .where('time', '==', inc[3])
                    //     .where('active', '==', true)
                    //     .get()
                    //     .then(col => {
                    //         if (col.docs.length) {
                    //             m.sendMessage2({
                    //                 callback_query_id: req.body.callback_query.id,
                    //                 show_alert: true,
                    //                 text: translations.noSeatsLeft[user.language_code] || translations.noSeatsLeft.en
                    //             }, 'answerCallbackQuery', token)
                    //         } else {
                    //             m.sendMessage2({
                    //                 callback_query_id: req.body.callback_query.id,
                    //                 text: translations.onIt[user.language_code] || translations.noSeatsLeft.en
                    //             }, 'answerCallbackQuery', token)
                    //             mra.add({
                    //                 user: user.id,
                    //                 date: inc[2],
                    //                 time: inc[3],
                    //                 active: true,
                    //             }).then(rec => {

                    //                 log({
                    //                     text: `${user.username} забронировал место в переговорке на ${inc[3]} ${inc[2]}`,
                    //                     user: user.id,
                    //                 })

                    //                 m.sendMessage2({
                    //                     chat_id: user.id,
                    //                     text: `${(translations.dateSelected(inc[2])[user.language_code] || translations.dateSelected(inc[2]).en)}\n${(translations.timeSelected(inc[3])[user.language_code] || translations.timeSelected(inc[3]).en)}\n${translations.coworkingBookingConfirmed[user.language_code] || translations.coworkingBookingConfirmed.en}`,
                    //                     message_id: req.body.callback_query.message.message_id
                    //                 }, 'editMessageText', token).then(() => {
                    //                     m.sendMessage2({
                    //                         chat_id: user.id,
                    //                         message_id: req.body.callback_query.message.message_id,
                    //                         reply_markup: {
                    //                             inline_keyboard: [
                    //                                 [{
                    //                                     text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                    //                                     callback_data: `mr_unbook_${rec.id}`
                    //                                 }]
                    //                             ]
                    //                         }
                    //                     }, 'editMessageReplyMarkup', token)
                    //                 })
                    //             })
                    //         }
                    //     })
                    break;
                }
                case 'unbook': {
                    return unbookMR(inc[2], user.id, req.body.callback_query)
                    break;
                }
                default:
                    break;
            }

        }

        if (inc[0] == 'coworking') {
            halls.doc(inc[1]).get().then(h => {
                h = h.data()
                coworking
                    .where('hall', '==', inc[1])
                    .where('active', '==', true)
                    .where('date', '>=', new Date().toISOString().split('T')[0])
                    .get()
                    .then(reservations => {

                        reservations = common.handleQuery(reservations);

                        let inline_keyboard = []
                        let shift = 0

                        while (shift < 8) {

                            let date = new Date(+new Date() + shift * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                            inline_keyboard.push([{
                                text: `${date}:  ${h.capacity - reservations.filter(r=> r.date == date).length} ${translations.seats[user.language_code] || translations.seats.en}`,
                                callback_data: `ca_set_${inc[1]}_${date.toString()}`
                            }])
                            shift++
                        }


                        m.sendMessage2({
                            chat_id: user.id,
                            text: translations.chooseDate[user.language_code] || translations.chooseDate.en,
                            message_id: req.body.callback_query.message.message_id
                        }, 'editMessageText', token).then(() => {
                            m.sendMessage2({
                                chat_id: user.id,
                                message_id: req.body.callback_query.message.message_id,
                                reply_markup: {
                                    inline_keyboard: inline_keyboard
                                }
                            }, 'editMessageReplyMarkup', token)
                        })

                    }).catch(err => {
                        console.log(err)
                    })
            })

        }

        if (inc[0] == 'ca') {
            switch (inc[1]) {
                case 'set': {
                    halls.doc(inc[2]).get().then(hall => {
                        hall = hall.data()
                        if (!hall.active) {
                            return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: translations.hallNotAvailable[user.language_code] || translations.hallNotAvailable.en
                            }, 'answerCallbackQuery', token)
                        } else {

                            roomsBlocked
                                .where('active', '==', true)
                                .where('room', '==', inc[2])
                                .where('date', '==', inc[3])
                                .get()
                                .then(col => {
                                    if (col.docs.length) {
                                        return m.sendMessage2({
                                            callback_query_id: req.body.callback_query.id,
                                            show_alert: true,
                                            text: translations.roomBlocked[user.language_code] || translations.roomBlocked.en
                                        }, 'answerCallbackQuery', token)
                                    } else {
                                        coworking
                                            .where('hall', '==', inc[2])
                                            .where('date', '==', inc[3])
                                            .where('active', '==', true)
                                            .get()
                                            .then(col => {

                                                let users = common.handleQuery(col).map(r => r.user)

                                                if (users.indexOf(user.id) > -1) {
                                                    return m.sendMessage2({
                                                        callback_query_id: req.body.callback_query.id,
                                                        show_alert: true,
                                                        text: translations.alreadyBooked[user.language_code] || translations.alreadyBooked.en
                                                    }, 'answerCallbackQuery', token)
                                                } else if (users.length == hall.capacity) {
                                                    return m.sendMessage2({
                                                        callback_query_id: req.body.callback_query.id,
                                                        show_alert: true,
                                                        text: translations.noSeatsLeft[user.language_code] || translations.noSeatsLeft.en
                                                    }, 'answerCallbackQuery', token)
                                                } else {
                                                    udb.doc(user.id.toString()).get().then(u => {

                                                        if (u.data().blocked) {
                                                            return m.sendMessage2({
                                                                chat_id: user.id,
                                                                text: translations.youArBanned[user.language_code] || translations.youArBanned.en
                                                            }, false, token)
                                                        }

                                                        if (!u.data().occupation) return m.sendMessage2({
                                                            chat_id: user.id,
                                                            text: translations.noOccupationProvided[user.language_code] || translations.noOccupationProvided.en
                                                        }, false, token)

                                                        if (!u.data().email) return m.sendMessage2({
                                                            chat_id: user.id,
                                                            text: translations.noEmailProvided[user.language_code] || translations.noEmailProvided.en
                                                        }, false, token)

                                                        coworking.add({
                                                            user: +user.id,
                                                            hall: inc[2],
                                                            date: inc[3],
                                                            createdAt: new Date(),
                                                            active: true,
                                                            paymentNeeded: (u.data().insider || u.data().admin || u.data().fellow) ? false : (u.data().bonus ? false : true),
                                                            payed: false
                                                        }).then(rec => {

                                                            if (u.data().bonus) {
                                                                udb.doc(u.id).update({
                                                                    bonus: false
                                                                })
                                                            }

                                                            log({
                                                                text: `${uname(user,u.id)} бронирует место в коворкинге ${hall.name} на ${inc[3]}`,
                                                                user: user.id,
                                                                hall: inc[2]
                                                            })

                                                            let pl = {
                                                                active: true,
                                                                id: rec.id,
                                                                intention: 'bookCoworking',
                                                                hall: inc[2],
                                                                date: inc[3],
                                                                user: user.id,
                                                                userName: (user.first_name + ' ' + user.last_name),
                                                                paymentNeeded: (u.data().insider || u.data().admin || u.data().fellow) ? false : (u.data().bonus ? false : true),
                                                                payed: false
                                                            }

                                                            axios.post(sheet, Object.keys(pl).map(k => `${k}=${pl[k]}`).join('&'), {
                                                                headers: {
                                                                    "Content-Type": "application/x-www-form-urlencoded"
                                                                }
                                                            })

                                                            m.sendMessage2({
                                                                chat_id: user.id,
                                                                text: translations.coworkingBookingDetails(inc[3], hall.name, user.language_code)[user.language_code] || translations.coworkingBookingDetails(inc[3], hall.name, user.language_code).en,
                                                                message_id: req.body.callback_query.message.message_id
                                                            }, 'editMessageText', token).then(() => {
                                                                m.sendMessage2({
                                                                    chat_id: user.id,
                                                                    message_id: req.body.callback_query.message.message_id,
                                                                    reply_markup: {
                                                                        inline_keyboard: [
                                                                            [{
                                                                                text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                                                                                callback_data: `ca_cancel_${rec.id}`
                                                                            }]
                                                                        ]
                                                                    }
                                                                }, 'editMessageReplyMarkup', token)

                                                                m.sendMessage2({
                                                                    chat_id: user.id,
                                                                    photo: process.env.ngrok + `/paper/qr?id=${rec.id}&entity=coworking`
                                                                }, 'sendPhoto', token)

                                                            })
                                                        })
                                                    })
                                                }
                                            })
                                    }
                                })


                        }
                    })
                    break;
                }

                case 'cancel': {
                    coworking.doc(inc[2]).get().then(record => {

                        if (!record.exists) {
                            return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: translations.noAppointment[user.language_code] || translations.noAppointment.en
                            }, 'answerCallbackQuery', token)
                        }

                        record = record.data();


                        if (+user.id !== +record.user) {
                            return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: translations.unAuthorized[user.language_code] || translations.unAuthorized.en
                            }, 'answerCallbackQuery', token)
                        }

                        if (!record.active) {
                            return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: translations.alreadyCancelled[user.language_code] || translations.alreadyCancelled.en
                            }, 'answerCallbackQuery', token)
                        }



                        coworking.doc(inc[2]).update({
                            active: false,
                            updatedAt: new Date(),
                            updatedBy: user.id
                        }).then(() => {
                            log({
                                text: `${uname(user,user.id)} отменяет запись в коворкинге на ${record.date}`
                            })

                            m.sendMessage2({
                                chat_id: user.id,
                                text: translations.bookingCancelled[user.language_code] || translations.bookingCancelled.en,
                                message_id: req.body.callback_query.message.message_id
                            }, 'editMessageText', token).then(() => {
                                m.sendMessage2({
                                    chat_id: user.id,
                                    message_id: req.body.callback_query.message.message_id,
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{
                                                text: translations.letsTryAgain[user.language_code] || translations.letsTryAgain.en,
                                                callback_data: `ca_repeat`
                                            }]
                                        ]
                                    }
                                }, 'editMessageReplyMarkup', token)

                            })

                        })
                    })
                    break
                }

                case 'repeat': {
                    checkUser(user.id).then(p => {
                        if (p) return sendCoworking(user)
                        sorry(user, `доступе к коворкингу`)
                    })
                    break;
                }

                default:
                    break;
            }
        }

        if (inc[0] == 'unclass') {

            m.sendMessage2({
                chat_id: user.id,
                message_id: req.body.callback_query.message.message_id
            }, 'unpinChatMessage', token)

            unClassUser(inc[1], user)
            
            
        }

        if (inc[0] == 'class') {

            common.devlog(`Бронь места`)

            bookClass(false, inc[1], false, user.id)


            // classes.doc(inc[1]).get().then(c=>{

            //     if(!c.exists) return res.sendStatus(404)


            // })

        }

        if (inc[0] == 'pay') {
            userClasses.doc(inc[1]).get().then(appointment => {
                if (!appointment.exists) {
                    m.sendMessage2({
                        chat_id: user.id,
                        text: translations.noAppointment[user.language_code] || translations.noAppointment.en
                    }, false, token)
                } else {
                    if (appointment.data().payed) {
                        m.sendMessage2({
                            chat_id: user.id,
                            text: translations.alreadyPayed[user.language_code] || translations.alreadyPayed.en
                        }, false, token)
                    } else {

                        classes.doc(appointment.data().class).get().then(c => {
                            m.sendMessage2({
                                "chat_id": user.id,
                                "title": translations.paymentTitleClass(c.data())[user.language_code] || translations.paymentTitleClass(c.data()).en,
                                "description": translations.paymentDesc[user.language_code] || translations.paymentDesc.en,
                                "payload": inc[1],
                                "provider_token": paymentToken,
                                "currency": "GEL",
                                "prices": [{
                                    "label": "входной билет",
                                    "amount": c.data().price * 100
                                }]

                            }, 'sendInvoice', token)
                        })

                    }
                }
            })

        }

        if(inc[0] == 'feedback'){
            // m.sendMessage2({
            //     callback_query_id: req.body.callback_query.id,
            //     text: `on it`
            // }, 'answerCallbackQuery', token)

            switch(inc[1]){
                case 'ticket':{
                    userClasses.doc(inc[2]).get().then(c=>{
                        let ticket = c.data();

                        if(c.exists){
                            if(ticket.user == user.id){
                                userClasses.doc(inc[2]).update({
                                    rate: +inc[3]
                                })
                                // alertAdmins({
                                //     text: `${ticket.userName} ставит мероприятию ${ticket.className} оценку ${inc[3]}`
                                // })
                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    text: translations.thanks[user.language_code] || translations.thanks.en,
                                    show_alert: true,
                                }, 'answerCallbackQuery', token)
                            } else {
                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    text: translations.notYourTicket[user.language_code] || translations.notYourTicket.en,
                                    show_alert: true,
                                }, 'answerCallbackQuery', token)    
                            }
                        } else {
                            m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                text: translations.noTicket[user.language_code] || translations.noTicket.en,
                                show_alert: true,
                            }, 'answerCallbackQuery', token)
                        }
                    })
                }
            }
        }
    }

    if (req.body.my_chat_member) {
        if (req.body.my_chat_member.new_chat_member.status == 'kicked') {
            common.devlog(`пользователь выходит`)
            udb.doc(req.body.my_chat_member.chat.id.toString()).update({
                active: false,
                stopped: true
            }).then(s=>{
                udb.doc(req.body.my_chat_member.chat.id.toString()).get().then(u=>{
                    
                    u = common.handleDoc(u)

                    log({
                        text: `${uname(u,u.id)} блочит бот`,
                        user: u.id
                    })
                })
                
            }).catch(err=>{
                console.log(err)
            })
        }
    }
})



router.get(`/api/:type`, (req, res) => {
    switch (req.params.type) {
        
        case 'menu':{
            return axios.get(`${process.env.menuHost}/test/8UxO0ziaGusAzxnztRsU?lang=ge&api=true`)
            .then(data=>{
                console.log(data.data)
                res.json(data.data)
            }).catch(err=>{
                console.log(err)
                res.status(500).send(err.message)
            })
        }
        case `q`:{
            if(!req.query.class) return res.status(400).send(`no class provided`)
            return userClassesQ
                .where(`active`,'==',true)
                .where(`class`,'==',req.query.class)
                .get()
                .then(col=>{
                    res.json(common.handleQuery(col))
                })
        }
        case 'plans':{
            return plans.get().then(col=>{
                res.json(common.handleQuery(col).sort((a,b)=>{
                    return b.createdAt._seconds - a.createdAt._seconds 
                }))
            })
        }
        case 'polls': {
            let data = []
            data.push(
                polls
                .where('active', '==', true)
                .orderBy('createdAt', 'desc')
                .get()
                .then(col => common.handleQuery(col))
            )

            data.push(
                pollsAnswers
                .where('user', '==', +req.query.user)
                .orderBy('createdAt', 'desc')
                .get()
                .then(col => common.handleQuery(col))
            )
            return Promise.all(data).then(data => {
                res.json({
                    questions: data[0],
                    answers: data[1]
                })
            })

        }
        case 'userData': {

            if (!req.query.user) return res.status(400)

            udb.doc(req.query.user.toString()).get().then(d => {
                if (!d.exists) return res.sendStatus(404)

                return res.json(d.data())
            }).catch(err => {
                return res.status(500).send(err.message)
            })

            break;
        }
        case 'user': {
            if (!req.query.id) return res.status(400)

            let warning = null;

            userEntries.add({
                user: +req.query.id,
                createdAt: new Date()
            }).then(() => {

                udb.doc(req.query.id).update({
                    appOpens: FieldValue.increment(1)
                }).then(() => {

                }).catch(err => {
                    warning = 'noUser';
                })

                return udb.doc(req.query.id).get().then(u => {
                    u = u.data()

                    if (!u) {
                        return res.json({
                            warning: warning,
                            admin: false,
                            insider: false,
                            fellow: false,
                            classes: [],
                            userClasses: [],
                            coworking: [],
                            mr: []
                        })
                    }
                    // if(!u.occupation || !u.email){
                    //     return res.json({
                    //         warning: 'dataMissing'
                    //     })
                    // }
                    if (u.blocked) {
                        return res.json({
                            warning: 'userBlocked'
                        })
                    }

                    let data = [];

                    data.push(classes.where(`date`, '>', new Date().toISOString().split('T')[0]).get().then(col => common.handleQuery(col)))
                    data.push(userClasses.where(`user`, '==', +req.query.id).where('active', '==', true).get().then(col => common.handleQuery(col)))
                    data.push(coworking.where('date', '>=', new Date().toISOString().split('T')[0]).where('user', '==', +req.query.id).where('active', '==', true).get().then(col => common.handleQuery(col)))
                    data.push(mra.where('date', '>=', new Date().toISOString().split('T')[0]).where('user', '==', +req.query.id).where('active', '==', true).get().then(col => common.handleQuery(col)))

                    if (u.fellow) {
                        data.push(
                            polls
                            .where('active', '==', true)
                            .orderBy('createdAt', 'desc')
                            .get()
                            .then(col => common.handleQuery(col))
                        )

                        data.push(
                            pollsAnswers
                            .where('user', '==', +req.query.id)
                            .orderBy('createdAt', 'desc')
                            .get()
                            .then(col => common.handleQuery(col))
                        )
                    }

                    Promise.all(data).then(data => {
                        return res.json({
                            warning: warning,
                            admin: u.admin,
                            insider: u.insider,
                            fellow: u.fellow,
                            noSpam: u.noSpam,
                            classes: data[0],
                            userClasses: data[1],
                            coworking: data[2],
                            mr: data[3],
                            questions: data[4] || null,
                            answers: data[5] || null
                        })
                    })





                })
            })
            break;
        }
        case 'usersList': {
            if (!req.query.user) return res.status(400).send('no user provided')
            if (!req.query.type) return res.status(400).send('no type provided')

            return udb.doc(req.query.user).get().then(u => {
                u = u.data();
                if (u.admin || u[req.query.type]) {
                    udb
                        .where(req.query.type, '==', true)
                        .where('active', '==', true)
                        .get().then(col => {
                            res.json(common.handleQuery(col).map(user => {
                                return {
                                    id: user.id,
                                    username: user.username,
                                    first_name: user.first_name,
                                    last_name: user.last_name,
                                    about: user.about
                                }
                            }))
                        })
                } else {
                    res.sendStatus(403)
                }
            })
        }
        case 'classes': {

            udb.doc(req.query.user).get().then(u => {
                if (!u.exists) return res.sendStatus(404);

                u = u.data();

                if (u.blocked) return res.sendStatus(403)

                let data = []

                data.push(classes
                    .where(`active`, '==', true)
                    .where('date', '>=', new Date(+new Date()-2*60*60*1000).toISOString())
                    .orderBy('date')
                    .get().then(col => common.handleQuery(col).filter(c => ((u.admin || u.insider || u.fellow) ? true : ((c.fellows && u.fellow) || (c.admins && u.admin) || (!c.fellows && !c.admins))))))

                data.push(userClasses
                    .where('active', '==', true)
                    .where('user', '==', +req.query.user)
                    .get().then(col => common.handleQuery(col)))

                Promise.all(data).then(data => {

                    let result = []
                    data[0].forEach(c => {
                        let record = data[1].filter(uc => c.id == uc.class)[0]
                        if (record) {
                            c.booked =          true;
                            c.status =          record.status;
                            c.appointmentId =   record.id;
                            c.payed =           record.isPayed || false;
                        }
                        result.push(c)
                    })

                    res.json(result)

                }).catch(err => {
                    console.log(err)
                    res.json([])
                })

            })




            break;
        }
        case 'coworking': {
            halls
                .where(`active`, '==', true)
                .where('isCoworking', '==', true)
                .get().then(col => {
                    res.json(common.handleQuery(col))
                }).catch(err => {
                    alertAdmins({
                        text: `ошибка выгрузки коворкинга ${err.message}`
                    })
                    res.status(500).send(`Извините, сервис временно недоступен`)
                })
            break;
        }
        case 'mr': {
            mra
                .where('active', '==', true)
                .where('date', '>=', new Date().toISOString().split('T')[0])
                .get()
                .then(col => {
                    let records = common.handleQuery(col);
                    let i = 0;
                    let result = []
                    while (i < 7) {
                        let d = new Date(+new Date() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                        let t = {
                            date: d,
                            slots: []
                        }

                        let start = new Date().setHours(10, 0, 0);
                        let shift = 0;

                        let dayrecords = records.filter(r => r.date == d)


                        while (shift < 10) {

                            let time = new Date(+start + shift * 60 * 60 * 1000).toTimeString().split(' ')[0].split(':').slice(0, 2).join(':');
                            let time2 = new Date(+start + shift * 60 * 60 * 1000 + 30 * 60 * 1000).toTimeString().split(' ')[0].split(':').slice(0, 2).join(':');


                            t.slots.push({
                                time: time,
                                available: dayrecords.filter(r => r.time == time).length ? false : true,
                                self: dayrecords.filter(r => r.time == time && r.user == +req.query.user).length ? dayrecords.filter(r => r.time == time && r.user == +req.query.user)[0].id : false
                            })

                            t.slots.push({
                                time: time2,
                                available: dayrecords.filter(r => r.time == time2).length ? false : true,
                                self: dayrecords.filter(r => r.time == time2 && r.user == +req.query.user).length ? dayrecords.filter(r => r.time == time2 && r.user == +req.query.user)[0].id : false
                            })
                            shift++
                        }

                        result.push(t)
                        i++
                    }
                    res.json(result)
                }).catch(err => {
                    console.log(err)
                    res.json([])
                })
            break;
        }
        default:
            return res.json([])
    }
})

function alertClassClosed(cl) {

    let id = cl.id;
    cl = cl.data();


    log({
        text: `${eTypes.ru[cl.type]} отменяется (((`,
        class: id
    })

    userClasses
        .where('class', '==', id)
        .where('active', '==', true)
        .get()
        .then(col => {
            common.handleQuery(col).forEach(appointment => {
                udb.doc(appointment.user.toString()).get().then(ud => {
                    ud = ud.data();

                    m.sendMessage2({
                        chat_id: appointment.user,
                        text: translations.classClosed(cl)[ud.language_code] || translations.classClosed(cl).en
                    }, false, token)
                })

            })
        })
}

router.all(`/api/:data/:id`, (req, res) => {

    switch (req.params.data) {
        case `invite`:{
            return invites.doc(req.params.id).get().then(i=>{
                if(!req.query.user) return res.sendStatus(400)
                if(!i.exists) return res.sendStatus(404)
                i = i.data()
                // if(!i.active) return res.json({success: false, comment: `Данное приглашение уже было использовано.`})
                m.getUser(req.query.user,udb).then(u=>{
                    
                    if(!u) return res.json({
                        success: false,
                        comment: `Мы не знаем такого юзера.`
                    })

                    udb.doc(req.query.user).update({
                        occupation: i.occupation,
                        about:      i.about || null
                    }).then(rec=>{

                        res.json({
                            success: true,
                            plans: i.plan
                        })
                        // plans.where(`active`,'==',true).get().then(col=>{
                        //     res.json({
                        //         success: true,
                        //         plans: common.handleQuery(col).sort((a,b)=>{
                        //             return b.price - a.price 
                        //         })
                        //     })
                        // })

                        invites.doc(req.params.id).update({
                            active: false,
                            updatedAt: new Date()
                        })
                    }).catch(err=>{
                        res.status(500).send(err.message)
                    })


                })
            }).catch(err=>{
                console.log(err)
            })
        }
        case `q`:{
            switch (req.method){
                case `GET`:{
                    return userClassesQ.doc(req.params.id).get().then(q=>{
                        if(!q.exists) return res.sendStatus(404)
                        q = q.data()
                        m.getUser(q.user,udb).then(user=>{
                            q.userData = user;
                            res.json(q)
                        })
                    })
                }
                case `POST`:{
                    return m.getUser(req.body.user,udb).then(u=>{
                        if(u){
                            if(req.body.text && req.body.class) {
                                userClassesQ.add({
                                    active:     true,
                                    createdAt:  new Date(),
                                    class:      req.body.class,
                                    user:       req.body.user,
                                    text:       req.body.text
                                }).then(s=>{

                                    alertAdmins({
                                        text: `Новый вопрос к лекции: _${req.body.text}_`
                                    })

                                    res.json({
                                        success: true,
                                        comment: `Вопрос задан. А это уже половина ответа...`
                                    })
                                }).catch(err=>{
                                    res.json({
                                        success: false,
                                        comment: err.message
                                    })
                                })
                            } else {
                                res.sendStatus(400)
                            }
                        } else {
                            res.sendStatus(400)
                        }
                    })
                }
                case `DELETE`:{
                    return userClassesQ.doc(req.params.id).get().then(q=>{
                        if(!q.exists) return res.sendStatus(404)
                        userClassesQ.doc(req.params.id).update({
                            active: false,
                            updatedBy: req.query.by || `непонятно кем`
                        }).then(s=>{
                            res.sendStatus(200)
                        }).catch(err=>{
                            res.status(500).send(err.message)
                        })
                    })
                }
            }
            break;
        }
        case 'plans':{
            switch (req.method){
                case 'PUT':{
                    if(!req.query.user) return res.sendStatus(400)
                    return plans.doc(req.params.id).get().then(p=>{
                        if(!p.exists) return res.sendStatus(404)
                        p = p.data()
                        if(!p.active) return res.json({
                            success: false,
                            comment: `Извините, этот тариф уже недоступен.`
                        })
                        m.getUser(req.query.user,udb).then(u=>{
                            if(!u) return res.json({
                                success: false,
                                comment: `Извините, мы вас не знаем.`
                            })

                            if(u.blocked) return res.json({
                                success: false,
                                comment: `Извините, вам тут не рады.`
                            }) 

                            plansRequests.add({
                                user:       +req.query.user,
                                plan:       req.params.id,
                                createdAt:  new Date(),
                                active:     true
                            }).then(request=>{
                                res.json({
                                    success: true
                                })

                                m.sendMessage2({
                                    chat_id:    +req.query.user,
                                    photo:      `${process.env.ngrok}/paper/qr?id=${request.id}&entity=planRequests`,
                                    caption:       `Вы запросили подключение тарифа ${p.name}.\nПросто покажите администратору этот код — он сможет подключить тариф в пару кликов.`
                                },'sendPhoto',token)

                                alertAdmins({
                                    user: +req.query.user,
                                    text: `${uname(u, +req.query.id)} хочет приобрести тариф ${p.name} (${common.cur(p.price,'GEL')}).\nНадо найти человека и взять его деньги!`
                                })
                            })
                        })
                    })
                }
                case 'POST':{
                    isAdmin(req.query.id).then(proof=>{
                        if(proof){
                            return plans.add({
                                name:           req.body.name,
                                description:    req.body.description,
                                price:          +req.body.price,
                                visits:         +req.body.visits,
                                events:         +req.body.events,
                                createdBy:      +req.query.id,
                                days:           +req.body.days || 30,
                                createdAt:      new Date(),
                                active:         true
                            }).then(s=>{
                                res.json({
                                    id: s.id
                                })

                                log({
                                    text: `Админ @id${req.query.id} создает подписку «${req.body.name}» (${cur(req.body.price)}).`,
                                    admin: +req.query.id,
                                    silent: true
                                })


                            }).catch(err=>{
                                res.status(500).send(err.message)
                            })
                        } else {
                            return res.sendStatus(403)
                        }
                    })
                }
                default:{
                    return res.sendStatus(404)
                }
            }
            
            break;
        }

        case 'polls': {
            switch (req.method) {
                case 'GET': {

                }
                case 'POST': {

                    console.log('это ответ на вопрос')

                    if (req.body.fellow) {
                        return udb.doc(req.body.fellow.toString()).get().then(user => {
                            if (user.exists) {
                                user = user.data();
                                if (user.fellow) {
                                    polls.doc(req.params.id).get().then(poll => {
                                        if (poll.exists) {
                                            return pollsAnswers.add({
                                                createdAt: new Date(),
                                                user: req.body.fellow,
                                                q: req.params.id,
                                                text: req.body.text
                                            }).then(() => {
                                                console.log('ответ записан')
                                                return res.sendStatus(200)
                                            }).catch(err => {
                                                console.log(err)

                                                return res.status(500).send(err.message)
                                            })
                                        } else {
                                            console.log('Нет такого опроса')
                                            res.sendStatus(404)
                                        }
                                    })
                                } else {
                                    res.sendStatus(403)
                                }
                            } else {
                                res.status(404).send('no such user')
                            }
                        })
                    } else {
                        return res.status(400).send('no fellow provided')
                    }
                    break;
                }
            }

        }
        case 'profile': {

            switch (req.method) {
                case 'PUT': {
                    udb.doc(req.params.id.toString()).get().then(d => {


                        if (!d.exists) return res.sendStatus(404)

                        let plausible = [
                            'email',
                            'last_name',
                            'first_name',
                            'occupation',
                            'about',
                            'language_code',
                            'noSpam'
                        ]

                        plausible.forEach(type => {
                            if (req.body[type]) {
                                udb.doc(req.params.id).update({
                                    [type]: req.body[type],
                                    updatedAt: new Date()
                                })
                                if (type == 'language_code') {
                                    axios.post(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
                                        "chat_id": req.params.id,
                                        "menu_button": {
                                            "type": "web_app",
                                            "text": translations.app[req.body.type] || translations.app.en,
                                            "web_app": {
                                                "url": process.env.ngrok+"/paper/app"
                                            }
                                        }
                                    })
                                }
                            }
                        })

                        return res.sendStatus(200)

                    })
                    break;
                }
                default:
                    res.sendStatus(404)
                    break;
            }
            break;
        }
        case 'rules': {
            coworkingRules.doc(req.params.id).set({
                rules: req.body
            })
        }
        case 'types': {
            return eventTypes.doc(req.params.id).set({
                en: req.body[0],
                ru: req.body[1],
                nom: req.body[2]
            }).then(d => {
                res.send(d.id)
            }).catch(err => {
                res.status(400).send(err.message)
            })
        }
        case 'halls': {
            switch (req.method) {
                case 'POST': {
                    let data = {
                        active: req.body[1],
                        name: req.body[2],
                        floor: req.body[3],
                        description: req.body[4],
                        capacity: req.body[5],
                        pics: req.body[6],
                        price: req.body[7],
                        isCoworking: req.body[8],
                        isMeetingRoom: req.body[9],
                        createdAt: new Date()
                    }
                    return halls.add(data).then(record => {
                        res.json({
                            id: record.id
                        })



                    }).catch(err => {
                        res.status(500).send(err.message)
                    })
                }
                case 'PUT': {
                    return halls.doc(req.params.id).update({
                        active: req.body[1],
                        name: req.body[2],
                        floor: req.body[3],
                        description: req.body[4],
                        capacity: req.body[5],
                        pics: req.body[6],
                        price: req.body[7],
                        isCoworking: req.body[8],
                        isMeetingRoom: req.body[9],
                        updatedAt: new Date()
                    }).then(() => res.sendStatus(200))
                }
                default:
                    return res.status(400)
            }
        }
        case 'classes': {
            switch (req.method) {
                case 'POST': {
                    if (req.query.intention == 'book') {
                        if (!req.query.user) return res.sendStatus(400)
                        return bookClass(false, req.params.id, res, req.query.user)
                    } else if (req.query.intention == `rate`) {
                        if(!req.body.rate || !req.body.ticket) return res.sendStatus(400)
                        return userClasses.doc(req.body.ticket).get().then(t=>{
                            if(!t.exists) return res.sendStatus(404)
                            t = common.handleDoc(t)
                            if(t.status != `used`) return res.sendStatus(403)
                            userClasses.doc(req.body.ticket).update({
                                rate:           +req.body.rate,
                                reviewed:    new Date()
                            }).then(s=>{
                                log({
                                    text:   `Новая оценка к мероприятию ${req.body.className}: ${req.body.rate}`,
                                    user:   t.user,
                                    class:  t.class,
                                    ticket: req.body.ticket
                                })
                                res.send(`ok`)
                            }).catch(err=>{
                                res.sendStatus(500)
                                console.log(err)
                            })
                        })
                    } else if (req.query.intention == `review`) {
                        if(!req.body.text || !req.body.ticket) return res.sendStatus(400)
                        return userClasses.doc(req.body.ticket).get().then(t=>{
                            if(!t.exists) return res.sendStatus(404)
                            t = common.handleDoc(t)
                            if(t.status != `used`) return res.sendStatus(403)
                            userClasses.doc(req.body.ticket).update({
                                review:     req.body.text,
                                reviewed:    new Date()
                            }).then(s=>{
                                log({
                                    text:   `Новый отзыв к мероприятию ${req.body.className}: ${req.body.text}`,
                                    user:   t.user,
                                    class:  t.class,
                                    ticket: req.body.ticket
                                })
                                res.send(`ok`)
                            }).catch(err=>{
                                res.sendStatus(500)
                                console.log(err)
                            })
                        })
                        return res.sendStatus(200)
                    } else {

                        if (!req.body[2]) return res.status(400).send(`вы не указали дату`)
                        if (!req.body[4]) return res.status(400).send(`вы не указали зал`)
                        if (!req.body[6]) return res.status(400).send(`вы не указали название`)
                        if (!req.body[10]) return res.status(400).send(`вы не указали описание`)

                        let data = {
                            active: req.body[1],
                            date: req.body[2],
                            type: req.body[3],
                            hall: req.body[4],
                            hallName: req.body[5],
                            name: req.body[6],
                            author: req.body[7],
                            duration: req.body[8],
                            price: req.body[9],
                            description: req.body[10],
                            pic: req.body[12],
                            createdAt: new Date()
                        }

                        return classes.add(data).then(record => {
                            res.json({
                                id: record.id
                            })

                            log({
                                class: record.id,
                                text: `На ${data.date} назначена новая лекция: ${data.name}.`
                            })

                            if (req.query.alert) {
                                udb.get().then(col => {
                                    let users = common.handleQuery(col)
                                    users.forEach(u => {
                                        if ((process.env.develop == 'true' && u.tester) || process.env.develop != 'true') {
                                            if (data.pic) {
                                                m.sendMessage2({
                                                    chat_id: u.id,
                                                    photo: data.pic,
                                                    caption: translations.newLecture(data)[u.language_code] || translations.newLecture(data).en,
                                                    reply_markup: {
                                                        inline_keyboard: [
                                                            [{
                                                                text: translations.book[u.language_code] || translations.book.en,
                                                                callback_data: `class_${record.id}`
                                                            }],
                                                            [{
                                                                text: translations.tellMeMore[u.language_code] || translations.tellMeMore.en,
                                                                web_app: {
                                                                    url: process.env.ngrok + '/paper/app?start=classes'
                                                                }
                                                            }]
                                                        ]
                                                    }
                                                }, 'sendPhoto', token)
                                            } else {
                                                m.sendMessage2({
                                                    chat_id: u.id,
                                                    text: translations.newLecture(data)[u.language_code] || translations.newLecture(data).en,
                                                    reply_markup: {
                                                        inline_keyboard: [
                                                            [{
                                                                text: translations.book[u.language_code] || translations.book.en,
                                                                callback_data: `class_${record.id}`
                                                            }],
                                                            [{
                                                                text: translations.tellMeMore[u.language_code] || translations.tellMeMore.en,
                                                                web_app: {
                                                                    url: process.env.ngrok + '/paper/app?start=classes'
                                                                }
                                                            }]
                                                        ]
                                                    }
                                                }, false, token)
                                            }
                                        }



                                    })
                                })
                            }
                        }).catch(err => {
                            res.status(500).send(err.message)
                        })
                    }

                }
                case 'PUT': {

                    classes.doc(req.params.id).get().then(cl => {
                        if (!cl.exists) return res.status(404).send('нет такой записи...')
                        if (cl.data().active && !req.body[1]) {
                            alertClassClosed(cl)
                        }
                        return classes.doc(req.params.id).update({
                                active: req.body[1],
                                date: req.body[2],
                                type: req.body[3],
                                hall: req.body[4],
                                hallName: req.body[5],
                                name: req.body[6],
                                author: req.body[7],
                                duration: req.body[8],
                                price: req.body[9],
                                description: req.body[10],
                                pic: req.body[12],
                                createdAt: new Date()
                            })
                            .then(() => res.sendStatus(200))
                            .catch(err => {
                                console.log(err)
                            })
                    })
                    break;
                }
                case 'GET': {
                    if(!req.query.user) return res.sendStatus(400)

                    return classes.doc(req.params.id).get().then(c=>{
                        if(!c.exists) return res.sendStatus(404)
                        
                        common.devlog(`лекция есть`)

                        c = c.data();  
                        
                        common.devlog(c.active)


                        if(!c.active) return res.sendStatus(404)
                        
                        
                        userClasses
                            .where(`active`,'==',true)
                            .where(`user`,'==',req.query.user)
                            .get()
                            .then(col=>{
                                common.devlog(col.docs)
                                c.booked == (col.docs.length ? col.docs[0].id : false)
                                res.json(c)
                            }).catch(err=>{
                                res.status(500).send(err.message)
                            })
                    })
                    // classes
                    //     .where(`active`, '==', true)
                    //     .where('date', '>=', new Date().toISOString())
                    //     .orderBy('date')
                    //     .get().then(col => {
                    //         return res.json(common.handleQuery(col))
                    //     })

                }
                case `DELETE`: {
                    return unClassUser(req.params.id, false, res, req.query.user)
                }
                default:
                    return res.status(400)
            }
        }
        case 'coworking': {
            switch (req.method) {
                case 'GET': {
                    return coworking
                        .where('hall', '==', req.params.id)
                        .where('active', '==', true)
                        .where('date', '>=', new Date().toISOString().split('T')[0])
                        .get().then(reservations => {

                            halls.doc(req.params.id).get().then(h => {
                                h = h.data()
                                reservations = common.handleQuery(reservations)


                                let shift = 0;
                                let answer = []

                                while (shift < 7) {

                                    let date = new Date(+new Date() + shift * 24 * 60 * 60 * 1000).toISOString().split('T')[0]


                                    answer.push({
                                        date: date,
                                        capacity: h.capacity - reservations.filter(r => r.date == date).length,
                                        booked: reservations.filter(r => r.date == date && r.user == +req.query.user).length ? 1 : 0,
                                        record: reservations.filter(r => r.date == date && r.user == +req.query.user)[0] ?
                                            reservations.filter(r => r.date == date && r.user == +req.query.user)[0].id : null
                                    })
                                    shift++
                                }


                                res.json(answer)
                            })

                        })
                }
                case 'POST': {
                    return halls.doc(req.params.id).get().then(hall => {
                        hall = hall.data()
                        if (!hall.active) {
                            return res.json({
                                success: false,
                                text: 'hallNotAvailable'
                            })
                        } else {

                            roomsBlocked
                                .where('active', '==', true)
                                .where('room', '==', req.params.id)
                                .where('date', '==', req.query.date)
                                .get()
                                .then(col => {

                                    console.log(common.handleQuery(col))

                                    if (col.docs.length) {
                                        res.json({
                                            success: false,
                                            text: 'roomBlocked'
                                        })
                                    } else {
                                        coworking
                                            .where('hall', '==', req.params.id)
                                            .where('date', '==', req.query.date)
                                            .where('active', '==', true)
                                            .get()
                                            .then(col => {

                                                let users = common.handleQuery(col).map(r => r.user)

                                                if (users.indexOf(req.query.user) > -1) {

                                                    // return res.status(400).send('alreadyBooked')
                                                    return res.json({
                                                        success: false,
                                                        text: 'alreadyBooked'
                                                    })

                                                } else if (users.length == hall.capacity) {

                                                    return res.json({
                                                        success: false,
                                                        text: 'noSeatsLeft'
                                                    })
                                                    return res.status(400).send('noSeatsLeft')

                                                } else {
                                                    udb.doc(req.query.user.toString()).get().then(u => {

                                                        if (u.data().blocked) {
                                                            return res.json({
                                                                success: false,
                                                                text: 'youArBanned'
                                                            })
                                                            return res.status(400).send('youArBanned')
                                                            // noSeatsLeft
                                                        }

                                                        if (!u.data().occupation) return res.json({
                                                            success: false,
                                                            text: 'noOccupationProvided'
                                                        })
                                                        // return res.status(400).send('noOccupationProvided')
                                                        if (!u.data().email) return res.json({
                                                            success: false,
                                                            text: 'noEmailProvided'
                                                        })
                                                        // return res.status(400).send('noEmailProvided')

                                                        coworking.add({
                                                            user: +req.query.user,
                                                            hall: req.params.id,
                                                            date: req.query.date,
                                                            createdAt: new Date(),
                                                            active: true,
                                                            paymentNeeded: (u.data().insider || u.data().admin || u.data().fellow) ? false : (u.data().bonus ? false : true),
                                                            payed: false
                                                        }).then(rec => {

                                                            let bonusText = false;

                                                            if (u.data().bonus) {

                                                                bonusText = true

                                                                udb.doc(u.id).update({
                                                                    bonus: false
                                                                })
                                                            }

                                                            log({
                                                                text: `${uname(u.data(), u.id)} бронирует место в коворкинге ${hall.name} на ${req.query.date}`,
                                                                user: req.query.user,
                                                                hall: req.params.id
                                                            })

                                                            let pl = {
                                                                active: true,
                                                                id: rec.id,
                                                                intention: 'bookCoworking',
                                                                hall: req.params.id,
                                                                date: req.query.date,
                                                                user: req.query.user,
                                                                userName: (u.data().first_name + ' ' + u.data().last_name),
                                                                paymentNeeded: (u.data().insider || u.data().admin || u.data().fellow) ? false : (u.data().bonus ? false : true),
                                                                payed: false
                                                            }

                                                            axios.post(sheet, Object.keys(pl).map(k => `${k}=${pl[k]}`).join('&'), {
                                                                headers: {
                                                                    "Content-Type": "application/x-www-form-urlencoded"
                                                                }
                                                            })


                                                            res.json({
                                                                success: true,
                                                                text: bonusText ? 'coworkingBookingConfirmedBonus' : 'coworkingBookingConfirmed',
                                                                record: rec.id
                                                            })


                                                            m.sendMessage2({
                                                                chat_id: req.query.user,
                                                                caption: translations.coworkingBookingDetails(req.query.date, hall.name, u.data().language_code)[u.data().language_code] || translations.coworkingBookingDetails(req.query.date, hall.name, u.data().language_code).en,
                                                                photo: process.env.ngrok + `/paper/qr?id=${rec.id}&entity=coworking`,
                                                                reply_markup: {
                                                                    inline_keyboard: [
                                                                        [{
                                                                            text: translations.coworkingBookingCancel[u.data().language_code] || translations.coworkingBookingCancel.en,
                                                                            callback_data: `ca_cancel_${rec.id}`
                                                                        }]
                                                                    ]
                                                                }
                                                            }, 'sendPhoto', token)

                                                            if (bonusText) {
                                                                m.sendMessage2({
                                                                    chat_id: req.query.user,
                                                                    text: translations.coworkingBookingConfirmedBonus[u.data().language_code] || translations.coworkingBookingConfirmedBonus.en
                                                                }, false, token)
                                                            }
                                                        })
                                                    })
                                                }
                                            })
                                    }
                                })


                        }
                    })
                }
                case 'DELETE': {
                    return udb.doc(req.query.user.toString()).get().then(u => {

                        if (!u.exists) return res.status(400).send('error')

                        return coworking.doc(req.params.id).get().then(record => {
                            if (!record.exists) return res.status(400).send('noAppointment')
                            record = record.data();
                            if (record.user != +req.query.user) return res.status(403).send(`unAuthorized`)
                            if (!record.active) return res.status(500).send('alreadyCancelled')

                            coworking.doc(req.params.id).update({
                                active: false,
                                updatedAt: new Date(),
                                updatedBy: req.query.user
                            }).then(() => {
                                log({
                                    text: `${uname(u.data(),u.id)} отменяет запись в коворкинге ${record.date}`
                                })
                                res.send('appointmentCancelled')
                            })
                        }).catch(err => {
                            res.status(500).send('error')
                        })
                    })

                }
            }

        }
        case 'user': {
            registerUser(req.body)
            break;
        }
        case 'mr': {
            switch (req.method) {
                case 'POST': {
                    return bookMR(req.query.date, req.query.time, req.query.user, false, res)
                    break;
                }
                case 'DELETE': {
                    return unbookMR(req.params.id, req.query.user, false, res)
                    break;
                }
                default:
                    return res.status(404)
            }
        }
        default:
            res.status(404)
    }
})


function bookMR(date, time, userid, callback, res) {
    udb.doc(userid.toString()).get().then(user => {
        user = user.data()
        user.id = +userid

        if (user.blocked) {
            if (res) {
                return res.json({
                    success: false,
                    text: `youArBanned`
                })
            }
            if (callback) {
                return m.sendMessage2({
                    callback_query_id: callback.id,
                    show_alert: true,
                    text: translations.youArBanned[user.language_code] || translations.youArBanned.en
                }, 'answerCallbackQuery', token)
            }
        }

        if (!user.email) {
            if (res) {
                return res.json({
                    success: false,
                    text: `noEmailProvided`
                })
            }
            if (callback) {
                return m.sendMessage2({
                    callback_query_id: callback.id,
                    show_alert: true,
                    text: translations.noEmailProvided[user.language_code] || translations.noEmailProvided.en
                }, 'answerCallbackQuery', token)
            }
        }

        if (!user.occupation) {
            if (res) {
                return res.json({
                    success: false,
                    text: `noOccupationProvided`
                })
            }
            if (callback) {
                return m.sendMessage2({
                    callback_query_id: callback.id,
                    show_alert: true,
                    text: translations.noOccupationProvided[user.language_code] || translations.noOccupationProvided.en
                }, 'answerCallbackQuery', token)
            }
        }

        mra
            .where('date', '==', date)
            .where('time', '==', time)
            .where('active', '==', true)
            .get()
            .then(col => {
                if (col.docs.length) {
                    if (callback) {
                        m.sendMessage2({
                            callback_query_id: callback.id,
                            show_alert: true,
                            text: translations.noSeatsLeft[user.language_code] || translations.noSeatsLeft.en
                        }, 'answerCallbackQuery', token)
                    }
                    if (res) {
                        return res.json({
                            success: false,
                            text: 'noSeatsLeft'
                        })
                    }

                } else {
                    if (callback) {
                        m.sendMessage2({
                            callback_query_id: callback.id,
                            text: translations.onIt[user.language_code] || translations.noSeatsLeft.en
                        }, 'answerCallbackQuery', token)
                    }


                    mra.add({
                        user: user.id,
                        date: date,
                        time: time,
                        active: true,
                    }).then(rec => {

                        log({
                            text: `${uname(user, user.id)} забронировал место в переговорке на ${time} ${date}`,
                            user: user.id,
                        })

                        if (callback) {
                            m.sendMessage2({
                                chat_id: user.id,
                                text: `${(translations.dateSelected(date)[user.language_code] || translations.dateSelected(date).en)}\n${(translations.timeSelected(time)[user.language_code] || translations.timeSelected(time).en)}\n${translations.coworkingBookingConfirmed[user.language_code] || translations.coworkingBookingConfirmed.en}`,
                                message_id: callback.message.message_id
                            }, 'editMessageText', token).then(() => {
                                m.sendMessage2({
                                    chat_id: user.id,
                                    message_id: callback.message.message_id,
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{
                                                text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                                                callback_data: `mr_unbook_${rec.id}`
                                            }]
                                        ]
                                    }
                                }, 'editMessageReplyMarkup', token)
                            })
                        }

                        if (res) {
                            res.json({
                                success: true,
                                text: 'coworkingBookingConfirmed',
                                rec: rec.id
                            })
                            m.sendMessage2({
                                chat_id: user.id,
                                text: `${(translations.dateSelected(date)[user.language_code] || translations.dateSelected(date).en)}\n${(translations.timeSelected(time)[user.language_code] || translations.timeSelected(time).en)}\n${translations.coworkingBookingConfirmed[user.language_code] || translations.coworkingBookingConfirmed.en}`,
                                reply_markup: {
                                    inline_keyboard: [
                                        [{
                                            text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                                            callback_data: `mr_unbook_${rec.id}`
                                        }]
                                    ]
                                }
                            }, false, token)
                        }


                    })
                }
            })
    })


}


function handleError(err) {
    console.log(err);
    try {
        res.status(500).send(err.message)
    } catch (err) {

    }
}

function unClassUser(ref, user, res, id) {
    if (!user) {
        user = udb.doc(id).get().then(u => {
            let t = u.data();
            t.id = id
            return t
        }).catch(handleError)
    }

    Promise.resolve(user).then(user => {


        userClasses.doc(ref).get().then(appointment => {
            if (!appointment.exists) {


                m.sendMessage2({
                    chat_id: user.id,
                    text: translations.noAppointment[user.language_code] || translations.noAppointment.en
                }, false, token)


                if (res) {
                    res.json({
                        success: false,
                        text: `noAppointment`
                    })
                }
            } else {
                if (appointment.data().user == +user.id) {

                    userClasses.doc(ref).update({
                        active: false
                    }).then(() => {

                        if (res) {
                            res.json({
                                success: true,
                                text: `bookingCancelled`
                            })
                        }

                        userClasses.doc(ref).get().then(d => {
                            classes.doc(d.data().class).get().then(c => {
                                log({
                                    text: `${uname(user, user.id)} отказывается от места на лекции  ${c.data().name}`,
                                    user: user.id,
                                    class: d.data().class
                                })
                            })



                            userClassesWL
                                .where(`active`,'==',true)
                                .where('class','==',d.data().class)
                                .get()
                                .then(col=>{
                                    let line = common.handleQuery(col)
                                    if(line.length){
                                        let next = line.sort((a,b)=>a.createdAt._seconds - b.createdAt._seconds)[0]
                                        bookClass(false,d.data().class,false,next.user)
                                    }
                                    // common.handleQuery(col).forEach(wl=>{
                                    //     udb.doc(wl.user.toString()).get().then(u=>{
                                    //         u = u.data();
                                    //         if(!u.blocked){
                                    //             m.sendMessage2({
                                    //                 chat_id:    wl.user,
                                    //                 text:       translations.spareTicket(wl.className)[u.language_code] || translations.spareTicket(wl.className).en,
                                    //                 reply_markup:{
                                    //                     inline_keyboard:[[{
                                    //                         text: translations.book[u.language_code] || translations.book.en,
                                    //                         callback_data: 'class_' + wl.class
                                    //                     }]]
                                    //                 }
                                    //             },false,token).then(s=>{
                                    //                 userClassesWL.doc(wl.id).update({
                                    //                     active: false,
                                    //                     sent: new Date()
                                    //                 })
                                    //             }).catch(err=>{
                                    //                 console.log(err)
                                    //             })
                                    //         }
                                    //     })
                                        
                                    // })
                                })
                        })

                        



                        m.sendMessage2({
                            chat_id: user.id,
                            text: translations.appointmentCancelled[user.language_code] || translations.appointmentCancelled.en
                        }, false, token)


                        axios.post(sheet, `intention=unClass&appointment=${ref}`, {
                            headers: {
                                "Content-Type": "application/x-www-form-urlencoded"
                            }
                        })

                    }).catch(handleError)
                } else {

                    if (res) {
                        res.json({
                            success: false,
                            text: `unAuthorized`
                        })
                    } else {
                        m.sendMessage2({
                            chat_id: user.id,
                            text: translations.unAuthorized[user.language_code] || translations.noAppointment.en
                        }, false, token)
                    }

                }
            }

        })
    }).catch(handleError)

}

function unbookMR(id, userid, callback, res) {
    udb.doc(userid.toString()).get().then(user => {
        user = user.data()
        user.id = +userid

        if (callback) m.sendMessage2({
            callback_query_id: callback.id,
            text: translations.onIt[user.language_code] || translations.noSeatsLeft.en
        }, 'answerCallbackQuery', token)

        mra.doc(id).get().then(rec => {
            if (!rec.exists) {
                if (callback) m.sendMessage2({
                    callback_query_id: callback.id,
                    show_alert: true,
                    text: translations.noAppointment[user.language_code] || translations.noAppointment.en
                }, 'answerCallbackQuery', token)
                if (res) res.json({
                    success: false,
                    text: 'noAppointment'
                })

                return;
            }

            rec = rec.data();

            if (!rec.active) {
                if (callback) m.sendMessage2({
                    callback_query_id: callback.id,
                    show_alert: true,
                    text: translations.alreadyCancelled[user.language_code] || translations.alreadyCancelled.en
                }, 'answerCallbackQuery', token)
                if (res) res.json({
                    success: false,
                    text: 'alreadyCancelled'
                })
                return;
            }

            if (rec.user !== user.id) {
                if (callback) m.sendMessage2({
                    callback_query_id: callback.id,
                    show_alert: true,
                    text: translations.unAuthorized[user.language_code] || translations.unAuthorized.en
                }, 'answerCallbackQuery', token)
                if (res) res.json({
                    success: false,
                    text: 'unAuthorized'
                })
                return;
            }

            mra.doc(id).update({
                active: false,
                updatedAt: new Date()
            }).then(() => {

                log({
                    text: `${uname(user, user.id)} cнял место в переговорке на ${rec.time} ${rec.date}`,
                    user: user.id,
                })



                if (callback) m.sendMessage2({
                    chat_id: user.id,
                    text: `${translations.bookingCancelled[user.language_code] || translations.bookingCancelled.en}`,
                    message_id: callback.message.message_id
                }, 'editMessageText', token).then(() => {
                    m.sendMessage2({
                        chat_id: user.id,
                        message_id: callback.message.message_id,
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: translations.letsTryAgain[user.language_code] || translations.letsTryAgain.en,
                                    callback_data: 'mr_repeat'
                                }]
                            ]
                        }
                    }, 'editMessageReplyMarkup', token)
                })

                if (res) {
                    res.json({
                        success: true,
                        text: 'bookingCancelled'
                    })
                }

            }).catch(err => {

                console.log(err);

                m.sendMessage2({
                    chat_id: user.id,
                    text: translations.error[user.language_code] || translations.error.en
                }, false, token)
            })

        })


    }).catch(err => {
        console.log(err)
    })
}


// userClasses
//     .get()
//     .then(col=>{
//         common.handleQuery(col)
//             .filter(r=>r.status == `used`)
//             .forEach(cl=>{
//                 udb.doc(cl.user.toString()).update({
//                     classes: FieldValue.increment(1)
//                 }).then(s=>{
//                     console.log(`${cl.user} +1`)
//                 })
//             })
//     })


module.exports = router;

// // 

// axios.post(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
//         "chat_id":212327111,
//         "menu_button": {
//             "type": "web_app",
//             "text": translations.app.ru || translations.app.en,
//             "web_app": {
//                 "url": process.env.ngrok+"/paper/app"
//             }
//         }
//     }).then(s=>{
//         devlog(`button updated`)
//     })

// udb.get().then(col=>{
//     common.handleQuery(col).forEach((u,i)=>{
//         setTimeout(function(){
//             axios.post(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
//             "chat_id": u.id,
//             "menu_button": {
//                 "type": "web_app",
//                 "text": translations.app[u.language_code] || translations.app.en,
//                 "web_app": {
//                     "url": process.env.ngrok+"/paper/app"
//                 }
//             }
//         }).then(console.count(`set`))
//         .catch(err=>{
//             udb.doc(u.id.toString()).update({
//                 active: false
//             })
//             console.count(`deactivated`)
//         })
//         },i*200)
        
//     })
// })


// coworking
//     .where(`active`,'==',true)
//     .get()
//     .then(col=>{
//         let res = {};
//         common.handleQuery(col).forEach(line=>{
//             if(!res[line.user]) res[line.user] = 0
//             res[line.user] ++
//         })

//         let users = []
//         Object.keys(res).filter(id=>res[id]>1).forEach(id=>{
//             users.push(udb.doc(id).get().then(u=>u.data()))
//         })

//         Promise.all(users).then(users=>{
//             console.log(JSON.stringify(users))
//         })
//     })