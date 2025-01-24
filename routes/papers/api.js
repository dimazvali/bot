//@ts-check

var express =   require('express');
var router =    express.Router();
var axios =     require('axios').default;

const { FieldValue } = require('firebase-admin/firestore');
const { handleQuery, isoDate, getDoc, ifBefore, uname, cur, devlog, handleDoc } = require('../common');
const { alertAdmins, log, token, registerUser, isAdmin } = require('../papersBot');
const { plans, userClassesQ, polls, pollsAnswers, udb, userEntries, classes, userClasses, coworking, mra, halls, plansUsers, plansRequests, invites, authors, messages, coworkingRules, standAlone, eventTypes, views, roomsBlocked } = require('./cols');
const { classMethods, mrMethods } = require('./logics');
const translations = require('./translations');
const { getUser, sendMessage2 } = require('../methods');


router.get(`/:type`, (req, res) => {
    switch (req.params.type) {
        case `tariffs`:{
            return plans.where(`active`,'==',true).get().then(col=>res.json(handleQuery(col)))
        }
        // case `podcasts`:{
        //     return podcasts
        //         .where(`active`,'==',true)
        //         .where(`date`,'>=',isoDate())
        //         .get()
        //         .then(col=>{
        //             res.json(handleQuery(col).sort((a,b)=>a.date<b.date?-1:1))
        //         })
        // }

        case 'menu':{
            return axios.get(`${process.env.menuHost}/test/8UxO0ziaGusAzxnztRsU?lang=ge&api=true`)
            .then(data=>{
                console.log(data.data)
                res.json(data.data)
            }).catch(err=>{
                console.log(err)
                res.status(500).send(err.message)
            })
        }
        case `q`:{
            if(!req.query.class) return res.status(400).send(`no class provided`)
            return userClassesQ
                .where(`active`,'==',true)
                .where(`class`,'==',req.query.class)
                .get()
                .then(col=>{
                    res.json(handleQuery(col))
                })
        }
        case 'plans':{
            return plans.get().then(col=>{
                res.json(handleQuery(col).sort((a,b)=>{
                    return b.createdAt._seconds - a.createdAt._seconds 
                }))
            })
        }
        case 'polls': {
            let data = []
            data.push(
                polls
                .where('active', '==', true)
                .orderBy('createdAt', 'desc')
                .get()
                .then(col => handleQuery(col))
            )

            data.push(
                pollsAnswers
                .where('user', '==', +req.query.user)
                .orderBy('createdAt', 'desc')
                .get()
                .then(col => handleQuery(col))
            )
            return Promise.all(data).then(data => {
                res.json({
                    questions: data[0],
                    answers: data[1]
                })
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
            
                req.query.id = req.query.id || '';

            let warning = null;

            return userEntries.add({
                user: +req.query.id,
                createdAt: new Date()
            }).then(() => {

                udb.doc(req.query.id).update({
                    appOpens: FieldValue.increment(1),
                    appLastOpened: new Date()
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
                            insider: false,
                            fellow: false,
                            classes: [],
                            userClasses: [],
                            coworking: [],
                            mr: []
                        })
                    }
                    
                    if (u.blocked) {
                        return res.json({
                            warning: 'userBlocked'
                        })
                    }

                    let data = [];

                    data.push(classes.where(`date`, '>', isoDate()).get().then(col => handleQuery(col)))
                    data.push(userClasses.where(`user`, '==', +req.query.id).where('active', '==', true).get().then(col => handleQuery(col)))
                    data.push(coworking.where('date', '>=', isoDate()).where('user', '==', +req.query.id).where('active', '==', true).get().then(col => handleQuery(col)))
                    data.push(mra.where('date', '>=', isoDate()).where('user', '==', +req.query.id).where('active', '==', true).get().then(col => handleQuery(col)))

                    if (u.fellow) {
                        data.push(
                            polls
                            .where('active', '==', true)
                            .orderBy('createdAt', 'desc')
                            .get()
                            .then(col => handleQuery(col))
                        )

                        data.push(
                            pollsAnswers
                            .where('user', '==', +req.query.id)
                            .orderBy('createdAt', 'desc')
                            .get()
                            .then(col => handleQuery(col))
                        )
                    }

                    Promise.all(data).then(data => {
                        return res.json({
                            warning: warning,
                            admin: u.admin,
                            insider: u.insider,
                            fellow: u.fellow,
                            noSpam: u.noSpam,
                            classes: data[0],
                            userClasses: data[1],
                            coworking: data[2],
                            mr: data[3],
                            questions: data[4] || null,
                            answers: data[5] || null,
                            
                        })
                        
                    })
                })
            })
            break;
        }
        case 'usersList': {
            if (!req.query.user) return res.status(400).send('no user provided')
            if (!req.query.type) return res.status(400).send('no type provided')

            return udb.doc(req.query.user).get().then(u => {
                u = u.data();
                if (u.admin || u[req.query.type]) {
                    udb
                        .where(req.query.type, '==', true)
                        .where('active', '==', true)
                        .get().then(col => {
                            res.json(handleQuery(col).map(user => {
                                return {
                                    id: user.id,
                                    username: user.username,
                                    first_name: user.first_name,
                                    last_name: user.last_name,
                                    about: user.about
                                }
                            }))
                        })
                } else {
                    res.sendStatus(403)
                }
            })
        }
        case 'classes': {

            udb.doc(req.query.user).get().then(u => {
                if (!u.exists) return res.sendStatus(404);

                u = u.data();

                if (u.blocked) return res.sendStatus(403)

                let data = []

                data.push(classes
                    .where(`active`, '==', true)
                    .where('date', '>=', new Date(+new Date()-2*60*60*1000).toISOString())
                    .orderBy('date')
                    .get().then(col => handleQuery(col).filter(c => ((u.admin || u.insider || u.fellow) ? true : ((c.fellows && u.fellow) || (c.admins && u.admin) || (!c.fellows && !c.admins))))))

                data.push(userClasses
                    .where('active', '==', true)
                    .where('user', '==', +req.query.user)
                    .get().then(col => handleQuery(col)))

                Promise.all(data).then(data => {

                    let result = []
                    data[0].forEach(c => {
                        let record = data[1].filter(uc => c.id == uc.class)[0]
                        if (record) {
                            c.booked =          true;
                            c.status =          record.status;
                            c.appointmentId =   record.id;
                            c.payed =           record.isPayed || false;
                        }
                        result.push(c)
                    })

                    res.json(result)

                }).catch(err => {
                    console.log(err)
                    res.json([])
                })

            })




            break;
        }
        case 'coworking': {
            halls
                .where(`active`, '==', true)
                .where('isCoworking', '==', true)
                .get().then(col => {
                    res.json(handleQuery(col))
                }).catch(err => {
                    alertAdmins({
                        filter: `coworking`,
                        text: `ошибка выгрузки коворкинга ${err.message}`
                    })
                    res.status(500).send(`Извините, сервис временно недоступен`)
                })
            break;
        }
        case 'mr': {
            mra
                .where('active', '==', true)
                .where('date', '>=', isoDate())
                .get()
                .then(col => {
                    let records = handleQuery(col);
                    let i = 0;
                    let result = []
                    while (i < 7) {
                        let d = new Date(+new Date() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                        let t = {
                            date: d,
                            slots: []
                        }

                        let start = new Date().setHours(10, 0, 0);
                        let shift = 0;

                        let dayrecords = records.filter(r => r.date == d)


                        while (shift < 12) {

                            let time = new Date(+start + shift * 60 * 60 * 1000).toTimeString().split(' ')[0].split(':').slice(0, 2).join(':');
                            let time2 = new Date(+start + shift * 60 * 60 * 1000 + 30 * 60 * 1000).toTimeString().split(' ')[0].split(':').slice(0, 2).join(':');


                            // @ts-ignore
                            t.slots.push({
                                time: time,
                                available: dayrecords.filter(r => r.time == time).length ? false : true,
                                self: dayrecords.filter(r => r.time == time && r.user == +req.query.user).length ? dayrecords.filter(r => r.time == time && r.user == +req.query.user)[0].id : false
                            })
                            
                            // @ts-ignore
                            t.slots.push({
                                time: time2,
                                available: dayrecords.filter(r => r.time == time2).length ? false : true,
                                self: dayrecords.filter(r => r.time == time2 && r.user == +req.query.user).length ? dayrecords.filter(r => r.time == time2 && r.user == +req.query.user)[0].id : false
                            })
                            shift++
                        }

                        result.push(t)
                        i++
                    }
                    res.json(result)
                }).catch(err => {
                    console.log(err)
                    res.json([])
                })
            break;
        }
        default:
            return res.json([])
    }
})


router.all(`/:data/:id`, (req, res) => {

    switch (req.params.data) {

        case `tariffs`:{
            if(!req.query.id) return res.sendStatus(400)

            switch(req.method){
                case `GET`:{
                    return getDoc(plans,req.params.id).then(t=>{
                        if(!t || !t.active) return res.sendStatus(404)
                        plansUsers
                            .where(`plan`,'==',req.params.id)
                            .where(`active`,'==',true)
                            .where(`user`,'==',+req.query.id)
                            .get()
                            .then(col=>{
                                t.inUse = handleQuery(col)[0]
                                res.json(t)
                                plans.doc(req.params.id).update({
                                    views: FieldValue.increment(1)
                                })
                            })
                    })
                }
                case `POST`:{
                    return getDoc(plans,req.params.id).then(p=>{
                        
                        if(!p || !p.active) return res.sendStatus(404)
                        
                        getDoc(udb,req.query.id).then(u=>{

                            if(!u || u.blocked) return res.sendStatus(400)
                            
                            ifBefore(plansRequests,{user:+req.query.id,active:true}).then(before=>{
                                
                                if(before.length) return res.json({
                                    success: false,
                                    comment: `Вы уже оставили заявку. Пожалуйста, подождите еще немного.`
                                })

                                plansRequests.add({
                                    createdAt:  new Date(),
                                    user:       +req.query.id,
                                    plan:       req.params.id,
                                    active:     true
                                }).then(record=>{
                                    
                                    res.json({
                                        success: true,
                                        id: record.id,
                                        comment: `Заявка принята! Мы скоро свяжемся с вами.`
                                    })
    
                                    log({
                                        filter: `coworking`,
                                        text: `${uname(u,u.id)} подает заявку на тариф ${p.name}.\nНадо связаться с человеком и объяснить правила и платеж.`,
                                        plan: p.id,
                                        user: +u.id
                                    })
                                })
                            })

                            
                        })
                    })
                }
            }
            
        }
        case `invite`:{
            return invites.doc(req.params.id).get().then(i=>{
                if(!req.query.user) return res.sendStatus(400)
                if(!i.exists) return res.sendStatus(404)
                i = i.data()
                // if(!i.active) return res.json({success: false, comment: `Данное приглашение уже было использовано.`})
                getUser(req.query.user,udb).then(u=>{
                    
                    if(!u) return res.json({
                        success: false,
                        comment: `Мы не знаем такого юзера.`
                    })

                    udb.doc(req.query.user).update({
                        occupation: i.occupation,
                        about:      i.about || null
                    }).then(rec=>{

                        res.json({
                            success: true,
                            plans: i.plan
                        })

                        invites.doc(req.params.id).update({
                            active: false,
                            updatedAt: new Date()
                        })
                    }).catch(err=>{
                        res.status(500).send(err.message)
                    })


                })
            }).catch(err=>{
                console.log(err)
            })
        }
        case `q`:{
            switch (req.method){
                case `GET`:{
                    return userClassesQ.doc(req.params.id).get().then(q=>{
                        if(!q.exists) return res.sendStatus(404)
                        q = q.data()
                        getUser(q.user,udb).then(user=>{
                            q.userData = user;
                            res.json(q)
                        })
                    })
                }
                case `POST`:{
                    return getUser(req.body.user,udb).then(u=>{
                        if(u){
                            if(req.body.text && req.body.class) {
                                userClassesQ.add({
                                    active:     true,
                                    createdAt:  new Date(),
                                    class:      req.body.class,
                                    user:       req.body.user,
                                    text:       req.body.text
                                }).then(s=>{

                                    getDoc(classes,req.body.class).then(c=>{
                                        if(c){
                                            log({
                                                filter: `lectures`,
                                                text:   `Новый вопрос к лекции ${c.name}: _${req.body.text}_`,
                                                user:   +req.body.user,
                                                class:  req.body.class
                                            })
    
                                            if(c && c.authorId) getDoc(authors,c.authorId).then(a=>{
                                                if(a && a.user){
                                                    sendMessage2({
                                                        chat_id: a.user,
                                                        text: `Новый вопрос по вашей лекции: ${req.body.text}.`
                                                    },false,token,messages)
                                                }
                                            })
                                        }
                                    })

                                    res.json({
                                        success: true,
                                        comment: `Вопрос задан. А это уже половина ответа...`
                                    })
                                }).catch(err=>{
                                    res.json({
                                        success: false,
                                        comment: err.message
                                    })
                                })
                            } else {
                                res.sendStatus(400)
                            }
                        } else {
                            res.sendStatus(400)
                        }
                    })
                }
                case `DELETE`:{
                    return userClassesQ.doc(req.params.id).get().then(q=>{
                        if(!q.exists) return res.sendStatus(404)
                        userClassesQ.doc(req.params.id).update({
                            active: false,
                            updatedBy: req.query.by || `непонятно кем`
                        }).then(s=>{
                            res.sendStatus(200)
                        }).catch(err=>{
                            res.status(500).send(err.message)
                        })
                    })
                }
            }
            break;
        }
        case 'plans':{
            switch (req.method){
                case 'PUT':{
                    if(!req.query.user) return res.sendStatus(400)
                    
                    return plans.doc(req.params.id).get().then(p=>{
                        if(!p.exists) return res.sendStatus(404)
                        p = p.data()
                        if(!p.active) return res.json({
                            success: false,
                            comment: `Извините, этот тариф уже недоступен.`
                        })
                        getUser(req.query.user,udb).then(u=>{
                            if(!u) return res.json({
                                success: false,
                                comment: `Извините, мы вас не знаем.`
                            })

                            if(u.blocked) return res.json({
                                success: false,
                                comment: `Извините, вам тут не рады.`
                            }) 

                            plansRequests.add({
                                user:       +req.query.user,
                                plan:       req.params.id,
                                createdAt:  new Date(),
                                active:     true
                            }).then(request=>{
                                res.json({
                                    success: true
                                })

                                sendMessage2({
                                    chat_id:    +req.query.user,
                                    photo:      `${process.env.ngrok}/paper/qr?id=${request.id}&entity=planRequests`,
                                    caption:       `Вы запросили подключение тарифа ${p.name}.\nПросто покажите администратору этот код — он сможет подключить тариф в пару кликов.`
                                },'sendPhoto',token)

                                alertAdmins({
                                    alert: `coworking`,
                                    user: +req.query.user,
                                    text: `${uname(u, +req.query.id)} хочет приобрести тариф ${p.name} (${cur(p.price,'GEL')}).\nНадо найти человека и взять его деньги!`
                                })
                            })
                        })
                    })
                }
                case 'POST':{
                    isAdmin(req.query.id).then(proof=>{
                        if(proof){
                            return plans.add({
                                name:           req.body.name,
                                description:    req.body.description,
                                price:          +req.body.price,
                                visits:         +req.body.visits,
                                events:         +req.body.events,
                                createdBy:      +req.query.id,
                                days:           +req.body.days || 30,
                                createdAt:      new Date(),
                                active:         true
                            }).then(s=>{
                                res.json({
                                    id: s.id
                                })

                                log({
                                    text: `Админ @id${req.query.id} создает подписку «${req.body.name}» (${cur(req.body.price)}).`,
                                    admin: +req.query.id,
                                    silent: true
                                })


                            }).catch(err=>{
                                res.status(500).send(err.message)
                            })
                        } else {
                            return res.sendStatus(403)
                        }
                    })
                }
                default:{
                    return res.sendStatus(404)
                }
            }
            
            break;
        }

        // case `podcasts`:{
        //     switch(req.method){
        //         case `POST`:{
        //             if(!req.body.user) return res.status(400).send(`no user no room`)
        //             if(!req.body.date) return res.status(400).send(`no date provided`)
        //             return getUser(req.body.user,udb).then(user=>{
        //                 if(user.blocked) return res.status(400).send(`you are not welcome`)
        //                 podcasts
        //                     .where(`active`,'==',true)
        //                     .where(`date`,'==',isoDate(req.body.date))
        //                     .get()
        //                     .then(col=>{
        //                         if(!col.docs.length){
        //                             podcasts.add({
        //                                 createdAt:  new Date(),
        //                                 user:       +req.body.user,
        //                                 active:     true,
        //                                 date:       isoDate(req.body.date)
        //                             }).then(rec=>{
        //                                 res.json({
        //                                     success: true,
        //                                     comment: `ok`,
        //                                     id: rec.id
        //                                 })
        //                                 log({
        //                                     filter: `coworking`,
        //                                     text: `${uname(u,u.id)} бронирует подкастерскую на ${isoDate(req.body.date)}`
        //                                 })
        //                             })
        //                         } else {
                                    
        //                             col = handleQuery(col)

        //                             if(+req.body.user == col[0].user){
        //                                 return res.status(400).send(`вы уже забронировали эту дату`)
        //                             }
        //                             return res.status(400).send(`Извините, дата уже занята`)
        //                         }
        //                     })
        //             })
        //         }
        //     }
        // }
        
        case 'polls': {
            switch (req.method) {
                case 'GET': {

                }
                case 'POST': {

                    console.log('это ответ на вопрос')

                    if (req.body.fellow) {
                        return udb.doc(req.body.fellow.toString()).get().then(user => {
                            if (user.exists) {
                                user = user.data();
                                if (user.fellow) {
                                    polls.doc(req.params.id).get().then(poll => {
                                        if (poll.exists) {
                                            return pollsAnswers.add({
                                                createdAt: new Date(),
                                                user: req.body.fellow,
                                                q: req.params.id,
                                                text: req.body.text
                                            }).then(() => {
                                                console.log('ответ записан')
                                                return res.sendStatus(200)
                                            }).catch(err => {
                                                console.log(err)

                                                return res.status(500).send(err.message)
                                            })
                                        } else {
                                            console.log('Нет такого опроса')
                                            res.sendStatus(404)
                                        }
                                    })
                                } else {
                                    res.sendStatus(403)
                                }
                            } else {
                                res.status(404).send('no such user')
                            }
                        })
                    } else {
                        return res.status(400).send('no fellow provided')
                    }
                    break;
                }
            }

        }
        case 'profile': {

            switch (req.method) {
                case 'PUT': {
                    udb.doc(req.params.id.toString()).get().then(d => {

                        if (!d.exists) return res.sendStatus(404)

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
                        
                        devlog(req.body);

                        plausible.forEach(type => {
                            
                            devlog(type)

                            if (req.body.hasOwnProperty(type)) {
                                
                                devlog(`${type}: ${req.body[type]}`)
                                
                                udb.doc(req.params.id).update({
                                    [type]: req.body[type],
                                    updatedAt: new Date()
                                })

                                if (type == 'language_code') {
                                    axios.post(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
                                        "chat_id": req.params.id,
                                        "menu_button": {
                                            "type": "web_app",
                                            "text": translations.app[req.body.type] || translations.app.en,
                                            "web_app": {
                                                "url": process.env.ngrok+"/paper/app"
                                            }
                                        }
                                    })
                                }
                            } else if (req.body.attr == type){
                                
                                devlog(`обвноляем ${req.body.attr}`)

                                udb.doc(req.params.id).update({
                                    [req.body.attr]: req.body.value,
                                    updatedAt: new Date()
                                })
                            }
                        })

                        return res.json({
                            success: true,
                            comment: `данные обновлены`
                        })

                    })
                    break;
                }
                default:
                    res.sendStatus(404)
                    break;
            }
            break;
        }
        case 'rules': {
            coworkingRules.doc(req.params.id).set({
                rules: req.body
            })
        }
        case `static`:{
            return getDoc(standAlone,req.params.id).then(s=>{
                if(!s || !s.active) return res.sendStatus(404)
                standAlone.doc(req.params.id).update({
                    views: FieldValue.increment(1)
                }) 
                return res.json(s)
            })
        }
        case 'types': {
            return eventTypes.doc(req.params.id).set({
                en: req.body[0],
                ru: req.body[1],
                nom: req.body[2]
            }).then(d => {
                res.send(d.id)
            }).catch(err => {
                res.status(400).send(err.message)
            })
        }
        case 'halls': {
            switch (req.method) {
                case 'POST': {
                    let data = {
                        active: req.body[1],
                        name: req.body[2],
                        floor: req.body[3],
                        description: req.body[4],
                        capacity: req.body[5],
                        pics: req.body[6],
                        price: req.body[7],
                        isCoworking: req.body[8],
                        isMeetingRoom: req.body[9],
                        createdAt: new Date()
                    }
                    return halls.add(data).then(record => {
                        res.json({
                            id: record.id
                        })



                    }).catch(err => {
                        res.status(500).send(err.message)
                    })
                }
                case 'PUT': {
                    return halls.doc(req.params.id).update({
                        active: req.body[1],
                        name: req.body[2],
                        floor: req.body[3],
                        description: req.body[4],
                        capacity: req.body[5],
                        pics: req.body[6],
                        price: req.body[7],
                        isCoworking: req.body[8],
                        isMeetingRoom: req.body[9],
                        updatedAt: new Date()
                    }).then(() => res.sendStatus(200))
                }
                default:
                    return res.status(400)
            }
        }
        case 'classes': {
            switch (req.method) {
                case 'POST': {
                    if (req.query.intention == 'book') {
                        if (!req.query.user) return res.sendStatus(400)
                        return classMethods.bookClass(false, req.params.id, res, req.query.user)
                    } else if (req.query.intention == `rate`) {
                        if(!req.body.rate || !req.body.ticket) return res.sendStatus(400)
                        return userClasses.doc(req.body.ticket).get().then(t=>{
                            if(!t.exists) return res.sendStatus(404)
                            t = handleDoc(t)
                            if(t.status != `used`) return res.sendStatus(403)
                            userClasses.doc(req.body.ticket).update({
                                rate:           +req.body.rate,
                                reviewed:    new Date()
                            }).then(s=>{
                                log({
                                    filter: `lectures`,
                                    text:   `Новая оценка к мероприятию ${req.body.className}: ${req.body.rate}`,
                                    user:   t.user,
                                    class:  t.class,
                                    ticket: req.body.ticket
                                })

                                classMethods.classReScore(req.body.ticket)

                                res.send(`ok`)
                            }).catch(err=>{
                                res.sendStatus(500)
                                console.log(err)
                            })
                        })
                    } else if (req.query.intention == `review`) {
                        if(!req.body.text || !req.body.ticket) return res.sendStatus(400)
                        return userClasses.doc(req.body.ticket).get().then(t=>{
                            if(!t.exists) return res.sendStatus(404)
                            t = handleDoc(t)
                            if(t.status != `used`) return res.sendStatus(403)
                            userClasses.doc(req.body.ticket).update({
                                review:     req.body.text,
                                reviewed:    new Date()
                            }).then(s=>{
                                log({
                                    filter: `lectures`,
                                    text:   `Новый отзыв к мероприятию ${req.body.className}: ${req.body.text}`,
                                    user:   t.user,
                                    class:  t.class,
                                    ticket: req.body.ticket
                                })
                                res.send(`ok`)
                            }).catch(err=>{
                                res.sendStatus(500)
                                console.log(err)
                            })
                        })
                        return res.sendStatus(200)
                    } else {

                        if (!req.body[2]) return res.status(400).send(`вы не указали дату`)
                        if (!req.body[4]) return res.status(400).send(`вы не указали зал`)
                        if (!req.body[6]) return res.status(400).send(`вы не указали название`)
                        if (!req.body[10]) return res.status(400).send(`вы не указали описание`)

                        let data = {
                            active: req.body[1],
                            date: req.body[2],
                            type: req.body[3],
                            hall: req.body[4],
                            hallName:   req.body[5],
                            name:       req.body[6],
                            author:     req.body[7],
                            duration:   req.body[8],
                            price:      +req.body[9],
                            description: req.body[10],
                            pic: req.body[12],
                            createdAt: new Date()
                        }

                        return classes.add(data).then(record => {
                            res.json({
                                id: record.id
                            })

                            log({
                                filter: `lectures`,
                                class: record.id,
                                text: `На ${data.date} назначена новая лекция: ${data.name}.`
                            })

                            if (req.query.alert) {
                                udb.get().then(col => {
                                    let users = handleQuery(col)
                                    users.forEach(u => {
                                        if ((process.env.develop == 'true' && u.tester) || process.env.develop != 'true') {
                                            if (data.pic) {
                                                sendMessage2({
                                                    chat_id: u.id,
                                                    photo: data.pic,
                                                    caption: translations.newLecture(data)[u.language_code] || translations.newLecture(data).en,
                                                    reply_markup: {
                                                        inline_keyboard: [
                                                            [{
                                                                text: translations.book[u.language_code] || translations.book.en,
                                                                callback_data: `class_${record.id}`
                                                            }],
                                                            [{
                                                                text: translations.tellMeMore[u.language_code] || translations.tellMeMore.en,
                                                                web_app: {
                                                                    url: process.env.ngrok + '/paper/app?start=classes'
                                                                }
                                                            }]
                                                        ]
                                                    }
                                                }, 'sendPhoto', token, messages)
                                            } else {
                                                sendMessage2({
                                                    chat_id: u.id,
                                                    text: translations.newLecture(data)[u.language_code] || translations.newLecture(data).en,
                                                    reply_markup: {
                                                        inline_keyboard: [
                                                            [{
                                                                text: translations.book[u.language_code] || translations.book.en,
                                                                callback_data: `class_${record.id}`
                                                            }],
                                                            [{
                                                                text: translations.tellMeMore[u.language_code] || translations.tellMeMore.en,
                                                                web_app: {
                                                                    url: process.env.ngrok + '/paper/app?start=classes'
                                                                }
                                                            }]
                                                        ]
                                                    }
                                                }, false, token, messages)
                                            }
                                        }



                                    })
                                })
                            }
                        }).catch(err => {
                            res.status(500).send(err.message)
                        })
                    }

                }
                case 'PUT': {

                    classes.doc(req.params.id).get().then(cl => {
                        if (!cl.exists) return res.status(404).send('нет такой записи...')
                        if (cl.data().active && !req.body[1]) {
                            classMethods.alertClassClosed(req.params.id)
                        }
                        return classes.doc(req.params.id).update({
                                active: req.body[1],
                                date: req.body[2],
                                type: req.body[3],
                                hall: req.body[4],
                                hallName: req.body[5],
                                name: req.body[6],
                                author: req.body[7],
                                duration: req.body[8],
                                price: +req.body[9],
                                description: req.body[10],
                                pic: req.body[12],
                                createdAt: new Date()
                            })
                            .then(() => res.sendStatus(200))
                            .catch(err => {
                                console.log(err)
                            })
                    })
                    break;
                }
                case 'GET': {
                    if(!req.query.user) return res.sendStatus(400)

                    return classes.doc(req.params.id).get().then(c=>{
                        
                        if(!c.exists) return res.sendStatus(404)
                        
                        devlog(`лекция есть`)

                        c = c.data();  
                        
                        devlog(c.active)


                        if(!c.active) return res.sendStatus(404)

                        views.add({
                            createdAt: new Date(),
                            name:   c.name,
                            entity: `classes`,
                            id:     req.params.id,
                            user:   +req.query.user
                        }).then(s=>{
                            classes.doc(req.params.id).update({
                                views: FieldValue.increment(1)
                            })
                        })
                        
                        
                        userClasses
                            .where(`active`,'==',true)
                            .where(`user`,'==',+req.query.user)
                            .where(`class`,'==',req.params.id)
                            .get()
                            .then(col=>{
                                let ticket = col.docs[0] ? col.docs[0].data() : null;

                                if(ticket) ticket.id = col.docs[0].id

                                c.booked = c.appointmentId = ticket ? ticket.id : null
                                c.used = ticket ? ticket.status : null
                                c.status = ticket ? ticket.status : null
                                
                                res.json(c)
                            }).catch(err=>{
                                res.status(500).send(err.message)
                            })
                    })
                    // classes
                    //     .where(`active`, '==', true)
                    //     .where('date', '>=', new Date().toISOString())
                    //     .orderBy('date')
                    //     .get().then(col => {
                    //         return res.json(handleQuery(col))
                    //     })

                }
                case `DELETE`: {
                    return classMethods.unClassUser(req.params.id, false, res, req.query.user)
                }
                default:
                    return res.status(400)
            }
        }
        case 'coworking': {
            switch (req.method) {
                case 'GET': {
                    return coworking
                        .where('hall', '==', req.params.id)
                        .where('active', '==', true)
                        .where('date', '>=', isoDate())
                        .get().then(reservations => {

                            halls.doc(req.params.id).get().then(h => {
                                h = h.data()
                                reservations = handleQuery(reservations)


                                let shift = 0;
                                let answer = []

                                while (shift < 7) {

                                    let date = new Date(+new Date() + shift * 24 * 60 * 60 * 1000).toISOString().split('T')[0]


                                    answer.push({
                                        date: date,
                                        capacity: h.capacity - reservations.filter(r => r.date == date).length,
                                        booked: reservations.filter(r => r.date == date && r.user == +req.query.user).length ? 1 : 0,
                                        record: reservations.filter(r => r.date == date && r.user == +req.query.user)[0] ?
                                            reservations.filter(r => r.date == date && r.user == +req.query.user)[0].id : null
                                    })
                                    shift++
                                }


                                res.json(answer)
                            })

                        })
                }
                case 'POST': {
                    if(!req.query.user) return res.sendStatus(400)
                        
                    return halls.doc(req.params.id).get().then(hall => {
                        hall = hall.data()
                        if (!hall.active) {
                            return res.json({
                                success: false,
                                text: 'hallNotAvailable'
                            })
                        } else {

                            udb
                                .doc(req.query.user)
                                .get()
                                .then(user=>{
                                    user = handleDoc(user)
                                    roomsBlocked
                                    .where('active', '==', true)
                                    .where('room', '==', req.params.id)
                                    .where('date', '==', req.query.date)
                                    .get()
                                    .then(col => {


                                        if (col.docs.length && !user.insider) {
                                            res.json({
                                                success: false,
                                                text: 'roomBlocked'
                                            })
                                        } else {
                                            coworking
                                                .where('hall', '==', req.params.id)
                                                .where('date', '==', req.query.date)
                                                .where('active', '==', true)
                                                .get()
                                                .then(col => {

                                                    let users = handleQuery(col).map(r => r.user)

                                                    if (users.indexOf(req.query.user) > -1) {

                                                        // return res.status(400).send('alreadyBooked')
                                                        return res.json({
                                                            success: false,
                                                            text: 'alreadyBooked'
                                                        })

                                                    } else if (users.length == hall.capacity) {

                                                        return res.json({
                                                            success: false,
                                                            text: 'noSeatsLeft'
                                                        })
                                                        return res.status(400).send('noSeatsLeft')

                                                    } else {
                                                        udb.doc(req.query.user.toString()).get().then(u => {

                                                            if (u.data().blocked) {
                                                                return res.json({
                                                                    success: false,
                                                                    text: 'youArBanned'
                                                                })
                                                                return res.status(400).send('youArBanned')
                                                                // noSeatsLeft
                                                            }

                                                            if (!u.data().occupation) return res.json({
                                                                success: false,
                                                                text: 'noOccupationProvided'
                                                            })
                                                            // return res.status(400).send('noOccupationProvided')
                                                            if (!u.data().email) return res.json({
                                                                success: false,
                                                                text: 'noEmailProvided'
                                                            })
                                                            // return res.status(400).send('noEmailProvided')

                                                            coworking.add({
                                                                user: +req.query.user,
                                                                hall: req.params.id,
                                                                date: req.query.date,
                                                                createdAt: new Date(),
                                                                active: true,
                                                                paymentNeeded: (u.data().insider || u.data().admin || u.data().fellow) ? false : (u.data().bonus ? false : true),
                                                                payed: false
                                                            }).then(rec => {

                                                                let bonusText = false;

                                                                if (u.data().bonus) {

                                                                    bonusText = true

                                                                    udb.doc(u.id).update({
                                                                        bonus: false
                                                                    })
                                                                }

                                                                log({
                                                                    filter: `coworking`,
                                                                    text: `${uname(u.data(), u.id)} бронирует место в коворкинге ${hall.name} на ${req.query.date}`,
                                                                    user: req.query.user,
                                                                    hall: req.params.id
                                                                })

                                                                res.json({
                                                                    success: true,
                                                                    text: bonusText ? 'coworkingBookingConfirmedBonus' : 'coworkingBookingConfirmed',
                                                                    record: rec.id
                                                                })


                                                                sendMessage2({
                                                                    chat_id: req.query.user,
                                                                    caption: translations.coworkingBookingDetails(req.query.date, hall.name, u.data().language_code)[u.data().language_code] || translations.coworkingBookingDetails(req.query.date, hall.name, u.data().language_code).en,
                                                                    photo: process.env.ngrok + `/paper/qr?id=${rec.id}&entity=coworking`,
                                                                    reply_markup: {
                                                                        inline_keyboard: [
                                                                            [{
                                                                                text: translations.coworkingBookingCancel[u.data().language_code] || translations.coworkingBookingCancel.en,
                                                                                callback_data: `ca_cancel_${rec.id}`
                                                                            }]
                                                                        ]
                                                                    }
                                                                }, 'sendPhoto', token, messages)

                                                                if (bonusText) {
                                                                    sendMessage2({
                                                                        chat_id: req.query.user,
                                                                        text: translations.coworkingBookingConfirmedBonus[u.data().language_code] || translations.coworkingBookingConfirmedBonus.en
                                                                    }, false, token, messages)
                                                                }
                                                            })
                                                        })
                                                    }
                                                })
                                        }
                                    })
                                })

                            


                        }
                    })
                }
                case 'DELETE': {
                    return udb.doc(req.query.user.toString()).get().then(u => {

                        if (!u.exists) return res.status(400).send('error')

                        return coworking.doc(req.params.id).get().then(record => {
                            if (!record.exists) return res.status(400).send('noAppointment')
                            record = record.data();
                            if (record.user != +req.query.user) return res.status(403).send(`unAuthorized`)
                            if (!record.active) return res.status(500).send('alreadyCancelled')

                            coworking.doc(req.params.id).update({
                                active: false,
                                updatedAt: new Date(),
                                updatedBy: req.query.user
                            }).then(() => {
                                log({
                                    filter: `coworking`,
                                    text: `${uname(u.data(),u.id)} отменяет запись в коворкинге ${record.date}`
                                })
                                res.send('appointmentCancelled')
                            })
                        }).catch(err => {
                            res.status(500).send('error')
                        })
                    })

                }
            }

        }
        case 'user': {
            registerUser(req.body)
            break;
        }
        case 'mr': {
            switch (req.method) {
                case 'POST': {
                    return mrMethods.bookMR(req.query.date, req.query.time, req.query.user, false, res)
                    break;
                }
                case 'DELETE': {
                    return mrMethods.unbookMR(req.params.id, req.query.user, false, res)
                    break;
                }
                default:
                    return res.status(404)
            }
        }
        default:
            res.status(404)
    }
})



module.exports = router;