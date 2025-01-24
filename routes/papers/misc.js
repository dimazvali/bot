function getSingularVisits(){
    coworking.where(`createdAt`,'>=',new Date(`2024-01-01`)).get().then(col=>{
        col = common.handleQuery(col);
        let users = [...new Set(col.map(r=>r.user))]
        users.forEach(id=>{
            let visits = col.filter(r=>r.user == id);
            console.log(id, visits.length,new Date(visits.sort((a,b)=>a.createdAt._seconds-b.createdAt._seconds)[0].createdAt._seconds*1000));
        })
    })
}

// getSingularVisits()


// udb.where(`active`,'==',true).get().then(col=>{
//     common.handleQuery(col).filter(u=>!u.avatar_id).forEach((u,i)=>{
//         setTimeout(()=>{
//             getAvatar(u.id).then(data=>{
//                 if(data && data.ok && data.result.total_count){
//                     let pic = data.result.photos[0].reverse()[0]
//                     devlog(`${i}: ${pic.file_id}`)
//                     udb.doc(u.id).update({
//                         avatar_id: pic.file_id
//                     })
//                 }
//             })
//         },i*200)
        
//     })
// })



// randomCoffees.get().then(col=>{
//     let data = common.handleQuery(col);
//     let iterations = [... new Set(data.map(r=>r.iteration))]
//     iterations
// //         .filter(i=>i)
// //         .forEach(i=>{
// //             let dataset = data.filter(c=>c.iteration == i) 
// //             randomCoffeeIterations.doc(i).update({
// //                 couples:    dataset.length,
// //                 meets:      dataset.filter(c=>c.proof && (c.proof.first || c.proof.second)).length
// //             })
// //         })
// // })

 
// common.ifBefore(plansRequests).then(col=>{
//     col.forEach(r=>{
        
//         devlog(r.id)

//         plansRequests.doc(r.id).update({
//             active: false
//         })
//     })
// })

// logs.get().then(col=>{
//     common.handleQuery(col).forEach(rec=>{
//         if(rec.user && typeof(rec.user) == `string`) logs.doc(rec.id).update({user: +rec.user})
//         if(rec.admin &&  typeof(rec.admin) == `string`) logs.doc(rec.id).update({admin: +rec.admin})
//     })
// })


// m.sendMessage2({
//     chat_id: 153982541,
//     parse_mode: `Markdown`,
//     text: `[человек](tg://user?id=${819380165})`
// },false,token)

function alertNewClassesOffers(){
    axios.get(`https://api.trello.com/1/lists/6551e8f31844b130a4db500a/cards?key=${process.env.kahaTrelloKey}&token=${process.env.kahaTrelloToken}`).then(data=>{
        data.data.forEach(card=>{
            classesOffers.doc(card.id).get().then(d=>{
                if(!d.exists){
                    m.sendMessage2({
                        chat_id: 487598913,
                        text: `Увага! Новая лекция предложена, но не рассмотрена по существу:\n${card.name}: ${card.desc}\n${card.shortUrl}`
                    },false,token)
                }
            })
        })
    })
}

function sendCoffeInvites(){
    udb
        .where(`active`,'==',true)
        .get()
        .then(col=>{
            common.handleQuery(col)
                .filter(u=>!u.rcInvited)
                .filter(u=>!u.hasOwnProperty(`randomCoffee`))
                // .slice(0,1)
                .forEach((u,i)=>{
                    setTimeout(()=>{
                        m.sendMessage2({
                            chat_id: u.id, // common.dimazvali,  
                            photo: `https://firebasestorage.googleapis.com/v0/b/paperstuff-620fa.appspot.com/o/random%2Frc.jpg?alt=media&token=85d36cca-9107-4580-a973-daa29a159083`,
                            caption: `Привет! Это команда Papers.

На этот бот подписаны почти три тысячи человек из сферы IT, медиа, дизайна, бизнеса и НКО. Многие успели познакомиться в коворкинге, на лекциях и комьюнити-днях, но мы решили пойти дальше — и запустить сервис случайных знакомств для неслучайных людей по принципу random coffee.

История random coffee началась 11 лет назад, ее придумали в Англии для того, чтобы сотрудники социального агентства NESTA перестали стесняться разговаривать друг с другом. У них получилось.

Как это работает: 

1️⃣ Вы подтверждаете согласие на участие в программе (кнопка внизу) и заполняете профиль в приложении (сфера деятельности и пара слов о себе — ваш пол, возраст и прочие щепетильности не играют никакой роли).
2️⃣ Каждый четверг бот подбирает вам нового собеседника — и представляет его. Далее вы можете договориться о встрече онлайн или офлайн. Если вы уезжаете из города или просто не хотите ни с кем разговаривать, вы можете пропустить тур — или вовсе выйти из программы.`,
                            reply_markup: {
                                inline_keyboard: [
                                    [{
                                        text: `Включить random coffee`,
                                        callback_data: `random_subscribe`
                                    }]
                                ]
                            }
                        },`sendPhoto`,token,messages).then(s=>{
                            udb.doc(u.id.toString()).update({
                                rcInvited: new Date()
                            })
                            
                        })
                    },i*300)
                })
        })
}

function sendTestApp(uid){
    m.sendMessage2({
        chat_id: uid || common.dimazvali,
        text: `Приложенька с дева`,
        reply_markup: {
            inline_keyboard: [
                [{
                    text: `test`,
                    web_app: {
                        url: `${ngrok2}/paper/app`
                    }
                }]
            ]
        }
    }, false, token, messages)
}