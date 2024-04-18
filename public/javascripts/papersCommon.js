

function showNews(){
    closeLeft()
    showScreen(`Рассылки`,`news`,newsLine,showNewNews,false,true,[`dark`,`dateButton`])
    // let p = preparePopupWeb(`news`,false,false,true)
    // p.append(ce('h2',false,false,`Загружаем...`))
    // load(`news`).then(tasks=>{
    //     p.innerHTML = `<h2>Рассылки</h2>`
    //     p.append(ce('button',false,`dateButton`,`Добавить`,{
    //         dataset:{booked:1},
    //         onclick:()=>showNewNews()
    //     }))
    //     tasks.forEach(t=>{
    //         p.append(newsLine(t))
    //     })
    // })
}

function newsLine(n){
    let c = listContainer(n,true)
    c.classList.remove(`hidden`)
    c.onclick=()=>showNewsNews(n.id)
    // c.append(ce('span',false,`info`,drawDate(n.createdAt._seconds*1000)))
    // c.append(ce('span',false,`info`,`Аудитория: ${n.audience||`нрзб.`}`))
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

        users.append(ce('button',false,[`dateButton`,`dark`],`показать всех получателей`,{
            onclick:()=>{
                load(`usersNews`,id).then(sends=>{
                    sends.sort((a,b)=>b.createdAt._seconds-a.createdAt._seconds).forEach((s,i)=>{
                        let c = ce('div',`message_${s.id}`,`sDivided`)
                        
                        users.append(c);

                        c.append(ce(
                            'span',
                            false,
                            `info`,
                            drawDate(s.createdAt._seconds*1000,false,{time: true})
                        ))

                        c.append(ce(`p`,false,false,s.user))

                        load(`users`,s.user,downLoadedUsers).then(u=>{
                            c.append(ce('a',false,false,uname(u,u.id),{
                                href: '#',
                                onclick:()=>showUser(false,u.id)
                            }))
                        })
                        
                    })

                    if((+new Date() - +new Date(n.createdAt._seconds*1000)) < 2*24*60*60*1000){
                        users.append(ce(`button`,false,[`dateButton`,`dark`,`active`],`Удалить сообщение`,{
                            onclick:function(){
                                let sure = confirm(`Сообщение будет удалено у всех доступных адресатов. Уверены?`)
                                if(sure) {
                                    sends.forEach((m,i)=>{
                                        setTimeout(()=>{
                                            axios.delete(`/${host}/admin/messages/${m.id}`).then(()=>{
                                                document.querySelector(`#message_${m.id}`).dataset.active = false;
                                            }).catch(err=>{
                                                alert(err.message)
                                            })
                                        },i*200)
                                    })
                                }
                            }
                        }))
                    }
                })
            }
        }))

        
        


    })
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

    if(host == `paper`){
        sendOptions = {
            admin:      `Админам`,
            insider:    `Сотрудникам`,
            fellow:     `fellows`,
            all:        `Всем`,
            randomCoffee: `random coffee`
            // tagged: `По тегу`
        }   
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