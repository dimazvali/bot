
let host = `auditoria`

let mc = document.querySelector(`#main`)

function closeLeft(){
    document.querySelector(`#left`).classList.remove('active')
}

function showCourses(){
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    axios.get(`/${host}/admin/courses`)
        .then(data=>{
            console.log(data.data)
            mc.innerHTML = '';
            mc.append(ce('h1',false,`header2`,`Курсы`))
            let c = ce('div')
            data.data.forEach(cl => {
                c.append(showCourseLine(cl))
            });
            c.append(ce(`button`,false,false,`Добавить`,{
                onclick:()=>newCourse()
            }))
            mc.append(c)


        })
        .catch(err=>{
            alert(err.message)
        })
}

function showCourseLine(course){
    // console.log(c)
    let c = ce(`div`,false,`divied`,false,{
        dataset:{active:course.active,kids:course.kids},
        onclick:()=>{
            showCourse(course)
        }
    })

    c.append(ce('h2',false,false,course.name))
    c.append(ce('p',false,false,course.author || `без автора`))

    return c
}

function showCourse(cl,id){
    if(!cl){
        cl = load(`courses`,id)
    }
    Promise.resolve(cl).then(cl=>{
        let p = preparePopupWeb(`class_${cl.id}`)
    if(cl.pic) {p.append(ce(`img`,false,`cover`,false,{
        src: cl.pic,
        onclick:()=>edit(`courses`,cl.id,`pic`,`text`,cl.pic)
    }))} else {
        p.append(ce('p',false,false,`добавить фото`,{
            onclick:()=>edit(`courses`,cl.id,`pic`,`text`,null)
        }))
    }
    p.append(ce('h1',false,false,cl.name||`Без названия`,{
        onclick:()=>edit(`courses`,cl.id,`name`,`text`,null)
    }))
    axios.get(`/${host}/admin/courses/${cl.id}`).then(course=>{
        course = course.data
        p.append(ce('p',false,false,course.course.description,{
            onclick:()=>edit(`courses`,cl.id,`description`,`text`,null)
        }))
        p.append(ce(`h3`,false,false,'Занятия'))
        course.classes.forEach(c=>{
            p.append(showClassLine(c))
        })
        p.append(addClass(cl.authorId,cl.id))

        if(course.subscriptions.length){
            p.append(ce('h2',false,false,`Подписок на курс: ${course.subscriptions.length}`))
            let txt = ce('textarea',false,false,false,{placeholder: `Рассылка по всем подписанным на курс.`})
            p.append(txt)
            p.append(ce('button',false,false,`Отправить`,{
                onclick:function(){
                    if(txt.value){
                        this.setAttribute(`disabled`,true)
                        axios.post(`/${host}/admin/courses/${cl.id}`,{
                            intent: `subscriptions`,
                            text: txt.value
                        }).then(handleSave)
                        .catch(handleError)
                        .finally(()=>this.removeAttribute(`disabled`))
                    }
                }
            }))
        }

    })
    })
    
}

function handleSave(s){
    if(s.data.success) return alert(s.data.comment || `Ура! Пожалуй, стоит обновить страницу.`)
}

function load(collection,id){
    return axios.get(`/${host}/admin/${collection}${id?`/${id}`:''}`).then(data=>{
        return data.data
    })
}


function edit(entity,id,attr,type, value){

    let attrTypes = {
        description: `описание`,
        name: `название`,
        authorId: `автор`,
        courseId: `курс`
    }

    let entities = {
        authors:    `автора`,
        courses:    `курса`,
        classes:    `мероприятия`,
        banks:      `рекивзитов`,
    }

    let edit = ce('div',false,`editWindow`)
        edit.append(ce('h2',false,false,`Правим поле ${attrTypes[attr]||attr} для ${entities[entity]||entity}#${id}`))
        let f = ce('input'); 
        if (type == `date`){
            f.type = `datetime-local`
            edit.append(f)
        } else if(type == `authorId`){
            load(`authors`).then(authors=>{
                f = ce('select')
                f.append(ce('option',false,false,`Выберите автора`,{value: ''}))
                authors
                    .filter(a=>a.active)
                    .sort((a,b)=>a.name<b.name?-1:1)
                    .forEach(a=>f.append(ce('option',false,false,a.name,{value:a.id})))
                edit.append(f)
            })
        } else if (type == `courseId`){
            load(`courses`).then(authors=>{
                f = ce('select')
                f.append(ce('option',false,false,`Выберите курс`,{value: ''}))
                authors
                    .filter(a=>a.active)
                    .sort((a,b)=>a.name<b.name?-1:1)
                    .forEach(a=>f.append(ce('option',false,false,a.name,{value:a.id})))
                edit.append(f)
            })
        } else {
            f = ce('input',false,false,false,{
                value: value,
                type: type,
                placeholder: `Новое значение`
            })
            edit.append(f)
        }
        
        edit.append(ce('button',false,false,`Сохранить`,{
            onclick:function(){
                if(f.value){
                    axios.put(`/${host}/admin/${entity}/${id}`,{
                        attr: attr,
                        value: type == `date`? new Date(f.value) : f.value
                    }).then(handleSave)
                    .catch(handleError)
                }
            }
        }))
        document.body.append(edit)
}


window.addEventListener('keydown', (e) => {
    if (e.key == 'Escape') {
        try {
            document.querySelector('.editWindow').remove();
            document.querySelector('#hover').remove();
        } catch (err) {
            console.warn(err)
        }
    }
})
function newBank(){
    let p = preparePopupWeb(`class_new`)
        p.append(ce('h1',false,false,`Новые реквизиты`))

        let name = ce('input',false,false,false,{type:`text`,placeholder:`Название`})
        p.append(name)
        let creds = ce('input',false,false,false,{type:`text`,placeholder:`Реквизиты`})
        p.append(creds)

        p.append(ce('button',false,false,`Сохранить`,{
            onclick:function(){
                if(name.value && creds.value){
                    axios.post(`/${host}/admin/banks`,{
                        name: name.value,
                        creds: creds.value
                    }).then(handleSave)
                    .catch(handleError)
                }
            }
        }))

}

function newClass(courseId,authorId){
    let p = preparePopupWeb(`class_new`)
        p.append(ce('h1',false,false,`Новое мероприятие`))
        
        let pic = ce('input',false,false,false,{type:`text`,placeholder:`фото`})
        p.append(pic)
        
        let name = ce('input',false,false,false,{type:`text`,placeholder:`Название`})
        p.append(name)
        let descShort = ce('textarea',false,false,false,{placeholder:`краткая подпись`})
        p.append(descShort)
        let descLong = ce('textarea',false,false,false,{placeholder:`развернутое описание`})
        p.append(descLong)
        let date = ce('input',false,false,false,{type:`datetime-local`})
        p.append(date)
        
        let kids = ce('input',false,false,false,{
            type: 'checkbox'
        })

        let kidsLabel = ce('label',false,false,'Для детей')

        kidsLabel.append(kids)

        p.append(kidsLabel)

        let age = ce('input',false,false,false,{type:`number`,placeholder: `возраст`})
        p.append(age)

        let price = ce(`input`,false,false,false,{
            type: `number`,
            min: 0,
            placeholder: `цена по записи`
        })

        let price1 = ce(`input`,false,false,false,{
            type: `number`,
            min: 0,
            placeholder: `цена на месте`
        })

        let price2 = ce(`input`,false,false,false,{
            type: `number`,
            min: 0,
            placeholder: `цена трансляции`
        })

        p.append(price)
        p.append(price1)
        p.append(price2)

        let author = ce('select')

        if(!authorId) load(`authors`).then(authors=>{
            
                author.append(ce('option',false,false,`Выберите автора`,{value: ''}))
                authors
                    .filter(a=>a.active)
                    .sort((a,b)=>a.name<b.name?-1:1)
                    .forEach(a=>author.append(ce('option',false,false,a.name,{value:a.id})))
                p.append(author)
        })
        
        let course = ce('select')

        if(!courseId) load(`courses`).then(courses=>{
            
                course.append(ce('option',false,false,`Выберите курс`,{value: ''}))
                courses
                    .filter(a=>a.active)
                    .sort((a,b)=>a.name<b.name?-1:1)
                    .forEach(a=>course.append(ce('option',false,false,a.name,{value:a.id})))
                p.append(course)
        })

        p.append(ce('button',false,false,`Сохранить`,{
            onclick:function(){
                if(name.value && date.value){
                    axios.post(`/${host}/admin/classes`,{
                        name:           name.value,
                        descShort:      descShort.value,
                        descLong:       descLong.value,
                        authorId:       authorId || author.value,
                        courseId:       courseId || course.value,
                        kids:           kids.checked ? true : false,
                        age:            age.value,
                        pic:            pic.value,
                        price:          price.value,
                        price1:         price1.value,
                        price2:         price2.value,
                        date:           date.value
                        
                    }).then(handleSave)
                    .catch(handleError)
                    .finally(s=>{
                        this.removeAttribute(`disabled`)
                    })
                }
            }
        }))

        

        
}

function newCourse(){
    let p = preparePopupWeb(`course_new`)
    p.append(ce('h1',false,false,`Новый курс`))
    
    let name = ce('input',false,false,false,{
        placeholder: `Имя`,
        type: `text`
    })
    let description = ce('textarea',false,false,false,{
        placeholder: `description`
    })

    let pic = ce('input',false,false,false,{
        placeholder: `ссылка на картинку`
    })

    p.append(name)
    p.append(description)

    let kids = ce('input',false,false,false,{
        type: 'checkbox'
    })

    let kidsLabel = ce('label',false,false,'Для детей')

    kidsLabel.append(kids)

    p.append(kidsLabel)

    load(`authors`).then(authors=>{
        let author = ce('select')
            author.append(ce('option',false,false,`Выберите автора`))
            authors
                .filter(a=>a.active)
                .sort((a,b)=>a.name<b.name?-1:1)
                .forEach(a=>author.append(ce('option',false,false,a.name,{value:a.id})))
            p.append(author)

            p.append(ce('button',false,false,`Сохранить`,{
                onclick:function(){
                    if(name.value){
                        axios.post(`/${host}/admin/courses`,{
                            name:           name.value,
                            description:    description.value,
                            authorId:       author.value,
                            kids:           kids.checked ? true : false,
                            pic:            pic.value
                        }).then(handleSave)
                        .catch(handleError)
                        .finally(s=>{
                            this.removeAttribute(`disabled`)
                        })
                    }
                }
            }))
    })
    
}

function newAuthor(){
    let p = preparePopupWeb(`author_new`)
    
    let name = ce('input',false,false,false,{
        placeholder: `Имя`,
        type: `text`
    })
    let description = ce('textarea',false,false,false,{
        placeholder: `description`
    })
    let pic = ce('input',false,false,false,{
        placeholder: `ссылка на картинку`,
        type: `text`
    })
    p.append(name)
    p.append(pic)
    p.append(description)
    p.append(ce('button',false,false,`Сохранить`,{
        onclick:function(){
            if(name.value){
                this.setAttribute(`disabled`,true)
                axios.post(`/${host}/admin/authors`,{
                    name: name.value,
                    description: description.value,
                    pic: pic.value
                }).then(handleSave)
                .catch(handleError)
                .finally(s=>{
                    this.removeAttribute(`disabled`)
                })

            }
            
        }
    }))

}

function addClass(a,c){
    return ce('button',false,false,`Добавить`,{
        onclick:()=> newClass(c,a)
    })
}

function addBank(){
    return ce('button',false,false,`Добавить`,{
        onclick:()=> newBank()
    })
}

function showAuthor(a){
    let p = preparePopupWeb(`author_${a.id}`)
    
    if(a.pic) p.append(ce(`img`,false,`cover`,false,{src: a.pic}))
    
    p.append(ce('h1',false,false,a.name,{
        onclick:()=>edit(`authors`,a.id,`name`,`text`,a.name)
    }))

    p.append(ce(`p`,false,false,a.description,{
        onclick:()=>edit(`authors`,a.id,`description`,`text`,a.description)
    }))

    axios.get(`/${host}/admin/authors/${a.id}`).then(authorData=>{
        authorData = authorData.data
        p.append(ce('h2',false,false,authorData.classes.length?`Лекции`:`Лекций еще нет`))
        authorData.classes.forEach(cl=>{
            p.append(showClassLine(cl))
        })
        p.append(addClass(a.id))

        if(authorData.subscriptions.length){
            p.append(ce('h2',false,false,`Подписок на автора: ${authorData.subscriptions.length}`))
            let txt = ce('textarea',false,false,false,{placeholder: `Рассылка по всем подписанным на автора.`})
            p.append(txt)
            p.append(ce('button',false,false,`Отправить`,{
                onclick:function(){
                    if(txt.value){
                        this.setAttribute(`disabled`,true)
                        axios.post(`/${host}/admin/authors/${a.id}`,{
                            intent: `subscriptions`,
                            text: txt.value
                        }).then(handleSave)
                        .catch(handleError)
                        .finally(()=>this.removeAttribute(`disabled`))
                    }
                    
                }
            }))
        }
    })

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
                c.append(showClassLine(cl))
            });
            c.append(addClass())
            mc.append(c)


        })
        .catch(err=>{
            alert(err.message)
        })
}

function showBanks(){
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    axios.get(`/${host}/admin/banks`)
        .then(data=>{
            console.log(data.data)
            mc.innerHTML = '';
            mc.append(ce('h1',false,`header2`,`Реквизиты`))
            let c = ce('div')
            data.data.forEach(cl => {
                c.append(showBankLine(cl))
            });
            c.append(addBank())
            mc.append(c)


        })
        .catch(err=>{
            alert(err.message)
        })
}

function showBankLine(b){
    let c = ce('div',false,'divided',false,{
        dataset:{
            active: b.active,
        },
        // onclick:()=>{
        //     showBank(cl)
        // }
    })
    
    c.append(ce('h2',false,false,b.name,{
        onclick:()=>edit(`banks`,b.id,`name`,`text`,b.name)
    }))

    c.append(ce('p',false,false,b.creds,{
        onclick:()=>edit(`banks`,b.id,`creds`,`text`,b.creds)
    }))

    return c
}

function showClassLine(cl){
    let c = ce('div',false,'divided',false,{
        dataset:{
            active: cl.active,
            kids:   cl.kids
        },
        onclick:()=>{
            showClass(cl)
        }
    })
    c.append(ce('h2',false,false,cl.name))
    c.append(ce('p',false,false,`${Date(cl.date._seconds*1000)}`))
    return c
}

function addComment(c,id){
    let comment = prompt(`О чем предупредить администратора?`)
    if(!comment) return alert(`запрос прерван`)
    axios.put(`/${host}/admin/tickets/${id}`,{
        value: comment,
        attr: `comment`
    }).then(s=>{
        alert(`ok`)
        c.innerHTML = comment
    }).catch(err=>{
        alert(err.message)
    })
}


function showAuthors(){
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    axios.get(`/${host}/admin/authors`)
        .then(data=>{
            console.log(data.data)
            mc.innerHTML = '';
            mc.append(ce('h1',false,`header2`,`Авторы`))
            let c = ce('div')
            data.data.forEach(cl => {
                c.append(showAuthorLine(cl))
            });

            c.append(ce('button',false,false,`Добавить автора`,{
                onclick:()=>newAuthor()
            }))

            mc.append(c)
        })
        .catch(err=>{
            alert(err.message)
        })
}



function showAuthorLine(a){

    let div = ce('div',false,false,false,{
        dataset:{active:a.active}
    })

    div.append(ce('h2',false,false,a.name,{
        onclick:()=>showAuthor(a)
    }))

    return div
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


function showClassEdit(c){
    let p = preparePopupWeb(`class_edit`)
    
    p.append(ce('h1',false,false,c.name ? `Редактируем мероприятие` : `Новое мероприятие`))

        
}

function showClass(cl,id){
    if(!cl){
        cl = load(`classes`,id).then(cl=>cl.class)
        // axios.get(`/${host}/admin/classes/${id}`).then(d=>cl = d.data())
    }

    Promise.resolve(cl).then(cl=>{
        let p = preparePopupWeb(`class_${cl.id}`)
    
    if(cl.pic) p.append(ce(`img`,false,`cover`,false,{
        src: cl.pic,
        onclick:()=>edit(`classes`,cl.id,`pic`,`text`,cl.descLong)
    })) 
    
    p.append(ce('p',false,false,`${drawDate(cl.date._seconds*1000,'ru',{time:true})}`,{
        onclick:()=>edit(`classes`,cl.id,`date`,`date`,cl.date)
    }))
    
    p.append(ce('h1',false,false,cl.name,{
        onclick:()=>edit(`classes`,cl.id,`name`,`text`,cl.name)
    }))
        
        if(cl.kids) p.append(ce(`button`,false,`accent`,`для детей ${cl.age  || `без возрастных оганичений`}`))
        let alertsContainer = ce('div',false,'flexible')
            // if(!cl.capacity)        alertsContainer.append(ce(`button`,false,`accent`,`вместимость не указана`))
            if(!cl.pic)             alertsContainer.append(ce(`button`,false,`accent`,`задать картинку`,{
                onclick:()=>edit(`classes`,cl.id,`pic`,`text`,null)
            }))
            if(!cl.author)          alertsContainer.append(ce(`button`,false,`accent`,`выбрать автора`,{
                onclick:()=>edit(`classes`,cl.id,`authorId`,`authorId`,null)
            }))
            if(!cl.course)          alertsContainer.append(ce(`button`,false,`accent`,`выбрать курс`,{
                onclick:()=>edit(`classes`,cl.id,`courseId`,`courseId`,null)
            }))
        p.append(alertsContainer)

        p.append(ce('p',false,false,`ведет: ${cl.author||`неизвестно кто`}`,{
            // onclick:()=>showAuthor(cl.authorId)
            onclick:()=>edit(`classes`,cl.id,`author`,`authorId`,cl.authorId)

        }))
        
        p.append(ce('p',false,false,`цена: ${cur(cl.price,`GEL`)} / ${cur(cl.price2,`GEL`)} / ${cur(cl.price3,`GEL`)}`))
        
        

        p.append(ce('p',false,`story`,cl.descShort,{
            onclick:()=>edit(`classes`,cl.id,`descShort`,`text`,cl.descShort)
        }))
        p.append(ce('p',false,`story`,cl.descLong,{
            onclick:()=>edit(`classes`,cl.id,`descLong`,`text`,cl.descLong)
        }))


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
                                <td onclick=showTicket(false,"${u.id}")>Открыть билет</td>
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
    })
    
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



function showTicket(t,id){
    if(!t){
        t = axios.get(`/${host}/admin/tickets/${id}`).then(d=>d.data)
    }
    Promise.resolve(t).then(ticket=>{
        let p = preparePopupWeb(`ticket${ticket.id}`)
            if(!ticket.active) p.append(ce('h1',false,false,`Отменен`))
            p.append(ce('h1',false,false,`Билет: ${ticket.className}`,{
                onclick:()=>showClass(false,ticket.class)
            }))
            p.append(ce('h2',false,false,`${ticket.userName}${ticket.outsider? ` (не через бот)` :''}`,{
                onclick:()=>{
                    if(ticket.user){
                        showUser(false,ticket.user)
                    }
                }
            }))
            if(ticket.alert) p.append(ce('p',false,false,`ВАЖНО: ${ticket.alert}`))
            if(ticket.isPayed) p.append(ce(`p`,false,false,'оплачен'))

            p.append(ce('p',false,false,ticket.used?`использован`:`не использован`))
            
            if(ticket.rate) p.append(ce('p',false,false,`Оценка: ${ticket.rate}`))
            if(ticket.review) p.append(ce('p',false,false,`Отзыв: ${ticket.review}`))
            

    })
}

function showTickets(){
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    load(`tickets`)
        .then(tickets=>{
            mc.innerHTML = ''
            mc.append(ce('h1',false,false,`Билеты`))
            let table = ce('table',false,`wide`)
            let headers = ce('tr')
                // headers.append(ce('th',false,false,`id`))
                headers.append(ce('th',false,false,`создан`))
                headers.append(ce('th',false,false,`гость`))
                headers.append(ce('th',false,false,`мероприятие`))
                headers.append(ce('th',false,false,`оплата`))
                headers.append(ce('th',false,false,`статус`))
                headers.append(ce('th',false,false,`примечания`))
            table.append(headers)
            tickets.forEach(t=>{
                let line = ce('tr', false, false, false,{
                    onclick:()=>showTicket(t)
                })
                    // line.append(ce('td',false,false,t.id))
                    line.append(ce('td',false,false,drawDate(t.createdAt._seconds*1000)))
                    line.append(ce('td',false,false,t.userName))
                    line.append(ce('td',false,false,t.className))
                    line.append(ce('td',false,false,t.isPayed?'✔️':'❌'))
                    line.append(ce('td',false,false,t.status?'✔️':'❌'))
                    line.append(ce('td',false,false,t.comment||`без примечаний`))
                table.append(line)
            })
            mc.append(table)
        })
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


            
            
            data.data.forEach(cl => {
                let d =new Date(cl.createdAt._seconds*1000).toISOString().split('T')[0]
                if(!udata[d]) udata[d] =0
                udata[d] ++ 
                c.append(showUserLine(cl))
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