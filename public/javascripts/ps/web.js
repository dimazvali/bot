
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

function getPicture(thumb, file){
    
    console.log(thumb, file)

    return  load(`images`,thumb||file).then(img=>{
        return ce(`img`,false,`preview`,false,{
            src:    img.src,
            onclick: ()=>thumb ? load(`images`,file).then(img=>window.open(img.src)) : window.open(img.src)
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
    let score = ce(`select`)
    let curScore = 1
    while (curScore<6){
        score.append(ce(`option`,false,false,curScore,{
            value: curScore
        }))
        curScore++
    }
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
            edit.append(score)
             
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
                        if(type == `task` && score.value){
                            axios.put(`/${host}/admin/userTasksSubmits/${d.data.id}`, {
                                attr: `score`,
                                value: +score.value
                            }).then(s=>{
                                handleSave(d);
                                edit.remove();
                            })
                        } else {
                            handleSave(d);
                            edit.remove();
                            if(container) container.innerHTML = f.value
                        }

                        
                        
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

function showNewNews(){
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

    let silent = labelButton(`бесшумная`, false)
    let safe = labelButton(`защита от пересылки`, false)

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
                let media = []
                p.querySelectorAll('.media').forEach(inp=>{
                    if(inp.value) media.push(inp.value)
                })
                axios.post(`/${host}/admin/news`,{
                    name:           name.value,
                    text:           desc.value,
                    tag:            tag.value,
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
    inpC.append(tag)
    
    inpC.append(silent)
    inpC.append(safe)
    
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
                    description:    desc.value,
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

function showIncoming(){
    closeLeft()
    let p = preparePopupWeb(`tasksSubmissions`)
    p.append(ce('h2',false,false,`Загружаем...`))
    load(`taskSubissions`).then(inc=>{
        p.innerHTML = null;
        p.append(ce('h1',false,`infoBubble`,`Входящие материалы`,{
            onclick:()=>showHelp([
                `Здесь собираются входящие фотографии, разобранные по сюжетам.`,
                `На экране отображаются превью картинок, вне зависимости от типа файла (heic/jpg). По клику в превью скачивается оригинал.`
            ])
        }))
        let listing = ce('div')
        p.append(listing)
        inc.forEach((s,i)=>{
            setTimeout(()=>{
                let c = ce(`div`,false,['sDivided',`flex`])
                listing.append(c)

                let left = ce(`div`,false,`previewContainer`)
                let right = ce(`div`)

                c.append(left)
                c.append(right)
                

                right.append(ce('span',false,`info`,drawDate(s.createdAt._seconds*1000)))
                right.append(ce('h3',false,false,s.name))
                let udata = ce('div')
                right.append(udata)
                load(`users`,s.user).then(u=>{
                    udata.append(ce('p',false,false,uname(u,u.id)))
                    udata.append(ce('button',false,[`dateButton`,`dark`],`Открыть профиль`,{
                        onclick:()=>showUser(false,u.id)
                    }))
                })
                if(s.score){
                    right.append(ce('p',false,false,`Оценка: ${s.score}.`))
                } else {
                    // TBC: сделать оценку
                }
                if(s.message) load(`messages`,s.message).then(m=>{
                    if(m.thumb || m.file_id) getPicture(m.thumb, m.file_id).then(img=>left.append(img))
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
        p.append(ce('h1',false,`infoBubble`,`Неразобранное`,{
            onclick:()=>showHelp([
                `Здесь отображаются неразобранные фотографии.`,
                `Вы можете отклонить лишние, или определить тему (и оценку) для подходящих.`
            ])
        }))
        let listing = ce('div')
        p.append(listing)
        inc.forEach((s,i)=>{
            setTimeout(()=>{
                let c = ce(`div`,false,['sDivided',`flex`])
                listing.append(c)

                let left = ce(`div`,false,`previewContainer`)
                let right = ce(`div`)

                c.append(left)
                c.append(right)

                right.append(ce('span',false,`info`,drawDate(s.createdAt._seconds*1000,false,{time:true})))
                let udata = ce('div')
                right.append(udata)
                load(`users`,s.user).then(u=>{
                    udata.append(ce('p',false,false,uname(u,u.id)))
                    udata.append(ce('button',false,[`dateButton`,`dark`],`Открыть профиль`,{
                        onclick:()=>showUser(false,u.id)
                    }))
                })

                right.append(ce('p',false,false,`Выберите задание`,{
                    onclick:function(){
                        edit(`messages`,s.id, `task`,`task`)
                    }
                }))

                right.append(ce(`button`,false,[`dark`,`dateButton`,`deleteButton`],`Отклонить`,{
                    onclick:function(){
                        axios.put(`/${host}/admin/messages/${s.id}`,{
                            attr: `taskSubmission`,
                            value: false
                        }).then(s=>{
                            handleSave(s)
                            c.remove()
                        }).catch(handleError)
                    }
                }))

                if(s.score){
                    right.append(ce('p',false,false,`Оценка: ${s.score}.`))
                } else {
                    // TBC: сделать оценку
                }
                if(s.thumb || s.file_id) getPicture(s.thumb, s.file_id).then(img=>left.append(img))
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
            let c = ce('div',false,[`sDivided`,`flex`])
                
                let left = ce(`div`,false,`previewContainer`)
                let right = ce(`div`)

                c.append(left)
                c.append(right)

                right.append(ce('span',false,`info`,drawDate(s.createdAt._seconds*1000)))
                right.append(ce(`p`,false,false,`Оценка: ${s.score}`))
            p.append(c)
            if(s.admin) load(`users`,s.admin).then(admin=>right.append(ce(`p`,false,false,`Кто поставил: ${uname(admin,admin.id)}`)))
            if(s.message) load(`messages`,s.message).then(m=>{
                if(m.thumb || m.file_id) getPicture(m.thumb, m.file_id).then(img=>left.append(img))
                
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

        p.append(deleteButton(`tasks`,taskId,!task.active,[`dark`,`dateButton`]))

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
                    if(m.thumb || m.file_id) getPicture(m.thumb, m.file_id).then(img=>c.append(img))
                })
                if(s.user){
                    load(`users`,s.user).then(u=>{
                        c.append(showUserLine(u))
                    })
                }
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
    let p = preparePopupWeb(`news`,false,false,true)
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
        p.innerHTML = null;
        p.append(ce('h2',false,`infoBubble`,`Задания`,{
            
            onclick:()=>showHelp([
                `Здесь вы можете создавать новые задания, к которым в дальнейшем будут привязываться присланные пользователями материалы.`,
                `При добавлении нового задания пользователи с меткой "готовы" получат сообщения с названием и описанием задания.`
            ])
        }))
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
    c.append(ce('h3',false,false,`${t.name} (${t.cnt?t.cnt:`пусто`})`))
    c.append(ce('p',false,`info`,t.description))
    return c;
}

function removeTag(refId,userId,container){
    axios.delete(`/${host}/admin/userTags/${refId}`)
        .then(s=>{
            handleSave(s)
            container.remove()
        }).catch(handleError)
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
