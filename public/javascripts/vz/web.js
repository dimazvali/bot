
let host = `vz`

let mc = document.querySelector(`#main`)

function closeLeft(){
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p=>p.remove())
}

if(start){
    
    start = start.split('_')
    
    switch(start[0]){
        case `courses`:{
            if(!start[1]) showCourses()
            if(start[1]) showCourse(start[1])
            break;
        }
        case `day`:{
            showDay(start[1])
            break;
        }

        case `newCourse`:{
            addNewCourse();
            break;
        }
        case `newRecipie`:{
            addNewRecipie();
            break;
        }

        case `recipies`:{
            if(!start[1]) showRecipies()
            if(start[1]) showRecipie(start[1])
            break;
        }

        case `streams`:{
            if(!start[1])   showStreams()
            if(start[1])    showStream(start[1])
            break;
        }
        default:{
            break;
        }
    }
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
    } else if (type == `task`) {
        load(`tasks`).then(tasks => {
            f = ce('select')
            f.append(ce('option', false, false, `Выберите задание`, {
                value: ''
            }))
            tasks
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
    } else if (type == `textarea`) {
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





function filterUsers(role,container,button, counter){
    let c = button.parentNode;
        c.querySelectorAll('button').forEach(b=>b.classList.remove('active'))
        c.querySelectorAll('button').forEach(b=>b.classList.add('passive'))
    button.classList.add('active')
    button.classList.remove('passive')

    let cnt = 0
    container.querySelectorAll('.userLine').forEach(user=>{
        if(!role) return user.classList.remove('hidden')
        
        if(user.dataset[role] == 'true') {
            user.classList.remove('hidden')
            cnt++
        } else {
            user.classList.add('hidden')
        }
    })

    counter.innerHTML = `Итого: ${cnt}`
    
}

function showLogs(){
    window.location.reload()
}

function showUsersChart(userData){

    console.log(userData)

    am5.ready(function() {

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
          pinchZoomX:true
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
            pan:"zoom"
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

function showUsers(){
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    axios.get(`/${host}/admin/users`)
        .then(data=>{
            console.log(data.data)
            mc.innerHTML = '';
            mc.append(ce('h1',false,`header2`,`Пользователи`))
            let c = ce('div')

            let counter = ce('h4',false,`mtop`)

            let chart = ce(`div`,`chartdiv`,`hidden`)
            
            mc.append(chart)

            mc.append(ce(`div`,false,[`dateButton`,`dark`],`Показать/Скрыть график`,{
                onclick:()=>chart.classList.toggle(`hidden`)
            }))

            let udata = {}

            counter.innerHTML = `Всего: ${data.data.users.length}`
            
            data.data.users
            // .reverse()
                // .sort((a,b)=>(b.score||0)-(a.score||0))
            .forEach(cl => {
                let d = new Date(cl.createdAt._seconds*1000).toISOString().split('T')[0]
                if(!udata[d]) udata[d] =0
                udata[d] ++ 
                c.append(showUserLine(cl,cl.score||0))
            });

            let d = Object.keys(udata).map(date=>{
                return {
                    date: +new Date(date),
                    value: udata[date]
                }
            })

            let filterTypes = {
                blocked:    `Вышли из чата`,
                admin:      `Админы`,
                ready:      `Активированы`,
                concent:     `Заполнили профиль`,
                notYet:      `На рассмотрении`,
                viewed:      `Отсмотрены`
            }

            let fc = ce(`div`,false,`flex`)
            mc.append(fc)

            Object.keys(filterTypes).forEach(type=>{
                fc.append(ce('button',false,[type,'dateButton'],filterTypes[type],{
                    onclick: function(){
                        filterUsers(type,c,this,counter)
                    },
                    dataset:{
                        booked:1
                    }
                }))
            })

            let sortTypes = {
                // appOpens: `По частоте использования`,
                // classes: `По количеству лекций`,
                // fellow: `fellows`,
            }

            Object.keys(sortTypes).forEach(type=>{
                mc.append(ce('button',false,type,sortTypes[type],{
                    onclick: function(){
                        c.innerHTML = ''
                        data.data.users.sort((a,b)=>(b[type]||0)-(a[type]||0)).forEach(cl => {
                            c.append(showUserLine(cl,(cl[type]||0)))
                        });
                    }
                }))
            })

            mc.append(counter)

            mc.append(c)

            showUsersChart(d)

            // data.data.users.forEach(cl => {
            //     if(!udata[new Date(cl.createdAt).toISOString()]) udata[new Date(cl.createdAt).toISOString()] =0
            //     udata[new Date(cl.createdAt).toISOString()] ++ 
            //     // c.append(showUserLine(cl))
            // });
        })
        .catch(err=>{
            alert(err.message)
        })
}




function showUserLine(u,cnt){
    let c = ce(`div`,false,`userLine`,false,{
        dataset:{
            active:     u.active,
            blocked:    !u.active,
            admin:      u.admin,
            ready:      u.ready,
            concent:    u.concent,
            notYet:     u.concent && !u.ready,
            viewed:     u.vi
        }
    })

    c.append(ce('h3',false,false,((cnt || typeof cnt =='number')?`${cnt}: `:'')+uname(u,u.id),{
        onclick:()=>{
            showUser(u)
        }
    }))

    return c;
}

function message(m){
    let c = ce('div',false,false,false,{
        dataset: {
            answer: m.isReply
        }
    })
    c.append(ce('span',false,`info`,new Date(m.createdAt._seconds*1000).toLocaleString()))
    if(m.news) c.append(ce('button',false,['dateButton','dark','slim'],`Открыть рассылку`,{
        onclick:()=> showNewsNews(m.news)
    }))
    c.append(ce('p',false,false, m.text || `картинка`))
    if(m.thumb || m.file_id) getPicture(m.thumb, m.file_id).then(img=>c.append(img))
    return c
}


function showUser(u,id){

    if(!u) u = load(`users`,id)

    Promise.resolve(u).then(u=>{
        let p = preparePopupWeb(`user${u.id}`)

        p.append(logButton(`user`,u.id,`Логи ${uname(u,u.id)}`))

        if(u.blocked) {
            p.append(ce('h1',false,false,`Пользователь заблокирован`))
        }

        p.append(ce('h1',false,false,`${uname(u,u.id)} (${u.language_code})`))
        p.append(ce('p',false,false,`регистрация: ${drawDate(u.createdAt._seconds*1000)}`))


        let adminLinks = [{
            attr:       `admin`,
            name:       `сделать админом`,
            disname:    `снять админство`
        },{
            attr:       `blocked`,
            name:       `заблокировать`,
            disname:    `разблокировать`
        },{
            attr:       `ready`,
            name:       `Подтвердить аккаунт`,
            disname:    `Снять подтверждение`
        },{
            attr:       `viewed`,
            name:       `Отсмотрен`,
            disname:    `Не отсмотрен`
        }]

        let ac = ce(`div`)
        p.append(ac)

        adminLinks.forEach(type=>{
            ac.append(ce('button',false,[`dateButton`,'dark', `inline`], u[type.attr] ? type.disname : type.name,{
                onclick:()=>{
                    axios.put(`/${host}/admin/users/${u.id}`, {
                        attr: type.attr,
                        value: !u[type.attr]
                    }).then(handleSave)
                    .catch(handleError)
                }
            }))
        })

        
        p.append(ce('p', false, `story`, `телефон ${u.phone}` || `добавьте телефон`, {
            onclick: function(){edit(`users`, u.id, `phone`, `text`, u.phone || null, this)}
        }))

        p.append(ce('p', false, `story`, `inst @${u.inst}` || `добавьте профиль в instagram`, {
            onclick: function(){edit(`users`, u.id, `inst`, `text`, u.inst || null, this)}
        }))

        if(u.inst){
            p.append(ce(`a`, false, [`whiteLink`,`block`], `Открыть профиль`,{
                href: `https://www.instagram.com/${u.inst}`,
                target: `_inst`
            }))
        }

        p.append(ce('h2',false,false,`Общий счет: ${u.score||0}`))

        let tags = ce('div')

        tags.append(ce('h2',false,false,`Теги`))

        p.append(tags)

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
        
        p.append(ce(`button`,false,[`dateButton`,`dark`],`Добавить тег`,{
            onclick:() => addTag(u.id)
        }))

        let tasks = ce('div',false,false,`<h2>Задания</h2>`)     
            p.append(tasks)   
        
        load(`usersTasks`,u.id).then(data=>{
            
            data.forEach(ut=>{
                tasks.append(userTaskLine(ut))
            })

            if(!data.length) tasks.append(ce('p',false,false,`Заданий пока нет`)) 
        })
        p.append(ce('h2',false,false,`Переписка`))

        let messages = ce('div',false,`scrollable`)
            p.append(messages)
            load(`usersMessages`,u.id).then(data=>{
                data.forEach(m=>{
                    messages.prepend(message(m))
                })
            })

        let mbox = ce('div')
            if(u.active) p.append(mbox)
            let txt = ce('textarea',false,false,false,{placeholder:`Написать пользователю`})
            mbox.append(txt)
            let sb = ce('button',false,'dateButton',`Отправить`,{
                dataset:{booked:1},
                onclick:function(){
                    if(txt.value){
                        this.setAttribute(`disabled`,true)
                        axios.post(`/${host}/admin/usersMessages/${u.id}`,{
                            text: txt.value
                        }).then(s=>{
                            alert(s.data.comment)
                            txt.value = null;
                        }).catch(handleError)
                        .finally(()=>{
                            this.removeAttribute(`disabled`)
                        })
                    }
                }
            })
            mbox.append(sb)
    })
}

function showStream(id){
    let p = preparePopupWeb(`streams_${id}`,false,false,true)
    load(`streams`,id).then(s=>{
        p.append(ce(`h1`,false,false,`Поток от ${s.date} курса ${s.courseName}`))
        
        let details = ce(`div`,false,`details`)
            details.append(ce(`span`,false,`info`,`создан ${drawDate(s.createdAt._seconds*1000)}`))
            load(`users`,s.createdBy).then(u=>{
                details.append(ce(`span`,false,`info`,`автор: ${uname(u,u.id)}`))
            })
        p.append(details)

        load(`streamUsers`,id).then(users=>{
            users.forEach(u=>{
                p.append(showStreamUserLine(u))
            })
        })


    })
}

function showStreamUserLine(u){
    let c = listContainer(u)
    let details = ce(`div`,false,`details`)
    c.append(details)
        details.append(ce(`span`,false,`info`,`создан ${drawDate(u.createdAt._seconds*1000)}`))
        
        if(u.payed) details.append(ce('span',false,`info`,`Оплачено: ${drawDate(u.payed._seconds*1000)}`))
        
        load(`users`,u.user).then(u=>{
            c.append(ce(`h3`,false,false,`подписчик: ${uname(u,u.id)}`,{
                onclick:()=>showUser(u,u.id)
            }))
        })

        if(!u.payed) c.append(ce(`button`,false,false,`Отметить как оплаченный`,{
            onclick:()=>{
                let sure = confirm(`Вы уверены?`)
                if(sure) axios.put(`/${host}/admin/streamUsers/${u.id}`,{
                    attr: `payed`,
                    value: new Date(),
                    type: `date`
                }).then(handleSave)
                .catch(handleError)
            }
        }))
    
    return c

}

function showStreams(){
    closeLeft()
    let p = preparePopupWeb(`streams`,false,false,true)
    p.append(ce(`h1`,false,false,`Потоки`,{
        onclick:()=>showHelp()
    }))
    load(`streams`).then(streams=>{

        let c = ce('div')

        let cc = ce('div',false,`controls`)
            cc.append(sortBlock([{
                attr: `date`,
                name: `По дате`
            },{
                attr: `views`,
                name: `По числу участников`
            }],c,streams,streamLine))
        
        p.append(cc)

        
        streams.forEach(s=>c.append(streamLine(s)))
        p.append(c)

        p.append(archiveButton(c))
    })
}

function showPromo(){
    closeLeft()
    let p = preparePopupWeb(`promo`,false,false,true)
        p.append(ce(`h1`,false,false,`Промо`))
    load(`promo`).then(promos=>{

        let c = ce('div')

        let cc = ce('div',false,`controls`)
            cc.append(sortBlock([{
                attr: `date`,
                name: `По дате`
            },{
                attr: `views`,
                name: `По размеру ссылки`
            }],c,promos,promoLine))
        
        p.append(cc)

        
        promos.forEach(p=>c.append(promoLine(p)))
        
        p.append(c)

        p.append(archiveButton(c))
    })
}


function promoLine(p){
    let c = listContainer(p)
    let details = ce('div',false,[`details`,`flex`])
        details.append(ce('span',false,`info`,drawDate(p.createdAt._seconds*1000))) 
        c.append(details)
    c.append(ce(`h3`,false,false,`${p.amount}%`))
}


function showRecipies(){
    closeLeft()
    let p = preparePopupWeb(`recipies`,false,false,true)
    p.append(ce(`h1`,false,false,`Рецепты`,{
        onclick:()=>showHelp()
    }))
    p.append(ce('button',false,false,`Добавить рецепт`,{
        onclick:()=>addNewRecipie()
    }))
    
    load(`recipies`).then(recs=>{

        let c = ce('div')

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
            }],c,recs,showRecipieLine))
        
        p.append(cc)

        
        recs.forEach(rec=>c.append(showRecipieLine(rec)))
        p.append(c)

        p.append(archiveButton(c))
    })
}

function showRecipieLine(r){
    let c = listContainer(r);

    let details = ce(`div`,false,`details`)
    c.append(details)
        details.append(ce(`span`,false,`info`,`создан ${drawDate(r.createdAt._seconds*1000)}`))

        c.append(ce(`h3`,false,false,r.name,{
            onclick:()=>showRecipie(r.id)
        }))
    return c
}

function showRecipie(id){
    closeLeft()
    let p = preparePopupWeb(`recipies_${id}`,false,false,true)
    load(`recipies`,id).then(r=>{
        
        p.append(ce(`h1`,false,`editable`,r.name,{
            onclick:function(){
                edit(`recipies`,id,`name`,`text`,r.name,this)
            }
        }))

        p.append(ce(`div`,false,`editable`,r.text,{
            onclick:function(){
                edit(`recipies`,id,`text`,`textarea`,r.text,this)
            }
        }))

        p.append(deleteButton(`recipies`,id,!r.active,false,showRecipies))

    })
}

function showCourses(){
    closeLeft()
    let p = preparePopupWeb(`courses`,false,false,`courses`)
    p.append(ce(`h1`,false,false,`Курсы`,{
        onclick:()=>showHelp()
    }))
    p.append(ce('button',false,false,`Добавить курс`,{
        onclick:()=>addNewCourse()
    }))
    
    load(`courses`).then(courses=>{

        let c = ce('div')

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
            }],c,courses,showCourseLine))
        
        p.append(cc)

        
        courses.forEach(course=>c.append(showCourseLine(course)))
        p.append(c)

        p.append(archiveButton(c))
    })
}

function showCourseLine(course){
    let c = listContainer(course)
    let details = ce('div',false,[`details`,`flex`])
        details.append(ce('span',false,`info`,drawDate(course.createdAt._seconds*1000))) 
        details.append(ce('span',false,[`info`,(course.views?`reg`:`hidden`)],c.views?`просмотров: ${c.views}`:''))
    c.append(details)
    c.append(ce('h3',false,false,course.name,{
        onclick:()=>showCourse(course.id)
    }))
    return c
}

function showCourse(id){
    let p = preparePopupWeb(`courses_${id}`,false,false,true)
    load(`courses`,id).then(course=>{
        p.append(ce('h1',false,`editable`,`Курс ${course.name}`,{
            onclick:function(){
                edit(`courses`,id,`name`,`text`,course.name,this)
            }
        }))

        let details = ce(`div`,false,`details`)
            details.append(ce(`span`,false,`info`,`создан ${drawDate(course.createdAt._seconds*1000)}`))
            load(`users`,course.createdBy).then(u=>{
                details.append(ce(`span`,false,`info`,`автор: ${uname(u,u.id)}`))
            })
        p.append(details)
        
        p.append(ce('p',false,`editable`,`${course.price}`,{
            onclick:function(){
                edit(`courses`,id,`price`,`number`,course.price,this)
            }
        }))

        p.append(ce('p',false,`editable`,course.description.replace(/\\n/g,'<br>'),{
            onclick:function(){
                edit(`courses`,id,`description`,`textarea`,course.description,this)
            }
        }))

        p.append(ce('p',false,`editable`,`${course.descriptionLong.replace(/\\n/g,'<br>') || `Добавьте полное описание`}`,{
            onclick:function(){
                edit(`courses`,id,`descriptionLong`,`textarea`,course.descriptionLong,this)
            }
        }))

        p.append(deleteButton(`courses`,id,!course.active,false,showCourses))

        load(`courseStreams`,id).then(streams=>{
            let streamsContainer = ce('div')

            let streamsList = ce('div',false,`hidden`);
            
            streamsContainer.append(ce('h3',false,`clickable`,`Потоки (${streams.length})`,{
                onclick:()=>streamsList.classList.toggle(`hidden`)
            }))

            streamsList.append(ce('button',false,`addButton`,`Добавить поток`,{
                onclick:()=>addNewStream(course)
            }))

            streamsContainer.append(streamsList)

            streams.forEach(s=>{
                streamsList.append(streamLine(s,true))
            })
            p.append(streamsContainer)

        })

        load(`courseDays`,id).then(days=>{
            let daysContainer = ce('div')
            let daysListing = ce('div',false,`hidden`)
            
            daysContainer.append(ce('h3',false,`clickable`,`Дни (${days.length})`,{
                onclick:()=>daysListing.classList.toggle(`hidden`)
            }))

            daysListing.append(ce('button',false,`addButton`,`Добавить день`,{
                onclick:()=>{
                    axios.post(`/${host}/admin/courseDays/${id}`)
                        .then((d)=>{
                            handleSave(d)
                            daysListing.append(showDayLine({
                                course: id,
                                id:     d.data.id,
                                active: true,
                                index:  d.data.index
                            }))
                        }).catch(handleError)
                }
            }))

            daysContainer.append(daysListing)

            p.append(daysContainer)


            days.forEach(d=>{
                daysListing.append(showDayLine(d))
            })
        })
    })
}


function showDayLine(d){
    let c = listContainer(d)
        c.append(ce('h4',false,false,`День ${d.index+1}`,{
            onclick:()=>{
                showDay(d.id)
            }
        }))
    return c
}

function showDay(id){
    let p = preparePopupWeb(`day_${id}`,false,false,true)
    load(`daySteps`,id).then(day=>{
        p.append(ce(`h1`,false,false,`День ${day.index+1} курса «${day.course.name}»`))
        p.append(ce(`button`,false,`addButton`,`Добавить шаг`,{
            onclick:()=>addStep(id)
        }))
        day.steps.forEach(step=>{
            p.append(showStepLine(step))
        })
    })
}

function showStepLine(step){
    let c = listContainer(step)
    c.classList.add(`flex`)
    c.append(ce(`span`,false,[`info`,`mright`],step.time))
    c.append(ce(`button`,false,`round`,'❌',{
        onclick:()=>{
            let sure = confirm(`Уверены?`)
            if(sure) axios.delete(`/${host}/admin/daySteps/${step.id}`)
                .then(s=>{
                    handleSave(s);
                    c.remove()
                })
                .catch(handleError)
        }
    }))
    c.append(ce(`p`,false,false,step.text))
    return c
}

function addStep(dayId){
    let edit = ce('div', false, `editWindow`)
        edit.append(ce(`h2`,false,false,`Добавляем шаг`))
        let time = ce('input',false,false,false,{
            type: `time`
        })
        let desc = ce(`textarea`,false,false,false,{
            placeholder: `Сообщение / примечание / ссылка`
        })
        edit.append(time)
        edit.append(desc)
        edit.append(ce(`button`,false,`saveButton`,`Сохранить`,{
            onclick:function(){
                if(!time.value) return alert(`Укажите время отправки`)
                if(!desc.value) return alert(`Я не вижу ваших букв!\n(в описании)`)
                this.setAttribute(`disabled`,true)
                axios.post(`/${host}/admin/daySteps/${dayId}`,{
                    time: time.value,
                    text: desc.value
                }).then(s=>{
                    handleSave(s)
                    edit.remove()
                    closeLeft()
                    showDay(dayId)
                }).catch(handleError)
            }
        }))
    document.body.append(edit)
}


function streamLine(s,noName){
    let c = listContainer(s)
    c.onclick = () => showStream(s.id)
    let details = ce('div',false,[`details`,`flex`])
        details.append(ce('span',false,`info`,`создан ${drawDate(s.createdAt._seconds*1000)}`)) 
        details.append(ce('span',false,[`info`,(s.users?`reg`:`hidden`)],s.users?`участников: ${s.users}`:''))
    c.append(details)
    if(!noName) c.append(ce(`h3`,false,false,s.courseName))
    c.append(ce(`h4`,false,false,`старт: ${drawDate(s.date)}`))
    return c;
}

function addNewStream(course){
    let p = preparePopupWeb(`newCourse`)
        p.append(ce('h1',false,false,`Добавляем новый поток к курсу ${course.name}`))
        
        let date = ce(`input`,false,false,false,{
            type: `date`
        })

        p.append(date)

        p.append(ce('button',false,false,`Добавить`,{
            onclick:function(){
                if(date.value){
                    axios.post(`/${host}/admin/streams`,{
                        course: course.id,
                        date:   date.value
                    }).then(s=>{
                        handleSave(s)
                        closeLeft()
                        showCourse(course.id)
                    }).catch(handleError)
                } else {
                    alert(`Введите дату старта`)
                }
            }
        }))

}

function addNewRecipie(){
    let p = preparePopupWeb(`newRecipie`,false,false,true)
        p.append(ce(`h1`,false,false,`Создаем новый рецепт`))
    let name = ce(`input`,false,false,false,{placeholder: `Название`})
    let txt = ce(`textarea`,false,false,false,{placeholder: `Описание`})
    p.append(name)
    p.append(txt)
    p.append(ce('button',false,`saveButton`,`Сохранить`,{
        onclick:function(){
            if(!name.value) return alert(`Пропущено название`)
            if(!txt.value) return alert(`Пропущено описание`)
            this.setAttribute(`disabled`,true)
            axios.post(`/${host}/admin/recipies`,{
                name: name.value,
                text: txt.value
            }).then(s=>{
                handleSave(s)
                showRecipies()
            }).catch(handleError)
        }
    }))
}

function addNewCourse(){
    let p = preparePopupWeb(`newCourse`,false,false,true)
        p.append(ce(`h1`,false,false,`Создаем новый курс`))
        let c = ce('div')
            let name = ce('input',false,false,false,{
                type: `text`,
                name: `name`,
                placeholder: `Название`
            })

            let price = ce('input',false,false,false,{
                type:       `number`,
                min:        1000,
                step:       1000,
                name:       `price`,
                placeholder: `Стоимость`
            })

            let days = ce('input',false,false,false,{
                type:       `number`,
                min:        1,
                step:       1,
                name:       `days`,
                placeholder: `Продолжительность (в днях)`
            })

            let description = ce('textarea',false,false,false,{
                name: `description`,
                placeholder: `Описание`
            })

            let descriptionLong = ce('textarea',false,false,false,{
                name: `descriptionLong`,
                placeholder: `Развернутое описание`
            })

        c.append(name)
        c.append(price)
        c.append(description)

        p.append(c)

        p.append(ce(`button`,false,`saveButton`,`Сохранить`,{
            onclick:function(){
                if(!name.value) return alert(`Укажите название`)
                if(!price.value) return alert(`Внесите стоимость`)
                if(!days.value) return alert(`Внесите продолжительность`)
                if(!description.value) return alert(`Добавьте описание`)

                let sure = confirm(`Уверены?`)

                if(sure) {
                    this.setAttribute(`disabled`,true)
                    axios.post(`/${host}/admin/courses`,{
                        name:           name.value,
                        price:          price.value,
                        days:           days.value,
                        description:    description.value,
                        descriptionLong:descriptionLong.value
                    }).then(s=>{
                        handleSave(s)
                        closeLeft()
                        showCourse(s.data.id)
                    }).catch(handleError)
                }
            }
        }))
}