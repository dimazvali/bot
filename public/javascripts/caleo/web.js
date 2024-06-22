let host = `books`
let subHost = `admin`
let downLoadedUsers = {};
let botLink = `https://t.me/dimazvalibot`
let buttonStyle = []


function showCities(){
    showScreen(`Города`,`cities`,showCityLine,addCity)
}

function showUsers(){
    showScreen(`Пользователи`,`users`,showUserLine,false)
}

function showUserLine(u){
    let c = listContainer(u,true,{deals: `сделок`, offers:`книг`});
        c.append(ce(`h3`,false,false,uname(u, u.id),{
            onclick:()=>showUser(u.id)
        }))
    return c;
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

function showDeal(id){
    let p = preparePopupWeb(`deal_${id}`,false,false,true);
    load(`deals`,id).then(deal=>{
        p.append(ce(`h1`,false,false,deal.bookName,{
            onclick:()=>showBook(deal.book)
        }))
        p.append(detailsContainer(deal))
        
        let uc = ce(`div`)
        
        p.append(uc)

        load(`users`,deal.seller,downLoadedUsers).then(seller=>{
            load(`users`,deal.buyer,downLoadedUsers).then(buyer=>{
                uc.append(line(
                    ce(`button`,false,false,uname(seller,seller.id),{
                        onclick:()=>showUser(seller.id)
                    }),
                    ce(`button`,false,false,uname(buyer,buyer.id),{
                        onclick:()=>showUser(buyer.id)
                    })
                ))
                // uc.append(deal.address)
            })
        })

        load(`offers`,deal.offer).then(o=>{
            uc.append(ce(`p`,false,false,o.address))
        })

        p.append(line(
            ce(`p`,false,`mrRight`,`Статус: ${deal.status}`),
            ce(`p`,false,false,`Тип: ${deal.type}`)
        ))

        p.append(deleteButton(`deals`,id))
    })
}

function showUser(id){
    let p = preparePopupWeb(`user_${id}`,false,false,true)
    load(`users`,id).then(u=>{
        
        p.append(ce(`h1`,false,false,uname(u, u.id)))

        p.append(line(
            toggleButton(`users`,u.id,`blocked`,u.blocked||false,`Разблокировать`,`Заблокировать`,[`dateButton`,`dark`]),
            toggleButton(`users`,u.id,`noSpam`,u.noSpam||false,`Выключить новости`,`Включить новости`,[`dateButton`,`dark`])
        ))
        
        p.append(ce(`p`,false,false,`Город: ${u.city ? cities[u.city]: `не указан`}`,{
            onclick: function(){
                edit(`users`,id,`city`,`city`,u.city,this)
            }
        }))

        p.append(ce(`p`,false,false,`Адрес: ${u.address || `не указан`}`,{
            onclick: function(){
                edit(`users`,id,`addtess`,`text`,u.address,this)
            }
        }))

        let shelf = ce(`div`)
            shelf.append(ce(`h2`,false,false,`Полка`))
            load(`offers`,false,{createdBy:id}).then(offers=>{
                offers.forEach(o=>{
                    shelf.append(showOfferLine(o))
                })
            })
            p.append(shelf)
        
        let deals = ce(`div`)

        deals.append(ce(`h2`,false,false,`Сделки`))
            
            load(`deals`,false,{seller:id}).then(dealsList=>{
                dealsList.forEach(o=>{
                    deals.append(showDealLine(o))
                })
            })

            load(`deals`,false,{buyer:id}).then(dealsList=>{
                dealsList.forEach(o=>{
                    deals.append(showDealLine(o))
                })
            })

            p.append(deals)
        
            let messenger = ce('div')
            
            p.append(messenger)
    
            messenger.append(ce(`button`,false,buttonStyle,`Открыть переписку`,{
                onclick:function(){
                    this.remove()
                    messenger.append(ce(`h2`,false,false,`Переписка:`))
                    load(`messages`,false,{user:id}).then(messages=>{
                        let mc = ce(`div`,false,`messenger`)
                        messenger.append(mc)
                        messages.forEach(m=>{
                            mc.prepend(messageLine(m))
                        })
                        let txt = ce('textarea',false,false,false,`вам слово`)
                        messenger.append(txt)
                        messenger.append(ce(`button`,false,buttonStyle,`Отправить`,{
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

start = start.split('_')

switch(start[0]){
    case `newOffer`:{
        console.log(`newOffer_${start[1]}`)
        if(start[1]){
            addOffer({book:start[1]})
        } else {
            addOffer()
        }
        break;
    }

    case `books`:{
        if(start[1]){
            if(start[1] == `new`) {
                addBook()
            } else {
                showBook(start[1])
            }
            
        } else {
            showBooks()
        }
        break;
    }

    case `offers`:{
        if(start[1]){
            showOffer(start[1])
        } else {
            showOffers()
        }
        break;
    }

    case `deals`:{
        if(start[1]){
            showDeal(start[1])
        } else {
            showDeals()
        }
        break;
    }
}


function showDeals(){
    showScreen(`Сделки`, `deals`,showDealLine,false,false,true)
}


function showCity(id){
    let p = preparePopupWeb(`cities_${id}`,false,false,true)
        load(`cities`,id).then(city=>{
            
            p.append(detailsContainer(city))

            p.append(ce(`h1`,false,false,city.name,{
                onclick:function(){
                    edit(`cities`,id,`name`,`text`,city.name,this)
                }
            }))

            p.append(ce(`p`,false,false,city.description||'добавьте описание',{
                onclick:function(){
                    edit(`cities`,id,`description`,`textarea`,city.description||`добавьте описание`,this)
                }
            }))

            let offers = ce(`div`)
                offers.append(ce(`h3`,false,false,`Предложения:`))
                load(`offers`,false,{city:id}).then(offersData=>{
                    offersData.length ? offers.append(ce(`p`,false,false,`пока нет`)) : offersData.forEach(o=>{
                        offers.append(showOfferLine(o))
                    })
                    offers.append(ce(`button`,false,false,`Добавить`,{
                        onclick:()=>addOffer({city:id})
                    }))
                })
            p.append(offers)

        })
}


function addCity(){
    addScreen(`cities`,`Новый город`,{
        name:           {placeholder: `Название`},
        description:    {placeholder: `Описание`,tag:`textarea`},
        currency:       {placeholder: `код валюты`},
    })
}

