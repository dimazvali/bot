
window.onload = () => {
    window.Telegram.WebApp.MainButton.hide()
}

axios.get(`/bot/telByUser/?id=${window.Telegram.WebApp.initDataUnsafe.user.id}`).then(u => {
    console.log(u.data)
    if (u.data && u.data.tel) {
        curOrder.phone = u.data.tel;
    }
})

let tg = window.Telegram.WebApp;


function toggleStatus(reservation, type) {
    document.querySelector('.buttonsContainer').style.display = 'none';
    let comment = ce('textarea', 'comment', false, false, {
        placeholder: (type == 'accept' ?
            'При желании вы можете указать ограничения и условия посадки — они будут переданы клиенту.' :
            'Пожалуйста, назовите причину. Нет мест? Или что-то иное?..')
    })
    start.append(comment)
    window.Telegram.WebApp.MainButton.setText(type == 'accept' ? 'Принять' : 'Отклонить')
    window.Telegram.WebApp.MainButton.show()
    window.Telegram.WebApp.MainButton.onClick(() => sendfeebback(reservation, type, comment))
    window.Telegram.WebApp.BackButton.show()
    window.Telegram.WebApp.BackButton.onClick(() => {

        window.Telegram.WebApp.MainButton.hide()
        window.Telegram.WebApp.BackButton.hide()
        document.querySelector('.buttonsContainer').style.display = 'block';
        document.querySelector('#comment').remove()
    })

}

let curOrder = {

}


function qDate(type) {
    switch (type) {
        case 'today':
            curOrder.date = new Date().toISOString().split('T')[0]
            break;
        case 'tomorrow':
            curOrder.date = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]
            break;
        case 'friday':
            let today = new Date().getDay();
            if(today == 5){
                curOrder.date = new Date().toISOString().split('T')[0]
            } else if (today<5){
                curOrder.date = new Date(+new Date()+(5-today)*24*60*60*1000).toISOString().split('T')[0]
            } else {
                curOrder.date = new Date(+new Date()+(6)*24*60*60*1000).toISOString().split('T')[0]
            }
            break
    }

    let chosenDate = new Date(curOrder.date)
    let tt = place.lifetime.timetables.filter(tt => tt.type.id == 1)[0]

    if (tt && tt.list && tt.list[chosenDate.getDay()] && tt.list[chosenDate.getDay()].is_closed) {
        window.Telegram.WebApp.showAlert(`В выбранный день ресторан не работает (`)
    } else {
        showTime()
    }
}

function initOrder(inp, id) {

    // alert(inp.value)
    
    let chosenDate = new Date(inp.value)
    

    if (chosenDate > new Date(new Date().setHours(0))) {
        inp.setAttribute('disabled', true)
        axios.get(`https://inner-node.restorating.ru/awn/getBusy?place=${id}`)
            .then(d => {
                // разобраться с занятостью
                // document.querySelector('#cur').append(ce('p',false,false,JSON.stringify(d.data)))

                curOrder.date = chosenDate.toISOString().split('T')[0];

                let tt = place.lifetime.timetables.filter(tt => tt.type.id == 1)[0]

                if (tt && tt.list && tt.list[chosenDate.getDay()] && tt.list[chosenDate.getDay()].is_closed) {
                    window.Telegram.WebApp.showAlert(`В выбранный день ресторан не работает (`)
                } else {
                    showTime()
                }

            }).catch(err => {
                console.log(err)
                window.Telegram.WebApp.showAlert(err.message)
            })
    } else {
        window.Telegram.WebApp.showAlert(`Извините, назад дороги нет. Выберите будущее!\n(время)`)
        inp.removeAttribute('disabled')
    }
}

let mbcb = null;
let beforeBack = null;


function step(bf, text, mcb) {

    det.innerHTML = '';

    setTimeout(function () {
        tg.BackButton.show();
        
        if(beforeBack) tg.offEvent('backButtonClicked',beforeBack)

        tg.onEvent('backButtonClicked',bf)
        
        beforeBack = bf;

    }, 100)

    if (mcb) {
        
        console.log(`новая главная`,mcb)

        console.log(`старая главная`,mbcb)
        
        
        setTimeout(function () {
            tg.onEvent('mainButtonClicked',mcb)
            tg.MainButton.enable()
            
            if(mbcb && mbcb != mcb){
                tg.offEvent('mainButtonClicked',mbcb)
            }
            mbcb = mcb
        }, 100)

    }

    if (text) {
        tg.MainButton.show()
        tg.MainButton.enable()
        tg.MainButton.setText(text)
    } else {
        tg.MainButton.hide()
    }

}

function closeMe(){
    tg.close()
}

function showDate(){

    // alert(curOrder.date)

    console.log('показать даты')

    tg.BackButton.hide()

    det.innerHTML = ''

    // step(closeMe)

    det.append(ce('span',false,'info','Выберите дату'))

    det.append(ce('input','dd',false,false,{
        type: 'date',
        value: curOrder.date||new Date().toISOString().split('T')[0],
        onchange:function(){
            initOrder(this,place.id)
        },
    }))
    det.append(ce('button',false,'mbutton','Сегодня',{
        onclick:()=>qDate('today')
    }))
    det.append(ce('button',false,'mbutton','Завтра',{
        onclick:()=>qDate('tomorrow')
    }))
    if(new Date().getDay() != 5){
        det.append(ce('button',false,'mbutton','В пятницу',{
            onclick:()=>qDate('friday')
        }))
    }

    tg.offEvent('mainButtonClicked',showGuests)
    tg.MainButton.hide()
    
}

let promotions = []

function showTime(){

    det.innerHTML = ''

    console.log('показать время')

    step(showDate)

    let tt = {};
    
    try {
        tt = place.lifetime.timetables.filter(tt => tt.type.id == 1)[0].list[new Date(curOrder.date).getDay()]
    } catch(err){
        tt = {
            searchStart: '00:00',
            searchEnd: '24:00'
        }
    }
    

    axios.get(`https://apiv2.restorating.ru/api/promotions/place/${place.slug}/`).then(p=>{
        promotions = p.data.rows || []
        let cd = new Date(curOrder.date).getDay() + 1;
        if(cd == 7) cd = 0;
        let foundActions = p.data.rows.filter(promo=> 
            new Date(promo.date[0].start_date)  <= new Date(curOrder.date) && 
            new Date(promo.date[0].end_date)    >= new Date(curOrder.date) && 
            promo.date[0].weekdays.indexOf(cd.toString())>-1)
        
        if(foundActions.length) {
            let pc = ce('div')
            pc.append(ce('h3',false,false,'В этот день действуют акции:'))
            foundActions.forEach(p=>{
                pc.append(ce('p',false,false,`${p.title} <span class="info">(${p.interval_date})</span>`))
            })
            det.append(pc)
        }
        
    })



    let timeHelper = ce('p', false, 'info', `Часы работы в выбранный день: ${tt.title}`)
    let time = ce('input', false, false, false, {
        type: 'time',
        value: curOrder.time || null,
        min: tt.searchStart,
        max: tt.searchEnd,
        onchange: function () {
            if ((this.value >= tt.searchStart && this.value <= tt.searchEnd) || (tt.searchEnd < tt.searchStart && this.value > tt.searchStart)) {
                curOrder.time = time.value;
                tg.MainButton.show()
                tg.MainButton.enable()
                tg.MainButton.onClick(showGuests)
                tg.MainButton.setText('К гостям')
            } else {
                window.Telegram.WebApp.showAlert(`В указанное время ресторан не работает...`)
                this.value = null;
            }

        }
    })

    if(curOrder.time){
        tg.MainButton.show()
        tg.MainButton.enable()
        tg.MainButton.onClick(showGuests)
        tg.MainButton.setText('К гостям')
    }

    tg.MainButton.offClick(showComment)
    det.append(timeHelper)
    det.append(ce('spab',false,'info','Укажите время'))
    det.append(time)
}

function showGuests () {

    console.log('показать гостей')
    
    step(showTime,
        `К пожеланиям`,
        showComment
    )
    
    // tg.offEvent('backButtonClicked',showDate)

    tg.offEvent('mainButtonClicked',showGuests)

    let placeSS = place.features.filter(f => f.id == 122 && f.is_place_has)[0]

    console.log(placeSS)

    if (placeSS) placeSS = {
        from: placeSS.data[11].value,
        val: placeSS.data[12].value
    }
    let gc = ce('input', false, false, false, {
        placeholder: 'выберите количество гостей',
        min: 1,
        value: 2,
        max: 100,
        step: 1,
        type: 'number',
        value: curOrder.guests || 2,
        pattern:"\d*",
        oninput: () => {
            if (placeSS) {
                if (+gc.value > placeSS.from) {
                    window.Telegram.WebApp.showConfirm(`Обратите внимание: от ${gc.value} гостей действует сервисный сбор в размере ${placeSS.val}% от суммы счета!`)
                }
            }
            curOrder.guests = +gc.value
            // showComment()
        }
    })
    det.append(ce('span',false,'info','Сколько будет гостей?'))
    det.append(gc)
    if(!curOrder.guests) curOrder.guests = 2
}

function showComment () {
    
    console.log('показать комменты')

    
    step(showGuests,
        `Пропустить`,
        showCheckOut
    )

    // tg.offEvent('backButtonClicked',showTime)
    tg.offEvent('mainButtonClicked',showComment)

    if (place.halls) {
        let hc = ce('select')
        let info = ce('span', false, 'info')
        hc.append(ce('option', false, false, 'Выберите зал', {
            selected: false,
            value: null
        }))
        place.halls.forEach(h => {
            hc.append(ce('option', false, false, h.name, {
                value: h.name
            }))
        })
        hc.onchange = () => {
            curOrder.hall = hc.value || null
            if (hc.value) {
                let hneeded = place.halls.filter(h => h.name == hc.value)[0]
                if (place.images.filter(p => !p.restricted).filter(p => p.hall && p.hall.id == hneeded.id)[0]) {
                    document.querySelector('img').src = place.images.filter(p => !p.restricted).filter(p => p.hall && p.hall.id == hneeded.id)[0].base_url.replace(/{size}/, 'base-big')
                }
                info.innerHTML = hneeded.description || ''
            } else {
                info.innerHTML = ''
            }
        }
        det.append(hc)
        det.append(info)
    }

    let cf = ce('textarea', false, false, false, {
        placeholder: 'Пожелания к заказу',
        onchange: () => {
            tg.MainButton.setText('Сохранить');
            curOrder.comment = cf.value
        }
    })
    let pf = place.features.filter(f => f.id == 96)[0]
    if (pf) {
        switch (pf.is_place_has) {
            case 1:
                det.append(ce('span', false, 'info', `Вы можете взять с собой питомца:`))
                det.append(ce('div', false, 'info', pf.description))
            default:
                det.append(ce('span', false, 'info', `Обратите внимание: посещение с животными запрещено`))
        }
    }

    det.append(cf)

}

function showCheckOut() {

    console.log('показать чекаут')


    step(showComment,
        `Забронировать`,
        sendOrder
    )

    // tg.offEvent('backButtonClicked',showComment)

    tg.offEvent('mainButtonClicked',showCheckOut)

    let labels={
        date:   {l:'Дата'},
        time:   {l:'Время'},
        guests: {step:showGuests,l:'Гостей'},
        hall:   {step:showComment,l:'Зал'},
        comment:{step:showComment,l:'Пожелания'},
        phone: {
            l: 'Ваш номер'
        }
    }

    setTimeout(function () {
        if (!curOrder.phone) {
            let pi = ce('input', false, false, false, {
                type: 'number',
                placeholder: 'Ваш телефон (только цифры)',
                onchange: () => {
                    curOrder.phone = pi.value;
                }
            })
            det.prepend(pi)
        }

        Object.keys(curOrder).forEach(k => {
            det.append(ce('p', false, false, `${labels[k].l}: ${k=='date'?new Date(curOrder[k]).toLocaleDateString():curOrder[k]}`,{
                onclick:()=>labels[k].step?labels[k].step():console.log('нет такого'),
            }))
        })

    }, 200)

}
function sendOrder() {

    tg.MainButton.setText('Отправляем заказ')

    tg.offEvent('mainButtonClicked',sendOrder)
    // tg.offEvent('backButtonClicked',showGuests)


    let od = {
        orderType: 'table',
        dateTime: new Date(curOrder.date).toISOString().split('T')[0]+'T'+ curOrder.time,
        bookId: +new Date(),
        bookName: tg.initDataUnsafe.user.first_name + ' ' + tg.initDataUnsafe.user.last_name,
        bookPhone: '+'+curOrder.phone,
        organizationId: place.id,
        guestsCount: curOrder.guests,
        comment: (curOrder.comment || '') + (curOrder.hall ? ' предпочитаемый зал: ' + curOrder.hall : ''),
        channel: 'telegramBot'
    }

    console.log(od)

    det.innerHTML = ''

    try {
        axios.post(`/order`, od)
            .then(s => {
                if(s.data.success){
                    tg.showConfirm('Ваш заказ принят в обработку. Подтверждение придет в смс, whatsapp или прямо сюда, если вы успели поделиться с ботом своим номером телефона.',()=>tg.close())
                } else {
                    tg.showAlert(s.data.comment)
                }
                
            }).catch(err => {
                console.log(err)
                tg.showAlert(err.message)
            }).finally(() => {
                // tg.close()
            })
    } catch (err) {
        console.log(err)
    }

    tg.MainButton.showProgress(false)

}

function setChanges(type, before, after) {

    if (!changes[type]) changes[type] = {
        before: before
    }
    changes[type].after = after;

    // window.Telegram.WebApp.MainButton.enable()

    window.Telegram.WebApp.MainButton.show()
    window.Telegram.WebApp.MainButton.enable()
    window.Telegram.WebApp.MainButton.onClick(() => sendChanges(changes, oid))
    window.Telegram.WebApp.MainButton.setText('Отправить')
}

function sendChanges(changes, order) {

    window.Telegram.WebApp.MainButton.showProgress()
    try {
        axios.post(`/bot/userChanges/${order}`, changes).then(s => {
            window.Telegram.WebApp.showConfirm('Спасибо! Мы все получили и начинаем работать')
        }).catch(err => {
            window.Telegram.WebApp.showAlert(err.message)
        }).finally(() => {
            document.querySelector('.cc').remove()
            window.Telegram.WebApp.MainButton.hide()
        })
    } catch (err) {
        start.append(ce('p', false, false, err.message))
    }

}

let changes = {

}

function toggleStatus() {
    window.Telegram.WebApp.showConfirm('Вы уверены?', function (shure) {
        if (shure) {
            try {
                axios.post(`/bot/userChanges/${oid}`, {
                    status: {
                        after: 'Отменен клиентом'
                    }
                }).then(s => {
                    window.Telegram.WebApp.showConfirm('Жаль! Будем рады забронировать для вас столик в любом ресторане Петерубрга, Москвы, Калинингра, Сочи, а теперь еще и Тбилиси!')
                }).catch(err => {
                    window.Telegram.WebApp.showAlert(err.message)
                }).finally(() => {
                    document.querySelector('.buttonsContainer').remove()
                    window.Telegram.WebApp.MainButton.hide()
                })
            } catch (err) {
                start.append(ce('p', false, false, err.message))
            }
        }
    })
}

function changeOrder(o) {



    let cd = ce('div', false, 'cc')
    let time = ce('input', false, false, false, {
        value: o.time,
        onchange: () => setChanges('time', o.time, time.value),
        type: 'time'
    })
    let date = ce('input', false, false, false, {
        value: new Date(+new Date(o.date) + 1000 * 60 * 60 * 24).toISOString().split('T')[0],
        onchange: () => setChanges('date', o.date, date.value),
        type: 'date'
    })
    let g = ce('input', false, false, false, {
        value: o.guests,
        onchange: () => setChanges('guests', o.guests, g.value),
        type: 'number',
        placeholder: 'гостей'
    })
    let comment = ce('textarea', false, false, false, {
        value: o.comment,
        onchange: () => setChanges('comment', o.guests, comment.value),
        placeholder: 'ваши пожелания'
    })

    cd.append(date)
    cd.append(time)
    cd.append(g)
    cd.append(comment)

    start.append(cd)
    document.querySelector('.buttonsContainer').style.display = 'none';

    // window.Telegram.WebApp.MainButton.setText('Отправить')
    // window.Telegram.WebApp.MainButton.show()
    // window.Telegram.WebApp.MainButton.disable()

    window.Telegram.WebApp.BackButton.show()
    window.Telegram.WebApp.BackButton.onClick(() => {

        window.Telegram.WebApp.MainButton.hide()
        window.Telegram.WebApp.BackButton.hide()
        document.querySelector('.buttonsContainer').style.display = 'block';
        document.querySelector('.cc').remove()
        document.querySelector('#comment').remove()
    })
}

function sendfeebback(r, t, c) {
    window.Telegram.WebApp.MainButton.showProgress()

    axios.post(`/pro/toggleOrder`, {
        reservation: r,
        action: t,
        user: window.Telegram.WebApp.initDataUnsafe.user.first_name + ' / ' + window.Telegram.WebApp.initDataUnsafe.user.id,
        comment: c.value,
        place: pid
    }).then(s => {
        start.append(ce('p', false, false, s.data))
    }).catch(err => {
        start.append(ce('p', false, false, err.message))
    }).finally(() => {
        window.Telegram.WebApp.MainButton.hide();
        c.remove();
    })
}