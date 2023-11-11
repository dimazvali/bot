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
var modals =    require('./modals.js').modals
const qs =      require('qs');
var uname =     require('./common').uname;
var drawDate =  require('./common').drawDate;
const { createHash,createHmac } = require('node:crypto');
const devlog = require(`./common`).devlog


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
    query,
    json
} = require('express');
const {
    factchecktools_v1alpha1
} = require('googleapis');
const {
    sendAt
} = require('cron');


let gcp = initializeApp({
    credential: cert({
        "type": "service_account",
        "project_id": "cyprusjournal-43b05",
        "private_key_id": "ef38d0abbbcdf6671bb447e3cdbbf0e3df3f98b4",
        "private_key": process.env.cyprusKey.replace(/\\n/g, '\n'),
        "client_email": "firebase-adminsdk-sjf38@cyprusjournal-43b05.iam.gserviceaccount.com",
        "client_id": "102273232380927774766",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-sjf38%40cyprusjournal-43b05.iam.gserviceaccount.com",
        "universe_domain": "googleapis.com"
      }
      ),
    databaseURL: "https://rrspecialsapi.firebaseio.com"
}, 'cyprus');

let fb = getFirestore(gcp);

let token = process.env.cyprusToken

let botLink =           `https://t.me/cyprusjournal_bot`
let testChannelLink =   `https://t.me/+uaMO0ee7u5hjYmQy`

let ngrok = process.env.ngrok


// setTimeout(function(){
//     axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok}/cyprus/hook`).then(()=>{
//         console.log(`cyprus hook set on ${ngrok}`)
//     }).catch(handleError)   
// },1500)

function handleError(err) {
    console.log(err);
    try {
        res.status(500).send(err.message)
    } catch (err) {

    }
}




let udb =               fb.collection('users');
let messages =          fb.collection('usersMessages');
let logs =              fb.collection('logs');
let news =              fb.collection('news');


router.post('/hook', (req, res) => {
    
    res.sendStatus(200)

    devlog(JSON.stringify(req.body))

    let user = {}

    if (process.env.develop == 'true') console.log(JSON.stringify(req.body, null, 2))

    if (req.body.message) {
        user = req.body.message.from

        udb.doc(user.id.toString()).get().then(u => {
            
            
            if (!u.exists) return registerUser(user)

            if(!u.data().active){
                udb.doc(user.id.toString()).update({
                    active: true,
                    stopped: null
                }).then(s=>{
                    log({
                        text: `Пользователь id ${user.id} возвращается`
                    })  
                })
            }


            if (req.body.message.text) {
                messages.add({
                    user: user.id,
                    text: req.body.message.text || null,
                    createdAt: new Date(),
                    isReply: false
                })

                if (req.body.message.text.indexOf('/start')) {
                    alertAdmins({
                        text: `${uname(u.data(),u.id)} пишет что-то странное: ${req.body.message.text}`,
                        type: 'incoming',
                        user_id: user.id
                    })
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

    if (req.body.my_chat_member) {
        if (req.body.my_chat_member.new_chat_member.status == 'kicked') {
            common.devlog(`пользователь выходит`)
            udb.doc(req.body.my_chat_member.chat.id.toString()).update({
                active: false,
                stopped: true
            }).then(s=>{
                udb.doc(req.body.my_chat_member.chat.id.toString()).get().then(u=>{
                    
                    u = common.handleDoc(u)

                    log({
                        text: `${uname(u,u.id)} блочит бот`,
                        user: u.id
                    })
                })
                
            }).catch(err=>{
                console.log(err)
            })
        }
    }
})


function log(o) {
    o.createdAt = new Date()
    logs.add(o)
}


function alertAdmins(){

}

let users = {}

function registerUser(u) {

    u.createdAt = new Date();
    u.active =  true;
    u.blocked = false;
    u.admin =   false;
    
    users[u.id] = u;

    udb.doc(u.id.toString()).set(u).then(() => {

        m.sendMessage2({
            chat_id: u.id,
            text: `Добро пожаловать!`,
        }, false, token)

        udb.get().then(col=>{
            alertAdmins({
                type: 'newUser',
                text: `Новый пользователь бота (№${col.docs.length}):\n${JSON.stringify(u,null,2)}`,
                user_id: u.id
            })
        })

    }).catch(err => {
        console.log(err)
    })
}


module.exports = router;