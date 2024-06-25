const ngrok2 = process.env.ngrok2;
const ngrok = process.env.ngrok;
const host = `caleo`
const token = process.env.caleoToken;

var express =   require('express');
var router =    express.Router();
var axios =     require('axios');

const fileUpload = require('express-fileupload');

var cors = require('cors')
var fs = require('fs');

let botLink = `https://t.me/caleoShopBot`


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
    clearTags,
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

let adminTokens =           fb.collection(`${host}AdminTokens`);
let udb =                   fb.collection(`${host}Users`);
let messages =              fb.collection(`${host}UsersMessages`);
let logs =                  fb.collection(`${host}Logs`);
let hashes =                fb.collection(`${host}UsersHashes`);
let orders =                fb.collection(`${host}Orders`);
let views =                 fb.collection(`${host}Views`);


let authToken = null;

let catalogue = []

class catalogueSection {
    constructor(id,s,before){
        this.id =       id,
        this.name =     s
        this.sub =      [];
        this.items =    [];
        this.parents =  before || [];
        
        this.parents.push({
            id:     this.id,
            name:   this.name
        })

        getSection(id).then(sub=>{
            if(!sub) sub = {};
            if(Object.keys(sub).length){
                devlog(`Загружаем подкаталог ${s}`)
                this.sub = Object.keys(sub).map(id=>new catalogueSection(id,sub[id],JSON.parse(JSON.stringify(this.parents))))
            } else {
                getProducts(id).then(products=>{
                    if(!Object.keys(products).length) {
                        // alertAdmins({
                        //     text: `Пустой раздел ${s}: (${this.parents.map(i=>`${i.name} (${i.id})`).join('=>')})` 
                        // })
                    } else {
                        this.items = Object.keys(products).map(id=>new catalogueProduct(id,products[id]))
                    }
                })
            }
        })
    }
}

class catalogueProduct {
    constructor(id,s){
        this.id =           id,
        this.name =         s.name
        this.sections =     s.sections||null;
        this.image =        s.image
        this.description =  s.description
    }
}



function getSection(id){
    devlog(`подгружаем секцию ${id}`)
    return axios.get(`https://motionai.ru/api/sections`,{
        headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': `application/json`
        },
        data: JSON.stringify({section_id:id})
    }).then(d=>{
        return d.data.block_sections
    }).catch(err=>{
        alertAdmins({
            text: `Ошибка метода /sections: ${err.message}`
        })
    })
}

function getProducts(id){
    devlog(`подгружаем товары категории ${id}`)
    return axios.get(`https://motionai.ru/api/products`,{
        headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': `application/json`
        },
        data: JSON.stringify({section_id:id})
    }).then(d=>{
        return d.data.products
    }).catch(err=>{
        alertAdmins({
            text: `Ошибка метода /products: ${err.message}`
        })
    })
}

function getItem(id){
    devlog(`подгружаем товора ${id}`)
    return axios.get(`https://motionai.ru/api/product`,{
        headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': `application/json`
        },
        data: JSON.stringify({product_id:id})
    }).then(d=>{
        return d.data.products
    }).catch(err=>{
        alertAdmins({
            text: `Ошибка метода /product: ${err.message}`
        })
    })
}


function syncCatalogue(){
    axios.post(`https://motionai.ru/api/login`,{
        "userName": "admin",
        "password": "admin123456**"
    }).then(data=>{
        authToken = data.data.token;
        axios.get(`https://motionai.ru/api/catalog`,{
            headers: { 
                'Authorization': `Bearer ${authToken}`
            }
        }).then(d=>{
            Object.keys(d.data.catalog).forEach(id=>{
                catalogue.push(new catalogueSection(id,d.data.catalog[id]))            
            })
        }).catch(err=>{
            alertAdmins({
                text: `Ошибка метода /catalog: ${err.message}`
            })
        })
    }).catch(err=>{
        alertAdmins({
            text: `Ошибка авториации: ${err.message}`
        })
    })
}

syncCatalogue()

setTimeout(function () {
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/${host}/hook`).then(() => {
        console.log(`${host} hook set on ${ngrok}`)
    }).catch(err => {
        handleError(err)
    })
}, 1000)


setTimeout(()=>{
    console.log(catalogue)
},3000)

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


router.post(`/authWebApp`,(req,res)=>{
    // TBD разобраться с токенами
    authWebApp(req,res,process.env.caleoToken2,adminTokens,udb)  
})


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



const datatypes = {
    messages:{
        newDoc: sendMessage,
        col:    messages
    },
    users:{
        col: udb
    }
    
}

router.get(`/auth`, (req, res) => {
    res.render(`${host}/auth`)
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

                if(req.body.message.text == `/catalogue`){
                    return sendMessage2({
                        chat_id:    u.id,
                        text:       `Каталог`,
                        reply_markup:{
                            inline_keyboard: catalogue.map(item=>{
                                return [{
                                    text: item.name,
                                    callback_data: `${item.id}`
                                }]
                            })
                        }
                    },false,token,messages)
                }

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

    if (req.body.callback_query) {
        getUser(req.body.callback_query.from.id,udb).then(u=>{
            let inc = req.body.callback_query.data.split('_');
            if(inc[0] == `add`){

                getItem(inc[1]).then(i=>{
                    
                    sendMessage2({
                        chat_id: u.id,
                        message_id: req.body.callback_query.message.message_id,
                        text: item.name,
                        reply_markup:{
                            inline_keyboard: inline_keyboard
                        }
                    },`editMessageReplyMarkup`,token)

                })
            } else if(inc[1] == `remove`){

            } else if(inc[0] == `item`){
                getItem(inc[1]).then(i=>{
                    sendMessage2({
                        chat_id:    u.id,
                        photo:      i.image,
                        parse_mode: `Markdown`,
                        caption:    `*${i.name}*\n${clearTags(i.description).split('\r\n\t').slice(1,3).join('\n')}`,
                        // reply_markup
                    },`sendPhoto`,token)
                })
            } else {
                if(inc.length == 1){
                
                    let item = catalogue.filter(c=>c.id == inc[0])[0]
                    
                    let inline_keyboard = [];
    
                    if(item.sub.length){
                        inline_keyboard = item.sub.map(item=>{
                            return [{
                                text:           item.name,
                                callback_data:  `${inc[0]}_${item.id}`
                            }]
                        })
                    } else {
                        inline_keyboard = item.items.map(item=>{
                            return [{
                                text:           item.name,
                                callback_data:  `${inc[0]}_${item.id}`
                            }]
                        })
                    }
    
                    sendMessage2({
                        chat_id: u.id,
                        message_id: req.body.callback_query.message.message_id,
                        text: item.name,
                        reply_markup:{
                            inline_keyboard: inline_keyboard
                        }
                    },`editMessageText`,token)

                } else {
                    let item = catalogue.filter(c=>c.id == inc[0])[0]
                    
                    let c = 1;
                    
                    while(c < inc.length){
                        item = item.sub.filter(i=>i.id == inc[c])[0]
                        c++
                    }
    
                    let inline_keyboard = [];
                    
                    if(item.sub.length){
                        inline_keyboard = item.sub.map(item=>{
                            return [{
                                text:           item.name,
                                callback_data:  `${inc.join('_')}_${item.id}`
                            }]
                        })
                    } else {
                        inline_keyboard = item.items.map(item=>{
                            return [{
                                text:           item.name,
                                callback_data:  `item_${item.id}`
                            }]
                        })
                    }

                    
    
                    sendMessage2({
                        chat_id: u.id,
                        message_id: req.body.callback_query.message.message_id,
                        text: item.name,
                        reply_markup:{
                            inline_keyboard: inline_keyboard
                        }
                    },`editMessageText`,token)
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

router.all(`/amo/:id`,(req,res)=>{
    res.send(req.params.id)
})

router.all(`/api/:method`,(req,res)=>{
    devlog(req.signedCookies.userToken)
    devlog(req.signedCookies.adminToken)
    // req.signedCookies.userToken
    if (!req.signedCookies.userToken) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(req.signedCookies.userToken).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(user=>{
            if(!user) return res.sendStatus(403)

            devlog(user)
            
            switch(req.params.method){
                case `views`:{
                    return ifBefore(views,{user: +user.id}).then(col=>res.json(col))
                }
                case `orders`:{
                    return ifBefore(orders,{user: +user.id}).then(col=>res.json(col))
                }
                case `userTypes`:{
                    return res.json([{
                        id: `fiz`,
                        active: true,
                        name: `Физлицо`
                    },{
                        id: `ur`,
                        active: true,
                        name: `Юрлицо`
                    },])
                }

                case `deliveryTypes`:{
                    return res.json([{
                        id: `sdek`,
                        active: true,
                        name: `СДЭК (доставка курьером)`
                    },{
                        id: `sdekSamo`,
                        active: true,
                        name: `СДЭК (Самовывоз)`
                    },{
                        id: `post`,
                        active: true,
                        name: `Почта России`
                    }])
                }
                case `profile`:{
                    return res.json(user)
                }

                case `order`:{
                    return axios.post(`https://motionai.ru/api/inorder`,
                                {
                                    client_id: user.id,
                                    basket_id: user.id
                                },
                                {
                                    headers:{ 
                                        'Authorization': `Bearer ${authToken}`,
                                        'Content-Type': `application/json`
                                    }
                                }
                            ).then(s=>{
                                devlog(s.data)
                                
                                s.data.createdAt = new Date();
                                s.data.user = +user.id

                                orders.add(s.data).then(r=>{
                                     res.json({
                                        id:     r.id,
                                        success: true,
                                        comment: `Отлично! Заказ создан!`
                                    })
                                })

                            }).catch(err=>{
                                devlog(err.message)
                                alertAdmins({
                                    text: `Ошибка метода /inorder: ${err.message}`
                                })
                                return res.sendStatus(500)
                            })
                }
                case `cart`:{
                    
                    req.body.client_id = user.id;

                    switch(req.method){

                        case `GET`:{
                            return axios.post(`https://motionai.ru/api/getbasket`,
                                {
                                    "client_id": user.id,
                                    "basket_id": user.id
                                },
                                {
                                    headers:{ 
                                        'Authorization': `Bearer ${authToken}`,
                                        'Content-Type': `application/json`
                                    }
                                }
                            ).then(s=>{
                                devlog(s.data)
                                return res.json(s.data[user.id])
                            }).catch(err=>{
                                devlog(err.message)
                                alertAdmins({
                                    text: `Ошибка /getbasket: ${err.message}`
                                })
                                return res.sendStatus(500)
                            })
                        }
                        
                        case `POST`:{
                            return axios.post(`https://motionai.ru/api/inbasket`,
                                req.body,
                                {
                                    headers:{ 
                                        'Authorization': `Bearer ${authToken}`,
                                        'Content-Type': `application/json`
                                    }
                                }
                            ).then(s=>{
                                devlog(s.data)
                                return res.sendStatus(200)
                            }).catch(err=>{
                                devlog(err.message)
                                alertAdmins({
                                    text: `Ошибка /inbasket: ${err.message}`
                                })
                                return res.sendStatus(500)
                            })
                        }
                        case `DELETE`:{
                            req.body.section_id = req.query.section_id;
                            req.body.product_id = req.query.product_id;
                            
                            devlog(req.body);
                            
                            return axios.post(`https://motionai.ru/api/outbasket`,
                                req.body,
                                {
                                    headers:{ 
                                        'Authorization': `Bearer ${authToken}`,
                                        'Content-Type': `application/json`
                                    }
                                }
                            ).then(s=>{
                                devlog(s.data)
                                return res.sendStatus(200)
                            }).catch(err=>{
                                alertAdmins({
                                    text: `Ошибка метода outbasket: ${err.message}`
                                })
                                devlog(err.message)
                                return res.sendStatus(500)
                            })
                        }
                    }
                }
            }
        })
    })
})

router.all(`/api/:method/:id`,(req,res)=>{
    
    if (!req.signedCookies.userToken) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(req.signedCookies.userToken).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(user=>{
            if(!user) return res.sendStatus(403)

            devlog(user)
            
            switch(req.params.method){
                case `orders`:{
                    return getDoc(orders,req.params.id).then(o=>{
                        if(!o) return res.sendStatus(404)
                        if(o.user != +user.id) return res.sendStatus(403)
                        return res.json(o)
                    })
                }
                case `items`:{
                    return getItem(req.params.id).then(i=>{
                        res.json(i)
                        
                        views.add({
                            createdAt:      new Date(),
                            catalogue_id:   req.params.id || null,
                            user:           +user.id || null,
                            name:           i.name || null,
                            image:          i.image || null,
                            product_id:     req.params.id|| null
                        })
                    })
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

router.get(`/syncCatalogue`,(req,res)=>{
    return res.sendStatus(200)
    syncCatalogue()
})

router.get(`/app`,(req,res)=>{
    res.render(`${host}/app`,{
        start:      req.query.startapp,
        catalogue:  catalogue
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

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./caleoSwagger.json');
const swaggerDocument2 = require('./caleoSwagger.json');

router.use('/swagger', swaggerUi.serve);
router.get('/swagger', swaggerUi.setup(swaggerDocument));


module.exports = router;
