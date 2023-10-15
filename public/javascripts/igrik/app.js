
let tg = window.Telegram.WebApp;

let userid = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : userId
let isAdmin = false;


axios.get(`/igrik/api/user?id=${userid}`).then(u => {

    isAdmin = u.data.admin;

    if(!u.data.phone) { 
        tg.showAlert(`Чтобы получить йога-пасс, поделитесь своим номером телефона`)
        axios.post(`/igrik/api/requestPhone?id=${userid}`);
        // tg.close()

        drawPass(u.data)

    } else {
        drawPass(u.data)
    }

    setTimeout(function(){

    },300)
}).catch(err=>{
    console.log(err)
})


const mastersDesc = {
    '83b7b582-b2c2-11ed-2292-00505683b2c0': 'Power Yoga,  Yoga Sculpt, Винная йога',
    '24c28e6e-9d62-11ed-2a93-00505683b2c0': 'Хатха-йога',
    '302dddd0-9d62-11ed-2a93-00505683b2c0': 'Тантра-терапия',
    '3c717c8c-9d62-11ed-2a93-00505683b2c0': 'Хатха-йога, функциональная йога',
    'c4a87454-e8bf-11ed-8a87-005056833ca1': 'Шоколадная медитация с "Культурой"',
    '85c6c5ac-e418-11ed-9fb9-005056833ca1': 'Йога FYSM',
    '0e586cf8-e41a-11ed-9fb9-005056833ca1': 'Медитативная практика инь-йога, здоровая спина, йога нидра, Personal soul treatment',
    'd2e5c188-e41a-11ed-9fb9-005056833ca1': 'Хатха с элементами Флоу, йога нидра',
    '1f2a405e-e41c-11ed-9fb9-005056833ca1': 'Хатха-йога',
    '11fd22ae-1430-11ee-8380-005056833ca1': 'Хатка-йога, Мягкая йога, Терапевтическая йога — здоровая спина, Йога-Нидра, Винная йога, Медитации'
}

function drawPass(user){
    // starter.remove()
    document.body.classList.add('s')

    let c = ce('div','content')
    document.body.append(c);
    
    c.append(ce('h2',false,false,user.first_name+' '+user.last_name))
    
    let cc = ce('span',false,false,(user.phone ? (user.credit||`бабка-йожка`) : 'Вы пользуетесь усеченной версией приложения. Отправьте свой номер, чтобы стать членом клуба.'))
    // let tagline = ce('p',false,'white',(user.username? user.username+', ': ''))
    // c.append(tagline)
    // tagline.append(cc)

    if(user.phone){

        
            let cont = ce('div',false,'scroll')

            

            let account = ce('div',false,'account','0')

            cont.append(account)
            // cont.append(ce('canvas','barcode'))

        c.append(cont)

        // JsBarcode("#barcode", +user.phone,{
        //     lineColor:      '#2f2f34',
        //     width:          2,
        //     displayValue:   false,
        //     height:         40
        // });
        axios.get(`/igrik/api/user/deposit?id=${userid}`).then(d=>{
            console.log(d.data)
            let b = d.data.data.filter(d=>d.status == 'active').reduce((a,b)=>a+b.count,0)
            if(b<30000){
                cc.innerHTML = 'мастер шавасаны'
            } else if (b< 60000){
                cc.innerHTML = 'Ловец кайфа'
            } else if (b< 90000){
                cc.innerHTML = 'Йогиня'
            } else {
                cc.innerHTML = 'Йогиня высшего уровня'
            }
            let s = 0;
            let step = 0;
            account.innerHTML = b
            // while (s < b){
            //     setTimeout(function(){
            //         account.innerHTML = s;
            //         s++
            //     },step*100)
            //     step++
            // }
        }).catch(err=>{
            console.error(err)
        })
    }
    

    let bc = ce('div',false, 'buttonsContainer')
    
    c.append(bc)

    if(user.phone){
        bc.append(ce('button',false,false,'Мои классы',{
            onclick:()=> user.phone ? showSchedule(user,true) : tg.showAlert(`Ты еще не поделилась своим номером.`)
        }))
    }
    
    bc.append(ce('button',false,false,'Расписание',{
        onclick:()=>showSchedule(user,false)
    }))

    bc.append(ce('button',false,false,'Новости',{
        onclick:()=>showNews(user,true)
    }))

    bc.append(ce('button',false,false,'Меню',{
        onclick:()=>showMenu(user,true)
    }))

    // bc.append(ce('button',false,false,'Резерв стола',{
    //     onclick:()=>showReserve(user,true)
    // }))

    bc.append(ce('button',false,false,'Учителя',{
        onclick:()=>showMasters(user,true)
    }))

    bc.append(ce('button',false,false,'Контакты',{
        onclick:()=>showContacts(user,true)
    }))

    switch(intention){
        case 'schedule':{
            showSchedule(user)
            break;
        }
        case 'me':{
            showSchedule(user,true)
            break;
        }
        case 'news':{
            showNews(user)
            break;
        }
        case 'menu':{
            showMenu(user)
            break;
        }
        case 'masters':{
            showMasters(user)
            break;
        }
        case 'contacts':{
            showContacts(user)
            break;
        }
        default:{
            if(!intention.indexOf('service')){
                showService(intention.split('_')[1],false,user)
            }
            break
        }
    }

    // document.body.append(ce('p',false,false,JSON.stringify(user)))
}

function showStart(){
    tg.MainButton.hide();
    tg.MainButton.offClick(sendOrder)

    try{
        document.querySelector('#popup').remove()
    } catch (err){
        console.log(err)
    }
    tg.BackButton.hide()
}

window.onscroll = (e)=>{
    let opacity = window.pageYOffset ? 
        (160-window.pageYOffset>0? (160-window.pageYOffset)/160 :0)
    : 1
    logo.style.opacity = opacity
}

function drawAppointMent(a,user,already,noname){
    
    // .filter(app=>app.arrival_status !== 'canceled')

    let c = ce('div')
    c.dataset.booked = (already ? 1 : 0)
    c.append(ce('span',false,['info','white'],(noname?'':new Date(a.start_date).toLocaleString('ru-RU',{
        month:  'long',
        day:    'numeric',
        hour:   '2-digit',
        minute: '2-digit'
    })+' | ')+(prices[a.service.id]?`${cur(+prices[a.service.id].price)} |`:'')+(already?` Продолжительность: ${a.duration} мин.`:' Свободных мест: '+(a.available_slots == 'unlimited' ? ' ∞.' : a.available_slots))))
    c.append(ce('h3',false,false,(noname ? new Date(a.start_date).toLocaleString('ru-RU',{
        month:  'long',
        day:    'numeric',
        hour:   '2-digit',
        minute: '2-digit'
    }) : a.service.title),{
        onclick: ()=>{
            if(a.service.description && !c.dataset.open) {
                c.insertBefore(ce('p',false,false,a.service.description),c.querySelector('button'))
                c.append(ce('p',false,'navlink','Когда еще?',{
                    onclick:()=>{
                        showService(a.service,false,user)
                    }
                }))

                if(isAdmin) {
                    c.append(ce('p',false,'navlink','Написать гостям', {
                        onclick:function(){
                            alertUsers(this,c,a.appointment_id)
                        }
                    }))

                    c.append(ce(`a`,false,`navlink`,`ссылка на класс`,{
                        href: `https://t.me/igrikyobot/app?startapp=service_${a.service.id}`
                    }))
                }
                
                c.dataset.open = true
            } else {
                if(!a.service.description) tg.showAlert('Извини, описание еще не готово.')
                // tg.showAlert(a.service.description || 'Извини, описание еще не готово.')
            }
            
        }
    }))

    if(a.employee) c.append(ce('p',false,'mtopMin',`Учитель: ${a.employee.name}.`))
    
    c.append(ce('button',false,'appButton',a.booked?` `:` `,{
        onclick:()=>{
            if(user.phone){
                already ? unBook(a,user,c)  : book(a,user,c)
            } else {
                tg.showAlert(`Жаль, но ты еще не в клубе. Пожалуйста, поделись своим номером телефона (нажми кнопку на основном экране, для этого нужно свернуть это приложение).`)
            }
            
        }
    }))
    return c;
}

function alertUsers(button, c, classid){
    button.remove();
    let txt = ce('textarea',false,false,false,{
        placeholder: 'Вам слово'
    })
    let sendb = ce('button',false,false,'Отправить',{
        onclick:function(){
            if(!txt.value) return tg.showAlert('Я не вижу ваших букв!')
            this.setAttribute('disabled',true)
            axios.post('/igrik/api/alertUsers',{
                admin: userid,
                text: txt.value,
                class: classid
            }).then(d=>{
                tg.showAlert(d.data)
                txt.value = null;
            }).catch(err=>{

            }).finally(()=>{
                this.removeAttribute('disabled')
            })
        }
    })
    c.append(txt)
    c.append(sendb)
}

function unBook(a, user,c){
    tg.showConfirm(`Хочешь отменить запись на ${new Date(a.start_date).toLocaleTimeString().replace(/\:00/,'')}`,(e)=>{
        console.log(e)
        if(e){axios.delete(`/igrik/api/user/appointment?appointment=${a.appointment_id}&id=${userid}&token=${user.user_token}`).then(s=>{
            tg.showPopup({
                title: `Печально...`,
                message: `Запись отменили. Может быть, в другой раз?`
            })
            c.dataset.booked = 0
        })} else {
            console.log('нет, ибо ',e)
        }
    })
}

function book(a, user,c){
    tg.showConfirm(`Хочешь записаться на ${new Date(a.start_date).toLocaleTimeString().replace(/\:00/,'')}`,(e)=>{
        console.log(e)
        if(e) {
            axios.post(`/igrik/api/user/appointment?appointment=${a.appointment_id}&id=${userid}&token=${user.user_token}`,{a}).then(s=>{
            tg.showPopup({
                title: `Ура!`,
                message: `Все готово, приходи (я пришлю напоминание за пару часов до начала класса).\nСсылка на оплату придет следующим сообщением.`
            })
            
            c.dataset.booked = 1;
        })} else {
            console.log('нет, ибо ',e)
        }
    })
}


function updateUserAlerts(c,type){
    if(c == 'alerted'){
        axios.post(`/igrik/api/user/alerts`,{
            alerts:{[type]: true},
            id: userid
        })
        localStorage[`alerted_${type}`] = true
    }
}

let curOrder = {
    guests: 2,
    date: null
}

function showReserve(user){

    tg.MainButton.setParams({
        color:`#f0a1a8`
    })
    setTimeout(function () {
        tg.BackButton.show();
        tg.onEvent('backButtonClicked',showStart)
    }, 100)
    let popup = ce('div','popup','blink')
        document.body.append(popup)
    popup.append(ce('h2',false,false,'Когда хотите в бар?'))
    popup.append(ce('p',false,'info','Мы знаем, что всегда. Но нужно выбрать точное время.'))

    let d = ce('input',false, false,false,{
        type: 'datetime-local',
        value: new Date(+new Date()+4*60*60*1000).toISOString().slice(0,16),
        onchange:function(){
            if(this.value){
                tg.MainButton.enable()
                curOrder.date = this.value;
            } else {
                tg.MainButton.disable()
            }
        }
    })
    popup.append(ce('span',false,'info','Выбери время'))
    popup.append(d)
    popup.append(ce('span',false,'info','И количество гостей'))
    let g = ce('input',false,false,false,{
        type: 'number',
        value: 2
    })
    popup.append(g)
    tg.MainButton.disable()
    tg.MainButton.setText('ПРОВЕРИТЬ')
    tg.MainButton.show()
    tg.MainButton.onClick(sendOrder)


    // tg.MainButton.onClick(()=>sendfeebback(reservation,type,comment,before))
}


function setOrder(order, table){
    axios.post(`/igrik/api/tables`,{
        user:   userid,
        table:  table,
        guests: order.guests,
        date:   order.date
    }).then(s=>{
        tg.showAlert(`Отлично! Мы приняли резерв.\nПожалуйста, дай знать, если планы изменятся.`)
        
    }).catch(err=>{
        tg.showAlert(err.message)
    })
}


function sendOrder(){
    if(!curOrder.guests) return tg.showAlert('Вы пропустили количество гостей')
    if(!curOrder.date) return tg.showAlert('Вы упустили время')
    
    tg.MainButton.showProgress()
    console.log(curOrder)  
    
    axios.get(`/igrik/api/tables?guests=${curOrder.guests}&date=${curOrder.date}`).then(s=>{
        console.log(s.data)
        let tc = ce('div')
        tc.append(ce('span',false,'info','Выберите подходящий столик'))
        document.querySelector('#popup').append(tc)
        let bc = ce('div',false,'mtop')
        tc.append(bc)
        s.data.forEach(table=>{
            bc.append(ce('button',false,'table',table.name,{
                onclick:()=>setOrder(curOrder,table.id)
            }))
        })
        if(!s.data.length) tg.showAlert(`Простите великодушно, подходящих столиков нет...`)
        
    }).catch(err=>{
        tg.showAlert(err.response? err.response.data : err.message)
    }).finally(()=>{
        tg.MainButton.hide()
    })

}

function showMenu(user){
    setTimeout(function () {
        tg.BackButton.show();
        tg.onEvent('backButtonClicked',showStart)
    }, 100)

    let popup = ce('div','popup','blink')
        document.body.append(popup)
        popup.append(ce('h2',false,false,'Меню'))
    
    axios.get(`/igrik/api/menu?user=${user.id}`).then(menu=>{

        let order = [
            '02b6bed3-5f28-4454-ba47-c5cd2fc09bc2',
            '45964a5f-c4af-424d-81e7-cdb03e14e3bb',
            '2b9d15b4-14f8-4717-84af-b197323e4528',
            '255f8d72-b1f9-4156-bf48-610dba3c262e',
            '46805626-3931-4b9d-9531-668d59c2997c',
            '5b052295-f02e-4039-9a36-fa29108f3ad7',
            'ac0bd740-b39c-4f71-a1fc-249384adbbfb',
            'ced98598-faff-49d6-8399-764d768c3d4e',
            '75abb4e1-3212-4947-9d6f-eb884cbe5e9f',
        ]

        let breakfast = menu.data.groups.filter(g=>g.id == '02b6bed3-5f28-4454-ba47-c5cd2fc09bc2')[0];
        let wine = menu.data.groups.filter(g=>g.id == 'a6717224-4663-4eec-91db-6f2fb329b648')[0]
        
        if(wine){
            let bcontent = ce('div',false,['hidden','mleft'])
            popup.append(ce('h3',false,false,'ВИНО',{
                onclick:()=>{
                    bcontent.classList.toggle('hidden')
                }
            }))
            popup.append(bcontent)
            menu.data.groups.filter(g=>g.parentGroup == 'a6717224-4663-4eec-91db-6f2fb329b648').forEach(s=>{
                bcontent.append(drawSection(s,menu.data.products.filter(p=>p.parentGroup == s.id || menu.data.groups.filter(s=>s.parentGroup == s.id).map(s=>s.id).indexOf(p.parentGroup)>-1)))
            })
        }

        // if(breakfast){
        //     let bcontent = ce('div',false,['hidden','mleft'])
        //     popup.append(ce('h3',false,false,'ЗАВТРАКИ',{
        //         onclick:()=>{
        //             bcontent.classList.toggle('hidden')
        //         }
        //     }))
        //     popup.append(bcontent)
        //     menu.data.groups.filter(g=>g.parentGroup == '02b6bed3-5f28-4454-ba47-c5cd2fc09bc2').forEach(s=>{
        //         bcontent.append(drawSection(s,menu.data.products.filter(p=>p.parentGroup == s.id || menu.data.groups.filter(s=>s.parentGroup == s.id).map(s=>s.id).indexOf(p.parentGroup)>-1)))
        //     })
        // }

        order.forEach(id=>{
            let s = menu.data.groups.filter(g=>g.id == id)[0]    
            if(s) popup.append(drawSection(s,menu.data.products.filter(p=>p.parentGroup == s.id)))
        })

        // menu.data.groups
        //     .sort((a,b)=>a.order - b.order)
        //     .filter(s=>s.id != `a6717224-4663-4eec-91db-6f2fb329b648` && s.id != `7f660f89-1cd9-4184-b293-81ed7b14afe3` && s.parentGroup != 'a6717224-4663-4eec-91db-6f2fb329b648')
        //     .filter(s=>!s.isGroupModifier)
        //     .filter(s=>menu.data.products.filter(p=>p.parentGroup == s.id).length)
        //     .forEach(s=>{
        //         popup.append(drawSection(s,menu.data.products.filter(p=>p.parentGroup == s.id)))
        //     })
    })

}

function drawSection(section,dishes){
    let c = ce('div')
    c.append(ce('h3',false,false,section.name,{
        onclick:()=>{
            if(c.querySelectorAll('.dish').length) {
                c.querySelectorAll('.dish').forEach(d=>d.remove())
            } else {
                dishes.forEach(d=>{
                    c.append(drawDish(d))
                })
            }
        }
    }))
    return c
}

function drawDish(d){
    let c = ce('div',false,'dish')
    
    c.append(ce('span',false,'dishName',d.name))
    c.append(ce('span',false,'dishPrice',cur(d.sizePrices[0].price.currentPrice)))

    if(d.description) c.onclick = () => tg.showAlert(d.description)
    return c;
}

function showNews(user){

    setTimeout(function () {
        tg.BackButton.show();
        tg.onEvent('backButtonClicked',showStart)
    }, 100)

    let popup = ce('div','popup','blink')
        document.body.append(popup)
        popup.append(ce('h2',false,false,'Не пропустите!'))
    axios.get(`/igrik/api/news?user=${user.id}`).then(news=>{
        news.data.sort((a,b)=>b.createdAt._seconds-a.createdAt._seconds).forEach(pub=>{
            popup.append(drawNews(pub))
        })
    })
}

function drawNews(pub){
    let c = ce('div',false,'publication')
        c.append(ce('span',false,'info',new Date(pub.createdAt._seconds*1000).toLocaleString('ru-RU',{
            month:  'long',
            day:    'numeric',
            // hour:   '2-digit',
            // minute: '2-digit'
        })))
        c.append(ce('h3',false,false,pub.title,{
            onclick:()=>{
                drawPublication(pub,c,)

                c.append()
                
            }
        }))
    return c
}

function drawPublication(p,container){
    if(p.video){
        container.append(ce('video',false,false,false,{
            src: p.video,
            autoplay: true,
            loop: true,
            type: 'video/mp4',
            style: `width: 100%`
        }))    
    } 
    container.append(ce('p',false,false,p.text || null))

    axios.post(`/igrik/api/news/read`,{
        user: userid,
        publication: p.id
    })
}


function showService(service,date,user){

    if(typeof service == 'string'){
        if(document.querySelector('#popup')) document.querySelector('#popup').remove();

        setTimeout(function () {
            tg.BackButton.show();
            tg.onEvent('backButtonClicked',showStart)
        }, 100)

        axios.get(`/igrik/api/user/service?${date?`from=${date}&`:''}id=${service}&utoken=${user.user_token}`)
        .then(r=>{

            service = r.data[0].service;


            setTimeout(function () {
                tg.BackButton.show();
                tg.onEvent('backButtonClicked',showStart)
            }, 100)
            
            let popup = ce('div','popup')
    
            document.body.append(popup)
    
            popup.append(ce('h2',false,false,service.title))
    
            let descriptionContainer = ce('div',false,'descC')
    
            if(service.description){
                // console.log(service.description)
                descriptionContainer.innerHTML += service.description
                
    
                popup.append(descriptionContainer)
    
                popup.append(ce('p',false,'navlink','показать полностью',{
                    onclick:function(){
                        this.remove(),
                        descriptionContainer.dataset.open = true;
                    }
                }))

                r.data.filter(a=>new Date(a.start_date)>new Date()).forEach((a,i) => {
                    setTimeout(function(){
                        popup.append(drawAppointMent(a,user,a.already_booked,true))
                    },i*100)
                });
    
                if(!r.data.length){
                    popup.append(ce('p',false,false,`${(!date ||date == new Date().toISOString().split('T')[0]) ? 'Сегодня уже никуда не успеть.' : 'Извините, расписание еще не готово.'}\nНо мы готовы позвать на бокал вина!`))
                }
    
    
            }


            loader.remove()
            r.data.filter(a=>new Date(a.start_date)>new Date()).forEach((a,i) => {
                setTimeout(function(){
                    popup.append(drawAppointMent(a,user,a.already_booked,true))
                },i*100)
            });

            if(!r.data.length){
                popup.append(ce('p',false,false,`${(!date ||date == new Date().toISOString().split('T')[0]) ? 'Сегодня уже никуда не успеть.' : 'Извините, расписание еще не готово.'}\nНо мы готовы позвать на бокал вина!`))
            }
        })

    } else {
        if(document.querySelector('#popup')) document.querySelector('#popup').remove();

        setTimeout(function () {
            tg.BackButton.show();
            tg.onEvent('backButtonClicked',showStart)
        }, 100)
        
        let popup = ce('div','popup')

        document.body.append(popup)

        popup.append(ce('h2',false,false,service.title))

        let descriptionContainer = ce('div',false,'descC')

        if(service.description){
            // console.log(service.description)
            descriptionContainer.innerHTML += service.description
            

            popup.append(descriptionContainer)

            popup.append(ce('p',false,'navlink','показать полностью',{
                onclick:function(){
                    this.remove(),
                    descriptionContainer.dataset.open = true;
                }
            }))


        }

        let loader = ce('p',false,false,'Расписание загружается...')

        popup.append(loader)

        axios.get(`/igrik/api/user/service?${date?`from=${date}&`:''}id=${service.id}&utoken=${user.user_token}`)
        .then(r=>{
            loader.remove()
            r.data.filter(a=>new Date(a.start_date)>new Date()).forEach((a,i) => {
                setTimeout(function(){
                    popup.append(drawAppointMent(a,user,a.already_booked,true))
                },i*100)
            });

            if(!r.data.length){
                popup.append(ce('p',false,false,`${(!date ||date == new Date().toISOString().split('T')[0]) ? 'Сегодня уже никуда не успеть.' : 'Извините, расписание еще не готово.'}\nНо мы готовы позвать на бокал вина!`))
            }
        })
    }


    

}

function showContacts(user){
    let popup = ce('div','popup')

        document.body.append(popup)

        setTimeout(function () {
            tg.BackButton.show();
            tg.onEvent('backButtonClicked',showStart)
        }, 100)
        
        // popup.append(ce('h2',false,false,'Об основателях'))
        // popup.append(ce('p',false,false,'Основатели “Игрика” — Наталья Тот и Кристина Галда. Близкие по жизненным принципам, приоритетам и вайбу, они познакомились в йога-туре: “Вечером мы сидели в поле, выпивали вино и решили, что жить так нужно всегда. Жить в кайф”. Так появилась философия “Игрика”. Без опыта в ресторанной сфере, девушки решились самостоятельно создать это пространство.'))
        // popup.append(ce('h2',false,false,'О винной йоге'))
        // popup.append(ce('p',false,false,'Винную йогу в США практикуют с 2017 года. Как направление её запустила фитнес-инструктор Эли Уокер. Каждое занятие длится 90 минут, разделенных на три части: бокал перед уроком, знакомство группы, затем мягкая разминка, асаны на баланс и легкая растяжка, а затем – совместное расслабление за вином. Инструкторы планируют занятие так, чтобы оно было максимально безопасным, спокойным. Это не “пьяная йога”, а расслабляющее общение.'))
        // popup.append(ce('p',false,false,'БОНУС! Для тех, кто не пьет, есть утренняя йога-сессия с кофе по тому же принципу.'))
        popup.append(ce('p',false,false,'Адрес: ул. Пионерская, 2'))
        popup.append(ce('p',false,false,'Телефон: +79111149898'))
        popup.append(ce('p',false,false,'График работы бара: 10:00 — 23:00'))
        popup.append(ce('p',false,false,'График работы зала: 9:00 — 23:00'))
        popup.append(ce('a',false,'b','Будем рады твоему отзыву на Яндексе.',{
            onclick:()=>{
                tg.openLink('https://yandex.com.ge/maps/org/igrik/93388573461/?ll=30.296482%2C59.955016&z=17')
            }
        }))
        
        
}

function showMasters(user){
    
    tg.BackButton.offClick(showMasters)

    if(document.querySelector(`#popup`)) document.querySelector(`#popup`).classList.add('blink')

    axios.get(`/igrik/api/masters/`)
        .then(r=>{
            try{
                document.querySelector(`#popup`).remove()
            }catch(err){
                console.log(err)
            }
            console.log(r.data)
            setTimeout(function () {
                tg.BackButton.show();
                tg.onEvent('backButtonClicked',showStart)
            }, 100)

            let popup = ce('div','popup')

            document.body.append(popup)

            r.data.data.forEach(m=>{
                console.log(m)
                popup.append(drawMaster(m))
            })
        })
        .catch(err=>{
            console.log(err)
        })
}

function drawMaster(m){
    let c = ce('div',false,'master')
        c.append(ce('h3',false,false,m.name))
        c.append(ce('span',false,'cred',mastersDesc[m.id] || m.position.title))
        c.onclick = () => {
            tg.BackButton.offClick(showStart)
            tg.onEvent('backButtonClicked',showMasters)

            let p = document.querySelector(`#popup`)
            
            p.classList.add('blink')

            axios.get(`/igrik/api/masters/${m.id}`).then(d=>{
                console.log(d.data)
                
                p.innerHTML = '';

                let c = ce('div',false,'master')

                p.append(c)

                c.append(ce('h3',false,false,m.name))
                c.append(ce('span',false,'cred',m.position.title))
                c.append(ce('p',false,false,d.data.data.description))
                
                p.classList.remove('blink')
            })
        }

        return c
}

function showSchedule(user,filtered,date){
    
    if(document.querySelector(`#popup`)) document.querySelector(`#popup`).classList.add('blink')

    if((!user.alerts || user.alerts.schedule)&& !localStorage[`alerted_schedule`]) tg.showPopup({
        title: `Давай познакомимся`,
        message: `Вот расписание классов. Можешь посмотреть любую дату — и записаться. Просто нажимай на иконку справа от названия.\n После записи она станет розовой.\nЕсли иконки нет — значит и мест нет, увы...`,
        buttons:[{
            text:   'Понятно',
            type:   'ok',
            id:     'alerted'
        },{
            text:   'Напомнить позже',
            type:   'destructive',
            id:     'nonalerted'
        }]
    },function(cv){updateUserAlerts(cv,'schedule')})

    if(!filtered){
        axios.get(`/igrik/api/user/schedule?${date?`from=${date}&`:''}id=${userid}&utoken=${user.user_token}`)
        .then(r=>{
            try{
                document.querySelector(`#popup`).remove()
            }catch(err){
                console.log(err)
            }
            console.log(r.data)
            setTimeout(function () {
                tg.BackButton.show();
                tg.onEvent('backButtonClicked',showStart)
            }, 100)
            let popup = ce('div','popup')
            
            let top = ce('div',false,'flex')

            top.append(ce('h2',false,false,'Расписание'))

            top.append(ce('input',false,'fr',false,{
                type: 'date',
                min: new Date().toISOString().split('T')[0],
                onchange:function(){showSchedule(user, filtered, this.value)},
                value: new Date(date||+new Date()).toISOString().split('T')[0]
            }))

            popup.append(top)

            r.data.filter(a=>new Date(a.start_date)>new Date()).forEach((a,i) => {
                setTimeout(function(){
                    popup.append(drawAppointMent(a,user,a.already_booked))
                },i*100)
            });

            if(!r.data.length){
                popup.append(ce('p',false,false,`${(!date ||date == new Date().toISOString().split('T')[0]) ? 'Сегодня уже никуда не успеть.' : 'Извините, расписание еще не готово.'}\nНо мы готовы позвать на бокал вина!`))
            } else {
                setTimeout(function(){
                    let tomorrow = ce('p',false,'navlink',`А может, завтра?..`,{
                        onclick:()=> {
                            showSchedule(user,filtered,new Date(+new Date(date||+new Date())+24*60*60*1000).toISOString().split('T')[0])
                            window.scrollTo({
                                top: 0,
                                behavior: 'smooth'
                            })
                        }
                    })
                    popup.append(tomorrow)
                },r.data.length*100+100)
                
            }

            document.body.append(popup)
            
        })
        .catch(err=>{
            tg.showAlert(err.response? err.response.data : err.message)
        })
    } else {
        axios.get(`/igrik/api/user/schedule?filtered=true&id=${userid}&utoken=${user.user_token}`)
        .then(r=>{
            try{
                document.querySelector(`#popup`).remove()
            }catch(err){
                console.log(err)
            }
            console.log(r.data)
            setTimeout(function () {
                tg.BackButton.show();
                tg.onEvent('backButtonClicked',showStart)
            }, 100)
            let popup = ce('div','popup')
            
            let top = ce('div',false,'flex')

            top.append(ce('h2',false,false,'Мои классы'))

            // top.append(ce('input',false,'fr',false,{
            //     type: 'date',
            //     onchange:function(){showSchedule(user, filtered, this.value)},
            //     value: new Date(date||+new Date()).toISOString().split('T')[0]
            // }))

            popup.append(top)
            r.data.filter(a=>a.arrival_status !== 'canceled').forEach((a,i) => {
                setTimeout(function(){
                    popup.append(drawAppointMent(a,user,true))
                },i*100)
            });
            if(!r.data.filter(a=>a.arrival_status !== 'canceled').length){
                let disc= ce('p',false,false,`Ты еще не записалась на занятия, а лучшее время сделать это — сейчас.\nПосмотри <a href="#">общее расписание</a>, там много кайфового.`,{
                    onclick:()=>showSchedule(user)
                })
                popup.append(disc)
            }

            document.body.append(popup)
            
        })
        .catch(err=>{
            tg.showAlert(err.response? err.response.data : err.message)
        })
    }

    
}
