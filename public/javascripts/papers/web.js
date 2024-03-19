
let host = `paper`

let users = {};


let mc = document.querySelector(`#main`)

function closeLeft() {
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p => p.remove())
}

const appLink = `https://t.me/paperstuffbot/app`
const web = `https://dimazvali-a43369e5165f.herokuapp.com/paper/mini`


if(start){
    start = start.split('_')
    switch(start[0]){
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



function drawCoworkingShedule(records,start){
    
    let cc = ce('div', false, `scroll`)
    let c = ce('div', false, `flex`)
    
    load(`coworking`).then(data=>{
        let fc = ce('div',false,`flex`)
        data.halls
        .sort((a,b)=>b.name<a.name?1:-1)
        .forEach(h=>{
            fc.append(ce(`button`,false,[`dark`,`dateButton`],h.name,{
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
            
            day.append(ce(`h3`, false, false, drawDate(date)))
            
            data.records
                .filter(e => typeof e.date == `string` && new Date(e.date).toISOString().split('T')[0] == isoDate)
                .sort((a,b)=>b.hallName<a.hallName?1:-1)
                .forEach(e => {
                let rec = ce('div',false,`recordLine`,false,{
                    dataset:{hall:e.hall}
                })
                    rec.append(ce(`span`,false,`info`,e.hallName))
                load(`users`,e.user).then(u=>rec.append(ce(`button`,false,
                    [`dark`,`dateButton`,((e.payed||!e.paymentNeeded)?'fineButton':'reg'),e.status==`used`?`active`:'reg']
                    ,unameShort(u,u.id),{
                    onclick:()=> showUser(u,u.id)
                })))
                day.append(rec)
            })
            c.append(day)
            i++
        }    
    })

    
    return cc
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
        day.append(ce(`h3`, false, false, drawDate(date)))
        events.filter(e => typeof e.date == `string` && new Date(e.date).toISOString().split('T')[0] == isoDate).forEach(e => {
            day.append(ce('p', false, false, `${new Date(e.date).toLocaleTimeString([],{ hour: "2-digit", minute: "2-digit" })}: ${e.name}`, {
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
    let p = preparePopupWeb(`newClass`,false,false,true)
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

    let edit = ce('div', false, `editWindow`)
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
    } else if (type == 'textarea') {
        f = ce('textarea', false, false, false, {
            value: value,
            type: type,
            placeholder: `Новое значение`
        })
        edit.append(f)
    } else {
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
                        value: type == `date` ? new Date(f.value) : (type == `number` ? +f.value : f.value)
                    }).then((s) => {
                        handleSave(s)
                        if (container) container.innerHTML = f.value
                    })
                    .catch(handleError)
            }
        }
    }))
    document.body.append(edit)
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
    let p = preparePopupWeb(`standAlone`,false,false,true)
        p.append(ce('h1',false,false,`Отдельные страницы`))
        p.append(ce(`button`,false,[`dark`,`dateButton`],`Добавить`,{
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
        plugins: 'anchor autolink charmap codesample emoticons image link lists media searchreplace table visualblocks wordcount checklist mediaembed casechange export formatpainter pageembed linkchecker permanentpen powerpaste advtable advcode editimage advtemplate mentions tinycomments tableofcontents footnotes mergetags autocorrect typography inlinecss',
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
                plugins: 'anchor autolink charmap codesample emoticons image link lists media searchreplace table visualblocks wordcount checklist mediaembed casechange export formatpainter pageembed linkchecker a11ychecker tinymcespellchecker permanentpen powerpaste advtable advcode editimage advtemplate tableofcontents footnotes mergetags typography inlinecss',
                toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table mergetags | addcomment showcomments | spellcheckdialog a11ycheck typography | align lineheight | checklist numlist bullist indent outdent | emoticons charmap | removeformat',
                tinycomments_mode: 'embedded',
                tinycomments_author: 'Author name',
                mergetags_list: [
                  { value: 'First.Name', title: 'First Name' },
                  { value: 'Email', title: 'Email' },
                ],
                ai_request: (request, respondWith) => respondWith.string(() => Promise.reject("See docs to implement AI Assistant")),
              });

            p.append(ce(`button`,false,[`dark`,`dateButton`],`Сохранить правки в HTML`,{
                onclick:()=>{
                    let html = tinymce.activeEditor.getContent("#html");
                    axios.put(`/${host}/admin/standAlone/${page.id}`,{
                        attr: `html`,
                        value: html
                    }).then(handleSave)
                    .catch(handleError)
                }
            }))

            p.append(deleteButton(`standAlone`,page.id,!page.active,[`dark`,`dateButton`]))
        })
}

function showCoworking(){
    closeLeft()
    let p = preparePopupWeb(`coworking`,false,false,true)
    p.append(ce('h1',false,false,`Коворкинг`))
    
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

    return ce(`button`,false,[`dark`,`dateButton`],`Закрыть зал`,{
        onclick:()=>{
            let edit = ce('div', false, `editWindow`)
            document.body.append(edit)
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

        p.append(deleteButton(`halls`,id,!h.active,[`dark`,`dateButton`]))

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
    
    

    if(!butUser) load(`users`,r.user).then(u=>{
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
    
    

    if(r.status != `used`) controls.append(deleteButton(`coworking`,r.id,!r.active,[`dark`,`dateButton`]))

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
    mc.innerHTML = '<h1>Загружаем...</h1>'
    window.history.pushState({}, "", `web?page=classes`);
    axios.get(`/${host}/admin/classes`)
        .then(data => {
            console.log(data.data)
            mc.innerHTML = '';
            mc.append(ce('h1', false, `header2`, `Расписание`))
            mc.append(drawSchedule(data.data))
            let c = ce('div')

            c.append(ce('button',false,[`dark`,`dateButton`],`Добавить`,{
                onclick:()=>newClass()
            }))

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
        c.append(ce('h2', false, false, cl.name))
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



function filterUsers(role, container, button,counter) {
    let c = button.parentNode;
    c.querySelectorAll('button').forEach(b => b.classList.remove('active'))
    c.querySelectorAll('button').forEach(b => b.classList.add('passive'))
    button.classList.add('active')
    button.classList.remove('passive')
    let cnt = 0
    container.querySelectorAll('.userLine').forEach(user => {
        if (!role) return user.classList.remove('hidden')

        if (user.dataset[role] == 'true') {
            user.classList.remove('hidden')
            cnt++
        } else {
            user.classList.add('hidden')
        }
    })

    counter.innerHTML = `Всего: ${cnt}`


}

function showClass(cl, id) {
    let p = preparePopupWeb(`class_${cl.id || id}`, `class_${cl.id|| id}`, [`classes`, cl.id || id])
    
    p.append(logButton(`class`,cl.id||id,`логи`))

    if (!cl) {
        cl = load(`classes`, id)
    }
    Promise.resolve(cl).then(cl => {
        
        window.history.pushState({}, "", `web?page=classes_${cl.id}`);

        if(new Date()<new Date(cl.date)){
            let mBox = ce(`div`,false,`flex`)
                p.append(mBox)
            
            mBox.append(ce(`button`,false,[`dark`,`dateButton`],`Отправить себе`,{
                onclick:()=>{
                    axios.get(`/${host}/admin/alertClass/${cl.id}?self=true`)
                        .then(handleSave)
                        .catch(handleError)
                }
            }))

            mBox.append(ce(`button`,false,[`dark`,`dateButton`],`Рассылка по админам`,{
                onclick:()=>{
                    let sure = confirm(`Стартуем по админам. Точно?`)
                    if(sure) axios.get(`/${host}/admin/alertClass/${cl.id}?admins=true`)
                        .then(handleSave)
                        .catch(handleError)
                }
            }))
            mBox.append(ce(`button`,false,[`dark`,`dateButton`],`Рассылка по пользователям`,{
                onclick:function(){
                    let sure = confirm(`Стартуем по админам. Точно?`)
                    if(sure) {
                        this.remove();
                        axios.get(`/${host}/admin/alertClass/${cl.id}`)
                            .then(handleSave)
                            .catch(handleError)
                    }
                }
            }))
        }
        
        
        if (cl.pic) p.append(ce(`img`, false, `cover`, false, {
            src: cl.pic,
            onclick: function () {
                edit(`classes`, cl.id, `pic`, `text`, cl.pic || null)
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

        if(cl.rate) p.append(ce('h3',false,false,`Оценка: ${cl.rate}`))

        let alertsContainer = ce('div', false, 'flexible')
            if (cl.admins) alertsContainer.append(ce('button', false, `accent`, `только для админов`))
            if (cl.fellows) alertsContainer.append(ce('button', false, `fellows`, `только для fellows`))
            if (cl.noRegistration) alertsContainer.append(ce(`button`, false, `accent`, `регистрация закрыта`))
            if (!cl.capacity) alertsContainer.append(ce(`button`, false, `accent`, `вместимость не указана`))
            if (!cl.pic) alertsContainer.append(ce(`button`, false, `accent`, `картинка не указана`))
        p.append(alertsContainer)

        if (!cl.authorId) alertsContainer.append(ce(`button`, false, [`dark`,`dateButton`], `выбрать автора`, {
            onclick: () => edit(`classes`, cl.id, `authorId`, `authorId`, null)
        }))

        p.append(ce('p', false, false, `Текст приветствия (после подтверждения билета):`))
        p.append(ce('p', false, false, cl.welcome || `не указан`, {
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


        if (!cl.feedBackSent && new Date()>new Date(cl.date._seconds*1000)) {
            p.append(ce(`button`, false, [`dark`,`dateButton`], `Отправить запрос на отзывы`, {
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



        p.append(ce('p', false, false, `цена: ${cur(cl.price,`GEL`)}`,{
            onclick: function () {
                edit(`classes`, cl.id, `price`, `number`, cl.price || null, this)
            }
        }))


        p.append(ce('p', false, false, `${drawDate(cl.date,'ru',{time:true})}, продолжительность ${cl.duration} мин.`))

        p.append(ce(`button`,false,[`dateButton`,`dark`],`Изменить дату`,{
            onclick: function () {
                edit(`classes`, cl.id, `date`, `datetime-local`, cl.date || null)
            }
        }))

        p.append(ce(`button`,false,[`dateButton`,`dark`],`Изменить продолжительность`,{
            onclick: function () {
                edit(`classes`, cl.id, `capaccity`, `number`, cl.duration || null)
            }
        }))

        p.append(ce(`p`,false,false,`Вместимость: ${cl.capacity}`,{
            onclick: function () {
                edit(`classes`, cl.id, `capacity`, `number`, cl.capacity || null, this)
            }
        }))

        p.append(ce('p', false, `clickable`, `@${cl.hallName}`, {
            onclick: () => showHall(false, cl.hall)
        }))

        p.append(ce('p', false, `story`, cl.description,{
            onclick: function () {
                edit(`classes`, cl.id, `description`, `textarea`, cl.description || null, this)
            }
        }))

        let guests = ce('div');

        p.append(guests)

        p.append(ce('button', false, `dateButton`, `Показать гостей`, {
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
                        guests.innerHTML += `<table><tr><th>Имя</th><th>оценка</th><th>💲</th><th>📍</th><th>примечания админу</th></tr>
                                ${data.data.map(u=>`<tr class="story">
                                    <td onclick="showUser(false,${u.user})">${u.userName}</td>
                                    <td>${u.rate ? u.rate : '-'}</td>
                                    <td>${cl.price ? (u.isPayed?'✔️':'❌') : '🚫'}</td>
                                    <td>${(u.status == 'used'? '✔️' : '❌')}</td>
                                    <td class="editable" onclick=addComment(this,"${u.id}")>${u.comment || `без примечаний`}</td>
                                </tr>`).join('')}</table>`
                    })
            }
        }))

        p.append(ce('button', false, `dateButton`, `Написать гостям`, {
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
    })

}


function showTicket(t,id){
    let p = preparePopupWeb(`ticket_${id}`,false, [`tickets`, id])
    load(`userClasses`,id).then(ticket=>{
        
        p.append(ce(`img`,false,false,false,{
            src: `/paper/qr?id=${id}&entity=userClasses`,
            dataset:{active:ticket.active}
        }))

        p.append(ce('h1',false,false,`Билет ${id}`))
        let det = ce('div',false,[`details`,`mb`])
            det.append(ce('span',false,`info`,`${drawDate(ticket.createdAt._seconds*1000,false,{time:true})} => ${drawDate(ticket.date,false,{time:true})}`))
            // det.append(ce('span',false,`info`,`мероприятие: `))
        
        p.append(det)

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

        load(`users`,ticket.user).then(u=>{
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
    mc.innerHTML = '<h1>Random coffee</h1>'
    
    window.history.pushState({}, "", `web?page=rc`);
    let usersC = ce('div')
    let listing = ce('div')
    
    mc.append(ce('button',false,[`dark`,`dateButton`],`Запустить`,{
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

    mc.append(usersC)
    mc.append(listing)

    load(`rcParticipants`).then(users=>{
        usersC.append(ce('h3',false,false,`Участников: ${users.length}`,{
            onclick:()=>{
                users.forEach(u=>{
                    usersC.append(showUserLine(u,u.randomCoffeePass?`пас`:`в игре`))
                })
            }
        }))

    })
    
    load(`rc`).then(coffees=>{
        listing.append(ce(`h3`,false,false,`Встречи`))
        coffees.forEach(couple=>{
            listing.append(rcLine(couple))
        })
    })
}

function rcLine(couple){
    let c = ce('div',false,[`sDivided`,`flex`])
        c.append(ce(`span`,false,`info`,drawDate(couple.createdAt._seconds*1000)))
        let users = ce(`div`,false,`flex`)
        c.append(users)
    load(`users`,couple.first).then(f=>{
        users.append(ce('button',false,[`dark`,`dateButton`,((couple.proof && couple.proof.first) ? `fineButton` : `reg`)],uname(f,f.id),{
            onclick:()=>showUser(f,f.id)
        }))
        load(`users`,couple.second).then(s=>{
            users.append(ce('button',false,[`dark`,`dateButton`,((couple.proof && couple.proof.second) ? `fineButton` : `reg`)],uname(s,s.id),{
                onclick:()=>showUser(s,s.id)
            }))    
        })
    })
    return c;
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
                    onclick: function () {
                        filterUsers(type, c, this,counter)
                    }
                }))
            })

            let occup = ce('div',false,`flex`)

            mc.append(occup)

            {
                let filterTypes = {
                    it:         `IT`,
                    media:      `Журналисты`,
                    advertisement: `реклама и PR`,
                    other:      `разное`,
                    lawyer:     `Юриспруденция`,
                    randomCoffee: `random coffee members`
                }
    
                Object.keys(filterTypes).forEach(type => {
                    occup.append(ce('button', false, [type,`dateButton`,`dark`], filterTypes[type], {
                        onclick: function () {
                            filterUsers(type, c, this,counter)
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


function showUser(u, id) {

    if (!u) {
        u = axios.get(`/${host}/admin/user?data=profile&user=${id}`)
            .then(d => d.data)
            .catch(err => {
                return alert(err.message)
            })
    }

    Promise.resolve(u).then(u => {
        let p = preparePopupWeb(`user${u.id}`)
        
        window.history.pushState({}, "", `web?page=users_${u.id}`);

        p.append(ce('h1', false, false, `${uname(u,u.id)} (${u.language_code})`))
        p.append(ce('p', false, false, `регистрация: ${drawDate(u.createdAt._seconds*1000)}`))

        p.append(ce('p', false, false, `${u.first_name || `имя не указано`}`, {
            onclick: function () {
                edit(`users`, u.id, `first_name`, `text`, u.first_name, this)
            }
        }))
        p.append(ce('p', false, false, `last_name: ${u.last_name || `фамилия не указана`}`, {
            onclick: function () {
                edit(`users`, u.id, `last_name`, `text`, u.last_name, this)
            }
        }))

        p.append(ce('p', false, false, `email: ${u.email || `не указан`}`, {
            onclick: function () {
                edit(`users`, u.id, `email`, `text`, u.email, this)
            }
        }))
        p.append(ce('p', false, false, `about: ${u.about || `о себе не рассказывал`}`, {
            onclick: function () {
                edit(`users`, u.id, `about`, `textarea`, u.about, this)
            }
        }))
        p.append(ce('p', false, false, `occupation: ${u.occupation || `о себе не рассказывал`}`))


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

        p.append(toggleButton(`users`,u.id,`randomCoffee`,u.randomCoffee||false,`Убрать из randomCoffee`,`Добавить в randomCoffee`,[`dateButton`,`dark`]))

        let lecs = ce('div')
        p.append(lecs)
        

        axios
            .get(`/${host}/admin/user?user=${u.id}&data=lections`)
            .then(data => {
                lecs.append(ce(`h2`, false, false, `Лекции (${data.data.length})`))
                data.data.forEach(c => {
                    lecs.append(ce('p', false, false, `${drawDate(c.createdAt._seconds*1000)}: ${c.className} (${c.status == `used` ? `✔️` : `❌`})`, {
                        dataset: {
                            active: c.active
                        },
                        onclick:()=>showTicket(false,c.id)
                    })) 
                })
            })

        let cw = ce('div')
        p.append(cw)
        
        load(`coworkingByUser`,u.id).then(records=>{
            if(records.length) cw.append(ce(`h2`,false,false,`Коворкинг (${records.length} дней)`))
            
            records.filter(rec=>rec.date>=new Date().toISOString().split('T')[0]).forEach(rec=>{
                cw.append(showCoworkingLine(rec,false,true))
            })
            
            cw.append(ce('button',false,[`dark`,`dateButton`],`Показать архив`,{
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
    })
}

function wineButton(userId){

    return ce(`button`,false,[`dark`,`dateButton`],`Налить вина`,{
        onclick:()=>{
            let edit = ce('div', false, `editWindow`)
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
            document.body.append(edit)
        }
    })

    
}

function wineLine(w){
    let c = ce(`div`,false,`sDivided`,false,{
        dataset:{active:true}
    })
    let details = ce(`div`,false,`details`)
    details.append(ce(`span`,false,`info`,`налито: ${drawDate(w.createdAt._seconds*1000)}`))
    if(w.createBy) load(`users`,w.createBy).then(u=>details.append(ce(`span`,false,`info`,uname(u,u.id))))
    c.append(details)

    c.append(ce('h5',false,false,`Остаток: ${w.left}`))
    
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



// Залы

function showHalls(){
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    window.history.pushState({}, "", `web?page=halls`);
    load(`halls`).then(halls => {
        mc.innerHTML = '';
        mc.append(ce('h1', false, `header2`, `Залы`))
        let c = ce('div')

        halls.forEach(h => {
            c.append(showHallLine(h))
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
        }], c, halls, showHallLine, [`dark`,`dateButton`]))

        mc.append(cc)

        c.append(ce('button', false, [`dark`,`dateButton`], `Добавить зал`, {
            onclick: () => newHall()
        }))

        mc.append(c)

        mc.append(archiveButton(c,[`dark`,`dateButton`]))
    })
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
        mc.innerHTML = '';
        mc.append(ce('h1', false, `header2`, `Авторы`))
        mc.append(ce(`p`, false, false, `В этом разделе отображаются авторы. У каждого из них появляется собственная страница, а у пользователей — возможность подписаться на обновления.<br>По умолчанию отображаются только активные авторы. Если кто-то ушел, а потом вернулся, не стоит создавать новую запись, откройте архив и верните к жизни предыдущую запись.`))


        let c = ce('div')

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
        }], c, authors, showAuthorLine,[`dark`,`dateButton`]))

        mc.append(cc)

        c.append(ce('button', false, [`dark`,`dateButton`], `Добавить автора`, {
            onclick: () => newAuthor()
        }))

        mc.append(c)

        mc.append(archiveButton(c,[`dark`,`dateButton`]))
    })
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



        p.append(deleteButton(`authors`, a.id, !a.active,[`dark`,`dateButton`]))



        // axios.get(`/${host}/admin/authors/${a.id}`)
        load(`authors`, a.id).then(authorData => {
            // authorData = authorData

            // p.append(addClass(a.id))        

            p.append(ce('h2', false, false, authorData.classes.length ? `Лекции` : `Лекций еще нет`))

            authorData.classes.sort(byDate).reverse().forEach(cl => {
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

