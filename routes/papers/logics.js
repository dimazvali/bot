//@ts-check

const express = require('express');
const router =  express.Router();
var axios =     require('axios').default;

let token =         process.env.papersToken;

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
    plans,
    plansRequests,
    authors,
    subscriptions,
    courses,
    views,
    standAlone,
    polls,
    pollsAnswers,
    podcastRecords,
} = require('./cols');

const coworkingCol = require('./cols').coworking;

const { getUser, sendMessage2 } = require('../methods');
const { isoDate, uname, cur, handleQuery, devlog, ifBefore, dimazvali, drawDate, getDoc, letterize, handleDoc, consistencyCheck, checkEntity, shuffle, handleCatch, handleError } = require('../common');
const translations = require('./translations');
const { FieldValue } = require('firebase-admin/firestore');
const { modals } = require('../modals');
const { newPlanRecord, Author, classRecord, Plan, Hall, entity, Page, SearchError, PermissionDenied, AlreadyError, PodcastRecord } = require('./classes');
const { coworkingPrice, log, localTime, alertAdmins, cba, classRates } = require('./store');


async function deleteEntity(req, res, ref, admin, attr, callback, extra) {
    
    try {
        let entities = {
            mr:{
                log:(name)=> `запись в переговорку была снята`,
                attr: `mr`
            },
            plansUsers:{
                log:(name)=> `подписка на тариф ${name} (${ref.id}) была архивирован`,
                attr: `plansUsers`
            },
            courses: {
                log: (name) => `курс ${name} (${ref.id}) был архивирован`,
                attr: `course`
            },
            users: {
                log: (name) => `пользователь ${name} (${ref.id}) был заблокирован`,
                attr: `user`
            },
            streams: {
                log: (name) => `подписка на трансляцию ${name} (${ref.id}) была аннулирована`,
                attr: `stream`
            },
            plans: {
                log: (name) => `абонемент ${name} (${ref.id}) был аннулирован`,
                attr: `plan`
            }
        }
        let e = await ref.get() 
        
        let data = handleDoc(e)

        if (!data[attr || 'active']) return res.json({
            success: false,
            comment: `Вы опоздали. Запись уже удалена.`
        })

        await ref.update({
            [attr || 'active']: false,
            updatedBy: admin
        }).then(s => {

            if(entities[req.params.data]){
                let logObject ={
                    admin: admin.id ? +admin.id : null,
                    text: entities[req.params.data].log(data.name),
                    [entities[req.params.data].attr]: Number(ref.id) ? Number(ref.id) : ref.id
                }

                if(extra){
                    Object.keys(extra).forEach(key=>{
                        logObject[key] = extra[key]
                    })
                }
    
                log(logObject)
            }
            
            

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
    } catch (error) {
        handleCatch(arguments,error)
    }
}

async function updateEntity(req, res, ref, adminId,callback) {
    
    devlog(`обновление`);
    devlog(req.body)

    try {
        let s = await ref.update({
            updatedAt: new Date(),
            updatedBy: adminId,
            [req.body.attr]: (req.body.attr == `date`||req.body.type == `date`) ? new Date(req.body.value) : req.body.value
        })
    
        if(callback){
            callback()
        }
    
        if(req.body.attr == `randomCoffee`){
            if(req.body.value) {
                rcMethods.welcome2RC(ref.id)
            }
        }
    
        if(req.body.value == `used` && req.params.method == `userClasses`)  return classMethods.acceptTicket(req.params.id, res, {id:+adminId})
        if(req.body.value == `used` && req.params.method == `podcasts`)     methods.podcasts.accept(req.params.id, {id:+adminId})
    
        if (req.body.attr == `authorId`) {
            getDoc(authors, req.body.value).then(a => {
                ref.update({
                    authorName: a.name
                })
            })
        }
    
        if (req.body.attr == `courseId`) {
            getDoc(courses, req.body.value).then(a => {
                ref.update({
                    course: a.name
                })
            })
        }
    
        if (req.body.attr == `planId`) {
            getDoc(plans, req.body.value).then(a => {
                ref.update({
                    plan: a.name
                })
            })
        }
    
        res.json({
            success: true
        })
    } catch (error) {
        handleError(error,res)
    }
    
}

const wine = {
    consume: async function (recordId,admin){
        return new Promise(async(resolve, reject)=>{
            try {
                let d = await getDoc(wineList,recordId); 
                if(!d || !d.left || d.left < 1) reject({message: `Этому больше не наливать`});
                let upd = await wineList.doc(recordId).update({
                    left:       FieldValue.increment(-1),
                    updatedAt:  new Date(),
                    statusBy:   +admin.id
                })
                
                sendMessage2({
                    photo: process.env.ngrok + `/paper/qr?id=${recordId}&entity=wineList`,
                    chat_id: d.user,
                    caption: d.left-1 
                        ? `Ваш депозит убыл. На балансе ${letterize(d.left-1, 'ходка')}`
                        : `Приплыли. Депозит на нуле. Пора домой.`
                }, 'sendPhoto', token, messages)   
                
                resolve({
                    success: true,
                    comment: `Остаток: ${letterize(d.left-1, 'ходка')}`
                }) 
            } catch (error) {
                handleCatch(arguments,error);
            }
        })
    },
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
    randomCoffeePrepare(admin,res,req){
    
        this.rcCheckBefore(req.body.text)
    
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
    },
    welcome2RC(id){
    
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
    },
    rcCheckBefore(text){
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
    },
    async randomCoffee(admin,id){

        log({
            silent: true,
            text: `${uname(admin,admin.id)} запускает random coffee`,
            admin: +admin.id
        })
    
        randomCoffeeIterations.doc(id).update({
            started: new Date()
        })
    
        let before = await ifBefore(randomCoffees,{})
        
        let users = await ifBefore(udb, {randomCoffee: true, active: true})

        let users2meet = users
            .filter(u => u.occupation && u.about)
            .filter(u => !u.randomCoffeePass)

        while(users2meet.length > 1){
            let first = users2meet.splice(0,1)[0]
            let exs = before
                .filter(couple => couple.first == +first.id || couple.second == +first.id)
                .map(couple=>couple.first == +first.id ? couple.second : couple.first)
            
            let news = users2meet.slice().filter(u=>exs.indexOf(+u.id) == -1)
            
            if(news.length){
                
                let randomIndex =   Math.floor(Math.random()*news.length)
                let secondId =      news[randomIndex].id
                let spliceIndex =   users2meet.map(u=>u.id).indexOf(secondId)
                let second =        users2meet.splice(spliceIndex,1)[0]
                
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
        users.filter(u => !u.occupation || !u.about)
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
    check: async(id)=>{
        let data = await getDoc(coworkingCol,id);
        
        if(!data) return false;
        
        let result = {
            data: data,
            alert: ''
        }
        let user = await getUser(data.user, udb);
        
        if(user.blocked) {
            result.alert = `Пользователь в черном списке!`
            return result;
        }

        result.user = user;

        result.data.hall = await getDoc(halls, data.hall);

        let plan = await ifBefore(plansUsers,{active:true,user: +user.id})[0];

        result.plan = plan || null;

        if(plan && plan.visitsLeft) result.alert = `Гость на подписке (у него еще ${plan.visitsLeft} посещений)`;

        return result;
    },
    async closeRoom (roomID, date, admin){
        let hall = await getDoc(halls,roomID);
        
        if(!hall || !hall.active) throw new Error(`no such room`)
        
        let already = await ifBefore(roomsBlocked,{active:true,date:date,room:roomID})
        
        if(already.length) throw new Error(`already closed`)

        let record = await roomsBlocked.add({
            createdAt:  new Date(),
            createdBy:  +admin.id,
            active:     true,
            date:       date,
            room:       roomID
        })

        let affected = await ifBefore(coworkingCol,{active:true,date:date,hall:roomID});

        log({
            filter: `coworking`,
            text:   `${uname(admin,admin.id)} закрывает зал ${hall.name} на ${date}. ${affected.length ? `Количество затронутых пользователей: ${affected.length}`: ''}`,
            admin:  +admin.id,
            hall:   roomID
        })

        affected.forEach(r=>this.alertCancel(r))

        return {
            id: record.id,
            comment: `Комната закрыта, снято ${affected.length} записей.`
        };
    },
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
                            text: `Добрый вечер!\nМы были рады видеть вас в коворкинге Papers.А вы?.. \nПожалуйста, поставьте нам честную оценку. Мы также будем рады любой обратной связи (просто напишите в бот, что вам понравилось — а что могло быть и лучше).\n\nО приятном: покажите это сообщение нашему администратору в течение недели и получите скидку 25 % на любой тариф в нашем коворкинге. Тарифы можно изучить прямо в этом боте, нажав на кнопку «приложение» в его левом нижнем углу.`,
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
    },
    async cancel(id,userId){
        let record = await getDoc(coworkingCol,id);
        if(!checkEntity(`record`,record)) throw new Error(`noAppointment`);
        if(record.user !== +userId) throw new Error(`unAuthorized`);
        let user = getUser(userId,udb);

        let upd = await coworkingCol.doc(id).update({
            active: false,
            updatedAt: new Date(),
            updatedBy: +userId
        })

        log({
            filter: `coworking`,
            text: `${uname(user,user.id)} отменяет запись в коворкинге ${record.date}`
        })
        return 'appointmentCancelled'

    }
}

const plan = {
    create:async(data,admin)=>{
        
        if(!consistencyCheck(data,[`price`,`visits`,`events`,`days`])) return;
        let record = await plans.add(new Plan(data,admin).js);
        log({
            text: `Админ ${uname(admin,admin.id)} создает подписку «${data.name}» (${cur(data.price)}).`,
            admin: +admin.id
        })
        return {
            success: true,
            id: record.id
        }
    },
    getRequest:(id)=>{
        return new Promise(async(resolve,reject)=>{
            try {
                let d = await getDoc(plansRequests,id);
                if(!d) reject({
                    message: `Нет такой заявки.` 
                }) 
                if(!d.active) reject({
                    message: `Заявка дективирована.` 
                })
                let plan = await getDoc(plans,d.plan);
                let user = await getUser(d.user, udb);
                resolve({
                    data:{
                        user: user,
                        plan: plan
                    }
                })    
            } catch (error) {
                reject({
                    message: error.message
                })
            }
            
        })
        
    },
    approveRequest(id,admin){
        return new Promise(async(resolve,reject)=>{
            try {
                let data = await this.getRequest(id).then(d=>d.data);
                data = data;
                let plan = new newPlanRecord()
            } catch (error) {
                reject({
                    message: error.message
                })
            }
        })   
    },
    alertDisposal:(p)=>{
        sendMessage2({
            chat_id: p.user,
            text: `Ваша подписка на тарифный план ${p.name} была аннулирована.`
        },false,token,messages)
    },
    request:async(user,planId)=>{
        let plan = await getDoc(plans, planId)
        if(!checkEntity(`plan`,plan)) throw new Error(`plan invalid`);
        
        let before = await ifBefore(plansRequests,{user:+user.id, active:true, plan: planId});
        if(before.length) throw new Error(`already booked`);

        let alreadyBooked = await ifBefore(plansUsers,{user:+user.id,active:true,plan: planId});
        if(alreadyBooked.length) throw new Error(`plan in progress`);
        
        let record = await plansRequests.add({
            createdAt:  new Date(),
            user:       +user.id,
            plan:       planId,
            active:     true
        })

        log({
            filter: `coworking`,
            text: `${uname(user,user.id)} подает заявку на тариф ${plan.name}.\nНадо связаться с человеком и объяснить правила и платеж.`,
            plan: plan.id,
            user: +user.id
        })

        sendMessage2({
            chat_id:        user.id,
            photo:          `${process.env.ngrok}/paper/qr?id=${record.id}&entity=planRequests`,
            caption:       `Вы запросили подключение тарифа ${plan.name}.\nПросто покажите администратору этот код — он сможет подключить тариф в пару кликов.`
        },'sendPhoto',token,messages)

        return {
            success: true,
            id: record.id,
            comment: `Заявка принята! Мы скоро свяжемся с вами.`
        }
    }
}

const profileMethods = {
    async get(user){
        return new Promise((resolve, reject)=>{

            try {
                let warning = null;
            
                userEntries.add({
                    user: +user.id,
                    createdAt: new Date()
                })

                udb.doc(user.id.toString()).update({
                    appOpens:       FieldValue.increment(1),
                    appLastOpened:  new Date()
                })

                let data = [];

                data.push(classes.where(`date`, '>', isoDate()).get().then(col => handleQuery(col)))
                data.push(userClasses.where(`user`, '==', +user.id).where('active', '==', true).get().then(col => handleQuery(col)))
                data.push(coworkingCol.where('date', '>=', isoDate()).where('user', '==', +user.id).where('active', '==', true).get().then(col => handleQuery(col)))
                data.push(mra.where('date', '>=', isoDate()).where('user', '==', +user.id).where('active', '==', true).get().then(col => handleQuery(col)))
                
                if(user.fellow){
                    data.push(
                        polls
                        .where('active', '==', true)
                        .orderBy('createdAt', 'desc')
                        .get()
                        .then(col => handleQuery(col))
                    )

                    data.push(
                        pollsAnswers
                        .where('user', '==', +user.id)
                        .orderBy('createdAt', 'desc')
                        .get()
                        .then(col => handleQuery(col))
                    )
                }

                Promise.all(data).then(data => {
                    resolve({
                        warning:    warning,
                        admin:      user.admin,
                        insider:    user.insider,
                        fellow:     user.fellow,
                        noSpam:     user.noSpam,
                        classes:        data[0],
                        userClasses:    data[1],
                        coworking:      data[2],
                        mr:             data[3],
                        questions:      data[4] || null,
                        answers:        data[5] || null,
                    })
                    
                })
            } catch (error) {
                reject({})
            }
        })
        
        
    },
    async update(user,data){
        let plausible = [
            'email',
            'last_name',
            'first_name',
            'occupation',
            'about',
            'language_code',
            'noSpam',
            `randomCoffee`
        ]
        plausible.forEach(type => {
                            
            devlog(type)

            if (data.hasOwnProperty(type)) {
                
                devlog(`${type}: ${data[type]}`)
                
                udb.doc(user.id.toString()).update({
                    [type]:     data[type],
                    updatedAt:  new Date()
                })

                if (type == 'language_code') {
                    axios.post(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
                        "chat_id": user.id,
                        "menu_button": {
                            "type": "web_app",
                            "text": translations.app[data.type] || translations.app.en,
                            "web_app": {
                                "url": process.env.ngrok+"/paper/app"
                            }
                        }
                    })
                }
            } else if (data.attr == type){
                
                devlog(`обвноляем ${data.attr}`)

                udb.doc(user.id.toString()).update({
                    [data.attr]: data.value,
                    updatedAt: new Date()
                })
            }
        })

        return true;
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
                    hallsData.push(getDoc(halls,id))
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


function registerView(d,userId, entity, col){
    views.add({
        createdAt:  new Date(),
        name:       d.name || null,
        id:         d.id || null,
        user:       userId || null,
        entity:     d.entity || entity || null
    }).then(()=>{
        if(col){
            col.doc(d.id).update({
                views: FieldValue.increment(1)
            })
        }
    })
}

const classMethods = {
    remind: async (rec) => {
        let tickets = await ifBefore(userClasses,{active:true,class:rec.id});
        tickets.forEach(async(t,i)=>{
            let user = await getUser(t.user,udb);
            setTimeout(()=>{
                sendMessage2({ 
                    chat_id: process.env.develop ? dimazvali : rec.user,
                    text: translations.lectureReminder(rec,user)[user.language_code] || translations.lectureReminder(rec,user).en,
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                                callback_data: `unclass_${t.id}`
                            }],[{
                                text: translations.openClass[user.language_code] || translations.openClass[user.language_code],
                                web_app: {
                                    url: process.env.ngrok + '/paper/app?start=class_'+rec.id
                                }
                            }]
                        ]
                    }
                }, false, token, messages)
            },i*200)
            
        })
        
    },
    feedBackRequest:async(c)=>{
        let l = await getDoc(classes,c);
        let tickets = await ifBefore(userClasses,{class:c, active:true, status: `used`})
        tickets.forEach((ticket,i)=>{
            setTimeout(async ()=>{
                let user = await getUser(ticket.user,udb);
                sendMessage2({
                    chat_id:    process.env.develop ? dimazvali : ticket.user,
                    text:       translations.feedBackRequest(ticket,l)[user.language_code] || translations.feedBackRequest(ticket,l).en,
                    reply_markup:{
                        inline_keyboard:[
                            classRates.map(r=>{
                                return {
                                    text: r.toString(),
                                    callback_data: `feedback_ticket_${ticket.id}_${r.toString()}`
                                }
                            })                            
                        ]
                    }
                },false,token,messages)
            },i*200)
        })

        classes.doc(c).update({
            feedBackSent: new Date()
        })

        return tickets.length;
    },
    bookClass: async (user, classId, res, id, amount)=>{
        
        if(!amount) amount = 1;

        if (!user) {
            user = await getUser(id,udb)
        }

        if(!user) {
            if(res) res.status(400).send(`no such user`)
            return;
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
            amount:     amount
        }

        let sub = (await ifBefore(plansUsers,{user:+user.id,active:true}))[0];

        let subData = sub ? `подписка: ${sub.name}` : ``;

        let alreadyLine = await ifBefore(userClasses,{class:classId,active:true});

        devlog(alreadyLine);

        let before = alreadyLine.reduce((a,b)=> a+(b.amount||1) ,0)
        
        devlog(before);

        let line =          before;
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
            visitors: FieldValue.increment(amount)
        })

        seatsData = `забронировано мест: ${line} из ${capacity||`бесконечного множества`}`;
        
        if (res) res.json({
            success: true,
            text: `lectureConfirm`
        })

        sendMessage2({
            chat_id:    user.id,
            photo:      process.env.ngrok + `/paper/qr?id=${record.id}&entity=userClasses`,
            caption:    translations.lectureInvite(c,amount)[user.language_code] || translations.lectureInvite(c,amount).en,
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
                let t = cl.data() || {};
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
    
            if (callback_query) return cba({body:{callback_query:{id:callback_query}}}, translations[code][user.language_code] || translations[code].en)
    
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
    acceptTicket:async(ticketId,res,admin)=>{

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

        

        let cl = await getDoc(classes,t.class);

        userClasses.doc(ticketId).update({
            status:     'used',
            known:      true,
            updatedAt:  new Date(),
            statusBy:   +admin.id
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

        if(cl.welcome) sendMessage2({
            chat_id: user.id,
            text: cl.welcome
        }, false, token, messages)

        if(res) res.json({
            success: true,
            comment: `Билет засчитан.${planned?` Посещение вычтено из тарифа.`:``}`
        })
    },
    async getTicket(id){
        return new Promise(async(resolve,reject)=>{
            try {
                let ticket = await getDoc(userClasses,id);
                if(!ticket || !ticket.active) reject({
                    comment: `Нет такого билета.`
                })
                let alert = ticket.alert || '';
                let cl = await getDoc(classes,ticket.class);
                if(!cl || !cl.active) reject({comment:`Мероприятие не существует (или было отменено).`})
                ticket.date = drawDate(cl.date,`ru`,{time:true});
                ticket.hall = cl.hallName;
                let userPlan = await ifBefore(plansUsers,{active:true,user:+ticket.user})[0];
                if(userPlan && userPlan.eventsLeft) alert += ` Посещение по подписке (осталось ${plan.eventsLeft-1})`
                resolve({
                    alert:      alert,
                    success:    true,
                    data:       ticket
                })    
            } catch (error) {
                reject({
                    comment: error.message
                })
            }
            
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
        
    },
    async add(data,admin){
        return new Promise(async(resolve,reject)=>{
            try {
                if(!consistencyCheck(data,[
                    `name`,
                    `description`,
                    `date`
                ])) reject({comment: `fields missing`})
                
                let c = new classRecord(data).js;
                let record = await classes.add(c);

                resolve({
                    success:    true,
                    comment:    `Мероприятие создано`,
                    id:         record.id
                })

                log({
                    filter: `lectures`,
                    class:  record.id,
                    admin:  +admin.id,
                    text:   `${uname(admin,admin.id)} создает мероприятие ${c.name}.`
                })

                if(data.author){
                    getDoc(authors,data.author).then(a=>{
                        if(!a || !a.active) classes.doc(record.id).update({
                            author: null
                        })
                    })
                }

                if(data.hall){
                    getDoc(halls,data.hall).then(a=>{
                        if(!a || !a.active) {
                            classes.doc(record.id).update({
                                hall: null
                            }) 
                        } else {
                            classes.doc(record.id).update({
                                hallName: a.name
                            })
                        }

                    })
                }
            } catch(err){
                reject({
                    comment: err.message
                })
            }
        })
    },
    async prepareRC(id,text){
        let tickets = await ifBefore(userClasses,{class:id,status: `used`});
        tickets = shuffle(tickets.filter(t=>!t.pass));
        tickets.forEach((t,i)=>{
            setTimeout(()=>{
                sendMessage2({
                    chat_id: t.user,
                    text: text,
                    reply_markup:{
                        inline_keyboard: [[{
                            text:           `Пас`,
                            callback_data:  `randomLecturePass_${t.id}`
                        }]]
                    }
                        
                },false,token,messages)
            },i*200)
        })
        return tickets.length
    },
    async startRC(id,text){
        let tickets = await ifBefore(userClasses,{class:id,status: `used`});
        tickets = shuffle(tickets.filter(t=>!t.pass));
        let q = tickets.length.toString();

        while(tickets.length > 1){
            let couple = tickets.splice(0,2);
            let firstUser = await getUser(couple[0].user,udb);
            let secondUser = await getUser(couple[1].user,udb);
            await sendMessage2({
                chat_id: firstUser.id,
                text: `Это рэндом-кофе. Вашей парой становится @${secondUser.username}. ${text||''}`
            },false,token,messages)
            await sendMessage2({
                chat_id: secondUser.id,
                text: `Это рэндом-кофе. Вашей парой становится @${firstUser.username}. ${text||''}`
            },false,token,messages)
        }
        return q
    },
    async get(id,userId){
        let c = await getDoc(classes,id);
        // if(!checkEntity(`ticket`,c)) throw new Error(`no such event`);
        if(userId){
            registerView(c, userId, `classes`, classes);
            let ticket = await ifBefore(userClasses,{active:true,user:+userId,class:id})[0];
            if(ticket){
                c.booked =  ticket.id;
                c.used =    ticket.status;
                c.status =  ticket.status;
            }
        }
        return c
    },
    async announce(data, admin){
        try {

            if(!consistencyCheck(data,[`class`,`type`,`text`])) throw new Error(`data missing`)

            let list = userClasses.where(`class`,`==`,data.class);
            
            if(data.type == `all`)      list = list.where('active', '==', true)
            if(data.type == `inside`)   list = list.where('status', '==', `used`)
            if(data.type == `outside`)  list = list.where('status', '!=', `used`)

            let tickets = await list.get().then(col=>handleQuery(col));

            tickets.forEach((t,i)=>{
                setTimeout(()=>{
                    sendMessage2({
                        chat_id:    t.user,
                        text:       data.text,
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: translations.openClass.en,
                                    web_app: {
                                        url: process.env.ngrok + '/paper/app?start=class_'+data.class
                                    }
                                }]
                            ]
                        }
                    }, false, token, messages, {admin: +admin.id})
                },i*200)
            })

            return {
                success: true,
                comment: `Рассылка уходит на ${tickets.length} пользователей.`
            }

        } catch (error) {
            throw new Error(error.message)
        }
    },
    async rate(data,user){
        if(!consistencyCheck(data,[`rate`,`ticket`])) throw new Error(`data missing`);
        let ticket = await getDoc(userClasses,data.ticket);
        if(!checkEntity(`ticket`,ticket) || ticket.status != `used`) throw new Error(`ticket invalid`);
        if(ticket.user !== +user.id) throw new Error(`not your ticket`);
        await userClasses.doc(data.ticket).update({
            rate:        +data.rate,
            reviewed:    new Date()
        })
        this.classReScore(ticket.class);
        log({
            filter: `lectures`,
            text:   `Новая оценка к мероприятию ${data.className}: ${data.rate}`,
            user:   +user.id,
            class:  ticket.class,
            ticket: ticket.id
        })
        return true;
    },
    async review(data,user){
        if(!consistencyCheck(data,[`text`,`ticket`])) throw new Error(`data missing`);
        let ticket = await getDoc(userClasses,data.ticket);
        if(!checkEntity(`ticket`,ticket) || ticket.status != `used`) throw new Error(`ticket invalid`);
        if(ticket.user !== +user.id) throw new Error(`not your ticket`);
        await userClasses.doc(data.ticket).update({
            review:        data.text,
            reviewed:       new Date()
        })
        log({
            filter: `lectures`,
            text:   `Новый отзыв к мероприятию ${data.className}: ${data.text}`,
            user:   +user.id,
            class:  ticket.class,
            ticket: ticket.id
        })
        return true;
    }
    // TBD: уведомления для авторов по отзывам и оценкам
}

const authorMethods = {
    add:(data,admin)=>{
        return new Promise(async (resolve,reject)=>{
            try {
                if(!consistencyCheck(data,[`name`,`description`])) reject({message:`data missing`});
                
                let author = new Author(data,admin).js;
                let record = await authors.add(author)
                
                log({
                    text: `${uname(admin,admin.id)} создает автора ${author.name}.`,
                    author: record.id
                })

                resolve({
                    success: true,
                    id: record.id,
                    comment: `Автор ${data.name} создан. Можно добавить еще.`
                })    
            } catch (err) {
                reject(err.message)
            }
        })
    },
    get: async(id)=>{
        let author = await getDoc(authors,id);
        if(!author) throw new Error(`no such author`);
        let classesList =       await ifBefore(classes,{authorId:id});
        let subs =              await ifBefore(subscriptions,{author: id,active:true});
        let coursesList =       await ifBefore(courses,{active:true,authorId:id});
        return {
            author:         author,
            classes:        classesList,
            subscriptions:  subs,
            courses:        coursesList
        }
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
            
            let d = {
                user:       +user.id,
                date:       date,
                time:       time,
                active:     true,
                createdAt:  new Date()
            }

            let rec = await mra.add(d)

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
                    success:    true,
                    text:       'coworkingBookingConfirmed',
                    rec:        rec.id,
                    id:         rec.id,
                    data:       d
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
        
    },
    alertCancel:(record)=>{
        sendMessage2({
            chat_id: record.user,
            text: `Простите, ваша запись в переговорку на ${record.time} была снята.`
        },false,token, messages)
    }
}

const newsMethods = {
    startNews: async (id) => {
        return new Promise(async (resolve, reject) => {
            try {
                let message = await getDoc(news, id);
                
                if(!message) reject(`нет такой рассылки`)

                if(!message.class) {

                    let users = [];

                    if(message.recipients) {
                        users = message.recipients.split(`\n`).filter(id=>id).map(id=>{
                            return {
                                id: id
                            }
                        })
                    } else {
                        users = await ifBefore(udb, { active: true, noSpam: false });
                    }

                    if(message.filter){
                        let field = message.filter.split(`_`)[0];
                        users =     users.filter(u=>u[field]) 
                    }

                    resolve({
                        success: users.length,
                    })
                    
                    
                    for (let index = 0; index < users.length; index++) {
                        const u = users[index];
                        let m = null;
                        try {
                            if(!message.media || !message.media.length){
                                m = await sendMessage2({
                                    chat_id:    u.user || u.id,
                                    text:       message.text,
                                    parse_mode: `HTML`,
                                    protect_content:        message.safe?true:false,
                                    disable_notification:   message.silent?true:false,
                                },false,token,messages,{news: message.id})
                            } else if(message.media && message.media.length == 1) {
                                m = await sendMessage2({
                                    chat_id:        u.user || u.id,
                                    caption:        message.text,
                                    parse_mode:     `HTML`,
                                    photo:          message.media[0],
                                    protect_content: message.safe?true:false,
                                    disable_notification: message.silent?true:false,
                                },`sendPhoto`,token,messages,{news: message.id})
                            } else if(message.media){
                                m = await sendMessage2({
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
                            
                            if(m && m.result) await news.doc(message.id).update({
                                audience: FieldValue.increment(1)
                            })    
                        } catch (error) {
                            handleError(error);
                        }
                    }
                    await news.doc(message.id).update({
                        finished: new Date()
                    })
                    alertAdmins({
                        text: `Рассылка ${message.name} завершена` 
                    })

                } else {
                    let cl = await getDoc(classes, message.class);
                    
                    // let records = await ifBefore(userClasses,{
                    //     class: message.class,
                    //     active: true
                    // })

                    let records = await ifBefore(udb, { active: true, noSpam: false });

                    if(message.filter){
                        let field = message.filter.split(`_`)[0];
                        records =     records.filter(u=>u[field]) 
                    }

                    resolve({
                        success: records.length,
                    })

                    for (let index = 0; index < records.length; index++) {
                        const user = records[index];
                        
                        // let user = await getUser(ticket.usedRecords,udb)
                        
                        let m = await sendClass(cl,user,message.id)
                        
                        if(m && m.result) await news.doc(message.id).update({
                            audience: FieldValue.increment(1)
                        })
                    }

                } 
                
                
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
                    recipients:         data.recipients || null,
                })
    
                log({
                    text:   `${uname(admin,admin.id)} создает рассылку с рабочим названием «${data.name}».`,
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

const roomMethods = {
    async create(data,admin){
        if(!consistencyCheck(data,[`floor`,`capacity`,`price`])) return;
        
        let record = await halls.add(new Hall(data,admin))   

        log({
            text:   `${uname(admin,admin.id)} создает зал ${data.name}.`,
            admin:  +admin.id,
            hall:   record.id
        })

        return {
            success: true,
            id: record.id
        }
    }
}

const methods = {
    podcasts:{
        async getRated(userId,grade){
            try {
                let user = await getUser(userId,udb);
                await udb.doc(user.id).update({
                    podcastRate: +grade
                })
                log({
                    text: `${uname(user,user.id)} ставит подкаст-студии оценку ${grade}`,
                    user: +user.id
                })
            } catch (error) {
                handleError(error)
            }
            
        },
        async requestFeedBack(user){
            sendMessage2({
                chat_id:    user.id,
                text:       translations.podcastFeedBackRequest[user.language_code]|| translations.podcastFeedBackRequest.en,
                reply_markup:{
                    inline_keyboard:[
                        [{
                            text: `1`,
                            callback_data: `feedback_podcasts_1`
                        },{
                            text: `2`,
                            callback_data: `feedback_podcasts_2`
                        },{
                            text: `3`,
                            callback_data: `feedback_podcasts_3`
                        },{
                            text: `4`,
                            callback_data: `feedback_podcasts_4`
                        },{
                            text: `5`,
                            callback_data: `feedback_podcasts_5`
                        }],
                    ]
                }
            },false,token,messages)
        },
        async accept(id,admin){
            try {
                admin = await getUser(admin.id,udb)
            
                let record =    await getDoc(podcastRecords,id);
                let user =      await getUser(record.user, udb);
                
                if(user){
                    udb.doc(user.id).update({
                        podcastsVisits: FieldValue.increment(1)
                    })

                    if(!user.podcastRate){
                        this.requestFeedBack(user)
                    }
                }

                log({
                    silent:         true,
                    text:           `${uname(admin,admin.id)} подтверждает посещение подкастерской со стороны ${uname(user,record.user)}`,
                    podcastRecord:  id
                })    
            } catch (error) {
                handleError(error)
            }
        },
        async list(userId, admin){
            
            let before = await podcastRecords.where(`date`,'>=',isoDate()).get().then(col=>handleQuery(col));
            
            if(admin) return before;

            before = before.filter(r=>r.active && r.date < isoDate(14)).map(r=>{
                if(r.user != userId) delete r.user;
                return r;
            })
            
            let result = [];

            let days = 0;
            while (days < 14){

                let date = isoDate(days);
                let hour = 10;
                
                while (hour < 22){
                    let already = before.filter(r=>r.date == isoDate(days) && r.time == hour)[0];
                    
                    let slot = {
                        date:       date,
                        time:       hour,
                        available:  already ? false : true,
                        id:         (already && already.user) ? (already.id || null) : false
                    }

                    result.push(slot);

                    hour++
                }
                days ++;
            }

            return result;

        },
        async book(data,admin){
            
            devlog(data);

            let user =          await getUser(data.user, udb);
            if(!user)           throw new SearchError(`нет такого пользователя`);
            if(user.blocked)    throw new PermissionDenied(`доступ ограничен`);
            let before =        await ifBefore(podcastRecords,{user: +data.user, active: true, date:data.date, time: data.time});
            if(before.length)   throw new AlreadyError(`уже забронировано`)
            let record =        await podcastRecords.add(new PodcastRecord(data,admin).js);

            alertAdmins({
                filter: `podcasts`,
                text: `${uname(user,user.id)} записывается в подкастерскую на ${data.date}, ${data.time}.`
            })

            await sendMessage2({
                chat_id:    user.id,
                text:       `Вы забронировали подкастерскую на час с ${data.date}, ${data.time}:00.`,
                reply_markup: {
                    inline_keyboard: [[{
                        text: `Отменить`
                    }]]
                }
            },false,token,messages)

            

            return record.id
        },

        async cancel(id,reason,user,admin){
            
            let record = await getDoc(podcastRecords, id);
            
            if(!admin){
                if(+record.user != +user.id) throw new PermissionDenied(`вы не можете отменить чужую запись`)
            }

            if(!record) throw new SearchError(`нет такой записи`);
            if(!record.active) throw new SearchError(`запись уже отменена`);
            if(record.status == `used`) throw new Error(`нельзя отменить уже состоявшуюся запись`)
            
            let upd = await podcastRecords.doc(id).update({
                active:     false,
                status:     `cancelled`,
                reason:     reason || null,
                updatedAt:  new Date(),
                updatedBy:  +user.id 
            })

            if(admin){
                alertAdmins({
                    filter: `podcasts`,
                    text: `${uname(user,user.id)} отменяет запись в подкастерскую на ${record.date}, ${record.time} ${reason ? `по прчиине ${reason}` : `без указания причин`}`
                })
            }

            if(!user) user = await getUser(record.user,udb);

            sendMessage2({
                chat_id:    record.user,
                text:       translations.podcastRecordCancelled[user.language_code](record) || translations.podcastRecordCancelled.en(record)
            },false,token,messages)

            return true;
        },
    },
    deposits:{
        add: async(admin, data, res)=>{
            if(!consistencyCheck(data,[
                `amount`,
                `user`
            ])) return;

            let user = await getUser(data.user,udb);

            if(!user) return res.status(404).send(`no such user`);
            
            deposits.add({
                createdAt:  new Date(),
                createdBy:  +admin.id,
                amount:     Number(data.amount),
                user:       data.user,
                description: data.description
            }).then(rec=>{
                udb.doc(data.user.toString()).update({
                    deposit: FieldValue.increment(Number(data.amount))
                }).then(()=>{
                    let newDeposit = (+user.deposit || 0)+Number(data.amount)
                    res.json({
                        success:    true,
                        comment:    `Баланс обновлен.`,
                        total:      newDeposit
                    })
                    log({
                        admin: +admin.id,
                        deposit: rec.id,
                        user: data.user,
                        text: `${uname(admin,admin.id)} обновляет баланс пользователя ${uname(user,user.id)} на ${data.amount}\n(${data.description||'без лишних слов'})`
                    })
                    sendMessage2({
                        chat_id: user.id,
                        text: translations.deposited(newDeposit)[user.language_code] || translations.deposited(newDeposit).en
                    },false,token,messages)
                })

            }).catch(err=>{
                res.status(500).send(err.message)
            })


        }
    },
    plans:{
        add:(admin, data, res)=>{

            return new Promise(async (resolve,reject)=>{
                try {
                    if(!consistencyCheck(data,[
                        `plan`,
                        `user`
                    ],res)) return reject({send: true});
                    
                    let plan = await getDoc(plans,data.plan);
                    
                    if(!checkEntity(`plan`, plan, res)) return reject({send: true});
                    
                    let user = await getUser(data.user, udb);
        
                    if(!checkEntity(`user`, user, res)) return reject({send: true});
        
                    if(data.request) {
                        let request = await getDoc(plansRequests,data.request)
                        if(!checkEntity(`request`, request, res)) return reject({send: true});
                    }
                    
                    let rec =  await plansUsers.add(new newPlanRecord(plan, admin, user).js)
        
                    if(data.request) plansRequests.doc(data.request).update({
                        active: false,
                    })
        
                    sendMessage2({
                        chat_id: user.id,
                        text: translations.planConfirmed(plan)[user.language_code] || translations.planConfirmed(plan).en
                    },false,token,messages)
        
                    log({
                        filter: `coworking`,
                        text: `${uname(admin, admin.id)} выдает подписку «${plan.name}» (${cur(plan.price,'GEL')}) пользователю ${uname(user, user.id)}`,
                        admin:  +admin.id,
                        user:   +user.id,
                        silent: true
                    })
    
                    resolve({
                        success:    true,
                        comment:    `Подписка оформлена.`,
                        od:         rec.id
                    })
                } catch (error) {
                    reject({message:error.message})
                }
                
            })
        },
        get:async(id, userId)=>{
            let plan = await getDoc(plans,id);
            if(!checkEntity(`plan`,plan)) throw new Error(`no such plan`);
            if(userId){
                let already = await ifBefore(plansUsers,{plan: id, active:true, user: +userId})
                if(already[0]) plan.inUse = already[0];
            }
            registerView(plan, userId, `plans`, plans);
            return plan;
        }
    },
}


const standAloneMethods = {
    async get(slug,user){
        let data = await getDoc(standAlone,slug);
        if(!checkEntity(`page`,data)) throw new Error(`no such page`);
        registerView(data,user?user.id:null,`standAlone`,standAlone)
        return data;
    },
    async add(data,admin){
        if(!consistencyCheck(data,[`name`,`slug`])) throw new Error(`data missing`)
        let before = await getDoc(standAlone,data.slug);
        if(before) throw new Error(`slug occupied`);
        let p = new Page(data,admin).js;
        let record = await standAlone.doc(data.slug.toString()).set(p)
        
        log({
            text:   `${uname(admin,admin.id)} создает раздел "${data.name}"`,
            page:   data.slug,
            admin:  +admin.id
        })

        return {
            success: true,
            id: data.slug
        }
        
    }
}


module.exports = {
    alertAdminsCoworking,
    alertSoonMR,
    alertWithdrawal,
    authorMethods,
    classDescription,
    classMethods,
    coworking,
    deleteEntity,
    methods,
    mrMethods,
    newsMethods,
    nowShow,
    plan,
    profileMethods,
    rcMethods,
    roomMethods,
    sendClass,
    standAloneMethods,
    updateEntity,
    wine,
}