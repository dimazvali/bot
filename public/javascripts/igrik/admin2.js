
const host = `igrik`
const app = `https://telegram.me/igrikyobot`
const appLinkAdmin = 'https://telegram.me/igrikyobot/admin'

let tg =        window.Telegram.WebApp
let userid =    tg.initDataUnsafe.user.id;
let mcb, mbbc = null


axios.get(`/${host}/admin/check/${userid}?id=${userid}`).then(s => {
    // loader.classList.remove('active')
    setTimeout(() => {
        // loader.remove()
        showStart()
    }, 300)
}).catch(err => {
    console.log(err.data)
    tg.showAlert(err.data || `Простите, но вам сюда нельзя`)
})


function showStart() {

    let b = document.body;

    b.append(ce('h2', false, false, `Логи`, {
        onclick: () => showLogs()
    }))

    b.append(ce('h2', false, false, `Пользователи`, {
        onclick: () => showUsers()
    }))

    b.append(ce('h2', false, false, `Рассылки`, {
        onclick: () => showNews()
    }))

    b.append(ce('h2', false, false, `Новости`, {
        onclick: () => showPublications()
    }))

    if(start){
        start = start.split('_')

        if(start[0] == `user`){
            showUser(start[1])
        }

        if(start[0] == `users`){
            showUsers()
        }

        if(start[0] == `news`){
            showNews()
        }

        if(start[0] == 'chat'){
            showChat(start[1])
        }

        if(start[0] == `logs`){
            showLogs()
        }

    }
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

        c.append(ce('button',false,'dark','Подробнее',{
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


function showNews() {
    showLoader();
    axios.get(`/${host}/admin/news/all?id=${userid}`)
        .then(data => {
            let p = preparePopup()
            
            p.append(ce('h1', false, `header`, 'История рассылок'))

            p.append(copyLink(`news`))

            p.append(ce('button',false,['dark',`block`], 'Создать рассылку', {
                onclick: function () {

                    p.innerHTML = '';

                    p.append(ce('h1', false, 'light', 'Печкин слушает!'))

                    let silent = ce('input', false, false, false, {
                        type: 'checkbox'
                    })

                    let slabel = ce('label', false, `block`, 'Бесшумное сообщение')

                    slabel.append(silent)

                    p.append(slabel)

                    let filter = ce('select',false,`br`)

                        filter.append(ce('option', false, false, 'Всем', {
                            value: ''
                        }))
                        filter.append(ce('option', false, false, 'Админам', {
                            value: 'admin_true'
                        }))

                    p.append(filter)

                    let classId = ce('input',false,'br',false,{
                        placeholder: `id класса`
                    })
                    p.append(classId)
                    

                    let sendButton = ce('button', false, 'dark', 'Отправить', {
                        disabled: true,
                        onclick: function () {
                            if (txt.value) {
                                let sure = confirm('Уверены?')
                                if (sure) {
                                    this.setAttribute('disabled', true)
                                    this.innerHTML = 'Отправляем...'

                                    axios.post(`/${host}/admin/news/new?id=${userid}`, {
                                            text:   txt.value,
                                            name:   name.value,
                                            filter: filter.value,
                                            silent: silent.checked,
                                            class:  classId.value
                                        })
                                        .then(s => {
                                            txt.value = null
                                            name.value = null
                                            tg.showAlert(`Ура!`)
                                        })
                                        .catch(handleError)
                                        .finally(() => {
                                            this.removeAttribute('disabled')
                                            this.innerHTML = 'Отправить'
                                        })
                                }
                            }
                        }
                    })
                    let txt = ce('textarea', false, [`br`,`hollow`], false, {
                        placeholder: `Вам слово`,
                        onchange: () => {
                            sendButton.removeAttribute('disabled')
                        }
                    })

                    let name = ce('input', false, [`br`,`hollow`], false, {
                        placeholder: `служебное название`,
                        type: 'text',
                        onchange: () => {
                            sendButton.removeAttribute('disabled')
                        }
                    })
                    p.append(name)
                    p.append(txt)
                    p.append(sendButton)

                    p.append(ce('p',false,['info','clickable'],`подсказка`,{
                        onclick:()=>{
                            tg.showAlert(`id класса вы (как админ) можете скопировать в расписании.\nЕсли вы его укажете, у пользователей появится кнопка "записаться"`)
                        }
                    }))

                }
            }))
            data.data.forEach(record => {
                p.append(drawNews(record))
            });
        })
        .catch(handleError)
        .finally(() => {
            hideLoader()
        })
}


function showUser(id){
    showLoader();
    
    axios.get(`/${host}/admin/users/${id}?id=${userid}`)
        .then(u=>{
            u = u.data;
            let p = preparePopup(`user_${id}`)
                p.append(ce('h1',false,'header',uname(u,id)))
                
                p.append(copyLink(`user_${id}`))
                
                p.append(ce(`p`,false,false,`Дата регистрации: ${drawDate(u.createdAt._seconds*1000)}`))
                
                if(u.id1c) p.append(ce('p',false,'info',`Аккаунт в 1С создан`))
                
                if(u.phone) {
                    p.append(ce('p',false,'info',`Телефон ${u.phone}`))
                } else {
                    p.append(ce('p',false,'info',`Телефон неизвестен.`))
                }
                
                if(u.recentMessage) p.append(ce(`p`,false,false,`Последнее сообщение: ${drawDate(u.recentMessage._seconds*1000)}`))
                
                if(u.opens) {
                    p.append(ce(`p`,false,false,`Запусков приложения: ${u.opens}`))                    
                }

                p.append(ce('button',false,'dark',`Переписка`,{
                    onclick: () => showChat(id)
                }))

                p.append(ce('button',false,'dark',`Логи`,{
                    onclick: () => showLogs(`&by=user&value=${id}`)
                }))

                if(u.admin){
                    p.append(ce('button',false,'dark',`Снять админство`,{
                        onclick: function(){
                            updateUser(id,`admin`,false).then(this.remove)
                        } 
                    }))
                } else {
                    p.append(ce('button',false,'dark',`Назначить админом`,{
                        onclick: function() {
                            updateUser(id,`admin`,true).then(this.remove)
                        }
                    }))
                } 
                
                if(u.blocked){
                    p.append(ce('button',false,'dark',`Разблокировать`,{
                        onclick: () => updateUser(id,`blocked`,false)
                    }))
                } else {
                    p.append(ce('button',false,'dark',`Заблокировать`,{
                        onclick: () => updateUser(id,`blocked`,true)
                    }))
                } 

                
        })
        .catch(handleError)
        .finally(hideLoader)    
}

function updateUser(id,field,value){
    showLoader()
    return axios.put(`/${host}/admin/users/${id}?id=${userid}`,{
        attr: field,
        value: value
    }).then(s=>{
        tg.showAlert(`ok`)
    }).catch(handleError)
    .finally(hideLoader)
}

function showUsers(){
    showLoader()
    axios.get(`/${host}/admin/users/all?id=${userid}`)
        .then(data=>{

            let users = data.data;

            let p = preparePopup(`users`)
                
                p.append(ce(`h1`,false,false,`Пользователи`))

                p.append(copyLink(`users`))

                p.append(ce('p',false,'info',`всего: ${users.length} юзеров`))

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

            
                users.sort((a,b)=>(b.recentMessage ? b.recentMessage._seconds : null) < (a.recentMessage ? a.recentMessage._seconds : null) ? -1 : 1).forEach(u => {
                    p.append(userLine(u))
                });

        })
        .catch(handleError)
        .finally(hideLoader)
    
}

function userLine(user){
    let c = ce('div',false,`divided`,false,{
        dataset:{
            blocked:    user.blocked,
            admin:      user.admin,
            phone:      user.phone
        }
    })

    c.append(ce('h4',false,`clickable`,uname(user,user.id),{
        onclick:()=>showUser(user.id)
    }))


    c.append(ce(`p`,false,false,`первый логин: ${drawDate(user.createdAt._seconds*1000)}`))
    if(user.recentMessage) c.append(ce(`p`,false,false,`последнее сообщение: ${drawDate(user.recentMessage._seconds*1000)}`))

    return c;

}


function showChat(id){
    showLoader()

    axios.get(`/${host}/admin/messages/${id}?id=${userid}`)
        .then(data=>{
            let p = preparePopup(`user_${id}_chat`)
            p.append(ce('h1',false,false,`Переписка`))
            
            let controls = ce('div')
            p.append(controls)

            
            
            let messages = ce('div')
            p.append(messages)

            let txt = ce('textarea',false,'br',false,{
                placeholder: `вам слово`
            })

            let sb = ce('button', false, `dark`, `Отправить`,{
                onclick:function(){
                    this.setAttribute(`disabled`,true)
                    showLoader()
                    axios
                        .post(`/${host}/admin/message/${id}?id=${userid}`,{
                            text: txt.value
                        })
                        .then(s=>{
                            shimmer(true)
                            tg.showAlert(`ok`)
                            messages.prepend(drawMessage(s.data))
                        })
                        .catch(handleError)
                        .finally(hideLoader)
                }
            })

            controls.append(txt)
            controls.append(sb)
            
            data.data.forEach(message=>{
                messages.append(drawMessage(message))
            })
        })
        .catch(handleError)
        .finally(hideLoader)
}

function drawMessage(m){
    let c = ce('div',false,`divided`,false,{
        dataset:{
            isReply: m.isReply ? true : false
        }
    })
    c.append(ce('span',false,`info`,drawDate(m.createdAt._seconds*1000)))
    c.append(ce('p',false,false,m.text || `без текста...`))
    return c
}