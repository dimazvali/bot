const ngrok =   process.env.ngrok2 
const ngrok2 =  process.env.ngrok
const host =    `reestr`
const token =   process.env.reestrToken;
const sheet =   process.env.reestrSheet;
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
    sudden,
    authWebApp,
    authTG,
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

const { getStorage, getDownloadURL } = require('firebase-admin/storage');



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
}, 'reestr');

let fb = getFirestore(gcp);
let s = getStorage(gcp)


setTimeout(function(){
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/${host}/hook`).then(()=>{
        console.log(`${host} hook set on ${ngrok}`)
    }).catch(handleError)   
},1000)

let adminTokens =                   fb.collection(`${host}AdminTokens`);
let udb =                           fb.collection(`${host}users`);
let requests =                      fb.collection(`${host}requests`);
let logs =                          fb.collection(`${host}logs`);
let messages =                      fb.collection(`${host}messages`);

router.get(`/auth`,(req,res)=>{
    res.render(`${host}/auth`)
})

router.post(`/authWebApp`,(req,res)=>{
    authWebApp(req,res,token,adminTokens,udb)
})

router.post(`/auth`,(req,res)=>{
    authTG(req,res,token,adminTokens,udb,registerUser)
})


router.all(`/admin/:method`,(req,res)=>{
    devlog(`апи`)
    
    if(!req.signedCookies.adminToken) return res.sendStatus(401);
    
    getDoc(adminTokens, (req.signedCookies.adminToken)).then(t=>{
        if(!t || !t.active) return res.sendStatus(403)
        getUser(t.user,udb).then(u=>{
            if(!u || !u.active || u.blocked) return res.sendStatus(403)
            switch(req.params.method){
                case `requests`:{
                    switch(req.method){
                        case `GET`:{
                            return requests.get().then(col=>{
                                return res.json(handleQuery(col,true))
                            })
                        }
                        case `POST`:{
                            return requests.add({
                                createdAt: new Date(),
                                createdBy: +u.id,
                                data: req.body
                            }).then(record=>{
                                res.json({id: record.id})
                                requests.get()
                                    .then(col=>{
                                        axios.post(sheet,{
                                            user:   +u.id,
                                            data:   req.body,
                                            num:    col.docs.length+1
                                        }).then(r=>{
                                            
                                            devlog(r.data)

                                            sendMessage2({
                                                chat_id: u.id,
                                                text: `${r.data.url}`
                                            },false,token)

                                            requests.doc(record.id).update({
                                                doc: r.data.url
                                            })
                                        }).catch(err=>{
                                            console.log(err)
                                        })
                                    })
                                
                            })
                        }
                    }
                }
            }
        })
    })
})

router.all(`/admin/:method/:id`,(req,res)=>{
    if(!req.signedCookies.adminToken) return res.sendStatus(401);
    
    getDoc(adminTokens, (req.signedCookies.adminToken)).then(t=>{
        if(!t || !t.active) return res.sendStatus(403)
        getUser(t.user,udb).then(u=>{
            if(!u || !u.active || u.blocked) return res.sendStatus(403)
            switch(req.params.method){
                case `requests`:{
                    switch(req.method){
                        case `GET`:{
                            return getDoc(requests,req.params.id).then(d=>{
                                if(!d) return res.sendStatus(404)
                                return res.json(d)
                            })
                        }
                    }
                }
            }
        })
    })
})

router.get(`/web`,(req,res)=>{
    
    devlog(req.signedCookies.adminToken)

    if(!(process.env.develop == `true`) && !req.signedCookies.adminToken) return res.redirect(`${process.env.ngrok}/${host}/auth`)
    
    getDoc(adminTokens, (req.signedCookies.adminToken)).then(t=>{

        devlog(t)

        if(!t || !t.active) return res.sendStatus(403)

        getUser(t.user,udb).then(u=>{

            devlog(`пользватель получен`)

            if(u.blocked) return res.sendStatus(403)
            
            if(process.env.develop == `true`) return logs
                .orderBy(`createdAt`,'desc')
                .limit(100)
                .get()
                .then(col=>{
                    res.cookie('adminToken', req.query.admintoken || process.env.adminToken, {
                        maxAge:     7 * 24 * 60 * 60 * 1000,
                        signed:     true,
                        httpOnly:   true,
                    }).render(`${host}/web`,{
                        user:       u,
                        wysykey:    process.env.wysykey,
                        start:      req.query.page,
                        logs:       handleQuery(col),
                        admin:      true
                    })
                }) 
            

            if(u.admin && !req.query.stopAdmin) return logs
                .orderBy(`createdAt`,'desc')
                .limit(100)
                .get()
                .then(col=>{
                    res.render(`${host}/web`,{
                        user:       u,
                        wysykey:    process.env.wysykey,
                        start:      req.query.page,
                        logs:       handleQuery(col)
                    })
                })

        })

    })
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

                    u = common.handleDoc(u)

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

                // пришло текстовое сообщение;


                switch (req.body.message.text) {


                    default:
                        if(!req.body.message.text.indexOf(`/start`)){
                            
                        } else {
                            return alertAdmins({
                                text: `${uname(u,u.id)} пишет: ${req.body.message.text}`,
                                user: user.id
                            })
                        }
                        
                }
            }

            if (req.body.message.photo) {
                // m.sendMessage2({
                //     chat_id: user.id,
                //     text: locals.fileNeeded
                // }, false, token)
            }

            if (req.body.message.document) {

                // if(req.body.message.media_group_id){
                //     if(!mediaGroups[req.body.message.media_group_id]) mediaGroups[req.body.message.media_group_id] = [];
                //     setTimeout(()=>{
                //         handleDoc(req,user)
                //     },mediaGroups[req.body.message.media_group_id].length*1000)
                //     mediaGroups[req.body.message.media_group_id].push(req.body.message.document.file_id)
                // } else {
                //     handleDoc(req,user)
                // }
            }

        })
    }
})

function registerUser(u) {

    u.createdAt =       new Date();
    u.active =          true;
    u.blocked =         false;
    
    udb.doc(u.id.toString()).set(u).then(() => {

        log({
            user: +u.id,
            text: `${uname(u,u.id)} регистрируется в боте.`
        })

    })
}


function log(o) {

    o.createdAt = new Date()

    logs.add(o).then(r => {

        if(!o.silent){
            alertAdmins({
                text:   o.text,
                type:   (o.class && o.user) ? 'class' : 'logRecord',
                id:     o.class,
                user:   o.user || o.user_id || null,
                ticket: o.ticket
            })
        }
        
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


module.exports = router;