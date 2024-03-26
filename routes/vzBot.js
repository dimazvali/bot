
const host = 'vz';
var express = require('express');
var router = express.Router();
var axios = require('axios');
var cors = require('cors')
var sha256 = require('sha256');
var common = require('./common.js');
const m = require('./methods.js');
var QRCode = require('qrcode')
var cron = require('node-cron');
var FormData = require('form-data');
var modals = require('./modals.js').modals
const qs = require('qs');
var uname = require('./common.js').uname;
var drawDate = require('./common.js').drawDate;
const {
    createHash,
    createHmac,
    subtle
} = require('node:crypto');

// const ngrok = 'https://a751-109-172-156-240.ngrok-free.app'
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

const {
    sendMessage2
} = require('./methods.js')

const {
    devlog,
    handleDoc,
    handleQuery,
    handleError,
} = require('./common.js')



router.get(`/test`,(req,res)=>{
    res.sendStatus(200)
    // tick()
    daySteps.doc(req.query.step).get().then(d=>{
        sendStep(d.data(),req.query.user||common.dimazvali)
    })
    
})

if (!process.env.develop) {
    cron.schedule(`0,30 * * * *`, () => {
        tick()
    })

    cron.schedule(`0 10 * * *`, () => {
        closeTemp()
    })
}

let gcp = initializeApp({
    credential: cert({
        "type": "service_account",
        "project_id": "vmestezdoroveeru",
        "private_key_id": process.env.vzKeyId,
        "private_key": process.env.vzKey.replace(/\\n/g, '\n'),
        "client_email": "firebase-adminsdk-nczte@vmestezdoroveeru.iam.gserviceaccount.com",
        "client_id": "110699901835472042312",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-nczte%40vmestezdoroveeru.iam.gserviceaccount.com",
        "universe_domain": "googleapis.com"
      }),
    databaseURL: "https://vmestezdoroveeru.firebaseio.com"
}, 'vz');

let fb = getFirestore(gcp);


let token =         process.env.vzToken;
let udb =           fb.collection('users');
let messages =      fb.collection('userMessages');
let logs =          fb.collection('logs');
let tokens =        fb.collection('tokens');
let adminTokens =   fb.collection('adminTokens');
let courses =       fb.collection('courses');
let usersCourses =  fb.collection('usersCourses');
let steps =         fb.collection('steps');
let streams =       fb.collection('streams');
let courseDays =    fb.collection(`courseDays`);
let daySteps =      fb.collection(`daySteps`);
let streamUsers =   fb.collection(`streamUsers`);
let recipies =      fb.collection(`recipies`);
let articles =      fb.collection(`articles`);
let promos =        fb.collection(`promos`);
let promoUsers =    fb.collection(`promoUsers`);
let invoices =      fb.collection(`invoices`);



const locals = {
    greetings:          `От лица нашей семьи, рады вам представить наш авторский курс для естественного восстановления здоровья  💚🙏.\nОтправьте свою геопозицию (просто точку на карте), чтобы бот смог выставить часовой пояс и в дальнейшем присылать сообщения по расписанию.

    Для этого:
    
    Нажмите скрепочку в поле сообщений
    Выберите пункт “геопозиция”
    Дождитесь определения вашего местоположения и нажмите “отправить выбранную геопозицию”`,
    blocked:            `Упс, ваш аккаунт заблокирован.`,
    provideYpurPhone:   `Пожалйуста, отправьте свой номер телефона с помощью кнопки внизу экрана.`,
    sendPhone:          `Отправить номер`,
    nuberIsBusy:        `Кажется, этот номер уже занят. Я сообщу администраторам — они разберутся.`,
    instNeeded:         `Спасибо за доверие!\nТеперь, пожалуйста, отправьте ссылку на ваш инстаграм.`,
    nicknameOccupied:   `Так, вижу, что этот ник уже занят. Администраторы в курсе и разбираются.`,
    preConfirmed:       `Спасибо, мы получили заявку! Как только администраторы ее верифицируют, мы с вами свяжемся. Это произойдет до 10 марта.`,
    provideInstLogin:   `Чтобы завершить заявку, пожалуйста, пришлите ссылку на свой инстаграм.`,
    justNotYet:         `Ваша учетная запись еще не подтверждена, нам нужно еще немного времени. Это произойдет до 10 марта.`,
    fileNeeded:         `Пожалуйста, отправьте фотографию как файл (через иконку скрепки рядом с полем ввода).`,
    congrats:           `Ваша учетная запись подтверждена и активирована! Скоро вы получите первое задание.`,
    notWelcome:         `Простите, но мы вам больше не рады...`,
    archive: (name) =>  `Внимание! Задание «${name}» переносится в архив.`,
    reviewed: (name, score) => {
        return          `Спасибо за вашу работу! Ваша оценка за задание «${name}» — ${score}.`
    }
}



function closeTemp(){
    streamUsers
        .where(`closure`,'<=',new Date())
        .where(`active`,'==',true)
        .get()
        .then(col=>{
            handleQuery(col).forEach(r=>{
                streamUsers.doc(r.id).update({
                    active: false
                }).then(s=>{
                    sendMessage2({
                        chat_id: r.user,
                        text: `Ваша подписка на курс ${r.courseName} истекла.`
                    })
                    log({
                        user: +r.user,
                        text: `Подписка на курс ${r.courseName} пользователя id ${r.user} истекла.`
                    })
                })
            })
        })
}

function sendStep(step,userId){
    
    devlog(step)
    
    let m = {
        chat_id: userId,
        text: step.text,
        parse_mode: `Markdown`,
        protect_content: true
    }
    let v = false
    let a = false;
    if(step.media && step.media.length){
        m.caption = step.text;
        m.photo = step.media[0];
    } 
    if(step.media && step.media[0] && step.media[0].indexOf(`mp4`) > -1){
        m.video = step.media[0]
        v = true
        delete m.photo
    }

    if(step.media && step.media[0] && step.media[0].indexOf(`https`) == -1){
        m.voice = step.media[0]
        a = true
        delete m.photo
    }

    let uploads = [];

    if(step.recipie) {
        uploads.push(common.getDoc(recipies,step.recipie))
    } else {
        uploads.push(false)
    }

    if(step.article) {
        uploads.push(common.getDoc(articles,step.article))
    } else {
        uploads.push(false)
    }

    return Promise.all(uploads).then(uploads=>{

        devlog(uploads)

        if(step.recipie || step.article){
            m.reply_markup={
                inline_keyboard:[]
            }
            if(step.recipie){
                m.reply_markup.inline_keyboard.push([{
                    text: uploads[0].button || `Открыть рецепт`,
                    web_app:{
                        url: `${ngrok}/${host}/app?start=recipies_${step.recipie}`
                    }
                }])
            }
            if(step.article){
                m.reply_markup.inline_keyboard.push([{
                    text: uploads[1].button ||`Открыть заметку`,
                    web_app:{
                        url: `${ngrok}/${host}/app?start=articles_${step.article}`
                    }
                }])
            }

            
        }
        devlog(m)

            return sendMessage2(m,step.media?(v?`sendVideo`:(a?`sendVoice`:`sendPhoto`)):false,token).then(d=>devlog(d))
    })
}

function sendCourses(uid){
    courses
        .where(`active`,'==',true)
        .get()
        .then(col=>{
            sendMessage2({
                chat_id:    uid,
                text:       `В данный момент у нас действуют следующие курсы:`,
                reply_markup:{
                    inline_keyboard:handleQuery(col).map(c=>{
                        return [{
                            text: c.name,
                            callback_data: `course_${c.id}` 
                        }]
                    })
                }
            },false,token)
        })
}

function checkAndAddPromo(uid,pid){
    promoUsers
        .where(`user`,'==',uid)
        .where(`active`,'==',true)
        .where(`promo`,'==',pid)
        .get()
        .then(col=>{
            if(!col.docs.length){
                promoUsers.add({
                    active:     true,
                    createdAt:  new Date(),
                    user:       uid,
                    promo:      pid
                })
            }
        })
}

function tick(){
    
    streams
        .where(`active`,'==',true)
        .where(`date`,'<=',new Date().toISOString().split('T')[0])
        .get()
        .then(col=>{
            // получили потоки
            handleQuery(col).forEach(stream=>{
                // для каждого потока
                streamUsers
                    .where(`stream`,'==',stream.id)
                    .get()
                    .then(col=>{
                        // получаем подписчиков
                        let usersInStream = handleQuery(col).filter(r=>r.payed)
                        let users = [];
                        let uData = {};

                        usersInStream.forEach(rec=>{
                            users.push(m.getUser(rec.user,udb))
                            uData[rec.user] = rec
                            uData[rec.user].record = rec.id
                        })
                        
                        Promise.all(users).then(users=>{
                            
                            // получили пользователей
                            
                            courses.doc(stream.course).get().then(course=>{
                                course = handleDoc(course)
                                let shift = Math.floor((+new Date() - +new Date(stream.date))/(24*60*60*1000))
                                courseDays
                                    .where(`course`,'==',   course.id)
                                    .where(`index`,'==',    shift)
                                    .where(`active`,'==',   true)
                                    .get()
                                    .then(col=>{
                                        handleQuery(col).forEach(day=>{
                                            daySteps
                                                .where(`day`,'==',day.id)
                                                .where(`active`,'==',true)
                                                .get()
                                                .then(col=>{
                                                    handleQuery(col)
                                                        .sort((a,b)=>b.time<a.time?1:-1)
                                                        .forEach(step=>{
                                                            users.forEach(u=>{
                                                                if(!uData[u.id].steps || !uData[u.id].steps[step.id]){
                                                                    let userTime = new Date(+new Date() + u.gmtOffset*1000)
                                                                    devlog(userTime)
                                                                    let stepDate =  new Date(-1*60*1000*new Date().getTimezoneOffset() + +new Date().setHours(+step.time.split(':')[0],+step.time.split(':')[1]))
                                                                    devlog(stepDate)

                                                                    if(userTime>=stepDate){


                                                                        

                                                                        sendStep(step,u.id).then(()=>{
                                                                            messages.add({
                                                                                step:       step.id,
                                                                                isReply:    true,
                                                                                text:       step.text
                                                                            })
                                                                            streamUsers.doc(uData[u.id].record).update({
                                                                                [`steps.${step.id}`]: new Date()
                                                                            })

                                                                        })
                                                                    }
                                                                }
                                                            })
                                                        })
                                                })
                                        })
                                    })
                            })
                        })
                    })
                
            })
        })
}




let admins = [];

udb
    .where(`admin`, '==', true)
    .get()
    .then(col => {
        admins = handleQuery(col)
    })

// axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/${host}/hook`).then(s => {
//     console.log(`vzBot hook set to ${ngrok}`)
// })


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


function registerUser(u,text) {
    u.createdAt =   new Date();
    u.active =      true;
    u.blocked =     false;
    u.gmtOffset =   0;
    udb.doc(u.id.toString()).set(u).then(() => {
        
        log({
            text:   `Новый юзер! Встречаем ${uname(u,u.id)}`,
            user:   +u.id
        })
        
        m.sendMessage2({
            chat_id: u.id,
            text: locals.greetings,
            photo: `https://firebasestorage.googleapis.com/v0/b/vmestezdoroveeru.appspot.com/o/photo_2024-03-17_14-44-50.jpg?alt=media&token=4aefa3e2-4d2c-4dff-ab28-dd3854e14ef8`
        }, `sendPhoto`, token).then(()=>{
            let promoAchieved = null;
            
            if(text) if(!text.indexOf(`/start promo`)){
                let promoKey = text.split('_')[1];
                promoAchieved = promos.doc(promoKey).get().then(promo=>{
                    if(promo.exists && promo.data().active){
                        if(promo.data().greeting){
                            sendMessage2({
                                chat_id: u.id,
                                text: promo.data().greeting
                            },false,token)
                        }
                        checkAndAddPromo(+u.id,promoKey)
                    }
                    return true
                })
            }
            
            Promise.resolve(promoAchieved).then(promoProceeded=>{
                sendCourses(+u.id)  
            })
        })

    })
}


function sorry(user) {

    // TBC: обсудить, как заблокированным пользователям подать аппеляцию

    m.sendMessage2({
        chat_id: u.id,
        text: locals.blocked
    }, false, token)
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
        
        m.getUser(user.id, udb).then(u => {

            if (!u) return registerUser(user,req.body.message.text)
            if (u.blocked) return sorry(user)
            // if (!u.ready) return regstriationIncomplete(u, req.body.message)
            if (!u.active) udb.doc(user.id.toString()).update({
                active: true,
                stopped: null
            }).then(s => {
                log({
                    text: `${uname(u,u.id)} возвращается.`,
                    user: +user.id
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

                if(!req.body.message.text.indexOf(`/start promo`)){
                    let promoKey = req.body.message.text.split('_')[1];
                    
                    devlog(promoKey)

                    return promos.doc(promoKey).get().then(promo=>{
                        if(promo.exists && promo.data().active){
                            if(promo.data().greeting){
                                sendMessage2({
                                    chat_id: user.id,
                                    text: promo.data().greeting
                                },false,token).then(()=>{
                                    sendCourses(user.id)
                                })
                            }
                            checkAndAddPromo(+user.id,promoKey)
                            
                        }
                        return true
                    })
                } else {
                    switch (req.body.message.text) {
                        // TBC: команды
                        case `/courses`:{
                            return courses
                                .where(`active`,'==',true)
                                .get()
                                .then(col=>{
                                    sendMessage2({
                                        chat_id:    user.id,
                                        text:       `В данный момент у нас действуют следующие курсы:`,
                                        reply_markup:{
                                            inline_keyboard:handleQuery(col).map(c=>{
                                                return [{
                                                    text: c.name,
                                                    callback_data: `course_${c.id}` 
                                                }]
                                            })
                                        }
                                    },false,token)
                                })
                        }
                        default:
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

            if(req.body.message.location){
                devlog(`координаты`)
                getTZ(req.body.message.location.latitude,req.body.message.location.longitude).then(d=>{

                    devlog(d)

                    if(!d) return m.sendMessage2({
                        chat_id: user.id,
                        text: `Упс! У нас что-то сломалось, бежим починять...`
                    }, false, token)

                    udb.doc(user.id.toString()).update({
                        gmtOffset:      d.gmtOffset,
                        cityName:       d.cityName || null,
                        countryCode:    d.countryCode || null
                    }).then(s=>{
                        return m.sendMessage2({
                            chat_id: user.id,
                            text: `Спасибо за доверие! Часовой пояс выставлен. Если вы куда-то переедете, просто скиньте новую точку.`
                        }, false, token)
                    })
                })
            }

            if(req.body.message.successful_payment){
                let payment = req.body.message.successful_payment
                let inc = payment.invoice_payload.split('_');
                let sum = `${payment.total_amount/100}${payment.currency}`
                switch(inc[0]){
                    case `invoice`: {
                        return invoices.doc(inc[1]).get().then(i=>{
                            if(!i.exists) return alertAdmins({
                                text: `Алярм! Только что пришел платеж в ${sum} в оплату инвойса, которого нет...`
                            })

                            i = handleDoc(i)
                            
                            invoices.doc(inc[1]).update({
                                payed: new Date(),
                                payedBy: +i.user,
                                telegram_payment_charge_id: payment.telegram_payment_charge_id,
                                provider_payment_charge_id: payment.provider_payment_charge_id
                            })

                            m.getUser(i.user,udb).then(u=>{
                                log({
                                    text: `${uname(u, u.id)} оплачивает ${sum} в оплату счета ${i.desc}`,
                                    user: i.user
                                })
                            })
                        }).catch(err=>{
                            handleError(err,res)
                        })
                    }
                    case `booking`:{
                        return  streamUsers.doc(inc[1])
                            .get()
                            .then(s=>{
                                if(!s.exists) {
                                    alertAdmins({
                                        text: `Алярм! Только что пришел платеж в ${sum} в оплату курса, которого нет...`
                                    })
                                }

                                streamUsers.doc(inc[1]).update({
                                    payed:      new Date(),
                                    payedBy:    +s.data().user,
                                    telegram_payment_charge_id: payment.telegram_payment_charge_id,
                                    provider_payment_charge_id: payment.provider_payment_charge_id
                                })

                                m.getUser(s.data().user,udb).then(u=>{
                                    log({
                                        text: `${uname(u, u.id)} оплачивает ${sum} в оплату курса ${s.data().courseName}`,
                                        user: s.data().user
                                    })
                                })

                                common.getDoc(courses,s.data().course).then(c=>{
                                    if(c && c.afterPayment){
                                        sendMessage2({
                                            chat_id:    +s.data().user,
                                            text:       c.afterPayment
                                        },false,token).then(()=>{
                                            messages.add({
                                                createdAt:  new Date(),
                                                isReply:    true,
                                                text:       c.afterPayment
                                            })
                                        })
                                    }
                                })
                            }).catch(err=>{
                                handleError(err,res)
                            })
                    }
                }
            }

            if(req.body.message.voice && u.admin){
                devlog(`Это голосовое`)
                sendMessage2({
                    chat_id: u.id,
                    parse_mode: `Markdown`,
                    text: '```'+req.body.message.voice.file_id+'```'
                },false,token).then(d=>console.log(d))
            }

        })
    }

    if (req.body.callback_query) {
        let qid = req.body.callback_query.id;
        user = req.body.callback_query.from
        let inc = req.body.callback_query.data.split('_');

        switch (inc[0]) {
            case `stream`:{
                return streams.doc(inc[1])
                    .get()
                    .then(s=>{
                        if(!s.exists) return replyCallBack(qid, `Такого курса у нас нет...`)
                        s = s.data()
                        if(!s.active) return replyCallBack(qid, `Простите, этот поток уже закрыт...`)
                        if(s.date < new Date().toISOString()) return replyCallBack(qid, `Простите, но вы слишком долго думали )`)
                        
                        u = user;
                        
                        streamUsers
                            .where(`user`,'==',user.id)
                            .where(`stream`,'==',inc[1])
                            .where(`active`,'==',true)
                            .get()
                            .then(col=>{
                                let before = handleQuery(col)
                                if(before[0]){
                                    sendMessage2({
                                        "chat_id": user.id,
                                        "title": `Оплата курса ${before[0].courseName}`,
                                        "description": `После оплаты возврат средств не осуществляется.`,
                                        "payload": `booking_${before[0].id}`,
                                        need_phone_number: true,
                                        send_phone_number_to_provider: true,
                                        provider_data: {
                                            receipt: {
                                                customer: {
                                                    full_name:  u.first_name+' '+u.last_name,
                                                    phone:      +u.phone
                                                },
                                                items: [{
                                                    description: `Курс ${before[0].courseName}, начало: ${s.date}`,
                                                    quantity: "1.00",
                                                    amount:{
                                                        value: before[0].price,
                                                        currency: 'RUB'
                                                    },
                                                    vat_code: 1
                                                }]
                                            }
                                        },
                                        "provider_token": process.env.vzPaymentToken,
                                        "currency": "RUB",
                                        "prices": [{
                                            "label": before[0].courseName,
                                            "amount":  before[0].price*100
                                        }]
                                    },'sendInvoice', token)
                                } else {
                                    courses.doc(s.course).get().then(c=>{
                                        
                                        c = c.data();
            
                                        if(!c.price) {
                                            replyCallBack(qid, `Извините, у нас что-то сломалось. Передаю администрации`)
                                            return alertAdmins({
                                                text: `АЛЯРМ! У нас курс без цены, пользователь не может зарегистрироваться.`
                                            })
                                        }

                                        promoUsers
                                            .where(`user`,'==',+user.id)
                                            .where(`active`,'==',true)
                                            .get()
                                            .then(col2=>{
                                                
                                                let discount = 1
                                                
                                                let foundPromo = handleQuery(col2)[0]
                                                
                                                devlog(foundPromo)

                                                if(foundPromo) discount = promos.doc(foundPromo.promo).get().then(p=>{
                                                    if(p.data().active) return 1-(p.data().discount/100)
                                                    return 1
                                                })
                                                
                                                Promise.resolve(discount).then(discount=>{
                                                    devlog(discount)

                                                let price = +c.price*discount

                                                streamUsers.add({
                                                    active:     true,
                                                    payed:      false,
                                                    createdAt:  new Date(),
                                                    stream:     inc[1],
                                                    course:     s.course,
                                                    courseName: c.name,
                                                    price:      Math.floor(price),
                                                    user:       user.id
                                                }).then(record=>{
                                                    
                                                    if(foundPromo) promoUsers.doc(foundPromo.id).update({
                                                        // active: false,
                                                        used: record.id
                                                    })

                                                    sendMessage2({
                                                        "chat_id": user.id,
                                                        "title": `Оплата курса ${c.name}`,
                                                        "description": `После оплаты возврат средств не осуществляется.`,
                                                        "payload": `booking_${record.id}`,
                                                        need_phone_number: true,
                                                        send_phone_number_to_provider: true,
                                                        provider_data: {
                                                            receipt: {
                                                                customer: {
                                                                    full_name: u.first_name+' '+u.last_name,
                                                                    phone: +u.phone
                                                                },
                                                                items: [{
                                                                    description: `Курс ${c.name}, начало: ${s.date}`,
                                                                    quantity: "1.00",
                                                                    amount:{
                                                                        value: Math.floor(price),
                                                                        currency: 'RUB'
                                                                    },
                                                                    vat_code: 1
                                                                }]
                                                            }
                                                        },
                                                        "provider_token": process.env.vzPaymentToken,
                                                        "currency": "RUB",
                                                        "prices": [{
                                                            "label": c.name,
                                                            "amount":  Math.floor(price)*100
                                                        }]
                                                    },'sendInvoice', token)
                                                })
                                                })

                                                
                                            })
                                        
            
                                        
                                    })
                                }
                            }) 
                        
                        
                    })
            }
            case `payment`:{
                return sendMessage2({
                    chat_id: user.id,
                    text: `🤖 ФИКСИРОВАННЫЙ ТАРИФ 🤖

Вы можете оплатить полную стоимость курса и тем самым поддержать развитие нашего проекта. Все материалы и обновления в таком случае Вам будут доступны навсегда. А при полном прохождении программы и заполнении анкет до и после, мы подарим от себя ценные призы за вклад в нашу исследовательскую деятельность.

СТОИМОСТЬ 12900₽ 


🎗ДОНЕЙШН (ПО СЕРДЦУ, ПО ВОЗМОЖНОСТЯМ)🎗

Вы можете оплатить любую комфортную сумму от 1000 руб. и при этом воспользоваться всеми возможностями программы на ограниченный срок в течение 4х месяцев. 

Даже если вы просмотрите все видеоуроки как сериал, это уже создаст правильный вектор на уровне вашего сознания. Если вы самостоятельно предпримете какие-то преобразования, вы сами ощутите положительный эффект. А если полностью пройдёте программу, заполните анкету на старте и в финале - вы космический молодец!🚀 

Нам статистические данные для исследования, а вам полноценная программа по оздоровлению, ценность которой значительно выше. 

!Win - Win!

💸 Для оплаты в формате донейшн просто напишите любую комфортную для вас сумму прямо в бот после выбора соответствующего тарифа. В ответ мы пришлём вам  ссылку на оплату с указанной вами суммой.

⚠️ ВНИМАНИЕ ⚠️
✔️После ознакомления с предоставленной информацией и оплаты возврат средств не осуществляется. 
✔️Старт программы начнётся в ближайший понедельник по таймеру сообщений. 
✔️Если по каким-либо причинам в это время вы не можете пройти курс, который вы оплатили, вы можете пройти его позже, получая сообщения от телеграм-бота в удобное для вас время. Для этого напишите прямо в бот или в чат поддержки.

👉 Не откладывайте на ПОТОМ вашу жизнь и здоровье. Посмотрите на людей, которые страдают от болезней, рождённых невежеством. Они упустили возможности и теперь сбиты с толку. Если вы чувствуете, что сейчас лучшее время, чтобы вложиться в свое здоровье, не проходите мимо и займитесь собой. Подходящий момент не приходит сам. Подходящий момент - это результат личного выбора. Начинайте курс сейчас, вы добьетесь поставленных целей и внесёте вклад в здоровье нации! 🌟
`
                },false,token)
            }
            case `course`:{
                // replyCallBack(qid, `Секундочку!`)
                return courses.doc(inc[1]).get().then(c=>{
                    if(!c.exists) return replyCallBack(qid, `Такого курса у нас нет...`)
                    c = c.data()
                    if(!c.active) return replyCallBack(qid, `Простите, этот курс уже закрыт...`)
                    streams
                        .where(`course`,'==',inc[1])
                        .where(`active`,'==',true)
                        .get()
                        .then(col=>{
                            let future = handleQuery(col).filter(s=>s.date>new Date().toISOString())

                            sendMessage2({
                                chat_id:user.id,
                                parse_mode: `Markdown`,
                                text: `*${c.name}*\n${c.descriptionLong || c.description}\n${future.length?`А вот даты ближайших наборов. Выберите дату, и мы пришлем вам счет.`:`К сожалению, в ближайшее время наборов не будет, но мы напишем вам, как только появится возможность записаться.`}`,
                                reply_markup:{
                                    inline_keyboard:future.map(s=>{
                                        return [{
                                            text: drawDate(s.date),
                                            callback_data: `stream_${s.id}`
                                        }]
                                    }).concat([[{
                                        text: `Условия оплаты`,
                                        callback_data: `payment`
                                    }]])
                                }
                            },false,token)
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


router.get(`/auth`, (req, res) => {
    res.render(`${host}/auth`)
})

router.get(`/app`, (req, res) => {
    if(req.query.start){
        let inc =req.query.start.split(`_`) 
        switch(inc[0]){
            case `articles`:{
                let ref = articles.doc(inc[1])
                return ref.get().then(r=>{
                    if(r.exists){
                        ref.update({
                            views: FieldValue.increment(1)
                        })
                        return res.render(`${host}/recipie`,{
                            recipie: handleDoc(r)
                        })
                    } else {
                        return res.sendStatus(404)
                    }
                    
                })
            }
            case `recipies`:{
                let ref = recipies.doc(inc[1])
                return ref.get().then(r=>{
                    if(r.exists){
                        ref.update({
                            views: FieldValue.increment(1)
                        })
                        return res.render(`${host}/recipie`,{
                            recipie: handleDoc(r)
                        })
                    } else {
                        return res.sendStatus(404)
                    }
                    
                }) 
                
            }
        }
    }
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
    sendMessage2({
        callback_query_id: id,
        text: text,
        show_alert: true,
    }, 'answerCallbackQuery', token)
}

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
                logs: handleQuery(col),
                start: req.query.page || null
            })
        })

    if (!req.signedCookies.adminToken) return res.redirect(`${process.env.ngrok}/vz/auth`)

    adminTokens
        .doc(req.signedCookies.adminToken)
        .get()
        .then(data => {
            if (!data.exists) return res.sendStatus(403)
            if (data.data().active) {
                logs
                    .orderBy(`createdAt`, 'desc')
                    .limit(100)
                    .get()
                    .then(col => {
                        res.render(`${host}/web`, {
                            logs: handleQuery(col),
                            // token: req.signedCookies.adminToken
                        })
                    })


            }
        })
})


function getTZ(lat,lng){
    return axios.get(`http://api.timezonedb.com/v2.1/get-time-zone?key=${process.env.tzKey}&format=json&by=position&lat=${lat}&lng=${lng}`)
        .then(r=>{
            return r.data
        }).catch(err=>{
            common.alertMe(`Ошибка подгрузки таймзоны!!!`)
            return false;
            
        })
}

function consistencу(type,data){
    let r = {
        passed: true,
        comment: null
    }
    switch(type){
        case `invoice`:{
            if(!data.price || !Number(data.price)){
                r.passed = false
                r.comment = `Некорректная стоимость`
            }
            break;
        }
        case `promos`:{

            if(!data.name){
                r.passed = false
                r.comment = `Название пропущено`
            }

            if(!data.discount || !Number(data.discount)){
                r.passed = false
                r.comment = `Некорректная скидка`
            }
            break;

        }
        case `recipie`:{
            if(!data.name) {
                r.passed = false
                r.comment = `Название пропущено`
            }

            if(!data.text) {
                r.passed = false
                r.comment = `Пропущен текст`
            }
            break;
        }
        case `article`:{
            if(!data.name) {
                r.passed = false
                r.comment = `Название пропущено`
            }

            if(!data.text) {
                r.passed = false
                r.comment = `Пропущен текст`
            }
            break;
        }
        default:{
            break;
        }
    }

    return r

}


router.all(`/admin/:method`, (req, res) => {

    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)

    let access = adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {
        if (!doc.exists) return false
        doc = handleDoc(doc)
        if (!doc.active) return false

        devlog(doc);

        return m.getUser(doc.user, udb)
    })

    Promise.resolve(access).then(admin => {

        if (!admin || !admin.admin) return res.sendStatus(403)

        switch (req.params.method) {
            
            case `articles`:{
                switch(req.method){
                    case `GET`:{
                        return articles.get().then(col=>{
                            res.json(handleQuery(col,true))
                        })
                    }
                    case `POST`:{
                        
                        let check = consistencу(`articles`,req.body)

                        if(check.passed) {
                            return articles.add({
                                createdAt:  new Date(),
                                createdBy:  +admin.id,
                                active:     true,
                                name:       req.body.name,
                                text:       req.body.text,
                                button:     req.body.button || null,
                                views:      0
                            }).then(rec=>{
                                res.json({
                                    success: true,
                                    comment: `Заметка создана`,
                                    id: rec.id
                                })
                                log({
                                    silent:     true,
                                    admin:      +admin.id,
                                    article:    rec.id,
                                    text: `${uname(admin,admin.id)} создает заметку ${req.body.name}`
                                })
                            })
                        } else {
                            return res.status(400).send(check.comment)
                        }
                    }
                }
            }

            case `courses`:{
                switch(req.method){
                    case `GET`:{
                        return courses.get().then(col=>res.json(handleQuery(col,true)))
                    }
                    case `POST`:{

                        if(!req.body.name) return res.status(400).send(`name is missing`)
                        if(!req.body.price || !Number(req.body.price)) return res.status(400).send(`price is missing`)
                        if(!req.body.days || !Number(req.body.days)) return res.status(400).send(`days are missing`)
                        if(!req.body.description) return res.status(400).send(`description is missing`)
                        

                        return courses.add({
                            createdAt:  new Date(),
                            createdBy:  +admin.id,
                            active:     true,
                            name:       req.body.name,
                            price:      +req.body.price,
                            description: req.body.description,
                            afterPayment: req.body.afterPayment || null
                        }).then(record=>{
                            res.json({
                                success:    true,
                                id:         record.id,
                                comment:    `Курс создан. Сейчас мы его откроем...`
                            })
                            log({
                                text:   `${uname(admin,admin.id)} создает курс ${req.body.name}`,
                                admin:  +admin.id,
                                course: record.id
                            })

                            let i = 0;
                            while (i<+req.body.days) {
                                courseDays.add({
                                    course: record.id,
                                    index:  i,
                                    active: true
                                })
                                i++
                            }
                        }).catch(err=>{
                            handleError(err,res)
                        })
                    }
                }
            }
            case `invoice`:{
                let check = consistencу(`invoice`,req.body)

                if(check.passed){

                    return m.getUser(req.body.user,udb).then(u=>{
                        
                        devlog(u)

                        if(!u) return res.sendStatus(404)

                        return invoices.add({
                            active:     true,
                            createdAt:  new Date(),
                            createdBy:  +admin.id,
                            price:      +req.body.price,
                            desc:       req.body.desc,
                            descLong:   req.body.descLong || null,
                            user:       +req.body.user
                        }).then(rec=>{
                            sendMessage2({
                                chat_id: req.body.user,
                                title: `${req.body.desc}`,
                                description: req.body.descLong || `После оплаты возврат средств не осуществляется.`,
                                payload: `invoice_${rec.id}`,
                                need_phone_number: true,
                                send_phone_number_to_provider: true,
                                provider_data: {
                                    receipt: {
                                        customer: {
                                            full_name: u.first_name+' '+u.last_name,
                                            phone: +u.phone
                                        },
                                        items: [{
                                            description: req.body.desc,
                                            quantity: "1.00",
                                            amount:{
                                                value: req.body.price,
                                                currency: 'RUB'
                                            },
                                            vat_code: 1
                                        }]
                                    }
                                },
                                "provider_token": process.env.vzPaymentToken,
                                "currency": "RUB",
                                "prices": [{
                                    "label": req.body.desc,
                                    "amount":  req.body.price*100
                                }]
                            },'sendInvoice', token).then(m=>{
                                devlog(m)
                                invoices.doc(rec.id).update({
                                    message: m.result.message_id
                                })
                                res.json({
                                    success: true,
                                    comment: `Ивойс отправлен`
                                })
                            })
                        })
                    })
                    
                } else {
                    return res.status(400).send(check.comment)
                }
            }
            case `promos`:{
                switch(req.method){
                    case `GET`:{
                        return promos.get().then(col=>{
                            res.json(handleQuery(col,true))
                        })
                    }
                    case `POST`:{
                        let check = consistencу(`promos`,req.body)
                        if(check.passed){
                            return promos.add({
                                createdAt: new Date(),
                                createdBy: +admin.id,
                                active:     true,
                                name:       req.body.name,
                                discount:   +req.body.discount,
                                greeting:   req.body.greeting || null
                            }).then(rec=>{
                                log({
                                    text: `${uname(admin,admin.id)} создает скидку ${req.body.name}`,
                                    admin: admin.id,
                                    promo: rec.id
                                })
                                return res.json({
                                    success:    true,
                                    comment:    `Скидка добавлена, мон колонель!`,
                                    id:         rec.id
                                })
                            })
                        } else {
                            return  res.status(400).send(check.comment)
                        }
                    }
                }
            }
            case `streams`:{
                switch(req.method){
                    case `POST`:{
                        if(!req.body.date || !new Date(req.body.date) || new Date(req.body.date) < new Date()) return res.status(400).send(`Некорректная дата`)
                        if(!req.body.course) return res.status(400).send(`no course provided`)
                        return courses.doc(req.body.course.toString()).get().then(c=>{
                            
                            if(!c.exists) return res.sendStatus(404)
                            
                            c = handleDoc(c)
                            
                            if(!c.active) return res.status(400).send(`Этот курс архивирован.ё`)

                            return streams.add({
                                createdAt:  new Date(),
                                createdBy:  +admin.id,
                                active:     true,
                                date:       req.body.date,
                                users:      0,
                                course:     req.body.course,
                                courseName: c.name
                            }).then(record=>{
                                
                                
    
                                log({
                                    text: `${uname(admin,admin.id)} добавляет новый поток к курсу ${c.name} на ${req.body.date}.`,
                                    admin: +admin.id,
                                    course: req.body.course,
                                    stream: record.id
                                })

                                res.json({
                                    success:    true,
                                    id:         record.id,
                                    comment:    `Поток создан!`
                                })

                            }).catch(err=>handleError(err,res))
                        })
                        
                    }
                    case `GET`:{
                        return streams.get().then(col=>{
                            res.json(handleQuery(col,true))
                        })
                    }
                    default: {
                        return res.sendStatus(404)
                    }
                }
            }
            case `recipies`:{
                switch(req.method){
                    case `GET`:{
                        return recipies.get().then(col=>{
                            res.json(handleQuery(col,true))
                        })
                    }
                    case `POST`:{
                        
                        let check = consistencу(`recipies`,req.body)

                        if(check.passed) {
                            return recipies.add({
                                createdAt:  new Date(),
                                createdBy:  +admin.id,
                                active:     true,
                                name:       req.body.name,
                                text:       req.body.text,
                                button:     req.body.button || null,
                                views:      0
                            }).then(rec=>{
                                res.json({
                                    success: true,
                                    comment: `Рецепт создан`,
                                    id: rec.id
                                })
                                log({
                                    silent:     true,
                                    admin:      +admin.id,
                                    recipie:    rec.id,
                                    text: `${uname(admin,admin.id)} создает рецепт ${req.body.name}`
                                })
                            })
                        } else {
                            return res.status(400).send(check.comment)
                        }
                    }
                }
            }
            
            case 'users': {
                return udb.get().then(col => {
                    res.json({
                        users: handleQuery(col,true)
                    })
                })
            }

            case `userStreams`:{
                if(!req.body.user) return res.status(400).send(`Пользователь не задан`)
                if(!req.body.stream) return res.status(400).send(`Поток не задан`)
                return udb.doc(req.body.user.toString()).get().then(u=>{
                    if(!u.exists) return res.status(400).send(`Такого пользователя нет`)
                    u = handleDoc(u)
                    streams.doc(req.body.stream).get().then(s=>{
                        if(!s.exists) return res.status(400).send(`Такого потока нет`)
                        s = handleDoc(s)
                        streamUsers.add({
                            createdAt:  new Date(),
                            createdBy:  +admin.id,
                            active:     true,
                            user:       +u.id,
                            stream:     s.id,
                            course:     s.course,
                            courseName: s.courseName,
                            payed:      new Date(),
                            payedBy:    +admin.id,
                            noPaymentNeeded: true
                        }).then(s=>{
                            res.json({
                                success: true,
                                id: s.id,
                                comment: `Пользователь добавлен в поток`
                            })
                        }).catch(err=>handleError(err,res))
                    })
                })
            }
            default: {
                return res.sendStatus(404)
            }
        }
    })
})


function alertStreamClosing(){
    // TBD
}

function alertStreamChanging(){
    // TBD
}

router.all(`/admin/:method/:id`, (req, res) => {
    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)

    let access = adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {
        if (!doc.exists) return false
        doc = handleDoc(doc)
        if (!doc.active) return false

        devlog(doc);

        return m.getUser(doc.user, udb)
    })

    Promise.resolve(access).then(admin => {

        if (!admin || !admin.admin) return res.sendStatus(403)

        switch (req.params.method) {

            case `articles`:{

                let ref = articles.doc(req.params.id)
                return ref.get().then(s=>{
                    if(!s.exists) return res.sendStatus(404)
                    switch(req.method){
                        case `GET`:{
                            return res.json(handleDoc(s))
                        }
                        case `DELETE`:{
                            return deleteEntity(req,res,red,admin)
                        }
                        case `PUT`:{
                            return updateEntity(req,res,ref,admin.id)
                        }
                    }
                }) 
            }

            case `courses`:{
                let ref = courses.doc(req.params.id);
                return ref.get().then(c=>{
                    if(!c.exists) return res.sendStatus(404)
                    switch(req.method){
                        case `GET`:{
                            return res.json(handleDoc(c))
                        }
                        case `DELETE`:{
                            return deleteEntity(req,res,ref,admin)
                        }
                        case `PUT`:{
                            return updateEntity(req,res,ref,admin.id)
                        }
                    }
                })
            }
            case `courseDays`:{
                switch(req.method){
                    case `GET`:{
                        return courseDays.where(`course`,'==',req.params.id).get().then(col=>{
                            res.json(handleQuery(col).sort((a,b)=>a.index-b.index))
                        })
                    }
                    case `POST`:{
                        return courseDays
                            .where(`course`,'==',req.params.id)
                            .get()
                            .then(col=>{
                                let index = handleQuery(col).length
                                // res.json(.sort((a,b)=>b.index-a.index))
                                courseDays.add({
                                    course: req.params.id,
                                    index:  index,
                                    active: true
                                }).then(record=>{
                                    res.json({
                                        id: record.id,
                                        index: index,
                                        success: true,
                                        comment: `Добавлен день №${index+1}`
                                    })
                                }).catch(err=>handleError(err,res))
                            })
                    }
                }
                
            }
            case `courseStreams`:{
                return streams.where(`course`,'==',req.params.id).get().then(col=>{
                    res.json(handleQuery(col).sort((a,b)=>a.date<b.date?-1:1))
                })
            }

            case `daySteps`:{
                switch(req.method){
                    case `PATCH`:{
                        return daySteps.doc(req.params.id).get().then(s=>{
                            sendStep(s.data(),admin.id).then(r=>console.log(r))
                            res.json({
                                success: true,
                                comment: `Сообщение отправлено`
                            })
                        })
                    }
                    case `GET`:{
                        return daySteps
                            .where(`day`,'==',req.params.id)
                            .where(`active`,'==',true)
                            .get()
                            .then(col=>{
                                courseDays.doc(req.params.id).get().then(d=>{
                                    if(!d.exists) return res.sendStatus(404)
                                    d = handleDoc(d);
                                    courses.doc(d.course).get().then(course=>{
                                        d.course =  handleDoc(course);
                                        d.steps =   handleQuery(col).sort((a,b)=>a.time<b.time?-1:1);
                                        res.json(d)
                                    })
                                })
                                
                            })
                    }
                    case `POST`:{
                        if(!req.body.time) return res.status(400).send(`Не указано время.`)
                        if(!req.body.text) return res.status(400).send(`Нет описания.`)
                        
                        return daySteps.add({
                            createdAt:  new Date(),
                            createdBy:  +admin.id,
                            media:      req.body.media || null,
                            time:       req.body.time,
                            text:       req.body.text,
                            recipie:    req.body.recipie == 'false' ? false : req.body.recipie || null,
                            article:    req.body.article == 'false' ? false : req.body.article || null,
                            active:     true,
                            day:        req.params.id
                        }).then(record=>{
                            courseDays.doc(req.params.id).update({
                                steps: FieldValue.increment(1)
                            })
                            res.json({
                                success: true,
                                comment: `Шаг сделан!`
                            })
                        }).catch(handleError)
                    }
                    case `DELETE`:{
                        let ref = daySteps.doc(req.params.id);
                        return ref.get().then(s=>{
                            if(!s.exists) return res.sendStatus(404)
                            s = handleDoc(s);
                            if(!s.active) return res.status(400).send(`Вы опоздали.\nЗапись уже отменена`);
                            ref.update({
                                active: false,
                                deletedAt: new Date(),
                                deletedBy: +admin.id
                            }).then(()=>{
                                courseDays.doc(s.day).update({
                                    steps: FieldValue.increment(-1)
                                })
                                res.json({
                                    success: true,
                                    comment: `Шаг назад!`
                                })
                            }).catch(handleError)
                        })
                    }
                }
            }

            // case `invoice`:{
            //     let ref = invoices.doc(req.params.id);
            //     switch(req.method){
            //         case `DELETE`:{
            //             return deleteEntity(req,res,ref,admin,false,)
            //         }
            //     }
            // }
            case `logs`:{
                let q = req.params.id.split('_')
                return logs
                    .where(q[0],'==',Number(q[1])?+q[1]:q[1])
                    .orderBy(`createdAt`,`desc`)
                    .get()
                    .then(col=>{
                        res.json(handleQuery(col))
                    })
            }
            case `messages`: {
                switch(req.method){
                    case `GET`:{
                        return messages.doc(req.params.id).get().then(d => res.json(handleDoc(d)))
                    }
                    case `PUT`:{

                    }
                }
            }
            case `promos`:{
                let ref = promos.doc(req.params.id);
                return ref.get().then(t => {
                    if (!t.exists) return res.sendStatus(404)
                    t = handleDoc(t);
                    switch (req.method) {
                        case `GET`: {
                            return res.json(t);
                        }
                        case `DELETE`: {
                            return deleteEntity(req, res, ref, admin, false);
                        }
                        case `PUT`:{
                            return updateEntity(req, res, ref, admin.id)   
                        }
                    }
                })
            }


            case `promoUsers`:{
                switch(req.method){
                    case `GET`:{
                        return promoUsers
                            .where(`promo`,'==',req.params.id)
                            .get()
                            .then(col=>{
                                res.json(handleQuery(col))
                            })
                    }
                }
            }
            

            case `recipies`:{
                let ref = recipies.doc(req.params.id)
                return ref.get().then(s=>{
                    if(!s.exists) return res.sendStatus(404)
                    switch(req.method){
                        case `GET`:{
                            return res.json(handleDoc(s))
                        }
                        case `DELETE`:{
                            return deleteEntity(req,res,red,admin)
                        }
                        case `PUT`:{
                            return updateEntity(req,res,ref,admin.id)
                        }
                    }
                }) 
            }

            case `streams`:{
                let ref = streams.doc(req.params.id);
                return ref.get().then(s=>{
                    if(!s.exists) return res.sendStatus(404)
                    switch(req.method){
                        case `GET`:{
                            return res.json(handleDoc(s))
                        }
                        case `DELETE`:{
                            return deleteEntity(req,res,red,admin,false,()=>alertStreamClosing(req.params.id))
                        }
                        case `PUT`:{
                            return updateEntity(req,res,ref,admin.id,()=>alertStreamChanging(req.params.id))
                        }
                    }
                })
            }

            case `streamUser`:{
                switch(req.method){
                    case `GET`:{
                        return streamUsers.doc(req.params.id)
                            .get()
                            .then(d=>{
                                res.json(handleDoc(d))
                            })
                    }
                    
                }
            }
            case `streamUsers`:{
                switch(req.method){
                    case `GET`:{
                        return streamUsers
                            .where(`stream`,'==',req.params.id)
                            .get()
                            .then(col=>{
                                res.json(handleQuery(col,true))
                            })
                    }
                    case `PUT`:{
                        let ref = streamUsers.doc(req.params.id) 
                        return ref.get().then(t=>{
                            if(!t.exists) return res.sendStatus(404)
                            
                            t = handleDoc(t)
                            
                            if(!t.active) return res.status(400).send(`Эта запись уже отменена`)
                            if(t.payed) return res.status(400).send(`Эта запись уже оплачена`)
                            
                            let closure = new Date(+new Date()+4*30*24*60*60*1000)
                            
                            ref.update({
                                payed:          new Date(),
                                payedBy:        +admin.id,
                                toBeClosed:     closure
                            }).then(()=>{
                                
                                log({
                                    text:   `${uname(admin,admin.id)} отмечает оплаченной запись пользователя ${t.user} на курс ${t.courseName}. Доступ закончится ${drawDate(closure)}.`,
                                    ticket: req.params.id,
                                    admin:  +admin.id
                                })

                                sendMessage2({
                                    chat_id: t.user,
                                    text: `Ваша запись на курс ${t.courseName} оплачена. Ура!`
                                },false,token)

                                res.json({
                                    success: true,
                                    comment: `Запись оплачена`
                                })
                            })
                        })
                    }
                    case `DELETE`:{
                        return deleteEntity(req,res,streamUsers.doc(req.params.id),admin,false,()=>alertUserStop(req.params.id))
                    }
                }                
            }
            case `users`: {
                let ref = udb.doc(req.params.id);
                return ref.get().then(t => {
                    if (!t.exists) return res.sendStatus(404)
                    t = handleDoc(t);
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

            case `userInvoices`:{
                switch (req.method) {
                    case 'GET': {
                        return invoices
                            .where(`user`, '==', +req.params.id)
                            .get()
                            .then(col => {
                                res.json(handleQuery(col,true))
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
                                res.json(handleQuery(col))
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

            case `userStreams`:{
                switch(req.method){
                    case `GET`:{
                        return streamUsers.where(`user`,'==',+req.params.id).get().then(col=>res.json(handleQuery(col,true)))
                    }
                    case `POST`:{

                    }
                }
                
            }
        }
    })
})


function alertUserStop(id){
    streamUsers.doc(id).get().then(rec=>{
        rec = handleDoc(rec)
        sendMessage2({
            chat_id: rec.user,
            text: `Ваша подписка на курс ${rec.courseName} от ${drawDate(rec.createdAt._seconds*1000)} была остановлена.`
        },false,token)
        
    })
}

function updateEntity(req, res, ref, adminId) {

    entities = {
        tasks: {
            log: (name) => `задание ${name} было обновлено: ${req.body.attr} становится ${req.body.value}`,
            type: `task`
        },
        courses:{
            log:(name)=> `курс ${name} был обновлен: ${req.body.attr} становится ${req.body.value}`,
            type: `course`
        },
        promos:{
            log:(name)=> `скидка ${name} была обновлена: ${req.body.attr} становится ${req.body.value}`,
            type: `promo`
        },
        articles:{
            log:(name)=> `заметка ${name} была обновлена: ${req.body.attr} становится ${req.body.value}`,
            type: `article`
        },
        recipies:{
            log:(name)=> `рецепт ${name} был обновлен: ${req.body.attr} становится ${req.body.value}`,
            type: `recipie`
        }
    }

    return ref.update({
        updatedAt:          new Date(),
        updatedBy:          +adminId || null,
        [req.body.attr]:    req.body.attr == `date` ? new Date(req.body.value) : req.body.value
    }).then(s => {
        res.json({
            success: true
        })

        

        if(entities[req.params.method]) {
            ref.get().then(data=>{
                data = handleDoc(data)
                log({
                    text: entities[req.params.method].log(data.name),
                    admin: +adminId,
                    [entities[req.params.method].type]: req.params.id
                })
            })
            
        }

    }).catch(err => {
        res.status(500).send(err.message)
    })
}

function deleteEntity(req, res, ref, admin, attr, callback) {
    entities = {
        tasks: {
            log: (name) => `задание ${name} было архивировано`,
            type: `task`
        },
        courses:{
            log:(name)=> `${uname(admin)} архивирует курс ${name}`,
            type: `course`
        },
        promos:{
            log:(name)=> `${uname(admin)} архивирует скидку ${name}`,
            type: `promo`
        },
        recipies:{
            log:(name)=> `${uname(admin)} архивирует рецепт ${name}`,
            type: `recipie`
        },
        articles:{
            log:(name)=> `${uname(admin)} архивирует заметку ${name}`,
            type: `article`
        }
    }


    return ref.get().then(e => {

        let data = handleDoc(e)

        if (!data[attr || 'active']) return res.json({
            success: false,
            comment: `Вы опоздали. Запись уже удалена.`
        })

        ref.update({
            [attr || 'active']: (attr == `blocked` ? true : false),
            updatedBy: +admin.id
        }).then(s => {

            if(entities[req.params.method]) log({
                text: entities[req.params.method].log(data.name),
                admin: +admin.id,
                [entities[req.params.method].type]: req.params.id
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

module.exports = router;