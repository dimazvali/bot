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

var devlog = common.devlog;

let users = {}

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

const {
    getDatabase
} = require('firebase-admin/database');
const {
    text, query, json
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
}, 'sss');
let fb = getFirestore(gcp);



let token = process.env.sssToken

let ngrok = process.env.ngrok

let sheet = process.env.sssSheet


function handleError(err){
    console.log(err);
    try{
        res.status(500).send(err.message)
    }catch(err){

    }
}

// setTimeout(function(){
//     axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/sss/hook`).then(()=>{
//         console.log(`sss hook set`)
//     }).catch(handleError)
// },1500)


let udb =                   fb.collection('users');
let messages =              fb.collection('userMessages');
let restaurants =          fb.collection('restaurants');
let discounts =             fb.collection('discounts');

router.all(`/api/:data/:id`, (req, res) => {
    console.log('погнал')
    switch (req.params.data) {
        case 'places':{
            console.log('places')
            switch (req.method){
                
                

                case 'POST':{
                    return restaurants.add({
                        active:         req.body[1],
                        name:           req.body[2],
                        description:    req.body[3],
                        address:        req.body[4],
                        pic:            req.body[5],
                        createdAt:      new Date()
                    }).then(rec=>{
                        res.json({
                            id: rec.id
                        })
                    }).catch(handleError)
                }
                case 'PUT':{
                    return restaurants.doc(req.params.id).update({
                        active:         req.body[1],
                        name:           req.body[2],
                        description:    req.body[3],
                        address:        req.body[4],
                        pic:            req.body[5],
                        updatedAt:      new Date()
                    }).then(()=>res.sendStatus(200))
                    .catch(handleError)
                }
                default: {
                    console.log(req.method)
                    return res.sendStatus(404)
                }
            }
        }
        case 'discounts':{
            switch (req.method){
                case 'POST':{

                    return discounts.add({
                        active:         req.body[1],
                        value:          req.body[2],
                        price:          req.body[3],
                        place:          req.body[4],
                        createdAt:      new Date()
                    }).then(rec=>{
                        res.json({
                            id: rec.id
                        })
                    }).catch(handleError)
                }
                case 'PUT':{
                    return discounts.add({
                        active:         req.body[1],
                        value:          req.body[2],
                        price:          req.body[3],
                        place:          req.body[4],
                        updatedAt:      new Date()
                    }).then(()=>res.sendStatus(200))
                    .catch(handleError)
                }
                default: {
                    console.log(req.method)
                    return res.sendStatus(404)
                }
            }
        }
        default: {
            return res.sendStatus(404)
        }
    }
})


function registerUser(u) {

    u.createdAt = new Date();
    u.active = true;
    u.blocked = false;
    u.bonus = true;

    users[u.id] = u;


    udb.doc(u.id.toString()).set(u).then(() => {

        m.sendMessage2({
            chat_id: u.id,
            text: `Привет, я стартовое сообщение от Сережи. Оно будет интересным. А теперь к делу: я могу показывать сертификаты по категориям и списком, как тебе больше хочется?`,
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: `Показать все`,
                        callback_data: `discount_all`
                    }],
                    [{
                        text: `Посмотреть рестораны`,
                        callback_data: `restaurants_all`
                    }]
                ]
            }
        }, false, token)

        let d = u;
        d.intention = 'newUser'
        d.id = u.id
        d.createdAt = new Date().toISOString()

        axios.post(sheet, Object.keys(d).map(k => `${k}=${d[k]}`).join('&'), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        }).then(d => {
            // console.log(d.data)
        }).catch(err => {
            console.log(err.message)
        })

        alertAdmins({
            type: 'newUser',
            text: `Новый пользователь бота:\n${JSON.stringify(u,null,2)}`,
            user_id: u.id
        })

    }).catch(err => {
        console.log(err)
    })
}


function alertAdmins(mess) {
    udb.where(`admin`, '==', true).get().then(admins => {
        admins.docs.forEach(a => {
            message.chat_id = a.id
            if (mess.type != 'stopLog' || !a.data().stopLog) m.sendMessage2(message, false, token)
        })
    })
}

function sendVenue(place,id,user,callback){
    if(!place.active){
        return m.sendMessage2({
            callback_query_id: callback.id,
            show_alert: true,
            text: `Извините, это заведение более недоступно.`
        }, 'answerCallbackQuery', token)
    }
    discounts.where('place','==',id).get().then(col=>{
        let discounts = common.handleQuery(col);
        
        devlog(discounts)

        let mess = {
            chat_id: user.id,
            parse_mode: 'HTML',
            text: `<b>${place.name}</b>\n<i>${place.address}</i>\n${place.description}`,
            reply_markup: {
                inline_keyboard: []
            }
        }
        discounts.forEach(d=>{
            mess.reply_markup.inline_keyboard.push([{
                text: `${d.value*100}% на сертификат в ${common.cur(d.price,'RUB')}`,
                callback_data: `discount_${d.id}`
            }])
        })

        mess.reply_markup.inline_keyboard.push([{
            text: `Подписаться на новые акции ресторана`,
            callback_data: `venue_subscribe_${id}`
        }])

        if(place.pic){
            mess.caption = mess.text
            mess.photo = place.pic
        }
        m.sendMessage2(mess,(place.pic?'sendPhoto':false),token)
    })
}

function sendDiscount(d,id,user){
    restaurants.doc(d.place).get().then(place=>{
        
        place = place.data();

        

        try {

            console.log(place, place.name)

            m.sendMessage2({
                chat_id: user.id,
                text: `${d.value*100}% на сертификаты стоимостью ${common.cur(d.price,'RUB')} в ресторане ${place.name || ''} (${place.address})`,
                reply_markup:{
                    inline_keyboard:[[
                        {
                            text: 'Подробнее о ресторане',
                            callback_data: `restaurant_${d.place}`
                        }
                    ],[
                        {
                            text: 'Купить',
                            callback_data: `buy_${id}`
                        }
                    ]]
                }
            },false,token)
        } catch (err){
            console.log(err)
        }
        
    })
    
}

router.post('/hook', (req, res) => {
    res.sendStatus(200)

    let user = {}

    devlog(req.body)
    try {
        if (req.body.message) {
            user = req.body.message.from
    
            udb.doc(user.id.toString()).get().then(u => {
                if (!u.exists) registerUser(user)
            })
        }
    
        if (req.body.message && req.body.message.text) {
            messages.add({
                user: user.id,
                text: req.body.message.text || null,
                createdAt: new Date(),
                isReply: false
            })

            switch(req.body.message.text){
                case '/places':{
                    return restaurants.where('active','==',true).get().then(col=>{
                        common.handleQuery(col).forEach(d=>{
                            sendVenue(d,d.id,user)
                        })
                    })
                }
                case '/discounts':{
                    return discounts.where('active','==',true).get().then(col=>{
                        common.handleQuery(col).forEach(d=>{
                            sendDiscount(d,d.id,user)
                        })
                    })
                }
                default:{
                    break;
                }
            }
        }
    
        
        if (req.body.callback_query) {
    
    
            user = req.body.callback_query.from;
    
            let inc = req.body.callback_query.data.split('_')
    
            devlog(inc)
    
            switch(inc[0]){
                case 'venue':{
                    return m.sendMessage2({
                        callback_query_id: req.body.callback_query.id,
                        show_alert: true,
                        text: `Извините, Эта функция все еще в разработке.`
                    }, 'answerCallbackQuery', token)
                }
                case 'discount':{
                    switch(inc[1]){
                        case 'all':{
                            return discounts.where('active','==',true).get().then(col=>{
                                common.handleQuery(col).forEach(d=>{
                                    sendDiscount(d,d.id,user)
                                })
                            })
                        }
                        default:{
                            return discounts.doc(inc[1]).get().then(d=>{
                                sendDiscount(d.data(),d.id,user)
                            })
                        }
                    }
                    
                }
                case 'restaurant':{
                    switch(inc[1]){
                        case 'all':{
                            return restaurants.where('active','==',true).get().then(col=>{
                                common.handleQuery(col).forEach(d=>{
                                    sendVenue(d,d.id,user,req.body.callback_query)
                                })
                            })
                        }
                        default:{
                            return restaurants.doc(inc[1]).get().then(d=>{
                                sendVenue(d.data(),d.id,user,req.body.callback_query)
                            })
                        }
                    }
                }
                case 'buy':{
                    return discounts.doc(inc[1]).get().then(d=>{
                        d = d.data();
                        
                        if(!d.active){
                            return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: `Извините, этот сертификат более не доступен.`
                            }, 'answerCallbackQuery', token)
                        }

                        return m.sendMessage2({
                            "chat_id": user.id,
                            "title": `Тестовый сертификат на ${common.cur(d.price,'RUB')}`,
                            "description": `вам понравится`,
                            "payload": `${JSON.stringify({user: user.id,discount: inc[1]})}`,
                            "provider_token": process.env.sssPaymentToken,
                            "currency": "RUB",
                            "prices": [{
                                "label": "входной билет",
                                "amount": Math.round(d.price*d.value) * 100
                            }]
                        }, 'sendInvoice', token)


                    })
                }
                default:{
                    return m.sendMessage2({
                        callback_query_id: req.body.callback_query.id,
                        show_alert: true,
                        text: `Извините, Эта функция все еще в разработке.`
                    }, 'answerCallbackQuery', token)
                }
            }
        }
    } catch(err){
        console.log(err)
    }

   

})

module.exports = router;