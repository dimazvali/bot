const ngrok = process.env.ngrok 
const ngrok2 = "https://a751-109-172-156-240.ngrok-free.app" 
const host = `dimazvali`
const token = process.env.dimazvaliToken;
var express =   require('express');
var router =    express.Router();
var axios =     require('axios');
var cors =      require('cors')

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
} = require ('./common.js')


const {
    sendMessage2,
    getUser,
    greeting
} =       require('./methods.js');

var cron =      require('node-cron');

const qs =      require('qs');
const { createHash,createHmac } = require('node:crypto');


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

const { ObjectStreamToJSON } = require('sitemap');

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


setTimeout(function(){
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok2}/dimazvali/hook`).then(()=>{
        console.log(`dimazvali hook set on ${ngrok}`)
    }).catch(handleError)   
},1000)

let adminTokens =               fb.collection('DIMAZVALIadminTokens');
let pages =                     fb.collection('DIMAZVALIpages');
let sections =                  fb.collection('DIMAZVALIsections');
let views =                     fb.collection(`DIMAZVALIviews`);
let logs =                      fb.collection(`DIMAZVALIlogs`);
let udb =                       fb.collection(`DIMAZVALIusers`);
let settings =                  fb.collection(`DIMAZVALIsettings`);
let tags =                      fb.collection(`DIMAZVALItags`);


const datatypes = {
    sections:{
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
    tags:{
        col: tags,
        newDoc: newTag
    }
}




router.post(`/hook`,(req,res)=>{
    
    res.sendStatus(200)

    let user = {}

    devlog(JSON.stringify(req.body))

    if (req.body.message) {

        user = req.body.message.from

        udb.doc(user.id.toString()).get().then(u => {
            if (!u.exists) registerUser(user)
        })
    }
})


router.get(`/auth`,(req,res)=>{
    res.render(`${host}/auth`)
})

router.post(`/auth`,(req,res)=>{

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


router.all(`/admin/:method/:id`,(req,res)=>{
    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(admin=>{
            
            if(!admin.admin) return res.sendStatus(403)
            
            switch(req.method){
                default:{
                    
                    if(!datatypes[req.params.method])  return res.sendStatus(404)
                    
                    let ref = datatypes[req.params.method].col.doc(req.params.id)

                    if(req.method == `GET`)         return ref.get().then(d=>{
                        d.exists ? res.json(handleDoc(d)) : res.sendStatus(404)
                    }) 
                    if(req.method == `PUT`)         return updateEntity(req,res,ref,admin)
                    if(req.method == `DELETE`)      return deleteEntity(req,res,ref,admin)
                    return res.sendStatus(404)
                }
            }
        })
        
    })
})

router.all(`/admin/:method`,(req,res)=>{
    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(admin=>{
            
            if(!admin.admin) return res.sendStatus(403)

            switch(req.method){
                case `about`:{
                    if(req.method == `GET`)     return settings.doc(`about`).get().then(d=>res.json(handleDoc(d,true))) 
                    if(req.method == `PUT`)     return updateEntity(req,res,settings.doc(`about`),admin)
                }
                default:{
                    if(!datatypes[req.params.method])  return res.sendStatus(404)
                    if(req.method == `GET`)     return datatypes[req.params.method].col.get().then(col=>res.json(handleQuery(col,true))) 
                    if(req.method == `POST`)    return datatypes[req.params.method].newDoc(req,res,admin)
                    return res.sendStatus(404)
                }
            }
        })  
    })
})

function updateEntity(req,res,ref,admin){
    ref.update({
        [req.body.attr]: req.body.value || null,
        updatedAt: new Date(),
        updatedBy: +admin.id
    }).then(s=>{
        res.json({
            success: true
        })
        log({
            admin: +admin.id,
            [req.params.method]: req.params.id,
            text: `Обновлен ${req.params.method} / ${req.params.id}.\n${req.body.attr} стало ${req.body.value}`
        })
    })
}


function newSection(req,res,admin){
    if(!req.body.slug) return res.status(400).send(`no slug`)
    if(!req.body.name) return res.status(400).send(`no name`)

    sections.doc(req.body.slug).get().then(s=>{
        
        if(s.exists) return res.status(400).send(`слаг уже занят`)
        
        sections.doc(req.body.slug.toString()).set({
            createdAt:      new Date(),
            createdBy:      +admin.id,
            active:         true,
            slug:           req.body.slug,
            id:             req.body.slug,
            name:           req.body.name || null,
            description:    req.body.description  || null,
            html:           req.body.html || null
        }).then(rec=>{
            res.redirect(`/web?page=sections_${req.body.slug}`)
            log({
                admin: +admin.id,
                text: `${uname(admin,admin.id)} создает раздел ${req.body.name}`
            })
        })
    })
}


function newPage(req,res,admin){
    
    if(!req.body.slug) return res.status(400).send(`no slug`)
    if(!req.body.name) return res.status(400).send(`no name`)

    pages.doc(req.body.slug).get().then(s=>{
        
        if(s.exists) return res.status(400).send(`слаг уже занят`)
        
        pages.doc(req.body.slug.toString()).set({
            createdAt:      new Date(),
            createdBy:      +admin.id,
            active:         true,
            slug:           req.body.slug,
            id:             req.body.slug,
            name:           req.body.name || null,
            description:    req.body.description  || null,
            html:           req.body.html || null
        }).then(rec=>{
            res.redirect(`/web?page=pages_${req.body.slug}`)
            log({
                admin: +admin.id,
                text: `${uname(admin,admin.id)} создает страницу ${req.body.name}`
            })
        })
    })
}

function newTag(req,res,admin){
    
    if(!req.body.slug) return res.status(400).send(`no slug`)
    if(!req.body.name) return res.status(400).send(`no name`)

    tags.doc(req.body.slug).get().then(s=>{
        
        if(s.exists) return res.status(400).send(`слаг уже занят`)
        
        tags.doc(req.body.slug.toString()).set({
            createdAt:      new Date(),
            createdBy:      +admin.id,
            active:         true,
            slug:           req.body.slug,
            id:             req.body.slug,
            name:           req.body.name || null,
            description:    req.body.description  || null,
            html:           req.body.html || null
        }).then(rec=>{
            res.redirect(`/web?tags=pages_${req.body.slug}`)
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

function newPage(req,res,admin){
    
    if(!req.body.slug) return res.status(400).send(`no slug`)
    if(!req.body.name) return res.status(400).send(`no name`)

    pages.where(`slug`,'==',req.body.slug).get().then(col=>{
        if(col.docs.length) return res.status(400).send(`слаг уже занят`)
        
        pages.doc(req.body.slug.toString()).set({
            createdAt:      new Date(),
            createdBy:      +admin.id,
            active:         true,
            slug:           req.body.slug,
            id:             req.body.slug,
            name:           req.body.name || null,
            description:    req.body.description  || null,
            html:           req.body.html || null
        }).then(rec=>{
            res.redirect(`/web?page=pages_${rec.id}`)
            log({
                admin: +admin.id,
                text: `${uname(admin,admin.id)} создает страницу ${req.body.name}`
            })
        })

    })
    
    
}

function registerUser(u){
    u.createdAt =   new Date();
    u.active =      true;
    u.blocked =     false;
    udb.doc(u.id.toString()).set(u).then(rec=>{
        sendMessage2({
            chat_id: u.id,
            text: `Добро пожаловать. Напишите, пожалуйста, чем могу быть полезен?..`
        },false,token)
        log({
            user: +u.id,
            text: `Новый пользователь: ${uname(u,u.id)}`
        })
    })
}


function log(o) {

    o.createdAt = new Date();

    logs.add(o).then(r => {

        if(!o.silent){
            alertAdmins({
                text:   o.text,
            })
        }
        
    })
}


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
            }).render(`${host}/web`,{
                wysykey: process.env.wysykey,
                start: req.query.page,
                logs: handleQuery(col),
                // token: req.signedCookies.adminToken
            })
        }) 

    if(!req.signedCookies.adminToken) return res.redirect(`${process.env.ngrok}/auth`)
    
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
                        res.render(`${host}/web`,{
                            wysykey:    process.env.wysykey,
                            logs:       handleQuery(col),
                            // token: req.signedCookies.adminToken
                        })
                    })
                

            }
        })
})


router.get(`/`,(req,res)=>{
    getDoc(settings,`start`).then(about=>{
        devlog(about)
        pages
            .where(`active`,'==',true)
            .get()
            .then(col=>{
                about.pages = handleQuery(col,true)
                res.render(`${host}/start`,
                    about
                )
            })
    })
})


router.get(`/:page`,(req,res)=>{
    let ref = pages.doc(req.params.page);
    ref.get().then(p=>{
        if(!p.exists) return res.sendStatus(404)
        views.add({
            page: req.params.page,
            createdAt: new Date(),
        })
        ref.update({
            views: FieldValue.increment(1)
        })
        res.render(`${host}/page`,p.data())
    })
})




module.exports = router;