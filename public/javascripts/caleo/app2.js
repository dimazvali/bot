

let tg =        window.Telegram.WebApp;
const host =    `caleo`
const adminka = `https://dimazvali-a43369e5165f.herokuapp.com/caleo`;
let mcb, mbbc, curLecture, curTicket, curAlert = null;

let views = [];


const dummyBook = `/images/${host}/blank.png`

const helperTexts = {
    offers: {
        title: `Ваша полка`,
        text: [
            `В этом разделе содержатся книги, которые вы представили публике. Пока что только «на почитать», но уже вы сможете выставить тот  или иной том на продажу.`,
            `Чтобы добавить книгу на полку, нажмите «Добавить книгу». Чтобы сэкономить ваше время, приложение попробует найти ее данные по ISBN. Если такой книги в каталоге еще нет — вы сможете оформить ее полностью.`,
            `Книги отображаются в порядке добавления (от новых к старым). Полупрозрачными становятся те издания, которые в данный момент находятся на руках у других пользователей (или ждут вашего одобрения).`,
            `Порядок выдачи прост: кто-то из пользователей находит вашу в каталоге и отправляет запрос. Бот отправит вам соответствующее сообщение. Если книга у вас на руках – вы подтверждаете запрос. Если что-то пошло не так, у вас есть возможность отказаться. После подтверждения запроса обе стороны получают сообщение с контактами друг друга. Вы связываетесь и договариваетесь об удобном месте и времени. После передачи – подтверждаете, что она состоялась. Наконец, после того, как книга вернется к вам, нажмите соответствующую кнопку — сделка будет закрыта и книга снова станет доступной другим читателям.`,
            `Если что-то пойдет не так, просто напишите боту – администрация свяжется с вами и постарается решить вопрос.`,
        ]
    },
    fresh:{
        title: `Свежие поступления`,
        text: [
            `В этом блоке выставлены книги, которые можно взять почитать в вашем городе (за исключением тех изданий, которые предлагаете вы сами).`,
            `Тома, находящиеся на руках у других читателей, сделаны полупрозрачными. Если они вам интересны, откройте карточку книги и нажмите «Тоже хочу» — мы уведомим вас, когда они освободятся.`,
            `Вы будете получать уведомления о новых книгах, если не отключите их в настройках (или кнопкой, сопровождающей каждое новое сообщение).`
        ]
    }
}

function helper(type){
    let c = ce(`div`,false,`containerHelp`,`?`,{
        onclick:()=>{
            let m = ce(`div`,false,[`modal`,(tg.colorScheme=='dark'?`reg`:`light`)])
                m.append(ce(`h2`,false,false,helperTexts[type].title,{
                    onclick:()=>m.remove()
                }))
            let sub = ce(`div`,false, `vScroll`)
                helperTexts[type].text.forEach(p=>{
                    sub.append(ce(`p`,false,`info`,p))
                })

                sub.append(ce(`button`,false,`thin`,`скрыть`,{
                    onclick:()=>m.remove()
                }))
            m.append(sub)
            document.body.append(m)
        }
    });
    
    return c;
}


const dealButtons={
    contact:{}
}

const dealsStatuses = {
    inReview:{
        sort: 1,
        name: {
            buyer: (d)=>`Ждет одобрения`,
            seller: (d)=>`Ждет вашего одобрения`
        },
        text:{
            seller: (d)=>`Сможете дать почитать эту книгу доброму человеку?..`,
            buyer: (d)=>`Вы оставили заявку на эту книгу в ${drawDate(d.createdAt._seconds*1000)}.\nЕе владелец еще не подтвердил возможность аренды. Чуть-чуть подождем.`
        },
        buttons:{
            seller:(d)=>[{
                text:   `Да, конечно!`,
                id:     `confirmToRent`
            },{
                text:   `Увы, нет.`,
                id:     `cancelledBySeller`
            }],
            buyer:(d)=>[{
                text:   `Отменить заявку`,
                type:   `destructive`,
                id:     `cancelledByBuyer`
            }]
        }
    },
    cancelledByBuyer:{
        sort: 5,
        name: {
            buyer: (d)=>`Вы отказались`,
            seller: (d)=>`Читатель отказался`
        },
        text:{
            seller: (d)=>`Человек, который попросил у вас эту книгу, успел передумать.`,
            buyer: (d)=>`Вы отменили заявку на эту книгу.`
        },
        buttons:{
            seller:(d)=>null,
            buyer:(d)=>null
        }
    },
    cancelledBySeller:{
        sort: 5,
        name: {
            buyer: (d)=>`Книга недоступна`,
            seller: (d)=>`Вы отказали`
        },
        text:{
            seller: (d)=>`Вы отклонили эту заявку.`,
            buyer: (d)=>`Владелец книги не смог подтвердить ваш запрос.`
        },
        buttons:{
            seller:(d)=>null,
            buyer:(d)=>null
        }
    },
    inProgress:{
        sort: 2,
        name: {
            buyer: (d)=>`Ждет встречи`,
            seller: (d)=>d.sellerConfirmed ? `Ждет подтверждения читателя` :`Ждет встречи с читателем`
        },
        text:{
            seller: (d)=> d.sellerConfirmed ? 
                `${d.buyerName || `@${d.buyerUserName}`} еще не подтвердил(-а) получение книги.` :  
                `Читатель: ${`@${d.buyerUserName}` || d.buyerName}.\nСвяжитесь с ним, договоритесь о встрече, а потом, пожалуйста, подтвердите, что книга передана.`,
            buyer:  (d)=>`Я отправил вам контакы владельца. Свяжитесь с ним, договоритесь о встрече, а потом, пожалуйста, подтвердите, что книга передана.`
        },
        buttons:{
            seller:(d)=>d.sellerConfirmed ? [{
                text:   `Напомнить о книге`,
                id:     `remindOfDelivery`
            }] : [{
                text:   `Открыть чат`,
                id:     `chat_${d.buyerUserName}`
            },{
                text:   `Книга передана`,
                id:     `deliveredBySeller`
            }],
            buyer:(d)=>[{
                text:   `Открыть чат`,
                id:     `chat_${d.sellerUserName}`
            },{
                text:   `Книга получена`,
                id:     `deliveredByBuyer`
            }]
        }
    },
    given:{
        sort: 3,
        name: {
            buyer: (d)=>`Книга у вас`,
            seller: (d)=>`Книга выдана`
        },
        text:{
            seller: (d)=>`Вы поделились самым дорогим. Вы молодец.\nНе забудьте подтвердить получение книги, когда она к вам вернется.`,
            buyer: (d)=>`Вы получили книгу. Пожалуйста, будьте с ней предельно аккуратны — и забудьте подтвердить возрат книги, когда придет время попроощаться с ней.`
        },
        buttons:{
            seller:(d)=>[{
                text:   `Книгу вернули`,
                id:     `closeDealBySeller`
            }],
            buyer:(d)=>[{
                text:   `Книга у владельца`,
                id:     `closeDealByBuyer`
            }]
        }
    },
    closed:{
        sort: 4,
        name: {
            buyer: (d)=>`Вы вернули книгу`,
            seller: (d)=>`Книга вернулась`
        },
        text:{
            seller: (d)=>`Вы получили сообщение с кнопками оценки читателя.`,
            buyer: (d)=>`Надеемся, все прошло хорошо.`
        },
        buttons:{
            seller:(d)=>null,
            buyer:(d)=>null
        }
    },
}

function shimmer(light){
    if(light) return tg.HapticFeedback.impactOccurred('light')
    tg.HapticFeedback.notificationOccurred('success')
}

let confirmed = false;

// if(authNeeded){
    console.log(`Нужна авторизация`)
    confirmed = axios.post(`/${host}/authWebApp?token=userToken`,tg.initData)
        .then(s=>{
            // confirmed = 
            console.log(`получили данные админа ${s.data}`)
            return s.data.admin;
        })
// }

function userLoad(collection, id, extra) {
    return axios.get(`/${host}/api/${collection}${id?`/${id}`:''}${extra?`?${Object.keys(extra).map(k=>`${k}=${extra[k]}`).join(`&`)}`:''}`)
        .then(data => {
            return data.data
        })
        // .catch(err=>{
        //     console.log(err)
        //     return new Error()
        // })
}



function showLoad(){
    tg.MainButton.setParams({
        text:`загружаем`,
        is_visible: true
    })
    tg.MainButton.showProgress()
}

function hideLoad(){
    tg.MainButton.setParams({
        text:`загружаем`,
        is_visible: false
    })
    tg.MainButton.hideProgress()
}


function setWarning(inp){
    inp.classList.add('warning')
    setTimeout(()=>{
        inp.classList.remove(`warning`)  
    },1500)
}


function showOrder(id){
    let p = preparePopup(`order_${id}`)
    userLoad(`orders`,id).then(o=>{
        let oid = id;
        p.append(ce(`h1`,false,false,`Заказ №${oid}`))
        let goods = ce(`div`,false,`container`)
        p.append(goods)
        o.products.forEach(i=>{
            let c = ce(`div`,false,`sDivided`)
            c.append(ce(`h3`,false,false,i.name))
            c.append(ce(`p`,false,`info`,cur(i.total)))
            goods.append(c)                
        })
    })
}


function toast(txt){
    tg.MainButton.setParams({
        text: txt,
        is_visible: true
    })
    setTimeout(()=>{
        tg.MainButton.hide()
    },1500)
}
    
function showSettings(profile,button){
    shimmer(true)
    let p = preparePopup(`profile`)
    
    p.append(ce(`h1`,false,false,`Профиль`))

    p.append(ce(`p`,false,[`info`,`cut`],`Здеcь будут прятаться полезные настройки и история заказов`,{
        onclick:function(){
            this.classList.toggle(`cut`)
        }
    }))


    let orders = ce(`div`,false,`container`);
    p.append(orders)

    userLoad(`orders`).then(o=>{
        if(o.length) orders.append(ce(`h2`,false,false,`История заказов `))
        o.forEach(order=>orders.append(showOrderLine(order)))
    })

    let views = ce(`div`,false,`container`);
    p.append(views)
    userLoad(`views`).then(o=>{
        if(o.length){
            views.append(ce(`h2`,false,false,`История просмотров`))
            let already = []
            o.forEach(view=>{
                if(already.indexOf(view.product_id) == -1){
                    views.append(itemLine(view))
                    already.push(view.product_id)
                }
            })
        } else {
            views.append(ce(`h3`,false,`info`,`Вы еще не открывали каталог.`))
        }
    })
}


function showOrderLine(order){
    let c = ce(`div`,false,`sDivided`,false,{
        onclick:()=>showOrder(order.id)
    })
    c.append(ce(`h4`,false,false,`Заказ ${order.id}`))
    c.append(ce(`span`,false,[`info`,`mtopmin`],`создан ${drawDate(order.createdAt)}`))
    return c;
}

function preparePopup(type) {
    tg.BackButton.show();
    tg.onEvent('backButtonClicked', clearPopUp)

    if (document.querySelector(`[data-type="${type}"]`)) {
        document.querySelector(`[data-type="${type}"]`).remove()
    }

    let index = Math.floor(Math.random()*4)+1

    mcb = clearPopUp
    let popup = ce('div', false, 'popup', false, {
        dataset: {
            type: type
        }
    })

    
    document.body.append(popup)
    let content = ce('div')
    // content.style.backgroundImage = `url(/images/caleo/bg/xray${index}.png)`
    // content.style.animation = `bgRise 1s forwards`
    popup.append(content)

    tg.MainButton.hide()
    return content
}


function clearPopUp() {
    let length = document.querySelectorAll('.popup').length;

    if(searchBarShown) {
        let lb = document.querySelector(`.logoSearchContainer`)
        lb.querySelector(`input`).remove()
        document.querySelector(`#sb`).classList.remove(`clicked`)
        lb.append(ce(`img`,false,false,false,{src:`/images/${host}/logo.png`}))
    }
    let p = document.querySelectorAll('.popup')[length - 1]

    console.log(p)

    p.classList.add('sb')

    setTimeout(function () {
        p.remove()
        if (!document.querySelectorAll('.popup').length) tg.BackButton.hide()
    }, 500)

    if (mcb) {
        tg.MainButton.offClick(mcb)
        mcb = null;
        tg.MainButton.hide()
    }

    if (mbbc) {
        tg.MainButton.hide()
        tg.MainButton.offClick(mbbc)
        mbbc = null
    }
}

let checkoutHeader = ce(`span`,false,`checkoutHeader`,'-',{
    onclick: ()=>showCart()
})
            


let searchBarShown = false;

Promise
    .resolve(confirmed)
    .then(admin=>{

        console.log(`погнали`)
        
        // tg.requestWriteAccess();

        document.body.innerHTML = null;

        function showSearch(container,button){
            searchBarShown = true;

            container.innerHTML = null;
            container.append(ce(`input`,false,false,false,{
                placeholder: `поиск по разделам`,
                oninput:function(){
                    console.log(this.value)
                    if(this.value){
                        // userLoad(`search`,this.value).then(options=>{
                        //     if(document.querySelector(`#suggest`)) document.querySelector(`#suggest`).remove() 
                        //     if(options.length){
                        //         let suggest = ce(`div`,`suggest`)
                        //             options.forEach(o=>{
                        //                 suggest.append(sectionLine(o))
                        //             })
                        //         document.body(append(suggest))
                                
                        //     }
                        // })

                        if(document.querySelector(`#suggest`)) document.querySelector(`#suggest`).remove() 
                            let found = itemsList.filter(i=>i.name.toLowerCase().indexOf(this.value.toLowerCase())>-1)  
                            if(found.length) {
                                let suggest = ce(`div`,`suggest`,`popup`)
                                found.forEach(item=>{
                                    suggest.append(itemLine(item))
                                })
                                document.body.append(suggest)
                            }
                            
                                
                            
                    }
                }
            }))
        }

        let sb = ce(`div`,false,`searchBar`)
            // sb.append(ce(`input`,false,false,false,{
            //     placeholder: `поиск`
            // }))
            // sb.append()
            let lb = ce(`div`,false,`logoSearchContainer`)
                sb.append(lb)
                lb.append(ce(`img`,false,false,false,{src:`/images/${host}/logo.png`}))

            let bc = ce(`div`,false,`flex`)
                sb.append(bc)
            bc.append(ce(`img`,`sb`,`clickable`,false,{
                src:`/images/${host}/search.png`,
                onclick:function(){
                    
                    this.classList.toggle(`clicked`)

                    if(lb.querySelector(`input`)){
                        searchBarShown = false;
                        lb.querySelector(`input`).remove()
                        lb.append(ce(`img`,false,false,false,{src:`/images/${host}/logo.png`}))
                    } else {
                        showSearch(lb,this)
                    }
                    
                }
            }))
            bc.append(ce(`img`,false,`clickable`,false,{
                src:`/images/${host}/basket.png`,
                onclick:()=>showCart()
            }))
            bc.append(checkoutHeader)            

        let c = ce(`div`,false,`mobile`)

        document.body.append(sb)
        document.body.append(c);

        let profile = ce(`div`,`profile`,[`container`,(tg.colorScheme=='dark'?`reg`:`light`)])

        c.append(profile)

        userLoad(`profile`).then(user=>{

            localStorage.city =     user.city || null;
            localStorage.address =  user.address || null;

            let uname = `${user.first_name||''} ${user.last_name||''}`.trim();

            if(!uname) uname = user.username ? `@${user.username}` : user.id

            profile.append(ce(`h3`,false,false,uname));

            if(user.num)       profile.append(ce(`p`,false,[`info`,`sub`],` Читательский билет №${user.num}.`))
            if(user.photo_url) profile.append(ce(`img`,false,`bgImg`,false,{src: user.photo_url}))

            // profile.append(ce(`div`,false,`tag`, `<span class="info">место действия:</span> <span id="cityName">`+(cities[user.city] ? cities[user.city].name : `город не определен`)+'</span>.'))

            // profile.append(ce(`p`,false,`info`,`Место отображения статуса и регалий.`))
            
            let tagsContainer = ce(`div`)
            
            profile.append(tagsContainer)
            // ⚙
            // ⚙️upRight
            // 
            profile.append(ce(`div`,false,`containerHelp`,`☰`,{
                onclick:function(){
                    showSettings(user)
                }
            }))

        }).catch(handleError)

        userLoad(`cart`).then(c=>{

            curCart = c.id;
            if(c.itemsCount){
                userLoad(`cart`,c.id).then(col=>{
                    col.products.filter(p=>p.total).forEach(item=>{
                
                        if(!cart[item.id]) cart[item.id] = {
                            name: item.name
                        }
                        
                        item.selectedOptions.forEach(so=>{
                            if(!cart[item.id][so.id]) cart[item.id][so.id] = {
                                q:          so.quantity||1,
                                price:      +so.price,
                                name:       so.name,
                                properties: so.properties,
                                total:      +(so.quantity||1)*+so.price
                            }
                        })

                        
                    })
                    if(c.itemsCount) rescoreCart()
                })

                
            }


            
        })

        let cat = ce(`div`,false,`container`);

        c.append(cat);

        catalogue.forEach(section=>{
            cat.append(sectionLine(section))
        })

        if(start) {
            start = start.split(`_`)
            switch(start[0]){
                
            }
        }
    })

function sectionLine(s){
    let c = ce(`div`,false,`sDivided`,s.name,{
        onclick:()=>{
            showSection(s)
        }
    })
    return c
}

function showSection(s){
    let p = preparePopup(s.id)
        
        p.append(ce(`h2`,false,false,s.name))

        if(s.description) p.append(ce(`p`, false, [`info`,`cut`], s.description,{
            onclick:function(){
                this.classList.toggle(`cut`)
            }
        }))

        if(s.sub.length){
            let list = ce(`div`,false,`container`)
            s.sub.forEach(l=>list.append(sectionLine(l)))
            p.append(list)
        } else if(s.products.length){
            let list = ce(`div`,false,`container`)
            s.products.forEach(l=>list.append(itemLine(l)))
            p.append(list)
        }

        let back = ce(`div`)

        // p.append(ce(`p`,false,`info`,`А здесь неплохо бы смотрелся виджет "популярное в разделе".`))

    return p
}

function itemLine(i){
    let c = ce(`div`,false,[`itemLine`,`sDivided`],false,{
        onclick:()=>showItem(i)
    })
    let content = ce(`div`,false,`flex`)
        content.append(ce(`img`,false,`ava`,false,{src:i.image}))
        content.append(ce(`p`,false,`ava`,i.name))
    c.append(content);

    let prices = ce(`div`,false,[`flex`,`r`])
    if(!i.sections) i.sections = [];
    i.sections.forEach(o=>prices.append(priceTag(o))) 
    c.append(prices)
    return c;
}

let cart = {}


function showCart(){
    // tg.showAlert(`еще не готово`)
    let p = preparePopup(`cart`)
        p.append(ce(`h2`,false,false,`Корзина`))
    Object.keys(cart).forEach(id=>{
        let cc = ce(`div`)
        cc.append(ce(`h3`,false,false,cart[id].name))
        p.append(cc)
        Object.keys(cart[id]).filter(k=>k!=`name`).forEach(oid=>{
            
            cc.append(priceLine(id,cart[id][oid].name,{
                id:         oid,
                price:      cart[id][oid].price,
                properties: cart[id][oid].properties
                // footage:    cart[id][oid].footage
            },true))
        })

        if(getSubTotal()){
            checkout()
        }
    })
    
}

function checkout(){
    let final = getSubTotal()
    
    if(final){
        tg.MainButton.offClick(showCart);
        setTimeout(()=>{
            tg.MainButton.setText(`Оформить покупку (${cur(final)})`)
            tg.MainButton.onClick(showCheckOut);
            tg.MainButton.show()
        },100)
        
    } else {
        tg.MainButton.hide()
    }
}

function handleSave(s) {

    let ctx = `Ура! Пожалуй, стоит обновить страницу.`

    if (s.data.hasOwnProperty('success')){
        try {
            tg.showAlert(`${s.data.comment || ''}` || ctx)
        } catch(err){
            alert(`${s.data.comment || ''}` || ctx)
        }
        
    } else {
        alert(ctx)
    }

    try{
        tg.MainButton.hideProgress()
        tg.MainButton.hide()
    } catch(err){
        console.log(err)
    }
}


function showCheckOut(){
    let p = preparePopup(`order`);
    p.append(ce(`h2`,false,false,cur(getSubTotal())))
    
    let userType = selector(`userTypes`,`Тип пользователя`,localStorage.userType,true);
    
    p.append(userType);
    
    let address = ce('input',false,false,false,{
        type:   `text`,
        name:   `address`,
        placeholder: `Адрес доставки`,
        value:  localStorage.address ? (localStorage.address == `null` ? null : localStorage.address) : null
    })
    p.append(address)
    
    let deliveryType =  selector(`deliveryTypes`,`Способ доставки`,null,true);
    
    p.append(deliveryType)

    p.append(ce(`button`,false,false,`Отправить заказ`,{
        onclick:function(){
            if(!userType.value) return      setWarning(userType,        `вы юридическое или физическое лицо?`)
            if(!address.value) return       setWarning(address,         `Кажется, вы пропустили адрес`)
            if(!deliveryType.value) return  setWarning(deliveryType,    `Вы пропустили тип доставки`)
            
                this.setAttribute(`disabled`,true)
            
            localStorage.address = address.value
            localStorage.userType = userType.value

            axios.post(`/${host}/api/order`,{
                cartId: curCart
            })
            .then(s=>{
                handleSave(s)
                axios.post(`/${host}/api/carts`).then(d=>{
                    curCart = d.data.id
                })
                cart = {};

                rescoreCart()
                document.querySelectorAll(`.popup`).forEach(i=>i.remove())
                
                showSettings()
            })
            .catch(handleError)
        }
    }))
}

function priceLine(itemId, itemName, option){
    let c = ce(`div`,false,`priceLine`)
    c.append(ce(`span`,false,`price`,(option.properties.map(p=>`${p.name}: ${p.value}`).join('<br>'))+'<br>Стоимость: '+cur(option.price)))
    // c.append(ce(`span`,false,false,(option.footage||'')+' '+cur(option.price)))
    
    let amount = ce(`span`,false,`cartAmount`,false,{
        dataset:{
            amount: (cart[itemId] && cart[itemId][option.id])?(cart[itemId][option.id].q||0):0
        }
    })
    let minus =ce(`span`,false,`cartRemove`,'-',{
        onclick:()=>{
            if(cart[itemId][option.id].q){
                showLoad();
                axios.put(`/${host}/api/cart/${curCart}`,{
                    product_id:     itemId,
                    section_id:     option.id,  
                    price:          option.price,
                    quantity:       1,
                    product_name:   option.name,
                    intention:      `delete`
                })
                .then(s=>{
                    hideLoad() 
                    cart[itemId][option.id].q --
                    amount.dataset.amount = cart[itemId][option.id].q
                    cart[itemId][option.id].total = cart[itemId][option.id].q*cart[itemId][option.id].price
                    
                    rescoreCart()
                }).catch(handleError)
                
            }
            
        }
    })
    
    let plus = ce(`span`,false,`cartAdd`,'+',{
        onclick:()=>{
            if(!cart[itemId]) cart[itemId] = {
                name: itemName,
                [option.id]: {
                    q:      0,
                    price:  +option.price,
                    total:  0,
                    name:           option.name,
                    properties:     option.properties
                }
            }
            if(!cart[itemId][option.id]){
                cart[itemId][option.id] ={
                    q:              0,
                    price:          +option.price,
                    total:          0,
                    name:           option.name,
                    properties:     option.properties
                } 
            }
            
            showLoad()

            axios.put(`/${host}/api/cart/${curCart}`,{
                product_id:     itemId,
                section_id:     option.id,  
                price:          option.price,
                quantity:       1,
                product_name:   option.name,
                intention: `add`

            }).then(s=>{
                
                hideLoad()

                cart[itemId][option.id].q ++
                amount.dataset.amount = cart[itemId][option.id].q
                cart[itemId][option.id].total = cart[itemId][option.id].q*cart[itemId][option.id].price
                rescoreCart()
            }).catch(handleError)

            
        }
    })
    let controls = ce(`div`,false,`bControls`)
        c.append(controls)
    controls.append(minus)
    controls.append(amount)
    controls.append(plus)
    
    // c.append(minus)
    // c.append(amount)
    // c.append(plus)
    return c
    
}

function getSubTotal(){
    return Object.keys(cart).reduce((a,b)=>a + Object.keys(cart[b]).filter(a=>a!=`name`).reduce((c,d)=>c+cart[b][d].total,0),0)
}

function rescoreCart(){

    let final = getSubTotal()
    
    if(document.querySelector(`[data-type="cart"]`)){
        showCart()
    } else {
        checkoutHeader.innerHTML = Object.keys(cart).length
        // if(final){
        //     tg.MainButton.setText(`Итого: ${cur(final)}`)
        //     tg.MainButton.onClick(showCart);
        //     tg.MainButton.show()
        // } else {
        //     tg.MainButton.hide()
        // }
    }
    
    
}


function priceTag(o){
    let c = ce(`div`,false,`priceTag`)
    c.append(ce(`span`,false,false,`${cur(o.price)}${o.footage?`/${o.footage}`:''}`))
    return c
}

function showItem(i){
    
    views.push(i);

    let c = preparePopup(i.id);
        userLoad(`items`,i.product_id || i.id).then(item=>{
            if(item.name){
                c.append(ce(`h2`,false,false,item.name))
                // c.append(ce(`img`,false,`cover`,false,{src: item.image}))
                
                let imgC = ce(`div`,false,`h40`)
                let scroll = ce(`div`,false,`scrollable`)
                
                item.gallery.forEach(pic=>{
                    scroll.append(ce(`img`,false,`bigPic`,false,{
                        src: pic
                    }))
                })

                imgC.append(scroll)
                c.append(imgC)

                if(item.description) c.append(ce(`p`, false, [`info`,`cut`], item.description,{
                    onclick:function(){
                        this.classList.toggle(`cut`)
                    }
                }))

                let prices = ce(`div`,false,`prices`)
                // item.options.sort((a,b)=>+a.price - +b.price).forEach(o=>prices.append(priceLine(i.id,item.name,o))) 

                let options =  item.options.map(o=>o.properties).flat();

                let optionCodes = [...new Set(options.map(o=>o.code))]

                let selected = {

                };

                let itemId = i.id;

                let option = {};

                let amount = ce(`span`,false,`cartAmount`,false,{
                    dataset:{
                        amount: (cart[itemId] &&cart[itemId][option.id])  ?(cart[itemId][option.id].q||0):0
                    }
                })
                let minus =ce(`span`,false,`cartRemove`,'-',{
                    onclick:()=>{
                        
                        if(Array.isArray(option)) option = option[0];
                        
                        if(cart[itemId][option.id].q){
                            showLoad();
                            axios.put(`/${host}/api/cart/${curCart}`,{
                                product_id:     itemId,
                                section_id:     option.id,  
                                price:          option.price,
                                quantity:       1,
                                product_name:   option.name,
                                intention:      `delete`
                            })
                            .then(s=>{
                                hideLoad() 
                                cart[itemId][option.id].q --
                                amount.dataset.amount = cart[itemId][option.id].q
                                cart[itemId][option.id].total = cart[itemId][option.id].q*cart[itemId][option.id].price
                                
                                rescoreCart()
                            }).catch(handleError)
                            
                        }
                        
                    }
                })
                
                let plus = ce(`span`,false,`cartAdd`,'+',{
                    onclick:()=>{
                        
                        console.log(option)
                        
                        if(Array.isArray(option)) option = option[0];

                        if(!cart[itemId]) cart[itemId] = {
                            name: option.name,
                            [option.id]: {
                                q:      0,
                                price:  +option.price,
                                total:  0,
                                properties: option.properties,
                                name: option.name
                            }
                        }
                        if(!cart[itemId][option.id]){
                            cart[itemId][option.id] ={
                                q:      0,
                                price:  +option.price,
                                total:  0,
                                properties: option.properties,
                                name: option.name
                            } 
                        }
                        
                        showLoad()
            
                        axios.put(`/${host}/api/cart/${curCart}`,{
                            product_id:     itemId,
                            section_id:     option.id,  
                            price:          option.price,
                            quantity:       1,
                            product_name:   option.name,
                            intention: `add`

                        }).then(s=>{
                            
                            hideLoad()
            
                            cart[itemId][option.id].q ++
                            amount.dataset.amount = cart[itemId][option.id].q
                            cart[itemId][option.id].total = cart[itemId][option.id].q*cart[itemId][option.id].price
                            rescoreCart()
                        }).catch(handleError)
            
                        
                    }
                })
                
                let toCartButton = ce(`div`,false,`bControls`,false,{
                    disabled:true
                })

                let prl = ce(`div`,false,`priceLine`,false,{
                    disabled:true
                })

                prl.setAttribute(`disabled`,true)
                
                let selectedItem  = ce(`span`,false,`price`)
                prl.append(selectedItem)
                prl.append(toCartButton)
                c.append(prl)
                
                toCartButton.append(minus)
                toCartButton.append(amount)
                toCartButton.append(plus)



                optionCodes.forEach(o=>{
                    
                    selected[o] = null;

                    let plausible = options.filter(option=>option.code == o);

                    console.log(plausible)
                    
                    let optionContainer = ce(`div`,false,false,false,{
                        dataset:{
                            code: o
                        }
                    })


                    optionContainer.append(ce('p',false,`info`,plausible[0].name))
                    
                    let unique = [...new Set(plausible.map(p=>p.value))]

                    console.log(unique)

                    unique.forEach(v=>{
                        
                        let po = plausible.filter(p=>p.value == v)[0];

                        optionContainer.append(ce(`span`,false,[`priceTag2`,`info`],po.value,{
                            dataset: {
                                options: item.options.filter(option=>option.properties.filter(p=>p.code == o).map(p=>p.value).indexOf(po.value)>-1).map(option=>option.id).join(',')
                            },
                            onclick:function(){

                                if(selected[o]){
                                    console.log(`уже был выбран`)
                                    if(selected[o] == po.value) {
                                        selected[o] = null
                                        console.log(`сняли`)
                                        // this.classList.remove()
                                    } else {
                                        selected[o] = po.value;
                                        this.parentNode.querySelector(`.selected`).classList.remove(`selected`)
                                    }
                                    
                                    
                                    // this.classList.add(`selected`)
                                } else {
                                    
                                    selected[o] = po.value;
                                }

                                    let availabe = item.options.filter(option=>{
                                        
                                        let t = {};
                                        
                                        option.properties.forEach(p=>{
                                            t[p.code] = p.value;
                                        })

                                        let pass = true;

                                        Object.keys(selected)
                                            .filter(key=> selected[key])
                                            .forEach(key=>{
                                                if(t[key] != selected[key]) pass = false;
                                            })

                                        return pass
                                    })

                                    if(availabe.length == 1){
                                        
                                        option = availabe[0];

                                        selectedItem.innerHTML = `${availabe[0].name} <br> ${cur(availabe[0].price)}/ед.`
                                        console.log(`опция всего одна`)
                                        prl.removeAttribute(`disabled`)
                                    } else {
                                        selectedItem.innerHTML = null;
                                        prl.setAttribute(`disabled`,true)
                                    }

                                    Object.keys(selected).filter(key => !selected[key]).forEach(key=>{
                                        prices.querySelector(`[data-code="${key}"]`).querySelectorAll(`.priceTag2`).forEach(tag=>{
                                            
                                            let pass = false;
                                            
                                            availabe.map(option=>option.id).forEach(id=>{
                                                if(tag.dataset.options.split(',').indexOf(id.toString())>-1) pass = true;
                                            })

                                            if(!pass) {
                                                tag.setAttribute(`disabled`,true)
                                            } else {
                                                tag.removeAttribute(`disabled`)
                                            }

                                            
                                        })
                                    })
                                

                                this.classList.toggle(`selected`);
                                console.log(selected)

                                if(this.dataset.options.split(',').length == 1){
                                    option = item.options.filter(o=>o.id == +this.dataset.options.split(',')[0])
                                    amount.dataset.amount = cart[itemId]?(cart[itemId][option.id].q||0):0
                                }                                
                            },
                            
                        }))
                    })
                    prices.append(optionContainer)

                })

                c.append(prices)
            } else {
                c.append(ce(`h2`,false,false,sudden.sad())) 
                c.append(ce(`p`,false,`info`,`Должно быть, за время пути товар успел подрасти...`))  
            }
            

            // c.append(ce(`p`,false,`info`,`А здесь было бы круто добавить "С этим товаром часто берут..."`))
        })
}

