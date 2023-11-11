
let tg = window.Telegram.WebApp;
let userid = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : userId
let mbbc, mcb = null;
let host = `paper`
let appLink = `https://t.me/paperstuffbot/app`

axios.get(`/${host}/admin/check?id=${userid}`).then(s=>{
    loader.classList.remove('active')
    setTimeout(()=>{
        loader.remove()
        showStart()
    },300)
}).catch(err=>{
    console.log(err.data)
    tg.showAlert(err.data || `Простите, но вам сюда нельзя`)
})


function showAuthors(){
    showLoader();
    axios.get(`/${host}/admin/authors?id=${userid}`)
    .then(data=>{
        let p = preparePopup()
        p.append(ce('h3',false,'light','Постоянные авторы'))
        
        data.data.forEach(record => {
            p.append(drawAuthor(record))
        });

        p.append(ce('button',false,'dateButton','Добавить автора',{
            onclick:function(){
                
                p.innerHTML = '';
                
                p.append(ce('h3',false,'light','Барт, ты не прав!'))

                let name = ce('input',false,false,false,{
                    placeholder: `Имя героя`,
                    type: 'text',
                    onchange:()=>{
                        sendButton.removeAttribute('disabled')
                    }
                })

                let txt = ce('textarea',false,false,false,{
                    placeholder: `Описание`,
                    onchange:()=>{
                        sendButton.removeAttribute('disabled')
                    }
                })

                let pic = ce('input',false,false,false,{
                    placeholder: `ссылка на фото`,
                    type: 'text'
                })

                
                
                let sendButton = ce('button',false,'dateButton','Сохранить',{
                    disabled: true,
                    onclick:function(){
                        if(txt.value){
                            let sure = confirm('Уверены?')
                            if(sure){
                                this.setAttribute('disabled',true)
                                this.innerHTML = 'Отправляем...'

                                axios.post(`/${host}/admin/authors?id=${userid}`,{
                                    text:   txt.value,
                                    name:   name.value,
                                    pic:    pic.value || null
                                })
                                .then(s=>{
                                    txt.value = null
                                    name.value = null
                                    tg.showAlert(`${s.data.comment}`)
                                })
                                .catch(handleError)
                                .finally(()=>{
                                    this.removeAttribute('disabled')
                                    this.innerHTML = 'Отправить'
                                })
                            }
                        }
                    }
                })
                
                p.append(name)
                p.append(txt)
                p.append(pic)
                p.append(sendButton)

        
            }
        }))
    })
    .catch(handleError)
    .finally(()=>{
        hideLoader()
    })
}



function clearPopUp(){
    let p = document.querySelector('#popup')
    p.classList.add('sb')
    setTimeout(function(){
        p.remove()
        tg.BackButton.hide()
        
    },500)
    if(mcb){
        tg.MainButton.offClick(mcb)
        mcb = null;
        tg.MainButton.hide()
    }

    if(mbbc){
        tg.MainButton.hide()
        tg.MainButton.offClick(mbbc)
        mbbc = null
    }
}

function cur(v,cur) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        currency: cur || 'RUB',
    }).format(Number(v||0));
}

function uname(u,id){
    return `${u.admin? `админ` : (u.insider ? 'сотрудник' : (u.fellow ? 'fellow' : (u.known ? 'гость' : 'пионер')))} ${u.username ? `@${u.username}` : `id ${id}` } (${u.first_name||''} ${u.last_name||''})`
}



function checkQR(data){
    
    tg.closeScanQrPopup()

    let inc = data.data.split('_')
    
    if(inc[1] != 'userClasses' && inc[1] != 'wineList' && inc[1] != 'coworking' && inc[1] != 'promos'  && inc[1] != 'planRequests'){
        return tg.showAlert(`Я так не играю. Это не коворкинг, не входной билет и не вино! ${inc[1]}`)
    }

    showLoader()

    axios.get(`/${host}/admin/qr?id=${userid}&data=${data.data}`)
        .then(r=>{
            let alert = r.data.alert;
            r = r.data.data;

            let p = preparePopup()
                if(inc[1] == 'userClasses'){

                    if(alert){
                        tg.showAlert(alert)
                    }

                    if(r.comment){
                        tg.showAlert(r.comment)
                    }

                    p.append(ce('h2',false,'light','Данные билета'))
                    p.append(ce('h3',false,'light',r.className))
                    p.append(ce('p',false,false,`Дата: ${r.date}`))
                    p.append(ce('p',false,false,`Место: ${r.hall}`))
                    p.append(ce('p',false,false,`Гость: ${r.userName}`))
                    
                    if(!r.active){
                        p.append(ce('p',false,'error',`Билет заблокирован`))
                    }
                    if(!r.isPayed){
                        p.append(ce('p',false,'error',`Билет не оплачен`))
                    }

                    if(r.status == 'used'){
                        p.append(ce('p',false,'error',`Билет уже использован!!!`))
                    } else {
                        p.append(ce('button',false,'dateButton','Использовать',{
                            onclick:function(){
                                showLoader();
                                axios.post(`/${host}/admin/qr?id=${userid}&data=${data.data}`)
                                    .then(r=>{
                                        tg.showAlert(`OK!`)
                                        
                                        this.remove()
                                    })
                                    .catch(handleError)
                                    .finally(hideLoader)
                            }
                        }))
                    }

                    p.append(ce(`button`,false,'dateButton',`Следующий`,{
                        onclick:()=>tryQR()
                    }))

                    
                      
                } else if(inc[1] == 'coworking') {
                    if(alert){
                        tg.showAlert(alert)
                    }

                    if(r.comment){
                        tg.showAlert(r.comment)
                    }

                    p.append(ce('h2',false,'light','Запись в коворкинг'))
                    p.append(ce('p',false,false,`Дата: ${r.date}`))
                    p.append(ce('p',false,false,`Место: ${r.hall.name}`))
                    p.append(ce('p',false,false,`Гость: ${uname(r.user,r.user.id)}`))
                    
                    if(!r.active){
                        p.append(ce('p',false,'error',`Запись отменена!!!`))
                    }
                    if(r.paymentNeeded && !r.isPayed){
                        p.append(ce('p',false,'error',`Запись не оплачена. ${r.user.deposit ? `На депозите у клиента ${cur(r.user.deposit,'GEL')}` : `Депозита нет.`}`))
                    }

                    if(r.status == 'used'){
                        p.append(ce('p',false,'error',`Запись уже использована!!!`))
                    } else {
                        p.append(ce('button',false,'dateButton','Использовать',{
                            onclick:function(){
                                showLoader();
                                axios.post(`/${host}/admin/qr?id=${userid}&data=${data.data}`)
                                    .then(r=>{
                                        tg.showAlert(r.data.alert)
                                        this.remove()
                                    })
                                    .catch(handleError)
                                    .finally(hideLoader)
                            }
                        }))
                    }  

                } else if(inc[1] == 'promos') {
                    

                    p.append(ce('h2',false,'light',`Промо ${r.name}`))
                    p.append(ce('h3',false,'light',`Осталось ${r.left} бокалов`))

                    p.append(ce(`p`,false,false,r.description))

                    if(r.left){
                        p.append(ce('button',false,'dateButton','Налить стаканчик',{
                            onclick:function(){
                                showLoader();
                                axios.post(`/${host}/admin/qr?id=${userid}&data=${data.data}`)
                                    .then(()=>{
                                        tg.showAlert(`OK!`)
                                        this.remove()
                                    })
                                    .catch(handleError)
                                    .finally(hideLoader)
                            }
                        }))
                    } else {
                        p.append(ce('p',false,false,`Тут наливать уже нечего.\nПойдем покурим, что ли`))
                    } 

                } else if(inc[1] == 'planRequests') {
                    

                    p.append(ce('h2',false,'light',`Покупка тарифа ${r.plan.name}`))

                    p.append(ce('p',false,false,uname(r.user,r.user.id)))

                    p.append(ce(`p`,false,false,`Стоимость: ${cur(r.plan.price,`GEL`)}.`))

                    if(r.user.deposit){
                        p.append(`С депозита гостя будет списано ${cur(r.user.deposit,'GEL')}.`)
                    }

                    p.append(ce('button',false,'dateButton','Активировать тариф',{
                        onclick:function(){
                            showLoader();
                            axios.post(`/${host}/admin/qr?id=${userid}&data=${data.data}`)
                                .then(()=>{
                                    tg.showAlert(`OK!`)
                                    this.remove()
                                })
                                .catch(handleError)
                                .finally(hideLoader)
                        }
                    }))

                } else {
                    p.append(ce('h2',false,`light`,'Подписка на вино!'))
                    p.append(ce('h3',false,`light`,`Осталось ${r.left} бокалов`))
                    if(r.left){
                        p.append(ce('button',false,'dateButton','Налить стаканчик',{
                            onclick:function(){
                                showLoader();
                                axios.post(`/${host}/admin/qr?id=${userid}&data=${data.data}`)
                                    .then(()=>{
                                        tg.showAlert(`OK!`)
                                        this.remove()
                                    })
                                    .catch(handleError)
                                    .finally(hideLoader)
                            }
                        }))
                    } else {
                        p.append(ce('p',false,false,`Тут наливать уже нечего.\nПойдем покурим, что ли`))
                    }
                }
                

        })
        .catch(handleError)
        .finally(hideLoader)
}

function tryQR(){
    tg.showScanQrPopup({
        text: `Наведите камеру на QR-код гостя`
    })
    tg.onEvent(`qrTextReceived`,checkQR)
}


function showStart(){
    let b = document.body;
    

    b.append(ce('h2',false,false,`Проверить код`,{
        onclick:()=>tryQR()
    }))


    b.append(ce('h2',false,false,`Пользователи`,{
        onclick:()=>showUsers()
    }))

    b.append(ce('h2',false,false,`Мероприятия`,{
        onclick:()=>showClasses()
    }))

    b.append(ce('h2',false,false,`Авторы`,{
        onclick:()=>showAuthors()
    }))

    b.append(ce('h2',false,false,`Что нового`,{
        onclick:()=>showLogs()
    }))

    b.append(ce('h2',false,false,`Рассылки`,{
        onclick:()=>showNews()
    }))

    b.append(ce('h2',false,false,`Подписки`,{
        onclick:()=>showPlans()
    }))

    
}


function drawUserLine(type,line){
    let c = ce('div', false, 'divided',false,{
        dataset:{
            id: line.id
        }
    })

        c.append(ce('span',false,'info',new Date(line.createdAt._seconds*1000).toLocaleString()))
    switch(type){
        case 'messages':{
            c.append(ce('p',false,false,line.text))
            break;
        }
        case 'subscriptions':{
            if(line.course){
                c.append(ce('p',false,false,`Подписка на курс ${line.course}`))
            }
            if(line.author){
                c.append(ce('p',false,false,`Подписка на лектора ${line.author}`))   
            }
            break;
        }
        case 'lections':{
            c.dataset.active = line.active;
            c.append(ce('p',false,false,line.className))
            break;
        }
        default:{
            c.append(ce('p',false,false,JSON.stringify(line,null,2)))
        }
    }
    return c
}


function showUserData(type,container,user){
    showLoader()
    axios.get(`/${host}/admin/user?id=${userid}&data=${type}&user=${user}`)
    .then(data=>{
        if(container.querySelector('#details')){
            container.querySelector('#details').remove()
        }
        let details = ce('div','details')
        container.append(details)
        data.data.forEach(line=>{
            details.append(drawUserLine(type, line))
        })
    })
    .catch(handleError)
    .finally(hideLoader)
}


function drawDate(d,l,o){
    let options = {
        weekday: 'short',
        month: 'short',
        day:'2-digit',
        timeZone: 'Asia/Tbilisi'
    }
    if(!o) o = {}
    if(o.time){
        options.hour= '2-digit',
        options.minute= '2-digit'
    }
    if(o.year) options.year = '2-digit'
    
    return new Date(d).toLocaleDateString(`${l||'ru'}-RU`,options)
}


function drawClass(l){
    let c = ce('div',false,'divided')
    
    c.append(ce('h3',false,'light',l.name))

    c.append(copyLink(`class_${l.id}`,appLink, `скопировать ссылку`))

    let details = ce('div',false,'hidden')

    details.append(ce('span',false,'info', new Date(l.date).toLocaleString('ru-RU',{
        timeZone: 'Asia/Tbilisi'
    })))
    
    details.append(ce('p',false,'story',l.description || 'без короткой подписи'))
    
    let questions = ce('p',false,false,'загружаю вопросы...')
        details.append(questions)

    let guests = ce('p',false,false,'загружаю гостей...')
        details.append(guests)

    c.append(details)

    
    

    c.append(ce('button',false,'dateButton','подробнее',{
        onclick:function(){

            axios.get(`/${host}/admin/q?id=${userid}&class=${l.id}`).then(res=>{
                questions.innerHTML = res.data.length ? `<h4 class="light">Вопросы гостей</h4>` : `<h4 class="light">Вопросов нет</h4>`;
                res.data.forEach(q=>{
                    let c = ce('div',false,false,false,{
                        dataset:{
                            active: q.active
                        }
                    })
                    c.append(ce(`p`,false,false,``))
                    c.append(ce(`span`,false,'info',drawDate(q.createdAt._seconds,false,{time:true})))
                    c.append(ce('p',false,false,uname(q.userData,q.userData.id)))
                    c.append(ce('p',false,'story',q.text))

                    if(q.active) c.append(ce('button',false,'dateButton',`Снять вопрос`,{
                        onclick:function(){
                            this.setAttribute('disabled',true)
                            axios.delete(`/${host}/api/q/${q.id}?by=${userid}`)
                                .then(()=>{
                                    this.remove()
                                    c.dataset.active = false;
                                }).catch(err=>{
                                    tg.showAlert(err.message)
                                })
                        }
                    }))
                    questions.append(c)
                })
            })

            details.classList.remove('hidden')
            
            this.remove()

            axios.get(`/${host}/admin/class?id=${userid}&class=${l.id}`)
                .then(data=>{

                    let rating = data.data.filter(t=>t.rate).map(t=>t.rate)
                    
                    if(rating.length){

                        let av = (rating.reduce((a,b)=>a+b,0)/rating.length).toFixed(2)

                        details.prepend(ce('h4',false,'light',`Рейтинг ${av} (${rating.length} голосов)`))
                    }

                    guests.innerHTML = `Гостей: ${data.data.length}${l.price ? ` // оплачено ${data.data.filter(g=>g.isPayed).length}` : ''}${` // пришли ${data.data.filter(g=>g.status == 'used').length}`}`
                    guests.onclick=function(){
                        if(!this.dataset.open){
                            this.dataset.open = true;
                            this.innerHTML+=`<table><tr><th>Имя</th><th>💲</th><th>📍</th></tr>
                                ${data.data.map(u=>`<tr class="story">
                                    <td>${u.userName}</td>
                                    <td>${l.price ? (u.isPayed?'✔️':'❌') : '🚫'}</td>
                                    <td>${(u.status == 'used'? '✔️' : '❌')}</td>
                                </tr>`).join('')}</table>`
                        }
                        
                    }
                    // tg.showAlert(data.data.map(u=>u.userName).join('\n'))
                })
                .catch(handleError)
        }
    }))

    if(!l.feedBackSent){
        c.append(ce('button',false,'dateButton',`Отправить запрос на отзыв`,{
            onclick:function(){
                this.setAttribute('disabled',true)
                axios.get(`/${host}/`)
            }
        }))
    }
    
    return c
}

function showClasses(){
    showLoader()
    axios.get(`/${host}/admin/classes/?id=${userid}`)
    .then(data=>{
        let p = preparePopup()
        p.append(ce('h2',false,'light','Занятия'))
        data.data.forEach(record => {
            p.append(drawClass(record))
        })
    })
    .catch(handleError)
    .finally(hideLoader)
}


function filterUsers(role,container,button){
    let c = button.parentNode;
    c.querySelectorAll('button').forEach(b=>b.classList.remove('active'))
    c.querySelectorAll('button').forEach(b=>b.classList.add('passive'))
    button.classList.add('active')
    button.classList.remove('passive')
    container.querySelectorAll('.divided').forEach(user=>{
        if(!role) return user.classList.remove('hidden')
        
        if(user.dataset[role] == 'true') {
            user.classList.remove('hidden')
        } else {
            user.classList.add('hidden')
        }
    })

    
}

function showUsers(){
    showLoader();
    axios.get(`/${host}/admin/users?id=${userid}`)
    .then(data=>{
        let p = preparePopup()
        p.append(ce('h3',false,'light',`Пользователи (${data.data.users.length} шт.)`))
        

        let cc = ce('div')
        
        p.append(cc)

        cc.append(ce('button',false,'active','все',{
            onclick: function(){
                filterUsers(false,p,this)
            }
        }))

        cc.append(ce('button',false,'passive','только админы',{
            onclick: function(){
                filterUsers('admin',p,this)
            }
        }))

        cc.append(ce('button',false,'passive','только сотрудники',{
            onclick: function(){
                filterUsers('insider',p,this)
            }
        }))

        cc.append(ce('button',false,'passive','только fellow',{
            onclick: function(){
                filterUsers('fellow',p,this)
            }
        }))

        p.append(ce('input',false,false,false,{
            placeholder: `поиск по имени`,
            oninput:function(){
                if(!this.value){
                    p.querySelectorAll('.divided').forEach(u=>u.classList.remove('hidden'))
                } else {
                    p.querySelectorAll('.divided').forEach(u=>{
                        if(u.innerHTML.indexOf(this.value)>-1){
                            u.classList.remove('hidden')
                        } else {
                            u.classList.add('hidden')
                        }
                    })
                }
            }
        }))

        data.data.users.forEach(record => {

            let plan = data.data.plans.filter(f=>f.user == record.id).sort((a,b)=>{
                return b.createdAt._seconds - a.createdAt._seconds
            })

            let c = ce('div',false,'divided',false,{
                dataset:{
                    active:     record.active,
                    id:         record.id,
                    admin:      record.admin || null,
                    insider:    record.insider || null,
                    fellow:     record.fellow || null
                }
            })

            c.append(ce('span',false,'info',`${new Date(record.createdAt._seconds*1000).toLocaleString()}, (${record.language_code})${record.admin?`, админ`: (record.insider?', сотрудник':'')}`,{
                dataset:{
                    ctx: `регистрация: `
                }
            }))

            if(plan.length) {
                plan.forEach(plan=>{
                    c.append(ce('span',false,['info','block'],`Подписка «${plan.name}» до ${new Date(plan.to._seconds*1000).toLocaleDateString()}`))
                })
            } 
            

            c.append(ce('p',false,false,`${record.username ? `@${record.username}` : 'Без ника'} // ${record.first_name || 'Без имени'} ${record.last_name || 'Без фамилии'}`))
            
            let controls = ce('div',false,'hidden')
            c.append(ce('button',false,'dateButton','подробнее',{
                onclick:function(){
                    this.remove()
                    controls.classList.remove(`hidden`)
                }
            }))

            c.append(controls)

            controls.append(ce('button',false,'dateButton','Переписка',{
                onclick:()=>{
                    showUserData('messages',c,record.id)
                }
            }))
            // controls.append(ce('button',false,'dateButton','Подписки',{
            //     onclick:()=>{
            //         showUserData('subscriptions',c,record.id)
            //     }
            // }))
            controls.append(ce('button',false,'dateButton','Лекции',{
                onclick:()=>{
                    showUserData('lections',c,record.id)
                }
            }))

            controls.append(ce('button',false,'dateButton','Налить вина',{
                onclick:function(){
                    let sure = confirm('Вы уверены?')
                    if(sure){
                        axios.post(`/${host}/pourMeWine?id=${userid}`,{
                            glasses: 5,
                            user: record.id
                        }).then(()=>{
                            tg.showAlert(`Сделано!\nГость получит сообщение с qr-кодом.`)
                        }).catch(handleError)
                    }
                }
            }))

            if(!record.admin) {
                controls.append(ce('button',false,'dateButton','Сделать админом',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/${host}/admin/users?id=${userid}`,{
                                field: 'admin',
                                value: true,
                                user: record.id
                            }).then(()=>{
                                tg.showAlert(`Сделано!\nЧтобы увидеть обновление, перезагрузите окно.`)
                            }).catch(handleError)
                        }
                    }
                }))
            } else {
                controls.append(ce('button',false,'dateButton','Снять админские права',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/${host}/admin/users?id=${userid}`,{
                                field: 'admin',
                                value: false,
                                user: record.id
                            }).then(()=>{
                                tg.showAlert(`Сделано!\nЧтобы увидеть обновление, перезагрузите окно.`)
                            }).catch(handleError)
                        }
                    }
                }))
            }

            if(!record.fellow) {
                controls.append(ce('button',false,'dateButton','Сделать fellow',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/${host}/admin/users?id=${userid}`,{
                                field: 'fellow',
                                value: true,
                                user: record.id
                            }).then(()=>{
                                tg.showAlert(`Сделано!\nЧтобы увидеть обновление, перезагрузите окно.`)
                            }).catch(handleError)
                        }
                    }
                }))
            } else {
                controls.append(ce('button',false,'dateButton','Снять права fellow',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/${host}/admin/users?id=${userid}`,{
                                field: 'fellow',
                                value: false,
                                user: record.id
                            }).then(()=>{
                                tg.showAlert(`Сделано!\nЧтобы увидеть обновление, перезагрузите окно.`)
                            }).catch(handleError)
                        }
                    }
                }))
            }

            if(!record.insider) {
                controls.append(ce('button',false,'dateButton','Сделать сотрудником',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/${host}/admin/users?id=${userid}`,{
                                field: 'insider',
                                value: true,
                                user: record.id
                            }).then(()=>{
                                tg.showAlert(`Сделано!\nЧтобы увидеть обновление, перезагрузите окно.`)
                            }).catch(handleError)
                        }
                    }
                }))
            } else {
                controls.append(ce('button',false,'dateButton','Снять права сотрудника',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/${host}/admin/users?id=${userid}`,{
                                field: 'insider',
                                value: false,
                                user: record.id
                            }).then(()=>{
                                tg.showAlert(`Сделано!\nЧтобы увидеть обновление, перезагрузите окно.`)
                            }).catch(handleError)
                        }
                    }
                }))
            }

            if(!record.blocked) {
                controls.append(ce('button',false,'dateButton','Заблокировать',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/${host}/admin/users?id=${userid}`,{
                                field: 'blocked',
                                value: true,
                                user: record.id
                            }).then(()=>{
                                tg.showAlert(`Сделано!\nЧтобы увидеть обновление, перезагрузите окно.`)
                            }).catch(handleError)
                        }
                    }
                }))
            } else {
                controls.append(ce('button',false,'dateButton','Снять бан',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/${host}/admin/users?id=${userid}`,{
                                field: 'blocked',
                                value: false,
                                user: record.id
                            }).then(()=>{
                                tg.showAlert(`Сделано!\nЧтобы увидеть обновление, перезагрузите окно.`)
                            }).catch(handleError)
                        }
                    }
                }))
            }


            let subc = ce('div',false,'hidden')
                data.data.plansA.forEach(plan=>{
                    subc.append(ce('button',false,'dateButton',`${plan.name} ${cur(plan.price,'GEL')}`,{
                        onclick:function(){
                            let s = confirm(`Выдаем подписку ${plan.name}, уверены?`)
                            if(s){
                                this.setAttribute(`disabled`,true)
                                axios.post(`/${host}/admin/subscribe?id=${userid}`,{
                                    user: record.id,
                                    plan: plan.id
                                }).then(s=>{
                                    tg.showAlert(s.data)
                                }).catch(err=>{
                                    tg.showAlert(err.data || err.message)
                                })
                            }
                        }
                    }))
                })
            controls.append(subc)
            controls.append(ce('button',false,'dateButton',`Выдать план`,{
                onclick:()=>{
                    subc.classList.toggle(`hidden`)
                }
            }))

            
                
            p.append(c)
        });
    })
    .catch(handleError)
    .finally(()=>{
        hideLoader()
    })
}

function drawNews(n){
    let c = ce('div',false,'divided')
        c.append(ce('span',false,'info',new Date(n.createdAt._seconds*1000).toLocaleString()))    
        
        c.append(ce('h4',false,'light',n.name))

        let details = ce('div',false,'hidden')

        let recieved = ce('span',false,'info', n.recieved, {
            dataset:{
                ctx: 'получателей: '
            }
        })

        details.append(recieved)

        details.append(ce('p',false,false,n.text))

        c.append(details)

        c.append(ce('button',false,'dateButton','Подробнее',{
            onclick:function(){
                details.classList.remove('hidden')
                this.remove()
                // axios.get(`/${host}/admin/news?id=${userid}&item=${n.id}`)
                //     .then(d=>{
                //         recieved.innerHTML = d.data.recieved;
                //     })
                //     .catch(err=>{
                //         tg.showAlert(`упс!\n${err.message}`)
                //     })
            }
        }))


        return c


}

function showPlans(){
    showLoader();
    axios.get(`/${host}/api/plans?id=${userid}`)
    .then(data=>{
        let p = preparePopup()
        p.append(ce('h3',false,'light','Подписки'))
        p.append(ce('button',false,'dateButton','Создать подписку',{
            onclick:()=>{
                let p = preparePopup()
                let name = ce('input',false,false,false,{
                    placeholder: `Название плана`
                })
                let description = ce('textarea',false,false,false,{
                    placeholder: `Описание`
                })
                let price = ce('input',false,false,false,{
                    placeholder: `стоимость`,
                    type: `number`
                })
                let visits = ce('input',false,false,false,{
                    placeholder: `посещений`,
                    type: `number`
                })
                let events = ce('input',false,false,false,{
                    placeholder: `мероприятий`,
                    type: `number`
                })

                let submit = ce('button',false,'dateButton',`Сохранить`,{
                    onclick:function(){
                        let pass = true;
                        [name,description,price,visits,events].forEach(i=>{
                            if(!i.value){
                                tg.showAlert(`Вы пропустили ${i.placeholder}`)
                                pass = false;
                            }
                        })

                        if(pass){
                            
                            this.setAttribute('disabled',true)

                            axios.post(`/${host}/api/plans/new?id=${userid}`,{
                                name:           name.value,
                                description:    description.value,
                                price:          price.value,
                                visits:         visits.value,
                                events:         events.value
                            }).then(s=>{
                                tg.showAlert(`План создан!`)
                            }).catch(err=>{
                                tg.showAlert(err.message)
                            }).finally(()=>{
                                this.removeAttribute('disabled')
                            })
                        }
                    }
                })

                p.append(name);
                p.append(description);
                p.append(price);
                p.append(visits);
                p.append(events);
                
                p.append(submit);
            }
        }))
        data.data.forEach(plan=>{
            p.append(drawPlan(plan))
        })
    })
}

function drawPlan(p){
    let c = ce('div',false,'divided',false,{
        dataset:{
            active: p.active
        }
    })
    c.append(ce('span',false,'info', new Date(p.createdAt._seconds*1000).toLocaleString()))
    c.append(ce('h4',false,['light','mtop20'],`${p.name} (${cur(p.price,`GEL`)})`))
    c.append(ce('p',false,'story', p.description))
    let footer = ce('div', false, 'flex')
        footer.append(ce(`span`,false,'info',`посещений: ${p.visits}`))
        footer.append(ce(`span`,false,'info',`билетов: ${p.events}`))
    c.append(footer)
    c.append(ce('button',false,'dateButton',p.active?`Архивировать`:'Акивировать',{
        onclick:function(){togglePlanActive(p.active)}
    }))
    
    return c;
}

function showNews(){
    showLoader();
    axios.get(`/${host}/admin/news?id=${userid}`)
    .then(data=>{
        let p = preparePopup()
        p.append(ce('h3',false,'light','История рассылок'))
        p.append(ce('button',false,'dateButton','Создать рассылку',{
            onclick:function(){
                
                p.innerHTML = '';
                
                p.append(ce('h3',false,'light','Печкин слушает!'))

                let silent = ce('input',false,false,false,{
                    type: 'checkbox'
                })

                let slabel = ce('label',false,false,'Бесшумное сообщение')

                slabel.append(silent)

                p.append(slabel)

                let filter = ce('select')

                filter.append(ce('option',false,false,'Всем',{
                    value: ''
                }))
                filter.append(ce('option',false,false,'Админам',{
                    value: 'admin_true'
                }))
                filter.append(ce('option',false,false,'Сотрудникам',{
                    value: 'insider_true'
                }))

                filter.append(ce('option',false,false,'Fellows',{
                    value: 'fellow_true'
                }))

                p.append(filter)
                
                let sendButton = ce('button',false,'dateButton','Отправить',{
                    disabled: true,
                    onclick:function(){
                        if(txt.value){
                            let sure = confirm('Уверены?')
                            if(sure){
                                this.setAttribute('disabled',true)
                                this.innerHTML = 'Отправляем...'

                                axios.post(`/${host}/news?id=${userid}`,{
                                    text: txt.value,
                                    name: name.value,
                                    filter: filter.value,
                                    silent: silent.checked
                                })
                                .then(s=>{
                                    txt.value = null
                                    name.value = null
                                    tg.showAlert(`Ура!\nУспешно доставлено: ${s.data.success.length} шт.`)
                                })
                                .catch(handleError)
                                .finally(()=>{
                                    this.removeAttribute('disabled')
                                    this.innerHTML = 'Отправить'
                                })
                            }
                        }
                    }
                })
                let txt = ce('textarea',false,false,false,{
                    placeholder: `Вам слово`,
                    onchange:()=>{
                        sendButton.removeAttribute('disabled')
                    }
                })

                let name = ce('input',false,false,false,{
                    placeholder: `служебное название`,
                    type: 'text',
                    onchange:()=>{
                        sendButton.removeAttribute('disabled')
                    }
                })
                p.append(name)
                p.append(txt)
                p.append(sendButton)

        
            }
        }))
        data.data.forEach(record => {
            p.append(drawNews(record))
        });
    })
    .catch(handleError)
    .finally(()=>{
        hideLoader()
    })
}

function showLogs(){
    showLoader();
    axios.get(`/${host}/admin/logs?id=${userid}`)
    .then(data=>{
        let p = preparePopup()
        p.append(ce('h3',false,false,'Логи'))
        data.data.forEach(record => {
            p.append(ce('span',false,'info',new Date(record.createdAt._seconds*1000).toLocaleString()))
            p.append(ce('p',false,false,record.text))
        });
    })
    .catch(handleError)
    .finally(()=>{
        hideLoader()
    })
}

function preparePopup(){
    tg.BackButton.show();
    tg.onEvent('backButtonClicked',clearPopUp)

    if(document.querySelector('#popup')){
        document.querySelector('#popup').remove()
    }
    mcb = clearPopUp
    let popup = ce('div','popup')
        document.body.append(popup)
    let content = ce('div')
        popup.append(content)
    return content    
}

function handleError(err){
    tg.showAlert(err.data || err.message)
}

function showLoader(){
    document.body.append(ce('div','loader'))
}

function hideLoader(){
    document.querySelector('#loader').remove()
}