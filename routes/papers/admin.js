//@ts-check
var express =   require('express');
var router =    express.Router();
var axios =     require('axios').default;


const { FieldValue } = require('firebase-admin/firestore');
const { Parser } = require('json2csv');
const { devlog, getDoc, uname, isoDate, handleError, letterize, handleDoc, handleQuery, drawDate, cur } = require('../common');
const { coworkingPrice, token, log, userList, updateEntity, deleteEntity, interprete } = require('../papersBot');
const { adminTokens, udb, userClassesQ, randomCoffeeIterations, messages, books, mra, userClasses, classes, deposits, standAlone, invoices, randomCoffees, coworking, halls, authors, news, plans, plansUsers, plansRequests, userClassesWL, subscriptions, logs, wineList, settings, roomsBlocked, courses, fb } = require('./cols');
const { addBook, classMethods, rcMethods, newsMethods, alertWithdrawal, wine, randomCoffee, plan, sendClass, classDescription } = require('./logics');
const translations = require('./translations');
const { getUser, sendMessage2 } = require('../methods');
const coworkingMethods = require('./logics.js').coworking;

router.all(`/:method`, (req, res) => {
    if (!req.query.id && !req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    
    if(!req.query.id) req.query.id = adminTokens.doc(req.signedCookies.adminToken).get().then(doc=>{
        if(!doc.exists) return false
        doc = handleDoc(doc)
        if(!doc.active) return false
        return doc.user
    })

    Promise.resolve(req.query.id).then(adminId=>{
        if(!adminId) return res.sendStatus(403)
        
        req.query.id = adminId.toString()
        
        devlog(req.query.id)

        udb.doc(req.query.id).get().then(async user => {
            if (!user.exists) return res.status(401).send(`Вы кто вообще?`)
            let admin = handleDoc(user)

            user = user.data();
            
            if (!(user.admin || user.insider)) return res.status(403).send(`Вам сюда нельзя`)
            switch (req.params.method) {

                case `langs`:{
                    return res.json([{
                        id: `en`,
                        name: `Английский`,
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

                case `userClassesQ`:{
                    let q = userClassesQ;
                    if(req.query.class){
                        q = q.where(`class`,'==',req.query.class)
                    }
                    return q.get().then(col=>res.json(handleQuery(col,true)))
                }
                case `rcIterations`:{
                    return randomCoffeeIterations.get().then(col=>res.json(handleQuery(col,true)))
                }
                case `messages`:{
                    return messages
                        .orderBy(`createdAt`,`desc`)
                        .offset(req.query.offset?+req.query.offset:0)
                        .limit(req.query.limit?+req.query.limit:200)
                        .get()
                        .then(col=>{
                            res.json(handleQuery(col))
                        })
                }

                case `books`:{
                    switch(req.method){
                        case `GET`:{
                            return books.get().then(col=>res.json(handleQuery(col)))
                        }
                        case `POST`:{
                            return addBook(req,res,admin)
                        }
                    }
                }

                case `userSearch`:{
                    if(!req.query.name) return res.sendStatus(400)
                    return Promise.resolve(userList).then(userList=>{
                        res.json(userList.filter(u=>u.username && !u.username.indexOf(req.query.name)))
                    })
                    
                }


                case `mr`:{
                    switch(req.method){
                        case `GET`:{
                            return mra
                                .orderBy(`date`,`desc`)
                                .offset(req.query.offset?+req.query.offset:0)
                                .limit(req.query.limit?+req.query.limit:200)
                                .get()
                                .then(col=>{
                                    res.json(handleQuery(col))
                                })
                        }
                        case `POST`:{
                            if(!req.body.user || !req.body.date || !req.body.time) return res.sendStatus(400)
                            return mra.add({
                                active:     true,
                                createdAt:  new Date(),
                                user:       +req.body.user,
                                date:       req.body.date,
                                time:       req.body.time
                            }).then(s=>{
                                res.json({
                                    success: true,
                                    id:     s.id,
                                    data: {
                                        active:     true,
                                        createdAt:  new Date(),
                                        user:       +req.body.user,
                                        date:       req.body.date,
                                        time:       req.body.time
                                    }
                                })
                            })
                        }
                    }
                    
                }
                case `userClasses`:{
                    switch(req.method){
                        case `GET`:{
                            return userClasses
                                .orderBy(`createdAt`,'desc')
                                .offset(req.query.offset?+req.query.offset:0)
                                .limit(req.query.limit?+req.query.limit:100)
                                .get()
                                .then(col=>{
                                    res.json(handleQuery(col))
                                })
                        }
                        case `POST`:{
                            if(!req.body.user || !req.body.class) return res.sendStatus(400)
                            return getDoc(classes,req.body.class).then(c=>{
                                if(!c) return res.sendStatus(400)
                                if(!c.active) return res.status(400).send(`Занятие отменено`)
                                getUser(req.body.user,udb).then(u=>{
                                    if(!u) return res.status(400).send(`Такого пользователя нет`)
                                    classMethods.bookClass(u,req.body.class,res)
                                })
                            })
                        }
                    }
                    
                }
                case 'message': {
                    if (req.body.text && req.body.user) {
                        return sendMessage2({
                                chat_id: req.body.user,
                                text: req.body.text
                            }, false, token, messages,{
                                admin: +admin.id
                            })
                            .then(r => {

                                devlog(r)

                                res.json({
                                    success: true
                                })

                                

                            }).catch(err => {
                                res.json({
                                    success: false,
                                    comment: `Отправка не задалась.`
                                })
                            })
                    } else {
                        return res.sendStatus(400)
                    }
                }
                case `deposits`:{
                    return deposits.get().then(col=>res.json(handleQuery(col,true)))
                }
                case `deposit`:{
                    if(!req.body.amount) return res.status(400).send(`no money provided`)
                    if(!req.body.user) return res.status(400).send(`no user provided`)
                    return deposits.add({
                        createdAt:  new Date(),
                        createdBy:  +admin.id,
                        amount:     Number(req.body.amount),
                        user:       req.body.user,
                        description: req.body.description
                    }).then(rec=>{
                        udb.doc(req.body.user.toString()).update({
                            deposit: FieldValue.increment(Number(req.body.amount))
                        }).then(s=>{
                            getUser(req.body.user,udb).then(u=>{
                                res.json({
                                    success:    true,
                                    comment:    `Баланс обновлен.`,
                                    total:      u.deposit
                                })
                                log({
                                    admin: +admin.id,
                                    deposit: rec.id,
                                    user: +req.body.user,
                                    text: `${uname(admin,admin.id)} обновляет баланс пользователя ${uname(u,u.id)} на ${req.body.amount}\n(${req.body.description||'без лишних слов'})`
                                })
                                sendMessage2({
                                    chat_id: u.id,
                                    text: translations.deposited(u.deposit)[u.language_code] || translations.deposited(u.deposit).en
                                },false,token,messages)
                            })
                        })
                    })
                }
                case `standAlone`:{
                    switch (req.method){
                        case `POST`:{
                            if(req.body.name){
                                let free = true;
                                if(req.body.slug) free = standAlone.doc(req.body.slug.toString()).get().then(d=>handleDoc(d))
                                return Promise.resolve(free).then(p=>{
                                    if(p) return res.status(400).send(`slug уже занят`)
                                    let page = {
                                        createdAt:      new Date(),
                                        active:         true,
                                        createdBy:      +admin.id,
                                        name:           req.body.name,
                                        description:    req.body.description || null,
                                        html:           req.body.html || null,
                                        views:          0,
                                        slug:           req.body.slug || null
                                    }
                                    if(req.body.slug){
                                        standAlone.doc(req.body.slug).set(page).then(s=>{
                                            res.json({
                                                success: true,
                                                id: req.body.slug
                                            })
                                        })
                                    } else {
                                        standAlone.add(page).then(rec=>{
                                            res.json({
                                                success: true,
                                                id: rec.id
                                            })
                                            standAlone.doc(rec.id).update({
                                                slug: rec.id
                                            })

                                        })
                                    }
                                    
                                })
                            }
                        }
                        case `GET`:{
                            return standAlone.get().then(col=>{
                                res.json(handleQuery(col,true))
                            })
                        }
                    }
                }

                case `invoice`:{
                    return getUser(req.body.user,udb).then(u=>{
                            
                        devlog(u)

                        if(!u) return res.sendStatus(404)

                        return invoices.add({
                            active:     true,
                            createdAt:  new Date(),
                            createdBy:  +admin.id,
                            price:      +req.body.price,
                            desc:       req.body.desc,
                            descLong:   req.body.descLong || null,
                            user:       +req.body.user
                        }).then(rec=>{
                            sendMessage2({
                                chat_id: req.body.user,
                                title: `${req.body.desc}`,
                                description: req.body.descLong || `После оплаты возврат средств не осуществляется.`,
                                payload: `invoice_${rec.id}`,
                                need_phone_number: true,
                                send_phone_number_to_provider: true,
                                provider_data: {
                                    receipt: {
                                        customer: {
                                            full_name: u.first_name+' '+u.last_name,
                                            phone: +u.phone
                                        },
                                        items: [{
                                            description: req.body.desc,
                                            quantity: "1.00",
                                            amount:{
                                                value: req.body.price,
                                                currency: 'RUB'
                                            },
                                            vat_code: 1
                                        }]
                                    }
                                },
                                "provider_token": process.env.papersTranzzoToken,
                                "currency": "RUB",
                                "prices": [{
                                    "label": req.body.desc,
                                    "amount":  req.body.price*100
                                }]
                            },'sendInvoice', token).then(m=>{
                                devlog(m)
                                invoices.doc(rec.id).update({
                                    message: m.result.message_id
                                })
                                res.json({
                                    success: true,
                                    comment: `Ивойс отправлен`
                                })
                            })
                        })
                    })
                }

                case `rcParticipants`:{
                    return udb
                        .where(`randomCoffee`,'==',true)
                        .where(`active`,'==',true)
                        .get()
                        .then(col=>{
                            res.json(handleQuery(col))
                        })
                }
                case `rc`:{
                    switch(req.method){
                        case `GET`:{
                            let col = randomCoffees.where(`active`,'==',true)
                            
                            if(req.query.iteration) col = col.where(`iteration`,'==',req.query.iteration)

                            return col.get()
                                .then(col=>{
                                    res.json(handleQuery(col,true))
                                })
                        }
                        case `POST`:{
                            return rcMethods.randomCoffeePrepare(admin,res,req)
                                .then(()=>{
                                    res.json({
                                        success: true,
                                        comment: `Предварительные запросы отправлены.\nНе забудьте запустить круг через пару часов!`
                                    })
                                }).catch(err=>{
                                    res.status(500).send(err.message)
                                })
                        }
                    }
                }

                
                case `coworking`:{
                    return coworking
                        .where(`date`,'>=',req.query.start||isoDate())
                        .where(`active`,'==',true)
                        .get()
                        .then(col=>{
                            let records = handleQuery(col)
                            let hallsList = [...new Set(records.map(r=>r.hall))]
                            let hallsData = [];
                            hallsList.forEach(id=>{
                                hallsData.push(halls.doc(id).get().then(h=>handleDoc(h)))
                            })
                            Promise.all(hallsData).then(hd=>{
                                res.json({
                                    records: records.map(r=>{
                                        let t = r;
                                        t.hallName = hd.filter(h=>h.id == r.hall)[0].name
                                        return t
                                    }),
                                    halls: hd
                                })
                            })
                        })
                }
                case `halls`:{
                    switch(req.method){
                        case 'GET':{
                            return halls.get().then(col=>{
                                res.json(handleQuery(col,false,true))
                            })
                        }
                    }
                }
                case `stats`:{
                    
                    log({
                        text: `${uname(admin,admin.id)} запрашивает выгрузку данных ${req.query.type}`,
                        admin: +admin.id
                    })

                    switch(req.query.type){
                        case `tickets`:{
                            return userClasses.get().then(col=>{
                                let opts = {
                                    fields: [
                                        `id`,
                                        `createdAt`,
                                        `date`,
                                        `user`,
                                        `status`,
                                        `class`,
                                        `rate`,
                                        `active`,
                                    ]
                                }
                                const parser = new Parser(opts);

                                let csv = parser.parse(handleQuery(col,true).map(c=>{
                                    return {
                                        id: c.id,
                                        createdAt: new Date(c.createdAt._seconds*1000),
                                        date:  (c.date && new Date(c.date)) ? new Date(c.date) : null,
                                        user: c.user,
                                        status: c.status,
                                        class: c.class || null,
                                        rate: c.rate || null
                                        // fellows: c.fellows || false
                                    }
                                }));
                        
                                res.attachment('tickets_'+Number(new Date())+'.csv');
                                res.status(200).send(csv);
                            })
                        }
                        case `schedule`:{
                            
                            return classes.get().then(col=>{
                                let opts = {
                                    fields: [
                                        `date`,
                                        `name`,
                                        `author`,
                                        `visitors`,
                                        `rate`,
                                        `views`,
                                        `fellows`,
                                        `admins`
                                    ]
                                }
                                const parser = new Parser(opts);

                                let csv = parser.parse(handleQuery(col,true).map(c=>{
                                    return {
                                        date:  (c.date && new Date(c.date)) ? new Date(c.date) : null,
                                        name: c.name,
                                        author: c.author || c.authorName,
                                        visitors: c.visitors || null,
                                        rate: c.rate || null,
                                        admins: c.admins || false,
                                        fellows: c.fellows || false
                                    }
                                }));
                        
                                res.attachment('classes_'+Number(new Date())+'.csv');
                                res.status(200).send(csv);
                            })
                        }
                        case `cowork`:{
                            let fields = [
                                'date',
                                'visits',
                                'newcomers'
                            ];

                            let opts = {
                                fields
                            };
                
                            const parser = new Parser(opts);
                            
                            return coworking
                            .where(`active`,'==',true)
                            .get()
                            .then(col=>{
                                let data = handleQuery(col).sort((a,b)=>a.date>b.date?1:-1)
                                devlog(data.map(r=>r.date))
                                let result = {};
                                let userIndex = [];
                                data.forEach(record=>{
                                    if(!result[record.date]) result[record.date] = {
                                        visits: 0,
                                        newcomers: 0
                                    }
                        
                                    result[record.date].visits ++
                        
                                    if(userIndex.indexOf(record.user) == -1) {
                                        result[record.date].newcomers ++
                                        userIndex.push(record.user)
                                    }
                        
                        
                                })
                                
                                let csv = parser.parse(Object.keys(result).map(date=>{
                                    return {
                                        date: date,
                                        visits: result[date].visits,
                                        newcomers: result[date].newcomers
                                    }
                                }));
                        
                                res.attachment('cowork_'+Number(new Date())+'.csv');
                                res.status(200).send(csv);

                            })
                            
                            

                        }
                        case `users`:{
                            return udb.get().then(col=>{
                                let opts = {
                                    fields: [
                                        `id`,
                                        `active`,
                                        `createdAt`,
                                        `first_name`,
                                        `last_name`,
                                        `userName`,
                                        `language_code`,
                                        `about`,
                                        `occupation`,
                                        `blocked`,
                                        `bonus`,
                                        `classesVisits`,
                                        `coworkingVisits`,
                                        `deposit`,
                                        `noSpam`,
                                        `insider`,
                                        `fellow`,
                                        `admin`,

                                    ]
                                }
                                const parser = new Parser(opts);

                                let csv = parser.parse(handleQuery(col,true).map(c=>{
                                    return {
                                        id: c.id,
                                        active: c.active,
                                        createdAt: new Date(c.createdAt._seconds*1000),
                                        first_name: c.first_name,
                                        last_name: c.last_name,
                                        userName: c.userName,
                                        language_code: c.language_code,                                        
                                        about: c.about,
                                        occupation: c.occupation,
                                        blocked: c.blocked,
                                        bonus: c.bonus,
                                        classesVisits: c.classesVisits,
                                        coworkingVisits: c.coworkingVisits,
                                        deposit: c.deposit,
                                        noSpam: c.noSpam,
                                        insider: c.insider,
                                        fellow: c.fellow,
                                        admin: c.admin,
                                    }
                                }));
                        
                                res.attachment('users_'+Number(new Date())+'.csv');
                                res.status(200).send(csv);
                            })
                        }
                        default:{
                            return res.sendStatus(404)
                        }
                    }
                    
                }
                case `channel`:{
                    return classes.doc(req.query.class).get().then(c=>{
                        if(!c.exists) return res.sendStatus(404)
                        let lang = `ru`
                        let h = c.data();
                        let kbd = [
                            [{
                                text: translations.book[lang] || translations.book.en,
                                callback_data: 'class_' + req.query.class
                            }]
                        ]
                        let message = {
                            chat_id: -1002103011599,
                            text: `${drawDate(h.date,false,{time:true})}.\n<b>${h.name}</b>\n<b>${translations.author[lang] ||  translations.author.en}:</b> ${h.author || h.authorName}\n<b>${translations.hall[lang] ||  translations.hall.en}:</b> ${h.hallName}\n\n${h.description}\n${h.price? `${translations.fee[lang] ||  translations.fee.en} ${cur(h.price,'GEL')}` : `${translations.noFee[lang] ||  translations.noFee.en}`}`,
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
                        sendMessage2(message, (h.pic ? 'sendPhoto' : false), token)
                    })
                }
                case `ticket`:{
                    
                    if(!req.query.ticket) return res.sendStatus(400)

                    return userClasses.doc(req.query.ticket).get().then(t=>{
                        if(!t.exists) return res.sendStatus(404)
                        userClasses.doc(req.query.ticket).update({
                            [req.body.attr]: req.body.value
                        }).then(s=>{
                            res.sendStatus(200)
                        }).catch(err=>{
                            res.status(500).send(err.message)
                        })
                    })
                }
                case `announce`:{
                    
                    let list = userClasses.where(`class`,`==`,req.body.class);
                    if(req.body.type == `all`) list = list.where('active', '==', true)
                    if(req.body.type == `inside`) list = list.where('status', '==', `used`)
                    if(req.body.type == `outside`) list = list.where('status', '!=', `used`)
                    
                    return list.get()
                        .then(tickets=>{
                            handleQuery(tickets).forEach(t=>{
                                
                                sendMessage2({
                                    chat_id: t.user,
                                    text: req.body.text,
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{
                                                text: translations.openClass.en,
                                                web_app: {
                                                    url: process.env.ngrok + '/paper/app?start=class_'+req.body.class
                                                }
                                            }]
                                        ]
                                    }
                                }, false, token, messages)
                            })
                            res.sendStatus(200)
                        })
                    .catch(handleError)
                }
                case 'feedBack':{
                    if(!req.query.class) res.sendStatus(404)
                    classMethods.feedBackRequest(req.query.class)
                    res.sendStatus(200)
                    break;
                }
                case `q`:{
                    return userClassesQ
                        .where(`class`,'==',req.query.class)
                        .get()
                        .then(col=>{
                            let fin = [];
    
                            handleQuery(col).forEach(q=>{
                                fin.push(getUser(q.user,udb).then(u=>{
                                    let t = q;
                                        q.userData = u;
                                    return t;
                                }))
                            })
    
                            Promise.all(fin).then(data=>{
                                res.json(data)
                            })
    
                            
                        })
                }
                case `authors`:{
                    switch (req.method){
                        case `GET`:{
                            return authors
                                .get().then(col=>{
                                    res.json(handleQuery(col,false,true))
                                })
                        }
                        case 'POST':{
                            
                            if(!req.body.name) return res.json({success: false, comment: `no name provided`})
                            if(!req.body.description) return res.json({success: false, comment: `no description provided`})
                            
                            return authors.add({
                                active:         true,
                                createdAt:      new Date(),
                                createdBy:      +user.id,
                                name:           req.body.name,
                                description:    req.body.description,
                                pic:            req.body.pic || null
                            }).then(s=>{
                                res.json({success:true,comment: `Автор ${req.body.name} создан. Можно добавить еще.`})
                            }).catch(err=>{
                                res.json({success: false, comment: err.message})
                            })
                        }
                    }
                    break;
                }
                case `news`: {
                    switch (req.method){
                        
                        case `GET`:{
                            return news.orderBy('createdAt', 'DESC').get().then(col => {
                                res.json(handleQuery(col))
                            }).catch(err => {
                                res.status(500).send(err.message)
                            })
                        }

                        case `POST`:{
                            if(!req.body.name || !req.body.text) return res.sendStatus(400)
                            try {

                                let record = await newsMethods.add(req.body,admin);
                                let result = await newsMethods.startNews(record.id);

                                return res.json({
                                    id:         record.id,
                                    comment:    `Рассылка создана и расходится на ${result.success} пользователей.`
                                })
                            } catch (error) {
                                return res.status(500).send(error.message)
                            }
                            
                        }
                    }
                    
                }
                case `subscribe`:{
                    if(!req.body.plan || !req.body.user) {
                        return res.status(400).send(`plan or user missing`)
                    }
                    return plans.doc(req.body.plan).get().then(p=>{
                        if(!p.exists || !p.data().active) return res.status(404).send(`plan is not available`)
                        
                        p = p.data();
    
                        getUser(req.body.user,udb).then(user=>{
    
                            if(!user) return res.status(400).send(`Нет такого пользователя`)
    
                            if(user.blocked) return res.status(400).send(`Пользователь заблокирован`)
    
                            plansUsers.add({
                                user:       +req.body.user,
                                createdAt:  new Date(),
                                to:         new Date(+new Date()+p.days*24*60*60*1000),
                                visitsLeft: p.visits,
                                eventsLeft: p.events,
                                createdBy:  req.query.id ? +req.query.id : null,
                                name:       p.name,
                                active:     true,
                                plan:       req.body.plan
                            }).then(s=>{

                                if(req.body.request) getDoc(plansRequests,req.body.request).then(r=>{
                                    if(r) plansRequests.doc(req.body.request).update({
                                        active: false,
                                    })
                                })
                                
                                res.send(`Подписка оформлена`)
    
                                devlog(user)
    
                                sendMessage2({
                                    chat_id: user.id,
                                    text: translations.planConfirmed(p)[user.language_code] || translations.planConfirmed(p).en
                                },false,token,messages)
    
                                log({
                                    filter: `coworking`,
                                    text: `Админ @id${req.query.id} выдает подписку «${p.name}» (${cur(p.price,'GEL')}) пользователю ${req.body.user}`,
                                    admin:  req.query.id ? +req.query.id : null,
                                    user:   req.body.user,
                                    silent: true
                                })
                            }).catch(err=>{
                                console.log(err);
                                res.status(500).send(err.message)
                            })
                        })
                    })
                }
                case `qr`: {
                    if (!req.query.data) return res.sendStatus(404)
                    // @ts-ignore
                    let inc = (req.query.data||'').split('_')
    
                    if (inc[1] == 'coworking') {
                        fb.collection(inc[1]).doc(inc[0]).get().then(d => {
    
                            if (!d.exists) return res.sendStatus(404)
    
                            d = d.data();
    
    
                            switch (req.method) {
                                case 'GET': {
    
                                    getUser(d.user, udb).then(user => {
                                        d.user = user;
                                        
                                        if (user.blocked) {
                                            d.alert = `Этот человек в черном списке!!!`
                                        }

                                        halls.doc(d.hall).get().then(h => {
                                            d.hall = h.data()
    
                                            devlog(user.id)
    
                                            plansUsers
                                                .where('user','==',+user.id)
                                                .where('active','==',true)
                                                .get().then(col=>{
                                                    
                                                    devlog(col.docs)
    
                                                    let plan = handleQuery(col)[0]
    
                                                    devlog(plan)
    
                                                    if(plan && plan.visitsLeft){
                                                        
                                                        // plansUsers.doc(plan.id).update({
                                                        //     visitsLeft: FieldValue.increment(-1)
                                                        // })
    
                                                        devlog(`подписка есть`)
    
                                                        res.json({
                                                            alert: `Гость на подписке (у него еще ${plan.visitsLeft} посещений)`,
                                                            data: d
                                                        })
    
                                                    } else {
    
                                                        devlog(`подписки нет`)
    
                                                        res.json({
                                                            alert: d.alert || null,
                                                            data: d
                                                        })
                                                    }
                                                })
    
                                            
                                        })
    
                                    })
    
                                    break;
                                }
                                case 'POST': {
    
                                    getUser(d.user, udb).then(user => {
                                        d.user = user;
    
                                        let toPay = null;
    
                                        let withdraw = 0;
    
                                        if (d.paymentNeeded && !d.payed) {
                                            toPay = coworkingPrice;
                                        }
    
                                        if (user.deposit) {
                                            if (user.deposit > coworkingPrice) {
                                                toPay = 0
                                                alertWithdrawal(user, false, coworkingPrice, `coworking`)
                                            } else {
                                                toPay = coworkingPrice - user.deposit;
                                                alertWithdrawal(user, false, user.deposit, `coworking`)
                                            }
                                        }
    
                                        fb.collection(inc[1]).doc(inc[0]).update({
                                            payed: d.paymentNeeded ? true : false,
                                            status: 'used'
                                        })

                                        udb.doc(user.id.toString()).update({
                                            coworkingVisits: FieldValue.increment(1)
                                        })
                                        
    
                                        devlog(user.id)
    
                                        plansUsers
                                            .where('user','==',+user.id)
                                            .where('active','==',true)
                                            .get().then(col=>{
                                                let plan = handleQuery(col)[0]
                                                
                                                devlog(plan)
    
                                                if(plan && plan.visitsLeft){
                                                    
                                                    plansUsers.doc(plan.id).update({
                                                        visitsLeft: FieldValue.increment(-1)
                                                    })
    
                                                    res.json({
                                                        success: true,
                                                        alert: `Посещение вычтено из подписки.`
                                                    })
    
                                                } else {
                                                    res.json({
                                                        success: true,
                                                        alert: toPay ? `К оплате на месте: ${cur(toPay,'GEL')}` : `Оплата не требуется.`
                                                    })
                                                }
                                            })
    
                                        
    
                                    })
    
    
                                    break;
                                }
                            }
                        })
                    } else if (inc[1] == 'wineList') {
                        fb.collection(inc[1]).doc(inc[0]).get().then(d => {
    
                            if (!d.exists) return res.sendStatus(404)
    
                            d = d.data();
    
    
                            switch (req.method) {
                                case 'GET': {
                                    res.json({data:d})
                                    break;
                                }
                                case 'POST': {
                                    if (d.left) {
                                        fb.collection(inc[1])
                                            .doc(inc[0])
                                            .update({
                                                left:       FieldValue.increment(-1),
                                                updatedAt:  new Date(),
                                                statusBy:   +req.query.id
                                            }).then(() => {
                                                res.sendStatus(201)
                                                if (d.left - 1) {
                                                    sendMessage2({
                                                        photo: process.env.ngrok + `/paper/qr?id=${inc[0]}&entity=wineList`,
                                                        chat_id: d.user,
                                                        caption: `Ваш депозит убыл. На балансе ${letterize(d.left-1, 'ходка')}`
                                                    }, 'sendPhoto', token, messages)
                                                } else {
                                                    sendMessage2({
                                                        photo: process.env.ngrok + `/paper/qr?id=${inc[0]}&entity=wineList`,
                                                        chat_id: d.user,
                                                        caption: `Приплыли. Депозит на нуле. Пора домой`
                                                    }, 'sendPhoto', token, messages)
                                                }
    
                                            }).catch(err => {
                                                console.log(err)
                                                res.sendStatus(500).send(err.message)
                                            })
                                    } else {
                                        res.status(403).send(`Этому больше не наливать`)
                                    }
                                    break;
    
                                }
                            }
    
                        })
    
                    } else if (inc[1] == 'promos') {
                        fb.collection(inc[1]).doc(inc[0]).get().then(d => {
    
                            if (!d.exists) return res.sendStatus(404)
    
                            d = d.data();
    
    
                            switch (req.method) {
                                case 'GET': {
                                    devlog(d)
                                    res.json({data:d})
                                    break;
                                }
                                case 'POST': {
                                    if (d.left) {
                                        fb.collection(inc[1])
                                            .doc(inc[0])
                                            .update({
                                                left: FieldValue.increment(-1),
                                                updatedAt: new Date(),
                                                statusBy: req.query.id
                                            }).then(() => {
                                                res.sendStatus(200)
    
                                            }).catch(err => {
                                                console.log(err)
                                                res.sendStatus(500).send(err.message)
                                            })
                                    } else {
                                        res.status(403).send(`Этому больше не наливать`)
                                    }
                                    break;
    
                                }
                            }
    
                        })
    
                    } else if (inc[1] == `planRequests`) {
    
                        switch(req.method){
                            case 'GET':{
                                return plansRequests.doc(inc[0]).get().then(r=>{
                                    let data = [];
                                    if(!r.exists) return res.status(500).send(`Такой заявки нет в базе данных`)
                                    r = r.data();
                                    data.push(getUser(r.user,udb).then(u=>u))
                                    data.push(plans.doc(r.plan).get().then(p=>p.data()))
                                    Promise.all(data).then(data=>{
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
                                        
                                        plansUsers.add({
                                            user:       r.user,
                                            createdAt:  new Date(),
                                            to:         new Date(+new Date()+p.days*24*60*60*1000),
                                            visitsLeft: p.visits,
                                            eventsLeft: p.events,
                                            createdBy:  +req.query.id,
                                            name:       p.name,
                                            active:     true,
                                            plan:       r.plan
                                        }).then(()=>{
                                            getUser(r.user,udb).then(user=>{
                                                sendMessage2({
                                                    chat_id: r.user,
                                                    text: translations.planConfirmed(p)[user.language_code] || translations.planConfirmed(p).en
                                                },false,token,messages)
                                                log({
                                                    filter: `coworking`,
                                                    text: `Админ @id${req.query.id} выдает подписку «${p.name}» (${cur(p.price,'GEL')}) пользователю ${uname(user,r.user)}`,
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
                                        if (!d.exists) {
                                            res.send({
                                                success: false,
                                                alert: `Такого билета нет в природе`
                                            })
                                        }
                                        classes.doc(d.data().class).get().then(c => {
                                            c = c.data()
    
                                            if (!c.active) return res.json(res.json({
                                                success: false,
                                                data: d.data(),
                                                alert: `Мероприятие было отменено!`
                                            }))
    
                                            d = d.data();
    
                                            d.date = drawDate(c.date, 'ru', {
                                                time: true
                                            })
                                            
                                            d.hall = c.hallName
    
                                            plansUsers
                                                .where('user','==',+d.user)
                                                .where('active','==',true)
                                                .get().then(col=>{
                                                    let plan = handleQuery(col)[0]
                                                    if(plan && plan.eventsLeft){
                                                        
                                                        plansUsers.doc(plan.id).update({
                                                            eventsLeft: FieldValue.increment(-1)
                                                        })
    
                                                        res.json({
                                                            alert: `Посещение по подписке (осталось ${plan.eventsLeft-1})`,
                                                            success: true,
                                                            data: d
                                                        })
    
                                                    } else {
                                                        res.json({
                                                            success: true,
                                                            data: d
                                                        })
                                                    }
                                                })
                                                
    
    
                                            
                                        })
    
                                    })
                            }
                            case 'POST': {
    
                                fb.collection(inc[1])
                                    .doc(inc[0])
                                    .update({
                                        status:     'used',
                                        known:      true,
                                        updatedAt:  new Date(),
                                        statusBy:   req.query.id
                                    }).then(() => {
                                        res.sendStatus(200)
                                    }).catch(err => {
                                        res.status(500).send(err.message)
                                    })
                                if (inc[1] == 'userClasses') return classMethods.acceptTicket(inc[0])                                    
                            }
                        }
                    }
                    break;
    
    
    
                }
                case 'check': {
                    return res.json(user)
                }
    
                case 'classes': {
                    switch(req.method){
                        case 'GET':{
                            return classes
                                .where('active', '==', true)
                                .orderBy('date', 'desc')
                                .get()
                                .then(col => {
                                    res.json(handleQuery(col))
                                })
                        }
                        case 'POST':{
                            if(!req.body.hall) req.body.hall = `BrXsFWF4tE7K36SHQIS6`
                            return classes.add({
                                active:         true,      
                                createdAt:      new Date(),
                                createdBy:      +user.id,
                                name:           req.body.name || `Без названия`,
                                description:    req.body.description || `Без описания`,
                                date:           req.body.date || new Date().toISOString(),
                                duration:       req.body.duration || 60,
                                hall:           req.body.hall,
                                capacity:       +req.body.capacity || 30,
                                authorName:     req.body.authorName || null,
                                author:         req.body.author || null,
                                admins:         req.body.admins || null,
                                fellows:        req.body.fellows || null,
                                noRegistration: req.body.noRegistration || null,
                                price:          +req.body.price || null,
                                pic:            req.body.pic || null,
                                clearPic:       req.body.clearPic || null
                            }).then(r=>{
                                
                                res.json({
                                    success: true,
                                    comment: `Мероприятие создано`,
                                    id:     r.id
                                })

                                log({
                                    filter: `lectures`,
                                    class: r.id,
                                    admin: +user.id,
                                    text: `${uname(user,user.id)} создает мероприятие ${req.body.name}`
                                })

                                if(req.body.author){
                                    getDoc(authors,req.body.author).then(a=>{
                                        if(!a || !a.active) classes.doc(r.id).update({
                                            author: null
                                        })
                                    })
                                }

                                if(req.body.hall){
                                    getDoc(halls,req.body.hall).then(a=>{
                                        if(!a || !a.active) {
                                            classes.doc(r.id).update({
                                                hall: null
                                            }) 
                                        } else {
                                            classes.doc(r.id).update({
                                                hallName: a.name
                                            })
                                        }

                                    })
                                }
                            }).catch(err=>{
                                console.log(err)
                                res.status(500).send(err.message)
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
                            res.json(handleQuery(col,true))
                        })
                }

                case 'classWL': {
                    if (!req.query.class) return res.sendStatus(404)
                    
                    return userClassesWL
                        .where('active', '==', true)
                        .where('class', '==', req.query.class)
                        .get()
                        .then(col => {
                            col = handleQuery(col)
                            
                            let usersData = [];

                            let usersToCome = col.map(r=>r.user)
                            
                            usersToCome.forEach(u=>{
                                usersData.push(getUser(u,udb))
                            })

                            Promise.all(usersData).then(usersData=>{
                                res.json(col.map(r=>{
                                    let t = r;
                                    t.user = usersData.filter(u =>u && u.id == t.user)[0]
                                    return t;
                                }))
                            })

                            
                        })
                }

                case 'user': {
    
                    if (!req.query.user) return res.sendStatus(404)
    
                    switch (req.query.data) {
                        case 'profile':{
                            return udb.doc(req.query.user).get().then(u=>{
                                if(!u.exists) return res.sendStatus(404)
                                return res.json(handleDoc(u))
                            })
                        }
                        case 'subscriptions': {
                            return subscriptions
                                .where('user', '==', +req.query.user)
                                .orderBy('createdAt', 'DESC')
                                .get()
                                .then(col => {
                                    res.json(handleQuery(col))
                                })
                        }
                        case 'messages': {
                            return messages
                                .where('user', '==', +req.query.user)
                                .orderBy('createdAt', 'DESC')
                                .get()
                                .then(col => {
                                    res.json(handleQuery(col))
                                })
                        }
                        case 'lections': {
                            return userClasses
                                .where('user', '==', +req.query.user)
                                .where('active', '==', true)
                                .orderBy('createdAt', 'DESC')
                                .get()
                                .then(col => {
                                    res.json(handleQuery(col))
                                })
                        }
                    }
                }
                case 'users': {
                    switch (req.method) {
                        case 'GET': {
    
                            let data = [];
                            data.push(udb
                                .orderBy((req.query.order || 'createdAt'), (req.query.direction || 'ASC'))
                                .get()
                                .then(d => handleQuery(d)))
    
                            data.push(plansUsers
                                .where('active','==',true)
                                .get()
                                .then(col=>handleQuery(col)))
    
                            data.push(plans
                                .where('active','==',true)
                                .get()
                                .then(col=>handleQuery(col)))
    
                            return Promise.all(data).then(data=>{
                                res.json({
                                    users: data[0],
                                    plans: data[1],
                                    plansA:data[2]
                                })
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
                                        text:   `Админ @${uname(actors[1],actors[1].id)} ${interprete(req.body.field,req.body.value)} @${actors[0].username || req.body.user}`,
                                        user:   +req.body.user,
                                        admin:  +actors[1].id
                                    })
    
                                    if (req.body.value) {
                                        if (req.body.field == 'insider') {
                                            sendMessage2({
                                                chat_id: req.body.user,
                                                text: translations.congrats[actors[0].language_code] || translations.congrats.en
                                            }, false, token, messages)
                                        }
    
                                        if (req.body.field == 'admin') {
                                            sendMessage2({
                                                chat_id: req.body.user,
                                                text: `Поздравляем, вы зарегистрированы как админ приложения.`
                                            }, false, token, messages)
                                        }
    
                                        if (req.body.field == 'fellow') {
                                            sendMessage2({
                                                chat_id: req.body.user,
                                                text: translations.fellow[actors[0].language_code] || translations.fellow.en
                                            }, false, token, messages)
                                        }
                                    }
                                })
                            })
                        }
    
                    }
    
                }
                case 'logs': {
                    return logs
                        .orderBy('createdAt', 'DESC')
                        .limit(req.query.offset ? +req.query.offset : 50)
                        // .limitToFirst(req.query.offset? +req.query.offset : 50)
                        .get()
                        .then(col => {
                            res.json(handleQuery(col))
                        })
                }

                case `wine`:{
                    if(!req.body.user) return res.sendStatus(400);

                    return udb.doc(req.body.user.toString()).get().then(u=>{
                        if(!u.exists) return res.sendStatus(404)
                        u = handleDoc(u)
                        if(!req.body.left) req.body.left = 5;

                        wine
                            .add(req.body,admin)
                            .then(s=>{
                                res.json({
                                    id: s.id,
                                    success: true,
                                    comment: `Налито ${req.body.left}.`
                                })
                            })
                            .catch(err=>{
                                res.status(500).send(err.message)
                            })
                    })
                }

                case `wineList`:{
                    switch(req.method){
                        case `GET`:{
                            return wineList.get().then(col=>res.json(handleQuery(col)))
                        }
                    }
                }

                case `plans`:{
                    switch(req.method){
                        case `GET`:{
                            return plans.get().then(col=>{
                                res.json(handleQuery(col,true))
                            })
                        }
                        case `POST`:{

                            if(!req.body.name) return res.status(400).send(`name is missing`)
                            if(!req.body.desc) return res.status(400).send(`desc is missing`)
                            if(!req.body.days) return res.status(400).send(`days is missing`)
                            if(!req.body.visits) return res.status(400).send(`visits is missing`)
                            if(!req.body.events) return res.status(400).send(`events is missing`)
                            if(!req.body.price) return res.status(400).send(`price is missing`)

                            return plans.add({
                                active: true,
                                createdAt:  new Date(),
                                createdBy:  +admin.id,
                                name:   req.body.name,
                                description:   req.body.desc,
                                days:   +req.body.days,
                                visits: +req.body.visits,
                                events: +req.body.events,
                                price:  +req.body.price,
                            }).then(rec=>{
                                log({
                                    text: `${uname(admin,admin.id)} создает тариф ${req.body.name}`,
                                    admin: +admin.id,
                                    plan:   rec.id
                                })
                                res.json({
                                    success:    true,
                                    comment:    `Тариф создан.`,
                                    id:         rec.id
                                })
                            }).catch(err=>{
                                handleError(err)
                            })
                        }
                    }
                    
                }
                default:
                    res.sendStatus(404)
            }
    
        })
    })
})

router.all(`/:method/:id`,(req,res)=>{
    if (!req.signedCookies.adminToken) return res.status(401).send(`Вы кто вообще?`)
    adminTokens.doc(req.signedCookies.adminToken).get().then(doc => {
        if (!doc.exists) return res.sendStatus(403)
        doc = handleDoc(doc)

        if (!doc.active) return res.sendStatus(403)

        udb.doc(doc.user.toString()).get().then(admin => {

            admin = handleDoc(admin);

            switch(req.params.method){

                case `rcStart`:{
                    
                    return getDoc(randomCoffeeIterations,req.params.id).then(i=>{
                        
                        if(!i)          return res.status(404).send(`не было такого круга`)
                        if(i.started)   return res.status(400).send(`круг уже был запущен`)
                        
                        randomCoffee(admin,req.params.id)
                
                        return res.json({
                            success: true,
                            comment: `Рулетка запущена!`
                        })    
                    })
                    
                }
                
                case `rcFollowUp`:{
                    switch(req.method){
                        case `POST`:{
                            return rcMethods.rcFollowUp(req.params.id)
                                .then(d=>{
                                    res.json(d)
                                }).catch(err=>{
                                    res.status(400).send(err.message)
                                })
                        }
                        case `GET`:{
                            
                            rcMethods.rcResult(req.params.id);
                            
                            return res.json({
                                success: true,
                                comment: `Результаты придут в телеграм.`
                            })
                        }
                    }

                    
                }

                case `usersNews`:{
                    return messages.where(`news`,'==',req.params.id).get().then(col=>res.json(handleQuery(col,true)))
                }

                case `images`: {
                    return axios.post(`https://api.telegram.org/bot${token}/getFile`, {
                        file_id: req.params.id
                    }).then(s => {
                        res.json({
                            src: `https://api.telegram.org/file/bot${token}/${s.data.result.file_path}`
                        })
                    }).catch(err=>handleError(err,res))
                }
                
                case `settings`:{
                    switch(req.method){
                        case `POST`:{
                            devlog(req.params.id);
                            devlog(req.body.value);
                            return settings.doc(req.params.id).set({help:req.body.value}).then(s=>{
                                res.json({
                                    success: true
                                })
                            }).catch(err=>{
                                res.status(500).send(err)
                            })
                        }
                        case `GET`:{
                            return getDoc(settings,req.params.id).then(d=>res.json(d))
                        }
                        case `PUT`:{
                            return updateEntity(req,res,settings.doc(req.params.id),+admin.id)
                        }
                    }
                }
                case `rcIterations`:{
                    return randomCoffeeIterations
                        .doc(req.params.id)
                        .get()
                        .then(doc=>res.json(handleDoc(doc)))
                }


                case `mr`:{
                    
                    let ref = mra.doc(req.params.id);
                    return ref.get().then(p=>{
                        switch(req.method){
                            case `DELETE`:{
                                return deleteEntity(req,res,ref,+admin.id,false,()=>plan.alertDisposal(handleDoc(p)),{
                                    user: p.data().user,
                                })
                            }
                        }
                    })
                    
                }

                case `books`:{
                    let ref = books.doc(req.params.id);
                        return ref.get().then(p=>{
                            
                            if(!p.exists) return res.sendStatus(404)

                            switch(req.method){
                                case `DELETE`:{
                                    return deleteEntity(req,res,ref,+admin.id)
                                }
                                case `PUT`:{
                                    return updateEntity(req,res,ref,+admin.id)
                                }
                            }

                        })   
                }

                case `plansUsers`:{
                    let ref = plansUsers.doc(req.params.id);
                        return ref.get().then(p=>{
                            if(!p.exists) return res.sendStatus(404)

                            switch(req.method){
                                case `DELETE`:{
                                    return deleteEntity(req,res,ref,+admin.id,false,()=>plan.alertDisposal(handleDoc(p)),{
                                        user: p.data().user,
                                        plan: p.data().plan
                                    })
                                }
                            }

                        })
                    
                }
                case `plansRequests`:{
                    let ref = plansRequests.doc(req.params.id);

                    return ref.get().then(cl => {
                        if (!cl.exists) return res.sendStatus(404)
                        switch (req.method) {
                            case `DELETE`:{
                                return ref.update({
                                    active: false
                                }).then(s=>{
                                    res.json({
                                        success: true,
                                        comment: `Заявка архивирована.`
                                    })
                                }).catch(err=>{
                                    handleError(err)
                                })
                            }                            
                        }
                    })
                }
                case `plansUses`:{
                    return plansUsers
                        .where(`plan`,'==',req.params.id)
                        .get()
                        .then(col=>{
                            res.json(handleQuery(col,true))
                        })
                }
                case `plansByUser`:{
                    switch(req.method){
                        case `GET`:{
                            return plansUsers
                                .where(`user`,'==',+req.params.id)
                                .get()
                                .then(col=>{
                                    res.json(handleQuery(col,true))
                                })
                        }
                    }
                }

                case `requestsByPlan`:{
                    return plansRequests.get().then(col=>{
                        res.json(handleQuery(col,true))
                    })
                }

                case `plans`:{
                    let ref = plans.doc(req.params.id);

                    return ref.get().then(cl => {
                        if (!cl.exists) return res.sendStatus(404)
                        switch (req.method) {
                            case `GET`:{
                                return res.json(handleDoc(cl))
                            }
                            case `DELETE`:{
                                return deleteEntity(req,res,ref,+admin.id,false,false,{
                                    plan: req.params.id
                                })
                            }
                            case `PUT`:{
                                return updateEntity(req,res,ref,+admin.id)
                            }
                        }
                    })
                }

                case `alertClass`:{
                    return getDoc(classes,req.params.id).then(async cl=>{
                        
                        if(!cl || !cl.active) return res.sendStatus(404)

                        if(req.query.self){
                            
                            sendClass(cl,admin)
                                
                            res.json({
                                success: true,
                                comment: `Го в тележку`
                            })

                        } else if(req.query.admins){
                            try {
                                let record = await newsMethods.add({
                                    name:       `Рассылка по админам по лекции ${cl.name}`,
                                    text:       classDescription(cl,`ru`),
                                    filter:     `admin`
                                },admin)
                                
                                let result = await newsMethods.startNews(record.id)
                                
                                return res.json({
                                    success: true,
                                    comment: `Рассылка уходит на ${letterize(result.success,'юзер')}.`
                                })    
                            } catch (error) {
                                res.json({
                                    success: false,
                                    comment: error.message
                                })
                            }
                            
                            
                        } else {
                            
                            if(cl.admins) cl.filter = `admin`
                            if(cl.fellows) cl.filter = `fellow`

                            try {
                                let record = await newsMethods.add({
                                    name:       `Рассылка по лекции ${cl.name}`,
                                    text:       classDescription(cl,`ru`),
                                    filter:     cl.filter || null,
                                    class:      cl.id
                                },admin)
    
                                let result = await newsMethods.startNews(record.id);
                                
                                res.json({
                                    success: true,
                                    comment: `Рассылка уходит на ${letterize(result.success,'юзер')}.`
                                })    
                            } catch (error) {
                                res.json({
                                    success: false,
                                    comment: error.message
                                })
                            }
                        }
                    })
                }
                case `standAlone`:{
                    let ref = standAlone.doc(req.params.id)
                    return ref.get().then(doc=>{
                        if(!doc.exists) return res.sendStatus(404)
                        switch(req.method){
                            case `GET`:{
                                return res.json(handleDoc(doc))
                            }
                            case `DELETE`:{
                                return deleteEntity(req,res,ref,+admin.id)
                            }
                            case `PUT`:{
                                return updateEntity(req,res,ref,+admin.id)
                            }
                        }
                    })
                }
                case `userClasses`:{
                    let ref = userClasses.doc(req.params.id);

                    return ref.get().then(cl => {
                        if (!cl.exists) return res.sendStatus(404)
                        switch (req.method) {
                            case `GET`:{
                                return res.json(handleDoc(cl))
                            }
                            case `PUT`:{
                                return updateEntity(req,res,ref,+admin.id)
                            }
                            case `DELETE`:{
                                return deleteEntity(req,res,ref,+admin.id)
                            }
                        }
                    })
                }
                case `userInvoices`:{
                    switch (req.method) {
                        case 'GET': {
                            return invoices
                                .where(`user`, '==', +req.params.id)
                                .get()
                                .then(col => {
                                    res.json(handleQuery(col,true))
                                })
                        }
                    }
                }
                case `coworking`:{
                    let ref = coworking.doc(req.params.id);

                    return ref.get().then(cl => {
                        if (!cl.exists) return res.sendStatus(404)
                        switch (req.method) {
                            case `PUT`:{
                                return updateEntity(req,res,ref,+admin.id,()=>{
                                    
                                    coworking.doc(req.params.id).update({
                                        payed: new Date()
                                    })

                                    coworkingMethods.withDrawal(cl.data(),req.body.by)
                                })
                            }
                            case `DELETE`:{
                                return deleteEntity(req,res,ref,+admin.id,false,()=>{coworkingMethods.alertCancel(cl.data())})
                            }
                        }
                    })
                }
                case `coworkingByUser`:{
                    return coworking
                        .where(`user`,'==',+req.params.id)
                        .get()
                        .then(col=>{
                            res.json(handleQuery(col).sort((a,b)=>a.date<b.date?-1:1))
                        })
                }
                case `roomsBlockedAdd`:{
                    return halls
                        .doc(req.params.id)
                        .get()
                        .then(h=>{
                            if(!h.exists) return res.sendStatus(404)
                            h = handleDoc(h)
                            let d = req.body.date || isoDate()

                            roomsBlocked
                                .where(`active`,'==',true)
                                .where(`date`,`==`,d)
                                .where(`room`,'==',req.params.id)
                                .get()
                                .then(col=>{
                                    if(col.docs.length) return res.json({
                                        success: false,
                                        comment: `Дата уже закрыта`
                                    })

                                    roomsBlocked.add({
                                        createdAt:  new Date(),
                                        createdBy:  +admin.id,
                                        active:     true,
                                        date:       d,
                                        room:       req.params.id
                                    }).then(rec=>{
                                        
                                        res.json({
                                            success: true,
                                            comment: `Дата закрыта`,
                                            id:     rec.id
                                        })

                                        coworking
                                            .where(`active`,'==',true)
                                            .where(`date`,`==`,d)
                                            .where(`hall`,'==',req.params.id)
                                            .get()
                                            .then(col=>{
                                                log({
                                                    filter: `coworking`,
                                                    text: `${uname(admin,admin.id)} закрывает зал ${h.name} на ${d}. ${col.docs.length ? `Количество затронутых пользователей: ${col.docs.length}`: ''}`,
                                                    admin: +admin.id,
                                                    hall: req.params.id
                                                })
                                                col.docs.forEach((cwr,i)=>{
                                                    setTimeout(()=>{
                                                        coworking.doc(cwr.id).update({
                                                            active:false
                                                        }).then(()=>{
                                                            let txt = `Простите, вашу запись в коворкинг на ${d} пришлось отменить по непредвиденным причинам. Пожалуйста, выберите другое время. Приносим извинения за неудобства.`
                                                            sendMessage2({
                                                                chat_id: cwr.data().user,
                                                                text: txt
                                                            },false,token,messages)
                                                        })
                                                    },i+200)
                                                })
                                            })
                                    })
                                })

                            
                        })
                }
                case `roomsBlockedByHall`:{
                    return roomsBlocked
                        .where(`room`,'==',req.params.id)
                        .where(`active`,'==',true)
                        .where(`date`,'>',new Date().toISOString().split(`T`)[0])
                        .get()
                        .then(col=>{
                            res.json(handleQuery(col,true))
                        })
                }

                case `roomsBlocked`:{
                    let ref = roomsBlocked.doc(req.params.id)
                    return ref.get().then(author => {
                        if (!author.exists) return res.sendStatus(404)
                        switch (req.method) {
                            case `DELETE`:{
                                deleteEntity(req,res,ref,admin.id)
                            }
                        }
                    })
                }

                case `coworkingHalls`:{
                    let days = []
                    let shift = 0;
                    
                    while (shift<7){
                        let date = new Date(+new Date()+shift*24*60*60*1000).toISOString().split('T')[0]
                        let hall = req.params.id
                        days.push(coworking.where(`hall`,'==',hall).where(`date`,'==',date).get().then(col=>{
                            return {
                                date: date,
                                records: handleQuery(col)
                            }
                        }))
                        shift++
                    }
                    return Promise.all(days).then(days=>{
                        res.json(days)
                    })
                }

                case `coworkingDays`:{
                    let days = []
                    let shift = 0;
                    while (shift<7){
                        let date = new Date(+new Date(req.params.id)+shift*24*60*60*1000).toISOString().split('T')[0]
                        days.push(coworking.where(`date`,'==',date).get().then(col=>{
                            return {
                                date: date,
                                records: handleQuery(col)
                            }
                        }))
                        shift++
                    }
                    return Promise.all(days).then(days=>{
                        res.json(days)
                    })
                }
                

                case `authors`:{
                    let ref = authors.doc(req.params.id)
                    return ref.get().then(author => {
                        if (!author.exists) return res.sendStatus(404)
                        switch (req.method) {
                            case 'GET': {
                                let data = []
                                data.push(classes.where(`authorId`, '==', req.params.id).get().then(col => handleQuery(col)))
                                data.push(subscriptions.where(`author`, '==', req.params.id).where(`active`, '==', true).get().then(col => handleQuery(col)))
                                data.push(courses.where(`authorId`, '==', req.params.id).where(`active`, '==', true).get().then(col => handleQuery(col)))
                                // data.push(views.where(`entity`,'==','author').where(`id`,'==',req.params.id).get().then(handleQuery))
                                return Promise.all(data).then(data => {
                                    res.json({
                                        author:         handleDoc(author),
                                        classes:        data[0],
                                        subscriptions:  data[1],
                                        courses:        data[2],
                                        // views:          data[3]
                                    })
                                })
                            }
                            case 'PUT': {
                                return ref.update({
                                    [req.body.attr]: req.body.value,
                                    updatedBy: doc.user
                                }).then(s => {
                                    log({
                                        silent: true,
                                        text: `автор ${handleDoc(author).name} был обновлен`,
                                        admin: +admin.id,
                                        author: req.params.id
                                    })
                                    res.json({
                                        success: true,
                                        comment: `Автор обновлен`
                                    })
                                }).catch(err => {
                                    res.json({
                                        success: false,
                                        comment: err.message
                                    })
                                })
                            }

                            case 'DELETE': {
                                return ref.update({
                                    active:     false,
                                    updatedBy:  +admin.id
                                }).then(s => {
                                    res.json({
                                        success: true,
                                        comment: `Автор отправлен в архив.`
                                    })
                                    log({
                                        silent: true,
                                        text:   `автор ${handleDoc(author).name} отправляется в архив`,
                                        admin:  +admin.id,
                                        author: req.params.id
                                    })
                                })
                            }
                        }
                    })
                }

                case `classes`:{
                    
                    let ref = classes.doc(req.params.id);

                    return ref.get().then(cl => {
                        if (!cl.exists) return res.sendStatus(404)
                        switch (req.method) {
                            
                            case `DELETE`:{
                                // cl = cl.data();
                                if(!cl.data().active) return res.status(400).send(`Уже отменено!`);
                                return deleteEntity(req,res,ref,+admin.id,false,()=>{
                                    classMethods.alertClassClosed(req.params.id);
                                })
                            }
                            case `PUT`:{

                                if(req.body.attr != `date`){
                                    return updateEntity(req,res,ref,+admin.id)
                                } else {
                                    return ref.update({
                                        updatedBy: +admin.id,
                                        updatedAt: new Date(),
                                        date: req.body.value
                                    }).then(s=>{
                                        res.json({
                                            success: true
                                        })
                                    })
                                }
                                
                            }
                            case `GET`:{
                                return res.json(handleDoc(cl))
                            }
                        }
                    })
                }

                case `classReviews`:{

                    let ref = classes.doc(req.params.id);

                    return ref.get().then(cl => {
                        if (!cl.exists) return res.sendStatus(404)
                        switch (req.method) {
                            case `POST`:{
                                return classMethods.feedBackRequest(req.params.id).then(s=>{
                                    res.json({
                                        success: true,
                                        comment: `Количество рассылаемых запросов: ${s}.`
                                    })
                                })
                            }
                        }
                    })
                }

                case `halls`:{
                    
                    let ref = halls.doc(req.params.id);

                    return ref.get().then(cl => {
                        if (!cl.exists) return res.sendStatus(404)
                        switch (req.method) {
                            case `GET`:{
                                return res.json(handleDoc(cl))
                            }
                            case `PUT`:{
                                return updateEntity(req,res,ref,+admin.id)
                            }
                            case `DELETE`:{
                                return deleteEntity(req,res,ref,+admin.id)
                            }
                        }
                    })
                }
                

                case `logs`:{
                    
                    let q = req.params.id.split('_')
                    
                    return logs
                        .where(q[0],'==',Number(q[1])?+q[1]:q[1])
                        // .orderBy(`createdAt`,`desc`)
                        .get()
                        .then(col=>{
                            res.json(handleQuery(col,true))
                        })
                }

                case `users`:{
                    let ref = udb.doc(req.params.id);

                    return ref.get().then(cl => {
                        if (!cl.exists) return res.sendStatus(404)
                        switch (req.method) {
                            
                            case `PUT`:{
                                return updateEntity(req,res,ref,+admin.id)
                            }

                            case `GET`:{
                                return res.json(handleDoc(cl))
                            }
                        }
                    })
                }

                case `messages`: {
                    switch (req.method){
                        case `GET`:{
                            return messages
                                .where(`user`, '==', +req.params.id)
                                .orderBy(`createdAt`, 'asc')
                                .get()
                                .then(col => {
                                    res.json(handleQuery(col))
                                })
                        }
                        case `PUT`:{
                            let ref = messages.doc(req.params.id);

                            return ref.get().then(mess=>{
                                if(!mess.exists) return res.sendStatus(404);
                                mess = handleDoc(mess);
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
                            })
                        }
                        case `DELETE`:{
                            let ref = messages.doc(req.params.id);
                            return ref.get().then(mess=>{
                                if(!mess.exists) return res.sendStatus(404);
                                mess = handleDoc(mess);
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
                            })
                        }
                    }
                    
                }

                case `news`:{
                    return news.doc(req.params.id).get().then(n=>{
                        if(!n.exists) return res.sendStatus(404)
                        return res.json(handleDoc(n))
                    })
                }

                case `wineByUser`:{
                    return wineList
                        .where(`user`,'==',+req.params.id)
                        .get()
                        .then(col=>{
                            res.json(handleQuery(col,true))
                        })
                }

                default:{
                    return res.sendStatus(404)
                }
            }
        })
    })
})

module.exports = router;