
// let ngrok. =    process.env.ngrok2;
let ngrok =     process.env.ngrok;

let token =         process.env.papersToken || '';

var https =             require('https');
var fs =                require('fs');

const requestIp = require('request-ip');


var express =   require('express');
var router =    express.Router();
var axios =     require('axios');
var cors =      require('cors')
var common =    require('./common');
const m =       require('./methods.js');
var QRCode =    require('qrcode')
const qs =      require('qs');
const { createHash,createHmac } = require('node:crypto');
const appLink = `https://t.me/paperstuffbot/app`

const {
    isoDate,
    getDoc,
    uname,
    drawDate,
    devlog,
    clearTags
} = require ('./common.js')


router.use(cors())

const {
    initializeApp,
    cert
} = require('firebase-admin/app');

const {
    FieldValue
} = require('firebase-admin/firestore');


var RSS = require('rss');

const { ObjectStreamToJSON } = require('sitemap');

const { getStorage, getDownloadUrl } = require('firebase-admin/storage');

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
}, 'paper2');


let paymentToken =  process.env.papersPaymentToken;

setTimeout(function(){
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/paper/hook`).then(()=>{
        console.log(`papers hook set on ${ngrok}`)
    }).catch(handleError)   
},1000)

function handleError(err,res) {
    console.log(err);
    if(res) res.status(500).send(err.message)
}

let rules = {
    "ru": [],
    "en": []
}

// axios.get(`https://script.googleusercontent.com/macros/echo?user_content_key=8ueAKyluy0wuRZ4gK-jYG1wliibQFso2esjvTmXknHNccnnqWbx9WR87tyn_8NGCexpTF-qyb44z3NK84Pr7U1g6MxN26kZ1m5_BxDlH2jW0nuo2oDemN9CCS2h10ox_1xSncGQajx_ryfhECjZEnFu2t8qra_k6h-c-IrXBLuGe4Knck_n4W9ZqXPr5xbqRychS1TFgEQNGcQZg4Ud1WotKUAj2b7nNRcVf8Rejry2ONuo323X-2Un_HSoeWndfjC_srxjkgLU&lib=MMewcMQsLAdLM797F3opR7PSxH8z8Wjql`).then(d=>{
//     console.log(d.data)
//     rules = JSON.parse(d.data)
// })

const {
    adminTokens,
    authors,
    classes,
    coworking,
    coworkingRules,
    gallery,
    halls,
    invites,
    logs,
    messages,
    mra,
    promos,
    randomCoffees,
    standAlone,
    tokens,
    udb,
    userClasses,
    userTags,
    views,
    entries,
} = require(`./papers/cols.js`);

const {wine, rcMethods, classMethods, mrMethods, newsMethods, classDescription, methods } = require('./papers/logics.js');

const coworkingMethods = require('./papers/logics.js').coworking;
const translations = require('./papers/translations.js');
const {alertAdmins, log, cba } = require('./papers/store.js');




coworkingRules.get().then(col => {
    col.docs.forEach(l => {
        rules[l.id] = l.data().rules
    })
})

router.post(`/invite`,(req,res)=>{
    if(!req.body.occupation)        return res.status(400).send(`occupation is missing`)
    if(!req.body.about)             return res.status(400).send(`about is missing`)

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
            'client_id':    process.env.paperBotId,
            'client_secret': process.env.paperBotSecret,
            'code':         req.query.code,
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
                wysykey: process.env.wysykey,
                start: req.query.page,
                logs: common.handleQuery(col),
                // token: req.signedCookies.adminToken
            })
        }) 

    if(!req.signedCookies.adminToken) return res.redirect(`${process.env.ngrok}/paper/auth`)
    
    adminTokens
        .doc(req.signedCookies.adminToken)
        .get()
        .then(data=>{
            if(!data.exists) return res.sendStatus(403)
            if(data.data().active){
                logs
                    .orderBy(`createdAt`,'desc')
                    .limit(100)
                    .get()
                    .then(col=>{
                        res.render(`papers/web`,{
                            wysykey: process.env.wysykey,
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

    let data_check_string=Object.keys(req.body)
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


router.get('/app', (req, res) => {

    standAlone
        .where(`active`,'==',true)
        .where(`appVisible`,'==',true)
        .get()
        .then(static=>{
            res.render('papers/app', {
                user:   req.query.id,
                start:  req.query.start || req.query.tgWebAppStartParam,
                translations: translations,
                rules: rules,
                static: common.handleQuery(static,false,true)
            })
        })

    
})


router.get('/admin', (req, res) => {
    res.render('papers/admin', {
        user: req.query.id,
        start: req.query.start,
        translations: translations
    })
})


router.post(`/pourMeWine`, async (req, res) => {
    if (!req.query.id) return res.status(401).send(`Вы кто вообще?`)
    let user = await m.getUser(req.query.id, udb)
    if(!user) return res.status(401).send(`Вы кто вообще?`)
    if(!user.admin) return res.status(403).send(`Вам сюда нельзя`)
    wine.add(req.body, user).then(() => {
        res.sendStatus(200)
    }).catch(err=>{
        res.status(500).send(err.message)
    })
})


router.post(`/sendMe/:type`, (req, res) => {
    switch (req.params.type) {
        case 'address': {
            m.sendMessage2({
                chat_id:        req.body.user,
                "longitude":    44.78321832242679,
                "latitude":     41.71100813134866,
                "title": "Papers (Hotel Iliani)",
                "address": translations.iliani.en
            }, 'sendVenue', token)
        }
        default: {
            res.sendStatus(404)
        }
    }
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


router.get('/rss', function (req, res) {
    let feed = new RSS({
        title:      'Papers Kartuli',
        description: 'Лекторий, коворкинг и подкаст-студия в центре Тбилиси.',
        feed_url: 'https://papers.dimazvali.com/rss',
        site_url: 'https://papers.dimazvali.com/',
        // image_url: 'https://s.restorating.ru/w/1280x720/image/og_logo_new[1].jpg',
        webMaster: 'dimazvali@gmail.com',
        copyright: 'papers.dimazvali.com',
        custom_namespaces: {
            yandex: "http://news.yandex.ru",
            media: "http://search.yahoo.com/mrss/",
            turbo: "http://turbo.yandex.ru"
        }
    });

    classes.where(`active`,'==',true).get().then(col=>{
        common.handleQuery(col,true).forEach(cl=>{
            feed.item({
                title: cl.name,
                description: cl.description,
                url: 'https://papers.dimazvali.com/classes/' + cl.id,
                guid: cl.id,
                date: new Date(cl.createdAt._seconds*1000)
            })
        })

        authors.where(`active`,'==',true).get().then(col=>{
            common.handleQuery(col,true).forEach(cl=>{
                feed.item({
                    title: cl.name,
                    description: cl.description,
                    url: 'https://papers.dimazvali.com/authors/' + cl.id,
                    guid: cl.id,
                    date: new Date(cl.createdAt._seconds*1000)
                })
            })
            res.attachment('some.xml');
            res.status(200).send(feed.xml());
        })

        
    })


    // res.sendFile(feed.xml())
})


router.post(`/authWebApp`,(req,res)=>{
    authWebApp(req,res,token,adminTokens,udb,entries,registerUser)
})




function authWebApp(req, res, token, adminTokens, udb, entries,registerUser) {
    let data_check_string = Object.keys(req.body)
        .filter(key => key !== 'hash')
        .sort()
        .map(key => `${key}=${req.body[key]}`)
        .join('\n')


    const secretKey = createHmac('sha256', 'WebAppData')
        .update(token)
        .digest();

    const hmac = createHmac('sha256', secretKey)
        .update(data_check_string)
        .digest('hex');

    if (req.body.hash == hmac) {
        req.body.user = JSON.parse(req.body.user);


        m.getUser(req.body.user.id, udb).then(u => {

            if (u && u.blocked) return res.sendStatus(403)

            if (!u) registerUser(req.body.user)

            adminTokens.add({
                createdAt:  new Date(),
                user:       +req.body.user.id,
                active:     true
            }).then(async c => {

                res.cookie((req.query.token || 'adminToken'), c.id, {
                    maxAge: 7 * 24 * 60 * 60 * 1000,
                    signed: true,
                    httpOnly: true,
                }).json({
                    admin: u && u.admin ? true : false
                })
                
                if(u) udb.doc(req.body.user.id.toString()).update({
                    entries:    FieldValue.increment(+1),
                    recent:     new Date()
                })

                try {
                    const clientIp = requestIp.getClientIp(req);

                    if(clientIp.indexOf(`::`) == -1){
                        let ipdata = {
                            createdAt: new Date(),
                            ip:         clientIp,
                            city:       null,
                            country:    null,
                            region:     null,
                            user:       u? +u.id : null,
                            platform:   req.body.platform || null,
                            version:    req.body.version || null
                        }

                        try{
                            await axios.get(`https://api.ipgeolocation.io/ipgeo?apiKey=${process.env.ipgeolocation}&ip=${clientIp}`).then(d=>{
                                ipdata.city =       d.data.city || null;
                                ipdata.country =    d.data.country_name || null; 
                                ipdata.region =     d.data.continent_name || null;

                            })
                        } catch (err){

                        }

                        entries.add(ipdata)
                    }
                } catch (error) {
                    console.log(error)
                }
                


            })
        }).catch(err => {
            console.log(err)
        })
    } else {
        res.sendStatus(403)
    }
}


router.get(`/`,(req,res)=>{
    
    classes
        .where(`active`,'==',true)
        .where(`date`,'>',new Date().toISOString())
        .get()
        .then(col=>{

            standAlone
                .where(`active`,'==',true)
                .get()
                .then(pages=>{
                    res.render(`papers/main`,{
                        classes:        common.handleQuery(col).filter(c=>!c.admins && !c.fellows),
                        translations:   translations,
                        pages:          common.handleQuery(pages),
                        coworkingRules: coworkingRules,
                        drawDate:(d)=>  drawDate(d),
                        lang: req.language.split('-')[0],
                        clearTags:(txt) =>  clearTags(txt)
                    })
                })
        })
})

let users = {}

function registerUser(u) {

    u.createdAt = new Date();
    u.active = true;
    u.blocked = false;
    u.bonus = true;
    u.noSpam = false;

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
        }, false, token, messages)

        getAvatar(u.id).then(data=>{
            if(data && data.ok && data.result.total_count){
                let pic = data.result.photos[0].reverse()[0]
                // devlog(`${i}: ${pic.file_id}`)
                udb.doc(u.id.toString()).update({
                    avatar_id: pic.file_id
                })
            }
        })

        let d = u;
        d.intention = 'newUser'
        d.id = u.id
        d.createdAt = new Date().toISOString()

        alertAdmins({
            filter: `users`,
            type: 'newUser',
            text: `Новый пользователь бота:\n${JSON.stringify(u,null,2)}`,
            user_id: u.id
        })

        // udb.get().then(col=>{

        //     // if(col.docs.length != 1000){
        //     //     m.sendMessage2({
        //     //         chat_id: u.id,
        //     //         text: `Вы ${col.docs.length}-й подписчик, поздравляем! Теперь вы в курсе всех новостей Papers.`
        //     //     },false,token)
        //     // } else {
        //     //     m.sendMessage2({
        //     //         chat_id: u.id,
        //     //         text: `Вы 1000-й подписчик, поздравляем! В честь круглой цифры дарим вам абонемент в коворкинг на 6 дней и билет на любое мероприятие в Papers. Мы скоро свяжемся с вами и расскажем, как воспользоваться подарком.`
        //     //     },false,token)
        //     // }

            
        // })

        

    }).catch(err => {
        handleError(err)
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
                }, 'sendPhoto', token, messages)
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
                    text: `${common.drawDate(h.date,false,{time:true})}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author || h.authorName}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description}\n${h.price? `${translations.fee[lang] ||  translations.fee.en} ${common.cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`,
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
                }

                m.sendMessage2(message, (h.pic ? 'sendPhoto' : false), token)
            })
        })
}

function showBookings(id) {

}



router.post(`/news`, (req, res) => {
    isAdmin(req.query.id).then(async p => {

        if (p || req.headers.secret == process.env.paperSlackToken) {
            try {
                if (req.body.text && req.body.name) {
                
                    let record = await newsMethods.add(req.body,p||{username:`slack`,id:`slack`})
                    let result = await newsMethods.startNews(record.id);

                    res.json(result);
                } else {
                    res.sendStatus(400)
                }    
            } catch (error) {
                res.status(500).send(error.message)
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
    }, false, token, messages)

    if (type) {
        alertAdmins({
            text: `Пользвателю ${uname(user, user.id)} было отказано в ${type}.`
        })
    }
}




router.get('/alertClass/:class', (req, res) => {
    classes.doc(req.params.class).get().then(cl => {
        let h = cl.data();
        h.id = req.params.class
        udb.get().then(col => {

            let users = common.handleQuery(col)

            users.forEach(u => {
                
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
                        text: `${common.drawDate(h.date,false,{time:true})}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author || h.authorName}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description}\n${h.price? `${translations.fee[lang] ||  translations.fee.en} ${common.cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: kbd
                        }
                    }

                    if (h.pic) {
                        message.caption = message.text.slice(0, 1000)
                        message.photo = h.pic
                    }

                    m.sendMessage2(message, (h.pic ? 'sendPhoto' : false), token, messages)
                }
            })
        })
    })

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





router.post('/hook', async (req, res) => {
    
    res.sendStatus(200)

    let user = {}

    if (process.env.develop == 'true') console.log(JSON.stringify(req.body, null, 2))

    if (req.body.message) {
        user = req.body.message.from

        udb.doc(user.id.toString()).get().then(u => {

            if (!u.exists) registerUser(user)

            if(u.data() && !u.data().active){
                udb.doc(user.id.toString()).update({
                    active: true,
                    stopped: null
                }).then(s=>{
                    log({
                        filter: `users`,
                        text: `${uname(u.data(),user.id)} возвращается`,
                        user: +user.id
                    })  
                })
            }

            if (req.body.message.text && req.body.message.text.indexOf('/start randomcoffee') == 0) {
                m.getUser(user.id,udb).then(u=>{
                    if(u) {
                        udb.doc(user.id.toString()).update({
                            randomCoffee: true
                        }).then(()=>{
                            log({
                                silent: true,
                                user: user.id,
                                text: `${uname(user,user.id)} включает randomCoffee`,
                            })
                            m.sendMessage2({
                                chat_id: user.id,
                                text: `${common.greeting()}! Вы подключились к участию в нетворкинге random coffee. Чтобы начать, нужно оформить профиль. Пожалуйста, укажите свою сферу деятельности и напишите пару слов о себе. Так вашему собеседнику будет проще начать разговор.`,
                                reply_markup:{
                                    inline_keyboard:[[{
                                        text: `Заполнить профиль`,
                                        url: `https://t.me/paperstuffbot/app?startapp=profile`
                                    }]]
                                }
                            },false,token,messages)
                            
                        }) 
                    } else {
                        registerUser(user)
                        setTimeout(()=>{
                            udb.doc(user.id.toString()).update({
                                randomCoffee: true
                            }).then(()=>{
                                log({
                                    silent: true,
                                    user: user.id,
                                    text: `${uname(user,user.id)} включает randomCoffee`,
                                })
                                m.sendMessage2({
                                    chat_id: user.id,
                                    text: `${common.greeting()}! Вы подключились к участию в нетворкинге random coffee. Чтобы начать, нужно оформить профиль. Пожалуйста, укажите свою сферу деятельности и напишите пару слов о себе. Так вашему собеседнику будет проще начать разговор.`,
                                    reply_markup:{
                                        inline_keyboard:[[{
                                            text: `Заполнить профиль`,
                                            url: `https://t.me/paperstuffbot/app?startapp=profile`
                                        }]]
                                    }
                                },false,token,messages)
                                
                            }) 
                        },2000)    
                    }
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

            if (req.body.message.text && req.body.message.text.indexOf('/start cowork') == 0) {
                coworkingMethods.bookCoworking(u.data()||user, req.body.message.text.split('_')[1])
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
                }, false, token, messages)
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
                        text: `${drawDate(h.date,lang,{time:true})}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author || h.authorName}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description.slice(0,800)}\n${h.price? `${translations.fee[lang] ||  translations.fee.en}: ${common.cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`,
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
                                            url: `${ngrok}/paper/app`
                                        }
                                    }]
                                ]
                            }
                        }, false, token, messages)

                        m.sendMessage2({
                            chat_id: user.id,
                            text: `админка с дева`,
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: `test`,
                                        web_app: {
                                            url: `${ngrok}/paper/admin`
                                        }
                                    }]
                                ]
                            }
                        }, false, token, messages)
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
                        }, false, token, messages)
                        break;
                    case '/coworking':
                        checkUser(user.id).then(p => {
                            if (p) return coworkingMethods.sendCoworking(user)
                            sorry(user, `доступе к коворкингу`)
                        })

                        break;
                    case '/myclasses':
                        checkUser(user.id).then(p => {
                            if (p) return classMethods.sendUserClasses(user.id, user.language_code)
                            sorry(user)
                        })

                        break;
                    case '/meetingroom':
                        checkUser(user.id).then(p => {
                            if (p) return mrMethods.sendMeetingRoom(user)
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
                                filter: `messages`,
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
                                chat_id:    a.id,
                                caption:    `фото от ${uname(u.data(),u.id)}`,
                                photo:      req.body.message.photo[0].file_id
                        }, 'sendPhoto', token, messages)
                    })
                })
                axios.post(`https://api.telegram.org/bot${token}/getFile`, {
                    file_id: req.body.message.photo.reverse()[0].file_id
                }).then(src => {

                    gallery.doc(u.id.toString()).set({
                        active:     true,
                        img:        `https://api.telegram.org/file/bot${token}/${src.data.result.file_path}`,
                        caption:    req.body.message.caption||null,
                        username:   req.body.message.chat.username
                    })

                    let download = function(url, dest, cb) {
                        var file = fs.createWriteStream(dest);
                        var request = https.get(url, function(response) {
                          response.pipe(file);
                          file.on('finish', function() {
                            file.close(cb);  // close() is async, call cb after close completes.
                            getStorage(gcp).bucket(`paperstuff`)
                                .upload(dest)
                                .then(()=>{
                                    getStorage(gcp).bucket(`paperstuff`).file(dest).getSignedUrl({
                                        action: `read`,
                                        expires: '03-09-2491'
                                    }).then(link=>{
                                        devlog(link)
                                        gallery.doc(u.id.toString()).update({
                                            img:link[0]
                                        })
                                        fs.unlink(dest)
                                    }).catch(err=>{
                                        devlog(err)
                                    })
                                })
                                .catch(err=>{
                                    console.log(err)
                                })
                          });
                        }).on('error', function(err) { // Handle errors
                          fs.unlink(dest); // Delete the file async. (But we don't check the result)
                          if (cb) cb(err.message);
                        });
                      };

                    download(`https://api.telegram.org/file/bot${token}/${src.data.result.file_path}`,`image_${user.id}.jpg`)

                    
                    
                })
            }

        }).catch(err => {
            console.log(err)
        })
    }
    if(req.body.inline_query){
        let inc = req.body.inline_query.query.split('_');
        switch(inc[0]){
            case `classes`:{
                let data = await getDoc(classes,inc[1]);
                devlog(data);

                return m.sendMessage2({
                    inline_query_id: req.body.inline_query.id,
                    is_personal: true,
                    cache_time: 0,    
                    results:[{
                        type:   `article`,
                        id:     inc[1],
                        title:  data.name,
                        description: 'Нажмите, чтобы позвать товарища.',
                        reply_markup: `HTML`,
                        input_message_content: {
                            message_text: classDescription(data,`ru`)
                        },
                        reply_markup: {
                            inline_keyboard:[[{
                                text: 'Зарегистрироваться',
                                url: `${appLink}?startapp=classes_${inc[1]}`
                            }]]
                        }
                    }]
                },`answerInlineQuery`,token)
            }
        }
    }
    if (req.body.callback_query) {
        m.getUser(req.body.callback_query.from.id,udb).then(async userData => {
            
            let userRef = udb.doc(userData.id.toString())
            
            let userLogName = uname(userData,userData.id)
    
            user = req.body.callback_query.from;
    
            let inc = req.body.callback_query.data.split('_')
    
            if (inc[0] == 'unsubscribe') {
                userRef.update({
                    noSpam: true
                }).then(() => {
                    m.sendMessage2({
                        callback_query_id: req.body.callback_query.id,
                        show_alert: true,
                        text: translations.unsubscribeMessage[user.language_code] || translations.unsubscribeMessage.en
                    }, 'answerCallbackQuery', token)
                    log({
                        silent: true,
                        text: `${userLogName} отписывается от новостей`,
                        user: +userData.id
                    })
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
                        switch (inc[2]) {
                            case 'unsubscribe': {
                                isAdmin(user.id.toString()).then(proof => {
    
                                    if (!proof) return m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        show_alert: true,
                                        text: `Простите великодушно, но вы же не админ. Как вы вообще получили эту кнопку?..`
                                    }, 'answerCallbackQuery', token)
    
    
    
                                    userRef.update({
                                        stopLog: true
                                    }).then(() => {
    
                                        log({
                                            silent: true,
                                            text: `${userLogName} отписывается от рассылки логов`,
                                            user: +userData.id
                                        })
    
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
                                    
                                    userRef.update({
                                        stopLog: false
                                    }).then(() => {
                                        
                                        log({
                                            silent: true,
                                            text: `${userLogName} подписывается на рассылку логов`,
                                            user: +userData.id
                                        })
    
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
                                    blocked:    true,
                                    updatedAt:  new Date(),
                                    updatedBy:  +user.id
                                }).then(() => {
    
                                    log({
                                        filter: `users`,
                                        text:   `${userLogName} заблокировал пользователя ${uname(userdata,inc[2])}`,
                                        user:   +inc[2],
                                        admin:  user.id
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
                                        text: `${userLogName} сделал пользователя ${uname(userdata,inc[2])} участником fellows`,
                                        user: +inc[2],
                                        admin: user.id
                                    })
    
    
                                    m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        show_alert: true,
                                        text: `Пользователь отмечен как участник fellows.`
                                    }, 'answerCallbackQuery', token)
    
                                    m.sendMessage2({
                                        chat_id: inc[2],
                                        text: translations.fellow[userdata.language_code] || translations.fellow.en
                                    }, false, token, messages)
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
    
                                    m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        show_alert: true,
                                        text: `Пользователь отмечен как сотрудник.`
                                    }, 'answerCallbackQuery', token)
                                    m.sendMessage2({
                                        chat_id: inc[2],
                                        text: translations.congrats[userdata.language_code] || translations.congrats.en
                                    }, false, token, messages)
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
                                        text: `${userLogName} сделал пользователя ${uname(userdata,inc[2])} равным себе`,
                                        user: +inc[2],
                                        admin: user.id
                                    })
    
                                    m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        show_alert: true,
                                        text: `Пользователь отмечен как админ.`
                                    }, 'answerCallbackQuery', token)
    
                                    m.sendMessage2({
                                        chat_id: inc[2],
                                        text: 'Поздравляем, вы зарегистрированы как админ приложения'
                                    }, false, token, messages)
    
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
                        return mrMethods.sendMeetingRoom(user)
                    }
                    case 'date': {
                        
                        if(!inc[2]) {
                            m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: `date error`
                            }, 'answerCallbackQuery', token)

                            return common.alertMe({
                                text: req.body
                            })
                        }

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
    
                        return mrMethods.bookMR(inc[2], inc[3], user.id, req.body.callback_query)
    
                    }
                    case 'unbook': {
                        return mrMethods.unbookMR(inc[2], user.id, req.body.callback_query)
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
                        .where('date', '>=', isoDate())
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
                        return coworkingMethods.bookCoworking(userData,inc[2],inc[3],req)
                    }
    
                    case 'cancel': {
                        return coworkingMethods.cancel(inc[2],userData.id).then(code=>{
                            m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: translations[code][user.language_code] || translations[code].en
                            }, 'answerCallbackQuery', token)
                        }).catch(err=>{
                            // TBD: редактировать сообщение
                            m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: translations[err.message][user.language_code] || translations[err.message].en
                            }, 'answerCallbackQuery', token)
                        })
                        // coworking.doc(inc[2]).get().then(record => {
    
                        //     if (!record.exists) {
                        //         return m.sendMessage2({
                        //             callback_query_id: req.body.callback_query.id,
                        //             show_alert: true,
                        //             text: translations.noAppointment[user.language_code] || translations.noAppointment.en
                        //         }, 'answerCallbackQuery', token)
                        //     }
    
                        //     record = record.data();
    
    
                        //     if (+user.id !== +record.user) {
                        //         return m.sendMessage2({
                        //             callback_query_id: req.body.callback_query.id,
                        //             show_alert: true,
                        //             text: translations.unAuthorized[user.language_code] || translations.unAuthorized.en
                        //         }, 'answerCallbackQuery', token)
                        //     }
    
                        //     if (!record.active) {
                        //         return m.sendMessage2({
                        //             callback_query_id: req.body.callback_query.id,
                        //             show_alert: true,
                        //             text: translations.alreadyCancelled[user.language_code] || translations.alreadyCancelled.en
                        //         }, 'answerCallbackQuery', token)
                        //     }
    
    
    
                        //     coworking.doc(inc[2]).update({
                        //         active: false,
                        //         updatedAt: new Date(),
                        //         updatedBy: user.id
                        //     }).then(() => {
                        //         log({
                        //             filter: `coworking`,
                        //             text: `${userLogName} отменяет запись в коворкинге на ${record.date}`,
                        //             user: +userData.id
                        //         })
    
                        //         m.sendMessage2({
                        //             chat_id: user.id,
                        //             caption: translations.bookingCancelled[user.language_code] || translations.bookingCancelled.en,
                        //             text: translations.bookingCancelled[user.language_code] || translations.bookingCancelled.en,
                        //             message_id: req.body.callback_query.message.message_id
                        //         }, 'editMessageText', token).then(() => {
                        //             m.sendMessage2({
                        //                 chat_id: user.id,
                        //                 message_id: req.body.callback_query.message.message_id,
                        //                 reply_markup: {
                        //                     inline_keyboard: [
                        //                         [{
                        //                             text: translations.letsTryAgain[user.language_code] || translations.letsTryAgain.en,
                        //                             callback_data: `ca_repeat`
                        //                         }]
                        //                     ]
                        //                 }
                        //             }, 'editMessageReplyMarkup', token)
    
                        //         })
    
                        //     })
                        // })
                        // break
                    }
    
                    case 'repeat': {
                        checkUser(user.id).then(p => {
                            if (p) return coworkingMethods.sendCoworking(user)
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
                    chat_id:    user.id,
                    message_id: req.body.callback_query.message.message_id
                }, 'unpinChatMessage', token)
    
                classMethods.unClassUser(inc[1], user, false, false, req.body.callback_query.id)
    
    
            }
    
            if (inc[0] == 'class') {
                classMethods.bookClass(false, inc[1], false, user.id)
            }
    
            if (inc[0] == 'pay') {
                userClasses.doc(inc[1]).get().then(appointment => {
                    if (!appointment.exists) {
                        m.sendMessage2({
                            chat_id: user.id,
                            text: translations.noAppointment[user.language_code] || translations.noAppointment.en
                        }, false, token, messages)
                    } else {
                        if (appointment.data().payed) {
                            m.sendMessage2({
                                chat_id: user.id,
                                text: translations.alreadyPayed[user.language_code] || translations.alreadyPayed.en
                            }, false, token, messages)
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
    
            if (inc[0] == 'feedback') {
    
                switch (inc[1]) {
                    case 'ticket': {
                        return userClasses.doc(inc[2]).get().then(c => {
                            let ticket = c.data();
    
                            if (c.exists) {
                                if (ticket.user == user.id) {
                                    userClasses.doc(inc[2]).update({
                                        rate: +inc[3]
                                    })
                                    log({
                                        filter: `lectures`,
                                        text: `${userLogName} ставит оценку ${inc[3]} меропориятию ${ticket.className}.`,
                                        user: +user.id,
                                        class: ticket.class
                                    })
    
                                    m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        text: translations.thanks[user.language_code] || translations.thanks.en,
                                        show_alert: true,
                                    }, 'answerCallbackQuery', token)
    
                                    if (+inc[3] < 4) {
                                        m.sendMessage2({
                                            chat_id: user.id,
                                            text: translations.whatWasWrong[user.language_code] || translations.whatWasWrong.en
                                        }, false, token, messages)
                                    }
    
                                    classMethods.classReScore(ticket.class)
    
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
                    case `coworking`: {
    
                        devlog(`Отзыв к коворку`)
    
                        log({
                            filter: `coworking`,
                            silent: +inc[2] < 4 ? false : true,
                            text: `${userLogName} ставит коворкингу оценку ${inc[2]}.`,
                            user: +user.id,
                        })
    
                        userRef.update({
                            coworkingRate: +inc[2]
                        })
    
                        return m.sendMessage2({
                            callback_query_id: req.body.callback_query.id,
                            text: `Спасибо!`,
                            show_alert: true,
                        }, 'answerCallbackQuery', token)
                    }
                    case `podcasts`:{
                        
                        methods.podcasts.getRated(user.id,inc[2])
                        
                        return m.sendMessage2({
                            callback_query_id: req.body.callback_query.id,
                            text: `Спасибо!`,
                            show_alert: true,
                        }, 'answerCallbackQuery', token)
                    }
                }
            }
    
            if (inc[0] == `random`) {
    
                devlog(`это random`)
    
                return userRef.get().then(u => {
                    u = common.handleDoc(u);
                    switch (inc[1]) {
                        case `rate`: {
                            let ref = randomCoffees.doc(inc[2]);
    
                            return ref.get().then(couple => {
                                couple = common.handleDoc(couple)
                                if ((couple.rate || {}).hasOwnProperty(inc[3])) {
                                    return m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        show_alert: true,
                                        text: `Извините, вы уже поставили оценку.`
                                    }, 'answerCallbackQuery', token)
                                } else {
    
                                    rcMethods.rcReScore(Number(inc[4]), couple[inc[3]])
    
                                    return ref.update({
                                        [`rate.${inc[3]}`]: Number(inc[4])
                                    }).then(s => {
    
                                        return m.sendMessage2({
                                            callback_query_id: req.body.callback_query.id,
                                            show_alert: true,
                                            text: `Спасибо и до новых встреч!`
                                        }, 'answerCallbackQuery', token)
    
                                    }).catch(err => {
                                        handleError(err)
                                    })
                                }
    
                            })
    
    
                        }
                        case `confirm`: {
                            let ref = randomCoffees.doc(inc[2]);
                            return ref.get().then(meeting => {
                                meeting = common.handleDoc(meeting)
                                let rate = null;
                                if (meeting.first == user.id) {
                                    ref.update({
                                        ['proof.first']: true
                                    })
                                    rate = `second`
                                } else if (meeting.second == user.id) {
                                    ref.update({
                                        ['proof.second']: true
                                    })
                                    rate = `first`
                                } else {
                                    return m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        show_alert: true,
                                        text: `Но вас там не было!`
                                    }, 'answerCallbackQuery', token)
                                }
    
                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Спасибо! Как вам понравилось?\n(это совершенно анонимно)`
                                }, 'answerCallbackQuery', token)
    
                                m.sendMessage2({
                                    chat_id: user.id,
                                    message_id: req.body.callback_query.message.message_id,
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{
                                                text: `😵`,
                                                callback_data: `random_rate_${inc[2]}_${rate}_0`
                                            }, {
                                                text: `😐`,
                                                callback_data: `random_rate_${inc[2]}_${rate}_0.5`
                                            }, {
                                                text: `🤩`,
                                                callback_data: `random_rate_${inc[2]}_${rate}_1`
                                            }]
                                        ]
                                    }
                                }, 'editMessageReplyMarkup', token)
    
                            })
                        }
                        case `later`: {
                            return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: `Спасибо! Держим за вас кулачки!`
                            }, 'answerCallbackQuery', token)
                        }
                        case `deny`: {
                            let ref = randomCoffees.doc(inc[2]);
                            return ref.get().then(meeting => {
                                meeting = common.handleDoc(meeting)
                                let rate = null;
    
                                if (meeting.first == user.id) {
                                    ref.update({
                                        ['proof.first']: false
                                    })
                                    rate = `second`
                                } else if (meeting.second == user.id) {
                                    ref.update({
                                        ['proof.second']: false
                                    })
                                    rate = `first`
                                } else {
                                    return m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        show_alert: true,
                                        text: `Но вас там не было!`
                                    }, 'answerCallbackQuery', token)
                                }
    
                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Ничего страшного! Может быть, в следующий раз получится.`
                                }, 'answerCallbackQuery', token)
    
                                // m.sendMessage2({
                                //     chat_id: user.id,
                                //     message_id: req.body.callback_query.message.message_id,
                                //     reply_markup: {
                                //         inline_keyboard: [
                                //             [{
                                //                 text: `🤯`,
                                //                 callback_data: `random_rate_${inc[2]}_${rate}_0`
                                //             },{
                                //                 text: `🤔`,
                                //                 callback_data: `random_rate_${inc[2]}_${rate}_0.5`
                                //             },{
                                //                 text: `🤗`,
                                //                 callback_data: `random_rate_${inc[2]}_${rate}_1`
                                //             }]
                                //         ]
                                //     }
                                // }, 'editMessageReplyMarkup', token)
    
                            })
                        }
                        case `pass`: {
                            return userRef.update({
                                randomCoffeePass: true
                            }).then(s => {
                                log({
                                    silent: true,
                                    user: user.id,
                                    text: `${uname(u,u.id)} пропускает randomCoffee`,
                                })
                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `До скорых встреч!`
                                }, 'answerCallbackQuery', token)
    
                            })
                        }
                        case `subscribe`: {
                            devlog(`это подключение`)
                            return userRef.update({
                                randomCoffee: true
                            }).then(s => {
                                log({
                                    silent: true,
                                    user: user.id,
                                    text: `${uname(u,u.id)} включает randomCoffee`,
                                })
                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Ждем четверг!`
                                }, 'answerCallbackQuery', token).then(() => {
    
                                    m.sendMessage2({
                                        chat_id: user.id,
                                        message_id: req.body.callback_query.message.message_id,
                                        reply_markup: {
                                            inline_keyboard: [
                                                [{
                                                    text: `Отменить участие`,
                                                    callback_data: `random_unsubscribe`
                                                }]
                                            ]
                                        }
                                    }, 'editMessageReplyMarkup', token)
                                })
    
    
                            })
                        }
                        case `unsubscribe`: {
                            return userRef.update({
                                randomCoffee: false
                            }).then(s => {
                                log({
                                    silent: true,
                                    user: user.id,
                                    text: `${uname(u,u.id)} отключает randomCoffee`,
                                })
                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Не прощаемся!`
                                }, 'answerCallbackQuery', token).then(() => {
    
                                    m.sendMessage2({
                                        chat_id: user.id,
                                        message_id: req.body.callback_query.message.message_id,
                                        reply_markup: {
                                            inline_keyboard: [
                                                [{
                                                    text: `Включить random coffee`,
                                                    callback_data: `random_subscribe`
                                                }]
                                            ]
                                        }
                                    }, 'editMessageReplyMarkup', token)
                                })
    
    
                            })
                        }
                    }
                }).catch(err => {
                    console.log(err)
                })
    
            }

            if(inc[0] == `randomLecturePass`){
                let t = await getDoc(userClasses,inc[1]);
                if(t){
                    userClasses.doc(inc[1]).update({
                        pass: true
                    })
                }
                return m.sendMessage2({
                    callback_query_id: req.body.callback_query.id,
                    show_alert: true,
                    text: `Спасибо и до новых встреч!`
                }, 'answerCallbackQuery', token)
            }

            if(inc[0] == `podcasts`){
                try {
                    await methods.podcasts.cancel(inc[1],`воля пользователя`,user)
                } catch (error) {
                    handleError(error)
                }
            }
        })
    
    
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
                        filter: `users`,
                        text: `${uname(u,u.id)} блочит бот`,
                        user: +u.id
                    })
                })
                
            }).catch(err=>{
                console.log(err)
            })
        }
    }

    if(req.body.edited_message && req.body.edited_message.location){
        let loc = req.body.edited_message.location;
        devlog(loc)
        let lookup= [
            {
                location: 'дома',
                lat: 41.695299,
                long: 44.856253,
                greetings: `Вы почти на месте!`,
                googbyes: `Заходите в гости!`,
            },{
                location: 'магазина',
                lat: 41.697341,
                long: 44.855363,
                greetings: `Не забудьте купить вина!`,
                googbyes: `Точно не забыли?..`,
                
            },{
                location: 'магазина',
                greetings: `Добро пожаловать в Papers!`,
                googbyes: `До новых встреч!`,
                lat: 41.710950,
                long: 44.783232
            }
        ]
        
        lookup.forEach(place=>{
    
            devlog(place)
    
            let distance = dist(loc.latitude,loc.longitude, place.lat, place.long)*1000
            
            devlog(place.location,distance)
            
            if(distance-loc.horizontal_accuracy < 30 ){
    
                devlog(`пользователь прибыл в точку ${place.location}`)
                if(!alertedUsers[req.body.edited_message.chat.id] || !alertedUsers[req.body.edited_message.chat.id][place.location]) m.sendMessage2({
                    chat_id: req.body.edited_message.chat.id,
                    text: place.greetings
                },false,token)
                
                
    
                if(!alertedUsers[req.body.edited_message.chat.id]) alertedUsers[req.body.edited_message.chat.id] = {}
                
                alertedUsers[req.body.edited_message.chat.id][place.location] = true 
            } else {
                if(!alertedUsers[req.body.edited_message.chat.id]) alertedUsers[req.body.edited_message.chat.id] = {}
                
                if(alertedUsers[req.body.edited_message.chat.id][place.location]){
                    m.sendMessage2({
                        chat_id: req.body.edited_message.chat.id,
                        text: place.googbyes
                    },false,token)
                }
                alertedUsers[req.body.edited_message.chat.id][place.location] = false
            }
        })
    }

})


function dist(lat,long,toLat, toLong){
    return +(Math.sqrt(Math.pow((lat - toLat) * 111.11, 2) + Math.pow((long - toLong) * 55.8, 2))).toFixed(3)
}

alertedUsers = {

}






router.get(`/:section`,(req,res)=>{

    devlog(rules)

    switch(req.params.section){
        case `coworking`:{
            return halls
                .where(`active`,'==',true)
                .where(`isCoworking`,'==',true)
                .get()
                .then(col=>{
                    res.render(`papers/coworking`,{
                        title:              `Коворкинг Papers Kartuli`,
                        description:        `Выберите зал на свой вкус (цвет почти одтин и тот же).`,
                        halls:              common.handleQuery(col,true),
                        translations:       translations,
                        coworkingRules:     rules,
                        drawDate:(d)=>      drawDate(d),
                        lang:               req.language.split('-')[0],
                        cur:(p)=>           common.cur(p),
                        uname:(u,id)=>      uname(u,id),
                        clearTags:(txt) =>  clearTags(txt)
                    })
                })
        }
        case  `staff`:{
            return udb
                .where(`active`,'==',true)
                .where(`insider`,'==',true)
                .where(`public`,'==',true)
                .get()
                .then(col=>{
                    res.render(`papers/staff`,{
                        title:              `Редакция Papers Kartuli`,
                        description:        `На связи 24/7!`,
                        staff:              common.handleQuery(col,false,true),
                        translations:       translations,
                        coworkingRules:     coworkingRules,
                        drawDate:(d)=>      drawDate(d),
                        lang:               req.language.split('-')[0],
                        cur:(p)=>           common.cur(p),
                        uname:(u,id)=>      uname(u,id),
                        clearTags:(txt) =>  clearTags(txt)
                    })
                })
        }

        case  `classes`:{
            return classes
                .where(`active`,'==',true)
                .where(`date`,'>',new Date().toISOString())
                .get()
                .then(col=>{
                    res.render(`papers/classes`,{
                        title:              `Лекции, концерты, мастер-классы Papers Kartuli`,
                        description:        `Ждем вас в гости!`,
                        classes:            common.handleQuery(col).filter(c=>!c.admins && !c.fellows),
                        translations:       translations,
                        coworkingRules:     coworkingRules,
                        drawDate:(d)=>      drawDate(d),
                        lang:               req.language.split('-')[0],
                        cur:(p)=>           common.cur(p),
                        clearTags:(txt) =>  clearTags(txt)
                    })
                })
        }
        case `authors`:{
            return authors
                .where(`active`,'==',true)
                // .where(`date`,'>',new Date().toISOString())
                .get()
                .then(col=>{
                    res.render(`papers/authors`,{
                        title:              `Авторы и ведущие Papers Kartuli`,
                        description:        `Ждем вас в гости!`,
                        authors:            common.handleQuery(col,false,true),
                        translations:       translations,
                        coworkingRules:     coworkingRules,
                        drawDate:(d)=>      drawDate(d),
                        lang:               req.language.split('-')[0],
                        cur:(p)=>           common.cur(p),
                        clearTags:(txt) =>  clearTags(txt)
                    })
                })
        }
        default:{
            return res.sendStatus(404)
        }
    }
})

router.get(`/:section/:id`,(req,res)=>{
    
    let response = {
        translations:       translations,
        coworkingRules:     rules,
        uname:(u,id)=>      uname(u,id),
        drawDate:(d,l,t)=>  drawDate(d,false,t),
        lang:               req.language.split('-')[0],
        cur:(p,cur)=>       common.cur(p,cur),
        clearTags:(txt) =>  clearTags(txt)
    }

    switch (req.params.section){
        case `static`:{
            return standAlone.doc(req.params.id).get().then(page=>{
                
                

                if(!page.exists) return res.sendStatus(404)
                
                page = common.handleDoc(page)
                
                if(!page.active) return res.sendStatus(404)
                
                standAlone.doc(req.params.id).update({
                    views: FieldValue.increment(1)
                })

                if(req.params.id == `gallery`) return gallery.where(`active`,'==',true).get().then(col=>{
                    res.render(`papers/gallery`,{
                        name:           page.name,
                        description:    page.description,
                        html:           page.html,
                        pic:            page.pic,
                        gallery:        common.handleQuery(col),
                        clearTags:(txt)=> clearTags(txt)
                    })
                })

                return res.render(`papers/static`,{
                    name:           page.name,
                    description:    page.description,
                    html:           page.html,
                    pic:            page.pic,
                    clearTags:(txt)=> clearTags(txt)
                })
            })
        }
        case `tickets`:{
            return userClasses.doc(req.params.id).get().then(t=>{
                if(!t.exists) return res.sendStatus(404)
                t = common.handleDoc(t)
                if(!t.active) return res.sendStatus(404)
                classes.doc(t.class).get().then(cl=>{
                    
                    devlog(common.handleDoc(cl))

                    res.render(`papers/ticket`,{
                        cl: common.handleDoc(cl),
                        ticket: t,
                        uname:(u,id)=>      uname(u,id),
                        drawDate:(d,l,t)=>  drawDate(d,false,t),
                        lang:               req.language.split('-')[0],
                        cur:(p,cur)=>       common.cur(p,cur),
                        clearTags:(txt) =>  clearTags(txt)
                    })
                })
            })
        }
        case `coworking`:{
            return getDoc(halls,req.params.id).then(hall=>{
                
                views.add({
                    name:       hall.name,
                    entity:     `halls`,
                    createdAt:  new Date(),
                    id:         req.params.id
                })

                halls.doc(req.params.id).update({
                    views: FieldValue.increment(1)
                })

                let o = {
                    title:              `${hall.name} | коворкинг Papers Kartuli`,
                    description:        hall.description,
                    image:              hall.pics,
                    hall:               hall
                }

                Object.keys(response).forEach(k=>o[k] = response[k])
                
                res.render(`papers/hall`,o)


            })
        }
        case `authors`:{
            return getDoc(authors,req.params.id).then(a=>{
                
                if(!a || !a.active) return res.sendStatus(404)
                
                views.add({
                    name:       a.name,
                    entity:     `authors`,
                    createdAt:  new Date(),
                    id:         req.params.id
                })
    
                authors.doc(req.params.id).update({
                    views: FieldValue.increment(1)
                })

                classes
                    .where(`authorId`,'==',req.params.id)
                    .where(`active`,'==',true)
                    .get()
                    .then(col=>{
                        let o = {
                            title:              `${a.name} | ведущие Papers Kartuli`,
                            description:        a.description,
                            image:              a.pic,
                            classes:            common.handleQuery(col,true).filter(a=>new Date()<new Date(a.date)),
                            archive:            common.handleQuery(col,true).filter(a=>new Date()>new Date(a.date)),
                            author:             a  
                        }

                        Object.keys(response).forEach(k=>o[k] = response[k])
                        
                        res.render(`papers/author`,o)
                    })
                
                
            })
        }
        case `classes`:{
            return getDoc(classes,req.params.id).then(c=>{
            
                if(!c) return res.sendStatus(404)
    
                let googleData = {
                    "@context": "https://schema.org",
                    "@type": "Event",
                    "name": c.name,
                    "startDate": c.date,
                    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
                    "eventStatus": "https://schema.org/EventScheduled",
                    "location": {
                      "@type": "Place",
                      "name": "Papers Space",
                      "address": {
                        "@type": "PostalAddress",
                        "streetAddress": "1/10, 1 Veriko Anjaparidze St",
                        "addressLocality": "Tbilisi",
                        "postalCode": "0100",
                        "addressRegion": "Tbilisi",
                        "addressCountry": "GE"
                      }
                    },
                    "image": [
                      c.pic
                     ],
                    "description": c.description,
                    "offers": {
                      "@type": "Offer",
                      "url":    appLink + '?startapp=classes_'+c.id,
                      "price": c.price,
                      "priceCurrency": "GEL",
                      "availability": "https://schema.org/InStock",
                      "validFrom": new Date(c.createdAt._seconds).toISOString()
                    },
                    "performer": {
                      "@type": "PerformingGroup",
                      "name": c.authorName
                    },
                    "organizer": {
                      "@type": "Organization",
                      "name": "Papers Space",
                      "url": "https://papers.dimazvali.com"
                    }
                  }


                views.add({
                    name:       c.name,
                    entity:     `classes`,
                    createdAt:  new Date(),
                    id:         req.params.id
                })
    
                classes.doc(req.params.id).update({
                    views: FieldValue.increment(1)
                })
                
                res.render(`papers/class`,{
                    title:              `${c.name} | Лекции, концерты, мастер-классы Papers Kartuli`,
                    description:        c.description,
                    image:              c.pic,
                    cl:                 c,
                    translations:       translations,
                    coworkingRules:     coworkingRules,
                    drawDate:(d,l,t)=>  drawDate(d,false,t),
                    lang:               req.language.split('-')[0],
                    cur:(p,cur)=>       common.cur(p,cur),
                    json:               JSON.stringify(googleData),
                    clearTags:(txt) =>  clearTags(txt)
                })
            })
        }
        default: {
            return res.sendStatus(404)
        }
    }
    
})




function getAvatar(id){
    return axios.post('https://api.telegram.org/bot' + token + '/getUserProfilePhotos', {
        user_id: id || common.dimazvali
    }, {headers: {'Content-Type': 'application/json'}
    }).then(d=>{
        return d.data
    }).catch(err=>{
        
        console.log(err)
    })
}

common.ifBefore(udb,{}).then(async col=>{
    col = col.filter(u=>!u.hasOwnProperty(`noSpam`))
    for (let index = 0; index < col.length; index++) {
        const u = col[index];
        if(!u.hasOwnProperty(`noSpam`)){
            await udb.doc(u.id.toString()).update({
                noSpam: false
            }).then(()=>{
                console.log(`${u.id} updated, ${col.length-index}`)
            })
        }
    }
})

module.exports = {
    
    appLink,
    cba,
    router,
    getAvatar,
    registerUser,
    isAdmin
};