
let host = `paper`

let mc = document.querySelector(`#main`)

function closeLeft(){
    document.querySelector(`#left`).classList.remove('active')
}

function showSchedule(){
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    axios.get(`/${host}/admin/classes`)
        .then(data=>{
            console.log(data.data)
            mc.innerHTML = '';
            mc.append(ce('h1',false,`header2`,`Расписание`))
            let c = ce('div')
            data.data.forEach(cl => {
                c.append(drawClassLine(cl))
            });
            mc.append(c)


        })
        .catch(err=>{
            alert(err.message)
        })
}

function drawClassLine(cl){
    let c = ce('div',false,'divided',false,{
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
                axios.get(`/paper/admin/class?class=${cl.id}`)
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

                        axios.post(`/paper/admin/announce`,{
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

function drawUsersChart(userData){

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

            let chart = ce(`div`,`chartdiv`)
            
            mc.append(chart)

            let udata = {}


            
            
            data.data.users.forEach(cl => {
                let d =new Date(cl.createdAt._seconds*1000).toISOString().split('T')[0]
                if(!udata[d]) udata[d] =0
                udata[d] ++ 
                c.append(drawUserLine(cl))
            });

            let d = Object.keys(udata).map(date=>{
                return {
                    date: +new Date(date),
                    value: udata[date]
                }
            })

            console.log(d)

            
            

            let filterTypes = {
                blocked: `Вышли из чата`,
                admin: `админы`,
                fellow: `fellows`,
            }

            Object.keys(filterTypes).forEach(type=>{
                mc.append(ce('button',false,type,filterTypes[type],{
                    onclick: function(){
                        filterUsers(type,c,this)
                    }
                }))
            })

            let sortTypes = {
                appOpens: `По частоте использования`,
                classes: `По количеству лекций`,
                // fellow: `fellows`,
            }

            Object.keys(sortTypes).forEach(type=>{
                mc.append(ce('button',false,type,sortTypes[type],{
                    onclick: function(){
                        c.innerHTML = ''
                        data.data.users.sort((a,b)=>(b[type]||0)-(a[type]||0)).forEach(cl => {
                            c.append(drawUserLine(cl,(cl[type]||0)))
                        });
                    }
                }))
            })

            mc.append(c)

            drawUsersChart(d)

            // data.data.users.forEach(cl => {
            //     if(!udata[new Date(cl.createdAt).toISOString()]) udata[new Date(cl.createdAt).toISOString()] =0
            //     udata[new Date(cl.createdAt).toISOString()] ++ 
            //     // c.append(drawUserLine(cl))
            // });
        })
        .catch(err=>{
            alert(err.message)
        })
}


function drawUserLine(u,cnt){
    let c = ce(`div`,false,`userLine`,false,{
        dataset:{
            active:     u.active,
            blocked:    !u.active,
            admin:      u.admin,
            fellow:     u.fellow,
        }
    })

    c.append(ce('h3',false,false,(cnt?`${cnt}: `:'')+uname(u,u.id),{
        onclick:()=>{
            showUser(u)
        }
    }))

    return c;
}


function showUser(u,id){

    if(!u){
        u = axios.get(`/${host}/admin/user?data=profile&user=${id}`)
            .then(d=>d.data)
            .catch(err=>{
                return alert(err.message)
            })
    }

    Promise.resolve(u).then(u=>{
        let p = preparePopupWeb(`user${u.id}`)
        p.append(ce('h1',false,false,`${uname(u,u.id)} (${u.language_code})`))
        p.append(ce('p',false,false,`регистрация: ${drawDate(u.createdAt._seconds*1000)}`))
        p.append(ce('p',false,false,`email: ${u.email || `не указан`}`))
        p.append(ce('p',false,false,`about: ${u.about || `о себе не рассказывал`}`))
        p.append(ce('p',false,false,`occupation: ${u.occupation || `о себе не рассказывал`}`))

        p.append(ce(`h2`,false,false,`Лекции`))
        axios
            .get(`/${host}/admin/user?user=${u.id}&data=lections`)
            .then(data=>{
                data.data.forEach(c=>{
                    p.append(ce('p',false,false,`${drawDate(c.createdAt._seconds*1000)}: ${c.className} (${c.status == `used` ? `✔️` : `❌`})`,{
                        dataset:{
                            active: c.active
                        }
                    }))
                })
            })
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