// let ngrok = process.env.ngrok2 
let ngrok = process.env.ngrok 

const host = `svanidze`;
const token = process.env.svanidzeToken;
const group = process.env.svanidzeGroup;

var express =   require('express');
var router =    express.Router();
var axios =     require('axios');
var cors =      require('cors')
var cron =      require('node-cron');
const fileUpload = require('express-fileupload');

router.use(fileUpload({
    // Configure file uploads with maximum file size 10MB
    limits: { fileSize: 10 * 1024 * 1024 },
  
    // Temporarily store uploaded files to disk, rather than buffering in memory
    useTempFiles : true,
    tempFileDir : '/tmp/'
  }));

const {
    dimazvali,
    getDoc,
    // uname,
    drawDate,
    devlog,
    letterize,
    letterize2,
    shuffle,
    handleQuery,
    handleDoc,
    handleError,
    cur,
    sudden,
    authTG,
    ifBefore,
    authWebApp,
    clearTags,
} = require('./common.js')


const {
    sendMessage2,
    getUser,
    greeting
} = require('./methods.js');


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
        "type":             "service_account",
        "project_id":       "dimazvalimisc",
        "private_key_id":   "5eb5025afc0fe53b63f518ba071f89e7b7ce03af",
        "private_key":      process.env.sssGCPKey.replace(/\\n/g, '\n'),
        "client_email":     "firebase-adminsdk-4iwd4@dimazvalimisc.iam.gserviceaccount.com",
        "client_id":        "110523994931477712119",
        "auth_uri":         "https://accounts.google.com/o/oauth2/auth",
        "token_uri":        "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-4iwd4%40dimazvalimisc.iam.gserviceaccount.com"
      }),
    databaseURL: "https://dimazvalimisc-default-rtdb.europe-west1.firebasedatabase.app"
}, host);

let fb =    getFirestore(gcp);


let adminTokens =           fb.collection(`${host}AdminTokens`);
let udb =                   fb.collection(`${host}Users`);
let messages =              fb.collection(`${host}UsersMessages`);
let logs =                  fb.collection(`${host}Logs`);
let payments =              fb.collection(`${host}Payments`)


if (!process.env.develop) {

    cron.schedule(`0 7 * * *`, () => {
        deActivate()
    })
}


setTimeout(function () {
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/${host}/hook`).then(() => {
        console.log(`${host} hook set on ${ngrok}`)
    }).catch(err => {
        handleError(err)
    })
}, 1000)

function log(o) {

    o.createdAt = new Date()

    logs.add(o).then(r => {

        if (!o.silent) {
            alertAdmins({
                text: o.text
            })
        }
    })
}


function registerUser(u) {

    u.createdAt = new Date();
    u.active = true;
    u.blocked = false;
    u.score = 0;
    
    if(u.language_code) u[u.language_code] = true;

    udb.doc(u.id.toString()).set(u).then(() => {

        // TBD приветствие

        log({
            user: +u.id,
            text: `new user: ${uname(u,u.id)}`
        })

    })
}

function uname(u,id){
    if(!u) u = {};
    return `${u.admin? `admin` : (u.insider ? 'associate' : (u.fellow ? 'fellow' : 'user'))} ${u.username ? `@${u.username}` : `id ${id}` } (${u.first_name||''} ${u.last_name||''})`
}


function alertAdmins(mess) {
    let message = {
        text: mess.text,
        isReply: true
    }

    if(mess.reply_markup) message.reply_markup = mess.reply_markup

    udb.where(`admin`, '==', true).get().then(admins => {
        admins = handleQuery(admins)
        // if(process.env.develop) admins = admins.filter(a=>+a.id == dimazvali)
        admins.forEach(a => {
            message.chat_id = a.id
            if (mess.type != 'stopLog' || !a.stopLog) sendMessage2(message, false, token, messages)
        })
    })
}

router.get(`/auth`, (req, res) => {
    res.render(`${host}/auth`)
})


router.post(`/auth`, (req, res) => {
    console.log(`запрос авторизации`)
    authTG(req, res, token, adminTokens, udb, registerUser)
})

const translations = {
    sorryNotPayed:      `Sorry, you have no subscription`,
    welcomeLinkName:    `Welcome on board`,
    urBlocked:          `სამწუხაროდ თქვენი აბონიმენტი ამოიწურა და არხზე წვდომა დაკარგეთ.` 
}

function deActivate(){
    payments
        .where(`active`,'==',true)
        // .where(`till`,'<=',new Date().toISOString().split('T')[0])
        .get()
        .then(col=>{
            col = handleQuery(col).filter(rec=>rec.till <=  new Date().toISOString().split('T')[0])
            if(col.length){

                alertAdmins({
                    text: `Deactivated users:\n${col.map(u=>`id${u.user}`).join(`\n`)}`
                })

                col.forEach(rec=>{
                    blockSubscription(rec);
                })
            }
        })
}

function blockSubscription(rec){

    payments.doc(rec.id).update({
        active: false,
        updatedAt: new Date()
    })
    
    sendMessage2({
        chat_id: rec.user,
        text: translations.urBlocked,
        reply_markup:{
            inline_keyboard:[[{
                text: `I have payed`,
                callback_data: `payed`
            }]]
        }
    },false,token,messages)


    sendMessage2({
        user_id: rec.user,
        chat_id: group,
    },`banChatMember`,token).then(d=>{
        devlog(d)
    })




    
    // TBD group action
}

if(process.env.develop) router.get(`/test`,(req,res)=>{
    deActivate()
    res.sendStatus(200)
})

function checkExpiring(days){

    let checkDate = new Date(+new Date()+days*24*60*60*1000).toISOString().split('T')[0]
    
    devlog(checkDate)

    payments
        .where(`active`,'==',true)
        // .where(`till`,'<=',checkDate)
        .get()
        .then(col=>{
            col = handleQuery(col).filter(rec=>rec.till <= checkDate)
            if(col.length){
                alertAdmins({
                    text: `Users to be deactivated until ${checkDate}:\n\n${col.map(u=>`id ${u.user}`).join(`\n`)}`
                })
                // handleQuery(col).forEach(rec=>{
                //     blockSubscription(rec);
                // })
            }
        })
}

router.get(`/web`, (req, res) => {

    devlog(`привет`)
    
    if (!process.env.develop && !req.signedCookies.adminToken) return res.redirect(`${process.env.ngrok}/${host}/auth`)

    getDoc(adminTokens, (req.signedCookies.adminToken || process.env.adminToken)).then(t => {

        if (!t || !t.active) {
            return res.sendStatus(403)
        }

        getUser(t.user, udb).then(u => {

            if (u.blocked) return res.sendStatus(403)

            devlog(`все ок`)

            if (u.admin && !req.query.stopAdmin) return logs
                .orderBy(`createdAt`, 'desc')
                .limit(100)
                .get()
                .then(col => {
                    devlog(`рисуем`)
                    res.render(`${host}/web`, {
                        user:       u,
                        wysykey:    process.env.wysykey,
                        start:      req.query.page,
                        logs:       handleQuery(col),
                    })
                })
            return res.render(`${host}/error`,{
                error: 403,
                text: `Sorry, the entrance is restricted. If you are sure that you have a right to enter, contact @dimazvali.`
            })

        })

    })
})
const datatypes = {
    payments:{
        col: payments,
        newDoc: addPayment
    },
    messages:{
        col:    messages,
        newDoc: sendMessage,
    },
    users: {
        col:    udb,
    }
}


function addPayment(req,res,admin){
    
    devlog(req.body)

    if(!req.body.user || !req.body.till) {
        if(res) {
            return res.sendStatus(400)
        } else {
            return false
        }
    };

    ifBefore(payments,{user:+req.body.user,active:true}).then(col=>{
        
        col.forEach(sub=>{
            payments.doc(sub.id).update({
                active:false
            })
        })

        payments.add({
            active:     true,
            createdAt:  new Date(),
            createdBy:  +admin.id,
            user:       +req.body.user,
            till:       req.body.till
        }).then(s=>{
    
            udb.doc(req.body.user.toString()).update({
                payed: true
            })
            
            invite2Chat(req.body.user)
    
            if(res) res.redirect(`/${host}/web?page=users_${req.body.user}`)
        }).catch(err=>{
            handleError(err,res)
        })
    })
}


function sendMessage(req,res,admin){
    let t = {
        chat_id: req.body.user,
        text:   req.body.text
    }
    
    sendMessage2(t, false, token, messages,{admin: +admin.id})
    
    if(res) res.sendStatus(200);
}

function invite2Chat(userId){
    sendMessage2({
        chat_id: group,
        user_id: userId
    },`getChatMember`,token).then(d=>{
        if(d.ok && d.result.status == `kicked`){
            
            devlog(`user was kicked`)

            sendMessage2({
                chat_id: group,
                user_id: userId,
            },`unbanChatMember`,token)

            // sendMessage2({
            //     chat_id: userId,
            //     text: `${translations.welcomeLinkName}`
            // },false,token,messages)
        } 
        sendMessage2({
            chat_id:    group,
            name:       translations.welcomeLinkName,
            creates_join_request: true,
        },`createChatInviteLink`,token).then(d=>{
            devlog(d)
            sendMessage2({
                chat_id: userId,
                text: `${translations.welcomeLinkName}\n${d.result.invite_link}`
            },false,token,messages)
        })
    })
    
}

router.all(`/admin/:method`,(req,res)=>{
    
    if(process.env.develop && !req.signedCookies.adminToken) req.signedCookies.adminToken = process.env.adminToken  

    if (!req.signedCookies.adminToken) return res.status(401).send(`who are you?`)
    
    adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(admin=>{

            if(!admin) return res.sendStatus(403)

            devlog(admin)

            switch(req.params.method){

                case `chat`:{
                    switch(req.method){
                        case `POST`:{
                            if(!req.body.user) return  res.sendStatus(400);
                            return getUser(req.body.user,udb).then(u=>{
                                if(!u) return res.sendStatus(404);
                                invite2Chat(req.body.user)
                                    .then(s=>{
                                        res.json({success:true,link:s})
                                    })
                            })

                        }
                    }
                }
                

                default:{

                    if(!datatypes[req.params.method])  return res.sendStatus(404)
                    
                    if(req.method == `GET`)     return datatypes[req.params.method].col.get().then(col=>{
                        
                        let data = handleQuery(col,true);
                        
                        Object.keys(req.query).forEach(q=>{
                            data = data.filter(i=> i[q] == (Number(req.query[q]) ? Number(req.query[q]) : req.query[q]))
                        })

                        if(!admin.admin && req.params.method == `users`) data = data.filter(i=>i.createdBy == +admin.id)

                        res.json(data)
                    }) 
                    if(req.method == `POST`)    return datatypes[req.params.method].newDoc(req,res,admin,datatypes[req.params.method].extras)
                    return res.sendStatus(404)
                }
            }
        })  
    })
})



router.all(`/admin/:method/:id`,(req,res)=>{

    if(process.env.develop && !req.signedCookies.adminToken) req.signedCookies.adminToken = process.env.adminToken  

    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(admin=>{
            
            switch(req.params.method){

                case `import`:{
                    
                    if(!admin.admin) return res.sendStatus(403)

                    if(!datatypes[req.params.id])  return res.sendStatus(404);

                    req.body.forEach(i=>{
                        i.createdAt = new Date()
                        datatypes[req.params.id].col.doc(i.id).set(i)
                    })

                }
                case `logs`:{
                    
                    if(!admin.admin) return res.sendStatus(403)

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

                    ref.get().then(d=>{
                        d = handleDoc(d)

                        if(!admin.admin){
                            if(d.createdBy != +admin.id) return res.sendStatus(403)
                        } 

                        if(req.method == `GET`)         return ref.get().then(d=>{
                            d.exists ? res.json(handleDoc(d)) : res.sendStatus(404)
                        })

                        if(req.method == `PUT`)         return updateEntity(req,res,ref,admin)
                        if(req.method == `DELETE`)      return deleteEntity(req,res,ref,admin)
                        
                        return res.sendStatus(404)
                        
                    })

                    
                }
            }
        })
        
    })
})

function deleteEntity(req, res, ref, admin, attr, callback) {
    
    return ref.get().then(e => {
        
        let data = common.handleDoc(e)

        if(req.params.method == `messages`){ 
            
            mess = data;

            if(mess.deleted)       return res.status(400).send(`уже удалено`);
            if(!mess.messageId)    return res.status(400).send(`нет id сообщения`);
            
            sendMessage2({
                chat_id:    mess.user,
                message_id: mess.messageId
            },`deleteMessage`,token).then(resp=>{
                if(resp.ok) {
                    res.json({
                        success: true,
                        comment: `Сообщение удалено.`
                    })
                    ref.update({
                        deleted:    new Date(),
                        deletedBy:  +admin.id
                    })
                } else {
                    res.sendStatus(500)
                }
            })
        } else {
            if (!data[attr || 'active']) return res.json({
                success: false,
                comment: `Вы опоздали. Запись уже удалена.`
            })
    
    
            ref.update({
                [attr || 'active']: false,
                updatedBy: +admin.id
            }).then(s => {
    
                log({
                    [req.params.data]: req.params.id,
                    admin: +admin.id,
                    text: `${uname(admin,admin.id)} архивирует ${req.params.data} ${e.name || e.id}.`
                })
    
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
        }

        
    })
}

function updateEntity(req,res,ref,admin){
    ref.get().then(d=>{
        
        d = handleDoc(d);

        if(req.params.method == `messages`){
            let mess = d;
            
            if(mess.deleted || mess.edited)       return res.status(400).send(`уже удалено`);
            if(!mess.messageId)    return res.status(400).send(`нет id сообщения`);
            
            sendMessage2({
                chat_id:    mess.user,
                message_id: mess.messageId,
                text:       req.body.value
            },`editMessageText`,token).then(resp=>{
                if(resp.ok) {
                    res.json({
                        success: true,
                        comment: `Сообщение обновлено.`
                    })
                    ref.update({
                        text:       req.body.value,
                        textInit:   mess.text,
                        editedBy:   +admin.id,
                        edited:     new Date()
                    })
                } else {
                    res.sendStatus(500)
                }
            })
        } else {
            ref.update({
                [req.body.attr]: req.body.value || null,
                updatedAt: new Date(),
                updatedBy: +admin.id
            }).then(s=>{
                res.json({
                    success: true,
                    comment: req.params.method == `profile` ? `Настройки обновлены.` : null
                })
                log({
                    silent: true,
                    admin: +admin.id,
                    [req.params.method]: req.params.id,
                    text: `Обновлен ${req.params.method} / ${d.name || req.params.id}.\n${req.body.attr} стало ${req.body.value} (было ${d[req.body.attr || null]})`
                })
            })
        }
    })
}

router.post(`/hook`, (req, res) => {
    res.sendStatus(200)

    devlog(JSON.stringify(req.body, null, 2))

    let user = {};

    if (req.body.my_chat_member) {
        if (req.body.my_chat_member.new_chat_member.status == 'kicked') {

            udb.doc(req.body.my_chat_member.chat.id.toString()).update({
                active: false,
                stopped: true
            }).then(s => {
                udb.doc(req.body.my_chat_member.chat.id.toString()).get().then(u => {

                    u = handleDoc(u)

                    log({
                        silent: true,
                        text: `${uname(u,u.id)} blocks the bot`,
                        user: +u.id
                    })
                })

            }).catch(err => {
                console.log(err)
            })
        }
    }
    if (req.body.message && req.body.message.from) {
        user = req.body.message.from;

        getUser(user.id, udb).then(u => {

            
            if (!u) return registerUser(user)

                
            if (!u.active) return udb.doc(user.id.toString()).update({
                active: true,
                stopped: null
            }).then(s => {
                log({
                    silent: true,
                    user: +user.id,
                    text: `user id ${user.id} comes back`
                })
            })

            if (req.body.message.photo && !req.body.message.chat.is_forum) {
                udb.where('admin','==',true).get().then(col=>{
                    handleQuery(col).forEach(a=>{
                            sendMessage2({
                                chat_id:    a.id,
                                caption:    `pics from ${uname(u,u.id)}`,
                                photo:      req.body.message.photo[0].file_id
                        }, 'sendPhoto', token, messages)
                    })
                })
            }

            if (req.body.message.text) {
                if(!req.body.message.chat.is_forum) messages.add({
                    user: user.id,
                    text: req.body.message.text || null,
                    createdAt: new Date(),
                    isReply: false
                })
            }

            if (req.body.message.text && !req.body.message.chat.is_forum) {

                

                if (req.body.message.text == `/start`) {
                    return sendMessage2({
                        chat_id: user.id,
                        parse_mode: `Markdown`,
                        text: `👾როგორ გავხდე პრემიუმ წევრი? 
🏛️წევრობის ფასია თვეში 20 ლარი.
გადმორიცხე თანხა საქართველოს ბანკზე: \`GE29BG0000000549896877\` 
ან 
TBC ბანკზე: 
\`GE39TB7301745064300064\` 
გადარიცხვის დროს მიუთითე სახელი რომელიც ტელეგრამზე გაწერია. თუ მითითება არ შეგიძლია, გადმორიცხვის შემდეგ ქვითარი/სქრინი გამოაგზავნე მეილზე: nsvanidze.info@gmail.com.

⚠️ თუ უკვე შეასრულე გადახდა, ჩატში დააჭირე ღილაკს “გადავიხადე”`,
                        reply_markup:{
                            inline_keyboard: [[{
                                text: `გადავიხადე`,
                                callback_data: `payed`
                            }]]
                        }
                    }, false, token, messages)
                } else {
                    return alertAdmins({
                        text: `${uname(u,u.id)} says: ${req.body.message.text}`,
                        user: user.id
                    })
                }
            }
        })
    }

    if (req.body.callback_query) {
        getUser(req.body.callback_query.from.id,udb).then(u=>{
            switch (req.body.callback_query.data){
                case `payed`:{
                    
                    sendMessage2({
                        chat_id: u.id,
                        text: `✅მოთხოვნა მიღებულია! გადავამოწმებთ თქვენს ტრანზაქციას და ავტომატურად გაგაწევრიანებთ ჯგუფში ვერიფიკაციის შემდეგ 👌🏻`
                    },false,token,messages)

                    return alertAdmins({
                        text: `${uname(u,u.id)} says, that (s)he had already payed for subscription.`,
                        reply_markup:{
                            inline_keyboard:[
                                [{
                                    text:`1 month`,
                                    callback_data: `confirm_1_${u.id}`
                                },{
                                    text:`3 months`,
                                    callback_data: `confirm_3_${u.id}`
                                },{
                                    text:`6 month`,
                                    callback_data: `confirm_6_${u.id}`
                                }],
                                [{
                                    text: `admin`,
                                    url: `${ngrok}/${host}/web`
                                }]
                            ]
                        },
                        user: user.id
                    })
                }
                default:{
                    let inc = req.body.callback_query.data.split('_')
                    switch (inc[0]){
                        case `confirm`:{
                            let nDate = new Date(+new Date() + +inc[1]*30*24*60*60*1000).toISOString().split('T')[0]
                            if(u.admin){
                                addPayment({
                                    body:{
                                        user: inc[2],
                                        till: nDate
                                    },
                                },false,u)
                                sendMessage2({
                                    chat_id:    u.id,
                                    message_id: req.body.callback_query.message.message_id,
                                    text:       `Subscription for user ${inc[2]} set untill ${nDate}`,
                                },`editMessageText`,token)
                            }
                        }
                    }
                }
            }
        })   
    }

    if (req.body.pre_checkout_query){
        console.log('это платеж')
        
        sendMessage2({
            ok: true,
            pre_checkout_query_id: req.body.pre_checkout_query.id
        },'answerPreCheckoutQuery',token).then(s=>{
            console.log(s.data)
        }).catch(err=>{
            console.log(err)
        })
    }

    if(req.body.chat_join_request){
        return getUser(req.body.chat_join_request.from.id,udb).then(u=>{
            if(u && u.payed && !u.blocked){
                sendMessage2({
                    chat_id: group,
                    user_id: req.body.chat_join_request.from.id
                },`approveChatJoinRequest`,token)
                sendMessage2({
                    chat_id: req.body.chat_join_request.from.id,
                    text: translations.welcomeLinkName
                },false,token,messages)
            } else {
                
                sendMessage2({
                    chat_id: group,
                    user_id: req.body.chat_join_request.from.id
                },`declineChatJoinRequest`,token)

                sendMessage2({
                    chat_id: req.body.chat_join_request.from.id,
                    parse_mode: `Markdown`,
                    text: `👾როგორ გავხდე პრემიუმ წევრი? 
🏛️წევრობის ფასია თვეში 20 ლარი.
გადმორიცხე თანხა საქართველოს ბანკზე: \`GE29BG0000000549896877\` 
ან 
TBC ბანკზე: 
\`GE39TB7301745064300064\` 
გადარიცხვის დროს მიუთითე სახელი რომელიც ტელეგრამზე გაწერია. თუ მითითება არ შეგიძლია, გადმორიცხვის შემდეგ ქვითარი/სქრინი გამოაგზავნე მეილზე: nsvanidze.info@gmail.com.

⚠️ თუ უკვე შეასრულე გადახდა, ჩატში დააჭირე ღილაკს “გადავიხადე”`,
                    reply_markup:{
                        inline_keyboard: [[{
                            text: `გადავიხადე`,
                            callback_data: `payed`
                        }]]
                    }
                },false,token,messages)
            }   
        })
    }
})

module.exports = router;
