var express = require('express');
var router = express.Router();
var axios = require('axios');
var cors = require('cors')
const getToken = require('./apitoken');


router.use(cors())

const dimazvali = 144489840;
const testChannel = -1001875160171;


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


let db = initializeApp({
    credential: cert({
        "type": "service_account",
        "project_id": "dimdimwine",
        "private_key_id": "99e88c0a720a916679e5f89a20243e013bfa35ac",
        "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDyFyziM2o4RZis\nBiWdczAFNFJ60O7I1/seClcvKZ3UXz0lTaUgC3CU93ES6mY8r8HWBkG4keaF9Kjo\n1RRFrz7cb7OH3zXtdOIfCK06yg2lNGTCiw49jyll+XIk92md8bdutE84PC55YM7J\nT8uCFWHO7J+LXJ/hKy7SG28qADwhdLpZEXKRXS4zWRnZFivD2cE7RUjoPnyxkyW8\nOJD5yZ3xQxTThlZJ25n96Lbou9QwTXJDjRLoMAQsCeflyQ4cAPI0vaPZUEIhYQu5\ns1vhJ0AtCyd1s8mpBYOQU6Prs27azpyYeAXV4sYgpVzWaeAT3qmZZ1OZypy2CUnk\neKC5CjWJAgMBAAECggEAAY+yCRNuepvC9vkN17dydoDL4gw5k1oGkz8F05a1HzWD\nXhuOFmgnJbl4JThrHbZpzZ46C51amz/ksaZjfGo7luMG3rggej49ZxiAkCyAF1yr\nJFtj5XRoPpwekavMJpSfK5DwzIVhggQ50S/j5Bw3MUUdZ6IFS0fNWYA2df2NEGTT\nyMas3f3nQdYyeHWCwagVEuaYKuvBNY9eGztk4Fdn9nyjViWmYORBnCeSrnF5vMRh\ngroDtWGrru348VGwJ7f15yMCYSBYuydYwlFPS+LAeHCJ2/0TwDb39tSe0edJjBcq\nt8w5thhdD+1/TtI4D7tRnodABRrY/Q9/NZ7KMIyK8QKBgQD6keTKaXAZw0G+PHSR\nb1TPO8sSJr0IRZ381n9+SSTTNfIxdaBS2w+tVtnKSGuo3oPT09nmzdY+n+Rmek9V\nqFsz3N0WUT6pkvqd31Gunw+xr66lHdbvXHzUgHciKnWawrJ5yi2DYmSRsle0TnMQ\ntEeFZEuTlnP6bajVQpNIAGYqiwKBgQD3Vj1tm1iJsW5jsaOxckuRtJMBWJGHAdEF\nZ6QCsuU2m3Tumd5tTOXd3hBv2L+BLcduhcq7aKhEx7YjXPYAR/fw9ZvMcJz8/2m2\nVX6UTpSDrGWdezt/EYydA2TLVI7rFUEyxtr1Vfioi3DYyuAROGUPtPxTlWMYPmRU\ndeI7PdmmuwKBgACsQ6EHh3WKQLLyFp4NXnzv/CugTwGmrjXvnYgJSkAG9Q+M8VFH\npVMh2JPifeeGMXRwLTWhd+HTLBnaWjwwp44MGcvli/WIn4OtBdsiMjiX8DAhVGJw\nLSWk8qz00DwKKdCJ6nVf3kVF5VZmn4h783U4P7u1u7oAcWOhOiQHXD7hAoGAGFmR\nKp1Elim1qHLwnqOV9P5GCrfhe90d6t5NM0bRchLT7DmRwEj1yGX4UEqSb/FF1Qeu\n8cxX5I2UzN52CYkMS9iiQfpEOlQa4CyCja8+x8fNKTfcn6Hmqf6PicUFXPd2t70E\nCWsxU8aGkZFHhep7aJR00vW+D8D0t6vzXcm1B8kCgYEAuwKo1s5HHlvvthElf5bt\nhrzbPSxXR0CAIxhOx2elIBcy5fMqViPzS361A65kf08ibR8fUt7KAndDDXzponYV\ngl/gPK5yhdzhINEhTjvpGpfH3UT0pUyRa8k0/e5FkR6OsgV/CLG+VTpoExmAu2MG\nffrKQo4nFL0UoKKrTTeWQ3Q=\n-----END PRIVATE KEY-----\n",
        "client_email": "firebase-adminsdk-kii5h@dimdimwine.iam.gserviceaccount.com",
        "client_id": "118321941073088796293",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-kii5h%40dimdimwine.iam.gserviceaccount.com"
    }),
    databaseURL: "https://dimdimwine.firebaseio.com"
}, 'wineBot');

let fb = getFirestore(db)

var kbd2 = {
    keyboard: [
        [{text: 'Покажите все'}],
        [{text: 'по региону'},{text: 'по винодельне'}],
        [{text: 'в корзине'}]
    ],
    resize_keyboard: true
}

let activeUsers = {}


fb.collection(`users`).get().then(u=>{
    u.docs.forEach(user=>{
        activeUsers[user.id] = user.data()
    })
})

const emotions = {
    lost: () => {
        let e = [
            'Куда вас, сударь, к черту занесло?..',
            'Оглянитесь вокруг, где это вы?..',
            'Бегите оттуда!',
            'Вот это поворот!'
        ]
        return e[Math.floor(Math.random() * e.length)]
    },
    confirm: (name) => {
        let e = [
            `Будет исполнено, ${name}!`,
            `Так точно, ${name}!`,
            `Roger that.`,
            `Есть!`
        ]
        return e[Math.floor(Math.random() * e.length)]
    },
    error: () => {
        let e = [
            `Увы!`,
            `Позор джунглям!`,
            `Вот никогда же так не было, и вот... опять...`,
            `Упс...`,
            `Оуч!`,
            `Ай-яй-яй...`,
            `Оц.`
        ]
        return e[Math.floor(Math.random() * e.length)]
    }
}

function regNewUser(user){
    user.since = new Date()
    fb.collection('users').doc(user.id.toString()).set(user).then(()=>{
        
        activeUsers[user.id] = user;
        
        sendMessage({
            chat_id:        user.id,
            text:           'Приветики! Я приветственное слово, меня еще нужно настроить',
            reply_markup:   kbd2
        })

        sendMessage({
            chat_id: testChannel,
            text: `#newcomer\nhttps://t.me/${user.username} ${user.name}`
        })
    })
}

// var kbd = () => {
//     return {
//         keyboard: [
//             [{text: 'Покажите все'}]
//             [{text: 'по региону'},{text: 'по винодельне'}]
//         ],
//         resize_keyboard: true
//     }
// }

class entity {
    constructor(e){

    }
    get new(){
        this.createdAt = new Date()
        return JSON.parse(JSON.stringify(this))
    }
    get json(){
        return JSON.parse(JSON.stringify(this))
    }
}

class wine extends entity {
    
    

    constructor(w){
        super(w)
        this.active =       w[1];
        this.wineyard =     w[2];
        this.name=          w[3];
        this.vintage =      w[4] || null;
        this.price =        w[5] || null;
        this.volume =       w[6] || null;
        this.sort =         w[7] || null;
        this.alc =          w[8] || null;
        this.sugar =        w[9] || null;
        this.pic =          w[10] || null;
        this.description =  w[11] || null;
        this.left =         w[12] || null;
    }   
    
}

class best extends entity {
    constructor(w){
        super(w)
        this.active =       w[1];
        this.name =         w[2];
        this.description=   w[3];
        this.length =          w[4] || null;
        // this.length =       w[5]
    }
}

class bestRelation extends entity {
    constructor(w){
        super(w)
        this.active =       w[1];
        this.best =         w[2];
        this.wine=          w[3];
        this.description=   w[4];
    }
}

router.post('/wine',(req,res)=>{
    if(req.headers.secret == process.env.wineSecret){
        fb.collection('wines')
            .add(new wine(req.body).new)
            .then(r=>res.json({id:r.id}))
            .catch(err=>res.status(500).send(err.message))
    } else {
        res.sendStatus(403)
    }
})

router.post('/bestsRelations',(req,res)=>{
    if(req.headers.secret == process.env.wineSecret){

        fb.collection('bestsRelations')
            .add(new bestRelation(req.body).new)
            .then(r=>res.json({id:r.id}))
            .catch(err=>{
                console.log(err)
                res.status(500).send(err.message)
            })
    } else {
        res.sendStatus(403)
    }
})

router.patch('/bestsRelations/:relation',(req,res)=>{
    if(req.headers.secret == process.env.wineSecret){
        fb.collection('bestsRelations')
            .doc(req.params.relation)
            .update(new bestRelation(req.body).json)
            .then(r=>res.json({id:req.params.best}))
            .catch(err=>res.status(500).send(err.message))
    } else {
        res.sendStatus(403)
    }
})

router.post('/bests',(req,res)=>{
    if(req.headers.secret == process.env.wineSecret){
        
        console.log(req.body)
        try{
            console.log(new best(req.body).new)
        } catch(err){
            console.log(err)
        }
        

        fb.collection('bests')
            .add(new best(req.body).new)
            .then(r=>res.json({id:r.id}))
            .catch(err=>{
                console.log(err)
                res.status(500).send(err.message)
            })
    } else {
        res.sendStatus(403)
    }
})

router.patch('/bests/:best',(req,res)=>{
    if(req.headers.secret == process.env.wineSecret){
        fb.collection('bests')
            .doc(req.params.best)
            .update(new best(req.body).json)
            .then(r=>res.json({id:req.params.best}))
            .catch(err=>res.status(500).send(err.message))
    } else {
        res.sendStatus(403)
    }
})

router.put('/wine',(req,res)=>{
    if(req.headers.secret == process.env.wineSecret){
        fb.collection('wines').doc(req.body[0]).update(new wine(req.body).json)
            .then(r=>res.json({id:req.body[0]}))
            .catch(err=>res.status(500).send(err.message))
    } else {
        res.sendStatus(403)
    }
})


// router.get(`/api/wines/list`,(req,res)=>{
//     fb.collection('wines').where('active','==',true).get().then(col=>{
//         res.json(col.docs.map(w=>{
//             let r = w.data();
//             r.id = w.id;
//             return r
//         }))
//     })
// })

router.get(`/api/start/:user`,(req,res)=>{
    let data = [];

    fb.collection('userEntries').add({
        user:       req.params.user,
        createdAt:  new Date()
    })

    data.push(fb.collection('wines').where('active','==',true).get().then(col=>{
        return col.docs.map(w=>{
            let r = w.data();
            r.id = w.id;
            return r
        })
    }))


    data.push(fb.collection('users').doc(req.params.user.toString()).get().then(u=> u.data()))

    data.push(fb.collection('carts').doc(req.params.user).get().then(c=>c.data()))

    data.push(fb.collection('bests').where('active','==',true).get().then(col=>{
        return col.docs.map(w=>{
            let r = w.data();
            r.id = w.id;
            return r
        })
    }))

    Promise.all(data).then(d=>{
        res.json({
            wines:  d[0],
            user:   d[1],
            cart:   d[2],
            bests:  d[3]
        })
    })


})

router.get('/webapp',(req,res)=>{
    
    res.render('webapp',{
        title: 'Первый!'
    })
})

router.get('/user/:id',(req,res)=>{
    fb.collection('users').doc(req.params.id).get().then(user=>{
        if(user.exists){
            res.json(user.data())
        } else {
            res.sendStatus(404)
        }
    })
})

router.put('/user/:id',(req,res)=>{
    fb.collection('users').doc(req.params.id).get().then(user=>{
        if(user.exists){
            fb.collection('users').doc(req.params.id).update(req.body)
        } else {
            res.sendStatus(404)
        }
    })
})

router.post('/webhook', cors(), function (req, res, next) {
    let user = {};

    console.log(req.body)
    if(req.body.message){
        user.id =       req.body.message.from.id;
        user.name =     req.body.message.from.first_name;
        user.username = req.body.message.from.username || null;
    
        if(!activeUsers[user.id]){
            regNewUser(user)
        }
    }

   console.log(req.body.callback_query)

    if (req.body.message && req.body.message.text){
        let txt = req.body.message.text;

        switch (txt) {
            case `статьи`:{
                sendMessage({
                    chat_id: user.id,
                    text: 'Попробуем открыть что-нибудь',
                    reply_markup: {
                        inline_keyboard:[
                            [{
                                text: 'Итоги премии Where to Eat Siberia 2022',
                                web_app: {
                                    url: 'https://www.restorating.ru/spb/articles/wheretoeat-2022'                                    
                                }
                            }]
                        ]
                    }
                })
                break;
            }
            case `Покажите все`:
                fb.collection('wines').where('active','==',true).get().then(col=>{
                    col.docs.forEach((wine,i)=>{
                        setTimeout(function(){
                            let w = wine.data();
                            sendMessage({
                                chat_id: user.id,
                                photo: w.pic || '/images/broken.jpg',
                                caption: `*${w.name}* (${w.wineyard})\n${w.description}`,
                                parse_mode: 'Markdown',
                                reply_markup: {
                                    inline_keyboard: [
                                        [{
                                            text: 'В корзину',
                                            callback_data: JSON.stringify({
                                                int:'add',
                                                item:wine.id
                                            })
                                        }]
                                    ]
                                }
                            },'sendPhoto')
                        },i*200)
                    })
                })
                break;
            default:
                sendMessage({
                    chat_id: user.id,
                    text: 'Извините, пока что я могу только повторять: '+req.body.message.text,
                    reply_markup: kbd2
                })
        }
            
        sendMessage({
            chat_id: testChannel,
            text: `${user.username} пишет:\n ${req.body.message.text}`
        })

    } else if (req.body.callback_query) {
        console.log('это кнопка!')
        handleQuery(req)
    } 

    res.sendStatus(200)
    
})


function sendMessage(m, ep) {
    return axios.post('https://api.telegram.org/bot' + process.env.wineBottoken + '/' + (ep ? ep : 'sendMessage'), m, {
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(telres => {
        return telres.data;
    }).catch(err => {
        console.log(err)
        return err;
    })
}

function handleQuery(req) {
    
    let user ={
        id:     req.body.callback_query.from.id,
        name:   req.body.callback_query.from.first_name
    }

    let qid = req.body.callback_query.id;

    let cb = JSON.parse(req.body.callback_query.data)
    console.log(cb.int)

    switch(cb.int){
        case 'add':{
            fb.collection('carts').doc(user.id.toString()).get().then(c=>{
                if(c.exists){
                    let cart = c.data()
                    if(cart[cb.item]){
                        fb.collection('carts').doc(user.id.toString()).update({
                            [cb.item]: FieldValue.increment(1)
                        }).then(()=>{
                            sendMessage({
                                callback_query_id: qid,
                                text: '+1'
                            }, 'answerCallbackQuery')
                        }).catch(err=>{
                            console.log(err)
                        })
                    } 
                } else {
                    fb.collection('carts').doc(user.id.toString()).set({
                        [cb.item]: 1,
                    }).then(()=>{
                        sendMessage({
                            callback_query_id: qid,
                            text: '+1'
                        }, 'answerCallbackQuery')
                    }).catch(err=>{
                        console.log(err)
                    })
                }
                
            }).catch(err=>{
                console.log(err)
            })
            break;
        }
        
        case 'remove':{
            fb.collection('carts').doc(user.id.toString()).get().then(c=>{
                cart = c.data();
                if(cart[cb.item]){
                    fb.collection('carts').doc(user.id.toString()).update({
                        [cb.item]: FieldValue.increment(-1)
                    }).then(()=>{
                        sendMessage({
                            callback_query_id: qid,
                            text: '-1'
                        }, 'answerCallbackQuery')
                    })
                }
            })
            break
        }
    }
}

module.exports = router;

