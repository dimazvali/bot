let mc = document.querySelector(`#main`)

const host = `cyprus`
function load(collection, id) {
    return axios.get(`/${host}/admin/${collection}${id?`/${id}`:''}`).then(data => {
        return data.data
    })
}

function showNews(){
    let p = preparePopupWeb(`class_new`)
        p.append(ce('h1', false, false, `Публикации`))

        let filtersc = ce(`div`)
        
        let filters = {
            active: `только новые`,
            published: `опубликованные`
        }

        

        let nc = ce(`div`)
        p.append(filtersc)
        p.append(nc)
        
        Object.keys(filters).forEach(b=>{
            filtersc.append(ce('button',false,false,filters[b],{
                onclick:function(){
                    filterUsers(b,nc,this)
                }
            }))
        })

        load(`news`).then(news=>{
            
            news.sort((a,b)=>b.createdAt._seconds-a.createdAt._seconds).forEach(n => {
                nc.append(drawNewsLine(n))
            });
        })
}


function showUser(u, id) {

    

    if (!u) {
        u = load(`users`,id)
    }

    Promise.resolve(u).then(u => {
        
        let news = u.news || []

        if(u.user) u = u.user

        

        console.log(u.news)
    

        let p = preparePopupWeb(`user_${u.id}`)
        
        p.append(ce('h1', false, false, `${uname(u,u.id)} (${u.language_code})`))
        p.append(ce('p', false, false, `регистрация: ${drawDate(u.createdAt._seconds*1000)}`))

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

        p.append(ce(`h2`, false, false, `Новости`))
        
        

        if(news) news.forEach(n=>{
            p.append(drawNewsLine(n))
        })
    })
}


function filterUsers(role,container,button){
    let c = button.parentNode;
    c.querySelectorAll('button').forEach(b=>b.classList.remove('active'))
    c.querySelectorAll('button').forEach(b=>b.classList.add('passive'))
    button.classList.add('active')
    button.classList.remove('passive')
    container.querySelectorAll('.divided').forEach(user=>{
        if(!role) return user.classList.remove('hidden')
        
        if(user.dataset[role] == 'true') {
            user.classList.remove('hidden')
        } else {
            user.classList.add('hidden')
        }
    })

    
}


function drawNewsLine(n){
    
    let c = ce('div',false,[`pub`,`divided`],false,{
        dataset: {
            active:         n.active,
            published:      n.published
        },
        onclick:()=>drawNews(n)
    })

    let s = ce('div',false,[`stat`,`flex`])

        s.append(ce('p',false,false,`Прислана: ${drawDate(n.createdAt._seconds*1000)}`))
        s.append(ce('p',false,false,`Статус: ${n.status}`))

    c.append(s)
    c.append(ce('h2',false,false,n.title))
    c.append(ce(`p`,false,false,))

    return c
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
    } else {
        f = ce('input', false, false, false, {
            value: value,
            type: type,
            placeholder: `Новое значение`
        })

        if(type == `textarea`){
            f = ce('textarea', false, false, false, {
                value: value,
                type: type,
                placeholder: `Новое значение`
            })
        }
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

function handleSave(s) {
    if (s.data.success) return alert(s.data.comment || `Ура! Пожалуй, стоит обновить страницу.`)
}

function drawNews(n){
    let p = preparePopupWeb(`news_${n.id}`)
    load(`news`,n.id).then(pub=>{
        
        n = pub.publication;

        p.append(ce(`p`,false,false,`статус: ${n.status}`))
        p.append(ce(`p`,false,false,`прислано: ${drawDate(n.createdAt._seconds*1000)}`))
        if(n.publishedAt) p.append(ce(`p`,false,false,`опубликовано: ${drawDate(n.publishedAt._seconds*1000,false,{time:true})}`))

        
        p.append(ce(`h1`,false,false,n.title,{
            onclick:()=>edit(`news`,n.id,`title`,`text`,n.title)
        }))

        if(pub.media){
            p.append(ce('img',false,`cover`,false,{
                src: pub.media
            }))
        }

        p.append(ce(`p`,false,false,`добавить/отредактировать картинку`,{
            onclick:()=>edit(`news`,n.id,`media`,`text`,n.media)
        }))

        p.append(ce(`p`,false,false,n.text,{
            onclick:()=>edit(`news`,n.id,`text`,`textarea`,n.text)
        }))

        if(n.active) {
            p.append(deleteButton(`news`,n.id))
        }

        if(n.status == `new`){
            p.append(publishButton(`news`,n.id))
        }

        p.append(ce('button',false,false,uname(pub.user,pub.user.id),{
            onclick:()=> showUser(false,pub.user.id)
        }))
    })
}

function publishButton(collection,id){
    return ce('button',false,false,`Опубликовать`,{
        onclick:()=>{
            let proof = confirm(`Вы уверены?`)
            if(proof) axios.post(`/${host}/admin/${collection}/${id}`)
                .then(handleSave)
                .catch(handleError)
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


function showUsers() {
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    axios.get(`/${host}/admin/users`)
        .then(data => {
            console.log(data.data)
            mc.innerHTML = '';
            mc.append(ce('h1', false, `header2`, `Пользователи`))
            let c = ce('div')

            // let chart = ce(`div`, `chartdiv`)

            // mc.append(chart)

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

            // let sortTypes = {
            //     appOpens: `По частоте использования`,
            //     classes: `По количеству лекций`,
            //     // fellow: `fellows`,
            // }

            // Object.keys(sortTypes).forEach(type => {
            //     mc.append(ce('button', false, type, sortTypes[type], {
            //         onclick: function () {
            //             c.innerHTML = ''
            //             data.data.sort((a, b) => (b[type] || 0) - (a[type] || 0)).forEach(cl => {
            //                 c.append(showUserLine(cl, (cl[type] || 0)))
            //             });
            //         }
            //     }))
            // })

            mc.append(c)

            // showUsersChart(d)

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


function closeLeft() {
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p => p.remove())
}


window.addEventListener('keydown', (e) => {
    if (e.key == 'Escape') {
        if(document.querySelectorAll(`.popupWeb`).length){
            document.querySelectorAll(`.popupWeb`)[document.querySelectorAll(`.popupWeb`).length-1].remove()
        }
        try {
            document.querySelector('.editWindow').remove();
            document.querySelector('#hover').remove();
        } catch (err) {
            console.warn(err)
        }
    }
})
