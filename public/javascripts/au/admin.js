
let tg = window.Telegram.WebApp;
let userid = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : userId
let mbbc, mcb = null;
let host = `auditoria`
axios.get(`/auditoria/admin/check?id=${userid}`).then(s=>{
    loader.classList.remove('active')
    setTimeout(()=>{
        loader.remove()
        showStart()
    },300)
}).catch(err=>{
    tg.showAlert(err.data)
})




function checkQR(data){
    
    tg.closeScanQrPopup()

    let inc = data.data.split('_')

    // tg.showAlert(inc[1])

    if(data.data.split('_')[1] != 'userClasses' &&  data.data.split('_')[1] != 'coworking' &&  data.data.split('_')[1] != 'planRequests'){
        return tg.showAlert(`Я так не играю. Это не входной билет.`)
    }

    showLoader()

    axios.get(`/auditoria/admin/qr?id=${userid}&data=${data.data}`)
        .then(r=>{
            r = r.data.data;

            let p = preparePopup(`qr`)

            if(inc[1] == 'userClasses'){
                
                p.append(ce('h2',false,false,'Данные билета'))
                p.append(ce('h3',false,false,r.className))
                p.append(ce('p',false,false,`Гость: ${r.userName}`))
                if(!r.active){
                    p.append(ce('p',false,'error',`Билет заблокирован`))
                }

                if(r.isPayed){
                    p.append(ce('p',false,'error',`Билет уже оплачен или входит в подписку`))
                } else if(!r.isPayed){
                    p.append(ce('p',false,'error',`Билет не оплачен`))
                }


                

                if(r.status == 'used'){
                    p.append(ce('p',false,'error',`Билет уже использован!!!`))
                } else {
                    p.append(ce('button',false,false,'Гость пришел',{
                        onclick:function(){
                            showLoader();
                            axios.post(`/auditoria/admin/qr?id=${userid}&data=${data.data}`)
                                .then(()=>{
                                    tg.showAlert(`OK!`)
                                    this.remove()
                                })
                                .catch(handleError)
                                .finally(hideLoader)
                        }
                    }))
                }
            } else if(inc[1] == 'coworking') {


                // if(alert){
                //     tg.showAlert(alert)
                // }

                if(r.comment){
                    tg.showAlert(r.comment)
                }

                p.append(ce('h2',false,'light','Запись в коворкинг'))
                p.append(ce('p',false,false,`Дата: ${r.date}`))
                // p.append(ce('p',false,false,`Место: ${r.hall.name}`))
                // p.append(ce('p',false,false,`Гость: ${uname(r.user,r.user.id)}`))
                
                if(!r.active){
                    p.append(ce('p',false,'error',`Запись отменена!!!`))
                }
                if(r.paymentNeeded && !r.isPayed){
                    p.append(ce('p',false,'error',`Запись не оплачена.`))
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

            } else if(inc[1] == `planRequests`) {
                
                p.append(ce('h2',false,'light',`Покупка тарифа ${r.plan.name}`))

                p.append(ce('p',false,false,uname(r.user,r.user.id)))

                p.append(ce(`p`,false,false,`Стоимость: ${cur(r.plan.price,`GEL`)}.`))

                p.append(ce('button',false,false,'Активировать тариф',{
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

    b.append(ce('h2',false,false,`Занятия`,{
        onclick:()=>showClasses()
    }))

    b.append(ce('h2',false,false,`Что нового`,{
        onclick:()=>showLogs()
    }))

    b.append(ce('h2',false,false,`Рассылки`,{
        onclick:()=>showNews()
    }))

    b.append(ce('h2',false,false,`Авторы`,{
        onclick:()=>showAuthors()
    }))
}

function showAuthors(){
    showLoader();
    axios.get(`/auditoria/admin/authors?id=${userid}`)
    .then(data=>{
        let p = preparePopup(`authors`)
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

                
                
                let sendButton = ce('button',false,'dateButton','Сохранить',{
                    disabled: true,
                    onclick:function(){
                        if(txt.value){
                            let sure = confirm('Уверены?')
                            if(sure){
                                this.setAttribute('disabled',true)
                                this.innerHTML = 'Отправляем...'

                                axios.post(`/auditoria/news?id=${userid}`,{
                                    text:   txt.value,
                                    name:   name.value,
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
                
                p.append(name)
                p.append(txt)
                p.append(sendButton)

        
            }
        }))
    })
    .catch(handleError)
    .finally(()=>{
        hideLoader()
    })
}


function showNews(){
    showLoader();
    axios.get(`/auditoria/admin/news?id=${userid}`)
    .then(data=>{
        let p = preparePopup(`letters`)
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

                p.append(filter)
                
                let sendButton = ce('button',false,'dateButton','Отправить',{
                    disabled: true,
                    onclick:function(){
                        if(txt.value){
                            let sure = confirm('Уверены?')
                            if(sure){
                                this.setAttribute('disabled',true)
                                this.innerHTML = 'Отправляем...'

                                axios.post(`/auditoria/news?id=${userid}`,{
                                    text:   txt.value,
                                    name:   name.value,
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
                
            }
        }))


        return c


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
    axios.get(`/auditoria/admin/user?id=${userid}&data=${type}&user=${user}`)
    .then(data=>{
        if(container.querySelector('#details')){
            container.querySelector('#details').remove()
        }
        let details = ce('div','details')
        container.append(details)
        data.data.forEach(line=>{
            details.append(drawUserLine(type, line))
        })

        if(!data.data.length) tg.showAlert(`Извините, тут пусто`)
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

function drawNewTicket(lecture){
    
    console.log(lecture)

    let p = preparePopup(`newTicket`)
        p.append(ce(`h2`,false,false,`Новый билет`))
        p.append(ce(`h3`,false,false,lecture.name))
        p.append(ce('p',false,false,drawDate(lecture.date)))
        
        let name = ce('input',false,false,false,{
            placeholder: `Имя гостя`
        })

        let payedL = ce(`label`,false,'block',`Оплачен`) 
        let payed =  ce('input',false,false,false,{
            checked: false,
            type: 'checkbox'
        })
        payedL.append(payed)

        p.append(name)
        p.append(payedL)
        
        p.append(ce(`button`,false,false,`Создать билет`,{
            onclick:function(){
                
                if(!name.value) return tg.showAlert(`Укажите имя гостя`)

                this.setAttribute('disabled',true)
                showLoader()
                axios.post(`/${host}/admin/issue?id=${userid}`,{
                    lecture:    lecture.id,
                    name:       name.value,
                    isPayed:    payed.checked
                }).then(s=>{
                    tg.showAlert(`Готово. Передайте гостю QR-код билета`)
                    p.append(ce('img', false, 'qrSub', false, {
                        alt: `ваш билет`,
                        src: `/${host}/qr?id=${s.data}&entity=userClasses`
                    }))
                }).catch(err=>{
                    tg.showAlert(err.message)
                }).finally(()=>{
                    hideLoader()
                    this.removeAttribute(`disabled`)
                })
                                
            }
        }))
}

function drawClass(l){
    let c = ce('div',false,'divided')
    c.append(ce('h3',false,false,l.name))
    c.append(ce('span',false,['info','block'], `дата: ${drawDate(l.date)}, ${new Date(l.time).getHours()}:${new Date(l.time).getMinutes()||'00'}` ))
    let details = ce('div',false,'hidden')
    
    details.append(ce('p',false,false,l.descShort || 'без короткой подписи'))
    details.append(ce('p',false,false,l.descLong || 'без описания'))
    let guests = ce('p',false,false,'загружаю гостей...')
    details.append(guests)

    c.append(details)
    
    

    c.append(ce('button',false,false,'подробнее',{
        onclick:function(){

            if(!c.asked) c.append(ce(`button`,false,false,`Запросить обратную связь`,{
                onclick:function(){
                    this.setAttribute('disabled',true)
                    axios.post(`/${host}/admin/requestFeedBack?id=${userid}`,{
                        class:l.id
                    }).then(s=>{
                        tg.showAlert(s.data)
                    }).catch(handleError)
                    .finally(()=>{
                        this.removeAttribute(`disabled`)
                    })
                }
            }))

            details.classList.remove('hidden')
            this.remove()
            details.append(ce('p',false,false,`Ссылка на лекцию в боте:`))
            details.append(ce('a',false,false,`t.me/AuditoraBot?start=quick_class_${l.id}`,{
                href: `https://t.me/AuditoraBot?start=quick_class_${l.id}`
            }))

            details.append(ce('img',false,false,false,{
                alt: `QR для быстрого перехода`,
                src: `/auditoria/qr?class=${l.id}`
            }))

            let sendBox = ce(`div`,false,`hidden`)
                let to = ce('select')
                    to.append(ce('option',false,false,`Всем`,{
                        value: `all`
                    }))
                    to.append(ce('option',false,false,`Пришедшим`,{
                        value: `used`
                    }))
                    to.append(ce('option',false,false,`Опаздывающим`,{
                        value: 'late'
                    }))
                sendBox.append(to)
                let txt = ce('textarea',false,false,false,{placeholder: `Вам слово`})
                sendBox.append(txt)
                sendBox.append(ce('button',false,false,`Отправить`,{
                    onclick:function(){
                        if(!txt.value) return tg.showAlert(`Нельзя отправить пустое сообщение`)
                        this.setAttribute('disabled',true)
                        axios.post(`/${host}/admin/alertClass?id=${userid}`,{
                            class:  l.id,
                            text:   txt.value,
                            filter: to.value
                        })
                        .then(d=>{
                            tg.showAlert(d.data)
                            txt.value = null
                        })
                        .catch(handleError)
                        .finally(()=>{
                            this.removeAttribute('disabled')
                        })
                    }
                }))
            details.append(sendBox)
            details.append(ce('button',false,false,`Написать гостям`,{
                onclick:function(){
                    sendBox.classList.toggle('hidden')
                    this.remove()
                }
            }))

            axios.get(`/auditoria/admin/class?id=${userid}&class=${l.id}`)
                .then(data=>{

                    let rating = data.data.filter(t=>t.rate).map(t=>t.rate)
                    
                    if(rating.length){

                        let av = (rating.reduce((a,b)=>a+b,0)/rating.length).toFixed(2)

                        details.prepend(ce('h4',false,'light',`Рейтинг ${av} (${rating.length} голосов)`))
                    }

                    details.append(ce('button',false,false,`Добавить билет`,{
                        onclick:()=> drawNewTicket(l)
                    }))

                    guests.innerHTML = `Гостей: ${data.data.length}${l.price ? ` // оплачено ${data.data.filter(g=>g.isPayed).length}` : ''}`
                    guests.onclick=function(){
                        if(!this.dataset.open){
                            this.dataset.open = true;
                            this.innerHTML+=`<table><tr><th>Имя</th><th>💲</th><th>📍</th></tr>
                                ${data.data.map(u=>`<tr class="story" onclick="showTicket('${u.id}')">
                                    <td>${u.userName}${u.outsider?' (не из бота)':''}</td>
                                    <td>${l.price ? (u.isPayed?'✔️':'❌') : '🚫'}</td>
                                    <td>${(u.status == 'used'? '✔️' : '❌')}</td>
                                </tr>`).join('')}</table>`
                        }
                        
                    }
                })
                .catch(handleError)
            
            
        }
    }))
    return c
}

function showTicket(id){
    showLoader();
    axios.get(`/${host}/admin/qr?id=${userid}&data=${id}_userClasses`)
        .then(data=>{
            let ticket = data.data;
            let p = preparePopup(`tictet`)
                p.append(ce('h2',false,false,`Билет на мероприятие ${ticket.className}`))
                if(!ticket.active) p.append(ce('h3',false,false,`билет аннулирован!`))
                p.append(ce('h3',false,false,`${ticket.isPayed ? '' : 'НЕ '} оплачен`))
                if(ticket.status && ticket.status== 'used') p.append(ce('h3',false,false,`Уже использован`))
                p.append(ce('p',false,false,`Зарегистрирован ${drawDate(ticket.createdAt._seconds*1000)} на имя ${ticket.userName}`))

                if(ticket.active) p.append(ce('button',false,false,`Аннулировать билет`,{
                    onclick:()=>{
                        let sure = confirm(`Уверены, что хотите аннулировать билет?`)

                        if(sure) axios.delete(`/${host}/admin/ticket?ticket=${id}&id=${userid}`)
                            .then(confirmation=>{
                                tg.showAlert(confirmation.data)
                            }).catch(err=>{
                                tg.showAlert(err.message)
                            })
                    }
                }))

                let atxt = ce(`textarea`,false,false,false,{
                    placeholder: `Предупреждение для контролера.`,
                    value: ticket.alert || null
                })

                p.append(atxt)

                p.append(ce('button',false,false,`Добавить предупреждение`,{
                    onclick:function(){
                        this.setAttribute('disabled',true)
                        axios.put(`/auditoria/admin/ticket?ticket=${id}&id=${userid}`,{
                            param:  `alert`,
                            value:      atxt.value || null
                        }).then(()=>{
                            tg.showAlert(`ok`)
                        }).catch(err=>{
                            tg.showAlert(err.message)
                        }).finally(()=>{
                            this.removeAttribute('disabled')
                        })
                    }
                }))



                

        })
        .catch(handleError)
        .finally(hideLoader)
}

function showClasses(){
    showLoader()
    axios.get(`/auditoria/admin/classes/?id=${userid}`)
    .then(data=>{
        let p = preparePopup(`classes`)
        p.append(ce('h1',false,false,'Занятия'))
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
    axios.get(`/auditoria/admin/users?id=${userid}`)
    .then(data=>{
        let p = preparePopup(`users`)
        p.append(ce('h1',false,false,'Гости'))

        p.append(ce('p',false,'info',`всего ${data.data.length} юзеров`))


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

        cc.append(ce('input',false,false,false,{
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

        data.data.forEach(record => {
            let c = ce('div',false,'divided',false,{
                dataset:{
                    active:     record.active,
                    id:         record.id,
                    admin:      record.admin || null,
                    insider:    record.insider || null
                }
            })

            c.append(ce('span',false,'info',`${new Date(record.createdAt._seconds*1000).toLocaleString()}, (${record.language_code})${record.admin?`, админ`: (record.insider?', сотрудник':'')}`,{
                dataset:{
                    ctx: `регистрация: `
                }
            }))

            c.append(ce('p',false,false,`${record.username ? `@${record.username}` : 'Без ника'} // ${record.first_name || 'Без имени'} ${record.last_name || 'Без фамилии'}`,{
                onclick:()=>{
                    tg.openTelegramLink(`https://t.me/${record.username}`)
                }
            }))
            
            let controls = ce('div',false,'hidden')
            
            c.append(ce('button',false,false,'подробнее',{
                onclick:function(){
                    this.remove()
                    controls.classList.remove(`hidden`)
                }
            }))

            c.append(controls)

            controls.append(ce('button',false,false,'Переписка',{
                onclick:()=>{
                    showUserData('messages',c,record.id)
                }
            }))
            controls.append(ce('button',false,false,'Подписки',{
                onclick:()=>{
                    showUserData('subscriptions',c,record.id)
                }
            }))
            controls.append(ce('button',false,false,'Лекции',{
                onclick:()=>{
                    showUserData('lections',c,record.id)
                }
            }))

            if(!record.admin) {
                controls.append(ce('button',false,false,'Сделать админом',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/auditoria/admin/users?id=${userid}`,{
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
                controls.append(ce('button',false,false,'Снять админские права',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/auditoria/admin/users?id=${userid}`,{
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

            if(!record.insider) {
                controls.append(ce('button',false,false,'Сделать сотрудником',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/auditoria/admin/users?id=${userid}`,{
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
                controls.append(ce('button',false,false,'Снять права сотрудника',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/auditoria/admin/users?id=${userid}`,{
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
                controls.append(ce('button',false,false,'Заблокировать',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/auditoria/admin/users?id=${userid}`,{
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
                controls.append(ce('button',false,false,'Снять бан',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/auditoria/admin/users?id=${userid}`,{
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

            let message = ce('textarea',false,'hidden',false,{placeholder: `Вам слово`})
            c.append(message)
            let sendButton = ce('button',false,'hidden','Отправить',{
                onclick:function(){
                    if(!message.value) return tg.showAlert(`Я не вижу ваших букв!`)
                    this.setAttribute('disabled',true)
                    axios.post(`/auditoria/admin/message?id=${userid}`,{
                        text: message.value,
                        user: record.id
                    }).then(()=>{
                        tg.showAlert(`Сообщение отправлено`)
                        message.value = null;
                    }).catch(err=>{
                        tg.showAlert(err.message)
                    }).finally(()=>{
                        this.removeAttribute('disabled')
                    })
                }
            })
            c.append(sendButton)

            c.append(ce('button',false,false,'Написать',{
                onclick:function(){
                    this.remove();
                    message.classList.remove('hidden')
                    sendButton.classList.remove('hidden')
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

function showLogs(){
    showLoader();
    axios.get(`/auditoria/admin/logs?id=${userid}`)
    .then(data=>{
        let p = preparePopup(`logs`)
        p.append(ce('h1',false,false,'Логи'))
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

// function preparePopup(){
//     tg.BackButton.show();
//     tg.onEvent('backButtonClicked',clearPopUp)
//     mcb = clearPopUp
//     let popup = ce('div','popup')
//         document.body.append(popup)
//     let content = ce('div')
//         popup.append(content)
//     return content    
// }



function handleError(err){
    tg.showAlert(err.data || err.message)
}

function showLoader(){
    document.body.append(ce('div','loader'))
}

function hideLoader(){
    document.querySelector('#loader').remove()
}
