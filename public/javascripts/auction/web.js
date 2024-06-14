
let host =      `auction`
let downLoadedUsers = {};
let botLink =   `https://t.me/starsAuctionBot`
let buttonStyle=false;

function closeLeft() {
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p => p.remove())
}

start = start.split('_')

switch(start[0]){
    case `users`:{
        if(start[1]){
            showUser(start[1])
            break
        }
        showUsers()
        break;
    }
    case `auctions`:{
        if(start[1]){
            showAuction(start[1])
            break;
        }
        showAuctions()
        break;
    }
}


function showUsers(){
    showScreen(`Пользователи`,`users`,showUserLine,false,false,false,false,false,`.sDivided`)
}

function showAuctions(){
    // TBD добавить стили подсказок
    showScreen(`Аукционы`,`auctions`,showAuctionLine,addAuction,false,true)
}

function showIterations(){
    showScreen(`Розыгрыши`,`auctionsIterations`,showIterationLine,false,false,true)
}

function showAuctionLine(a){
    let c = listContainer(a,true,{iterations:`Итераций`})
        c.append(ce(`h2`,false,false,a.name,{
            onclick:()=>showAuction(a.id)
        }))
    return c
}

function showIterationLine(a){
    let c = listContainer(a,true,{
        users:`Участников`,
        base: `ставка`,
        stake: `пул`
    })
        c.append(ce(`h2`,false,false,a.auctionName,{
            onclick:()=>showIteration(a.id)
        }))
    return c
}

function showUserLine(u){
    let c = listContainer(u,true,{iterations: `аукционов`, score:`текущий счет`, total: `сальдо`});
        c.append(ce(`h3`,false,false,uname(u, u.id),{
            onclick:()=>showUser(u.id)
        }))
    return c;
}

function addAuction(){
    addScreen(`auctions`,`Новый аукцион`,{
        name:       {placeholder:`название`},
        base:       {placeholder: `ставка`, type: `number`},
        start:      {placeholder: `стартовый пул`, type: `number`},
    })
}

function addIteration(auctionId,name){
    addScreen(`auctionsIterations`,`Запускаем раунд ${name}`,{
        auction:    {placeholder:`id аукциона`, type:`hidden`, value: auctionId},
        till:       {type: `datetime-local`,placeholder: `дата окончания`}
    })
}

function addTransaction(userId,callback){
    addScreen(`transactions`,`Зачисление / вычет пользователю ${userId}`,{
        user:       {placeholder:`id пользователя`, type:`hidden`, value: userId},
        amount:     {placeholder: `сумма`, type: `number`}
    },callback)
}

function showIteration(id){
    let p = preparePopupWeb(`auctionsIterations_${id}`,false,false,true);
    
    load(`auctionsIterations`,id).then(i=>{
        p.append(ce('h1', false, false, `${i.auctionName}`))
        p.append(ce(`p`,false,false,`Ставка: ${i.base}`))
        p.append(ce(`p`,false,false,`Пул: ${i.stake}`))
        p.append(ce(`p`,false,false,`Лидер: ${i.stakeHolder}`))

        p.append(deleteButton(`auctionsIterations`,id))
    })
}

function showAuction(id){
    
    let p = preparePopupWeb(`auctions_${id}`,false,false,true);
    
    load(`auctions`,id).then(a=>{
        
        p.append(ce('h1', false, false, `${a.name}`,{
            onclick: function () {
                edit(`auctions`, a.id, `name`, `text`, a.name, this)
            }
        }))

        p.append(ce(`p`,false,false,`Ставка: ${a.base}`,{
            onclick: function () {
                edit(`auctions`, a.id, `base`, `number`, a.base, this)
            }
        }))

        p.append(ce(`p`,false,false,`Старт: ${a.start}`,{
            onclick: function () {
                edit(`auctions`, a.id, `start`, `number`, a.start, this)
            }
        }))

        let current = ce(`div`);

        p.append(current)

        load(`auctionsIterations`,false,{active: true, auction: id}).then(c=>{
            if(c[0]){
                showIterationLine(c[0])
            } else {
                current.append(ce(`button`,false,false,`Начать`,{
                    onclick:()=>addIteration(id,a.name)
                }))
            }
        })

        let iterationsContainer = ce(`div`)
        
        p.append(iterationsContainer);

        load(`auctionsIterations`,false,{auction: id}).then(iterations=>{
            iterations.forEach(i=>{
                iterationsContainer.append(showIterationLine(i))
            })
            if(!iterations.length) iterationsContainer.append(ce(`p`,false,false,`Еще не запускали`))
        })

    })
}

function messageLine(m){
    
    m.active = m.hasOwnProperty(`deleted`) ? false : true
    
    let c = listContainer(m,true,false,{
        isReply:        m.isReply,
        isIncoming:     !m.isReply,
        user:           m.user,
        reply:          m.isReply?true:false,
        incoming:       !m.isReply?true:false,
    })

    if(!m.active) c.classList.remove(`hidden`)

    c.append(ce(`p`,false,false,m.text || `без текста`))

    if(m.textInit) c.append(ce(`p`,false,false,`Исходный текст: ${m.textInit}`))

    let bc = ce(`div`,false,`flex`)
        c.append(bc)

    if(m.messageId && !m.deleted  && (+new Date() - new Date(m.createdAt._seconds*1000 < 48*60*60*1000))){
        bc.append(deleteButton(`messages`,m.id,false,[`active`,`dark`,`dateButton`],()=>message.remove()))
        if(!m.edited) bc.append(ce(`button`,false,buttonStyle,`редактировать`,{
            onclick:()=>{
                let ew = modal()
                    let txt = ce(`textarea`,false,false,false,{
                        placeholder: `вам слово`,
                        value: m.text || null
                    })
                     
                    ew.append(txt);

                    ew.append(ce(`button`,false,false,`Сохранить`,{
                        onclick:()=>{
                            if(txt.value) axios.put(`/${host}/admin/messages/${m.id}`,{
                                attr: `text`,
                                value: txt.value
                            }).then(handleSave)
                            .catch(handleError)
                        }
                    }))
            }
        }))
    }

    if(!m.isReply){
        bc.append(ce(`button`,false,buttonStyle,`Ответить`,{
            onclick:()=>{
                let b = modal()
                let txt = ce(`textarea`,false,false,false,{placeholder: `Вам слово`})
                    b.append(txt)
                    b.append(ce(`button`,false,buttonStyle,`Написать`,{
                        onclick:function(){
                            if(!txt.value) return alert(`Я не вижу ваших букв`)
                            this.setAttribute(`disabled`,true)
                            axios.post(`/${host}/admin/message`,{
                                text: txt.value,
                                user: m.user
                            }).then(handleSave)
                            .catch(handleError)
                            .finally(()=>{
                                txt.value = null;
                                this.removeAttribute(`disabled`)
                            })
                        }
                    }))
            }
        }))
    }

    return c
}



function showUser(id){
    let p = preparePopupWeb(`users_${id}`,false,false,true)
    load(`users`,id).then(u=>{
        p.append(ce('h1', false, false, `${uname(u,u.id)}`))
        
        p.append(line(
            ce('p', false, false, `регистрация: ${drawDate(u.createdAt._seconds*1000)}`),
            // ce('p', false, false, `последний раз в приложении: ${u.appLastOpened ? drawDate(u.appLastOpened._seconds*1000) : `нет данных`}`)
        ))
        
        p.append(line(
            ce('p', false, false, `${u.first_name || `Имя не указано`}`, {
                onclick: function () {
                    edit(`users`, u.id, `first_name`, `text`, u.first_name, this)
                }
            }),
            ce('p', false, false, `${u.last_name || `Фамилия не указана`}`, {
                onclick: function () {
                    edit(`users`, u.id, `last_name`, `text`, u.last_name, this)
                }
            })
        ))
        

        let adminLinks = [{
            attr: `admin`,
            name: `сделать админом`,
            disname: `снять админство`
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

        p.append(ce(`p`,false,false,`Депозит: ${u.score}`,{
            onclick:()=>addTransaction(u.id,()=>showUser(id))
        }))


        let messenger = ce('div')
        p.append(messenger)

        messenger.append(ce(`button`,false,[`dark`,`dateButton`],`Открыть переписку`,{
            onclick:function(){
                this.remove()
                messenger.append(ce(`h2`,false,false,`Переписка:`))
                load(`messages`,false,{user:+u.id}).then(messages=>{
                    let mc = ce(`div`,false,`messenger`)
                    messenger.append(mc)
                    messages.forEach(m=>{
                        mc.prepend(messageLine(m))
                    })
                    let txt = ce('textarea',false,false,false,`вам слово`)
                    messenger.append(txt)
                    messenger.append(ce(`button`,false,[`dark`,`dateButton`],`Отправить`,{
                        onclick:()=>{
                            if(txt.value){
                                axios.post(`/${host}/admin/messages`,{
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

function showShop(id){
    let p = preparePopupWeb(`shops_${id}`,false,false,true);
    
    load(`shops`,id).then(s=>{
        let details = ce(`div`,false,`details`)
            details.append(ce('span',false,`info`,`создано ${drawDate(s.createdAt._seconds*1000)}`))
            if(s.updatedAt) details.append(ce('span',false,`info`,`обновлено ${drawDate(s.updatedAt._seconds*1000)}`))
            details.append(ce('span',false,`info`,`посещений ${s.visited||0}`))
            
        p.append(details)

        p.append(ce(`h1`,false,false,s.name,{
            onclick:function(){
                edit(`shops`,id,`name`,`text`,s.name,this)
            }
        }))
    
        p.append(ce(`p`,false,`editable`,`Ключ API ${s.apiId}`,{
            onclick:function(){
                edit(`shops`,id,`apiId`,`text`,s.apiId,this)
            }
        }))
    
        p.append(ce(`p`,false,`editable`,`Секрет API ${s.apiSecret}`,{
            onclick:function(){
                edit(`shops`,id,`apiSecret`,`text`,s.apiSecret,this)
            }
        }))

        let usersContainer = ce(`div`)
        p.append(usersContainer)
        usersContainer.append(ce(`h2`,false,false,`Пользователи:`))
        load(`shopsUsers`,false,{shop:id})
            .then(users=>{
                users.forEach(u=>{
                    usersContainer.append(shopUserLine(u))
                })
                usersContainer.append(ce(`button`,false,false,`Добавить пользователя`,{
                    onclick:()=>{
                        add2Shop(id)
                    }
                }))

            })

        p.append(ce(`button`,false,false,`Открыть отчет`,{
            onclick:()=>{
                window.open(
                    `/${host}/${s.id}/report`,
                    '_blank'
                )
            }
        }))
    })
}


function add2Shop(shopId){
    let p = modal();
        p.append(ce(`h2`,false,false,`Добавить пользователя`))
    
        let suggest = ce(`div`)

        let cv = null;

        let inp = ce('input',false,false,false,{
            placeholder: `начните вводить ник пользователя`,
            oninput:function(){
                if(this.value && this.value!=cv && this.value.length > 3){
                    cv = this.value
                    suggest.innerHTML = `ищу-свищу`
                    axios.get(`/${host}/admin/userSearch?name=${this.value}`).then(options=>{
                        if(options.data.length){
                            suggest.innerHTML = null;
                            options.data.forEach(u=>{
                                suggest.append(ce(`button`,false,false,uname(u,u.id),{
                                    onclick:function(){
                                        this.setAttribute(`disabled`,true)
                                        axios.post(`/${host}/admin/shopsUsers`,{
                                            user: +u.id,
                                            shop: shopId
                                        }).then(s=>{
                                            handleSave(s)
                                            p.remove()
                                            showShop(shopId)
                                        }).catch(handleError)
                                    }
                                }))
                            })
                        }
                    })
                }
            }
        })

        p.append(inp)
        p.append(suggest)
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

function edit(entity, id, attr, type, value, container,layer) {

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

    let helps={
        voice: `Чтобы получить код голосовой заметки, просто начитайте ее боту, в ответ вы получите необходимую строку.`
    }

    let edit = modal();

    edit.append(ce('h2', false, false, `Правим поле ${attrTypes[attr]||attr} для ${entities[entity]||entity}#${id}`))
    
    if(helps[attr]) edit.append(ce(`p`,false,`info`,helps[attr]))
    
    let f = ce('input');
    if (type == `date`) {
        f.type = `datetime-local`
        edit.append(f)
    } else if (type == `textarea`) {
        f = ce('textarea', false, false, false, {
            value: value,
            type: type,
            placeholder: `Новое значение`
        })
        edit.append(f)
    } else {
        f = ce('input', false, false, false, {
            value:          value,
            type:           type,
            placeholder:    `Новое значение`
        })
        edit.append(f)
    }

    f.focus()

    edit.append(ce('button', false, false, `Сохранить`, {
        onclick: function () {
            if (f.value) {
                axios.put(`/${host}/${layer||`admin`}/${entity}/${id}`, {
                        attr: attr,
                        value: type == `date` ? new Date(f.value) : f.value
                    }).then((d)=>{
                        handleSave(d);
                        edit.remove()
                        if(container) container.innerHTML = f.value
                    })
                    .catch(handleError)
            }
        }
    }))

    edit.append(ce('button', false, false, `Удалить`, {
        onclick: function () {
            let sure = confirm(`вы уверены?..`)
            if (sure) {
                axios.put(`/${host}/${layer||`admin`}/${entity}/${id}`, {
                        attr:   attr,
                        value:  null
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

function setSettings(settings,shop){
    Object.keys(settings).sort((a,b)=>settings[b].sort-settings[a].sort).forEach(sku=>{
        document.querySelector(`#content`).append(settingsLine(settings[sku],sku,shop))
    })
}


function setHouses(houses, shop){
    Object.keys(houses).sort((a,b)=>a>b?1:-1).forEach(id=>{
        document.querySelector(`#content`).append(houseLine(houses[id],id,shop))
    })
}

function setHouses2(houses,shop){
    let curShop = shop;
    
    console.log(houses)
    
    

    let dataM = new page({
        houses: Object.keys(houses).sort((a,b)=>a<b?-1:1).map(key=>{
            let t = houses[key]
            t.id = key
    
            return t
        })
    });

    ko.applyBindings(dataM, document.querySelector('#content'));

}

let dragged = null;
let dragOver = null;

function houseLine(h, id, shop){
    let c = listContainer(s,true)
        c.classList.remove(`hidden`)
        c.append(ce(`h3`,false,false,id))
        c.append(ce(`p`,false,`editable`,`Литробонусы: ${h.lb}`,{
            onclick: function () {
                edit(`shopHouses`, shop, `${id}.lb`, `text`, h.lb, this, `api`)
            }
        }))

        c.append(ce(`p`,false,`editable`,`Доставка: ${h.delivery}`,{
            onclick: function () {
                edit(`shopHouses`, shop, `${id}.delivery`, `text`, h.delivery, this, `api`)
            }
        }))
        return c
}

function settingsLine(s,id,shop){
    let c = listContainer(s,true)
        c.id = id;
        c.cl
        c.dataset.shop = shop
        
        c.draggable = true;

        c.classList.remove(`hidden`)
        let line = ce(`div`,false,`flex`)

        
        
        line.append(ce(`h3`,false,false,s.id||id))
        
        line.append(toggleButton(`shopSettings`,shop,`${id}.active`,s.active,`скрыть`,`показать`,false,`api`))
        
        line.append(ce('p', false, `editable`, `${s.name || `Добавьте название`}`, {
            title: `название`,
            onclick: function () {
                edit(`shopSettings`, shop, `${id}.name`, `text`, s.name, this, `api`)
            }
        }))

        line.append(ce('p', false, `editable`, `${s.price ? cur(s.price||0) : `Добавьте стоимость`}`, {
            title: `название`,
            onclick: function () {
                edit(`shopSettings`, shop, `${id}.price`, `number`, s.price, this, `api`)
            }
        }))
        
        c.append(line)

        c.addEventListener(`dragstart`,(e)=>{
            console.log(e);
            dragged = e.target;
            // c.remove()
        })

        c.addEventListener(`dragenter`,(e)=>{
            console.log(`попали на`, c)
            dragOver = c
        })

        c.addEventListener(`dragend`,(e)=>{
            console.log(`прекратили тащить`,id, c)
            e.target.parentNode.removeChild(dragged)
            dragOver.parentNode.insertBefore(dragged,dragOver)
            rescorePositions(dragOver.parentNode)
            dragged,dragOver = null;
            
        })

        c.addEventListener(`drop`,(e)=>{
            console.log(`бросили`,id, c)
        })

        
        

    return c;
}

function rescorePositions(container){
    let row = document.querySelector(`#content`).querySelectorAll(`.sDivided`) 
    row.forEach((el,i)=>{
        axios.put(`/${host}/api/shopSettings/${el.dataset.shop}`,{
            attr:   `${el.id}.sort`,
            value:  row.length-i
        })
    })
}

function addShop(){
    let p = modal();
    p.append(`Новый магазин`)

    let name = ce(`input`,false,false,false,{
        placeholder: `название магазина`,
        type: `text`
    })
    p.append(name)
    
    let apiId = ce(`input`,false,false,false,{
        placeholder: `client id`,
        type: `text`
    })
    p.append(apiId)

    let apiSecret = ce(`input`,false,false,false,{
        placeholder: `API key`,
        type: `text`
    })
    p.append(apiSecret)

    p.append(ce(`button`,false,false,`Сохранить`,{
        onclick:function(){
            if(!name.value) return alert(`вы пропустили название магазина`)
            if(!apiId.value) return alert(`вы пропустили client id`)
            if(!apiSecret.value) return alert(`вы пропустили API key`)
            this.setAttribute(`disabled`,true)
            axios.post(`/${host}/api/shops`,{
                name: name.value,
                apiId: apiId.value,
                apiSecret: apiSecret.value,
            }).then(s=>{
                window.location.reload()
            }).catch(handleError)
        }
    }))
}

function updateCreds(b){
    let c =         b.parentNode;
    let apiId =     c.querySelector(`[name="apiId"]`)
    let apiSecret = c.querySelector(`[name="apiSecret"]`)

    if(apiId.value && apiSecret.value){
        axios.patch(`/${host}/api/shops/${c.id}`,{
            apiId: apiId.value,
            apiSecret: apiSecret.value
        }).then(handleSave)
        .catch(handleError)
    } else {
        alert(`Вы пропустили одно из полей.`)
    }
    
}