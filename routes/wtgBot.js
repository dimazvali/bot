var express =   require('express');
var router =    express.Router();
var axios =     require('axios');
var cors =      require('cors')
var common =    require('./common');
const m =       require('./methods.js');
var QRCode =    require('qrcode')
var cron =      require('node-cron');
var modals =    require('./modals.js').modals
const qs =      require('qs');
var uname =     require('./common').uname;
var drawDate =  require('./common').drawDate;


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
const { from } = require('form-data');


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
}, 'wtg');

let botLink = `https://t.me/wineToGoBot`;

let fb = getFirestore(gcp);

let token = process.env.wtgToken
let paymentToken = process.env.papersPaymentToken

let ngrok = process.env.ngrok

let host = `wtg`


// setTimeout(function(){
//     common.devlog(`выставляем токен`)
//     axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/${host}/hook`).then(()=>{
//         console.log(`wtg hook set on ${ngrok}`)
//         if (process.env.develop != 'true') {
//             log({
//                 text: `Приложение перезапущено ${drawDate(new Date(),'ru',{time:true})}`
//             })
//         }
//     }).catch(handleError)   
// },100)

function handleError(err) {
    console.log(err);
    try {
        res.status(500).send(err.message)
    } catch (err) {

    }
}


let udb =               fb.collection('WTGusers');
let messages =          fb.collection('WTGuserMessages');
let logs =              fb.collection('WTGlogs');
let userEntries =       fb.collection('WTGuserEntries');
let news =              fb.collection('WTGnews');
let cities =            fb.collection('WTGcities');
let tickets =           fb.collection('WTGtickets');
let bars =              fb.collection('WTGbars');
let wines =             fb.collection('WTGwines');
let fests =             fb.collection('WTGfests');
let barsUsers =         fb.collection(`WTGbarsUsers`);
let barsInvites =       fb.collection(`WTGbarsInvites`);
let barsOrders =        fb.collection(`WTGbarsOrders`);
let barsReviews =       fb.collection(`WTGbarsReviews`);
let achievements =      fb.collection(`WTGachievements`);
let usersAchievements =      fb.collection(`WTGusersAchievements`);



router.get('/app', (req, res) => {
    res.render(host+'/app', {
        user:           req.query.id,
        start:          req.query.start || req.query.tgWebAppStartParam,
        translations:   translations,
    })
})


router.get('/admin', (req, res) => {
    res.render(host+'/admin', {
        user:           req.query.id,
        start:          req.query.start || req.query.tgWebAppStartParam,
        translations:   translations
    })
})

router.get('/bar', (req, res) => {
    res.render(host+'/bar', {
        user:           req.query.id,
        start:          req.query.start || req.query.tgWebAppStartParam,
        translations:   translations
    })
})

function alertAchievement(a,user_id){
    m.sendMessage2({
        chat_id: user_id,
        parse_mode: 'Markdown',
        text: `${common.sudden.fine()}! Вы открыли достижение ${a.name}\n(_${a.desc}_)`
    },false,token)
}

function setAchievement(a,u){
    achievements.doc(a).get().then(achievement=>{
        achievement = achievement.data();
        udb.doc(u.toString()).get().then(user=>{
            user = user.data();
            usersAchievements.add({
                createdAt:      new Date(),
                auto:           true,
                achievement:    a,
                user:           +u
            }).then(rec=>{
                alertAchievement(achievement,u)
                log({
                    text:           `${uname(user,u)} получает ачику ${a.name}.`,
                    user:           +u,
                    achievement:    a
                })
            })
        })

    })
}

router.all(`/admin/:method/:id`,(req,res)=>{
    if (!req.query.id) return res.status(401).send(`Вы кто вообще?`)
    udb.doc(req.query.id).get().then(user => {
        if (!user.exists) return res.status(401).send(`Вы кто вообще?`)
        user = user.data();
        if (!user.admin) return res.status(403).send(`Вам сюда нельзя`)

        switch(req.params.method){
            case 'achievements':{
                if(!req.body.user) return res.sendStatus(400)
                
                return usersAchievements.add({
                    achievement:    req.params.id,
                    user:           +req.body.user,
                    createdAt:      new Date(),
                    createdBy:      +req.query.id
                }).then(rec=>{
                    
                    res.sendStatus(200)

                    achievements.doc(req.params.id).get().then(a=>{
                        
                        log({
                            text: `Админ выдает пользователю ${req.body.user} ачивку ${a.data().name}`,
                            admin: +req.query.id,
                            achievement: req.params.id
                        })

                        alertAchievement(a.data(),req.body.user)
                    })

                }).catch(handleError)
            }
            case 'bars':{
                switch (req.method){
                    case 'GET':{
                        return bars.doc(req.params.id).get().then(b=>{
                            if(!b.exists) return res.sendStatus(404)
                            let data = []

                            data.push(barsOrders.where(`bar`,'==',req.params.id).get().then(col=>common.handleQuery(col)))
                            data.push(barsUsers.where(`bar`,'==',req.params.id).get().then(col=>common.handleQuery(col)))
                            
                            Promise.all(data).then(data=>{
                                let users = []
                                data[1].forEach(u=>{
                                    users.push(udb.doc(u.user.toString()).get().then(u=>{
                                        let t = u.data();
                                            t.id = u.user
                                            return t
                                    }))
                                })
                                Promise.all(users).then(users=>{
                                    res.json({
                                        users:      users,
                                        orders:    data[0]
                                    })
                                })

                            })
                        })
                    }
                }
            }
            case `tickets`:{
                let tref = tickets.doc(req.params.id)
                return tref.get().then(t=>{
                    if(!t.exists) return res.sendStatus(404)
                    t = t.data();
                    if(req.method == 'PUT'){
                        tref.update({
                            payed: new Date()
                        }).then(s=>{
                            res.json({success: true})
                        }).catch(err=>{
                            res.status(500).send(err.message)
                        })

                        // tref.update({
                        //     [req.body.attr]: req.body.value
                        // }).then(s=>{
                        //     res.json({success: true})
                        // }).catch(err=>{
                        //     res.status(500).send(err.message)
                        // })
                    }
                    if(req.method == `DELETE`){
                        tref.update({
                            active: false
                        }).then(s=>{
                            res.json({success: true})
                        }).catch(err=>{
                            res.status(500).send(err.message)
                        })
                    }
                })
            }
        }

    })  
})

function log(m){
    m.createdAt = new Date()
    logs.add(m)
}


function interprete(field, value) {
    switch (field) {
        case 'admin': {
            return value ? `делает админом` : `снимает админство с`
        }
        case 'bar':
            return value ? `делает барменом` : `убирает из барменов`
        case 'blocked':
            return value ? `добавляет в ЧС` : `убирает из бана`
        default:
            return `делает что-то необычно: поле ${field} становится ${value}`
    }
}

router.all(`/bar/:method/:id`,(req,res)=>{
    common.devlog(req.query.id)
    if (!req.query.id) return res.status(401).send(`Вы кто вообще?`)
    udb.doc(req.query.id).get().then(user => {
        if (!user.exists) return res.status(401).send(`Вы кто вообще?`)
        user = user.data();
        if (!user.bar) return res.status(403).send(`Вам сюда нельзя`)

        barsUsers
            .where('user','==',+req.query.id)
            .where(`active`,'==',true)
            .get()
            .then(col=>{
                let allowed = {};
                common.handleQuery(col).forEach(b=>{
                    allowed[b.bar] = true
                })

                switch(req.params.method){
                    case 'ticket':{
                        if(req.method == 'POST'){

                            if(!allowed[req.query.bar]) return res.sendStatus(403)

                            let tref = tickets.doc(req.params.id)

                                return tref.get().then(t=>{
                                    
                                    if(!t.exists) return res.sendStatus(404)

                                    t = t.data();

                                    if(t.left){
                                        tref.update({
                                            left: FieldValue.increment(-1)
                                        })
                                        barsOrders.add({
                                            createdAt:  new Date(),
                                            bar:        req.query.bar,
                                            by:         +req.query.id,
                                            ticket:     req.params.id,
                                            user:       t.user,
                                            revenue:    8
                                        }).then(()=>{
                                            
                                            res.json({success:true})

                                            bars.doc(req.query.bar).get().then(b=>{
                                                m.sendMessage2({
                                                    chat_id: t.user,
                                                    text: `Как вам в баре ${b.data().name}?..`
                                                },false,token)

                                                udb.doc(t.user.toString()).get().then(u=>{
                                                    u = u.data()
                                                    log({
                                                        text:   `В баре ${b.data().name} наливают бокал гостю ${uname(u,t.user)}`,
                                                        bar:    req.query.bar,
                                                        barman: +req.query.id,
                                                        user:   t.user,
                                                        ticket: req.params.id
                                                    })
                                                })
                                                
                                            })


                                            
                                            
                                            
                                        })
                                        
                                    } else {
                                        res.json({
                                            success: false,
                                            comment: `все выпито, мон колонель`
                                        })
                                    }
                                })
                        }
                        break;
                    }
                    case 'bars':{
                        if(!allowed[req.params.id]) return res.sendStatus(403)
                        switch(req.query.int){
                            case 'users':{
                                return barsUsers.where(`bar`,'==',req.params.id).get().then(col=>{
                                    let t = []
                                    common.handleQuery(col).forEach(access=>{
                                        t.push(udb.doc(access.user.toString()).get().then(u=>{
                                            let temp = u.data();
                                                temp.access = access.id;
                                                temp.id = u.id
                                            return temp
                                        }))
                                    })
                                    Promise.all(t).then(users=>{
                                        res.json(users)
                                    })
                                })
                            }
                            case 'incomes':{
                                return barsOrders.where(`bar`,'==',req.params.id).get().then(col=>res.json(common.handleQuery(col)))
                            }
                        }
                    }
                }
            })
    })  
})

router.all(`/bar/:method`,(req,res)=>{
    if (!req.query.id) return res.status(401).send(`Вы кто вообще?`)
    udb.doc(req.query.id).get().then(user => {
        if (!user.exists) return res.status(401).send(`Вы кто вообще?`)
        user = user.data();
        if (!user.bar) return res.status(403).send(`Вам сюда нельзя`)

        barsUsers
            .where('user','==',+req.query.id)
            .where(`active`,'==',true)
            .get()
            .then(col=>{
                let allowed = {};
                common.handleQuery(col).forEach(b=>{
                    allowed[b.bar] = true
                })

                switch(req.params.method){
                    case `qr`: {
                        if (!req.query.data) return res.sendStatus(404)
                        let inc = req.query.data.split('_')
                        
                        switch (req.method) {
                            case 'GET': {
                                return tickets
                                    .doc(inc[0])
                                    .get()
                                    .then(d => {
                                        common.devlog({data:d.data()})
                                        res.json({data:d.data()})
                                    })
                            }
                            case 'POST': {

                                let tref = tickets.doc(inc[0])

                                return tref.get().then(t=>{
                                    if(t.left){
                                        tref.update({
                                            left: FieldValue.increment(-1)
                                        })
                                        orders.add({
                                            createdAt:  new Date(),
                                            bar:        req.query.bar,
                                            by:         +req.query.id,
                                            ticket:     inc[0],
                                            user:       t.user,
                                            revenue:    8
                                        }).then(()=>{
                                            
                                            res.json({success:true})

                                            bars.doc(req.query.bar).get().then(b=>{
                                                m.sendMessage2({
                                                    chat_id: t.user,
                                                    text: `Как вам в баре ${b.data().name}?..`
                                                })
                                            })

                                            orders
                                                .where(`user`,'==',t.user)
                                                .get()
                                                .then(col=>{
                                                    if(col.docs.length == 1){
                                                        setAchievement(`PS6O1AXpgK4W5xY8SoP7`,t.user)
                                                    }
                                                })
                                            
                                            
                                        })
                                        
                                    } else {
                                        res.json({
                                            success: false,
                                            comment: `все выпито, мон колонель`
                                        })
                                    }
                                })

                                
                                    
                            }
                        }
                    }
                    
                    case 'logs':{
                        if(!req.query.bar) return res.sendStatus(400)
                        if(!allowed[req.query.bar]) return res.sendStatus(403)
                        return logs.where(`bar`,'==',req.query.bar).get().then(col=>res.json(common.handleQuery(col)))
                    }
                    case 'check': {
                        let bars4user = []
                        Object.keys(allowed).forEach(id=>{
                            bars4user.push(bars.doc(id).get().then(b=>{
                                let t = b.data();
                                    t.id = id;
                                    return t
                            }))
                        })
                        Promise.all(bars4user).then(bars=>{
                            res.json({
                                user: user,
                                bars: bars
                            })
                        })
                    }
                }

            })

        
    })
})

router.all(`/admin/:method`, (req, res) => {
    if (!req.query.id) return res.status(401).send(`Вы кто вообще?`)
    udb.doc(req.query.id).get().then(user => {
        if (!user.exists) return res.status(401).send(`Вы кто вообще?`)
        user = user.data();
        if (!user.admin) return res.status(403).send(`Вам сюда нельзя`)
        switch (req.params.method) {
            case 'achievements':{
                switch(req.method){
                    case 'GET':{
                        return achievements.get().then(col=>res.json(common.handleQuery(col)))
                    }
                    case 'POST':{
                        return achievements.add({
                            createdAt:  new Date(),
                            createdBy:  +req.query.id,
                            name:       req.body.name || 'без названия',
                            desc:       req.body.desc || 'без описания'
                        }).then(rec=>{
                            res.send(rec.id)
                        }).catch(handleError)
                    }
                }
            }
            case 'bars':{
                switch(req.method){
                    case 'POST':{
                        req.body.createdAt = new Date();
                        req.body.createdBy = +req.query.id;
                        return bars.add(req.body)
                            .then(rec=>{
                                res.json({success:true})
                                
                                log({
                                    admin:  +req.query.id,
                                    bar:    rec.id,
                                    text:   `${uname(user,req.query.id)} создает новый бар ${req.body.name}`
                                })
                            }).catch(err=>{
                                common.devlog(err.message)
                            })
                    }
                    case 'GET':{
                        return bars.get().then(col=>res.json(common.handleQuery(col)))
                    }
                }
            }
            case 'fests':{
                switch(req.method){
                    case 'POST':{
                        if(!req.body.from || !req.body.till) return res.sendStatus(400)
                        return fests.add({
                            active:     true,
                            createdAt:  new Date(),
                            from:       new Date(req.body.from),
                            till:       new Date(req.body.till),
                            createdBy:  +req.query.id,
                            title:      req.body.title || null,
                            description:    req.body.description || null
                        }).then(f=>{
                            res.json({success:true})
                            log({
                                admin:  +req.query.id,
                                bar:    f.id,
                                text:   `${uname(user,req.query.id)} создает новый фестиваль на ${req.body.from}`
                            })
                        }).catch(err=>{
                            res.status(500).send(err.message)
                        })
                    }
                    case 'GET':{
                        return fests.get().then(col=>res.json(common.handleQuery(col)))
                    }
                }
                
            }
            case `tickets`:{
                return tickets.orderBy('createdAt', 'DESC').get().then(col => {
                    let tickets = common.handleQuery(col)
                    let users = []
                    let uniqueUsers = [... new Set(tickets.map(t=>t.user))]
                    uniqueUsers.forEach(id=>{
                        users.push(udb.doc(id.toString()).get().then(u=>{
                            let t = u.data();
                                t.id = id;
                            return t
                        }))
                    })
                    Promise.all(users).then(users=>{
                        let ready = [];
                        tickets.forEach(t=>{
                            t.user = users.filter(u=>u.id == t.user)[0]
                            ready.push(t)
                        })
                        res.json(ready)
                    })
                    
                }).catch(err => {
                    res.status(500).send(err.message)
                })
            }
            case `news`: {
                return news.orderBy('createdAt', 'DESC').get().then(col => {
                    res.json(common.handleQuery(col))
                }).catch(err => {
                    res.status(500).send(err.message)
                })
            }
            case `qr`: {
                if (!req.query.data) return res.sendStatus(404)
                let inc = req.query.data.split('_')
                
                switch (req.method) {
                    case 'GET': {
                        return fb.collection(inc[1])
                            .doc(inc[0])
                            .get()
                            .then(d => {
                                res.json({data:d.data()})
                            })
                    }
                    case 'POST': {
                        fb.collection(inc[1])
                            .doc(inc[0])
                            .update({
                                status:         'used',
                                updatedAt:      new Date(),
                                statusBy:       req.query.id
                            }).then(d => {
                                console.log(d.data())
                                res.json(d.data())
                            })
                    }
                }
            }
            case 'check': {
                return res.json(user)
            }
            case 'user': {

                if (!req.query.user) return res.sendStatus(404)

                switch (req.query.data) {
                    
                    case 'messages': {
                        return messages
                            .where('user', '==', +req.query.user)
                            .orderBy('createdAt', 'DESC')
                            .get()
                            .then(col => {
                                res.json(common.handleQuery(col))
                            })
                    }

                    case 'achievements': {
                        return usersAchievements
                            .where('user', '==', +req.query.user)
                            .get()
                            .then(col => {

                                let ready = []
                                common.handleQuery(col).forEach(a=>{
                                    ready.push(achievements.doc(a.achievement).get().then(a=>a.data()))
                                })
                                Promise.all(ready).then(achievements=>{
                                    res.json(achievements)
                                })
                                
                            })
                    }
                    
                }
            }
            case 'users': {
                switch (req.method) {
                    case 'GET': {
                        return udb
                            .orderBy((req.query.order || 'createdAt'), (req.query.direction || 'ASC'))
                            .get()
                            .then(d => {
                                res.json(common.handleQuery(d))
                            })
                    }
                    case 'POST': {
                        udb.doc(req.body.user.toString()).update({
                            [req.body.field]: req.body.value,
                            updatedAt: new Date(),
                            updatedBy: +req.query.id
                        }).then(() => {
                            let actors = []

                            actors.push(udb.doc(req.body.user.toString()).get().then(u => u.data()))
                            actors.push(udb.doc(req.query.id.toString()).get().then(u => u.data()))
                            Promise.all(actors).then(actors => {
                                log({
                                    text: `Админ @${actors[1].username} ${interprete(req.body.field,req.body.value)} @${actors[0].username || req.body.user}`,
                                    user: req.body.user,
                                    admin: +req.query.id
                                })

                                if (req.body.value) {
                                    if (req.body.field == 'insider') {
                                        m.sendMessage2({
                                            chat_id: req.body.user,
                                            text: translations.congrats[actors[0].language_code] || translations.congrats.en
                                        }, false, token)
                                    }

                                    if (req.body.field == 'admin') {
                                        m.sendMessage2({
                                            chat_id: req.body.user,
                                            text: `Поздравляем, вы зарегистрированы как админ приложения`
                                        }, false, token)
                                    }
                                }
                            })
                        })
                    }

                }

            }
            case 'logs': {
                console.log(`Запрос логов`)
                return logs
                    .orderBy('createdAt', 'DESC')
                    .limitToLast(req.query.offset ? +req.query.offset : 50)
                    .get()
                    .then(col => {
                        res.json(common.handleQuery(col))
                    })
            }
        }

    })
})

router.get('/qr', async (req, res) => {
    if (req.query.id && req.query.entity) {
        QRCode.toFile(__dirname + `/../public/images/${host}/qr/${req.query.id}_${req.query.entity}.png`, `${req.query.id}_${req.query.entity}`, {
            color: {

                dark: req.query.dark || '#1b334c',
                light: req.query.light || '#ffffff',
            },
            maskPattern: req.query.m || 0,
            type: 'png',
        }).then(s => {
            res.sendFile(`${req.query.id}_${req.query.entity}` + '.png', {
                root: `./public/images/${host}/qr/`
            })
        }).catch(err => {
            console.log(err)
            res.sendStatus(500)
        })
    } else {
        if(req.query.type == `barInvite`){

            barsInvites.add({
                bar:        req.query.bar,
                by:         +req.query.by,
                createdAt:  new Date()
            }).then(rec=>{
                QRCode.toFile(__dirname + `/../public/images/${host}/qr/${req.query.type}_${req.query.bar}.png`, `${botLink}?start=barInvite_${rec.id}`, {
                    color: {
                        dark: req.query.dark || '#1b334c',
                        light: req.query.light || '#ffffff',
                    },
                    maskPattern: req.query.m || 0,
                    type: 'png',
                }).then(s => {
                    res.sendFile(`${req.query.type}_${req.query.bar}` + '.png', {
                        root: `./public/images/${host}/qr/`
                    })
                }).catch(err => {
                    console.log(err)
                    res.status(500).send(err.message)
                })
            })

            
        } else {
            res.status(500).send(`no place provided`)
        }
        
    }
})


function updateRating(bar){
    barsOrders
        .where(`bar`,'==',bar)
        .where('rated','>=',0)
        .get()
        .then(col=>{
            let orders = common.handleQuery(col)

            let rating = orders.reduce((a,b)=>a+b.rated,0)/orders.length;
            bars.doc(bar).update({
                rating: rating
            })
        })

}

router.all(`/api/:type/:id`,(req,res)=>{
    switch (req.params.type){

        case 'author':{
            return udb.doc(req.params.id).get().then(u=>{
                
                common.devlog(req.params.id)

                if(!u.exists) return res.sendStatus(404)
                
                u = u.data();
                
                if(u.hidden && req.params.id != req.query.id) return res.sendStatus(403)

                barsReviews
                    .where(`user`,'==',+req.params.id)
                    .where(`active`,'==',true)
                    .get()
                    .then(col=>{
                        let reviews = common.handleQuery(col).sort((a,b)=>b.createdAt._seconds-a.createdAt._seconds)
                        let uniqueBars = [...new Set(reviews.map(r=>r.bar))]
                        let barsReady = [];
                        uniqueBars.forEach(id=>{
                            barsReady.push(bars.doc(id).get().then(b=>{
                                let t = b.data()
                                    t.id = id;
                                return t
                            }))
                        })


                        Promise.all(barsReady).then(bars=>{
                            let ready = [];
                            reviews.forEach(r=>{
                                r.barData = bars.filter(b=>b.id == r.bar)[0]
                                ready.push(r)
                            })

                            usersAchievements
                                .where('user', '==', +req.params.id)
                                .get()
                                .then(col => {

                                    let ready2 = []
                                    common.handleQuery(col).forEach(a=>{
                                        ready2.push(achievements.doc(a.achievement).get().then(a=>a.data()))
                                    })
                                    Promise.all(ready2).then(achievements=>{
                                        res.json({
                                            createdAt: u.createdAt,
                                            first_name: u.first_name,
                                            last_name: u.last_name,
                                            achievements: achievements,
                                            reviews: ready
                                        })
                                        // res.json()
                                    })
                                    
                                })
                            
                        })
                    })
            })
        }
        case 'sendMe':{
            return bars.doc(req.params.id).get().then(b=>{
                
                if(!b.exists) return res.sendStatus(404)
                
                b = b.data();

                m.sendMessage2({
                    chat_id:    req.query.id,
                    latitude:   b.lat,
                    longitude:  b.lng,
                    title:      b.name,
                    address:    b.address
                },'sendVenue',token).then(()=>{
                    res.sendStatus(200)
                })
            })
        }
        case 'rating':{
            switch(req.params.id){
                case 'bars':{
                    return bars
                        // .where(`active`,'==',true)
                        .get()
                        .then(col=>{
                            res.json(common.handleQuery(col).sort((a,b)=>b.rating-a.rating))
                        })
                }
            }
        }
        case 'bars':{
            return bars.doc(req.params.id).get().then(b=>{
                if(!b.exists) return res.sendStatus(404)
                barsReviews
                    .where(`bar`,'==',req.params.id)
                    .where(`active`,'==',true)
                    .get()
                    .then(col=>{
                        let bar = b.data()
                            let reviews = common.handleQuery(col).filter(r=>!r.blocked)
                            common.devlog(reviews)
                            let uniqueUsers = reviews.map(r=>r.user)
                            common.devlog(uniqueUsers)
                            let userData = []
                            uniqueUsers.forEach(id=>{
                                userData.push(udb.doc(id.toString()).get().then(u=>{
                                    let t = u.data();
                                        t.id = u.id;
                                    return t;
                                }))
                            })
                            Promise.all(userData).then(users=>{
                                let reviewsReady = [];
                                reviews.forEach(r=>{
                                    r.userData = users.filter(u=>u.id == r.user)[0]
                                    reviewsReady.push(r)
                                })
                                bar.reviews = reviewsReady
                                res.json(bar)
                            })
                        
                    })
            })
        }
        case `review`:{
            if(!req.query.id || !req.body.review) return res.status(400).send(`Не указан автор или текст`)
            
            return udb.doc(req.query.id).get().then(u=>{
                if(!u.exists) return res.status(400).send(`Нет такого юзера`)
                u = u.data();
                if(u.blocked) return res.json({success:false,comment: `Извините, вам слова не давали...`})
                bars.doc(req.params.id).get().then(b=>{
                    if(!b.exists) return res.sendStatus(404)
                    barsOrders
                        .where(`bar`,'==',req.params.id)
                        .where(`user`,'==',+req.query.id)
                        .get()
                        .then(col=>{
                            
                            let trusted = col.docs.length ? true : false;

                            barsReviews.add({
                                active:     true,
                                createdAt:  new Date(),
                                text:       req.body.review,
                                trusted:    trusted,
                                bar:        req.params.id,
                                user:       +req.query.id,
                            }).then(rec=>{
                                barsReviews.doc(rec.id).get().then(r=>{
                                    
                                    res.json({
                                        success: true,
                                        review: r.data()
                                    })
                                    
                                    log({
                                        user:   +req.query.id,
                                        bar:    req.params.id,
                                        text:   `${uname(u,+req.query.id)} оставляет новый отзыв о баре ${b.data().name}:\n${req.body.review}`
                                    })

                                    alertAdmins({
                                        text: `Новый отзыв о баре ${b.data().name}: ${req.body.review}`,
                                        type: `review`
                                    })

                                })

                                barsReviews.where(`user`,'==',+req.query.id)
                                    .get()
                                    .then(col=>{
                                        if(col.docs.length == 1){
                                            setAchievement(`kvtV6oorGryN9JPTgiKR`,+req.query.id)
                                        }
                                    })

                            }).catch(err=>{
                                res.status()
                            })
                        })
                })
                
            })
        }
        case 'tickets':{
            switch(req.method){
                case 'POST':{
                    
                    if(!req.body.user) return res.sendStatus(400)

                    return udb.doc(req.body.user.toString()).get().then(u=>{
                        if(!u.exists) res.sendStatus(404)
                        
                        u = u.data()
                        
                        if(u.blocked) return {
                            success: false,
                            alert: `Извините, мне сказали вам больше не наливать.`
                        }

                        tickets.add({
                            createdAt:  new Date(),
                            user:       req.body.user,
                            active:     true,
                            payed:      false,
                            left:       5
                        }).then(s=>{

                            res.json({
                                success:    true,
                                id:         s.id
                            })
                            
                            alertAdmins({
                                text:       `${uname(u, req.body.id)} просит новый билет`, 
                                user:       req.body.user,
                                type:       `newTicket`,
                                ticket:     s.id
                            })

                            log({
                                user:       req.body.id,
                                ticket:      s.id,
                                text:   `${uname(u,req.body.user)} просит новый билет`
                            })

                        }).catch(err=>{
                            common.devlog(err.message)
                        })

                        
                        
                    })
                }
            }
        }
        case 'user':{
            switch(req.method){
                case 'GET':{
                    return udb.doc(req.params.id).get().then(u=>{
                        if(!u.exists) res.sendStatus(404)
                        
                        u = u.data();
                
                        if(u.blocked) res.json({
                            alert: `Извините, вам сюда нельзя`
                        })
                        tickets
                            .where('active','==',true)
                            .where('user','==',+req.params.id)
                            .get()
                            .then(col=>{
                                let ticket = common.handleQuery(col)[0];
                                
                                fests
                                    .where(`active`,'==',true)
                                    .where(`till`,'>=',new Date())
                                    .orderBy(`till`,`asc`)
                                    .limit(1)
                                    .get()
                                    .then(col=>{
                                        common.devlog(common.handleQuery(col)[0])
                                        res.json({
                                            ticket: ticket ? {
                                                id:     ticket.id,
                                                left:   ticket.left,
                                                payed:  ticket.payed
                                            } : false,
                                            admin:  u.admin,
                                            bar:    u.bar,
                                            fest: common.handleQuery(col)[0]
                                        })
                                    })
        
                                
                            })
                        
                    })
                }
                case 'PUT':{
                    if(!req.body.attr) res.sendStatus(400)
                    let available = [`hidden`,`about`];
                    if(available.indexOf(req.body.attr)>-1){
                        return udb.doc(req.params.id).update({
                            [req.body.attr]:req.body.value
                        }).then(r=>{
                            res.sendStatus(200)
                        })
                    } else {
                        return  res.sendStatus(403)
                    }
                }
            }
            
        }
        case 'history':{
            return barsOrders
                .where(`user`,'==',+req.params.id)
                .get()
                .then(col=>{
                    let orders = common.handleQuery(col)
                    let barsReady = [];
                    let uniqueBars =[...new Set(orders.map(o=>o.bar))]
                    uniqueBars.forEach(id=>{
                        barsReady.push(bars.doc(id).get().then(b=>{
                            let t = b.data();
                                t.id = id
                            return t
                        }))
                    })
                    Promise.all(barsReady).then(bars=>{
                        common.devlog(bars)
                        let final = [];
                        orders.forEach(o=>{
                            o.barData = bars.filter(o => o.bar == bars.id)[0]
                            final.push(o)
                            
                        })
                        res.json(final.sort((a,b)=>b.createdAt._seconds < a.createdAt._seconds ? -1 : 1))

                    })
                }).catch(err=>{
                    console.log(err)
                })
        }
        case 'rate':{
            if(req.body.rating && typeof req.body.rating == 'number'){
                let oRef = barsOrders.doc(req.params.id)
                return oRef.get().then(o=>{
                    if(!o.exists) return res.sendStatus(404)
                    
                    o = o.data();
                    
                    if(+req.query.id != o.user) return res.json({success:false,comment: `Извините, но это не ваше посещение.`})
                    if(o.rated) return res.json({success:false,comment: `Вы уже оценили это посещение на ${o.rated} баллов.`})

                    udb.doc(o.user.toString()).get().then(u=>{
                        if(!u.exists) return res.json({success:false,comment: `Извините, но это не ваше посещение.`})
                        
                        u = u.data()
                        
                        oRef.update({
                            rated: req.body.rating
                        }).then(s=>{
                            res.json({success:true})

                            updateRating(o.bar)

                            log({
                                text:   `${uname(u,+req.query.id)} ставит бару оценку ${req.body.rating}`,
                                user:   +req.query.id,
                                bar:    o.bar
                            })
                        })
                    })
                     
                    
                })
            } else {
                return res.sendStatus(400)
            }
        }
        default:{
            res.sendStatus(404)
        }
    }
    
})



function isAdmin(id) {
    return udb.doc(id || 'noWay').get().then(a => {
        if (!a.exists) return false
        if (a.data().admin) return true
        return false
    }).catch(err => {
        return false
    })
}

router.post('/hook', (req, res) => {
    res.sendStatus(200)

    let user = {}

    common.devlog(JSON.stringify(req.body, null, 2))

    if (req.body.message) {
        user = req.body.message.from

        udb.doc(user.id.toString()).get().then(u => {
            if (!u.exists) registerUser(user)

            if (req.body.message.text) {
                messages.add({
                    user: user.id,
                    text: req.body.message.text || null,
                    createdAt: new Date(),
                    isReply: false
                })

                switch (req.body.message.text) {
                    
                    case '/test':
                        m.sendMessage2({
                            chat_id: user.id,
                            text: `Приложенька с дева`,
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: `test`,
                                        web_app: {
                                            url: `${process.env.ngrok}/${host}/app`
                                        }
                                    }]
                                ]
                            }
                        }, false, token)
                        break;
                    case '/pro':
                        m.sendMessage2({
                            chat_id: user.id,
                            text: `Привет, коллежка!`,
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: `test`,
                                        web_app: {
                                            url: `${process.env.ngrok}/${host}/admin`
                                        }
                                    }]
                                ]
                            }
                        }, false, token)
                        break;
                    
                    default:


                        if (req.body.message.text.indexOf('/start')) {

                            alertAdmins({
                                text: `${uname(u.data(),u.id)} пишет что-то странное: ${req.body.message.text}`,
                                type: 'incoming',
                                user_id: user.id
                            })
                        }

                        if(!req.body.message.text.indexOf(`/start barInvite`)){
                            let invite = req.body.message.text.split(`barInvite_`)[1]
                            iRef = barsInvites.doc(invite)
                            iRef.get().then(r=>{
                                if(!r.exists) return alertAdmins({
                                    text: `${common.sudden.sad()}: ${uname(req.body.message.from)} пытается хакнуть систему инвайтов.`
                                })
                                
                                r = r.data()

                                barsUsers
                                    .where(`bar`,'==',  r.bar)
                                    .where(`user`,'==', req.body.message.from.id)
                                    .get()
                                    .then(col=>{
                                        if(col.docs.length){
                                            m.sendMessage2({
                                                chat_id: req.body.message.from.id,
                                                text: `Вы уже зарегистрированы как представитель этой площадки.`
                                            })
                                        } else {
                                            barsUsers.add({
                                                active:     false,
                                                createdAt:  new Date(),
                                                user:       req.body.message.from.id,
                                                by:         r.by,
                                                bar:        r.bar
                                            })
            
                                            bars.doc(r.bar).get().then(bar=>{
                                                bar = bar.data();
                                                log({
                                                    text: `${uname(req.body.message.from)} становится представителем бара ${bar.name}`,
                                                    bar:  r.bar,
                                                    user: req.body.message.from.id
                                                })

                                                m.sendMessage2({
                                                    chat_id: req.body.message.from.id,
                                                    text: `Поздравляем! Теперь вы полномочный представитель заведения ${bar.name}.\nОткройте приложение: в шапке появится закладка "бары", через которую вы попадете в кабинет сотрудника.`
                                                })
                                            })
            
                                            setTimeout(function(){
                                                udb.doc(req.body.message.from.id.toString()).update({
                                                    bar: true
                                                })
                                            },2000)
                                        }
                                    })

                                
                                
                            })
                        }

                        break;
                }
            }

            if (req.body.message.photo) {
                udb.where('admin','==',true).get().then(col=>{
                    common.handleQuery(col).forEach(a=>{
                            m.sendMessage2({
                                chat_id: a.id,
                                caption: `фото от ${uname(u.data(),u.id)}`,
                                photo: req.body.message.photo[0].file_id
                            }, 'sendPhoto', token)
                        })
                })
            }

        }).catch(err => {
            console.log(err)
        })
    }

    if (req.body.callback_query) {
        user = req.body.callback_query.from;

        let inc = req.body.callback_query.data.split('_')

        common.devlog(inc)

        if (inc[0] == 'unsubscribe') {
            udb.doc(user.id.toString()).update({
                noSpam: true
            }).then(() => {
                m.sendMessage2({
                    callback_query_id: req.body.callback_query.id,
                    show_alert: true,
                    text: translations.unsubscribeMessage[user.language_code] || translations.unsubscribeMessage.en
                }, 'answerCallbackQuery', token)
            }).catch(err => {
                m.sendMessage2({
                    callback_query_id: req.body.callback_query.id,
                    show_alert: true,
                    text: err.message
                }, 'answerCallbackQuery', token)
            })
        }

        if (inc[0] == 'admin') {
            switch (inc[1]) {
                case 'log': {
                    console.log('обновления подписок', inc[2])
                    switch (inc[2]) {
                        case 'unsubscribe': {
                            isAdmin(user.id.toString()).then(proof => {

                                if (!proof) return m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Простите великодушно, но вы же не админ. Как вы вообще получили эту кнопку?..`
                                }, 'answerCallbackQuery', token)



                                udb.doc(user.id.toString()).update({
                                    stopLog: true
                                }).then(() => {

                                    m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        show_alert: true,
                                        text: `Вы отписаны от фоновых уведомлений.\nЧтобы вернуть их, нажмите на ту же кнопку.`
                                    }, 'answerCallbackQuery', token).then(() => {
                                        m.sendMessage2({
                                            chat_id: user.id,
                                            message_id: req.body.callback_query.message.message_id,
                                            reply_markup: {
                                                inline_keyboard: [
                                                    [{
                                                        text: 'Подписаться на обновления',
                                                        callback_data: `admin_log_subscribe`
                                                    }]
                                                ]
                                            }
                                        }, 'editMessageReplyMarkup', token)
                                    })

                                }).catch(err => {
                                    console.log(err)
                                })
                            }).catch(err => {
                                console.log(err)
                            })
                            break;
                        }
                        case 'subscribe': {
                            isAdmin(user.id.toString()).then(proof => {
                                if (!proof) return m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Простите великодушно, но вы же не админ. Как вы вообще получили эту кнопку?..`
                                }, 'answerCallbackQuery', token)
                                udb.doc(user.id.toString()).update({
                                    stopLog: false
                                }).then(() => {
                                    return m.sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        show_alert: true,
                                        text: `Вы подписались на  фоновые уведомления.\nЧтобы отключить их, нажмите на ту же кнопку.`
                                    }, 'answerCallbackQuery', token).then(() => {
                                        m.sendMessage2({
                                            chat_id: user.id,
                                            message_id: req.body.callback_query.message.message_id,
                                            reply_markup: {
                                                inline_keyboard: [
                                                    [{
                                                        text: 'Отписаться от обновлений',
                                                        callback_data: `admin_log_unsubscribe`
                                                    }]
                                                ]
                                            }
                                        }, 'editMessageReplyMarkup', token)
                                    })

                                })
                            })
                            break;
                        }

                        default:
                            break;

                    }
                    break;
                }
                default: {
                    break;
                }
            }
        }


        if (inc[0] == 'user') {
            isAdmin(user.id.toString()).then(proof => {
                if (!proof) return m.sendMessage2({
                    callback_query_id: req.body.callback_query.id,
                    show_alert: true,
                    text: `Простите великодушно, но вы же не админ. Как вы вообще получили эту кнопку?..`
                }, 'answerCallbackQuery', token)

                udb.doc(inc[2]).get().then(userdata => {

                    userdata = userdata.data();

                    switch (inc[1]) {
                        case 'block': {
                            udb.doc(inc[2]).update({
                                blocked: true,
                                updatedAt: new Date(),
                                updatedBy: +user.id
                            }).then(() => {

                                udb.doc(inc[2]).get().then(u => {
                                    let m = u.data()
                                    m.intention = `updateUser`;
                                    m.id = u.id
                                    axios.post(sheet, Object.keys(m).map(k => `${k}=${m[k]}`).join('&'), {
                                        headers: {
                                            "Content-Type": "application/x-www-form-urlencoded"
                                        }
                                    })
                                })

                                log({
                                    text: `Админ @${user.username} заблокировал пользователя ${uname(userdata,inc[2])}`,
                                    user: +inc[2],
                                    admin: user.id
                                })

                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Пользователь заблокирован.`
                                }, 'answerCallbackQuery', token)
                            })
                            break;
                        }

                        case 'fellow': {
                            udb.doc(inc[2]).update({
                                fellow: true,
                                updatedAt: new Date(),
                                updatedBy: +user.id
                            }).then(() => {


                                log({
                                    text: `Админ @${user.username} сделал пользователя ${uname(userdata,inc[2])} участником fellows`,
                                    user: +inc[2],
                                    admin: user.id
                                })

                                udb.doc(inc[2]).get().then(u => {
                                    let m = u.data()
                                    m.intention = `updateUser`;
                                    m.id = u.id
                                    axios.post(sheet, Object.keys(m).map(k => `${k}=${m[k]}`).join('&'), {
                                        headers: {
                                            "Content-Type": "application/x-www-form-urlencoded"
                                        }
                                    })
                                })

                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Пользователь отмечен как участник fellows.`
                                }, 'answerCallbackQuery', token)

                                m.sendMessage2({
                                    chat_id: inc[2],
                                    text: translations.fellow[userdata.language_code] || translations.fellow.en
                                }, false, token)
                            })
                            break;
                        }

                        case 'insider': {
                            udb.doc(inc[2]).update({
                                insider: true,
                                updatedAt: new Date(),
                                updatedBy: +user.id
                            }).then(() => {


                                log({
                                    text: `Админ @${user.username} сделал пользователя ${uname(userdata,inc[2])} сотрудником`,
                                    user: +inc[2],
                                    admin: user.id
                                })

                                udb.doc(inc[2]).get().then(u => {
                                    let m = u.data()
                                    m.intention = `updateUser`;
                                    m.id = u.id
                                    axios.post(sheet, Object.keys(m).map(k => `${k}=${m[k]}`).join('&'), {
                                        headers: {
                                            "Content-Type": "application/x-www-form-urlencoded"
                                        }
                                    })
                                })

                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Пользователь отмечен как сотрудник.`
                                }, 'answerCallbackQuery', token)
                                m.sendMessage2({
                                    chat_id: inc[2],
                                    text: translations.congrats[userdata.language_code] || translations.congrats.en
                                }, false, token)
                            })
                            break;
                        }
                        case 'admin': {
                            udb.doc(inc[2]).update({
                                admin: true,
                                updatedAt: new Date(),
                                updatedBy: +user.id
                            }).then(() => {

                                log({
                                    text: `Админ @${user.username} сделал пользователя ${uname(userdata,inc[2])} равным себе`,
                                    user: +inc[2],
                                    admin: user.id
                                })

                                udb.doc(inc[2]).get().then(u => {
                                    let m = u.data()
                                    m.intention = `updateUser`;
                                    m.id = u.id
                                    axios.post(sheet, Object.keys(m).map(k => `${k}=${m[k]}`).join('&'), {
                                        headers: {
                                            "Content-Type": "application/x-www-form-urlencoded"
                                        }
                                    })
                                })

                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Пользователь отмечен как админ.`
                                }, 'answerCallbackQuery', token)

                                m.sendMessage2({
                                    chat_id: inc[2],
                                    text: 'Поздравляем, вы зарегистрированы как админ приложения'
                                }, false, token)

                            })
                            break;
                        }
                        case 'bonus': {
                            udb.doc(inc[2]).update({
                                bonus: false,
                                updatedAt: new Date(),
                                updatedBy: +user.id
                            }).then(() => {
                                log({
                                    text: `Админ @${user.username} снимает бонус коворкинга с пользователя ${uname(userdata,inc[2])} равным себе`,
                                    user: +inc[2],
                                    admin: user.id
                                })
                            })
                            break;
                        }
                        default:
                            return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: translations.nosais[req.body.callback_query.from.language_code] || translations.nosais.en
                            }, 'answerCallbackQuery', token)
                    }
                })


            })
        }

        if(inc[0] == 'ticket'){

            common.devlog(`что-то про билеты`)

            common.devlog(user.id)

            isAdmin(user.id.toString()).then(proof => {
                


                if (!proof) return m.sendMessage2({
                    callback_query_id: req.body.callback_query.id,
                    show_alert: true,
                    text: `Простите великодушно, но вы же не админ. Как вы вообще получили эту кнопку?..`
                }, 'answerCallbackQuery', token)

                common.devlog(`это ззапрос от админа`)
                
                tickets.doc(inc[2]).get().then(t=>{
                    
                    t =  t.data();

                    common.devlog(t)

                    switch(inc[1]){
                        case 'payed':{
                            if(!t.active) return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: `Упс, билет уже деактивирован.`
                            }, 'answerCallbackQuery', token)

                            common.devlog(`не активен`)
        
                            if(t.payed) return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: `Этот билет уже оплачен!`
                            }, 'answerCallbackQuery', token)

                            common.devlog(`уже оплачен`)
                            
                            return tickets.doc(inc[2]).update({
                                payed: new Date()
                            }).then(s=>{

                                common.devlog(`оплатили`)
    
                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Отлично! Отправляю подтверждение гостю.`
                                }, 'answerCallbackQuery', token)

                                m.sendMessage2({
                                    chat_id:    t.user,
                                    photo:      `${ngrok}/${host}/qr?id=${inc[2]}&entity=tickets`,
                                    caption:    `${common.sudden.fine()}! Ваш билет оплачен! Пора по барам!` 
                                },'sendPhoto',token)
                            }).catch(err=>{
                                common.devlog(err)
                            })
                        }
                        case 'removed':{
                            if(!t.active) return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: `Упс, билет уже деактивирован.`
                            }, 'answerCallbackQuery', token)
                            
                            return tickets.doc(inc[2]).update({
                                active: false
                            }).then(s=>{
    
                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Roger that!`
                                }, 'answerCallbackQuery', token)
                            })
                        }
                    }

                    


                })

                switch (inc[1]){
                    
                    case 'payed':{
                        
                    }

                }

            }).catch(err=>{
                common.devlog(`ошибка определения админства`)
            })
        }

        if(inc[0] == 'feedback'){
            // m.sendMessage2({
            //     callback_query_id: req.body.callback_query.id,
            //     text: `on it`
            // }, 'answerCallbackQuery', token)

            switch(inc[1]){
                case 'ticket':{
                    userClasses.doc(inc[2]).get().then(c=>{
                        let ticket = c.data();

                        if(c.exists){
                            if(ticket.user == user.id){
                                userClasses.doc(inc[2]).update({
                                    rate: +inc[3]
                                })
                                // alertAdmins({
                                //     text: `${ticket.userName} ставит мероприятию ${ticket.className} оценку ${inc[3]}`
                                // })
                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    text: translations.thanks[user.language_code] || translations.thanks.en,
                                    show_alert: true,
                                }, 'answerCallbackQuery', token)
                            } else {
                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    text: translations.notYourTicket[user.language_code] || translations.notYourTicket.en,
                                    show_alert: true,
                                }, 'answerCallbackQuery', token)    
                            }
                        } else {
                            m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                text: translations.noTicket[user.language_code] || translations.noTicket.en,
                                show_alert: true,
                            }, 'answerCallbackQuery', token)
                        }
                    })
                }
            }
        }
    }
})


let users = {}


const translations = {
    notYourTicket: {
        ru: `Извините, но это не ваш билет.`,
        en: `Sorry, but that's not your ticket.`
    },
    noTicket: {
        ru: `Извините, такого билета не существует.`,
        en: `Sorry, there's no such ticket.`
    },
    thanks:{
        ru: `Спасибо!`,
        en: `Thank you!`
    },
    spareTicket:(name)=>{
        return {
            ru: `Кажется, вы хотели сходить на мероприятие «${name}», но не хватило мест?\nХорошие новости: билет как раз освободился.`,
            en: `Looks like you wanted to attent ${name}, but we've run out of spare seats. Good news: a ticket had just been spared.`
        }
    },
    planConfirmed:(plan)=>{
        return {
            ru: `Поздравляем! Вы оформили подписку на план ${plan.name}. Он будет действовать в течение ${plan.days} дней.`,
            en: `Congratulations! You've bought a plan for ${plan.visits} visits and ${plan.events}. Feel free to use it in the next ${plan.days} days.`
        }
    },
    feedBackRequest:(ticket)=>{
        return {
            ru: `Здравствуйте! Как вам наше мероприятие (${ticket.className})? Поставьте оценку (это вполне анонимно).`,
            en: `Hello! Please, rate the event (${ticket.className}).`
        }
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
        ru: `Добро пожаловать! Ваш билет был принят.\nЕсли произошла ошибка и вы не находитесь в ${host}, пожалуйста, напишите об этом.\nВопросы лектору (или организаторам) вы можете задать через приложение, на странице мероприятия.`,
        en: `Glad to see you on premise.\nIf there's been a mistake and you are not in ${host} Space right now, please, write about immediately.`
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
        ru: 'Афиша мероприятий',
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
        ru: 'Поздравляем, вы зарегистрированы как сотрудник ${host}',
        ka: 'გილოცავთ, თქვენ დარეგისტრირდით როგორც ${host}-ის თანამშრომელი'
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
        ru: `Приветствуем тебя, отважный испытатель. На себе обычно не показывают, но мы — постараемся...`,
        en: `Welcome, welcome, welcome`
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
        ru: 'Простите, но свободных мест не осталось. Мы напишем, если они появятся.',
        en: `We are sorry — no seats lefts. We'll let you know if a spare ticket shows up.`
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

function registerUser(u) {

    u.createdAt = new Date();
    u.active = true;
    u.blocked = false;

    users[u.id] = u;

    axios.post(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
        "chat_id": u.id,
        "menu_button": {
            "type": "web_app",
            "text": translations.app[u.language_code] || translations.app.en,
            "web_app": {
                "url": "https://api-bot.restorating.ru/"+host+"/app"
            }
        }
    })

    udb.doc(u.id.toString()).set(u).then(() => {

        m.sendMessage2({
            chat_id: u.id,
            text: translations.intro[u.language_code] || translations.intro.en,
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: translations.introButton[u.language_code] || translations.introButton.en,
                        web_app: {
                            url: process.env.ngrok + '/'+host+'/app?lang=' + u.language_code
                        }
                    }]
                ]
            }
        }, false, token)

   

        udb.get().then(col=>{

            

            alertAdmins({
                type:       'newUser',
                text:       `Новый пользователь бота (№${col.docs.length}):\n${JSON.stringify(u,null,2)}`,
                user_id:    u.id
            })

            if(col.docs.length<101){
                setAchievement(MExa9eqoJh4ieFRT2SUh,u.id)
            }
        })

        

    }).catch(err => {
        console.log(err)
    })
}


function alertAdmins(mess) {
    let message = {
        text: mess.text
    }


    if(mess.type == 'newUser'){
        message.reply_markup = {
            inline_keyboard: [
                [{
                    text: 'Заблокировать',
                    callback_data: `user_block_${mess.user_id}`
                }],
                [{
                    text: `Сделать барменом`,
                    callback_data: `user_fellow_${mess.user_id}`
                }],
                [{
                    text: `Сделать админом`,
                    callback_data: `user_admin_${mess.user_id}`
                }]
            ]
        }
    }

    if(mess.type == `newTicket`){
        message.reply_markup = {
            inline_keyboard: [
                [{
                    text: 'Отметить оплаченным',
                    callback_data: `ticket_payed_${mess.ticket}`
                }],
                [{
                    text: `Снять билет`,
                    callback_data: `ticket_remove_${mess.ticket}`
                }]
            ]
        }
    }

    udb.where(`admin`, '==', true).get().then(admins => {
        admins.docs.forEach(a => {
            message.chat_id = a.id
            if (mess.type != 'stopLog' || !a.data().stopLog) m.sendMessage2(message, false, token)
        })
    })
}



module.exports = router;