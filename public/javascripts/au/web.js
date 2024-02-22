
let host = `auditoria`
const appLink = `https://t.me/AuditoraBot/app`
const web = `https://dimazvali-a43369e5165f.herokuapp.com/auditoria/site/tbi`
let mc = document.querySelector(`#main`)

function closeLeft() {
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p => p.remove())
}

if(start){
    switch(start){
        
        case 'authors':{
            showAuthors()
            break;
        }

        case 'banks':{
            showBanks()
            break;
        }

        case 'tickets':{
            showTickets()
            break;
        }
        
        
        case 'schedule':{
            showSchedule()
            break;
        }

        case 'courses':{
            showCourses()
            break;
        }

        case 'streams':{
            showStreams()
            break;
        }

        case 'tickets':{
            showTickets()
            break;
        }

        case 'users':{
            showUsers()
            break;
        }

        case 'views':{
            showViews()
            break;
        }
        
        case 'plans':{
            showPlans()
            break;
        }

    }
}


function showNews(){
    closeLeft()
    let p = preparePopupWeb(`news`)
    p.append(ce('h2',false,false,`Загружаем...`))
    load(`news`).then(tasks=>{
        p.innerHTML = `<h2>Рассылки</h2>`
        window.history.pushState({}, "", `web?page=news`);
        p.append(ce('button',false,`dateButton`,`Добавить`,{
            dataset:{booked:1},
            onclick:()=>showNewNews()
        }))
        tasks.forEach(t=>{
            p.append(newsLine(t))
        })
    })
}

function newsLine(n){
    let c = ce('div',false,`sDivided`,false,{
        onclick:()=>showNewsNews(n.id)
    });
    c.append(ce('span',false,`info`,drawDate(n.createdAt._seconds*1000)))
    c.append(ce('span',false,`info`,`Аудитория: ${n.audience||`нрзб.`}`))
    c.append(ce(`h3`,false,false,n.name))
    return c
}

function showNewNews(){
    closeLeft()
    let p = preparePopupWeb(`newNews`)
    p.append(ce('h2',false,false,`Новая рассылка`))
    
    let name = ce('input',false,`block`,false,{placeholder: `Название`})
    let desc = ce('textarea',false,false,false,{placeholder: `Текст`})
    
    let select = ce(`select`)
        select.append(ce(`option`,false,false,`Кому отправлять?`,{
            value: ''
        }))
        select.onchange = () =>{
            if(select.value == `tagged`){
                tag.classList.remove(`hidden`)
            }
        }

    let sendOptions = {
        admins: `Админам`,
        // ready:  `Оформленным`,
        all:    `Всем`,
        tagged: `По тегу`
    }

    Object.keys(sendOptions).forEach(o=>{
        select.append(ce('option',false,false,sendOptions[o],{
            value: o
        }))
    })

    let tag = ce('select',false,`hidden`)
        tag.append(ce(`option`,false,false,`Выберите тег`,{
            value: ''
        }))

        load(`tags`).then(tags=>{
            tags
                .filter(a => a.active)
                .sort((a, b) => a.name < b.name ? -1 : 1)
                .forEach(a => tag.append(ce('option', false, false, a.name, {
                    value: a.id
                })))
        })
    
    let sb = ce('button',false,`dateButton`,`Отправить`,{
        dataset:{booked:1},
        onclick:function(){
            if(name.value && desc.value){
                this.setAttribute(`disabled`,true)
                axios.post(`/${host}/admin/news`,{
                    name:           name.value,
                    text:           desc.value,
                    tag:            tag.value,
                    filter:         select.value
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
    inpC.append(desc)
    inpC.append(select)
    inpC.append(tag)
    
    p.append(sb)
}

function showNewsNews(id){
    let p = preparePopupWeb(`news_${id}`)
    p.append(ce('h2',false,false,`Загружаем...`))
    load(`news`,id).then(n=>{
        p.innerHTML = `<h2>${n.name}</h2>`
        p.append(ce('span',false,`info`,`создана ${drawDate(n.createdAt._seconds*1000)}`))
        p.append(ce('span',false,`info`,` получателей ${n.audience||`нрзб.`}`))
        
        p.append(ce('p',false,false,n.text))

        let credits = ce('div')

        p.append(credits)

        load(`users`,n.createdBy).then(u=>{
            credits.append(ce(`button`,false,['dateButton','dark'],uname(u,id),{
                onclick:()=>showUser(u,u.id)
            }))
        })

        let users = ce('div')
        p.append(users)

        users.append(ce('button',false,[`dateButton`,`dark`],`показать всех получаетей`,{
            onclick:()=>{
                load(`usersNews`,id).then(sends=>{
                    sends.sort((a,b)=>b.createdAt._seconds-a.createdAt._seconds).forEach((s,i)=>{
                        let c = ce('div',false,`sDivided`)
                        users.append(c);

                        c.append(ce(
                            'span',
                            false,
                            `info`,
                            drawDate(s.createdAt._seconds*1000,false,{time: true})
                        ))

                        c.append(ce(`p`,false,false,s.user))

                        load(`users`,s.user).then(u=>{
                            c.append(ce('a',false,false,uname(u,u.id),{
                                href: '#',
                                onclick:()=>showUser(false,u.id)
                            }))
                        })
                        
                    })
                })
            }
        }))


    })
}



function showStreams(){
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    axios.get(`/${host}/admin/streams`)
        .then(data => {
            window.history.pushState({}, "", `web?page=streams`);
            mc.innerHTML = '';
            mc.append(ce('h1', false, `header2`, `Трансляции`))
            let c = ce('div')
            data.data.forEach(cl => {
                c.append(showStreamLine(cl))
            });
            mc.append(c)

        })
        .catch(err => {
            console.log(err)
            alert(err.message)
        })
}

function showStreamLine(s){
    let c = ce('div',false,false,false,{
        dataset:{active:s.active}
    })
    c.append(ce(`span`,false,`info`,drawDate(s.createdAt._seconds*1000)))
    c.append(ce('h3',false,false,`${s.userName} @ ${s.className} (${s.payed?'✔️':'❌'})`,{
        onclick:()=>showStream(s.id)
    }))
    return c;
}



function showCourses() {
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    window.history.pushState({}, "", `web?page=courses`);
    axios.get(`/${host}/admin/courses`)
        .then(data => {
            console.log(data.data)
            mc.innerHTML = '';
            mc.append(ce('h1', false, `header2`, `Курсы`))
            
            mc.append(ce(`button`, false, false, `Добавить курс`, {
                onclick: () => newCourse()
            }))

            
            let c = ce('div')
                data.data.forEach(cl => {
                    c.append(showCourseLine(cl))
                });
            
            
            let cc = ce('div',false,`controls`)
                cc.append(sortBlock([{
                    attr: `name`,
                    name: `По названию`
                },{
                    attr: `views`,
                    name: `По просмотрам`
                },{
                    attr: `createdAt`,
                    name: `По дате создания`
                }],c,data.data,showCourseLine))
            
            mc.append(cc)
            
            mc.append(c)

            mc.append(archiveButton(c))

        })
        .catch(err => {
            console.log(err)
            alert(err.message)
        })
}

function sortableText(t){
    if(!t) t = '';
    let txt = t.toString().replace(/\»/g,'').replace(/\«/g,'').toLowerCase().trim()
    console.log(txt)
    return txt
}

function sortBlock(sortTypes,container,array,callback){
    let c = ce('div',false,`controls`)
    sortTypes.forEach(type=>{
        c.append(ce('button',false,false,type.name,{
            onclick:()=>{
                container.innerHTML = null;
                array.sort((a,b)=>{
                    switch(type.attr){
                        case `views`:{
                            return (b.views||0) - (a.views||0)
                        }
                        case 'name':{
                            return sortableText(b.name) > sortableText(a.name) ? -1 : 0
                        }
                        case 'createdAt':{
                            return (a.createdAt||{})._seconds||0 - (b.createdAt||{})._seconds||0 
                        }
                        case `price`:{
                            return (+b.price||0) - (+a.price||0)
                        }
                    }
                }).forEach(r=>{
                    container.append(callback(r))
                })
            }
        }))
    })

    return c;
}

function archiveButton(container){
    return ce('button',false,false,`Показать архивные записи`,{
        onclick:()=>{
            container.querySelectorAll(`.hidden`).forEach(c=>{
                c.classList.toggle(`hidden`)
            })
        }
    })
    
}


function showPlanLine(plan) {
    let c = ce('div', false, `divided`, false, {
        onclick: () => showPlan(plan.id)
    })
    if(!plan.active) c.classList.add(`hidden`)
    c.append(ce('h2', false, false, plan.name))
    c.append(ce('p', false, false, plan.description || `без описания`))
    c.append(ce('p', false, false, `${cur(plan.price,`GEL`)}, ${plan.visits} посещений.`))
    return c
}

function showViews(){
    load(`views`).then(views=>{
        let p = preparePopupWeb(`views`)
            p.append(ce('h1',false,false,`Просмотры:`))
            window.history.pushState({}, "", `web?page=views`);
        let entities = {
            classes: {
                name:`Занятия`,
                node: `class`
            },
            courses: {
                name: `Курсы`,
                node: `course`
            },
            authors: {
                name: `Авторы`,
                node: `author`
            }
        }

        p.append(ce('h2',false,false,`tapLink`))
        
        let filtered = views.filter(r=>r.entity == `mp`)
        let counter = {};
        filtered.forEach(r=>{
            let d = new Date(r.createdAt._seconds*1000).toISOString().split("T")[0]
            if(!counter[d]) counter[d] = 0;
            counter[d]++
        })

        Object.keys(counter).sort().forEach(date=>{
            p.append(ce('p',false,false,`${date}: ${counter[date]}`))
        })

        Object.keys(entities).forEach(type=>{
            p.append(ce('h2',false,false,entities[type].name))
            let filtered = views.filter(r=>r.entity == type)
            let counter = {};
            filtered.forEach(r=>{
                if(!counter[r.id]) counter[r.id] = 0;
                counter[r.id]++
            })
            Object.keys(counter).sort((a,b)=>counter[b]-counter[a]).forEach((id,num)=>{
                let line = ce(`p`,false,false,`#${num+1}: ${id} (${counter[id]})`)
                p.append(line)
                load(type,id).then(data=>{
                    line.innerHTML = `#${num+1}: ${data[entities[type].node].name} (${counter[id]})`
                })
            })
        })
         
    })
}

function showPlan(id) {
    load(`plans`, id).then(plan => {
        let p = preparePopupWeb(`plan_${plan.id}`)

        p.append(logButton(`plan`,plan.id,`Лог по абонементу ${plan.name}`))

        p.append(ce('h1', false, false, plan.name || `Без названия`, {
            onclick: () => edit(`plans`, id, `name`, `text`, plan.name)
        }))

        p.append(ce('p', false, false, plan.description || `Без описания`, {
            onclick: () => edit(`plans`, id, `description`, `textarea`, plan.description)
        }))

        p.append(ce('p', false, false, cur(plan.price, 'GEL') || `Без стоимости`, {
            onclick: () => edit(`plans`, id, `price`, `number`, plan.price)
        }))

        p.append(ce('p', false, false, `Посещений: ${plan.visits}` || `Без посещений`, {
            onclick: () => edit(`plans`, id, `visits`, `number`, plan.visits)
        }))

        p.append(deleteButton(`plans`,id))

        if (plan.subscriptions.length) {
            p.append(ce('h2', false, false, `Подписок: ${plan.subscriptions.length} (активных ${plan.subscriptions.filter(s=>s.active).length})`))
            p.append(postSection(`plan`, plan.id, p))
        }
    })
}

function showPlans() {
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    window.history.pushState({}, "", `web?page=plans`);
    load(`plans`)
        .then(plans => {
            mc.innerHTML = '';
            mc.append(ce('h1', false, `header2`, `Подписки`))
            let c = ce('div')
            
            plans.forEach(plan => {
                c.append(showPlanLine(plan))
            });

            c.append(ce(`button`, false, false, `Добавить подписку`, {
                onclick: () => newPlan()
            }))

            let cc = ce('div',false,`controls`)
                cc.append(sortBlock([{
                    attr: `name`,
                    name: `По названию`
                },{
                    attr: `views`,
                    name: `По просмотрам`
                },{
                    attr: `createdAt`,
                    name: `По дате создания`
                },{
                    attr: `price`,
                    name: `По стоимости`
                }],c,plans,showPlanLine))
            
            mc.append(cc)

            mc.append(c)

            mc.append(archiveButton(c))


        })
        .catch(err => {
            console.log(err)
            alert(err.message)
        })
}

function drawSchedule(events, start) {
    let cc = ce('div', false, `scroll`)
    let c = ce('div', false, `flex`)
    cc.append(c)
    let i = 0
    while (i < 30) {
        let day = ce(`div`, false, `date`)

        let date = new Date(+new Date() + i * 24 * 60 * 60 * 1000)
        let isoDate = date.toISOString().split('T')[0]
        day.append(ce(`h3`, false, false, drawDate(date)))
        events.filter(e => new Date(e.date._seconds * 1000).toISOString().split('T')[0] == isoDate).sort((a, b) => a.date._seconds - b.date._seconds).forEach(e => {
            day.append(ce('p', false, false, `<b>${new Date(e.date._seconds*1000).toLocaleTimeString([],{ hour: "2-digit", minute: "2-digit" })}</b>: ${e.name}`, {
                onclick: () => showClass(e, e.id),
                dataset:{
                    soldOut:    e.soldOut,
                    kids:       e.kids
                }
            }))
        })
        c.append(day)
        i++
    }
    return cc

}

function showCourseLine(course) {
    // console.log(c)
    let c = ce(`div`, false, `divided`, false, {
        dataset: {
            active: course.active,
            kids: course.kids
        },
        onclick: () => {
            showCourse(course)
        }
    })

    if(!course.active) c.classList.add(`hidden`)

    let creds = ce(`div`)

        creds.append(ce('span', false, `info`, course.views ? `Просмотров: ${course.views}` : ``))
        creds.append(ce('span', false, `info`, course.createdAt ? `Создан(-а): ${drawDate(course.createdAt._seconds*1000)}` : course.createdAt))

    c.append(creds)

    c.append(ce('h2', false, false, course.name))
    c.append(ce('p', false, false, course.author || `без автора`))

    return c
}

function removeConnectionButton(collection,id,upd,attr){
    return ce(`button`,false,false,`Удалить связь`,{
        onclick:function(){
            let sure = confirm(`Уверены?`)
            if(sure){
                this.setAttribute(`disabled`,true)
                axios
                    .patch(`/${host}/admin/${collection}/${id}${attr?`?attr=${attr}`:''}`,upd)
                    .then(handleSave)
                    .catch(handleError)
                    .finally(this.parentNode.remove())
            }
            
        }
    })
    
}

function deleteButton(collection,id){
    return ce('button',false,false,`Архивировать`,{
        onclick:()=>{
            let proof = confirm(`Вы уверены?`)
            if(proof) axios.delete(`/${host}/admin/${collection}/${id}`)
                .then(handleSave)
                .catch(handleError)
        }
    })
}

function showBank(id){
    let p = preparePopupWeb(`bank_${id}`,`bank_${id}`,[`banks`,id])
    load(`banks`,id)
        .then(b=>{

            p.append(logButton(`author`,b.id,`Лог реквизита`))

            p.append(ce('h1',false,false,`Реквизиты ${b.name}`))
            
            p.append(ce('h2', false, false, b.name, {
                onclick: () => edit(`banks`, b.id, `name`, `text`, b.name)
            }))
        
            p.append(ce('p', false, false, b.creds, {
                onclick: () => edit(`banks`, b.id, `creds`, `text`, b.creds)
            }))

            load(`banksCourses`,b.id).then(courses=>{
                if(!courses.length){
                    p.append(ce('h3',false,false,`не привязаны ни к одному курсу`))
                } else {
                    p.append(ce(`h3`,false,false,`Связанные курсы:`))
                    courses.forEach(c=>{
                        let container = ce('div',false,c.active?`sDivided`:`hidden`)
                            container.append(showCourseLine(c))
                            container.append(removeConnectionButton(`courses`,c.id,{
                                bankId: null,
                                bankCreds: null
                            },`bankCourse`))
                        p.append(container)
                    })
                }
            })

            p.append(deleteButton(`banks`,b.id))

        })
}

function showCourse(cl, id) {
    
    if (!cl) {
        cl = load(`courses`, id)
    }

    Promise.resolve(cl).then(cl => {

        if(cl.course) cl = cl.course


        let p = preparePopupWeb(`course_${cl.id}`,`course_${cl.id}`,[`courses`,cl.id])

        p.append(logButton(`course`,cl.id,`Лог по курсу ${cl.name}`))

        if (cl.pic) {
            p.append(ce(`img`, false, `cover`, false, {
                src: cl.pic,
                onclick: () => edit(`courses`, cl.id, `pic`, `text`, cl.pic)
            }))
        } else {
            p.append(ce('p', false, false, `добавить фото`, {
                onclick: () => edit(`courses`, cl.id, `pic`, `text`, null)
            }))
        }


        if (!cl.bankId) {
            p.append(ce(`button`, false, `accent`, `выбрать счет`, {
                onclick: () => edit(`courses`, cl.id, `bankId`, `bankId`, null)
            }))
        } else {
            p.append(ce(`button`, false, `accent`, cl.bankName, {
                onclick: () => edit(`courses`, cl.id, `bankId`, `bankId`, null)
            }))
        }

        if (!cl.plan) {
            p.append(ce(`button`, false, `accent`, `выбрать подписку`, {
                onclick: () => edit(`courses`, cl.id, `planId`, `planId`, null)
            }))
        } else {
            p.append(ce(`button`, false, `accent`, cl.plan, {
                onclick: () => edit(`courses`, cl.id, `planId`, `planId`, cl.planId)
            }))
        }

        

        p.append(ce('h1', false, false, cl.name || `Без названия`, {
            onclick: () => edit(`courses`, cl.id, `name`, `text`, null)
        }))

        p.append(ce('p',false,false,`Просмотров: ${cl.views || 0}`))

        if (!cl.authorId) {
            p.append(ce(`button`, false, `accent`, `выбрать автора`, {
                onclick: () => edit(`courses`, cl.id, `authorId`, `authorId`, null)
            }))
        } else {
            p.append(ce(`button`, false, `accent`, cl.author, {
                onclick: () => edit(`courses`, cl.id, `authorId`, `authorId`, cl.authorId)
            }))
        }

        let kids = ce('input', false, false, false, {
            type: 'checkbox',
            checked: cl.kids,
            onchange:function(){
                axios.put(`/${host}/admin/courses`,{
                    attr: `kids`,
                    value: this.checked
                })
            }
        })

        

        let kidsLabel = ce('label', false, false, 'Для детей')

        kidsLabel.append(kids)

        p.append(kidsLabel)

        p.append(ce('p',false,false,cl.age?`Для детей от ${cl.age} лет.`:`возраст не указан`,{
            onclick: () => edit(`courses`,cl.id,`age`,`number`,cl.age)
        }))


        if (cl.description) {
            p.append(ce('p', false, false, cl.description, {
                onclick: () => edit(`courses`, cl.id, `description`, `textarea`, cl.description)
            }))
        } else {
            p.append(ce(`button`, false, `accent`, `Без описания`, {
                onclick: () => edit(`courses`, cl.id, `description`, `textarea`, null)
            }))
        }

        p.append(deleteButton(`courses`,cl.id))


        load(`courses`,cl.id).then(course => {

            p.append(ce(`h3`, false, false, 'Занятия'))

            course.classes.forEach(c => {
                p.append(showClassLine(c))
            })

            p.append(addClass(cl.authorId, cl.id, cl.bankId))

            if (course.subscriptions.length) {
                p.append(ce('h2', false, false, `Подписок на курс: ${course.subscriptions.length}`))
                let txt = ce('textarea', false, false, false, {
                    placeholder: `Рассылка по всем подписанным на курс.`
                })
                p.append(txt)
                p.append(ce('button', false, false, `Отправить`, {
                    onclick: function () {
                        if (txt.value) {
                            this.setAttribute(`disabled`, true)
                            axios.post(`/${host}/admin/courses/${cl.id}`, {
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

function handleSave(s) {
    if (s.data.hasOwnProperty('success')) return alert(s.data.comment || `Ура! Пожалуй, стоит обновить страницу.`)
}

function load(collection, id) {
    return axios.get(`/${host}/admin/${collection}${id?`/${id}`:''}`).then(data => {
        return data.data
    })
}

function deleteEntity(col, id) {
    console.log(`удаляем`, col, id)
    return axios.delete(`/${host}/admin/${col}/${id}`)
        .then(handleSave)
        .catch(handleError)
}

function replicate(id) {
    let edit = ce('div', false, `editWindow`)
    edit.append(ce('h2', false, false, `Выберите дату`))

    let f = ce('input');
    f.type = `datetime-local`
    edit.append(f)

    edit.append(ce('button', false, false, `Сохранить`, {
        onclick: function () {
            if (f.value) {
                axios.post(`/${host}/admin/classes/${id}`, {
                        date: new Date(f.value)
                    }).then(handleSave)
                    .catch(handleError)
            }
        }
    }))

    document.body.append(edit)
}


function togglePayed(id,isPayed){
    let edit = ce('div', false, `editWindow`)
    edit.append(ce('h2',false,false,`Сменить статус оплаты билета.`))
    edit.append(ce('p',false,false,`текущий статус: ${isPayed?`оплачен`:`НЕ оплачен`}`))
    
    edit.append(ce('button',false,false,`Оплачен`,{
        onclick: function () {
            axios.put(`/${host}/admin/tickets/${id}`, {
                attr: `isPayed`,
                value: true
            }).then(handleSave)
            .catch(handleError)
        }
    }))

    edit.append(ce('button',false,false,`НЕ Оплачен`,{
        onclick: function () {
            axios.put(`/${host}/admin/tickets/${id}`, {
                attr: `isPayed`,
                value: false
            }).then(handleSave)
            .catch(handleError)
        }
    }))
}

function toggleStatus(id,status){
    let edit = ce('div', false, `editWindow`)
    edit.append(ce('h2',false,false,`Сменить статус билета.`))
    edit.append(ce('p',false,false,`текущий статус: ${status == `used`?`гость пришел`:`гость НЕ пришел`}`))
    
    edit.append(ce('button',false,false,`Пришел`,{
        onclick: function () {
            axios.put(`/${host}/admin/tickets/${id}`, {
                attr: `status`,
                value: `used`
            }).then(handleSave)
            .catch(handleError)
        }
    }))

    edit.append(ce('button',false,false,`НЕ пришел`,{
        onclick: function () {
            axios.put(`/${host}/admin/tickets/${id}`, {
                attr: `status`,
                value: null
            }).then(handleSave)
            .catch(handleError)
        }
    }))
}

function edit(entity, id, attr, type, value) {

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

    let edit = ce('div', false, `editWindow`)

    edit.append(ce('span', false, `closeMe`, `✖`, {
        onclick: () => {
            edit.remove()
        }
    }))
    
    edit.append(ce('h2', false, false, `Правим поле ${attrTypes[attr]||attr} для ${entities[entity]||entity}#${id}`))

    let f = ce('input');
    
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
    } else if (type == `planId`) {
        load(`plans`).then(authors => {
            f = ce('select')
            f.append(ce('option', false, false, `Выберите подписку`, {
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
    } else if (type == `textarea`) {
        f = ce('textarea', false, false, false, {
            value: value,
            type: type,
            placeholder: `Новое значение`
        })
        edit.append(f)
    }else {
        f = ce('input', false, false, false, {
            value: value,
            type: type,
            placeholder: `Новое значение`
        })
        edit.append(f)
    }

    edit.append(ce('button', false, false, `Сохранить`, {
        onclick: function () {
            if (f.value) {
                axios.put(`/${host}/admin/${entity}/${id}`, {
                        attr: attr,
                        value: type == `date` ? new Date(f.value) : f.value
                    }).then(handleSave)
                    .catch(handleError)
            }
        }
    }))
    document.body.append(edit)
}


window.addEventListener('keydown', (e) => {
    if (e.key == 'Escape') {
        if(document.querySelector('.editWindow')){
            document.querySelector('.editWindow').remove()
        } else if(document.querySelectorAll(`.popupWeb`).length){
            document.querySelectorAll(`.popupWeb`)[document.querySelectorAll(`.popupWeb`).length-1].remove()
        } else if(document.querySelector('#hover')){
            document.querySelector('#hover').remove()
        }
    }
})

function newPlan(){
    let p = preparePopupWeb(`plans_new`)
    
    p.append(ce('h1', false, false, `Новый абонемент`))

    let name = ce('input', false, false, false, {
        type: `text`,
        placeholder: `Название`
    })
    p.append(name)

    let description = ce('input', false, false, false, {
        type: `text`,
        placeholder: `описание`
    })
    p.append(description)

    let price = ce('input', false, false, false, {
        type: `number`,
        placeholder: `стоимость`
    })
    p.append(price)

    let visits = ce('input', false, false, false, {
        type: `number`,
        placeholder: `посещенйи`
    })
    p.append(visits)

    p.append(ce('button', false, false, `Сохранить`, {
        onclick: function () {
            if (name.value && price.value && visits.value) {
                axios.post(`/${host}/admin/plans`, {
                        name:           name.value,
                        description:    description.value,
                        price:          price.value,
                        visits:         visits.value
                    }).then(handleSave)
                    .catch(handleError)
            }
        }
    }))
}

function newBank() {
    let p = preparePopupWeb(`class_new`)
    p.append(ce('h1', false, false, `Новые реквизиты`))

    let name = ce('input', false, false, false, {
        type: `text`,
        placeholder: `Название`
    })
    p.append(name)
    let creds = ce('input', false, false, false, {
        type: `text`,
        placeholder: `Реквизиты`
    })
    p.append(creds)

    p.append(ce('button', false, false, `Сохранить`, {
        onclick: function () {
            if (name.value && creds.value) {
                axios.post(`/${host}/admin/banks`, {
                        name: name.value,
                        creds: creds.value
                    }).then(handleSave)
                    .catch(handleError)
            }
        }
    }))

}

function newClass(courseId, authorId, bankId) {

    let courseData = courseId ? load(`courses`,courseId) : null
    let authorData = authorId ? load(`courses`,authorId) : null
    

    
    let p = preparePopupWeb(`class_new`)
    p.append(ce('h1', false, false, `Новое мероприятие`))

    let pic = ce('input', false, false, false, {
        type: `text`,
        placeholder: `фото`
    })
    p.append(pic)

    let name = ce('input', false, false, false, {
        type: `text`,
        placeholder: `Название`
    })
    p.append(name)
    let descShort = ce('textarea', false, false, false, {
        placeholder: `краткая подпись`
    })
    
    p.append(descShort)
    let descLong = ce('textarea', false, false, false, {
        placeholder: `развернутое описание`
    })
    p.append(descLong)
    
    

    let date = ce('input', false, false, false, {
        type: `datetime-local`
    })

    p.append(date)

    let kids = ce('input', false, false, false, {
        type: 'checkbox'
    })
    

    let kidsLabel = ce('label', false, false, 'Для детей')

    kidsLabel.append(kids)

    p.append(kidsLabel)

    let age = ce('input', false, false, false, {
        type: `number`,
        placeholder: `возраст`
    })

    p.append(age)

    Promise.resolve(courseData).then(c=>{
        if(c && c.course.age) age.value = c.course.age;
        if(c && c.course.kids) kids.checked = 1;
        if(c && c.course.description) descLong.value = c.course.description;
        if(c && c.course.name) name.value = c.course.name;
    })

    let price = ce(`input`, false, false, false, {
        type: `number`,
        min: 0,
        placeholder: `цена по записи`
    })

    let price2 = ce(`input`, false, false, false, {
        type: `number`,
        min: 0,
        placeholder: `цена на месте`
    })

    let price3 = ce(`input`, false, false, false, {
        type: `number`,
        min: 0,
        placeholder: `цена трансляции`
    })

    p.append(price)
    p.append(price2)
    p.append(price3)

    let author = ce('select')

    if (!authorId) load(`authors`).then(authors => {

        author.append(ce('option', false, false, `Выберите автора`, {
            value: ''
        }))
        authors
            .filter(a => a.active)
            .sort((a, b) => a.name < b.name ? -1 : 1)
            .forEach(a => author.append(ce('option', false, false, a.name, {
                value: a.id
            })))
        p.append(author)
    })

    let course = ce('select')

    if (!courseId) load(`courses`).then(courses => {

        course.append(ce('option', false, false, `Выберите курс`, {
            value: ''
        }))
        courses
            .filter(a => a.active)
            .sort((a, b) => a.name < b.name ? -1 : 1)
            .forEach(a => course.append(ce('option', false, false, a.name, {
                value: a.id
            })))
        p.append(course)
    })

    let bank = ce(`select`)

    if (!bankId) load(`banks`).then(banks => {

        bank.append(ce('option', false, false, `Выберите реквизиты`, {
            value: ''
        }))
        banks
            .filter(a => a.active)
            .sort((a, b) => a.name < b.name ? -1 : 1)
            .forEach(a => bank.append(ce('option', false, false, a.name, {
                value: a.id
            })))
        p.append(bank)
    })

    p.append(ce('button', false, false, `Сохранить`, {
        onclick: function () {
            if (name.value && date.value) {
                axios.post(`/${host}/admin/classes`, {
                        name: name.value,
                        descShort: descShort.value,
                        descLong: descLong.value,
                        authorId: authorId || author.value,
                        courseId: courseId || course.value,
                        kids: kids.checked ? true : false,
                        age: age.value,
                        pic: pic.value,
                        price: price.value,
                        price2: price2.value,
                        price3: price3.value,
                        date: new Date(date.value),
                        bankId: bankId || bank.value

                    }).then(handleSave)
                    .catch(handleError)
                    .finally(s => {
                        this.removeAttribute(`disabled`)
                    })
            }
        }
    }))




}

function newCourse() {
    let p = preparePopupWeb(`course_new`)
    p.append(ce('h1', false, false, `Новый курс`))

    let name = ce('input', false, false, false, {
        placeholder: `Имя`,
        type: `text`
    })
    let description = ce('textarea', false, false, false, {
        placeholder: `description`
    })

    let pic = ce('input', false, false, false, {
        placeholder: `ссылка на картинку`
    })

    p.append(name)
    p.append(description)

    let kids = ce('input', false, false, false, {
        type: 'checkbox'
    })

    let kidsLabel = ce('label', false, false, 'Для детей')

    kidsLabel.append(kids)

    p.append(kidsLabel)

    load(`authors`).then(authors => {
        let author = ce('select')
        author.append(ce('option', false, false, `Выберите автора`))
        authors
            .filter(a => a.active)
            .sort((a, b) => a.name < b.name ? -1 : 1)
            .forEach(a => author.append(ce('option', false, false, a.name, {
                value: a.id
            })))
        p.append(author)

        p.append(ce('button', false, false, `Сохранить`, {
            onclick: function () {
                if (name.value) {
                    axios.post(`/${host}/admin/courses`, {
                            name: name.value,
                            description: description.value,
                            authorId: author.value,
                            kids: kids.checked ? true : false,
                            pic: pic.value
                        }).then(handleSave)
                        .catch(handleError)
                        .finally(s => {
                            this.removeAttribute(`disabled`)
                        })
                }
            }
        }))
    })

}

function newAuthor() {
    let p = preparePopupWeb(`author_new`)

    let name = ce('input', false, false, false, {
        placeholder: `Имя`,
        type: `text`
    })
    let description = ce('textarea', false, false, false, {
        placeholder: `description`
    })
    let pic = ce('input', false, false, false, {
        placeholder: `ссылка на картинку`,
        type: `text`
    })
    p.append(name)
    p.append(pic)
    p.append(description)
    p.append(ce('button', false, false, `Сохранить`, {
        onclick: function () {
            if (name.value) {
                this.setAttribute(`disabled`, true)
                axios.post(`/${host}/admin/authors`, {
                        name: name.value,
                        description: description.value,
                        pic: pic.value
                    }).then(handleSave)
                    .catch(handleError)
                    .finally(s => {
                        this.removeAttribute(`disabled`)
                    })

            }

        }
    }))

}

function addClass(a, c, b) {
    return ce('button', false, false, `Добавить меропориятие`, {
        onclick: () => newClass(c, a, b)
    })
}

function addBank() {
    return ce('button', false, false, `Добавить реквизиты`, {
        onclick: () => newBank()
    })
}

function showStream(id){
    load(`streams`,id).then(stream=>{
        let p = preparePopupWeb(`stream_${a.id}`)
            p.append(ce(`p`,false,false,drawDate(stream.createdAt._seconds*1000)))
            if(!stream.active) p.append(ce('h1',false,false,`Запись отменена`))
            p.append(ce(`h2`,false,false,`Трансляция ${stream.className}`))
        
    })
}

function showAuthor(a,id) {

    if(!a){
        a = load(`authors`,id)
    }

    Promise.resolve(a).then(a=>{
        
        if(a.author) a = a.author

        let p = preparePopupWeb(`author_${a.id}`,`author_${a.id}`,[`authors`,a.id])


        p.append(logButton(`author`,a.id,`Лог по автору`))

        p.append(ce('h1', false, false, a.name, {
            onclick: () => edit(`authors`, a.id, `name`, `text`, a.name)
        }))

        p.append(ce('p',false,false,`Просмотров: ${a.views || 0}`))

        if (a.pic) {
            p.append(ce(`img`, false, `cover`, false, {
                src: a.pic,
                onclick: () => edit(`authors`, a.id, `pic`, `text`, a.pic)
            }))
        } else {
            p.append(ce(`button`, false, `accent`, `задать картинку`,{
                onclick: () => edit(`authors`, a.id, `pic`, `text`, null)
            }))
        }

        p.append(ce(`p`, false, false, a.description, {
            onclick: () => edit(`authors`, a.id, `description`, `textarea`, a.description)
        }))

        p.append(ce('p', false, false, `Доля автора: ${a.share ? `${a.share}%` : `не определена` }`, {
            onclick: () => edit(`authors`, a.id, `share`, `number`, a.share)
        }))

        p.append(ce('p', false, false, `Минимальная ставка: ${a.minWage ? `${cur(a.minWage)}` : `не определена` }`, {
            onclick: () => edit(`authors`, a.id, `minWage`, `number`, a.minWage)
        }))



        p.append(deleteButton(`authors`,a.id))



        // axios.get(`/${host}/admin/authors/${a.id}`)
        load(`authors`,a.id).then(authorData => {
            // authorData = authorData
            
            p.append(addClass(a.id))        
            
            p.append(ce('h2', false, false, authorData.classes.length ? `Лекции` : `Лекций еще нет`))
            
            authorData.classes.sort(byDate).forEach(cl => {
                p.append(showClassLine(cl))
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

function byDate(a,b){
    return b.date._seconds-a.date._seconds
}



function showBanks() {
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    window.history.pushState({}, "", `web?page=banks`);
    load(`banks`).then(banks=>{
        mc.innerHTML = '';
        mc.append(ce('h1', false, `header2`, `Реквизиты`))
        let c = ce('div')
        banks.forEach(cl => {
            c.append(showBankLine(cl))
        });
        c.append(addBank())
        
        let cc = ce('div',false,`controls`)
            cc.append(sortBlock([{
                attr: `name`,
                name: `По названию`
            },{
                attr: `views`,
                name: `По просмотрам`
            },{
                attr: `createdAt`,
                name: `По дате создания`
            }],c,banks,showBankLine))
            
        mc.append(cc)
        
        mc.append(c)

        mc.append(archiveButton(c))
    })
}

function showBankLine(b) {
    let c = ce('div', false, `sDivided`, false, {
        dataset: {
            active: b.active,
        }
    })

    c.append(ce(`h3`,false,false,b.name))
    c.append(ce(`p`,false,false,b.creds))

    if(!b.active) c.classList.add(`hidden`)

    c.onclick=()=>{
        showBank(b.id)
    }

    return c
}





function showClassLine(cl) {
    let c = ce('div', false, `sDivided`, false, {
        dataset: {
            active:     cl.active,
            kids:       cl.kids,
            soldOut:    cl.soldOut
        },
        onclick: () => {
            showClass(cl)
        }
    })

    let creds = ce(`div`)

    creds.append(ce('span', false, `info`, cl.views ? `Просмотров: ${cl.views}` : ``))
    creds.append(ce('span', false, `info`, cl.createdAt ? `Создан(-а): ${drawDate(cl.createdAt._seconds*1000)}` : cl.createdAt))

    c.append(creds)

    c.append(ce('h2', false, false, cl.name))
    c.append(ce('p', false, false, `${drawDate(cl.date._seconds*1000,false,{time:true})}`))
    return c
}

function addComment(c, id) {
    let comment = prompt(`О чем предупредить администратора?`)
    if (!comment) return alert(`запрос прерван`)
    axios.put(`/${host}/admin/tickets/${id}`, {
        value: comment,
        attr: `comment`
    }).then(s => {
        alert(`ok`)
        c.innerHTML = comment
    }).catch(err => {
        alert(err.message)
    })
}




function showAuthors() {
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    window.history.pushState({}, "", `web?page=authors`);
    load(`authors`).then(authors=>{
        mc.innerHTML = '';
        mc.append(ce('h1', false, `header2`, `Авторы`))
        mc.append(ce(`p`,false,false,`В этом разделе отображаются авторы. У каждого из них появляется собственная страница, а у пользователей — возможность подписаться на обновления.<br>По умолчанию отображаются только активные авторы. Если кто-то ушел, а потом вернулся, не стоит создавать новую запись, откройте архив и верните к жизни предыдущую запись.`))


        let c = ce('div')
        
        authors.forEach(a => {
            c.append(showAuthorLine(a))
        });

        let cc = ce('div',false,`controls`)
            cc.append(sortBlock([{
                attr: `name`,
                name: `По названию`
            },{
                attr: `views`,
                name: `По просмотрам`
            },{
                attr: `createdAt`,
                name: `По дате создания`
            }],c,authors,showAuthorLine))
        
        mc.append(cc)

        c.append(ce('button', false, false, `Добавить автора`, {
            onclick: () => newAuthor()
        }))

        mc.append(c)

        mc.append(archiveButton(c))
    })
}



function showAuthorLine(a) {

    // console.log(a.name,a.createdAt)

    let div = ce('div', false, `sDivided`, false, {
        dataset: {
            active: a.active
        }
    })

    if(!a.active) div.classList.add(`hidden`)

    let creds = ce(`div`)

    creds.append(ce('span', false, `info`, a.views ? `Просмотров: ${a.views}` : ``))
    creds.append(ce('span', false, `info`, a.createdAt ? `Создан(-а): ${drawDate(a.createdAt._seconds*1000)}` : a.createdAt))

    div.append(creds)

    div.append(ce('h2', false, `clickable`, a.name, {
        onclick: () => showAuthor(a)
    }))

    div.append(ce('p', false, false, a.description || `без описания`))

    

    return div
}



function filterUsers(role, container, button) {
    let c = button.parentNode;
    c.querySelectorAll('button').forEach(b => b.classList.remove('active'))
    c.querySelectorAll('button').forEach(b => b.classList.add('passive'))
    button.classList.add('active')
    button.classList.remove('passive')
    
    container.querySelectorAll('.userLine').forEach(user => {
        if (!role) return user.classList.remove('hidden')

        if (user.dataset[role] == 'true') {
            user.classList.remove('hidden')
        } else {
            user.classList.add('hidden')
        }
    })
}


function postSection(postType, id, p) {
    return ce('button', false, `dateButton`, `Написать гостям`, {
        dataset: {
            booked: 1
        },
        onclick: function () {
            this.remove;
            let txt = ce('textarea', false, false, false, {
                placeholder: `Вам слово`
            })

            let type = ce('select')

            if (postType == `class`) {
                type.append(ce('option', false, false, `Всем`, {
                    value: `all`
                }))
                type.append(ce('option', false, false, `Пришедшим`, {
                    value: `inside`
                }))
                type.append(ce('option', false, false, `Опаздантам`, {
                    value: `outside`
                }))
            }



            p.append(txt)
            p.append(type)


            p.append(ce('button', false, `dateButton`, `Отправить`, {
                dataset: {
                    booked: 1
                },
                onclick: function () {

                    if (!txt.value) return alert(`Я не вижу ваших букв!`)

                    this.setAttribute(`disabled`, true)

                    axios.post(`/${host}/admin/announce`, {
                        [postType]: id,
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
    })
}

function showClassEdit(c) {
    let p = preparePopupWeb(`class_edit`)

    p.append(ce('h1', false, false, c.name ? `Редактируем мероприятие` : `Новое мероприятие`))


}

function showClass(cl, id) {
    if (!cl) {
        cl = load(`classes`, id).then(cl => cl.class)
        // axios.get(`/${host}/admin/classes/${id}`).then(d=>cl = d.data())
    }

    Promise.resolve(cl).then(cl => {
        let p = preparePopupWeb(`class_${cl.id}`,`class_${cl.id}`,[`classes`,cl.id])

        p.append(logButton(`class`,cl.id,`Лог занятия`))

        if (cl.pic) p.append(ce(`img`, false, `cover`, false, {
            src: cl.pic,
            onclick: () => edit(`classes`, cl.id, `pic`, `textarea`, cl.descLong)
        }))

        p.append(ce('p', false, false, `${drawDate(cl.date._seconds*1000,'ru',{time:true})}`, {
            onclick: () => edit(`classes`, cl.id, `date`, `date`, cl.date)
        }))

        p.append(ce('h1', false, false, cl.name, {
            onclick: () => edit(`classes`, cl.id, `name`, `text`, cl.name)
        }))

        p.append(ce('p',false,false,`Просмотров: ${cl.views || 0}`))

        if (cl.kids) p.append(ce(`button`, false, `accent`, `для детей ${cl.age  || `без возрастных ограничений`}`))

        let alertsContainer = ce('div', false, 'flexible')
        // if(!cl.capacity)        alertsContainer.append(ce(`button`,false,`accent`,`вместимость не указана`))
        if (!cl.pic) alertsContainer.append(ce(`button`, false, `accent`, `задать картинку`, {
            onclick: () => edit(`classes`, cl.id, `pic`, `text`, null)
        }))
        if (!cl.author) alertsContainer.append(ce(`button`, false, `accent`, `выбрать автора`, {
            onclick: () => edit(`classes`, cl.id, `authorId`, `authorId`, null)
        }))
        if (!cl.course) alertsContainer.append(ce(`button`, false, `accent`, `выбрать курс`, {
            onclick: () => edit(`classes`, cl.id, `courseId`, `courseId`, null)
        }))

        if (!cl.paymentDesc) alertsContainer.append(ce(`button`, false, `accent`, `выбрать счет`, {
            onclick: () => edit(`classes`, cl.id, `bankId`, `bankId`, null)
        }))

        p.append(alertsContainer)

        p.append(ce('p', false, false, `ведет: ${cl.author||`неизвестно кто`}`, {
            onclick: () => edit(`classes`, cl.id, `author`, `authorId`, cl.authorId)
        }))

        if(cl.price){
            p.append(ce(`p`,false,false,`Цена по записи: ${cur(cl.price,`GEL`)}`, {
                onclick: () => edit(`classes`, cl.id, `price`, `number`, cl.price)
            }))
        } else {
            p.append(ce(`button`, false, `accent`, `задать цену по записи`, {
                onclick: () => edit(`classes`, cl.id, `price`, `number`, null)
            }))
        }

        if(cl.price2){
            p.append(ce(`p`,false,false,`Цена на месте: ${cur(cl.price2,`GEL`)}`, {
                onclick: () => edit(`classes`, cl.id, `price2`, `number`, cl.price2)
            }))
        } else {
            p.append(ce(`button`, false, `accent`, `задать цену на месте`, {
                onclick: () => edit(`classes`, cl.id, `price2`, `number`, null)
            }))
        }

        if(cl.price3){
            p.append(ce(`p`,false,false,`Цена трансляции: ${cur(cl.price3,`GEL`)}`, {
                onclick: () => edit(`classes`, cl.id, `price3`, `number`, cl.price3)
            }))
        } else {
            p.append(ce(`button`, false, `accent`, `задать цену трансляции`, {
                onclick: () => edit(`classes`, cl.id, `price3`, `number`, null)
            }))
        }

        // p.append(ce('p', false, false, `цена: ${} / ${cur(cl.price2,`GEL`)} / ${cur(cl.price3,`GEL`)}`))

        p.append(ce('p', false, `story`, cl.descShort, {
            onclick: () => edit(`classes`, cl.id, `descShort`, `text`, cl.descShort)
        }))

        p.append(ce('p', false, `story`, cl.descLong, {
            onclick: () => edit(`classes`, cl.id, `descLong`, `textarea`, cl.descLong)
        }))

        p.append(ce(`p`,false,false,cl.streamDesc ? cl.streamDesc : `параметры трансляции не заданы`,{
            onclick:()=>edit(`classes`, cl.id, `streamDesc`, `text`, cl.streamDesc)
        }))

        p.append(ce('button',false,false,`Отправить ссылку на трансляцию`,{
            onclick:function(){
                this.setAttribute(`disabled`,true)
                axios.post(`/${host}/admin/streamAlerts/${cl.id}`).then(s=>{
                    if(s.data.success) return alert(`ok`)
                    return alert(s.data.comment)
                }).catch(err=>{
                    alert(err.message)
                }).finally(()=>{
                    this.removeAttribute('disabled')
                })
            }
        }))


        let inc = ce('div')

        p.append(inc)

        if(cl.authorId) {
            load(`authors`,cl.authorId).then(a=>{
                inc.append(ce('p', false, `story`, cl.authorShare || a.share || `процент автора не указан`, {
                    onclick: () => edit(`classes`, cl.id, `authorShare`, `number`, cl.authorShare)
                }))

                inc.append(ce('p', false, `story`, cl.minShare || a.minWage || `минимальная ставка не указана`, {
                    onclick: () => edit(`classes`, cl.id, `authorShare`, `number`, cl.minShare)
                }))
            })
        }

        



        let guests = ce('div');

        p.append(guests)



        p.append(ce('button', false, `dateButton`, `Показать гостей`, {
            dataset: {
                booked: 1
            },
            onclick: function () {
                this.remove()
                load(`classes`,cl.id)
                    .then(data => {
                        let rating = data.tickets.filter(t => t.rate).map(t => t.rate)

                        if (rating.length) {

                            let av = (rating.reduce((a, b) => a + b, 0) / rating.length).toFixed(2)

                            guests.prepend(ce('h4', false, 'light', `Рейтинг ${av} (${rating.length} голосов)`))
                        }


                        guests.append(ce(`p`, false, false, `Гостей: ${data.tickets.length}${cl.price ? ` // оплачено ${data.tickets.filter(g=>g.isPayed).length}` : ''}${` // пришли ${data.tickets.filter(g=>g.status == 'used').length}`}`))
                        
                        guests.innerHTML += `<table><tr><th>Имя</th><th>💲</th><th>📍</th><th>примечания админу</th></tr>
                            ${data.tickets.map(u=>`<tr class="story">
                                <td onclick="showUser(false,${u.user})">${u.userName}</td>
                                <td>${cl.price ? (u.isPayed?'✔️':'❌') : '🚫'}</td>
                                <td>${(u.status == 'used'? '✔️' : '❌')}</td>
                                <td class="editable" onclick=addComment(this,"${u.id}")>${u.comment || `без примечаний`}</td>
                                <td onclick=showTicket(false,"${u.id}")>Открыть билет</td>
                            </tr>`).join('')}</table>`

                        guests.append(ce(`h3`,false,false,`Трансляции`))
                        
                        if(data.streams.length){
                            data.streams.forEach(s=>{
                                guests.append(drawStreamLine(s))
                            })
                        } else {
                            guests.append(ce(`p`,false,false,`Никто еще не записывался`))
                        }
                    })
            }
        }))

        p.append(postSection(`class`, cl.id, p))

        p.append(ce(`button`, false, `dateButton`, `Показать лист ожидания`, {
            dataset: {
                booked: 1
            },
            onclick: () => {
                let wl = ce('div')
                let t = ce('table')
                let n = ce(`tr`)
                n.append(ce(`th`, false, false, `гость`))
                n.append(ce(`th`, false, false, `дата`))
                n.append(ce(`th`, false, false, `статус`))
                t.append(n)
                axios.get(`/${host}/admin/classWL?class=${cl.id}`).then(d => {
                    d.data.sort((a, b) => a.createdAt._seconds - b.createdAt._seconds).forEach(rec => {
                        let line = ce('tr')
                        line.append(ce(`td`, false, false, uname(rec.user, rec.user.id)))
                        line.append(ce(`td`, false, false, drawDate(rec.createdAt._seconds * 1000, `ru`, {
                            time: true
                        })))
                        line.append(ce(`td`, false, false, rec.active))
                        t.append(line)
                    })
                })
                wl.append(t)
                p.append(wl)
            }
        }))

        p.append(ce(`button`, false, `dateButton`, `Запостить в канал`, {
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

        let rep = ce('div')
        p.append(rep)

        rep.append(ce(`button`, false, false, `Дублировать`, {
            onclick: () => replicate(cl.id)
        }))

        p.append(delButton(`classes`, cl.id))
        p.append(ce('button',false,false,cl.soldOut?`снять солдаут`:`солдаут`,{
            onclick:()=>{
                let shure = confirm(`Уверены?`)
                if(shure) {
                    axios.put(`/${host}/admin/classes/${cl.id}`,{
                        attr: `soldOut`,
                        value: !cl.soldOut
                    }).then(handleSave)
                    .catch(handleError)
                }
            }
        }))

    })

}

function drawStreamLine(s){
    let c = ce(`div`,false,false,false,{
        dataset:{active:s.active}
    })
    c.append(ce(`span`,false,`info`,drawDate(s.createdAt._seconds*1000)))
    if(s.payed){
        c.append(ce(`p`,false,false,`Оплачено`))
    } else {
        c.append(ce(`p`,false,false,`Еще не оплачено`))
        c.append(ce(`button`,false,false,`Отметить как оплаченную`,{
            onclick:()=>{
                update(`streams`,s.id,{payed:true})
            }
        }))
    }
    return c
}

function delButton(col, id) {
    let cd = ce('div')
    cd.append(ce('button', false, false, `Отменить/Архивировать`, {
        onclick: () => {
            let shure = confirm(`Вы уверены?`)
            if (shure) {
                deleteEntity(col, id)
            }
        }
    }))
    return cd
}

function showLogs() {
    window.history.pushState({}, "", `web?page=logs`);
    window.location.reload()
}

function showUsersChart(userData) {

    console.log(userData)

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

function update(col,doc,data,text){
    let sure = confirm(text||`Уверены?`)
    if (sure) return axios.put(`/${host}/admin/${col}/${doc}`,data)
}

function showTicket(t, id) {
    if (!t) {
        t = axios.get(`/${host}/admin/tickets/${id}`).then(d => d.data)
    }
    Promise.resolve(t).then(ticket => {
        let p = preparePopupWeb(`ticket${ticket.id}`)

        p.append(ce(`p`,false,`info`,`Создан ${drawDate(ticket.createdAt._seconds*1000)}`))
        
        if (!ticket.active) p.append(ce('h1', false, false, `Отменен`))
        
        p.append(ce('h1', false, false, `Билет: ${ticket.className}`, {
            onclick: () => showClass(false, ticket.class)
        }))
        
        p.append(ce('h2', false, false, `${ticket.userName}${ticket.outsider? ` (не через бот)` :''}`, {
            onclick: () => {
                if (ticket.user) {
                    showUser(false, ticket.user)
                }
            }
        }))
        
        if (ticket.alert) p.append(ce('p', false, false, `ВАЖНО: ${ticket.alert}`))
        
        if (ticket.isPayed) p.append(ce(`p`, false, false, 'оплачен'))

        p.append(ce('p', false, false, ticket.used ? `использован` : `не использован`))



        if (ticket.rate) p.append(ce('p', false, false, `Оценка: ${ticket.rate}`))
        if (ticket.review) p.append(ce('p', false, false, `Отзыв: ${ticket.review}`))


    })
}

function showTickets() {
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    window.history.pushState({}, "", `web?page=tickets`);
    load(`tickets`)
        .then(tickets => {
            mc.innerHTML = ''
            mc.append(ce('h1', false, false, `Билеты`))
            let table = ce('table', false, `wide`)
            let headers = ce('tr')
            // headers.append(ce('th',false,false,`id`))
            headers.append(ce('th', false, false, `открыть`))
            headers.append(ce('th', false, false, `гость`))
            headers.append(ce('th', false, false, `мероприятие`))
            headers.append(ce('th', false, false, `оплата`))
            headers.append(ce('th', false, false, `статус`))
            headers.append(ce('th', false, false, `примечания`))
            table.append(headers)
            tickets.forEach(t => {
                let line = ce('tr', false, false, false)
                // line.append(ce('td',false,false,t.id))
                line.append(ce('td', false, false, drawDate(t.createdAt._seconds * 1000),{
                    onclick: () => showTicket(t)
                }))
                line.append(ce('td', false, false, t.userName,{
                    onclick: () => showUser(false, t.user)
                }))
                line.append(ce('td', false, false, t.className,{
                    onclick: () => showClass(false, t.class)
                }))
                line.append(ce('td', false, false, t.isPayed ? '✔️' : '❌',{
                    onclick:()=>togglePayed(t.id,t.isPayed)
                }))
                line.append(ce('td', false, false, t.status ? '✔️' : '❌',{
                    onclick:()=>toggleStatus(t.id,t.status)
                }))
                line.append(ce('td', false, false, t.comment || `без примечаний`,{
                    onclick: function(){addComment(this,t.id)}
                }))
                table.append(line)
            })
            mc.append(table)
        })
}

function showUsers() {
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    window.history.pushState({}, "", `web?page=users`);
    axios.get(`/${host}/admin/users`)
        .then(data => {
            console.log(data.data)
            mc.innerHTML = '';
            mc.append(ce('h1', false, `header2`, `Пользователи`))
            let c = ce('div')

            let chart = ce(`div`, `chartdiv`)

            mc.append(chart)

            let udata = {}




            data.data.forEach(cl => {
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
                blocked: `Вышли из чата`,
                admin: `админы`,
            }

            Object.keys(filterTypes).forEach(type => {
                mc.append(ce('button', false, type, filterTypes[type], {
                    onclick: function () {
                        filterUsers(type, c, this)
                    }
                }))
            })

            let sortTypes = {
                appOpens: `По частоте использования`,
                classes: `По количеству лекций`,
                // fellow: `fellows`,
            }

            Object.keys(sortTypes).forEach(type => {
                mc.append(ce('button', false, type, sortTypes[type], {
                    onclick: function () {
                        c.innerHTML = ''
                        data.data.sort((a, b) => (b[type] || 0) - (a[type] || 0)).forEach(cl => {
                            c.append(showUserLine(cl, (cl[type] || 0)))
                        });
                    }
                }))
            })

            mc.append(c)

            showUsersChart(d)

            // data.data.users.forEach(cl => {
            //     if(!udata[new Date(cl.createdAt).toISOString()]) udata[new Date(cl.createdAt).toISOString()] =0
            //     udata[new Date(cl.createdAt).toISOString()] ++ 
            //     // c.append(showUserLine(cl))
            // });
        })
        .catch(err => {
            alert(err.message)
        })
}


function showUserLine(u, cnt) {
    let c = ce(`div`, false, `userLine`, false, {
        dataset: {
            active: u.active,
            blocked: !u.active,
            admin: u.admin,
            fellow: u.fellow,
        }
    })

    c.append(ce('h3', false, false, (cnt ? `${cnt}: ` : '') + uname(u, u.id), {
        onclick: () => {
            showUser(u)
        }
    }))

    return c;
}


function showUser(u, id) {

    console.log(u,id)

    if (!u) {
        u = load(`users`,id)
    }

    Promise.resolve(u).then(u => {
        
        let classes = u.classes;
        let subscriptions = u.subscriptions;
        if(u.user) u = u.user

        let p = preparePopupWeb(`user${u.id}`)

        p.append(logButton(`user`,u.id,`Лог по пользователю ${u.id}`))
        
        p.append(ce('h1', false, false, `${uname(u,u.id)} (${u.language_code})`))
        p.append(ce('p', false, false, `регистрация: ${drawDate(u.createdAt._seconds*1000)}`))
        p.append(ce('p', false, false, `email: ${u.email || `не указан`}`))
        p.append(ce('p', false, false, `about: ${u.about || `о себе не рассказывал`}`))
        p.append(ce('p', false, false, `occupation: ${u.occupation || `о себе не рассказывал`}`))

        let adminLinks = [{
            attr: `admin`,
            name: `сделать админом`,
            disname: `снять админство`
        },{
            attr:       `blocked`,
            name:       `заблокировать`,
            disname:    `разблокировать`
        }]

        let ac = ce(`div`)
        p.append(ac)

        adminLinks.forEach(type=>{
            ac.append(ce('button',false,false, u[type.attr] ? type.disname : type.name,{
                onclick:()=>{
                    axios.put(`/${host}/admin/users/${u.id}`, {
                        attr: type.attr,
                        value: !u[type.attr]
                    }).then(handleSave)
                    .catch(handleError)
                }
            }))
        })

        let tags = ce('div')

        tags.append(ce('h2',false,false,`Теги`))

        p.append(tags)

        p.append(ce(`button`,false,[`dateButton`,`dark`],`Добавить тег`,{
            onclick:() => addTag(u.id)
        }))

        load(`userTags`,u.id).then(tgs=>{
            if(!tgs.length) tags.append(ce('p',false,false,`тегов еще нет`))
            tgs.forEach(t=>{
                tags.append(ce('button',false,[`dateButton`,`dark`],t.name,{
                    onclick:function(){
                        removeTag(t.id,u.id,this)
                    }
                }))
            })
        })


        let messenger = ce('div')
        p.append(messenger)

        messenger.append(ce(`button`,false,false,`Открыть переписку`,{
            onclick:function(){
                this.remove()
                load(`messages`,u.id).then(messages=>{
                    let mc = ce(`div`,false,`messenger`)
                    messenger.append(mc)
                    messages.forEach(m=>{
                        let message = ce('div',false,false,false,{dataset:{reply:m.isReply}})
                            message.append(ce(`span`,false,`info`,drawDate(m.createdAt._seconds*1000,false,{time:true})))
                            message.append(ce(`p`,false,false,m.text))
                        mc.prepend(message)
                    })
                    let txt = ce('textarea',false,false,false,`вам слово`)
                    messenger.append(txt)
                    messenger.append(ce(`button`,false,false,`Отправить`,{
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

        p.append(ce(`h2`, false, false, `Лекции`))
        
        if(classes) classes.forEach(c=>{
            p.append(ce('p', false, false, `${drawDate(c.createdAt._seconds*1000)}: ${c.className} (${c.status == `used` ? `✔️` : `❌`})`, {
                dataset: {
                    active: c.active
                }
            }))
        })

        p.append(ce(`h2`, false, false, `Подписки`))
        
        if(subscriptions) subscriptions.forEach(c=>{
            p.append(showSubscriptionsLine(c))
        })
        
    })
}


function showSubscriptionsLine(s){
    return ce('p',false,false,`еще не готово`)
}



function preparePopupWeb(name,link,weblink) {
    let c = ce('div', false, 'popupWeb')
    c.append(ce('span', false, `closeMe`, `✖`, {
        onclick: () => {
            c.classList.add(`slideBack`)
            setTimeout(function () {
                c.remove()
            }, 500)
        }
    }))

    if(link)        c.append(copyLink(link,appLink))
    if(weblink)     c.append(copyWebLink(web,weblink))
    // if(weblink)c.append(copyLink(link,appLink))

    document.body.append(c)
    let content = ce('div', false, `content`)
    c.append(content)
    return content;
}


function showSchedule() {
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    window.history.pushState({}, "", `web?page=schedule`);
    axios.get(`/${host}/admin/classes`)
        .then(data => {
            console.log(data.data)
            mc.innerHTML = '';
            mc.append(ce('h1', false, `header2`, `Расписание`))
            mc.append(drawSchedule(data.data))
            mc.append(addClass())
            let c = ce('div')

            data.data.forEach(cl => {
                c.append(showClassLine(cl))
            });
            
            mc.append(c)


        })
        .catch(err => {
            console.log(err)
            alert(err.message)
        })
}


// ТЕГИ

function showTags(){
    closeLeft()
    let p = preparePopupWeb(`tags`)
    p.append(ce('h2',false,false,`Загружаем...`))
    load(`tags`).then(tasks=>{
        p.innerHTML = `<h2>Теги</h2>`
        p.append(ce('button',false,`dateButton`,`Добавить`,{
            dataset:{booked:1},
            onclick:()=>showNewTag()
        }))
        tasks.forEach(t=>{
            p.append(tagLine(t))
        })
    })
}

function showTag(tagId){
    let p = preparePopupWeb(`tags_${tagId}`)
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
        
        if(tag.active) p.append(deleteButton(`tags`,tagId))

        let users = ce('div',false,false,`загружаем пользователей`)
        
        p.append(users)

        load(`tagsUsers`,tagId).then(tusers=>{
            
            users.innerHTML = tusers.length ? `${tusers.length} пользователей` : `юзеров нет`
            
            tusers.forEach(u=>{
                load(`users`,u.user).then(u=>{
                    users.append(showUserLine(u.user))
                })
            })
        })

        let msg = ce(`div`,false,`hidden`)
            msg.append(ce(`h2`,false,false,`Рассылка по пользователям`))
            let txt = ce(`textarea`,false,false,false,{
                placeholder: `Вам слово`
            })
            msg.append(txt)
            msg.append(ce(`button`,false,false,`Отправить`,{
                onclick:function(){
                    if(!txt.value) return alert(`Я не вижу ваших букв!`)
                    this.setAttribute(`disabled`,true)
                    axios.post(`/${host}/admin/news`,{
                        text:       txt.value,
                        name:       `Рассылка по тегу «${tag.name}»`,
                        filter:     `tagged`,
                        tag:        tag.id
                    }).then(s=>{
                        handleSave(s)
                        txt.value = null;
                    }).catch(handleError)
                    .finally(()=>{
                        this.removeAttribute(`disabled`)
                    })
                }
            }))
        p.append(msg)
        p.append(ce(`button`,false,false,`Отправить рассылку`,{
            onclick:function(){
                this.remove()
                msg.classList.remove(`hidden`)
            }
        }))

    })
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

function showNewTag(){
    closeLeft()
    let p = preparePopupWeb(`newTag`)
    p.append(ce('h2',false,false,`Новый тег`))
    let name = ce('input',false,`block`,false,{placeholder: `Название`})
    let desc = ce('textarea',false,false,false,{placeholder: `Описание`})
    let sb = ce('button',false,`dateButton`,`Отправить`,{
        dataset:{booked:1},
        onclick:function(){
            if(name.value && desc.value){
                this.setAttribute(`disabled`,true)
                axios.post(`/${host}/admin/tags`,{
                    name:           name.value,
                    description:    desc.value
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
    inpC.append(desc)
    p.append(sb)
}

function tagLine(t){
    let c = ce('div',false,'sDivided',false,{
        onclick:()=>showTag(t.id),
        dataset:{active:t.active}
    });
    c.append(ce('span',false,`info`,drawDate(t.createdAt._seconds*1000)))
    c.append(ce('h3',false,false,t.name))
    c.append(ce('p',false,`info`,t.description))
    return c;
}

// ЛОГИ


function logButton(collection,id,credit){
    return ce(`button`,false,[`dateButton`,`dark`,`slim`],credit||`Логи`,{
        onclick:()=>{
            let p = preparePopupWeb(`logs_${collection}_${id}`)
                p.append(ce('h2',false,false,`Загружаем...`))
                load(`logs`,`${collection}_${id}`).then(logs=>{
                    p.innerHTML = null;
                    p.append(ce('h1',false,false,credit||`Логи`))
                    logs.forEach(l=>{
                        p.append(logLine(l))
                    })
                })
        }
    })
}

function logLine(l){
    let c = ce('div',false,`sDivided`)
        c.append(ce(`span`,false,`info`,drawDate(l.createdAt._seconds*1000)))
        c.append(ce('p',false,false,l.text))
        
        if(l.user){
            c.append(ce('button',false,[`dateButton`,`dark`,`inline`],`Открыть профиль`,{
                onclick:()=>showUser(false,l.user)
            }))
        }

        if(l.task){
            c.append(ce('button',false,[`dateButton`,`dark`,`inline`],`Открыть задание`,{
                onclick:()=>showTask(l.task)
            }))
        }

        if(l.tag){
            c.append(ce('button',false,[`dateButton`,`dark`,`inline`],`Открыть тег`,{
                onclick:()=>showTag(l.tag)
            }))
        }

        

    return c;
}


// COMMON

function editable(e){
    return ce(e.tag||`p`,false,false,e.value||'добавьте буквы',{
        onclick:function(){
            edit(e.entity,e.id,e.attr,e.type||`text`,e.value||null,this)
        }
    })
}