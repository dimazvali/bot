let tg = window.Telegram.WebApp;
const host = `homeless`

let mcb, mbbc, curLecture, curTicket = null;

function shimmer(light){
    if(light) return tg.HapticFeedback.impactOccurred('light')
    tg.HapticFeedback.notificationOccurred('success')
}

let confirmed = false;

function list(){
    
    showLoad();
    
    axios.post(`/${host}/api/usersEvents`,{
        event: curLecture
    }).then((s)=>{
        handleSave(s)
        tg.MainButton.offClick(list);
        curTicket = s.data.id
    })
    .catch(err=>{
        handleError(err)
        tg.MainButton.offClick(list)
    })
}

function deList(){
    showLoad();
    axios.delete(`/${host}/api/usersEvents/${curTicket}`)
        .then(s=>{
            handleSave(s)
            tg.MainButton.offClick(deList)
            mbbc = list
            tg.MainButton.setText(`Зарегистрироваться`)
            tg.MainButton.onClick(list)
        })
        .catch(err=>{
            handleError(err)
            tg.MainButton.offClick(deList)
            tg.MainButton.hide()
        })
}

function showEvent(id){
    curLecture = id;

    let p = preparePopup(`event_${id}`)
    userLoad(`events`,id).then(e=>{
        if(e.pic) p.append(ce(`img`,false,`cover`,false,{src:e.pic}))
        p.append(ce(`h1`,false,false,e.name))
        p.append(ce(`h3`,false,false,drawDate(e.date._seconds*1000,false,{time:true})))
        p.append(ce(`p`,false,`info`,e.description,false,true))
        if(e.capacity && !e.ticket){
            if(!e.guests || e.guests < e.capacity) {
                
                tg.MainButton.setText(`Зарегистрироваться`)
                tg.MainButton.show()
                tg.MainButton.onClick(list)
                mbbc = list
                
            } else {
                p.append(ce(`p`,false,`info`,`Извините, но мест больше нет.`))
            }
        }
        if(e.ticket){

            curTicket = e.ticket;
            tg.MainButton.setText(`Снять запись`)
            tg.MainButton.show()
            tg.MainButton.onClick(deList)
            mbbc = deList

            // p.append(ce(`button`,false,`deleteButton`,`Снять запись`,{
            //     onclick:function(){
            //         this.remove();
            //         showLoad();
            //         axios.delete(`/${host}/api/usersEvents/${e.ticket}`)
            //             .then(handleSave)
            //             .catch(handleError)
            //     }
            // }))
        }

    })
}


function showLoad(){
    tg.MainButton.setParams({
        text:`загружаем`,
        is_visible: true
    })
    tg.MainButton.showProgress()
}

// if(authNeeded){
    console.log(`Нужна авторизация`)
    confirmed = axios.post(`/${host}/authWebApp?token=userToken`,tg.initData)
        .then(s=>{
            // confirmed = 
            console.log(`получили данные админа ${s.data}`)
            return s.data.admin;
        })
// }

function userLoad(collection, id) {
    return axios.get(`/${host}/api/${collection}${id?`/${id}`:''}`).then(data => {
        return data.data
    })
}

Promise
    .resolve(confirmed)
    .then(admin=>{

        console.log(`погнали`)

        document.body.innerHTML = null;

        document.body.append(ce(`img`,`logo`,tg.colorScheme == `light` ? false : `bright`,false,{
            src: `/images/homeless/logo.png`
        }))

        let c = ce(`div`,false,`mobile`)

        let profile = ce(`div`,`profile`,[`container`])

        c.append(profile)

        userLoad(`profile`).then(user=>{

            let uname = `${user.first_name||''} ${user.last_name||''}`.trim();
            if(!uname) uname = user.username ? `@${user.username}` : user.id

            profile.append(ce(`h3`,false,false,uname));

            profile.append(ce(`p`,false,`info`,`Место отображения статуса и регалий.`))
            
            let tagsContainer = ce(`div`)
            
            profile.append(tagsContainer)

            if(user.volunteer) tagsContainer.append(ce(`span`,false,[`utag`,`volunteer`],`волонтер`))
            if(user.media) tagsContainer.append(ce(`span`,false,[`utag`,`media`],`журналист`))
            if(user.admin) tagsContainer.append(ce(`span`,false,[`utag`,`admin`],`админ`))

            
            profile.append(ce(`div`,false,`upRight`,`⚙️`,{
                onclick:()=>showSettings(user)
            }))
        }).catch(err=>{
            tg.showAlert(`Изините, вам тут не рады.`)
        })
        
        console.log(`админ: ${admin}`)

        if(admin){
            
            let adminBus = ce(`div`,`adminBus`,`container`)
            c.append(adminBus)
            adminBus.append(ce(`h2`,false,false,`Админка автобуса`))
            load(`busTrips`).then(trips=>{
                let nearest = ce(`div`,false,`h40`)
                let scrollable =ce(`div`,false,`scrollable`)
                
                adminBus.append(nearest)
                nearest.append(scrollable)

                setTimeout(()=>{
                    scrollable.append(ce(`div`,false,`box`,`🚌`))
                },0)
                
                    
                    
                    trips.forEach((t,i)=>{
                        setTimeout(()=>{
                            scrollable.append(ce(`div`,false,`box`,drawDate(t.date),{
                                onclick:()=>{
                                    showAdminBusTrip(t.id)
                                }
                            }))
                        },0)
                    })
                
            })
        }

        if(start) {
            start = start.split(`_`)
            switch(start[0]){
                case `events`:{
                    if(start[1]) {
                        showEvent(start[1])
                        break;
                    }
                    userLoad(`events`).then(e=>showEvents())
                    break;
                }
                case `event`:{
                    if(start[1]) {
                        showEvent(start[1])
                        break;
                    }
                    userLoad(`events`).then(e=>showEvents())
                    break;
                }
            }
        }
        
        let bus = ce(`div`,`bus`,[`container`,`left`])
        
        c.append(bus)

        userLoad(`bus`).then(busData=>{
            bus.classList.remove(`left`)
            bus.append(ce(`h2`,false,`help`,`Ночной автобус`,{
                onclick:()=>{
                    tg.showPopup({
                        title: `Что это такое?`,
                        message: `Специально оборудованный микроавтобус пять дней в неделю выезжает в отдалённые районы города: на четырёх стоянках волонтёры Ночлежки раздают нуждающимся людям горячую еду, средства гигиены, одежду.`,
                        buttons: [{
                            text: `Подробнее`,
                            id: `https://homeless.ru/projects/478/`
                        }]
                    },(e)=>{
                        tg.openLink(e)
                    })
                }
            }))
            if(busData.length) {
                bus.append(ce(`p`,false,`info`,`Это дни, на которые вы записались.`))
            } else {
                bus.append(ce(`p`,false,`info`,`Никуда не едем...`))
            }
            busData.forEach(e=>{
                bus.append(ce(`h4`,false,`rideLine`,`🚌 ${drawDate(e.date)}`,{
                    onclick:function(){
                        userLoad(`bus`,e.id).then(data=>{
                            tg.showPopup({
                                title: `${drawDate(e.date)}, ${data.trip.time}.`,
                                message: `${data.trip.start}\n${data.trip.comment||''}`,
                                buttons: [{
                                    type: `destructive`,
                                    text: `отменить`,
                                    id: `cancel`
                                },{
                                    text: `ok`
                                }]
                            },(cb)=>{
                                if(cb == `cancel`){
                                    axios.delete(`/${host}/api/bus/${e.id}`)
                                        .then(()=>{
                                            this.remove()
                                        })
                                        .catch(handleError)
                                }
                            })
                        })
                        
                    }
                }))
            })
            bus.append(ce(`p`,false,`info`,`А это — расписание на неделю вперед.`))

            let nearest = ce(`div`,false,`h40`)
            let scrollable =ce(`div`,false,`scrollable`)
            bus.append(nearest)
            nearest.append(scrollable)
            
            userLoad(`trips`).then(trips=>{
                setTimeout(()=>{
                    scrollable.append(ce(`div`,false,`box`,`🚌`))
                },0)
                
                trips.slice(0,7).forEach((t,i)=>{
                    setTimeout(()=>{
                        scrollable.append(ce(`div`,false,`box`,drawDate(t.date),{
                            onclick:()=>{
                                tg.showConfirm(`Хотите записаться на ${drawDate(t.date)}?`,(e)=>{
                                    if(e) axios.post(`/${host}/api/trips`,{
                                        trip: t.id
                                    }).then(s=>{
                                        if(s.data.success) tg.showAlert(`ok!`)
                                    }).catch(handleError)
                                })
                            }
                        }))
                    },0)
                })
            })

            bus.append(ce(`button`,false,`loadButton`,`Показать полное расписание`,{
                onclick:function(){
                    
                    userLoad(`trips`).then(trips=>{
                        showTrips(trips)
                    })
                }
            }))
        })
        
        let events = ce(`div`,`events`,[`container`,`left`])
        
        c.append(events)
        
        document.body.append(c)

        userLoad(`usersEvents`).then(eventsData=>{
            events.classList.remove(`left`)
            events.append(ce(`h2`,false,false,`Другие события`))
            
            eventsData.forEach(e=>{
                events.append(ce(`p`,false,`middle`,`<span class="info">${drawDate(e.date._seconds*1000)}</span><br>${e.eventName}`,{
                    onclick:()=>showEvent(e.event)
                }))
            })

            if(!eventsData.length) events.append(ce(`p`,false,`info`,`Вы не идете никуда. Фактически, стоите на месте. Но это можно исправить!`))

            events.append(ce(`button`,false,`loadButton`,`Показать расписание`,{
                onclick:function(){
                    
                    showLoad()
                    
                    userLoad(`events`).then(events=>{
                        tg.MainButton.hideProgress()
                        showEvents(events)
                    })
                }
            }))
        })

        
    })


function showAdminBusTrip(tripId){
    let p = preparePopup(`trip_${tripId}`)
    load(`busTrips`,tripId).then(trip=>{
        load(`bus`,false,{trip:tripId}).then(records=>{
            p.append(ce(`h1`,false,false,`🚌 ${drawDate(trip.date)}`))
            p.append(ce(`p`,false,`info`,`<b>время</b>: ${trip.time}`))
            p.append(ce(`p`,false,`info`,`<b>место</b>: ${trip.start}`))
            p.append(ce(`p`,false,`info`,`<b>примечания</b>: ${trip.comment || `не указаны`}`))
            p.append(ce(`hr`))
            let uc = ce(`div`,false,`relative`)
                uc.append(ce(`h3`,false,false,`Участники:`))
                uc.append(ce(`span`,false,[`info`,`upRightSmall`],`показать отмены`,{
                    onclick:function(){
                        this.remove();
                        uc.querySelectorAll(`.sDivided.hidden`).forEach(line=>{line.classList.toggle(`hidden`)})
                    }
                }))
                records.forEach(r=>{
                    load(`users`,r.user).then(u=>{
                        let rc = ce(`div`,false,[`sDivided`,r.active?`reg`:`hidden`],false,{dataset:{active:r.active}})
                            rc.append(ce(`p`,false,`info`,`заявка от ${drawDate(r.createdAt._seconds*1000)}`))
                            rc.append(ce(`p`,false,false,uname(u,u.id),{
                                onclick:()=>tg.openTelegramLink(`https://t.me/${u.username}`)
                            }))
                            if(r.active){
                                let flex = ce(`div`,false,`flex`)
                                rc.append(flex)
                                if(r.onplace){
                                    rc.append(ce(`p`,false,`info`,`на месте с ${drawDate(r.onplace._seconds*1000,false,{time:true})}`))
                                } else {
                                    flex.append(ce(`button`,false,`addButton`,`На месте`,{
                                        onclick:function(){
                                            this.setAttribute(`disabled`,true)
                                            tg.showConfirm(`Уверены?`,(e)=>{
                                                if(e){
                                                    axios.put(`/${host}/admin/bus/${r.id}`,{
                                                        attr: `onplace`,
                                                        value: new Date(),
                                                        type: `date`
                                                    }).then((s)=>{
                                                        handleSave(s)
                                                        this.remove()
                                                    })
                                                    .catch(handleError)
                                                } else {
                                                    this.removeAttribute(`disabled`)
                                                }
                                            })
    
                                        }
                                    }))
                                    flex.append(ce(`button`,false,`deleteButton`,`Снять запись`,{
                                        onclick:function(){
                                            this.setAttribute(`disabled`,true)
                                            tg.showConfirm(`Человек не придет?`,(e)=>{
                                                if(e){
                                                    axios.delete(`/${host}/admin/bus/${r.id}`)
                                                    .then((s)=>{
                                                        handleSave(s)
                                                        rc.remove()
                                                    })
                                                    .catch(handleError)
                                                } else {
                                                    this.removeAttribute(`disabled`)
                                                }
                                            })
    
                                        }
                                    }))
                                    
                                }
                            }
                            
                        uc.append(rc)
                    })
                })
            p.append(uc)
            p.append(ce(`hr`))
            let txt = ce(`textarea`,false,false,false,{
                placeholder: `Рассылка по участникам`
            });
            p.append(txt);
            p.append(ce(`button`,false,`sendButton`,`Отправить`,{
                onclick:function(){
                    if(!txt.value) return tg.showAlert(`Я не вижу ваших букв!`)
                    this.setAttribute(`disabled`,true);
                    axios.post(`/${host}/admin/news`,{
                        name: `Рассылка по участникам ночного рейса ${trip.date}`,
                        text:   txt.value,
                        filter: `trip`,
                        trip:     tripId
                    }).then(s=>{
                        handleSave(s)
                        txt.value = null
                    }).catch(handleError)
                    .finally(()=>{
                        this.removeAttribute(`disabled`)
                    })

                }
            }))
        })
    })
}
function showSettings(profile){
    shimmer(true)
    let p = preparePopup(`profile`)
    
    p.append(ce(`h1`,false,false,`Настройки`))

    p.append(ce(`p`,false,`info`,`Краткая информация о том, что тут можно делать...`))

    p.append(toggleButton(`profile`,profile.id,`volunteer`, profile.volunteer,  `Я волонтер`,               `Я не волонтер`,`mBottom`,`api`))
    p.append(toggleButton(`profile`,profile.id,`media`,     profile.media,      `Я журналист`,              `Я не работаю в медиа`,`mBottom`,`api`))
    p.append(toggleButton(`profile`,profile.id,`news`,      profile.news,       `Хочу получать новости`,    `Не хочу получать новости`,`mBottom`,`api`))

    p.append(ce('h3',false,false,`Чем похвастаетесь?..`))
    userLoad(`tags`).then(td=>{
        td.tags.forEach(t=>{
            p.append(toggleCheckBox(`userTags`,
                profile.id,
                t.id,
                td.userTags.map(t=>t.tag).indexOf(t.id)>-1?true:false,
                `${t.name}`
            ))
        })
    })
}

function showEvents(events){
    shimmer(true)
    let p = preparePopup(`events`)
    p.append(ce(`h1`,false,false,`События`))
    p.append(ce(`p`,false,`info`,`Информация о правилах посещения, проведения и прочего недоразумения.`))
    events
        .sort((a,b)=>b.date<a.date?-1:1)
        .forEach((t,i)=>{
            setTimeout(()=>{
                let c = ce(`div`,false,`container`,false,{
                    onclick:()=>showEvent(t.id)
                })
                if(t.pic) c.append(ce(`img`,false,`cover`,false,{
                    src: t.pic
                }))
                c.append(ce(`h3`,false,false,`${t.name}`))
                c.append(ce(`h4`,false,false,`${drawDate(t.date._seconds*1000)}`))
                c.append(ce(`p`,false,`info`,`${cutMe(t.description,200)}`,false,true))
            
                // if(t.comment) c.append(ce(`p`,false,false,`${t.comment}`))
                if(t.ticket){

                } else {
                    // c.append(eventButton(t.id))
                }
                p.append(c)
            },i*200)
        })
}

function showTrips(trips){
    shimmer(true)
    let p = preparePopup(`trips`)
    p.append(ce(`h1`,false,false,`Ночной автобус`))
    p.append(ce(`p`,false,`info`,`Информация о правилах посещения, проведения и прочего недоразумения.`))
    trips
        .sort((a,b)=>b.date<a.date?-1:1)
        .forEach((t,i)=>{
            setTimeout(()=>{
                let c = ce(`div`,false,`container`)
                c.append(ce(`h4`,false,false,`${drawDate(t.date)}, ${t.time}`))
                c.append(ce(`p`,false,false,`${t.start}.`))
                if(t.comment) c.append(ce(`p`,false,false,`${t.comment}`))
                if(t.ticket){

                } else {
                    c.append(busButton(t.id))
                }
                p.append(c)
            },i*200)
        })
}
function busButton(tripId){
    return ce(`button`,false,false,`Записаться`,{
        onclick:function(){
            this.setAttribute(`disabled`,true)
            this.classList.add(`loading`)
            axios.post(`/${host}/api/trips`,{
                trip: tripId
            }).then(s=>{
                if(s.data.success){
                    this.parentNode.append(debusButton(s.data.id,tripId))
                    this.remove()
                }
            }).catch(handleError)
        }
    })
}

function debusButton(bus,tripId){
    return ce(`button`,false,`deleteButton`,`снять запись`,{
        onclick:function(){
            this.setAttribute(`disabled`,true)
            axios
                .delete(`/${host}/api/bus/${bus}`)
                .then(s=>{
                    this.parentNode.append(busButton(tripId))
                    this.remove();
                    
                })
                .catch(handleError)
        }
    })
}

function preparePopup(type) {
    tg.BackButton.show();
    tg.onEvent('backButtonClicked', clearPopUp)

    if (document.querySelector(`[data-type="${type}"]`)) {
        document.querySelector(`[data-type="${type}"]`).remove()
    }

    mcb = clearPopUp
    let popup = ce('div', false, 'popup', false, {
        dataset: {
            type: type
        }
    })
    document.body.append(popup)
    let content = ce('div')
    popup.append(content)

    tg.MainButton.hide()
    return content
}


function clearPopUp() {
    let length = document.querySelectorAll('.popup').length;

    console.log(length)

    let p = document.querySelectorAll('.popup')[length - 1]

    console.log(p)

    p.classList.add('sb')

    setTimeout(function () {
        p.remove()
        if (!document.querySelectorAll('.popup').length) tg.BackButton.hide()
    }, 500)

    if (mcb) {
        tg.MainButton.offClick(mcb)
        mcb = null;
        tg.MainButton.hide()
    }

    if (mbbc) {
        tg.MainButton.hide()
        tg.MainButton.offClick(mbbc)
        mbbc = null
    }
}