

let userFilters = {};
// let userFilters = {};

const fsdb = `https://console.firebase.google.com/u/0/project/paperstuff-620fa/firestore/data`

let host = `paper`

let buttonStyle = [`dark`,`dateButton`]

let users = {};
let downLoadedUsers = {}
let messagesFilter = {}

let mc = document.querySelector(`#main`)

function closeLeft() {
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p => p.remove())
}

const appLink = `https://t.me/paperstuffbot/app`
const web = `https://papers.dimazvali.com`


if(start){
    start = start.split('_')

    switch(start[0]){
        case `wineList`:{
            showWine()
            break;
        }
        case `messages`:{
            showMessages();
            break;
        }
        case `mr`:{
            showMeetingRoom()
            break;
        }
        case `tickets`:{
            if(start[1]) {
                showTicket(false,start[1])
            } else {
                showTickets()     
            }
            break;
        }
        case `plans`:{
            if(start[1]) {
                showPlan(start[1])
            } else {
                showPlans()     
            }
            break;
        }
        case `standAlone`:{
            if(start[1]) {
                showStandAlonePage(start[1])
            } else {
                showStandAlone()     
            }
            break;
        }
        case `rc`:{
            showRC()
            break;
        }
        case `newClass`:{
            newClass()
            break;
        }
        case 'users':{
            if(start[1]) {
                showUser(false,start[1])
            } else {
                showUsers()
            }
            break;
        }
        case 'classes':{
            if(start[1]) {
                showClass(false,start[1])
            } else {
                showSchedule()
            }
            break;
        }
        case 'halls':{
            if(start[1]) {
                showHall(false,start[1])
            } else {
                showHalls()
            }
            break;
        }
        case 'coworking':{
            showCoworking()
            break;
        }
        case 'authors':{
            if(start[1]){
                showAuthor(false,start[1])
            } else {
                showAuthors()
            }
            break;
        }
        default:
            break;
        
    }
}

function checkMissing(type,data){
    let alerts = [];
    switch(type){
        case `books`:{
            if(!data.isbn) alerts.push(`Нет ISBN`)
            if(!data.author) alerts.push(`Нет автора`)
            if(!data.description) alerts.push(`Нет описания`)
        }
        default:{
            if(!data.name) alerts.push(`Нет названия!`)
        }
    }
    
    return alerts
}


function showBooks(){
    showScreen(`Книги`,`books`,showBookLine,addBook,false,true,buttonStyle)
}

function showBookLine(b){
    let c = listContainer(b,true,{isbn:b.isbn},false,checkMissing(`books`,b))
        c.onclick = () => showBook(b.id)
        c.append(ce(`h3`,false,false,b.name))
        c.append(ce(`p`,false,false,b.description? b.description.toString().slice(0,100) : `без описания`))
        return c;
}

function addBook(){
    addScreen(`books`,`Новая книга`,{
        name:           {placeholder:`Название`},
        description:    {placeholder: `Описание`,type:`textarea`},
        isbn:           {placeholder: `ISBN`},
        lang:           {selector:  `langs`,placeholder: `Выберите язык`},
        author:         {placeholder: `Автор`},
        pic:            {placeholder: `Обложка`},
        price:          {placeholder: `Стоимость`, type: `number`},
        publisher:      {placeholder: `Издательство`},
        year:           {placeholder: `Год издания`, type: `number`},
        new:            {placeholder: `Состояние`,selector: `bookState`}
    })
}

function showStats(){
    let p = preparePopupWeb(`stats`);
        
        p.append(ce(`h1`,false,false,`Выгрузки`))
        p.append(ce(`p`,false,false,`Здесь вы можете выгрузить данные по коворкингу, расписанию, пользователям. Запросы логируются.`))
        p.append(ce(`p`,false,false,`Данные выгружаются в CSV. Если они отобраются некорректно, воспользуйтесь кнопкой "импорт" (в excel) — или просто откройте файл через гуглодоки.`))

        let types = {
            cowork:     `Коворкинг`,
            schedule:   `Расписание`,
            users:      `Пользователи`,
            tickets:    `Билеты`
        }

        Object.keys(types).forEach(t=>{
            p.append(ce(`button`,false,buttonStyle,types[t],{
                onclick:()=>{
                    window.open(`/${host}/admin/stats?type=${t}`)
                    // load(`stats`,false,{type:t})
                }
            }))
        })

}

function showWine(){
    let screen = showScreen(
        `Вино`,
        `wineList`,
        wineLine,
        false,
        false,
        true,
        buttonStyle
    )
}

function drawCoworkingShedule(records,start){
    
    let cc = ce('div', false, `scroll`)
    let c = ce('div', false, `flex`)

    
    load(`coworking`).then(data=>{
        let fc = ce('div',false,`flex`)
        data.halls
        .sort((a,b)=>b.name<a.name?1:-1)
        .forEach(h=>{
            fc.append(ce(`button`,false,buttonStyle,h.name,{
                onclick:function(){
                    this.parentNode.querySelectorAll(`.active`).forEach(b=>b.classList.remove(`active`))
                    this.classList.add(`active`)
                    c.querySelectorAll(`.date`).forEach(day=>{
                        day.querySelectorAll(`.recordLine`).forEach(rec=>{
                            if(rec.dataset.hall != h.id){
                                rec.classList.add(`hidden`)
                            } else {
                                rec.classList.remove(`hidden`)
                            }
                        })
                    })
                }
            }))
        })
        cc.append(fc)
        cc.append(c)
        let i = 0
        while (i < 30) {
            let day = ce(`div`, false, `date`)
            
            let date = new Date(+new Date() + i * 24 * 60 * 60 * 1000)
            
            let isoDate = date.toISOString().split('T')[0]
            
            day.append(ce(`h3`, false, (date.getDay() == 0 || date.getDay() == 6) ? `active` : false, drawDate(date)))
            
            data.records
                .filter(e => typeof e.date == `string` && new Date(e.date).toISOString().split('T')[0] == isoDate)
                .sort((a,b)=>b.hallName<a.hallName?1:-1)
                .forEach(e => {
                    let rec = ce('div',false,`recordLine`,false,{
                        dataset:{hall:e.hall}
                    })
                        rec.append(ce(`span`,false,`info`,e.hallName))
                        
                        load(`users`,e.user, false, downLoadedUsers).then(u=>{
                            let b = ce(`button`,false,[`dark`,`dateButton`,((e.payed||!e.paymentNeeded)?'fineButton':'reg'),e.status==`used`?`active`:'reg'],unameShort(u,u.id),{
                                // onclick:()=> showUser(u,u.id)
                                onclick:function(){
                                    showCoworkingOptions(e,u,this)
                                }
                            });
                            if(u.avatar_id) load(`images`,u.avatar_id).then(p=>{
                                b.prepend(ce(`img`,false,[`avatar`,`xSmall`],false,{src:p.src}))
                            })
                            rec.append(b)
                        })
                    day.append(rec)
                })
            c.append(day)
            i++
        }    
    })
    return cc
}


function showPlans(){
    let p = preparePopupWeb(`plans`,false,false,true,false,false,`Тарифы и подписки`);
        // p.append(ce(`h1`,false,false,`Тарифы и подписки`))
        load(`plans`).then(plans=>{

            let c = ce('div')
            
            plans.forEach(plan=>{
                c.append(showPlanLine(plan))
            })

            let cc = ce('div', false, `controls`)
            
            cc.append(sortBlock([{
                attr: `name`,
                name: `По названию`
            }, {
                attr: `views`,
                name: `По просмотрам`
            }, {
                attr: `createdAt`,
                name: `По дате создания`
            }], c, plans, showPlanLine, buttonStyle))

            p.append(cc)

            c.append(ce('button', false, buttonStyle, `Добавить тариф`, {
                onclick: () => newPlan()
            }))
            
            p.append(c)
            p.append(archiveButton(c,buttonStyle))
            
        })
}

function showPlanLine(plan){
    let c = listContainer(plan,true,{
        days: `дней`,
        events: `событий`,
        visits: `коворк`
    })
        c.append(ce('h3',false,false,plan.name,{
            onclick:()=>showPlan(plan.id)
        }));

        c.append(ce(`p`,false,false,plan.description.slice(0,100)+'...'))
    return c
}

function newPlan(){
    let p = preparePopupWeb(`newPlan`,false,false,true)
        p.append(ce(`h1`,false,false,`Добавляем тариф:`))
        p.classList.add(`inpC`)
        
        let name = ce('input',false,false,false,{
            placeholder: `Название`,
            type: `text`
        })

        let desc = ce('textarea',false,false,false,{
            placeholder: `Описание`,
            type: `text`
        })

        let days = ce('input',false,false,false,{
            placeholder: `Дней`,
            type: `number`,
            min: 1,
            step: 1
        })

        let visits = ce('input',false,false,false,{
            placeholder: `Коворк`,
            type: `number`,
            min: 1,
            step: 1
        })

        let events = ce('input',false,false,false,{
            placeholder: `Ивентов`,
            type: `number`,
            min: 1,
            step: 1
        })

        let price = ce('input',false,false,false,{
            placeholder: `Стоимость`,
            type: `number`,
            min: 10,
            step: 10
        })


        p.append(name)
        p.append(desc)
        p.append(days)
        p.append(visits)
        p.append(events)
        p.append(price)

        p.append(ce(`button`,false,false,`Сохранить`,{
            onclick:function(){
                
                    if(!name.value) return alert(`Пропущено поле name`)
                    if(!desc.value) return alert(`Пропущено поле desc`)
                    if(!days.value) return alert(`Пропущено поле days`)
                    if(!visits.value) return alert(`Пропущено поле visits`)
                    if(!events.value) return alert(`Пропущено поле events`)
                    if(!price.value) return alert(`Пропущено поле price`)

                    this.setAttribute(`disabled`,true)
                    axios.post(`/${host}/admin/plans`,{
                        name: name.value,
                        desc: desc.value,
                        days: days.value,
                        visits: visits.value,
                        events: events.value,
                        price: price.value,
                    }).then(s=>{
                        handleSave(s)
                        showPlan(s.data.id)
                    }).catch(handleError)

            }
        }))

}


function showPlan(id){
    let p = preparePopupWeb(`plans_${id}`,false,false,true)
        load(`plans`,id).then(plan=>{
            p.append(ce('h1', false, false, plan.name,{
                onclick: function () {
                    edit(`plans`, id, `name`, `text`, plan.name || null, this)
                }
            }))

            p.append(ce('p', false, false, plan.description,{
                onclick: function () {
                    edit(`plans`, id, `description`, `textarea`, plan.description || null, this)
                }
            }))

            p.append(ce(`p`,false,false,`Дней: ${plan.days}.`))
            
            p.append(ce(`p`,false,false,`Ивентов: ${plan.events}.`))
            
            p.append(ce(`p`,false,false,`Коворк: ${plan.visits}.`))

            p.append(deleteButton(`plans`,id,!plan.active,buttonStyle))


            let requests = ce('div')
                requests.append(ce(`h2`,false,false,`Заявки`))
                p.append(requests)
                load(`requestsByPlan`,id).then(reqs=>{
                    reqs.filter(c=>c.active).forEach(r=>{
                        let c = listContainer(r,true)
                            c.classList.add(`flex`)
                            load(`users`,r.user,false,downLoadedUsers).then(u=>{
                                c.append(ce(`button`,false,[`dateButton`,`dark`],uname(u,u.id),{
                                    onclick:()=>showUser(false,u.id)
                                }))

                                c.append(ce(`button`,false,[`dateButton`,`dark`],`Подтвердить`,{
                                    onclick:function(){
                                        let sure = confirm(`Уверены?`)
                                        if(sure){
                                            axios.patch(`/${host}/admin/subscribe/`,{
                                                plan: r.plan,
                                                user: r.user,
                                            })
                                                .then(s=>{
                                                    handleSave(s)
                                                    this.remove()
                                                })
                                                .catch(handleError)
                                        }
                                    }
                                }))

                                c.append(ce(`button`,false,[`dateButton`,`dark`,`active`],`Отклонить`,{
                                    onclick:function(){
                                        let sure = confirm(`Уверены?`)
                                        if(sure){
                                            axios.delete(`/${host}/admin/plansRequests/${r.id}`)
                                                .then(s=>{
                                                    handleSave(s)
                                                    this.parentNode.remove()
                                                })
                                                .catch(handleError)
                                        }
                                    }
                                }))
                            })
                        requests.append(c)
                    })
                })
            
            let users = ce(`div`)
                p.append(users)
                users.append(ce(`h2`,false,false,`Подписки`))
                load(`plansUses`,id).then(uses=>{
                    uses.forEach(u=>{
                        users.append(planUseLine(u))
                    })
                    
                })

        })
}

function planUseLine(line,butUser){
    let c = listContainer(line,true,{
        to: `до`,
        visitsLeft: `посещений`,
        eventsLeft: `мероприятий`
    })
    if(!line.active) c.classList.remove(`hidden`)
    let bc = ce(`div`,false,`flex`)
    c.append(bc)
    if(!butUser) load(`users`,line.user, false, downLoadedUsers).then(u=>{
        bc.append(ce(`button`,false,[`dateButton`,`dark`],uname(u,u.id),{
            onclick:()=>showUser(false,u.id)
        }))
    })
    
    if(butUser) bc.append(ce(`button`,false,[`dateButton`,`dark`],line.name,{
        onclick:()=>showPlan(line.plan)
    }))

    if(line.active){
        bc.append(deleteButton(`plansUsers`,line.id,false,[`active`,`dateButton`],()=>{line.dataset.active = false}))
    }
    return c
}

function showMROptions(record, user, container){
    let c = modal()
        
        c.append(ce(`button`,false,[`dateButton`,`dark`],uname(user,user.id),{onclick:()=>showUser(false,user.id)}))

        if(record.status != `used`) {
            let tv = ce(`div`,false,`flex`)
            c.append(tv)
            
            tv.append(ce(`button`,false,[`dateButton`,`dark`,`active`],`снять запись`,{
                onclick:function(){
                    axios.delete(`/${host}/admin/mr/${record.id}`).then(s=>{
                        handleSave(s)
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
            axios.post(`/${host}/admin/message`,{
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
function showCoworkingOptions(record, user, container){
    let c = modal()
        
        c.append(ce(`button`,false,[`dateButton`,`dark`],uname(user,user.id),{onclick:()=>showUser(false,user.id)}))

        if(user.avatar_id) {
            let picHolder = ce(`img`,false,[`avatar`,`small`])
            c.prepend(picHolder);
            load(`images`,user.avatar_id).then(a=>{
                picHolder.src = a.src
            })
        }

        if(user.bonus && record.status != `used`) c.append(ce(`button`,false,buttonStyle,`Списать первое посещение`,{
            onclick:function(){
                axios.put(`/${host}/admin/coworking/${record.id}`,{
                    attr:   `status`,
                    value:  `used`,
                    by:     `bonus`
                }).then(s=>{
                    handleSave(s)
                    if(s.data.succes) this.remove()
                }).catch(handleError)
            }
        })) 

        if(record.status != `used`) {
            let tv = ce(`div`,false,`flex`)
            c.append(tv)
            tv.append(ce(`button`,false,[`dateButton`,`dark`],`гость пришел`,{
                onclick:function(){
                    axios.put(`/${host}/admin/coworking/${record.id}`,{
                        attr: `status`,
                        value: `used`
                    }).then(s=>{
                        handleSave(s)
                        if(s.data.succes) this.remove()
                    }).catch(handleError)
                }
            }))
            tv.append(ce(`button`,false,[`dateButton`,`dark`,`active`],`снять запись`,{
                onclick:function(){
                    axios.delete(`/${host}/admin/coworking/${record.id}`,{
                        attr: `status`,
                        value: `used`
                    }).then(s=>{
                        handleSave(s)
                        if(s.data.succes) с.remove()
                    }).catch(handleError)
                }
            }))
        }

        if(record.paymentNeeded && user.deposit && !record.isPayed){
            c.append(`У пользователя есть депозит: ${cur(user.deposit)}`)
            if(!record.status != `used`) c.append(ce(`button`,false,buttonStyle,`Списать с депозита (20)`,{
                onclick:function(){
                    axios.put(`/${host}/admin/coworking/${record.id}`,{
                        attr:   `status`,
                        value:  `used`,
                        by:     `deposit`
                    }).then(s=>{
                        handleSave(s)
                        if(s.data.succes) this.remove()
                    }).catch(handleError)
                }
            }))
        }

        if(!user.admin && !user.fellow && !user.insider) {
            let informer = ce(`p`,false,false,`Загружаю подписки...`)
            c.append(informer)
            load(`plansByUser`,user.id)
                .then(plans=>{
                    
                    informer.remove();

                    plans.filter(p=>p.active).forEach(p=>{
                        c.append(ce(`p`,false,false,`Остаток посещений по плану: ${p.visitsLeft}.`))
                        if(p.visitsLeft && record.status != `used`) c.append(ce(`button`,false,buttonStyle,`Списать с плана`,{
                            onclick:function(){
                                axios.put(`/${host}/admin/coworking/${record.id}`,{
                                    attr:   `status`,
                                    value:  `used`,
                                    by:     `plan_${p.id}`
                                }).then(s=>{
                                    handleSave(s)
                                    if(s.data.succes) this.remove()
                                }).catch(handleError)
                            }
                        }))
                    })

                })
        }

    let txt = ce(`textarea`,false,false,false,{placeholder: `Вам слово`})
    c.append(txt)
    c.append(ce(`button`,false,buttonStyle,`Написать`,{
        onclick:function(){
            if(!txt.value) return alert(`Я не вижу ваших букв`)
            this.setAttribute(`disabled`,true)
            axios.post(`/${host}/admin/message`,{
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


function drawSchedule(events, start) {
    let cc = ce('div', false, `scroll`)
    let c = ce('div', false, `flex`)
    cc.append(c)
    let i = 0
    while (i < 30) {
        let day = ce(`div`, false, `date`)
        console.log(events.map(e => e.date))
        let date = new Date(+new Date() + i * 24 * 60 * 60 * 1000)
        let isoDate = date.toISOString().split('T')[0]
        day.append(ce(`h3`, false, (date.getDay() == 0 || date.getDay() == 6) ? `active` : false, drawDate(date)))
        events.filter(e => typeof e.date == `string` && new Date(e.date).toISOString().split('T')[0] == isoDate).forEach(e => {
            day.append(ce('p', false, `hover`, `${drawDate(e.date,false,{time:true})}: ${e.name}`, {
                onclick: () => showClass(e, e.id)
            }))
        })
        c.append(day)
        i++
    }
    return cc
}


function newClass(){
    closeLeft()
    let p = preparePopupWeb(`newClass`,false,false,true,false,`/classes/qATeRPHCEHrFKeO2klJB`)
    p.classList.add('inpC')
    p.append(ce(`h1`,false,false,`Новое мероприятие`))
    
    let name = ce('input',false,false,false,{
        placeholder: `Название`
    })
    p.append(name)

    let img = ce(`input`,false,false,false,{
        type: `text`,
        placeholder: `ссылка на картинку`
    })
    p.append(img)

    let clearPic = ce(`input`,false,false,false,{
        type: `text`,
        placeholder: `ссылка на картинку без текста`
    })
    p.append(clearPic)

    p.append(ce(`a`,false,`whiteLink`,`грузим тут`,{
        href: `https://console.firebase.google.com/u/0/project/paperstuff-620fa/storage/paperstuff-620fa.appspot.com/files/~2Flectures`,
        target: `_blank`
    }))

    let description = ce('textarea',false,false,false,{
        placeholder: `Описание`
    })
    p.append(description)
    let date = ce('input',false,false,false,{
        type: `datetime-local`
    })
    p.append(date)
    let capacity = ce('input',false,false,false,{
        placeholder: `Вместимость`
    })
    p.append(capacity)
    
    let authorName = ce('input',false,false,false,{
        placeholder: `Имя автора строкой`
    })
    p.append(authorName)
    
    let author = selector(`authors`,`выберите ведущего`)
    p.append(author)

    let hall = selector(`halls`,`выберите зал`)
    p.append(hall)

    

    let duration = ce('input',false,false,false,{
        placeholder: `продолжительность`,
        type: `number`,
        min: 0
    })
    p.append(duration)

    let price = ce('input',false,false,false,{
        placeholder:    `стоимость`,
        type:           `number`,
        min:            0
    })

    p.append(price)

    let noRegistration = labelButton(`без регистрации`)
    p.append(noRegistration)

    let admins = labelButton(`только для админов`)
    p.append(admins)

    let fellows = labelButton(`только для fellows`)
    p.append(fellows)


    let sb = ce('button',false,[`dateButton`,`dark`],`Сохранить`,{
        onclick:function(){
            if(
                name.value && 
                description.value &&
                date.value
            ) {
                this.setAttribute(`disabled`,true)
                axios.post(`/${host}/admin/classes`,{
                    name:           name.value,
                    pic:            img.value,
                    description:    description.value,
                    date:           date.value,
                    duration:       duration.value,
                    hall:           hall.value,
                    capacity:       capacity.value,
                    authorName:     authorName.value,
                    author:         author.value,
                    price:          price.value,
                    clearPic:       clearPic.value,
                    noRegistration: noRegistration.querySelector(`input`).checked ? true : false,
                    admins:         admins.querySelector(`input`).checked ? true : false,
                    fellows:        fellows.querySelector(`input`).checked ? true : false
                }).then(s=>{
                    handleSave(s)
                    showClass(false,s.data.id)
                })
                .catch(handleError)
                .finally(()=>{
                    this.removeAttribute(`disabled`)
                })
            }
        }
    })
    p.append(sb)
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
        banks: `рекивзитов`,
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

function showStandAlone(){
    closeLeft()
    let p = preparePopupWeb(`standAlone`,false,false,true,false,false,`Отдельные страницы`)
        // p.append(ce('h1',false,false,`Отдельные страницы`))
        p.append(ce(`button`,false,buttonStyle,`Добавить`,{
            onclick:()=>addStandAlone()
        }))
    load(`standAlone`).then(pages=>{
        pages.forEach(page=>{
            p.append(pageLine(page))
        })
    })
}

function pageLine(page){
    let c = listContainer(page,true)
    if(!page.active){
        c.classList.remove(`hidden`)
    }
    c.append(ce(`h3`,false,false,page.name,{
        onclick:()=>showStandAlonePage(page.id)
    }))
    c.append(ce(`p`,false,false,page.description))
    return c
}


function addStandAlone(){
    let p = preparePopupWeb(`addStandAlone`,false,false,true)
    
    let name = ce('input',false,false,false,{placeholder:`название`,type:`text`})
    let description = ce('textarea',false,false,false,{placeholder:`описание`})
    let slug = ce('input',false,false,false,{placeholder:`slug`,type:`text`})
    let html = ce('textarea',`html`,false,false,{placeholder:`описание`})
    

    p.append(name)
    p.append(description)
    p.append(html)
    p.append(slug)

    tinymce.init({
        selector: '#html',
        // plugins: 'anchor autolink charmap codesample emoticons image link lists media searchreplace table visualblocks wordcount checklist mediaembed casechange export formatpainter pageembed linkchecker permanentpen powerpaste advtable advcode editimage advtemplate mentions tinycomments tableofcontents footnotes mergetags autocorrect typography inlinecss',
        toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table mergetags | addcomment showcomments | spellcheckdialog a11ycheck typography | align lineheight | checklist numlist bullist indent outdent | emoticons charmap | removeformat',
        tinycomments_mode: 'embedded',
        tinycomments_author: 'Author name',
        mergetags_list: [
          { value: 'First.Name', title: 'First Name' },
          { value: 'Email', title: 'Email' },
        ],
        // ai_request: (request, respondWith) => respondWith.string(() => Promise.reject("See docs to implement AI Assistant")),
      });

      p.append(ce(`button`,false,[`dark`,`saveButton`],`Сохранить`,{
        onclick:function(){
            let html = tinymce.activeEditor.getContent("#html");
           if(name.value && description.value && html){
            axios.post(`/${host}/admin/standAlone`,{
                html: html,
                name: name.value,
                description: description.value,
                slug: slug.value
            }).then(s=>{
                handleSave(s)
                showStandAlonePage(s.data.id)
            }).catch(handleError)
           }
        }
      }))

      tinymce.activeEditor.getContent("#html");
}

function showStandAlonePage(pid){
    let p = preparePopupWeb(`standAlone_${pid}`,false,[`static`,pid],true)
        load(`standAlone`,pid).then(page=>{


            p.append(toggleButton(`standAlone`,page.id,`appVisible`,page.appVisible,`Видно в приложении`,`Только для сайта`))

            p.append(ce('h1',false,`clickable`,page.name,{
                onclick: function () {
                    edit(`standAlone`, page.id, `name`, `text`, page.name)
                }
            }))
            
            p.append(ce(`img`, false, `cover`, false, {
                src: page.pic,
                onclick: function () {
                    edit(`standAlone`, page.id, `pic`, `text`, page.pic || null)
                }
            }))

            p.append(ce(`p`,false,false,`Описание (мета): ${page.description}`,{
                onclick: function () {
                    edit(`standAlone`, page.id, `description`, `textarea`, page.pic || null)
                }
            }))

            p.append(ce('textarea',false,false,false,{
                value: page.html
            }))

            tinymce.init({
                selector: 'textarea',
                // plugins: 'anchor autolink charmap codesample emoticons image link lists media searchreplace table visualblocks wordcount checklist mediaembed casechange export formatpainter pageembed linkchecker a11ychecker tinymcespellchecker permanentpen powerpaste advtable advcode editimage advtemplate tableofcontents footnotes mergetags typography inlinecss',
                toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table mergetags | addcomment showcomments | spellcheckdialog a11ycheck typography | align lineheight | checklist numlist bullist indent outdent | emoticons charmap | removeformat',
                tinycomments_mode: 'embedded',
                tinycomments_author: 'Author name',
                mergetags_list: [
                  { value: 'First.Name', title: 'First Name' },
                  { value: 'Email', title: 'Email' },
                ],
                ai_request: (request, respondWith) => respondWith.string(() => Promise.reject("See docs to implement AI Assistant")),
              });

            p.append(ce(`button`,false,buttonStyle,`Сохранить правки в HTML`,{
                onclick:()=>{
                    let html = tinymce.activeEditor.getContent("#html");
                    axios.put(`/${host}/admin/standAlone/${page.id}`,{
                        attr: `html`,
                        value: html
                    }).then(handleSave)
                    .catch(handleError)
                }
            }))

            p.append(deleteButton(`standAlone`,page.id,!page.active,buttonStyle))
        })
}

function showCoworking(){
    
    closeLeft()

    let p = preparePopupWeb(`coworking`,false,false,true,false,false,`Коворкинг`)
    
    p.append(drawCoworkingShedule())


    let c = ce('div')
        p.append(c)
    load(`coworkingDays`,new Date().toISOString().split('T')[0]).then(days=>{
        days.forEach(d=>{
            let day = ce('div')
                day.append(ce(`h2`,false,false,d.date))
                d.records.forEach(r=>{
                    day.append(showCoworkingLine(r))
                })
            c.append(day)
        })
    })
}

function closeHallButton(id){

    return ce(`button`,false,buttonStyle,`Закрыть зал`,{
        onclick:()=>{
            let edit = modal()
            edit.append(ce('h2', false, false, `Закрываем зал`))
                let f = ce('input',false,false,false,{type:`date`});
            edit.append(f)
            edit.append(ce(`button`,false,false,`Сохранить`,{
                onclick:function(){
                    if(f.value){
                        this.setAttribute(`disabled`,true)
                        axios.post(`/${host}/admin/roomsBlockedAdd/${id}`,{
                            date: f.value
                        }).then(handleSave)
                        .catch(handleError)
                        .finally(()=>{
                            f.value = null;
                            this.removeAttribute(`disabled`)
                        })
                    }
                }
            }))
        }
    })
    
}

function showHall(h,id){

    let p = preparePopupWeb(`hall_${id}`)
    window.history.pushState({}, "", `web?page=halls_${id}`);
    
    if(!h) h = load(`halls`,id)

    Promise.resolve(h).then(h=>{

        console.log(h)

        p.append(ce('h1',false,false,h.name))

        p.append(toggleButton(`halls`,h.id,`isCoworking`,h.isCoworking,`это коворкинг`,`это не коворкинг`,[`dateButton`,`dark`]))
        p.append(toggleButton(`halls`,h.id,`isMeetingRoom`,h.isMeetingRoom,`это переговорка`,`это не переговорка`,[`dateButton`,`dark`]))

        p.append(ce('p',false,`editable`,`Название: ${h.name}`,{
            onclick:function(){
                edit(`halls`,id,`name`,`text`,h.name,this)
            }
        }))

        p.append(ce('p',false,`editable`,`Этаж: ${h.floor}`,{
            onclick:function(){
                edit(`halls`,id,`floor`,`number`,h.floor,this)
            }
        }))

        p.append(ce('p',false,`editable`,`Вместимость: ${h.capacity}`,{
            onclick:function(){
                edit(`halls`,id,`floor`,`number`,h.capacity,this)
            }
        }))

        p.append(ce('p',false,`editable`,`${h.description}`,{
            onclick:function(){
                edit(`halls`,id,`description`,`textarea`,h.description,this)
            }
        }))

        p.append(deleteButton(`halls`,id,!h.active,buttonStyle))

        let closures = ce(`div`)

        closures.append(closeHallButton(id))

        p.append(closures)

        load(`roomsBlockedByHall`,id)
            .then(dates=>{
                dates.sort((a,b)=>a.date<b.date?-1:1).forEach(d=>{
                    let c = ce('div',false,`sDivided`)
                    c.append(ce('span',false,`info`,drawDate(d.date)))
                    c.append(ce('button',false,[`dateButton`,`dark`],`снять блокировку`,{
                        onclick:()=>{
                            axios
                                .delete(`/${host}/admin/roomsBlocked/${d.id}`)
                                .then(s=>{
                                    handleSave(s)
                                    if(s.data.succes) c.remove()
                                })
                                .catch(handleError)
                        }
                    }))
                closures.append(c)
            })
        })

        load(`coworkingHalls`,id).then(days=>{
            days.forEach(d=>{
                let day = ce('div')
                    day.append(ce(`h2`,false,false,d.date))
                    d.records.forEach(r=>{
                        day.append(showCoworkingLine(r,true))
                    })
                p.append(day)
            })
        })

    })
}

function showCoworkingLine(r,butHall,butUser){
    
    let c = ce(`div`,false,`sDivided`,false,{
        dataset:{active:r.active}
    })

    c.append(ce(`span`,false,`info`,`бронь от ${drawDate(r.createdAt? r.createdAt._seconds*1000 : 0)} на ${r.date}`))

    c.append(ce('p',false,false,r.payed?`оплачено`:(r.paymentNeeded?'не оплачено':'оплаты не требует')))
    
    

    if(!butUser) load(`users`,r.user, false, downLoadedUsers).then(u=>{
        c.append(ce('button',false,[`dateButton`,`dark`],uname(u,u.id),{
            onclick:()=>showUser(false,u.id)
        }))
    })

    let controls = ce('div',false,`flex`)

    c.append(controls)

    if(!butHall) load(`halls`, r.hall).then(h=>{
        controls.append(ce('button',false,[`dateButton`,`dark`],h.name,{
            onclick:()=>showHall(false,h.id)
        }))
    })
    
    

    if(r.status != `used`) controls.append(deleteButton(`coworking`,r.id,!r.active,buttonStyle))

    if(r.status != `used` && r.active) controls.append(ce(`button`,false,[`dateButton`,`dark`],`гость пришел`,{
        onclick:function(){
            axios.put(`/${host}/admin/coworking/${r.id}`,{
                attr: `status`,
                value: `used`
            }).then(s=>{
                handleSave(s)
                if(s.data.succes) this.remove()
            }).catch(handleError)
        }
    }))

    return c
}

function showSchedule() {
    closeLeft()
    // mc.innerHTML = '<h1>Загружаем...</h1>'
    // window.history.pushState({}, "", `web?page=classes`);
    let p = preparePopupWeb(`classes`,false,false,true,false,false,`Расписание`)
    axios.get(`/${host}/admin/classes`)
        .then(data => {
            console.log(data.data)
            // mc.innerHTML = '';
            // mc.append(ce('h1', false, `header2`, `Расписание`))
            p.append(drawSchedule(data.data))
            let c = ce('div')

            c.append(ce('button',false,[`dark`,`dateButton`,`mTop`],`Добавить событие`,{
                onclick:()=>newClass()
            }))

            data.data.forEach(cl => {
                c.append(showClassLine2(cl))
            });
            p.append(c)


        })
        .catch(err => {
            console.log(err)
            alert(err.message)
        })
}

function showClassLine(cl) {
    let c = ce('div', false, 'sDivided', false, {
        dataset: {
            active: cl.active
        },
        onclick: () => {
            showClass(cl)
        }
    })
    let details = ce('div',false,`details`)
    c.append(details)
        details.append(ce(`span`,false,`info`,drawDate(cl.createdAt._seconds*1000)))
        if(cl.visitors) details.append(ce(`span`,false,`info`,cl.visitors?`гостей: ${cl.visitors}`:''))
        if(cl.views) details.append(ce(`span`,false,`info`,cl.views?`просмотров: ${cl.views}`:''))
        if(cl.rate)  details.append(ce(`span`,false,`info`,`оценка: ${cl.rate}`))
        if(cl.admins)  details.append(ce(`span`,false,`info`,`только для админов`))
        if(cl.fellows)  details.append(ce(`span`,false,`info`,`только для fellows`))
        
        c.append(ce('h2', false, false, cl.name))

    c.append(ce('p', false, false, `${drawDate(cl.date)} @ ${cl.hallName}`))
    return c
}

function classAlerts(cl){
    let alerts = [];

    if(!cl.description) alerts.push(`нет описания`)
    if(!cl.clearPic)    alerts.push(`нет картинки без буковок`)
    if(!cl.slides)      alerts.push(`нет презентации`)
    

    return alerts;
}

function showClassLine2(cl) {

    let c = listContainer(cl,true,{
        visitors: `гостей`,
        rate: `оценка`,
        admins: `только для админов`,
        fellows: `только для fellows`
    },false,classAlerts(cl))
    
    c.append(ce('h3', false, false, cl.name,{
        onclick:()=>showClass(false,cl.id)
    }))

    c.append(ce('p', false, false, `${drawDate(cl.date)} @ ${cl.hallName}`))
    return c
}

function addComment(c, id) {
    let comment = prompt(`О чем предупредить администратора?`)
    if (!comment) return alert(`запрос прерван`)
    axios.put(`/${host}/admin/ticket/?ticket=${id}`, {
        value: comment,
        attr: `comment`
    }).then(s => {
        alert(`ok`)
        c.innerHTML = comment
    }).catch(err => {
        alert(err.message)
    })
}



function filterUsers(role, container, button,counter,selector,fo) {
    let userFilters = fo ||userFilters
    let c = button.parentNode;
        
        let toBeOff = button.classList.value.indexOf('active') >- 1

        c.querySelectorAll('button').forEach(b => {
            b.classList.remove('active')
            b.classList.add('passive')
            userFilters[b.dataset.filter] = false;
        })

        if(role) userFilters[role] = !toBeOff

    if(!toBeOff){
        button.classList.add('active')
        button.classList.remove('passive')
    }
        
    let cnt = 0
    container.querySelectorAll(selector||'.userLine').forEach(user => {
        // if (!role) return user.classList.remove('hidden')
        
        let passed = true;

        Object.keys(userFilters).filter(t=>userFilters[t]).forEach(t=>{
            if (user.dataset[t] != 'true') {
                passed = false;    
            } else {
                // 
            }
        })

        if(passed){
            user.classList.remove('hidden')
            cnt++
        } else {
            user.classList.add('hidden')
        }
    })

    if(counter) counter.innerHTML = `Всего: ${cnt}`
}




function showViews(){
    let events = {};
    let offset = 100
    let p = preparePopupWeb(`views`,false,false,true)
        let c = ce(`div`)
        p.append(c)
    load(`views`)
        .then(views=>{
            views.forEach((v,i)=>{
                c.append(showViewLine(v))
            })
        })
}


function showClass(cl, id) {
    let p = preparePopupWeb(
        `classes_${cl.id || id}`,
        `class_${cl.id|| id}`,
        [`classes`, cl.id || id],
        true,
        logButton(`class`,cl.id||id,`логи`),
        `/classes/${id}`,
        )
    
    // p.append()

    if (!cl) {
        cl = load(`classes`, id)
    }
    Promise.resolve(cl).then(cl => {
        
        if(new Date()<new Date(cl.date)){
            let mBox = ce(`div`,false,`flex`)
                p.append(mBox)
            
            mBox.append(ce(`button`,false,buttonStyle,`Отправить себе`,{
                onclick:()=>{
                    axios.get(`/${host}/admin/alertClass/${cl.id}?self=true`)
                        .then(handleSave)
                        .catch(handleError)
                }
            }))

            mBox.append(ce(`button`,false,buttonStyle,`Рассылка по админам`,{
                onclick:()=>{
                    let sure = confirm(`Стартуем по админам. Точно?`)
                    if(sure) axios.get(`/${host}/admin/alertClass/${cl.id}?admins=true`)
                        .then(handleSave)
                        .catch(handleError)
                }
            }))
            mBox.append(ce(`button`,false,buttonStyle,`Рассылка по пользователям`,{
                onclick:function(){
                    let sure = confirm(`Стартуем по всем. Точно?`)
                    if(sure) {
                        this.remove();
                        axios.get(`/${host}/admin/alertClass/${cl.id}`)
                            .then(handleSave)
                            .catch(handleError)
                    }
                }
            }))
        }
        
        let picDiv= ce('div',false,`flex`)
        p.append(picDiv)

        picDiv.append(ce(`img`, false, `cover`, false, {
            src: cl.pic,
            onclick: function () {
                edit(`classes`, cl.id, `pic`, `text`, cl.pic || null)
            }
        }))

        picDiv.append(ce(`img`, false, `cover`, false, {
            src: cl.clearPic,
            onclick: function () {
                edit(`classes`, cl.id, `clearPic`, `text`, cl.clearPic || null)
            }
        }))

        p.append(ce('h1', false, false, cl.name,{
            onclick: function () {
                edit(`classes`, cl.id, `name`, `text`, cl.name || null, this)
            }
        }))

        p.append(ce('h3', false, false, cl.subTitle || `Без подзаголовка`,{
            onclick: function () {
                edit(`classes`, cl.id, `subTitle`, `text`, cl.subTitle || null, this)
            }
        }))


        if(cl.slides) {
            p.append(ce('a', false, false, `Скачать презентацию`,{
                href: cl.slides,
            }))
        }
        p.append(ce('p', false, false, cl.slides ? `ссылка на презентацию: ${cl.slides}`: `добавьте ссылку на презентацию`,{
            onclick: function () {
                edit(`classes`, cl.id, `slides`, `text`, cl.slides || null, this)
            }
        }))

        if(cl.rate) p.append(ce('h3',false,false,`Оценка: ${cl.rate}`))

        let alertsContainer = ce('div', false, 'flex')

            alertsContainer.append(toggleButton(`classes`,cl.id,`admins`,cl.admins,`только для админов`,`не для админов`,buttonStyle))
            alertsContainer.append(toggleButton(`classes`,cl.id,`fellows`,cl.fellows,`только для fellows`,`не для fellows`,buttonStyle))

            if (cl.noRegistration) alertsContainer.append(ce(`button`, false, `accent`, `регистрация закрыта`))
            if (!cl.capacity) alertsContainer.append(ce(`button`, false, `accent`, `вместимость не указана`))
            if (!cl.pic) alertsContainer.append(ce(`button`, false, `accent`, `картинка не указана`))
        p.append(alertsContainer)

        if (!cl.authorId) alertsContainer.append(ce(`button`, false, buttonStyle, `выбрать автора`, {
            onclick: () => edit(`classes`, cl.id, `authorId`, `authorId`, null)
        }))

        



        p.append(ce('p', false, false, `Текст приветствия (после подтверждения билета): ${cl.welcome || `не указан`}`,{
            onclick: function () {
                edit(`classes`, cl.id, `welcome`, `textarea`, cl.welcome || null, this)
            }
        }))

        if (cl.author) {
            p.append(ce('p', false, false, `автор (строкой): ${cl.author}`,{
                onclick:function(){
                    edit(`classes`, cl.id, `author`, `text`, cl.author,this)
                }
            }))
        }

        if (cl.authorId) {
            p.append(ce(`button`, false, `accent`, `автор ${cl.authorName}`, {
                onclick: () => edit(`classes`, cl.id, `authorId`, `authorId`, cl.authorId)
            }))
        }


        if (!cl.feedBackSent && new Date()>new Date(cl.date)) {
            p.append(ce(`button`, false, buttonStyle, `Отправить запрос на отзывы`, {
                onclick: function () {
                    this.setAttribute(`disabled`, true)
                    axios
                        .post(`/${host}/admin/classReviews/${cl.id}`)
                        .then(handleSave)
                        .catch(handleError)
                        .finally(() => {
                            this.remove()
                        })
                }
            }))
        }

        let det = ce(`div`,false,[`flex`,`spread`])
        
        p.append(det)


        det.append(ce('p', false, `hover`, `цена: ${cur(cl.price,`GEL`)}`,{
            onclick: function () {
                edit(`classes`, cl.id, `price`, `number`, cl.price || null, this)
            }
        }))


        det.append(ce('p', false, `hover`, `${drawDate(cl.date,'ru',{time:true})}`,{
            onclick: function () {
                edit(`classes`, cl.id, `date`, `datetime-local`, cl.date || null)
            } 
        }))

        det.append(ce('p', false, `hover`, `продолжительность ${cl.duration} мин.`,{
            onclick: function () {
                edit(`classes`, cl.id, `duration`, `number`, cl.duration || null)
            }
        }))

        det.append(ce(`p`,false,`hover`,`Вместимость: ${cl.capacity}`,{
            onclick: function () {
                edit(`classes`, cl.id, `capacity`, `number`, cl.capacity || null, this)
            }
        }))

        p.append(ce('p', false, `clickable`, `@${cl.hallName}`, {
            onclick: () => showHall(false, cl.hall)
        }))

        p.append(ce('p', false, [`story`,`hover`], cl.description || `Добавьте описание`,{
            onclick: function () {
                edit(`classes`, cl.id, `description`, `textarea`, cl.description || null, this)
            }
        }))


        let qBox = ce(`div`)
        p.append(qBox)
        load(`userClassesQ`,false,{class:cl.id}).then(q=>{
            if(q.length){
                qBox.append(ce(`h3`,false,false,`Вопросы от гостей:`))
                q.forEach(question=>{
                    qBox.append(showQLine(question))
                })
            }
        })

        let guests = ce('div');

        p.append(guests)

        let gbox = ce('div',false,`flex`)
            p.append(gbox)

        
        gbox.append(ce(`button`,false,[`dateButton`,`dark`],`Добавить гостя`,{
            onclick:()=>addGuest(cl.id,guests)
        }))
        gbox.append(ce('button', false, `dateButton`, `Показать гостей`, {
            dataset: {
                booked: 1
            },
            onclick: function () {
                this.remove()
                axios.get(`/paper/admin/class?class=${cl.id}`)
                    .then(data => {
                        let rating = data.data.filter(t => t.rate).map(t => t.rate)

                        if (rating.length) {

                            let av = (rating.reduce((a, b) => a + b, 0) / rating.length).toFixed(2)

                            guests.prepend(ce('h4', false, 'light', `Рейтинг ${av} (${rating.length} голосов)`))
                        }


                        guests.append(ce(`p`, false, false, `Гостей: ${data.data.length}${cl.price ? ` // оплачено ${data.data.filter(g=>g.isPayed).length}` : ''}${` // пришли ${data.data.filter(g=>g.status == 'used').length}`}`))
                        data.data.forEach(t=>{
                            guests.append(showTicketLine(t,true))
                        })
                        
                        // guests.innerHTML += `<table><tr><th>Имя</th><th>оценка</th><th>💲</th><th>📍</th><th>примечания админу</th></tr>
                        //         ${data.data.map(u=>`<tr class="story">
                        //             <td onclick="showUser(false,${u.user})">${u.userName}</td>
                        //             <td>${u.rate ? u.rate : '-'}</td>
                        //             <td>${cl.price ? (u.isPayed?'✔️':'❌') : '🚫'}</td>
                        //             <td>${(u.status == 'used'? '✔️' : '❌')}</td>
                        //             <td class="editable" onclick=addComment(this,"${u.id}")>${u.comment || `без примечаний`}</td>
                        //         </tr>`).join('')}</table>`
                    })
            }
        }))

         
        gbox.append(ce('button', false, `dateButton`, `Написать гостям`, {
            dataset: {
                booked: 1
            },
            onclick: function () {
                this.remove;

                let txt = ce('textarea', false, false, false, {
                    placeholder: `Вам слово`
                })

                let type = ce('select')

                type.append(ce('option', false, false, `Всем`, {
                    value: `all`
                }))

                type.append(ce('option', false, false, `Пришедшим`, {
                    value: `inside`
                }))

                type.append(ce('option', false, false, `Опоздантам`, {
                    value: `outside`
                }))

                p.append(txt)
                p.append(type)


                p.append(ce('button', false, `dateButton`, `Отправить`, {
                    dataset: {
                        booked: 1
                    },
                    onclick: function () {

                        if (!txt.value) return alert(`Я не вижу ваших букв!`)

                        this.setAttribute(`disabled`, true)

                        axios.post(`/paper/admin/announce`, {
                            class: cl.id,
                            type: type.value,
                            text: txt.value
                        }).then(s => {
                            alert(`ok`)
                            txt.value = null;
                        }).catch(err => {
                            alert(err.message)
                        }).finally(() => {
                            this.removeAttribute('disabled')
                        })

                    }
                }))
            }
        }))

        gbox.append(ce(`button`, false, `dateButton`, `Показать лист ожидания`, {
            dataset: {
                booked: 1
            },
            onclick: () => {
                
                axios.get(`/${host}/admin/classWL?class=${cl.id}`).then(d => {
                    let wl = ce('div')
                    let t = ce('table')
                    let n = ce(`tr`)
                    n.append(ce(`th`, false, false, `гость`))
                    n.append(ce(`th`, false, false, `дата`))
                    n.append(ce(`th`, false, false, `статус`))
                    t.append(n)
                    
                    if(!d.data.length) return alert(`Список пуст!`)

                    d.data.sort((a, b) => a.createdAt._seconds - b.createdAt._seconds).forEach(rec => {
                        let line = ce('tr')
                        line.append(ce(`td`, false, false, uname(rec.user, rec.user.id)))
                        line.append(ce(`td`, false, false, drawDate(rec.createdAt._seconds * 1000, `ru`, {
                            time: true
                        })))
                        line.append(ce(`td`, false, false, rec.active))
                        t.append(line)
                    })

                    wl.append(t)
                    p.append(wl)
                })
                
            }
        }))

        gbox.append(ce(`button`, false, `dateButton`, `Запостить в канал`, {
            dataset: {
                booked: 1
            },
            onclick: () => {
                axios.post(`/${host}/admin/channel?class=${cl.id}`)
                    .then(s => {
                        alert(`ok`)
                    })
                    .catch(err => {
                        alert(err.message)
                    })
            }
        }))
    })

}

function showTickets(){
    closeLeft();
    let p = preparePopupWeb(`tickets`,false,false,true,false,false,`Билеты`)
    // p.append(ce(`h1`,false,false,`Билеты`))
    load(`userClasses`).then(plans=>{

        let c = ce('div')
        
        plans.forEach(plan=>{
            c.append(showTicketLine(plan))
        })

        let offset = 0;

        

        // let cc = ce('div', false, `controls`)
        
        // cc.append(sortBlock([{
        //     attr: `name`,
        //     name: `По названию`
        // }, {
        //     attr: `views`,
        //     name: `По просмотрам`
        // }, {
        //     attr: `createdAt`,
        //     name: `По дате создания`
        // }], c, plans, showTicketLine, buttonStyle))

        // p.append(cc)

        // c.append(ce('button', false, buttonStyle, `Добавить тариф`, {
        //     onclick: () => newPlan()
        // }))
        
        p.append(c)

        p.append(ce(`button`,false,buttonStyle,`Еще`,{
            onclick:function(){
                offset = offset+100;
                load(`userClasses`,false,{offset:offset})
                    .then(tickets=>{
                        if(tickets.length<100) this.remove()
                        tickets.forEach(t=>{
                            c.append(showTicketLine(t))
                        })
                        
                    })
            }
        }))

        p.append(archiveButton(c,buttonStyle))
        
    })   
}

function showTicketLine(t,butName){
    let c = listContainer(t,true,{
        date:       `Дата`,
        comment:    `Примечание`
    })

    if(t.isPayed) c.dataset.payed = true

    if(!butName) c.append(ce(`h3`,false,false,t.className,{
        onclick:()=>showTicket(false,t.id)
    }))
    c.append(ce(`a`,false,`thin`,t.userName,{
        onclick:()=>showUser(false,t.user)
    }))

    let controls = ce('div',false,`flex`)
    c.append(controls)




    if(!t.isPayed) {
        controls.append(ce(`button`,false,[`dateButton`,`dark`],`Отметить оплаченным`,{
            onclick:function(){
                axios.put(`/${host}/admin/userClasses/${t.id}`,{
                    attr: `isPayed`,
                    type: `date`,
                    value: new Date()
                }).then(s=>{
                    handleSave(s)
                    c.dataset.payed = true;
                    this.remove()
                }).catch(handleError)
            }
        })) 
    }

    if(t.active && t.status != `used`) {
        controls.append(ce(`button`,false,[`dateButton`,`dark`],`Гость пришел`,{
            onclick:function(){
                axios.put(`/${host}/admin/userClasses/${t.id}`,{
                    attr: `status`,
                    value: `used`
                }).then(s=>{
                    handleSave(s)
                    c.dataset.used = true;
                    this.remove()
                }).catch(handleError)
            }
        })) 
    }

    controls.append(deleteButton(`userClasses`,t.id,!t.active,[`active`,`dateButton`,`dark`]))

    return c
}


function showTicket(t,id){
    let p = preparePopupWeb(`tickets_${id}`,false, [`tickets`, id],true)
    
    load(`userClasses`,id).then(ticket=>{
        
        p.append(ce(`img`,false,'ticketQR',false,{
            src: `/paper/qr?id=${id}&entity=userClasses`,
            dataset:{active:ticket.active}
        }))

        p.append(ce('h1',false,false,`Билет ${id}`))
        let det = ce('div',false,[`details`,`mb`])
            det.append(ce('span',false,`info`,`${drawDate(ticket.createdAt._seconds*1000,false,{time:true})} => ${drawDate(ticket.date,false,{time:true})}`))
        
        p.append(det)

        p.append(ce(`p`,false,false,`Примечание для контролера: ${ticket.comment || `отсутсвует`}`,{
            onclick:function(){
                edit(`userClasses`,id,`comment`,`textarea`,ticket.comment,this)
            }
        }))

        let cont = ce(`div`,false,`flex`)

        p.append(cont)
        cont.append(ce('button',false,[`dateButton`,`dark`],ticket.className,{
            onclick:()=>showClass(false,ticket.class)
        }))

        let user = ce('div')
        
        cont.append(user)


        let contr = ce('div',false,`flex`)
        p.append(contr)

        

        contr.append(deleteButton(`userClasses`,id,!ticket.active,[`dateButton`,`dark`]))

        if(!ticket.status){
            contr.append(ce(`button`,false,[`dateButton`,`dark`],`Отметить как использованный`,{
                onclick:function(){
                    this.remove();
                    axios.put(`/${host}/admin/userClasses/${id}`,{
                        attr: `status`,
                        value: `used`
                    }).then(handleSave)
                    .catch(handleError)
                }
            }))
        }

        load(`users`,ticket.user, false, downLoadedUsers).then(u=>{
            user.append(ce('button',false,[`dateButton`,`dark`],uname(u,u.id),{
                onclick:()=>showUser(u,u.id)
            }))
        })

    })
}

function showLogs() {
    window.history.pushState({}, "", `web?page=users`);
    setTimeout(()=>{
        window.location.reload()
    },100)
    
}

function showUsersChart(userData) {


    am5.ready(function () {

        // Create root element
        // https://www.amcharts.com/docs/v5/getting-started/#Root_element
        var root = am5.Root.new("chartdiv");


        // Set themes
        // https://www.amcharts.com/docs/v5/concepts/themes/
        root.setThemes([
            am5themes_Animated.new(root)
        ]);


        // Create chart
        // https://www.amcharts.com/docs/v5/charts/xy-chart/
        var chart = root.container.children.push(am5xy.XYChart.new(root, {
            panX: true,
            panY: true,
            wheelX: "panX",
            wheelY: "zoomX",
            pinchZoomX: true
        }));


        // Add cursor
        // https://www.amcharts.com/docs/v5/charts/xy-chart/cursor/
        var cursor = chart.set("cursor", am5xy.XYCursor.new(root, {
            behavior: "none"
        }));
        cursor.lineY.set("visible", false);


        // Generate random data
        var date = new Date();

        date.setHours(0, 0, 0, 0);

        var value = 100;

        function generateData() {
            value = Math.round((Math.random() * 10 - 5) + value);
            am5.time.add(date, "day", 1);
            return {
                date: date.getTime(),
                value: value
            };
        }

        function generateDatas(count) {
            var data = [];
            for (var i = 0; i < count; ++i) {
                data.push(generateData());
            }
            return data;
        }


        // Create axes
        // https://www.amcharts.com/docs/v5/charts/xy-chart/axes/
        var xAxis = chart.xAxes.push(am5xy.DateAxis.new(root, {
            maxDeviation: 0.2,
            baseInterval: {
                timeUnit: "day",
                count: 1
            },
            renderer: am5xy.AxisRendererX.new(root, {}),
            tooltip: am5.Tooltip.new(root, {})
        }));

        var yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {
                pan: "zoom"
            })
        }));


        // Add series
        // https://www.amcharts.com/docs/v5/charts/xy-chart/series/
        var series = chart.series.push(am5xy.LineSeries.new(root, {
            name: "Series",
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: "value",
            valueXField: "date",
            tooltip: am5.Tooltip.new(root, {
                labelText: "{valueY}"
            })
        }));


        // Add scrollbar
        // https://www.amcharts.com/docs/v5/charts/xy-chart/scrollbars/
        chart.set("scrollbarX", am5.Scrollbar.new(root, {
            orientation: "horizontal"
        }));


        // Set data


        var data = userData;

        // generateDatas(1200);

        series.data.setAll(data);


        // Make stuff animate on load
        // https://www.amcharts.com/docs/v5/concepts/animations/
        series.appear(1000);
        chart.appear(1000, 100);

    }); // end am5.ready()
}

function showRC(){
    closeLeft()
    let p = preparePopupWeb(`rc`,false,false,true,false,false,`Random Coffee`)
    let usersC = ce('div')
    let listing = ce('div')
    
    p.append(ce('button',false,buttonStyle,`Запустить подготовку`,{
        onclick:function(){
            let sure = confirm(`Уверены?`)
            if(sure) {
                this.setAttribute(`disabled`,true)
                axios.post(`/${host}/admin/rc`)
                    .then(handleSave)
                    .catch(handleError)
            }
        }
    }))

    p.append(usersC)
    p.append(listing)

    listing.append(ce(`h2`,false,false,`Список встреч:`))

    load(`rcParticipants`).then(users=>{
        usersC.append(ce('h3',false,false,`Участников: ${users.length}`))
        usersC.append(ce(`button`,false,[`dateButton`,`dark`],`Показать`,{
            onclick:function(){
                this.remove()
                users.forEach(u=>{
                    usersC.append(showUserLine(u,u.randomCoffeePass?`пас`:`в игре`))
                })
            }
        }))
    })

    load(`rcIterations`).then(col=>{
        col.forEach(i=>{
            listing.append(rcIterationLine(i))
        })
    })
    
    
}

function rcIterationLine(i){
    let c = listContainer(i,true,{
        couples:    `пар`,
        meets:      `встреч`
    })
    
    if(!i.active) c.classList.remove(`hidden`);

    c.append(ce(`h3`,false,false,drawDate(i.createdAt._seconds*1000),{
        onclick:()=>{
            showRCIteration(i.id)
        }
    }))
    return c
}

function showRCIteration(id){
    let p = preparePopupWeb(`rc_${id}`,false,false,true);
    
    load(`rcIterations`,id).then(i=>{

        p.append(ce(`h2`,false,false,drawDate(i.createdAt._seconds*1000)))

        if(!i.started){
            p.append(ce(`button`,false,[`dateButton`,`dark`],`Стартовать круг`,{
                onclick:function(){
                    this.remove()
                    axios.post(`/${host}/admin/rcStart/${id}`)
                        .then(handleSave)
                        .catch(handleError)
                }
            }))
        } else {
            if(i.followUp) {
                p.append(ce(`p`,false,false,`Запрос на отзывы отправлен ${drawDate(i.followUp._seconds*1000)}`))
                
                p.append(ce(`button`,false,[`dateButton`,`dark`],`Запросить статистику`,{
                    onclick:function(){
                        this.remove()
                        axios.get(`/${host}/admin/rcFollowUp/${id}`)
                            .then(handleSave)
                            .catch(handleError)
                    }
                }))

            } else {
                p.append(ce(`button`,false,[`dateButton`,`dark`],`Отправить запрос на отзывы`,{
                    onclick:function(){
                        this.remove()
                        axios.post(`/${host}/admin/rcFollowUp/${id}`)
                            .then(handleSave)
                            .catch(handleError)
                    }
                }))
            }
        }
        

        

        load(`rc`,false,{iteration:id}).then(coffees=>{
            p.append(ce(`h3`,false,false,`Встречи`))
            coffees.forEach(couple=>{
                p.append(rcLine(couple))
            })
        })
    })
        
}

function rcLine(couple){
    let c = ce('div',false,[`sDivided`,`flex`])
        c.append(ce(`span`,false,`info`,drawDate(couple.createdAt._seconds*1000)))
        let users = ce(`div`,false,`flex`)
        c.append(users)
    load(`users`,couple.first, false, downLoadedUsers).then(f=>{
        users.append(ce('button',false,[`dark`,`dateButton`,((couple.proof && couple.proof.first) ? `fineButton` : (couple.proof && couple.proof.hasOwnProperty(`first`) ? `sadButton` : `reg`))],uname(f,f.id),{
            onclick:()=>showUser(f,f.id)
        }))
        load(`users`,couple.second, false, downLoadedUsers).then(s=>{
            users.append(ce('button',false,[`dark`,`dateButton`,((couple.proof && couple.proof.second) ? `fineButton` : (couple.proof && couple.proof.hasOwnProperty(`second`) ? `sadButton` : `reg`))],uname(s,s.id),{
                onclick:()=>showUser(s,s.id)
            }))    
        })
    })
    return c;
}



function showUsers() {
    
    

    closeLeft()
    // mc.innerHTML = '<h1>Загружаем...</h1>'
    
    // window.history.pushState({}, "", `web?page=users`);

    let mc = preparePopupWeb(`users`,false,false,true,false,false,`Пользователи`)

    axios.get(`/${host}/admin/users`)
        .then(data => {
            console.log(data.data)
            // mc.innerHTML = '';
            
            let c = ce('div')

            let counter = ce('h4',false,`mtop`)

            let chart = ce(`div`, `chartdiv`,`hidden`)

            mc.append(ce(`button`,false,[`dateButton`,'dark'],`Показать график`,{
                onclick:function(){
                    chart.classList.remove(`hidden`)
                    showUsersChart(d)
                    this.remove();
                }
            }))

            mc.append(chart)

            let udata = {}

            counter.innerHTML = `Всего: ${data.data.users.length}`

            data.data.users.forEach(cl => {
                let d = new Date(cl.createdAt._seconds * 1000).toISOString().split('T')[0]
                if (!udata[d]) udata[d] = 0
                udata[d]++
                c.append(showUserLine(cl))
            });

            let d = Object.keys(udata).map(date => {
                return {
                    date: +new Date(date),
                    value: udata[date]
                }
            })


            let filterTypes = {
                blocked:    `Вышли из чата`,
                admin:      `админы`,
                insider:    `редакция`,
                fellow:     `fellows`,
            }

            let fc = ce('div',false,`flex`)
            mc.append(fc)
            
            Object.keys(filterTypes).forEach(type => {
                fc.append(ce('button', false, [type,`dateButton`,`dark`], filterTypes[type], {
                    dataset:{filter:type},
                    onclick: function () {
                        filterUsers(type, c, this, counter,false,userFilters)
                    }
                }))
            })

            

            {
                let occup = ce('div',false,`flex`)

                mc.append(occup)
                
                let filterTypes = {
                    it:             `IT`,
                    media:          `Журналисты`,
                    advertisement:  `реклама и PR`,
                    other:          `разное`,
                    lawyer:         `Юриспруденция`,
                    // randomCoffee:   `random coffee members`,
                    // noAbout:        `без описания`
                }
    
                Object.keys(filterTypes).forEach(type => {
                    occup.append(ce('button', false, [type,`dateButton`,`dark`], filterTypes[type], {
                        dataset:{filter:type},
                        onclick: function () {
                            filterUsers(type, c, this,counter,false,userFilters)
                        }
                    }))
                })
            }

            {
                let occup = ce('div',false,`flex`)

                mc.append(occup)

                let filterTypes = {
                    // it:             `IT`,
                    // media:          `Журналисты`,
                    // advertisement:  `реклама и PR`,
                    // other:          `разное`,
                    // lawyer:         `Юриспруденция`,
                    randomCoffee:   `random coffee members`,
                    noAbout:        `без описания`
                }
    
                Object.keys(filterTypes).forEach(type => {
                    occup.append(ce('button', false, [type,`dateButton`,`dark`], filterTypes[type], {
                        dataset:{filter:type},
                        onclick: function () {
                            filterUsers(type, c, this,counter,false,userFilters)
                        }
                    }))
                })
            }

            let sortTypes = {
                appOpens:           `По частоте использования`,
                classes:            `По количеству лекций`,
                coworkingVisits:    `По использованию коворкинга`,
            }

            let sortBlock = ce(`div`,false,`flex`)
            
            mc.append(sortBlock)

            Object.keys(sortTypes).forEach(type => {
                sortBlock.append(ce('button', false, [type,`dateButton`,`dark`], sortTypes[type], {
                    onclick: function () {
                        c.innerHTML = ''
                        data.data.users.sort((a, b) => (b[type] || 0) - (a[type] || 0)).forEach(cl => {
                            c.append(showUserLine(cl, (cl[type] || 0)))
                        });
                    }
                }))
            })

            mc.append(counter)
            mc.append(c)

        })
        .catch(err => {
            alert(err.message)
        })
}


function showUserLine(u, cnt) {
    let c = ce(`div`, false, `userLine`, false, {
        dataset: {
            randomCoffee: u.randomCoffee,
            active:     u.active,
            noAbout:    !u.about,
            blocked:    !u.active,
            admin:      u.admin,
            fellow:     u.fellow,
            insider:    u.insider,
            it:         u.occupation ? (u.occupation == 'it' ? true : false) : null,
            media:      u.occupation ? (u.occupation == 'media' ? true : false) : null,
            advertisement: u.occupation ? (u.occupation == 'advertisement' ? true : false) : null,
            other:      u.occupation ? (u.occupation == 'other' ? true : false) : null,
            lawyer:     u.occupation ? (u.occupation == 'lawyer' ? true : false) : null,
        }
    })

    c.append(ce('h3', false, false, (cnt ? `${cnt}: ` : '') + uname(u, u.id), {
        onclick: () => {
            showUser(u)
        }
    }))

    return c;
}


function showMeetingRoom(){
    let p = preparePopupWeb(`mr`,false,false,true,false,false,`Переговорка`)
    load(`mr`).then(data=>{
        let cc = ce('div', false, `scroll`)
        let c = ce('div', false, `flex`)
        cc.append(c)
        p.append(cc)

        let i = 0
        while (i < 30) {
            let day = ce(`div`, false, `date`)
            
            let date = new Date(+new Date() + i * 24 * 60 * 60 * 1000)
            
            let isoDate = date.toISOString().split('T')[0]
            
            day.append(ce(`h3`, false, (date.getDay() == 0 || date.getDay() == 6) ? `active` : false, drawDate(date)))
            
            let shift = 0

            let start = new Date().setHours(10, 0, 0);

            while (shift < 12) {
                let time = new Date(+start + shift * 60 * 60 * 1000).toTimeString().split(' ')[0].split(':').slice(0, 2).join(':');
                let time2 = new Date(+start + shift * 60 * 60 * 1000 + 30 * 60 * 1000).toTimeString().split(' ')[0].split(':').slice(0, 2).join(':');

                let f1 = data
                    .filter(e => typeof e.date == `string` && new Date(e.date).toISOString().split('T')[0] == isoDate)
                    .filter(e => e.time == time)
                    .filter(e => e.active)[0]

                if(f1){
                    let rec = ce('div',false,`recordLine`,false,{
                        // dataset:{hall:e.hall}
                    })
                        rec.append(ce(`span`,false,`info`,time))
                        
                        load(`users`,f1.user, false, downLoadedUsers).then(u=>
                            rec.append(ce(`button`,false,[`dark`,`dateButton`,((f1.payed||!f1.paymentNeeded)?'fineButton':'reg'),f1.status==`used`?`active`:'reg'],unameShort(u,u.id),{
                                // onclick:()=> showUser(u,u.id)
                                onclick:function(){
                                    showMROptions(f1,u,this)
                                }
                            }))
                        )
                    day.append(rec)
                } else {
                    let rec = ce('div',false,`recordLine`,false,{
                        dataset:{active:false}
                    })
                        rec.append(ce(`span`,false,`info`,time))
                        
                        rec.append(ce(`button`,false,[`dark`,`dateButton`,'fineButton'],`пусто`,{
                        //    disabled: true
                            onclick:()=>occupyMR(isoDate,time,rec)
                        }))
                    day.append(rec)
                }

                let f2 = data
                    .filter(e => typeof e.date == `string` && new Date(e.date).toISOString().split('T')[0] == isoDate)
                    .filter(e => e.time == time2)
                    .filter(e => e.active)[0]

                if(f2){
                    let rec = ce('div',false,`recordLine`,false,{
                        // dataset:{hall:e.hall}
                    })
                    let e = f2;
                        rec.append(ce(`span`,false,`info`,e.time))
                        
                        load(`users`,e.user, false, downLoadedUsers).then(u=>
                            rec.append(ce(`button`,false,[`dark`,`dateButton`,((e.payed||!e.paymentNeeded)?'fineButton':'reg'),e.status==`used`?`active`:'reg'],unameShort(u,u.id),{
                                onclick:function(){
                                    showMROptions(e,u,this)
                                }
                            }))
                        )
                    day.append(rec)
                } else {
                    let rec = ce('div',false,`recordLine`,false,{
                        dataset:{active:false}
                    })
                        rec.append(ce(`span`,false,`info`,time2))
                        
                        rec.append(ce(`button`,false,[`dark`,`dateButton`,'fineButton'],`пусто`,{
                        //    disabled: true
                            onclick:()=>occupyMR(isoDate,time2,rec)
                        }))
                    day.append(rec)
                }

                shift++
            }


            // data
            //     .filter(e => typeof e.date == `string` && new Date(e.date).toISOString().split('T')[0] == isoDate)
            //     .sort((a,b)=>b.time<a.time?1:-1)
            //     .forEach(e => {
            //         let rec = ce('div',false,`recordLine`,false,{
            //             // dataset:{hall:e.hall}
            //         })
            //             rec.append(ce(`span`,false,`info`,e.time))
                        
            //             load(`users`,e.user).then(u=>
            //                 rec.append(ce(`button`,false,[`dark`,`dateButton`,((e.payed||!e.paymentNeeded)?'fineButton':'reg'),e.status==`used`?`active`:'reg'],unameShort(u,u.id),{
            //                     // onclick:()=> showUser(u,u.id)
            //                     onclick:function(){
            //                         showCoworkingOptions(e,u,this)
            //                     }
            //                 }))
            //             )
            //         day.append(rec)
            //     })

            c.append(day)
            i++
        }   

    })
}

function addUser(collection,id){
    let p = modal()

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
                                suggest.append(ce(`button`,false,buttonStyle,uname(u,u.id),{
                                    onclick:function(){
                                        this.setAttribute(`disabled`,true)
                                        axios.put(`/${host}/admin/${collection}/${id}`,{
                                            attr:   `user`,
                                            value:  +u.id
                                        }).then(s=>{
                                            handleSave(s)
                                            p.remove()
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
}

function addGuest(cid,container){
    let p = modal()
        p.append(ce(`h2`,false,false,`Запись на ивент`))

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
                                        axios.post(`/${host}/admin/userClasses`,{
                                            user:   u.id,
                                            class:  cid
                                        }).then(s=>{
                                            handleSave(s)
                                            p.remove()
                                            container.prepend(showTicketLine(s.data.data))
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
}

function occupyMR(date,time,button){
    let p = modal()
    
        p.append(ce(`h2`,false,false,`Запись в переговорку`))
        p.append(ce(`p`,false,false,`${date}, ${time}`))
        
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
                                        axios.post(`/${host}/admin/mr`,{
                                            user: u.id,
                                            date: date,
                                            time: time
                                        }).then(s=>{
                                            handleSave(s)
                                            p.remove()
                                            button.dataset.active = true;
                                            button.innerHTML = uname(u,u.id)
                                            button.onclick=()=>{
                                                showMROptions(s.data.data,u,button)
                                            }
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

    let bc =ce(`div`,false,`flex`)
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

function showMessages(){
    let p = preparePopupWeb(`messages`,false,false,true,false,false,`Сообщения`)
        let c = ce('div')
        
        // let filters = ce(`div`,false,`flex`)
        
        let filterTypes = {
            reply:    `Исходящие`,
            incoming:  `Входящие`,
        }

        let fc = ce('div',false,`flex`)
        
        p.append(fc)
        
        Object.keys(filterTypes).forEach(type => {
            fc.append(ce('button', false, [type,`dateButton`,`dark`], filterTypes[type], {
                dataset:{filter:type},
                onclick: function () {
                    filterUsers(type, c, this,false,`.sDivided`,messagesFilter)
                }
            }))
        })

        load(`messages`)
            .then(messages=>{
                messages.forEach(m=>{
                    c.append(messageLine(m))            
                })
            })
        p.append(c)

        let offset = 0;

        p.append(ce(`button`,false,buttonStyle,`Еще`,{
            onclick:function(){
                offset = offset+200;
                load(`messages`,false,{offset:offset})
                    .then(messages=>{
                        if(messages.length<200) this.remove()
                        messages.forEach(m=>{
                            c.append(messageLine(m))
                        })
                        
                    })
            }
        }))
}

function showUser(u, id) {

    if (!u) {
        u = axios.get(`/${host}/admin/user?data=profile&user=${id}`)
            .then(d => d.data)
            .catch(err => {
                return alert(err.message)
            })
    }

    Promise.resolve(u).then(u => {
        
        let p = preparePopupWeb(`users_${u.id}`,false,false,true,logButton(`user`, u.id, `Лог по пользователю`))
        
        

        let headline = ce(`div`,false,`flex`)
        p.append(headline)
        if(u.avatar_id){
            let img = ce(`img`,false,`avatar`)
            headline.append(img)
            load(`images`,u.avatar_id).then(pic=>{
                img.src = pic.src
            })
        }

        headline.append(ce('h1', false, false, `${uname(u,u.id)} (${u.language_code})`))
        
        p.append(line(
            ce('p', false, false, `регистрация: ${drawDate(u.createdAt._seconds*1000)}`),
            ce('p', false, false, `последний раз в приложении: ${u.appLastOpened ? drawDate(u.appLastOpened._seconds*1000) : `нет данных`}`)
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
        
        p.append(line(
            ce('p', false, false, `email: ${u.email || `не указан`}`, {
                onclick: function () {
                    edit(`users`, u.id, `email`, `text`, u.email, this)
                }
            }),
            ce('p', false, false, `about: ${u.about || `о себе не рассказывал`}`, {
                onclick: function () {
                    edit(`users`, u.id, `about`, `textarea`, u.about, this)
                }
            }),
            ce('p', false, false, `occupation: ${u.occupation || `о себе не рассказывал`}`)

        ))

        let adminLinks = [{
            attr: `admin`,
            name: `сделать админом`,
            disname: `снять админство`
        }, {
            attr: `fellow`,
            name: `отметить как fellow`,
            disname: `убрать из fellows`
        }, {
            attr: `insider`,
            name: `сделать сотрудником`,
            disname: `убрать из сотрудников`
        }, {
            attr: `public`,
            name: `сделать публичным сотрудником`,
            disname: `убрать из публичных сотрудников`
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

        if(u.admin) {
            let adminLinks = [{
                attr: `alert.users`,
                name: `включить уведомления по пользователям`,
                disname: `снять уведомления по пользователям`
            }, {
                attr: `alert.lectures`,
                name: `включить уведомления по лекциям`,
                disname: `снять уведомления по лекциям`
            }, {
                attr: `alert.messages`,
                name: `включить уведомления по сообщениям`,
                disname: `снять уведомления по сообщениям`
            }, {
                attr: `alert.coworking`,
                name: `включить уведомления по коворкингу`,
                disname: `снять уведомления по коворкингу`
            }]

            let ac = ce(`div`,false,`flex`)
            p.append(ac)

            adminLinks.forEach(type => {
                let a = type.attr.split('.')[0];
                let b = type.attr.split('.')[1];
                let cv = u[a] && u[a][b] ? true : false;

                ac.append(ce('button', false, [`dateButton`,`dark`], cv ? type.disname : type.name, {
                    onclick: () => {
                        axios.put(`/${host}/admin/users/${u.id}`, {
                            attr: type.attr,
                            value: !cv
                        }).then(handleSave)
                        .catch(handleError)
                    }
                }))
            })
        }

        // let line = ce(`div`,false,`flex`)

        p.append(line(
            toggleButton(`users`,u.id,`blocked`,u.blocked||false,`Разблокировать`,`Заблокировать`,[`dateButton`,`dark`]),
            toggleButton(`users`,u.id,`randomCoffee`,u.randomCoffee||false,`Убрать из randomCoffee`,`Добавить в randomCoffee`,[`dateButton`,`dark`]),
            toggleButton(`users`,u.id,`noSpam`,u.noSpam||false,`Выключить новости`,`Включить новости`,[`dateButton`,`dark`])
        ))


        let messenger = ce('div')
        p.append(messenger)

        messenger.append(ce(`button`,false,buttonStyle,`Открыть переписку`,{
            onclick:function(){
                this.remove()
                messenger.append(ce(`h2`,false,false,`Переписка:`))
                load(`messages`,u.id).then(messages=>{
                    let mc = ce(`div`,false,`messenger`)
                    messenger.append(mc)
                    messages.forEach(m=>{
                        // let message = ce('div',false,false,false,{dataset:{reply:m.isReply}})
                        //     message.append(ce(`span`,false,`info`,drawDate(m.createdAt._seconds*1000,false,{time:true})))
                        //     message.append(ce(`p`,false,false,m.text))
                        mc.prepend(messageLine(m))
                    })
                    let txt = ce('textarea',false,false,false,`вам слово`)
                    messenger.append(txt)
                    messenger.append(ce(`button`,false,buttonStyle,`Отправить`,{
                        onclick:()=>{
                            if(txt.value){
                                axios.post(`/${host}/admin/message`,{
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
            



        // let invoices = ce(`div`);
        // invoices.append(ce('h3',false,false,`Счета`))
        // p.append(invoices)
        
        // invoices.append(ce(`button`,false,false,`Выставить счет`,{
        //     onclick:()=>addInvoice(u.id)
        // }))

        // load(`userInvoices`,u.id).then(inc=>{
        //     inc.forEach(invoice=>{
        //         invoices.append(invoiceLine(invoice))
        //     })
        // })

        let plans = ce(`div`)
            plans.append(ce(`h2`,false,false,`Подписки`))
            load(`plansByUser`,u.id).then(plansq=>{
                if(!plansq.length) plans.append(`подписок нет`)
                plansq.filter(p=>p.active).forEach(p=>{
                    plans.append(planUseLine(p))
                })
                plans.append(ce('a',false,[`thin`,`block`],`показать архив`,{
                    onclick:function(){
                        
                        this.remove()

                        plansq.filter(p=>!p.active).forEach(p=>{
                            plans.append(planUseLine(p,true))
                        })
                    }
                }))
            }) 
            p.append(plans)

        let deposits = ce(`div`)
        p.append(deposits)
            deposits.append(ce(`h2`,false,false,`Депозит:`))
            let dep = ce(`p`,false,false,(u.deposit ? cur(u.deposit,`GEL`) : `отсутствует`))
            deposits.append(dep)

        deposits.append(ce(`button`,false,buttonStyle,`Добавить депозит`,{
            onclick:()=>{
                let c = modal()
                    c.append(ce('h2',false,false,`Вносим денег`))
                let amount = ce('input',false,false,false,{
                    type: `number`,
                    placeholder: `Сколько?`,
                    min: 10,
                    step: 10
                })
                let desc = ce(`input`,false,false,false,{
                    type: `text`,
                    placeholder: `Примечание (ДСП)`
                })

                c.append(amount)
                c.append(desc)

                c.append(ce(`button`,false,buttonStyle,`Сохранить`,{
                    onclick:function(){
                        if(amount.value){
                            let sure = confirm(`Уверены?`)
                            if(sure){
                                this.setAttribute(`disabled`,true)
                                axios.post(`/${host}/admin/deposit`,{
                                    amount: +amount.value,
                                    user: u.id,
                                    description: desc.value || null 
                                }).then(s=>{
                                    handleSave(s)
                                    dep.innerHTML = cur(s.data.total)
                                    c.remove()
                                }).catch(handleError)
                            }
                        }
                    }
                }))
            }
        }))

        deposits.append(ce(`button`,false,[`dark`,`dateButton`,`active`],`Списать депозит`,{
            onclick:()=>{
                
                let c = modal()
                    c.append(ce('h2',false,false,`Списываем денег`))
                let amount = ce('input',false,false,false,{
                    type: `number`,
                    placeholder: `Сколько?`,
                    min: 10,
                    step: 10
                })
                let desc = ce(`input`,false,false,false,{
                    type: `text`,
                    placeholder: `Примечание (ДСП)`
                })

                c.append(amount)
                c.append(desc)

                c.append(ce(`button`,false,buttonStyle,`Сохранить`,{
                    onclick:function(){
                        if(amount.value){
                            let sure = confirm(`Уверены?`)
                            if(sure){
                                this.setAttribute(`disabled`,true)
                                axios.post(`/${host}/admin/deposit`,{
                                    user: u.id,
                                    amount: -Number(amount.value),
                                    description: desc.value || null 
                                }).then(s=>{
                                    handleSave(s)
                                    dep.innerHTML = cur(s.data.total,`GEL`)
                                    c.remove()
                                }).catch(handleError)
                            }
                        }
                    }
                }))
            }
        }))



        let lecs = ce('div')
        p.append(lecs)
        

        axios
            .get(`/${host}/admin/user?user=${u.id}&data=lections`)
            .then(data => {
                lecs.append(ce(`h2`, false, false, `Лекции (${data.data.length})`))
                
                data.data.filter(l=>new Date()<new Date(l.date)).forEach(c => {
                    lecs.append(ce('p', false, false, `${drawDate(c.createdAt._seconds*1000)}: ${c.className} (${c.status == `used` ? `✔️` : `❌`})`, {
                        dataset: {
                            active: c.active
                        },
                        onclick:()=>showTicket(false,c.id)
                    })) 
                })

                if(data.data.length) lecs.append(ce(`button`,false,buttonStyle,`Показать архив`,{
                    onclick:function(){
                        this.remove();
                        data.data.filter(l=>new Date()>new Date(l.date)).forEach(c => {
                            lecs.append(ce('p', false, false, `${drawDate(c.createdAt._seconds*1000)}: ${c.className} (${c.status == `used` ? `✔️` : `❌`})`, {
                                dataset: {
                                    active: c.active
                                },
                                onclick:()=>showTicket(false,c.id)
                            })) 
                        })
                    }
                }))
            })

        let cw = ce('div')
        p.append(cw)
        
        load(`coworkingByUser`,u.id).then(records=>{
            if(records.length) cw.append(ce(`h2`,false,false,`Коворкинг (${records.length} дней)`))
            
            records.filter(rec=>rec.date>=new Date().toISOString().split('T')[0]).forEach(rec=>{
                cw.append(showCoworkingLine(rec,false,true))
            })
            
            cw.append(ce('button',false,buttonStyle,`Показать архивные записи в коворкинг`,{
                onclick:function(){
                    this.remove()
                    records.filter(rec=>rec.date<new Date().toISOString().split('T')[0]).reverse().forEach(rec=>{
                        cw.append(showCoworkingLine(rec,false,true))
                    })
                }
            }))
        })

        load(`wineByUser`,u.id).then(wineList=>{
            p.append(ce(`h3`,false,false,`Вино`))
            let wc = ce(`div`) 
            wineList.forEach(r=>{
                wc.append(wineLine(r))
            })
            p.append(wc)
            p.append(wineButton(u.id))
        })

        
    })
}

function wineButton(userId){

    return ce(`button`,false,buttonStyle,`Налить вина`,{
        onclick:()=>{
            let edit = modal()
                edit.append(ce(`h2`,false,false,`Привет, гертруда!`))
                edit.append(ce(`p`,false,false,`Выберите, сколько бокалов налить`))
            let volume = ce('input',false,false,false,{
                placeholder:    `сколько лить в бокалах`,
                min:            1,
                type:           `number`
            })
            edit.append(volume)
            edit.append(ce(`button`,false,[`dateButton`,`dark`],`Налить`,{
                onclick:function(){
                    if(volume.value){
                        
                        this.setAttribute(`disabled`,true)
                        
                        axios.post(`/${host}/admin/wine`,{
                            user: userId,
                            left: volume.value
                        }).then(s=>{
                            handleSave(s)
                            edit.remove()
                        }).catch(handleError)
                    }
                }
            }))
        }
    })
}

function wineLine(w){
    c = listContainer(w,true)
    c.classList.remove(`hidden`)
    c.append(ce('h3',false,false,`Налито: ${w.total}. Остаток: ${w.left}`))
    // c.append(ce('h3',false,false,`Остаток: ${w.left}`))
    return c
}


// function preparePopupWeb(name){
//     let c = ce('div',false,'popupWeb')
//     c.append(ce('span',false,`closeMe`,`✖`,{
//         onclick:()=>{
//             c.classList.add(`slideBack`)
//             setTimeout(function(){
//                 c.remove()
//             },500)
//         }
//     }))
//     document.body.append(c)
//     let content = ce('div',false,`content`)
//     c.append(content)
//     return content;
// }


function depositLine(d){
    let c = listContainer(d,true)
        c.classList.remove(`hidden`)
        
        c.append(ce(`h3`,false,false,cur(d.amount,`GEL`)))
        let uc =ce(`div`)
        c.append(uc)
        load(`users`,d.user, false, downLoadedUsers).then(u=>{
            uc.append(ce(`button`,false,[`dateButton`,`dark`],uname(u,u.id),{
                onclick:()=>showUser(false,u.id)
            }))
        })
        c.append(ce(`p`,false,false,d.description||`без комментариев`))
    return c
}

function showDeposits(){
    let p = preparePopupWeb(`deposits`,false,false,true,false,false,`Движения по депозитам`)
        load(`deposits`).then(list=>{
            list.forEach(d=>{
                p.append(depositLine(d))            
            })
        })
}

function showHalls(){
    showScreen(`Залы`,`halls`,showHallLine,false,false,true)
    // load(`halls`).then(halls => {

    //     let p = preparePopupWeb(`halls`,false,false,true,false,false,`Залы`)

    //     let c = ce(`div`)

    //     halls.forEach(h => {
    //         p.append(showHallLine(h))
    //     });

    //     let cc = ce('div', false, `controls`)
        
    //     cc.append(sortBlock([{
    //         attr: `name`,
    //         name: `По названию`
    //     }, {
    //         attr: `views`,
    //         name: `По просмотрам`
    //     }, {
    //         attr: `createdAt`,
    //         name: `По дате создания`
    //     }], c, halls, showHallLine, buttonStyle))

    //     p.append(cc)

    //     p.append(ce('button', false, buttonStyle, `Добавить зал`, {
    //         onclick: () => newHall()
    //     }))

    //     // p.append(c)

    //     p.append(archiveButton(c,buttonStyle))
    // })
}

function showHallLine(a){
    let div = ce('div',false,`sDivided`,false,{
        dataset: {active: a.active}
    })
    if (!a.active) div.classList.add(`hidden`)
    
    let creds = ce(`div`,false,`details`)

    creds.append(ce('span', false, `info`, a.views ? `Просмотров: ${a.views}` : ``))
    creds.append(ce('span', false, `info`, a.createdAt ? `Создан(-а): ${drawDate(a.createdAt._seconds*1000)}` : a.createdAt))

    div.append(creds)

    div.append(ce('h2', false, `clickable`, a.name, {
        onclick: () => showHall(false,a.id)
    }))

    div.append(ce('p', false, false, a.description || `без описания`))



    return div
}

// Авторы


function showAuthors() {
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    window.history.pushState({}, "", `web?page=authors`);
    load(`authors`).then(authors => {
        let p = preparePopupWeb(`authors`,false,false,true,false,false,`Авторы`)
        // mc.innerHTML = '';
        // mc.append(ce('h1', false, `header2`, `Авторы`))
        // mc.append(ce(`p`, false, false, `В этом разделе отображаются авторы. У каждого из них появляется собственная страница, а у пользователей — возможность подписаться на обновления.<br>По умолчанию отображаются только активные авторы. Если кто-то ушел, а потом вернулся, не стоит создавать новую запись, откройте архив и верните к жизни предыдущую запись.`))


        let c = ce('div')

        // p.append(c)

        authors.forEach(a => {
            c.append(showAuthorLine(a))
        });

        let cc = ce('div', false, `controls`)
        cc.append(sortBlock([{
            attr: `name`,
            name: `По названию`
        }, {
            attr: `views`,
            name: `По просмотрам`
        }, {
            attr: `createdAt`,
            name: `По дате создания`
        }], c, authors, showAuthorLine,buttonStyle))

        p.append(cc)

        c.append(ce('button', false, buttonStyle, `Добавить автора`, {
            onclick: () => newAuthor()
        }))

        p.append(c)

        p.append(archiveButton(c,buttonStyle))
    })
}

function showQLine(q){
    let c = listContainer(q,true)
        c.append(ce(`p`,false,false,q.text))
    return c;
}

function showAuthorLine(a) {

    let div = ce('div', false, `sDivided`, false, {
        dataset: {
            active: a.active
        }
    })

    if (!a.active) div.classList.add(`hidden`)

    let creds = ce(`div`,false,`details`)

    creds.append(ce('span', false, `info`, a.views ? `Просмотров: ${a.views}` : ``))
    creds.append(ce('span', false, `info`, a.createdAt ? `Создан(-а): ${drawDate(a.createdAt._seconds*1000)}` : a.createdAt))

    div.append(creds)

    div.append(ce('h2', false, `clickable`, a.name, {
        onclick: () => showAuthor(a)
    }))

    div.append(ce('p', false, false, a.description || `без описания`))



    return div
}


function showAuthor(a, id) {

    if (!a) {
        a = load(`authors`, id)
    }

    Promise.resolve(a).then(a => {

        if (a.author) a = a.author

        let p = preparePopupWeb(`author_${a.id}`, `author_${a.id}`, [`authors`, a.id])
        window.history.pushState({}, "", `web?page=authors_${a.id}`);

        p.append(logButton(`author`, a.id, `Лог по автору`))

        p.append(ce('h1', false, false, a.name, {
            onclick: () => edit(`authors`, a.id, `name`, `text`, a.name)
        }))

        p.append(ce('p', false, false, `Просмотров: ${a.views || 0}`))

        if (a.pic) {
            p.append(ce(`img`, false, `cover`, false, {
                src: a.pic,
                onclick: () => edit(`authors`, a.id, `pic`, `text`, a.pic)
            }))
        } else {
            p.append(ce(`button`, false, `accent`, `задать картинку`, {
                onclick: () => edit(`authors`, a.id, `pic`, `text`, null)
            }))
        }

        p.append(ce(`p`, false, false, a.description, {
            onclick: () => edit(`authors`, a.id, `description`, `textarea`, a.description)
        }))

        if(a.user){
            load(`users`,a.user,false,downLoadedUsers).then(u=>{
                p.append(ce(`button`,false,buttonStyle,uname(u,u.id)))
            })
            
        } else {
            p.append(ce(`button`,false,[`dateButton`,`dark`],`Добавьте связь с пользователем`,{
                onclick:()=>addUser(`authors`,a.id)
            }))
        }



        p.append(deleteButton(`authors`, a.id, !a.active,buttonStyle))



        // axios.get(`/${host}/admin/authors/${a.id}`)
        load(`authors`, a.id).then(authorData => {
            // authorData = authorData

            // p.append(addClass(a.id))        

            p.append(ce('h2', false, false, authorData.classes.length ? `Лекции` : `Лекций еще нет`))

            authorData.classes.sort(byDate).reverse().forEach(cl => {
                p.append(showClassLine2(cl))
            })

            p.append(ce('h2', false, false, authorData.courses.length ? `Курсы` : `Курсов нет`))
            authorData.courses.forEach(cl => {
                p.append(showCourseLine(cl))
            })



            if (authorData.subscriptions.length) {
                p.append(ce('h2', false, false, `Подписок на автора: ${authorData.subscriptions.length}`))
                let txt = ce('textarea', false, false, false, {
                    placeholder: `Рассылка по всем подписанным на автора.`
                })
                p.append(txt)
                p.append(ce('button', false, false, `Отправить`, {
                    onclick: function () {
                        if (txt.value) {
                            this.setAttribute(`disabled`, true)
                            axios.post(`/${host}/admin/authors/${a.id}`, {
                                    intent: `subscriptions`,
                                    text: txt.value
                                }).then(handleSave)
                                .catch(handleError)
                                .finally(() => this.removeAttribute(`disabled`))
                        }

                    }
                }))
            }
        })
    })
}


function invoiceLine(i){
    let c = listContainer(i)
        
        c.append(ce('h3',false,false,i.payed?`Оплачен`:`НЕ оплачен`))
        c.append(ce('p',false,false,i.desc))
        c.append(ce('h4',false,false,cur(i.price)))

    return c
}


function addInvoice(userId){
    let edit = modal()

        edit.append(ce(`h2`,false,false,`Выставить счет`))
    
        let price = ce('input',false,false,false,{
            type:   `number`,
            min:    100,
            value:  1000,
            step:   1000,
            placeholder: `сумма`
        })

        edit.append(price)

        let desc = ce(`input`,false,false,false,{
            placeholder: `назначение`,
            type: `text`
        })

        edit.append(desc)

        edit.append(ce('button',false,`saveButton`,`Отправить`,{
            onclick:function(){
                if(!price.value) return alert(`не указана сумма`)
                if(!desc.value) return alert(`не указано назначение`)
                if(!userId) return alert(`Ошибка определения пользователя`)

                this.setAttribute(`disabled`,true)
                axios.post(`/${host}/admin/invoice`,{
                    price: +price.value,
                    desc: desc.value,
                    user: userId
                }).then(s=>{
                    handleSave(s)
                    this.parentNode.remove()
                }).catch(handleError)
            }
        }))


}