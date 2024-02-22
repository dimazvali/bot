const host = 'ps';
var express = require('express');
var router = express.Router();
var axios = require('axios');
var cors = require('cors')
var sha256 = require('sha256');
var common = require('./common');
const m = require('./methods.js');
var QRCode = require('qrcode')
var cron = require('node-cron');
var FormData = require('form-data');
var modals = require('./modals.js').modals
const qs = require('qs');
var uname = require('./common').uname;
var drawDate = require('./common').drawDate;
const {
    createHash,
    createHmac,
    subtle
} = require('node:crypto');
const devlog = require(`./common`).devlog
const ngrok = process.env.ngrok;

const {
    initializeApp,
    applicationDefault,
    cert,
    refreshToken
} = require('firebase-admin/app');

const {
    getFirestore,
    Timestamp,
    FieldValue
} = require('firebase-admin/firestore');


const {
    text,
    query,
    json
} = require('express');

const {
    sendAt
} = require('cron');


const locals = {
    greetings:          `Добро пожаловать в программу профессиональных свидетелей!\nДело за малым: чтобы завершить регистрацию, пришлите нам свой номер телефона (с помощью кнопки на клавиатуре), а также свой логин в запрещенной социальной сети с картинками.`,
    blocked:            `Простите, ваш аккаунт заблокирован.`,
    provideYpurPhone:   `Пожалйуста, отправьте свой номер телефона с помощью кнопки на клавиатуре бота.`,
    sendPhone:          `Отправить номер`,
    nuberIsBusy:        `Извините, этот номер уже занят. Сейчас я расскажу об этом администраторам, они разберутся.`,
    instNeeded:         `Спасибо за доверие!\nТеперь, пожалуйста, отправьте свой ник в instagram.`,
    nicknameOccupied:   `Извините, этот ник уже занят. Сейчас я расскажу об этом администраторам, они разберутся.`,
    preConfirmed:       `Спасибо!\nВаша учетная запись оформлена и дожидается подтверждения от модератора. Остаемся на связи.`,
    provideInstLogin:   `Чтобы продолжить общение, пожалуйста, пришлите ссылку на свой профиль в запрещенной соцсети с картинками.`,
    justNotYet:         `Извините, ваша учетная запись еще не подтверждена`,
    fileNeeded:         `Извините, мы не принимаем фотографии в этом формате. Пожалуйста, отправьте картинку как файл (через аттач).`,
    congrats:           `Поздравляем! Ваша учетная запись подтверждена и активирована. Скоро вы начнете получать задания!`,
    notWelcome:         `Простите, но мы вам больше не рады...`,
    archive: (name) =>  `Внимание! Задание «${name}» переносится в архив.`,
    reviewed: (name, score) => {
        return          `Ваша работа по заданию «${name}» была оценена на ${score}.`
    }
}



let gcp = initializeApp({
    credential: cert({
        "type": "service_account",
        "project_id": "psbot-7faf5",
        "private_key_id": process.env.psIdKey,
        "private_key": process.env.psKey.replace(/\\n/g, '\n'),
        "client_email": "firebase-adminsdk-qizme@psbot-7faf5.iam.gserviceaccount.com",
        "client_id": "100709622312378886138",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-qizme%40psbot-7faf5.iam.gserviceaccount.com",
        "universe_domain": "googleapis.com"
    }),
    databaseURL: "https://psbot-7faf5.firebaseio.com"
}, 'ps');

let fb = getFirestore(gcp);


let token = process.env.psToken;
let udb =           fb.collection('users');
let messages =      fb.collection('userMessages');
let logs =          fb.collection('logs');
let tokens =        fb.collection('tokens');
let adminTokens =   fb.collection('adminTokens');
let tags =          fb.collection('tags');
let userTags =      fb.collection('userTags');
let userTasks =     fb.collection('userTasks');
let userTasksSubmits = fb.collection('userTasksSubmits');
let tasks =         fb.collection(`tasks`);
let news =          fb.collection(`news`);

let admins = [];

// init Admins
udb
    .where(`admin`, '==', true)
    .get()
    .then(col => {
        admins = common.handleQuery(col)
    })


axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${process.env.ngrok}/${host}/hook`).then(s => {
    console.log(`psBot hook set to ${ngrok}`)
})

router.get('/admin', (req, res) => {
    res.render(host + '/admin', {
        user: req.query.id,
        start: req.query.start,
        translations: translations
    })
})


function log(o) {

    o.createdAt = new Date()

    let copy = JSON.parse(JSON.stringify(o));

    delete copy.kbd;

    logs.add(copy).then(r => {
        if (!o.silent) {
            alertAdmins({
                text: o.text,
                kbd: o.kbd || null
            })
        }
    })
}

function alertAdmins(o) {
    let msg = {
        text: o.text
    }
    if (o.kbd) {
        msg.reply_markup = {
            inline_keyboard: o.kbd
        }
    }
    admins.forEach((a, i) => {
        setTimeout(() => {
            msg.chat_id = a.id;
            m.sendMessage2(msg, false, token)
        }, i * 100)
    })
}

function registerUser(u) {
    u.createdAt = new Date();
    u.active = true;
    u.blocked = false;
    u.score = 0;
    udb.doc(u.id.toString()).set(u).then(() => {
        m.sendMessage2({
            chat_id: u.id,
            text: locals.greetings,
            reply_markup: {
                resize_keyboard: true,
                one_time_keyboard: true,
                keyboard: [
                    [{
                        text: locals.sendPhone,
                        request_contact: true
                    }]
                ]
            }
        }, false, token)
    })
}

function sorry(user) {

    // TBC: обсудить, как заблокированным пользователям подать аппеляцию

    m.sendMessage2({
        chat_id: u.id,
        text: locals.blocked
    }, false, token)
}

function regstriationIncomplete(user, message) {
    if (!user.phone) {
        if (!message.contact) {
            m.sendMessage2({
                chat_id: user.id,
                text: locals.provideYpurPhone,
                reply_markup: {
                    resize_keyboard: true,
                    one_time_keyboard: true,
                    keyboard: [
                        [{
                            text: locals.sendPhone,
                            request_contact: true
                        }]
                    ]
                }
            }, false, token)
        } else {
            let uPhone = message.contact.phone_number.replace(/\+/, '')
            udb
                .where(`phone`, '==', uPhone)
                .get()
                .then(col => {
                    if (col.docs.length) return m.sendMessage2({
                        chat_id: user.id,
                        text: locals.nuberIsBusy
                    })
                    udb.doc(user.id.toString()).update({
                        phone: uPhone
                    }).then(() => {
                        m.sendMessage2({
                            chat_id: user.id,
                            text: locals.instNeeded
                        }, false, token)
                    })
                })
        }

    } else if (!user.inst) {
        if (message.text) {
            let login = message.text.split(`instagram.com/`)
            if (login.length > 1) {
                login = login[1]
            } else {
                login = login[0]
            }
            login = login.split('?')[0]
            udb
                .where(`inst`, '==', login)
                .get()
                .then(col => {
                    if (col.docs.length) return m.sendMessage2({
                        chat_id: user.id,
                        text: locals.nicknameOccupied
                    }, false, token)
                    udb.doc(user.id.toString()).update({
                        inst: login
                    }).then(() => {
                        m.sendMessage2({
                            chat_id: user.id,
                            text: locals.preConfirmed
                        }, false, token)

                        log({
                            user: user.id,
                            text: `Пользователь ${uname(user,user.id)} завершает оформление профиля.\nТелефон +${user.phone}\nИнст: https://www.instagram.com/${login}.`,
                            kbd: [
                                [{
                                    text: `Валидировать`,
                                    callback_data: 'user_activate_' + user.id
                                }],
                                [{
                                    text: `Заблокировать`,
                                    callback_data: 'user_block_' + user.id
                                }],
                                [{
                                    text: `Открыть профиль`,
                                    url: `${process.env.ngrok}/${host}/web?start=user_${user.id}`
                                }]
                            ]
                        })

                    })
                })
        } else {
            m.sendMessage2({
                chat_id: user.id,
                text: locals.provideInstLogin
            }, false, token)
        }
    } else {
        m.sendMessage2({
            chat_id: user.id,
            text: locals.justNotYet
        }, false, token)
    }
}

router.post(`/hook`, (req, res) => {
    res.sendStatus(200)

    devlog(JSON.stringify(req.body, null, 2))

    let user = {};
    if (req.body.my_chat_member) {
        if (req.body.my_chat_member.new_chat_member.status == 'kicked') {

            udb.doc(req.body.my_chat_member.chat.id.toString()).update({
                active: false,
                stopped: true
            }).then(s => {
                udb.doc(req.body.my_chat_member.chat.id.toString()).get().then(u => {

                    u = common.handleDoc(u)

                    log({
                        text: `${uname(u,u.id)} блочит бот`,
                        user: u.id
                    })
                })

            }).catch(err => {
                console.log(err)
            })
        }
    }

    if (req.body.message && req.body.message.from) {
        user = req.body.message.from;
        m.getUser(user.id, udb).then(u => {

            if (!u) return registerUser(user)
            if (u.blocked) return sorry(user)
            if (!u.ready) return regstriationIncomplete(u, req.body.message)
            if (!u.active) return udb.doc(user.id.toString()).update({
                active: true,
                stopped: null
            }).then(s => {
                log({
                    text: `Пользователь id ${user.id} возвращается`
                })
            })

            if (req.body.message.text) {

                // пришло текстовое сообщение;

                messages.add({
                    user: user.id,
                    text: req.body.message.text || null,
                    createdAt: new Date(),
                    isReply: false
                })

                switch (req.body.message.text) {
                    // TBC: команды
                    default:
                        return alertAdmins({
                            text: `${uname(u,u.id)} пишет: ${req.body.message.text}`,
                            user: user.id
                        })
                }
            }

            if (req.body.message.photo) {
                m.sendMessage2({
                    chat_id: user.id,
                    text: locals.fileNeeded
                }, false, token)
            }



            if (req.body.message.document) {

                return messages
                    .where('file_id', '==', req.body.message.document.file_id)
                    .get()
                    .then(col => {




                        if (!col.docs.length) {

                            tasks
                                .where(`active`, '==', true)
                                .get()
                                .then(col => {
                                    let tasks = common.handleQuery(col).map(t => t.id)
                                    userTasks
                                        .where(`user`, '==', +user.id)
                                        .get()
                                        .then(col => {
                                            let uTasks = common.handleQuery(col).filter(t => tasks.indexOf(t.task) > -1)


                                            messages.add({
                                                taskSubmission: null,
                                                file: true,
                                                createdAt: new Date(),
                                                user: +user.id,
                                                file_id: req.body.message.document.file_id
                                            }).then(message => {
                                                m.sendMessage2({
                                                    chat_id: user.id,
                                                    text: `${common.sudden.fine()}! Ваш материал принят.`
                                                }, false, token)

                                                admins.forEach(a => {
                                                    m.sendMessage2({
                                                        chat_id: a.id,
                                                        from_chat_id: user.id,
                                                        message_id: req.body.message.message_id
                                                    }, 'forwardMessage', token).then(s => {
                                                        m.sendMessage2({
                                                            chat_id: a.id,
                                                            text: `Выберите, к какому заданию относится это фото, а потом поставьте оценку.`,
                                                            reply_markup: {
                                                                inline_keyboard: uTasks.map(t => {
                                                                    return [{
                                                                        text: `${uTasks.map(t=>t.task).indexOf(t.id) == -1 ? '(new) ' : ''} ${t.name}`,
                                                                        callback_data: `pic_${message.id}_task_${t.id}`
                                                                    }]
                                                                })
                                                            }
                                                        }, false, token)
                                                    })

                                                })
                                            })




                                        })

                                })


                        } else {
                            m.sendMessage2({
                                chat_id: user.id,
                                text: `${common.sudden.sad()} Такой файл у нас уже есть.`
                            }, false, token)
                        }
                    })


            }

        })
    }

    if (req.body.callback_query) {
        let qid = req.body.callback_query.id;
        user = req.body.callback_query.from
        let inc = req.body.callback_query.data.split('_');
        switch (inc[0]) {
            case `submission`: {
                if (inc.length != 4) return replyCallBack(qid, `ошибка данных: ${inc.join('_')}`)
                return userTasksSubmits.doc(inc[1]).update({
                    score: +inc[3]
                }).then(s => {
                    replyCallBack(qid, `Оценка выставлена!`)
                    rescore(userTasksSubmits.doc(inc[1],+inc[3]))
                })
            }
            case `pic`: {
                if (inc.length != 4) return replyCallBack(qid, `ошибка данных: ${inc.join('_')}`)

                return messages.doc(inc[1])
                    .get()
                    .then(msg => {
                        if (msg.data().taskSubmission) return replyCallBack(qid, `Картинка уже разобрана.`)
                        userTasks.doc(inc[3]).get().then(ut => {
                            if (!ut.exists) return replyCallBack(qid, `у пользователя нет такого задания`)
                            ut = ut.data()
                            userTasksSubmits.add({
                                message: msg.id,
                                createdAt: new Date(),
                                task: ut.task,
                                userTask: inc[3],
                                name: ut.name,
                                user: +ut.user,
                                admin: user.id
                            }).then(rec => {
                                messages.doc(inc[1]).update({
                                    taskSubmission: rec.id
                                }).then(s => {
                                    replyCallBack(qid, `Принято!`)
                                    m.sendMessage2({
                                        chat_id: user.id,
                                        message_id: req.body.callback_query.message.message_id,
                                        text: `Теперь поставим оценку...`,
                                        reply_markup: {
                                            inline_keyboard: [
                                                [{
                                                    text: `1`,
                                                    callback_data: `submission_${rec.id}_score_1`
                                                }],
                                                [{
                                                    text: `2`,
                                                    callback_data: `submission_${rec.id}_score_2`
                                                }],
                                                [{
                                                    text: `3`,
                                                    callback_data: `submission_${rec.id}_score_3`
                                                }],
                                                [{
                                                    text: `4`,
                                                    callback_data: `submission_${rec.id}_score_4`
                                                }],
                                                [{
                                                    text: `5`,
                                                    callback_data: `submission_${rec.id}_score_5`
                                                }],
                                            ]
                                        }
                                    }, 'editMessageReplyMarkup', token)
                                })
                            })
                        })
                    })
            }
            case 'user': {
                return m.getUser(user.id, udb).then(a => {
                    if (a.admin && inc[2]) {

                        let uRef = udb.doc(inc[2]);

                        return m.getUser(inc[2], udb).then(user => {
                            switch (inc[1]) {
                                case 'activate': {

                                    if (user.ready) return m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        text: `Пользователь уже активирован!`,
                                        show_alert: true,
                                    }, 'answerCallbackQuery', token)

                                    return uRef.update({
                                        ready: true
                                    }).then(s => {
                                        log({
                                            user: +inc[2],
                                            text: `${uname(a,a.id)} активирует пользователя ${uname(user,user.id)}`
                                        })
                                        m.sendMessage2({
                                            chat_id: user.id,
                                            text: locals.congrats
                                        }, false, token)
                                    })
                                }
                                case 'blocked': {
                                    if (user.blocked) return m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        text: `Пользователь уже заблокирован`,
                                        show_alert: true,
                                    }, 'answerCallbackQuery', token)
                                    return uRef.update({
                                        blocked: true
                                    }).then(s => {
                                        log({
                                            user: +inc[2],
                                            text: `${uname(a,a.id)} блокирует пользователя ${uname(user,user.id)}`
                                        })
                                        m.sendMessage2({
                                            chat_id: user.id,
                                            text: locals.notWelcome
                                        }, false, token)
                                    })
                                }
                                default: {
                                    return m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        text: `Команда не распознана`,
                                        show_alert: true,
                                    }, 'answerCallbackQuery', token)
                                }
                            }
                        })

                    }
                })
            }
            default: {
                return m.sendMessage2({
                    callback_query_id: req.body.callback_query.id,
                    text: `Команда не распознана`,
                    show_alert: true,
                }, 'answerCallbackQuery', token)
            }
        }
    }

})



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
                logs: common.handleQuery(col),
                // token: req.signedCookies.adminToken
            })
        })

    if (!req.signedCookies.adminToken) return res.redirect(`${process.env.ngrok}/ps/auth`)

    adminTokens
        .doc(req.signedCookies.adminToken)
        .get()
        .then(data => {
            if (!data.exists) res.sendStatus(403)
            if (data.data().active) {
                logs
                    .orderBy(`createdAt`, 'desc')
                    .limit(100)
                    .get()
                    .then(col => {
                        res.render(`${host}/web`, {
                            logs: common.handleQuery(col),
                            // token: req.signedCookies.adminToken
                        })
                    })


            }
        })
})

function removeTags(id){
    userTags
        .where(`tag`,'==',id)
        .where(`active`,'==',true)
        .get()
        .then(col=>{
            col.docs.forEach(d=>{
                userTags.doc(d.id).update({
                    active: false
                })    
            })
        })
}

router.all(`/admin/:method/:id`, (req, res) => {
    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)

    let access = adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {
        if (!doc.exists) return false
        doc = common.handleDoc(doc)
        if (!doc.active) return false
        // if(!doc.admin) return false

        devlog(doc);

        return m.getUser(doc.user, udb)
    })

    Promise.resolve(access).then(admin => {

        devlog(admin)

        if (!admin || !admin.admin) return res.sendStatus(403)


        switch (req.params.method) {
            
            case `usersNews`:{
                return messages
                    .where(`news`,'==',req.params.id)
                    .get()
                    .then(col=>{
                        res.json(common.handleQuery(col))
                    })
            }

            case `news`:{
                return news.doc(req.params.id)
                    .get()
                    .then(n=>{
                        if(!n.exists) return res.sendStatus(404)
                        res.json(common.handleDoc(n))
                    })
            }

            case `logs`:{
                let q = req.params.id.split('_')
                // devlog()
                return logs
                    .where(q[0],'==',Number(q[1])?+q[1]:q[1])
                    .orderBy(`createdAt`,`desc`)
                    .get()
                    .then(col=>{
                        res.json(common.handleQuery(col))
                    })
            }
            case `tags`:{
                let ref = tags.doc(req.params.id);
                return ref.get().then(t => {
                    if (!t.exists) return res.sendStatus(404)
                    t = common.handleDoc(t);
                    
                    switch(req.method){
                        case 'GET':{
                            return res.json(t)
                        }
                        case `DELETE`:{
                            deleteEntity(req,res,ref,admin,false,()=>removeTags(req.params.id))
                        }
                        case `PUT`:{
                            updateEntity(req,res,ref,admin.id)
                        }
                    }

                })
                
            }

            case `tagsUsers`:{
                switch(req.method){
                    case `GET`:{
                        return userTags
                            .where(`tag`,'==',req.params.id)
                            .get()
                            .then(d => 
                                res.json(common.handleQuery(d))
                            )
                    }
                    case `PUT`:{

                    }
                }
            }

            case 'userTags':{
                switch(req.method){
                    case `GET`:{
                        return userTags
                            .where(`user`,'==',+req.params.id)
                            .get()
                            .then(col=>{
                                res.json(common.handleQuery(col))
                            })
                    }
                    case 'POST':{
                        if(!req.body.tag) return res.sendStatus(404)
                        return udb.doc(req.params.id).get().then(u=>{
                            if(!u.exists) return res.status(400).send(`no such user`)
                            tags.doc(req.body.tag).get().then(t=>{
                                if(!t.exists) res.status(400).send(`no such tag`)
                                    t = common.handleDoc(t)
                                if(!t.active) res.status(400).send(`tag is not active`)
                                
                                userTags.add({
                                    user:       +req.params.id,
                                    active:     true,
                                    createdAt:  new Date(),
                                    createdBy:  +admin.id,
                                    tag:        req.body.tag,
                                    name:       t.name
                                }).then(rec=>{
                                    res.json({
                                        comment: `Тег добавлен`,
                                        id: rec.id
                                    })
                                    tags.doc(req.body.tag).update({
                                        cnt: FieldValue.increment(1)
                                    })
                                    log({
                                        text:   `${uname(admin,admin.id)} добавляет тег ${t.name} пользователю с id ${req.params.id}`,
                                        admin:  +admin.id,
                                        tag:    req.body.tag,
                                        user:   +req.params.id
                                    })
                                })
                            })
                        })
                    } 
                    case `DELETE`:{
                        let ref = userTags.doc(req.params.id)
                        return ref.get().then(t=>{
                            if(!t.exists) return res.sendStatus(404)
                            t = common.handleDoc(t)
                            if(!t.active) return res.status(400).send(`already deleted`)
                            ref.update({
                                active: false
                            }).then(s=>{
                                res.json({
                                    comment: `Тег снят`
                                })
                                tags.doc(t.tag).update({
                                    cnt: FieldValue.increment(-1)
                                })
                                log({
                                    text:   `${uname(admin,admin.id)} снимает тег ${t.name} пользователю с id ${req.params.id}`,
                                    admin:  +admin.id,
                                    tag:    t.tag,
                                    user:   +t.user
                                })
                            })
                        })
                    }
                }
            }
            
            case `messages`: {
                switch(req.method){
                    case `GET`:{
                        return messages.doc(req.params.id).get().then(d => res.json(common.handleDoc(d)))
                    }
                    case `PUT`:{

                    }
                }
                
            }
            case `images`: {
                return axios.post(`https://api.telegram.org/bot${token}/getFile`, {
                    file_id: req.params.id
                }).then(s => {
                    res.json({
                        src: `https://api.telegram.org/file/bot${token}/${s.data.result.file_path}`
                    })
                })
            }
            case `taskSubissions`: {
                let ref = userTasks.doc(req.params.id);
                return ref.get().then(t => {
                    if (!t.exists) return res.sendStatus(404)
                    t = common.handleDoc(t)
                    switch (req.method) {
                        case `GET`: {
                            let data = []
                            data.push(userTasksSubmits
                                .where(`userTask`, '==', req.params.id)
                                .get()
                                .then(col => common.handleQuery(col))
                            )
                            data.push(tasks.doc(t.task).get().then(d => common.handleDoc(d)))
                            return Promise.all(data).then(data => {
                                t.taskData = data[1];
                                t.submissions = data[0];
                                res.json(t)
                            })
                        }
                    }
                })

            }
            case `usersTasks`: {
                switch (req.method) {
                    case 'GET': {
                        return userTasks
                            .where(`user`, '==', +req.params.id)
                            .orderBy(`createdAt`)
                            .get()
                            .then(col => {
                                res.json(common.handleQuery(col))
                            })
                    }
                }
            }
            case `usersMessages`: {
                switch (req.method) {
                    case 'GET': {
                        return messages
                            .where(`user`, '==', +req.params.id)
                            .orderBy(`createdAt`)
                            .get()
                            .then(col => {
                                res.json(common.handleQuery(col))
                            })
                    }
                    case 'POST': {
                        return m.sendMessage2({
                            chat_id: req.params.id,
                            text: req.body.text,
                        }, false, token).then(s => {
                            messages.add({
                                user: +req.params.id,
                                createdAt: new Date(),
                                text: req.body.text,
                                isReply: true,
                                admin: +admin.id
                            })
                            res.json({
                                comment: `Сообщение отправлено!`
                            })
                        }).catch(err => {
                            res.json({
                                comment: `Сообщение не может быть отправлено.`
                            })
                        })
                    }
                }
            }
            
            case `tasks`: {
                let ref = tasks.doc(req.params.id);
                return ref.get().then(t => {
                    if (!t.exists) return res.sendStatus(404)
                    t = common.handleDoc(t);
                    switch (req.method) {
                        case `GET`: {
                            return userTasksSubmits
                                .where(`task`,'==',req.params.id)
                                .orderBy(`createdAt`,'desc')
                                .get()
                                .then(col=>{
                                    t.submissions = common.handleQuery(col)
                                    res.json(t)
                                })

                            // Первая версия — группировка по пользователям
                            // return userTasks
                            //     .where(`task`, '==', req.params.id)
                            //     .get()
                            //     .then(col => {
                            //         t.users = common.handleQuery(col)
                            //         res.json(t)
                            //     })
                        }
                        case `DELETE`: {
                            devlog(`удаляем задание`)
                            return deleteEntity(req, res, ref, admin, `active`, function () {
                                removeTasks(req.params.id)
                            })
                        }
                        case `PUT`: {
                            return updateEntity(req, res, ref, admin.id)
                        }
                    }
                })


            }
            case `users`: {
                let ref = udb.doc(req.params.id);
                return ref.get().then(t => {
                    if (!t.exists) return res.sendStatus(404)
                    t = common.handleDoc(t);
                    switch (req.method) {
                        case `GET`: {
                            return res.json(t);
                        }
                        case `DELETE`: {
                            return deleteEntity(req, res, ref, admin, `blocked`, () => clearUser(req.params.id));
                        }
                        case `PUT`: {
                            return updateEntity(req, res, ref, admin.id).then(s=>{
                                switch (req.body.attr){
                                    case `admin`:{
                                        if(req.body.value){
                                            m.sendMessage2({
                                                chat_id: req.params.id,
                                                text: `${common.sudden.fine()}! Вы стали администратором программы.\nВот ваша ссылка на админку: ${process.env.ngrok}/ps/web.`
                                            },false,token)
                                        } else {
                                            m.sendMessage2({
                                                chat_id: req.params.id,
                                                text: `${common.sudden.sad()}, вы перестали числиться в администраторах проекта.`
                                            },false,token)
                                        }
                                    }
                                }
                            });
                        }
                    }
                })
            }
            default: {
                return res.sendStatus(404)
            }
        }
    })
})


function removeTasks(taskId) {

    devlog(`удаляем задания по ${taskId}`)

    userTasks
        .where(`task`, '==', taskId)
        .where(`completed`, '==', false)
        .where(`active`, '==', true)
        .get()
        .then(col => {
            common.handleQuery(col).forEach((rec, i) => {
                setTimeout(() => {
                    devlog(rec.id)
                    userTasks.doc(rec.id)
                        .update({
                            active: false
                        })
                        .then(s => {
                            m.sendMessage2({
                                chat_id: rec.user,
                                text: locals.archive(rec.name)
                            }, false, token)
                        })
                }, i * 200)
            })
        })
}

router.all(`/admin/:method`, (req, res) => {

    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)

    let access = adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {
        if (!doc.exists) return false
        doc = common.handleDoc(doc)
        if (!doc.active) return false
        // if(!doc.admin) return false

        devlog(doc);

        return m.getUser(doc.user, udb)
    })

    Promise.resolve(access).then(admin => {

        devlog(admin)

        if (!admin || !admin.admin) return res.sendStatus(403)

        switch (req.params.method) {

            case `news`:{
                switch(req.method){
                    case `GET`:{
                        return news
                            .orderBy(`createdAt`,'desc')
                            .get().then(col=>{
                                res.json(common.handleQuery(col))
                            })
                    }
                    case `POST`:{
                        if(!req.body.name || !req.body.text) return res.sendStatus(400)
                        let q = udb
                            .where(`active`,'==',true)
                            .where(`blocked`,'==',false)
                        if(req.body.filter){
                            switch (req.body.filter){
                                case `admins`:{
                                    q = q.where(`admin`,'==',true)
                                    break;
                                }
                                case 'ready':{
                                    q = q.where(`ready`,'==',true) 
                                    break;
                                }
                                case `tagged`:{
                                    q = userTags.where(`active`,'==',true).where(`tag`,'==',req.body.tag)
                                }
                            }
                        }
                        return q.get()
                            .then(col=>{
                                news.add({
                                    createdAt:  new Date(),
                                    createdBy:  +admin.id,
                                    text:       req.body.text,
                                    name:       req.body.name,
                                    audience:   col.docs.length
                                }).then(rec=>{
                                    res.json({
                                        id:         rec.id,
                                        comment:    `Рассылка создана и расходится на ${col.docs.length} пользователей.`
                                    })
                                    log({
                                        text:  `${uname(admin,admin.id)} стартует рассылку с названием ${req.body.name}`,
                                        admin: +admin.id
                                    })
                                    common.handleQuery(col).forEach((u,i)=>{
                                        setTimeout(()=>{
                                            m.sendMessage2({
                                                chat_id:    u.user || u.id,
                                                text:       req.body.text
                                            },false,token).then(res=>{
                                                messages.add({
                                                    createdAt:  new Date(),
                                                    user:       +u.id,
                                                    text:       req.body.text,
                                                    news:       rec.id,
                                                    isReply:    true
                                                })
                                            })
                                        },i*200)
                                    })
                                })
                                
                            })
                    }
                }
            }

            case `tags`:{
                switch(req.method){
                    case 'GET':{
                        return tags.get().then(col=>res.json(common.handleQuery(col)))
                    }
                    case `POST`:{
                        if(!req.body.name || !req.body.description) return res.sendStatus(400)
                        return tags.add({
                            createdAt:      new Date(),
                            active:         true,
                            name:           req.body.name,
                            description:    req.body.description
                        }).then(s=>{
                            res.json({
                                id: s.id,
                                comment: `Тег создан. Обновите страницу`
                            })
                            log({
                                text: `${uname(admin,admin.id)} создает тег ${req.body.name}`,
                                admin: admin.id
                            })
                        })
                    }
                }
            }


            case `unseen`:{
                return messages
                    .orderBy(`createdAt`,`desc`)
                    // .where(`message`,'',1)
                    .where(`taskSubmission`,'==',null)
                    .where(`file`,'==',true)
                    .get()
                    .then(col=>{
                        res.json(common.handleQuery(col))
                    })
            }

            case `taskSubissions`:{
                let query = userTasksSubmits.orderBy(`createdAt`,`desc`).limit(50)
                if(req.query.tilt){
                    query = query.offset(+req.query.tilt)
                }
                return query.get().then(col=>res.json(common.handleQuery(col)))
            }
            case 'users': {
                return udb.get().then(col => {
                    res.json({
                        users: common.handleQuery(col)
                    })
                })
            }

            case 'tasks': {
                switch (req.method) {
                    case 'GET': {
                        return tasks.get().then(col => {
                            res.json(common.handleQuery(col))
                        })
                    }
                    case 'POST': {
                        return tasks.add({
                            active: true,
                            createdAt: new Date(),
                            name: req.body.name || `Без названия`,
                            description: req.body.description,
                            admin: admin.id
                        }).then(rec => {
                            udb
                                .where(`active`, '==', true)
                                .where(`ready`, '==', true)
                                .get()
                                .then(col => {
                                    res.json({
                                        id: rec.id,
                                        comment: `Задание расходится на ${common.letterize(col.docs.length,'пользователь')}`
                                    })

                                    log({
                                        text: `${uname(admin,admin.id)} создает новое задание: ${req.body.name}.`,
                                        admin: admin.id,
                                        task: rec.id
                                    })

                                    common.handleQuery(col).forEach((u, i) => {
                                        setTimeout(() => {
                                            userTasks.add({
                                                active: true,
                                                createdAt: new Date(),
                                                task: rec.id,
                                                name: req.body.name || `без названия`,
                                                completed: false,
                                                user: +u.id
                                            }).then(() => {
                                                m.sendMessage2({
                                                    chat_id: u.id,
                                                    text: `${common.sudden.fine()}! Новое задание: ${req.body.name}\n${req.body.description}`
                                                }, false, token)
                                            })
                                        }, i * 200)
                                    })
                                })

                        })
                    }
                }

            }
            default: {
                return res.sendStatus(404)
            }
        }
    })
})



function updateEntity(req, res, ref, adminId) {
    return ref.update({
        updatedAt: new Date(),
        updatedBy: adminId,
        [req.body.attr]: req.body.attr == `date` ? new Date(req.body.value) : req.body.value
    }).then(s => {
        res.json({
            success: true
        })
    }).catch(err => {
        res.status(500).send(err.message)
    })
}

function deleteEntity(req, res, ref, admin, attr, callback) {
    entities = {
        tasks: {
            log: (name) => `задание ${name} было архивировано`
        }
    }


    return ref.get().then(e => {

        devlog(req.params.id)

        devlog(typeof (callback))

        let data = common.handleDoc(e)

        if (!data[attr || 'active']) return res.json({
            success: false,
            comment: `Вы опоздали. Запись уже удалена.`
        })

        ref.update({
            [attr || 'active']: (attr == `blocked` ? true : false),
            updatedBy: +admin.id
        }).then(s => {

            log({
                text: entities[req.params.method].log(data.name),
                admin: +admin.id
            })

            res.json({
                success: true
            })

            if (typeof (callback) == 'function') {
                console.log(`Запускаем коллбэк`)
                callback()
            }


        }).catch(err => {
            res.json({
                success: false,
                comment: err.message
            })
        })
    })
}

function rescore(ref,curScore) {
    ref.get().then(s => {
        submission = s.data()
        userTasksSubmits
            .where(`user`, '==', submission.user)
            .where(`score`, '>', 0)
            .get()
            .then(col => {

                let max = Math.max(...common.handleQuery(col).map(s => s.score||0));

                devlog(`максимальный счет: ${max}`)

                m.sendMessage2({
                    chat_id: submission.user,
                    text: locals.reviewed(submission.name, submission.score)
                }, false, token)

                userTasks.doc(submission.userTask).update({
                    completed: true,
                    score: max
                })

                userTasks
                    .where(`user`,'==',submission.user)
                    .get()
                    .then(col=>{
                        col = common.handleQuery(col).filter(s=>s.score)
                        let avg = col.length ? +(col.reduce((a,b)=>a+b.score,0)/col.length).toFixed(1) : 0
                        udb.doc(submission.user.toString()).update({
                            avg:    avg,
                            total:  col.length,
                            score:  avg ? col.reduce((a,b)=>a+b.score,0) : 0 
                        })
                    })



            })
    })
}

function isAdmin(id) {
    return udb.doc(id || 'noWay').get().then(a => {
        if (!a.exists) return false
        if (a.data().admin) return true
        return false
    }).catch(err => {
        return false
    })
}


function replyCallBack(id, text) {
    m.sendMessage2({
        callback_query_id: id,
        text: text,
        show_alert: true,
    }, 'answerCallbackQuery', token)
}

module.exports = router;