let host = `paper`

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
    let p = preparePopupWeb(`newClass`)
    p.classList.add('inpC')
    p.append(ce(`h1`,false,false,`Новое мероприятие`))
    let name = ce('input',false,false,false,{
        placeholder: `Название`
    })
    p.append(name)
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
        placeholder: `Название`
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

    let sb = ce('button',false,[`dateButton`,`dark`],`Сохранить`,{
        onclick:function(){
            if(
                name.value && 
                description.value &&
                date.value
            ) {
                this.setAttribute(`disabled`,true)
                axios.post(`/${host}/admin/classes`,{
                    name: name.value,
                    description: description.value,
                    date: date.value,
                    duration: duration.value,
                    hall: hall.value,
                    capacity: capacity.value,
                    authorName: authorName.value,
                    author: author.value,
                }).then(handleSave)
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
                        value: type == `date` ? new Date(f.value) : f.value
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

function showCoworking(){
    closeLeft()
    let p = preparePopupWeb(`coworking`)
    window.history.pushState({}, "", `web?page=coworking`);
    p.append(ce('h1',false,false,`Коворкинг`))
    
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

        p.append(ce('p',false,`editable`,`Название: ${h.name}`,{
            onclick:function(){
                edit(`halls`,id,`name`,`text`,h.name,this)
            }
        }))

        p.append(ce('p',false,`editable`,`${h.description}`,{
            onclick:function(){
                edit(`halls`,id,`description`,`textarea`,h.description,this)
            }
        }))

        p.append(deleteButton(`halls`,id,!h.active))

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
    
    if(!butHall) load(`halls`, r.hall).then(h=>{
        c.append(ce('button',false,[`dateButton`,`dark`],h.name,{
            onclick:()=>showHall(false,h.id)
        }))
    })
    
    if(!butUser) load(`users`,r.user).then(u=>{
        c.append(ce('button',false,[`dateButton`,`dark`],uname(u,u.id),{
            onclick:()=>showUser(false,u.id)
        }))
    })

    if(r.status != `used`) c.append(deleteButton(`coworking`,r.id,!r.active))

    if(r.status != `used` && r.active) c.append(ce(`button`,false,[`dateButton`,`dark`],`гость пришел`,{
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
    let c = ce('div', false, 'divided', false, {
        dataset: {
            active: cl.active
        },
        onclick: () => {
            showClass(cl)
        }
    })
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







function showClass(cl, id) {
    let p = preparePopupWeb(`class_${cl.id}`, false, [`classes`, cl.id])
    
    if (!cl) {
        cl = load(`classes`, id)
    }
    Promise.resolve(cl).then(cl => {
        
        window.history.pushState({}, "", `web?page=classes_${cl.id}`);

        if (cl.pic) p.append(ce(`img`, false, `cover`, false, {
            src: cl.pic
        }))

        p.append(ce('h1', false, false, cl.name))

        let alertsContainer = ce('div', false, 'flexible')
        if (cl.admin) alertsContainer.append(ce('button', false, `accent`, `только для админов`))
        if (cl.fellows) alertsContainer.append(ce('button', false, `fellows`, `только для fellows`))
        if (cl.noRegistration) alertsContainer.append(ce(`button`, false, `accent`, `регистрация закрыта`))
        if (!cl.capacity) alertsContainer.append(ce(`button`, false, `accent`, `вместимость не указана`))
        if (!cl.pic) alertsContainer.append(ce(`button`, false, `accent`, `картинка не указана`))
        p.append(alertsContainer)

        if (!cl.authorId) alertsContainer.append(ce(`button`, false, `accent`, `выбрать автора`, {
            onclick: () => edit(`classes`, cl.id, `authorId`, `authorId`, null)
        }))

        p.append(ce('p', false, false, `Текст приветствия (после подтверждения билета):`))
        p.append(ce('p', false, false, cl.welcome || `не указан`, {
            onclick: function () {
                edit(`classes`, cl.id, `welcome`, `textarea`, cl.welcome || null, this)
            }
        }))

        if (cl.author) {
            p.append(ce('p', false, false, `автор (строкой): ${cl.author}`))
        }

        if (cl.authorId) {
            p.append(ce(`button`, false, `accent`, `автор ${cl.authorName}`, {
                onclick: () => edit(`classes`, cl.id, `authorId`, `authorId`, cl.authorId)
            }))
        }


        if (!cl.feedBackSent) {
            p.append(ce(`button`, false, `accent`, `Отправить запрос на отзывы`, {
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



        p.append(ce('p', false, false, `цена: ${cur(cl.price,`GEL`)}`))
        p.append(ce('p', false, false, `${drawDate(cl.date,'ru',{time:true})}, продолжительность ${cl.duration} мин.`))

        p.append(ce('p', false, `clickable`, `@${cl.hallName}`, {
            onclick: () => showHall(false, cl.hall)
        }))

        p.append(ce('p', false, `story`, cl.description))

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
                        guests.innerHTML += `<table><tr><th>Имя</th><th>💲</th><th>📍</th><th>примечания админу</th></tr>
                                ${data.data.map(u=>`<tr class="story">
                                    <td onclick="showUser(false,${u.user})">${u.userName}</td>
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

function showLogs() {
    window.location.reload()
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

            console.log(d)




            let filterTypes = {
                blocked: `Вышли из чата`,
                admin: `админы`,
                insider: `редакция`,
                fellow: `fellows`,
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
                        data.data.users.sort((a, b) => (b[type] || 0) - (a[type] || 0)).forEach(cl => {
                            c.append(showUserLine(cl, (cl[type] || 0)))
                        });
                    }
                }))
            })

            mc.append(c)

            

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
            insider: u.insider
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

        let ac = ce(`div`)
        p.append(ac)

        adminLinks.forEach(type => {
            ac.append(ce('button', false, false, u[type.attr] ? type.disname : type.name, {
                onclick: () => {
                    axios.put(`/${host}/admin/users/${u.id}`, {
                            attr: type.attr,
                            value: !u[type.attr]
                        }).then(handleSave)
                        .catch(handleError)
                }
            }))
        })

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
                        }
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
            
            cw.append(ce('button',false,false,`Показать архив`,{
                onclick:function(){
                    this.remove()
                    records.filter(rec=>rec.date<new Date().toISOString().split('T')[0]).reverse().forEach(rec=>{
                        cw.append(showCoworkingLine(rec,false,true))
                    })
                }
            }))
        })
    })



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
        }], c, halls, showHallLine))

        mc.append(cc)

        c.append(ce('button', false, false, `Добавить зал`, {
            onclick: () => newHall()
        }))

        mc.append(c)

        mc.append(archiveButton(c))
    })
}

function showHallLine(a){
    let div = ce('div',false,`sDivided`,false,{
        dataset: {active: a.active}
    })
    if (!a.active) div.classList.add(`hidden`)
    
    let creds = ce(`div`)

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
        }], c, authors, showAuthorLine))

        mc.append(cc)

        c.append(ce('button', false, false, `Добавить автора`, {
            onclick: () => newAuthor()
        }))

        mc.append(c)

        mc.append(archiveButton(c))
    })
}

function showAuthorLine(a) {

    let div = ce('div', false, `sDivided`, false, {
        dataset: {
            active: a.active
        }
    })

    if (!a.active) div.classList.add(`hidden`)

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



        p.append(deleteButton(`authors`, a.id, !a.active))



        // axios.get(`/${host}/admin/authors/${a.id}`)
        load(`authors`, a.id).then(authorData => {
            // authorData = authorData

            // p.append(addClass(a.id))        

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