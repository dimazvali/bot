//@ts-check

const express = require('express');
const router =  express.Router();
var axios =     require('axios');

const { 
    books, 
    wineList,
    udb,
    messages,
    deposits,
    randomCoffeeIterations,
    randomCoffees,
    plansUsers,
    userClasses,
    mra,
    halls,
    userEntries,
    classes,
    roomsBlocked,
    userClassesWL,
    news,
    userClassesQ,
} = require('./cols');

const coworkingCol = require('./cols').coworking;

const { log, token, coworkingPrice, localTime, alertAdmins, cba } = require('../papersBot');
const { getUser, sendMessage2 } = require('../methods');
const { isoDate, uname, cur, handleQuery, devlog, ifBefore, dimazvali, drawDate, getDoc, letterize, handleDoc } = require('../common');
const translations = require('./translations');
const { FieldValue } = require('firebase-admin/firestore');
const { modals } = require('../modals');
const { admin } = require('googleapis/build/src/apis/admin');



function addBook(req,res,admin){
    
    let b = {
        createdAt:  new Date(),
        active:     true,
        createdBy:  +admin.id,
        name:       req.body.name   || null,
        description:req.body.description || null,
        pic:        req.body.pic    || null,
        isbn:       req.body.isbn   || null,
        lang:       req.body.lang   || `ru`,
        author:     req.body.author || null,
        price:      +req.body.price || null,
        owner:      +req.body.owner || null,
        year:       +req.body.year  || null,
        state:      +req.body.state || null,
        publisher:  req.body.publisher || null,
    }

    return books.add(b).then(rec=>{
        
        log({
            text:   `${uname(admin,admin.id)} добавляет книгу ${b.name}.`,
            book:   rec.id,
            admin:  +admin.id,
            silent: true
        })

        return res.redirect(`/paper/web?page=books_${rec.id}`)
    })
}



const wine = {
    add: async (data, admin)=>{
        return  new Promise((resolve,reject)=>{
            wineList.add({
                user:       +data.user || null,
                left:       +data.glasses || +data.left ||  0,
                total:      +data.glasses || +data.left ||  0,
                createdAt:  new Date(),
                createdBy:  +admin.id,
            }).then(async record=>{

                let gifted = await getUser(data.user,udb);
                
                log({
                    text:   `${uname(admin, admin.id)} наливает гостю ${uname(gifted, gifted.id)} ${data.glasses} бокалов вина`,
                    user:   +data.user,
                    admin:  +admin.id
                })

                sendMessage2({
                    chat_id: data.user,
                    caption: translations.winePoured[gifted.language_code](data.glasses) || translations.winePoured.en(data.glasses),
                    photo: process.env.ngrok + `/paper/qr?id=${record.id}&entity=wineList`
                }, 'sendPhoto', token, messages)

                resolve(record)

            }).catch(err=>reject(err))
        })
    }
}

function alertWithdrawal(user, id, sum, reason) {
    if (sum > 0) sum = sum * -1;
    udb.doc(user.id || id).update({
        deposit: FieldValue.increment(sum)
    }).then(() => {
        deposits.add({
            createdAt:      new Date(),
            amount:         sum,
            user:           +user.id || id,
            description:    reason || null
        }).then(rec=>{
            log({
                deposit: rec.id,
                user: user.id || id,
                text: `Со счета пользователя ${uname(user,(user.id||id))} списывается ${cur(sum,'GEL')} по статье ${reason}`
            })
        })
        
    })
}

const rcMethods = {
    randomCoffeePrepare:(admin,res,req)=>{
    
        rcCheckBefore(req.body.text)
    
        return new Promise((resolve,reject)=>{
            randomCoffeeIterations.add({
                createdAt:  new Date(),
                createdBy:  +admin.id,
                text:       req.body.text || null
            }).then(rec=>{
                resolve(rec)
            }).catch(err=>{
                reject(err)
            })
        })
    },
    rcResult: async (id)=>{
        let couples = await ifBefore(randomCoffees,{iteration:id})
        let rates = [];
        couples.filter(c=>c.rate).forEach(c=>{
            if(c.rate.hasOwnProperty(`first`)) rates.push(c.rate.first)
            if(c.rate.hasOwnProperty(`second`)) rates.push(c.rate.second)
        })
        alertAdmins({
            text:`Завершился очередной раунд random coffee. Что мы имеем?
Пар составлено: ${couples.length}.
Состоялось встреч: ${couples.filter(c=>c.proof).length}.
Индекс счастья: ${Math.round((rates.reduce((a,b)=>a+b,0)/rates.length)*100)}%`
        })
    },
    rcFollowUp(id){
        return new Promise(async (data,err)=>{
            let i = await getDoc(randomCoffeeIterations,id)
            if(!i)          return err(new Error(`Не было такого круга`));
            if(i.followUp)  return err(new Error(`Запрос уже был отправлен ${drawDate(i.followUp._seconds*1000,false,{time: true})}`))
            let couples = await ifBefore(randomCoffees,{iteration:id})
            
            couples.forEach((couple,delay)=>{
                setTimeout(()=>{
                    sendMessage2({
                        chat_id: couple.first,
                        text: `Привет! Как вам кофе? Удалось ли пообщаться?`,
                        reply_markup:{
                            inline_keyboard:[[{
                                text: `Да`,
                                callback_data: `random_confirm_${couple.id}`
                            },{
                                text: `Нет`,
                                callback_data: `random_deny_${couple.id}`
                            }],[{
                                text: `Нет, но планирую`,
                                callback_data: `random_later_${couple.id}`
                            }]]
                        }
                    },false,token,messages)
                    sendMessage2({
                        chat_id: couple.second,
                        text: `Привет! Как вам кофе? Удалось ли пообщаться?`,
                        reply_markup:{
                            inline_keyboard:[[{
                                text: `Да`,
                                callback_data: `random_confirm_${couple.id}`
                            },{
                                text: `Нет`,
                                callback_data: `random_deny_${couple.id}`
                            }],[{
                                text: `Нет, но планирую`,
                                callback_data: `random_later_${couple.id}`
                            }]]
                        }
                    },false,token,messages)
                },delay*200)
            })

            randomCoffeeIterations.doc(id).update({
                followUp: new Date()
            })

            data({
                success: true,
                comment: `Запросы уходят на ${couples.length} пар.`
            })
        })
    },
    rcReScore:async(score,id)=>{
        
        let u = await getUser(id,udb);
        
        if(!u.coffeeScore)  u.coffeeScore = 0
        if(!u.coffees)      u.coffees = 0
        
        udb.doc(id.toString()).update({
            coffees:        FieldValue.increment(1),
            coffeeScore:    Number(((u.coffeeScore||0*u.coffees+score)/(u.coffees+1)).toFixed(2))
        })
    }
}


function rcCheckBefore(text){
    udb
        .where(`randomCoffee`,'==',true)
        .where(`active`,'==',true)
        .get()
        .then(col=>{

            handleQuery(col).forEach((user,i)=>{
                
                if(user.randomCoffeePass){
                    udb.doc(user.id).update({
                        randomCoffeePass:null
                    })
                }
                
                let issues = []

                if(!user.about) issues.push(`не заполнено описание "О себе"`)
                if(!user.occupation) issues.push(`не заполнено поле "Сфера деятельности"`)


                setTimeout(()=>{
                    let txt = text || `Привет! Через пару часов мы запустим очередную серию встреч в формате random coffee. Если вы не в Тбилиси (или просто не готовы ни с кем знакомиться на этой неделе) нажмите «Пас».${issues.length ?`\nНапоминаем, что для участия вам понадобится заполнить профиль. Кажется, у вас ${issues.join('\n')}.` : ``}`
                    
                    let keyBoard = [[{
                        text:           `Пас`,
                        callback_data:  `random_pass`
                    }]]

                    if(issues.length){
                        // @ts-ignore
                        keyBoard.push([{
                            text: `Заполнить профиль`,
                            url: `https://t.me/paperstuffbot/app?startapp=profile`
                        }])
                    }
                    
                    sendMessage2({
                        chat_id: user.id,
                        // chat_id: dimazvali,
                        text: txt,
                        reply_markup:{
                            inline_keyboard:keyBoard
                        }
                    },false,token,messages)
                },i*200)
            })
        })
}

async function randomCoffee(admin,id){

    log({
        silent: true,
        text: `${uname(admin,admin.id)} запускает random coffee`,
        admin: +admin.id
    })

    randomCoffeeIterations.doc(id).update({
        started: new Date()
    })

    let before = await ifBefore(randomCoffees,{})
    
    udb
        .where(`randomCoffee`,'==',true)
        .where(`active`,'==',true)
        .get()
        .then(col=>{
            
            let users2meet = handleQuery(col)
                .filter(u => u.occupation && u.about)
                .filter(u => !u.randomCoffeePass)

            while(users2meet.length > 1){
                let first = users2meet.splice(0,1)[0]
                let exs = before
                    .filter(couple => couple.first == +first.id || couple.second == +first.id)
                    .map(couple=>couple.first == +first.id ? couple.second : couple.first)
                
                let news = users2meet.slice().filter(u=>exs.indexOf(+u.id) == -1)
                
                if(news.length){
                    
                    let randomIndex = Math.floor(Math.random()*news.length)
                    let secondId = news[randomIndex].id
                    let spliceIndex = users2meet.map(u=>u.id).indexOf(secondId)
                    let second = users2meet.splice(spliceIndex,1)[0]
                    
                    randomCoffees.add({
                        iteration:  id,
                        active:     true,
                        createdAt:  new Date(),
                        first:      +first.id,
                        second:     +second.id
                    }).then(r=>{

                        randomCoffeeIterations.doc(id).update({
                            couples: FieldValue.increment(1)
                        })
                        
                        let txt1 = translations.rcInvite.ru(first,second) || translations.rcInvite.en(first,second)
                        let txt2 = translations.rcInvite.ru(second,first) || translations.rcInvite.en(second,first)
                        
                        sendMessage2({
                            chat_id:    first.id,
                            text:       txt1,
                            parse_mode: `Markdown`,
                        },false,token,messages)

                        sendMessage2({
                            chat_id:    second.id,
                            text:       txt2,
                            parse_mode: `Markdown`,
                        },false,token,messages)
                    })
                } else {
                    devlog(`${uname(first,first.id)} перевстречался со всеми`)
                }
            }

            if(users2meet.length){
                
                let lastOne = users2meet[0];

                sendMessage2({
                    chat_id: lastOne.id,
                    text: `Простите великодушно. Знаете, как это бывает, когда на десять девчонок... В общем, у нас было нечетное количество участников, поэтому вам в собеседники достается разработчик приложения: Дмитрий @dimazvali.`
                },false,token)

                sendMessage2({
                    chat_id: dimazvali,
                    text: `Поcледний кофейный герой: ${uname(lastOne,lastOne.id)}.`
                },false,token)

            }

            handleQuery(col)
                .filter(u => !u.occupation || !u.about)
                .forEach((u,x)=>{
                    setTimeout(()=>{
                        sendMessage2({
                            chat_id: u.id,
                            text: `Добрый вечер! К сожалению, этот круг random coffee вы пропускаете. Пожалуйста, заполните профиль.`,
                            reply_markup:{
                                inline_keyboard:[[{
                                    text: `Заполнить профиль`,
                                    url: `https://t.me/paperstuffbot/app?startapp=profile`
                                }]]
                            }
                        },false,token,messages)
                    },x*200)
                })
    })
}


function welcome2RC(id){
    let u = getUser(id,udb);
    
    sendMessage2({
        chat_id: id,
        text: translations.welcome2RC[u.language_code] || translations.welcome2RC.en
    },false,token,messages)
    
    if(!u.about || !u.occupation){
        sendMessage2({
            chat_id: id,
            text: translations.rcMissingDetails[u.language_code] || translations.rcMissingDetails.en,
            reply_markup:{
                inline_keyboard:[[{
                    text: translations.profile[u.language_code] || translations.profile.en,
                    web_app:{
                        url: process.env.ngrok+'/paper/app?start=profile'
                    }
                }]]
            }
        },false,token,messages)
    }
}

function classDescription(h, lang, newsId){
    return `${drawDate(h.date,false,{time:true})}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author || h.authorName}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description}\n${h.price? `${translations.fee[lang] ||  translations.fee.en} ${cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`
}


function sendClass(h,u,newsId){
    
    let lang = u.language_code

    let kbd = [
        [{
            text: translations.book[lang] || translations.book.en,
            callback_data: 'class_' + h.id
        }]
    ]

    if (h.noRegistration) {
        kbd = []
    }

    kbd.push([{
        text: translations.unsubscribe[lang] || translations.unsubscribe.en,
        callback_data: `unsubscribe`
    }])

    let message = {
        chat_id: u.id,
        text: classDescription(h,lang),
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: kbd
        }
    }

    if (h.pic) {
        message.caption = message.text.slice(0, 1000)
        message.photo = h.pic
    }
    return sendMessage2(message, (h.pic ? 'sendPhoto' : false), token, messages,newsId?{news:newsId}:false)
}

const coworking = {
    sendCoworking:async(user)=>{
        let hallsData = await ifBefore(halls,{active:true,isCoworking:true,isMeetingRoom:false})
        sendMessage2({
            chat_id:    user.id,
            text:       translations.coworkingStart[user.language_code] || translations.coworkingStart.en,
            reply_markup: {
                inline_keyboard: hallsData.map(h => {
                    return [{
                        text: `${h.name}`,
                        callback_data: `coworking_${h.id}`
                    }]
                })
            }
        }, false, token, messages)
    },
    requestCoworkingFeedback: async ()=>{
        let records = await ifBefore(coworkingCol,{date: isoDate()})
        let usedRecords = records.filter(r=>r.status == `used`);
        usedRecords.forEach((record,i)=>{
            
            coworkingCol
                .where(`user`,'==',record.user)
                .where(`status`,'==','used')
                .get()
                .then(col=>{
                    if(col.docs.length == 1) setTimeout(()=>{
                        sendMessage2({
                            chat_id: record.user,
                            text: `Добрый вечер!\nМы были рады видеть вас в коворкинге Papers.А вы?.. \nПожалуйста, поставьте нам честную оценку. Мы также будем рады любой обратной связи (просто напишите в бот, что вам понравилось — а что могло быть и лучше).`,
                            reply_markup:{
                                inline_keyboard:[
                                    [{
                                        text: `1`,
                                        callback_data: `feedback_coworking_1`
                                    },{
                                        text: `2`,
                                        callback_data: `feedback_coworking_2`
                                    },{
                                        text: `3`,
                                        callback_data: `feedback_coworking_3`
                                    },{
                                        text: `4`,
                                        callback_data: `feedback_coworking_4`
                                    },{
                                        text: `5`,
                                        callback_data: `feedback_coworking_5`
                                    }],
                                ]
                            }
                        },false,token,messages)
                    },i*100)
                })
        })
    },
    alertCancel:(rec)=>{
        sendMessage2({
            chat_id: rec.user,
            text: `Ваша запись в коворкинг на ${drawDate(rec.date)} была отменена.`
        },false,token,messages)
    },
    withDrawal: async (record,reason)=>{
        if(reason){

            let user = await getUser(record.user,udb)
            
            if(reason == `deposit`){
                alertWithdrawal(user,user.id,coworkingPrice-10,`посещение коворкинга`)
            }
            if(reason == `bonus`) {
                udb.doc(record.user.toString()).update({
                    bonus: false
                })
            }
            if(!reason.indexOf(`plan`)){
                plansUsers.doc(reason.split('_')[1]).update({
                    visitsLeft: FieldValue.increment(-1)
                })
            }
        }
    },
    bookCoworking: async (user, hallId, date, req, res)=>{

        function sorryBut(code) {
    
            if (res) return res.json({
                success: false,
                text: code
            })
    
            if (req) return cba(req, translations[code][user.language_code] || translations[code].en)
    
            return sendMessage2({
                chat_id:    user.id,
                text:       translations[code][user.language_code] || translations[code].en
            }, false, token, messages)
        }
    
        if (!date) date = isoDate();
    
        if (isoDate() > date) return sorryBut(`tooLate`)
            
        let hall = await getDoc(halls, hallId)

        if (!hall || !hall.active || !hall.isCoworking) return sorryBut('hallNotAvailable')
        
        let blocked = await ifBefore(roomsBlocked, { date: date, room: hallId, active: true });

        if(blocked.length && !user.insider) return sorryBut(`roomBlocked`)
        
        let already = await ifBefore(coworkingCol, { hall: hallId, date: date, active: true }); 
        
        let users = already.map(r => +r.user);
        
        if (users.indexOf(+user.id) > -1) return sorryBut(`alreadyBooked`)

        if (users.length >= hall.capacity) return sorryBut(`noSeatsLeft`)

        if (!user.occupation) return  sorryBut(`noOccupationProvided`)

        if (!user.email) return  sorryBut(`noEmailProvided`)

        coworkingCol.add({
            user:   +user.id,
            hall:   hallId,
            date:   date,
            createdAt: new Date(),
            active: true,
            paymentNeeded: (user.insider || user.admin || user.fellow) ? false : (user.bonus ? false : true),
            payed: false
        }).then(rec => {

            let bonusText = false;

            if (user.bonus) {

                bonusText = true

                udb.doc(user.id.toString()).update({
                    bonus: false
                })
            }

            log({
                filter: `coworking`,
                text: `${uname(user, user.id)} бронирует место в коворкинге ${hall.name} на ${date}.`,
                user: user.id,
                hall: hallId
            })

            if (res) res.json({
                success: true,
                text: bonusText ? 'coworkingBookingConfirmedBonus' : 'coworkingBookingConfirmed',
                record: rec.id
            })

            if (req) cba(req, `ok`)


            sendMessage2({
                chat_id: user.id,
                caption: translations.coworkingBookingDetails(date, hall.name, user.language_code)[user.language_code] || translations.coworkingBookingDetails(date, hall.name, user.language_code).en,
                photo: process.env.ngrok + `/paper/qr?id=${rec.id}&entity=coworking`,
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                            callback_data: `ca_cancel_${rec.id}`
                        }]
                    ]
                }
            }, 'sendPhoto', token, messages)

            if (bonusText) {
                sendMessage2({
                    chat_id: user.id,
                    text: translations.coworkingBookingConfirmedBonus[user.language_code] || translations.coworkingBookingConfirmedBonus.en
                }, false, token, messages)
            }
        })    
    }
}

const plan = {
    alertDisposal:(p)=>{
        sendMessage2({
            chat_id: p.user,
            text: `Ваша подписка на тарифный план ${p.name} была аннулирована.`
        },false,token,messages)
    }
}

function nowShow(){
    userClasses
        .where(`active`,'==',true)
        .where(`status`,'!=',`used`)
        .get()
        .then(col=>{
            handleQuery(col)
                .filter(t=>t.date<new Date().toISOString())
                .filter(t=>!t.status)
                .forEach(ticket=>{
                    userClasses.doc(ticket.id).update({
                        status: `noShow`
                    })
                })
        })
}

function alertSoonMR() {

    mra
        .where('active', '==', true)
        .where('date', '==', isoDate())
        .where('time', '<', localTime(20))
        .orderBy('time', 'asc')
        .get()
        .then(col => {
            handleQuery(col).filter(rec=>!rec.alerted).forEach(rec=>{
                getUser(rec.user,udb).then(udata=>{
                    sendMessage2({
                        chat_id: rec.user,
                        text: translations.mrReminder(rec.time)[udata.language_code] || translations.mrReminder(rec.time).en,
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: translations.coworkingBookingCancel[udata.language_code] || translations.coworkingBookingCancel.en,
                                    callback_data: `mr_unbook_${rec.id}`
                                }]
                            ]
                        }
                    }, false, token, messages).then(()=>{
                        mra.doc(rec.id).update({
                            alerted: new Date()
                        })
                    })
                })
                
            })
        }).catch(err => {
            console.log(err)
        })
}

function alertAdminsCoworking() {
    coworkingCol
        .where('active', '==', true)
        .where('date', '==', isoDate())
        .get()
        .then(col => {
            
            let records = handleQuery(col);
            let toBePayed = records.filter(r => r.paymentNeeded && !r.payed)
            let payed = records.filter(r => r.payed)
            let free = records.filter(r => !r.paymentNeeded)
            
            if (records.length) {
                let hallsData = [];
                [...new Set(records.map(r => r.hall))].forEach(id => {
                    hallsData.push(halls.doc(id).get().then(h => {
                        let t = h.data()
                        t.id = h.id;
                        return t
                    }))
                })
                Promise.all(hallsData).then(hd => {

                    let users = [];

                    [...new Set(records.map(r => r.user))].forEach(id => {
                        users.push(getUser(id,udb))
                    })



                    let hallsReady = {};


                    hd.forEach(hall => {
                        hallsReady[hall.id] = hall
                    })

                    Promise.all(users).then(users => {

                        let uReady = {};

                        users.forEach(u => {
                            uReady[u.id] = u
                        })

                        // @ts-ignore
                        axios.post(process.env.papersHook, {
                            blocks: modals.coworkingReport(toBePayed, payed, free, hallsReady, uReady)
                        }).then(s => {
                            devlog(s.data)
                        }).catch(err => {
                            console.log(err)
                        })
                    })

                })
            } else {
                alertAdmins({
                    filter: `coworking`,
                    text: `На сегодня записей в коворкинг нет.`
                })
            }
        })
}

function countUserEntries(days){
    userEntries
        // @ts-ignore
        .where(`createdAt`,'>=',new Date(new Date()-days*24*60*60*1000))
        .get()
        .then(col=>{
            col = handleQuery(col)
            log({
                text: `За последние сутки ${letterize([... new Set(col.map(r=>r.user))].length,`гость`)} ${letterize(col.length,`раз`)} открывали приложение.`
            })
        })
}

const classMethods = {
    remind: async (rec) => {
        let user = await getUser(rec.user,udb);
        sendMessage2({
            chat_id: rec.user,
            text: translations.lectureReminder(rec,user)[user.language_code] || translations.lectureReminder(rec,user).en,
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                        callback_data: `unclass_${rec.id}`
                    }]
                ]
            }
        }, false, token, messages)
    },
    feedBackRequest:(c)=>{
        return getDoc(classes,c).then(l=>{
            return userClasses
                .where(`class`,'==',c)
                .where('active','==',true)
                .where('status','==','used')
                .get()
                .then(col=>{
                    handleQuery(col).forEach(ticket=>{
                        getUser(ticket.user,udb).then(user=>{
                            sendMessage2({
                                chat_id: ticket.user,
                                text: translations.feedBackRequest(ticket,l)[user.language_code] || translations.feedBackRequest(ticket,l).en,
                                reply_markup:{
                                    inline_keyboard:[
    
                                        [
                                            {
                                                text: `1`,
                                                callback_data: `feedback_ticket_${ticket.id}_1`
                                            },
                                            {
                                                text: `2`,
                                                callback_data: `feedback_ticket_${ticket.id}_2`
                                            },
                                            {
                                                text: `3`,
                                                callback_data: `feedback_ticket_${ticket.id}_3`
                                            },
                                            {
                                                text: `4`,
                                                callback_data: `feedback_ticket_${ticket.id}_4`
                                            },
                                            {
                                                text: `5`,
                                                callback_data: `feedback_ticket_${ticket.id}_5`
                                            }
                                        ]
                                        
                                    ]
                                }
                            },false,token,messages)
                        })
                        
                    })
                    classes.doc(c).update({
                        feedBackSent: new Date()
                    })
    
                    return handleQuery(col).length
                })
        })
    },
    bookClass: async (user, classId, res, id)=>{
    
        if (!user) {
            user = await getUser(id,udb)
        }
        let already = await ifBefore(userClasses, { user: +user.id, active: true, class: classId });
        
        if(already.length) {
            if (res) {
                res.json({
                    success: false,
                    text: 'alreadyBookedClass'
                })
            } else {
                sendMessage2({
                    chat_id: user.id,
                    text: translations.alreadyBookedClass[user.language_code] || translations.alreadyBookedClass.en
                }, false, token, messages)
            }
            return;
        }

        let c = await getDoc(classes, classId)

        if (!c || !c.active){
            if(res) return res.sendStatus(404)
            return false
        }

        let d = {
            user:       +user.id,
            userName:   `${user.first_name} ${user.last_name} (${user.username})`,
            active:     true,
            createdAt:  new Date(),
            className:  c.name,
            class:      classId,
            date:       c.date,
        }

        let sub = await ifBefore(plansUsers,{user:+user.id,active:true})[0];

        let subData = sub ? `подписка: ${sub.name}` : ``;

        let before = await ifBefore(userClasses,{class:classId,active:true})
        
        let line =          before.length;
        let capacity =      c.capacity
        let seatsData =     '';
        
        if(capacity && line >= capacity){
            // овербукинг
            seatsData = `*овербукинг:* забронировано ${line} мест из ${capacity}`;
            
            userClassesWL.add({
                createdAt:  new Date(),
                active:     true,
                user:       +user.id,
                class:      classId,
                className:  c.name
            })

            if (res) {
                res.json({
                    success: false,
                    text: `noSeatsLeft`
                })
            } else {
                sendMessage2({
                    chat_id: user.id,
                    text: translations.noSeatsLeft[user.language_code] 
                }, false, token, messages)
            }

            log({
                filter: `lectures`,
                text: `${uname(user, user.id)} НЕ ПОЛУЧАЕТ место на лекцию ${c.name}\n${seatsData}`,
                user: user.id,
                class: c.id
            })
            return;

        }

        let record = await userClasses.add(d);
        
        classes.doc(classId).update({
            visitors: FieldValue.increment(1)
        })

        seatsData = `забронировано мест: ${line} из ${capacity||`бесконечного множества`}`;
        
        if (res) res.json({
            success: true,
            text: `lectureConfirm`
        })

        sendMessage2({
            chat_id:    user.id,
            photo:      process.env.ngrok + `/paper/qr?id=${record.id}&entity=userClasses`,
            caption:    translations.lectureInvite(c)[user.language_code] || translations.lectureInvite(c).en,
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: `${translations.coworkingBookingCancel[user.language_code] ||  translations.coworkingBookingCancel.en}`,
                        callback_data: 'unclass_' + record.id
                    }]
                ]
            }
        }, 'sendPhoto', token, messages).then(data => {
            if(data && data.result) sendMessage2({
                chat_id: user.id,
                message_id: data.result.message_id
            }, 'pinChatMessage', token)
        })

        log({
            filter: `lectures`,
            text:   `${uname(user, user.id)} регистрируется на лекцию ${c.name}\n${seatsData}`,
            user:   user.id,
            class:  c.id,
            ticket: record.id
        })
    },
    sendUserClasses:async(id, lang, past)=>{
        let records = await ifBefore(userClasses, { user: id, active: true });

        let d = []
        records.forEach(record => {
            d.push(classes.doc(record.class).get().then(cl => {
                let t = cl.data()
                t.id = cl.id;
                t.appointment = record.id
                return t
            }))
        })

        Promise.all(d).then(data => {
            if (!data.length) {
                sendMessage2({
                    chat_id: id,
                    text: translations.noClasses[lang] || translations.noClasses.en
                }, false, token, messages)
            } else {
                data.forEach(h => {
                    let message = {
                        chat_id: id,
                        text: `${drawDate(h.date,false,{time:true})}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author || h.authorName}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description}\n${h.price? `${translations.fee[lang] ||  translations.fee.en} ${cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: `${translations.coworkingBookingCancel[lang] ||  translations.coworkingBookingCancel.en}`,
                                    callback_data: 'unclass_' + h.appointment
                                }]
                            ]
                        }
                    }
                    if (h.noRegistration) {
                        // @ts-ignore
                        delete message.reply_markup
                    }

                    h.pic = process.env.ngrok + `/paper/qr?id=${h.appointment}&entity=userClasses`

                    if (h.pic) {
                        message.caption = message.text.slice(0, 900)
                        message.photo = h.pic
                    }

                    sendMessage2(message, (h.pic ? 'sendPhoto' : false), token)
                })
            }

        })
            
    },
    classReScore: async (classId)=>{
        let before = await ifBefore(userClasses,{class:classId});
        let score = [];
        before.filter(t=>t.rate).forEach(t=>{
            score.push(+t.rate)
        })
        if(score.length) classes.doc(classId).update({
            rate: +(score.reduce((a,b)=>a+b,0)/score.length).toFixed(1)
        })
    },
    unClassUser:async(ref, user, res, id, callback_query)=>{
        function sorryBut(code) {
        
            if (res) return res.json({
                success: false,
                text: code
            })
    
            if (callback_query) return cba(callback_query, translations[code][user.language_code] || translations[code].en)
    
            return sendMessage2({
                chat_id:    user.id,
                text:       translations[code][user.language_code] || translations[code].en
            }, false, token, messages)
        }

        try {
            if (!user) user = await getUser(id,udb);
        
            

            let appointment = await getDoc(userClasses,ref);
            if(!appointment) return sorryBut(`noAppointment`)
            if(+appointment.user != +user.id) return sorryBut(`unAuthorized`)
            if(!appointment.active) return sorryBut(`alreadyCancelled`)
            if(new Date(appointment.date) < new Date()) return sorryBut(`tooLate`)
            await userClasses.doc(ref).update({
                active: false
            })

            classes.doc(appointment.class).update({
                visitors: FieldValue.increment(-1)
            })

            sorryBut(`bookingCancelled`)

            let c = await getDoc(classes, appointment.class);
            
            log({
                filter: `lectures`,
                text:   `${uname(user, user.id)} отказывается от места на лекции  ${c.name}`,
                user:   +user.id,
                class:  appointment.class
            })

            let line = await ifBefore(userClassesWL,{active:true,class:appointment.class})
            
            if(line.length){
                let next = line.sort((a,b)=>a.createdAt._seconds - b.createdAt._seconds)[0]
                classMethods.bookClass(false,appointment.class,false,next.user)
            }
            
            sendMessage2({
                chat_id: user.id,
                text: translations.appointmentCancelled[user.language_code] || translations.appointmentCancelled.en
            }, false, token, messages)
        } catch (error) {
            console.warn(error)
            sorryBut(`error`)
        }
        
    },
    acceptTicket:async(ticketId,res)=>{

        let t = await getDoc(userClasses,ticketId);

        let userid =  t.user;
        
        let userPlans = await ifBefore(plansUsers,{user:+userid,active:true})
        let planned = false;
        let plan = userPlans[0]
        
        if(plan && plan.eventsLeft){
            plansUsers.doc(plan.id).update({
                eventsLeft: FieldValue.increment(-1)
            })
            planned = true;
        }

        let user = await getUser(userid,udb);
        
        udb.doc(userid.toString()).update({
            classesVisits: FieldValue.increment(1)
        })

        sendMessage2({
            chat_id: user.id,
            text: translations.welcomeOnPremise[user.language_code] || translations.welcomeOnPremise.en,
            reply_markup:{
                inline_keyboard: [
                    [{
                        text: translations.openClass[user.language_code] || translations.openClass.en,
                        web_app: {
                            url: process.env.ngrok + '/paper/app?start=class_'+t.class
                        }
                    }]
                ]
            }
            
        }, false, token, messages)

        let cl = await getDoc(classes,t.class);

        if(cl.welcome) sendMessage2({
            chat_id: user.id,
            text: cl.welcome
        }, false, token, messages)

        if(res) res.json({
            success: true,
            comment: `Билет засчитан.${planned?` Посещение вычтено из тарифа.`:``}`
        })
    },
    alertClassClosed:async(id)=>{
        let cl = await getDoc(classes,id);
    
        log({
            filter: `lectures`,
            text:   `Лекция ${cl.name} отменяется (((`,
            class:  id
        })

        let tickets = await ifBefore(userClasses,{class:id,active:true})
        
        tickets.forEach(async appointment => {
            let user = await getUser(appointment.user,udb);
            sendMessage2({
                chat_id: appointment.user,
                text:   translations.classClosed(cl)[user.language_code] || translations.classClosed(cl).en
            }, false, token, messages)
        })
        
        
        let waitingList = await ifBefore(userClassesQ,{active: true, class:id});
    
        waitingList.forEach(record=>{
            getUser(record.user,udb).then(ud=>{
                
                sendMessage2({
                    chat_id: record.user,
                    text: translations.classClosed(cl)[ud.language_code] || translations.classClosed(cl).en
                }, false, token, messages)
                
                userClassesQ.doc(record.id).update({
                    active: false
                })
            })
            
        })
        
    }

}

const mrMethods = {
    sendMeetingRoom:(user)=>{
        let shift = 0;
        let dates = []
        
        while (shift < 7) {
            dates.push(new Date(+new Date() + shift * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            shift++
        }

        sendMessage2({
            chat_id: user.id,
            text: translations.chooseDate[user.language_code] || translations.chooseDate,
            reply_markup: {
                inline_keyboard: dates.map(d => {
                    return [{
                        text: d,
                        callback_data: `mr_date_${d}`
                    }]
                })
            }
        }, false, token, messages)
    },
    bookMR: async (date, time, userid, callback, res)=>{
        
        let user = await getUser(userid,udb)

        function sorryBut(code) {
    
            if (res) return res.json({
                success: false,
                text: code
            })
    
            if (callback) return cba(callback, translations[code][user.language_code] || translations[code].en)
    
            return sendMessage2({
                chat_id:    user.id,
                text:       translations[code][user.language_code] || translations[code].en
            }, false, token, messages)
        }

        try {
            
    
            if (user.blocked)       return sorryBut(`youArBanned`)
            if (!user.email)        return sorryBut(`noEmailProvided`)
            if (!user.occupation)   return sorryBut(`noOccupationProvided`)
            
            let already = await ifBefore(mra,{date:date,time:time,active:true})
            
            if(already.length) return sorryBut(`alreadyBooked`)

            if(callback) cba(callback,translations.onIt[user.language_code])
            
            let rec = await mra.add({
                user:       +user.id,
                date:       date,
                time:       time,
                active:     true,
                createdAt:  new Date()
            })

            if (callback) {
                sendMessage2({
                    chat_id:    user.id,
                    text:       `${(translations.dateSelected(date)[user.language_code] || translations.dateSelected(date).en)}\n${(translations.timeSelected(time)[user.language_code] || translations.timeSelected(time).en)}\n${translations.coworkingBookingConfirmed[user.language_code] || translations.coworkingBookingConfirmed.en}`,
                    message_id: callback.message.message_id
                }, 'editMessageText', token).then(() => {
                    sendMessage2({
                        chat_id:    user.id,
                        message_id: callback.message.message_id,
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                                    callback_data: `mr_unbook_${rec.id}`
                                }]
                            ]
                        }
                    }, 'editMessageReplyMarkup', token)
                })
            }

            if (res) {
                
                sendMessage2({
                    chat_id: user.id,
                    text: `${(translations.dateSelected(date)[user.language_code] || translations.dateSelected(date).en)}\n${(translations.timeSelected(time)[user.language_code] || translations.timeSelected(time).en)}\n${translations.coworkingBookingConfirmed[user.language_code] || translations.coworkingBookingConfirmed.en}`,
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                                callback_data: `mr_unbook_${rec.id}`
                            }]
                        ]
                    }
                }, false, token, messages)

                res.json({
                    success: true,
                    text: 'coworkingBookingConfirmed',
                    rec: rec.id
                })

            }

            log({
                filter: `coworking`,
                silent: true,
                text: `${uname(user, user.id)} бронирует место в переговорке на ${time} ${date}`,
                user: user.id,
                mr: rec.id,
            })
        } catch (error) {
            console.warn(error)
            sorryBut(`error`)   
        }
    },
    unbookMR:async(id, userid, callback, res)=>{
        
        function sorryBut(code) {
    
            if (res) return res.json({
                success: false,
                text: code
            })
    
            if (callback) return cba(callback, translations[code][user.language_code] || translations[code].en)
    
            return sendMessage2({
                chat_id:    user.id,
                text:       translations[code][user.language_code] || translations[code].en
            }, false, token, messages)
        }
        
        let user = await getUser(userid,udb);
        
        if (callback) sendMessage2({
            callback_query_id: callback.id,
            text: translations.onIt[user.language_code] || translations.noSeatsLeft.en
        }, 'answerCallbackQuery', token)
        
        let rec = await getDoc(mra,id);
        
        if (!rec) return sorryBut(`noAppointment`)
        if (!rec.active) return sorryBut(`alreadyCancelled`)
        if (+rec.user !== +user.id) return sorryBut(`unAuthorized`)

        await mra.doc(id).update({
            active:     false,
            updatedAt:  new Date()
        })

        log({
            filter: `coworking`,
            text:   `${uname(user, user.id)} cнял место в переговорке на ${rec.time} ${rec.date}`,
            user:   +user.id,
        })

        if (callback) sendMessage2({
            chat_id:    user.id,
            text:       `${translations.bookingCancelled[user.language_code] || translations.bookingCancelled.en}`,
            message_id: callback.message.message_id
        }, 'editMessageText', token).then(() => {
            sendMessage2({
                chat_id: user.id,
                message_id: callback.message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: translations.letsTryAgain[user.language_code] || translations.letsTryAgain.en,
                            callback_data: 'mr_repeat'
                        }]
                    ]
                }
            }, 'editMessageReplyMarkup', token)
        })

        if (res) {
            res.json({
                success:    true,
                text:       'bookingCancelled'
            })
        }
        
    }
}

const newsMethods = {
    startNews: async (id) => {
        return new Promise(async (resolve, reject) => {
            try {
                let message = await getDoc(news, id);
                if(!message) return false;
                let users = await ifBefore(udb, { active: true, noSpam: false });
                if(message.filter){
                    let field = message.filter.split(`_`)[0];
                    users = users.filter(u=>u[field]) 
                }
                
                
                if(!message.class) return users.forEach((u, i) => {
                    setTimeout(()=>{
                        let m = null;
                        if(!message.media || !message.media.length){
                            m = sendMessage2({
                                chat_id:    u.user || u.id,
                                text:       message.text,
                                parse_mode: `HTML`,
                                protect_content:        message.safe?true:false,
                                disable_notification:   message.silent?true:false,
                            },false,token,messages,{news: message.id})
                        } else if(message.media && message.media.length == 1) {
                            m = sendMessage2({
                                chat_id:        u.user || u.id,
                                caption:        message.text,
                                parse_mode:     `HTML`,
                                photo:          message.media[0],
                                protect_content: message.safe?true:false,
                                disable_notification: message.silent?true:false,
                            },`sendPhoto`,token,messages,{news: message.id})
                        } else if(message.media){
                            m = sendMessage2({
                                chat_id:        u.user || u.id,
                                caption:        message.text,
                                parse_mode:     `HTML`,
                                media:          message.media.map((p,i)=>{
                                    return {
                                        type:       `photo`,
                                        media:      p,
                                        caption:    i?'':message.text
                                    }
                                }),
                                protect_content: message.safe?true:false,
                                disable_notification: message.silent?true:false,
                            },`sendMediaGroup`,token,messages,{news: message.id})
                        }
                        Promise.resolve(m).then(m=>{
                            if(m && m.result) news.doc(message.id).update({
                                audience: FieldValue.increment(1)
                            })
                        })
                    },i*200)
                })

                let cl = await getDoc(classes, message.class);
                
                users.forEach((u,i)=>{
                    setTimeout(()=>{
                        sendClass(cl,u,message.id).then(m=>{
                            if(m && m.result) news.doc(message.id).update({
                                audience: FieldValue.increment(1)
                            })
                        })
                    },i*200)
                })

                resolve({
                    success: users.length,
                })
            } catch (error) {
                reject(error)
            }
        })
        
    },
    add: async function(data,admin){
        return new Promise(async(resolve,reject)=>{
            try {
                let record = await news.add({
                    filter:             data.filter ? (data.filter == `all` ? false : data.filter) :null,
                    createdBy:          +admin.id || null,
                    createdAt:          new Date(),
                    name:               data.name,
                    text:               data.text,
                    safe:               data.safe || false, 
                    silent:             data.silent || false,
                    inline_keyboard:    data.inline_keyboard || null,
                    media:              data.media || null,
                    class:              data.class || null,
                })
    
                log({
                    text:   `${uname(admin,admin.id)} стартует рассылку с рабочим названием «${data.name}».`,
                    admin:  +admin.id,
                    silent: true,
                    news:   record.id
                })

                resolve(record)

            } catch (error) {
                reject(error)
            }
        })
    }
}



module.exports = {
    rcMethods,
    addBook,
    alertAdminsCoworking,
    alertSoonMR,
    alertWithdrawal,
    classDescription,
    classMethods,
    countUserEntries,
    coworking,
    mrMethods,
    newsMethods,
    nowShow,
    plan,
    randomCoffee,
    sendClass,
    welcome2RC,
    wine,
}