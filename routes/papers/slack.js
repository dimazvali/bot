//@ts-check

var express =   require('express');
var router =    express.Router();
var axios =     require('axios').default;
const { modals } = require('../modals');
const { halls, classes, polls, udb, userTags, pollsAnswers, messages, coworking, userClasses, plansUsers, roomsBlocked, mra } = require('./cols');
const { handleQuery, devlog, cur, uname, handleError, dimazvali, isoDate, drawDate } = require('../common');
const { log, token, appLink } = require('../papersBot');
const { FieldValue } = require('firebase-admin/firestore');
const translations = require('./translations');
const { getUser, sendMessage2 } = require('../methods');


router.post(`/slack/loader`, (req, res) => {
    let data = JSON.parse(req.body.payload)

    devlog(data);

    switch (data.block_id) {
        case 'hall': {
            halls.where('active', '==', true).get().then(h => {

                res.json({
                    options: handleQuery(h).map(hall => {
                        return {
                            "text": {
                                "type": "plain_text",
                                "text": hall.name.toString()
                            },
                            "value": hall.id
                        }
                    })
                })
            })
            break;
        }
        case 'lectures': {
            classes
                .where('active', '==', true)
                .where('date', '>=', new Date())
                .get()
                .then(col => {
                    res.json({
                        options: handleQuery(col).map(lecture => {
                            return {
                                "text": {
                                    "type": "plain_text",
                                    "text": lecture.name
                                },
                                "value": lecture.id
                            }
                        })
                    })
                    // handleQuery(col).forEach(record => {
                    //     remindOfClass(record)
                    // })
                }).catch(err => {
                    console.log(err)
                })
            break;
        }
        default: {
            return res.json({
                options: []
            })
        }
    }
})

router.post(`/slack/q`, (req, res) => {
    res.status(200).send()
    return axios.post(
        'https://slack.com/api/views.open', {
            trigger_id: req.body.trigger_id,
            view: modals.newQ
        }, {
            headers: {
                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                'Content-Type': 'application/json',
            }
        }
    ).then(s => {
        if (process.env.develop == 'true') console.log(s.data)
    }).catch(err => {
        console.log(err.message)
    })
})

router.post(`/slack/qs`, (req, res) => {
    res.status(200).send()
    polls.get().then(col => {
        return axios.post(
            'https://slack.com/api/views.open', {
                trigger_id: req.body.trigger_id,
                view: modals.qList(handleQuery(col))
            }, {
                headers: {
                    'Authorization': 'Bearer ' + process.env.paperSlackToken,
                    'Content-Type': 'application/json',
                }
            }
        ).then(s => {
            if (process.env.develop == 'true') console.log(s.data)
        }).catch(err => {
            console.log(err.message)
        })
    })


})

router.post(`/slack/lecture`, (req, res) => {
    res.status(200).send()
    // @ts-ignore
    return axios.post(
        'https://slack.com/api/views.open', {
            trigger_id: req.body.trigger_id,
            view: modals.newLecture
        }, {
            headers: {
                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                'Content-Type': 'application/json',
            }
        }
    ).then(s => {
        if (process.env.develop == 'true') console.log(s.data)
    }).catch(err => {
        console.log(err.message)
    })
})

router.post(`/slack/users`, (req, res) => {
    res.status(200).send()
    udb.get().then(u => {
        return axios.post(
            'https://slack.com/api/views.open', {
                trigger_id: req.body.trigger_id,
                view: modals.users(handleQuery(u))
            }, {
                headers: {
                    'Authorization': 'Bearer ' + process.env.paperSlackToken,
                    'Content-Type': 'application/json',
                }
            }
        ).then(s => {
            if (process.env.develop == 'true') console.log(s.data)
        }).catch(err => {
            console.log(err.message)
        })
    })

})

router.post(`/slack/mr`, (req, res) => {
    res.status(200).send()
    console.log(modals.mr())
    return axios.post(
        'https://slack.com/api/views.open', {
            trigger_id: req.body.trigger_id,
            view: modals.mrDate()
        }, {
            headers: {
                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                'Content-Type': 'application/json',
            }
        }
    ).then(s => {
        if (process.env.develop == 'true') console.log(s.data)
    }).catch(err => {
        console.log(err.message)
    })

})

router.post(`/slack/tags`, (req, res) => {
    res.status(200).send(`Загружаем теги...`)
    userTags.get().then(col => {
        return axios.post(
            'https://slack.com/api/views.open', {
                trigger_id: req.body.trigger_id,
                view: modals.tags(handleQuery(col))
            }, {
                headers: {
                    'Authorization': 'Bearer ' + process.env.paperSlackToken,
                    'Content-Type': 'application/json',
                }
            }
        ).then(s => {
            if (process.env.develop == 'true') console.log(s.data)
        }).catch(err => {
            console.log(err.message)
        })
    })

})

router.post('/slack/campaign', (req, res) => {
    res.status(200).send()
    return axios.post(
        'https://slack.com/api/views.open', {
            trigger_id: req.body.trigger_id,
            view: modals.campaign
        }, {
            headers: {
                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                'Content-Type': 'application/json',
            }
        }
    ).then(s => {
        if (process.env.develop == 'true') console.log(s.data)
    }).catch(err => {
        console.log(err.message)
    })
})

router.post(`/slack/lecturesList`, (req, res) => {
    res.status(200).send()
    return axios.post(
        'https://slack.com/api/views.open', {
            trigger_id: req.body.trigger_id,
            view: modals.lectures
        }, {
            headers: {
                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                'Content-Type': 'application/json',
            }
        }
    ).then(s => {
        if (process.env.develop == 'true') console.log(s.data)
    }).catch(err => {
        console.log(err.message)
    })
})

router.post(`/slack/lectures`, (req, res) => {
    res.sendStatus(200);
    classes
        .where(`active`, '==', true)
        // .where('date', '>=', new Date().toISOString())
        .orderBy('date', 'desc')
        .limit(20)
        .get().then(col => {

            return axios.post(
                'https://slack.com/api/views.open', {
                    trigger_id: req.body.trigger_id,
                    view: modals.lecturesList(handleQuery(col))
                }, {
                    headers: {
                        'Authorization': 'Bearer ' + process.env.paperSlackToken,
                        'Content-Type': 'application/json',
                    }
                }
            ).then(s => {
                if (process.env.develop == 'true') console.log(s.data)
            }).catch(err => {
                console.log(err.message)
            })

        })

})

router.post(`/slack/coworking`, (req, res) => {
    res.send(`Сейчас откроется коворкинг...`);
    halls
        .where(`isCoworking`, '==', true)
        .where('active', '==', true)
        .orderBy('name', 'asc')
        .get().then(col => {

            return axios.post(
                'https://slack.com/api/views.open', {
                    trigger_id: req.body.trigger_id,
                    view: modals.coworking(handleQuery(col))
                }, {
                    headers: {
                        'Authorization': 'Bearer ' + process.env.paperSlackToken,
                        'Content-Type': 'application/json',
                    }
                }
            ).then(s => {
                if (process.env.develop == 'true') console.log(s.data)
            }).catch(err => {
                console.log(err.message)
            })

        })

})

router.post('/slack', (req, res) => {
    let data = {}

    if (req.body.payload) {
        data = JSON.parse(req.body.payload)
    } else {
        data = req.body
    }

    if (process.env.develop == 'true') console.log(req.body.payload)

    switch (data.type) {
        case "block_actions": {
            let a = data.actions[0];
            let inc = a.action_id.split('_')


            if (process.env.develop == 'true') console.log(inc)

            switch (inc[0]) {

                case 'pollDetails': {
                    let d = []

                    d.push(polls.doc(a.value).get().then(d => d.data()))
                    d.push(pollsAnswers.where('q', '==', a.value).get().then(col => handleQuery(col)))

                    return Promise.all(d).then(d => {

                        let users = [];

                        if (d[1].length) {
                            d[1].forEach(u => {
                                users.push(getUser(u.user, udb))
                            })
                        }

                        Promise.all(users).then(u => {
                            console.log(u)
                            axios.post(
                                'https://slack.com/api/views.update',
                                modals.qDetails(data.view.id, a.value, d[0], d[1], u), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            )
                        })


                    })

                    break;
                }

                case 'deposit': {
                    return udb.doc(inc[1]).get().then(u => {
                        let user = u.data()
                        if (user.active && !user.blocked) {

                            if (+a.value == 0 || +a.value < 0) return axios.post(
                                'https://slack.com/api/views.update',
                                modals.err(data.view.id, `Некорректная сумма депозита!`), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            )
                            udb.doc(inc[1]).update({
                                deposit: FieldValue.increment(+a.value)
                            }).then(() => {
                                axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.omniSuccess(data.view.id, `Депозит ${cur(+a.value,'GEL')} успешно зачислен на счет пользовател ${uname(user,inc[1])}`), {
                                        headers: {
                                            'Content-type': 'application/json',
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                                        }
                                    }
                                )
                                sendMessage2({
                                    chat_id: inc[1],
                                    text: translations.deposit(+a.value)[user.language_code] || translations.deposit(+a.value).en
                                }, false, token, messages)

                                log({
                                    text: `Админ ${data.user.username} зачисляет пользователю ${uname(user,inc[1])} депозит в ${cur(+a.value,'GEL')}`,
                                    user: +inc[1]
                                })
                            })
                        } else {
                            axios.post(
                                'https://slack.com/api/views.update',
                                modals.err(data.view.id, `Этот пользователь заблокирован или не найден`), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            )
                        }
                    })

                }

                case 'undeposit': {
                    return udb.doc(inc[1]).get().then(u => {
                        let user = u.data()
                        if (user.active && !user.blocked) {

                            if (+a.value == 0 || +a.value < 0 || user.deposit < +a.value) return axios.post(
                                'https://slack.com/api/views.update',
                                modals.err(data.view.id, `Некорректная сумма списания (или текущего депозита недостаточно)!`), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            )
                            udb.doc(inc[1]).update({
                                deposit: FieldValue.increment(-Number(a.value))
                            }).then(() => {
                                axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.omniSuccess(data.view.id, `Депозит ${cur(+a.value,'GEL')} успешно списан со счета пользователя ${uname(user,inc[1])}`), {
                                        headers: {
                                            'Content-type': 'application/json',
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                                        }
                                    }
                                )
                                sendMessage2({
                                    chat_id: inc[1],
                                    text: translations.undeposit(+a.value)[user.language_code] || translations.undeposit(+a.value).en
                                }, false, token, messages)

                                log({
                                    text: `Админ ${data.user.username} списывает с депозита пользователя ${uname(user,inc[1])} ${cur(+a.value,'GEL')}`,
                                    user: +inc[1]
                                })
                            })
                        } else {
                            axios.post(
                                'https://slack.com/api/views.update',
                                modals.err(data.view.id, `Этот пользователь заблокирован или не найден`), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            )
                        }
                    })

                }

                case 'coworkingRecord': {
                    switch (inc[1]) {
                        case 'free': {
                            coworking.doc(a.value).update({
                                paymentNeeded: false
                            }).then(() => {

                                axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.omniSuccess(data.view.id, `Твори добро!`), {
                                        headers: {
                                            'Content-type': 'application/json',
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                                        }
                                    }
                                )

                                coworking.doc(a.value).get().then(record => {
                                    record = record.data()
                                    let d = [];
                                    d.push(getUser(record.user, udb))
                                    d.push(halls.doc(record.hall).get().then(d => d.data()))
                                    Promise.all(d).then(d => {
                                        log({
                                            text: `Админ @${data.user.username} дарит день в коворкинге пользователю ${uname(d[0],record.user)}. ${record.date} @ ${d[1].name}`
                                        })
                                    })
                                })
                            })
                            break;
                        }
                        case 'cancel': {
                            coworking.doc(a.value).update({
                                active: false
                            }).then(() => {

                                axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.omniSuccess(data.view.id, `Твори добро!`), {
                                        headers: {
                                            'Content-type': 'application/json',
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                                        }
                                    }
                                )

                                coworking.doc(a.value).get().then(record => {
                                    record = record.data()
                                    let d = [];
                                    d.push(getUser(record.user, udb))
                                    d.push(halls.doc(record.hall).get().then(d => d.data()))
                                    Promise.all(d).then(d => {
                                        log({
                                            text: `Админ @${data.user.username} отменяет запись пользователя ${uname(d[0],record.user)} в коворкинг на ${record.date}`
                                        })
                                    })
                                })
                            })
                            break;
                        }
                        default: {
                            coworking.doc(a.value).get().then(record => {
                                record = record.data()
                                let d = [];
                                d.push(getUser(record.user, udb))
                                d.push(halls.doc(record.hall).get().then(d => d.data()))
                                Promise.all(d).then(d => {
                                    if (data.view) {
                                        axios.post(
                                            'https://slack.com/api/views.update',
                                            modals.coworkingRecord(data.view.id, record, a.value, d[0], d[1]), {
                                                headers: {
                                                    'Content-type': 'application/json',
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                }
                                            }
                                        ).then(s => {
                                            if (process.env.develop == 'true') console.log(s.data)
                                        }).catch(err => {
                                            console.log(err.message)
                                        })
                                    } else {
                                        axios.post(
                                            'https://slack.com/api/views.open', {
                                                trigger_id: data.trigger_id,
                                                view: modals.coworkingRecord(false, record, a.value, d[0], d[1])
                                            }, {
                                                headers: {
                                                    'Content-type': 'application/json',
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                }
                                            }
                                        ).then(s => {
                                            if (process.env.develop == 'true') console.log(s.data)
                                        }).catch(err => {
                                            console.log(err.message)
                                        })
                                    }
                                })
                            })
                            break;
                        }
                    }
                    break;
                }

                case 'ticket': {
                    switch (inc[1]) {
                        case 'used':{
                            return userClasses.doc(a.value).update({
                                status: 'used'
                            }).then(() => {

                                userClasses.doc(a.value).get().then(doc=>{
                                    
                                    let user = doc.data().user;

                                    udb.doc(user.toString()).update({
                                        classes: FieldValue.increment(1),
                                        classesVisits: FieldValue.increment(1)
                                    })

                                    plansUsers
                                        .where('user','==',+user)
                                        .where('active','==',true)
                                        .get().then(col=>{
                                            let plan = handleQuery(col)[0]
                                            if(plan && plan.eventsLeft){
                                                
                                                plansUsers.doc(plan.id).update({
                                                    eventsLeft: FieldValue.increment(-1)
                                                })
                                            }
                                        })
                                })
                                res.send('ok')
                            })
                        }
                        case 'comment': {
                            return userClasses.doc(a.block_id).update({
                                comment: a.value
                            }).then(() => {
                                res.send('ok')
                            })
                        }
                        case 'cancel': {
                            return userClasses.doc(a.value).update({
                                active: false
                            }).then(() => {
                                res.send('ok')
                            })
                        }
                        case 'free': {
                            return userClasses.doc(a.value).update({
                                isFree: true
                            }).then(() => {
                                res.send('ok')
                            })
                        }
                        default: {
                            return res.sendStatus(404)
                        }
                    }
                }
                case 'ticketDetails': {
                    res.send('ok')
                    return userClasses.doc(a.value).get().then(t => {
                        t = t.data();
                        t.id = a.value;
                        getUser(t.user, udb).then(user => {
                            let admin = {};
                            if (t.statusBy) {
                                admin = getUser(t.statusBy, udb)
                            }
                            Promise.resolve(admin).then(admin => {

                                classes.doc(t.class).get().then(c => {

                                    if (data.view) {
                                        axios.post(
                                            'https://slack.com/api/views.update',
                                            modals.ticketDetails(data.view.id, t, user, c.data(), admin), {
                                                headers: {
                                                    'Content-type': 'application/json',
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                }
                                            }
                                        ).then(s => {
                                            if (process.env.develop == 'true') console.log(s.data)
                                        }).catch(err => {
                                            console.log(err.message)
                                        })
                                    } else {
                                        axios.post(
                                            'https://slack.com/api/views.open', {
                                                trigger_id: data.trigger_id,
                                                view: modals.ticketDetails(false, t, user, c.data(), admin)
                                            }, {
                                                headers: {
                                                    'Content-type': 'application/json',
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                }
                                            }
                                        ).then(s => {
                                            if (process.env.develop == 'true') console.log(s.data)
                                        }).catch(err => {
                                            console.log(err.message)
                                        })
                                    }

                                })
                            })
                        })
                    })
                }
                case 'closeRoom': {
                    console.log(a.selected_option.value, a.block_id)
                    switch (a.selected_option.value) {
                        case '0': {
                            return roomsBlocked.add({
                                active: true,
                                room: a.block_id.split('_')[0],
                                date: a.block_id.split('_')[1],
                                createdAt: new Date(),
                                createdBy: data.user.username
                            }).then(s => {
                                res.sendStatus(200)
                                halls.doc(a.block_id.split('_')[0]).get().then(h => {
                                    log({
                                        filter: `coworking`,
                                        text: `Админ ${data.user.username} закрывает комнату ${h.data().name} на ${a.block_id.split('_')[1]}`
                                    })
                                })

                            }).catch(handleError)
                        }
                        case '1': {
                            return roomsBlocked
                                .where('active', '==', true)
                                .where('room', '==', a.block_id.split('_')[0])
                                .where('date', '==', a.block_id.split('_')[1])
                                .get()
                                .then(col => {
                                    col.docs.forEach(d => {
                                        roomsBlocked.doc(d.id).update({
                                            active: false,
                                            updatedAt: new Date(),
                                            updatedBy: data.user.username
                                        })
                                    })
                                    res.sendStatus(200)
                                    halls.doc(a.block_id.split('_')[0]).get().then(h => {
                                        log({
                                            filter: `coworking`,
                                            text: `Админ ${data.user.username} открывает комнату ${h.data().name} на ${a.block_id.split('_')[1]}`
                                        })
                                    })
                                }).catch(handleError)

                        }
                    }
                }
                case 'mr': {
                    return mra
                        .where('date', '==', a.selected_date)
                        .get()
                        .then(col => {
                            let records = handleQuery(col)
                            let userList = [...new Set(records.map(r => r.user))]
                            udb.where('id', 'in', userList.length ? userList : [dimazvali]).get().then(users => {
                                axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.mrDate(data.view.id, a.selected_date, records, handleQuery(users)), {
                                        headers: {
                                            'Content-type': 'application/json',
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                                        }
                                    }
                                ).then(s => {
                                    if (process.env.develop == 'true') console.log(s.data)
                                }).catch(err => {
                                    console.log(err.message)
                                })
                            })
                        })
                }
                case 'tagMessage': {
                    return userTags.doc(inc[1]).get().then(tag => {
                        if (!tag.exists) return res.sendStatus(404)
                        tag = tag.data();

                        Object.keys(tag).forEach(id => {
                            if (id != 'name') sendMessage2({
                                chat_id: id,
                                text: a.value
                            }, false, token, messages)
                        })

                        log({
                            text: `Админ ${data.user.username} отправляет рассылку по тегу «${inc[1]}»:\n${a.value}`
                        })
                        axios.post(
                            'https://slack.com/api/views.update',
                            modals.omniSuccess(data.view.id, `Ваше сообщение расходится на ${Object.keys(tag).length} пользователей.`), {
                                headers: {
                                    'Content-type': 'application/json',
                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                }
                            }
                        )

                    })
                }
                case 'tag': {
                    return userTags.doc(inc[1]).get().then(d => {

                        udb.where('id', 'in', [...new Set(Object.keys(d.data()).map(r => +r))]).get().then(users => {
                            axios.post(
                                'https://slack.com/api/views.update',
                                modals.tagDetails(data.view.id, d, handleQuery(users)), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            ).then(s => {
                                if (process.env.develop == 'true') console.log(s.data)
                            }).catch(err => {
                                console.log(err.message)
                            })
                        })


                    })
                }
                case 'coworkingMess': {
                    switch (inc[1]) {
                        case 'confirmBooking':{
                            let ref = coworking.doc(inc[2])
                            ref.get().then(r=>{
                                let rec = r.data();
                                if(rec){
                                    if(rec.status != 'used'){
                                        ref.update({
                                            status: 'used'
                                        })

                                        plansUsers
                                            .where('user','==',rec.user)
                                            .where('active','==',true)
                                            .get().then(col=>{
                                                let plan = handleQuery(col)[0]
                                                if(plan && plan.visitsLeft){
                                                    plansUsers.doc(plan.id).update({
                                                        visitsLeft: FieldValue.increment(-1)
                                                    })
                                                    axios.post(
                                                        'https://slack.com/api/views.update',
                                                        modals.omniSuccess(data.view.id, `Вы отметили, что гость пришел. Оплата не требуется (использована подписка).`), {
                                                            headers: {
                                                                'Content-type': 'application/json',
                                                                'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                            }
                                                        }
                                                    ).then(s => {
                                                        if (process.env.develop == 'true') console.log(s.data)
                                                    }).catch(err => {
                                                        console.log(err.message)
                                                    })
                                                } else {
                                                    if(!rec.paymentNeeded) {
                                                        axios.post(
                                                            'https://slack.com/api/views.update',
                                                            modals.omniSuccess(data.view.id, `Вы отметили, что гость пришел. Оплата не требуется.`), {
                                                                headers: {
                                                                    'Content-type': 'application/json',
                                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                                }
                                                            }
                                                        ).then(s => {
                                                            if (process.env.develop == 'true') console.log(s.data)
                                                        }).catch(err => {
                                                            console.log(err.message)
                                                        })
                                                    } else {
                                                        getUser(rec.user,udb).then(user=>{
                                                            axios.post(
                                                                'https://slack.com/api/views.update',
                                                                modals.omniSuccess(data.view.id, `Вы отметили, что гость пришел.\nПерейдем к оплате. На счете пользователя ${cur(user.deposit||0,'GEL')}.`), {
                                                                    headers: {
                                                                        'Content-type': 'application/json',
                                                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                                    }
                                                                }
                                                            ).then(s => {
                                                                if (process.env.develop == 'true') console.log(s.data)
                                                            }).catch(err => {
                                                                console.log(err.message)
                                                            })
                                                        })
                                                    }
                                                }
                                            })

                                


                                        

                                    } else {
                                        axios.post(
                                            'https://slack.com/api/views.update',
                                            modals.err(data.view.id, `Запись уже находится в статусе "Были".`), {
                                                headers: {
                                                    'Content-type': 'application/json',
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                }
                                            }
                                        ).then(s => {
                                            if (process.env.develop == 'true') console.log(s.data)
                                        }).catch(err => {
                                            console.log(err.message)
                                        })
                                    }
                                } else {
                                    axios.post(
                                        'https://slack.com/api/views.update',
                                        modals.err(data.view.id, `Такой записи в базе нет.`), {
                                            headers: {
                                                'Content-type': 'application/json',
                                                'Authorization': 'Bearer ' + process.env.paperSlackToken
                                            }
                                        }
                                    ).then(s => {
                                        if (process.env.develop == 'true') console.log(s.data)
                                    }).catch(err => {
                                        console.log(err.message)
                                    })
                                }
                                
                            })
                            break;
                        }
                        case 'cancelBooking': {
                            return coworking.doc(inc[2]).update({
                                active: false,
                                updatedAt: new Date(),
                                updatedBy: `slack_${data.user.username}`
                            }).then(() => {
                                res.sendStatus(200)
                            }).catch(handleError)
                        }
                        default:
                            return res.sendStatus(404)
                    }
                    break;

                }
                case 'coworking': {
                    console.log(inc[2])
                    return coworking
                        .where('hall', '==', inc[1])
                        .where('active', '==', true)
                        .where('date', '>=', a.selected_date || isoDate())
                        .get()
                        .then(reservations => {
                            reservations = handleQuery(reservations);
                            let days = {}
                            let shift = 0

                            while (shift < 8) {
                                let date = new Date((a.selected_date ? +new Date(a.selected_date) : +new Date()) + shift * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                                let temp = reservations.filter(r => r.date == date)
                                days[date] = temp
                                shift++
                            }

                            let usersToCome = [...new Set(reservations.map(r => r.user))]

                            roomsBlocked
                                .where('room', '==', inc[1])
                                .where('active', '==', true)
                                .where('date', '>=', a.selected_date ? a.selected_date : isoDate())
                                .get()
                                .then(blocks => {
                                    udb.where('id', 'in', usersToCome.length ? usersToCome : [dimazvali]).get().then(users => {

                                        halls.doc(inc[1]).get().then(h => {
                                            let hall = h.data()
                                            hall.id = h.id;
                                            axios.post(
                                                'https://slack.com/api/views.update',
                                                modals.coworkingDetails(data.view.id, days, hall, handleQuery(users), handleQuery(blocks), a.selected_date), {
                                                    headers: {
                                                        'Content-type': 'application/json',
                                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                    }
                                                }
                                            ).then(s => {
                                                if (process.env.develop == 'true') console.log(s.data)
                                            }).catch(err => {
                                                console.log(err.message)
                                            })
                                        })

                                    })
                                })






                        })
                    break;
                }
                case 'updateUser': {
                    return udb.doc(data.view.callback_id).update({
                        [a.block_id]: a.value
                    }).then(() => res.sendStatus(200)).catch(err => {
                        res.sendStatus(500)
                    })
                }
                case 'userDetails': {
                    return udb.doc(a.value).get().then(u => {

                        let udata = []

                        udata.push(userClasses
                            .where('active', '==', true)
                            .where('user', '==', +a.value)
                            .get()
                            .then(col => {
                                return handleQuery(col).sort((a, b) => b.createdAt._seconds - a.createdAt._seconds)
                            }))

                        udata.push(messages
                            .where('user', '==', +a.value)
                            .orderBy('createdAt', 'desc')
                            .limit(10)
                            .get()
                            .then(col => {
                                return handleQuery(col)
                            }))




                        Promise.all(udata).then(udata => {

                            console.log(JSON.stringify(modals.userDetails(false, u, udata[0], udata[1])))
                            if (data.view) {
                                axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.userDetails(data.view.id, u, udata[0], udata[1]), {
                                        headers: {
                                            'Content-type': 'application/json',
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                                        }
                                    }
                                ).then(s => {
                                    if (process.env.develop == 'true') console.log(s.data)
                                }).catch(err => {
                                    console.log(err.message)
                                })
                            } else {
                                return axios.post(
                                    'https://slack.com/api/views.open', {
                                        trigger_id: data.trigger_id,
                                        view: modals.userDetails(false, u, udata[0], udata[1])
                                    }, {
                                        headers: {
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                            'Content-Type': 'application/json',
                                        }
                                    }
                                ).then(s => {
                                    if (process.env.develop == 'true') console.log(s.data)
                                }).catch(err => {
                                    console.log(err.message)
                                })
                            }
                        })



                    })
                }
                case 'message': {

                    sendMessage2({
                        chat_id: a.action_id.split('_')[1],
                        text: `🧙: ` + a.value
                    }, false, token, messages).then(() => {

                        axios.post(`https://slack.com/api/chat.postMessage`, {
                            channel: data.container.channel_id,
                            thread_ts: data.container.message_ts,
                            text: `@${data.user.name} пишет: ${a.value}`
                        }, {
                            headers: {
                                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                'Content-Type': 'application/json'
                            }
                        }).then(d => {
                            console.log(d)
                            res.sendStatus(200)
                        }).catch(err => {
                            console.log(err)
                        })

                    })

                    break;
                }
                case 'user': {
                    udb.doc(a.value).get().then(u => {
                        if (!u.exists) {
                            return axios.post(`https://slack.com/api/chat.postMessage`, {
                                channel: data.container.channel_id,
                                thread_ts: data.container.message_ts,
                                text: `Такого пользователя в базе нет`
                            }, {
                                headers: {
                                    'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                    'Content-Type': 'application/json'
                                }
                            }).then(d => {
                                console.log(d)
                                res.sendStatus(200)
                            }).catch(err => {
                                console.log(err)
                            })
                        }
                        switch (a.action_id.split('_')[1]) {
                            case 'block': {
                                if (u.data().blocked) {
                                    return axios.post(`https://slack.com/api/chat.postMessage`, {
                                        channel: data.container.channel_id,
                                        thread_ts: data.container.message_ts,
                                        text: `Пользователь уже заблокирован`
                                    }, {
                                        headers: {
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                            'Content-Type': 'application/json'
                                        }
                                    }).then(d => {
                                        console.log(d)
                                        res.sendStatus(200)
                                    }).catch(err => {
                                        console.log(err)
                                    })
                                } else {
                                    return udb.doc(a.value).update({
                                        blocked: true,
                                        updatedBy: `slack_${data.user.userName}`
                                    }).then(() => {
                                        res.sendStatus(200)
                                        axios.post(`https://slack.com/api/chat.postMessage`, {
                                            channel: data.container.channel_id,
                                            thread_ts: data.container.message_ts,
                                            text: `Пользователь заблокирован`
                                        }, {
                                            headers: {
                                                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                                'Content-Type': 'application/json'
                                            }
                                        })
                                        log({
                                            filter: `users`,
                                            user: u.id,
                                            text: `Админ ${data.user.username} блокирует пользователя ${uname(u.data(),u.id)}`
                                        })
                                    })
                                    
                                }
                            }
                            case 'admin': {
                                udb.doc(a.value).update({
                                    admin: true,
                                    updatedBy: `slack_${data.user.username}`
                                }).then(() => {
                                    res.sendStatus(200)
                                })
                                axios.post(`https://slack.com/api/chat.postMessage`, {
                                    channel: data.container.channel_id,
                                    thread_ts: data.container.message_ts,
                                    text: `Пользователь стал админом`
                                }, {
                                    headers: {
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                        'Content-Type': 'application/json'
                                    }
                                })
                                log({
                                    user: u.id,
                                    text: `Админ ${data.user.username} сделал ${uname(u.data(),u.id)} админом`
                                })
                                sendMessage2({
                                    chat_id: u.id,
                                    text: `Поздравляем, вы зарегистрированы как админ приложения`
                                }, false, token, messages)
                                break;
                            }
                            case 'insider': {
                                udb.doc(a.value).update({
                                    insider: true,
                                    updatedBy: `slack_${data.user.userName}`
                                }).then(() => {
                                    res.sendStatus(200)
                                })
                                axios.post(`https://slack.com/api/chat.postMessage`, {
                                    channel: data.container.channel_id,
                                    thread_ts: data.container.message_ts,
                                    text: `Пользователь стал сотрудником`
                                }, {
                                    headers: {
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                        'Content-Type': 'application/json'
                                    }
                                })
                                log({
                                    user: u.id,
                                    text: `Админ ${data.user.userName} сделал ${uname(u.data(),u.id)} сотрудником`
                                })
                                sendMessage2({
                                    chat_id: u.id,
                                    text: translations.congrats[u.data().language_code] || translations.congrats.en
                                }, false, token, messages)
                                break;
                            }

                            case 'fellow': {
                                udb.doc(a.value).update({
                                    fellow: true,
                                    updatedBy: `slack_${data.user.userName}`
                                }).then(() => {
                                    res.sendStatus(200)
                                })
                                axios.post(`https://slack.com/api/chat.postMessage`, {
                                    channel: data.container.channel_id,
                                    thread_ts: data.container.message_ts,
                                    text: `Пользователь стал участником fellows`
                                }, {
                                    headers: {
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                        'Content-Type': 'application/json'
                                    }
                                })
                                log({
                                    user: u.id,
                                    text: `Админ ${data.user.userName} сделал ${uname(u.data(),u.id)} участником программы fellows`
                                })
                                sendMessage2({
                                    chat_id: u.id,
                                    text: translations.fellow[u.data().language_code] || translations.fellow.en
                                }, false, token, messages)
                                break;
                            }

                            default: {
                                res.sendStatus(404)
                            }
                        }

                    })

                    break;
                }

                case 'usersPaginator': {
                    switch (a.block_id) {
                        case 'all': {
                            let offset = +a.selected_option.value.split('_')[0]
                            let limit = +a.selected_option.value.split('_')[1]

                            return udb.orderBy('createdAt')
                                .limit(offset + limit)
                                .get().then(col => {
                                    return axios.post(
                                        'https://slack.com/api/views.update',
                                        modals.filteredUsers(data.view.id, handleQuery(col).splice(offset, limit), a.block_id), {
                                            headers: {
                                                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                                'Content-Type': 'application/json',
                                            }
                                        }
                                    ).then(s => {
                                        if (process.env.develop == 'true') console.log(s.data)
                                    }).catch(err => {
                                        console.log(err.message)
                                    })
                                }).catch(err => {
                                    console.log(err)
                                })
                        }
                        default: {
                            return udb.where(a.block_id, '==', true).get().then(col => {
                                return axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.filteredUsers(data.view.id, handleQuery(col), a.action_id.split('_')[2]), {
                                        headers: {
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                            'Content-Type': 'application/json',
                                        }
                                    }
                                ).then(s => {
                                    if (process.env.develop == 'true') console.log(s.data)
                                }).catch(err => {
                                    console.log(err.message)
                                })
                            }).catch(err => {
                                console.log(err)
                            })
                        }
                    }
                }
                case 'users': {
                    switch (inc[1]) {
                        case 'filtered': {
                            switch (inc[2]) {
                                case 'all': {
                                    return udb.orderBy('createdAt').offset(inc[3] || 0).limit(inc[4] || 50).get().then(col => {
                                        return axios.post(
                                            'https://slack.com/api/views.update',
                                            modals.filteredUsers(data.view.id, handleQuery(col), a.action_id.split('_')[2]), {
                                                headers: {
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                                    'Content-Type': 'application/json',
                                                }
                                            }
                                        ).then(s => {
                                            if (process.env.develop == 'true') console.log(s.data)
                                        }).catch(err => {
                                            console.log(err.message)
                                        })
                                    }).catch(err => {
                                        console.log(err)
                                    })
                                }
                                default: {
                                    return udb.where(a.action_id.split('_')[2], '==', true).get().then(col => {
                                        return axios.post(
                                            'https://slack.com/api/views.update',
                                            modals.filteredUsers(data.view.id, handleQuery(col), a.action_id.split('_')[2]), {
                                                headers: {
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                                    'Content-Type': 'application/json',
                                                }
                                            }
                                        ).then(s => {
                                            if (process.env.develop == 'true') console.log(s.data)
                                        }).catch(err => {
                                            console.log(err.message)
                                        })
                                    }).catch(err => {
                                        console.log(err)
                                    })
                                }
                            }
                        }
                    }
                }
                case 'lectures': {
                    classes.doc(a.selected_option.value).get().then(l => {
                        l = l.data();

                        axios.post(`https://slack.com/api/views.update`, modals.lecture(l), {
                            headers: {
                                'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                'Content-Type': 'application/json'
                            }
                        }).then(d => {
                            console.log(d)
                        }).catch(err => {
                            console.log(err)
                        })
                    })
                    break;
                }
                case 'lecture': {
                    switch (a.action_id.split('_')[1]) {
                        case 'cancel': {
                            return classes.doc(a.value).get().then(c => {
                                if (!c.exists) {
                                    return axios.post(`https://slack.com/api/chat.postMessage`, {
                                        channel: data.container.channel_id,
                                        thread_ts: data.container.message_ts,
                                        text: `Извините, этой лекции не существует в базе данных`
                                    }, {
                                        headers: {
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                            'Content-Type': 'application/json'
                                        }
                                    }).then(d => {
                                        res.sendStatus(200)
                                    }).catch(err => {
                                        console.log(err)
                                    })
                                }

                                if (!c.data().active) {
                                    return axios.post(`https://slack.com/api/chat.postMessage`, {
                                        channel: data.container.channel_id || process.env.papersHook,
                                        thread_ts: data.container.message_ts,
                                        text: `Извините, эта лекция уже отменена`
                                    }, {
                                        headers: {
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                            'Content-Type': 'application/json'
                                        }
                                    }).then(d => {
                                        console.log(d)
                                        res.sendStatus(200)
                                    }).catch(err => {
                                        console.log(err)
                                    })
                                }

                                return classes.doc(a.value).update({
                                    active: false,
                                    updatedBy: `slack_${data.user.username}`,
                                    updatedAt: new Date()
                                }).then(() => {
                                    axios.post(`https://slack.com/api/chat.postMessage`, {
                                        channel: data.container.channel_id || process.env.papersHook,
                                        thread_ts: data.container.message_ts,
                                        text: `${data.user.username} отменяет лекцию`
                                    }, {
                                        headers: {
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken,
                                            'Content-Type': 'application/json'
                                        }
                                    }).then(d => {
                                        console.log(d)
                                        res.sendStatus(200)
                                    }).catch(err => {
                                        console.log(err)
                                    })

                                    if (data.container.view_id) {
                                        axios.post(
                                            'https://slack.com/api/views.update',
                                            modals.omniSuccess(data.view.id, `Лекция отменена. Участники получат соответствующие уведомления.`), {
                                                headers: {
                                                    'Content-type': 'application/json',
                                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                                }
                                            }
                                        )
                                    }
                                })
                            })
                        }
                        case 'announce': {
                            return userClasses
                                .where('class', '==', a.action_id.split('_')[2])
                                .where('active', '==', true)
                                .get()
                                .then(col => {
                                    col.docs.forEach(record => {
                                        sendMessage2({
                                            chat_id: record.data().user,
                                            text: a.value
                                        }, false, token, messages)
                                    })
                                    res.sendStatus(200)
                                }).catch(handleError)
                        }
                        case 'lecture_announceNoShow_': {
                            return userClasses
                                .where('class', '==', a.action_id.split('_')[2])
                                .where('active', '==', true)
                                .get()
                                .then(col => {
                                    handleQuery(col)
                                    .filter(r => r.status != 'used')
                                    .forEach(record => {

                                        sendMessage2({
                                            chat_id: record.data().user,
                                            text: a.value,
                                            reply_markup: {
                                                inline_keyboard: [
                                                    [{
                                                        text: translations.openClass.en,
                                                        web_app: {
                                                            url: appLink + '?startapp=classes'
                                                        }
                                                    }]
                                                ]
                                            }
                                        }, false, token, messages)
                                    })
                                    res.sendStatus(200)
                                }).catch(handleError)
                        }
                        case 'alert': {
                            switch (inc[2]) {
                                case 'admins': {

                                    classes.doc(inc[3]).get().then(cl => {
                                        let h = cl.data();
                                        h.id = inc[3]

                                        udb
                                            .where('admin', '==', true)
                                            .get()
                                            .then(col => {
                                                handleQuery(col).forEach(u => {
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
                                                        text: `${drawDate(h.date,false,{time:true})}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author || h.authorName}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description}\n${h.price? `${translations.fee[lang] ||  translations.fee.en} ${cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`,
                                                        parse_mode: 'HTML',
                                                        reply_markup: {
                                                            inline_keyboard: kbd
                                                        }
                                                    }

                                                    if (h.pic) {
                                                        message.caption = message.text.slice(0, 1000)
                                                        message.photo = h.pic
                                                        // delete message.text
                                                    }
                                                    sendMessage2(message, (h.pic ? 'sendPhoto' : false), token)
                                                })
                                            })
                                    })

                                    break;
                                }
                                case 'all': {
                                    classes.doc(inc[3]).get().then(cl => {
                                        let h = cl.data();
                                        h.id = inc[3]

                                        let users = udb.where('active', '==', true)

                                        if (h.admins) {
                                            users = users.where('admin', '==', true)
                                        } else if (h.fellows) {
                                            users = users.where('fellow', '==', true)
                                        }

                                        users
                                            .get()
                                            .then(col => {
                                                handleQuery(col).forEach((u,i) => {

                                                    if (!u.noSpam) {
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
                                                            text: `${drawDate(h.date,false,{time:true})}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author || h.authorName}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description}\n${h.price? `${translations.fee[lang] ||  translations.fee.en} ${cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`,
                                                            parse_mode: 'HTML',
                                                            reply_markup: {
                                                                inline_keyboard: kbd
                                                            }
                                                        }

                                                        if (h.pic) {
                                                            message.caption = message.text.slice(0, 1000)
                                                            message.photo = h.pic
                                                            // delete message.text
                                                        }
                                                        setTimeout(function(){
                                                            sendMessage2(message, (h.pic ? 'sendPhoto' : false), token).then(s=>{
                                                                if(!s) {
                                                                    udb.doc(u.id.toString()).update({active:false})
                                                                } else {
                                                                    udb.doc(u.id.toString()).update({testTag:new Date()})
                                                                }
                                                            })
                                                        },i*200)
                                                    
                                                    }
                                                    
                                                })
                                                res.sendStatus(200)
                                            })


                                    })
                                    break
                                }
                            }
                            break;
                        }
                        case 'update': {
                            return classes.doc(inc[2]).get().then(l => {
                                if (!l.exists) return res.sendStatus(404)

                                console.log(JSON.stringify(modals.lectureUpdate(data.view.id, l.data(), l.id)))

                                return axios.post(
                                    'https://slack.com/api/views.update',
                                    modals.lectureUpdate(data.view.id, l.data(), l.id), {
                                        headers: {
                                            'Content-type': 'application/json',
                                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                                        }
                                    }
                                ).then(s => {
                                    if (process.env.develop == 'true') console.log(s.data)
                                }).catch(err => {
                                    console.log(err.message)
                                })
                            })
                        }
                        default:
                            return res.sendStatus(404)
                    }
                    break;
                }
                case 'coworkingHall': {

                    data.actions[0].action_id = 'coworking_' + a.selected_option.value

                    axios.post(process.env.apihost + '/paper/slack', data)
                    return res.send('ok')
                }
                case 'lectureDetails': {
                    let d = [];
                    d.push(classes.doc(a.value).get().then(c => {
                        let t = c.data()
                        t.id = a.value
                        return t;
                    }))
                    d.push(userClasses.where('class', '==', a.value)
                        // .orderBy('createdAt','asc')
                        .get().then(col => handleQuery(col)))

                    Promise.all(d).then(d => {
                        if (data.view) {
                            axios.post(
                                'https://slack.com/api/views.update',
                                modals.lectureDetails(data.view.id, d[0], d[1]), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            ).then(s => {
                                if (process.env.develop == 'true') console.log(s.data)
                            }).catch(err => {
                                console.log(err.message)
                            })
                        } else {
                            axios.post(
                                'https://slack.com/api/views.open', {
                                    trigger_id: data.trigger_id,
                                    view: modals.lectureDetails(false, d[0], d[1])
                                }, {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            ).then(s => {
                                if (process.env.develop == 'true') console.log(s.data)
                            }).catch(err => {
                                console.log(err.message)
                            })
                        }

                    })
                    break;
                }
                default: {
                    return res.sendStatus(404)
                }
            }
            break;
        }
        case 'view_submission': {

            if (!data.view.callback_id.indexOf('lectureUpdate_')) {

                axios.post(
                    'https://slack.com/api/views.update',
                    modals.inprogress, {
                        headers: {
                            'Content-type': 'application/json',
                            'Authorization': 'Bearer ' + process.env.paperSlackToken
                        }
                    }
                )

                let lid = data.view.callback_id.split('lectureUpdate_')[1]
                let nl = data.view.state.values;
                let l = {
                    date: new Date(nl.date.date.selected_date + ' ' + nl.time.time.selected_time).toISOString(),
                    name: nl.name.name.value,
                    author: nl.author.author.value,
                    duration: nl.duration.duration.value,
                    price: +nl.price.price.value || 0,
                    description: nl.description.description.value,
                    fellows: nl.extras.extras.selected_options.filter(o => o.value == 'fellows').length ? true : false,
                    admins: nl.extras.extras.selected_options.filter(o => o.value == 'admins').length ? true : false,
                    noRegistration: nl.extras.extras.selected_options.filter(o => o.value == 'noRegistration').length ? true : false,
                    updatedAt: new Date(),
                    updatedBy: `slack_${data.user.username}`,
                    capacity: +nl.capacity.capacity.value || 0,
                    pic: nl.pic.pic.value || null,
                }

                return classes.doc(lid).update(l).then(() => {

                    res.sendStatus(200)

                    return axios.post(
                        'https://slack.com/api/views.update',
                        modals.omniSuccess(data.view.id, `Отлично! Лекция Обновлена.`), {
                            headers: {
                                'Content-type': 'application/json',
                                'Authorization': 'Bearer ' + process.env.paperSlackToken
                            }
                        }
                    )
                }).catch(handleError)
            }

            switch (data.view.callback_id) {

                case 'newClass': {

                    res.sendStatus(200)

                    axios.post(
                        'https://slack.com/api/views.update',
                        modals.inprogress, {
                            headers: {
                                'Content-type': 'application/json',
                                'Authorization': 'Bearer ' + process.env.paperSlackToken
                            }
                        }
                    )

                    let nl = data.view.state.values;

                    let capacity = nl.capacity.capacity.value || null;

                    if (!capacity) {
                        capacity = halls.doc(nl.hall.hall.selected_option.value).get().then(h => h.data().capacity)
                    }

                    return Promise.resolve(capacity).then(capacity => {
                        let l = {
                            active:         true,
                            date:           new Date(nl.date.date.selected_date + ' ' + nl.time.time.selected_time).toISOString(),
                            type:           nl.type.type.selected_option.value,
                            hall:           nl.hall.hall.selected_option.value,
                            hallName:       decodeURIComponent(nl.hall.hall.selected_option.text.text),
                            name:           nl.name.name.value,
                            author:         nl.author.author.value,
                            duration:       nl.duration.duration.value,
                            price:          +nl.price.price.value || 0,
                            description:    nl.description.description.value,
                            pic:            nl.pic.pic.value || null,
                            fellows:        nl.extras.extras.selected_options.filter(o => o.value == 'fellows').length ? true : false,
                            admins:         nl.extras.extras.selected_options.filter(o => o.value == 'admins').length ? true : false,
                            noRegistration: nl.extras.extras.selected_options.filter(o => o.value == 'noRegistration').length ? true : false,
                            createdAt:      new Date(),
                            capacity:       capacity || null
                        }


                        return classes.add(l).then(record => {

                            log({
                                filter: `lectures`,
                                class: record.id,
                                text: `На ${l.date} назначена новая лекция: ${l.name}.`
                            })

                            if (nl.extras.extras.selected_options.filter(o => o.value == 'alert').length) {
                                udb.get().then(col => {

                                    let users = handleQuery(col)

                                    users.forEach(u => {
                                        if ((process.env.develop == 'true' && u.tester) || process.env.develop != 'true') {
                                            if (l.pic) {

                                                let ikbd = [
                                                    [{
                                                        text: translations.tellMeMore[u.language_code] || translations.tellMeMore.en,
                                                        web_app: {
                                                            url: process.env.ngrok + '/paper/app?start=classes'
                                                        }
                                                    }]
                                                ]

                                                if (!l.noRegistration) {
                                                    // @ts-ignore
                                                    ikbd.push([{
                                                        text: translations.book[u.language_code] || translations.book.en,
                                                        callback_data: `class_${record.id}`
                                                    }])
                                                }
                                                sendMessage2({
                                                    chat_id: u.id,
                                                    photo: l.pic,
                                                    caption: translations.newLecture(l)[u.language_code] || translations.newLecture(l).en,
                                                    reply_markup: {
                                                        inline_keyboard: ikbd
                                                    }
                                                }, 'sendPhoto', token, messages)
                                            } else {

                                                let ikbd = [
                                                    [{
                                                        text: translations.tellMeMore[u.language_code] || translations.tellMeMore.en,
                                                        web_app: {
                                                            url: process.env.ngrok + '/paper/app?start=classes'
                                                        }
                                                    }]
                                                ]

                                                if (!l.noRegistration) {
                                                    // @ts-ignore
                                                    ikbd.push([{
                                                        text: translations.book[u.language_code] || translations.book.en,
                                                        callback_data: `class_${record.id}`
                                                    }])
                                                }

                                                sendMessage2({
                                                    chat_id: u.id,
                                                    text: translations.newLecture(l)[u.language_code] || translations.newLecture(l).en,
                                                    reply_markup: {
                                                        inline_keyboard: ikbd
                                                    }
                                                }, false, token, messages)
                                            }
                                        }



                                    })
                                })
                            }
                            return axios.post(
                                'https://slack.com/api/views.update',
                                modals.omniSuccess(data.view.id, `Отлично! Лекция создана. Вот ее код (на всякий случай): ${record.id}.`), {
                                    headers: {
                                        'Content-type': 'application/json',
                                        'Authorization': 'Bearer ' + process.env.paperSlackToken
                                    }
                                }
                            )


                        }).catch(err => {
                            console.log(err)
                            return res.sendStatus(500)
                        })
                    })



                    // log({
                    //     class: record.id,
                    //     text: `На ${l.date} назначена новая лекция: ${l.name}.`
                    // })

                    break;
                }

                case 'newQ': {
                    let nl = data.view.state.values;
                    let q = {
                        name: nl.name.name.value,
                        by: data.user.username,
                        text: nl.text.text.value,
                        createdAt: new Date(),
                        active: true
                    }

                    polls.add(q).then(rec => {
                        axios.post(
                            'https://slack.com/api/views.update',
                            modals.omniSuccess(data.view.id, `Вопрос задан и начал расходиться по fellows.`), {
                                headers: {
                                    'Content-type': 'application/json',
                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                }
                            }
                        )
                    })

                    udb
                        .where('active', '==', true)
                        .where('fellow', '==', true)
                        .get()
                        .then(col => {
                            handleQuery(col).forEach(u => {

                                sendMessage2({
                                    chat_id: u.id,
                                    text: `Добрый день! Коллега ${data.user.username} просит ответить на вопрос ${nl.name.name.value}\n${nl.text.text.value}.\nОтветить вы сможете через приложение.`
                                }, false, token, messages)


                            })
                        })






                    return res.send('ok')
                }

                case 'newCampaign': {

                    let nl = data.view.state.values;

                    let message = {
                        text: nl.text.text.value,
                        by: data.user.username,
                        name: nl.name.name.value,
                        silent: !nl.extras.extras.selected_options.lenth
                    }

                    if (nl.type.type.selected_option.value != 'all') {
                        message.filter = nl.type.type.selected_option.value + '_true'
                    }

                    return axios.post(process.env.apihost + `/paper/news`, message, {
                        headers: {
                            secret: process.env.paperSlackToken || ''
                        }
                    }).then(s => {
                        res.sendStatus(200)
                        axios.post(
                            'https://slack.com/api/views.update',
                            modals.omniSuccess(data.view.id, `Отлично! Ваше сообщение доставлено ${s.data.success.length} раз.`), {
                                headers: {
                                    'Content-type': 'application/json',
                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                }
                            }
                        )
                    }).catch(err => {
                        res.sendStatus(500)
                        return axios.post(
                            'https://slack.com/api/views.update',
                            modals.err(data.view.id, `Что-то пошло не так: ${err.message}`), {
                                headers: {
                                    'Content-type': 'application/json',
                                    'Authorization': 'Bearer ' + process.env.paperSlackToken
                                }
                            }
                        )
                    })



                    break;
                }

                default: {
                    return res.sendStatus(400)
                }
            }
        }
        default:
            return res.sendStatus(404)
    }
})


module.exports = router;