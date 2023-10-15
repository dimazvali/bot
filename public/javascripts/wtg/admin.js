
let tg = window.Telegram.WebApp;
let userid = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : userId
let mbbc, mcb = null;
let host = `wtg`
axios.get(`/${host}/admin/check?id=${userid}`).then(s=>{
    loader.classList.remove('active')
    setTimeout(()=>{
        loader.remove()
        showStart()
    },300)
}).catch(err=>{
    tg.showAlert(err.data)
})


function showLogs(){
    showLoader();
    axios.get(`/${host}/admin/logs?id=${userid}`)
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

function tryQR(){
    tg.showScanQrPopup({
        text: `Наведите камеру на QR-код гостя`
    })
    tg.onEvent(`qrTextReceived`,checkQR)
}


function showStart(){
    let b = document.body;
    

    b.append(ce('h2',false,false,`Проверить код`,{
        onclick:()=>tryQR()
    }))

    b.append(ce('h2',false,false,`Пользователи`,{
        onclick:()=>showUsers()
    }))

    b.append(ce('h2',false,false,`Билеты`,{
        onclick:()=>showTickets()
    }))

    b.append(ce('h2',false,false,`Что нового`,{
        onclick:()=>showLogs()
    }))

    b.append(ce('h2',false,false,`Бары`,{
        onclick:()=>showBars()
    }))

    b.append(ce('h2',false,false,`Фестивали`,{
        onclick:()=>showFests()
    }))

    b.append(ce('h2',false,false,`Достижения`,{
        onclick:()=>showAchievements()
    }))

}

function showAchievements(){
    let p = preparePopup(`achievements`)
    p.append(ce('h2',false,false,'Достижения'))
    p.append(ce('button',false,'big',`Добавить`,{
        onclick:()=>{
            let ac = ce('div')
                let name = ce('input',false,false,false,{placeholder:`название`})
                let desc = ce('textarea',false,false,false,{placeholder:`описание`})
                let save = ce('button',false,false,`Сохранить`,{
                    onclick:()=>{
                        if(name.value&&desc.value){
                            axios
                                .post(`/${host}/admin/achievements?id=${userid}`,{
                                    name: name.value,
                                    desc: desc.value
                                }).then(s=>{
                                    tg.showAlert(`ok`)
                                    ac.remove()
                                }).catch(handleError)
                        }
                    }
                })
                ac.append(name)
                ac.append(desc)
                ac.append(save)
                p.insertBefore(ac,p.querySelector(`button`))
        }
    }))
    axios.get(`/${host}/admin/achievements?id=${userid}`).then(data=>{
        data.data.forEach(a=>{
            p.append(ce('span',false,'info',`создано ${a.createdBy} ${drawDate(a.createdAt._seconds*1000)}`))
            p.append(ce(`button`,false,`big`,a.name,{
                onclick:()=>tg.showAlert(a.desc)
            }))
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

function showUserData(type,container,user){
    showLoader()
    axios.get(`/${host}/admin/user?id=${userid}&data=${type}&user=${user}`)
    .then(data=>{
        if(container.querySelector('#details')){
            container.querySelector('#details').remove()
        }
        let details = ce('div','details')
        container.append(details)
        data.data.forEach(line=>{
            details.append(drawUserLine(type, line))
        })

        if(!data.data.length) tg.showAlert(`Извините, тут пусто`)
    })
    .catch(handleError)
    .finally(hideLoader)
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
                axios.post(`/${host}/admin/bars?id=${userid}`,{
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

    axios.get(`/${host}/admin/bars?id=${userid}`).then(data=>{
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

                    axios.get(`/${host}/admin/bars/${bar.id}?id=${userid}`).then(d=>{
                        let users = ce('div',false,'divided')
                            users.append(ce('h3',false,false,`Сотрудники`))
                        if(d.data.users.length){
                            d.data.users.forEach(u=>{
                                users.append(ce('p',false,false,uname(u,u.id)))
                            })
                            let message = ce('textarea',false,false,false,{
                                placeholder: `Хотите что-то написать сотрудникам?`
                            })
                            users.append(message)
                            users.append(ce('button',false,'block','Отправить',{
                                onclick:function(){
                                    if(message.value){
                                        axios.post(`/${host}/admin/message?id=${userid}`,{
                                            list:   true,
                                            filter: `barsUsers`,
                                            value:  bar.id
                                        }).then(r=>{
                                            tg.showAlert(`Отправлено`)
                                            message.value = null;
                                        }).catch(handleError)
                                        .finally(()=>this.removeAttribute(`disabled`))
                                    }
                                }
                            }))
                        } else {
                            users.append(ce('p',false,'info',`Ни один сотрудник не зарегистрирован`))
                        }
                        p.append(users)

                        let incomes = ce('div',false,`divided`)
                            incomes.append(ce('h3',false,false,'Доходы'))
                            if(d.data.orders.length){
                                incomes.append(ce('h4',false,'alter',cur(d.data.orders.reduce((a,b)=>a+b.revenue,0))))
                                incomes.append(ce('button',false,false,`Подробнее`,{
                                    onclick:function(){
                                        d.data.orders.forEach(o=>{
                                            incomes.append(ce('p',false,'info',`${drawDate(o.createdAt._seconds*1000)}: ${cur(o.revenue)}`))
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
                                    axios.delete(`/${host}/admin/bars/${bar.id}?id=${userid}`)
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
                                    axios.put(`/${host}/admin/bars/${bar.id}?id=${userid}`,{
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

function showUsers(){
    showLoader();
    axios.get(`/${host}/admin/users?id=${userid}`)
    .then(data=>{
        let p = preparePopup(`users`)
        p.append(ce('h1',false,false,'Гости'))

        p.append(ce('p',false,'info',`всего ${data.data.length} юзеров`))


        let cc = ce('div')
        
        p.append(cc)

        cc.append(ce('button',false,'active','все',{
            onclick: function(){
                filterUsers(false,p,this)
            }
        }))

        cc.append(ce('button',false,'passive','только админы',{
            onclick: function(){
                filterUsers('admin',p,this)
            }
        }))

        cc.append(ce('button',false,'passive','только бармены',{
            onclick: function(){
                filterUsers('bar',p,this)
            }
        }))

        cc.append(ce('input',false,false,false,{
            placeholder: `поиск по имени`,
            oninput:function(){
                if(!this.value){
                    p.querySelectorAll('.divided').forEach(u=>u.classList.remove('hidden'))
                } else {
                    p.querySelectorAll('.divided').forEach(u=>{
                        if(u.innerHTML.indexOf(this.value)>-1){
                            u.classList.remove('hidden')
                        } else {
                            u.classList.add('hidden')
                        }
                    })
                }
            }
        }))

        data.data.forEach(record => {
            let c = ce('div',false,'divided',false,{
                dataset:{
                    active:     record.active,
                    id:         record.id,
                    admin:      record.admin || null,
                    bar:        record.bar || null
                }
            })

            c.append(ce('span',false,'info',`${new Date(record.createdAt._seconds*1000).toLocaleString()}, (${record.language_code})${record.admin?`, админ`: (record.insider?', сотрудник':'')}`,{
                dataset:{
                    ctx: `регистрация: `
                }
            }))

            c.append(ce('p',false,false,`${record.username ? `@${record.username}` : 'Без ника'} // ${record.first_name || 'Без имени'} ${record.last_name || 'Без фамилии'}`,{
                onclick:()=>{
                    tg.openTelegramLink(`https://t.me/${record.username}`)
                }
            }))
            
            let controls = ce('div',false,'hidden')
            
            c.append(ce('button',false,false,'подробнее',{
                onclick:function(){
                    this.remove()
                    controls.classList.remove(`hidden`)
                }
            }))

            c.append(controls)

            controls.append(ce('button',false,false,'Переписка',{
                onclick:()=>{
                    showUserData('messages',c,record.id)
                }
            }))

            if(!record.admin) {
                controls.append(ce('button',false,false,'Сделать админом',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/${host}/admin/users?id=${userid}`,{
                                field: 'admin',
                                value: true,
                                user: record.id
                            }).then(()=>{
                                tg.showAlert(`Сделано!\nЧтобы увидеть обновление, перезагрузите окно.`)
                            }).catch(handleError)
                        }
                    }
                }))
            } else {
                controls.append(ce('button',false,false,'Снять админские права',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/${host}/admin/users?id=${userid}`,{
                                field: 'admin',
                                value: false,
                                user: record.id
                            }).then(()=>{
                                tg.showAlert(`Сделано!\nЧтобы увидеть обновление, перезагрузите окно.`)
                            }).catch(handleError)
                        }
                    }
                }))
            }

            if(!record.bar) {
                controls.append(ce('button',false,false,'Сделать барменом',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/${host}/admin/users?id=${userid}`,{
                                field: 'bar',
                                value: true,
                                user: record.id
                            }).then(()=>{
                                tg.showAlert(`Сделано!\nЧтобы увидеть обновление, перезагрузите окно.`)
                            }).catch(handleError)
                        }
                    }
                }))
            } else {
                controls.append(ce('button',false,false,'Разделать барменом',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/${host}/admin/users?id=${userid}`,{
                                field: 'bar',
                                value: false,
                                user: record.id
                            }).then(()=>{
                                tg.showAlert(`Сделано!\nЧтобы увидеть обновление, перезагрузите окно.`)
                            }).catch(handleError)
                        }
                    }
                }))
            }

            if(!record.blocked) {
                controls.append(ce('button',false,false,'Заблокировать',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/${host}/admin/users?id=${userid}`,{
                                field: 'blocked',
                                value: true,
                                user: record.id
                            }).then(()=>{
                                tg.showAlert(`Сделано!\nЧтобы увидеть обновление, перезагрузите окно.`)
                            }).catch(handleError)
                        }
                    }
                }))
            } else {
                controls.append(ce('button',false,false,'Снять бан',{
                    onclick:function(){
                        let sure = confirm('Вы уверены?')
                        if(sure){
                            axios.post(`/${host}/admin/users?id=${userid}`,{
                                field: 'blocked',
                                value: false,
                                user: record.id
                            }).then(()=>{
                                tg.showAlert(`Сделано!\nЧтобы увидеть обновление, перезагрузите окно.`)
                            }).catch(handleError)
                        }
                    }
                }))
            }

            let message = ce('textarea',false,'hidden',false,{placeholder: `Вам слово`})
            c.append(message)
            let sendButton = ce('button',false,'hidden','Отправить',{
                onclick:function(){
                    if(!message.value) return tg.showAlert(`Я не вижу ваших букв!`)
                    this.setAttribute('disabled',true)
                    axios.post(`/${host}/admin/message?id=${userid}`,{
                        text: message.value,
                        user: record.id
                    }).then(()=>{
                        tg.showAlert(`Сообщение отправлено`)
                        message.value = null;
                    }).catch(err=>{
                        tg.showAlert(err.message)
                    }).finally(()=>{
                        this.removeAttribute('disabled')
                    })
                }
            })
            c.append(sendButton)

            c.append(ce('button',false,false,'Написать',{
                onclick:function(){
                    this.remove();
                    message.classList.remove('hidden')
                    sendButton.classList.remove('hidden')
                }
            }))

            c.append(ce('button',false,false,`Ачивки`,{
                onclick:()=>{
                    axios.get(`/${host}/admin/user?id=${userid}&user=${record.id}&data=achievements`)
                        .then(a=>{
                            a.data.forEach(a=>{
                                c.append(ce('button',false,false,a.name,{
                                    onclick:()=>tg.showAlert(a.desc)
                                }))
                            })

                            axios.get(`/${host}/admin/achievements?id=${userid}`).then(a=>{
                                c.append(ce(`h4`,false,false,'Добавить ачивку'))
                                a.data.forEach(a=>{
                                    c.append(ce('button',false,`big`,a.name,{
                                        onclick:()=>{
                                            axios.post(`/${host}/admin/achievements/${a.id}?id=${userid}`,{
                                                user:record.id
                                            })
                                        }
                                    }))
                                })
                            })
                        })
                }
            }))

            
                
            p.append(c)
        });
    })
    .catch(handleError)
    .finally(()=>{
        hideLoader()
    })
}




function showFests(){
    
    showLoader()
    let p = preparePopup(`fests`)
    p.append(ce('button',false,'big',`Назначить новый`,{
        onclick:()=>{
            let p = preparePopup(`fest`)
                p.append(ce('h2',false,false,`Новое событие`))
                
                let from = ce('input',false,false,false,{
                    type: `datetime-local`
                })

                let till = ce('input',false,false,false,{
                    type: `datetime-local`
                })
                
                p.append(ce('p',false,'info',`Время начала`))
                p.append(from)
                p.append(ce('p',false,'info',`Время завершения`))
                p.append(till)

                let title = ce('input',false,'block',false,{
                    placeholder: `Название (при желании)`
                })

                let description = ce('textarea',false,'block',false,{
                    placeholder: `описание (при желании)`
                })

                p.append(title)
                p.append(description)

                p.append(ce('button',false,['active','block'],`Создать`,{
                    onclick:function(){
                        if(!from.value || !till.value) return tg.showAlert(`Без даты никак.`)
                        
                        this.setAttribute(`disabled`,true)
                        
                        axios.post(`/${host}/admin/fests?id=${userid}`,{
                            from: from.value,
                            till: till.value,
                            title: title.value,
                            description: description.value
                        }).then(d=>{
                            if(d.data.success){
                                tg.showAlert(`ok`)
                            } else {
                                tg.showAlert(d.data.comment)
                            }
                        })
                    }
                }))
        }
    }))
    axios.get(`/${host}/admin/fests?id=${userid}`)
        .then(data=>{
            hideLoader()
            data.data.forEach(f=>{
                let fc = ce('div',false,'divided')
                    fc.append(ce('span',false,'info',drawDate(f.from._seconds*1000)))
                    fc.append(ce('p',false,false,f.title || 'без названия'))
                    if(f.description) fc.append(ce('p',false,'info',f.description))
                p.append(fc)
            })
        })
}



function showTickets(){
    let p = preparePopup(`tickets`)
    showLoader()
    axios.get(`/${host}/admin/tickets?id=${userid}`)
        .then(data=>{
            p.append(ce('h1',false,false,`Билеты`))
            data.data.forEach(t => {
                let tc = ce('div',false,'divided',false,{
                    dataset: {
                        active: t.active ? true : false
                    }
                })

                    tc.append(ce('p',false,`info`,`создан ${drawDate(new Date(t.createdAt._seconds*1000),false,{time:true})}`))
                    if(t.payed) tc.append(ce('p',false,`info`,`оплачен ${drawDate(new Date(t.payed._seconds*1000),false,{time:true})}`))
                    tc.append(ce(`p`,false,false,t.id))
                    tc.append(ce(`p`,false,false,uname(t.user,t.user.id)))
                    
                    

                    if(t.active){

                        if(!t.payed){
                            tc.append(ce('button',false,false,`Оплатить`,{
                                onclick:function(){
                                    this.setAttribute(`disabled`,true)
                                    axios.put(`/${host}/admin/tickets/${t.id}?id=${userid}`,{
                                        attr: 'payed',
                                        value: new Date()
                                    })
                                    .then(s=>{
                                        if(s.data.success) tg.showAlert(`ok`)
                                        if(!s.data.success) tg.showAlert(s.data.comment)                                        
                                    })
                                    .catch(handleError)
                                    .finally(()=>{
                                        this.remove()
                                    })
                                        
                                }
                            }))
                        }

                        tc.append(ce('button',false,`alert`,`Деактивировать`,{
                            onclick:function(){
                                this.setAttribute(`disabled`,true)
                                axios.delete(`/${host}/admin/tickets/${t.id}?id=${userid}`)
                                .then(s=>{
                                    if(s.data.success) tg.showAlert(`ok`)
                                    if(!s.data.success) tg.showAlert(s.data.comment)                                        
                                })
                                .catch(handleError)
                                .finally(()=>{
                                    this.remove()
                                })
                                    
                            }
                        }))
                    }

                    p.append(tc)
                    
            });
        })
        .catch(handleError)
        .finally(hideLoader)
}


function checkQR(data){
    
    tg.closeScanQrPopup()

    let inc = data.data.split('_')

    // tg.showAlert(inc[1])

    if(data.data.split('_')[1] != 'ticket'){
        return tg.showAlert(`Я так не играю. Это не входной билет.`)
    }

    showLoader()

    axios.get(`/${host}/admin/qr?id=${userid}&data=${data.data}`)
        .then(r=>{
            r = r.data.data;

            let p = preparePopup(`qr`)


            

        })
        .catch(handleError)
        .finally(hideLoader)
}
