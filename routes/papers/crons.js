//@ts-check

var express =   require('express');
var router =    express.Router();

var cron =      require('node-cron');
const { nowShow,alertSoonMR, alertAdminsCoworking, classMethods, coworking } = require('./logics');
const { log } = require('debug');

const { devlog, drawDate, uname, getNewUsers, handleQuery, ifBefore, handleDoc, isoDate, getDoc, letterize } = require('../common');
const { udb, plansUsers, messages, views, classes, authors, halls, userEntries } = require('./cols');
const translations = require('./translations');
const { getUser, sendMessage2 } = require('../methods');

let token =         process.env.papersToken;

let siteSectionsTypes = {
    classes:{
        title:  `Афиша`,
        data:   classes,
    },
    authors:{
        title:  `Резиденты`,
        data:   authors
    },
    halls:{
        title:  `Коворкинг`,
        data:   halls
    }
}


if(!process.env.develop){
    cron.schedule(`55,25 * * * *`, () => {
        alertSoonMR()
    })
    
    
    cron.schedule(`0 5 * * *`, () => {
        alertSoonCoworking()
        alertAdminsCoworking()
        countUserEntries(1)
        nowShow()
        updatePlans()
        getNewUsers(udb,1).then(newcomers=>{
            log({
                text: `Новых пользователей за сутки: ${newcomers}`
            })
        })
    })

    cron.schedule(`0 5 * * 1`,()=>{
        alertMiniStats(7)
        getNewUsers(udb,7).then(newcomers=>{
            log({
                text: `Новых пользователей за неделю: ${newcomers}`
            })
        })
    })
    
    cron.schedule(`0 11 * * *`, () => {
        alertSoonClasses()
    })

    cron.schedule(`0 19 * * *`, () => {
        feedBackTimer()
    })

    cron.schedule(`0 15 * * *`, () => {
        coworking.requestCoworkingFeedback()
    })
    
    cron.schedule(`0 5 1 * *`, () => {
        getNewUsers(udb,30).then(newcomers=>{
            log({
                text: `Новых пользователей за месяц: ${newcomers}`
            })
        })
    })
}


function countUserEntries(days){
    userEntries
        .where(`createdAt`,'>=',new Date(+new Date()-days*24*60*60*1000))
        .get()
        .then(col=>{
            let users = handleQuery(col)
            log({
                text: `За последние сутки ${letterize([... new Set(users.map(r=>r.user))].length,`гость`)} ${letterize(users.length,`раз`)} открывали приложение.`
            })
        })
}

function feedBackTimer(){
    classes
        .where(`active`,'==',true)
        .where(`date`,`>=`,new Date(+new Date() - 24*60*60*1000))
        .get()
        .then(col=>{
            handleQuery(col)
                .filter(c=>!c.feedBackSent)
                .forEach(c=>{
                    log({
                        filter: `lectures`,
                        text:   `Автоматический запрос отзывов на лекцию ${c.name}`,
                        class:  c.id
                    })
                    classMethods.askForFeedback(c.id)
                })
        })
}

function alertSoonClasses() {
    classes
        .where('active', '==', true)
        .where('date', '==', isoDate())
        .get()
        .then(col => {
            handleQuery(col).forEach(record => {
                classMethods.remind(record)
            })
        }).catch(err => {
            console.log(err)
        })
}

function alertSoonCoworking() {
    coworking
        .where('active', '==', true)
        .where('date', '==', isoDate())
        .get()
        .then(col => {
            handleQuery(col).forEach(record => {
                remindOfCoworking(record)
            })
        }).catch(err => {
            console.log(err)
        })
}

async function remindOfCoworking(rec) {
    let user = await getUser(rec.user,udb);
    let hall = await getDoc(halls,rec.hall);

    sendMessage2({
        chat_id: rec.user,
        text: translations.coworkingReminder(hall)[user.language_code] || translations.coworkingReminder(hall).en,
        reply_markup: {
            inline_keyboard: [
                [{
                    text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                    callback_data: `ca_cancel_${rec.id}`
                }]
            ]
        }
    }, false, token, messages)
}

function updatePlans(){
    let data = ifBefore(plansUsers);

    let toBeOff = data.filter(p=>new Date() > new Date(p.to._seconds*1000))
    
    toBeOff.forEach(rec=>{
        getUser(rec.user,udb).then(u=>{
            
            log({
                filter: `coworking`,
                text:   `Подписка ${rec.name} ${uname(u,u.id)} закончила действие ${drawDate(rec.to._seconds*1000)}. Отправлен запрос на продление.`,
                user:   +rec.user,
            })
            
            plansUsers.doc(rec.id).update({
                active: false
            })

            sendMessage2({
                chat_id:    rec.user,
                text:       translations.planTerminated(rec)[u.language_code] || translations.planTerminated(rec).en
            },false,token,messages)
        })
    })
}

async function alertMiniStats(days){
    
    if(!days) days = 7;

    let admins = await ifBefore(udb, {admin:true})

    let ndate = new Date(+new Date() - days*24*60*60*1000)
     
    views
        .where('createdAt','>=',ndate)
        .get()
        .then(col=>{

            let data = col.docs.map(d=>d.data())

            if(data.length){
                
                let sections = {};
                
                data.forEach(rec=>{
                    if(!sections[rec.entity])           sections[rec.entity] = []
                    if(!sections[rec.entity][rec.id])   sections[rec.entity][rec.id] = 0
                    sections[rec.entity][rec.id] ++
                })

                

                Object.keys(sections).filter(type=>siteSectionsTypes[type]).forEach(type=>{
                    
                    let data = [];
                    
                    Object.keys(sections[type]).forEach(id=>{
                        data.push(siteSectionsTypes[type].data.doc(id).get().then(d=>handleDoc(d)))
                    })

                    Promise.all(data).then(data=>{
                        
                        admins.forEach(a => {
                            sendMessage2({
                                chat_id: a.id,
                                parse_mode: 'HTML',
                                text: `<b>Статистика просмотров раздела ${siteSectionsTypes[type].title} за ${days} дней</b>:\n\n${
                                    Object.keys(sections[type])
                                        .sort((a,b)=>sections[type][b]-sections[type][a])
                                        .map(id=>`${data.filter(r=>r.id == id)[0] ? data.filter(r=>r.id == id)[0].name : id}: ${sections[type][id]}`)
                                        .join('\n')
                                }`
                            },false,token)
                        })

                        
                    })
                })
            }
            
        })
}

module.exports = router;