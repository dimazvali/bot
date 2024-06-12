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
const host = `cyprus`

const channellId = -1002139324312;

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


let gcp = initializeApp({
    credential: cert({
        "type": "service_account",
        "project_id": "cyprusjournal-43b05",
        "private_key_id": "ef38d0abbbcdf6671bb447e3cdbbf0e3df3f98b4",
        "private_key": process.env.cyprusKey.replace(/\\n/g, '\n'),
        "client_email": "firebase-adminsdk-sjf38@cyprusjournal-43b05.iam.gserviceaccount.com",
        "client_id": "102273232380927774766",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-sjf38%40cyprusjournal-43b05.iam.gserviceaccount.com",
        "universe_domain": "googleapis.com"
      }
      ),
    databaseURL: "https://rrspecialsapi.firebaseio.com"
}, 'cyprus');

let fb = getFirestore(gcp);

let token = process.env.cyprusToken

let botLink =           `https://t.me/cyprusjournal_bot`
let testChannelLink =   `https://t.me/+uaMO0ee7u5hjYmQy`

const ngrok = process.env.ngrok


setTimeout(function(){
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/cyprus/hook`).then(()=>{
        console.log(`cyprus hook set on ${ngrok}`)
    }).catch(handleError)   
},1500)

function handleError(err) {
    console.log(err);
    try {
        res.status(500).send(err.message)
    } catch (err) {

    }
}

let udb =               fb.collection('users');
let messages =          fb.collection('usersMessages');
let logs =              fb.collection('logs');
let news =              fb.collection('news');
let adminTokens =       fb.collection(`adminTokens`)


router.all(`/api/:data/:id`,(req,res)=>{
    if(!req.query.user) return res.sendStatus(400)
    switch(req.params.data){
        case `news`:{ 
            return common.getDoc(news,req.params.id).then(doc=>{
                if(!doc) return res.sendStatus(404)
                if(doc.user != +req.query.user) return res.sendStatus(403)
                switch(req.method){
                    case `GET`:{
                        return res.json(doc)
                    }
                    case `DELETE`:{
                        if(doc.published) return res.json({
                            success: false,
                            comment: `Новость уже опубликована, вы не можете ее удалить.`
                        })

                        return news.doc(req.params.id).update({
                            active: false
                        }).then(s=>{
                            res.json({success:true})
                        })
                    }
                    case `PUT`:{
                        
                        if(doc.published) return res.json({
                            success: false,
                            comment: `Новость уже опубликована, вы не можете ее удалить.`
                        })

                        if(req.body.attr == `text` || req.body.attr == `media`){
                            return news.doc(req.params.id).update({
                                [req.body.attr]: req.body.value
                            }).then(s=>{
                                res.json({success:true})
                            })
                        } else {
                            return res.sendStatus(403)
                        }
                    }
                }
                 
            })
        }
    }
})

router.get(`/app`,(req,res)=>{
    res.render(`cyprus/app`)
})

router.get(`/admin`,(req,res)=>{
    res.render(`cyprus/admin`)
})

router.all(`/admin/:data/`,(req,res)=>{
    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(req.signedCookies.adminToken).get().then(doc=>{
        if(!doc.exists) return res.sendStatus(403)
        doc = common.handleDoc(doc)
        if(!doc.active) return res.sendStatus(403)

        switch(req.params.data){

            case `news`:{
                return news.get().then(col => res.json(common.handleQuery(col,true)))
            }
            case `users`:{
                return udb.get().then(col => res.json(common.handleQuery(col,true)))
            }
            case 'message': {
                if (req.body.text && req.body.user) {
                    return m.sendMessage2({
                            chat_id: req.body.user,
                            text: req.body.text
                        }, false, token)
                        .then(() => {
                            res.json({
                                success: true
                            })

                            messages.add({
                                user: +req.body.user,
                                text: req.body.text,
                                createdAt: new Date(),
                                isReply: true
                            })

                        }).catch(err => {
                            res.json({
                                success: false
                            })
                        })
                } else {
                    return res.sendStatus(400)
                }
            }
            default:{
                return res.sendStatus(404)
            }
        }
    
    })
    
})

router.all(`/admin/:data/:id`,(req,res)=>{
    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(req.signedCookies.adminToken).get().then(doc=>{
        if(!doc.exists) return res.sendStatus(403)
        doc = common.handleDoc(doc)
        if(!doc.active) return res.sendStatus(403)

        switch(req.params.data){
            case `messages`:{
                switch(req.method){
                    case `GET`:{
                        return messages.where(`user`,'==',+req.params.id).get().then(col=>res.json(common.handleQuery(col)))
                    }
                }
            }
            case `news`:{
                let ref = news.doc(req.params.id)

                switch(req.method){
                    case `GET`:{

                        let data = [];

                        return ref.get().then(p=>{

                            p = common.handleDoc(p)

                            data.push(udb.doc(p.user.toString()).get().then(u=>common.handleDoc(u)))
                            
                            if(p.media) data.push(axios.post(`https://api.telegram.org/bot${token}/getFile`,{
                                file_id: p.media 
                            }).then(d=>d.data))
                            
                            Promise.all(data).then(data=>{

                                devlog(data)

                                res.json({
                                    publication:    p,
                                    user:           data[0],
                                    media:          data[1] ? `https://api.telegram.org/file/bot${token}/${data[1].result.file_path}` : null 
                                })

                            })
                        })                        
                    }
                    case `PUT`:{
                        devlog(req.body.attr)
                        return updateEntity(req,res,ref,doc.user)
                    }
                    case `DELETE`:{
                        return ref.update({
                            active: false,
                            updatedAt: new Date()
                        }).then(s=>{
                            res.json({
                                success: true
                            })
                            m.sendMessage({
                                chat_id:    d.user,
                                text: `К сожалению, ваша публикация не прошла модерацию.`
                            })
                        })
                    }
                    case `POST`:{
                        return ref.get().then(d=>{

                            d = d.data()

                            let method = false;
                            
                            if(d.media) method = `sendPhoto`;
                            
                            let message = {
                                chat_id:    channellId,
                                text:       d.text,
                                caption:    d.media ? d.text : null, 
                                photo:      d.media || null
                            }

                            return m.sendMessage2(message,method,token)
                                .then(s=>{
                                    devlog(s)
                                    devlog(s.data)
                                    res.json({success:true})
                                    
                                    ref.update({
                                        status:         `published`,
                                        published:      true,
                                        publishedAt:    new Date()
                                    })

                                    udb.doc(d.user.toString()).update({
                                        publications: FieldValue.increment(1)
                                    })

                                    m.sendMessage2({
                                        chat_id:    d.user,
                                        text: `Спасибо!\nВаша публикая была отправлена в канал: ${testChannelLink}`
                                    },false,token)
                                })
                                .catch(err=>{
                                    devlog(err.message)
                                    res.sendStatus(500)
                                })

                        })
                    }
                }
                
            }
            case `users`:{
                let ref = udb.doc(req.params.id)
                switch (req.method){
                    
                    case `GET`:{
                        return ref.get().then(d=>{
                            let publications = news.where(`user`,'==',+req.params.id).get().then(col=>common.handleQuery(col,true))
                            
                            Promise.resolve(publications).then(publications=>{
                                res.json({
                                    user: common.handleDoc(d),
                                    news: publications
                                })
                            })
                            
                        })
                    }
                    case `PUT`:{
                        devlog(req.body.attr)
                        return updateEntity(req,res,ref,doc.user)
                    }
                    case `DELETE`:{
                        return ref.update({
                            active: false,
                            updatedAt: new Date()
                        }).then(s=>{
                            res.json({
                                success: true
                            })
                            m.sendMessage({
                                chat_id:    d.user,
                                text: `К сожалению, ваш аккаунт был заблокирован.`
                            })
                        })
                    }
                }
                
            }
            default:{
                return res.sendStatus(404)
            }
        }
    
    })
})


router.all(`/api/:data`,(req,res)=>{
    
    if(!req.query.user) return res.sendStatus(400)

    switch(req.params.data){
        case `news`:{
            switch(req.method){
                case 'GET':{
                    return news
                        .where(`user`,'==',+req.query.user)
                        .get()
                        .then(col=>{
                            res.json(common.handleQuery(col,true))
                        })
                }
                case 'POST':{
                    if(!req.query.user) return res.json({success:false,comment:`Публикации без автора не принимаются.`})
                    if(!req.body.title) return res.json({success:false,comment:`Публикации без заголовка не принимаются.`})
                    if(!req.body.text) return res.json({success:false,comment:`Публикации без текста не принимаются.`})
                    
                    return common.getDoc(udb,req.query.user).then(u=>{
                        if(!u) return res.json({success:false,comment:`Публикации без автора не принимаются.`})
                        
                        return news.add({
                            user:       +req.query.user,
                            title:      req.body.title,
                            createdAt:  new Date(),
                            text:       req.body.text,
                            media:      req.body.media || null,
                            active:     true,
                            status:     `new`
                        }).then(s=>{
                            res.json({success:true})

                            log({
                                text: `Новая публикация от пользователя  ${uname(u,u.id)}: ${req.body.title}.\nЧитаем здесь: ${ngrok}/${host}/web?page=news_${s.id}`,
                                user: +req.query.user,
                                news: s.id
                            })
                        })
                    })

                    
                }
            }
            
        }
        default: {
            res.sendStatus(404)
        }
    }
})


function updateEntity(req,res,ref,adminId){
    return ref.update({
        updatedAt: new Date(),
        updatedBy: adminId,
        [req.body.attr]: req.body.attr == `date` ? new Date(req.body.value) : req.body.value
    }).then(s=>{
        res.json({success:true})

    }).catch(err=>{
        res.status(500).send(err.message)
    })
}


router.post('/hook', (req, res) => {
    
    res.sendStatus(200)

    devlog(JSON.stringify(req.body))

    let user = {}

    if (process.env.develop == 'true') console.log(JSON.stringify(req.body, null, 2))

    if (req.body.message) {
        user = req.body.message.from

        udb.doc(user.id.toString()).get().then(u => {
            
            if (!u.exists) return registerUser(user)



            if(!u.data().active){
                udb.doc(user.id.toString()).update({
                    active:     true,
                    stopped:    null
                }).then(s=>{
                    log({
                        text: `Пользователь id ${user.id} возвращается`,
                        user:   +user.id
                    })  
                })
            }

            if(req.body.message && req.body.message.photo){
                m.sendMessage2({
                    chat_id:    user.id,
                    parse_mode: 'HTML',
                    text:       'id фото (понадобится для публикации)\n<pre>'+req.body.message.photo.reverse()[0].file_id+'</pre>'
                },false,token)
            }

            if (req.body.message.text) {
   
                messages.add({
                    user:       user.id,
                    text:       req.body.message.text || null,
                    createdAt:  new Date(),
                    isReply:    false
                })

                if (req.body.message.text.indexOf('/start')) {
                    alertAdmins({
                        text: `${uname(u.data(),u.id)} пишет что-то странное: ${req.body.message.text}`,
                        type: 'incoming',
                        user_id: user.id
                    })
                }

                if (!req.body.message.text.indexOf('/pro')) {
                    m.sendMessage2({
                        chat_id: user.id,
                        text: `Админка с дева ${ngrok}:`,
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: `test`,
                                    web_app: {
                                        url: `${ngrok}/${host}/admin`
                                    }
                                }]
                            ]
                        }
                    }, false, token)

                    m.sendMessage2({
                        chat_id: user.id,
                        text: `Приложенька с дева ${ngrok}`,
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: `test`,
                                    web_app: {
                                        url: `${ngrok}/${host}/app`
                                    }
                                }]
                            ]
                        }
                    }, false, token)
                }

            }

            if (req.body.message.photo) {
                udb.where('admin','==',true).get().then(col=>{
                    common.handleQuery(col).forEach(a=>{
                            // m.sendMessage2({
                            //     chat_id: a.id,
                            //     caption: `фото от ${uname(u.data(),u.id)}`,
                            //     photo: req.body.message.photo[0].file_id
                            // }, 'sendPhoto', token)
                            m.sendMessage2({
                                chat_id: a.id,
                                from_chat_id: user.id,
                                message_id: req.body.message.message_id
                            }, 'forwardMessage', token)
                        })
                })
            }

        }).catch(err => {
            console.log(err)
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
                        text: `${uname(u,u.id)} блочит бот`,
                        user: +u.id
                    })
                })
                
            }).catch(err=>{
                console.log(err)
            })
        }
    }
})


function log(o) {
    o.createdAt = new Date()
    logs.add(o)
    if(!o.silent){
        alertAdmins({
            text:   o.text
        })
    }
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

                if(!process.env.develop || a.id == common.dimazvali) m.sendMessage2(message, false, token)
            }
        })
    })
}
let users = {}


function registerUser(u) {

    u.createdAt =   new Date();
    u.active =      true;
    u.blocked =     false;
    u.admin =       false;
    
    users[u.id] = u;

    udb.doc(u.id.toString()).set(u).then(() => {

        m.sendMessage2({
            chat_id: u.id,
            text: `Добро пожаловать!`,
        }, false, token)

        udb.get().then(col=>{
            alertAdmins({
                type: 'newUser',
                text: `Новый пользователь бота (№${col.docs.length}):\n${JSON.stringify(u,null,2)}`,
                user_id: u.id
            })

            log({
                text: `Новый пользователь: ${uname(u,u.id)}`,
                user:   +u.id
            })
        })

    }).catch(err => {
        console.log(err)
    })
}



router.get(`/auth`,(req,res)=>{
    res.render(`${host}/auth`)
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



function isAdmin(id) {
    return udb.doc(id || 'noWay').get().then(a => {
        if (!a.exists) return false
        if (a.data().admin) return true
        return false
    }).catch(err => {
        return false
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
                httpOnly: true
            }).render(`${host}/web`,{
                logs: common.handleQuery(col),
                start:  req.query.page
                // token: req.signedCookies.adminToken
            })
        }) 

    if(!req.signedCookies.adminToken) return res.redirect(`${ngrok}/${host}/auth`)
    
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
                        res.render(`${host}/web`,{
                            logs: common.handleQuery(col),
                            start:  req.query.page
                            // token: req.signedCookies.adminToken
                        })
                    })
                

            }
        })
})


module.exports = router;