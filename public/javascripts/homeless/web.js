let host = `homeless`
let subHost = `admin`
let downLoadedUsers = {};
let botLink = `https://t.me/homeless_people_bot`
let buttonStyle = []
let appLink = ``
let fsdb = `https://console.firebase.google.com/u/0/project/dimazvalimisc/firestore/databases/-default-/data`



function showCities(){
    showScreen(`Города`,`cities`,showCityLine,addCity)
}

function showSettings(){
    let p = preparePopupWeb(`settings`,false,false,true)
    p.append(ce(`h1`,false,false,`Дефолтные значения и настройки`))
    load(`settings`).then(settings=>{
        settings.forEach(item=>{
            let c = ce(`div`,false,`sDivided`)
            c.append(ce(`h3`,false,false,item.id))
            c.append(ce(`p`,false,false,item.value,{
                onclick:function(){
                    edit(`settings`,item.id,`value`,(item.type||`text`),item.value,this)
                }
            }))
            p.append(c)
        })
    })
}

function showBus(){
    closeLeft();

    let p = preparePopupWeb(`bus`,false,false,true,false,false,`Расписание автобуса`)
    
    p.append(drawBusShedule())

}

function drawBusShedule(records,start){
    
    let cc = ce('div', false, `scroll`)
    let c = ce('div', false, `flex`)

    load(`busTrips`).then(trips=>{
        load(`bus`).then(data=>{
            let fc = ce('div',false,`flex`)
            cc.append(fc)
            cc.append(c)
            let i = 0
            while (i < 30) {
    
                let day = ce(`div`, false, `date`)
                
                let date = new Date(+new Date() + i * 24 * 60 * 60 * 1000)
                
                let isoDate = date.toISOString().split('T')[0]

                day.append(ce(`h3`, false, (date.getDay() == 0 || date.getDay() == 6) ? `active` : false, drawDate(date)))
                
                let trip = trips.filter(t=>t.date == isoDate)[0];

                if(trip) {
                    day.append(ce(`button`,false,false,`Посмотреть рейс`,{
                        onclick:()=>showTrip(trip.id)
                    }))
                } else {
                    day.append(ce(`button`,false,`addButton`,`Добавить рейс`,{
                        onclick:()=>addTrip(isoDate)
                    }))
                }

                data
                    .filter(e => typeof e.date == `string` && new Date(e.date).toISOString().split('T')[0] == isoDate)
                    .forEach(e => {
                        let rec = ce('div',false,`recordLine`,false,{
                            // dataset:{hall:e.hall}
                        })     
                            if(e.user){
                                load(`users`,e.user, false, downLoadedUsers).then(u=>{
                                    let b = ce(`button`,false,[`dark`,`dateButton`,false,e.status==`used`?`active`:'reg'],unameShort(u,u.id),{
                                        // onclick:()=> showUser(u,u.id)
                                        dataset:{
                                            active: e.active
                                        },
                                        onclick:function(){
                                            showBusOptions(e,u,trip,this)
                                        }
                                    });
                                    if(u.avatar_id) load(`images`,u.avatar_id).then(p=>{
                                        b.prepend(ce(`img`,false,[`avatar`,`xSmall`],false,{src:p.src}))
                                    })
                                    rec.append(b)
                                })
                            } else {
                                rec.append(ce(`button`,false,[`dark`,`dateButton`],e.userName,{
                                    onclick:function(){
                                        let c = confirm(`уверены?`)
                                        if(c) axios.delete(`/${host}/admin/bus/${e.id}`)
                                            .then(handleSave,this.remove())
                                            .catch(handleError)
                                    }
                                }))
                            }                 
                            

                        day.append(rec)
                    })
                    if(trip) day.append(ce(`button`,false,`addButton`,`Добавить ездока`,{
                        onclick:()=>{
                            add2Bus(trip.id,isoDate)
                        }
                    }))
                c.append(day)
                i++
            }    
        })
    })
    
    return cc
}


function showBusOptions(record,user,trip,button){
    let c = modal();
    
    c.append(ce(`button`,false,[`dateButton`,`dark`],uname(user,user.id),{onclick:()=>showUser(user.id)}))

    if(user.avatar_id) {
        let picHolder = ce(`img`,false,[`avatar`,`small`])
        c.prepend(picHolder);
        load(`images`,user.avatar_id).then(a=>{
            picHolder.src = a.src
        })
    }

    if(record.status != `used`) {
        let tv = ce(`div`,false,`flex`)
        c.append(tv)
        tv.append(ce(`button`,false,[`dateButton`,`dark`],`гость пришел`,{
            onclick:function(){
                axios.put(`/${host}/admin/bus/${record.id}`,{
                    attr: `status`,
                    value: `used`
                }).then(s=>{
                    handleSave(s)
                    if(s.data.succes) this.remove()
                }).catch(handleError)
            }
        }))
        tv.append(ce(`button`,false,`removeButton`,`снять запись`,{
            onclick:function(){
                axios.delete(`/${host}/admin/bus/${record.id}`).then(s=>{
                    handleSave(s)
                    button.remove()
                    if(s.data.succes) с.remove()
                }).catch(handleError)
            }
        }))
    }

    let txt = ce(`textarea`,false,false,false,{placeholder: `Вам слово`})
    c.append(txt)
    c.append(ce(`button`,false,buttonStyle,`Написать`,{
        onclick:function(){
            if(!txt.value) return alert(`Я не вижу ваших букв`)
            this.setAttribute(`disabled`,true)
            axios.post(`/${host}/admin/messages`,{
                text: txt.value,
                user: user.id
            }).then(handleSave)
            .catch(handleError)
            .finally(()=>{
                txt.value = null;
                this.removeAttribute(`disabled`)
            })
        }
    }))

}

function add2Bus(tripId,date){
    let p = modal();
        p.append(ce(`h2`,false,false,`Запись в автобус на ${date}`))
    
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
                                suggest.append(ce(`button`,false,buttonStyle,uname(u,u.id),{
                                    onclick:function(){
                                        this.setAttribute(`disabled`,true)
                                        axios.post(`/${host}/admin/bus`,{
                                            user: +u.id,
                                            date: date,
                                            trip: tripId
                                        }).then(s=>{
                                            handleSave(s)
                                            p.remove()
                                            showBus()
                                        })
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
        p.append(ce(`button`,false,`addButton`,`Без аккаунта в TG`,{
            onclick:function(){
                this.remove();
                inp.remove();
                suggest.remove();
                let uname = ce(`input`,false,false,false,{
                    type: `text`,
                    name: `outsider`
                })
                p.append(uname);
                p.append(ce(`button`,false,`saveButton`,`Сохранить`,{
                    onclick:function(){
                        if(!uname.value) return alert(`Укажите имя, пожалуйста.`);
                        this.setAttribute(`disabled`,true)
                        axios.post(`/${host}/admin/bus`,{
                            outsider: true,
                            userName: uname.value,
                            date: date,
                            trip: tripId
                        }).then(handleSave,showBus)
                        .catch(handleError)
                    }
                }))
            }
        }))

}

function showTrip(id){
    let p = preparePopupWeb(`bus_${id}`,false,false,true)
    load(`busTrips`,id).then(trip=>{
        p.append(ce(`h2`,false,false,trip.date,{
            onclick:function(){
                edit(`busTrips`,id,`date`,`date`,trip.date,this)
            }
        }))

        p.append(ce(`p`,false,false,`время: ${trip.time||`внесите!`}`,{
            onclick:function(){
                edit(`busTrips`,id,`time`,`time`,trip.time,this)
            }
        }))

        p.append(ce(`p`,false,false,`точка старта: ${trip.start||`внесите!`}`,{
            onclick:function(){
                edit(`busTrips`,id,`start`,`textarea`,trip.start,this)
            }
        }))

        p.append(ce(`p`,false,false,`примечания: ${trip.comment||`(нажмите, чтобы добавить)`}`,{
            onclick:function(){
                edit(`busTrips`,id,`comment`,`textarea`,trip.start,this)
            }
        }))

        let users = ce(`div`)
        load(`bus`,false,{trip: id}).then(users=>{
            if(!users.length) return user.append(ce(`h3`,false,false,`Никто еще не записался`))

        })
    })
}

function showUsers(){
    showScreen(`Пользователи`,`users`,showUserLine,false,false,false,false,{
        volunteer:  `волонтеры`,
        media:      `журналисты`,
        sponsor:    `партнеры`,
        tgAdmin:    `админы ТГ`
    },`.sDivided`)
}

function showEvents(){
    showScreen(`События`,`events`,showEventLine,addEvent,false,false,false,{
        volunteer:  `для волонтеров`,
        media:      `для журналистов`,
        sponsor:    `для партнеров`,
        tgAdmin:    `для телеграмщиков`
    },`.sDivided`)
}

function showNews(){
    showScreen(`Рассылки`,`news`,showNewsLine, addNews)
}

function closeLeft() {
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p => p.remove())
}


function edit(entity, id, attr, type, value, container) {

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
        banks:  `реквизитов`,
    }

    let edit = modal()

    edit.append(ce('h2', false, false, `Правим поле ${attrTypes[attr]||attr} для ${entities[entity]||entity}#${id}`))
    let f = ce('input');
    f.focus()
    if (type == `date`) {
        f.type = `datetime-local`
        edit.append(f)
    } else if (type == `bankId`) {
        load(`banks`).then(authors => {
            f = ce('select')
            f.append(ce('option', false, false, `Выберите реквизиты`, {
                value: ''
            }))
            authors
                .filter(a => a.active)
                .sort((a, b) => a.name < b.name ? -1 : 1)
                .forEach(a => f.append(ce('option', false, false, a.name, {
                    value: a.id
                })))
            edit.append(f)
        })
    } else if (type == `authorId`) {
        load(`authors`).then(authors => {
            f = ce('select')
            f.append(ce('option', false, false, `Выберите автора`, {
                value: ''
            }))
            authors
                .filter(a => a.active)
                .sort((a, b) => a.name < b.name ? -1 : 1)
                .forEach(a => f.append(ce('option', false, false, a.name, {
                    value: a.id
                })))
            edit.append(f)
        })
    } else if (type == `courseId`) {
        load(`courses`).then(authors => {
            f = ce('select')
            f.append(ce('option', false, false, `Выберите курс`, {
                value: ''
            }))
            authors
                .filter(a => a.active)
                .sort((a, b) => a.name < b.name ? -1 : 1)
                .forEach(a => f.append(ce('option', false, false, a.name, {
                    value: a.id
                })))
            edit.append(f)
        })
    } else if (type == 'textarea') {
        f = ce('textarea', false, false, false, {
            value: value,
            type: type,
            placeholder: `Новое значение`
        })
        edit.append(f)
    } else {
        f = ce('input', false, false, false, {
            value:  value,
            type:   type,
            placeholder: `Новое значение`
        })
        edit.append(f)
    }

    edit.append(ce('button', false, false, `Сохранить`, {
        onclick: function () {
            if (f.value) {
                axios.put(`/${host}/admin/${entity}/${id}`, {
                        attr: attr,
                        value: (type == `date` || type == `datetime-local`) ? new Date(f.value) : (type == `number` ? +f.value : f.value)
                    }).then((s) => {
                        handleSave(s)
                        if (container) container.innerHTML = f.value
                    })
                    .catch(handleError)
            }
        }
    }))
}

function showNewsLine(n){
    let c = listContainer(n,true,{audience: `гостей`});
        c.append(ce(`h3`,false,false,n.name,{
            onclick:()=>showNew(n.id)
        }))
    return c;
}

function showEventLine(e){
    let c = listContainer(e,true,{
            guests:     `гостей`,
            date:       `когда`,
            media:      `для журналистов`,
            volunteer:  `для волонтеров`,
            sponsor:    `для партнеров`,
        });
        c.append(ce(`h3`,false,false,e.name,{
            onclick:()=>showEvent(e.id)
        }))
    return c;
}

function showUserLine(u){
    let c = listContainer(u,true,{
        events:     `Мероприятий`,
        media:      `Медиа`,
        volunteer:  `Волонтер`,
        sponsor:    `Партнер`,
        tgAdmin:    `Админ ТГ`
    });
        c.append(ce(`h3`,false,false,uname(u, u.id),{
            onclick:()=>showUser(u.id)
        }))
    return c;
}



window.addEventListener('keydown', (e) => {
    if (e.key == 'Escape') {
        if (document.querySelector('.editWindow')) {
            document.querySelector('.editWindow').remove()
        } else if (document.querySelectorAll(`.popupWeb`).length) {
            document.querySelectorAll(`.popupWeb`)[document.querySelectorAll(`.popupWeb`).length - 1].remove()
        } else if (document.querySelector('#hover')) {
            document.querySelector('#hover').remove()
        }
    }
})

function showEvent(id){
    let p = preparePopupWeb(
        `events_${id}`,
        false,
        false,
        true,
        logButton(`events`,id,`логи`),
        `/events/${id}`,
    )

    load(`events`,id).then(cl=>{
        p.append(ce(`img`, false, `cover`, false, {
            src: cl.pic || cl.cover,
            onclick: function () {
                edit(`events`, cl.id, `pic`, `text`, cl.pic || null)
            }
        }))  

        p.append(ce('h1', false, false, cl.name,{
            onclick: function () {
                edit(`events`, cl.id, `name`, `text`, cl.name || null, this)
            }
        }))

        p.append(ce('p', false, `hover`, `${drawDate(cl.date._seconds*1000,'ru',{time:true})}`,{
            onclick: function () {
                edit(`classes`, cl.id, `date`, `datetime-local`, cl.date || null)
            } 
        }))

        p.append(ce('p', false, [`story`,`hover`], cl.description || `Добавьте описание`,{
            onclick: function () {
                edit(`events`, cl.id, `description`, `textarea`, cl.description || null, this)
            }
        },true))

        p.append(ce(`p`,false,`hover`,`Вместимость: ${cl.capacity}`,{
            onclick: function () {
                edit(`events`, cl.id, `capacity`, `number`, cl.capacity || null, this)
            }
        }))

        p.append(line(
            toggleButton(`events`,cl.id,`media`,       cl.media,       `Для медиа`,        `Не для медиа`),
            toggleButton(`events`,cl.id,`volunteer`,   cl.volunteer,   `Для волонтеров`,   `Не для волонтеров`),
            toggleButton(`events`,cl.id,`sponsor`,     cl.sponsor,     `Для спонсоров`,    `Не для спонсоров`),
            toggleButton(`events`,cl.id,`tgAdmin`,     cl.tgAdmin,     `Для админов ТГ`,   `Не для админов ТГ`),
        ))
        
        
        
        

        p.append(ce(`button`,false,false,`Отправить анонс`,{
            onclick:()=>{

                let c = modal(`Рассылка по возможным участникам`)
                
                let txt = ce(`textarea`,false,false,false,{
                    placeholder: `Вам слово`,
                    value: null
                })

                c.append(txt)

                c.append(ce(`button`,false,`sendButton`,`Отправить`,{
                    onclick:()=>{
                        if(!txt.value) return alert(`я не вижу ваших букв!`)
                        axios.post(`/${host}/admin/news`,{
                            name:   `рассылка возможным гостям ${cl.name}`,
                            text:   txt.value,
                            filter: `event`,
                            event:  cl.id,
                            app:{
                                text: `Открыть событие`,
                                link: `events_${cl.id}`
                            }
                        })
                    }
                }))
            }
        }))

        p.append(deleteButton(`events`,cl.id,!cl.active))

        p.append(ce(`h2`,false,false,`Гости:`))

        load(`usersEvents`,false,{event: cl.id}).then(col=>{
            if(!col.length) p.append(ce(`p`,false,false,`Ни одной записи еще нет.`))
            col.forEach(t=>{
                p.append(showTicketLine(t))
            })
        })
    })
}

function showTicketLine(t){
    let c = listContainer(t,true)
    if(!t.active) c.classList.remove(`hidden`)
    return c
}

function addTrip(date){
    addScreen(`busTrips`,`Новый рейс`,{
        date: {
            type: `date`,
            value: date,
            required: true
        },
        count: {
            type:       `number`,
            value:      settings.defaultBusRiders.value,
            placeholder: `мест для волонтеров`   
        },
        time: {
            type: `time`,
            value: settings.defaultStartTime.value
        },
        start: {
            type: `text`,
            placeholder: `Точка старта`,
            value: settings.defaultStartPlace.value
        },
        comment: {
            type: `textarea`,
            placeholder: `примечания`,
            value: null
        }
    })
}

function addEvent(){
    addScreen(`events`, `Новое событие`,{
        pic:{
            type: `file`,
            name: `cover`
        },
        date:           {
            placeholder: `Дата`,
            type: `datetime-local`
        },
        name:           {
            placeholder: `Название`
        },
        description:    {
            placeholder: `Описание`,
            tag:`textarea`
        },
        capacity:       {
            type: `number`,
            placeholder: `количество участников`
        },
        media: {
            bool: true,
            placeholder: `Для медиа`
        },
        volunteer: {
            bool: true,
            placeholder: `Для волонтеров`
        },
        sponsor: {
            bool: true,
            placeholder: `Для партнеров`
        },
        tgAdmin:{
            bool: true,
            placeholder: `Для админов ТГ`
        }
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

function showDeal(id){
    let p = preparePopupWeb(`deal_${id}`,false,false,true);
    load(`deals`,id).then(deal=>{
        p.append(ce(`h1`,false,false,deal.bookName,{
            onclick:()=>showBook(deal.book)
        }))
        p.append(detailsContainer(deal))
        
        let uc = ce(`div`)
        
        p.append(uc)

        load(`users`,deal.seller,downLoadedUsers).then(seller=>{
            load(`users`,deal.buyer,downLoadedUsers).then(buyer=>{
                uc.append(line(
                    ce(`button`,false,false,uname(seller,seller.id),{
                        onclick:()=>showUser(seller.id)
                    }),
                    ce(`button`,false,false,uname(buyer,buyer.id),{
                        onclick:()=>showUser(buyer.id)
                    })
                ))
                // uc.append(deal.address)
            })
        })

        load(`offers`,deal.offer).then(o=>{
            uc.append(ce(`p`,false,false,o.address))
        })

        p.append(line(
            ce(`p`,false,`mrRight`,`Статус: ${deal.status}`),
            ce(`p`,false,false,`Тип: ${deal.type}`)
        ))

        p.append(deleteButton(`deals`,id))
    })
}

let savedUserTypes = {
    volunteer:  `волонтеры`,
    sponsor:    `партнеры`,
    media:      `журналисты`,
    tgAdmin:    `админы ТГ`
}

function removeTag(refId,userId,container){
    axios.delete(`/${host}/admin/userTags/${refId}`)
        .then(s=>{
            handleSave(s)
            container.remove()
        }).catch(handleError)
}

function addTag(userId){
    let edit = ce('div', false, `editWindow`)
    edit.append(ce(`h2`,false,false,`Добавляем тег`))
    let f;
    load(`tags`).then(tags=>{
        f = ce('select')
        f.append(ce('option', false, false, `Выберите тег`, {
            value: ''
        }))
        tags
            .filter(a => a.active)
            .sort((a, b) => a.name < b.name ? -1 : 1)
            .forEach(a => f.append(ce('option', false, false, a.name, {
                value: a.id
            })))
        edit.append(f)

        edit.append(ce('button', false, false, `Сохранить`, {
            onclick: function () {
                if (f.value) {
                    axios.post(`/${host}/admin/userTags/${userId}`, {
                        tag: f.value
                    }).then((d)=>{
                        handleSave(d);
                    })
                    .catch(handleError)
                }
            }
        }))
        document.body.append(edit)

    })
}

function showUser(id){
    let p = preparePopupWeb(`users_${id}`,false,false,true)
    load(`users`,id).then(u=>{
        
        if(u.avatar_id) {
            let avatarContainer = ce(`div`)
            p.append(avatarContainer);
            load(`images`,u.avatar_id).then(data=>{
                avatarContainer.append(ce(`img`,false,`avatar`,false,{
                    src: data.src
                }))
            })
        }

        p.append(ce(`h1`,false,false,uname(u, u.id)))



        p.append(line(
            toggleButton(`users`,u.id,`blocked`,u.blocked||false,`Разблокировать`,`Заблокировать`,[`dateButton`,`dark`]),
            toggleButton(`users`,u.id,`noSpam`,u.noSpam||false,`Выключить новости`,`Включить новости`,[`dateButton`,`dark`])
        ))

        p.append(line(
            ...Object.keys(savedUserTypes).map(t=>toggleButton(`users`,u.id,t,u[t]||false,`${savedUserTypes[t]} — да`,`${savedUserTypes[t]} — нет`))
        ))

        let tags = ce('div')

        tags.append(ce('h2',false,false,`Теги`))

        p.append(tags)

        load(`userTags`,false,{user:u.id}).then(tgs=>{
            if(!tgs.length) tags.append(ce('p',false,false,`тегов еще нет`))
            tgs.forEach(t=>{
                tags.append(ce('button',false,[`dateButton`,`dark`],t.name,{
                    onclick:function(){
                        removeTag(t.id,u.id,this)
                    }
                }))
            })
        })
        
        p.append(ce(`button`,false,`addButton`,`Добавить тег`,{
            onclick:() => addTag(u.id)
        }))
        

        
        
            let messenger = ce('div')
            
            p.append(messenger)
    
            messenger.append(ce(`button`,false,buttonStyle,`Открыть переписку`,{
                onclick:function(){
                    this.remove()
                    messenger.append(ce(`h2`,false,false,`Переписка:`))
                    load(`messages`,false,{user:id}).then(messages=>{
                        let mc = ce(`div`,false,`messenger`)
                        messenger.append(mc)
                        messages.forEach(m=>{
                            mc.prepend(messageLine(m))
                        })
                        let txt = ce('textarea',false,false,false,`вам слово`)
                        messenger.append(txt)
                        messenger.append(ce(`button`,false,buttonStyle,`Отправить`,{
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

start = start.split('_')

switch(start[0]){
    case `events`:{
        if(start[1]) {
            showEvent(start[1])
        } else {
            showEvents()
        }
        break;
    }
}

function showTag(tagId){
    let p = preparePopupWeb(`tags_${tagId}`,false,false,true)
    p.append(ce('h2',false,false,`Загружаем...`))
    load(`tags`,tagId).then(tag=>{
        p.innerHTML = null;
        
        p.append(logButton(`tag`,tagId,`Лог по тегу`))

        p.append(ce(`h1`,false,false,tag.name,{
            onclick:function(){
                edit(`tags`,tagId,`name`,`text`,tag.name,this)
            }
        }))
        
        p.append(editable({
            entity: `tags`,
            id:     tagId,
            attr:   `description`,
            value:  tag.description
        }))

        p.append(toggleButton(`tags`,tagId,`public`,tag.public,`Публичный тег`, `Тег для админов`))
        
        if(tag.active) p.append(deleteButton(`tags`,tagId))

        let users = ce('div',false,false,`загружаем пользователей`)
        
        p.append(users)

        load(`userTags`,false,{tag:tagId}).then(tusers=>{
            
            users.innerHTML = tusers.length ? `${tusers.length} пользователей` : `юзеров нет`
            
            tusers.forEach(u=>{
                load(`users`,u.user,false,downLoadedUsers).then(u=>{
                    users.append(showUserLine(u))
                })        
            })    
            
            if(tusers.length){
                let mb = ce(`div`,false,`inpC`)
                mb.append(ce('h3',false,false,`Отправить сообщение`))

                let name = ce('input',false,`block`,false,{placeholder: `Название`})
                let desc = ce('textarea',false,false,false,{placeholder: `Текст`})
                let sb = ce('button',false,`dateButton`,`Отправить`,{
                    dataset:{booked:1},
                    onclick:function(){
                        if(name.value && desc.value){
                            this.setAttribute(`disabled`,true)
                            axios.post(`/${host}/admin/news`,{
                                name:           name.value,
                                text:           desc.value,
                                tag:            tagId,
                                filter:         `tagged`
                            }).then(r=>{
                                alert(r.data.comment)
                            }).catch(err=>{
                                alert(err.message)
                            }).finally(()=>{
                                this.removeAttribute(`disabled`)
                            })
                        }
                    }
                })
                mb.append(name)
                mb.append(desc)
                mb.append(sb)
                p.append(mb)
            }
        })

        

    })
}

function showTags(){
    showScreen(`Теги`,`tags`,showTagLine,addNewTag)
}

function addNewTag(){
    addScreen(`tags`,`Новый тег`,{
        name: {
            placeholder: `Название`
        },
        description: {
            placeholder: `Описание`,
            tag:        `textarea`
        },
        public:{
            placeholder: `Пользователь может проставить самому себе`,
            bool: true
        }
    })
}

function showTagLine(t){
    let c = listContainer(t,true,{cnt:`пользователей`})
        c.append(t.name)
        c.onclick=()=>showTag(t.id)
    return c
}

function showCity(id){
    let p = preparePopupWeb(`cities_${id}`,false,false,true)
        load(`cities`,id).then(city=>{
            
            p.append(detailsContainer(city))

            p.append(ce(`h1`,false,false,city.name,{
                onclick:function(){
                    edit(`cities`,id,`name`,`text`,city.name,this)
                }
            }))

            p.append(ce(`p`,false,false,city.description||'добавьте описание',{
                onclick:function(){
                    edit(`cities`,id,`description`,`textarea`,city.description||`добавьте описание`,this)
                }
            }))

            let offers = ce(`div`)
                offers.append(ce(`h3`,false,false,`Предложения:`))
                load(`offers`,false,{city:id}).then(offersData=>{
                    offersData.length ? offers.append(ce(`p`,false,false,`пока нет`)) : offersData.forEach(o=>{
                        offers.append(showOfferLine(o))
                    })
                    offers.append(ce(`button`,false,false,`Добавить`,{
                        onclick:()=>addOffer({city:id})
                    }))
                })
            p.append(offers)

        })
}


function addCity(){
    addScreen(`cities`,`Новый город`,{
        name:           {placeholder: `Название`},
        description:    {placeholder: `Описание`,tag:`textarea`},
        currency:       {placeholder: `код валюты`},
    })
}


function addNews(){
    closeLeft()
    let p = preparePopupWeb(`news_add`,false,false,true)
    p.append(ce('h2',false,`infoBubble`,`Новая рассылка`,{
        onclick:()=>showHelp([
            `Здесь вы можете составлять рассылки (текстовые и не только) как по всем активным пользователям, так и по ролям или тегам.`,
            `Обратите внимание, что пользователи, заблокировавшие бот, не получат вашего сообщения.`,
            `Фотографии для публикаций вставляются ссылками. Загрузить картинки можно <a href="https://console.firebase.google.com/u/0/project/psbot-7faf5/storage/psbot-7faf5.appspot.com/files" targtet="_firebase">здесь</a>.`
        ])
    }))
    
    let name = ce('input',false,`block`,false,{placeholder: `Название`})

    let desc = ce('textarea',false,false,false,{placeholder: `Текст`})
    
    let select = ce(`select`)
        select.append(ce(`option`,false,false,`Кому отправлять?`,{
            value: ''
        }))

    let sendOptions = {
        admin:          `Админам`,
        media:          `Медийщикам`,
        volunteer:      `Волонтерам`,
        tgAdmin:        `Администраторам ТГ`,
        sponsor:        `Партнерам`,
        all:            `Всем`
    } 

    Object.keys(sendOptions).forEach(o=>{
        select.append(ce('option',false,false,sendOptions[o],{
            value: o
        }))
    })

    let silent = labelButton(`бесшумная`, false)
    let safe = labelButton(`защита от пересылки`, false)
    
    let sb = ce('button',false,`dateButton`,`Отправить`,{
        dataset:{booked:1},
        onclick:function(){
            if(name.value && desc.value){
                this.setAttribute(`disabled`,true)
                let media = []
                p.querySelectorAll('.media').forEach(inp=>{
                    if(inp.value) media.push(inp.value)
                })
                axios.post(`/${host}/admin/news`,{
                    name:           name.value,
                    text:           desc.value,
                    filter:         select.value,
                    media:          media,
                    silent:         silent.querySelector(`input`).checked ? true : false,
                    safe:           safe.querySelector(`input`).checked ? true : false
                }).then(r=>{
                    alert(r.data.comment)
                }).catch(err=>{
                    alert(err.message)
                }).finally(()=>{
                    this.removeAttribute(`disabled`)
                })
            }
        }
    })

    let inpC = ce('div',false,`inpC`)
    p.append(inpC)

    inpC.append(name)
    inpC.append(mediaLine())
    inpC.append(ce(`button`,false,`thin`,`Добавить фото`,{
        onclick:function(){
            let copy = mediaLine()
            this.parentNode.insertBefore(copy,this)
        }
    }))
    inpC.append(desc)
    inpC.append(select)
    // inpC.append(tag)
    
    inpC.append(silent)
    inpC.append(safe)
    
    p.append(sb)
}

function mediaLine(){
    let mc = ce('div',false,`relative`)
    let media = ce('input',false,[`block`,`media`],false,{placeholder: `фото или видео`,onchange:function(){
        mc.querySelectorAll(`img`).forEach(img=>img.remove())
        if(this.value) mc.prepend(ce(`img`,false,`micro`,false,{src:this.value}))
    }
})
    let db = ce('div',false,`delete`,`❌`,{
        onclick:function(){
            this.parentNode.remove()
        }
    })
    
    mc.append(media)
    mc.append(db)
    return mc
}

if(start){
    switch(start[0]){
        case `bus`:{
            showBus();
            break;
        }
        case `tags`:{
            showTags()
            break;
        }
    }
}
