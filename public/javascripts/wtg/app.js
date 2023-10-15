
let tg = window.Telegram.WebApp;

let userid = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : userId

const host = `wtg`

let mbbc, mcb = null;


tg.MainButton.setParams({
    color: `#075B3F`
})


// загружаем юзера


function showBars(){
    showLoader()
    

    axios.get(`/${host}/api/rating/bars`)
        .then(bars=>{
            hideLoader()
            let p = preparePopup(`bars`)
                p.append(ce('h2',false,false,`Куда пойдем?`))
            bars.data.forEach(bar=>{
                let bc = ce('div',false,'divided')
                bc.append(ce('h3',false,false,bar.name,{
                    onclick: ()=>showBar(bar.id),
                    dataset: {
                        rating: bar.rating ? bar.rating : `без оценок`
                    }
                }))
                bc.append(ce(`span`,false,'info',bar.address))
                p.append(bc)
            })
        })
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

function preparePopup(type) {
    tg.BackButton.show();
    tg.onEvent('backButtonClicked', clearPopUp)

    if (document.querySelector(`[data-type="${type}"]`)) {
        document.querySelector(`[data-type="${type}"]`).remove()
    }

    mcb = clearPopUp
    let popup = ce('div', false, 'popup', false, {
        dataset: {
            type: type
        }
    })
    document.body.append(popup)
    let content = ce('div')
    popup.append(content)

    tg.MainButton.hide()
    return content
}

function userName(u,id){
    let uc = ce('span',false,['clickable','user'],`${u.first_name||''}${` ${u.last_name}`||''}`,{
        onclick:()=>{
            showUser(u.id||id)
        }
    })
    return uc
}

function showProfile(){
    axios.get(`/${host}/api/author/${userid}?id=${userid}`).then(u=>{
        hideLoader()
        let user = u.data
        let p = preparePopup(`user`)
            p.append(ce('h2',false,false,`Ваш профиль`))
            p.append(ce('span',false,false,`Регистрация: ${drawDate(user.createdAt._seconds*1000)}`))
            
            let hiddenL = ce('label',false,'block',`Скрытый профиль`)
            let hidden = ce('input',false,false,false,{
                type: `checkbox`,
                checked: user.hidden,
                onchange:function(){
                    axios.put(`/${host}/api/user/${userid}`,{
                        attr: `hidden`,
                        value: hidden.checked
                    }).then(()=>{
                        tg.showAlert(`Записано!`)
                    }).catch(handleError)
                }
            })
            hiddenL.append(hidden)
            
            p.append(hiddenL)
            
            if(user.desc) p.append(ce('p',false,'info',user.desc))
            if(user.achievements && user.achievements.length){
                p.append(ce('h3',false,false,`Награды и регалии`))
                user.achievements.forEach(a=>{
                    p.append(ce(`button`,false,false,a.name,{
                        onclick:()=>tg.showAlert(a.desc)
                    }))
                })
            }
            if(user.reviews && user.reviews.length){
                p.append(ce('h3',false,false,`Отзывы`))
                user.reviews.forEach(r=>{
                    let rc = ce('div',false,false,false,{
                        dataset:{
                            trusted: r.trusted
                        }
                    })
                    rc.append(ce('span',false,'info',drawDate(r.createdAt._seconds*1000)))
                    rc.append(ce('span',false,'clickable',` Бар ${r.barData.name}`,{
                        onclick:()=>showBar(r.bar)
                    }))
                    rc.append(ce(`p`,false,false,r.text))
                    p.append(rc)
                })
                p.append(ce(`button`,false,`big`,`Подписаться на новые отзывы`,{
                    onclick:()=>tg.showAlert(`Извините, функционал еще не готов.`)
                }))
                
            }
                  
    })

}

function showUser(id){
    if(id == userid) return showProfile();

    showLoader()
    
    axios.get(`/${host}/api/author/${id}?id=${userid}`).then(u=>{
        hideLoader()
        let user = u.data
        let p = preparePopup(`user`)
            p.append(ce('h2',false,false,`${user.first_name||''}${` ${user.last_name}`||''}`))
            p.append(ce('span',false,false,`Ходит с ${drawDate(user.createdAt._seconds*1000)}`))
            if(user.desc) p.append(ce('p',false,'info',user.desc))
            if(user.achievements && user.achievements.length){
                p.append(ce('h3',false,false,`Награды и регалии`))
                user.achievements.forEach(a=>{
                    p.append(ce(`button`,false,false,a.name,{
                        onclick:()=>tg.showAlert(a.desc)
                    }))
                })
            }
            if(user.reviews && user.reviews.length){
                p.append(ce('h3',false,false,`Отзывы`))
                user.reviews.forEach(r=>{
                    let rc = ce('div',false,false,false,{
                        dataset:{
                            trusted: r.trusted
                        }
                    })
                    rc.append(ce('span',false,'info',drawDate(r.createdAt._seconds*1000)))
                    rc.append(ce('span',false,'clickable',` Бар ${r.barData.name}`,{
                        onclick:()=>showBar(r.bar)
                    }))
                    rc.append(ce(`p`,false,false,r.text))
                    p.append(rc)
                })
                p.append(ce(`button`,false,`big`,`Подписаться на новые отзывы`,{
                    onclick:()=>tg.showAlert(`Извините, функционал еще не готов.`)
                }))
                
            }
                  
    })
}

function reviewLine(r){
    let rc = ce('div',false,false,false,{
        dataset:{
            trusted: r.trusted
        }
    })
        rc.append(ce('span',false,'info',drawDate(r.createdAt._seconds*1000)))
        rc.append(userName(r.userData))
        rc.append(ce(`p`,false,false,r.text))
    return rc
}

function sendMe(id){
    axios.get(`/${host}/api/sendMe/${id}?id=${userid}`).then(()=>{
        tg.showAlert(`Координаты придут сообщением в бот.`)
        tg.close()
    })
}

function showBar(id){
    
    let p  = preparePopup('bar')
    
    showLoader();

    axios.get(`/${host}/api/bars/${id}`).then(bar=>{
        bar = bar.data;
        hideLoader()
        p.append(ce('h2',false,false,bar.name))
        p.append(ce(`span`,false,'clickable',bar.address,{
            onclick:()=>{
                sendMe(id)
            }
        }))
        
        if(bar.rating) p.append(ce(`p`,false,false,`рейтинг: ${letterize(bar.rating,'балл')}`))

        if(bar.desc) p.append(ce(`p`,false,'info',bar.desc))

        p.append(ce('h3',false,false,`Отзывы`))

        if(bar.reviews.length) {
            
            bar.reviews.forEach(r=>{
                p.append(reviewLine(r))
            })
        }
        let review = ce('textarea',false,false,false,{
            placeholder: `Вам слово.`
        })

        p.append(review)

        p.append(ce('button',false,`big`,`Отправить`,{
            onclick:function(){
                if(!review.value) return tg.showAlert(`Я не вижу ваших букв!`)
                axios.post(`/${host}/api/review/${id}?id=${userid}`,{
                    review: review.value
                }).then(r=>{
                    if(r.data.success){
                        tg.showAlert(`Спасибо!`)
                        this.remove();
                        review.remove()
                        p.append(reviewLine(r.data.review))
                    } else {
                        tg.showAlert(r.data.comment)
                    }
                }).catch(handleError)
            }
        }))
        
        
    })
}

function showHistory(){
    axios.get(`/${host}/api/history/${userid}`).then(data=>{
        let p = preparePopup('history')
        p.append(ce('h2',false,false,'Необыкновенные похождения'))
        if(data.data.length){
            data.data.forEach(order => {
                let bc = ce('div',false,`divided`)
                    
                bc.append(ce('span',false,'info',drawDate(order.createdAt._seconds*1000,false,{time:true})))
                bc.append(ce('h3',false,false,order.barData.name,{
                    onclick:()=>showBar(order.bar)
                }))
                bc.append(ce('span',false,'info',order.barData.address))

                if(!order.rated){
                    let rc = ce('div',false,'ratingContainer')
                    let rating = 1;
                    while(rating<6){
                        let t = rating
                        rc.append(ce('button',false,false,rating,{
                            onclick:function(){
                                this.classList.add('active')
                                axios.post(`/${host}/api/rate/${order.id}?id=${userid}`,{
                                    rating: t
                                }).then(r=>{
                                    if(r.data.success) {
                                        tg.showAlert(`Спасибо!`)
                                    } else {
                                        tg.showAlert(r.data.comment)
                                    }
                                    rc.remove()
                                }).catch(handleError)
                            }
                        }))
                        rating++
                    }
                    bc.append(rc)
                } else {
                    bc.append(ce('p',false,false,`Вы оценили это посещение на ${letterize(order.rated,'балл')}.`))
                }

                p.append(bc)
            });
        } else {
            p.append(ce('p',false,`info`,`Кажется, вы еще не пользовались приложением. Давайте же исправим это недоразумение!`))
        }
    })
}

function hideLoader(){
    try{
        loader.classList.add('hide')
        setTimeout(function(){
            loader.remove()
        },300)
    }catch(err){

    }
    
}

axios.get(`/${host}/api/user/${userid}`).then(u => {
    console.log(u.data)

    if (u.data.admin) {
        links.prepend(ce('h1', false, `admin`, `Админка`, {
            onclick: () => window.location.href = `/${host}/admin`
        }))
    }
    if (u.data.bar) {
        links.prepend(ce('h1', false, `bar`, `Бар`, {
            onclick: () => window.location.href = `/${host}/bar`
        }))
    }

    if(u.data.blocked){
        tg.showAlert(`Извините, вам тут не рады`)
    } else {
        hideLoader()

        if(new Date(u.data.fest.from._seconds*1000)<new Date()){
            counter.innerHTML = `до завершения фестиваля остается ${Math.floor((+new Date(u.data.fest.till._seconds*1000) - +new Date())/(1000*60*60))} ч.`
        } else {
            counter.innerHTML = `до начала фестиваля остается ${Math.floor((+new Date(u.data.fest.from._seconds*1000) - +new Date())/(1000*60*60))} ч.`
        }
        if (u.data.ticket) {
            ticket.innerHTML = `<h2>Ваш билет</h2>`
            ticket.append(ce('img', false, `ticket`, false, {
                dataset: {
                    active: u.data.ticket.payed ? true : false,
                },
                src: `/${host}/qr?id=${u.data.ticket.id}&entity=tickets`
            }))
            if (u.data.ticket.payed) {
                ticket.append(ce(`p`, false, false, `У вас осталось ${u.data.ticket.left} бокалов`))
                ticket.append(ce(`button`, false, false, `Где вы были?..`, {
                    onclick: () => {
                        showHistory(u.data.ticket.id)
                    }
                }))
            } else {
                ticket.append(ce(`p`, false, false, `Ожидает оплаты.`))
            }
    
        } else {
            ticket.classList.add('selectable')
            ticket.onclick = function(){
                this.setAttribute(`disabled`, true)
                    axios.post(`/${host}/api/tickets/new`, {
                        user: userid
                    }).then(s => {
                        switch (s.data.success) {
                            case true: {
                                ticket.innerHTML = '';
                                ticket.append(ce('img', false, `ticket`, false, {
                                    dataset: {
                                        active: false
                                    },
                                    href: `/${host}/qr?id=${u.data.ticket.id}&entity=tickets`
                                }))
                                ticket.append(ce(`p`, false, false, `Ожидает оплаты.`))
                                
                                break;
                            }
                            case false:{
                                return tg.showAlert(s.data.comment)
                            }
                            default:{
                                this.removeAttribute('disabled')
                            }
                        } 
    
                    }).catch(err => {
                        tg.showAlert(err.message)
                    })
            }
            // ticket.append(ce('button', false, false, `Купить билет`, {
            //     onclick: function () {
            //         this.setAttribute(`disabled`, true)
            //         axios.post(`/${host}/api/tickets/new`, {
            //             user: userid
            //         }).then(s => {
            //             switch (s.data.success) {
            //                 case true: {
            //                     ticket.innerHTML = '';
            //                     ticket.append(ce('img', false, `ticket`, false, {
            //                         dataset: {
            //                             active: false
            //                         },
            //                         href: `/${host}/qr?id=${u.data.ticket.id}&entity=tickets`
            //                     }))
            //                     ticket.append(ce(`p`, false, false, `Ожидает оплаты.`))
            //                 }
            //                 case false:{
            //                     tg.showAlert(s.data.comment)
            //                 }
            //                 default:{
            //                     this.removeAttribute('disabled')
            //                 }
            //             } 
    
            //         }).catch(err => {
            //             tg.showAlert(err.message)
            //         })
            //     }
            // }))
        }
    }
    
}).catch(err => {
    console.log(err)
})