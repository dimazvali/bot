// let ngrok = process.env.ngrok2 
let ngrok = process.env.ngrok;

const host = `homeless`;
const token = process.env.homelessToken;


var express =   require('express');
var router =    express.Router();
var axios =     require('axios');

const fileUpload = require('express-fileupload');

var cors =      require('cors')

var common =    require('./common');
const m =       require('./methods.js');
var QRCode =    require('qrcode')
var cron =      require('node-cron');
var FormData =  require('form-data');
var modals =    require('./modals.js').modals
const qs =      require('qs');
const fs =      require('fs');


router.use(cors())

router.use(fileUpload({
    // Configure file uploads with maximum file size 10MB
    limits: { fileSize: 10 * 1024 * 1024 },
  
    // Temporarily store uploaded files to disk, rather than buffering in memory
    useTempFiles : true,
    tempFileDir : '/tmp/'
  }));

const dummyBook = `${ngrok}/images/${host}/blank.png`


const appLink = `https://t.me/paperstuffbot/app`

const {
    objectify,
    getDoc,
    uname,
    drawDate,
    devlog,
    letterize,
    letterize2,
    shuffle,
    clearTags,
    handleQuery,
    handleDoc,
    sudden,
    cutMe,
    interpreteCallBackData,
    authTG,
    authWebApp,
} = require ('./common.js')

const {
    sendMessage2,
    getUser,
    greeting,
} = require('./methods.js')

const {
    Parser
} = require('json2csv');



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

const { getStorage, getDownloadUrl } = require('firebase-admin/storage');

const {
    getDatabase
} = require('firebase-admin/database');


var RSS = require('rss');

const { ObjectStreamToJSON } = require('sitemap');


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
    databaseURL: "https://rrspecialsapi.firebaseio.com"
}, host);

let fb = getFirestore(gcp);
let s = getStorage(gcp)


setTimeout(function(){
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/${host}/hook`).then(()=>{
        console.log(`${host} hook set on ${ngrok}`)
    }).catch(err=>{
        handleError(err)
    })   
},1000)

function handleError(err,res) {
    console.log(err);
    if(res) res.status(500).send(err.message)
}

let adminTokens =       fb.collection(`DIMAZVALIadminTokens`);

// let udb =               fb.collection(`${host}Users`);

let udb =               fb.collection(`${host}Users`);
let cities =            fb.collection(`${host}Cities`);
let events =            fb.collection(`${host}Events`);
let userTypes =         fb.collection(`${host}userTypes`);
let usersEvents =       fb.collection(`${host}UsersEvents`);
let logs =              fb.collection(`${host}Logs`);
let messages =          fb.collection(`${host}Messages`);
let news =              fb.collection(`${host}News`);
let bus =               fb.collection(`${host}Bus`);
let busTrips =          fb.collection(`${host}BusTrips`);
let settings =          fb.collection(`${host}Settings`);
let tags =              fb.collection(`${host}Tags`);
let userTags =          fb.collection(`${host}UserTags`);

let savedCities = {};

let savedUserTypes = {
    volunteer:  `волонтеры`,
    sponsor:    `партнеры`,
    media:      `журналисты`
}



let userList = udb.get().then(col=>common.handleQuery(col))


cities.where(`active`,'==',true).get().then(col=>savedCities = objectify(handleQuery(col)))

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


function sendMessage(req,res,admin){
    let t = {
        chat_id: req.body.user,
        text:   req.body.text
    }
    
    sendMessage2(t, false, token, messages,{admin: +admin.id})
    
    if(res) res.sendStatus(200);
}


const datatypes = {
    userTags:{
        col: userTags,
    },
    tags: {
        col: tags,
        newDoc: newEntity,
        extras: [`public`],
    },
    settings:{
        col: settings,
    },
    busTrips:{
        col:    busTrips,
        newDoc: addtrip
    },
    bus: {
        col:    bus,
        newDoc: addBus,
    },
    news: {
        col:    news,
        newDoc: addNews
    },
    messages:{
        col: messages,
        newDoc: sendMessage,
    },
    events:{
        col:    events,
        newDoc: newEntity,
        extras: [`media`,`volunteer`,`sponsor`,`capacity`,`date`]
    },
    cities: {
        col:    cities,
        newDoc: newEntity
    },
    users: {
        col:    udb,
    }
}

function addtrip(req,res,admin){
    if(!req.body.date) return res.json({success:false,comment:`Без даты никак.`})
    busTrips
        .where(`date`,`==`,req.body.date)
        .where(`active`,`==`,true)
        .get()
        .then(col=>{
            if(col.docs.length) return res.json({success:false,comment:`Этот день уже внесен!`})
            busTrips.add({
                createdAt:  new Date(),
                active:     true,
                admin:      +admin.id,
                date:       req.body.date,
                start:      req.body.start ||   savedSettings.defaultStartPlace.value,
                time:       req.body.time ||    savedSettings.defaultStartTime.value,
                comment:    req.body.comment || null,
                count:      +req.body.count || savedSettings.defaultBusRiders.value || 5
            }).then(rec=>{
                log({
                    text:       `${uname(admin,admin.id)} запускает рейс автобуса на ${req.body.date}`,
                    busTrip:    rec.id,
                    admin:      +admin.id
                })
                res.redirect(`/${host}/web?page=bus`)
            })
        })
}

function register2Bus(tripId,u,callback,res){
    getDoc(busTrips,tripId).then(trip=>{
        if(!trip || !trip.active) {
            
            if(callback) return sendMessage2({
                callback_query_id: callback.id,
                show_alert: true,
                text:       locals.eventCancelled
            }, 'answerCallbackQuery', token)

            return res.status(400).send(locals.eventCancelled)
        }

        if(trip.guests > (trip.count || 5)) {
            if(callback){
                return sendMessage2({
                    callback_query_id: callback.id,
                    show_alert: true,
                    text:       locals.overBooking
                }, 'answerCallbackQuery', token)
            }
            return res.status(400).send(locals.overBooking)
        }

        bus
            .where(`trip`,`==`,tripId)
            .where(`active`,`==`,true)
            .where(`user`,'==',+u.id)
            .get()
            .then(col=>{
                if(col.docs.length) {
                    if(callback){
                        return sendMessage2({
                            callback_query_id: callback.id,
                            show_alert: true,
                            text:       locals.alreadyBooked
                        }, 'answerCallbackQuery', token)
                    }
                    return res.status(400).send(locals.alreadyBooked)
                } 
                
                

                bus.add({
                    active:     true,
                    createdAt:  new Date(),
                    trip:       tripId,
                    date:       trip.date,
                    user:       +u.id
                }).then(rec=>{

                    busTrips.doc(tripId).update({
                        guests: FieldValue.increment(1)
                    })

                    log({
                        text:       `${uname(u,u.id)} записывается на рейс ${trip.date}`,
                        busTrip:    tripId,
                        bus:        rec.id,
                        user:       +u.id 
                    })

                    sendMessage2({
                        chat_id: u.id,
                        text: locals.busAccepted(trip),
                        reply_markup:{
                            inline_keyboard:[[{
                                text: `Не смогу прийти.`,
                                callback_data: `bus_leave_${rec.id}`
                            }]]
                        }
                    },false,token,messages)

                    if(res) res.json({
                        success: true,
                        id: rec.id
                    })
                })
            })
    })
}

function addBus(req,res,admin){
    
    
    if(!req.body.user)return res.status(400).send(`no user provided`)
    if(!req.body.date)return res.status(400).send(`no date provided`)
    if(!+new Date(req.body.date)) return res.status(400).send(`invalid date provided`)
    if(new Date() > new Date(req.body.date)) return res.status(400).send(`no way back`)

    getUser(req.body.user,udb).then(u=>{
        
        if(!u)          return res.json({success:false,comment: `Такого пользователя в системе нет`})
        if(!u.active)   return res.json({success:false,comment: `Пользователь заблочил бот`})
        if(u.blocked)   return res.json({success:false,comment: `Пользователь в ЧС`})

        bus
            .where(`date`,'==',req.body.date)
            .where(`user`,'==',+req.body.user)
            .where(`active`,'==',true)
            .get()
            .then(already=>{
                
                if(already.docs.length) return res.json({
                    success: false,
                    comment: `Пользователь уже записан`
                })

                bus.add({
                    active:     true,
                    createdAt:  new Date(),
                    admin:      +admin.id,
                    user:       +req.body.user,
                    date:       req.body.date,
                    trip:       req.body.trip || null
                }).then(rec=>{
                    log({
                        text:   `${uname(u,u.id)} добавлен в команду ночного автобуса на ${req.body.date}`,
                        user:   +u.id,
                        admin:  +admin.id,
                        bus:    rec.id
                    })
                    sendMessage2({
                        chat_id: u.id,
                        text: locals.busAccepted({
                            date:req.body.date
                        }),
                        reply_markup: {
                            inline_keyboard:[[{
                                text: `Не смогу прийти.`,
                                callback_data: `bus_leave_${rec.id}`
                            }]]
                        }
                    },false,token,messages)
                    res.json({success:true})
                })
            })
    })
    
}

function sendNews(req,res,col, admin){
    news.add({
        active:     true,
        createdAt:  new Date(),
        createdBy:  +admin.id,
        text:       req.body.text,
        name:       req.body.name,
        audience:   col.length
    }).then(rec=>{
        
        res.json({
            success:    true,
            id:         rec.id,
            comment:    `Рассылка создана и расходится на ${col.length} пользователей.`
        })
        
        log({
            silent: true,
            text:  `${uname(admin,admin.id)} стартует рассылку с названием «${req.body.name}».`,
            admin: +admin.id
        })

        col
            .forEach((u,i)=>{
            setTimeout(()=>{
                if(req.body.app){
                    m.sendMessage2({
                        chat_id:    u.user || u.id,
                        text:       req.body.text,
                        parse_mode: `HTML`,
                        reply_markup:{
                            inline_keyboard:[[{
                                text: req.body.app.text,
                                web_app:{
                                    url: `${ngrok}/${host}/app?startapp=${req.body.app.link}`
                                }
                            }]]
                        },
                        protect_content:        req.body.safe?true:false,
                        disable_notification:   req.body.silent?true:false,
                    },false,token,messages)
                } else if(!req.body.media || !req.body.media.length){
                    m.sendMessage2({
                        chat_id:    u.user || u.id,
                        text:       req.body.text,
                        parse_mode: `HTML`,
                        protect_content:        req.body.safe?true:false,
                        disable_notification:   req.body.silent?true:false,
                    },false,token,messages)
                } else if(req.body.media && req.body.media.length == 1) {
                    m.sendMessage2({
                        chat_id:        u.user || u.id,
                        caption:        req.body.text,
                        parse_mode:     `HTML`,
                        photo:          req.body.media[0],
                        protect_content: req.body.safe?true:false,
                        disable_notification: req.body.silent?true:false,
                    },`sendPhoto`,token,messages)
                } else if(req.body.media){
                    m.sendMessage2({
                        chat_id:        u.user || u.id,
                        caption:        req.body.text,
                        parse_mode:     `HTML`,
                        media:          req.body.media.map((p,i)=>{
                            return {
                                type:       `photo`,
                                media:      p,
                                caption:    i?'':req.body.text
                            }
                        }),
                        protect_content: req.body.safe?true:false,
                        disable_notification: req.body.silent?true:false,
                    },`sendMediaGroup`,token,messages)
                }
            },i*200)
        })
    })
}

function addNews(req,res,admin){
    if(!req.body.name || !req.body.text) return res.sendStatus(400)
                            
        let q = udb
            .where(`active`,'==',true)
            .where(`blocked`,'==',false)

        if(req.body.filter && req.body.filter != 'all' && req.body.filter != 'tagged'  && req.body.filter != 'trip' && req.body.filter != 'event'){
            q = q.where(req.body.filter,'==',true)
        }

        if(req.body.filter && req.body.filter == `tagged`){
            q = userTags
                .where(`active`,'==',true)
                .where(`tag`,'==',req.body.tag)
        }

        if(req.body.filter && req.body.filter == `trip`){
            q = bus
                .where(`active`,'==',true)
                .where(`trip`,'==',req.body.trip)
        }

        if(req.body.filter == `event`){
            getDoc(events,req.body.event).then(e=>{
                q.get().then(col=>{
                    let audience = handleQuery(col)
                    let filter = [];
                        if(e.media)     filter.push(`media`)
                        if(e.volunteer) filter.push(`volunteer`) 
                        if(e.sponsor)   filter.push(`sponsor`)
                        if(e.tgAdmin)   filter.push(`tgAdmin`)
                    if(filter.length){
                        audience = audience.filter(u => {
                            let passed = false;
                            filter.forEach(t=>{
                                if(u[t]) passed = true;
                            })
                            return passed;
                        })
                    }
                    sendNews(req,res,audience,admin)
                })
            })
        } else {
            return q.get()
            .then(col=>{
                sendNews(req,res,handleQuery(col),admin)                
            })
        }

        
}

function newEntity(req,res,admin,extra){
    
    if(!req.body.name) return res.status(400).send(`no name`)
    
    let o = {
        createdAt:      new Date(),
        createdBy:      +admin.id,
        active:         true,
        description:    req.body.description || null,
        name:           req.body.name || null,
        pic:            req.body.pic || null,
    }
    

    if(extra) extra.forEach(t=>{
        o[t] = (+req.body[t] ? +req.body[t] : req.body[t]) || null;
        if(t == `date` && req.body[t]) o[t] = new Date(req.body[t])
    })

    datatypes[req.params.method].col.add(o).then(rec=>{
        
        res.redirect(`/${host}/web?page=${req.params.method}_${rec.id}`)

        if(req.files && req.files.cover){
            let sampleFile = req.files.cover;
                let uploadPath = __dirname + '/../public/images/'+host+'/' + sampleFile.name
                
                sampleFile.mv(uploadPath, function(err) {
                
                    if (err) return res.status(500).send(err);
                    

                    s.bucket(`dimazvalimisc`)
                        .upload(uploadPath)
                        .then(()=>{
                            s.bucket(`dimazvalimisc`).file(sampleFile.name).getSignedUrl({
                                action: `read`,
                                expires: '03-09-2491'
                            }).then(link=>{
                                datatypes[req.params.method].col.doc(rec.id).update({
                                    pic: link[0]
                                })
                                fs.unlinkSync(uploadPath)

                            })
                        })
                        .catch(err=>{
                            console.log(err)
                        })
                
                });
        }   

        log({
            admin:      +admin.id,
            [req.params.method]:      rec.id,
            text:       `${uname(admin,admin.id)} создает ${req.params.method} ${req.body.name}`
        })
    })
}

function isoDate(){
    return new Date().toISOString().split('T')[0]
}


router.all(`/api/:method/:id`,(req,res)=>{
    
    if (!req.signedCookies.userToken) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(req.signedCookies.userToken).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(user=>{

            if(!user) return res.sendStatus(403)

            devlog(user)

            switch(req.params.method){

                case `userTags`:{
                    
                    if(+user.id != +req.params.id) return res.sendStatus(403)

                    
                    return getDoc(tags,req.body.attr).then(tag=>{
                        if(!tag || !tag.active) return res.sendStatus(404)
                        
                        userTags
                            .where(`tag`,`==`,req.body.attr)
                            .where(`user`,`==`,+req.params.id)
                            .where(`active`,'==',true)
                            .get()
                            .then(col=>{
                                
                                let already = handleQuery(col);
                                
                                if(req.body.value){
                                    if(already.length) return res.status(400).send(`уже записано`)
                                    userTags.add({
                                        tag:        req.body.attr,
                                        createdAt:  new Date(),
                                        user:       +user.id,
                                        active:     true,
                                        name:       tag.name
                                    }).then(r=>{
                                        tags.doc(tag.id).update({
                                            users: FieldValue.increment(1)
                                        })
                                        res.json({
                                            success: true,
                                            comment: `Спасибо!`
                                        })
                                        log({
                                            silent: true,
                                            tag: tag.id,
                                            user: +user.id,
                                            text: `${uname(user,user.id)} добавляет себе тег ${tag.name}`
                                        })
                                    })
                                } else {
                                    if(!already.length) return res.status(400).send(`нечего удалять...`)
                                    already.forEach(record=>{
                                        userTags.doc(record.id).update({
                                            active: false
                                        })
                                        tags.doc(tag.id).update({
                                            users: FieldValue.increment(-1)
                                        })
                                        log({
                                            silent: true,
                                            tag: tag.id,
                                            user: +user.id,
                                            text: `${uname(user,user.id)} снимает тег ${tag.name}`
                                        })
                                    })
                                    res.json({
                                        success: true,
                                        comment: `Спасибо!`
                                    })
                                }
                            })

                        
                    })
                }
                case `profile`:{
                    switch (req.method){
                        case `PUT`:{
                            let possible = {
                                volunteer:  `волонтер`,
                                media:      `медиа`,
                                news:       `новости`
                            }
                            if(possible[req.body.attr]){
                                return udb.doc(user.id).update({
                                    [req.body.attr]:req.body.value  
                                }).then(()=>{
                                    res.sendStatus(200)
                                    
                                    log({
                                        user: +user.id,
                                        text: `${uname(user,user.id)} обновляет профиль: ${possible[req.body.attr]} становится ${req.body.value}.`
                                    })
                                })
                            }
                             
                        }
                    }
                }
                case `bus`:{
                    let ref = bus.doc(req.params.id);
                    return getDoc(bus,req.params.id).then(ride=>{
                        if(!ride) return res.sendStatus(404);
                        switch (req.method){
                            case `GET`:{
                                return getDoc(busTrips,ride.trip).then(trip=>{
                                    res.json({
                                        ride: ride,
                                        trip: trip
                                    })
                                })
                            }
                            case `DELETE`:{
                                if(!ride.active) return res.status(400).send(`Запись уже отменена`);
                                return ref.update({
                                    active: false,
                                }).then(()=>{
                                    busTrips.doc(ride.trip).update({
                                        guests: FieldValue.increment(-1)
                                    })
                                    log({
                                        bus: req.params.id,
                                        busTrip: ride.trip,
                                        user: +user.id,
                                        text: `${uname(user,user.id)} снимается с рейса ${ride.date}`
                                    })
                                    res.json({
                                        success: true
                                    })
                                })
                            }
                        }
                    })
                    
                }
                case `usersEvents`:{
                    let ref = usersEvents.doc(req.params.id);
                    return getDoc(usersEvents,req.params.id).then(e=>{
                        if(!e || !e.active) res.sendStatus(404);
                        if(+user.id != e.user) res.sendStatus(401)
                        ref.update({
                            active: false
                        }).then(()=>{
                            events.doc(e.event).update({
                                guests: FieldValue.increment(-1)
                            })
                            res.json({
                                success: true,
                                comment: `Очень жаль. До новых встреч!`
                            })
                            log({
                                silent: true,
                                text: `${uname(user,user.id)} отказывается от места на мероприятии ${e.eventName}.`,
                                event: req.params.id,
                                user: +user.id
                            })
                        })
                    })
                }
                case `events`:{
                    return getDoc(events,req.params.id).then(e=>{
                        if(!e || !e.active) return res.sendStatus(404)
                        usersEvents
                            .where(`user`,  '==',+user.id)
                            .where(`active`,'==',true)
                            .where(`event`, '==',req.params.id)
                            .get()
                            .then(col=>{
                                col = handleQuery(col)
                                e.ticket = col[0] ? col[0].id : false,
                                res.json(e) 
                            })
                    })
                }
            }
        })
    })
})

router.all(`/api/:method`,(req,res)=>{
    
    if (!req.signedCookies.userToken) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(req.signedCookies.userToken).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(user=>{

            if(!user) return res.sendStatus(403)

            devlog(user)

            switch(req.params.method){

                case `userTags`:{
                    return userTags
                        .where(`user`,`==`,+user.id)
                        .where(`active`,'==',true)
                        .get()
                        .then(col=>{
                            res.json(handleQuery(col))
                        })
                }
                
                case `tags`:{
                    let data = []
                    data.push(tags
                        .where(`public`,'==',true)
                        .where(`active`,'==',true)
                        .get()
                        .then(col=>{
                            return handleQuery(col, false, true)
                        })
                    )

                    data.push(userTags
                        .where(`user`,'==',+user.id)
                        .where(`active`,'==',true)
                        .get()
                        .then(col=>{
                            return handleQuery(col, false, true)
                        })
                    )
                    return Promise.all(data).then(data=>{
                        res.json({
                            tags:       data[0],
                            userTags:   data[1]
                        })
                    })
                }

                case `profile`:{
                    return res.json(user);
                }
                case `trips`:{
                    switch(req.method){
                        case `GET`:{
                            return busTrips
                                .where(`date`,`>=`,isoDate())
                                // .where(`active`,'==',true)
                                .get()
                                .then(col=>{
                                    res.json(handleQuery(col).filter(a=>a.active))
                                })
                        }
                        case `POST`:{
                            if(!req.body.trip) return res.sendStatus(400)
                            return register2Bus(req.body.trip, user, false, res)
                        }
                    }
                }

                case `events`:{
                    return events
                        .where(`date`,`>=`,new Date())
                        .get()
                        .then(col=>{
                            
                            let events = handleQuery(col)
                                .filter(e=>e.active)
                                .filter(e=>{
                                    let filter = [];
                                        if(e.media)     filter.push(`media`)
                                        if(e.volunteer) filter.push(`volunteer`) 
                                        if(e.sponsor)   filter.push(`sponsor`)
                                        if(e.tgAdmin)   filter.push(`tgAdmin`)
                                    let passed = false;
                                    
                                    if(!filter.length) {
                                        return true;
                                    } else {
                                        filter.forEach(type=>{
                                            if(user[type]) passed = true;
                                        })
                                        return passed;
                                    }
                                })
                            

                            res.json(events)
                        })
                }

                case `usersEvents`:{
                    switch(req.method){
                        case `GET`:{
                            return usersEvents
                                .where(`user`,`==`,+user.id)
                                .get()
                                .then(col=>{
                                    res.json(handleQuery(col).filter(r=>r.active))
                                })
                        }
                        case `POST`:{
                            if(!req.body.event) return res.status(400).send(`no event provided`)
                            return getDoc(events, req.body.event)
                                .then(e=>{
                                    if(!e || !e.active) return res.status(404).send(`no such event`)
                                    if(e.capacity && e.capacity <= e.guests) return res.status(400).send(`Извините, но свободных мест больше нет.`)
                                    usersEvents
                                        .where(`event`,'==',e.id)
                                        .where(`active`,'==',true)
                                        .where(`user`,'==',+user.id)
                                        .get()
                                        .then(col=>{
                                            if(col.docs[0]) return res.status(400).send(`Извините, но вы уже зарегистрированы.`)
                                            usersEvents.add({
                                                createdAt:  new Date(),
                                                event:      e.id,
                                                user:       +user.id,
                                                eventName:  e.name,
                                                date:       e.date,
                                                active: true
                                            }).then(rec=>{
                                                res.json({
                                                    success:    true,
                                                    id:         rec.id,
                                                    comment:    `Спасибо и до скорой встречи!`
                                                })
                                                log({
                                                    silent: true,
                                                    text:   `${uname(user,user.id)} регистрируется на мероприятие ${e.name}.`,
                                                    event:  req.body.event,
                                                    user:   +user.id
                                                })
                                            }).catch(err=>handleError(err,res))
                                        })
                                        
                                })
                        }
                    }
                }
                case `bus`:{
                    switch(req.method){
                        case `GET`:{
                            return bus
                                .where(`user`,`==`,+user.id)
                                .get()
                                .then(col=>{
                                    // col
                                    res.json(handleQuery(col).filter(r=>r.active).filter(t=>t.date>isoDate()))
                                })
                        }
                    }
                }
            }
        })
    })
})

router.all(`/admin/:method`,(req,res)=>{
    
    let token = req.signedCookies.adminToken || req.signedCookies.userToken;

    if (!token) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(token).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(admin=>{

            if(!admin) return res.sendStatus(403)

            devlog(admin)

            switch(req.params.method){



                case `userSearch`:{
                    if(!req.query.name) return res.sendStatus(400)
                    return Promise.resolve(userList).then(userList=>{
                        res.json(userList.filter(u=>u.username && !u.username.indexOf(req.query.name)))
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
                    
                    if(req.method == `POST`)    return datatypes[req.params.method].newDoc(req,res,admin,datatypes[req.params.method].extras)
                    
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
                
                case `userTags`:{
                    switch(req.method){
                        case `GET`:{
                            return userTags
                                .where(`user`,'==',+req.params.id)
                                .where(`active`,'==',true)
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
    
                                    userTags
                                        .where(`user`,'==',+req.params.id)
                                        .where(`tag`,'==',req.body.tag)
                                        .where(`active`,'==',true)
                                        .get()
                                        .then(already=>{
                                            
                                            if(common.handleQuery(already).length) return res.status(400).send(`tag is already set`)
                                            
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
                                        text:   `${uname(admin,admin.id)} снимает тег ${t.name} пользователю с id ${t.user}`,
                                        admin:  +admin.id,
                                        tag:    t.tag,
                                        user:   +t.user
                                    })
                                })
                            })
                        }
                    }
                }

                case `images`: {
                    return axios.post(`https://api.telegram.org/bot${process.env.homelessToken}/getFile`, {
                        file_id: req.params.id
                    }).then(s => {
                        res.json({
                            src: `https://api.telegram.org/file/bot${process.env.homelessToken}/${s.data.result.file_path}`
                        })
                    })
                }

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
        
        let data = common.handleDoc(e)

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



router.get(`/auth`,(req,res)=>{
    res.render(`${host}/auth`)
})

router.post(`/authWebApp`,(req,res)=>{
    authWebApp(req,res,token,adminTokens,udb)
})

router.post(`/auth`,(req,res)=>{
    authTG(req,res,token,adminTokens,udb)
})


router.get(`/app`,(req,res)=>{
    if(req.signedCookies.userToken){
        getDoc(adminTokens,req.signedCookies.userToken).then(proof=>{
            if(!proof) res.render(`${host}/app`,{
                authNeeded: true,
                start: req.query.startapp,
            })
            getUser(proof.user,udb).then(u=>{
                res.render(`${host}/app`,{
                    user: u,
                    start: req.query.startapp,
                })
            })
        })
        
    } else {
        res.render(`${host}/app`,{
            authNeeded: true,
            start: req.query.startapp,
        })
    }
    
})


router.get(`/web`,(req,res)=>{
    
    devlog(req.signedCookies.adminToken)

    if(!(process.env.develop == `true`) && !req.signedCookies.adminToken) return res.redirect(`${process.env.ngrok}/${host}/auth`)
    
    getDoc(adminTokens, (req.signedCookies.adminToken || process.env.adminToken)).then(t=>{

        devlog(t)

        // if(!req.signedCookies.adminToken && (process.env.develop == `true`)) return res.cookie('adminToken', req.query.adminToken || process.env.adminToken, {
        //     maxAge: 24 * 60 * 60 * 1000,
        //     signed: true,
        //     httpOnly: true,
        // })

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
                        cities:     savedCities,
                        settings:   savedSettings
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
                        logs:       handleQuery(col),
                        cities:     savedCities,
                        settings:   savedSettings
                    })
                })

        })

    })
})


function composeEventDescription(event){
    let txt = `*${event.name}*\n${drawDate(event.date._seconds*1000)}\n\n${cutMe(event.description,800)}`
    if(event.capacity){
        if(event.guests) {
            let delta = event.capacity-event.guests
            if(delta>0){
                txt+=`\n\nМы готовы принять еще ${delta} человек.`
            } else {
                txt+=`\n\nСвободных мест больше нет.`
            }
            
        }
    }
    return txt;
}


function acbq(req,text){
    sendMessage2({
        callback_query_id: req.body.callback_query.id,
        show_alert: true,
        text:       text,
    }, 'answerCallbackQuery', token)
}


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
                    case `/test`:{
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
                    }
                    case `/bus`:{
                        return busTrips
                            .where(`date`,'>=',new Date().toISOString().split('T')[0])
                            .get()
                            .then(col=>{
                                let trips = handleQuery(col)
                                    .filter(t=>t.active && (!t.guests || t.guests < 6))
                                    .sort((a,b)=>b<a?-1:1)
                                
                                if(!trips.length) return sendMessage2({
                                    chat_id:    u.id,
                                    text:       locals.nothingYet
                                },false,token,messages)

                                sendMessage2({
                                    chat_id:    u.id,
                                    text:       locals.futureEvents,
                                    reply_markup:{
                                        inline_keyboard:trips.map(t=>{
                                            return [{
                                                text: `${t.date} ${t.time}`,
                                                callback_data: `bus_join_${t.id}`
                                            }]
                                        })
                                    }
                                },false,token,messages)
                            })
                    }
                    case `/settings`:{
                        return sendMessage2({
                            chat_id:    +u.id,
                            text:       locals.settingsDescription,
                            reply_markup: {
                                inline_keyboard:[[{
                                    text: `Город`,
                                    callback_data: `userSettings_city`
                                }],[{
                                    text: `Подписки`,
                                    callback_data: `userSettings_subscriptions`
                                }],[{
                                    text: `Языки`,
                                    callback_data: `userSettings_languages`
                                }],]
                            }
                        }, false, token, messages)
                    }

                    case `/events`:{
                        return events
                            .where(`date`,`>=`,new Date())
                            // .where(`active`,'==',true)
                            .get()
                            .then(col=>{
                                let events = handleQuery(col).filter(e=>e.active)
                                
                                Object.keys(savedUserTypes).forEach(type=>{
                                    if(u[type]) events = events.filter(e=>e[type])
                                })

                                if(events.length){
                                    sendMessage2({
                                        chat_id: u.id,
                                        text: locals.futureEvents,
                                        reply_markup:{
                                            inline_keyboard:events.map(e=>{
                                                return [{
                                                    text: `${drawDate(e.date._seconds*1000)} ${e.name}.`,
                                                    callback_data: `event_${e.id}_show`
                                                }]
                                            })
                                        }
                                    },false,token,messages)
                                } else {
                                    sendMessage2({
                                        chat_id: u.id,
                                        text: locals.nothingYet
                                    },false,token,messages)
                                }

                            })
                    }

                    default:
                        if(!req.body.message.text.indexOf(`/start`)){
                            let inc = req.body.message.text.split(' ');
                            if(inc[1]){
                                inc = inc[1].split('_');
                                if(inc[0] == `offer`){
                                    getDoc(offers,inc[1]).then(o=>{
                                        getDoc(books,o.book).then(b=>{
                                            sendOffer(b,o,req.body.message.from)
                                        })
                                    })
                                    
                                }
                            }
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

    if (req.body.callback_query) {
        
        user = req.body.callback_query.from;

        let userRef = udb.doc(user.id.toString())
        
        let inc = req.body.callback_query.data.split('_')

        // if(req.body.callback_query.chat_instance) sendMessage2({
        //     chat_id: req.body.callback_query.chat_instance,
        //     text: `some letters`
        // },false,token)

        getUser(user.id,udb).then(u=>{

            if(!u) sendMessage2({
                callback_query_id: req.body.callback_query.id,
                show_alert: true,
                text:       `Извините, мы вас пока не знаем...`
            }, 'answerCallbackQuery', token)

            // TBD: проверка блокировки

            let userLogName = uname(u||user, u ? u.id : user.id)

            switch(inc[0]){
                case `bus`:{
                    switch(inc[1]){
                        case `join`:{
                            return register2Bus(inc[2], u, req.body.callback_query)
                            
                        }
                        case `leave`:{
                            return getDoc(bus,inc[2]).then(busRecord=>{
                                if(!busRecord || !busRecord.active) return acbq(req,`Запись уже отменена`)

                                bus.doc(inc[2]).update({
                                    active: false
                                }).then(()=>{
                                    if(busRecord.trip) busTrips.doc(busRecord.trip).update({
                                        guests: FieldValue.increment(-1)
                                    })

                                    log({
                                        text:       `${uname(u,u.id)} снимается с рейса ${busRecord.date}`,
                                        busTrip:    busRecord.trip || null,
                                        bus:        inc[2],
                                        user:       +u.id 
                                    })
                                    
                                    acbq(req,`Запись отменена`)
                                })

                            })
                        }
                    }
                }
                case `event`:{
                    let eventRef = events.doc(inc[1])
                    return getDoc(events,inc[1]).then(event=>{

                        if(!event.active) return sendMessage2({
                            callback_query_id: req.body.callback_query.id,
                            show_alert: true,
                            text:       locals.eventCancelled
                        }, 'answerCallbackQuery', token)


                        usersEvents
                            .where(`event`,'==',inc[1])
                            .where(`user`,'==',+u.id)
                            .where(`active`,'==',true)
                            .get()
                            .then(col=>{
                                let reserve = col.docs[0] ? col.docs[0].id : false;
                                if(inc[2] == `show`){

                                    sendMessage2({
                                        chat_id:    u.id,
                                        text:       composeEventDescription(event),
                                        caption:    composeEventDescription(event),
                                        parse_mode: `Markdown`,
                                        photo:      event.pic||null,
                                        reply_markup: event.capacity ? {
                                            inline_keyboard:[[{
                                                text: reserve ? `Не приду` : `Записаться`,
                                                callback_data: reserve ? `event_${inc[1]}_leave_${reserve}` : `event_${inc[1]}_join`
                                            }]]
                                        } : null
                                    },(event.pic? `sendPhoto` :false),token,messages)
                                }
        
                                if(inc[2] == `join`){

                                    if(reserve) return sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        show_alert: true,
                                        text:       locals.alreadyBooked
                                    }, 'answerCallbackQuery', token)

                                    usersEvents.add({
                                        active: true,
                                        event:  inc[1],
                                        user:   +u.id
                                    }).then(rec=>{
                                        log({
                                            text: `${uname(u,u.id)} регистрируется на мероприятие ${event.name}`,
                                            user: +u.id,
                                            event: event.id,
                                            userEvent: rec.id
                                        })
                                        eventRef.update({
                                            guests: FieldValue.increment(1)
                                        })
                                        sendMessage2({
                                            chat_id: u.id,
                                            text:   locals.eventEntered(event),
                                            reply_markup:{
                                                inline_keyboard:[[{
                                                    text: `Снять запись`,
                                                    callback_data: `event_${inc[1]}_leave_${rec.id}`
                                                }]]
                                            }
                                        },false,token)
                                    })
                                }
        
                                if(inc[2] == `leave`){

                                    if(reserve) return usersEvents.doc(reserve).update({
                                        active: false
                                    }).then(()=>{
                                        acbq(req,`Спасибо, ваша запись снята`)
                                        
                                        eventRef.update({
                                            guests: FieldValue.increment(-1)
                                        })

                                        log({
                                            text:       `${uname(u,u.id)} снимает запись на мероприятие ${event.name}`,
                                            user:       +u.id,
                                            event:      event.id,
                                            userEvent:  reserve
                                        })
                                    })
                                }
                            })

                        
                    })
                }
                case `userSettings`:{
                    switch(inc[1]){
                        case `city`:{
                            return sendMessage2({
                                chat_id: user.id,
                                text: `Хорошо там, где мы есть:`,
                                reply_markup:{
                                    inline_keyboard: Object.keys(savedCities).map(c=>{
                                        return [{
                                            text: `${u.city == c ?  `✔️` : `❌`} ${savedCities[c].name} (${savedCities[c].currency})`,
                                            callback_data: `user_city_${c}`
                                        }]
                                    })
                                }
                            },false,token,messages)
                        }
                        case `subscriptions`:{
                            return sendMessage2({
                                chat_id: user.id,
                                text: `Пока что у нас есть только один вид подписки: на все новые книги в нужном вам городе на знакомых вам языках.`,
                                reply_markup:{
                                    inline_keyboard:[
                                        [{
                                            text: `Включить`,
                                            callback_data: `user_noSpam_false`
                                        }],
                                        [{
                                            text: `Выключить`,
                                            callback_data: `user_noSpam_true`
                                        }],
                                    ]
                                }
                            },false,token,messages)
                        }
                        case `languages`:{
                            return sendMessage2({
                                chat_id: user.id,
                                text:   `Больше не меньше...`,
                                reply_markup:{
                                    inline_keyboard:langs.map(l=>{
                                        return [{
                                            text: `${u[l.id] ?  `✔️` : `❌`} ${l.name}`,
                                            callback_data: `user_${l.id}_${u[l.id]?false:true}`
                                        }]
                                    })
                                }
                            },false,token,messages)
                        }
                    }
                }
                case `user`:{

                    if(inc[1] == `toggle`){
                        return userRef.update({
                            [inc[2]]: !u[inc[2]]
                        }).then(()=>{
                            getUser(u.id, udb).then(u=>{
                                sendMessage2({
                                    chat_id:    +user.id,
                                    message_id: req.body.callback_query.message.message_id,
                                    reply_markup:{
                                        inline_keyboard: [
                                            [{
                                                text: `${u.volunteer ? `✔️` : `❌`} Волонтером`,
                                                callback_data: `user_toggle_volunteer`
                                            }],
                                            [{
                                                text: `${u.media ? `✔️` : `❌`} Журналистом`,
                                                callback_data: `user_toggle_media`
                                            }],
                                            // [{
                                            //     text: `${u.sponsor ? `✔️` : `❌`} Меценатом`,
                                            //     callback_data: `user_toggle_sponsor`
                                            // }],
                                        ]
                                    }
                                },`editMessageReplyMarkup`,token)
                            })
                            
                        })
                    } else {
                        return userRef.update({
                            [inc[1]]: interpreteCallBackData(inc[2])
                        }).then(upd=>{
                            log({
                                user:   +user.id,
                                silent: true,
                                text:   `${userLogName} обновляет профиль: ${inc[1]} становится ${inc[2]}`
                            })
                            sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text:       locals.updateSuccess
                            }, 'answerCallbackQuery', token)
    
                            if(langs.map(l=>l.id).indexOf(inc[1])>-1){
                                getUser(user.id, udb).then(u=>{
                                    sendMessage2({
                                        chat_id:    +user.id,
                                        message_id: req.body.callback_query.message.message_id,
                                        reply_markup:{
                                            inline_keyboard: langs.map(l=>{
                                                return [{
                                                    text: `${u[l.id] ? `✔️` : `❌`} ${l.name}`,
                                                    callback_data: `user_${l.id}_${u[l.id]?false:true}`
                                                }]
                                            })
                                        }
                                    },`editMessageReplyMarkup`,token,messages)
                                })
                                
                            }
    
                            if(inc[1] == `city`) sendMessage2({
                                chat_id:    +user.id,
                                text:       `Что дальше? Пока сайт находися в разработке, вы можете воспользоваться поиском непосредственно в боте (для этого отправьте мне /offers — или введите @shelfCareBot и название книги через пробел).\nВы также можете добавить свои книги: выставить их на продажу, в подарок или в режиме "Дам почитать". Для этого вам понадобится перейти в [админку](https://dimazvali-a43369e5165f.herokuapp.com/books/auth).\nПолный список доступных команд доступен в меню.`,
                                parse_mode: `Markdown`,
                            },false,token,messages)
                        }).catch(err=>{
                            console.log(err)
                        })
                    }

                    
                }
                default:{
                    sendMessage2({
                        callback_query_id: req.body.callback_query.id,
                        show_alert: true,
                        text:       locals.commandUnknown
                    }, 'answerCallbackQuery', token)
                }
            }
        })

        
    }

    if (req.body.inline_query){
        let q = req.body.inline_query;
        if(q.query){
            getUser(q.from.id,udb).then(u=>{
                offers.where(`active`,'==',true).get().then(col=>{
                    let line = handleQuery(col,false,true);
                    if(u && u.city) line = line.filter(b=>b.city == u.city);
                    line = line.filter(b=>b.bookName.toLowerCase().indexOf(q.query.toLowerCase())>-1)
                    sendMessage2({
                        inline_query_id: q.id,
                        results: line.map(b=>{
                            return {
                                type: `article`,
                                id: b.id,
                                title: b.bookName,
                                description: b.description || 'некое описание',
                                thumbnail_url: b.bookPic ? (typeof b.bookPic == `object` ? b.bookPic[0] : b.bookPic) :dummyBook,
                                input_message_content:{
                                    message_text: b.bookName
                                },
                                reply_markup:{
                                    inline_keyboard: [[{
                                        text: `Подробнее`,
                                        callback_data: `offer_${b.id}_view`    
                                    }]]
                                }
                                // start_parameter: `offer_${b.id}_view`
                            }
                        })
                    },`answerInlineQuery`,token)
                })
            })
        }
    }
})


function getAvatar(id){
    return axios.post('https://api.telegram.org/bot' + token + '/getUserProfilePhotos', {
        user_id: id || common.dimazvali
    }, {headers: {'Content-Type': 'application/json'}
    }).then(d=>{
        return d.data
        console.log(d.data)
    }).catch(err=>{
        console.log(err)
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

        userList.push(u);

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



const locals = {
    overBooking:    `${sudden.sad()}! Места уже закончились...`,
    busAccepted: (b) => `${sudden.fine()}! Вы записаны в команду ночного автобуса. До встречи ${b.date}.`,
    eventEntered:(e)=> `${sudden.fine()}! Вы записались на мероприятие ${e.name}. До встречи!`,
    alreadyBooked:  `Вы уже записаны.`,
    eventCancelled: `${sudden.sad()}, это меропрятие отменено`,
    futureEvents:   `Посмотрим, что у нас есть...`,
    nothingYet:     `Кажется, для вас ничего нет...`,
    greetings:      `${greeting()}! Тут должен быть текст приветствия, который можно будет настроить через админку. А пока что укажите, кем вы захотели стать, когда выросли:`,

    settingsDescription:    `Что именно вам хотелось бы изменить?..`,
    subscriptionDisclaimer: `\nВы получили это сообщение, так как подписаны на все новинки в своем городе. Чтобы отписаться, нажмите последнюю кнопку под сообщением.`,
    noBooksAvailable: `${sudden.sad()}! Кажется, в вашем городе нет доступных книг. Может быть, вы сможете добавить парочку?..`,
    dealConfirmed2Buyer:(d,s)=>     `${sudden.fine()}! Книга «${d.bookName}» без малого ваша. А вот ее хозяин: [@${s.username||s.first_name||s.last_name}](tg://user?id=${s.id})`,
    rentConfirmed2Seller:(d,s)=>    `${sudden.fine()}! А вот и человек, который хотел бы получить книгу «${d.bookName}»: [@${s.username||s.first_name||s.last_name}](tg://user?id=${s.id})`,
    rentCancelledByOwner: (d) =>    `${sudden.sad()}! Хозяин книги «${d.bookName}» не сможет ей поделиться. Такое бывает. Давайте найдем что-нибудь еще?..`,
    rentCancelled:(d)=>             `${sudden.sad()}! Запрос на книгу «${d.bookName}» был отменен.`,
    afterCancel:    `Ваш запрос отменен`,
    tooLate:        `Извинте, уже не получится`,
    dealNotActive:  `Этот запрос уже закрыт. Вы не можете его обновить.`,
    noDeal:         `Очень странные дела... Нет такой записи...`,
    alreadyRented:  `Вы уже взяли эту книгу. Оставьте ее в покое.`,
    cantBuyYourSelf: `Простите, но это ваша собственная книга.`,
    rentRequest: (o)=>              `${sudden.fine()}! Кто-то хочет взять почитать ваше издание «${o.bookName}».\nНажмите «Согласиться» — и мы свяжем вас напрямую.\nЕсли вы не можете им поделиться — не беда. Нажмите «Вежливый отказ». Мы все передадим (и снимем издание с полки).`,
    rentRequestSent:(o)=>           `Отличный выбор! Ваш запрос на книгу «${o.bookName}» отправлен владельцу. После подтверждения мы свяжем вас напрямую.`,
    offerBlocked:   `${sudden.sad()}! Эту книгу сейчас читают...`,
    
    updateSuccess:  `Настройки обновлены.`,
    noCityProvided: `Извините, но вы все еще не указали свой город. Давайте исправим это:`,
    catalogue:      `Присмотримся...`,
    commandUnknown: `Извините, я еще не выучил такую команду`,
    noOffer:        `${sudden.sad()}! Это предложение уже недоступно...`
}

let savedSettings = {
    defaultStartPlace: {value:`Дворцовая площадь, 1`},
    defaultStartTime: {value:`18:45`},
    defaultGreetings: {value:locals.greetings}
}


settings.get().then(col=>{
    savedSettings = objectify(handleQuery(col))
})


module.exports = router;