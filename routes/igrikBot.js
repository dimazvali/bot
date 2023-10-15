var express =   require('express');
var router =    express.Router();
var axios =     require('axios');
var cors =      require('cors')
var sha256 =    require('sha256');
var common =    require('./common');
const m =       require('./methods.js');
var QRCode =    require('qrcode')
var mail =      require('nodemailer')

var parser =    require('vdata-parser');


let transporter = mail.createTransport({
    service: 'Yandex', // no need to set host or port etc.
    auth: {
        user: 'igrikbaryoga',
        pass: '^8Sm5CFLKyxdg'
    }
});

// transporter.sendMail({
//     from:       'igrikbaryoga@yandex.ru',
//     to:         'dimazvali@yandex.ru',
//     text:       'the very first letter',
//     subject:    'test email '+new Date().toLocaleDateString()
// })


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



let gcp = initializeApp({
    credential: cert({
        "type":             "service_account",
        "project_id":       "igrikbot-dcd61",
        "private_key_id":   process.env.ibId,
        "private_key":      process.env.ibKey.replace(/\\n/g, '\n'),
        "client_email":     "firebase-adminsdk-2slr0@igrikbot-dcd61.iam.gserviceaccount.com",
        "client_id":        "100164649604632886814",
        "auth_uri":         "https://accounts.google.com/o/oauth2/auth",
        "token_uri":        "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-pg1xn%40samobot-d4237.iam.gserviceaccount.com"
    }),
    databaseURL: "https://rrspecialsapi.firebaseio.com"
}, 'igrik');

let fb = getFirestore(gcp);


let users = {};
var path = require('path');
var cron = require('node-cron');

let token =      `5841330129:AAHW7ec-2JNhqw5odjDOVDcP5slT36CONo0`
let adminToken = `6174033726:AAH8QaTasCMq6JscwxLo_Md9JVpB6USvBzY`


let ngrok = process.env.ngrok;


axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/igrik/hook`).then(s=>{
    console.log(`igrik hook set to ${ngrok}`)
})

axios.get(`https://api.telegram.org/bot${adminToken}/setWebHook?url=${ngrok}/igrik/adminHook`).then(s=>{
    console.log(`igrik hook set to ${ngrok}`)
})



let udb =           fb.collection('users');
let invitations =   fb.collection('invitations');
let messages =      fb.collection('usersMessages');
let admins =        fb.collection('admins');
let news =          fb.collection('news');
let newsReads =     fb.collection('newsReads');
let newsPosts =     fb.collection('newsPosts');
let usersClasses =  fb.collection('usersClasses');
let userTags =      fb.collection('userTags');

let prices =        fb.collection('prices');


let pd = {}

if(!process.env.develop) updatePrices()


function updatePrices(){
    axios.get(`${process.env.igrik1Chost}/price_list/?club_id=${process.env.igrik1ClubId}`, {
        headers: {
            'Content-Type':     'application/json',
            'apikey':           process.env.igrik1CapiKey,
            'Authorization':    process.env.igrik1CapiAuth
        }
    }).then(d=>{
        pd = {}
        d.data.data.forEach(item=>{
            if(item.services){
                pd[item.services[0].id] = item   
            }
        })
        console.log(`установили цены`)
        common.devlog(JSON.stringify(pd))
    }).catch(err=>{
        console.log(err)
    })
}




let kbd =(id)=> [
    [{
        text: 'Твои классы',
        web_app: {
            url: `${ngrok}/igrik/app?start=me&id=${id}`
        }
    }],[{
        text: 'Расписание',
        web_app: {
            url: `${ngrok}/igrik/app?start=schedule&id=${id}`
        }
    }],[{
        text: 'Новости',
        web_app: {
            url: `${ngrok}/igrik/app?start=news&id=${id}`
        }
    }],[{
        text: 'Меню',
        web_app: {
            url: `${ngrok}/igrik/app?start=menu&id=${id}`
        }
    }],
    [{
        text: 'Учителя',
        web_app: {
            url: `${ngrok}/igrik/app?start=masters&id=${id}`
        }
    }],
    [{
        text: 'Контакты',
        web_app: {
            url: `${ngrok}/igrik/app?start=contacts&id=${id}`
        }
    }]
]

router.get('/qr', async (req, res) => {
    if (req.query.tag) {
        QRCode.toFile(__dirname + '/../public/images/igrik/' + req.query.tag + '.svg', `https://t.me/igrikyobot?start=campaign_${req.query.tag}`, {
            color: {
                dark: req.query.dark || '#FE93C7',
                light: req.query.light || '#ffffff',
            },
            maskPattern: req.query.m || 0,
            type: 'svg',
        }).then(s => {
            res.sendFile(req.query.tag + '.svg', {
                root: './public/images/igrik/'
            })
        }).catch(err => {
            console.log(err)
            res.sendStatus(500)
        })
    } else {
        res.status(500).send(`no place provided`)
    }
})


router.post(`/api/alertUsers`,(req,res)=>{
    
    if(!req.body.admin || !req.body.text || !req.body.class) return res.sendStatus(400);

    checkAdmin(req.body.admin).then(admin=>{
        usersClasses
            .where('active','==',true)
            .where('appointment','==',req.body.class)
            .get()
            .then(col=>{
                let result = []
                common.handleQuery(col).forEach(app=>{
                    result.push(m.sendMessage2({
                        chat_id: app.user,
                        text: req.body.text
                    },false,token))
                    messages.add({
                        user:       +app.user,
                        text:       req.body.text,
                        createdAt:  new Date(),
                        isReply:    true
                    })
                })
                Promise.all(result).then(q=>{
                    res.send(`Сообщение отправлено на ${q.length} телефонов.`)
                })
            }).catch(err=>{
                res.status(500).send(err.message)
            })
    })
})

function alertUsersByClass(){
    usersClasses.where('active','==',true).get().then(col=>{
        col.docs.forEach(appointment=>{
            if(!appointment.data().sent && (new Date(appointment.data().date) <= new Date(+new Date()+2*60*60*1000)) && (new Date(appointment.data().date) >= new Date(+new Date()+24*60*60*1000))){

                axios.get(`${process.env.igrik1Chost}/class_descriptions/?appointment_id=${appointment.data().appointment}`,{
                    headers: {
                        'apikey':           process.env.igrik1CapiKey,
                        'Authorization':    process.env.igrik1CapiAuth
                    }
                }).then(d=>{
                    if(d.data.success && !d.data.data.canceled){
                        m.sendMessage2({
                            chat_id: appointment.data().user,
                            text: `Напоминаем, что в ${new Date(appointment.data().date).toLocaleString('ru-RU',{
                                // day: '2-digit',
                                // month: 'long',
                                hour:   '2-digit',
                                minute: '2-digit'
                            })} у тебя будет занятие «${appointment.data().name}».`,
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: 'Отменить запись',
                                        callback_data: 'cancel'+'_'+appointment.data().appointment
                                    }]
                                ]
                                }
                        },false,token)
                        usersClasses.doc(appointment.id).update({
                            sent: true
                        })
                    }
                }).catch(err=>{
                    common.devlog(err.message)
                })
                
            }
        })
    })
}

// router.get('/test/:pub',(req,res)=>{
//     udb.get().then(col=>{
//         common.handleQuery(col).forEach((u,i)=>{
//             setTimeout(function(){
//                 console.log(i)
//                 m.sendMessage2({
//                     chat_id: u.id,
//                     parse_mode: 'HTML',
//                     caption: `\nЙога, на которой можно попивать коктейли!\nЕсли вы улыбнулись, увидев, что мы существуем, то это именно то что вам нужно в эту субботу!🧘♀️🙌\n<strong>14 октября в 19:00 </strong>пройдет первая коктейльная йога в СПБ! В программе &mdash; час медитативной тренировки под бокал специального коктейля от Ola Bar, фуршет от винного бара IGRIK и дегустация еще одного коктейля от Ola Bar. В качестве сюрприза на занятии вас ожидает практика с метафорическими картами, на которой можно будет получить ответ на волнующий вопрос! Не сможете прийти на йогу, но все еще хотите присоединиться к веселью? Нет проблем! Для всех желающих есть свободные столики в винном баре IGRIK.\nСтоимость: 2 900 рублей (участие по предварительной записи) / Вход в бар: свободный\nВстречаемся на Петроградке. Ул. Пионерская, 2.🤍`,
//                     photo: `AgACAgIAAxkBAAJkOmUmn0aE53a4tiPHB1t8L04FdskJAALf2TEbLLA5SQ61ht1JJ1hLAQADAgADeQADMAQ`,
//                     reply_markup:{
//                         inline_keyboard:[[{
//                             text: `Записаться`,
//                             web_app:{
//                                 url: `https://api-bot.restorating.ru/igrik/app?start=service_966eb0f6-586a-11ee-8777-005056833ca1`
//                             }
//                         }]]
//                     }
//                 },`sendPhoto`,token)
//             },i*200)
//         })
//     })
    
// })

cron.schedule(`0 10 * * 1`,()=>{
    // каждый понедельник в 10
    alertStats('week')
})


cron.schedule(`0 10 1 * *`,()=>{
    // каждое первое число в 10
    alertStats('month')

})

function alertStats(period){
    
    let since = new Date(+new Date()-7*24*60*60*1000)
    
    if(period == 'month') since = new Date(new Date().setDate(0))

    let data = []
    
    data.push(udb.where('createdAt','>=',since).get().then(col=>common.handleQuery(col)))

    data.push(usersClasses.where('createdAt','>=',since).get().then(col=>common.handleQuery(col)))

    data.push(messages.where('createdAt','>=',since).get().then(col=>common.handleQuery(col)))

    let periods={
        'month': 'истекший месяц',
        'week': 'последнюю неделю'
    }

    Promise.all(data).then(data=>{
        reportAdmins(`За ${periods[period]} в боте появилось ${common.letterize(data[0].length,'гость')}.\n${common.letterize(data[2].length,'комментарий')}\nЗаписей: ${data[1].length}.`)
    })
}


cron.schedule(`0 6-23 * * *`,()=>{
    // каждый час с 6 до 23
    alertUsersByClass()
    updatePrices()

    
})

// let newsReady =     news.where('active','==',true)
//     // .orderBy('createdAt')
//     .get().then(col=>{
//     return col.docs.map(pub=>{
//         let t = pub.data();
//         t.id = pub.id;
//         return t
//     })
// })

router.get('/app', (req, res) => {

    console.log(req.query)

    res.render('igrik/app',{
        user:   req.query.id,
        start:  req.query.start || req.query.tgWebAppStartParam,
        prices: pd
    })
})

router.get('/adminApp', (req, res) => {
    // console.log(req)
    if(req.query.action == 'messenger'){
        let data = []
            data.push(udb.doc(req.query.user).get().then(u=>u.data()))
            data.push(getUserMessages(+req.query.user))
            
            data.push(userTags.where('user','==',req.query.user).get().then(col=>{
                return col.docs.map(t=>{
                    let temp = t.data()
                        temp.id = t.id;
                        return temp
                })
            }))

            data.push(usersClasses
                .where('user','==',req.query.user)
                .where('active','==',true)
                .where('date','>',new Date().toISOString().split('T')[0])
                .get()
                .then(col=>common.handleQuery(col))
            )
        Promise.all(data).then(data=>{
            res.render('igrik/adminApp',{
                intent:     'messenger',
                messages:   data[1],
                user:       data[0],
                tags:       data[2],
                classes:    data[3]
            })
        })
    } else if(req.query.action == 'start'){
        res.render('igrik/adminApp',{
            intent:     'start',
        })
    } else if(req.query.action == 'news'){
        news.doc(req.query.publication).get().then(publication=>{
            if(!publication.exists) return res.sendStatus(404)
            let t = publication.data()
                t.id = publication.id;
                if(t.video){
                    axios.post(`https://api.telegram.org/bot${adminToken}/getFile`,{
                        file_id: t.video
                    }).then(s=>{
                        t.video = `https://api.telegram.org/file/bot${adminToken}/${s.data.result.file_path}`
                        res.render(`igrik/adminApp`,{
                            intent: 'publication',
                            publication: t
                        })
                    })
                } else {
                    res.render(`igrik/adminApp`,{
                        intent: 'publication',
                        publication: t
                    })
                }
                
        })
    } else {
        res.sendStatus(404)
    }
})




function registerUser(u) {

    // alertAdmin(`новый юзер игрика: ${JSON.stringify(u,null,2)}`)

    u.createdAt = new Date();
    u.active = true;
    u.blocked = false;
    users[u.id] = u;
    udb.doc(u.id.toString()).set(u)

    

    m.sendMessage2({
        chat_id: u.id,
        text: `Привет!\n\nТы в пространстве IGRIK — это винный бар и йога на Петроградке. \nИ правильный выбор, чтобы красиво расслабиться.\n Здесь хранится твоя клубная карта, расписание занятий и баланс. Ботик записывает на классы и рассказывает наши новости. Даже помогает выбирать и заказывать вино! \nНо — позже. Пока тестируем, так что вся информация — для ознакомления.\nЗапрещенная красота:\nhttps://www.instagram.com/igrikbaryoga/`,
        reply_markup: {
            is_persistent:  true,
            resize_keyboard: true,
            keyboard: kbd(u.id)
        }
    },false,token).then(()=>{

        m.sendMessage2({
            chat_id: u.id,
            text: `Чтобы воспользоваться всем функционалом приложения, поделись своим телефоном. Мы сами не спамим — и другим не даем.`,
            reply_markup:{
                inline_keyboard:[
                    [{
                        text: `Поделиться телефоном`,
                        callback_data: `request_contact`
                    }]
                ]
            }
        },false,token)
        // m.sendMessage2({
        //     chat_id: u.id,
        //     text: 'Чтобы получить полноценный доступ, отправьте мне свой телефон. просто нажмите на специальную кнопку ниже',
        //     reply_markup: {
        //         keyboard: [
        //             [{
        //                 text: 'Отправить номер',
        //                 request_contact: true
        //             }]
        //         ]
        //     }
        // }, false, token)
    })

    // m.sendMessage2({
    //     chat_id: u.id,
    //     caption: m.greeting()+`, ${u.first_name}! В данный момент бот находится в режиме активной разработки. Join us if you dare.`,
    //     photo: `https://firebasestorage.googleapis.com/v0/b/igrikbot-dcd61.appspot.com/o/image%20(1).jpeg?alt=media&token=7e4dfef3-fb9c-497a-8dcf-3137e77bb778`
    // }, 'sendPhoto', token).then(() => {

        
        
    // })
}


function registerAdmin(u) {

    alertAdmin(`новый админ игрика? \n ${JSON.stringify(u,null,2)}`)

    u.createdAt = new Date();
    u.active = true;
    u.confirmed = false,
    
    admins.doc(u.id.toString()).set(u)

    m.sendMessage2({
        chat_id: u.id,
        text: `${m.greeting()}, ${u.first_name}! Пожалуйста, подождите, пока ваш доступ подтвердят коллеги.`
    },false,adminToken)
}

function reportAdmins(text,userid){
    admins.where('confirmed','==',true)
        .where('active','==',true)
        .get().then(col=>{
            col.forEach(a=>{
                common.devlog(a.id)
                let mess = {
                    chat_id: a.id,
                    text: text
                }
                if(userid) mess.reply_markup = {
                    inline_keyboard:[[{
                        text: 'Открыть переписку',
                        "web_app": {
                            "url": `${process.env.igrikBotHost}/adminApp?action=messenger&user=${userid}`
                        }
                    }]]
                }
                m.sendMessage2(mess,false,adminToken)
            })
        })
}

function alertAdmins(user, text){
    admins.where('confirmed','==',true)
        .where('active','==',true)
        .get().then(col=>{
        col.forEach(a=>{
            common.devlog(a.id)
            m.sendMessage2({
                chat_id: a.id,
                text: `Клиент ${user.first_name} @${user.username} пишет боту что-то непонятное:\n${text}\n\n`,
                reply_markup:{
                    inline_keyboard:[[{
                        text: 'Открыть переписку',
                        "web_app": {
                            "url": `${process.env.igrikBotHost}/adminApp?action=messenger&user=${user.id}`
                        }
                    }]]
                }
            },false,adminToken)
        })
    })
}

function updateUser(id, upd) {
    return udb.doc(id.toString()).update(upd)
}

function getIikoToken() {
    return axios.post(`https://api-ru.iiko.services/api/1/access_token`, {
        "apiLogin": process.env.igrikiikoapiLogin
    }).then(s => {
        return s.data.token
    }).catch(err => {
        throw new Error(err)
    })
}


function askForDate(id){
    let days = [[{
        text: 'Сегодня',
        callback_data: 'schedule_'+new Date().toISOString().split('T')[0]
    }],[{
        text: 'Завтра',
        callback_data: 'schedule_'+new Date(new Date()+1*24*60*60*1000).toISOString().split('T')[0]
    }]];

    let plus = 2
    
    while(plus<8){
        console.log(plus)
        days.push([{
            text: new Date(+new Date()+plus*24*60*60*1000).toLocaleDateString(),
            callback_data: 'schedule_'+new Date(+new Date()+plus*24*60*60*1000).toISOString().split('T')[0]
        }])
        plus++
    }

    days.push([{
        text: `Удобнее всего записаться через приложение`,
        web_app:{
            url: ngrok+'/igrik/app?start=schedule'
        }
    }])
    
    m.sendMessage2({
        chat_id: id,
        text: 'Пожалуйста, выберите день занятий',
        reply_markup:{
            inline_keyboard: days
        }
    },false,token)
}

function showUserSchedule(id,utoken){
    axios.get(`${process.env.igrik1Chost}/appointments/`,{
        headers: {
            usertoken:          utoken || null,
            'apikey':           process.env.igrik1CapiKey,
            'Authorization':    process.env.igrik1CapiAuth
        }
    }).then(schedule=>{
        schedule.data.data.sort((a,b)=>a.start_date < b.start_date ? -1 : 1).filter(app=>app.arrival_status !== 'canceled').forEach(app=>{
            app.booked = 1;
            sendAppointment(id,app)
        })
    }).catch(err=>{
        console.log(err)
        m.sendMessage2({
            chat_id: id,
            text: `Извините, сервис временно недоступен`
        },false,token)

        alertAdmin(`Ошибка получения расписания для клиента ${id}`)
    })
}

function classJoin(id, utoken, appointment_id, res, appointment){
    axios.post(`${process.env.igrik1Chost}/client_to_class/`,{
        "appointment_id": appointment_id
    },{
        headers: {
            usertoken:          utoken || null,
            'apikey':           process.env.igrik1CapiKey,
            'Authorization':    process.env.igrik1CapiAuth
        }
    }).then(s=>{
        

        axios.get(`${process.env.igrik1Chost}/class_descriptions/?appointment_id=${appointment_id}`,{
            headers: {
                usertoken:          utoken || null,
                'apikey':           process.env.igrik1CapiKey,
                'Authorization':    process.env.igrik1CapiAuth
            }
        }).then(d=>{

            common.devlog(d.data)

            let timeanddate = `${d.data.data.service.title}, ${new Date(d.data.data.start_date).toLocaleString('ru-RU',{
                day: '2-digit',
                month: 'long',
                hour:   '2-digit',
                minute: '2-digit'
            })}`

            m.sendMessage2({
                chat_id: id,
                text: `Отлично, записали тебя на класс ${timeanddate}`,
                reply_markup:{
                    inline_keyboard:[[
                        {text: `Твои классы`,web_app:{url:`${ngrok}/igrik/app?start=me`}}
                    ]]
                }
            },false,token)

            udb.doc(id.toString()).get().then(u=>{

                u = u.data()

                axios.get(`${process.env.igrik1Chost}/price_list/?service_id=${d.data.data.service.id}`, {
                    headers: {
                        'Content-Type':     'application/json',
                        'apikey':           process.env.igrik1CapiKey,
                        'Authorization':    process.env.igrik1CapiAuth
                    }
                }).then(price=>{    
                    let pd = {
                        "chat_id": id,
                        "title": `Прдеоплата занятия ${timeanddate}`,
                        "description": `Если ты передумаешь — мы вернем оплату (но только если до занятия останется больше 5 часов).`,
                        "payload": `${appointment_id}`,
                        need_phone_number: true,
                        send_phone_number_to_provider: true,
                        provider_data: {
                            receipt: {
                                customer: {
                                    full_name: u.first_name+' '+u.last_name,
                                    phone: +u.phone
                                },
                                items: [{
                                    description: `${d.data.data.service.title}, ${timeanddate}`,
                                    quantity: "1.00",
                                    amount:{
                                        value: 500.0,
                                        // (+price.data.data[0].price).toFixed(1),
                                        currency: 'RUB'
                                    },
                                    vat_code: 1
                                }]
                            }
                        },
                        "provider_token": process.env.igrikPaymentToken,
                        "currency": "RUB",
                        "prices": [{
                            "label": d.data.data.service.title,
                            "amount":  50000
                            // +price.data.data[0].price*100
                        }]
        
                    }

                    console.log(JSON.stringify(pd)) 

                    m.sendMessage2(pd, 'sendInvoice', token)
                }).catch(err=>{
                    console.log(err)
                })
                
            })


            usersClasses.add({
                appointment: appointment_id,
                name: d.data.data.service.title,
                user: id,
                date: d.data.data.start_date,
                createdAt: new Date(),
                active: true
            })

            // reportAdmins(`Гость ${id} записывается на занятие «${d.data.data.service.title}» на ${date}`,id)

        }).catch(err=>{
            console.log(err)
        })
            
        
        if(res) res.sendStatus(200)


    }).catch(err=>{

        console.log(err)
        m.sendMessage2({
            chat_id: id,
            text: 'Ивините, мест больше нет'
        },false,token)

        alertAdmin(`Ошибка записи на занятие ${err.message}`)
    })
}

function classCancel(id, utoken, appointment_id, res){
    axios.delete(`${process.env.igrik1Chost}/client_from_class?appointment_id=${appointment_id}`,{
        headers:{
            usertoken:          utoken || null,
            'apikey':           process.env.igrik1CapiKey,
            'Authorization':    process.env.igrik1CapiAuth
        }
    }).then(()=>{
        m.sendMessage2({
            chat_id: id,
            text: 'Печально... запись отменили. Может, в другой раз?'
        },false,token)

        usersClasses.where('user','==',id.toString()).get().then(col=>{
            
            let classes = col.docs.filter(c=>c.data().active && c.data().appointment == appointment_id);

            classes.forEach(a=>{
                usersClasses.doc(a.id).update({
                    active: false
                }).then(()=>{
                    console.log(`обновили`)
                }).catch(err=>{
                    console.log(err)
                })
            })
        })

        if(res) res.sendStatus(200)
    }).catch(err=>{

        console.log(err)

        m.sendMessage2({
            chat_id: id,
            text: 'Извините, сервис временно недоступен.'
        }, false, token)

        alertAdmin('ошибка подгрузки расписания: ' + err.message)
    })
}

function getSchedule(id, utoken, from, to) {

    if (!from) from = new Date().toISOString().split('T')[0];
    if (!to) to = new Date(+new Date(from) + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    axios.get(`${process.env.igrik1Chost}/classes/?start_date=${from}&end_date=${to}&club_id=${process.env.igrik1ClubId}`, {

        headers: {
            usertoken:          utoken || null,
            'apikey':           process.env.igrik1CapiKey,
            'Authorization':    process.env.igrik1CapiAuth
        }

    }).then(s => {
        s.data.data.sort((a,b)=> a.start_date < b.start_date ? -1 : 1).forEach(a => {
            sendAppointment(id,a)
        });
    }).catch(err => {
        m.sendMessage2({
            chat_id: id,
            text: 'Извините, сервис временно недоступен.'
        }, false, token)

        alertAdmin('ошибка подгрузки расписания: ' + err.message)
    })
}



function clearTgas(v) {
    if (!v) {
        v = ''
    }
    v = v.toString().replace(/<br>/, ' ')
    return v.toString().replace(/(\<(\/?[^>]+)>)/g, '').replace(/&nbsp;/g, ' ').replace(/&mdash/, '—')
}

function sendAppointment(id,a){

    console.log(a.service.id)
    console.log(pd[a.service.id])
    m.sendMessage2({
        chat_id: id,
        text: `${a.booked?'✔️':''}*${a.service.title}*${a.service.description? '\n_'+clearTgas(a.service.description)+'_':''}\n*Учитель:* ${a.employee.name}\n*Время:* ${new Date(a.start_date).toLocaleString('ru-RU',{
            month:  'long',
            day:    'numeric',
            hour:   '2-digit',
            minute: '2-digit'
        })} (${a.duration} мин.)${(pd[a.service.id] && pd[a.service.id].price) ? `\nСтоимость: ${pd[a.service.id].price} руб.` : ''}`,
        parse_mode: 'Markdown',
        reply_markup:{
            inline_keyboard:[[
                {text: `Открыть расписание`,web_app:{url:`${ngrok}/igrik/app?start=schedule`}}
            ]]
        }
    }, false, token)
}

function initInvite(message) {
    console.log('готовим инвайт')

    let phone = message.contact.phone_number.replace(/\+/, '')

    // parser.fromString(string);

    if(message.contact.vcard){
        console.log(parser.fromString(message.contact.vcard))   
    }

    if (message.contact.user_id) {
        console.log(message.contact.user_id)
        udb.doc(message.contact.user_id.toString()).get().then(u => {
            if (u.exists) {
                console.log('такой юзер уже есть')
                m.sendMessage2({
                    chat_id: message.from.id,
                    text: `Вы не поверите! ${message.contact.first_name} уже с нами )`
                }, false, token)

            } else {
                console.log('такого юзера пока нет')

                invitations.doc(message.contact.user_id.toString()).get().then(u => {
                    if (u.exists) {
                        console.log('такое приглашение уже есть')
                        m.sendMessage2({
                            chat_id: message.from.id,
                            text: `Спасибо! ${message.contact.first_name} уже была приглашена в клуб.`
                        }, false, token)
                    } else {
                        console.log('такого приглашения нет')
                        invitations.doc(message.contact.user_id.toString()).set({
                            createdAt:  new Date(),
                            data:       message.contact,
                            createdBy:  message.from.id
                        }).then(s => {
                            m.sendMessage2({
                                chat_id: message.from.id,
                                text: `Отлично! Просто перешлите следующее сообщение человеку, которого вы позвали:`
                            },false,token)
                            m.sendMessage2({
                                chat_id: message.from.id,
                                caption: `${common.greeting()}! Приглашаю тебя в кайфовый клуб! Просто нажми на кнопку ниже:`,
                                photo: `https://firebasestorage.googleapis.com/v0/b/igrikbot-dcd61.appspot.com/o/IGRIK_Bar%26Yoga_logo_ALLLL-24.jpg?alt=media&token=acc1119e-9b15-4b01-89b9-6517bd737c0e`,
                                reply_markup:{
                                    inline_keyboard:[[
                                        {text: 'igrik',url:`https://t.me/igrikyobot?start=campaign_userInvitations`}
                                    ]]
                                }
                            },'sendPhoto',token)

                            // m.sendMessage2({
                            //     chat_id: message.from.id,
                            //     text: `Спасибо! Сейчас ${message.contact.first_name} получит смс с приглашением...`
                            // }, false, token)

                            // getIikoToken().then(itoken => {
                            //     axios.post(`https://api-ru.iiko.services/api/1/loyalty/iiko/message/send_sms`, {
                            //         "phone": phone,
                            //         "text": "Приглашение в клуб...",
                            //         "organizationId": process.env.igrikiikoOgranizationId
                            //     }, {
                            //         headers: {
                            //             'Authorization': 'Bearer ' + itoken,
                            //             'Content-Type': 'application/json'
                            //         },
                            //     }).then(s => {
                            //         m.sendMessage2({
                            //             chat_id: message.from.id,
                            //             text: `Готово!`
                            //         }, false, token)
                            //     }).catch(err => {
                            //         m.sendMessage2({
                            //             chat_id: message.from.id,
                            //             text: `Что-то пошло не так: ${err.response.data.errorDescription}`
                            //         }, false, token)
                            //     })
                            // })

                            get1cAuthToken(phone).then(auth => {
                                post1CUser(phone, message.contact.user_id, message.contact.first_name, message.contact.last_name, auth.data.data.pass_token).then(auth => {
                                    userCustomField(auth.data.data.user_token, 'Кто пригласил', message.from.first_name + ' ' + message.from.last_name + ' (' + message.from.id + ')')

                                    getIikoToken().then(iikotoken => {
                                        axios.post(`https://api-ru.iiko.services/api/1/loyalty/iiko/customer/create_or_update`, {
                                            "phone": phone,
                                            "name": message.contact.first_name,
                                            "surName": message.contact.last_name,
                                            "userData": JSON.stringify({
                                                telegram: message.contact.user_id,
                                                id1c: auth.data.data.id
                                            }),
                                            "organizationId": process.env.igrikiikoOgranizationId
                                        }, {
                                            headers: {
                                                'Authorization': 'Bearer ' + iikotoken,
                                                'Content-Type': 'application/json'
                                            }
                                        })
                                    })
                                })
                            })
                        }).catch(err => {
                            console.log(err)
                        })
                    }
                }).catch(err => {
                    console.log(err)
                })
            }
        }).catch(err => {
            console.log(err)
        })
    } else {
        m.sendMessage2({
            chat_id: m.from.id,
            text: 'Упс! Кажется, этого человека еще нет в телеграме. Я не смогу его позвать...'
        }, false, token)
    }

}


function get1cAuthToken(phone) {
    return axios.get(`${process.env.igrik1Chost}/pass_token/?phone=${phone}&sign=${sha256(`phone:${phone};key:${process.env.secret1c}`)}`, {
        headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.igrik1CapiKey,
            'Authorization': process.env.igrik1CapiAuth
        }
    })
}

function getUserBalance(token){
    // return axios.get(`${process.env.igrik1Chost}/deposits`,{
    //     headers:{
    //         'apikey': process.env.igrik1CapiKey,
    //         'Authorization': process.env.igrik1CapiAuth,
    //         'usertoken': token
    //     }
    // })

    return axios.get(`${process.env.igrik1Chost}/tickets/?club_id=bbb226fa-8033-11ed-1b86-00505683b2c0`,{headers:{
        'apikey': process.env.igrik1CapiKey,
        'Authorization': process.env.igrik1CapiAuth,
        'usertoken': token
    }})
}

function userCustomField(user, parameter, value) {
    return axios.post(process.env.igrik1Chost + '/additional_client_parameter', {
        parameter: parameter,
        value: value
    }, {
        headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.igrik1CapiKey,
            'Authorization': process.env.igrik1CapiAuth,
            'usertoken': user
        }
    })
}

function post1CUser(phone, pass, name, last_name, token) {
    return axios.post(process.env.igrik1Chost + '/reg_and_auth_client', {
        "phone": phone,
        "password": pass,
        "last_name": last_name,
        "name": name,
        "second_name": null,
        "pass_token": token
    }, {
        headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.igrik1CapiKey,
            'Authorization': process.env.igrik1CapiAuth
        }
    })
}

function initConnection(message) {
    let phone = message.contact.phone_number.replace(/\+/, '')

    m.sendMessage2({
        chat_id: message.from.id,
        text: 'Вот это номер!\nЗапускаем процедуру регистрации.'
    }, false, token)
    updateUser(message.from.id, {
        phone: phone
    }).then(() => {
        get1cAuthToken(phone).then(auth => {
            updateUser(message.from.id, {
                pass_token: auth.data.data.pass_token
            }).then(() => {
                post1CUser(phone, message.from.id.toString(), message.from.first_name, message.from.last_name, auth.data.data.pass_token).then(user1c => {



                    updateUser(message.from.id, {
                        user_token: user1c.data.data.user_token,
                        id1c: user1c.data.data.id
                    }).then(() => {
                        m.sendMessage2({
                            chat_id: message.from.id,
                            text: 'Поздравляем! Теперь ты в кайф-клубе.'
                        }, false, token).then(() => {
                            // m.sendMessage2({
                            //     chat_id: message.from.id,
                            //     text: 'Приступаем к iiko'
                            // }, false, token)
                        })

                        getIikoToken().then(iikotoken => {
                            axios.post(`https://api-ru.iiko.services/api/1/loyalty/iiko/customer/create_or_update`, {
                                "phone": phone,
                                "name": message.from.first_name,
                                "surName": message.from.last_name,
                                "userData": JSON.stringify({
                                    telegram: message.from.id,
                                    id1c: user1c.data.data.id
                                }),
                                "organizationId": process.env.igrikiikoOgranizationId
                            }, {
                                headers: {
                                    'Authorization': 'Bearer ' + iikotoken,
                                    'Content-Type': 'application/json'
                                }
                            }).then(iiko => {
                                updateUser(message.from.id, {
                                    idIiko: iiko.data.id
                                }).then(() => {
                                    m.sendMessage2({
                                        chat_id: message.from.id,
                                        // text: 'Прекрасно! Ваш id в iiko: ' + iiko.data.id
                                        text: `А еще тебя ждут в баре )`,
                                        reply_markup: {
                                            resize_keyboard: true,
                                            keyboard: kbd(message.from.id)
                                        }
                                    }, false, token)
                                })
                            })
                        })
                    })
                }).catch(err => {
                    alertAdmin(`Ошибка регистрации в 1С`)
                    alertAdmin(JSON.stringify({
                        "phone": phone,
                        "password": message.from.id.toString(),
                        "last_name": message.from.last_name,
                        "name": message.from.first_name,
                        "second_name": message.from.username,
                        "pass_token": auth.data.data.pass_token
                    }, null, 2))
                    alertAdmin(err.message)
                })
            }).catch(err => {
                alertAdmin('Ошибка обновления pass_token для ' + message.from.id + ': ' + err.message)
            })
        }).catch(err => {
            console.warn(err)
            alertAdmin(err.message)
        })
    }).catch(err => {
        alertAdmin(err.message)
    })
}

router.post(`/api/tables`,(req,res)=>{
    udb.doc(req.body.user.toString()).get().then(u=>{
        if(!u.exists) return res.sendStatus(404)
        getIikoToken().then(token=>{
            axios.post(`https://api-ru.iiko.services/api/1/reserve/create`,{
                "organizationId": process.env.igrikiikoOgranizationId,
                "externalNumber": +new Date(),
                "terminalGroupId": "05f8c905-09bf-1845-0185-ce9af40d0064",
                "estimatedStartTime": req.body.date.split('T').join(' ')+':00.000',
                "customer":{
                    
                },
                "transportToFrontTimeout": 10*60,
                "phone":"+"+u.data().phone,
                "guests":{
                    "count": req.body.guests
                },
                "comment":"Тестовый резерв",
                "tableIds": [req.body.table],
                "durationInMinutes": 60,
                "shouldRemind": true
            },{
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            }).then(success=>{
                console.log(success.data)
                res.sendStatus(200)
                m.sendMessage2({
                    chat_id: req.body.user,
                    text: `Вы забронировали столик на ${new Date(req.body.date).toLocaleDateString()}`
                },false,token)
            }).catch(err=>{
                console.log(err)
                res.status(500).send(err.message)
            })
        })
})})

router.get(`/api/tables`,(req,res)=>{
    getIikoToken().then(token=>{
        axios.post(`https://api-ru.iiko.services/api/1/reserve/available_restaurant_sections`,{
            "terminalGroupIds": [
              "05f8c905-09bf-1845-0185-ce9af40d0064"
            ],
            "returnSchema": true
          },{
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        }).then(data=>{
            let possible = data.data.restaurantSections[0].tables.filter(t=>t.seatingCapacity>=+req.query.guests)
            if(possible.length){
                res.json(possible)
            } else {
                res.status(400).send('Извините, столов на такое количество гостей у нас нет')
            }
        })
    })
})

router.get(`/api/masters`,(req,res)=>{
    axios.get(`${process.env.igrik1Chost}/trainers`,{headers:{
        'apikey': process.env.igrik1CapiKey,
        'Authorization': process.env.igrik1CapiAuth
    }}).then(d=>res.json(d.data)).catch(err=>{
        res.status(500).send(err.message)
    })
})

router.get(`/api/masters/:id`,(req,res)=>{
    axios.get(`${process.env.igrik1Chost}/employee?employee_id=${req.params.id}`,{headers:{
        'apikey': process.env.igrik1CapiKey,
        'Authorization': process.env.igrik1CapiAuth
    }}).then(d=>res.json(d.data)).catch(err=>{
        res.status(500).send(err.message)
    })
})

router.get(`/api/checkUser`,(req,res)=>{
    admins.doc(req.query.admin.toString()).get().then(a=>{
        if(a.exists && a.data().confirmed){
            let d= [];

                d.push(udb.get().then(col=>common.handleQuery(col)))
                
                d.push(news.get().then(col=>col.docs.map(d=>{
                    let t = d.data()
                        t.id = d.id;
                    return t;   
                })))
            Promise.all(d).then(data=>{
                res.json({
                    users:  data[0],
                    news:   data[1]
                })
            })
        } else {
            res.sendStatus(403)
        }
    }).catch(err=>{
        console.log(err)
    })
})


router.get(`/api/user`,(req,res)=>{

    if(!req.query.id) return res.sendStatus(400)
    
    udb.doc(req.query.id.toString())
        .get()
        .then(d=>{
            admins.doc(req.query.id.toString()).get().then(admin=>{
                let data = d.data() || {};
                data.admin = admin.exists ? admin.data().confirmed : false 
                res.json(data)
            })
            
        })
        .catch(err=>{
            console.log(err)
            res.send(false)
        })
})

router.patch(`/api/user`,(req,res)=>{
    checkAdmin(req.body.admin).then(admin=>{
        if(admin) { 
            updateUser(req.body.user,req.body.update).then(()=>{
                res.sendStatus(200)
            }).catch(err=>{
                res.status(500).send(err.message)
            })
        } else {
            res.sendStatus(403)
        }
    })
})

router.get(`/api/user/deposit`,(req,res)=>{
    if(!req.query.id) return res.sendStatus(402)
    udb.doc(req.query.id.toString()).get().then(user=>{
        console.log(user.data())
        if(!user.exists) return res.sendStatus(404)
        if(user.data().user_token){
            getUserBalance(user.data().user_token).then(balance=>{
                res.json(balance.data);
            }).catch(err=>{

                console.log(err)

                if(err.response){
                    res.status(err.response.status).send(err.response.message);
                } else {
                    res.status(500).send(err.message)
                }
                
            })
        } else {
            res.status(400).send(`Мы не знаем сколько у вас денег, ведь вы не привязали свой номер телефона...`)
        }
        
    })
})

router.post(`/api/requestPhone`,(req,res)=>{
    console.log('запрос телефона')
    if(!req.query.id) return res.sendStatus(400);
    m.sendMessage2({
        chat_id: req.query.id,
        text: req.body.text || 'Чтобы получить полноценный доступ, отправьте мне свой телефон. просто нажмите на специальную кнопку ниже',
        reply_markup: {
            resize_keyboard: true,
            one_time_keyboard: true,
            keyboard: [
                [{
                    text: 'Отправить номер',
                    request_contact: true
                }]
            ]
        }
    }, false, token).then(()=>{
        res.sendStatus(200)
    }).catch(err=>{
        res.sendStatus(500)
    })
})



router.all(`/api/user/appointment`,(req,res)=>{
    console.log(req.query)
    switch(req.method){
        case 'POST':{
            classJoin(req.query.id,req.query.token,req.query.appointment,res,req.body)
            break;
        }
        case 'DELETE':{
            classCancel(req.query.id, req.query.token,req.query.appointment,res)
        }

    }
})

router.post(`/api/user/alerts`,(req,res)=>{
    udb.doc(req.body.id.toString()).get().then(d=>{
        if(d.exists) {
            udb.doc(req.body.id.toString())
                .update(req.body.alerts)
                .then(s=>res.sendStatus(200))
                .catch(err=>res.status(500).send(err.message))
        } else {
            res.sendStatus(404)
        }
    })
})

router.get(`/api/menu`,(req,res)=>{
    getIikoToken().then(t=>{
        axios.post(`https://api-ru.iiko.services/api/1/nomenclature`, {

            "organizationId": process.env.igrikiikoOgranizationId
        }, {
            headers: {
                'Authorization': 'Bearer ' + t,
                'Content-Type': 'application/json'
            }
        }).then(d=>res.json(d.data)).catch(err=>{
            res.status(500).send(err.message)
        })
    })
})

router.get(`/api/news`,(req,res)=>{
    news.where('active','==',true)
        // .orderBy('createdAt','desc')
        .get().then(col=>{
        let result = []

        col.docs.forEach(pub=>{
            
            let t = pub.data();
            t.id = pub.id
            if(!t.video){
                result.push(t)
            } else {
                result.push(axios.post(`https://api.telegram.org/bot${adminToken}/getFile`,{
                    file_id: pub.data().video
                }).then(s=>{
                    t.video = `https://api.telegram.org/file/bot${adminToken}/${s.data.result.file_path}`
                    return t
                }))
            }
        })

        Promise.all(result).then(d=>{
            res.json(d)
        })
    })
})

router.post(`/api/news`,(req,res)=>{
    if(!req.body.admin) return res.sendStatus(401)
    checkAdmin(req.body.admin).then(admin=>{
        if(admin){
            news.add({
                createdAt:  new Date(),
                text:       req.body.text || null,
                createdBy:  req.body.admin,
                title:      req.body.title || `Новость без заголовка`,
                active:     false,
                posted:     false,
                video:      req.body.video || null,
                photo:      req.body.photo || null
            }).then(rec=>{
                res.send(rec.id)
            }).catch(err=>{
                res.status(500).send(err.message)
            })
        } else {
            res.sendStatus(403)
        }    
    })
    
})

router.patch(`/api/news/:id`,(req,res)=>{
    checkAdmin(req.body.admin).then(admin=>{
        if(!admin) return res.sendStatus(403)
        news.doc(req.params.id).update(req.body.update)
            .then(()=>{res.sendStatus(200)})
            .catch(err=>res.status(500).send(err.message))
    })
})

function alertNews(user,publication){

    let message = {
        chat_id: user.id,
        text: `Хорошие новости!\n${publication.data().title}\n${publication.data().text}`
    }

    let method = 'sendMessage';

    if(publication.data().video){
        method  = 'sendVideo';
        message.caption = message.text;
        message.video = publication.data().video

        m.sendMessage2(message,method,token).then(()=>{
            newsPosts.add({
                createdAt:      new Date(),
                user:           user.id,
                publication:    publication.id
            })
        })
        
        // return axios.post(`https://api.telegram.org/bot${adminToken}/getFile`,{
        //     file_id: message.video
        // }).then(s=>{
        //     message.video = `https://api.telegram.org/file/bot${adminToken}/${s.data.result.file_path}`
            
            
        // })
    } else if (publication.data().photo) {
        method  =   'sendPhoto';
        message.caption = message.text;
        message.photo = publication.data().photo
        
        m.sendMessage2(message,method,token).then(()=>{
            newsPosts.add({
                createdAt:      new Date(),
                user:           user.id,
                publication:    publication.id
            })
        })

        // return axios.post(`https://api.telegram.org/bot${adminToken}/getFile`,{
        //     file_id: message.photo
        // }).then(s=>{
        //     message.photo = `https://api.telegram.org/file/bot${adminToken}/${s.data.result.file_path}`
            
            
        // })
    } else {
        m.sendMessage2(message,method,token).then(()=>{
            newsPosts.add({
                createdAt:      new Date(),
                user:           user.id,
                publication:    publication.id
            })
        })
    }


    
}


router.post(`/api/news/read`,(req,res)=>{
    if(!req.body.publication) return res.sendStatus(404)
    
    news.doc(req.body.publication).get().then(p=>{
        if(!p.exists) return res.sendStatus(404)

        news.doc(req.body.publication).update({
            views: FieldValue.increment(1)
        })

        newsReads.add({
            createdAt: new Date(),
            user: req.body.user,
            publication: req.body.publication
        })

        res.sendStatus(200)
    }).catch(err=>{
        res.status(500).send(err.message)
    })
    
    

})

router.post(`/api/news/:id`,(req,res)=>{
    checkAdmin(req.body.admin).then(admin=>{
        
        if(!admin) return res.sendStatus(403)

        news.doc(req.params.id).get().then(pub=>{
            console.log()
            if(!pub.exists) return res.sendStatus(404)
            udb.where('active','==',true).get().then(col=>{
                col.docs.forEach((user,i)=>{
                    // common.devlog(user.id)
                    setTimeout(function(){
                        alertNews(user,pub)    
                    },i*200)
                    // if(user.id == common.dimazvali){
                        
                        
                    // }
                    
                    
                })
            })
            news.doc(req.params.id).update({
                posted: true
            })
        })
    })
})



router.get(`/api/user/service`,(req,res)=>{
    let from, to;

    from = req.query.from;

    if (!from) from = (new Date()<new Date('2023-05-23') ? '2023-05-23' :  new Date().toISOString().split('T')[0]);
    if (!to) to = new Date(+new Date(from) + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    axios.get(`${process.env.igrik1Chost}/classes/?start_date=${from}&end_date=${to}&club_id=${process.env.igrik1ClubId}&service_id=${req.query.id}`, {

        headers: {
            usertoken:          req.query.utoken || null,
            'apikey':           process.env.igrik1CapiKey,
            'Authorization':    process.env.igrik1CapiAuth
        }

    }).then(s => {
        res.json(s.data.data.sort((a,b)=> a.start_date < b.start_date ? -1 : 1))
    }).catch(err => {
        (err.response ? 
            res.status(err.response.status).send(err.response.data)
            : res.status(500).send(err.message))

        alertAdmin('ошибка подгрузки расписания: ' + err.message)
    })
})

router.get(`/api/user/schedule`,(req,res)=>{

    let from, to;

    from = req.query.from;

    if(!req.query.id) return res.sendStatus(400)
    
    if (!from) from = (new Date()<new Date('2023-05-23') ? '2023-05-23' :  new Date().toISOString().split('T')[0]);
    if (!to) to = new Date(+new Date(from) + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    if(!req.query.filtered){
        axios.get(`${process.env.igrik1Chost}/classes/?start_date=${from}&end_date=${to}&club_id=${process.env.igrik1ClubId}`, {

            headers: {
                usertoken:          req.query.utoken || null,
                'apikey':           process.env.igrik1CapiKey,
                'Authorization':    process.env.igrik1CapiAuth
            }

        }).then(s => {

            

            res.json(s.data.data.sort((a,b)=> a.start_date < b.start_date ? -1 : 1))

            // m.sendMessage2({
            //     chat_id: common.dimazvali,
            //     text: `Запрос расписания от ${req.query.id}: ${from}, ${to}; ${s.data.data.length}`
            // },false,token)

        }).catch(err => {
            (err.response ? 
                res.status(err.response.status).send(err.response.data)
                : res.status(500).send(err.message))

            alertAdmin('ошибка подгрузки расписания: ' + err.message)
        })
    } else {
        axios.get(`${process.env.igrik1Chost}/appointments`,{
            headers: {
                usertoken:          req.query.utoken || null,
                'apikey':           process.env.igrik1CapiKey,
                'Authorization':    process.env.igrik1CapiAuth
            }
        }).then(s => {
            res.json(s.data.data.sort((a,b)=> a.start_date < b.start_date ? -1 : 1))
        }).catch(err => {
            (err.response ? 
                res.status(err.response.status).send(err.response.data)
                : res.status(500).send(err.message))

            alertAdmin('ошибка подгрузки расписания: ' + err.message)
        })
    }

    
})


function checkAdmin(id){
    if(!id) return false
    return admins.doc(id.toString()).get().then(a=>{
        if(a.exists && a.data().active) return true
        return false;
    }).catch(err=>{
        return false
    })
}

router.post(`/api/postMessage`,(req,res)=>{
    admins.doc(req.body.admin.toString()).get().then(a=>{
        if(a.exists && a.data().confirmed){
            messages.add({
                user:       +req.body.user,
                text:       req.body.text,
                createdAt:  new Date(),
                isReply:    req.body.admin
            }).then(s=>{
                
                m.sendMessage2({
                    chat_id: req.body.user,
                    text: req.body.text
                },false,token)

                udb.doc(req.body.user.toString()).update({
                    recentMessage: new Date()
                })
                
                res.sendStatus(201)

            }).catch(err=>{
                console.log(err)
                res.status(500).send(err.message)
            })
        }
    }).catch(err=>{
        console.log(err)
    })
})

function getUserMessages(id){
    console.log(id)
    return messages.where('user','==',id).orderBy('createdAt','desc').get()
    .then(m=>{
        console.log(m.docs)
        return m.docs.map(m=>m.data())
    }).catch(err=>{
        console.log(err)
        return []
    })
}

function alertAdmin(txt) {
    m.sendMessage2({
        chat_id: common.dimazvali,
        text: txt
    }, false, token)
}

router.post('/adminHook', (req, res) => {
    res.sendStatus(200)
    let user = {}
    user = req.body.message.from;

    if(req.body.message && req.body.message.chat_shared){
        m.sendMessage2({
            chat_id: req.body.message.chat_shared.chat_id,
            text: 'хэллоу'
        },false,adminToken)
    }

    console.log(JSON.stringify(req.body))

    admins.doc(user.id.toString()).get().then(u => {
        
    if (!u.exists) registerAdmin(user)

    if(req.body.message && req.body.message.video){
        m.sendMessage2({
            chat_id:    user.id,
            parse_mode: 'HTML',
            text:       'id видео (понадобится для публикации)\n<pre>'+req.body.message.video.file_id+'</pre>'
        },false,adminToken)
    }

    if(req.body.message && req.body.message.photo){
        m.sendMessage2({
            chat_id:    user.id,
            parse_mode: 'HTML',
            text:       'id фото (понадобится для публикации)\n<pre>'+req.body.message.photo.reverse()[0].file_id+'</pre>'
        },false,adminToken)
    }

    if(req.body.message.text == `/test`){
        m.sendMessage2({
            chat_id: user.id,
            text: `Приложенька с дева`,
            reply_markup:{
                inline_keyboard:[[{
                    text: `test`,
                    web_app: {
                        url: `${process.env.ngrok}/igrik/adminApp?action=start`
                    }
                }]]
            }
        },false,adminToken)
    }
    
}).catch(err=>{
        console.log(err)
    })
})


function dist(lat,long,toLat, toLong){
    return (Math.sqrt(Math.pow((lat - toLat) * 111.11, 2) + Math.pow((long - toLong) * 55.8, 2))).toFixed(3)
}

alertedUsers ={}

router.post('/hook', (req, res) => {

    res.sendStatus(200)

    let user = {}
    console.log(JSON.stringify(req.body))


    // if(req.body.edited_message && req.body.edited_message.location){
    //     let loc = req.body.edited_message.location;
    //     console.log(loc)
    //     let lookup= [
    //         {
    //             location: 'дома',
    //             lat: 41.695299,
    //             long: 44.856253
    //         },{
    //             location: 'магазина',
    //             lat: 41.697341,
    //             long: 44.855363
    //         }
    //     ]
        
    //     lookup.forEach(place=>{

    //         console.log(place)

    //         let distance = dist(loc.latitude,loc.longitude, place.lat, place.long)*1000
            
    //         console.log(place.location,distance)
            
    //         if(distance-loc.horizontal_accuracy < 30 ){

    //             console.log(`пользователь прибыл в точку ${place.location}`)
    //             if(!alertedUsers[req.body.edited_message.chat.id] || !alertedUsers[req.body.edited_message.chat.id][place.location]) m.sendMessage2({
    //                 chat_id: req.body.edited_message.chat.id,
    //                 text: `Вот вы и ${place.location}`
    //             },false,token)
                
                

    //             if(!alertedUsers[req.body.edited_message.chat.id]) alertedUsers[req.body.edited_message.chat.id] = {}
                
    //             alertedUsers[req.body.edited_message.chat.id][place.location] = true 
    //         } else {
    //             if(!alertedUsers[req.body.edited_message.chat.id]) alertedUsers[req.body.edited_message.chat.id] = {}
                
    //             if(alertedUsers[req.body.edited_message.chat.id][place.location]){
    //                 m.sendMessage2({
    //                     chat_id: req.body.edited_message.chat.id,
    //                     text: `Вы ушли из ${place.location}`
    //                 },false,token)
    //             }
    //             alertedUsers[req.body.edited_message.chat.id][place.location] = false
    //         }
    //     })

        
    // }


    if (req.body.update_id && req.body.message && req.body.message.contact) {

        if (req.body.message.contact.user_id == req.body.message.from.id) {
            initConnection(req.body.message)
        } else {
            initInvite(req.body.message)
        }

    } else if (req.body.message) {

        // сообщение
        user = req.body.message.from;

        udb.doc(user.id.toString()).get().then(u => {
            
            if (!u.exists) return registerUser(user)

            if (req.body.message.text && req.body.message.text.indexOf('/start campaign') == 0) {
                
                userTags.add({
                    user:       user.id.toString(),
                    tag:        req.body.message.text.split('/start campaign')[1],
                    createdAt:  new Date()
                })
            }

            if (req.body.message.text && req.body.message.text.indexOf('/start schedule') == 0) {
                askForDate(req.body.message.from.id);

            }

            
        })

        checkAdmin(user.id).then(admin=>{
            if(admin){
                if(req.body.message && req.body.message.video){
                    m.sendMessage2({
                        chat_id: user.id,
                        parse_mode: 'HTML',
                        text: 'id видео (понадобится для публикации)\n<pre>'+req.body.message.video.file_id+'</pre>'
                    },false,adminToken)
                }

                if(req.body.message && req.body.message.photo){
                    m.sendMessage2({
                        chat_id:    user.id,
                        parse_mode: 'HTML',
                        text:       'id фото (понадобится для публикации)\n<pre>'+req.body.message.photo.reverse()[0].file_id+'</pre>'
                    },false,adminToken)
                }
            }
        })

        messages.add({
            user:       user.id,
            text:       req.body.message.text || null,
            createdAt:  new Date(),
            isReply:    false
        })
        

        if(req.body.message.text == '/start'){
      
            return m.sendMessage2({
                chat_id: req.body.message.from.id,
                // text: 'Прекрасно! Ваш id в iiko: ' + iiko.data.id
                text: `Как давно мы не встречались!..\nКуда хочешь: на йогу — или сразу в бар?..`,
                reply_markup: {
                    resize_keyboard: true,
                    keyboard: kbd(req.body.message.from.id)
                }
            }, false, token).then(d=>console.log(d)).catch(err=>console.log(err.message))
        } else if (req.body.message.text == '/test') {
                m.sendMessage2({
                    chat_id: user.id,
                    text: `Приложенька с дева`,
                    reply_markup:{
                        inline_keyboard:[[{
                            text: `test`,
                            web_app: {
                                url: `${process.env.ngrok}/igrik/app`
                            }
                        }]]
                    }
                },false,token)

                m.sendMessage2({
                    chat_id: user.id,
                    text: `Админка с дева`,
                    reply_markup:{
                        inline_keyboard:[[{
                            text: `test`,
                            web_app: {
                                url: `${process.env.ngrok}/igrik/appApp`
                            }
                        }]]
                    }
                },false,token)
        } else if (req.body.message.text == '/schedule') {
            askForDate(req.body.message.from.id);
        } else if (req.body.message.text == '/myschedule') {
            console.log('мое расписание')
            udb.doc(req.body.message.from.id.toString()).get().then(u=>{
                if(u.data().user_token){
                    showUserSchedule(req.body.message.from.id, u.data().user_token);
                } else {
                    m.sendMessage2({
                        chat_id: req.body.message.from.id,
                        text: 'Жаль, но ты еще не в клубе. Пожалуйста, пришли свой номер телефона, чтобы вступить.'
                    },false,token)
                }
            }).catch(err=>{
                console.log(err)
            })
            
        } else {

            if (req.body.message.successful_payment) {
                m.sendMessage2({
                    chat_id: user.id,
                    text: `Отлично! Платеж на сумму ${common.cur(req.body.message.successful_payment.total_amount/100,'RUB')} успешно принят. Ваш счет в приложении обновится в течение пары минут.`,
                    reply_markup: {
                        resize_keyboard: true,
                        keyboard: kbd(user.id)
                    }
                },false,token)

                alertAdmins(user.id, `Пришел платеж на сумму ${common.cur(req.body.message.successful_payment.total_amount/100,'RUB')}: ${JSON.stringify(req.body,null,2)}`)
            } else if(!req.body.message.photo && !req.body.message.video && !(req.body.message.text == `/start`)){

                console.log('непонятное обращение от '+user.id)

                m.sendMessage2({
                    chat_id: user.id,
                    text: `Извини, я не понял, о чем ты. Передам умникам, пусть разбираются…`,
                    reply_markup: {
                        resize_keyboard: true,
                        keyboard: kbd(user.id)
                    }
                },false,token)
    
                alertAdmins(user,req.body.message.text)
            } else {
                common.devlog(!req.body.message.video, !(req.body.message.text == `/start`))
            }

            
        }

    } else if (req.body.callback_query) {

        console.log('колбэк')

        m.sendMessage2({
            callback_query_id: req.body.callback_query.id,
            text: `секундочку`
        }, 'answerCallbackQuery',token)

        udb.doc(req.body.callback_query.from.id.toString()).get().then(u=>{
            if(!req.body.callback_query.data.indexOf('schedule')) getSchedule(req.body.callback_query.from.id,u.data().user_token,req.body.callback_query.data.split('_')[1])
            if(!req.body.callback_query.data.indexOf('join')) classJoin(req.body.callback_query.from.id,u.data().user_token,req.body.callback_query.data.split('_')[1])
            if(!req.body.callback_query.data.indexOf('cancel')) classCancel(req.body.callback_query.from.id,u.data().user_token,req.body.callback_query.data.split('_')[1])
            if(!req.body.callback_query.data.indexOf('request_contact')) axios.post(ngrok+`/igrik/api/requestPhone?id=${req.body.callback_query.from.id}`,{
                text: `Прошу!`
            })
        })
        

        // коллбэк
    } else if (req.body.chosen_inline_result) {
        // инлайн
    } else if (req.body.my_chat_member) {
        // удаляшка
    } else if (req.body.pre_checkout_query){
        console.log('это платеж')
        m.sendMessage2({
            ok: true,
            pre_checkout_query_id: req.body.pre_checkout_query.id
        },'answerPreCheckoutQuery',token).then(s=>{
            console.log(s.data)
        }).catch(err=>{
            console.log(err)
        })
    }
})


module.exports = router;