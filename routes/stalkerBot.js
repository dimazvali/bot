// let ngrok = process.env.ngrok2 
let ngrok = process.env.ngrok;

const host = `stalker`;
const token = process.env.stalkersToken;


var express =   require('express');
var router =    express.Router();
var axios =     require('axios');

const fileUpload = require('express-fileupload');

var cors =      require('cors')

var common =    require('./common');
const m =       require('./methods.js');
var QRCode =    require('qrcode')
var cron =      require('node-cron');
var FormData =  require('form-data');
var modals =    require('./modals.js').modals
const qs =      require('qs');
const fs =      require('fs');

router.use(cors())

const {
    objectify,
    getDoc,
    uname,
    drawDate,
    devlog,
    letterize,
    letterize2,
    shuffle,
    clearTags,
    handleQuery,
    handleDoc,
    sudden,
    cutMe,
    interpreteCallBackData,
    authTG,
    authWebApp,
} = require ('./common.js')

const {
    sendMessage2,
    getUser,
    greeting,
} = require('./methods.js')

const {
    Parser
} = require('json2csv');



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

const { getStorage, getDownloadUrl } = require('firebase-admin/storage');

const {
    getDatabase
} = require('firebase-admin/database');


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
    databaseURL: "https://rrspecialsapi.firebaseio.com"
}, host);

let fb = getFirestore(gcp);
let s = getStorage(gcp)



setTimeout(function(){
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/${host}/hook`).then(()=>{
        console.log(`${host} hook set on ${ngrok}`)
    }).catch(err=>{
        handleError(err)
    })   
},1000)

function handleError(err,res) {
    console.log(err);
    if(res) res.status(500).send(err.message)
}


let udb =               fb.collection(`${host}Users`);
let phones =            fb.collection(`${host}Phones`);
let logs =              fb.collection(`${host}Logs`);
let messages =          fb.collection(`${host}Messages`);
let phonesUsers =       fb.collection(`${host}phonesUsers`);

function registerPhone(tel, user){
    phones.doc(tel.toString()).set({
        active:     true,
        createdAt:  new Date(),
        createdBy:  +user.id,
        tel:        +tel
    }).then(()=>{
        
        sendMessage2({
            chat_id:    user.id,
            text:       locals.phoneAdded(tel)[user.language_code] || locals.phoneAdded(tel).en
        },false,token,messages)

        udb.where(`active`,'==',true).get().then(col=>{
            handleQuery(col).filter(u=>u.id != +user.id).forEach((user,i) => {
                setTimeout(()=>{
                    sendMessage2({
                        chat_id:    user.id,
                        parse_mode: `Markdown`,
                        text:       locals.newPhone(tel)[user.language_code] || locals.newPhone(tel).en
                    },false,token,messages)
                },i*200)
            });
        })
    })
}
let locals = {
    copy:()=>{
        return {
            en: `Thanks, but you have alreade sent me this number.`,
        }
    },
    phoneUpdated:(tel)=>{
        return {
            en: `Thank you! This number is already on the list.`,
        }
    },
    phoneAdded:(tel)=>{
        return {
            en: `Thank you! Now I will alert the other users.`,
        }
    },
    newPhone:(tel)=>{
        return {
            en: `Hello! A new phone was added by a fellow user: \`\`\`+${tel}\`\`\``,
        }
    },
    phoneWasVetted:(tel)=>{
        return {
            en: `Ooops! Looks like this phone number was vetted. Please, tell me why you think it's dangerous.`,
        }
    },
    notANumber:(tel)=>{
        return {
            en: `I'm sorry, ${tel} does not look like a valid phone number.`,
        }
    },
    intro:(name, username)=> {
        return {
            en: `Hello, ${name||username}!\nWe are here to protect Georgian pro-European activists against anonymous telephone abusers.\n\nJust send me the phone numbers of the people that tried to harrass you — and i will warn the others (and vice versa). This data will also help the journalists to investigate this matter.\nLet's start. Type /list to get the phonebook or send me a number (one at a time, please).`
        }
    }
}


function log(o) {

    o.createdAt = new Date()

    logs.add(o).then(r => {

        if(!o.silent){
            alertAdmins({
                text:   o.text
            })
        }

    })
}


function getAvatar(id){
    return axios.post('https://api.telegram.org/bot' + token + '/getUserProfilePhotos', {
        user_id: id || common.dimazvali
    }, {headers: {'Content-Type': 'application/json'}
    }).then(d=>{
        return d.data
        console.log(d.data)
    }).catch(err=>{
        console.log(err)
    })
}



function alertAdmins(mess) {
    let message = {
        text: mess.text,
        isReply: true
    }

    udb.where(`admin`, '==', true).get().then(admins => {
        admins.docs.forEach(a => {
            message.chat_id = a.id
            if (mess.type != 'stopLog' || !a.data().stopLog) sendMessage2(message, false, token, messages)
        })
    })
}

function registerUser(u) {

    u.createdAt =       new Date();
    u.active =          true;
    u.blocked =         false;
    u.city =            null;
    u.score =           0;
    u[u.language_code] = true; 
    
    udb.doc(u.id.toString()).set(u).then(() => {

        // userList.push(u);

        sendMessage2({
            chat_id: +u.id,
            text:   locals.intro(u.first_name || u.username)[u.language_code] || locals.intro(u.first_name || u.username).en,
        }, false, token, messages)

        getAvatar(u.id).then(data=>{
            if(data && data.ok && data.result.total_count){
                
                let pic = data.result.photos[0].reverse()[0]
                
                udb.doc(u.id.toString()).update({
                    avatar_id: pic.file_id
                })
            }
        })

        log({
            user: +u.id,
            text: `${uname(u,u.id)} регистрируется в боте.`
        })

    })
}

router.post(`/hook`,(req,res)=>{
    
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

                    u = common.handleDoc(u)

                    log({
                        silent: true,
                        text: `${uname(u,u.id)} блочит бот`,
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

            if(req.body.message.text){
                messages.add({
                    user:       user.id,
                    text:       req.body.message.text || null,
                    createdAt:  new Date(),
                    isReply:    false
                })
            }

            if (!u) return registerUser(user)
            
            
            if (!u.active) return udb.doc(user.id.toString()).update({
                active: true,
                stopped: null
            }).then(s => {
                log({
                    silent:     true,
                    user:       +user.id,
                    text:       `Пользователь id ${user.id} возвращается`
                })
            })

            if (req.body.message.text) {

                // пришло текстовое сообщение;


                switch (req.body.message.text) {

                    case `/list`:{
                        phones.where(`active`,'==',true).get().then(col=>{
                            col = handleQuery(col,true)
                            let i = 0;
                            if(!col.length) return sendMessage2({
                                chat_id: u.id,
                                text: `Sorry, but the list is empty (by now). Send me the very first number!`,
                            },false,token)

                            while (col.length){

                                let list = col.splice(0,5)

                                devlog(list)

                                setTimeout(()=>{
                                    sendMessage2({
                                        chat_id: u.id,
                                        parse_mode: `Markdown`,
                                        text: list.map(p=>`\`\`\`+${p.tel}\`\`\``).join('\n\n')
                                    },false,token,messages)
                                },i*200)
                                i++;
                            }
                        })
                    }


                    default:
                        if(!req.body.message.text.indexOf(`/start`)){
                            let inc = req.body.message.text.split(' ');
                            if(inc[1]){
                                inc = inc[1].split('_');
                                if(inc[0] == `offer`){
                                    getDoc(offers,inc[1]).then(o=>{
                                        getDoc(books,o.book).then(b=>{
                                            sendOffer(b,o,req.body.message.from)
                                        })
                                    })
                                    
                                }
                            }
                        } else {

                            let inc = req.body.message.text.replace(/[^0-9]/g, "");
                            
                            if(+inc){
                                console.log(inc, )
                                if(inc.length != 11) return sendMessage2({
                                    chat_id: u.id,
                                    text: locals.notANumber(inc)[u.language_code] || locals.notANumber(inc).en
                                },false,token,messages)
                                
                                phonesUsers.add({
                                    createdAt:  new Date(),
                                    user:       +u.id,
                                    phone:      +inc
                                })

                                return getDoc(phones,inc).then(phone=>{
                                    

                                    if(!phone) return registerPhone(inc,u)

                                    if(!phone.active) return sendMessage2({
                                        chat_id: u.id,
                                        text: locals.phoneWasVetted(inc)[u.language_code] || locals.phoneWasVetted(inc).en
                                    },false,token,messages)
                                    
                                    

                                    if(!u[inc]) {

                                        sendMessage2({
                                            chat_id: u.id,
                                            text: locals.phoneUpdated()[u.language_code] || locals.phoneUpdated().en
                                        },false,token,messages)

                                        phones.doc(inc).update({
                                            sent: FieldValue.increment(1)
                                        })

                                    } else {
                                        sendMessage2({
                                            chat_id: u.id,
                                            text: locals.copy()[u.language_code] || locals.copy().en
                                        },false,token,messages)
                                    }
                                    
                                    
                                })

                            } else {
                                return alertAdmins({
                                    text: `${uname(u,u.id)} пишет: ${req.body.message.text}`,
                                    user: user.id
                                })
                            }
                            
                        }
                        
                }
            }

            if (req.body.message.photo) {

            }

            if (req.body.message.document) {

            }

        })
    }
})

module.exports = router;
