

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
        let oid = Object.keys(o)[0];
        p.append(ce(`h1`,false,false,`Заказ №${oid}`))
        let goods = ce(`div`,false,`conatainer`)
        p.append(goods)
        o[oid].forEach(item=>{
            userLoad(`items`,item.product_id).then(i=>{

                console.log(i)

                if(i.name){
                    let c = ce(`div`,false,[`itemLine`,`sDivided`])
                    let content = ce(`div`,false,`flex`)
                        content.append(ce(`img`,false,`ava`,false,{src:i.image}))
                        content.append(ce(`p`,false,`ava`,i.name))
                    c.append(content)

                    let prices = ce(`div`,false,[`flex`,`r`])
                    
                    let needed = i.sections.filter(type => type.id == item.section_id)[0]

                    console.log(needed)

                    let priceTag = ce('div',false,`priceTag`)
                        priceTag.append(ce(`span`,false,false,`${item.total_quantity}: ${cur(+needed.price*item.total_quantity)}`))
                    prices.append(priceTag)
                    c.append(prices)
                    goods.append(c)
                }
                
            })
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

    // userLoad(`profile`).then(profile=>{
        
    //     profile = profile.user;

    //     let city = selector(`cities`,`Выберите город`,profile.city,true,[{
    //         name: `Другой`,
    //         value: `newCity`
    //     }])        

    //     city.onchange = ()=>{
    //         axios.put(`/${host}/api/profile/${profile.id}`,{
    //             attr: `city`,
    //             value: city.value
    //         }).then(()=>{
    //             document.querySelector(`#cityName`).innerHTML = cities[city.value] ? cities[city.value].name : `N-ск`;
    //             toast(`город обновлен`);
    //             if(city.value == `newCity`) tg.showAlert(`Издалека долго?.. Пожалуйста, напишите боту, в каком городе вы находитесь — мы обновим спраочник!.`)
    //             updateFresh()
    //         })
    //     }

    //     p.append(city)

    //     // p.append(ce(`p`,false,`info`,`Если вы не нашли свой город в списке — напишите об этом прямо в бот. Администрация постарается исправить ситуацию.`))

    //     p.append(ce(`input`,false,false,false,{
    //         placeholder: `Адрес`,
    //         type: `text`,
    //         name: `address`,
    //         value: profile.address || null,
    //         onchange:function(){
    //             if(this.value){
    //                 localStorage.address = this.value
    //                 axios.put(`/${host}/api/profile/${profile.id}`,{
    //                     attr: `address`,
    //                     value: this.value
    //                 }).then(()=>{
    //                     toast(`Адрес обновлен`)
    //                 })
    //             }
    //         }
    //     }))

    //     p.append(toggleCheckBox(`profile`,
    //         profile.id,
    //         `news`,
    //         profile.news,
    //         `Получать новости`,
    //         false,
    //         true
    //     ))

    //     p.append(toggleCheckBox(`profile`,
    //         profile.id,
    //         `public`,
    //         profile.public,
    //         `Публичный профиль`,
    //         false,
    //         true
    //     ))

    //     p.append(ce(`p`,false,`info`,`Идея и разработка:<br>Дмитрий Шестаков, @dimazvali.`,{
    //         onclick:()=>tg.openTelegramLink(`https://telegram.me/dimazvali`)
    //     }))
    // })
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
    c.append(ce(`h4`,false,false,`Заказ #${Object.keys(order)[0]}`))
    c.append(ce(`span`,false,[`info`,`mtopmin`],`создан ${drawDate(order.createdAt._seconds*1000)}`))
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

    console.log(length)

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


Promise
    .resolve(confirmed)
    .then(admin=>{

        console.log(`погнали`)
        
        // tg.requestWriteAccess();

        document.body.innerHTML = null;


        let c = ce(`div`,false,`mobile`)
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
            c.forEach(item=>{
                
                if(!cart[item.product_id]) cart[item.product_id] = {
                    name: item.product_name
                }

                if(!cart[item.product_id][item.section_id]) cart[item.product_id][item.section_id] = {
                    q:      item.total_quantity,
                    price:  +item.price,
                    total:  +item.total_quantity*+item.price
                }
            })
            if(c.length) rescoreCart()
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

        if(s.description) p.append(ce(`p`,false,[`info`,`cut`],p.description,{
            onclick:function(){
                this.classList.toggle(`cut`)
            }
        },true))

        if(s.sub.length){
            let list = ce(`div`,false,`container`)
            s.sub.forEach(l=>list.append(sectionLine(l)))
            p.append(list)
        } else if(s.items.length){
            let list = ce(`div`,false,`container`)
            s.items.forEach(l=>list.append(itemLine(l)))
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
            cc.append(priceLine(id,cart[id].name,{
                id: oid,
                price: cart[id][oid].price,
                footage:  cart[id][oid].footage
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

            axios.post(`/${host}/api/order`)
                .then(s=>{
                    handleSave(s)
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
    c.append(ce(`span`,false,false,(option.footage||'')+' '+cur(option.price)))
    // 
    let amount = ce(`span`,false,`cartAmount`,false,{
        dataset:{
            amount: cart[itemId]?(cart[itemId][option.id].q||0):0
        }
    })
    let minus =ce(`span`,false,`cartRemove`,'-',{
        onclick:()=>{
            if(cart[itemId][option.id].q){
                showLoad();
                axios.delete(`/${host}/api/cart?product_id=${itemId}&section_id=${option.id}`)
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
                    total:  0
                }
            }
            if(!cart[itemId][option.id]){
                cart[itemId][option.id] ={
                    q:      0,
                    price:  +option.price,
                    total:  0
                } 
            }
            
            showLoad()

            axios.post(`/${host}/api/cart`,{
                
                product_id:     itemId,
                section_id:     option.id,  
                price:          option.price,
                quantity:       1,
                product_name:   itemName
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
        if(final){
            tg.MainButton.setText(`Итого: ${cur(final)}`)
            tg.MainButton.onClick(showCart);
            tg.MainButton.show()
        } else {
            tg.MainButton.hide()
        }
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
                c.append(ce(`img`,false,`cover`,false,{src: item.image}))
                c.append(ce(`div`,false,`info`,item.description||''))

                let prices = ce(`div`,false,`prices`)
                item.sections.forEach(o=>prices.append(priceLine(i.id,item.name,o))) 
                c.append(prices)
            } else {
                c.append(ce(`h2`,false,false,sudden.sad())) 
                c.append(ce(`p`,false,`info`,`Должно быть, за время пути товар успел подрасти...`))  
            }
            

            // c.append(ce(`p`,false,`info`,`А здесь было бы круто добавить "С этим товаром часто берут..."`))
        })
}

