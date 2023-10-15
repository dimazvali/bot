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
}, 'kaha');

let fb = getFirestore(gcp);


let token = process.env.kahaToken

let ngrok = process.env.ngrok


// axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/kaha/hook`).then(r => {
//     console.log(`kaha token set`)
// })



let udb = fb.collection('kahaUsers');
let messages = fb.collection('kahaUserMessages');
let orders = fb.collection('kahaOrders');

let startMessage = `Привет! Я Каха. И я продаю спирт за 11 лари / литр. Тут все просто: делаете заказ (от 5 литров; от 40 литров — скидка), оставляете адрес — в следующую среду я буду у вас на пороге. Погнали!`

let users = {}

function registerUser(u) {

    u.createdAt = new Date();
    u.active = true;
    u.blocked = false;
    u.bonus = true;

    users[u.id] = u;


    udb.doc(u.id.toString()).set(u).then(() => {

        m.sendMessage2({
            chat_id: u.id,
            text: startMessage,
            // reply_markup: {
            //     inline_keyboard: [
            //         [{
            //             text: `Показать все`,
            //             callback_data: `discount_all`
            //         }],
            //         [{
            //             text: `Посмотреть рестораны`,
            //             callback_data: `restaurants_all`
            //         }]
            //     ]
            // }
        }, false, token)

        let d = u;
        d.intention = 'newUser'
        d.id = u.id
        d.createdAt = new Date().toISOString()

        alertAdmins({
            type: 'newUser',
            text: `Новый пользователь бота:\n${JSON.stringify(u,null,2)}`,
            user_id: u.id
        })

    }).catch(err => {
        console.log(err)
    })
}


function alertAdmins(message) {
    udb.where(`admin`, '==', true).get().then(admins => {
        admins.docs.forEach(a => {
            message.chat_id = a.id
            if (message.type != 'stopLog' || !a.data().stopLog) m.sendMessage2(message, false, token)
        })
    })
}

router.get('/app', (req, res) => {

    devlog(req.query)

    res.render('kaha/app', {
        user: req.query.id,
        start: req.query.start,
        translations: translations,
    })
})


router.get('/test', (req, res) => {
    m.sendMessage2({
        chat_id: req.query.id || common.dimazvali,
        text: `Приложенька с дева`,
        reply_markup: {
            inline_keyboard: [
                [{
                    text: `test`,
                    web_app: {
                        url: `${process.env.ngrok}/kaha/app`
                    }
                }]
            ]
        }
    }, false, token)
    res.sendStatus(200)
})


router.all('/api/:type/:id', (req, res) => {
    switch (req.params.type) {
        case 'profile': {
            m.getUser(req.params.id, udb).then(u => {
                if (!u) return res.sendStatus(404)
                let plausible = [
                    'first_name',
                    'last_name',
                    'about',
                    'deliveryAddress',
                    'barName'
                ]
                let upd = []
                plausible.forEach(type => {
                    if (req.body[type]) {
                        udb.doc(req.params.id).update({
                            [type]: req.body[type]
                        })
                        upd.push(true)
                    }
                })
                res.send(`${upd.length} fields updated`)
            })
            break;
        }
        case 'order': {
            let orderRef = orders.doc(req.params.id);
            orderRef.get().then(o => {
                
                let order = o.data();

                if (!o.exists) return res.status(400).send('Нет такого заказа')
                switch (req.method) {
                    case 'POST':{
                        return isAdmin(req.query.user).then(admin=>{
                            if(!admin) return res.sendStatus(403)
                            if(!req.body.status) return res.sendStatus(400)
                            
                            orderRef.update({
                                updatedAt:      new Date(),
                                deliveredAt:    new Date(),
                                updatedBy:      +req.query.user,
                                status:         req.body.status,
                                active:         req.body.active || false
                            })

                            m.sendMessage2({
                                chat_id: order.user,
                                text:   `Ваш заказ на ${order.volume} л. выдан. Если это не так — немедленно сообщите об этом.`
                            },false,token)

                        })
                        break;
                    }
                    case 'DELETE': {
    
                            let pass = true;
    
                            if (req.query.admin) {
                                pass = isAdmin(req.query.user)
                            }
    
    
    
                            Promise.resolve(pass).then(admin => {
                                devlog(admin)
    
                                
    
                                if ((req.query.admin && !admin) || (!admin && (!req.query.user || order.user !== +req.query.user))) return res.sendStatus(403)
    
    
    
                                m.getUser(req.query.user, udb).then(u => {
                                    if (u.blackList || !u) return res.sendStatus(400)
    
                                    if (!order.active) return res.status(400).send('Заказ уже отменен!')
    
                                    orders.doc(req.params.id).update({
                                        active: false,
                                        cancelledBy: +req.query.user,
                                        status: cancelled
                                    }).then(() => {
                                        res.sendStatus(200)
                                    })
    
                                    if (admin && req.query.admin) {
                                        m.sendMessage2({
                                            chat_id: order.user,
                                            text: `Ваш заказ на ${order.volume} л. был отменен администратором.`
                                        }, false, token)
                                    }
    
                                    alertAdmins({
                                        text: `${uname(u,u.id)} отменяет заказ на ${order.volume} литров по адресу ${order.address}.`
                                    })
                                })
                            })
                    }
                    default: {
                        res.sendStatus(404)
                    }
                }
            })
            

            break;
        }
        default:
            res.sendStatus(404)
    }
})

function isAdmin(id) {

    devlog(id)

    return udb.doc(id || 'noWay').get().then(a => {

        devlog(a.data())

        if (!a.exists) return false
        if (a.data().admin) return true
        return false
    }).catch(err => {
        devlog(err)
        return false
    })
}

router.get(`/api/:type`, (req, res) => {
    switch (req.params.type) {
        case 'userHistory':{
            devlog('история заказов')
            return m.getUser(req.query.user,udb).then(user=>{

                devlog(user)
                
                if(!user) return res.json({
                    success: false,
                    comment: `Такого пользователя в системе нет.`
                })

                if(user.blocked) return res.json({
                    success: false,
                    comment: `Ваш доступ огранчиен.`
                })

                

                orders
                    .where('user','==',+req.query.user)
                    .orderBy('createdAt','desc')
                    .get()
                    .then(col=>{
                        res.json({
                            success: true,
                            orders: common.handleQuery(col)
                        })
                    }).catch(err=>{
                        console.log(err)
                        res.status(500).send(err.message)
                    })
            }).catch(err=>{
                console.log(err)
            })
        }

        case 'userData': {

            if (!req.query.user) return res.status(400)

            udb.doc(req.query.user.toString()).get().then(d => {
                if (!d.exists) return res.sendStatus(404)

                return res.json(d.data())
            }).catch(err => {
                return res.status(500).send(err.message)
            })

            break;
        }
        case 'user': {
            if (!req.query.id) return res.status(400)

            let warning = null;



            udb.doc(req.query.id).update({
                appOpens: FieldValue.increment(1)
            }).then(() => {

            }).catch(err => {
                warning = 'noUser';
            })

            return udb.doc(req.query.id).get().then(u => {
                u = u.data()

                if (!u) {
                    return res.json({
                        warning: warning,
                        admin: false,
                    })
                }

                if (u.blocked) {
                    return res.json({
                        warning: 'userBlocked'
                    })
                }

                let data = [];

                data.push(orders
                    .where('active', '==', true)
                    .where('user', '==', +req.query.id)
                    .get()
                    .then(col => {
                        console.log(col.docs.length)
                        return common.handleQuery(col)
                    })
                )



                Promise.all(data).then(data => {
                    return res.json({
                        warning: warning,
                        admin: u.admin,
                        noSpam: u.noSpam,
                        deliveryAddress: u.deliveryAddress,
                        barName: u.barName,

                        orders: data[0]
                    })
                })





            })
            break;
        }
        case 'orders': {
            return isAdmin(req.query.admin).then(a => {
                if (!a) return res.sendStatus(404)

                let ref = orders.orderBy('createdAt','desc');
                
                if(!req.query.all) ref = ref.where('active', '==', true)

                ref
                    .get().then(col => {
                    users = [];

                    let orders = common.handleQuery(col);

                    orders.forEach(o => {

                        users.push(udb.doc(o.user.toString()).get().then(u => {
                            let t = u.data();
                            t.id = o.user;
                            return t
                        }))


                    })

                    Promise.all(users)
                        .then(users => {
                            console.log(users)
                            res.json({
                                orders: orders,
                                users: users
                            })
                        }).catch(err => {
                            console.log(err)
                        })
                })
            })
            break;
        }
        case 'users':{
            return isAdmin(req.query.admin).then(a=>{
                if(!a) return res.sendStatus(403)

                udb.orderBy('createdAt','desc').get().then(col=>res.json({
                    success: true,
                    clients: common.handleQuery(col)
                }))
            })
        }
        default:
            return res.json([])
    }
})

function getDueDate(){
    let i = 0;
    while (i<7){
        let day = new Date(+new Date()+i*1000*60*60*24) 
        if(day.getDay() == 3){
            return day.toISOString().split('T')[0] 
        }
        i++
    }
}

router.post(`/api/order`, (req, res) => {
    if (!req.body.volume || req.body.volume < 5) return res.json({
        success: false,
        comment: `Я принимаю заказы от 5 литров.`
    })

    if (!req.body.deliveryAddress) return res.json({
        success: false,
        comment: `Я не понял, куда отвезти заказ.`
    })

    m.getUser(req.body.user, udb).then(u => {
        if (!u) return res.json({
            success: false,
            comment: `Кажется, мы еще не знакомы.`
        })

        if (u.blocked) return res.json({
            success: false,
            comment: `Извините, я вам не продам`
        })

        orders.add({
            active: true,
            createdAt: new Date(),
            dueDate: getDueDate(),
            user: req.body.user,
            volume: req.body.volume,
            address: req.body.deliveryAddress,
            notes: req.body.notes || null
        }).then(rec => {
            res.json({
                success: true,
                order: rec.id
            })

            m.sendMessage2({
                chat_id: req.body.user,
                text: `Вы оформили заказ на ${req.body.volume} л.\nАдрес доставки: ${req.body.deliveryAddress}.\nПримечания: ${req.body.notes||`не указаны`}\nОжидаемое время доставки: ${getDueDate()}.`
            },false,token)

            alertAdmins({
                text: `${uname(u,u.id)} делает заказ на ${req.body.volume} литров по адресу ${req.body.deliveryAddress}.`
            })
        })
    })
})

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

            switch (req.body.message.text) {

                case '/orders': {
                    return orders
                        .where('active', '==', true)
                        .where('user', '==', user.id)
                        .get()
                        .then(col => {
                            common.handleQuery(col).forEach(d => {
                                sendDiscount(d, d.id, user)
                            })
                            if (!col.docs.length) m.sendMessage2({
                                chat_id: user.id,
                                text: `Кажется, вы еще не заказывали. Откройте приложение и сделайте шаг навстречу прекрасному (спирту).`
                            }, false, token)
                        })
                }
                case '/test': {
                    m.sendMessage2({
                        chat_id: req.query.id || common.dimazvali,
                        text: `Приложенька с дева`,
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: `test`,
                                    web_app: {
                                        url: `${process.env.ngrok}/kaha/app`
                                    }
                                }]
                            ]
                        }
                    }, false, token)
                }
                default: {
                    m.getUser(user.id, udb).then(data => {
                        if (!data || data.freeze || data.freeze > new Date()) {
                            m.sendMessage2({
                                chat_id: user.id,
                                text: `Передаю ваши слова админу. Ждите ответа`
                            }, false, token)
                        }
                    })
                    try {
                        udb.doc(user.id.toString()).get().then(user => {
                            if (user.exists) {
                                udb.doc(user.id.toString()).update({
                                    freeze: new Date(new Date() + 5 * 60 * 1000)
                                })
                            }
                        })

                    } catch (err) {
                        devlog(err.message)
                    }


                    break;
                }
            }
        }


        if (req.body.callback_query) {


            user = req.body.callback_query.from;

            let inc = req.body.callback_query.data.split('_')

            devlog(inc)

            switch (inc[0]) {
                case 'venue': {
                    return m.sendMessage2({
                        callback_query_id: req.body.callback_query.id,
                        show_alert: true,
                        text: `Извините, Эта функция все еще в разработке.`
                    }, 'answerCallbackQuery', token)
                }
                case 'discount': {
                    switch (inc[1]) {
                        case 'all': {
                            return discounts.where('active', '==', true).get().then(col => {
                                common.handleQuery(col).forEach(d => {
                                    sendDiscount(d, d.id, user)
                                })
                            })
                        }
                        default: {
                            return discounts.doc(inc[1]).get().then(d => {
                                sendDiscount(d.data(), d.id, user)
                            })
                        }
                    }

                }
                case 'restaurant': {
                    switch (inc[1]) {
                        case 'all': {
                            return restaurants.where('active', '==', true).get().then(col => {
                                common.handleQuery(col).forEach(d => {
                                    sendVenue(d, d.id, user, req.body.callback_query)
                                })
                            })
                        }
                        default: {
                            return restaurants.doc(inc[1]).get().then(d => {
                                sendVenue(d.data(), d.id, user, req.body.callback_query)
                            })
                        }
                    }
                }
                case 'buy': {
                    return discounts.doc(inc[1]).get().then(d => {
                        d = d.data();

                        if (!d.active) {
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
                                "amount": Math.round(d.price * d.value) * 100
                            }]
                        }, 'sendInvoice', token)


                    })
                }
                default: {
                    return m.sendMessage2({
                        callback_query_id: req.body.callback_query.id,
                        show_alert: true,
                        text: `Извините, Эта функция все еще в разработке.`
                    }, 'answerCallbackQuery', token)
                }
            }
        }
    } catch (err) {
        console.log(err)
    }



})


const translations = {
    notesPlaceHolder: {
        ru: 'Например, вы можете дозаказать настойки «Чернобыль» или «Тао»',
        en: 'You can also reserve some Chernobyl or Tao tinctures'
    },
    notes: {
        ru: 'Особые пожелания',
        en: 'Notes'
    },
    deliveryAddress: {
        en: 'address',
        ru: 'адрес доставки'
    },
    barName: {
        en: 'You venue\'s name',
        ru: 'Название вашего заведения'
    },
    notifications: {
        ru: `Получать сообщения о новых событиях`,
        en: `Subscribe to upcomning events`
    },
    unsubscribe: {
        ru: `Отписаться от новостей`,
        en: 'Unsubscribe'
    },
    unsubscribeMessage: {
        ru: `Итак, вы отписаны. Но всегда можете передумать — и подписаться на новые лекции через приложение (раздел «Профиль»).`,
        en: `You won't get any messages about upcoming events. If can turn them on again in Profile section of the built-in app.`
    },
    toKnow: {
        en: `30 GEL per day. The first day is for free.`,
        ru: `Стоимость — 30 лари в день, первый тестовый день — бесплатно.`
    },
    iliani: {
        en: '1/10 Veriko Anjaparidze St, Tbilisi, Georgia',
        ru: `Тбилиси, Улица Верико Анджапаридзе, 1/10.`,
        ka: `1/10 ვერიკო ანჯაფარიძის ქუჩა, თბილისი`
    },
    address: {
        en: 'Address',
        ru: 'Адрес'
    },
    contacts: {
        ru: `Контакты`,
        en: `Contacts`
    },
    undeposit: (v, left) => {
        return {
            ru: `С вашего счета было списано ${common.cur(+v,'GEL')}.`,
            en: `${common.cur(+v,'GEL')} was withdrawn from your account.`
        }
    },
    deposit: (v, left) => {
        return {
            ru: `На ваш счет было зачислено ${common.cur(+v,'GEL')}.`,
            en: `${common.cur(+v,'GEL')} was deposited on your account`
        }
    },
    welcomeOnPremise: {
        ru: `Добро пожаловать! Ваш билет был принят.\nЕсли произошла ошибка и вы не находитесь в Papers, пожалуйста, напишите об этом.`,
        en: `Glad to see you on premise.\nIf there's been a mistake and you are not in Papers Space right now, please, write about immediately.`
    },
    roomBlocked: {
        ru: `Извините, в этот день комната закрыта на спецобслуживание.`,
        en: `We're sorry, but the room is closed on that day.`
    },
    coworkingBookingConfirmedBonus: {
        ru: `Ждем вас по адресу 1 Veriko Anjaparidze (вход под вывеской ILIANI Hotel), c 9:00 до 21:00.  Если у вас будут вопросы, пишите прямо в чат-бот, и наш администратор вам ответит.`,
        en: 'We are waiting for you at 1 Veriko Anjaparidze (entrance under the sign of ILIANI Hotel), from 9:00 to 21:00. If you have any questions, write directly to the chatbot and our administrator will answer you.',
        ka: `გელოდებით ვერიკო ანჯაფარიძის 1-ში (შესასვლელი სასტუმრო ილიანის ნიშნით), 9:00-დან 21:00 საათამდე. თუ თქვენ გაქვთ რაიმე შეკითხვები, მოგვწერეთ პირდაპირ ჩატბოტზე და ჩვენი ადმინისტრატორი გიპასუხებთ.`
    },
    coworkingInit: {
        ru: `Прежде чем записаться, пожалуйста, заполните профиль. Помимо всего, напишите 3 предложения о себе: мы будем рады узнать, с кем мы делим пространство.`,
        en: `Please complete your profile before enrolling. Above all, write 3 sentences about yourself: we'd love to know who we're sharing the space with.`,
        ka: `გთხოვთ შეავსოთ თქვენი პროფილი რეგისტრაციამდე. უპირველეს ყოვლისა, დაწერეთ 3 წინადადება თქვენს შესახებ: ჩვენ გვსურს ვიცოდეთ ვისთან ერთად ვიზიარებთ სივრცეს.`
    },
    app: {
        ru: `Приложение`,
        en: 'App',
        ka: `App`
    },
    about: {
        en: `About`,
        ru: `Пару слов о себе`
    },
    media: {
        en: `Journalism`,
        ru: `Журналистика`
    },
    lawyer: {
        en: `Law`,
        ru: `Юриспруденция`
    },
    advertisement: {
        en: `PR & Advertisement`,
        ru: `Реклама и PR`
    },
    it: {
        en: `IT`,
        ru: `IT`
    },
    other: {
        en: `Other`,
        ru: `Другое`
    },

    profileSubTitle: {
        en: `Nice to meet you, by the way.`,
        ru: `Видим вас как наяву.`
    },
    dataMissing: {
        ru: `Прежде чем записаться, пожалуйста, заполните профиль. Помимо всего, напишите 3 предложения о себе: мы будем рады узнать, с кем мы делим пространство.`,
        en: `Please complete your profile before enrolling. Above all, write 3 sentences about yourself: we'd love to know who we're sharing the space with.`,
        ka: `გთხოვთ შეავსოთ თქვენი პროფილი რეგისტრაციამდე. უპირველეს ყოვლისა, დაწერეთ 3 წინადადება თქვენს შესახებ: ჩვენ გვსურს ვიცოდეთ ვისთან ერთად ვიზიარებთ სივრცეს.`
    },
    fellow: {
        ru: `Поздравляем! Вы зарегистрированы в программе fellows!`,
        en: `Congrats! You're in the fellows team!`
    },
    coworkingBookingDetails: (date, name, lang) => {
        return {
            ru: `Вы записались в коворкинг (${translations.room[lang] || translations.room.en} ${name}) на ${drawDate(date,lang)}.`,
            en: `You booked a place at ${translations.room[lang] || translations.room.en} ${name} on ${drawDate(date,lang)}.`
        }
    },
    save: {
        ru: `Сохранить`,
        en: 'Save and close'
    },
    saved: {
        ru: `Записано!`,
        en: 'Saved'
    },
    seats: {
        ru: `мест`,
        en: 'seats'
    },
    floor: {
        ru: `Этаж`,
        en: 'Floor'
    },
    room: {
        ru: `Кабинет`,
        en: 'Room'
    },
    mr: {
        ru: `Переговорка`,
        en: 'Meeting room'
    },
    bookOn: (d) => {
        return {
            ru: `Забронировать на ${d}`,
            en: `Book on ${d}`
        }
    },
    unbookOn: (d) => {
        return {
            ru: `Снять бронь на ${d}`,
            en: `Cancel on ${d}`
        }
    },
    enlisted: {
        ru: `вы записаны`,
        en: `your are in`
    },
    noOccupationProvided: {
        ru: 'Прежде, чем записаться в коворкинг, вам надо указать сферу своей деятельности. Пожалуйста, перейдите в "профиль" и внесите контактные данные',
        en: 'You haven\'t set your occupation yet. Please, provide your contacts in the Profile section.'
    },
    noEmailProvided: {
        ru: 'Прежде, чем записаться в коворкинг, вам надо указать свою почту. Пожалуйста, перейдите в "профиль" и внесите контактные данные',
        en: 'You haven\'t set your email yet. Please, provide your contacts in the Profile section.'
    },
    email: {
        ru: 'email',
        en: 'email'
    },
    name: {
        ru: 'Имя',
        en: 'First name',
        ka: 'სახელი'
    },
    sname: {
        ru: 'Фамилия',
        en: 'Family name',
        ka: 'გვარი'
    },
    occupation: {
        ru: 'укажите род деятельности',
        en: 'what\'s you occupation',
        ka: 'საქმიანობის სფერო'
    },
    loading: {
        ru: 'Загружаем данные',
        en: 'Loading data',
        ka: 'ვტვირთავთ ინფორმაციას'
    },
    profile: {
        ru: 'Профиль',
        en: 'Profile',
        ka: 'პროფილი'
    },
    coworkingRules: {
        ru: 'Смотреть правила',
        en: 'See rules',
        ka: 'იხილეთ წესები'
    },
    classClosed: (c) => {
        return {
            en: `We are sorry to inform you, that ${eTypes[c.type].en} ${c.name} was cancelled. Stay tuned, we're gonna come up with even better events.`,
            ru: `Случилось страшное: ${eTypes[c.type].ru} «${c.name}» отменяется.\nНадеемся увидеть вас на других мероприятиях. Остаемся на связи.`,
            ka: `ბოდიშს გიხდით გაცნობებთ, რომ ${eTypes[c.type].ka} ${c.name} გაუქმდა. თვალყური ადევნეთ, ჩვენ კიდევ უფრო კარგ მოვლენებს მოვაწყობთ`
        }
    },
    yourCode: {
        ru: 'Ваш код (вместо билета, лучше него)',
        en: `Your entrance code`,
        ka: 'თქვენი ბილეთის კოდი'
    },
    newLecture: (l) => {
        return {
            ru: `Отличные новости! Мы подготовили ${eTypes[l.type].nom}: «${l.name}».${l.author ? ` Ее проведет ${l.author}` : ''}, ${new Date(l.date).toLocaleDateString()}.\nНачало в ${new Date(l.date).toLocaleTimeString(
                'ru-RU',{
                    timeZone: 'Asia/Tbilisi'
                }
            )}${l.price?`\nСтоимость: ${common.cur(l.price,'GEL')}`:''}`,
            en: `Hello there! We have a new ${eTypes[l.type].en} coming: ${l.name} by ${l.author} on ${new Date(l.date).toLocaleDateString()}.`,
            ka: `გაუმარჯოს! ჩვენ გვაქვს ახალი ${eTypes[l.type].ka} მომავალი: ${l.name} ${l.author}-ის მიერ ${new Date(l.date).toLocaleDateString()}`
        }
    },
    tellMeMore: {
        ru: 'Подробнее',
        en: 'More',
        ka: 'დამატებითი ინფორმაცია'
    },
    coworkingReminder: (hall) => {
        return {
            ru: `Доброе утро! Просто напоминаю, что сегодня вас ждут в коворкинге. Комната ${hall.name}, ${hall.floor} этаж.`,
            en: `Good morning! Looking forward to meet you at our coworking. Room ${hall.name}, on the ${hall.floor}.`,
            ka: `დილა მშვიდობისა! გახსენებთ, რომ დღეს თქვენ ხართ ჩაწერილი კოვორკინგში. ოთახი ${hall.name}, ${hall.floor} სართული`
        }
    },
    mrReminder: (t) => {
        return {
            ru: `Напоминаем, что через пару минут (в ${t}) для вас забронирована переговорка.`,
            en: `Just to remind you, that you have booked a meeting room on ${t}.`,
            ka: `შეგახსენებთ, რომ 2 წუთში ${t}-ზე თქვენ გაქვთ ჩაწერა საკონფერენციო ოთახში`
        }
    },
    schedule: {
        ru: 'События',
        en: 'Events',
        ka: 'განრიგი'
    },
    coworking: {
        ru: 'Записаться в коворкинг',
        en: 'Coworking',
        ka: 'კოვორკინგი'
    },
    mr: {
        ru: 'Переговорка',
        en: 'Meeting Room',
        ka: 'საკონფერენციო ოთახი'
    },
    paymentTitleClass: (l) => {
        return {
            ru: `Оплата лекции ${l.name}`,
            en: `Payment for the lecture ${l.name}`,
            ka: `ლექციის გადახდა ${l.name}`
        }
    },
    nosais: {
        ru: `Извините, я не знаю такой команды. Уведомлю админа; кажется, что-то пошло не так...`,
        en: `Beg your pardon, I have no idea what to do about this task. I shall talk to my master...`,
        ka: 'გიხდით ბოდიშს, ასეთ ბრძანებას ვერ ვიგებ. ადმინისტრატორზე გადაგრთავთ.'
    },
    congrats: {
        en: 'Welcome aboard! You are registered as coworker.',
        ru: 'Поздравляем, вы зарегистрированы как сотрудник papers',
        ka: 'გილოცავთ, თქვენ დარეგისტრირდით როგორც Papers-ის თანამშრომელი'
    },
    book: {
        ru: 'Записаться',
        en: 'Book a place',
        ka: 'ჩაწერვა'
    },
    noFee: {
        ru: 'Вход бесплатный ',
        en: 'Free admittance',
        ka: 'უფასო შესვლა'
    },
    fee: {
        ru: 'Стоимость ',
        en: 'Entry fee ',
        ka: 'შესვლა'
    },
    hall: {
        ru: 'Зал',
        en: 'Hall'
    },
    author: {
        ru: 'Спикер',
        en: 'Speaker',
        ka: 'ავტორი'
    },
    minutes: {
        ru: 'минут',
        en: 'minutes',
        ka: 'წუთი'
    },
    bookHall: {
        ru: 'Забронировать зал',
        en: 'Book the space',
        ka: 'ოთახია დაჯავშნა'
    },
    hallSchedule: {
        ru: 'Посмотреть график',
        en: 'Schedule',
        ka: 'განრიგის ნახვა'
    },
    intro: {
        ru: `Добро пожаловать в пространство PAPERS от Paper Kartuli.Тут можно забронировать место в коворкинге или переговорке, посмотреть расписание лекций, — или сразу пройти в бар.\nУдобнее всего пользоваться ботом с помощью приложения: вот эта кнопочка внизу (или в нижнем левом углу).Вы можете записаться на бесплатный тестовый день в коворкинге. Следующие дни — по стандартному тарифу (30 GEL в день, оплата на месте). Для аренды переговорки или ивент-пространства, напишите прямо в наш чат-бот, и наш администратор вам ответит.`,
        en: `Welcome to the PAPERS space by Paper Kartuli. Here you can book a place in a coworking or meeting room, see the lecture schedule, or go straight to the bar.\nThe most convenient way to use the bot is through the application: this button is at the bottom (or in the lower left corner). You can sign up for a free test day in a coworking space. The following days - at the standard rate (30 GEL per day, payable locally). To rent a meeting room or event space, write directly to our chatbot, and our administrator will answer you.`,
        ka: 'კეთილი იყოს თქვენი მობრძანება Paper Kartuli-ის PAPERS სივრცეში, აქ შეგიძლიათ დაჯავშნოთ ადგილი კოვორკინგში ან შეხვედრების ოთახში, ნახოთ ლექციების განრიგი ან პირდაპირ ბარში ჩაბრძანდეთ. ბოტის გამოყენების ყველაზე მოსახერხებელი გზაა აპლიკაციის საშუალებით: ეს არის ქვედა ღილაკი (ან ქვედა მარცხენა კუთხეში) შეგიძლიათ დარეგისტრირდეთ უფასო ტესტის დღეს კოვორკინგის სივრცეში. მომდევნო დღეებში - სტანდარტული ღირებულობით (დღეში 30 ლარი, გადასახდელი ადგილობრივად). შეხვედრების ოთახის ან ღონისძიების სივრცის დასაქირავებლად მოგვწერეთ პირდაპირ ჩვენს ჩატბოტში და ჩვენი ადმინისტრატორი გიპასუხებთ.'
    },
    introButton: {
        ru: `Открыть приложение`,
        en: `release the kraken!`,
        ka: 'აპლიკაციის გახსნა'
    },
    payOnSite: {
        ru: `Оплачу на месте.`,
        en: `I'll pay on premise.`,
        ka: 'ადგილზე გადავიხდი'
    },
    pay: (v) => {
        return {
            ru: `Оплатить ${v}`,
            en: `Pay ${v}`,
            ka: `გადახდა ${v}`
        }
    },
    lectureInvite: (l) => {
        return {
            ru: `Отлично! Ждем вас на лекции «${l.name}».${l.price?`\n\nОбратите внимание: к оплате на месте ${common.cur(l.price,'GEL')}`:''}`,
            en: `Great! Looking forward to meeting you. ${l.price?`\n\nBeware: entrance fee is ${common.cur(l.price,'GEL')}`:''}`,
            ka: `დიდი! გელოდებით ლექციაზე "${l.name}"`
        }
    },
    lectureReminder: (l) => {
        return {
            ru: `Напоминаем, что сегодня в ${l.time} мы ждем вас на лекции ${l.name}.${(l.price&&!l.payed)?`\n\nОбратите внимание: к оплате на месте ${common.cur(l.price,'GEL')}`:''}`,
            en: `Let me remind you of upcoming event today: ${l.name} at ${l.time}. ${l.price?`\n\nBeware: entrance fee is ${common.cur(l.price,'GEL')}`:''}`,
            ka: `შეგახსენებთ, რომ დღეს ${l.time}-ზე გელოდებით ლექციაზე ${l.name}`
        }
    },
    lectureConfirm: {
        ru: `Отлично! Ждем вас на лекции. Подробнее в сообщениях.`,
        en: `Great! Looking forward to meet you. You'll get a message with all necessary details.`
    },
    alreadyCancelled: {
        ru: 'Эта запись уже отменена',
        en: 'This record had already been cancelled'
    },
    hallNotAvailable: {
        ru: 'Извиние, это помещение более недоступно',
        en: `Sorry, this space is no available any more.`
    },
    letsTryAgain: {
        en: `One more time?`,
        ru: 'Попробуем еще разок?'
    },
    error: {
        en: 'We\'re sorry. An unexpected error occured. Sheep happened',
        ru: `Непредвиденная ошибка. Мы уже уведомили админа.`
    },
    bookingCancelled: {
        en: 'Your booking was cancelled',
        ru: `Запись отменена`
    },
    timeSelected: (d) => {
        return {
            ru: 'Время: ' + d,
            en: `Time: ${d}`
        }
    },
    dateSelected: (d) => {
        return {
            ru: 'Выбранная дата: ' + d,
            en: `Date chosen: ${d}`
        }
    },
    onIt: {
        ru: 'Секундочку',
        en: 'Just a sec...'
    },
    coworkingBookingCancel: {
        ru: 'Отменить бронь',
        en: 'Cancel booking'
    },
    coworkingBookingConfirmed: {
        ru: 'Это время забронировано за вами',
        en: 'You are in!'
    },
    youArBanned: {
        ru: 'Извините, вам будут не рады...',
        en: 'Sorry, we can\'t let you in...'
    },
    noSeatsLeft: {
        ru: 'Простите, но свободных мест не осталось.',
        en: 'We are sorry — no seats lefts.'
    },
    alreadyBooked: {
        ru: 'Это место уже захвачено, мон колонель!',
        en: 'You have already booked a place.'
    },
    alreadyBookedClass: {
        ru: 'Извините, но вы уже записывались на эту лекцию.',
        en: 'You have already booked a place.'
    },
    seats: {
        ru: `мест`,
        en: 'seats'
    },
    chooseDate: {
        ru: `Выберите день`,
        en: `Choose a date`
    },
    chooseTime: {
        ru: `Выберите время`,
        en: `Choose time`
    },
    coworkingStart: {
        ru: `Выберите зал, в котором хотели бы работать.`,
        en: `Choose a space to work in.`
    },
    noSchedule: {
        ru: 'Извините, пока что тут пусто. Мы пришлем весточку, когда добавим что-то новое.',
        en: `Ooops! Nothing to show yet. Stay tuned.`
    },
    noClasses: {
        ru: 'Извините, дорогой друг. Вы еще не записывались. Или мы что-то забыли...\nНажмите /classes — мы покажем расписание на ближайшие дни',
        en: `Ooops! Nothing to show yet. Press /classes to see upcoming events.`
    },
    noAppointment: {
        ru: `Извините, такой записи в природе не существует`,
        en: 'Sorry, we have no idea of the appointment. Where did you get it?..'
    },
    unAuthorized: {
        ru: 'Терпеть не можем это говорить, но... у вас нет права на совершение этой операции.',
        en: `Sorry, you are not authorized to perform the action.`
    },
    appointmentCancelled: {
        ru: 'Культура отмены — тоже культура. Ваша запись снята',
        en: 'Cancel culture marching. You\'re free to go'
    },
    alreadyPayed: {
        ru: 'Вай мэ, дорогой товарищ, ваш билет уже оплачен.',
        en: 'That\'s sweet, but you have already payed for the ticket'
    },
    paymentDesc: {
        ru: `После покупки билета вы получите код — просто покажите его при входе.`,
        en: `Once the payment is through you get a code. Just show it at the reception.`
    },
    userBlocked: {
        ru: `Извините, ваш аккаунт был заблокирован.`,
        en: `Sorry, but your account was blocked.`
    }
}

module.exports = router;