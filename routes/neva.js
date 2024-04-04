const ngrok = process.env.ngrok 
const ngrok2 = "https://a751-109-172-156-240.ngrok-free.app" 
const host = `neva`
const token = process.env.dimazvaliToken;
var express =   require('express');
var router =    express.Router();
var axios =     require('axios');
var cors =      require('cors')

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

let authors =                   fb.collection(`NEVAauthors`);
let programs =                  fb.collection(`NEVAprograms`);
let shows =                     fb.collection(`NEVAshows`);


router.get(`/`,(req,res)=>{
    programs
        .where(`active`,'==',true)
        .get()
        .then(col=>{
            res.render(`${host}/neva`,{
                programs: handleQuery(col,false,true)
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

module.exports = router;
