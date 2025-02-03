//@ts-check

var express =   require('express');
var router =    express.Router();
var axios =     require('axios').default;

let token =         process.env.papersToken;

const { FieldValue } = require('firebase-admin/firestore');
const { handleQuery, isoDate, getDoc, ifBefore, uname, cur, devlog, handleDoc, handleError, checkEntity } = require('../common');
const { registerUser, isAdmin } = require('../papersBot');
const { plans, userClassesQ, polls, pollsAnswers, udb, userEntries, classes, userClasses, coworking, mra, halls, plansUsers, plansRequests, invites, authors, messages, coworkingRules, standAlone, eventTypes, views, roomsBlocked } = require('./cols');
const { classMethods, mrMethods, plan, methods } = require('./logics');
const coworkingMethods  = require('./logics').coworking;
const translations = require('./translations');
const { getUser, sendMessage2 } = require('../methods');
const { alertAdmins, log } = require('./store');




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
                    appOpens:       FieldValue.increment(1),
                    appLastOpened:  new Date()
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
                            admin:      u.admin,
                            insider:    u.insider,
                            fellow:     u.fellow,
                            noSpam:     u.noSpam,
                            classes:    data[0],
                            userClasses: data[1],
                            coworking:  data[2],
                            mr:         data[3],
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


router.all(`/:data/:id`, async (req, res) => {

    switch (req.params.data) {

        case `tariffs`:{
            if(!req.query.id) return res.sendStatus(400)

            switch(req.method){
                case `GET`:{
                    return methods.plans.get(req.params.id,req.query.id)
                        .then(s=>res.json(s))
                        .catch(err=>handleError(err.res))
                }
                case `POST`:{
                    return plan.request(req.query.id,req.params.id)
                        .then(s=>{
                            res.json(s)
                        }).catch(err=>{
                            res.json({
                                success: false,
                                comment: err.message
                            })
                        })
                }
            }
            
        }
        case `invite`:{
            if(!req.query.user) return res.sendStatus(400)
            let i = await getDoc(invites, req.params.id);
            if(!checkEntity(`invite`,i,res)) return;
            let u = await getUser(req.query.user,udb)
                    
            if(!u) return res.json({
                success: false,
                comment: `Мы не знаем такого юзера.`
            })

            udb.doc(u.id.toString()).update({
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
        }
        case `q`:{
            switch (req.method){
                case `GET`:{
                    let q = await getDoc(userClassesQ,req.params.id);
                    if(!q) return res.sendStatus(404)
                    getUser(q.user,udb).then(user=>{
                        q.userData = user;
                        res.json(q)
                    })
                    break;
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
                    
                    return plan.request(req.query.user, req.params.id).then(s=>{
                        res.json(s)
                    }).catch(err=>{
                        res.json({
                            success: false,
                            comment: err.message
                        })
                    })
                }
                case 'POST':{
                    return res.status(403).send(`method removed`);
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
                    if (!req.body.fellow) return res.status(400).send('no fellow provided')
                    let user = await getUser(req.body.fellow,udb);
                    if(!user) res.status(404).send('no such user')
                    if (!user.fellow) return res.sendStatus(403)
                    let poll = await getDoc(polls, req.params.id) 
                    if(!poll)  return res.sendStatus(403)
                    return pollsAnswers.add({
                        createdAt:  new Date(),
                        user:       +req.body.fellow,
                        q:          req.params.id,
                        text:       req.body.text || null
                    }).then(() => {
                        return res.sendStatus(200)
                    }).catch(err => {
                        return res.status(500).send(err.message)
                    })
                    
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
                res.send(req.params.id)
            }).catch(err => {
                res.status(400).send(err.message)
            })
        }
        
        case 'classes': {
            if(!req.query.user) return res.sendStatus(400)

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

                    } else {
                        return res.status(403).send(`method removed`)
                    }

                }
                case 'PUT': {
                    return res.status(403).send(`method removed`)
                }
                case 'GET': {
                    return classMethods.get(req.params.id, +req.query.user)
                        .then(d=>{
                            res.json(d)
                        }).catch(err=>{
                            handleError(err,res)
                        })

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
                    let user = await getUser(req.query.user,udb);
                
                    return coworkingMethods.bookCoworking(user,req.params.id,req.query.date,false,res).then(()=>{
                        devlog(`ok`)
                    }).catch(err=>{
                        handleError(err,res)
                    })
                }
                case 'DELETE': {
                    return coworkingMethods.cancel(req.params.id,req.query.user)
                        .then(s=>res.send(s))
                        .catch(err=>handleError(err,res))
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
                }
                case 'DELETE': {
                    return mrMethods.unbookMR(req.params.id, req.query.user, false, res)
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