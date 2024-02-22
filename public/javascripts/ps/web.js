
let host = `ps`

let mc = document.querySelector(`#main`)

function closeLeft(){
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p=>p.remove())
}


function drawSchedule(events, start) {
    let cc = ce('div',false,`scroll`)
    let c = ce('div', false, `flex`)
    cc.append(c)
    let i = 0
    while (i < 30) {
        let day = ce(`div`, false, `date`)
        console.log(events.map(e=>e.date))
        let date = new Date(+new Date() + i * 24 * 60 * 60 * 1000)
        let isoDate = date.toISOString().split('T')[0]
        day.append(ce(`h3`, false, false, drawDate(date)))
        events.filter(e => typeof e.date == `string` && new Date(e.date).toISOString().split('T')[0] == isoDate).forEach(e => {
            day.append(ce('p', false, false, `${new Date(e.date).toLocaleTimeString([],{ hour: "2-digit", minute: "2-digit" })}: ${e.name}`,{
                onclick:()=>showClass(e,e.id)
            }))
        })
        c.append(day)
        i++
    }
    return cc
}

function getPicture(id){
    return  load(`images`,id).then(img=>{
        return ce(`img`,false,`preview`,false,{
            src:    img.src,
            onclick: ()=>window.open(img.src)
        })
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
        ready:  `Оформленным`,
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

function showNewTask(){
    closeLeft()
    let p = preparePopupWeb(`newTask`)
    p.append(ce('h2',false,false,`Новое задание`))
    let name = ce('input',false,`block`,false,{placeholder: `Название`})
    let desc = ce('textarea',false,false,false,{placeholder: `Описание`})
    let sb = ce('button',false,`dateButton`,`Отправить`,{
        dataset:{booked:1},
        onclick:function(){
            if(name.value && desc.value){
                this.setAttribute(`disabled`,true)
                axios.post(`/${host}/admin/tasks`,{
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


function showSchedule(){
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    axios.get(`/${host}/admin/classes`)
        .then(data=>{
            console.log(data.data)
            mc.innerHTML = '';
            mc.append(ce('h1',false,`header2`,`Расписание`))
            mc.append(drawSchedule(data.data))
            let c = ce('div')
            data.data.forEach(cl => {
                c.append(showClassLine(cl))
            });
            mc.append(c)


        })
        .catch(err=>{
            console.log(err)
            alert(err.message)
        })
}

function showClassLine(cl){
    let c = ce('div',false,'sDivided',false,{
        dataset:{
            active: cl.active
        },
        onclick:()=>{
            showClass(cl)
        }
    })
    c.append(ce('h2',false,false,cl.name))
    c.append(ce('p',false,false,`${drawDate(cl.date)} @ ${cl.hallName}`))
    return c
}

function addComment(c,id){
    let comment = prompt(`О чем предупредить администратора?`)
    if(!comment) return alert(`запрос прерван`)
    axios.put(`/${host}/admin/ticket/?ticket=${id}`,{
        value: comment,
        attr: `comment`
    }).then(s=>{
        alert(`ok`)
        c.innerHTML = comment
    }).catch(err=>{
        alert(err.message)
    })
}



function filterUsers(role,container,button){
    let c = button.parentNode;
        c.querySelectorAll('button').forEach(b=>b.classList.remove('active'))
        c.querySelectorAll('button').forEach(b=>b.classList.add('passive'))
    button.classList.add('active')
    button.classList.remove('passive')
    container.querySelectorAll('.userLine').forEach(user=>{
        if(!role) return user.classList.remove('hidden')
        
        if(user.dataset[role] == 'true') {
            user.classList.remove('hidden')
        } else {
            user.classList.add('hidden')
        }
    })

    
}


function showClass(cl){
    let p = preparePopupWeb(`class_${cl.id}`)
    
    if(cl.pic) p.append(ce(`img`,false,`cover`,false,{src: cl.pic})) 
    
    p.append(ce('h1',false,false,cl.name))
        
        let alertsContainer = ce('div',false,'flexible')
        if(cl.admin)            alertsContainer.append(ce('button',false,`accent`,`только для админов`))
        if(cl.fellows)          alertsContainer.append(ce('button',false,`fellows`,`только для fellows`))
        if(cl.noRegistration)   alertsContainer.append(ce(`button`,false,`accent`,`регистрация закрыта`))
        if(!cl.capacity)        alertsContainer.append(ce(`button`,false,`accent`,`вместимость не указана`))
        if(!cl.pic)             alertsContainer.append(ce(`button`,false,`accent`,`картинка не указана`))
        p.append(alertsContainer)

        p.append(ce('p',false,false,`ведет: ${cl.author}`))
        p.append(ce('p',false,false,`цена: ${cur(cl.price,`GEL`)}`))
        p.append(ce('p',false,false,`${drawDate(cl.date,'ru',{time:true})}, продолжительность ${cl.duration} мин.`))

        p.append(ce('p',false,`clickable`,`@${cl.hallName}`,{
            onclick:()=>showHall(false, cl.hall)
        }))

        p.append(ce('p',false,`story`,cl.description))

        let guests = ce('div');
        
        p.append(guests)

        p.append(ce('button',false,`dateButton`,`Показать гостей`,{
            dataset:{booked:1},
            onclick:function(){
                this.remove()
                axios.get(`/${host}/admin/class?class=${cl.id}`)
                    .then(data=>{
                        let rating = data.data.filter(t=>t.rate).map(t=>t.rate)
                    
                        if(rating.length){

                            let av = (rating.reduce((a,b)=>a+b,0)/rating.length).toFixed(2)
                            
                            guests.prepend(ce('h4',false,'light',`Рейтинг ${av} (${rating.length} голосов)`))
                        }


                        guests.append(ce(`p`,false,false,`Гостей: ${data.data.length}${cl.price ? ` // оплачено ${data.data.filter(g=>g.isPayed).length}` : ''}${` // пришли ${data.data.filter(g=>g.status == 'used').length}`}`))
                        guests.innerHTML+=`<table><tr><th>Имя</th><th>💲</th><th>📍</th><th>примечания админу</th></tr>
                            ${data.data.map(u=>`<tr class="story">
                                <td onclick="showUser(false,${u.user})">${u.userName}</td>
                                <td>${cl.price ? (u.isPayed?'✔️':'❌') : '🚫'}</td>
                                <td>${(u.status == 'used'? '✔️' : '❌')}</td>
                                <td class="editable" onclick=addComment(this,"${u.id}")>${u.comment || `без примечаний`}</td>
                            </tr>`).join('')}</table>`
                        })
                    }
                }))

        p.append(ce('button',false,`dateButton`,`Написать гостям`,{
            dataset:{booked:1},
            onclick:function(){
                this.remove;
                let txt = ce('textarea',false,false,false,{
                    placeholder: `Вам слово`
                })

                let type = ce('select')
                
                    type.append(ce('option',false,false,`Всем`,{
                        value: `all`
                    }))
                    type.append(ce('option',false,false,`Пришедшим`,{
                        value: `inside`
                    }))
                    type.append(ce('option',false,false,`Опаздантам`,{
                        value: `outside`
                    }))

                p.append(txt)
                p.append(type)

                 
                p.append(ce('button',false,`dateButton`,`Отправить`,{
                    dataset:{booked:1},
                    onclick:function(){
                        
                        if(!txt.value) return alert(`Я не вижу ваших букв!`)

                        this.setAttribute(`disabled`,true)

                        axios.post(`/${host}/admin/announce`,{
                            class: cl.id,
                            type: type.value,
                            text: txt.value
                        }).then(s=>{
                            alert(`ok`)
                            txt.value = null;
                        }).catch(err=>{
                            alert(err.message)
                        }).finally(()=>{
                            this.removeAttribute('disabled')
                        })
                        
                    }
                }))
            }
        }))

        p.append(ce(`button`,false,`dateButton`,`Показать лист ожидания`,{
            dataset:{booked:1},
            onclick:()=>{
                let wl =    ce('div')
                let t =     ce('table')
                let n =     ce(`tr`)
                    n.append(ce(`th`,false,false,`гость`))
                    n.append(ce(`th`,false,false,`дата`))
                    n.append(ce(`th`,false,false,`статус`))
                t.append(n)
                axios.get(`/${host}/admin/classWL?class=${cl.id}`).then(d=>{
                    d.data.sort((a,b)=>a.createdAt._seconds-b.createdAt._seconds).forEach(rec=>{
                        let line = ce('tr')
                            line.append(ce(`td`,false,false,uname(rec.user, rec.user.id)))
                            line.append(ce(`td`,false,false,drawDate(rec.createdAt._seconds*1000,`ru`,{time: true})))
                            line.append(ce(`td`,false,false,rec.active))
                        t.append(line)
                    })
                })
                wl.append(t)
                p.append(wl)
            }
        }))

        p.append(ce(`button`,false,`dateButton`,`Запостить в канал`,{
            dataset:{booked:1},
            onclick:()=>{
                axios.post(`/${host}/admin/channel?class=${cl.id}`)
                    .then(s=>{
                        alert(`ok`)
                    })
                    .catch(err=>{
                        alert(err.message)
                    })
            }
        }))
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

            let chart = ce(`div`,`chartdiv`,`hidden`)
            
            mc.append(chart)

            mc.append(ce(`div`,false,[`dateButton`,`dark`],`Показать/Скрыть график`,{
                onclick:()=>chart.classList.toggle(`hidden`)
            }))

            let udata = {}


            
            
            data.data.users.sort((a,b)=>(b.score||0)-(a.score||0)).forEach(cl => {
                let d =new Date(cl.createdAt._seconds*1000).toISOString().split('T')[0]
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

            console.log(d)

            
            

            let filterTypes = {
                blocked:    `Вышли из чата`,
                admin:      `Админы`,
                ready:      `Активированы`,
            }

            Object.keys(filterTypes).forEach(type=>{
                mc.append(ce('button',false,[type,'dateButton'],filterTypes[type],{
                    onclick: function(){
                        filterUsers(type,c,this)
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
    if(m.file_id) getPicture(m.file_id).then(img=>c.append(img))
    return c
}

function showIncoming(){
    closeLeft()
    let p = preparePopupWeb(`tasksSubmissions`)
    p.append(ce('h2',false,false,`Загружаем...`))
    load(`taskSubissions`).then(inc=>{
        p.innerHTML = null;
        p.append(ce('h1',false,false,`Входящие материалы`))
        let listing = ce('div')
        p.append(listing)
        inc.forEach((s,i)=>{
            setTimeout(()=>{
                let c = ce(`div`,false,'sDivided')
                listing.append(c)    
                c.append(ce('span',false,`info`,drawDate(s.createdAt._seconds*1000)))
                c.append(ce('h3',false,false,s.name))
                let udata = ce('div')
                c.append(udata)
                load(`users`,s.user).then(u=>{
                    udata.append(ce('p',false,false,uname(u,u.id)))
                    udata.append(ce('button',false,[`dateButton`,`dark`],`Открыть профиль`,{
                        onclick:()=>showUser(false,u.id)
                    }))
                })
                if(s.score){
                    c.append(ce('p',false,false,`Оценка: ${s.score}.`))
                } else {
                    // TBC: сделать оценку
                }
                if(s.message) load(`messages`,s.message).then(m=>{
                    if(m.file_id) getPicture(m.file_id).then(img=>c.append(img)) 
                })
            },i*100)
        })
    })
}

function showUnseen(){
    closeLeft()
    let p = preparePopupWeb(`tasksSubmissions`)
    p.append(ce('h2',false,false,`Загружаем...`))
    load(`unseen`).then(inc=>{
        p.innerHTML = null;
        p.append(ce('h1',false,false,`Неразобранное`))
        let listing = ce('div')
        p.append(listing)
        inc.forEach((s,i)=>{
            setTimeout(()=>{
                let c = ce(`div`,false,'sDivided')
                listing.append(c)    
                c.append(ce('span',false,`info`,drawDate(s.createdAt._seconds*1000)))
                // c.append(ce('h3',false,false,s.name))
                let udata = ce('div')
                c.append(udata)
                load(`users`,s.user).then(u=>{
                    udata.append(ce('p',false,false,uname(u,u.id)))
                    udata.append(ce('button',false,[`dateButton`,`dark`],`Открыть профиль`,{
                        onclick:()=>showUser(false,u.id)
                    }))
                })

                c.append(ce('p',false,false,`Выберите задание`,{
                    onclick:function(){
                        edit(`messages`,s.id, `task`,`task`)
                    }
                }))

                if(s.score){
                    c.append(ce('p',false,false,`Оценка: ${s.score}.`))
                } else {
                    // TBC: сделать оценку
                }
                if(s.file_id) getPicture(s.file_id).then(img=>c.append(img))
                // if(m.file_id) getPicture(m.file_id).then(img=>c.append(img))
            },i*100)
        })
    })
}


function showSubmissions(userTaskId){
    let p = preparePopupWeb(`tasksSubmissions_${userTaskId}`)

    p.append(ce('h2',false,false,`Загружаем...`))
    load(`taskSubissions`,userTaskId).then(task=>{
        p.innerHTML = null;
        p.append(ce('h1',false,false,`Материалы задания ${task.name} от пользователя ${task.user}`))
        p.append(ce(`p`,false,false,`Описание задания: ${task.taskData.description}`))
        p.append(ce('h3',false,false,`Материалы:`))
        task.submissions.forEach(s=>{
            let c = ce('div',false,`sDivided`)
                p.append(c)
                c.append(ce('span',false,`info`,drawDate(s.createdAt._seconds*1000)))
                c.append(ce(`p`,false,false,`Оценка: ${s.score}`))
            p.append(c)
            if(s.admin) load(`users`,s.admin).then(admin=>c.append(ce(`p`,false,false,`Кто поставил: ${uname(admin,admin.id)}`)))
            if(s.message) load(`messages`,s.message).then(m=>{
                if(m.file_id) load(`images`,m.file_id).then(img=>{
                    c.append(ce(`img`,false,`preview`,false,{
                        src: img.src,
                        onclick: window.open(img.src)
                    }))
                })
            })
        })
    })
}

function editable(e){
    return ce(e.tag||`p`,false,false,e.value||'добавьте буквы',{
        onclick:function(){
            edit(e.entity,e.id,e.attr,e.type||`text`,e.value||null,this)
        }
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
                    users.append(showUserLine(u))
                })
                
            })      
        })

    })
}

function showTask(taskId){
    let p = preparePopupWeb(`tasks`)
    p.append(ce('h2',false,false,`Загружаем...`))
    load(`tasks`,taskId).then(task=>{

        p.innerHTML = null;

        p.append(logButton(`task`,taskId,`Логи по заданию ${task.name}`))
        
        p.append(ce('h1',false,false,`Задание «${task.name}»`,{
            onclick:function(){
                edit(`tasks`,taskId,`name`,`text`,task.name,this)
            }
        }))

        p.append(ce(`p`,false,false,task.description,{
            onclick:function(){
                edit(`tasks`,taskId,`description`,`textarea`,task.description,this)
            }
        }))

        if(task.active) p.append(deleteButton(`tasks`,taskId))

        let submissions = ce('div')
        p.append(submissions)

        if(!task.submissions.length) submissions.append(ce('p',false,false,`Материалов еще нет`))
            task.submissions.forEach(s=>{
                let c = ce('div',false,`sDivided`)
                    p.append(c)
                    c.append(ce('span',false,`info`,drawDate(s.createdAt._seconds*1000)))
                    c.append(ce(`p`,false,false,`Оценка: ${s.score}`))
                    submissions.append(c)
                if(s.admin) load(`users`,s.admin).then(admin=>c.append(ce(`p`,false,false,`Кто поставил: ${uname(admin,admin.id)}`)))
                if(s.message) load(`messages`,s.message).then(m=>{
                    if(m.file_id) load(`images`,m.file_id).then(img=>{
                        c.append(ce(`img`,false,`preview`,false,{
                            src: img.src,
                            onclick:()=> window.open(img.src)
                        }))
                    })
                })
            })

        // Первая версия — группировка по пользователям
        // let users = ce(`div`,false,false,`Пользователи (${task.users ? task.users.length : 0})`,{
        //     onclick:function(){
        //         task.users.sort((a,b)=>a.createdAt._seconds-b.createdAt._seconds).forEach((u,i)=>{
        //             let c = ce('div',false,`sDivided`)
        //             c.append(ce('span',false,`info`,drawDate(u.createdAt._seconds*1000)))
        //             setTimeout(()=>{
        //                 load(`users`,u.user).then(user=>{
        //                     c.append(ce(`p`,false,false,uname(user,u.user)))
        //                     c.append(ce(`button`,false,[`dateButton`,`dark`],`Открыть материалы`,{
        //                         onclick:()=>{
        //                             showSubmissions(u.id)
        //                         }
        //                     }))
        //                     c.append(ce(`button`,false,[`dateButton`,`dark`],`Открыть пользователя`,{
        //                         onclick:()=>{
        //                             showUser(false,u.id)
        //                         }
        //                     }))
        //                 })
        //             },i*100)
        //             users.append(c)
        //         })
        //     }
        // })
        // p.append(users)
    })
}


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


function showNews(){
    closeLeft()
    let p = preparePopupWeb(`news`)
    p.append(ce('h2',false,false,`Загружаем...`))
    load(`news`).then(tasks=>{
        p.innerHTML = `<h2>Рассылки</h2>`
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


function showTasks(){
    closeLeft()
    let p = preparePopupWeb(`tasks`)
    p.append(ce('h2',false,false,`Загружаем...`))
    load(`tasks`).then(tasks=>{
        p.innerHTML = `<h2>Задания</h2>`
        p.append(ce('button',false,`dateButton`,`Добавить`,{
            dataset:{booked:1},
            onclick:()=>showNewTask()
        }))
        tasks.forEach(t=>{
            p.append(taskLine(t))
        })
    })
}

function taskLine(t){
    let c = ce('div',false,'sDivided',false,{
        onclick:()=>showTask(t.id),
        dataset:{active:t.active}
    });
    c.append(ce('span',false,`info`,drawDate(t.createdAt._seconds*1000)))
    c.append(ce('h3',false,false,t.name))
    c.append(ce('p',false,`info`,t.description))
    return c;
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
            name:       `Прошел подготовку`,
            disname:    `Снять флаг подготовки`
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
            p.append(mbox)
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

function userTaskLine(userTask){
    let c = ce('div',false,`sDivided`,false,{
        dataset:{active:userTask.active?true:false}
    })
        c.append(ce('span',false,`info`,drawDate(userTask.createdAt._seconds*1000)))
        c.append(ce('h4',false,false,userTask.name))
        c.append(ce(`p`,false,false,userTask.completed ? `Оценка: ${userTask.score || 0}` : `еще не закрыто`))
    return c
}

function load(collection, id) {
    return axios.get(`/${host}/admin/${collection}${id?`/${id}`:''}`).then(data => {
        return data.data
    })
}

function preparePopupWeb(name){
    let c = ce('div',false,'popupWeb')
    c.append(ce('span',false,`closeMe`,`✖`,{
        onclick:()=>{
            c.classList.add(`slideBack`)
            setTimeout(function(){
                c.remove()
            },500)
        }
    }))
    document.body.append(c)
    let content = ce('div',false,`content`)
    c.append(content)
    return content;
}