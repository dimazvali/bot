const ngrok2 = process.env.ngrok 
const ngrok = "https://a751-109-172-156-240.ngrok-free.app" 
const host = `neva`
const token = process.env.nevaToken;
var express =   require('express');
var router =    express.Router();
var axios =     require('axios');
var cors =      require('cors');
var RSS = require('rss');

var sha256 =    require('sha256');
const { createHash,createHmac } = require('node:crypto');

const {
    dimazvali,
    getDoc,
    uname,
    drawDate,
    devlog,
    letterize,
    letterize2,
    shuffle,
    handleQuery,
    handleDoc,
    handleError,
    sudden,
} = require ('./common.js')


const {
    sendMessage2,
    getUser,
    greeting
} =       require('./methods.js');


router.use(cors())

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
}, 'neva');

let fb = getFirestore(gcp);


setTimeout(function(){
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/${host}/hook`).then(()=>{
        console.log(`neva hook set on ${ngrok}`)
    }).catch(handleError)   
},1000)


let authors =                   fb.collection(`NEVAauthors`);
let programs =                  fb.collection(`NEVAprograms`);
let shows =                     fb.collection(`NEVAshows`);
let adminTokens =               fb.collection('DIMAZVALIadminTokens');
let udb =                       fb.collection(`NEVAusers`);
let logs =                      fb.collection(`NEVAlogs`);
let settings =                  fb.collection(`NEVAsettings`);
let messages =                  fb.collection(`NEVAmessages`);


router.get(`/auth`,(req,res)=>{
    res.render(`${host}/auth`)
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

router.post(`/auth`,(req,res)=>{

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
                wysykey: process.env.wysykey,
                start: req.query.page,
                logs: handleQuery(col),
                // token: req.signedCookies.adminToken
            })
        }) 

    if(!req.signedCookies.adminToken) return res.redirect(`/auth`)
    
    adminTokens
        .doc(req.signedCookies.adminToken)
        .get()
        .then(data=>{
            if(!data.exists) return res.sendStatus(403)
            if(data.data().active){
                logs
                    .orderBy(`createdAt`,'desc')
                    .limit(100)
                    .get()
                    .then(col=>{
                        res.render(`${host}/web`,{
                            wysykey:    process.env.wysykey,
                            logs:       handleQuery(col),
                            // token: req.signedCookies.adminToken
                        })
                    })
                

            }
        })
})

function newEntity(req,res,admin,extra){
    if(!req.body.name) return res.status(400).send(`no name`)
    
    let o = {
        createdAt:      new Date(),
        createdBy:      +admin.id,
        active:         true,
        description:    req.body.description || null,
        name:           req.body.name || null,
        pic:            req.body.pic || null,
    }

    if(extra) extra.forEach(t=>{
        o[t] = req.body[t] ||null
    })

    datatypes[req.params.method].col.add(o).then(rec=>{
        res.redirect(`/${host}/web?page=${req.params.method}_${rec.id}`)
        log({
            admin:      +admin.id,
            [req.params.method]:      rec.id,
            text:       `${uname(admin,admin.id)} создает ${req.params.method} ${req.body.name}`
        })
    })
}

function getRandomRec(){
    return shows.get().then(col=>{
        let i = Math.floor(Math.random()*col.docs.length)
        return handleQuery(col)[i]
    })
}


router.get(`/`,(req,res)=>{
    getRandomRec().then(r=>{
        programs
            .where(`active`,'==',true)
            .get()
            .then(col=>{
                res.render(`${host}/neva`,{
                    programs:   handleQuery(col,false,true),
                    random:     r,
                    greetings:()=>greeting()
                })
            })
    })
    
})

router.get(`/:program`,(req,res)=>{
    programs
        .doc(req.params.program)
        .get()
        .then(p=>{
            
            if(!p.exists) return res.sendStatus(404)
            p = handleDoc(p) 
            shows
                .where(`program`,'==',req.params.program)
                .where(`active`,'==',true)
                .get()
                .then(col=>{
                    res.render(`${host}/program`,{
                        name: `${p.name} | Радио Нева FM | dimazvali.com`,
                        description: `Временный архив передачи ${p.name}.`,
                        program: p,
                        shows: handleQuery(col,true)
                    })
                })
        })
})

router.get(`/rss/:program`,(req,res)=>{
    programs
        .doc(req.params.program)
        .get()
        .then(p=>{
            
            if(!p.exists) return res.sendStatus(404)
            p = handleDoc(p)

            let feed = new RSS({
                title:          p.name,
                description:    p.description,
                feed_url: `https://neva.dimazvali.com/rss/${req.params.program}`,
                site_url: 'https://neva.dimazvali.com/',
                webMaster: 'dimazvali@gmail.com',
                copyright: 'neva.dimazvali.com',
                custom_namespaces: {
                    itunes:     "http://www.itunes.com/dtds/podcast-1.0.dtd",
                    content:    "http://purl.org/rss/1.0/modules/content/"
                }
            });

            shows
                .where(`program`,'==',req.params.program)
                .where(`active`,'==',true)
                .get()
                .then(col=>{
                    handleQuery(col).forEach(show=>{
                        feed.item({
                            title:          show.name,
                            description:    show.description,
                            enclosure: {
                                url: show.url
                            },
                            url:            `https://neva.dimazvali.com/programs/${req.params.program}/${show.id}`,
                            guid:           show.id,
                            pubDate:        new Date(show.date ? show.date : show.createdAt._seconds*1000).toISOString()
                        })
                    })
                    res.attachment(`${req.params.program}.xml`);
                    res.status(200).send(feed.xml());
                })
        })
})




function updateEntity(req,res,ref,admin){
    ref.get().then(d=>{
        
        d = handleDoc(d);

        ref.update({
            [req.body.attr]: req.body.value || null,
            updatedAt: new Date(),
            updatedBy: +admin.id
        }).then(s=>{
            res.json({
                success: true
            })
            log({
                silent: true,
                admin: +admin.id,
                [req.params.method]: req.params.id,
                text: `Обновлен ${req.params.method} / ${d.name || req.params.id}.\n${req.body.attr} стало ${req.body.value} (было ${d[req.body.attr || null]})`
            })
        })
    })
    
}



const datatypes = {
    shows:{
        col: shows,
        newDoc: newEntity,
        extras: [`program`] 
    },
    programs:{
        col: programs,
        newDoc: newEntity,
        extras: [`author`]
    },
    authors:{
        col: authors,
        newDoc: newEntity
    },
    users: {
        col: udb,
    }
}

function registerUser(u){
    u.createdAt =   new Date();
    u.active =      true;
    u.blocked =     false;
    udb.doc(u.id.toString()).set(u).then(rec=>{
        sendMessage2({
            chat_id: u.id,
            text: `Добро пожаловать. Напишите, пожалуйста, чем могу быть полезен?..`
        },false,token,messages)
        log({
            user: +u.id,
            text: `Новый пользователь: ${uname(u,u.id)}`
        })
    })
}


function log(o) {

    o.createdAt = new Date();

    logs.add(o).then(r => {

        if(!o.silent){
            alertAdmins({
                text:   o.text,
            })
        }
        
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

                if (!process.env.develop || a.id == dimazvali) sendMessage2(message, false, token)
            }
        })
    })
}


router.post(`/hook`,(req,res)=>{
    
    res.sendStatus(200)

    let user = {}

    devlog(JSON.stringify(req.body))

    if (req.body.message) {

        user = req.body.message.from

        udb.doc(user.id.toString()).get().then(u => {
            
            devlog(u)
            
            if (!u.exists) registerUser(user)

            u = handleDoc(u);

            if(req.body.message.text){
                let txt = req.body.message.text;                
            }



            if(req.body.message.voice && u.admin){
                // devlog(`Это голосовое`)
                sendMessage2({
                    chat_id: u.id,
                    parse_mode: `Markdown`,
                    text: '```'+req.body.message.voice.file_id+'```'
                },false,token,messages).then(d=>console.log(d))
            }

            if(req.body.message.text){
                // if(!req.body.message.text.indexOf(`/start`)){
                //     let inc = req.body.message.text.split(' ')
                //     if(inc[1]){
                //         let attr = inc[1].split('_');
                        
                //     }
                // }
            }
        })
    }


    if(req.body.callback_query){
        let user = req.body.callback_query.from;
        let inc = req.body.callback_query.data.split('_')
    }
})


router.all(`/admin/:method/:id`,(req,res)=>{
    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(admin=>{
            
            if(!admin.admin) return res.sendStatus(403)
            
            switch(req.params.method){
                case `logs`:{
                    devlog(`Запрос логов`)
                    let q = req.params.id.split('_')
                    
                    return logs
                        .where(q[0],'==',Number(q[1])?+q[1]:q[1])
                        .get()
                        .then(col=>{
                            res.json(handleQuery(col,true))
                        })
                }

                default:{
                    
                    if(!datatypes[req.params.method])  return res.sendStatus(404)
                    
                    let ref = datatypes[req.params.method].col.doc(req.params.id)

                    if(req.method == `GET`)         return ref.get().then(d=>{
                        d.exists ? res.json(handleDoc(d)) : res.sendStatus(404)
                    }) 
                    if(req.method == `PUT`)         return updateEntity(req,res,ref,admin)
                    if(req.method == `DELETE`)      return deleteEntity(req,res,ref,admin)
                    return res.sendStatus(404)
                }
            }
        })
        
    })
})




router.all(`/api/:method/:id`,(req,res)=>{
    switch(req.params.method){
        case `import`:{
            
            devlog(`import`);

            return programs.doc(req.params.id).get().then(p=>{
                if(!p.exists) return res.sendStatus(404)
                res.send(`import ${req.body.length} shows to ${p.data().name}`)
                req.body.reverse().forEach((s,i)=>{
                    setTimeout(()=>{
                        shows.add({
                            active:     true,
                            createdAt:  new Date(),
                            name:       s.name,
                            url:        s.url,
                            program:    req.params.id,
                            description: null, 
                        }).then(s=>{
                            programs.doc(req.params.id).update({
                                shows: FieldValue.increment(1)
                            })
                            devlog(`${i} — ${s.id}`)
                        })
                    },i*500)
                })
                
            })
            
        }
        case `showstarted`:{
            let ref = shows.doc(req.params.id)
            return ref.get().then(d=>{
                if(!d.exists) return res.sendStatus(404)
                ref.update({
                    played: FieldValue.increment(1)
                })
                .then(()=>{
                    programs.doc(d.data().program).update({
                        played: FieldValue.increment(1)
                    })
                    res.sendStatus(200)
                })
                .catch(err=>{
                    res.status(400).send(err.message)
                })
            })
                
        }
        default:{
            res.sendStatus(404)
        }
    }
})


function deleteEntity(req,res,ref,admin,callback){
    return ref.get().then(e => {

        let data = handleDoc(e)

        devlog(data)

        let attr = req.body.attr

        if (!data[attr || 'active']) return res.json({
            success: false,
            comment: `Вы опоздали. Запись уже удалена.`
        })

        ref.update({
            [attr || 'active']: false,
            updatedBy: +admin.id
        }).then(s => {
            
            log({
                [req.params.method]: req.params.id,
                text: `${uname(admin,admin.id)} архивирует ${req.params.method} ${data.name||data.id}`,
                admin: +admin.id
            })
            res.json({
                success: true
            })

            if (typeof (callback) == 'function') {
                callback()
            }
        }).catch(err => {
            res.json({
                success: false,
                comment: err.message
            })
        })
    })
}

router.all(`/admin/:method`,(req,res)=>{
    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(admin=>{
            
            if(!admin.admin) return res.sendStatus(403)

            switch(req.params.method){
                
                case `shows`:{
                    let q = shows;
                    if(req.query.program) q = q.where(`program`,'==',req.query.program)
                    return q.get().then(col=>res.json(handleQuery(col,true)))
                }
                
                case `about`:{
                    if(req.method == `GET`)     return settings.doc(`about`).get().then(d=>res.json(handleDoc(d,true))) 
                    if(req.method == `PUT`)     return updateEntity(req,res,settings.doc(`about`),admin)
                }
                default:{
                    if(!datatypes[req.params.method])  return res.sendStatus(404)
                    if(req.method == `GET`)     return datatypes[req.params.method].col.get().then(col=>res.json(handleQuery(col,true))) 
                    if(req.method == `POST`)    return datatypes[req.params.method].newDoc(req,res,admin,datatypes[req.params.method].extras)
                    return res.sendStatus(404)
                }
            }
        })  
    })
})

module.exports = router;