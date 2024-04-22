let ngrok2 = process.env.ngrok2 
let ngrok = process.env.ngrok 

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

const dummyBook = `${ngrok2}/images/${host}/blank.png`


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
    axios.get(`https://api.telegram.org/bot${token}/setWebHook?url=${ngrok2}/${host}/hook`).then(()=>{
        console.log(`${host} hook set on ${ngrok2}`)
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

let savedCities = {};

cities.where(`active`,'==',true).get().then(col=>savedCities = objectify(handleQuery(col)))

function addBook(req,res,admin){
    
    let b = {
        createdAt:  new Date(),
        active:     true,
        createdBy:  +admin.id,
        name:       req.body.name   || null,
        description:req.body.description || null,
        pic:        req.body.pic    || null,
        isbn:       req.body.isbn   || null,
        lang:       req.body.lang   || `ru`,
        author:     req.body.author || null,
        year:       +req.body.year  || null,
        // state:      +req.body.state || null,
        kids:       req.body.kids   || false,
    }

    return books.add(b).then(rec=>{
        
        if(req.files && req.files.cover){
            let sampleFile = req.files.cover;
                let uploadPath = __dirname + '/../public/images/books/' + sampleFile.name
                
                sampleFile.mv(uploadPath, function(err) {
                
                    if (err) return res.status(500).send(err);
                    

                    s.bucket(`dimazvalimisc`)
                        .upload(uploadPath)
                        .then(()=>{
                            s.bucket(`dimazvalimisc`).file(sampleFile.name).getSignedUrl({
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

        return res.redirect(`/${host}/web?page=books_${rec.id}`)
        // res.json({
        //     success: true,
        //     id: rec.id
        // })

    })
}

function addOffer(req,res,admin){
    
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
                rent:           +req.body.rent || false,
                price:          +req.body.price || null,
                owner:          +req.body.owner || +admin.id || null,
                state:          +req.body.state || null,
                city:           req.body.city || null,
                address:        req.body.address,
            }
        
            return offers.add(o).then(rec=>{
                
                log({
                    text: `${uname(admin,admin.id)} добавляет в продажу книгу ${b.name}.`,
                    offer: rec.id,
                    // admin: +admin.id
                })

                if(req.files && req.files.cover){
                    let sampleFile = req.files.cover;
                        let uploadPath = __dirname + '/../public/images/books/' + sampleFile.name
                        
                        sampleFile.mv(uploadPath, function(err) {
                        
                            if (err) return res.status(500).send(err);
                            
        
                            s.bucket(`dimazvalimisc`)
                                .upload(uploadPath)
                                .then(()=>{
                                    s.bucket(`dimazvalimisc`).file(sampleFile.name).getSignedUrl({
                                        action: `read`,
                                        expires: '03-09-2491'
                                    }).then(link=>{
                                        offers.doc(rec.id).update({
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

                return res.redirect(`/${host}/web?page=offers_${rec.id}`)
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

    // udb.where(`admin`, '==', true).get().then(admins => {
    //     admins.docs.forEach(a => {
    //         message.chat_id = a.id
    //         if (mess.type != 'stopLog' || !a.data().stopLog) sendMessage2(message, false, token, messages)
    //     })
    // })
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
                    return res.json([{
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
                    }])
                }

                case `bookState`:{
                    return res.json([{
                        id: `new`,
                        name: `Новая`,
                        active:true
                    },{
                        id: `user`,
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

            if(!u || u.blocked) return res.sendStatus(403)
                
                adminTokens.add({
                    createdAt:  new Date(),
                    user:       +req.body.id,
                    active:     true 
                }).then(c=>{
                    res.cookie('adminToken', c.id, {
                        maxAge: 24 * 60 * 60 * 1000,
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
                        filters.push(`в городе ${savedCities[req.query[k]].name}`)
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

        let uploadPath = __dirname + '/../public/images/books/' + sampleFile.name
        
        sampleFile.mv(uploadPath, function(err) {
        
        if (err) return res.status(500).send(err);
        
        s.bucket(`dimazvalimisc`)
            .upload(uploadPath)
            .then(()=>{
                s.bucket(`dimazvalimisc`).file(sampleFile.name).getSignedUrl({
                    action: `read`,
                    expires: '03-09-2500'
                }).then(link=>{
                    datatypes[req.query.collection].col.doc(req.query.id).update({
                        pic: link,
                        updatedAt: new Date()
                    })
                    res.redirect(`${ngrok2}/${host}/web?page=${req.query.collection}_${req.query.id}`)
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


router.get(`/web`,(req,res)=>{
    
    if(!(process.env.develop == `true`) && !req.signedCookies.adminToken) return res.redirect(`${process.env.ngrok}/${host}/auth`)
    
    getDoc(adminTokens, req.signedCookies.adminToken).then(t=>{

        if(!req.signedCookies.adminToken && (process.env.develop == `true`)) return res.cookie('adminToken', req.query.admintoken || process.env.adminToken, {
            maxAge: 24 * 60 * 60 * 1000,
            signed: true,
            httpOnly: true,
        })

        if(!t || !t.active) return res.sendStatus(403)

        getUser(t.user,udb).then(u=>{
            
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

function startDeal(ref, deal){
    ref.update({
        active:     false,
        status:     `inProgress`,
        started:    new Date()
    }).then(()=>{
        let users = [];
            users.push(getUser(deal.buyer,udb))
            users.push(getUser(deal.seller,udb))

        Promise.all(users).then(users=>{
            sendMessage2({
                chat_id:    deal.buyer,
                text:       locals.dealConfirmed2Buyer(deal,users[1]),
                parse_mode: `Markdown`,
            },false,token,messages)
    
            sendMessage2({
                chat_id:    deal.seller,
                text:       locals.rentCancelled2Seller(deal,users[0]),
                parse_mode: `Markdown`,l
            },false,token,messages)
        })
        log({
            text:   `${uname(users[1],users[1].id)} подтверждает запрос на книгу ${deal.bookName}`,
            book:   deal.book,
            offer:  deal.offer,
            user:   deal.seller
        })
    })
}

function cancelDeal(reason,ref,deal){
    switch(reason){
        case 'buyerCancel':{
            ref.update({
                active: false,
                status: `cancelledByBuyer`
            }).then(()=>{
                
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
                        user:   deal.buyer
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
                status: `cancelledBySeller`
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
                

                // TBD рейтинг продавца

            })
            break;
        }
    }
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

            let userLogName = uname(u||user,u ? u.id : user.id)

            switch(inc[0]){
                case `offer`:{
                    let offerRef = offers.doc(inc[1])

                    return getDoc(offers,inc[1]).then(o=>{
                        
                        getDoc(books, o.book).then(b=>{
                            if(!o || !o.active) return sendMessage2({
                                callback_query_id: req.body.callback_query.id,
                                show_alert: true,
                                text:       locals.noOffer
                            }, 'answerCallbackQuery', token)
                            
                            switch(inc[2]){
                                case `rent`:{
                                    if(o.blocked) return sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        show_alert: true,
                                        text:       locals.offerBlocked
                                    }, 'answerCallbackQuery', token)

                                    if(o.createdBy == +u.id) return sendMessage2({
                                        callback_query_id: req.body.callback_query.id,
                                        show_alert: true,
                                        text:       locals.cantBuyYourSelf
                                    }, 'answerCallbackQuery', token)

                                    return deals
                                        .where(`active`,'==',true)
                                        .where(`offer`,'==',o.id)
                                        .where(`buyer`,'==',+u.id)
                                        .get()
                                        .then(col=>{

                                            if(col.docs.length) return sendMessage2({
                                                callback_query_id: req.body.callback_query.id,
                                                show_alert: true,
                                                text:       locals.alreadyRented
                                            }, 'answerCallbackQuery', token)

                                            return rentBook(b,o,u)
                                        })
    
                                    
                                }
                                case `view`:{
                                    offerRef.update({
                                        views: FieldValue.increment(1)
                                    })
            
                                    return getDoc(books, o.book).then(b=>{
                                        sendOffer(b,o,u||user)
                                    })
                                }
                            }
                        })
                    })
                }
                case `user`:{
                    return userRef.update({
                        [inc[1]]: inc[2]
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
                        if(inc[1] == `city`) sendMessage2({
                            chat_id: +user.id,
                            text: `Что дальше? Пока сайт находися в разработке, вы можете воспользоваться поиском непосредственно в боте (для этого отправьте мне /offers).\nВы также можете добавить свои книги: выставить их на продажу, в подарок или в режиме "Дам почитать". Для этого вам понадобится перейти в [админку](https://dimazvali-a43369e5165f.herokuapp.com/books/auth).\nПолный список доступных команд доступен в меню.`,
                            reply_markup: `Markdown`,
                        },false,token,messages)
                    }).catch(err=>{
                        console.log(err)
                    })
                }
                case `book`:{
                    let ref = books.doc(inc[1]);
                    switch(req[2]){
                        case `view`:{
                            return ref.get().then(d=>{
                                let book = handleDoc(d)
                                if(!book) return sendMessage2({
                                    callback_query_id: req.body.callback_query.id,
                                    show_alert: true,
                                    text:       locals.noOffer
                                }, 'answerCallbackQuery', token)
                                return sendBook(book,user)
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
                            case `buyerCancel`:{
                                if(d.status == `inReview`) return cancelDeal(inc[2],ref,d)
                                
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

function rentBook(book, offer, user){
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
    })


}

function sendOffer(b,o,u){
    let kbd = [[{
        text:           `Подробнее о книге`,
        callback_data:  `book_${o.book}_view`
    }]]

    if(o.price) kbd.push([{
        text:           `Купить (${cur(o.price,u.currency)})`,
        callback_data:  `offer_${o.id}_buy`
    }])

    if(o.rent) kbd.push([{
        text:           `Взять почитать`,
        callback_data:  `offer_${o.id}_rent`
    }])


    sendMessage2({
        chat_id:        u.id,
        parse_mode:     `Markdown`,
        caption:        offerDescription(o,b),
        photo:          (o.pic ? (typeof o.pic == `object` ? o.pic[0] : o.pic) : false) || (b.pic ? (typeof b.pic == `object` ? b.pic[0] : b.pic) : false) || dummyBook,
        reply_markup: {
            inline_keyboard: kbd
        }
    },`sendPhoto`,token,messages)
}

function offerDescription(offer,book){
    let txt = `*${book.name}*
${book.author||''} ${book.publisher||''} ${book.year||''}
${offer.description ? `От владельца: _${offer.description}_` : ``}
${offer.price ? `Стоимость: ${cur(offer.price)}` : offer.rent ? `` : `Книга в подарок.`}
Где можно забрать: ${offer.address}`
    return txt
}

const locals = {
    noBooksAvailable: `${sudden.sad()}! Кажется, в вашем городе нет доступных книг. Может быть, вы сможете добавить парочку?..`,
    dealConfirmed2Buyer:(d,s)=>     `${sudden.fine()}! Книга «${d.bookName}» без малого ваша. А вот ее хозяин: [@${s.username||s.first_name||s.last_name}](tg://user?id=${s.id})`,
    rentCancelled2Seller:(d,s)=>    `${sudden.fine()}! А вот и человек, который хотел бы получить книгу «${d.bookName}»: [@${s.username||s.first_name||s.last_name}](tg://user?id=${s.id})`,
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
    greetings:      `${greeting()}! Рады знакомству.\n Чтобы продолжить, выберите город из предложенных ниже. Если вашего города в списке нет — напишите об этом обычным текстовым сообщением.`,
    updateSuccess:  `Настройки обновлены.`,
    noCityProvided: `Извините, но вы все еще не указали свой город. Давайте исправим это:`,
    catalogue:      `Присмотримся...`,
    commandUnknown: `Извините, я еще не выучил такой команды`,
    noOffer:        `${sudden.sad()}! Это предложение уже недоступно...`
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


function registerUser(u) {

    u.createdAt =   new Date();
    u.active =      true;
    u.blocked =     false;
    u.city =        null;
    u.score =       0;
    
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
}

module.exports = router;


// offers.get().then(col=>{
//     handleQuery(col).forEach(b=>{
//         offers.doc(b.id).update({
//             address: `Верико Анджапаридзе, 1`
//         })
//     })
// })

offers.get().then(col=>{
    // handleQuery(col).filter(b=>b.bookPic).forEach(b=>{
    //     if(typeof b.bookPic == `object`) offers.doc(b.id).update({bookPic:b.bookPic[0]})
    // })

    handleQuery(col).forEach(o=>{
        offers.doc(o.id).update({
            rent: true
        })
    })
})