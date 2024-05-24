let ngrok = process.env.ngrok2 
// let ngrok = process.env.ngrok 

const host = `books`;
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

let adminTokens =       fb.collection(`DIMAZVALIadminTokens`);
// let udb =               fb.collection(`${host}Users`);

let udb =               fb.collection(`${host}Users`);
let messages =          fb.collection(`${host}UserMessages`);
let books =             fb.collection(`${host}Books`);
let deals =             fb.collection(`${host}Deals`);
let logs =              fb.collection(`${host}Logs`);
let cities =            fb.collection(`${host}Cities`);
let shops =             fb.collection(`${host}Shops`);
let offers =            fb.collection(`${host}Offers`);


let langs = [{
    id:     `en`,
    name:   `Английский`,
    active:true
},{
    id: `ka`,
    name: `Грузинский`,
    active:true
},{
    id: `ru`,
    name: `Русский`,
    active:true
}]

let savedCities = {};

cities.where(`active`,'==',true).get().then(col=>savedCities = objectify(handleQuery(col)))

function addBook(req,res,admin, noRedirect){
    
    let b = {
        createdAt:  new Date(),
        active:     true,
        createdBy:  +admin.id,
        name:       req.body.name ? req.body.name.trim() : null,
        description:req.body.description || null,
        pic:        req.body.pic    || null,
        isbn:       req.body.isbn   || null,
        lang:       req.body.lang   || `ru`,
        author:     req.body.author || null,
        year:       +req.body.year  || null,
        kids:       req.body.kids   || false,
    }

    return books.add(b).then(rec=>{
        
        if(req.files && req.files.cover){
            let sampleFile = req.files.cover;
                
            let fname = +new Date()+sampleFile.name
                        
            let uploadPath = __dirname + `/../public/images/books/${fname}`
                            
                sampleFile.mv(uploadPath, function(err) {
                
                    if (err) return res.status(500).send(err);
                    

                    s.bucket(`dimazvalimisc`)
                        .upload(uploadPath)
                        .then(()=>{
                            s.bucket(`dimazvalimisc`).file(fname).getSignedUrl({
                                action: `read`,
                                expires: '03-09-2491'
                            }).then(link=>{
                                books.doc(rec.id).update({
                                    pic: link[0]
                                })
                                fs.unlinkSync(uploadPath)

                            })
                        })
                        .catch(err=>{
                            console.log(err)
                        })
                
                });
        }        

        log({
            text: `${uname(admin,admin.id)} добавляет книгу ${b.name}.`,
            book: rec.id,
            admin: +admin.id
        })
        if(!noRedirect) return res.redirect(`/${host}/web?page=newOffer_${rec.id}`)
        return res.json({
            success: true,
            id: rec.id
        })

    })
}

function addOffer(req,res,admin,app){
    
    if(!req.body.book) return res.status(400).send(`no book provided`);

    getDoc(books, req.body.book)
        .then(b=>{
            if(!b) return res.sendStatus(404)
            
            let o = {
                createdAt:      new Date(),
                active:         true,
                createdBy:      +admin.id,
                book:           b.id,
                bookName:       b.name,
                description:    req.body.description || null,
                bookDescription: b.description || null,
                pic:            req.body.pic    || null,
                bookPic:        b.pic || null,
                isbn:           b.isbn   || null,
                lang:           b.lang   || `ru`,
                author:         b.author || null,
                rent:           req.body.rent || false,
                price:          +req.body.price || null,
                owner:          +req.body.owner || +admin.id || null,
                state:          req.body.state || null,
                city:           req.body.city || admin.city || null,
                address:        req.body.address,
            }

            devlog(o)
        
            return offers.add(o).then(rec=>{

                books.doc(b.id).update({
                    offers: {
                        [req.body.city]: FieldValue.increment(1)
                    }
                })
                
                log({
                    text: `${uname(admin,admin.id)} добавляет в продажу книгу ${b.name}.`,
                    offer: rec.id,
                    // admin: +admin.id
                })

                if(req.files){
                    devlog(`ФАЙЛО`)
                    devlog(req.files.cover)
                } else {
                    devlog(`нет файлов`)
                }

                if(app){
                    res.redirect(`/${host}/app?page=offers_${rec.id}`)
                } else {
                    res.redirect(`/${host}/web?page=offers_${rec.id}`)
                }

                if(req.files && req.files.cover){
                    let sampleFile = req.files.cover;

                        let fname = +new Date()+sampleFile.name
                        
                        let uploadPath = __dirname + `/../public/images/books/${fname}`
                        
                        sampleFile.mv(uploadPath, function(err) {
                        
                            if (err) return res.status(500).send(err);
                            
                            s.bucket(`dimazvalimisc`)
                                .upload(uploadPath)
                                .then(()=>{
                                    s.bucket(`dimazvalimisc`).file(fname).getSignedUrl({
                                        action: `read`,
                                        expires: '03-09-2491'
                                    }).then(link=>{
                                        offers.doc(rec.id).update({
                                            pic: link[0]
                                        }).then(()=>{
                                            alertNewOffer(rec.id)
                                        })
                                        fs.unlinkSync(uploadPath)
                                    })
                                })
                                .catch(err=>{
                                    console.log(err)
                                })
                        
                        });
                } else {
                    alertNewOffer(rec.id)
                } 
            })
        })
}

function alertNewOffer(id){
    getDoc(offers,id).then(o=>{
        getDoc(books,o.book).then(b=>{
            udb
                .where(`city`,'==',o.city)
                .where(`active`,'==',true)
                .get()
                .then(col=>{
                    handleQuery(col)
                        .filter(u=>!u.noSpam)
                        .filter(u=>u[b.lang])
                        .forEach((u,i)=>{
                            setTimeout(()=>{
                                sendOffer(b,o,u,true)
                            },i*200)
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


function sendMessage(req,res,admin){
    let t = {
        chat_id: req.body.user,
        text:   req.body.text
    }
    
    sendMessage2(t, false, token, messages,{admin: +admin.id})
    
    if(res) res.sendStatus(200);
}

const datatypes = {
    messages:{
        col: messages,
        newDoc: sendMessage,
    },
    offers:{
        col: offers,
        newDoc: addOffer
    },
    books: {
        col:    books,
        newDoc: addBook,
    },
    deals:{
        col:    deals,
        // newDoc: addDeal,
    },
    cities: {
        col:    cities,
        newDoc: newEntity,
        extras: [`currency`]
    },
    users: {
        col:    udb,
    }
}

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

router.all(`/admin/:method`,(req,res)=>{
    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(admin=>{

            if(!admin) return res.sendStatus(403)

            devlog(admin)

            switch(req.params.method){
                case `langs`:{
                    return res.json(langs)
                }

                case `bookState`:{
                    return res.json([{
                        id: `new`,
                        name: `Новая`,
                        active:true
                    },{
                        id: `used`,
                        name: `Читаная`,
                        active:true
                    }])
                }

                case `offersByUser`:{
                    return offers.where(`createdBy`,'==',+admin.id).get().then(col=>res.json(handleQuery(col,true)))
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

if(process.env.develop){
    router.post(`/import/:id`,(req,res)=>{
        if(!datatypes[req.params.id])  return res.sendStatus(404);

        req.body.forEach(i=>{
            i.createdAt = new Date()
            datatypes[req.params.id].col.doc(i.id).set(i)
        })
    })
}


router.get(`/catalogue`,(req,res)=>{
    
    let filters = {
        name: `по названию`,
        city: `в городе`,
        isbn: `по isbn`
    };
    
    let query = offers;
    
    Object.keys(req.query).forEach(k=>{
        if(filters[k]) query = query.where(k,'==',req.query[k])
    })

    query.get().then(col=>{
        res.render(`${host}/catalogue`,{
            q:      req.query,
            data:   handleQuery(col)
        })
    })
})


router.all(`/api/:method/:id`,(req,res)=>{
    
    if (!req.signedCookies.userToken) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(req.signedCookies.userToken).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(user=>{
            if(!user) return res.sendStatus(403)

            devlog(user)
            
            switch(req.params.method){



                case `deals`:{
                    switch(req.method){
                        case `PUT`:{
                            if(!req.body.intention) return res.sendStatus(400);
                            let inc = req.body.intention.split('_');
                            let ref = deals.doc(req.params.id);
                            
                            return getDoc(deals, req.params.id).then(d=>{
                                if(!d||!d.active) return res.sendStatus(404);
                                switch(inc[0]){
                                
                                    case `seller`:{

                                        if(d.seller !== +user.id) return res.sendStatus(403)

                                        switch(inc[1]){
                                            case `confirmToRent`:{
                                                if(d.status != `inReview`) return res.status(400).send(`Недоступно для текущего статуса.`)
                                                return startDeal(ref, d, res)
                                            }
                                            case `cancelledBySeller`:{
                                                if(d.status != `inReview`) return res.status(400).send(`Недоступно для текущего статуса.`)
                                                return cancelDeal(`sellerCancel`, ref, d, res)
                                            }

                                            case `deliveredBySeller`:{
                                                if(d.sellerConfirmed) return res.status(400).send(`Уже было отмечено.`)
                                                return transferBook(ref,d,`seller`,res)
                                            }

                                            case `closeDealBySeller`:{
                                                if(d.sellerReturned) return res.status(400).send(`Уже было отмечено.`)
                                                closeDeal(ref,d,`seller`,res)
                                            }
                                        }
                                    }
    
                                    case `buyer`:{
                                        
                                        if(d.buyer !== +user.id) return res.sendStatus(403)
                                        
                                        switch(inc[1]){
                                            case `cancelledByBuyer`:{
                                                if(d.status != `inReview`) return res.status(400).send(`Недоступно для текущего статуса.`)
                                                return cancelDeal(`buyerCancel`, ref, d, res)
                                            }

                                            case `deliveredByBuyer`:{
                                                if(d.buyerConfirmed) return res.status(400).send(`Уже было отмечено`)
                                                return transferBook(ref,d,`buyer`,res)
                                            }
                                            case `closeDealByBuyer`:{
                                                if(d.buyerReturned) return res.status(400).send(`Уже было отмечено`)
                                                closeDeal(ref,d,`buyer`,res)
                                            }
                                        }
                                    }
    
                                    default:{
                                        return res.sendStatus(404)
                                    }
                                }
                            })

                            
                        }
                        case `GET`:{
                            return getDoc(deals,req.params.id).then(d=>{
                                if(!d)  return res.sendStatus(404)
                                if(d.seller != +user.id) return res.sendStatus(403)
                                res.json(d)
                            })
                        }
                    }
                }

                case `books`:{
                    return getDoc(books, req.params.id).then(book=>{
                        if(!book || !book.active) return res.sendStatus(404)
                        return res.json(book)
                    })
                }

                case `isbn`:{

                    let isbn = req.params.id.replace(/-/g,'')
                    
                    devlog(isbn);

                    if(isbn.length != 13 && isbn.length != 10) return res.status(400).send(`Извините, ${isbn} не похоже на ISBN`)

                    return books
                        .where(`active`,'==',true)
                        .where(`isbn`,'==',isbn)
                        .get()
                        .then(col=>{
                            if(col.docs[    0]) return res.json({
                                id: col.docs[0].id
                            })
                            devlog(handleQuery(col))
                            return axios.get(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`).then(books=>{
                                if(books.data && books.data.totalItems){
                                    let b = books.data.items[0].volumeInfo

                                    res.json({
                                        name:           b.title,
                                        description:    b.description,
                                        lang:           b.language,
                                        author:         (b.authors||[]).join(', '),
                                        publisher:      b.publisher,
                                        year:           b.publishedDate
                                    })
                                } else {
                                    res.json({})
                                }
                            })
                        })
                            
                    
                }
                case `profile`:{

                    
                    if(user.id  !== user.id) return res.sendStatus(403);

                    let ref = udb.doc(req.params.id);

                    let allowedChanges = [`city`,`news`,`first_name`,`last_name`, `address`]

                    if(req.body.attr == `city` && req.body.value == `newCity`) {
                        sendMessage2({
                            chat_id: common.dimazvali,
                            text: `${uname(user,user.id)} запрашивает новый город.`
                        },false,process.env.booksToken)
    
                        sendMessage2({
                            chat_id: user.id,
                            text: `Пожалуйста, напишите, в каком городе вы находитесь — я передам администратору.`
                        },false,process.env.booksToken)
                    }

                    if(allowedChanges.indexOf(req.body.attr)>-1) return updateEntity(req,res,ref,user)
                    
                    return res.sendStatus(403)

                }
                case `offers`:{
                    let ref = offers.doc(req.params.id);

                    return getDoc(offers,req.params.id).then(o=>{
                        if(!o) return res.sendStatus(404);

                        switch(req.method){
                            case `GET`:{
                                ref.update({
                                    views: FieldValue.increment(1)
                                })
                                delete o.createdBy
                                delete o.owner
                                return res.json(o)
                            }
                            case `PUT`:{
                                if (o.createdBy != +user.id) return res.sendStatus(403);
                                return updateEntity(req,res,ref,user)
                            }
                            case `DELETE`:{
                                if (o.createdBy != +user.id) return res.sendStatus(403);
                                return ref.update({
                                    active: false
                                }).then(()=>{
                                    res.json({
                                        success: true,
                                        comment: `Книга была скрыта.`
                                    })

                                    log({
                                        text: `${uname(user,user.id)} скрывает книгу ${o.bookName}`,
                                        offer: req.params.id
                                    })
                                })
                            }
                        }
                    })
                    
                }
                case `requestSeller`:{
                    return getDoc(deals,req.params.id).then(d=>{
                        if(!d || !d.active) return res.sendStatus(404)
                        getUser(d.seller,udb).then(s=>{
                            sendMessage2({
                                chat_id: user.id,
                                parse_mode: `Markdown`,
                                text: `Владелец книги «${d.bookName}»: [@${s.username||s.first_name||s.last_name}](tg://user?id=${s.id})`
                            },false,process.env.booksToken,messages).then(()=>{
                                res.json({
                                    success: true,
                                    comment: `Я отправил вам сообщение с контактами.`
                                })
                            })
                        })
                    })
                }
                case `requestBuyer`:{
                    return getDoc(deals,req.params.id).then(d=>{
                        if(!d || !d.active) return res.sendStatus(404)
                        getUser(d.buyer,udb).then(s=>{
                            sendMessage2({
                                chat_id: user.id,
                                parse_mode: `Markdown`,
                                text: `Держатель книги «${d.bookName}»: [@${s.username||s.first_name||s.last_name}](tg://user?id=${s.id})`
                            },false,process.env.booksToken,messages).then(()=>{
                                res.json({
                                    success: true,
                                    comment: `Я отправил вам сообщение с контактами.`
                                })
                            })
                        })
                    })
                }
                default:{
                    res.sendStatus(404)
                }
            }
        })
    })
})
router.all(`/api/:method`,(req,res)=>{
    
    if (!req.signedCookies.userToken) return res.status(401).send(`Вы кто вообще?`)
    
    adminTokens.doc(req.signedCookies.userToken).get().then(doc => {
        
        if (!doc.exists) return res.sendStatus(403)
        
        let token = handleDoc(doc)

        getUser(token.user,udb).then(user=>{
            if(!user) return res.sendStatus(403)

            devlog(user)
            
            switch(req.params.method){

                case `books`:{
                    switch(req.method){
                        
                        case `POST`:{
                            
                            devlog(`пост книжки`)
                            
                            return addBook(req,res,user,true)
                        }
                    }
                }

                case `deals`:{
                    switch(req.method){
                        case `GET`:{
                            if(!req.query.offer) return res.status(400).send(`no offer provided`)

                            return getDoc(offers,req.query.offer).then(o=>{
                                if(!o) return res.sendStatus(404)
                                if(o.createdBy !== +user.id) return res.sendStatus(403)
                                deals
                                    .where(`offer`,'==',req.query.offer)
                                    .get()
                                    .then(col=>{
                                        res.json(handleQuery(col,true))
                                    })
                            })


                        }
                        case `POST`:{
                            if(!req.body.offer) return res.sendStatus(400)
                            return bookaBook(req.body.offer,req.body.type || `rent`,false, user, req, res)
                        }
                    }
                }

                case `cities`:{
                    return cities.get().then(col=>res.json(handleQuery(col,false,true).filter(a=>a.active)))
                    // res.json(savedCities)
                }
                case `languages`:{
                    return res.json(langs);
                }
                
                case `profile`:{
                    let data = [];

                    data.push(
                        offers
                            .where(`owner`,'==',+user.id)
                            // .where(`active`,'==',true)
                            .get()
                            .then(col=> handleQuery(col,true))
                    )

                    data.push(
                        deals
                            .where(`seller`,'==',+user.id)
                            // .where(`active`,'==',true)
                            .get()
                            .then(col=> handleQuery(col,true))
                    )

                    data.push(
                        deals
                            .where(`buyer`,'==',+user.id)
                            // .where(`active`,'==',true)
                            .get()
                            .then(col=> handleQuery(col,true))
                    )


                    return Promise.all(data).then(data=>{
                        res.json({
                            user:       user,
                            offers:     data[0],
                            inRent:     data[2],
                            rented:     data[1]
                        })
                    }).catch(err=>handleError(err,res))

                }

                case `offers`:{
                    if(!user.city) return res.status(400).send(`Выберите город!`);
                    switch(req.method){
                        case `GET`:{
                            return offers
                                .where(`active`,'==',true)
                                .where(`city`,`==`, req.query.city || user.city)
                                .get()
                                .then(col=>{
                                    
                                    let data = sanitize(handleQuery(col,true).filter(o=>o.createdBy != +user.id),[`createdBy`])

                                    Object.keys(req.query).forEach(q=>{
                                        data = data.filter(i=> i[q] == (Number(req.query[q]) ? Number(req.query[q]) : req.query[q]))
                                    })

                                    res.json(data)
                                })
                        }
                        case `POST`:{
                            return datatypes.offers.newDoc(req,res,user,true)
                        }
                    }
                    
                }
            }
        })
    })
})


router.get(`/isbn/:isbn`,(req,res)=>{
    let isbn = req.params.isbn.replace(/-/g,'')
    
    if(isbn.length != 13 && isbn.length != 10) return res.status(400).send(`Извините, ${isbn} не похоже на ISBN`)
            
    axios.get(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`).then(books=>{
        if(books.data && books.data.totalItems){
            let b = books.data.items[0].volumeInfo

            res.json({
                name:           b.title,
                description:    b.description,
                lang:           b.language,
                author:         b.authors.join(', '),
                publisher:      b.publisher,
                year:           b.publishedDate
            })
        } else {
            res.json({})
        }
    })
})


router.all(`/admin/:method/:id`,(req,res)=>{
    
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
                    success: true
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


router.post(`/authWebApp`,(req,res)=>{
    authWebApp(req,res,token,adminTokens,udb)  
})


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

router.post(`/sellerConcent`,(req,res)=>{
    getDoc(adminTokens, req.signedCookies.adminToken).then(t=>{
        
        if(!t || !t.active) return res.sendStatus(403)

        getUser(t.user,udb).then(u=>{

            if(!u) return res.sendStatus(400)

            udb.doc(t.user.toString()).update({
                seller:     true,
                address:    req.body.address || null,
                city:       req.body.city || null
            }).then(()=>{
                res.redirect(`/${host}/web?start=sellerConfirmed`)
                log({
                    silent: true,
                    text: `${uname(u,u.id)} регистрируется как продавец`
                })
            })
        })
    })
})


router.get(`/offers/:offer`,(req,res)=>{
    offers.doc(req.params.offer).get().then(o=>{
        
        o = handleDoc(o);

        if(!o) return res.render(`${host}/error`,{
            code: 404,
            name: `Нет такого предложения...`
        })

        let data = [];

        data.push(getDoc(books,o.book))

        data.push(offers
            .where(`book`,'==',o.book)
            .where(`active`,'==',true)
            .get()
            .then(col=>{
                return handleQuery(col,true)
            })
        )
        Promise.all(data).then(data=>{
            res.render(`${host}/offer`,{
                offer:      o,
                book:       data[0],
                offers:   data[1],
                dummyBook:  dummyBook,
                cur:(s,b)=>cur(s,b),
                cities: savedCities
            })
        })
    })
})

router.get(`/about`,(req,res)=>{
    res.render(`${host}/page`,{
        name: `О проекте`,
        html: `<p>${greeting()}! Вы находитесь на сайте проекта с рабочим названием «Книгожук». Давайте осмотримся.</p>
<p>Что мы делаем: сервис продажи/обмена/аренды книг с прицелом на экспатские круги (но не только).</p>
<h2>Зачем мы это делаем?</h2>
<p>Бумажные книги — это очень про нормальный быт. Очень многим сейчас недостает нормальности.</p>
<p>При этом экспаты (и не только) живут совсем не той жизнью, чтобы книги копить.</p> 
<p>Детские книги вообще копить бессмысленно, а выбрасывать невозможно.</p>
<p>Книги должны “жить”. То есть читаться. Обычные цепочки обмена что среди уехавших, что среди оставшихся успели пострадать: где-то разорваться, а где-то не успеть наладиться.</p>`
    })
})

router.get(`/contacts`,(req,res)=>{
    res.render(`${host}/page`,{
        name: `Поговорим?`,
        html: `<p>Автор идеи и технического воплощения — Дмитрий Шестаков, dimazvali@gmail.com, t.me/dimazvali.</p>`
    })
})



router.get(`/offers`,(req,res)=>{
    
    let queries = {
        city: `в городе`,
        bookName: `по названию`,
    }
    
    if(req.query.city) res.cookie('city', req.query.city, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        signed: true,
        httpOnly: true,
    })

    if(req.signedCookies.city && !req.query.city) req.query.city = req.signedCookies.city

    let user = {};

    if(req.signedCookies.admin){
        user = adminTokens.doc(req.signedCookies.admin).get().then(doc => {
            if(!doc.exists) user = {};
            udb.doc(doc.data().user.toString()).get().then(u=>{
                user = u.data();
            })
            return u.data()
        })
    }

    Promise.resolve(user).then(u=>{
        offers.where(`active`,'==',true).get().then(col=>{
            let books = handleQuery(col,true)
            let filters = [];
        
            Object.keys(req.query).filter(q=>req.query[q]).forEach(k=>{
                devlog(k)
                if(queries[k]) {            
                    books=books.filter(b => b[k])
                    if(k == `city`){
                        books = books.filter(b=> b[k] == req.query[k])
                        filters.push(`в ${savedCities[req.query[k]].name}`)
                    } else if (k == `bookName`){
                        books = books.filter(b=> b[k].toLowerCase().indexOf(req.query[k].toLowerCase().trim())>-1)
                        filters.push(`c названием «${req.query[k].toLowerCase().trim()}»`)
                    } else {
                        books = books.filter(b=>b[k] == req.query[k])
                        filters.push(`${queries[k]} ${req.query[k]}`)
                    }
                    
                }
            })
    
            res.render(`${host}/search`,{
                books:          books,
                cutMe:          cutMe,
                dummyBook:      dummyBook,
                seller:         u.seller,
                admin:          u.admin,
                cities:         savedCities,
                q:              req.query,
                city:           req.query.city || req.signedCookies.city || null,
                name:           filters.length ? `Книги ${filters.join(', ')}.` : `Новые поступления`,
                description:    books.length ? `${letterize(books.length,`книжечка`)} вы можете взять почитать (или забрать к себе в библиотеку).` : `К сожалению, мы не нашли ничего подходящего...`
            })
        })
    })

    
    
})


router.post(`/upload`,(req,res)=>{
    
    devlog(req.files)

    // res.sendStatus(200)

    if(!req.files || !req.files.file) return res.status(400).send(`А где же файл?`)
    if(!req.query.id || !req.query.collection || !datatypes[req.query.collection]) return res.status(400).send(`Неясно, что обновлять...`)
    
    getDoc(datatypes[req.query.collection].col,req.query.id).then(d=>{

        if(!d) return res.sendStatus(404);

        let sampleFile = req.files.file;

        let fname = +new Date()+sampleFile.name
                        
        let uploadPath = __dirname + `/../public/images/books/${fname}`
                        
        sampleFile.mv(uploadPath, function(err) {
        
        if (err) return res.status(500).send(err);
        
        s.bucket(`dimazvalimisc`)
            .upload(uploadPath)
            .then(()=>{
                s.bucket(`dimazvalimisc`).file(fname).getSignedUrl({
                    action: `read`,
                    expires: '03-09-2500'
                }).then(link=>{
                    datatypes[req.query.collection].col.doc(req.query.id).update({
                        pic:        link[0],
                        updatedAt:  new Date()
                    })
                    
                    fs.unlinkSync(uploadPath)

                    res.redirect(`${ngrok}/${host}/web?page=${req.query.collection}_${req.query.id}`)
                }).catch(err=>{
                    res.status(500).send(err.message)
                })
            })
            .catch(err=>{
                console.log(err)
            })
        
        });
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

router.get(`/app`,(req,res)=>{
    if(req.signedCookies.userToken){
        getDoc(adminTokens,req.signedCookies.userToken).then(proof=>{
            if(!proof) res.render(`${host}/app`,{
                authNeeded: true,
                start: req.query.startapp,
                cities: savedCities
            })
            getUser(proof.user,udb).then(u=>{
                res.render(`${host}/app`,{
                    user: u,
                    start: req.query.startapp,
                    cities: savedCities
                })
            })
        })
        
    } else {
        res.render(`${host}/app`,{
            authNeeded: true,
            start: req.query.startapp,
            cities: savedCities
        })
    }
    
})

router.get(`/web`,(req,res)=>{
    
    devlog(req.signedCookies.adminToken)

    if(!(process.env.develop == `true`) && !req.signedCookies.adminToken) return res.redirect(`${process.env.ngrok}/${host}/auth`)
    
    getDoc(adminTokens, (req.signedCookies.adminToken || process.env.adminToken)).then(t=>{

        devlog(t)

        // if(!req.signedCookies.adminToken && (process.env.develop == `true`)) return res.cookie('adminToken', req.query.adminToken || process.env.adminToken, {
        //     maxAge: 24 * 60 * 60 * 1000,
        //     signed: true,
        //     httpOnly: true,
        // })

        if(!t || !t.active) return res.sendStatus(403)

        getUser(t.user,udb).then(u=>{

            devlog(`пользватель получен`)

            if(process.env.develop && req.query.stopadmin) return logs
            .orderBy(`createdAt`,'desc')
            .limit(100)
            .where(`user`,`==`,+u.id)
            .get()
            .then(col=>{
                cities.get().then(col2=>{
                    res.render(`${host}/admin`,{
                        user:       u,
                        seller:     true,
                        admin:      false,
                        adminAccess: u.admin,
                        wysykey:    process.env.wysykey,
                        logs:       handleQuery(col),
                        cities:     objectify(handleQuery(col2))
                    })
                })
            })
            
            if(process.env.develop == `true`) return logs
                .orderBy(`createdAt`,'desc')
                .limit(100)
                .get()
                .then(col=>{
                    cities.get().then(col2=>{
                        res.cookie('adminToken', req.query.admintoken || process.env.adminToken, {
                            maxAge: 24 * 60 * 60 * 1000,
                            signed: true,
                            httpOnly: true,
                        }).render(`${host}/web`,{
                            user:       u,
                            admin:      req.query.admin ? true : false,
                            wysykey:    process.env.wysykey,
                            adminAccess: true,
                            start:      req.query.page,
                            logs:       handleQuery(col),
                            cities:     objectify(handleQuery(col2))
                        })
                    })
                }) 
        
        

            if(u.blocked) return res.sendStatus(403)

            if(u.admin && !req.query.stopAdmin) return logs
                .orderBy(`createdAt`,'desc')
                .limit(100)
                .get()
                .then(col=>{
                    cities.get().then(col2=>{
                        res.render(`${host}/web`,{
                            user:       u,
                            wysykey:    process.env.wysykey,
                            adminAccess: u.admin,
                            logs:       handleQuery(col),
                            cities:     objectify(handleQuery(col2))
                        })
                    })
                })

            
            if(u.seller || req.query.seller)  return logs
                .orderBy(`createdAt`,'desc')
                .limit(100)
                .where(`user`,`==`,+u.id)
                .get()
                .then(col=>{
                    cities.get().then(col2=>{
                        res.render(`${host}/admin`,{
                            user:       u,
                            seller:     true,
                            admin:      false,
                            adminAccess: u.admin,
                            wysykey:    process.env.wysykey,
                            logs:       handleQuery(col),
                            cities:     objectify(handleQuery(col2))
                        })
                    })
                })

            

            
            
            return cities.get().then(col=>{
                res.render(`${host}/concent`,{
                    light: true,
                    greetings:() => greeting(),
                    cities: handleQuery(col)
                })
            })
        })

    })
})

function startDeal(ref, deal, res){
    ref.update({
        status:         `inProgress`,
        startedAt:      new Date(),
        updatedAt:      new Date()
    }).then(()=>{

        let users = [];
            users.push(getUser(deal.buyer,udb))
            users.push(getUser(deal.seller,udb))

        Promise.all(users).then(users=>{
            sendMessage2({
                chat_id:        deal.buyer,
                text:           locals.dealConfirmed2Buyer(deal,users[1]),
                parse_mode:     `Markdown`,
                reply_markup: {
                    inline_keyboard: [[{
                        text: `Книга получена`,
                        callback_data: `deal_${deal.id}_buyerConfirmed`
                    }],[{
                        text: `Галя, у нас отмена`,
                        callback_data: `deal_${deal.id}_buyerCancelled`
                    }]]
                }
            },false,token,messages)
    
            sendMessage2({
                chat_id:        deal.seller,
                text:           locals.rentConfirmed2Seller(deal,users[0]),
                parse_mode:     `Markdown`,
                reply_markup: {
                    inline_keyboard: [[{
                        text: `Книга передана`,
                        callback_data: `deal_${deal.id}_sellerConfirmed`
                    }],[{
                        text: `Галя, у нас отмена`,
                        callback_data: `deal_${deal.id}_sellerCancelled`
                    }]]
                }
            },false,token,messages)

            if(res) ref.get().then(d=>{
                res.json({
                    success: true,
                    comment: `Спасибо! Я только что отправил вам сообщение с контактами чтеца.`,
                    deal: handleDoc(d)
                })
            })


        })
        log({
            text:   `${uname(users[1],users[1].id)} подтверждает запрос на книгу ${deal.bookName}`,
            book:   deal.book,
            deal:   deal.id,
            offer:  deal.offer,
            user:   deal.seller
        })
    })
}

function cancelDeal(reason,ref,deal, res){
    switch(reason){
        case 'buyerCancel':{
            ref.update({
                active:     false,
                status:     `cancelledByBuyer`,
                updatedAt:  new Date()
            }).then(()=>{
                
                offers.doc(deal.offer).update({
                    blocked: false
                })

                sendMessage2({
                    chat_id: deal.buyer,
                    text: locals.afterCancel
                },false,token,messages)

                sendMessage2({
                    chat_id: deal.seller,
                    text: locals.rentCancelled(deal)
                },false,token,messages)

                getUser(deal.buyer,udb).then(u=>{
                    log({
                        silent: true,
                        text:   `${uname(u,u.id)} отменяет свой запрос на книгу ${deal.bookName}`,
                        book:   deal.book,
                        offer:  deal.offer,
                        user:   deal.buyer,
                        deal:   deal.id
                    })
                })

                if(res) ref.get().then(d=>{
                    res.json({
                        success: false,
                        deal: handleDoc(d)
                    })
                })
                

                // TBD удаление запроса у продавца
                // TBD рейтинг покупател
            })
            break;
        }
        case 'sellerCancel':{
            ref.update({
                active: false,
                status: `cancelledBySeller`,
                updatedAt: new Date(),
            }).then(()=>{
                
                sendMessage2({
                    chat_id:    deal.buyer,
                    text:       locals.rentCancelledByOwner(deal)
                },false,token,messages)

                sendMessage2({
                    chat_id: deal.seller,
                    text: locals.rentCancelled(deal)
                },false,token,messages)

                getUser(deal.seller,udb).then(u=>{
                    log({
                        silent: true,
                        text:   `${uname(u,u.id)} отклоняет запрос на книгу ${deal.bookName}`,
                        book:   deal.book,
                        offer:  deal.offer,
                        user:   deal.seller
                    })

                    offers.doc(deal.offer).update({
                        active: false
                    }).then(()=>{
                        log({
                            silent: true,
                            text:   `Предложение уходит в архив (вместе с отклоненной заявкой).`,
                            offer:  deal.offer
                        })
                    })
                })
                if(res) ref.get().then(d=>{
                    res.json({
                        success: true,
                        deal: handleDoc(d)
                    })
                })
                

                // TBD рейтинг продавца

            })
            break;
        }
    }
}
function bookaBook(offerId, dealType, callback, user, req, res){
    let offerRef = offers.doc(offerId)

    return getDoc(offers,offerId).then(o=>{
        
        getDoc(books, o.book).then(b=>{
            if(!o || !o.active) {
                
                if(callback) return sendMessage2({
                    callback_query_id: callback.id,
                    show_alert: true,
                    text:       locals.noOffer
                }, 'answerCallbackQuery', token)

                return res.status(400).send(locals.noOffer)
            }
            
            switch(dealType){
                case `rent`:{
                    if(o.blocked) {
                        if(callback) return sendMessage2({
                            callback_query_id: callback.id,
                            show_alert: true,
                            text:       locals.offerBlocked
                        }, 'answerCallbackQuery', token)

                        return res.status(400).send(locals.offerBlocked)
                    }

                    if(o.createdBy == +user.id) {
                        if(callback) return sendMessage2({
                            callback_query_id: callback.id,
                            show_alert: true,
                            text:       locals.cantBuyYourSelf
                        }, 'answerCallbackQuery', token)

                        return res.status(400).send(locals.cantBuyYourSelf)

                    }

                    return deals
                        .where(`active`,'==',true)
                        .where(`offer`,'==',o.id)
                        .where(`buyer`,'==',+user.id)
                        .get()
                        .then(col=>{

                            if(col.docs.length) {
                                if(callback) return sendMessage2({
                                    callback_query_id: callback.id,
                                    show_alert: true,
                                    text:       locals.alreadyRented
                                }, 'answerCallbackQuery', token)

                                return res.status(400).send(locals.alreadyRented)
                            }

                            return rentBook(b,o,user,res)
                        })

                    
                }
                case `view`:{
                    offerRef.update({
                        views: FieldValue.increment(1)
                    })

                    return getDoc(books, o.book).then(b=>{
                        sendOffer(b,o,user)
                    })
                }
            }
        })
    })
}

function evaluateDeal(ref,deal,score,req,res){
    ref.update({
        buyerScore: +score,
        updatedAt: new Date()
    }).then(()=>{
        if(req) cba(req,`Спасибо!`)
        if(res) res.json({success:true})
        getUser(deal.seller).then(u=>{
            log({
                silent: true,
                deal:   deal.id,
                user:   deal.seller,
                text: `${uname(u,u.id)} выставляет ${score} человеку, который взял у него книгу ${deal.bookName}`
            })
        })
    })
}

function closeDeal(ref, deal, initiator, res){
    
    let upd = null;

    switch (initiator){
        case `seller`:{
            upd = ref.update({
                status:         `closed`,
                closedAt:       new Date(),
                sellerReturned: new Date()
            }).then(()=>{
                
                offers.doc(deal.offer).update({
                    blocked: false
                })

                sendMessage2({
                    chat_id: deal.buyer,
                    text: `Спасибо! Хозяин книги «${deal.bookName}» сообщает, что она счастливо вернулась домой. Найдем теперь что-то новое?..`
                },false,token,messages)

                sendMessage2({
                    chat_id: deal.seller,
                    text: `Спасибо!\nА теперь щепетильное: вы порекомендуете другим пользователям сервиса давать книги этому человеку?`,
                    reply_markup:{
                        inline_keyboard:[[{
                            text: `Да`,
                            callback_data: `deal_${deal.id}_evaluate_2`
                        },{
                            text: `хм...`,
                            callback_data: `deal_${deal.id}_evaluate_1`
                        },{
                            text: `Нет`,
                            callback_data: `deal_${deal.id}_evaluate_0`
                        }]]
                    }
                },false,token,messages)

            })
            break;
        }
        case `buyer`:{
            upd = ref.update({
                buyerReturned: new Date()
            }).then(()=>{
                sendMessage2({
                    chat_id: deal.seller,
                    text: `Человек, который брал у вас книгу «${deal.bookName}», говорит, что уже вернул ее. Подтвердите, пожалуйста.`,
                    reply_markup:{
                        inline_keyboard:[[{
                            text: `Все так`,
                            callback_data: `deal_${deal.id}_sellerClosed`
                        }]]
                    }
                },false,token,messages)
            })
            break;
        }
    }
    Promise.resolve(upd).then(()=>{
        if(res) ref.get().then(d=>res.json(handleDoc(d)))
    })
}

function transferBook(ref, deal, initiator, res){
    switch(initiator){
        
        case `seller`:{
            if(!deal.buyerConfirmed) sendMessage2({
                chat_id: deal.buyer,
                text: `${greeting()}! Хозяин книги «${deal.bookName}» сообщает, что передача состоялась. Все так?`,
                reply_markup:{
                    inline_keyboard:[[{
                        text:           `Да`,
                        callback_data:  `deal_${deal.id}_buyerConfirmed`
                    },{
                        text: `Нет`,
                        callback_data:  `deal_${deal.id}_buyerDenied`
                    }]]
                }
            },false,token,messages)

            return ref.update({
                sellerConfirmed: new Date()
            }).then(()=>{
                getUser(deal.seller,udb).then(u=>{
                    log({
                        silent: true,
                        text:   `${uname(u,u.id)} сообщает, что книга ${deal.bookName} была выдана`,
                        deal:   deal.id,
                        offer:  deal.offer,
                        book:   deal.book,
                        user:   +u.id
                    })
                })
            })
        }

        case `buyer`:{
            if(!deal.sellerConfirmed) sendMessage2({
                chat_id: deal.seller,
                text: `${greeting()}! Получатель книги «${deal.bookName}» сообщает, что передача состоялась. Все так?`,
                reply_markup:{
                    inline_keyboard:[[{
                        text:           `Да`,
                        callback_data:  `deal_${deal.id}_sellerConfirmed`
                    },{
                        text: `Нет`,
                        callback_data:  `deal_${deal.id}_sellerDenied`
                    }]]
                }
            },false,token,messages)

            return ref.update({
                buyerConfirmed: new Date()
            }).then(()=>{
                getUser(deal.buyer,udb).then(u=>{
                    log({
                        silent: true,
                        text:   `${uname(u,u.id)} сообщает, что книга ${deal.bookName} была получена`,
                        deal:   deal.id,
                        offer:  deal.offer,
                        book:   deal.book,
                        user:   +u.id
                    })
                })
            })
        }
    }

    let dealUpdated = null;

    if(initiator == `seller` ? deal.buyerConfirmed : deal.sellerConfirmed){
        dealUpdated = ref.update({
            status:     `given`,
            givenAt:    new Date()
        }).then(s=> true)
    }

    return Promise.resolve(dealUpdated).then(()=>{
        if(res) ref.get().then(d=>{
            res.json({
                success: true,
                deal: handleDoc(d)
            })
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
                    
                    case `/test`:{
                        return sendMessage2({
                            chat_id:    u.id,
                            text:       `Приложение с теста`,
                            reply_markup:{
                                inline_keyboard:[[{
                                    text: `${ngrok}`,
                                    web_app:{
                                        url: `${ngrok}/${host}/app` 
                                    }
                                }]]
                            }
                        },false,token,messages)
                    }

                    case `/settings`:{
                        return sendMessage2({
                            chat_id: +u.id,
                            text:   locals.settingsDescription,
                            reply_markup: {
                                inline_keyboard:[[{
                                    text: `Город`,
                                    callback_data: `userSettings_city`
                                }],[{
                                    text: `Подписки`,
                                    callback_data: `userSettings_subscriptions`
                                }],[{
                                    text: `Языки`,
                                    callback_data: `userSettings_languages`
                                }],]
                            }
                        }, false, token, messages)
                    }

                    case `/offers`:{
                        if(!u.city) return cities.get().then(col=>{
                            udb.doc(u.id.toString()).set(u).then(() => {
                                sendMessage2({
                                    chat_id: +u.id,
                                    text:   locals.noCityProvided,
                                    reply_markup: {
                                        inline_keyboard:handleQuery(col,false,true).filter(`active`,'==',true).map(c=>{
                                            return [{
                                                text: c.name,
                                                callback_data: `user_city_${c.id}`
                                            }]
                                        })
                                    }
                                }, false, token, messages)
                            })
                        })

                        return offers
                            .where(`city`, `==`, u.city)
                            .where(`active`,'==',true)
                            .get()
                            .then(col=>{
                                let books = handleQuery(col,true);
                                if(!books.length) return sendMessage2({
                                    chat_id: +u.id,
                                    text:   locals.noBooksAvailable,
                                    reply_markup: {
                                        inline_keyboard: books.map(c=>{
                                            return [{
                                                text:   c.bookName,
                                                callback_data: `offer_${c.id}_view`
                                            }]
                                        })
                                    }
                                }, false, token, messages)

                                sendMessage2({
                                    chat_id: +u.id,
                                    text:   locals.catalogue,
                                    reply_markup: {
                                        inline_keyboard: books.map(c=>{
                                            return [{
                                                text:   c.bookName,
                                                callback_data: `offer_${c.id}_view`
                                            }]
                                        })
                                    }
                                }, false, token, messages)
                            })
                    }

                    case `/cities`:{
                        return cities.get().then(col=>{
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
                            })
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
                            return alertAdmins({
                                text: `${uname(u,u.id)} пишет: ${req.body.message.text}`,
                                user: user.id
                            })
                        }
                        
                }
            }

            if (req.body.message.photo) {
                // m.sendMessage2({
                //     chat_id: user.id,
                //     text: locals.fileNeeded
                // }, false, token)
            }

            if (req.body.message.document) {

                // if(req.body.message.media_group_id){
                //     if(!mediaGroups[req.body.message.media_group_id]) mediaGroups[req.body.message.media_group_id] = [];
                //     setTimeout(()=>{
                //         handleDoc(req,user)
                //     },mediaGroups[req.body.message.media_group_id].length*1000)
                //     mediaGroups[req.body.message.media_group_id].push(req.body.message.document.file_id)
                // } else {
                //     handleDoc(req,user)
                // }
            }

        })
    }

    if (req.body.callback_query) {
        
        user = req.body.callback_query.from;

        let userRef = udb.doc(user.id.toString())
        
        let inc = req.body.callback_query.data.split('_')

        // if(req.body.callback_query.chat_instance) sendMessage2({
        //     chat_id: req.body.callback_query.chat_instance,
        //     text: `some letters`
        // },false,token)

        getUser(user.id,udb).then(u=>{

            if(!u) sendMessage2({
                callback_query_id: req.body.callback_query.id,
                show_alert: true,
                text:       `Извините, мы вас пока не знаем...`
            }, 'answerCallbackQuery', token)

            // TBD: проверка блокировки

            let userLogName = uname(u||user, u ? u.id : user.id)

            switch(inc[0]){
                case `userSettings`:{
                    switch(inc[1]){
                        case `city`:{
                            sendMessage2({
                                chat_id: user.id,
                                text: `Хорошо там, где мы есть:`,
                                reply_markup:{
                                    inline_keyboard: Object.keys(savedCities).map(c=>{
                                        return [{
                                            text: `${u.city == c ?  `✔️` : `❌`} ${savedCities[c].name} (${savedCities[c].currency})`,
                                            callback_data: `user_city_${c}`
                                        }]
                                    })
                                }
                            },false,token,messages)

                            if(!u.intro) sendMessage2({
                                chat_id: u.id,
                                text: `Что дальше? Все просто: откройте приложение (кнопка в нижнем левом углу экрана) — и посмотрите, какие книги уже есть у ваших соседей. Смело добавляйте свои собственные. Читайте в свое удовольствие.`
                            },false,token).then(()=>{
                                udb.doc(u.id.toString()).update({
                                    intro: new Date()
                                })
                            })
                            break;
                        }
                        case `subscriptions`:{
                            return sendMessage2({
                                chat_id: user.id,
                                text: `Пока что у нас есть только один вид подписки: на все новые книги в нужном вам городе на знакомых вам языках.`,
                                reply_markup:{
                                    inline_keyboard:[
                                        [{
                                            text: `Включить`,
                                            callback_data: `user_noSpam_false`
                                        }],
                                        [{
                                            text: `Выключить`,
                                            callback_data: `user_noSpam_true`
                                        }],
                                    ]
                                }
                            },false,token,messages)
                        }
                        case `languages`:{
                            return sendMessage2({
                                chat_id: user.id,
                                text:   `Больше не меньше...`,
                                reply_markup:{
                                    inline_keyboard:langs.map(l=>{
                                        return [{
                                            text: `${u[l.id] ?  `✔️` : `❌`} ${l.name}`,
                                            callback_data: `user_${l.id}_${u[l.id]?false:true}`
                                        }]
                                    })
                                }
                            },false,token,messages)
                        }
                    }
                }
                case `offer`:{
                    return bookaBook(inc[1], inc[2], req.body.callback_query, u||user)
                }
                case `user`:{
                    return userRef.update({
                        [inc[1]]: interpreteCallBackData(inc[2])
                    }).then(upd=>{
                        log({
                            user:   +user.id,
                            silent: true,
                            text:   `${userLogName} обновляет профиль: ${inc[1]} становится ${inc[2]}`
                        })
                        sendMessage2({
                            callback_query_id: req.body.callback_query.id,
                            show_alert: true,
                            text:       locals.updateSuccess
                        }, 'answerCallbackQuery', token)

                        if(langs.map(l=>l.id).indexOf(inc[1])>-1){
                            getUser(user.id, udb).then(u=>{
                                sendMessage2({
                                    chat_id:    +user.id,
                                    message_id: req.body.callback_query.message.message_id,
                                    reply_markup:{
                                        inline_keyboard: langs.map(l=>{
                                            return [{
                                                text: `${u[l.id] ? `✔️` : `❌`} ${l.name}`,
                                                callback_data: `user_${l.id}_${u[l.id]?false:true}`
                                            }]
                                        })
                                    }
                                },`editMessageReplyMarkup`,token,messages)
                            })
                            
                        }

                        if(inc[1] == `city`) sendMessage2({
                            chat_id:    +user.id,
                            text:       `Что дальше? Пока сайт находися в разработке, вы можете воспользоваться поиском непосредственно в боте (для этого отправьте мне /offers — или введите @shelfCareBot и название книги через пробел).\nВы также можете добавить свои книги: выставить их на продажу, в подарок или в режиме "Дам почитать". Для этого вам понадобится перейти в [админку](https://dimazvali-a43369e5165f.herokuapp.com/books/auth).\nПолный список доступных команд доступен в меню.`,
                            parse_mode: `Markdown`,
                        },false,token,messages)
                    }).catch(err=>{
                        console.log(err)
                    })
                }
                case `book`:{
                    let ref = books.doc(inc[1]);
                    devlog(`its a book`)
                    // devlog()
                    switch(inc[2]){
                        
                        case `view`:{
                            return ref.get().then(d=>{
                                let book = handleDoc(d)

                                if(!book) return sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text:       locals.noOffer
                                }, 'answerCallbackQuery', token)
                                
                                return sendBook(book,u)
                            })
                        }
                    }
                }
                case `deal`:{

                    let ref = deals.doc(inc[1]);
                    
                    return ref.get().then(d=>{
                        
                        d = handleDoc(d);
                        
                        if(!d) return sendMessage2({
                            callback_query_id: req.body.callback_query.id,
                            show_alert: true,
                            text:       locals.noDeal
                        }, 'answerCallbackQuery', token)

                        if(!d.active) return sendMessage2({
                            callback_query_id: req.body.callback_query.id,
                            show_alert: true,
                            text:       locals.dealNotActive
                        }, 'answerCallbackQuery', token)

                        switch(inc[2]){
                            case `evaluate`:{
                                if(d.buyerScore) {
                                    return cba(req,`Извините, вы уже поставили оценку.`)
                                }
                                return evaluateDeal(ref,d, interpreteCallBackData(inc[3]), req)
                            }
                            case `sellerClosed`:{
                                return closeDeal(ref, d, `seller`)
                            }

                            case `buyerConfirmed`:{
                                if(d.buyerConfirmed) return cba(req,locals.tooLate)
                                
                                ref.update({
                                    buyerConfirmed: new Date(),
                                })

                                if(d.sellerConfirmed){
                                    ref.update({
                                        status:         `given`,
                                        givenAt:        new Date()     
                                    })

                                    if(d.type !== `rent`){
                                        ref.update({
                                            completed: true
                                        })
                                        
                                        udb.doc(d.seller.toString()).update({
                                            sold: FieldValue.increment(1)
                                        })

                                        udb.doc(d.buyer.toString()).update({
                                            bought: FieldValue.increment(1)
                                        })
                                    }

                                    cba(req,`Спасибо! Вы молодцы! )`);

                                } else {
                                    cba(req,`Спасибо! Осталось дождаться подтверждения у второй стороны.`)

                                    sendMessage2({
                                        chat_id: d.seller,
                                        text: `${greeting()}! Получатель книги «${d.bookName}» сообщает, что передача состоялась. Все так?`,
                                        reply_markup:{
                                            inline_keyboard:[[{
                                                text:           `Да`,
                                                callback_data:  `deal_${d.id}_sellerConfirmed`
                                            },{
                                                text: `Нет`,
                                                callback_data:  `deal_${d.id}_sellerDenied`
                                            }]]
                                        }
                                    },false,token,messages)
                                }
                                break;
                            }
                            case `sellerConfirmed`:{
                                
                                if(d.sellerConfirmed) return cba(req,locals.tooLate)
                                
                                ref.update({
                                    sellerConfirmed: new Date(),
                                })

                                if(d.buyerConfirmed) {

                                    ref.update({
                                        status:         `given`,
                                        givenAt:        new Date()     
                                    })

                                    if(d.type !== `rent`){
                                        ref.update({
                                            completed: true
                                        })
                                        
                                        udb.doc(d.seller.toString()).update({
                                            sold: FieldValue.increment(1)
                                        })

                                        udb.doc(d.buyer.toString()).update({
                                            bought: FieldValue.increment(1)
                                        })
                                    }

                                    cba(req,`Спасибо! Вы молодцы! )`)

                                } else {
                                    
                                    cba(req,`Спасибо! Осталось дождаться подтверждения у второй стороны.`)

                                    sendMessage2({
                                        chat_id: d.buyer,
                                        text: `${greeting()}! Хозяин книги «${d.bookName}» сообщает, что передача состоялась. Все так?`,
                                        reply_markup:{
                                            inline_keyboard:[[{
                                                text:           `Да`,
                                                callback_data:  `deal_${d.id}_buyerConfirmed`
                                            },{
                                                text: `Нет`,
                                                callback_data:  `deal_${d.id}_buyerDenied`
                                            }]]
                                        }
                                    },false,token,messages)
                                }
                                break;
                            }
                            case `buyerCancel`:{

                                if(d.status == `inReview` ) return cancelDeal(inc[2],ref,d)
                                
                                return sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text:       locals.tooLate
                                }, 'answerCallbackQuery', token)
                            }
                            case `sellerCancel`:{

                                if(d.status == `inReview`) return cancelDeal(inc[2],ref,d)
                                
                                return sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text:       locals.tooLate
                                }, 'answerCallbackQuery', token)
                            }

                            case `sellerAccept`:{
                                return startDeal(ref,d)
                            }
                        }

                    })
                }
                default:{
                    sendMessage2({
                        callback_query_id: req.body.callback_query.id,
                        show_alert: true,
                        text:       locals.commandUnknown
                    }, 'answerCallbackQuery', token)
                }
            }
        })

        
    }

    if (req.body.inline_query){
        let q = req.body.inline_query;
        if(q.query){
            getUser(q.from.id,udb).then(u=>{
                offers.where(`active`,'==',true).get().then(col=>{
                    let line = handleQuery(col,false,true);
                    if(u && u.city) line = line.filter(b=>b.city == u.city);
                    line = line.filter(b=>b.bookName.toLowerCase().indexOf(q.query.toLowerCase())>-1)
                    sendMessage2({
                        inline_query_id: q.id,
                        results: line.map(b=>{
                            return {
                                type: `article`,
                                id: b.id,
                                title: b.bookName,
                                description: b.description || 'некое описание',
                                thumbnail_url: b.bookPic ? (typeof b.bookPic == `object` ? b.bookPic[0] : b.bookPic) :dummyBook,
                                input_message_content:{
                                    message_text: b.bookName
                                },
                                reply_markup:{
                                    inline_keyboard: [[{
                                        text: `Подробнее`,
                                        callback_data: `offer_${b.id}_view`    
                                    }]]
                                }
                                // start_parameter: `offer_${b.id}_view`
                            }
                        })
                    },`answerInlineQuery`,token)
                })
            })
        }
    }
})

function composeBookDescription(book, offerLine, citySpecific, active){
    let txt = `*${book.name}*
${book.author||''}
${book.publisher?`${book.publisher}, `:''}${book.year||''}

${cutMe(book.description,500)}`;

    if(active.length) {
        txt+=`\n\nВ вашем городе ${letterize(active.length, `книжечка`)} можно взять почитать:`
    } else if (citySpecific.length) {
        txt+=`\n\nВ вашем городе есть ${letterize(active.length, `книга`)}. Правда, придется постоять в очереди...`
    } else if(offerLine.length) {
        txt+=`\n\nБоюсь, сейчас ни одной копии в вашем городе нет. Хотите, я пришлю вам уведомление, как только такая появится?..`
    } else {
        txt+=`\n\nБоюсь, сейчас ни одной копии в открытом доступе нет. Хотите, я пришлю вам уведомление, как только такая появится?..`
    }

    return txt;
}

function rentBook(book, offer, user, res){
    deals.add({
        createdAt:  new Date(),
        status:     `inReview`,
        active:     true,
        createdBy:  +user.id,
        book:       book.id,
        bookName:   book.name,
        offer:      offer.id,
        seller:     offer.createdBy,
        buyer:      +user.id,
        type:       `rent`,
        city:       offer.city
    }).then(rec=>{

        offers.doc(offer.id).update({
            blocked: rec.id
        })

        sendMessage2({
            chat_id:    user.id,
            text:       locals.rentRequestSent(offer),
            reply_markup: {
                inline_keyboard:[[{
                    text: `Отказаться`,
                    callback_data: `deal_${rec.id}_buyerCancel`
                }]]
            }
        },false,token,messages)
        
        sendMessage2({
            chat_id:    offer.createdBy,
            text:       locals.rentRequest(offer, user),
            reply_markup: {
                inline_keyboard:[[{
                    text: `Согласиться`,
                    callback_data: `deal_${rec.id}_sellerAccept`
                }],[{
                    text: `Отказаться`,
                    callback_data: `deal_${rec.id}_sellerCancel`
                }]]
            }
        },false,token,messages)

        if(res) {
            getDoc(deals,rec.id).then(d=>{
                res.json({
                    success:    true,
                    deal:       d,
                    comment:    `Я передал вашу заявку. Подробнее — в сообщениях.`
                })
            })
            
        }
    })


}

function sendOffer(b,o,u,subscription){
    
    let kbd = [[{
        text:           `Подробнее о книге`,
        callback_data:  `book_${o.book}_view`
    }]]

    if(o.price) kbd.push([{
        text:           `Купить (${cur(o.price,savedCities[u.city].currency)})`,
        callback_data:  `offer_${o.id}_buy`
    }])

    if(o.rent) kbd.push([{
        text:           `Взять почитать`,
        callback_data:  `offer_${o.id}_rent`
    }])

    if(subscription) kbd.push([{
        text:           `Отписаться от новостей`,
        callback_data:  `user_noSpam_true`
    }])


    sendMessage2({
        chat_id:        u.id,
        parse_mode:     `Markdown`,
        caption:        (subscription ? `Новинка!\n\n` : ``)+offerDescription(o,b)+(subscription?locals.subscriptionDisclaimer:''),
        photo:          (o.pic ? (typeof o.pic == `object` ? o.pic[0] : o.pic) : false) || (b.pic ? (typeof b.pic == `object` ? b.pic[0] : b.pic) : false) || dummyBook,
        reply_markup: {
            inline_keyboard: kbd
        }
    },`sendPhoto`,token,messages)

}

function offerDescription(offer,book){
    let txt = `*${book.name}*
${book.author||''} ${book.publisher||''} ${book.year||''}
${offer.description ? `От владельца: _${cutMe(offer.description,600)}_` : ``}
${offer.price ? `Стоимость: ${cur(offer.price)}` : (offer.rent ? `Книгу можно взять почитать.` : `Книгу можно получить в подарок.`)}
Где: ${savedCities[offer.city].name}, ${offer.address}.`
    return txt
}

const locals = {
    settingsDescription:    `Что именно вам хотелось бы изменить?..`,
    subscriptionDisclaimer: `\nВы получили это сообщение, так как подписаны на все новинки в своем городе. Чтобы отписаться, нажмите последнюю кнопку под сообщением.`,
    noBooksAvailable: `${sudden.sad()}! Кажется, в вашем городе нет доступных книг. Может быть, вы сможете добавить парочку?..`,
    dealConfirmed2Buyer:(d,s)=>     `${sudden.fine()}! Книга «${d.bookName}» без малого ваша. А вот ее хозяин: [@${s.username||s.first_name||s.last_name}](tg://user?id=${s.id})`,
    rentConfirmed2Seller:(d,s)=>    `${sudden.fine()}! А вот и человек, который хотел бы получить книгу «${d.bookName}»: [@${s.username||s.first_name||s.last_name}](tg://user?id=${s.id})`,
    rentCancelledByOwner: (d) =>    `${sudden.sad()}! Хозяин книги «${d.bookName}» не сможет ей поделиться. Такое бывает. Давайте найдем что-нибудь еще?..`,
    rentCancelled:(d)=>             `${sudden.sad()}! Запрос на книгу «${d.bookName}» был отменен.`,
    afterCancel:    `Ваш запрос отменен`,
    tooLate:        `Извинте, уже не получится`,
    dealNotActive:  `Этот запрос уже закрыт. Вы не можете его обновить.`,
    noDeal:         `Очень странные дела... Нет такой записи...`,
    alreadyRented:  `Вы уже взяли эту книгу. Оставьте ее в покое.`,
    cantBuyYourSelf: `Простите, но это ваша собственная книга.`,
    rentRequest: (o)=>              `${sudden.fine()}! Кто-то хочет взять почитать ваше издание «${o.bookName}».\nНажмите «Согласиться» — и мы свяжем вас напрямую.\nЕсли вы не можете им поделиться — не беда. Нажмите «Вежливый отказ». Мы все передадим (и снимем издание с полки).`,
    rentRequestSent:(o)=>           `Отличный выбор! Ваш запрос на книгу «${o.bookName}» отправлен владельцу. После подтверждения мы свяжем вас напрямую.`,
    offerBlocked:   `${sudden.sad()}! Эту книгу сейчас читают...`,
    greetings:      `${greeting()}! Рады знакомству.\ Чтобы продолжить, выберите город из предложенных ниже. Если вашего города в списке нет — напишите об этом обычным текстовым сообщением.`,
    updateSuccess:  `Настройки обновлены.`,
    noCityProvided: `Извините, но вы все еще не указали свой город. Давайте исправим это:`,
    catalogue:      `Присмотримся...`,
    commandUnknown: `Извините, я еще не выучил такой команды`,
    noOffer:        `${sudden.sad()}! Это предложение уже недоступно...`
}

function cba(req,txt){
    sendMessage2({
        callback_query_id: req.body.callback_query.id,
        show_alert: true,
        text:       txt
    }, 'answerCallbackQuery', token)
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

function sendBook(book,user){

    let method = book.pic ? `sendPhoto` : false;
    
    offers
        .where(`book`,'==',book.id)
        .where(`active`,'==',true)
        .get()
        .then(col=>{

            console.log(user.city);
            
            let offerLine =     handleQuery(col,true);
            let citySpecific =  offerLine.filter(o=>o.city == user.city);
            let active =        citySpecific.filter(o=>!o.blocked);

            let kbd = [];

            if(active.length){
                kbd = active.slice(0,9).map(o=>{
                    return [{
                        text: `${o.price ? cur(p.price, savedCities[user.city].currency) : (o.rent ? `взять почитать на ${o.address}` : `взять в подарок на ${o.address}`)}`,
                        callback_data: `offer_${o.id}_view`
                    }]
                })
            } else if(citySpecific.length) {
                kbd = citySpecific.slice(0,9).map(o=>{
                    return [{
                        text: `${o.price ? cur(p.price, savedCities[user.city].currency) : (o.rent ? `взять почитать на ${o.address}` : `взять в подарок на ${o.address}`)}`,
                        callback_data: `offer_${o.id}_view`
                    }]
                })
            } else if(offerLine.length) {
                kbd = offerLine.slice(0,9).map(o=>{
                    return [{
                        text: `${savedCities[o.city].name}`,
                        callback_data: `offer_${o.id}_view`
                    }]
                })
            }

            let m = {
                chat_id: user.id,
                parse_mode: `Markdown`,
                photo: book.pic || dummyBook,
                caption: composeBookDescription(book, offerLine, citySpecific, active)
            }

            if(kbd.length) m.reply_markup = {inline_keyboard:kbd}
            sendMessage2(m,`sendPhoto`,token,messages)
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

module.exports = router;


// offers.get().then(col=>{
//     handleQuery(col).forEach(b=>{
//         offers.doc(b.id).update({
//             address: `Верико Анджапаридзе, 1`
//         })
//     })
// })

// offers.get().then(col=>{

//     // handleQuery(col).filter(b=>b.bookPic).forEach(b=>{
//     //     if(typeof b.bookPic == `object`) offers.doc(b.id).update({bookPic:b.bookPic[0]})
//     // })

//     handleQuery(col).forEach(o=>{
//         // offers.doc(o.id).update({
//         //     rent: true
//         // })
//         // books.doc(o.book).update({
//         //     offers:{[o.city]:FieldValue.increment(1)}
//         // })
//     })
// })

// udb.get().then(col=>{
//     col.docs.forEach(u=>{
//         udb.doc(u.id).update({
//             ru: true,
//             en: true
//         })
//     })
// })


// udb.get().then(col=>{
//     handleQuery(col,true).reverse().forEach((u,i)=>{
//         udb.doc(u.id).update({
//             num: i+1
//         })
//     })
// })


// deals
//     .where(`active`,'==',true)
//     .get()
//     .then(col=>{
//         handleQuery(col)
//             .forEach(deal=>{
//                 deals.doc(deal.id).update({
//                     active: false
//                 })
//                 offers.doc(deal.offer).update({
//                     blocked: false
//                 })
//             })
//     })