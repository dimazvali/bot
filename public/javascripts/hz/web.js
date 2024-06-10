
let host = `hz`
let downLoadedUsers = {};
let botLink = `https://t.me/ozonStatsBot`
let buttonStyle=false;

function closeLeft() {
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p => p.remove())
}

start = start.split('_')

switch(start[0]){
    
    case `landmarks`:{
        if(start[1]){
            showLandmark(start[1])
        } else {
            showLandmarks()
        }
        break;
    }
    case `tours`:{
        if(start[1]){
            showTour(start[1])
        } else {
            showTours()
        }
        break;
    }
    case `cities`:{
        if(start[1]){
            showCity(start[1])
        } else {
            showCities()
        }
        break;
    }
}


function showShops(){
    showScreen(`Магазины`, `shops`,showShopLine,addShop)
}
function showUsers(){
    showScreen(`Пользователи`,`users`,showUserLine,false,false,false,false,false,`.sDivided`)
}




function showShopLine(s){
    let c = listContainer(s,true,{stats:`запросов`})
        c.append(ce(`h2`,false,false,s.name,{
            onclick: ()=>showShop(s.id)
        }))
        // c.append(ce(`p`,false,false,l.description))
    return c
}

function addShop(){
    addScreen(`shops`,`Новый магазин`,{
        name:       {placeholder:`название`},
        apiId:      {placeholder: `client Id`},
        apiSecret:  {placeholder: `ключ доступа к API`},
    })
}

function messageLine(m){
    
    m.active = m.hasOwnProperty(`deleted`) ? false : true
    
    let c = listContainer(m,true,false,{
        isReply:        m.isReply,
        isIncoming:     !m.isReply,
        user:           m.user,
        reply:          m.isReply?true:false,
        incoming:       !m.isReply?true:false,
    })

    if(!m.active) c.classList.remove(`hidden`)

    c.append(ce(`p`,false,false,m.text || `без текста`))

    if(m.textInit) c.append(ce(`p`,false,false,`Исходный текст: ${m.textInit}`))

    let bc = ce(`div`,false,`flex`)
        c.append(bc)

    if(m.messageId && !m.deleted  && (+new Date() - new Date(m.createdAt._seconds*1000 < 48*60*60*1000))){
        bc.append(deleteButton(`messages`,m.id,false,[`active`,`dark`,`dateButton`],()=>message.remove()))
        if(!m.edited) bc.append(ce(`button`,false,buttonStyle,`редактировать`,{
            onclick:()=>{
                let ew = modal()
                    let txt = ce(`textarea`,false,false,false,{
                        placeholder: `вам слово`,
                        value: m.text || null
                    })
                     
                    ew.append(txt);

                    ew.append(ce(`button`,false,false,`Сохранить`,{
                        onclick:()=>{
                            if(txt.value) axios.put(`/${host}/admin/messages/${m.id}`,{
                                attr: `text`,
                                value: txt.value
                            }).then(handleSave)
                            .catch(handleError)
                        }
                    }))
            }
        }))
    }

    if(!m.isReply){
        bc.append(ce(`button`,false,buttonStyle,`Ответить`,{
            onclick:()=>{
                let b = modal()
                let txt = ce(`textarea`,false,false,false,{placeholder: `Вам слово`})
                    b.append(txt)
                    b.append(ce(`button`,false,buttonStyle,`Написать`,{
                        onclick:function(){
                            if(!txt.value) return alert(`Я не вижу ваших букв`)
                            this.setAttribute(`disabled`,true)
                            axios.post(`/${host}/admin/message`,{
                                text: txt.value,
                                user: m.user
                            }).then(handleSave)
                            .catch(handleError)
                            .finally(()=>{
                                txt.value = null;
                                this.removeAttribute(`disabled`)
                            })
                        }
                    }))
            }
        }))
    }

    return c
}

function shopUserLine(l){
    let c = listContainer(l,true,{deals: `сделок`, offers:`книг`});
        c.classList.remove(`hidden`);
        c.append(ce(`h3`,false,false,l.username,{
            // onclick:()=>showUser(u.id)
        }))

        // c.append(ce(`button`,false,false,`Удалить`,{
        //     onclick:()=>{
        //         let sure = confirm(`Уверены?`)
        //         if(sure) axios.delete(`/${host}/admin/shopsUsers/${l.id}`)
        //             .then(handleSave,c.remove())
        //             .catch(handleError)
        //     }
        // }))

        c.append(deleteButton(`shopsUsers`,l.id,!l.active))
    return c;
}

function showUserLine(u){
    let c = listContainer(u,true,{deals: `сделок`, offers:`книг`});
        c.append(ce(`h3`,false,false,uname(u, u.id),{
            onclick:()=>showUser(u.id)
        }))
    return c;
}

function showUser(id){
    let p = preparePopupWeb(`users_${id}`,false,false,true)
    load(`users`,id).then(u=>{
        p.append(ce('h1', false, false, `${uname(u,u.id)}`))
        
        p.append(line(
            ce('p', false, false, `регистрация: ${drawDate(u.createdAt._seconds*1000)}`),
            // ce('p', false, false, `последний раз в приложении: ${u.appLastOpened ? drawDate(u.appLastOpened._seconds*1000) : `нет данных`}`)
        ))
        
        p.append(line(
            ce('p', false, false, `${u.first_name || `Имя не указано`}`, {
                onclick: function () {
                    edit(`users`, u.id, `first_name`, `text`, u.first_name, this)
                }
            }),
            ce('p', false, false, `${u.last_name || `Фамилия не указана`}`, {
                onclick: function () {
                    edit(`users`, u.id, `last_name`, `text`, u.last_name, this)
                }
            })
        ))
        
        // p.append(line(
        //     ce('p', false, false, `email: ${u.email || `не указан`}`, {
        //         onclick: function () {
        //             edit(`users`, u.id, `email`, `text`, u.email, this)
        //         }
        //     }),
        //     ce('p', false, false, `about: ${u.about || `о себе не рассказывал`}`, {
        //         onclick: function () {
        //             edit(`users`, u.id, `about`, `textarea`, u.about, this)
        //         }
        //     }),
        //     ce('p', false, false, `occupation: ${u.occupation || `о себе не рассказывал`}`)

        // ))

        let adminLinks = [{
            attr: `admin`,
            name: `сделать админом`,
            disname: `снять админство`
        }, {
            attr: `blocked`,
            name: `заблокировать`,
            disname: `разблокировать`
        }]

        let ac = ce(`div`,false,`flex`)
        p.append(ac)

        adminLinks.forEach(type => {
            ac.append(ce('button', false, [`dateButton`,`dark`], u[type.attr] ? type.disname : type.name, {
                onclick: () => {
                    axios.put(`/${host}/admin/users/${u.id}`, {
                        attr: type.attr,
                        value: !u[type.attr]
                    }).then(handleSave)
                    .catch(handleError)
                }
            }))
        })

        // let line = ce(`div`,false,`flex`)

        // p.append(line(
        //     toggleButton(`users`,u.id,`blocked`,u.blocked||false,`Разблокировать`,`Заблокировать`,[`dateButton`,`dark`]),
        // ))


        let messenger = ce('div')
        p.append(messenger)

        messenger.append(ce(`button`,false,[`dark`,`dateButton`],`Открыть переписку`,{
            onclick:function(){
                this.remove()
                messenger.append(ce(`h2`,false,false,`Переписка:`))
                load(`messages`,false,{user:+u.id}).then(messages=>{
                    let mc = ce(`div`,false,`messenger`)
                    messenger.append(mc)
                    messages.forEach(m=>{
                        mc.prepend(messageLine(m))
                    })
                    let txt = ce('textarea',false,false,false,`вам слово`)
                    messenger.append(txt)
                    messenger.append(ce(`button`,false,[`dark`,`dateButton`],`Отправить`,{
                        onclick:()=>{
                            if(txt.value){
                                axios.post(`/${host}/admin/messages`,{
                                    text: txt.value,
                                    user: u.id
                                }).then(s=>{
                                    
                                    alert(`ушло!`)
                                    
                                    let message = ce('div',false,false,false,{dataset:{reply:true}})
                                        message.append(ce(`span`,false,`info`,drawDate(new Date(),false,{time:true})))
                                        message.append(ce(`p`,false,false,txt.value))
                                        txt.value = null;
                                    mc.prepend(message)
                                }).catch(err=>{
                                    alert(err.message)
                                })
                            }
                        }
                    }))
                })
            }
        }))
    })
}

function showShop(id){
    let p = preparePopupWeb(`shops_${id}`,false,false,true);
    
    load(`shops`,id).then(s=>{
        let details = ce(`div`,false,`details`)
            details.append(ce('span',false,`info`,`создано ${drawDate(s.createdAt._seconds*1000)}`))
            if(s.updatedAt) details.append(ce('span',false,`info`,`обновлено ${drawDate(s.updatedAt._seconds*1000)}`))
            details.append(ce('span',false,`info`,`посещений ${s.visited||0}`))
            
        p.append(details)

        p.append(ce(`h1`,false,false,s.name,{
            onclick:function(){
                edit(`shops`,id,`name`,`text`,s.name,this)
            }
        }))
    
        p.append(ce(`p`,false,`editable`,`Ключ API ${s.apiId}`,{
            onclick:function(){
                edit(`shops`,id,`apiId`,`text`,s.apiId,this)
            }
        }))
    
        p.append(ce(`p`,false,`editable`,`Секрет API ${s.apiSecret}`,{
            onclick:function(){
                edit(`shops`,id,`apiSecret`,`text`,s.apiSecret,this)
            }
        }))

        let usersContainer = ce(`div`)
        p.append(usersContainer)
        usersContainer.append(ce(`h2`,false,false,`Пользователи:`))
        load(`shopsUsers`,false,{shop:id})
            .then(users=>{
                users.forEach(u=>{
                    usersContainer.append(shopUserLine(u))
                })
                usersContainer.append(ce(`button`,false,false,`Добавить пользователя`,{
                    onclick:()=>{
                        add2Shop(id)
                    }
                }))

            })

        p.append(ce(`button`,false,false,`Открыть отчет`,{
            onclick:()=>{
                window.open(
                    `/${host}/${s.id}/report`,
                    '_blank'
                )
            }
        }))
    })
}


function add2Shop(shopId){
    let p = modal();
        p.append(ce(`h2`,false,false,`Добавить пользователя`))
    
        let suggest = ce(`div`)

        let cv = null;

        let inp = ce('input',false,false,false,{
            placeholder: `начните вводить ник пользователя`,
            oninput:function(){
                if(this.value && this.value!=cv && this.value.length > 3){
                    cv = this.value
                    suggest.innerHTML = `ищу-свищу`
                    axios.get(`/${host}/admin/userSearch?name=${this.value}`).then(options=>{
                        if(options.data.length){
                            suggest.innerHTML = null;
                            options.data.forEach(u=>{
                                suggest.append(ce(`button`,false,false,uname(u,u.id),{
                                    onclick:function(){
                                        this.setAttribute(`disabled`,true)
                                        axios.post(`/${host}/admin/shopsUsers`,{
                                            user: +u.id,
                                            shop: shopId
                                        }).then(s=>{
                                            handleSave(s)
                                            p.remove()
                                            showShop(shopId)
                                        }).catch(handleError)
                                    }
                                }))
                            })
                        }
                    })
                }
            }
        })

        p.append(inp)
        p.append(suggest)
}

window.addEventListener('keydown', (e) => {
    if (e.key == 'Escape') {
        if(document.querySelector('.editWindow')){
            document.querySelector('.editWindow').remove()
        } else if(document.querySelector('#hover')){
            document.querySelector('#hover').remove()
        } else if (document.querySelector('.popupWeb')){
            document.querySelectorAll('.popupWeb')[document.querySelectorAll('.popupWeb').length-1].remove()
        }}
    }
)

function edit(entity, id, attr, type, value, container,layer) {

    let attrTypes = {
        description: `описание`,
        name: `название`,
        authorId: `автор`,
        courseId: `курс`,
        descShort: `краткое описание`,
        descLong: `развернутое пописание`
    }

    let entities = {
        authors: `автора`,
        courses: `курса`,
        classes: `мероприятия`,
        banks: `рекивзитов`,
    }

    let helps={
        voice: `Чтобы получить код голосовой заметки, просто начитайте ее боту, в ответ вы получите необходимую строку.`
    }

    let edit = modal();

    edit.append(ce('h2', false, false, `Правим поле ${attrTypes[attr]||attr} для ${entities[entity]||entity}#${id}`))
    
    if(helps[attr]) edit.append(ce(`p`,false,`info`,helps[attr]))
    
    let f = ce('input');
    if (type == `date`) {
        f.type = `datetime-local`
        edit.append(f)
    } else if (type == `textarea`) {
        f = ce('textarea', false, false, false, {
            value: value,
            type: type,
            placeholder: `Новое значение`
        })
        edit.append(f)
    } else {
        f = ce('input', false, false, false, {
            value:          value,
            type:           type,
            placeholder:    `Новое значение`
        })
        edit.append(f)
    }

    f.focus()

    edit.append(ce('button', false, false, `Сохранить`, {
        onclick: function () {
            if (f.value) {
                axios.put(`/${host}/${layer||`admin`}/${entity}/${id}`, {
                        attr: attr,
                        value: type == `date` ? new Date(f.value) : f.value
                    }).then((d)=>{
                        handleSave(d);
                        edit.remove()
                        if(container) container.innerHTML = f.value
                    })
                    .catch(handleError)
            }
        }
    }))

    edit.append(ce('button', false, false, `Удалить`, {
        onclick: function () {
            let sure = confirm(`вы уверены?..`)
            if (sure) {
                axios.put(`/${host}/${layer||`admin`}/${entity}/${id}`, {
                        attr:   attr,
                        value:  null
                    }).then((d)=>{
                        handleSave(d);
                        if(container) container.innerHTML = f.value
                    })
                    .catch(handleError)
            }
        }
    }))
    document.body.append(edit)
}

function setSettings(settings,shop){
    Object.keys(settings).sort((a,b)=>settings[b].sort-settings[a].sort).forEach(sku=>{
        document.querySelector(`#content`).append(settingsLine(settings[sku],sku,shop))
    })
}

function settingsLine(s,id,shop){
    let c = listContainer(s,true)
        c.classList.remove(`hidden`)
        let line = ce(`div`,false,`inline`)
        c.append(ce(`h3`,false,false,s.id||id))
        line.append(toggleButton(`shopSettings`,shop,`${id}.active`,s.active,`скрыть`,`показать`,false,`api`))
        c.append(line)
        
        line.append(ce('p', false, `editable`, `${s.name || `Добавьте название`}`, {
            title: `название`,
            onclick: function () {
                edit(`shopSettings`, shop, `${id}.name`, `text`, s.name, this, `api`)
            }
        }))

        line.append(ce('p', false, `editable`, `Значение для сортировки: ${s.sort  || 0}`, {
            title: `значение для сортировки`,
            onclick: function () {
                edit(`shopSettings`, shop, `${id}.sort`, `number`, s.sort, this, `api`)
            }
        }))

    return c;
}