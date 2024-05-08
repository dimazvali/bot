let tg = window.Telegram.WebApp;
const host = `homeless`

let mcb, mbbc = null;

function shimmer(light){
    if(light) return tg.HapticFeedback.impactOccurred('light')
    tg.HapticFeedback.notificationOccurred('success')
}

let confirmed = true;

if(authNeeded){
    console.log(`Нужна авторизация`)
    confirmed = axios.post(`/${host}/authWebApp?token=userToken`,tg.initData)
        .then(s=>{
            confirmed = true;
        })
}

function userLoad(collection, id) {
    return axios.get(`/${host}/api/${collection}${id?`/${id}`:''}`).then(data => {
        return data.data
    })
}

Promise
    .resolve(confirmed)
    .then(()=>{

        console.log(`погнали`)

        document.body.innerHTML = null;

        document.body.append(ce(`img`,`logo`,tg.colorScheme == `light` ? false : `bright`,false,{
            src: `/images/homeless/logo.png`
        }))

        let c = ce(`div`,false,`mobile`)
        let events = ce(`div`,`events`,[`container`,`left`])
        let bus = ce(`div`,`bus`,[`container`,`left`])
        
        c.append(bus)

        c.append(events)
        
        document.body.append(c)

        userLoad(`usersEvents`).then(eventsData=>{
            events.classList.remove(`left`)
            events.append(ce(`h2`,false,false,`Другие события`))
            
            eventsData.forEach(e=>{
                events.append(ce(`p`,false,false,e.name))
            })

            if(!eventsData.length) events.append(ce(`p`,false,`info`,`Вы не идете никуда. Фактически, стоите на месте. Но это можно исправить!`))

            events.append(ce(`button`,false,`loadButton`,`Показать расписание`,{
                onclick:function(){
                    tg.MainButton.setParams({
                        text:`загружаем`,
                        is_visible: true
                    })

                    tg.MainButton.showProgress()
                    
                    userLoad(`events`).then(events=>{
                        showEvents(events)
                    })
                }
            }))
        })

        userLoad(`bus`).then(busData=>{
            bus.classList.remove(`left`)
            bus.append(ce(`h2`,false,false,`Ночной автобус`))
            if(busData.length) {
                bus.append(ce(`p`,false,`info`,`Это дни, на которые вы записались.`))
            } else {
                bus.append(ce(`p`,false,`info`,`Никуда не едем...`))
            }
            busData.forEach(e=>{
                bus.append(ce(`h4`,false,false,`🚌 ${drawDate(e.date)}`))
            })

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
                    // this.setAttribute(`disabled`,true)
                    tg.MainButton.setParams({
                        text:`загружаем`,
                        is_visible: true
                    })
                    tg.MainButton.showProgress()
                    userLoad(`trips`).then(trips=>{
                        showTrips(trips)
                    })
                }
            }))
        })
    })

function showEvents(events){
    let p = preparePopup(`events`)
    p.append(ce(`h1`,false,false,`События`))
    p.append(ce(`p`,false,`info`,`Информация о правилах посещения, проведения и прочего недоразумения.`))
    events
        .sort((a,b)=>b.date<a.date?-1:1)
        .forEach((t,i)=>{
            setTimeout(()=>{
                let c = ce(`div`,false,`container`)
                if(t.pic) c.append(ce(`img`,false,`cover`,false,{
                    src: t.pic
                }))
                c.append(ce(`h3`,false,false,`${t.name}`))
                c.append(ce(`h4`,false,false,`${drawDate(t.date._seconds*1000)}`))
                c.append(ce(`p`,false,false,`${t.description}.`))
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