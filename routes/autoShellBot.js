// let ngrok = process.env.ngrok2 
let ngrok = process.env.ngrok 

const host = `autoshell`;
const token = process.env.booksToken;

var express =   require('express');
var router =    express.Router();
var axios =     require('axios');

const fileUpload = require('express-fileupload');


var cors =      require('cors')
var sha256 =    require('sha256');
var common =    require('./common');
const m =       require('./methods.js');
var QRCode =    require('qrcode')
var cron =      require('node-cron');
var FormData =  require('form-data');
var modals =    require('./modals.js').modals
const qs =      require('qs');
const fs =      require('fs')

const { createHash,createHmac } = require('node:crypto');
router.use(cors())

router.use(fileUpload({
    // Configure file uploads with maximum file size 10MB
    limits: { fileSize: 10 * 1024 * 1024 },
  
    // Temporarily store uploaded files to disk, rather than buffering in memory
    useTempFiles : true,
    tempFileDir : '/tmp/'
  }));

const dummyBook = `${ngrok}/images/${host}/blank.png`


const appLink = `https://t.me/paperstuffbot/app`

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
    authWebApp,
    sanitize,
    cur,
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


var RSS = require('rss');

const { ObjectStreamToJSON } = require('sitemap');


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
let s =     getStorage(gcp)
let rtb =   getDatabase(gcp)


router.get(`/auth`,(req,res)=>{
    res.render(`${host}/auth`)
})


let adminTokens =       fb.collection(`DIMAZVALIadminTokens`);

let udb =               fb.collection(`${host}Users`);
let records =           fb.collection(`${host}Records`);

router.get(`/auth`,(req,res)=>{
    res.render(`${host}/auth`)
})

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

    if(req.body.hash == hmac){

        getUser(req.body.id,udb).then(u=>{

            if(u.blocked) return res.sendStatus(403)

            if(!u) registerUser(req.body)
                
                adminTokens.add({
                    createdAt:  new Date(),
                    user:       +req.body.id,
                    active:     true 
                }).then(c=>{
                    res.cookie('adminToken', c.id, {
                        maxAge: 7 * 24 * 60 * 60 * 1000,
                        signed: true,
                        httpOnly: true,
                    }).sendStatus(200)
                })
        })
    } else {
        res.sendStatus(403)
    }
})

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

function registerUser(u) {

    udb.get().then(col=>{
        u.createdAt =       new Date();
        u.active =          true;
        u.blocked =         false;
        u.city =            null;
        u.score =           0;
        u.num =             col.docs.length+1;
        u[u.language_code] = true; 
        
        cities.get().then(col=>{
            udb.doc(u.id.toString()).set(u).then(() => {
                sendMessage2({
                    chat_id: +u.id,
                    text:   locals.greetings,
                    reply_markup: {
                        inline_keyboard:handleQuery(col,false,true).filter(c=>c.active).map(c=>{
                            return [{
                                text: c.name,
                                callback_data: `user_city_${c.id}`
                            }]
                        })
                    }
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
        })
    })

    
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

router.post(`/api/:method`,(req,res)=>{
    switch(req.params.method){
        
        case `pair`:{
            devlog(`новая пара`)
            let data = req.body.data;
            data.parsed = false;

            devlog(data)
            if(data['BFB'] + data.rater.solRate + data.rater.directRate + data.rater.singleTransactionBuyRate + data.rater.buyersTransferRate + data.rater.cexTransferRate){
                return rtb.ref(`/${host}/inc`).push(data)
                .then(raw=>{
                    devlog(`положили`);
                    let token = data.pairData.tokenA.indexOf(`So11`) ? data.pairData.tokenA : data.pairData.tokenB;
                    parseAndSet(false, token, data, raw)
                    return res.sendStatus(201)
                }).catch(err=>{
                    devlog(err);
                })
            } else {
                return res.status(200).send(`read, but not registered`)
            }
            
        }
        default:{
            res.sendStatus(404)
        }
    }
})


// cron.schedule(`*/2 * * * *`, () => {
//     devlog(`погнали крон`)
//     rtb.ref(`/${host}/pairs/`).once(`value`).then(data=>{
//         let cur = data.val();
//         Object.keys(cur).forEach(token=>{
//             axios.get(`https://api.dexscreener.com/latest/dex/tokens/${token}`)
//                 .then(res=>{
//                     p = res.data;
//                     if(p && p.pairs){
//                         p = p.pairs[0]
                        
//                         console.log(p.info);

//                         let upd = {
//                             updatedAt: +new Date(),
//                             url: p.url,
//                             pairAddress:    p.pairAddress,
//                             address:        p.baseToken.address,
//                             symbol:         p.baseToken.symbol,
//                             volume_h24:     p.volume.h24,
//                             volume_h6:      p.volume.h6,
//                             volume_h1:      p.volume.h1,
//                             volume_m5:      p.volume.m5,
//                             priceChange_m5: p.priceChange.m5,
//                             priceChange_h1: p.priceChange.h1,
//                             priceChange_h6: p.priceChange.h6,
//                             priceChange_h24: p.priceChange.h24,
//                             liquidity_usd:  p.liquidity.usd,
//                             liquidity_base: p.liquidity.base,
//                             priceNative:    Number(p.priceNative),
//                             priceUsd:       Number(p.priceUsd),
//                             pic:            p.info ? p.info.imageUrl : null
//                         }
//                         if(!cur[token].priceUsdOriginal) {
//                             upd.priceUsdOriginal = Number(p.priceUsd)
//                         } else {
//                             upd.priceCompare =  cur[token].priceUsdOriginal/Number(p.priceUsd)
//                         }
//                         rtb.ref(`/${host}/pairs/${token}`).update(upd)
//                     } else {
//                         devlog(p);
//                     }
//                 }).catch(err=>{
//                     console.log(err)
//                 })
//         })
//     })
// })

function parseAndSet(date, token, data, rec){
    axios.get(`https://api.dexscreener.com/latest/dex/tokens/${token}`)
        .then(res=>{
            p = res.data;
            if(p && p.pairs){
                p = p.pairs[0];
                rtb.ref(`/${host}/pairs/${token}`).set({
                    createdAt:  +new Date(),
                    url: p.url,
                    pairAddress: p.pairAddress,
                    address: p.baseToken.address,
                    symbol:p.baseToken.symbol,
                    bfb: data.pairData['BFB'],
                    mintAuthority: data.pairData.additionalTokenData.mintAuthority,
                    freezeAuthority: data.pairData.additionalTokenData.freezeAuthority,
                    totalSupply: data.pairData.additionalTokenData.totalSupply,
                    exist: data.pairData.additionalTokenData.exist,
                    liquiditySupply: data.pairData.liquiditySupply,
                    liquiditySupplyPercent: data.pairData.liquiditySupplyPercent,
                    pooledSol: data.pairData.pooledSol,
                    initialSolPrice: data.pairData.initialSolPrice,
                    solRate: data.rater.solRate,
                    directRate: data.rater.directRate,
                    singleTransactionBuyRate: data.rater.singleTransactionBuyRate,
                    buyersTransferRate: data.rater.buyersTransferRate,
                    cexTransferRate: data.rater.cexTransferRate,
                    priceNative: Number(p.priceNative),
                    priceUsd: Number(p.priceUsd),
                    priceUsdOriginal: Number(p.priceUsd),
                    // curPr: null,
                    // difPriceusd: null,
                    volume_h24: p.volume.h24,
                    volume_h6: p.volume.h6,
                    volume_h1: p.volume.h1,
                    volume_m5: p.volume.m5,
                    priceChange_m5: p.priceChange.m5,
                    priceChange_h1: p.priceChange.h1,
                    priceChange_h6: p.priceChange.h6,
                    priceChange_h24: p.priceChange.h24,
                    liquidity_usd: p.liquidity.usd,
                    liquidity_base: p.liquidity.base,
                    // parsed: false
                }).then(()=>{
                    rtb.ref(`/${host}/inc/${rec.key}`).update({
                        parsed: +new Date()
                    })
                }).catch(err=>{
                    devlog(err)
                })
            } else {
                rtb.ref(`/${host}/pairs/${token}`).set({
                    createdAt:  +new Date(),
                    // url: p.url,
                    // pairAddress: p.pairAddress,
                    // address: p.baseToken.address,
                    // symbol:p.baseToken.symbol,
                    bfb: data.pairData['BFB'],
                    mintAuthority: data.pairData.additionalTokenData.mintAuthority,
                    freezeAuthority: data.pairData.additionalTokenData.freezeAuthority,
                    totalSupply: data.pairData.additionalTokenData.totalSupply,
                    exist: data.pairData.additionalTokenData.exist,
                    liquiditySupply: data.pairData.liquiditySupply,
                    liquiditySupplyPercent: data.pairData.liquiditySupplyPercent,
                    pooledSol: data.pairData.pooledSol,
                    initialSolPrice: data.pairData.initialSolPrice,
                    solRate: data.rater.solRate,
                    directRate: data.rater.directRate,
                    singleTransactionBuyRate: data.rater.singleTransactionBuyRate,
                    buyersTransferRate: data.rater.buyersTransferRate,
                    cexTransferRate: data.rater.cexTransferRate
                })
            }
        })
        .catch(err=>{
            devlog(err)
        })
    
}

router.get(`/view`,(req,res)=>{
    res.render(`${host}/view`)
})

module.exports = router;