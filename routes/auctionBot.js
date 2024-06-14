const ngrok2 = process.env.ngrok2;
const ngrok = process.env.ngrok2;
const host = `auction`
const token = process.env.auctionToken;

var express =   require('express');
var router =    express.Router();
var axios =     require('axios');

const fileUpload = require('express-fileupload');

var cors = require('cors')
var fs = require('fs');

let botLink = `https://t.me/starsAuctionBot`

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
    authTG,
    ifBefore,
    authWebApp,
} = require('./common.js')


const {
    sendMessage2,
    getUser,
    greeting
} = require('./methods.js');

var cron = require('node-cron');


router.use(cors())

router.use(fileUpload({
    // Configure file uploads with maximum file size 10MB
    limits: {
        fileSize: 10 * 1024 * 1024
    },

    // Temporarily store uploaded files to disk, rather than buffering in memory
    useTempFiles: true,
    tempFileDir: '/tmp/'
}));

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
    getDatabase,
    increment
} = require('firebase-admin/database');

const {
    getStorage,
    getDownloadURL
} = require('firebase-admin/storage');

var FormData = require('form-data');

const {
    ObjectStreamToJSON
} = require('sitemap');
const { database } = require('firebase-admin');


let gcp = initializeApp({
    credential: cert({
        "type":             "service_account",
        "project_id":       "dimazvalimisc",
        "private_key_id":   "5eb5025afc0fe53b63f518ba071f89e7b7ce03af",
        "private_key":      process.env.sssGCPKey.replace(/\\n/g, '\n'),
        "client_email":     "firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com",
        "client_id":        "110523994931477712119",
        "auth_uri":         "https://accounts.google.com/o/oauth2/auth",
        "token_uri":        "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com"
      }),
    databaseURL: "https://dimazvalimisc-default-rtdb.europe-west1.firebasedatabase.app"
}, host);

let fb =    getFirestore(gcp);
let s =     getStorage(gcp)
let rtb =   getDatabase(gcp)


setTimeout(function () {
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/${host}/hook`).then(() => {
        console.log(`${host} hook set on ${ngrok}`)
    }).catch(err => {
        handleError(err)
    })
}, 1000)



let adminTokens =           fb.collection(`${host}AdminTokens`);
let udb =                   fb.collection(`${host}Users`);
let auctions =              fb.collection(`${host}Auctions`);
let auctionsIterations =    fb.collection(`${host}AuctionsIterations`);
let auctionsBets =          fb.collection(`${host}AuctionsBets`);
let messages =              fb.collection(`${host}UsersMessages`);
let logs =                  fb.collection(`${host}Logs`);
let transactions =          fb.collection(`${host}Transactions`);
let hashes =                fb.collection(`${host}UsersHashes`);
let invoices =              fb.collection(`${host}Invoices`);

const locals = {
    accountCharged:(a)=>{
        return {
            ru: `Ура! Ваш баланс полонен на ${a} звезд. Используйте их с умом!`,
            en: `Owesome! You've got ${a} more stars!`
        }
    }
}

router.all(`/api/:method/:id`,(req,res)=>{

    let token = req.signedCookies.userToken;
    
    if (!token) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(token).get().then(doc => {

        if (!doc.exists) return res.sendStatus(403)

        let token = handleDoc(doc)

        getUser(token.user, udb).then(user => {

            if (!user) return res.sendStatus(403)
                switch(req.params.method){

                    case `stake`:{
                        return getDoc(auctionsIterations,req.params.id).then(i=>{
                            if(!i || !i.active) return res.status(400).send(`Такого аукциона нет`)
                            devlog(user.score,i.base)
                            if(+user.score > +i.base){
                                
                                transactions.add({
                                    auctionsIteration:  i.id,
                                    user:               +user.id,
                                    createdAt:          new Date()
                                })


                                auctionsIterations.doc(req.params.id).update({
                                    stake:          FieldValue.increment(+i.base),
                                    stakeHolder:    user.hash
                                })

                                rtb.ref(`${host}/iterations/${i.id}`).update({
                                    stake:          database.ServerValue.increment(+i.base),
                                    stakeHolder:    user.hash
                                })


                                udb.doc(user.id).update({
                                    score: FieldValue.increment(+i.base*-1)
                                })

                                rtb.ref(`${host}/users/${user.hash}`).update({
                                    score:          database.ServerValue.increment(-i.base)
                                })

                                res.send(`ставка сделана`)
                            } else {
                                invoices.add({
                                    user:       +user.id,
                                    iteration:  req.params.id,
                                    amount:     +i.base
                                }).then(s=>{
                                    m.sendMessage2({
                                        "chat_id": user.id,
                                        "title": `${i.base} звезд`,
                                        "description": `Столько не хватает для следующей ставки`,
                                        "payload": s.id,
                                        "currency": "XTR",
                                    }, 'createInvoiceLink', token).then(d=>{
                                        devlog(d.data)
                                    })
                                })
                                

                                res.status(400).send(`у вас не хватает звезд`)
                            }
                        }).catch(err=>{
                            handleError(err,res)
                        })
                    }
                    case `users`:{
                        if(+req.params.id != +user.id) return res.sendStatus(403)
                        return res.json(user)
                    }
                    default:{
                        res.sendStatus(404)
                    }
                }
            
        })
    })
    
})


function log(o) {

    o.createdAt = new Date()

    logs.add(o).then(r => {

        if (!o.silent) {
            alertAdmins({
                text: o.text
            })
        }
    })
}

function registerUser(u) {

    u.createdAt = new Date();
    u.active = true;
    u.blocked = false;
    u.score = 0;
    u[u.language_code] = true;

    udb.doc(u.id.toString()).set(u).then(() => {

        // TBD приветствие

        log({
            user: +u.id,
            text: `${uname(u,u.id)} регистрируется в боте.`
        })

        hashes.add({
            createdAt:  new Date(),
            active:     true,
            user:       +u.id
        }).then(rec=>{
            udb.doc(u.id.toString()).update({
                hash: rec.id
            })
        })


    })
}


function alertAdmins(mess) {
    let message = {
        text: mess.text,
        isReply: true
    }

    udb.where(`admin`, '==', true).get().then(admins => {
        admins.docs.forEach(a => {
            message.chat_id = a.id
            if (mess.type != 'stopLog' || !a.data().stopLog) sendMessage2(message, false, token, messages)
        })
    })
}



const datatypes = {
    transactions:{
        col:    transactions,
        newDoc: transactionsAdd,
    },
    auctions:{
        newDoc: auctionsAdd,
        col:    auctions
    },
    auctionsBets:{
        newDoc: auctionsBetsAdd,
        col:    auctionsBets
    },
    auctionsIterations:{
        newDoc: auctionsIterationsAdd,
        col:    auctionsIterations
    },
    messages:{
        newDoc: sendMessage,
        col:    messages
    },
    users:{
        col: udb
    }
    
}


router.post(`/authWebApp`,(req,res)=>{
    authWebApp(req,res,token,adminTokens,udb)  
})


function transactionsAdd(req,res,admin){
    let required = {
        user:   `Название`,
        amount: `Сумма`
    }
    let missed = Object.keys(required).filter(k=>!req.body[k])
    if(missed.length) return res.status(400).send(`${missed.join(', ')} missing`)

    getUser(req.body.user,udb)
        .then(u=>{
            if(!u) return res.status(400).send(`такого пользователя нет`)
                transactions.add({

                    createdAt:  new Date(),
                    createdBy:  +admin.id,
                    active:     true,
            
                    user:       +req.body.user,
                    amount:     +req.body.amount
                }).then(rec=>{
            
                    udb.doc(req.body.user.toString()).update({
                        score: FieldValue.increment(+req.body.amount)
                    }).then(()=>{
                        transactions.doc(rec.id).update({
                            charged: new Date()
                        })

                        getDoc(udb,u.id).then(updated=>{
                            rtb.ref(`auction/users/${u.hash}`).update({
                                score: updated.score
                            })
                        })

                        
                    })
                    
                    res.redirect(`/${host}/web?page=users_${req.body.user}&alert=${encodeURIComponent(`перевод зачислен`)}`)
            
                    log({
                        transaction:    rec.id,
                        admin:          +admin.id,
                        user:           +req.body.user,
                        text:           `${uname(admin,admin.id)} обновляет счет пользователя ${req.body.user} на ${req.body.amount}`
                    })

                    if(+req.body.amount > 0){
                        sendMessage2({
                            chat_id:    u.id,
                            photo:      `${ngrok}/images/auction/stars${Math.floor(Math.random()*4)}.webp`,
                            caption:    lang(u,locals.accountCharged(+req.body.amount))
                        },`sendPhoto`,token,messages)
                    }
                })
        })
    
}

function lang(user,text){
    return text[user.language_code] || text.en;
}

function auctionsAdd(req,res,admin){
    let required = {
        name: `Название`,
        base: `Ставка`
    }
    let missed = Object.keys(required).filter(k=>!req.body[k])
    if(missed.length) return res.status(400).send(`${missed.join(', ')} missing`)
    
    auctions.add({

        createdAt:  new Date(),
        createdBy:  +admin.id,
        active:     true,

        name: req.body.name,
        base: +req.body.base,
        
    }).then(rec=>{
        res.redirect(`/${host}/web?page=auctions_${rec.id}`)
        log({
            auction: rec.id,
            admin: +admin.id,
            text: `${uname(admin,admin.id)} создает аукцион «${req.body.name}».`
        })
    }).catch(err=>handleError(err,res))
}
function auctionsBetsAdd(req,res,admin){

}
function auctionsIterationsAdd(req,res,admin){
    let required = {
        auction:    `аукцион`,
        till:       `Срок окончания`
    }
    let missed = Object.keys(required).filter(k=>!req.body[k])
    if(missed.length) return res.status(400).send(`${missed.join(', ')} missing`)

    getDoc(auctions, req.body.auction).then(a=>{
        if(!a || !a.active) return res.status(400).send(`аукцион недоступен`)

        auctionsIterations.add({
            createdAt:  new Date(),
            createdBy:  +admin.id,
            active:     true,
            
            auction:        req.body.auction,
            auctionName:    a.name,
            base:           a.base,
            stake:          a.start,
            timer:          new Date(req.body.till)
        }).then(s=>{

            rtb.ref(`/${host}/iterations/${s.id}`).set({
                id:             s.id,
                active:         true,    
                auctionName:    a.name,
                base:           a.base,
                stake:          a.start,
                timer:          new Date(req.body.till)
            })

            res.redirect(`/${host}/web?page=auctionsIterations_${s.id}`)
            
            // TBD уведомления пользователям

        }).catch(err=>handleError(err,res))
    })
}

function sendMessage(req, res, admin) {
    let t = {
        chat_id: req.body.user,
        text: req.body.text
    }

    sendMessage2(t, false, token, messages, {
        admin: +admin.id
    })

    if (res) res.sendStatus(200);
}

router.get(`/auth`, (req, res) => {
    res.render(`${host}/auth`)
})

router.get(`/userAuth`, (req, res) => {
    res.render(`${host}/userAuth`, {
        ep: req.query.ep
    })
})

router.get(`/`,(req,res)=>{
    res.render(`${host}/landing.pug`)
})


router.get(`/test`,(req,res)=>{
    res.sendStatus(200)
    sendMessage2({
        "chat_id": dimazvali,
        "title": `1 звезда`,
        "description": `Столько не хватает для следующей ставки`,
        "payload": +new Date(),
        "currency": "XTR",
        "prices": [{
            "label": "Оплата",
            "amount": 1
        }]
    }, 'createInvoiceLink', token).then(d=>{
        console.log(d.result)
    }).catch(err=>{
        console.log(err)
    })
})

router.post(`/userAuth`, (req, res) => {
    authTG(req, res, token, adminTokens, udb, registerUser, `userToken`)
})

router.post(`/auth`, (req, res) => {
    console.log(`запрос авторизации`)
    authTG(req, res, token, adminTokens, udb, registerUser)
})

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

                    u = handleDoc(u)

                    log({
                        silent: true,
                        text: `${uname(u,u.id)} блочит бот`,
                        user: +u.id
                    })
                })

            }).catch(err => {
                console.log(err)
            })
        }
    }
    if (req.body.message && req.body.message.from) {
        user = req.body.message.from;

        getUser(user.id, udb).then(u => {
            if (req.body.message.text) {
                messages.add({
                    user: user.id,
                    text: req.body.message.text || null,
                    createdAt: new Date(),
                    isReply: false
                })
            }
            if (!u) return registerUser(user)
            if (!u.active) return udb.doc(user.id.toString()).update({
                active: true,
                stopped: null
            }).then(s => {
                log({
                    silent: true,
                    user: +user.id,
                    text: `Пользователь id ${user.id} возвращается`
                })
            })

            if (req.body.message.text) {

                if (req.body.message.text == `/test`) {
                    return sendMessage2({
                        chat_id:    u.id,
                        text:       `Приложение с теста`,
                        reply_markup:{
                            inline_keyboard:[[{
                                text: `${ngrok}`,
                                web_app:{
                                    url: `${ngrok}/${host}/app` 
                                }
                            }]]
                        }
                    },false,token,messages)
                } else if (req.body.message.text == `/start`) {
                    return sendMessage2({
                        chat_id: user.id,
                        text: `Я текст приветствия, который можно будет настроить в админке.`
                    }, false, token,messages)
                } else {

                    

                    return alertAdmins({
                        text: `${uname(u,u.id)} пишет: ${req.body.message.text}`,
                        user: user.id
                    })
                }
            }
        })
    }

    if (req.body.pre_checkout_query){
        console.log('это платеж')
        sendMessage2({
            ok: true,
            pre_checkout_query_id: req.body.pre_checkout_query.id
        },'answerPreCheckoutQuery',token).then(s=>{
            console.log(s.data)
        }).catch(err=>{
            console.log(err)
        })
    }
})



router.all(`/api/:method`, (req, res) => {
    
    let token = req.signedCookies.userToken;
    
    if (!token) return res.status(401).send(`Вы кто вообще?`)
        adminTokens.doc(token).get().then(doc => {

            if (!doc.exists) return res.sendStatus(403)
    
            let token = handleDoc(doc)
    
            getUser(token.user, udb).then(user => {
    
                if (!user) return res.sendStatus(403)
    
                devlog(req.body)
    
                switch (req.params.method) {
                    case `profile`:{
                        return res.json(user)
                    }
                    case `auctions`:{
                        return ifBefore(auctions).then(data=>res.json(data))
                    }

                    case `auctionsIterations`:{
                        return ifBefore(auctionsIterations).then(data=>res.json(data))
                    }

                    default:{
                        res.sendStatus(404)
                    }
                }
            })
        })
})

router.all(`/admin/:method`, (req, res) => {

    let token = req.signedCookies.adminToken || req.signedCookies.userToken || process.env.develop == `true`? process.env.adminToken : false;

    if (!token) return res.status(401).send(`Вы кто вообще?`)

    adminTokens.doc(token).get().then(doc => {

        if (!doc.exists) return res.sendStatus(403)

        let token = handleDoc(doc)

        getUser(token.user, udb).then(admin => {
            if (!admin) devlog(`нет такого юзера`)
            if (!admin) return res.sendStatus(403)

            devlog(req.body)

            switch (req.params.method) {

                case `userSearch`: {
                    if (!req.query.name) return res.sendStatus(400)

                    return udb.get().then(col => {
                        res.json(handleQuery(col).filter(u => u.username && !u.username.indexOf(req.query.name)))
                    })

                }

                default: {

                    if (!datatypes[req.params.method]) return res.sendStatus(404)

                    if (req.method == `GET`) return datatypes[req.params.method].col.get().then(col => {

                        let data = handleQuery(col, true);

                        Object.keys(req.query).forEach(q => {
                            data = data.filter(i => i[q] == (Number(req.query[q]) ? Number(req.query[q]) : req.query[q]))
                        })

                        if (!admin.admin && req.params.method == `users`) data = data.filter(i => i.createdBy == +admin.id)

                        res.json(data)
                    })

                    if (req.method == `POST`) return datatypes[req.params.method].newDoc(req, res, admin, datatypes[req.params.method].extras)

                    return res.sendStatus(404)
                }
            }
        })
    })
})

router.get(`/app`,(req,res)=>{
    res.render(`${host}/app`,{
        start: req.query.startapp,
    })
})

router.all(`/admin/:method/:id`, (req, res) => {
    
    let token = req.signedCookies.adminToken || req.signedCookies.userToken || process.env.develop == `true`? process.env.adminToken : false;

    if (!token) return res.status(401).send(`Вы кто вообще?`)

    adminTokens.doc(token).get().then(doc => {


        if (!doc.exists) return res.sendStatus(403)

        let token = handleDoc(doc)

        getUser(token.user, udb).then(admin => {
            switch (req.params.method) {

                case `logs`: {

                    if (!admin.admin) return res.sendStatus(403)

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

                    ref.get().then(d => {
                        d = handleDoc(d)

                        if (!admin.admin) {
                            if (d.createdBy != +admin.id) return res.sendStatus(403)
                        }

                        if (req.method == `GET`) return ref.get().then(d => {
                            d.exists ? res.json(handleDoc(d)) : res.sendStatus(404)
                        })

                        if (req.method == `PUT`) return updateEntity(req, res, ref, admin)
                        if (req.method == `DELETE`) return deleteEntity(req, res, ref, admin)

                        return res.sendStatus(404)

                    })


                }
            }
        })

    })
})

function updateEntity(req, res, ref, admin) {
    ref.get().then(d => {

        d = handleDoc(d);

        if (req.params.method == `messages`) {
            let mess = d;

            if (mess.deleted || mess.edited) return res.status(400).send(`уже удалено`);
            if (!mess.messageId) return res.status(400).send(`нет id сообщения`);

            sendMessage2({
                chat_id: mess.user,
                message_id: mess.messageId,
                text: req.body.value
            }, `editMessageText`, token).then(resp => {
                if (resp.ok) {
                    res.json({
                        success: true,
                        comment: `Сообщение обновлено.`
                    })
                    ref.update({
                        text: req.body.value,
                        textInit: mess.text,
                        editedBy: admin ? +admin.id : null,
                        edited: new Date()
                    })
                } else {
                    res.sendStatus(500)
                }
            })
        } else {
            ref.update({
                [req.body.attr]: (req.body.type == `date` ? new Date(req.body.value) : req.body.value) || null,
                updatedAt: new Date(),
                updatedBy: admin ? +admin.id : null,
            }).then(s => {
                res.json({
                    success: true
                })

                if(req.params.method == `users`){
                    rtb.ref(`auction/users/${d.hash}`).update({
                        [req.body.attr]: req.body.value
                    })
                }

                log({
                    silent: true,
                    admin: admin ? +admin.id : null,
                    [req.params.method]: req.params.id,
                    text: `Обновлен ${req.params.method} / ${d.name || req.params.id}.\n${req.body.attr} стало ${req.body.value} (было ${d[req.body.attr || null]})`
                })

                if (req.params.method == `settings`) {
                    savedSettings[req.params.id].value = req.body.value
                }
            })
        }


    })

}


function deleteEntity(req, res, ref, admin, attr, callback) {

    return ref.get().then(e => {

        let data = handleDoc(e)

        if (req.params.method == `messages`) {

            mess = data;

            if (mess.deleted) return res.status(400).send(`уже удалено`);
            if (!mess.messageId) return res.status(400).send(`нет id сообщения`);

            sendMessage2({
                chat_id: mess.user,
                message_id: mess.messageId
            }, `deleteMessage`, token).then(resp => {
                if (resp.ok) {
                    res.json({
                        success: true,
                        comment: `Сообщение удалено.`
                    })
                    ref.update({
                        deleted: new Date(),
                        deletedBy: +admin.id
                    })
                } else {
                    res.sendStatus(500)
                }
            })
        } else {
            if (!data[attr || 'active']) return res.json({
                success: false,
                comment: `Вы опоздали. Запись уже удалена.`
            })


            ref.update({
                [attr || 'active']: false,
                updatedBy: +admin.id
            }).then(s => {

                log({
                    [req.params.data]: req.params.id,
                    admin: +admin.id,
                    text: `${uname(admin,admin.id)} архивирует ${req.params.data} ${e.name || e.id}.`
                })

                res.json({
                    success: true
                })

                if (typeof (callback) == 'function') {
                    console.log(`Запускаем коллбэк`)
                    callback()
                }
            }).catch(err => {

                console.log(err)

                res.json({
                    success: false,
                    comment: err.message
                })
            })
        }


    })
}

router.get(`/web`, (req, res) => {
    
    console.log(req.signedCookies.adminToken)

    if (!process.env.develop && !req.signedCookies.adminToken) return res.redirect(`${process.env.ngrok}/${host}/auth`)

    getDoc(adminTokens, (req.signedCookies.adminToken || process.env.adminToken)).then(t => {

        if (!t || !t.active) {
            devlog(`нет такого токена`)
            return res.sendStatus(403)
        }

        getUser(t.user, udb).then(u => {

            devlog(`пользватель получен`)

            if (u.blocked) return res.sendStatus(403)

            if (u.admin && !req.query.stopAdmin) return logs
                .orderBy(`createdAt`, 'desc')
                .limit(100)
                .get()
                .then(col => {

                    res.render(`${host}/web`, {
                        user:       u,
                        wysykey:    process.env.wysykey,
                        start:      req.query.page,
                        logs:       handleQuery(col),
                    })
                })
            return res.render(`${host}/error`,{
                error: 403,
                text: `Извините, но это закрытая часть сайта. Если вы уверены, что у вас должен быть доступ, напишите в телеграм @dimazvali.`
            })

        })

    })
})

module.exports = router;

// udb.get().then(col=>{
//     col.docs.forEach(u=>{
//         hashes.add({
//             createdAt:  new Date(),
//             active:     true,
//             user:       +u.id
//         }).then(rec=>{
//             udb.doc(u.id.toString()).update({
//                 hash: rec.id
//             })
//         })
//     })
// })


// sendMessage2({
//     user_id:                        5326429,

//     telegram_payment_charge_id:     "F7380379248521067520U5326429B7396872880A1I5434113367314801068"
// },'refundStarPayment',token)
//     .then(d=>console.log(d))