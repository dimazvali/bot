var express =   require('express');
var router =    express.Router();
var axios =     require('axios');
var cors =      require('cors')
var sha256 =    require('sha256');
var common =    require('./common');
const m =       require('./methods.js');
var QRCode =    require('qrcode')
var cron =      require('node-cron');
var FormData =  require('form-data');
const host =    `auditoria`

let devlog =    common.devlog

const { createHash,createHmac } = require('node:crypto');

var mail =          require('nodemailer')

let transporter = mail.createTransport({
    service: 'Yandex', // no need to set host or port etc.
    auth: {
        // user: 'lena.zateeva@club-show.com',
        user:       'vapeclub.show',
        // pass: 'ujfjuqfwibzyeitj'
        pass:       'bgvjkomhqmdcijks'
        // 'A#jsIHR7'
    }
});



router.use(cors())
router.use(express.json({limit:'10mb'}));

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
    query
} = require('express');
const {
    factchecktools_v1alpha1
} = require('googleapis');
const {
    sendAt
} = require('cron');
const e = require('express');
const { ChangeFreqInvalidError } = require('sitemap');



let gcp = initializeApp({
    credential: cert({
        "type": "service_account",
        "project_id": "auditorium-7e39d",
        "private_key_id": "fca76d09dd1f013f49a8d8e356abe2d769fa600a",
        "private_key": process.env.auGCPkey.replace(/\\n/g, '\n'),
        "client_email": "firebase-adminsdk-gq1zl@auditorium-7e39d.iam.gserviceaccount.com",
        "client_id": "103448403464129922999",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-gq1zl%40auditorium-7e39d.iam.gserviceaccount.com"
    }),
    databaseURL: "https://rrspecialsapi.firebaseio.com"
}, 'auditoria');
let fb = getFirestore(gcp);

let channelLink = 'https://t.me/+yDUeXnlR2r4yMzUy'
let channel_id = -1002067678991

let appLink = `https://t.me/AuditoraBot/app`

let token = process.env.auditoriaToken
let paymentToken = process.env.auPaymentToken

const ngrok = process.env.ngrok

let sheet = process.env.auditoriaSheet

axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/auditoria/hook`).then(s=>{
    console.log(`auditoria hook set to ${ngrok}`)
})

let getDoc = common.getDoc;



// axios.post(`${sheet}?intention=getCategories`).then(s=>{
//     common.devlog(`categories initiated`)
// }).catch(err=>{
//     common.devlog(err)
// })

// axios.post(`${sheet}?intention=getDishes`).then(s=>{
//     common.devlog(`dishes initiated`)
// }).catch(err=>{
//     common.devlog(err)
// })

let menuCategories = []
let menuDishes = [];



function refreshMenu(){
    let updates = []

    updates.push(axios.get(`https://joinposter.com/api/menu.getCategories?token=658416:0542557d20b40805925cc4a52c0cfe49`).then(d=>{
        menuCategories = d.data.response.filter(c=>c.visible && c.visible[0].visible)
        return true
    }))

    updates.push(axios.get(`https://joinposter.com/api/menu.getProducts?token=658416:0542557d20b40805925cc4a52c0cfe49`).then(d=>{
        menuDishes = d.data.response
        return true
    }))

    Promise.all(updates).then(s=>{
        return true;
    }).catch(err=>{
        return false;
    })
}

refreshMenu()





let udb =                       fb.collection('users');
let messages =                  fb.collection('userMessages');
let admins =                    fb.collection('admins');
let halls =                     fb.collection(`halls`);
let classes =                   fb.collection(`classes`);
let userClasses =               fb.collection(`userClasses`);
let bookings =                  fb.collection(`bookings`);
let coworking =                 fb.collection(`coworking`);
let mra =                       fb.collection(`meetingRoom`);
let logs =                      fb.collection('logs');
let userEntries =               fb.collection('userEntries');
let authors =                   fb.collection('authors');
let courses =                   fb.collection('courses');
let subscriptions =             fb.collection(`subscriptions`);
let news =                      fb.collection('news');
let plans =                     fb.collection('plans')
let views =                     fb.collection('views')
let streams =                   fb.collection('streams')
let classAlerts =               fb.collection(`classAlerts`)
let userClassesQ =              fb.collection(`userClassesQ`)
let plansRequests =             fb.collection(`plansRequests`);
let plansUsers =                fb.collection(`plansUsers`)
let adminTokens =               fb.collection(`adminTokens`)
let banks =                     fb.collection(`banks`)
let channelStats =              fb.collection(`channelStats`)
let subscriptionsEmail =        fb.collection(`subscriptionsEmail`)

if (!process.env.develop) {
    
    cron.schedule(`0 10 * * *`, () => {
        refreshMenu()
        common.getNewUsers(udb, 1).then(newcomers => {
            if(newcomers.length){
                log({
                    text: `Новых пользователей за сутки: ${newcomers}`
                })
            }
        })
        checkChannel()

    })

    cron.schedule(`0 11 * * 1`, () => {
        if(newcomers.length) common.getNewUsers(udb, 7).then(newcomers => {
            log({
                text: `Новых пользователей за неделю: ${newcomers}`
            })
        })
    })

    cron.schedule(`0 11 1 * *`, () => {
        if(newcomers.length) common.getNewUsers(udb, 7).then(newcomers => {
            log({
                text: `Новых пользователей за месяц: ${newcomers}`
            })
        })
    })

    cron.schedule(`0 9 * * *`, () => {
        alertSoonCoworking()
    })

    cron.schedule(`0 15 * * *`, () => {
        alertSoonClasses()
    })
}

router.get('/app', (req, res) => {
    res.render('auditoria/app', {
        user: req.query.id,
        start: req.query.start,
        translations: translations
    })
})

router.get('/app2', (req, res) => {
    res.render('auditoria/app2', {
        user: req.query.id,
        start: req.query.start,
        translations: translations
    })
})

const sections ={
    classes:    classes,
    authors:    authors,
    courses:    courses,
    plans:      plans
}

const sectionsMeta = {
    mp:{
        title: `Auditoria Books&Bar Tbilisi`,
        description: `Креативное пространство на Симона Джанашиа, 26`
    },
    classes:{
        title: `Лекции`,
        description: `Мероприятия на любой вкус и цвет.`
    },
    authors: {
        title: `Авторы`,
        description: `Вы нас даже не представляете.`
    },
    courses: {
        title: `Курсы`,
        description: `Давайте встречаться чаще`
    },
    bar:{
        title: `Меню и счет`,
        description: `Съесть вопрос...`
    },
    plans:{
        title: `Подписки`,
        description: `Оптом — дешевле`
    }
}

router.get(`/site/:city`,(req,res)=>{
    if(req.params.city !== `tbi`) return res.sendStatus(404)
    classes
        .where(`active`,'==',true)
        .where(`date`,'>=',new Date())
        .limit(5)
        .get()
        .then(col=>{
            res.render(`auditoria/inst`,{
                title: sectionsMeta.mp.title,
                description: sectionsMeta.mp.description,
                classes: common.handleQuery(col),
                randomPic: ()=> randomPic(),
                city: req.params.city
            })
            views.add({
                createdAt:  new Date(),
                user:       `web`,
                entity:     `mp`
            })
        })
})

router.get(`/site/:city/:section`,(req,res)=>{
    if(req.params.city !== `tbi`) return res.sendStatus(404)
    if(sections[req.params.section]){
        sections[req.params.section]
            .where(`active`,'==',true)
            .get()
            .then(col=>{
                let d = common.handleQuery(col)
                if(req.params.section == `classes`){
                    d = d.sort((a,b)=>a.date._seconds-b.date._seconds)
                } else {
                    d = d.sort((a,b)=>(b.views||0)-(a.views||0))
                }
                res.render(`auditoria/${req.params.section}`,{
                    section: req.params.section,
                    data: d,
                    title: sectionsMeta[req.params.section].title+ ' | Auditoria Books&Bar Tbilisi',
                    description: sectionsMeta[req.params.section].description,
                    randomPic: ()=> randomPic(),
                    randomStyle:()=>randomStyle(),
                    city: req.params.city
                })
        })
    } else if(req.params.section == `bar`){
        
        res.render(`auditoria/${req.params.section}`,{
            section: req.params.section,
            data: {
                categories: menuCategories,
                dishes: menuDishes
            },
            stopList: [
                `Coworking`,
                `Staff only`,
                'Events',
                `Bag shop (Max Sharoff)`,
                'Exhibition '
            ],
            title: sectionsMeta[req.params.section].title + ' | Auditoria Books&Bar Tbilisi',
            description: sectionsMeta[req.params.section].description,
            randomPic: ()=> randomPic(),
            cur: (v,c)=>common.cur(v,c),
            drawDate:(d)=>   common.drawDate(d),
            randomStyle:()=>randomStyle(),
            city: req.params.city
        })   
    } else {
        res.sendStatus(404)
    }
})


function randomStyle(){
    let random = Math.floor(Math.random()*100)
    let bl = 100-random;
    let br = Math.floor(Math.random()*100)
    let tr = 100-br
    return `border-top-left-radius: ${random}%;border-bottom-left-radius: ${bl}%;border-top-right-radius: ${tr}%;border-bottom-right-radius: ${br}%;`
    
}


router.get(`/site/:city/:section/:id`,(req,res)=>{
    if(req.params.city !== `tbi`) return res.sendStatus(404)
    if(sections[req.params.section]){
        getDoc(sections[req.params.section],req.params.id).then(d=>{
            
            views.add({
                createdAt: new Date(),
                entity: req.params.section,
                id:     req.params.id,
                user:   `web`
            })

            try {
                sections[req.params.section].doc(req.params.id).update({
                    views: FieldValue.increment(+1)
                })
            } catch (error) {
                
            }

            if(req.params.section == `authors`){
                return classes
                    .where(`active`,'==',true)
                    .where(`authorId`,'==',req.params.id)
                    .where(`date`,'>=',new Date())
                    .get()
                    .then(classes=>{
                        d.classes = common.handleQuery(classes)
                        devlog(d)

                        res.render(`auditoria/${req.params.section}Item`,{
                            title: (d.name +' | '+sectionsMeta[req.params.section].title + '| Auditoria Books&Bar'),
                            description: d.description,
                            section: req.params.section,
                            data: d,
                            randomPic: ()=> randomPic(),
                            cur: (v,c)=>common.cur(v,c),
                            drawDate:(d)=>   common.drawDate(d),
                            city: req.params.city
                        })
                    })
            }

            if(req.params.section == `classes`){
                let course = null;
                if(d.courseId) course = getDoc(courses,d.courseId)
                return Promise.resolve(course).then(course=>{
                    d.planId = course ? course.planId : null;
                    d.plan = course ? course.plan :null;
                    res.render(`auditoria/${req.params.section}Item`,{
                        section: req.params.section,
                        data: d,
                        title: (d.name +' | '+sectionsMeta[req.params.section].title + '| Auditoria Books&Bar'),
                        description: d.description,
                        randomPic: ()=> randomPic(),
                        cur: (v,c)=>common.cur(v,c),
                        drawDate:(d)=>   common.drawDate(d),
                        city: req.params.city
                    })

                })
                
            }

            res.render(`auditoria/${req.params.section}Item`,{
                section: req.params.section,
                data: d,
                title: (d.name +' | '+sectionsMeta[req.params.section].title + '| Auditoria Books&Bar'),
                description: d.description,
                randomPic: ()=> randomPic(),
                cur: (v,c)=>common.cur(v,c),
                drawDate:(d)=>   common.drawDate(d),
                city: req.params.city
            })
        })
    } else if(req.params.section == `tickets`){
        devlog(`билетики`)
        getDoc(userClasses,req.params.id).then(t=>{
            if(!t) return res.sendStatus(404)
            getDoc(classes,t.class).then(cl=>{
                devlog(cl)
                return res.render(`auditoria/ticket`,{
                    ticket: t,
                    cl:  cl,
                    city: req.params.city,
                    randomPic:()=>randomPic(),
                    drawDate:(d)=>   common.drawDate(d),
                    cur: (v,c)=>common.cur(v,c),
                })
            })
        })
    } else {
        res.sendStatus(404)
    }
})

router.get('/admin', (req, res) => {
    res.render('auditoria/admin', {
        user: req.query.id,
        start: req.query.start,
        translations: translations
    })
})

function interprete(field, value) {
    switch (field) {
        case 'admin': {
            return value ? `делает админом` : `снимает админство с`
        }
        case 'insider':
            return value ? `делает сотрудником` : `убирает из сотрудников`
        case 'blocked':
            return value ? `добавляет в ЧС` : `убирает из бана`
        default:
            return `делает что-то необычно: поле ${field} становится ${value}`
    }
}

function checkChannel(){
    let today = new Date().toISOString().split('T')[0]
    let yesterday = new Date(+new Date()-24*60*60*1000).toISOString().split('T')[0]
    axios.get(`https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=@auditoria_tbilisi`).then(data=>{
        channelStats.doc(today).set({
            views: data.data.result
        })
        getDoc(channelStats,yesterday).then(b=>{
            if(!b) b = {views:0}
            log({
                text: `Количество подписчиков у канала: ${data.data.result}; Прирост к прошлому дню: ${data.data.result-b.views}`
            })
        })

    })
}

router.get(`/web`,(req,res)=>{
    if(process.env.develop == `true`) return logs
        .orderBy(`createdAt`,'desc')
        .limit(100)
        .get()
        .then(col=>{
            res.cookie('adminToken', process.env.adminToken, {
                maxAge: 24 * 60 * 60 * 1000,
                signed: true,
                httpOnly: true,
            }).render(`${host}/web`,{
                logs: common.handleQuery(col),
                // token: req.signedCookies.adminToken
            })
        }) 

    if(!req.signedCookies.adminToken) return res.redirect(`${ngrok}/auditoria/auth`)
    
    adminTokens
        .doc(req.signedCookies.adminToken)
        .get()
        .then(data=>{
            if(!data.exists) res.sendStatus(403)
            if(data.data().active){
                logs
                    .orderBy(`createdAt`,'desc')
                    .limit(100)
                    .get()
                    .then(col=>{
                        res.render(`${host}/web`,{
                            logs: common.handleQuery(col),
                            // token: req.signedCookies.adminToken
                        })
                    })
                

            }
        })
})

router.get(`/auth`,(req,res)=>{
    res.render(`${host}/auth`)
})

router.post(`/auth`,(req,res)=>{
    
    console.log(Object.keys(req.body).sort())

    data_check_string=Object.keys(req.body)
        .filter(key => key !== 'hash')
        .sort()
        .map(key=>`${key}=${req.body[key]}`)
        .join('\n')

        devlog(data_check_string)

    const secretKey = createHash('sha256')
        .update(token)
        .digest();

    const hmac = createHmac('sha256', secretKey)
        .update(data_check_string)
        .digest('hex');

        devlog(req.body.hash)
        devlog(hmac)

    if(req.body.hash == hmac){

        isAdmin(req.body.id.toString())
            .then(s=>{
                
                if(!s) return res.sendStatus(403)
                
                adminTokens.add({
                    createdAt:  new Date(),
                    user:       +req.body.id,
                    active: true 
                }).then(c=>{
                    res.cookie('adminToken', c.id, {
                        maxAge: 24 * 60 * 60 * 1000,
                        signed: true,
                        httpOnly: true,
                    }).sendStatus(200)
                })
            })

        // res.sendStatus(200)
    } else {
        res.sendStatus(403)
    }
})


router.all(`/admin/:method`, (req, res) => {

    if (!req.query.id && !req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    
    if(!req.query.id) req.query.id = adminTokens.doc(req.signedCookies.adminToken).get().then(doc=>{
        if(!doc.exists) return false
        doc = common.handleDoc(doc)
        if(!doc.active) return false
        return doc.user
    })

    Promise.resolve(req.query.id).then(adminId=>{
        if(!adminId) return res.sendStatus(403)
        
        req.query.id = adminId.toString()

        udb.doc(req.query.id).get().then(user => {
            if (!req.query.id) return res.status(401).send(`Вы кто вообще?`)
            udb.doc(req.query.id).get().then(user => {
                if (!user.exists) return res.status(401).send(`Вы кто вообще?`)
                user = common.handleDoc(user);
                if (!user.admin) return res.status(403).send(`Вам сюда нельзя`)
                switch (req.params.method) {
                    case `plans`:{
                        switch(req.method){
                            case 'GET':{
                                return plans.get().then(col=>res.json(common.handleQuery(col)))
                            }
                            case 'POST':{
                                if(req.body.name && req.body.price){
                                    return plans.add({
                                        active:     true,
                                        createdAt:  new Date(),
                                        createdBy:  user.id,
                                        name:       req.body.name,
                                        description: req.body.description,
                                        price:      +req.body.price,
                                        visits:     +req.body.visits
                                    }).then(s=>{
                                        log({
                                            silent: true,
                                            text: `${common.uname(user,user.id)} создает новую подписку ${req.body.name}.`,
                                            plan: s.id
                                        })
                                        res.sendStatus(200)
                                    })
                                } else {
                                    return res.sendStatus(400)
                                }
                                
                            }
                        }
                        
                    }
                    case `views`:{
                        return views.get().then(col=>res.json(col.docs.map(d=>d.data())))
                    }
                    case `channel`:{
                        return classes.doc(req.query.class).get().then(c=>{
                            if(!c.exists) return res.sendStatus(404)
                            let lang = `ru`
                            let h = c.data();
                            let kbd = [
                                [{
                                    text: `Подробнее`,
                                    url: `${appLink}?startapp=class_${req.query.class}`
                                    // web_app:{
                                    //     url: `${ngrok}/${host}/app2?start=class_${req.query.class}`
                                    // }
                                }],[{
                                    text: translations.book[lang] || translations.book.en,
                                    callback_data: 'class_' + req.query.class
                                }]
                            ]
                            let message = {
                                chat_id: channel_id,
                                text: classDescription(h,'ru'),
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
                            m.sendMessage2(message, (h.pic ? 'sendPhoto' : false), token)
                            res.json({success:true})
                        })
                    }
                    case `issue`:{
                        if(!req.body.name || !req.body.lecture) return res.status(400).send(`name or class is missing`)

                        return classes.doc(req.body.lecture).get().then(c=>{
                            if(!c.exists) return res.sendStatus(404)
                            c = c.data()
                            userClasses.add({
                                class:      req.body.lecture,
                                className:  c.name,
                                createdAt:  new Date(),
                                active:     true,
                                isPayed:    req.body.isPayed,
                                admin:      +req.query.id,
                                userName:   req.body.name,
                                outsider:   true
                            }).then(rec=>{
                                res.send(rec.id)
                            }).catch(err=>{
                                res.status(500).send(err.message)
                            })    
                        }).catch(err=>{
                            console.log(classes)
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
                        if (inc[1] == `planRequests`) {

                            switch(req.method){
                                case 'GET':{
                                    return plansRequests.doc(inc[0]).get().then(r=>{
                                        let data = [];
                                        if(!r.exists) return res.status(500).send(`Такой заявки нет в базе данных`)
                                        r = r.data();
                                        data.push(m.getUser(r.user,udb).then(u=>u))
                                        data.push(plans.doc(r.plan).get().then(p=>p.data()))
                                        Promise.all(data).then(data=>{
                                            common.devlog(JSON.stringify({
                                                data:{
                                                    user: data[0],
                                                    plan: data[1]
                                                }
                                                
                                            }))
                                            res.json({
                                                data:{
                                                    user: data[0],
                                                    plan: data[1]
                                                }
                                                
                                            })
                                        })
                                    }).catch(err=>{
                                        console.log(err)
                                        res.status(500).send(err.message)
                                    })

                                    break;
                                }
                                case 'POST':{
                                    return plansRequests.doc(inc[0]).get().then(r=>{
                                        if(!r.exists) return res.status(500).send(`Такой заявки нет в базе данных`)
                                        r = r.data();
                                        plans.doc(r.plan).get().then(p=>{
                                            p = p.data()

                                            common.devlog({
                                                user:       r.user,
                                                createdAt:  new Date(),
                                                to:         new Date(+new Date()+p.days*24*60*60*1000),
                                                visitsLeft: p.visits || 0,
                                                eventsLeft: p.events  || 0,
                                                createdBy:  +req.query.id,
                                                name:       p.name,
                                                active:     true,
                                                plan:       r.plan
                                            })
                                            
                                            plansUsers.add({
                                                user:       r.user,
                                                createdAt:  new Date(),
                                                to:         new Date(+new Date()+p.days*24*60*60*1000),
                                                visitsLeft: p.visits  || 0,
                                                eventsLeft: p.events  || 0,
                                                createdBy:  +req.query.id,
                                                name:       p.name,
                                                active:     true,
                                                plan:       r.plan
                                            }).then(()=>{
                                                m.getUser(r.user,udb).then(user=>{
                                                    m.sendMessage2({
                                                        chat_id: r.user,
                                                        text: translations.planConfirmed(p)[user.language_code] || translations.planConfirmed(p).en
                                                    },false,token)
                                                    log({
                                                        text: `Админ @id${req.query.id} выдает подписку «${p.name}» (${common.cur(p.price,'GEL')}) пользователю ${common.uname(user,r.user)}`,
                                                        admin: +req.query.id,
                                                        user:   r.user,
                                                        silent: true
                                                    })
                
                                                    res.sendStatus(200)
                
                                                })
                
                                                
                                            })
                                        })
                                        
                                    })
                                }
                            }
                            
                        } else {
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
                                    return fb.collection(inc[1])
                                        .doc(inc[0])
                                        .update({
                                            status: 'used',
                                            updatedAt: new Date(),
                                            statusBy: req.query.id
                                        }).then(d => {
                                            res.sendStatus(200)
                                        })
                                }
                            }
                        }
                        
                        


                    }
                    case `q`:{
                        if(!req.query.class) return res.status(400).send(`no class provided`)
                        return userClassesQ
                            .where(`active`,'==',true)
                            .get()
                            .then(col=>{
                                res.json(common.handleQuery(col))
                            })
                    }
                    case `announce`:{
                        devlog(req.body)
                        let list = userClasses.where(`class`,`==`,req.body.class);
                        if(req.body.type == `all`) list = list.where('active', '==', true)
                        if(req.body.type == `inside`) list = list.where('status', '==', `used`)
                        if(req.body.type == `outside`) list = list.where('status', '!=', `used`)
                        
                        return list.get()
                        .then(tickets=>{
                            common.handleQuery(tickets).forEach(t=>{
                                
                                devlog(t);
    
                                m.sendMessage2({
                                    chat_id: t.user,
                                    text: req.body.text,
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{
                                                text: `Открыть`,
                                                web_app: {
                                                    url: ngrok + '/'+host+'/app2/start=class_'+req.body.class
                                                }
                                            }]
                                        ]
                                    }
                                }, false, token)
                            })
                            res.sendStatus(200)
                        })
                        .catch(handleError)
                    }
                    case 'message': {
                        if (req.body.text && req.body.user) {
                            return m.sendMessage2({
                                    chat_id: req.body.user,
                                    text: req.body.text
                                }, false, token)
                                .then(() => {
                                    res.json({
                                        success: true
                                    })

                                    messages.add({
                                        user: +req.body.user,
                                        text: req.body.text,
                                        createdAt: new Date(),
                                        isReply: true
                                    })

                                }).catch(err => {
                                    res.json({
                                        success: false
                                    })
                                })
                        } else {
                            return res.sendStatus(400)
                        }
                    }
                    case 'check': {
                        return res.json(user)
                    }
                    case 'classes': {
                        switch (req.method){
                            case `GET`:{
                                let nclasses = classes.where('active', '==', true)
                                if(req.query.filter == `future`) nclasses = nclasses.where(`date`,'>=',new Date(+new Date()-3*60*60*1000))
                                return nclasses.orderBy('date', req.query.filter ? 'asc' : 'desc')
                                    .limit(50)
                                    .get()
                                    .then(col => {
                                        res.json(common.handleQuery(col))
                                    })
                            }
                            case `POST`:{
                                return classes.add({
                                    active:     true,
                                    createdAt:  new Date(),
                                    createdBy:  +req.query.id,
                                    name:       req.body.name || null,
                                    descShort:  req.body.descShort || null,
                                    descLong:   req.body.descLong || null,
                                    authorId:   req.body.authorId || null,
                                    courseId:   req.body.courseId || null,
                                    kids:       req.body.kids || null,
                                    age:        req.body.age || null,
                                    pic:        req.body.pic || null,
                                    price:      req.body.price || null,
                                    price2:     req.body.price2 || null,
                                    price3:     req.body.price3 || null,
                                    date:       new Date(req.body.date)
                                }).then(s=>{
                                    res.json({success:true})
                                    log({
                                        silent: true,
                                        text: `${common.uname(user,user.id)} создает новое мероприятие ${req.body.name}`,
                                        class: s.id,
                                        admin: user.id
                                    })
                                    if(req.body.authorId){
                                        getDoc(authors,req.body.authorId).then(a=>{
                                            if(a) classes.doc(s.id).update({
                                                author: a.name
                                            }).then(s=>{
                                                getDoc(classes,s.id).then(cl=>{
                                                    subscriptions
                                                    .where(`author`,'==',req.body.authorId)
                                                    .where(`active`,'==',true)
                                                    .get()
                                                    .then(col=>{
                                                        
                                                        common.handleQuery(col).forEach((subscription,i)=>{
                                                            setTimeout(function(){
                                                                m.getUser(subscription.user,udb).then(u=>{
                                                                    alertClass(cl,cl.id,u)
                                                                })    
                                                            },i*200)
                                                        })

                                                    })
                                                })
                                            })
                                        })
                                    }
                                    if(req.body.bankId){
                                        getDoc(banks,req.body.bankId).then(b=>{
                                            if(b) classes.doc(s.id).update({
                                                bankId:         b.id,
                                                bankCreds:      b.creds,
                                                paymentDesc:    b.creds
                                            })
                                        })
                                    }
                                    if(req.body.courseId){
                                        getDoc(courses,req.body.courseId).then(a=>{
                                            if(a) classes.doc(s.id).update({
                                                course: a.name
                                            }).then(s=>{
                                                getDoc(`classes`,s.id).then(cl=>{
                                                    subscriptions
                                                    .where(`course`,'==',req.body.courseId)
                                                    .where(`active`,'==',true)
                                                    .get()
                                                    .then(col=>{
                                                        common.handleQuery(col).forEach((subscription,i)=>{
                                                            setTimeout(function(){
                                                                m.getUser(subscription.user,udb).then(u=>{
                                                                    alertClass(cl,cl.id,u)
                                                                })    
                                                            },i*200)
                                                        })

                                                    })
                                                })
                                            })
                                        })
                                    }
                                })
                            }
                        }
                        
                    }
                    case 'class': {
                        if (!req.query.class) return res.sendStatus(404)
                        return userClasses
                            .where('active', '==', true)
                            .where('class', '==', req.query.class)
                            .get()
                            .then(col => {
                                res.json(common.handleQuery(col))
                            })
                    }
                    case 'user': {

                        if (!req.query.user) return res.sendStatus(404)

                        switch (req.query.data) {
                            case 'subscriptions': {
                                return subscriptions
                                    .where('user', '==', +req.query.user)
                                    .orderBy('createdAt', 'DESC')
                                    .get()
                                    .then(col => {
                                        res.json(common.handleQuery(col))
                                    })
                            }
                            case 'messages': {
                                return messages
                                    .where('user', '==', +req.query.user)
                                    .orderBy('createdAt', 'DESC')
                                    .get()
                                    .then(col => {
                                        res.json(common.handleQuery(col))
                                    })
                            }
                            case 'lections': {
                                return userClasses
                                    .where('user', '==', +req.query.user)
                                    .where('active', '==', true)
                                    .orderBy('createdAt', 'DESC')
                                    .get()
                                    .then(col => {
                                        res.json(common.handleQuery(col))
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
                    case 'alertClass':{
                        let list = userClasses
                            .where(`class`,'==',req.body.class)
                            .where(`active`,'==',true)
                        if(req.body.filter == `used`) list =list.where('status','==','used')
                        if(req.body.filter == `late`) list =list.where('status','!=','used')
                        return list.get().then(col=>{

                            classAlerts.add({
                                createdAt:  new Date(),
                                text:       req.body.text,
                                by:         +req.query.id,
                                credit:     common.uname(user, user.id)
                            })
                            
                            common.handleQuery(col).forEach((t,i)=>{
                                setTimeout(function(){
                                    m.sendMessage2({
                                        chat_id: t.user,
                                        text: req.body.text,
                                        reply_markup:{
                                            inline_keyboard:[[{
                                                text: `Ваш билет`,
                                                web_app:{
                                                    url: `${ngrok}/auditoria/app2?start=ticket_${t.id}`
                                                }
                                            }]]
                                        }
                                    },false,token,messages)
                                },i*100)
                            })

                            res.send(`Ваше сообщение расходится на ${col.docs.length} пользователей.`)
                        })
                        
                    }
                    case `requestFeedBack`:{

                        return classes.doc(req.body.class).get().then(c=>{
                            if(!c.exists) return res.sendStatus(404)

                            c = c.data()
                            userClasses
                                .where(`class`,'==',req.body.class)
                                .where(`active`,'==',true)
                                .get()
                                .then(col=>{
                                    
                                    common.handleQuery(col).forEach((ticket,i)=>{
                                        setTimeout(function(){
                                            m.sendMessage2({
                                                chat_id: ticket.user,
                                                text: `Здравствуйте! Как вам наше мероприятие (${ticket.className})? Поставьте оценку (это вполне анонимно).`,
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
                                        },i*100)
                                    })
                                    classes.doc(req.body.class).update({
                                        asked: new Date()
                                    })
                                    res.send(`ok`)
                                })
                        })

                        
                    }
                    case `ticket`:{
                        common.devlog(`манипуляция с билетом`)
                        switch (req.method){
                            case `GET`:{
                                return userClasses.doc(req.query.ticket).get().then(t=>res.json(common.handleDoc(t)))
                            }
                            case 'DELETE':{
                                return userClasses.doc(req.query.ticket).get().then(t=>{
                                    
                                    common.devlog(t)

                                    if(!t.exists) return res.sendStatus(404)
                                    
                                    userClasses.doc(req.query.ticket).update({
                                        active: false,
                                        updatedAt: new Date(),
                                        admin: +req.query.id
                                    }).then(s=>{
                                        res.send(`ok`)
                                    }).catch(err=>{
                                        res.status(500).send(err.message)
                                    })
                                })
                            }
                            case 'PUT':{
                                return userClasses.doc(req.query.ticket).get().then(t=>{
                                    if(!t.exists) return res.sendStatus(404)
                                    
                                    userClasses.doc(req.query.ticket).update({
                                        [req.body.param]: req.body.value,
                                        updatedAt: new Date(),
                                        admin: +req.query.id
                                    }).then(s=>{
                                        res.send(`ok`)
                                    }).catch(err=>{
                                        res.status(500).send(err.message)
                                    })
                                })
                            }
                            default:{
                                return res.sendStatus(404)
                            }
                        }
                    }
                    case `authors`:{
                        switch (req.method){
                            case 'POST':{
                                if(req.body.name && req.body.description){
                                    return authors.where(`name`,'==',req.body.name).get().then(col=>{
                                        if(col.docs.length){
                                            return res.json({
                                                success: false,
                                                comment: `Автор с таким именем уже существует!`
                                            })
                                        }
                                        authors.add({
                                            createdAt:      new Date(),
                                            name:           req.body.name,
                                            description:    req.body.description,
                                            active:         true,
                                            createdBy:      +req.query.id
                                        }).then(record=>{
                                            log({
                                                text:   `Создан новый автор: ${req.body.name}.`,
                                                admin:  +req.query.id,
                                                author: record.id
                                            })
                                            return res.json({
                                                success: true
                                            })
                                        })
                                        
                                    })
                                }
                                return res.sendStatus(400)
                            }
                            case 'GET':{
                                return authors.get().then(col=>res.json(common.handleQuery(col).sort((a,b)=>b.name>a.name?-1:1)))
                            }
                        }
                    }
                    case `banks`:{
                        switch (req.method){
                            case `GET`:{
                                return banks.get().then(col=>res.json(common.handleQuery(col)))
                            }
                            case `POST`:{
                                if(req.body.name && req.body.creds){
                                    return banks.add({
                                        active:     true,
                                        createdAt:  new Date(),
                                        createdBy:  user.id,
                                        name:       req.body.name,
                                        creds:      req.body.creds
                                    }).then(s=>{
                                        res.json({success:true})
                                        log({
                                            silent: true,
                                            text: `${common.uname(user,user.id)} добавляет реквизиты ${req.body.creds}`
                                        })
                                    }).catch(err=>{
                                        res.json({success:false,comment:err.message})
                                    })
                                } else {
                                    return res.sendStatus(400)
                                }
                            }
                        }
                        
                    }
                    case `courses`:{
                        switch(req.method){
                            case 'GET': {
                                return courses.where(`active`,'==',true).get().then(col=>res.json(common.handleQuery(col)))
                            }
                            case 'POST':{
                                if(req.body.name){
                                    return courses.add({
                                        active:         true,
                                        createdBy:      +req.query.id,
                                        name:           req.body.name,
                                        description:    req.body.description || null,
                                        kids:           req.body.kids || false,
                                        createdAt:      new Date(),
                                        pic:            req.body.pic || null
                                    }).then(s=>{
                                        res.json({success:true})
                                        log({
                                            silent: true,
                                            text: `${common.uname(user,user.id)} создает новый курс ${req.body.name}`,
                                            course: s.id,
                                            admin: user.id
                                        })
                                        if(req.body.authorId){
                                            getDoc(authors,req.body.authorId).then(a=>{
                                                if(a){
                                                    courses.doc(s.id).update({
                                                        author:     a.name,
                                                        authorId:   req.body.authorId
                                                    })
                                                }
                                            })
                                        }
                                    })
                                }
                            }
                        }

                    }

                    case `tickets`:{
                        return userClasses.orderBy(`createdAt`,'desc').get().then(col=>res.json(common.handleQuery(col)))
                    }

                    case `streams`:{
                        return streams
                            .orderBy(`createdAt`,'desc')
                            .get()
                            .then(col=>{
                                res.json(common.handleQuery(col))
                            })
                    }
                    default:
                        res.sendStatus(404)
                }

            })
        })
    })
})

router.all(`/admin/:data/:id`,(req,res)=>{
    
    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(req.signedCookies.adminToken).get().then(doc=>{
        if(!doc.exists) return res.sendStatus(403)
        doc = common.handleDoc(doc)
        if(!doc.active) return res.sendStatus(403)
        switch(req.params.data){
            case `authors`:{
                let ref = authors.doc(req.params.id)
                return ref.get().then(author=>{
                    if(!author.exists) return res.sendStatus(404)
                    switch (req.method){
                        case `POST`:{
                            return subscriptions.where(`author`,'==',req.params.id).where(`active`,'==',true).get().then(col=>{
                                let line = common.handleQuery(col); 
                                line.forEach((s,i)=>{
                                    setTimeout(function(){
                                        m.sendMessage2({
                                            chat_id: s.user,
                                            text: req.body.text,
                                            reply_markup: {
                                                inline_keyboard:[[{
                                                    text: `Открыть автора`,
                                                    web_app:{
                                                        url: `${ngrok}/${host}/app2?start=author_${req.params.id}`
                                                    }
                                                }]]
                                            }
                                        },false,token).then(s=>{
                                            if(s) messages.add({
                                                isReply: true,
                                                createdAt: new Date(),
                                                text: req.body.text
                                            })
                                        })
                                    },i*200)
                                })
                                res.json({
                                    success: true,
                                    comment: `Ваше сообщение расходится на ${line.length} адресатов.`
                                })
                            })
                        }
                        case 'GET':{
                            let data = []
                            data.push(classes.where(`authorId`,'==',req.params.id).get().then(col=>common.handleQuery(col))) 
                            data.push(subscriptions.where(`author`,'==',req.params.id).where(`active`,'==',true).get().then(col=>common.handleQuery(col)))
                            data.push(courses.where(`authorId`,'==',req.params.id).where(`active`,'==',true).get().then(col=>common.handleQuery(col)))
                            // data.push(views.where(`entity`,'==','author').where(`id`,'==',req.params.id).get().then(common.handleQuery))
                            return Promise.all(data).then(data=>{
                                res.json({
                                    author:         common.handleDoc(author),
                                    classes:        data[0],
                                    subscriptions:  data[1],
                                    courses:        data[2],
                                    // views:          data[3]
                                })
                            })
                        }
                        
                        case 'DELETE':{
                            return ref.update({
                                active: false,
                                updatedBy: doc.user
                            }).then(s=>{
                                res.json({success:true})
                                log({
                                    text: `автор ${common.handleDoc(author).name} отправляется в архив`,
                                    admin: doc.user,
                                    author: req.params.id
                                })
                            })
                        }

                        case 'PUT':{
                            return ref.update({
                                [req.body.attr]: req.body.value,
                                updatedBy: doc.user
                            }).then(s=>{
                                log({
                                    text: `автор ${common.handleDoc(author).name} был обновлен`,
                                    admin: doc.user,
                                    author: req.params.id
                                })
                                res.json({success:true})
                            }).catch(err=>{
                                res.json({success:false,comment:err.message})
                            })
                        }
                    }
                })
            }
            case `courses`:{
                let ref = courses.doc(req.params.id)
                return ref.get().then(course=>{
                    if(!course.exists) return res.sendStatus(404)
                    course = common.handleDoc(course)
                    switch(req.method){
                        case `POST`:{
                            return subscriptions.where(`course`,'==',req.params.id).where(`active`,'==',true).get().then(col=>{
                                let line = common.handleQuery(col); 
                                line.forEach((s,i)=>{
                                    setTimeout(function(){
                                        m.sendMessage2({
                                            chat_id:    s.user,
                                            text:       req.body.text,
                                            reply_markup: {
                                                inline_keyboard:[[{
                                                    text: `Открыть курс`,
                                                    web_app:{
                                                        url: `${ngrok}/${host}/app2?start=course_${req.params.id}`
                                                    }
                                                }]]
                                            }
                                        },false,token).then(s=>{
                                            if(s) messages.add({
                                                isReply: true,
                                                createdAt: new Date(),
                                                text: req.body.text
                                            })
                                        })
                                    },i*200)
                                })
                                res.json({
                                    success: true,
                                    comment: `Ваше сообщение расходится на ${line.length} адресатов.`
                                })
                            })
                        }

                        case `GET`:{
                            let data = []
                            data.push(classes.where(`course`,'==',req.params.id).get().then(col=>common.handleQuery(col,`date`)))
                            data.push(subscriptions.where(`course`,'==',req.params.id).get().then(col=>common.handleQuery(col,`date`)))
                            // data.push(views.where(`entity`,'==','course').where(`id`,'==',req.params.id).get().then(common.handleQuery))
                            devlog(data)
                            return Promise.all(data).then(data=>{
                                res.json({
                                    course:          course,
                                    classes:        data[0],
                                    subscriptions:  data[1],
                                    // views:          data[2]
                                })
                            })
                            
                        }
                        case `DELETE`:{
                            return deleteEntity(req,res,ref,doc.user)
                        }
                        case `PUT`:{
                            return updateEntity(req,res,ref,doc.user)
                        }
                    }
                })
            }
            case `tickets`:{
                let ref = userClasses.doc(req.params.id);
                return ref.get().then(ticket=>{
                    if(!ticket.exists) return res.sendStatus(404)
                    ticket = common.handleDoc(ticket)
                    switch(req.method){
                        case `GET`:{
                            return res.json(ticket)                            
                        }
                        case `DELETE`:{
                            return deleteEntity(req,res,ref,doc.user).then(s=>{
                                // TBD alert tickets
                            })
                        }
                        case `PUT`:{
                            return updateEntity(req,res,ref,doc.user)
                        }
                    }
                })
            }
            case `users`:{
                let ref = udb.doc(req.params.id);
                return ref.get().then(user=>{
                    if(!user.exists) return res.sendStatus(404)
                    user = common.handleDoc(user)
                    switch(req.method){
                        case `GET`:{
                            let data = []
                            data.push(userClasses.where(`user`,'==',+req.params.id).get().then(col=>common.handleQuery(col,`date`)))
                            data.push(subscriptions.where(`user`,'==',+req.params.id).get().then(col=>common.handleQuery(col,`date`)))
                            return Promise.all(data).then(data=>{
                                res.json({
                                    user:           user,
                                    classes:        data[0],
                                    subscriptions:  data[1]
                                })
                            })
                            
                        }
                        case `DELETE`:{
                            return blockUser(req,res,ref,doc.user)
                        }
                        case `PUT`:{
                            return updateEntity(req,res,ref,doc.user)
                        }
                    }
                })
            }
            case `classes`:{
                let ref = classes.doc(req.params.id);
                return ref.get().then(cl=>{
                    if(!cl.exists) return res.sendStatus(404)
                    cl = common.handleDoc(cl)
                    switch(req.method){
                        case `POST`:{
                            cl.date = new Date(req.body.date);
                            delete cl.id
                            return classes.add(cl).then(s=>{
                                res.json({success:true})
                            })
                        }
                        case `GET`:{
                            let data = []
                            
                            data.push(userClasses.where(`class`,'==',req.params.id).get().then(col=>common.handleQuery(col,`date`)))
                            
                            if(cl.authorId) {data.push(getDoc(authors,cl.authorId))} else {data.push([])} 
                            if(cl.courseId) {data.push(getDoc(courses,cl.courseId))} else {data.push([])}
                            
                            data.push(streams.where(`class`,'==',req.params.id).get().then(col=>common.handleQuery(col,`date`)))


                            return Promise.all(data).then(data=>{

                                devlog(data)
                                
                                res.json({
                                    class:          cl,
                                    tickets:        data[0],
                                    author:         data[1],
                                    course:         data[2],
                                    streams:        data[3]
                                })
                            })
                            
                        }
                        case `DELETE`:{
                            return deleteEntity(req,res,ref,doc.user).then(s=>{
                                // TBD alert tickets
                            })
                        }
                        case `PUT`:{
                            return updateEntity(req,res,ref,doc.user)
                        }
                    }
                })
            }
            case `banks`:{
                let ref = classes.doc(req.params.id);
                return ref.get().then(cl=>{
                    if(!cl.exists) return res.sendStatus(404)
                    let creds = common.handleDoc(cl)
                    switch(req.method){
                        case `GET`:{
                            return res.json(creds)
                        }
                        case `PUT`:{
                            return updateEntity(req,res,ref,doc.user)
                        }
                        case  `DELETE`:{
                            return deleteEntity(req,res,ref,doc.user)
                        }
                    }
                })   
            }
            case `plans`:{
                let ref = plans.doc(req.params.id);
                return ref.get().then(cl=>{
                    if(!cl.exists) return res.sendStatus(404)
                    let plan = common.handleDoc(cl)
                    switch(req.method){
                        case `GET`:{
                            return plansUsers.where(`plan`,'==',plan.id).get().then(col=>{
                                plan.subscriptions = common.handleQuery(col)||[]
                                devlog(plan.subscriptions)
                                res.json(plan)
                            })
                        }
                        case `PUT`:{
                            return updateEntity(req,res,ref,doc.user)
                        }
                        case  `DELETE`:{
                            return deleteEntity(req,res,ref,doc.user)
                        }
                    }
                })   
            }
            case `messages`:{
                return messages
                    .where(`user`,'==',+req.params.id)
                    .orderBy(`createdAt`,'asc')
                    .get()
                    .then(col=>{
                        res.json(common.handleQuery(col))
                    })
            }
            case `streamAlerts`:{
                return getDoc(classes,req.params.id).then(cl=>{
                    if(cl.active && cl.streamDesc){
                        return streams
                            .where(`class`,'==',req.params.id)
                            .where(`active`,'==',true)
                            .where(`payed`,'==',true)
                            .get()
                            .then(col=>{
                                let line = common.handleQuery(col)
                                res.json({
                                    success:true,
                                    comment: `отправляется на ${line.length} адресов`
                                })
                                line.forEach((r,count)=>{
                                    if(!r.sent){
                                        setTimeout(function(){
                                            m.sendMessage2({
                                                chat_id: r.user,
                                                text: `Доступ к трансляции ${r.className}:\n${cl.streamDesc}`
                                            },false,token).then(s=>{
                                                messages.add({
                                                    createdAt:  new Date(),
                                                    user:       r.user,
                                                    text:       `Доступ к трансляции ${r.className}:\n${cl.streamDesc}`,
                                                    isReply:    true
                                                })
                                                streams.doc(r.id).update({
                                                    sent: new Date()
                                                })
                                            })
                                        },count*200)
                                    }
                                })
                            })
                    } else {
                        return res.json({
                            success: false,
                            comment: `Мероприятие отменено или не заданы данные трансляции.`
                        })
                    }
                })
                
            }
            case `streams`:{
                let ref = streams.doc(req.params.id)
                return ref.get().then(s=>{
                    if(!s.exists) return res.sendStatus(404)
                    
                    switch (req.method){
                        case `PUT`:{
                            return ref.get().then(s=>{
                                updateEntity(req,res,ref,doc.user)
                            })
                        }
                        case `GET`:{
                            return ref.get().then(s=>{
                                m.getUser(s.data().userBlocked,udb).then(u=>{
                                    res.json({
                                        stream: s.data(),
                                        user: u
                                    })
                                })
                            })
                        }
                        case `DELETE`:{
                            return deleteEntity(req,res,ref,doc.user)
                        }
                    }
                })
                
                
            }
            default: return res.sendStatus(404)
        }
    })
})

function updateEntity(req,res,ref,adminId){
    return ref.update({
        updatedAt: new Date(),
        updatedBy: adminId,
        [req.body.attr]: req.body.attr == `date` ? new Date(req.body.value) : req.body.value
    }).then(s=>{
        res.json({success:true})

        if(req.body.attr == `authorId`){
            getDoc(authors,req.body.value).then(a=>{
                ref.update({
                    author: a.name
                })
            })
        }

        if(req.body.attr == `courseId`){
            getDoc(courses,req.body.value).then(a=>{
                ref.update({
                    course: a.name
                })
            })
        }

        if(req.body.attr == `bankId`){
            getDoc(banks,req.body.value).then(a=>{
                ref.update({
                    bankName:       a.name,
                    bankCreds:      a.creds
                })
            })
        }

        if(req.body.attr == `planId`){
            getDoc(plans,req.body.value).then(a=>{
                ref.update({
                    plan:   a.name
                })
            })
        }

    }).catch(err=>{
        res.status(500).send(err.message)
    })
}

function blockUser(){
    // TBD
}

function deleteEntity(req,res,ref,admin, attr){
    devlog(`удаляем нечто`)
    entities = {
        courses:{
            log: (name) => `курс ${name} был архивирован`
        },
        users: {
            log: (name) => `пользователь ${name} был заблокирован`
        },
        streams: {
            log: (name) => `подписка на трансляцию была аннулирована`
        }
    }
    return ref.get().then(e=>{
        let data = common.handleDoc(e)
        if(!data[attr||'active']) return res.json({success:false,comment:`Вы опоздали. Запись уже удалена.`})
        ref.update({[attr||'active']:false,updatedBy:admin}).then(s=>{
            log({
                text: entities[req.params.data].log(data.name)
            })
            res.json({success:true})
        }).catch(err=>{
            res.json({success:false,comment: err.message})
        })
    })
}

router.get('/qr', async (req, res) => {
    if (req.query.class) {
        let n = +new Date()
        QRCode.toFile(__dirname + `/../public/images/auditoria/qr/invite_${req.query.class}.png`, `https://t.me/AuditoraBot?start=quick_class_${req.query.class}`, {
            color: {
                dark: req.query.dark || '#000000',
                light: req.query.light || '#ffffff',
            },
            maskPattern: req.query.m || 0,
            type: 'png',
        }).then(s => {
            res.sendFile(`invite_${req.query.class}` + '.png', {
                root: './public/images/auditoria/qr/'
            })
        }).catch(err => {
            console.log(err)
            res.sendStatus(500)
        })
    } else if (req.query.id && req.query.entity) {
        QRCode.toFile(__dirname + `/../public/images/auditoria/qr/${req.query.id}_${req.query.entity}.png`, `${req.query.id}_${req.query.entity}`, {
            color: {
                dark: req.query.dark || '#000000',
                light: req.query.light || '#ffffff',
            },
            maskPattern: req.query.m || 0,
            type: 'png',
        }).then(s => {
            res.sendFile(`${req.query.id}_${req.query.entity}` + '.png', {
                root: './public/images/auditoria/qr/'
            })
        }).catch(err => {
            console.log(err)
            res.sendStatus(500)
        })
    } else {
        res.status(500).send(`no place provided`)
    }
})



router.get('/test', (req, res) => {
    // stopClasses()
    checkChannel()
    // alertSoonCoworking();
    // alertSoonClasses();
    res.sendStatus(200)
})


// udb.get().then(col=>{
//     col.docs.forEach((u,i)=>{
//         setTimeout(function(){
//             let m = u.data();
//                 m.intention = 'newUser'
//                 m.id = u.id
//             axios.post(sheet,Object.keys(m).map(k=>`${k}=${m[k]}`).join('&'),{headers:{ "Content-Type": "application/x-www-form-urlencoded" }}).then(d=>{
//                 console.log(d.data)
//             }).catch(err=>{
//                 console.log(err.message)
//             })
//         },i*2500)

//     })
// })



function alertSoonClasses() {
    // TBD перевести на новое время
    classes
        .where('active', '==', true)
        .where('date', '==', new Date().toISOString().split('T')[0])
        .get()
        .then(col => {
            common.handleQuery(col).forEach(record => {
                remindOfClass(record)
            })
        }).catch(err => {
            console.log(err)
        })
}

function alertSoonCoworking() {
    coworking
        .where('active', '==', true)
        .where('date', '==', new Date().toISOString().split('T')[0])
        .get()
        .then(col => {
            common.handleQuery(col).forEach(record => {
                remindOfCoworking(record)
            })
        }).catch(err => {
            console.log(err)
        })
}


function remindOfClass(rec) {
    udb.doc(rec.user.toString()).get().then(user => {
        m.sendMessage2({
            chat_id: rec.user,
            text: translations.lectureReminder(rec)[user.language_code] || translations.lectureReminder(rec).en,
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                        callback_data: `unclass_${rec.id}`
                    }]
                ]
            }
        }, false, token)
    })
}

function remindOfCoworking(rec) {
    udb.doc(rec.user.toString()).get().then(user => {
        user = user.data();

        halls.doc(rec.hall).get().then(hall => {
            hall = hall.data();
            let message = {
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
            }
            if (!rec.isPayed && rec.paymentNeeded) {
                message.reply_markup.inline_keyboard.push([{
                    text: translations.pay(25)[user.language_code] || translations.pay(25).en,
                    callback_data: `pay_coworking_${rec.id}`
                }])
            }
            m.sendMessage2(message, false, token)
        })

    })
}


let users = {}

function bookClass(user, classId, res, id) {
    if (!user) {
        user = udb.doc(id).get().then(u => {
            let t = u.data();
            t.id = id
            return t
        })
    }

    Promise.resolve(user).then(user => {
        common.devlog(+user.id)
        common.devlog(classId)
        // common.devlog(+user.id)


        userClasses
            .where('user', '==', +user.id)
            .where('active', '==', true)
            .where('class', '==', classId)
            .get().then(col => {
                common.devlog(col.docs)
                if (!col.docs.length) {
                    classes.doc(classId).get().then(c => {

                        if (!c.exists) return res.sendStatus(404)

                        

                        let d = {
                            user: +user.id,
                            userName: `${user.first_name} ${user.last_name} (${user.username})`,
                            active: true,
                            createdAt: new Date(),
                            className: c.data().name,
                            class: classId
                        }
                        userClasses.add(d).then(record => {

                            d.id = record.id;

                            d.intention = 'newClassRecord';


                            userClasses
                                .where('class', '==', classId)
                                .where('active', '==', true)
                                .get()
                                .then(col => {

                                    let line = col.docs.length;
                                    let capacity = c.data().capacity
                                    let seatsData = '';

                                    if (capacity) {
                                        if (line < capacity) {
                                            seatsData = `осталось мест: ${capacity-line} из ${capacity}`
                                        } else {
                                            seatsData = `*овербукинг:* забронировано ${line} мест из ${capacity}`
                                        }
                                    } else {
                                        seatsData = `всего забронировано мест: ${line}`
                                    }

                                    log({
                                        text: `${user.first_name} ${user.last_name} (${user.username}) просит место на лекцию ${c.data().name}\n${seatsData}`,
                                        user: user.id,
                                        class: c.id,
                                        ticket: record.id
                                    })
                                })

                            if (c.data().price) {

                                if (res) {
                                    res.json({
                                        success: true,
                                        text: `lectureConfirm`
                                    })
                                }

                                let plan = null;

                                if(c.data().courseId){
                                    common.devlog(`курс обнаружен ${c.data().courseId}`)
                                    plans
                                        .where(`courseId`,'==',c.data().courseId)
                                        .get()
                                        .then(col=>{
                                            let plauseiblePlans = common.handleQuery(col)
                                            // common.devlog(`подписка подобрана ${plauseiblePlans[0].id}, ${user.id}`)
                                            if(plauseiblePlans[0]){
                                                getPlanWithUser(plauseiblePlans[0].id,user.id)
                                                    .then(plan=>{
                                                        common.devlog(plan)
                                                        if(plan){
                                                            common.devlog(`абонемент обнаружен`)
                                                            if(plan.eventsLeft){
                                                                
                                                                plansUsers.doc(plan.id).update({
                                                                    eventsLeft: FieldValue.increment(-1)
                                                                })
                                                                
                                                                userClasses.doc(record.id).update({
                                                                    isPayed: true
                                                                })

                                                                common.devlog(`билет обновлен`)
                                                                
                                                                m.sendMessage2({
                                                                    chat_id: user.id,
                                                                    photo: ngrok + `/auditoria/qr?id=${record.id}&entity=userClasses`,
                                                                    caption: translations.lectureInvite(c.data(),true)[user.language_code] || translations.lectureInvite(c.data(),true).en,
                                                                    reply_markup: {
                                                                        inline_keyboard: [
                                                                            [{
                                                                                text: `Подробнее`,
                                                                                web_app:{
                                                                                    url: `${ngrok}/auditoria/app2?start=ticket_${record.id}`
                                                                                }
                                                                            }],
                                                                            [{
                                                                                text: `Отменить`,
                                                                                callback_data: `unclass_${record.id}`
                                                                            }]
                                                                            // [{
                                                                            //     text: translations.pay(common.cur(c.data().price, 'GEL'))[user.language_code] || translations.pay(common.cur(c.data().price, 'GEL')).en,
                                                                            //     callback_data: 'pay_' + d.id
                                                                            // }],
                                                                            // [{
                                                                            //     text: translations.payOnSite(c.data().price2)[user.language_code] || translations.payOnSite(c.data().price2).en,
                                                                            //     callback_data: 'payOnSite_' + d.id
                                                                            // }]
                                                                        ]
                                                                        //     ,
                                                                        //     [{
                                                                        //         text: translations.yourCode[user.language_code] || translations.yourCode.en,
                                                                        //         url: ngrok + `/auditoria/qr?id=${record.id}&entity=userClasses`
                                                                        //     }]
                                                                        // ]
                                                                    }
                                                                }, 'sendPhoto', token).then(data=>{
                                                                    m.sendMessage2({
                                                                        chat_id: user.id,
                                                                        message_id: data.result.message_id
                                                                    }, 'pinChatMessage', token)
                                                                })
                                                            } else { 
                                                                m.sendMessage2({
                                                                    chat_id: user.id,
                                                                    photo: ngrok + `/auditoria/qr?id=${record.id}&entity=userClasses`,
                                                                    caption: translations.lectureInvite(c.data())[user.language_code] || translations.lectureInvite(c.data()).en,
                                                                    reply_markup: {
                                                                        inline_keyboard: [
                                                                            [{
                                                                                text: `Подробнее`,
                                                                                web_app:{
                                                                                    url: `${ngrok}/auditoria/app2?start=ticket_${record.id}`
                                                                                }
                                                                            }],
                                                                            [{
                                                                                text: `Отменить`,
                                                                                callback_data: `unclass_${record.id}`
                                                                            }]
                                                                            // [{
                                                                            //     text: translations.pay(common.cur(c.data().price, 'GEL'))[user.language_code] || translations.pay(common.cur(c.data().price, 'GEL')).en,
                                                                            //     callback_data: 'pay_' + d.id
                                                                            // }],
                                                                            // [{
                                                                            //     text: translations.payOnSite(c.data().price2)[user.language_code] || translations.payOnSite(c.data().price2).en,
                                                                            //     callback_data: 'payOnSite_' + d.id
                                                                            // }]
                                                                        ]
                                                                        //     ,
                                                                        //     [{
                                                                        //         text: translations.yourCode[user.language_code] || translations.yourCode.en,
                                                                        //         url: ngrok + `/auditoria/qr?id=${record.id}&entity=userClasses`
                                                                        //     }]
                                                                        // ]
                                                                    }
                                                                }, 'sendPhoto', token).then(data=>{
                                                                    m.sendMessage2({
                                                                        chat_id: user.id,
                                                                        message_id: data.result.message_id
                                                                    }, 'pinChatMessage', token)
                                                                })
                                                            }
                                                            
                                                        } else {
                                                            m.sendMessage2({
                                                                chat_id: user.id,
                                                                photo: ngrok + `/auditoria/qr?id=${record.id}&entity=userClasses`,
                                                                caption: translations.lectureInvite(c.data())[user.language_code] || translations.lectureInvite(c.data()).en,
                                                                reply_markup: {
                                                                    inline_keyboard: [
                                                                        [{
                                                                            text: `Подробнее`,
                                                                            web_app:{
                                                                                url: `${ngrok}/auditoria/app2?start=ticket_${record.id}`
                                                                            }
                                                                        }],
                                                                        [{
                                                                            text: `Отменить`,
                                                                            callback_data: `unclass_${record.id}`
                                                                        }]
                                                                        // [{
                                                                        //     text: translations.pay(common.cur(c.data().price, 'GEL'))[user.language_code] || translations.pay(common.cur(c.data().price, 'GEL')).en,
                                                                        //     callback_data: 'pay_' + d.id
                                                                        // }],
                                                                        // [{
                                                                        //     text: translations.payOnSite(c.data().price2)[user.language_code] || translations.payOnSite(c.data().price2).en,
                                                                        //     callback_data: 'payOnSite_' + d.id
                                                                        // }]
                                                                    ]
                                                                    //     ,
                                                                    //     [{
                                                                    //         text: translations.yourCode[user.language_code] || translations.yourCode.en,
                                                                    //         url: ngrok + `/auditoria/qr?id=${record.id}&entity=userClasses`
                                                                    //     }]
                                                                    // ]
                                                                }
                                                            }, 'sendPhoto', token).then(data=>{
                                                                m.sendMessage2({
                                                                    chat_id: user.id,
                                                                    message_id: data.result.message_id
                                                                }, 'pinChatMessage', token)
                                                            })
                                                        }
                                                    })
                                            } else {
                                                m.sendMessage2({
                                                    chat_id: user.id,
                                                    photo: ngrok + `/auditoria/qr?id=${record.id}&entity=userClasses`,
                                                    caption: translations.lectureInvite(c.data())[user.language_code] || translations.lectureInvite(c.data()).en,
                                                    reply_markup: {
                                                        inline_keyboard: [
                                                            [{
                                                                text: `Подробнее`,
                                                                web_app:{
                                                                    url: `${ngrok}/auditoria/app2?start=ticket_${record.id}`
                                                                }
                                                            }],
                                                            [{
                                                                text: `Отменить`,
                                                                callback_data: `unclass_${record.id}`
                                                            }]
                                                            // [{
                                                            //     text: translations.pay(common.cur(c.data().price, 'GEL'))[user.language_code] || translations.pay(common.cur(c.data().price, 'GEL')).en,
                                                            //     callback_data: 'pay_' + d.id
                                                            // }],
                                                            // [{
                                                            //     text: translations.payOnSite(c.data().price2)[user.language_code] || translations.payOnSite(c.data().price2).en,
                                                            //     callback_data: 'payOnSite_' + d.id
                                                            // }]
                                                        ]
                                                        //     ,
                                                        //     [{
                                                        //         text: translations.yourCode[user.language_code] || translations.yourCode.en,
                                                        //         url: ngrok + `/auditoria/qr?id=${record.id}&entity=userClasses`
                                                        //     }]
                                                        // ]
                                                    }
                                                }, 'sendPhoto', token).then(data=>{
                                                    m.sendMessage2({
                                                        chat_id: user.id,
                                                        message_id: data.result.message_id
                                                    }, 'pinChatMessage', token)
                                                })
                                            }
                                            
                                        })
                                    
                                } else {
                                    m.sendMessage2({
                                        chat_id: user.id,
                                        photo: ngrok + `/auditoria/qr?id=${record.id}&entity=userClasses`,
                                        caption: translations.lectureInvite(c.data())[user.language_code] || translations.lectureInvite(c.data()).en,
                                        reply_markup: {
                                            inline_keyboard: [
                                                [{
                                                    text: `Подробнее`,
                                                    web_app:{
                                                        url: `${ngrok}/auditoria/app2?start=ticket_${record.id}`
                                                    }
                                                }],
                                                [{
                                                    text: `Отменить`,
                                                    callback_data: `unclass_${record.id}`
                                                }]
                                                // [{
                                                //     text: translations.pay(common.cur(c.data().price, 'GEL'))[user.language_code] || translations.pay(common.cur(c.data().price, 'GEL')).en,
                                                //     callback_data: 'pay_' + d.id
                                                // }],
                                                // [{
                                                //     text: translations.payOnSite(c.data().price2)[user.language_code] || translations.payOnSite(c.data().price2).en,
                                                //     callback_data: 'payOnSite_' + d.id
                                                // }]
                                            ]
                                            //     ,
                                            //     [{
                                            //         text: translations.yourCode[user.language_code] || translations.yourCode.en,
                                            //         url: ngrok + `/auditoria/qr?id=${record.id}&entity=userClasses`
                                            //     }]
                                            // ]
                                        }
                                    }, 'sendPhoto', token).then(data=>{
                                        m.sendMessage2({
                                            chat_id: user.id,
                                            message_id: data.result.message_id
                                        }, 'pinChatMessage', token)
                                    })
                                }

                                
                            } else {

                                if (res) {
                                    res.json({
                                        success: true,
                                        text: `lectureConfirm`
                                    })
                                }
                                m.sendMessage2({
                                    chat_id: user.id,
                                    text: translations.lectureInvite(c.data())[user.language_code] || translations.lectureInvite(c.data()).en,
                                }, false, token).then(data=>{
                                    m.sendMessage2({
                                        chat_id: user.id,
                                        message_id: data.result.message_id
                                    }, 'pinChatMessage', token)
                                })
                            }




                            let t = Object.keys(d).map(k => `${k}=${d[k]}`).join('&')


                            axios.post(sheet, t, {
                                headers: {
                                    "Content-Type": "application/x-www-form-urlencoded"
                                }
                            })

                        }).catch(err => {
                            console.log(err)
                        })

                    })


                } else {

                    if (res) {
                        res.json({
                            success: false,
                            text: 'alreadyBookedClass'
                        })
                    } else {
                        m.sendMessage2({
                            chat_id: user.id,
                            text: translations.alreadyBookedClass[user.language_code] || translations.alreadyBookedClass.en
                        }, false, token)
                    }

                }
            })
    })
}

function alertAdmins(mess) {
    let message = {
        text: mess.text
    }
    if (mess.type == 'newUser') {
        message.reply_markup = {
            inline_keyboard: [
                [{
                    text: 'Заблокировать',
                    callback_data: `user_block_${mess.user_id}`
                }],
                [{
                    text: `Сделать сотрудником`,
                    callback_data: `user_insider_${mess.user_id}`
                }],
                [{
                    text: `Сделать админом`,
                    callback_data: `user_admin_${mess.user_id}`
                }]
            ]
        }
    } else if (mess.type == 'logRecord') {
        message.reply_markup = {
            inline_keyboard: [
                [{
                    text: 'Отписаться от уведомлений',
                    callback_data: `admin_log_unsubscribe`
                }]
            ]
        }
    }

    udb.where(`admin`, '==', true).get().then(admins => {
        admins.docs.forEach(a => {
            message.chat_id = a.id
            if (mess.type != 'stopLog' || !a.data().stopLog) {

                if(!process.env.develop || a.id == common.dimazvali) m.sendMessage2(message, false, token)
            }
        })
    })
}

function stopClasses(){
    userClasses
        .where('active','==',true)
        .get()
        .then(col=>{
            // common.devlog(col)
            common.handleQuery(col).forEach(t=>{
                common.devlog(t.class)
                classes.doc(t.class).get().then(cl=>{
                    cl = cl.data()
                    common.devlog(cl.date)

                    if(new Date()>cl.date){
                        common.devlog(`${cl.date} passed`)
                        userClasses.doc(t.id).update({
                            active: false
                        })
                    }
                })
            })

        })
}

function registerUser(u) {

    u.createdAt = new Date();
    u.active = true;
    u.blocked = false;

    users[u.id] = u;

    axios.post(`https://joinposter.com/api/clients.createClient?tokent=${process.env.auPosterToken}`,{
        client_name: common.uname(u,u.id),
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
                            url: ngrok + '/auditoria/app?lang=' + u.language_code
                        }
                    }]
                ]
            }
        }, false, token)

        let d = u;
        d.intention = 'newUser'
        d.id = u.id
        d.createdAt = new Date(d.createdAt).toISOString()

        axios.post(sheet, Object.keys(d).map(k => `${k}=${d[k]}`).join('&'), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        }).then(d => {
            console.log(d.data)
        }).catch(err => {
            console.log(err.message)
        })

        alertAdmins({
            type: 'newUser',
            text: `Новый пользователь бота:\n${JSON.stringify(u,null,2)}`,
            user_id: u.id
        })

    }).catch(err => {
        console.log(err)
    })
}

function sendMeetingRoom(user) {
    let shift = 0;
    let dates = []
    while (shift < 7) {
        dates.push(new Date(+new Date() + shift * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        shift++
    }
    m.sendMessage2({
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
    }, false, token)
}

function sendCoworking(user) {

    coworking
        .where('active', '==', true)
        .where('date', '>=', new Date().toISOString())
        .get()
        .then(data => {
            reservations = common.handleQuery(data);
            let days = {}
            let shift = 0

            while (shift < 8) {
                let date = new Date(+new Date() + shift * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                let temp = reservations.filter(r => r.date == date)
                days[date] = temp
                shift++
            }

            m.sendMessage2({
                chat_id: user.id,
                text: translations.coworkingStart[user.language_code] || translations.coworkingStart.en,
                reply_markup: {
                    inline_keyboard: Object.keys(days).map(day => {
                        return [{
                            text: `${common.drawDate(day,user.language_code)} ${days[day].length == 12 ? translations.noSeatsLeft[user.language_code] || translations.noSeatsLeft.en : ''}`,
                            callback_data: `coworking_book_${day}`
                        }]
                    })
                }
            }, false, token)

        })

    // halls
    //     .where(`active`, '==', true)
    //     .where('isMeetingRoom', '==', false)
    //     .where('isCoworking', '==', true)
    //     .get().then(col => {
    //         m.sendMessage2({
    //             chat_id: user.id,
    //             text: translations.coworkingStart[user.language_code] || translations.coworkingStart.en,
    //             reply_markup: {
    //                 inline_keyboard: col.docs.map(h => {
    //                     return [{
    //                         text: `${h.data().name}`,
    //                         callback_data: `coworking_${h.id}`
    //                     }]
    //                 })
    //             }
    //         }, false, token)


    //     })
}


function sendSubs(id, lang) {
    subscriptions.where('user', '==', +id).get().then(col => {

        if (!col.docs.length) return m.sendMessage2({
            chat_id: id,
            text: translations.noContent[lang] || translations.noContent.en
        }, false, token)

        let subs = common.handleQuery(col);
        subs.forEach(s => {
            if (s.author) {
                authors.doc(s.author).get().then(a => {
                    m.sendMessage2({
                        photo: a.data().pic || randomPic(),
                        chat_id: id,
                        caption: translations.allByAuthor(a.data().name)[lang] || translations.allByAuthor(a.data().name).en,
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: translations.authorDetails[lang] || translations.authorDetails.en,
                                    callback_data: `author_${s.author}`
                                }],
                                [{
                                    text: translations.unsubscribe[lang] || translations.unsubscribe.en,
                                    callback_data: `subs_delete_${s.id}`
                                }]
                            ]
                        }
                    }, 'sendPhoto', token)
                })
            } else if (s.course) {
                courses.doc(s.course).get().then(a => {
                    m.sendMessage2({
                        photo: a.data().pic || randomPic(),
                        chat_id: id,
                        caption: translations.allByCourse(a.data().name)[lang] || translations.allByCourse(a.data().name).en,
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: translations.tellMeMore[lang] || translations.tellMeMore.en,
                                    callback_data: `author_${s.author}`
                                }],
                                [{
                                    text: translations.unsubscribe[lang] || translations.unsubscribe.en,
                                    callback_data: `subs_delete_${s.id}`
                                }]
                            ]
                        }
                    }, 'sendPhoto', token)
                })
            }
        })

    })
}

function sendHalls(id, lang) {
    halls
        .where(`active`, '==', true)
        .where('isMeetingRoom', '==', false)
        .where('isCoworking', '==', false)
        .get().then(col => {
            col.docs.forEach(h => {
                m.sendMessage2({
                    chat_id: id,
                    caption: `<b>${h.data().name}</b>\n${h.data().description}`,
                    photo: h.data().pics,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: translations.bookHall[lang] || translations.bookHall.en,
                                callback_data: 'book_' + h.id
                            }, {
                                text: translations.hallSchedule[lang] || translations.hallSchedule.en,
                                callback_data: `inquire_${h.id}`
                            }]
                        ]
                    }
                }, 'sendPhoto', token)
            })
        })
}

const translations = {
    planConfirmed:(plan)=>{
        return {
            ru: `Поздравляем! Вы оформили подписку на абонемент ${plan.name}. Он будет действовать в течение ${plan.days} дней.`,
            en: `Congratulations! You've bought a plan for ${plan.events} events. Feel free to use it in the next ${plan.days} days.`
        }
    },
    thanks:{
        ru: `Спасибо!`,
        en: `Thank you!`
    },
    course: {
        ru: `Курс`,
        en: `Course`
    },
    allByCourse: (a) => {
        return {
            ru: `Новые события в курсе ${a}`,
            en: `New events within course ${a}`
        }
    },
    allByAuthor: (a) => {
        return {
            ru: `Новые события с участием ${a}`,
            en: `New events with ${a}`
        }
    },
    noContent: {
        ru: `Извините, здесь пока пусто...`,
        en: `Sorry, there's nothing to show yet...`
    },
    authorDetails: {
        ru: `Подробнее об авторе`,
        en: `More about the author`
    },
    addedSubscription: {
        ru: `Подписка оформлена!`,
        en: `Subscription was set`
    },
    deletedSubscription: {
        ru: `Подписка отменена`,
        en: `Subscription was cancelled`
    },
    subscribe: {
        ru: `Подписаться на обновления`,
        en: `Subscribe`
    },
    unsubscribe: {
        ru: `Отписаться от обновлений`,
        en: `Unsubscribe`
    },
    yourCode: {
        ru: 'Ваш код (вместо билета, лучше него)',
        en: `Ypur entrance code`
    },
    newLecture: (l) => {
        return {
            ru: `Отличные новости! Мы подготовили новую лекцию: «${l.name}». Ее проведет ${l.author}, ${new Date(l.date).toLocaleDateString()}.`,
            en: `Hello there! We have a new lecture coming: ${l.name} by ${l.author} on ${new Date(l.date).toLocaleDateString()}.`
        }
    },
    tellMeMore: {
        ru: 'Подробнее',
        en: 'More'
    },
    coworkingReminder: (hall) => {
        return {
            ru: `Доброе утро! Просто напоминаю, что сегодня вас ждут в коворкинге. Комната ${hall.name}, ${hall.floor} этаж.`,
            en: `Good morning! Looking forward to meet you at our coworking. Room ${hall.name}, on the ${hall.floor}.`
        }
    },
    mrReminder: (t) => {
        return {
            ru: `Напоминаем, что через пару минут (в ${t}) для вас забронирована переговорка.`,
            en: `Just to remind you, that you have booked a meeting room on ${t}.`
        }
    },
    schedule: {
        ru: 'Расписание',
        en: 'Schedule'
    },
    coworking: {
        ru: 'Коворкинг',
        en: 'Coworking'
    },
    mr: {
        ru: 'Переговорка',
        en: 'Meeting Room'
    },
    paymentTitleClass: (l) => {
        return {
            ru: `Оплата лекции ${l.name}`,
            en: `Payment for the lecture ${l.name}`
        }
    },
    nosais: {
        ru: `Извините, я не знаю такой команды. Уведомлю админа; кажется, что-то пошло не так...`,
        en: `Beg your pardon, I have no idea what to do about this task. I shall talk to my master...`
    },
    congrats: {
        en: 'Welcome aboard! You are registered as coworker.',
        ru: 'Поздравляем, вы зарегистрированы как сотрудник auditoria'
    },
    book: {
        ru: 'Записаться',
        en: 'Book a place'
    },
    noFee: {
        ru: 'Вход бесплатный ',
        en: 'Free admittance'
    },
    fee: {
        ru: 'Вход: ',
        en: 'Entry fee: '
    },
    hall: {
        ru: 'Зал',
        en: 'Hall'
    },
    author: {
        ru: 'Автор',
        en: 'Author'
    },
    minutes: {
        ru: 'минут',
        en: 'minutes'
    },
    bookHall: {
        ru: 'Забронировать зал',
        en: 'Book the space'
    },
    hallSchedule: {
        ru: 'Посмотреть график',
        en: 'Schedule'
    },
    intro: {
        ru: `Здравствуй, друг. Прощай, трезвый день.\nТы можешь посмотреть расписание лекций, забронировать место в коворкинге или переговорке — или сразу пройти в бар. Там мы тебя ждем...\n`,
        // Удобнее всего пользоваться ботом с помощью приложения: вот эта кнопочка в нижнем левом углу...
        en: `Hello there! Glad to meet you!`
    },
    introButton: {
        ru: `Открыть приложение`,
        en: `release the kraken!`
    },
    payOnSite: (v) => {
        return {
            ru: `Оплачу на месте (${common.cur(v,'GEL')}).`,
            en: `I'll pay on premise (${common.cur(v,'GEL')}).`
        }
    },
    pay: (v) => {
        return {
            ru: `Оплатить ${v}`,
            en: `Pay ${v}`
        }
    },
    lectureInvite: (l) => {
        return {
            ru: `Отлично! Ждем вас на лекции «${l.name}»`,
            en: `Great! Looking forward to meet you`
        }
    },
    lectureReminder: (l) => {
        return {
            ru: `Напоминаем, что сегодня в ${l.time} мы ждем вас на лекции ${l.name}.`,
            en: `Great! Looking forward to meet you`
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
        ru: 'Ваше место пусто не останется',
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
    coworkingBookingDetails: (date, name, lang) => {
        return {
            ru: `Вы записались в коворкинг на ${common.drawDate(date,lang)}.`,
            en: `You booked a place at on ${common.drawDate(date,lang)}.`
        }
    },
    seats: {
        ru: `п/м`,
        en: 'seats left'
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
        ru: `В коворкинге 12 мест. Стоимость за день 20 GEL, в неделю — 90.`,
        en: `We have room for 12 people. The price is 20 GEl per day (90 per week).`
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
        ru: `Извините, но вам не рады.`,
        en: `Sorry, but you're not welcome.`
    }
}

function log(o) {
    o.createdAt = new Date()

    console.log(o)

    logs.add(o).then(r => {

        if(!o.silent) alertAdmins({
            text: o.text,
            type: 'logRecord'
        })

        axios.post(sheet, `text=${o.text}`, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        })
    })
}

function randomPic() {
    let images = [
        '3b.png',
        'b1.png',
        'b2.png',
        'w1.png',
        'w2.png'
    ]

    return `${ngrok}/images/auditoria/${images[Math.floor(Math.random()*images.length)]}`
}


function classDescription(h, lang) {
    return `${common.drawDate(h.date._seconds*1000,lang)} ${new Date(h.date._seconds*1000).toLocaleTimeString()}.\n
<b>${h.name}</b>\n
${h.author ? `<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author}\n` : ''}${h.hallName ? `<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n` : ''}${h.descShort ? `${h.descShort}\n`:''}${h.price? `${translations.fee[lang] ||  translations.fee.en} ${common.cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}\n<a href="https://t.me/AuditoraBot?start=quick_class_${h.id}">${translations.tellMeMore[lang] || translations.tellMeMore.en}</a>`
}



function sendClasses(id, lang, filter) {
    let req = classes

    if (filter) {
        req = classes.where(filter[0], filter[1], filter[2])
    }

    req
        .where(`active`, '==', true)
        .where('date', '>=', new Date())
        .orderBy('date', 'asc')
        .get().then(col => {
            col.docs.forEach(h => {

                t = h.id
                h = h.data()
                h.id = t

                if (!h.pic) {
                    h.pic = randomPic()
                }

                let message = {
                    chat_id: id,
                    text: classDescription(h, lang),
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: translations.book[lang] || translations.book.en,
                                callback_data: 'class_' + h.id
                            }]
                        ]
                    }
                }

                if (h.authorId) {
                    message.reply_markup.inline_keyboard.push([{
                        text: translations.author[lang] || translations.author.en,
                        callback_data: 'author_' + h.authorId
                    }])
                }

                if (h.courseId) {
                    message.reply_markup.inline_keyboard.push([{
                        text: translations.course[lang] || translations.course.en,
                        callback_data: 'course_' + h.courseId
                    }])
                }

                if (h.pic) {
                    message.caption = message.text
                    message.photo = h.pic
                    // delete message.text
                }

                m.sendMessage2(message, (h.pic ? 'sendPhoto' : false), token)
            })

            if (!col.docs.length) {
                m.sendMessage2({
                    chat_id: id,
                    text: translations.noContent[lang] || translations.noContent.en,
                }, false, token)
            }
        })
}


function sendUserClasses(id, lang, past) {
    userClasses
        .where('user', '==', id)
        .where('active', '==', true)
        .get().then(col => {
            let d = []
            col.docs.forEach(record => {
                d.push(classes.doc(record.data().class).get().then(cl => {
                    let t = cl.data()
                    t.id = cl.id;
                    t.appointment = record.id
                    return t
                }))
            })

            Promise.all(d).then(data => {
                if (!data.length) {
                    m.sendMessage2({
                        chat_id: id,
                        text: translations.noClasses[lang] || translations.noClasses.en
                    }, false, token)
                } else {
                    data.forEach(h => {
                        let message = {
                            chat_id: id,
                            text: classDescription(h, lang),
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

                        if (h.authorId) {
                            message.reply_markup.inline_keyboard.push([{
                                text: translations.author[lang] || translations.author.en,
                                callback_data: 'author_' + h.authorId
                            }])
                        }

                        if (h.courseId) {
                            message.reply_markup.inline_keyboard.push([{
                                text: translations.course[lang] || translations.course.en,
                                callback_data: 'course_' + h.courseId
                            }])
                        }

                        if (!h.pic) {
                            h.pic = randomPic()
                        }

                        if (h.pic) {
                            message.caption = message.text
                            message.photo = h.pic
                            // delete message.text
                        }

                        m.sendMessage2(message, (h.pic ? 'sendPhoto' : false), token)
                    })
                }

            })
        })
}

function showBookings(id) {

}

router.post(`/news`, (req, res) => {
    isAdmin(req.query.id).then(p => {

        if (p) {

            if (req.body.text && req.body.name) {
                news.add({
                    text: req.body.text,
                    createdBy: +req.query.id || req.body.by,
                    createdAt: new Date(),
                    name: req.body.name,
                    inline_keyboard: req.body.inline_keyboard || null
                }).then(ref => {

                    log({
                        text: `Админ @id${req.query.id} стартует рассылку с рабочим названием «${req.body.name}».`,
                        admin: +req.query.id,
                        silent: true
                    })

                    udb.get().then(col => {

                        let s = []

                        col.docs.forEach(u => {

                            let message = {
                                chat_id: u.id,
                                text: req.body.text
                            }

                            if (req.body.silent) {
                                message.disable_notification = true
                            }

                            if (req.body.inline_keyboard) {
                                message.reply_markup = {
                                    inline_keyboard: req.body.inline_keyboard
                                }
                            }
                            let pass = true;

                            if (req.body.filter) {


                                let field = req.body.filter.split('_')[0]
                                let value = req.body.filter.split('_')[1] == 'true' ? true : false;
                                if (u.data()[field] != value) {
                                    pass = false
                                }


                            }
                            // u.id == common.dimazvali &&  
                            if (pass) {
                                s.push(m.sendMessage2(message, false, token).then(() => true).catch(err => false))
                                messages.add({
                                    user: u.id,
                                    text: message.text || message.caption,
                                    createdAt: new Date(),
                                    isReply: true
                                })
                            }



                        })

                        Promise.all(s).then(line => {
                            res.json({
                                success: line.filter(m => m),
                                decline: line.filter(m => !m)
                            })

                            news.doc(ref.id).update({
                                recieved: line.filter(m => m).length
                            })
                        })
                    })
                })


            } else {
                res.sendStatus(400)
            }

        } else {
            res.sendStatus(403)
        }

    })

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

function checkUser(id) {
    return udb.doc(id.toString()).get().then(u => {
        return !u.data().blocked
    }).catch(err => {

        alertAdmins({
            text: `ошибка проверки пользователя: ${err.message}`
        })

        return false;

    })
}

function sorry(user, type) {
    m.sendMessage2({
        chat_id: user.id,
        text: translations.userBlocked[user.language_code] || translations.userBlocked.en
    }, false, token)

    if (type) {
        alertAdmins({
            text: `Пользвателю @${user.username} (${user.id}) было отказано в ${type}.`
        })
    }
}


function sendCourse(user, course) {
    subscriptions
        .where(`user`, '==', user.id)
        .where('course', '==', course.id)
        .get()
        .then(s => {

            s = s.docs[0] ? s.docs[0].id : false;

            m.sendMessage2({
                chat_id: user.id,
                photo: course.pic || randomPic(),
                caption: `<b>${course.name}</b> by ${course.author}\n${course.description}`,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: translations.authorDetails[user.language_code] || translations.authorDetails.en,
                            callback_data: `author_${course.authorId}`
                        }],
                        [{
                            text: translations.schedule[user.language_code] || translations.schedule.en,
                            callback_data: `schedule_course_${course.id}`
                        }]
                    ]
                }
            }, 'sendPhoto', token)
        })
}


router.all(`/poster`,(req,res)=>{
    
    if(req.query) common.devlog(req.query)
    if(req.body) common.devlog(req.body)
    res.sendStatus(200)
})

router.all(`/poster/:dt`,(req,res)=>{
    switch(req.params.dt){
        case 'categories':{
            common.devlog(req.body)
            menuCategories = req.body.response.filter(c=>c.visible && c.visible[0].visible)
            break;
        }
        case 'dishes':{
            menuDishes = req.body.response
            break;
        }
        default:{
            break;
        }
    }
    // if(req.query) common.devlog(req.query)
    // if(req.body) common.devlog(req.body)
    res.sendStatus(200)
})

router.get(`/poster/auth`,(req,res)=>{
    if(req.query) common.devlog(req.query)
    if(req.body) common.devlog(req.body)
    res.sendStatus(200)
})

router.post('/hook', (req, res) => {

    res.sendStatus(200)

    let user = {}

    common.devlog(JSON.stringify(req.body))

    if (req.body.message) {

        user = req.body.message.from

        udb.doc(user.id.toString()).get().then(u => {
            if (!u.exists) registerUser(user)
            if (req.body.message.text && req.body.message.text.indexOf('/start campaign') == 0) {

                userTags.add({
                    user: user.id.toString(),
                    tag: req.body.message.text.split('/start campaign')[1],
                    createdAt: new Date()
                })
            }

            if (req.body.message.text && req.body.message.text.indexOf('/start quick') == 0) {
                let inc = req.body.message.text.split(' ')[1].split('_')
                if (inc[0] == 'quick') {
                    switch (inc[1]) {
                        case 'class': {
                            classes.doc(inc[2]).get().then(c => {
                                let h = c.data()
                                h.id = c.id;
                                if (!h.pic) {
                                    h.pic = randomPic()
                                }

                                let message = {
                                    chat_id: user.id,
                                    text: classDescription(h, user.language_code),
                                    parse_mode: 'HTML',
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{
                                                text: translations.book[user.language_code] || translations.book.en,
                                                callback_data: 'class_' + h.id
                                            }]
                                        ]
                                    }
                                }

                                if (h.pic) {
                                    message.caption = message.text
                                    message.photo = h.pic
                                    // delete message.text
                                }

                                m.sendMessage2(message, (h.pic ? 'sendPhoto' : false), token)
                            })
                            break;
                        }
                        default:
                            break;
                    }
                }
            }

            // if(req.body.message && req.body.message.reply_to_message){
            //     return isAdmin(req.body.message.from.id).then(admin=>{
            //         if(admin){
            //             m.sendMessage2({
            //                 chat_id: req.body.message.reply_to_message.chat.id,
            //                 text: req.body.message.text
            //             },false,token).then(()=>{
            //                 messages.add({
            //                     user: req.body.message.reply_to_message.chat.id,
            //                     text: req.body.message.text || null,
            //                     createdAt: new Date(),
            //                     isReply: true
            //                 })
            //             })
            //         } 
            //     })
            // } else 

            if (req.body.message.text) {
                messages.add({
                    user: user.id,
                    text: req.body.message.text || null,
                    createdAt: new Date(),
                    isReply: false
                })

                switch (req.body.message.text) {
                    case '/subscriptions':
                        checkUser(user.id).then(p => {
                            if (p) return sendSubs(user.id, user.language_code)
                            sorry(user, `просмотре данных о залах`)
                        })
                        break;
                    case '/halls':
                        checkUser(user.id).then(p => {
                            if (p) return sendHalls(user.id, user.language_code)
                            sorry(user, `просмотре данных о залах`)
                        })
                        break;

                    case '/classes':
                        checkUser(user.id).then(p => {
                            if (p) return sendClasses(user.id, user.language_code)
                            sorry(user, `просмотре данных о лекциях`)
                        })

                        break;
                    case '/coworking':
                        checkUser(user.id).then(p => {
                            if (p) return sendCoworking(user)
                            sorry(user, `доступе к коворкингу`)
                        })

                        break;

                    case '/app':
                        m.sendMessage2({
                            chat_id: user.id,
                            text: `приложение находится в режиме разработки`,
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: `test`,
                                        web_app: {
                                            url: `${ngrok}/auditoria/app2`
                                        }
                                    }]
                                ]
                            }
                        }, false, token)

                        break;
                    case '/pro':
                        m.sendMessage2({
                            chat_id: user.id,
                            text: `Админка с дева ${ngrok}:`,
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: `test`,
                                        web_app: {
                                            url: `${ngrok}/auditoria/admin`
                                        }
                                    }]
                                ]
                            }
                        }, false, token)

                        m.sendMessage2({
                            chat_id: user.id,
                            text: `Приложенька с дева ${ngrok}`,
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: `test`,
                                        web_app: {
                                            url: `${ngrok}/auditoria/app2`
                                        }
                                    }]
                                ]
                            }
                        }, false, token)

                        break;
                    case '/myclasses':
                        checkUser(user.id).then(p => {
                            if (p) return sendUserClasses(user.id, user.language_code)
                            sorry(user)
                        })

                        break;
                    case '/meetingroom':
                        checkUser(user.id).then(p => {
                            if (p) return sendMeetingRoom(user)
                            sorry(user, 'доступе к переговорке')
                        })


                        break;
                    case '/bookings':
                        checkUser(user.id).then(p => {
                            if (p) return showBookings(user.id)
                            sorry(user)
                        })


                        break;
                    default:


                        if (req.body.message.text != '/start') {
                            m.sendMessage2({
                                chat_id: common.dimazvali,
                                text: `@${user.username} пишет что-то странное: ${req.body.message.text}`
                            }, false, token)
                        }

                        break;
                }
            }

            if (req.body.message.photo) {
                udb.where('admin','==',true).get().then(col=>{
                    let admins = common.handleQuery(col)
                    admins.forEach(a=>{
                        if(a.id == common.dimazvali) m.sendMessage2({
                            chat_id:    a.id,
                            caption:    `фото от ${common.uname(u.data(),u.id)}`,
                            photo:      req.body.message.photo[0].file_id
                        }, 'sendPhoto', token)
                    })

                    userClasses
                        .where(`active`,'==',true)
                        .where(`user`,'==',+u.id)
                        .get()
                        .then(col=>{
                            let tickets = common.handleQuery(col)

                            common.devlog(tickets)

                            if(tickets.length){
                                let data = [];
                                tickets.forEach(t=>{
                                    data.push(classes.doc(t.class).get().then(d=>{
                                        return {
                                            record: t.id,
                                            class: d.data()
                                        }
                                    }))
                                })

                                Promise.all(data).then(d=>{
                                    admins.forEach(a=>{
                                        m.sendMessage2({
                                            chat_id:    a.id,
                                            text:       `Если это чек, то вот неоплаченные билеты:`,
                                            reply_markup:{
                                                inline_keyboard:
                                                    d.map(t=>{
                                                        return [{
                                                            text: t.class.name,
                                                            callback_data: `payClass_${t.record}`
                                                        }]
                                                    })
                                                
                                            }
                                        }, false, token)
                                    })
                                })
                            }
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

        if(inc[0] == `payClass`){

            common.devlog(`это оплата`)

            userClasses.doc(inc[1]).get().then(ticket=>{
                if(!ticket.exists) return m.sendMessage2({
                    callback_query_id: req.body.callback_query.id,
                    show_alert: true,
                    text: `Нет такого билета (`
                }, 'answerCallbackQuery', token)

                ticket = ticket.data();

                if(!ticket.active) return m.sendMessage2({
                    callback_query_id: req.body.callback_query.id,
                    show_alert: true,
                    text: `Билет недоступен.`
                }, 'answerCallbackQuery', token)

                if(ticket.isPayed){
                    return m.sendMessage2({
                        callback_query_id: req.body.callback_query.id,
                        show_alert: true,
                        text: `Билет уже оплачен`
                    }, 'answerCallbackQuery', token)
                }

                userClasses.doc(inc[1]).update({
                    updatedAt:  new Date(),
                    isPayed:    new Date(),
                    updatedBy:  user.id
                }).then(()=>{
                    m.sendMessage2({
                        callback_query_id: req.body.callback_query.id,
                        show_alert: true,
                        text: `Вы отметили билет как оплаченный.`
                    }, 'answerCallbackQuery', token)

                    m.sendMessage2({
                        chat_id: ticket.user,
                        text: `Ваш билет на мероприятие ${ticket.className} успешно оплачен.`
                    },false,token)
                })
                
            })

            

        }

        if (inc[0] == 'schedule') {
            switch (inc[1]) {
                case 'course': {
                    sendClasses(user.id, user.language_code, [`courseId`, '==', inc[2]])
                    break;
                }
                case 'author': {
                    sendClasses(user.id, user.language_code, [`authorId`, '==', inc[2]])
                    break;
                }
                default: {
                    // непонятный запрос
                    break;
                }
            }
        }

        if (inc[0] == `course`) {
            let cref = courses.doc(inc[1])
            cref.get().then(c => {
                if (!c.exists) {
                    // нет курса
                }
                c = c.data();
                c.id = inc[1];

                if (!c.active) {
                    // курс недоступен
                } else {
                    cref.update({
                        views: FieldValue.increment(1)
                    })
                    sendCourse(req.body.callback_query.from, c)
                }
            })
        }

        if (inc[0] == 'subs') {
            switch (inc[1]) {
                case `delete`: {
                    subscriptions.doc(inc[2]).delete().then(() => {
                        m.sendMessage2({
                            callback_query_id: req.body.callback_query.id,
                            show_alert: true,
                            text: translations.deletedSubscription[user.language_code] || translations.deletedSubscription.en
                        }, 'answerCallbackQuery', token)
                    })
                    break;
                }
                default: {
                    subscriptions.add({
                        user: user.id,
                        [inc[1]]: inc[2],
                        createdAt: new Date()
                    }).then(rec => {
                        m.sendMessage2({
                            callback_query_id: req.body.callback_query.id,
                            show_alert: true,
                            text: translations.addedSubscription[user.language_code] || translations.addedSubscription.en
                        }, 'answerCallbackQuery', token)
                    })
                }
            }
        }

        if (inc[0] == 'author') {
            authors.doc(inc[1]).get().then(a => {
                if (!a.exists) {
                    // автор не найден
                }

                let author = a.data();

                authors.doc(inc[1]).update({
                    views: FieldValue.increment(1)
                })

                courses
                    .where(`authorId`, '==', inc[1])
                    .where('active', '==', true)
                    .get()
                    .then(c => {
                        let cd = common.handleQuery(c)

                        console.log(cd)

                        subscriptions
                            .where(`author`, '==', inc[1])
                            .where('user', '==', user.id)
                            .get()
                            .then(s => {
                                let subscription = s.docs.length ? s.docs[0].id : false;

                                m.sendMessage2({
                                    chat_id: user.id,
                                    photo: author.pic || randomPic(),
                                    caption: '*' + author.name + '*\n' + author.description,
                                    reply_markup: {
                                        inline_keyboard: cd.map(c => {

                                            return [{
                                                text: `Курс «${c.name}»`,
                                                callback_data: `course_${c.id}`
                                            }]
                                        }).concat([
                                            [{
                                                text: subscription ? (translations.unsubscribe[user.language_code] || translations.unsubscribe.en) : (translations.subscribe[user.language_code] || translations.subscribe.en),
                                                callback_data: subscription ? `subs_delete_${subscription}` : `subs_author_${inc[1]}`
                                            }]
                                        ]).concat([
                                            [{
                                                text: translations.schedule[user.language_code] || translations.schedule.en,
                                                callback_data: `schedule_author_${inc[1]}`
                                            }]
                                        ])


                                    }
                                }, 'sendPhoto', token)
                            })

                    })
            })
        }

        if (inc[0] == 'admin') {
            switch (inc[1]) {
                case 'log': {
                    console.log('обновления подписок', inc[2])
                    switch (inc[2]) {
                        case 'unsubscribe': {
                            isAdmin(user.id.toString()).then(proof => {

                                console.log(proof)

                                if (!proof) return m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: `Простите великодушно, но вы же не админ. Как вы вообще получили эту кнопку?..`
                                }, 'answerCallbackQuery', token)



                                udb.doc(user.id.toString()).update({
                                    stopLog: true
                                }).then(() => {

                                    console.log('Обновили')
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
                                    text: `Админ @${user.username} заблокировал пользователя @${userdata.username}`,
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
                        case 'insider': {
                            udb.doc(inc[2]).update({
                                insider: true,
                                updatedAt: new Date(),
                                updatedBy: +user.id
                            }).then(() => {


                                log({
                                    text: `Админ @${user.username} сделал пользователя @${userdata.username} сотрудником`,
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
                                    text: `Админ @${user.username} сделал пользователя @${userdata.username} равным себе`,
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
                                    text: 'Поздравляем, вы зарегистрированы как админ приложения! Чтобы открыть админку, отправьте /pro'
                                }, false, token)

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

        if (inc[0] == 'mr') {


            switch (inc[1]) {

                case 'repeat': {
                    sendMeetingRoom(user)
                }
                case 'date': {

                    return mra
                        .where('active', '==', true)
                        .where('date', '==', inc[2])
                        .get()
                        .then(data => {

                            // console.log(data)
                            tt = common.handleQuery(data).sort((a, b) => b.time - a.time)
                            let shift = 0;
                            let start = new Date().setHours(10, 0, 0);
                            let ts = [];

                            console.log(tt)

                            while (shift < 10) {
                                let h = [];
                                let time = new Date(+start + shift * 60 * 60 * 1000).toTimeString().split(' ')[0].split(':').slice(0, 2).join(':')
                                let time2 = new Date(+start + shift * 60 * 60 * 1000 + 30 * 60 * 1000).toTimeString().split(' ')[0].split(':').slice(0, 2).join(':')

                                h.push({
                                    text: `${tt.filter(s=>s.time == time).length ? '❌' : '✔️'} ${time}`,
                                    callback_data: `mr_book_${inc[2]}_${time}`
                                }, {
                                    text: `${tt.filter(s=>s.time == time2).length ? '❌' : '✔️'} ${time2}`,
                                    callback_data: `mr_book_${inc[2]}_${time2}`
                                })

                                ts.push(h)

                                shift++
                            }

                            console.log(ts)


                            m.sendMessage2({
                                chat_id: user.id,
                                text: (translations.dateSelected(inc[2])[user.language_code] || translations.dateSelected(inc[2]).en) + '\n' + (translations.chooseTime[user.language_code] || translations.chooseTime.en),
                                message_id: req.body.callback_query.message.message_id
                            }, 'editMessageText', token).then(() => {
                                m.sendMessage2({
                                    chat_id: user.id,
                                    message_id: req.body.callback_query.message.message_id,
                                    reply_markup: {
                                        inline_keyboard: ts
                                    }
                                }, 'editMessageReplyMarkup', token)
                            })
                        }).catch(err => {
                            console.log(err)
                        })

                    break;
                }
                case 'book': {

                    return bookMR(inc[2], inc[3], user.id, req.body.callback_query)
                    // return mra
                    //     .where('date', '==', inc[2])
                    //     .where('time', '==', inc[3])
                    //     .where('active', '==', true)
                    //     .get()
                    //     .then(col => {
                    //         if (col.docs.length) {
                    //             m.sendMessage2({
                    //                 callback_query_id: req.body.callback_query.id,
                    //                 show_alert: true,
                    //                 text: translations.noSeatsLeft[user.language_code] || translations.noSeatsLeft.en
                    //             }, 'answerCallbackQuery', token)
                    //         } else {
                    //             m.sendMessage2({
                    //                 callback_query_id: req.body.callback_query.id,
                    //                 text: translations.onIt[user.language_code] || translations.noSeatsLeft.en
                    //             }, 'answerCallbackQuery', token)
                    //             mra.add({
                    //                 user: user.id,
                    //                 date: inc[2],
                    //                 time: inc[3],
                    //                 active: true,
                    //             }).then(rec => {

                    //                 log({
                    //                     text: `${user.username} забронировал место в переговорке на ${inc[3]} ${inc[2]}`,
                    //                     user: user.id,
                    //                 })

                    //                 m.sendMessage2({
                    //                     chat_id: user.id,
                    //                     text: `${(translations.dateSelected(inc[2])[user.language_code] || translations.dateSelected(inc[2]).en)}\n${(translations.timeSelected(inc[3])[user.language_code] || translations.timeSelected(inc[3]).en)}\n${translations.coworkingBookingConfirmed[user.language_code] || translations.coworkingBookingConfirmed.en}`,
                    //                     message_id: req.body.callback_query.message.message_id
                    //                 }, 'editMessageText', token).then(() => {
                    //                     m.sendMessage2({
                    //                         chat_id: user.id,
                    //                         message_id: req.body.callback_query.message.message_id,
                    //                         reply_markup: {
                    //                             inline_keyboard: [
                    //                                 [{
                    //                                     text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                    //                                     callback_data: `mr_unbook_${rec.id}`
                    //                                 }]
                    //                             ]
                    //                         }
                    //                     }, 'editMessageReplyMarkup', token)
                    //                 })
                    //             })
                    //         }
                    //     })
                    break;
                }
                case 'unbook': {
                    return unbookMR(inc[2], user.id, req.body.callback_query)
                    break;
                }
                default:
                    break;
            }

        }

        if (inc[0] == 'coworking') {
            switch (inc[1]) {
                case 'book': {
                    return coworking
                        .where('date', '==', inc[2])
                        .where('active', '==', true)
                        .where('user', '==', user.id)
                        .get()
                        .then(col => {
                            if (col.docs.length) {
                                return m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: translations.alreadyBooked[user.language_code] || translations.alreadyBooked.en
                                }, 'answerCallbackQuery', token)
                            } else {
                                coworking.add({
                                    createdAt: new Date(),
                                    active: true,
                                    user: user.id,
                                    date: inc[2]
                                }).then(rec => {
                                    m.sendMessage2({
                                        chat_id: user.id,
                                        photo: ngrok + `/auditoria/qr?id=${rec.id}&entity=coworking`,
                                        caption: translations.coworkingBookingDetails(inc[2], user.language_code)[user.language_code] || translations.coworkingBookingDetails(inc[2], user.language_code).en,
                                        reply_markup: {
                                            inline_keyboard: [
                                                [{
                                                    text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                                                    callback_data: `coworking_unbook_${rec.id}`
                                                }]
                                            ]
                                        }
                                    }, 'sendPhoto', token)
                                    log({
                                        text: `@${user.username} просит место в коворкинге на ${inc[2]}`
                                    })
                                })
                            }
                        })
                }
                case 'unbook': {
                    return coworking.doc(inc[2]).get().then(rec => {
                        if (!rec.exists) {
                            return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: translations.noAppointment[user.language_code] || translations.noAppointment.en
                            }, 'answerCallbackQuery', token)
                        }
                        if (rec.data().active) {
                            coworking.doc(inc[2]).update({
                                active: false,
                                updatedAt: new Date()
                            }).then(() => {
                                m.sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text: translations.bookingCancelled[user.language_code] || translations.bookingCancelled.en
                                }, 'answerCallbackQuery', token)
                                log({
                                    text: `@${user.username} снимает запись в коворкинг на ${rec.data().date}`
                                })
                            })
                        } else {
                            return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: translations.alreadyCancelled[user.language_code] || translations.alreadyCancelled.en
                            }, 'answerCallbackQuery', token)
                        }

                    })
                }
                default: {
                    break
                }
            }
        }

        if (inc[0] == 'ca') {
            switch (inc[1]) {
                case 'set': {
                    halls.doc(inc[2]).get().then(hall => {
                        hall = hall.data()
                        if (!hall.active) {
                            return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: translations.hallNotAvailable[user.language_code] || translations.hallNotAvailable.en
                            }, 'answerCallbackQuery', token)
                        } else {
                            coworking
                                .where('hall', '==', inc[2])
                                .where('date', '==', inc[3])
                                .where('active', '==', true)
                                .get()
                                .then(col => {

                                    let users = common.handleQuery(col).map(r => r.user)

                                    if (users.indexOf(user.id) > -1) {
                                        return m.sendMessage2({
                                            callback_query_id: req.body.callback_query.id,
                                            show_alert: true,
                                            text: translations.alreadyBooked[user.language_code] || translations.alreadyBooked.en
                                        }, 'answerCallbackQuery', token)
                                    } else if (users.length == hall.capacity) {
                                        return m.sendMessage2({
                                            callback_query_id: req.body.callback_query.id,
                                            show_alert: true,
                                            text: translations.noSeatsLeft[user.language_code] || translations.noSeatsLeft.en
                                        }, 'answerCallbackQuery', token)
                                    } else {
                                        udb.doc(user.id.toString()).get().then(u => {

                                            if (u.data().blocked) {
                                                return m.sendMessage2({
                                                    chat_id: user.id,
                                                    text: translations.youArBanned[user.language_code] || translations.youArBanned.en
                                                }, false, token)
                                            }

                                            coworking.add({
                                                user: user.id,
                                                hall: inc[2],
                                                date: inc[3],
                                                createdAt: new Date(),
                                                active: true,
                                                paymentNeeded: u.data().insider ? true : false,
                                                payed: false
                                            }).then(rec => {

                                                log({
                                                    text: `@${user.username || user.first_name+' '+users.last_name} бронирует место в коворкинге ${hall.name} на ${inc[3]}`,
                                                    user: user.id,
                                                    hall: inc[2]
                                                })

                                                let pl = {
                                                    active: true,
                                                    id: rec.id,
                                                    intention: 'bookCoworking',
                                                    hall: inc[2],
                                                    date: inc[3],
                                                    user: user.id,
                                                    userName: (user.first_name + ' ' + user.last_name),
                                                    paymentNeeded: u.data().insider ? true : false,
                                                    payed: false
                                                }

                                                axios.post(sheet, Object.keys(pl).map(k => `${k}=${pl[k]}`).join('&'), {
                                                    headers: {
                                                        "Content-Type": "application/x-www-form-urlencoded"
                                                    }
                                                })

                                                m.sendMessage2({
                                                    chat_id: user.id,
                                                    text: translations.coworkingBookingConfirmed[user.language_code] || translations.coworkingBookingConfirmed.en,
                                                    message_id: req.body.callback_query.message.message_id
                                                }, 'editMessageText', token).then(() => {
                                                    m.sendMessage2({
                                                        chat_id: user.id,
                                                        message_id: req.body.callback_query.message.message_id,
                                                        reply_markup: {
                                                            inline_keyboard: [
                                                                [{
                                                                    text: translations.coworkingBookingCancel[user.language_code] || translations.coworkingBookingCancel.en,
                                                                    callback_data: `ca_cancel_${rec.id}`
                                                                }]
                                                            ]
                                                        }
                                                    }, 'editMessageReplyMarkup', token)

                                                })
                                            })
                                        })
                                    }
                                })
                        }
                    })
                    break;
                }

                case 'cancel': {
                    coworking.doc(inc[2]).get().then(record => {

                        if (!record.exists) {
                            return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: translations.noAppointment[user.language_code] || translations.noAppointment.en
                            }, 'answerCallbackQuery', token)
                        }

                        record = record.data();

                        if (user.id !== record.user) {
                            return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: translations.unAuthorized[user.language_code] || translations.unAuthorized.en
                            }, 'answerCallbackQuery', token)
                        }

                        if (!record.active) {
                            return m.sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text: translations.alreadyCancelled[user.language_code] || translations.alreadyCancelled.en
                            }, 'answerCallbackQuery', token)
                        }



                        coworking.doc(inc[2]).update({
                            active: false,
                            updatedAt: new Date(),
                            updatedBy: user.id
                        }).then(() => {
                            log({
                                text: `@${user.username} отменяет запись в коворкинге на ${record.date}`
                            })

                            m.sendMessage2({
                                chat_id: user.id,
                                text: translations.bookingCancelled[user.language_code] || translations.bookingCancelled.en,
                                message_id: req.body.callback_query.message.message_id
                            }, 'editMessageText', token).then(() => {
                                m.sendMessage2({
                                    chat_id: user.id,
                                    message_id: req.body.callback_query.message.message_id,
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{
                                                text: translations.letsTryAgain[user.language_code] || translations.letsTryAgain.en,
                                                callback_data: `ca_repeat`
                                            }]
                                        ]
                                    }
                                }, 'editMessageReplyMarkup', token)

                            })

                        })
                    })
                    break
                }

                default:
                    break;
            }
        }

        if (inc[0] == 'unclass') {

            m.sendMessage2({
                chat_id: user.id,
                message_id: req.body.callback_query.message.message_id
            }, 'unpinChatMessage', token)

            userClasses.doc(inc[1]).get().then(appointment => {
                if (!appointment.exists) {
                    m.sendMessage2({
                        chat_id: user.id,
                        text: translations.noAppointment[user.language_code] || translations.noAppointment.en
                    }, false, token)
                } else {
                    if (appointment.data().user == user.id) {
                        userClasses.doc(inc[1]).update({
                            active: false
                        }).then(() => {

                            userClasses.doc(inc[1]).get().then(d => {
                                classes.doc(d.data().class).get().then(c => {
                                    log({
                                        text: `@${user.username} отказывается от места на лекции  ${c.data().name}`,
                                        user: user.id,
                                        class: d.data().class
                                    })
                                })
                            })



                            m.sendMessage2({
                                chat_id: user.id,
                                text: translations.appointmentCancelled[user.language_code] || translations.appointmentCancelled.en
                            }, false, token)


                            axios.post(sheet, `intention=unClass&appointment=${inc[1]}`, {
                                headers: {
                                    "Content-Type": "application/x-www-form-urlencoded"
                                }
                            })

                        })
                    } else {
                        m.sendMessage2({
                            chat_id: user.id,
                            text: translations.unAuthorized[user.language_code] || translations.noAppointment.en
                        }, false, token)
                    }
                }

            })
        }

        if (inc[0] == 'class') {

            bookClass(user, inc[1], false)


            // classes.doc(inc[1]).get().then(c=>{

            //     if(!c.exists) return res.sendStatus(404)


            // })

        }

        if (inc[0] == 'pay') {
            userClasses.doc(inc[1]).get().then(appointment => {
                if (!appointment.exists) {
                    m.sendMessage2({
                        chat_id: user.id,
                        text: translations.noAppointment[user.language_code] || translations.noAppointment.en
                    }, false, token)
                } else {
                    if (appointment.data().payed) {
                        m.sendMessage2({
                            chat_id: user.id,
                            text: translations.alreadyPayed[user.language_code] || translations.alreadyPayed.en
                        }, false, token)
                    } else {

                        classes.doc(appointment.data().class).get().then(c => {
                            m.sendMessage2({
                                "chat_id": user.id,
                                "title": translations.paymentTitleClass(c.data())[user.language_code] || translations.paymentTitleClass(c.data()).en,
                                "description": translations.paymentDesc[user.language_code] || translations.paymentDesc.en,
                                "payload": inc[1],
                                "provider_token": paymentToken,
                                "currency": "GEL",
                                "prices": [{
                                    "label": "входной билет",
                                    "amount": c.data().price * 100
                                }]

                            }, 'sendInvoice', token)
                        })

                    }
                }
            })

        }
    }
})

router.post(`/api/:type`,(req,res)=>{
    switch(req.params.type){
        case `subscribe`:{
            devlog('подписочка')
            if(req.method == `POST`){
                let subTypes = {
                    authors: `автора`,
                    courses: `курс` 
                }
                if(!req.body.mail) return res.status(400).send(`Укажите почту`)
                if(!req.body.type) return res.status(400).send(`Укажите тип подписки`)
                if(!subTypes[req.body.type]) return res.status(400).send(`Некорректный тип подписки`)
                if(!req.body.id) return res.status(400).send(`Укажите, на кого подписаться`)
                

                return subscriptionsEmail
                    .where(`mail`,'==',req.body.mail)
                    .where(`active`,'==',true)
                    .where(`type`,'==',req.body.type)
                    .where(`id`,'==',req.body.id)
                    .get()
                    .then(col=>{
                        if(col.docs.length) return res.status(400).send(`Вы уже подписаны`)
                        
                        fb.collection(req.body.type).doc(req.body.id).get().then(s=>{
                            
                            if(!s.exists) return res.status(404).send(`не найдено`)
                            
                            s = common.handleDoc(s)

                            if(!s.active) return res.status(400).send(`Слишком старо...`)

                            return subscriptionsEmail.add({
                                active: false,
                                type:   req.body.type,
                                mail:  req.body.mail,
                                id:     req.body.id
                            }).then(rec=>{
                                transporter.sendMail({
                                    from:       'au <vapeclub.show@yandex.ru>',
                                    to:         req.body.mail,
                                    subject:    `Подписка на ${subTypes[req.body.type]} ${s.name}`,
                                    text:       `Кто-то только что попросил подписать эту почту на обновления «${s.name}».\nЕсли это были вы, пройдите по ссылке ${ngrok}/${host}/site/subscriptions?subscription=${rec.id}.\nЕсли это были не вы, просто проигнорируйте это сообщение`
                                })
                                res.sendStatus(200)
                            })

                        })

                        
                    })
                
            }
        }
        default:{
            return res.sendStatus(404)
        }
    }
})

router.get(`/api/:type`, (req, res) => {
    devlog(req.method)
    switch (req.params.type) {
        case `menu`:{
            return res.json({
                categories: menuCategories,
                dishes: menuDishes
            })
        }
        case 'subscriptions':{
            if(!req.query.user) return res.sendStatus(400)
            return subscriptions
                .where(`active`,'==',true)
                .where(`user`,'==',+req.query.user)
                .get()
                .then(col=>{
                    let subs = common.handleQuery(col)
                    let authorsList = [];
                    let coursesList = [];
                    subs.forEach(s=>{
                        if(s.author){
                            authorsList.push(
                                authors.doc(s.author).get().then(a=>{
                                    let t = a.data();
                                        t.id = s.author;
                                    return t
                                })
                            )
                        }
                        if(s.course){
                            coursesList.push(
                                courses.doc(s.course).get().then(a=>{
                                    let t = a.data();
                                        t.id = s.course;
                                    return t
                                })
                            )
                        }
                    })
                    Promise.all(authorsList).then(al=>{
                        Promise.all(coursesList).then(cl=>{

                            common.devlog(subs)
                            res.json({
                                subs:       subs,
                                authors:    al,
                                courses:    cl
                            })
                        })
                    })
                })
        }
        
        case 'user': {
            if (!req.query.id) return res.sendStatus(400)

            userEntries.add({
                user: +req.query.id,
                createdAt: new Date()
            }).then(() => {

                udb.doc(req.query.id).update({
                    appOpens: FieldValue.increment(1)
                })
                
                udb.doc(req.query.id).get().then(u=>{
                    if(u.data().admin){
                        return res.json({admin:true})
                    }
                    return res.sendStatus(200)
                })

                
            })
            break;
        }
        case `profile`:{
            if(!req.query.user) return res.sendStatus(400)
            let data = []
                data.push(streams
                    .where('active','==',true)
                    .where(`user`,'==',+req.query.user)
                    .get()
                    .then(col=>common.handleQuery(col))
                )

                // data.push(subscriptions
                //     .where('active','==',true)
                //     .where(`user`,'==',+req.query.user)
                //     .get()
                //     .then(col=>common.handleQuery(col))
                // )

                data.push(userClasses
                    .where('active','==',true)
                    .where(`user`,'==',+req.query.user)
                    .get()
                    .then(col=>common.handleQuery(col))
                )

                data.push(plansUsers
                    .where('active','==',true)
                    .where(`user`,'==',+req.query.user)
                    .get()
                    .then(col=>common.handleQuery(col))
                )

                return Promise.all(data).then(data=>{
                    
                    common.devlog(data)
                    
                    let details = [];

                    data[0].forEach(r=>{
                        details.push(classes.doc(r.class).get().then(d=> common.handleDoc(d)))
                    })

                    data[1].forEach(r=>{  
                        details.push(classes.doc(r.class).get().then(d=>common.handleDoc(d)))
                    })

                    Promise.all(details).then(d=>{

                        common.devlog(d)

                        let tickets = [];
                        let streams = [];

                        data[0].forEach(stream=>{
                            let t = d.filter(d=>d.id == stream.class)[0]
                                t.booked =  stream.id;
                                t.status =  stream.status;
                                t.payed =   stream.isPayed;
                                t.stream =  true;
                            streams.push(t)
                        })

                        data[1].forEach(stream=>{
                            let t = d.filter(d=>d.id == stream.class)[0]
                                t.booked = stream.id;
                                t.status = stream.status;
                                t.payed =   stream.isPayed;
                            tickets.push(t)
                        })

                        res.json({
                            streams:        streams,
                            schedule:       tickets,
                            plans:          data[2]
                        })
                    })

                    

                    
                })

            break;
        }
        case 'classes': {

            let data = []



            data.push(classes
                .where(`active`, '==', true)
                .where('date', '>=', new Date())
                .orderBy('date')
                .get().then(col => common.handleQuery(col)))

            data.push(userClasses
                .where('active', '==', true)
                .where('user', '==', +req.query.user)
                .get().then(col => common.handleQuery(col)))

            Promise.all(data).then(data => {

                console.log(data[1])
                let result = []
                data[0].forEach(c => {
                    if (data[1].filter(uc => c.id == uc.class).length) {
                        c.booked =  data[1].filter(uc => c.id == uc.class)[0].id;
                        c.payed =   data[1].filter(uc => c.id == uc.class)[0].isPayed || false;
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
            let dates = [];
            let shift = 0;
            while (shift<7){
                dates.push(new Date(+new Date()+shift*24*60*60*1000).toISOString().split('T')[0])
                shift++;
            }
            coworking
                .where('active','==',true)
                .where('date','in',dates)
                .get()
                .then(col=>{
                    res.json(common.handleQuery(col))
                })
            break;
        }
        default:
            return res.json([])
    }
})


class apiHall {
    constructor(h) {
        this.active = h[1] || null,
            this.name = h[2] || null,
            this.floor = h[3] || null,
            this.description = h[4] || null,
            this.capacity = h[5] || null,
            this.pics = h[6] || null,
            this.price = h[7] || null,
            this.isCoworking = h[8] || null,
            this.isMeetingRoom = h[9] || null,
            this.createdAt = new Date(),
            this.updatedAt = new Date()
    }
}

class lecture {
    constructor(l) {
        this.active =   l[1] || null,
        this.date =     l[2] || null,
        this.time =     l[3] || null,
        this.name =     l[4] || null,
        this.descShort = l[5] || null,
        this.descLong = l[6] || null,
        this.hall =     l[7] || null,
        this.author =   l[8] || null,
        this.authorId = l[9] || null,
        this.course =   l[10] || null
        this.courseId = l[11] || null
        this.kids =     l[12] || null,
        this.age =      l[13] || null,
        this.price =    l[14] || null,
        this.price2 =   l[15] || null,
        this.price3 =   l[16] || null,
        this.pic =      l[17] || null,
        this.capacity = l[18] || null,
        this.createdAt = new Date()
    }
    get toJS() {
        return JSON.parse(JSON.stringify(this))
    }
}


class apiLector {
    constructor(l) {
        this.active = l[0] || false;
        this.name = l[1] || null;
        this.description = l[3] || null;
        this.pic = l[4] || null;
    }

    get toJS() {
        return JSON.parse(JSON.stringify(this))
    }
}

class apiPlan {
    constructor(p){
        this.active =       p[1] || false,
        this.name =         p[2] || null,
        this.description=   p[3] || null,
        this.courseId =     p[4] || null,
        this.price =        p[5] || null,
        this.days =         p[6] || 0,
        this.events =       p[7] || 0
    }

    get toJS() {
        return JSON.parse(JSON.stringify(this))
    }
}

class apiCourse {
    constructor(c) {
        this.active = c[0] || false;
        this.name = c[1] || null;
        this.description = c[3] || null;
        this.pic = c[4] || null;
        this.kids = c[5] || null;
        this.author = c[6] || null;
        this.authorId = c[7] || null;
    }

    get toJS() {
        return JSON.parse(JSON.stringify(this))
    }
}

router.post(`/views/:type/:id`,(req,res)=>{
    
    if(!req.body.user) return res.status(400).send(`no user provided`)

    if(req.body.id == `undefinded`) return res.status(400).send(`no id provided`)

    views.add({
        createdAt:  new Date(),
        user:       +req.body.user,
        entity:     req.params.type,
        id:         req.params.id
    }).then(rec=>{
        res.send(rec.id)
        try {
            sections[req.params.type].doc(req.params.id).update({
                views: FieldValue.increment(+1)
            })
        } catch (error) {
            
        }
    })
    .catch(err=>{
        console.log(err)
    })
})

function alertClass(c, cid, u){
    let message = {
        chat_id: u.id,
        photo: c.pic,
        text: translations.newLecture(c)[u.language_code] || translations.newLecture(c).en,
        reply_markup: {
            inline_keyboard: [
                [{
                    text: translations.book[u.language_code] || translations.book[en],
                    callback_data: `class_${cid}`
                }]
            ]
        }
    }

    let method = false

    if(c.pic){
        message.caption = message.text
        method = `sendPhoto`
    }

    m.sendMessage2(message,method,token)
}

router.all(`/api/:data/:id`, (req, res) => {
    common.devlog(req.body)
    switch (req.params.data) {
        case `online`:{
            if(!req.query.user) return res.sendStatus(400);

            return m.getUser(req.query.user,udb).then(u=>{

                if(u.blocked) return res.json({
                    success: false,
                    comment: `youArBanned`
                })

                streams
                    .where(`active`,'==',true)
                    .where(`user`,'==',+req.query.user)
                    .where(`class`,'==',req.params.id)
                    .get()
                    .then(col=>{
                        common.devlog(common.handleQuery(col))
                        if(col.docs.length){
                            return res.json({
                                success: false,
                                comment: `alreadyBooked`
                            })
                        } else {
                            classes.doc(req.params.id).get().then(c=>{
                                if(!c.exists){
                                    return res.json({
                                        success: false,
                                        comment: `nosais`
                                    })
                                }
                                
                                c = c.data();

                                if(!c.active) return res.json({
                                    success: false,
                                    comment: `cancelled`
                                })

                                streams.add({
                                    status:     `new`,
                                    payed:      false,
                                    active:     true,
                                    createdAt:  new Date(),
                                    user:       +req.query.user,
                                    class:      req.params.id,
                                    className:  c.name,
                                    userName:   common.uname(u,u.id)
                                }).then(r=>{
                                    res.json({
                                        success:    true,
                                        ticket:     r.id,
                                        comment:    `Вы записались на трансляцию.`
                                    })

                                    m.sendMessage2({
                                        chat_id: req.query.user,
                                        text: `Вы записались на онлайн-трансляцию мероприятия ${c.name}. Мы пришлем вам ссылку и пароль за полчаса до начала.\nЧтобы оплатить трансляцию, пришлите ${common.cur(c.price3,`GEL`)} на ${c.paymentDesc || `счет GE28TB7303145064400005`} — и скиньте мне скриншот с подтверждением.` 
                                    },false,token)
                                })
                            })
                        }
                    })

            })
        }
        case 'subscriptions':{
            switch(req.method){
                case `DELETE`:{
                    let ref = subscriptions.doc(req.params.id)
                    return ref.get().then(s=>{
                        if(!s.exists) return res.sendStatus(404)
                        if(!req.query.user) return res.sendStatus(401)
                        
                        s = s.data()

                        common.devlog(s.user)
                        common.devlog(+req.query.user)

                        if(s.user != +req.query.user) return res.sendStatus(403)
                        
                        ref.update({
                            active:     false,
                            updatedAt:  new Date()
                        }).then(()=>{
                            res.sendStatus(200)
                        }).catch(err=>{
                            console.log(err)
                            res.status(500).send(err.message)
                        })
                    })
                }
                case 'POST':{
                    if(!req.body.type || !req.body.user || !req.body.id) res.sendStatus(400)
                    return subscriptions.add({
                        active:             true,
                        createdAt:          new Date(),
                        [req.body.type]:    req.body.id,
                        user:               +req.body.user
                    }).then(rec=>{
                        res.send(rec.id)
                    }).catch(err=>{
                        console.log(err)
                        res.status(500).send(err.message)
                    })
                }
            }
        }
        case 'plans':{
            common.devlog(`Обновление абонементов`)
            switch (req.method){
                case 'POST':{
                    let data = new apiPlan(req.body).toJS

                    return plans.add(data).then(record => {
                        res.json({
                            id: record.id
                        })
                    }).catch(err => {
                        res.status(500).send(err.message)
                    })
                }
                case 'PUT': {
                    return courses.doc(req.params.id).update(new apiCourse(req.body).toJS).then(() => res.sendStatus(200))
                }
                default:
                    return res.status(400)
            }
        }
        case `q`:{
            switch (req.method){
                case `GET`:{
                    return userClassesQ.doc(req.params.id).get().then(q=>{
                        if(!q.exists) return res.sendStatus(404)
                        q = q.data()
                        m.getUser(q.user,udb).then(user=>{
                            q.userData = user;
                            res.json(q)
                        })
                    })
                }
                case `POST`:{
                    return m.getUser(req.body.user,udb).then(u=>{
                        if(u){
                            if(req.body.text && req.body.class) {
                                userClassesQ.add({
                                    active:     true,
                                    createdAt:  new Date(),
                                    class:      req.body.class,
                                    user:       req.body.user,
                                    text:       req.body.text
                                }).then(s=>{

                                    alertAdmins({
                                        text: `Новый вопрос к лекции: _${req.body.text}_`
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
        case 'courses': {
            switch (req.method) {
                case 'POST': {

                    let data = new apiCourse(req.body).toJS

                    return courses.add(data).then(record => {
                        res.json({
                            id: record.id
                        })
                    }).catch(err => {
                        res.status(500).send(err.message)
                    })
                }
                case `GET`:{
                    let data = [];
                        
                        data.push(courses.doc(req.params.id).get().then(a=>a.data()))
                        
                        data.push(classes
                            .where(`active`,'==',true)
                            .where(`courseId`,'==',req.params.id)
                            .get()
                            .then(col=>{
                                return common.handleQuery(col).sort((a,b)=>b.date>a.date?-1:1)
                            })
                        )
                        data.push(subscriptions
                            .where(`active`,'==',true)    
                            .where(`course`,'==',req.params.id)
                            .get()
                            .then(col=>common.handleQuery(col))
                        )

                        data.push(plans
                            .where('active','==',true)
                            .where('courseId','==',req.params.id)
                            .get()
                            .then(col=>common.handleQuery(col))
                        )
                    return Promise.all(data)
                        .then(data=>res.json({
                            course:         data[0],
                            classes:        data[1],
                            subscriptions:  data[2].length,
                            plans:          data[3],
                            subscribed:     req.query.user ? (data[2].filter(s=>s.user == +req.query.user).length ? data[2].filter(s=>s.user == +req.query.user)[0].id : false) : false
                        })).catch(err=>{
                            console.log(err)

                        })
                }
                
            }
        }
        case 'authors': {
            switch (req.method) {
                case 'POST': {

                    let data = new apiLector(req.body).toJS

                    return authors.add(data).then(record => {
                        res.json({
                            id: record.id
                        })
                    }).catch(err => {
                        res.status(500).send(err.message)
                    })
                }
                case `GET`:{
                    // return 
                    let data = [];
                        data.push(authors.doc(req.params.id).get().then(a=>a.data()))
                        data.push(classes
                            .where(`active`,'==',true)
                            .where(`authorId`,'==',req.params.id)
                            .get()
                            .then(col=>{
                                return common.handleQuery(col).sort((a,b)=>b.date>a.date?-1:1)
                            })
                        )
                        data.push(subscriptions
                            .where(`active`,'==',true)    
                            .where(`author`,'==',req.params.id)
                            .get()
                            .then(col=>common.handleQuery(col))
                            )
                    return Promise.all(data)
                        .then(data=>res.json({
                            author:         data[0],
                            classes:        data[1],
                            subscriptions:  data[2].length,
                            subscribed:     req.query.user ? (data[2].filter(s=>s.user == +req.query.user).length ? data[2].filter(s=>s.user == +req.query.user)[0].id : false) : false
                        })).catch(err=>{
                            console.log(err)

                        })
                    break;
                }
                case 'PUT': {
                    return authors.doc(req.params.id).update(new apiLector(req.body).toJS).then(() => res.sendStatus(200))
                }
                default:
                    return res.status(400)
            }
        }
        case 'halls': {
            switch (req.method) {
                case 'POST': {

                    let data = new apiHall(req.body)

                    return halls.add(data).then(record => {
                        res.json({
                            id: record.id
                        })
                    }).catch(err => {
                        res.status(500).send(err.message)
                    })
                }
                case 'PUT': {
                    return halls.doc(req.params.id).update(new apiHall(req.body)).then(() => res.sendStatus(200))
                }
                default:
                    return res.status(400)
            }
        }
        case `tickets`:{
            if(!req.query.user) return res.sendStatus(400)
            // if(!req.body.type) return res.sendStatus(400)
            switch(req.method){
                case `DELETE`:{
                    let ref = req.query.type == `stream` ? streams : userClasses;
                        ref = ref.doc(req.params.id)
                        return ref.get().then(t=>{
                            if(!t.exists) return res.sendStatus(404)
                            t = t.data()
                            if(!t.active) return res.json({
                                success: false,
                                comment: `Запись уже отменена`
                            })
                            if(t.user !== +req.query.user) return res.json({
                                success: false,
                                comment: `Это не ваш заказ!`
                            })
                            ref.update({
                                updatedAt:  new Date(),
                                active:     false
                            }).then(s=>{
                                res.json({
                                    success: true,
                                    comment: `Ваша запись отменена.`
                                })
                            })
                        }).catch(err=>{
                            res.json({
                                success: false,
                                comment: err.message
                            })
                        })                
                }
                case `GET`:{
                    return userClasses.doc(req.params.id).get().then(t=>{
                        if(!t.exists) return res.sendStatus(404)
                        t = t.data();
                        classes.doc(t.class).get().then(c=>{
                            c = c.data();
                            c.id = t.class;
                            c.booked = t.active ? req.params.id : false
                            c.payed = t.isPayed
                            res.json(c)
                        })
                    })
                }
            }
        }
        case 'classes': {
            switch (req.method) {
                case 'POST': {
                    if (req.query.intention == 'book') {
                        if (!req.query.user) return res.sendStatus(400)
                        return bookClass(false, req.params.id, res, req.query.user)

                    } else {

                        let data = new lecture(req.body).toJS

                        console.log(data)

                        return classes.add(data).then(record => {

                            res.json({
                                id: record.id
                            })

                            if (req.query.alert) {
                                udb.get().then(col => {
                                    let users = common.handleQuery(col)
                                    users.forEach((u, i) => {
                                        setTimeout(function () {
                                            alertClass(data, record.id, u)
                                        },i * 100)

                                    })
                                })
                            } else {
                                let checks = []

                                if (data.authorId) {
                                    checks.push(subscriptions.where(`author`, '==', data.authorId).get().then(col => {
                                        return common.handleQuery(col)
                                    }))
                                }

                                if (data.courseId) {
                                    checks.push(subscriptions.where(`course`, '==', data.courseId).get().then(col => {
                                        return common.handleQuery(col)
                                    }))
                                }

                                Promise.all(checks).then(toInform => {
                                    let informed = [];
                                    if (toInform[0]) toInform[0].forEach(sub => {
                                        m.sendMessage2({
                                            chat_id: sub.user,
                                            photo: data.pic || randomPic(),
                                            caption: `${data.author} проводит новое мерпориятие: ${data.name}`,
                                            reply_markup: {
                                                inline_keyboard: [
                                                    [{
                                                        text: translations.tellMeMore.en,
                                                        callback_data: `lecture_${record.id}`
                                                    }],
                                                    [{
                                                        text: translations.unsubscribe.en,
                                                        callback_data: `subs_delete_${sub.id}`
                                                    }]
                                                ]
                                            }
                                        }, 'sendPhoto', token)
                                    })

                                    if (toInform[1]) toInform[1].forEach(sub => {
                                        m.sendMessage2({
                                            chat_id: sub.user,
                                            caption: `Новое мерпориятие в курсе «${data.course}»: ${data.name}`,
                                            photo: data.pic || randomPic(),
                                            reply_markup: {
                                                inline_keyboard: [
                                                    [{
                                                        text: translations.tellMeMore.en,
                                                        callback_data: `lecture_${record.id}`
                                                    }],
                                                    [{
                                                        text: translations.unsubscribe.en,
                                                        callback_data: `subs_delete_${sub.id}`
                                                    }]
                                                ]
                                            }
                                        }, 'sendPhoto', token)
                                    })
                                })



                            }
                        }).catch(err => {
                            console.log(err)
                            res.status(500).send(err.message)
                        })
                    }

                }
                case 'PUT': {
                    let data = new lecture(req.body).toJS
                    return classes.doc(req.params.id).update(data).then(() => res.sendStatus(200))
                }
                case 'GET': {
                    classes
                        .where(`active`, '==', true)
                        .where('date', '>=', new Date())
                        .orderBy('date')
                        .get().then(col => {
                            res.json(common.handleQuery(col))
                        })
                }
                default:
                    return res.status(400)
            }
        }
        case 'class':{
            common.devlog(`Это класс`)
            switch(req.method){
                case 'GET':{
                    
                    common.devlog(`быстрый запрос билета`)

                    return classes.doc(req.params.id).get().then(c=>{
                        if(!c.exists) return res.sendStatus(404);
                        common.devlog(`занятие найдено`)
                        userClasses
                            .where(`class`,'==',req.params.id)
                            .where(`active`,'==',true)
                            .where(`user`,'==',+req.query.user)
                            .get()
                            .then(col=>{
                                
                                let tickets = common.handleQuery(col)
                                
                                if(tickets.length){
                                    
                                    common.devlog(`Билеты найдены`)

                                    let d = c.data();

                                        d.booked = tickets[0].id;
                                        d.payed = tickets[0].isPayed;

                                    res.json(d)
                                } else {
                                    res.json(c.data())
                                }
                            }).catch(err=>{
                                res.status(500).send(err.message)
                            })
                    })
                }
                default: 
                    return res.sendStatus(404)
            }    
        }
        case 'coworking': {
            switch (req.method) {
                case 'GET': {
                    return coworking
                        .where('active', '==', true)
                        .where('date', '>=', new Date().toISOString().split('T')[0])
                        .get().then(reservations => {

                            halls.doc(req.params.id).get().then(h => {
                                h = h.data()
                                reservations = common.handleQuery(reservations)


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
                    return coworking
                        .where('date', '==', req.query.date)
                        .where('active', '==', true)
                        .get()
                        .then(col => {

                            let users = common.handleQuery(col).map(r => r.user)

                            if (users.indexOf(req.query.user) > -1) {

                                return res.status(400).send('alreadyBooked')

                            } else if (users.length == 17) {

                                return res.status(400).send('noSeatsLeft')

                            } else {
                                udb.doc(req.query.user.toString()).get().then(u => {

                                    if (u.data().blocked) {

                                        return res.status(400).send('youArBanned')

                                    }

                                    coworking.add({
                                        user: req.query.user,
                                        hall: req.params.id,
                                        date: req.query.date,
                                        createdAt: new Date(),
                                        active: true,
                                        paymentNeeded: u.data().insider ? true : false,
                                        payed: false
                                    }).then(rec => {

                                        log({
                                            text: `${u.data().username || u.data().first_name+' '+u.data().last_name} бронирует место в коворкинге на ${req.query.date}`,
                                            user: req.query.user,
                                            hall: req.params.id
                                        })

                                        let pl = {
                                            active: true,
                                            id: rec.id,
                                            intention: 'bookCoworking',
                                            hall: req.params.id,
                                            date: req.query.date,
                                            user: req.query.user,
                                            userName: (u.data().first_name + ' ' + u.data().last_name),
                                            paymentNeeded: u.data().insider ? true : false,
                                            payed: false
                                        }

                                        axios.post(sheet, Object.keys(pl).map(k => `${k}=${pl[k]}`).join('&'), {
                                            headers: {
                                                "Content-Type": "application/x-www-form-urlencoded"
                                            }
                                        })


                                        res.json({
                                            text: 'coworkingBookingConfirmed',
                                            record: rec.id
                                        })


                                        m.sendMessage2({
                                            chat_id: req.query.user,
                                            photo: ngrok + `/auditoria/qr?id=${rec.id}&entity=coworking`,
                                            caption: translations.coworkingBookingDetails(req.query.date,false,u.data().language_code)[u.data().language_code] || translations.coworkingBookingDetails(req.query.date,false,'en').en,
                                            reply_markup: {
                                                inline_keyboard: [
                                                    [{
                                                        text: translations.coworkingBookingCancel[u.data().language_code] || translations.coworkingBookingCancel.en,
                                                        callback_data: `ca_cancel_${rec.id}`
                                                    }]
                                                ]
                                            }
                                        }, 'sendPhoto', token)
                                    })
                                })
                            }
                        })
                }
                case 'DELETE': {
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
                                text: `${req.query.user} отменяет запись в коворкинге ${record.date}`
                            })
                            res.send('appointmentCancelled')
                        })
                    }).catch(err => {
                        res.status(500).send('error')
                    })
                }
            }

        }
        case 'mr': {
            switch (req.method) {
                case 'POST': {
                    return bookMR(req.query.date, req.query.time, req.query.user, false, res)
                    break;
                }
                case 'DELETE': {
                    return unbookMR(req.params.id, req.query.user, false, res)
                    break;
                }
                default:
                    return res.status(404)
            }
        }
        case 'planCheck':{
            
            return getPlanWithUser(req.params.id,req.query.id).then(plan=>{
                if(plan) return res.json(plan)
                return res.sendStatus(404)
            })
        }
        case 'plan':{
            switch(req.method){
                case 'POST':{
                    return getPlanWithUser(req.params.id,req.query.user).then(p=>{
                        if(p) return res.sendStatus(400)
                        plans.doc(req.params.id).get().then(p=>{
                            if(!p.exists) return res.sendStatus(404)
                            p = p.data();
                            if(!p.active) return res.sendStatus(400)
                            
                            plansRequests.add({
                                active:     true,
                                isPayed:    false,
                                status:     `new`,
                                createdAt:  new Date(),
                                user:       +req.query.id,
                                plan:       req.params.id
                            }).then(rec=>{
                                res.send(rec.id)
                                m.sendMessage2({
                                    chat_id:    req.query.id,
                                    caption:    `Вы запросили абонемент ${p.name}. Пожалуйста, покажите этот код администратору площадки, чтобы подтвердить подписку.`,
                                    photo:      ngrok + `/auditoria/qr?id=${rec.id}&entity=planRequests`,
                                },'sendPhoto',token)
                            })

                            
                        })
                    })
                }
                case 'GET':{

                }
            }
            
        }
        default:
            res.status(404)
    }
})


function getPlanWithUser(plan,user){
    return plansUsers
        .where(`active`,'==',true)
        .where(`user`,'==',+user)
        .where(`plan`,'==',plan)
        // .where(`status`,'==','active')
        .get()
        .then(col=>{
            let d = common.handleQuery(col)[0]
            if (d) return d
            return false 
        }).catch(err=>{
            return err
        })
}

function bookMR(date, time, userid, callback, res) {
    udb.doc(userid.toString()).get().then(user => {
        user = user.data()
        user.id = +userid

        if (user.blocked) {
            if (res) {
                return res.json({
                    success: false,
                    text: `youArBanned`
                })
            }
            if (callback) {
                return m.sendMessage2({
                    callback_query_id: callback.id,
                    show_alert: true,
                    text: translations.youArBanned[user.language_code] || translations.youArBanned.en
                }, 'answerCallbackQuery', token)
            }
        }

        mra
            .where('date', '==', date)
            .where('time', '==', time)
            .where('active', '==', true)
            .get()
            .then(col => {
                if (col.docs.length) {
                    if (callback) {
                        m.sendMessage2({
                            callback_query_id: callback.id,
                            show_alert: true,
                            text: translations.noSeatsLeft[user.language_code] || translations.noSeatsLeft.en
                        }, 'answerCallbackQuery', token)
                    }
                    if (res) {
                        return res.json({
                            success: false,
                            text: 'noSeatsLeft'
                        })
                    }

                } else {
                    if (callback) {
                        m.sendMessage2({
                            callback_query_id: callback.id,
                            text: translations.onIt[user.language_code] || translations.noSeatsLeft.en
                        }, 'answerCallbackQuery', token)
                    }


                    mra.add({
                        user: user.id,
                        date: date,
                        time: time,
                        active: true,
                    }).then(rec => {

                        log({
                            text: `@${user.username} забронировал место в переговорке на ${time} ${date}`,
                            user: user.id,
                        })

                        if (callback) {
                            m.sendMessage2({
                                chat_id: user.id,
                                text: `${(translations.dateSelected(date)[user.language_code] || translations.dateSelected(date).en)}\n${(translations.timeSelected(time)[user.language_code] || translations.timeSelected(time).en)}\n${translations.coworkingBookingConfirmed[user.language_code] || translations.coworkingBookingConfirmed.en}`,
                                message_id: callback.message.message_id
                            }, 'editMessageText', token).then(() => {
                                m.sendMessage2({
                                    chat_id: user.id,
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
                            res.json({
                                success: true,
                                text: 'coworkingBookingConfirmed'
                            })
                            m.sendMessage2({
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
                            }, false, token)
                        }


                    })
                }
            })
    })
}

function unbookMR(id, userid, callback, res) {
    udb.doc(userid.toString()).get().then(user => {
        user = user.data()
        user.id = +userid

        if (callback) m.sendMessage2({
            callback_query_id: callback.id,
            text: translations.onIt[user.language_code] || translations.noSeatsLeft.en
        }, 'answerCallbackQuery', token)

        mra.doc(id).get().then(rec => {
            if (!rec.exists) {
                if (callback) m.sendMessage2({
                    callback_query_id: callback.id,
                    show_alert: true,
                    text: translations.noAppointment[user.language_code] || translations.noAppointment.en
                }, 'answerCallbackQuery', token)
                if (res) res.json({
                    success: false,
                    text: 'noAppointment'
                })

                return;
            }
            rec = rec.data();
            if (!rec.active) {
                if (callback) m.sendMessage2({
                    callback_query_id: callback.id,
                    show_alert: true,
                    text: translations.alreadyCancelled[user.language_code] || translations.alreadyCancelled.en
                }, 'answerCallbackQuery', token)
                if (res) res.json({
                    success: false,
                    text: 'alreadyCancelled'
                })
                return;
            }

            if (rec.user !== user.id) {
                if (callback) m.sendMessage2({
                    callback_query_id: callback.id,
                    show_alert: true,
                    text: translations.unAuthorized[user.language_code] || translations.unAuthorized.en
                }, 'answerCallbackQuery', token)
                if (res) res.json({
                    success: false,
                    text: 'unAuthorized'
                })
                return;
            }

            mra.doc(id).update({
                active: false,
                updatedAt: new Date()
            }).then(() => {

                log({
                    text: `@${user.username} cнял место в переговорке на ${reс.time} ${reс.date}`,
                    user: user.id,
                })



                if (callback) m.sendMessage2({
                    chat_id: user.id,
                    text: `${translations.bookingCancelled[user.language_code] || translations.bookingCancelled.en}`,
                    message_id: callback.message.message_id
                }, 'editMessageText', token).then(() => {
                    m.sendMessage2({
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
                        success: true,
                        text: 'bookingCancelled'
                    })
                }

            }).catch(err => {

                m.sendMessage2({
                    chat_id: user.id,
                    text: translations.error[user.language_code] || translations.error.en
                }, false, token)
            })

        })


    })
}

module.exports = router;