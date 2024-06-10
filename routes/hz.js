
const ngrok2 =  process.env.ngrok2;
const ngrok =   process.env.ngrok;
const host =    `hz`
const token =   process.env.ozonToken;

var express =   require('express');
var router =    express.Router();
var axios =     require('axios');

const fileUpload = require('express-fileupload');

var cors =      require('cors')
var fs =        require('fs');

let botLink = `https://t.me/ozonStatsBot`

// shop
//     name
//     client
//     key

// shopUsers
//     user
//     shop
//     admin

// userPayments


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
    ifBefore
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
    limits: { fileSize: 10 * 1024 * 1024 },
  
    // Temporarily store uploaded files to disk, rather than buffering in memory
    useTempFiles : true,
    tempFileDir : '/tmp/'
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
    getStorage,
    getDownloadURL
} = require('firebase-admin/storage');

var FormData =  require('form-data');

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
}, 'hz');

let fb = getFirestore(gcp);
let s = getStorage(gcp)


setTimeout(function(){
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/${host}/hook`).then(()=>{
        console.log(`${host} hook set on ${ngrok}`)
    }).catch(err=>{
        handleError(err)
    })   
},1000)



let adminTokens =       fb.collection(`${host}adminTokens`);
let udb =               fb.collection(`${host}Users`);
let shops =             fb.collection(`${host}Shops`);
let shopsUsers =        fb.collection(`${host}ShopsUsers`);
let logs =              fb.collection(`${host}Logs`);
let messages =          fb.collection(`${host}Messages`);


router.get(`/:shop/report`,(req,resp)=>{
    
    if(!req.signedCookies.userToken) return resp.redirect(`/${host}/userAuth?token=userToken&ep=${encodeURIComponent(`${req.params.shop}/report`)}`)

    getDoc(adminTokens,req.signedCookies.userToken).then(t=>{
        if(!t || !t.active) return resp.redirect(`/${host}/userAuth?token=userToken`)
        getDoc(udb,t.user).then(u=>{
            if(!u.active) return resp.status(403).send(`Простите, вам сюда нельзя.`);
            ifBefore(shopsUsers,{user: +u.id,active:true}).then(userShops=>{
                if(userShops.map(s=>s.shop).indexOf(req.params.shop)==-1) return resp.status(403).send(`Простите, вам сюда нельзя.`);
                getDoc(shops,req.params.shop).then(s=>{
        
                    if(!s) return res.sendStatus(404);
                    let from = new Date(new Date().setHours(0,0) - ((+req.query.days||14)*24*60*60*1000)).toISOString();
                    let to = new Date().toISOString();
            
                    let uploads = [];
            
                    uploads.push(axios.post(`https://api-seller.ozon.ru/v2/posting/fbo/list`,{
                        "dir": "ASC",
                        "filter": {
                        "since":  from,
                        "to":     to
                        },
                        "limit": 1000,
                        "with": {
                        "analytics_data": true,
                        "financial_data": true
                        }
                    },{headers:{
                        'Api-key':      s.apiSecret, 
                        'Client-Id':    s.apiId, 
                    }}).then(d=>d.data))
            
                    uploads.push(axios.post(`https://api-seller.ozon.ru/v2/analytics/stock_on_warehouses`,{
                        "limit": 1000,
                        "offset": 0,
                        "warehouse_type": "ALL"
                    },{headers:{
                        'Api-key':      s.apiSecret, 
                        'Client-Id':    s.apiId, 
                    }}).then(d=>d.data))
            
                    Promise.all(uploads).then(data=>{
            
                        shops.doc(req.params.shop).update({
                            reports: FieldValue.increment(1)
                        })
            
                        log({
                            silent: true,
                            text:   `${uname(u,u.id)} формирует отчет для магазина ${s.name}`,
                            shop:   s.id,
                            user:   +u.id
                        })
                        
                        let r = data[0].result.filter(o=>o.status != `cancelled`);
                        
                        let uniqueSKU = [... new Set(r.map(rec=>rec.products.map(p=>p.sku).flat()))]
            
                        let res = {};
            
                        uniqueSKU.forEach(sku=>{
                            
                            let data = [];
            
                            r.forEach(sell=>{
                                sell.products.forEach((p)=>{
                                    if(p.sku == sku){
                                        data.push({
                                            created_at:     sell.created_at,
                                            sku:            p.sku,
                                            name:           p.name,
                                            price:          +p.price,
                                            quantity:       p.quantity,
                                            offer_id:       p.offer_id,
                                            region:         sell.analytics_data.region,
                                            city:           sell.analytics_data.city,
                                            wh:             sell.analytics_data.warehouse_name,
                                            cluster_from:   sell.financial_data.cluster_from,
                                            cluster_to:     sell.financial_data.cluster_to,
                                        })
                                    }
                                })
                            })
            
                            let tonight =       new Date(new Date().setHours(0,0)).toISOString()
                            let lastnight =     new Date(new Date().setHours(0,0)-(24*60*60*1000)).toISOString()
                            let lastnight2 =    new Date(new Date().setHours(0,0)-(2*24*60*60*1000)).toISOString()
                            let lastweek =      new Date(new Date().setHours(0,0)-(8*24*60*60*1000)).toISOString()
            
                            // console.log(tonight,lastnight,lastweek)
            
            
                            res[sku] = {
                                data:       data,
                                today:      data.filter(p=> new Date(p.created_at).toISOString() > tonight),
                                yesterday:  data.filter(p=> new Date(p.created_at).toISOString() > lastnight    && new Date(p.created_at).toISOString() < tonight),
                                week:       data.filter(p=> new Date(p.created_at).toISOString() > lastweek     && new Date(p.created_at).toISOString() < tonight),
                                // total:      []
                            };
                            
                        })
            
                        resp.render(`${host}/hz`,{
                            data:   res,
                            shops: userShops,
                            lefts: data[1].result.rows,
                            cur: (p) => cur(p)
                        })
                    })
                })
            })
        })
    })
    
    
})

function log(o) {

    o.createdAt = new Date()

    logs.add(o).then(r => {

        if(!o.silent){
            alertAdmins({
                text:   o.text
            })
        }

    })
}

function registerUser(u) {

    u.createdAt =       new Date();
    u.active =          true;
    u.blocked =         false;
    u.city =            null;
    u.score =           0;
    u[u.language_code] = true; 
    
    udb.doc(u.id.toString()).set(u).then(() => {

        sendMessage2({
            chat_id: +u.id,
            text:   savedSettings.defaultGreetings.value,
            reply_markup: {
                inline_keyboard:[
                    [{
                        text: `Волонтером`,
                        callback_data: `user_toggle_volunteer`
                    }],
                    [{
                        text: `Журналистом`,
                        callback_data: `user_toggle_media`
                    }],
                    [{
                        text: `Меценатом`,
                        callback_data: `user_toggle_sponsor`
                    }],
                ]
            }
        }, false, token, messages)

        getAvatar(u.id).then(data=>{
            if(data && data.ok && data.result.total_count){
                
                let pic = data.result.photos[0].reverse()[0]
                
                udb.doc(u.id.toString()).update({
                    avatar_id: pic.file_id
                })
            }
        })

        log({
            user: +u.id,
            text: `${uname(u,u.id)} регистрируется в боте.`
        })

    })
}


function getAvatar(id){
    return axios.post('https://api.telegram.org/bot' + token + '/getUserProfilePhotos', {
        user_id: id || dimazvali
    }, {headers: {'Content-Type': 'application/json'}
    }).then(d=>{
        return d.data
        console.log(d.data)
    }).catch(err=>{
        console.log(err)
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

function addShop(req,res,admin){
    
    devlog(req.body);

    if(!req.body.apiId)         return res.status(400).send(`нет id`)
    if(!req.body.apiSecret)     return res.status(400).send(`нет ключа`)
    if(!req.body.name)          return res.status(400).send(`нет названия`)
    
    return ifBefore(shops,{id:req.body.apiId}).then(col=>{
        if(col.length) return res.status(400).send(`магазин с таким ключом уже создан: ${col.map(s=>s.name).join(', ')}.`);
        shops.add({
            createdAt:  new Date(),
            createdBy:  +admin.id,
            name:       req.body.name,
            apiId:      req.body.apiId,
            apiSecret:  req.body.apiSecret,
            active:     true
        }).then(s=>{
            log({
                shop:   s.id,
                admin:  +admin.id,
                text: `${uname(admin,admin.id)} создает магазин с названием ${req.body.name}`
            })
            res.redirect(`/${host}/web?page=shops_${s.id}`)
        })
    })
}


const datatypes = {
    shopsUsers:{
        col:    shopsUsers,
        newDoc: add2Shop
    },
    shops:{
        col: shops,
        newDoc: addShop
    },
    users:{
        col: udb
    },
    messages:{
        col: messages,
        newDoc: sendMessage,
    }
}

function add2Shop(req,res,admin){
    if(!req.body.user) return res.status(400).send(`Пользователь потерялся`)
    if(!req.body.shop) return res.status(400).send(`Магазин потерялся`)
    getDoc(udb,req.body.user).then(u=>{
        if(!u || !u.active) return res.status(400).send(`Такого пользователя нет (или он заблокирован).`)
        getDoc(shops,req.body.shop).then(s=>{
            if(!s || !s.active) return res.status(400).send(`Такого магазина нет (или он заблокирован).`);
            ifBefore(shopsUsers,{user:+u.id,shop:s.id}).then(before=>{
                if(before.length) return res.status(400).send(`Этот пользователь уже был добавлен в этот магазин`);
                shopsUsers.add({
                    active:     true,
                    createdAt:  new Date(),
                    admin:      +admin.id,
                    user:       +u.id,
                    shop:       s.id,
                    shopName:   s.name
                }).then(r=>{
                    log({
                        text:       `${uname(admin,admin.id)} открывает доступ к магазину ${s.name} для пользователя ${uname(u,u.id)}`,
                        admin:      +admin.id,
                        user:       +u.id,
                        shop:       s.id
                    })
                    // res.redirect(`/${host}/web?page=shops_${s.id}`)
                    res.json({
                        success: true
                    })
                })
            })
        })
    })
}

function sendMessage(req,res,admin){
    let t = {
        chat_id: req.body.user,
        text:   req.body.text
    }
    
    sendMessage2(t, false, token, messages,{admin: +admin.id})
    
    if(res) res.sendStatus(200);
}

router.get(`/auth`,(req,res)=>{
    res.render(`${host}/auth`)
})

router.get(`/userAuth`,(req,res)=>{
    res.render(`${host}/userAuth`,{
        ep: req.query.ep
    })
})

router.post(`/userAuth`,(req,res)=>{
    authTG(req,res,token,adminTokens,udb,registerUser,`userToken`)
})

router.post(`/auth`,(req,res)=>{
    authTG(req,res,token,adminTokens,udb,registerUser)
})

router.post(`/hook`,(req,res)=>{
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
            if(req.body.message.text){
                messages.add({
                    user:       user.id,
                    text:       req.body.message.text || null,
                    createdAt:  new Date(),
                    isReply:    false
                })
            }
            if (!u) return registerUser(user)
            if (!u.active) return udb.doc(user.id.toString()).update({
                active: true,
                stopped: null
            }).then(s => {
                log({
                    silent:     true,
                    user:       +user.id,
                    text:       `Пользователь id ${user.id} возвращается`
                })
            })

            if (req.body.message.text) {
                if(req.body.message.text == `/start`){
                    return sendMessage2({
                        chat_id: user.id,
                        text: `Я текст приветствия, который можно будет настроить в админке.`
                    },false,token)
                } else {
                    return alertAdmins({
                        text: `${uname(u,u.id)} пишет: ${req.body.message.text}`,
                        user: user.id
                    })
                }
            }
        })
    }
})
    

router.all(`/admin/:method`,(req,res)=>{
    
    let token = req.signedCookies.adminToken || req.signedCookies.userToken;

    if (!token) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(token).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(admin=>{

            if(!admin) return res.sendStatus(403)

            devlog(req.body)

            switch(req.params.method){

                case `userSearch`:{
                    if(!req.query.name) return res.sendStatus(400)
                    
                    return udb.get().then(col=>{
                        res.json(handleQuery(col).filter(u=>u.username && !u.username.indexOf(req.query.name)))
                    })
            
                }

                default:{

                    if(!datatypes[req.params.method])  return res.sendStatus(404)
                    
                    if(req.method == `GET`)     return datatypes[req.params.method].col.get().then(col=>{
                        
                        let data = handleQuery(col,true);
                        
                        Object.keys(req.query).forEach(q=>{
                            data = data.filter(i=> i[q] == (Number(req.query[q]) ? Number(req.query[q]) : req.query[q]))
                        })

                        if(!admin.admin && req.params.method == `users`) data = data.filter(i=>i.createdBy == +admin.id)

                        res.json(data)
                    }) 
                    
                    if(req.method == `POST`)    return datatypes[req.params.method].newDoc(req, res, admin,datatypes[req.params.method].extras)
                    
                    return res.sendStatus(404)
                }
            }
        })  
    })
})

router.all(`/admin/:method/:id`,(req,res)=>{
    let token = req.signedCookies.adminToken || req.signedCookies.userToken;
    if (!token) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(token).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(admin=>{
            switch(req.params.method){
                

                case `logs`:{
                    
                    if(!admin.admin) return res.sendStatus(403)

                    let q = req.params.id.split('_')
                    
                    return logs
                        .where(q[0],'==',Number(q[1])?+q[1]:q[1])
                        .get()
                        .then(col=>{
                            res.json(handleQuery(col,true))
                        })
                }

                default:{
                    
                    if(!datatypes[req.params.method])  return res.sendStatus(404)
                    
                    let ref = datatypes[req.params.method].col.doc(req.params.id)

                    ref.get().then(d=>{
                        d = handleDoc(d)

                        if(!admin.admin){
                            if(d.createdBy != +admin.id) return res.sendStatus(403)
                        } 

                        if(req.method == `GET`)         return ref.get().then(d=>{
                            d.exists ? res.json(handleDoc(d)) : res.sendStatus(404)
                        })

                        if(req.method == `PUT`)         return updateEntity(req,res,ref,admin)
                        if(req.method == `DELETE`)      return deleteEntity(req,res,ref,admin)
                        
                        return res.sendStatus(404)
                        
                    })

                    
                }
            }
        })
        
    })
})


function updateEntity(req,res,ref,admin){
    ref.get().then(d=>{
        
        d = handleDoc(d);

        if(req.params.method == `messages`){
            let mess = d;
            
            if(mess.deleted || mess.edited)       return res.status(400).send(`уже удалено`);
            if(!mess.messageId)    return res.status(400).send(`нет id сообщения`);
            
            sendMessage2({
                chat_id:    mess.user,
                message_id: mess.messageId,
                text:       req.body.value
            },`editMessageText`,token).then(resp=>{
                if(resp.ok) {
                    res.json({
                        success: true,
                        comment: `Сообщение обновлено.`
                    })
                    ref.update({
                        text:       req.body.value,
                        textInit:   mess.text,
                        editedBy:   +admin.id,
                        edited:     new Date()
                    })
                } else {
                    res.sendStatus(500)
                }
            })
        } else {
            ref.update({
                [req.body.attr]: (req.body.type == `date`? new Date(req.body.value) : req.body.value) || null,
                updatedAt: new Date(),
                updatedBy: +admin.id
            }).then(s=>{
                res.json({
                    success: true
                })
                log({
                    silent: true,
                    admin: +admin.id,
                    [req.params.method]: req.params.id,
                    text: `Обновлен ${req.params.method} / ${d.name || req.params.id}.\n${req.body.attr} стало ${req.body.value} (было ${d[req.body.attr || null]})`
                })

                if(req.params.method == `settings`){
                    savedSettings[req.params.id].value = req.body.value
                }
            })
        }

        
    })
    
}


function deleteEntity(req, res, ref, admin, attr, callback) {
    
    return ref.get().then(e => {
        
        let data = handleDoc(e)

        if(req.params.method == `messages`){ 
            
            mess = data;

            if(mess.deleted)       return res.status(400).send(`уже удалено`);
            if(!mess.messageId)    return res.status(400).send(`нет id сообщения`);
            
            sendMessage2({
                chat_id:    mess.user,
                message_id: mess.messageId
            },`deleteMessage`,token).then(resp=>{
                if(resp.ok) {
                    res.json({
                        success: true,
                        comment: `Сообщение удалено.`
                    })
                    ref.update({
                        deleted:    new Date(),
                        deletedBy:  +admin.id
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

router.get(`/web`,(req,res)=>{
    devlog(req.signedCookies.adminToken)

    if(!req.signedCookies.adminToken) return res.redirect(`${process.env.ngrok}/${host}/auth`)
    
    getDoc(adminTokens, req.signedCookies.adminToken).then(t=>{

        devlog(t)

        if(!t || !t.active) return res.sendStatus(403)

        getUser(t.user,udb).then(u=>{

            devlog(`пользватель получен`)

            if(u.blocked) return res.sendStatus(403)
            
            if(u.admin && !req.query.stopAdmin) return logs
                .orderBy(`createdAt`,'desc')
                .limit(100)
                .get()
                .then(col=>{

                    res.render(`${host}/web`,{
                        user:       u,
                        wysykey:    process.env.wysykey,
                        start:      req.query.page,
                        logs:       handleQuery(col),
                    })
                })

        })

    })
})


module.exports = router;