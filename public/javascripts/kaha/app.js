let tg =        window.Telegram.WebApp;
let userid =    tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : userId
let userLang =  tg.initDataUnsafe.user.language_code
let user = {};

let mbbc = null;

if(start){
    switch(start){
        case 'classes': {
            showSchedule(classes.querySelector('h2'))
            break;
        }
        case 'coworking': {
            showCoworking(coworking.querySelector('h2'))
            break;
        }
        case 'mr': {
            showMR(mr.querySelector('h2'))
            break;
        }
        case 'profile': {
            showProfile(profile.querySelector('h2'))
            break;
        }
    }
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

let curVolume = 5;

notes = null;

// tg.MainButton.setParams({
//     color:      `var(--tg-theme-bg-color)`,
//     text_color: `var(--tg-theme-button-text-color)`
// })



function mainButton(init){
    if(init){
        tg.MainButton.setParams({
            text: translations.loading[userLang] || translations.loading.en
        })
        tg.MainButton.show()
        tg.MainButton.showProgress()
    } else {
        tg.MainButton.hideProgress()
        tg.MainButton.hide()
        
    }
}

function showPeople(){
    axios.get('/kaha/api/users?admin='+userid).then(data=>{

        data = data.data;

        tg.BackButton.show();

        tg.onEvent('backButtonClicked',clearPopUp)
        
        mcb = clearPopUp

        let popup = ce('div','popup')
            document.body.append(popup)
        let content = ce('div')
            popup.append(content)

            content.append(ce('h2',false,false,'Клиенты'))
            content.append(ce('h3',false,false,`Всего: ${data.clients.length}`))

        data.clients.forEach(client=>{
            let c = ce('div',false,'client',false,{
                dataset:{
                    blocked:    client.blocked,
                    status:     client.status
                }
            })

            c.append(ce('h3',false,false,uname(client,client.id)))
            c.append(ce('span',false,'info',`Регистрация: ${drawDate(client.createdAt._seconds*1000)}`))
            c.append(ce('p',false,false,`Адрес: ${client.deliveryAddress || `Не указан`}`))
            c.append(ce('p',false,false,`Бар: ${client.barName || `Не указан`}`))

            content.append(c)
        })
    }).catch(err=>{
        tg.showAlert(`Что-то пошло не так`)
    })
}


function uname(u,id){
    return `${u.admin? `админ` : (u.insider ? 'сотрудник' : (u.fellow ? 'fellow' : (u.known ? 'гость' : 'пионер')))} ${u.username ? `@${u.username}` : `id ${id}` } (${u.first_name||''} ${u.last_name||''})`
}

function showOrderHistory(){
    axios.get('/kaha/api/orders?all=true&admin='+userid).then(data=>{

        data = data.data;

        tg.BackButton.show();

        tg.onEvent('backButtonClicked',clearPopUp)
        
        mcb = clearPopUp

        let popup = ce('div','popup')
            document.body.append(popup)
        let content = ce('div')
            popup.append(content)

            content.append(ce('h2',false,false,'История заказов'))

            content.append(ce('h3',false,false,`Объем: ${data.orders.reduce((a,b)=>a+Number(b.volume),0)}`))
            content.append(ce('h3',false,false,`Адресов: ${[... new Set(data.orders.map(o=>o.address))].length}`))

        data.orders.forEach(order=>{
            let user = data.users.filter(u=>u.id == order.user);
            let c = ce('div',false,'order',false,{
                dataset:{
                    active: order.active,
                    status: order.status
                }
            })
            
            c.append(ce('span',false,false,drawDate(order.createdAt._seconds*1000)))
            c.append(ce('p',false,false,order.volume+' л.'))
            c.append(ce('p',false,false,order.notes || 'без примечаний'))
            c.append(ce('p',false,false,order.address || 'без адреса'))
            c.append(ce('p',false,false,order.barName || 'без названия заведения'))
            c.append(ce('p',false,false,user.username))


            content.append(c)
        })
    }).catch(err=>{
        tg.showAlert(`Что-то пошло не так`)
    })
}

function showCurOrder(){
    axios.get('/kaha/api/orders?admin='+userid).then(data=>{

        data = data.data;

        tg.BackButton.show();

        tg.onEvent('backButtonClicked',clearPopUp)
        
        mcb = clearPopUp

        let popup = ce('div','popup')
            document.body.append(popup)
        let content = ce('div')
            popup.append(content)

            content.append(ce('h2',false,false,'В работе'))

            content.append(ce('h3',false,false,`Объем: ${data.orders.reduce((a,b)=>a+Number(b.volume),0)}`))
            content.append(ce('h3',false,false,`Адресов: ${[... new Set(data.orders.map(o=>o.address))].length}`))

        data.orders.forEach(order=>{
            let user = data.users.filter(u=>u.id == order.user);
            let c = ce('div',false,'order',false,{
                dataset:{
                    active: order.active
                }
            })
            
            c.append(ce('span',false,false,drawDate(order.createdAt._seconds*1000)))
            c.append(ce('p',false,false,order.volume+' л.'))
            c.append(ce('p',false,false,order.notes || 'без примечаний'))
            c.append(ce('p',false,false,order.address || 'без адреса'))
            c.append(ce('p',false,false,order.barName || 'без названия заведения'))
            c.append(ce('p',false,false,user.username))
            
            c.append(ce('button',false,'cancelButton',`Отменить заказ`,{
                onclick:function(){
                    let b = this;
                    tg.showConfirm(`Хотите удалить этот заказ?`,function(ok){
                        if(ok){
                            tg.MainButton.setText(`Секундочку`)
                            tg.MainButton.show()
                            tg.MainButton.showProgress()
                            axios.delete(`/kaha/api/order/${order.id}?user=${userid}&admin=true`)
                                .then(s=>{
                                    b.remove();
                                }).catch(err=>{
                                    tg.showAlert(err.message)
                                }).finally(()=>{
                                    tg.MainButton.hideProgress()
                                    tg.MainButton.hide()  
                                })
                        }
                    })
                }
            }))

            c.append(ce('button',false,false,`Заказ выдан`,{
                onclick:function(){
                    let b = this;
                    tg.showConfirm(`Заказ точно выдан?`,function(ok){
                        if(ok){
                            tg.MainButton.setText(`Секундочку`)
                            tg.MainButton.show()
                            tg.MainButton.showProgress()
                            axios.post(`/kaha/api/order/${order.id}?user=${userid}&admin=true`,{
                                status: 'completed',
                                active: false
                            })
                                .then(s=>{
                                    b.remove();
                                }).catch(err=>{
                                    tg.showAlert(err.message)
                                }).finally(()=>{
                                    tg.MainButton.hideProgress()
                                    tg.MainButton.hide()  
                                })
                        }
                    })
                }
            }))

            content.append(c)
        })
    }).catch(err=>{
        tg.showAlert(`Что-то пошло не так`)
    })
}



axios.get(`/kaha/api/user?id=${userid}`).then(u => {
    
    console.log(u.data)


    user = u.data;

    console.log(user)

    if(u.data.warning){
        
        if(u.data.warning == 'dataMissing') showProfile()
    }

    if(u.data.orders.length){
        starts.append(ce('h2',false,false,'Ваши заказы'))
        u.data.orders.forEach(o => {
            starts.append(ce('button',false,false,`${o.volume} л. (${cur(o.volume*11,'GEL')})`,{
                onclick:function(){
                    let b = this;
                    let order = o;
                    console.log(order,o)
                    tg.showConfirm(`Хотите удалить этот заказ?`,function(ok){
                        if(ok){
                            tg.MainButton.show()
                            tg.MainButton.showProgress()
                            axios.delete(`/kaha/api/order/${order.id}?user=${userid}`)
                                .then(s=>{
                                    b.remove();
                                }).catch(err=>{
                                    tg.showAlert(err.message)
                                }).finally(()=>{
                                    tg.MainButton.hideProgress()
                                    tg.MainButton.hide()
                                    
                                })
                        }
                    })
                }
            }))
        });
    }

    if(u.data.admin){
        
        let m = document.querySelector('.mobile')

        m.insertBefore(ce('h2',false,false,'Открыть админку',{
            onclick:()=>{
                // window.open(`http://t.me/alcoberbot/admin?admin=${}')
                m.innerHTML = '';
                m.append(ce('h2',false,false,'Текущий заказ',{
                    onclick: () => showCurOrder()
                }))

                m.append(ce('h2',false,false,'История заказов',{
                    onclick: () => showOrderHistory()
                }))

                m.append(ce('h2',false,false,'Клиенты',{
                    onclick:()=> showPeople()
                }))
            }
        }),m.querySelectorAll('div')[1]) 
        
    }

    deliveryAddress = user.deliveryAddress;
    barName = user.barName || null;

}).catch(err=>{
    console.log(err)
})


function handleError(err){
    tg.showAlert(err.message)
}



function order(){
    tg.BackButton.show();

    tg.onEvent('backButtonClicked',clearPopUp)
    
    mcb = clearPopUp

    let popup = ce('div','popup')
        document.body.append(popup)
    let content = ce('div')
        popup.append(content)

    content.append(ce('h2',false,false,'Мечем стаканы на стол'))

    // let price = ce('p',false,false,`Стоимость заказа: ${cur(curVolume*11,'GEL')}`)

    // content.append(price);

    let volume = ce('input',false,false,false,{
        placeholder: 'Укажите объем (от 5 литров)',
        type: 'number',
        value: 5,
        min: 5,
        onchange: function(){
            curVolume = this.value;
            tg.MainButton.setText(`Заказать (${cur(curVolume*11,'GEL')})`)
        } 
    })

    content.append(ce('p',false,false,'Сколько. Вешать. В литрах...'))
    content.append(volume)

    let address = ce('input',false,false,false,{
        placeholder: 'Укажите адрес доставки',
        value: user.deliveryAddress || null,
        oninput: function(){
            deliveryAddress = this.value
        } 
    })

    content.append(ce('p',false,false,'А куда везти?'))
    content.append(address)

    let bname = ce('input',false,false,false,{
        placeholder: translations.barName[userLang] || translations.barName.en,
        value: user.barName || null,
        oninput: function(){
            barName = this.value
        } 
    })

    content.append(ce('p',false,false,translations.barName[userLang] || translations.barName.en))
    content.append(bname)


    let notes = ce('textarea',false,false,false,{
        placeholder: translations.notesPlaceHolder[userLang] || translations.notesPlaceHolder.en,
        oninput: function(){
            notes = this.value
        } 
    })

    content.append(ce('p',false,false,translations.notes[userLang] || translations.notes.en))
    content.append(notes)

    tg.MainButton.setText(`Заказать`)
    tg.MainButton.show()
    tg.MainButton.onClick(book)
    mbbc = book
}

function orderList(){
    tg.BackButton.show();

    tg.onEvent('backButtonClicked',clearPopUp)
    
    mcb = clearPopUp

    let popup = ce('div','popup')
        document.body.append(popup)
    let content = ce('div')
        popup.append(content)

    content.append(ce('h2',false,'light',`История заказов`))

    let loader = ce('p',false,'info',`Кто прошлое помянет...`)
        content.append(loader)

    axios
        .get(`/kaha/api/userHistory?user=${userid}`)
        .then(data=>{
            if(data.data.success){
                content.append(ce('h3',false,false,`Объем: ${data.data.orders.filter(o=>o.status == 'completed').reduce((a,b)=>a+Number(b.volume),0)} л.`))

                data.data.orders.forEach(order=>{
                    let c = ce('div',false,'order',false,{
                        dataset:{
                            active: order.active,
                            status: order.status
                        }
                    })
                    c.append(ce('span',false,false,drawDate(order.createdAt._seconds*1000)))
                    c.append(ce('p',false,false,order.volume+' л.'))
                    content.append(c)
                })
            } else {
                tg.showAlert(data.data.comment)
            }
        }).catch(err=>{
            tg.showAlert(err.message)
        }).finally(()=>{
            loader.remove()
        })
}


function book(){
    
    tg.MainButton.showProgress()
    
    axios.post(`/kaha/api/order`,{
        user:               userid,
        volume:             curVolume,
        deliveryAddress:    deliveryAddress,
        barName:            barName,
        notes:              notes
    }).then(r=>{
        if(r.data.success){
            tg.showAlert('Ваш заказ принят. Перезагрузите приложение, чтобы увидеть его в списке')
            mcb = clearPopUp;
            clearPopUp()
        } else {
            tg.showAlert(r.data.comment)
        }
        
    }).catch(err=>{
        tg.showAlert(err.message)
    }).finally(()=>{
        tg.MainButton.hideProgress()
    })
    

    
}

function showContacts(el){
    
    tg.BackButton.show();

    tg.onEvent('backButtonClicked',clearPopUp)
    
    mcb = clearPopUp

    let popup = ce('div','popup')
        document.body.append(popup)
    let content = ce('div')
        popup.append(content)

    content.append(ce('h3',false,'light',`Адрес`,{
        onclick:()=>{
            axios.post('/kaha/sendMe/address',{
                user: userid
            })
            tg.close()
        }
    }))

    content.append(ce('p',false,'story',`Некий Адрес`,{
        onclick:()=>{
            axios.post('/kaha/sendMe/address',{
                user: userid
            })
            tg.close()
        }
    }))

    content.append(ce('h3',false,'light','Разработка',{
        onclick:()=>tg.openTelegramLink(`https://t.me/dimazvali`)
    }))
    content.append(ce('p',false,'story','Dmitry Shestakov',{
        onclick:()=>tg.openTelegramLink(`https://t.me/dimazvali`)
    }))
    
}


function clearPopUp(){
    let p = document.querySelector('#popup')
    p.classList.add('sb')
    setTimeout(function(){
        p.remove()
        tg.BackButton.hide()
        
    },500)
    if(mcb){
        tg.MainButton.offClick(mcb)
        mcb = null;
        tg.MainButton.hide()
    }

    if(mbbc){
        tg.MainButton.hide()
        tg.MainButton.offClick(mbbc)
        mbbc = null
    }
}

function showProfile(el){

    tg.BackButton.show();

    tg.onEvent('backButtonClicked',clearPopUp)
    
    mcb = clearPopUp

    let popup = ce('div','popup')
        document.body.append(popup)
    let content = ce('div')
        popup.append(content)

    content.append(ce('h2',false,'light',translations.profile[userLang]||translations.profile.en))

    content.append(ce('p',false,'info',translations.profileSubTitle[userLang]||translations.profileSubTitle.en))

    let loader = ce('p',false,false,translations.loading[userLang]||translations.loading.en)

    content.append(loader)
    
    mainButton(true)
    
    axios
        .get(`/kaha/api/userData?user=${userid}`)
        .then(d=>{
            
            loader.remove()

            // Object.keys(d.data).forEach(key=>{
            //     content.append(ce('p',false,false, JSON.stringify(d.data[key])))
            // })

            let ud = d.data;

            content.append(ce('input',false,'hollow',false,{
                placeholder: translations.name[userLang] || translations.name.en,
                value: ud.first_name || null,
                onchange:function(){
                    if(this.value) axios.put(`/kaha/api/profile/${userid}`,{
                        first_name: this.value
                    }).then(s=>{
                        // tg.showAlert(translations.saved[userLang] || translations.saved.en)
                    })
                }
            }))
            

            content.append(ce('input',false,'hollow',false,{
                placeholder: translations.sname[userLang] || translations.sname.en,
                value: ud.last_name || null,
                onchange:function(){
                    if(this.value) axios.put(`/kaha/api/profile/${userid}`,{
                        last_name: this.value
                    })
                }
            }))

            content.append(ce('textarea',false,'hollow',false,{
                placeholder: translations.about[userLang] || translations.about.en,
                value: ud.about || null,
                onchange:function(){
                    if(this.value) axios.put(`/kaha/api/profile/${userid}`,{
                        about: this.value
                    })
                }
            }))

            content.append(ce('textarea',false,'hollow',false,{
                placeholder: translations.deliveryAddress[userLang] || translations.deliveryAddress.en,
                value: ud.deliveryAddress || null,
                onchange:function(){
                    if(this.value) axios.put(`/kaha/api/profile/${userid}`,{
                        deliveryAddress: this.value
                    })
                }
            }))

            content.append(ce('textarea',false,'hollow',false,{
                placeholder: translations.barName[userLang] || translations.barName.en,
                value: ud.barName || null,
                onchange:function(){
                    if(this.value) axios.put(`/kaha/api/profile/${userid}`,{
                        barName: this.value
                    })
                }
            }))



            content.append(ce('button',false,'dateButton',translations.save[userLang] || translations.save.en,{
                onclick:()=>{
                    mcb = clearPopUp;
                    clearPopUp()
                }
            }))

            


        }).catch(err=>{
            handleError
        }).finally(()=>{
            mainButton(false)
        })

}