
let tg = window.Telegram.WebApp;
let userid = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : userId
let mbbc, mcb = null;
let host = `wtg`
let curBar = null;
let user = {}

axios.get(`/${host}/bar/check?id=${userid}`).then(s=>{
    loader.classList.remove('active')
    setTimeout(()=>{
        loader.remove()
        showIndex(s.data)
    },300)
}).catch(err=>{
    tg.showAlert(err.data)
})

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

function uname(u,id){
    return `${u.admin? `админ` : (u.bar ? 'бармен' : 'гость')} ${u.username ? `@${u.username}` : `id ${id}` } (${u.first_name||''} ${u.last_name||''})`
}

function tryQR(id){
    tg.showScanQrPopup({
        text: `Наведите камеру на QR-код гостя`
    })
    tg.onEvent(`qrTextReceived`,checkQR)
}



function showIndex(data){
    if(!data.bars.length){
        startc.append(ce('p',false,false,`Извините, у вас нет активных доступов ни к одному заведению. Чтобы запросить его, просто напишите о себе боту.`))
    } else if (data.bars.length == 1) {
        startc.append(ce('h2',false,false,data.bars[0].name))
        showStart(data.bars[0].id)
        curBar = data.bars[0].id
    } else {
        data.bars.forEach(b=>{
            startc.append(ce('button',false,'big',b.name,{
                onclick:()=>{
                    showStart(b.id)
                    curBar = b.id
                }
            }))
        })
    }
}


function showLogs(id){
    showLoader();
    axios.get(`/${host}/bar/logs?id=${userid}&bar=${id}`)
    .then(data=>{
        let p = preparePopup(`logs`)
        p.append(ce('h1',false,false,'Логи'))
        data.data.forEach(record => {
            p.append(ce('span',false,'info',new Date(record.createdAt._seconds*1000).toLocaleString()))
            p.append(ce('p',false,false,record.text))
        });
    })
    .catch(handleError)
    .finally(()=>{
        hideLoader()
    })
}


function showStart(id){
    
    let b = content;
    
    b.innerHTML = null;

    b.append(ce('h3',false,false,`Налить`,{
        onclick:()=>tryQR(id)
    }))

    b.append(ce('h3',false,false,`Что нового`,{
        onclick:()=>showLogs(id)
    }))
    
    b.append(ce('h3',false,false,`Коллеги`,{
        onclick:()=>showPartners(id)
    }))

    b.append(ce('h3',false,false,`Доходы`,{
        onclick:()=>showIncomes(id)
    }))

}

function handleError(err){
    tg.showAlert(err.data || err.message)
}

function showIncomes(id){
    let p = preparePopup('incomes')
        p.append(ce('h2',false,false,'Доходы'))
    axios.get(`/${host}/bar/bars/${id}?id=${userid}&int=incomes`).then(data=>{
        if(data.data.length){
            p.append(ce('h4',false,'alter',cur(data.data.reduce((a,b)=>a+b.revenue,0),"GEL")))
            p.append(ce('button',false,false,`Подробнее`,{
                onclick:function(){
                    data.data.forEach(o=>{
                        p.append(ce('p',false,'info',`${drawDate(o.createdAt._seconds*1000)}: ${cur(o.revenue,"GEL")}`))
                    })
                    this.remove()
                }
            }))
        } else {
            p.append(ce('p',false,'info','Заказов еще не было'))
        }
    })
}

function showPartners(id){
    let p = preparePopup(`partners`)
        p.append(ce('h2',false,false,`Ваши коллеги`))

        let invite = ce('div')
            invite.append(ce('img',false,false,false,{
                src: `/${host}/qr?type=barInvite&bar=${id}&by=${userid}`
            }))
            invite.append(ce('p',false,'info',`Попросите коллег просканировать этот код — и они добавятся автоматически.`))
        
        p.append(invite)

        axios.get(`/${host}/bar/bars/${id}?id=${userid}&int=users`).then(data=>{
            data.data.sort((a,b)=>b.active>a.active?-1:1).forEach(u=>{
                let uc = ce('div',false,'divided',false,{
                    active: u.active
                })
                uc.append(ce('p',false,'info',uname(u,u.id)))
                p.append(uc)
                if(u.active){
                    uc.append(ce(`button`,false,false,'Снять доступ',{
                        onclick:function(){
                            axios.delete(`/${host}/bar/users/${u.access}?id=${userid}`)
                                .then(()=>{
                                    tg.showAlert(`ok`)
                                    this.remove()
                                }).catch(handleError)
                        }
                    }))
                } else {
                    uc.append(ce(`button`,false,false,'Снять доступ',{
                        onclick:function(){
                            axios.put(`/${host}/bar/users/${u.access}?id=${userid}`,{
                                attr: 'active',
                                value: true
                            }).then(()=>{
                                tg.showAlert(`ok`)
                                this.remove()
                            }).catch(handleError)
                        }
                    }))
                }
            })
        }).catch(handleError)
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



function addNewBar(){
    let p = preparePopup('newBar')
        p.append(ce('h2',false,false,`Добавляем новый бар`))
        let name = ce('input',false,false,false,{
            placeholder: 'Название'
        })
        let address = ce('input',false,false,false,{
            placeholder: 'Адрес'
        })
        let lat = ce('input',false,false,false,{
            placeholder: 'Широта'
        })
        let lng = ce('input',false,false,false,{
            placeholder: 'Долгота'
        })
        let desc = ce('textarea',false,false,false,{
            placeholder: `Описание`
        })

        p.append(name)
        p.append(address)
        p.append(lat)
        p.append(lng)
        p.append(desc)

        p.append(ce('button',false,false,`Сохранить`,{
            onclick: function(){
                this.setAttribute('disabled',true)
                axios.post(`/${host}/bar/bars?id=${userid}`,{
                    name:       name.value,
                    address:    address.value,
                    lat:        lat.value,
                    lng:        lng.value,
                    desc:       desc.value
                }).then(r=>{
                    if(r.data.success){
                        tg.showAlert(`Бар создан. Чтобы уведеть его, откройте список баров заново`)
                        name.value = null;
                        address.value = null;
                        lat.value = null;
                        lng.value = null;
                        desc.value = null;
                    } else {
                        tg.showAlert(r.data.comment)
                    }
                }).catch(handleError)
                .finally(()=>{
                    this.removeAttribute('disabled')
                })
            }
        }))

}

function showBars(){
    
    let p = preparePopup(`bars`);

    showLoader();

    p.append(ce('button',false,`big`,`Добавить площадку`,{
        onclick:()=>addNewBar()
    }))

    axios.get(`/${host}/bar/bars?id=${userid}`).then(data=>{
        data.data.forEach(bar=>{
            p.append(barButton(bar))
        })
        hideLoader()
    })
}

function barButton(bar){
    let bc = ce('div',false,`divided`,false,{
        dataset:{
            active: bar.active
        }
    })
        bc.append(ce('h3',false,false,bar.name))
        bc.append(ce('p',false,'info',bar.address))

        bc.append(ce('button',false,false,`Подробнее`,{
            onclick:()=>{
                let p = preparePopup(`bar`)
                    p.append(ce('h2',false,false,bar.name))
                    p.append(ce('p',false,'info',bar.address))
                    p.append(ce('p',false,'info',bar.description))
                    
                    let invite = ce('div')
                            invite.append(ce('img',false,false,false,{
                                src: `/${host}/qr?type=barInvite&bar=${bar.id}&by=${userid}`
                            }))
                        p.append(invite)

                    axios.get(`/${host}/bar/bars/${bar.id}?id=${userid}`).then(d=>{
                        let users = ce('div',false,'divided')
                            users.append(ce('h3',false,false,`Сотрудники`))
                        if(d.data.users.length){
                            d.data.users.forEach(u=>{
                                users.append(ce('p',false,false,uname(u,u.id)))
                            })
                        } else {
                            users.append(ce('p',false,'info',`Ни один сотрудник не зарегистрирован`))
                        }
                        p.append(users)

                        let incomes = ce('div',false,`divided`)
                            incomes.append(ce('h3',false,false,'Доходы'))
                            if(d.data.orders.length){
                                incomes.append(ce('h4',false,'alter',cur(d.data.orders.reduce((a,b)=>a+b.revenue,0),"GEL")))
                                incomes.append(ce('button',false,false,`Подробнее`,{
                                    onclick:function(){
                                        d.data.orders.forEach(o=>{
                                            incomes.append(ce('p',false,'info',`${drawDate(o.createdAt._seconds*1000)}: ${cur(o.revenue,"GEL")}`))
                                        })
                                        this.remove()
                                    }
                                }))
                            } else {
                                incomes.append(ce('p',false,'info','Заказов еще не было'))
                            }
                        p.append(incomes)

                        if(bar.active){
                            p.append(ce('button',false,`big`,`Деактивировать бар`,{
                                onclick:function(){
                                    this.setAttribute(`disabled`,true)
                                    axios.delete(`/${host}/bar/bars/${bar.id}?id=${userid}`)
                                        .then(s=>{
                                            bc.dataset.active = false;
                                            this.remove
                                        })
                                }
                            }))
                        } else {
                            p.append(ce('button',false,`big`,`Деактивировать бар`,{
                                onclick:function(){
                                    this.setAttribute(`disabled`,true)
                                    axios.put(`/${host}/bar/bars/${bar.id}?id=${userid}`,{
                                        attr: 'active',
                                        value: true
                                    }).then(s=>{
                                        bc.dataset.active = true;
                                        this.remove;
                                    })
                                }
                            }))
                        }
                        
                    })
                    
            }
        }))
    return bc;
}

function drawDate(d,l,o){
    let options = {
        weekday: 'short',
        month: 'short',
        day:'2-digit',
        timeZone: 'Asia/Tbilisi'
    }
    if(!o) o = {}
    if(o.time){
        options.hour= '2-digit',
        options.minute= '2-digit'
    }
    if(o.year) options.year = '2-digit'
    
    return new Date(d).toLocaleDateString(`${l||'ru'}-RU`,options)
}

function showFests(){
    
    showLoader()
    let p = preparePopup(`fests`)
    
    axios.get(`/${host}/bar/fests?id=${userid}`)
        .then(data=>{
            data.data.forEach(f=>{
                let fc = ce('div',false,'divided')
                    fc.append(ce('span',false,'info',drawDate(f.createdAt._seconds*1000)))
                p.append(fc)
            })
        })
}

function checkQR(data){
    
    tg.closeScanQrPopup()

    let inc = data.data.split('_')

    // tg.showAlert(inc[1])

    if(data.data.split('_')[1] != 'tickets'){
        return tg.showAlert(`Я так не играю. Это не входной билет: ${data.data}`)
    }

    showLoader()

    axios.get(`/${host}/bar/qr?id=${userid}&data=${data.data}`)
        .then(r=>{

            r = r.data.data;

            let p = preparePopup(`qr`)

            if(r.active){
                if(r.payed){
                    if(r.left){
                        p.append(ce('h2',false,false,`Можно лить!`))
                        p.append(ce('p',false,'info','Обязательно нажмите на кнопку ниже при выдаче напитка, иначе он не появится на вашем счету.'))
                        p.append(ce('button',false,`big`,`Бокал налит!`,{
                            onclick:function(){
                                this.setAttribute(`disabled`,true)
                                axios.post(`/${host}/bar/ticket/${inc[0]}?bar=${curBar}&id=${userid}`)
                                    .then(r=>{
                                        if(r.data.success) {
                                            tg.showAlert(`Налито!`)
                                        } else {
                                            tg.showAlert(`${r.data.comment}. Тут что-то нечисто, обратитесь в службу поддержки.`)
                                        }
                                    })
                            }
                        }))
                    } else {
                        p.append(ce('h2',false,false,`Билет выпит до конца.`))
                    }
                } else {
                    p.append(ce('h2',false,false,`Билет не оплачен.`))
                }
            } else {
                p.append(ce('h2',false,false,`Билет заблокирован.`))
            }
                

        })
        .catch(handleError)
        .finally(hideLoader)
}


function showLoader(){
    document.body.append(ce('div','loader'))
}

function hideLoader(){
    document.querySelector('#loader').remove()
}
