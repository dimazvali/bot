//@ts-check

var express =   require('express');
var router =    express.Router();
var axios =     require('axios').default;

let token =         process.env.papersToken;

const { handleQuery, isoDate, getDoc, ifBefore, devlog, handleError, checkEntity } = require('../common');
const { registerUser } = require('../papersBot');
const { plans, userClassesQ, polls, pollsAnswers, udb, classes, userClasses, coworking, mra, halls, invites, authors, messages, adminTokens } = require('./cols');
const { classMethods, mrMethods, plan, methods, profileMethods, standAloneMethods } = require('./logics');
const coworkingMethods  = require('./logics').coworking;
const { getUser, sendMessage2 } = require('../methods');
const { log } = require('./store');


async function auth(req,res,next){
    if(!req.signedCookies.userToken && process.env.develop)  req.signedCookies.userToken = process.env.adminToken;
    
    if(!req.signedCookies.userToken) {
        next();
    }

    let token = await getDoc(adminTokens,req.signedCookies.userToken);
    if(!token) return res.sendStatus(401);
    let user = await getUser(token.user, udb);
    if(!user || user.blocked) return res.sendStatus(403);
    res.locals.user = user;
    
    devlog(user);

    next()
}


router.get(`/:type`, auth, async (req, res) => {
    
    let user = res.locals.user;

    switch (req.params.type) {
        
        case `tariffs`:{
            return plans.where(`active`,'==',true).get().then(col=>res.json(handleQuery(col)))
        }

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
            
            if(!user) return res.sendStatus(401);

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
                .where('user', '==', +user.id)
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

            if (!user) return res.status(401)

            return res.json(user);
        }

        case 'user': {
            if (!user) return res.status(401)
            return profileMethods.get(user)
                .then(s=>res.json(s))
                .catch(err=>handleError(err,res))
        }

        case 'usersList': {
            
            if (!user) return res.sendStatus(401)
            if (!user.admin) return res.sendStatus(403)

            if (!req.query.type) return res.status(400).send('no type provided')
        
            let filter = req.query.type.toString();

            let users = await ifBefore(udb,{active:true, [filter]: true})
            res.json(users.map(user => {
                return {
                    id:         user.id,
                    username:   user.username,
                    first_name: user.first_name,
                    last_name:  user.last_name,
                    about:      user.about
                }
            }))
            break;
        }
        case 'classes': {
            if(!user) return res.sendStatus(401)

            let data = []

            data.push(classes
                .where(`active`, '==', true)
                .where('date', '>=', new Date(+new Date()-2*60*60*1000).toISOString())
                .orderBy('date')
                .get().then(col => handleQuery(col).filter(c => ((user.admin || user.insider || user.fellow) ? true : ((c.fellows && user.fellow) || (c.admins && user.admin) || (!c.fellows && !c.admins))))))

            data.push(userClasses
                .where('active', '==', true)
                .where('user', '==', +user.id)
                .get().then(col => handleQuery(col)))

            Promise.all(data).then(data => {

                let result = [];

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
            
            break;
        }
        case 'coworking': {
            let data = await ifBefore(halls,{active:true,isCoworking:true});
            res.json(data)
            break;
        }
        case 'mr': {
            
            if(!user) return res.sendStatus(401);

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
                                available:  dayrecords.filter(r => r.time == time).length ? false : true,
                                self:       dayrecords.filter(r => r.time == time && r.user == +user.id).length ? dayrecords.filter(r => r.time == time && r.user == +user.id)[0].id : false
                            })
                            
                            // @ts-ignore
                            t.slots.push({
                                time: time2,
                                available:  dayrecords.filter(r => r.time == time2).length ? false : true,
                                self:       dayrecords.filter(r => r.time == time2 && r.user == +user.id).length ? dayrecords.filter(r => r.time == time2 && r.user == +user.id)[0].id : false
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


router.all(`/:data/:id`, auth, async (req, res) => {
    
    let user = res.locals.user;

    switch (req.params.data) {

        case `tariffs`:{
            if(!user) return res.sendStatus(401);
            switch(req.method){
                case `GET`:{
                    return methods.plans.get(req.params.id,user.id)
                        .then(s=>res.json(s))
                        .catch(err=>handleError(err.res))
                }
                case `POST`:{
                    return plan.request(user,req.params.id)
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
            if(!user) res.sendStatus(401)
            switch (req.method){
                case `GET`:{
                    let q = await getDoc(userClassesQ,req.params.id);
                    if(!q) return res.sendStatus(404)
                    q.userData = user;
                    res.json(q)
                    break;
                }
                case `POST`:{
                    if(req.body.text && req.body.class) {
                        userClassesQ.add({
                            active:     true,
                            createdAt:  new Date(),
                            class:      req.body.class,
                            user:       +user.id,
                            text:       req.body.text
                        }).then(s=>{

                            getDoc(classes,req.body.class).then(c=>{
                                if(c){
                                    log({
                                        filter: `lectures`,
                                        text:   `Новый вопрос к лекции ${c.name}: _${req.body.text}_`,
                                        user:   +user.id,
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
                    break;
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
            if(!user) res.sendStatus(401)
            switch (req.method){
                case 'PUT':{
                    return plan.request(user, req.params.id).then(s=>{
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
            if(!user) res.sendStatus(401)
            switch (req.method) {
                case 'PUT': {
                    return profileMethods.update(user,req.body).then(s=>{
                        res.json({
                            success: true,
                            comment: `данные обновлены`
                        })
                    }).catch(err=>handleError(err,res))
                }
                default:
                    res.sendStatus(404)
                    break;
            }
            break;
        }
        // case 'rules': {
        //     coworkingRules.doc(req.params.id).set({
        //         rules: req.body
        //     })
        // }
        case `static`:{
            return standAloneMethods.get(req.params.id,user)
                .then(d=>res.json(d))
                .catch(err=>handleError(err,res))
        }
        // case 'types': {
        //     return eventTypes.doc(req.params.id).set({
        //         en:     req.body[0],
        //         ru:     req.body[1],
        //         nom:    req.body[2]
        //     }).then(d => {
        //         res.send(req.params.id)
        //     }).catch(err => {
        //         res.status(400).send(err.message)
        //     })
        // }
        
        case 'classes': {
            if(!user)return res.sendStatus(401)

            switch (req.method) {
                case 'POST': {
                    if (req.query.intention == 'book') {
                        return classMethods.bookClass(false, req.params.id, res, user.id)
                    } else if (req.query.intention == `rate`) {
                        return classMethods.rate(req.body,user)
                            .then(s=>{
                                res.sendStatus(200)
                            })
                            .catch(err=>handleError(err,res))
                        
                    } else if (req.query.intention == `review`) {
                        return classMethods.review(req.body,user)
                            .then(s=>{
                                res.sendStatus(200)
                            })
                            .catch(err=>handleError(err,res))

                    } else {
                        return res.status(403).send(`method removed`)
                    }

                }
                case 'PUT': {
                    return res.status(403).send(`method removed`)
                }
                case 'GET': {
                    return classMethods.get(req.params.id, +user.id)
                        .then(d=>{
                            res.json(d)
                        }).catch(err=>{
                            handleError(err,res)
                        })

                }
                case `DELETE`: {
                    return classMethods.unClassUser(req.params.id, false, res, user.id)
                }
                default:
                    return res.status(400)
            }
        }
        case 'coworking': {
            
            if(!user) res.sendStatus(401);

            switch (req.method) {
                case 'GET': {
                    return coworking
                        .where('hall', '==', req.params.id)
                        .where('active', '==', true)
                        .where('date', '>=', isoDate())
                        .get().then(async reservationsCol => {
                            let reservations = handleQuery(reservationsCol)
                            let h = await getDoc(halls,req.params.id)
                            
                            let shift = 0;
                            let answer = []

                            while (shift < 7) {

                                let date = new Date(+new Date() + shift * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

                                answer.push({
                                    date:       date,
                                    capacity:   h.capacity - reservations.filter(r => r.date == date).length,
                                    booked:     reservations.filter(r => r.date == date && r.user == +user.id).length ? 1 : 0,
                                    record:     reservations.filter(r => r.date == date && r.user == +user.id)[0] 
                                        ? reservations.filter(r => r.date == date && r.user == +user.id)[0].id 
                                        : null
                                })
                                shift++
                            }
                            res.json(answer)
                        })
                }
                case 'POST': {
                    return coworkingMethods.bookCoworking(user,req.params.id,req.query.date,false,res).then(()=>{
                        devlog(`ok`)
                    }).catch(err=>{
                        handleError(err,res)
                    })
                }
                case 'DELETE': {
                    return coworkingMethods.cancel(req.params.id,user.id)
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
            if(!user) res.sendStatus(401)
            switch (req.method) {
                case 'POST': {
                    return mrMethods.bookMR(req.query.date, req.query.time, user.id, false, res)
                }
                case 'DELETE': {
                    return mrMethods.unbookMR(req.params.id, user.id, false, res)
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