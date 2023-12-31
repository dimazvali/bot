
let tg = window.Telegram.WebApp;

let coworkingHall, coworkindDate, coworkingRecord, curLecture, curRecord, curRecordStream = null

let userid = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : userId

const host = `auditoria`

const coworkingCapacity = 17;

let appData = undefined;

class auditoriaAppModel extends appModel {
    constructor(v){
        super(v)
        this.streams = ko.observableArray(v.streams.map(s=>new auLecture(s)))
        this.schedule = ko.observableArray(v.schedule.map(l=>new auLecture(l)))
    }
}

class auLecture extends appLecture{
    constructor(l){
        super(l)
        this.price2 = ko.observable(l.price2)
        this.price3 = ko.observable(l.price3)   

    }
}


try {
    if (tg.initDataUnsafe.user.language_code != 'en' && translations.schedule[tg.initDataUnsafe.user.language_code]) {
        let lang = tg.initDataUnsafe.user.language_code
        // classes.querySelector('h2').innerHTML = translations.schedule[lang]
        // coworking.querySelector('h2').innerHTML = translations.coworking[lang]

    }

} catch (err) {
    console.error(err)
}

const ready = [

]

// if(start){
//     switch(start){
//         case 'classes': {
//             showSchedule(classes.querySelector('h2'))
//             break;
//         }
//         case 'coworking': {
//             showCoworking(coworking.querySelector('h2'))
//             break;
//         }
//         case 'mr': {
//             showMR(mr.querySelector('h2'))
//             break;
//         }
//     }
// }





tg.MainButton.setParams({
    color: `#075B3F`
})

axios.get(`/auditoria/api/user?id=${userid}`).then(u => {
    console.log(u.data)
    if(u.data.admin){
        links.prepend(ce('h1',false,`admin`,`Админка`,{
            onclick: () => window.location.href = `/${host}/admin`
        }))
    }
}).catch(err => {
    console.log(err)
})

// отрисовываем расписание
axios.get(`/auditoria/api/profile?user=${userid}`)
    .then(data => {

        data = data.data

        let p = document.querySelector('#schedule')

        // if(data.schedule.length || data.streams.length){
        //     p.classList.add('open')
        //     p.append(ce('h1', false, false, `Ваши билеты:`))
        // }

        let appData = new auditoriaAppModel({
            schedule: data.schedule,
            streams: data.streams
        })

        let s = ce('table',false,false,false,{
            dataset:{
                bind: `visible: streams().length, foreach: streams`
            }
        })
        
        p.append(s)

        let cl = ce('tr', false, 'class',false,{
            dataset:{
                bind: ``
            }
        })

        s.append(cl)

        let timing = ce('td',false,'timing')
            timing.append(ce('span',false,'date',false,{
                dataset:{
                    bind: `attr:{"data-month":new Date(date()).getMonth()}, html: new Date(date()).getDate({timeZone: 'Asia/Tbilisi'})`
                }
            }))
            timing.append(ce('span',false,'time',false,{
                dataset:{
                    bind: `html: new Date(time()).toLocaleTimeString([], {timeZone: 'Asia/Tbilisi',hour: '2-digit', minute:'2-digit'})`
                }
            }))

        cl.append(timing)

        let desc = ce('td')

        cl.append(desc)

        desc.append(ce('h4',false,false,false,{
            dataset:{
                bind: `html: name`
            }
        }))

        desc.append(ce('h5',false,false,false,{
            dataset:{
                bind: `html: author, visible: author()`
            }
        }))

        desc.append(ce('h5',false,false,false,{
            dataset:{
                bind: `html: descShort, visible: !author() && descShort()`
            }
        }))


        ko.applyBindings(appData,document.querySelector('#links'))




        

        // if (data.schedule.length) {

           
        // } else {
        //     p.append(ce('p', false, `bold`, `Тут (пока) пусто...`))
        // }

        // if (data.streams.length) {
        //     p.append(ce('h3', false, false, `Трансляции`))
        //     data.streams.forEach(s => p.append(drawClassLine(s)))
        // }
    })

function handleError(err) {
    tg.showAlert(err.message)
}

function list() {
    axios.post(`/auditoria/api/classes/${curLecture}?&user=${userid}&intention=book`).then(d => {
        tg.showAlert(translations[d.data.text][tg.initDataUnsafe.user.language_code] || translations[d.data.text].en)
        if (d.data.success) {
            tg.MainButton.offClick(list)
            mbbc = delist
            tg.MainButton.setText(translations.coworkingBookingCancel[[tg.initDataUnsafe.user.language_code]] || translations.coworkingBookingCancel.en)
            tg.MainButton.onClick(delist)
        } else {
            tg.MainButton.offClick(list)
            tg.MainButton.hide()
        }
    })
}

function delist() {
    // tg.showAlert(`not ready yet. you should use /myclasses command instead`)
    showLoader();
    axios
        .delete(`/${host}/api/tickets/${curRecord}?user=${userid}`, {
            type: curRecordStream ? true : false
        })
        .then(res => {
            tg.showAlert(res.data.comment)
        }).catch(err => {
            tg.showAlert(err.message)
        }).finally(hideLoader)
}

function showMR(el) {
    // tg.showAlert(`not ready yet. you should use /meetingroom command instead`)

    if (el.className.indexOf('switched') > -1) {
        el.classList.remove('switched')
        el.parentNode.classList.remove('open')
        el.parentNode.querySelectorAll('.class').forEach(c => c.remove())
    } else {
        el.classList.add('switched')
        el.parentNode.classList.add('open')
        axios.get(`/auditoria/api/mr?user=${userid}`).then(data => {
            data.data.forEach(date => {
                el.parentNode.append(drawDay(date))
            })
        }).catch(err => {
            tg.showAlert(err.data)
        })
    }
}

function book() {
    axios.post(`/auditoria/api/coworking/${coworkingHall}?date=${coworkindDate}&user=${userid}`).then(d => {
        tg.showAlert(translations[d.data.text][tg.initDataUnsafe.user.language_code] || translations[d.data.text].en)
        coworkingRecord = d.data.record
        tg.MainButton.offClick(book)
        mbbc = unBook
        tg.MainButton.setText(`Отменить бронь на ${coworkindDate}`)
        tg.MainButton.onClick(unBook)
    }).catch(err => {
        tg.showAlert(translations[err.data][tg.initDataUnsafe.user.language_code] || translations[err.data].en)
    })
}

function unBook() {
    axios.delete(`/auditoria/api/coworking/${coworkingRecord}?date=${coworkindDate}&user=${userid}`).then(d => {
        tg.showAlert(translations[d.data][tg.initDataUnsafe.user.language_code] || translations[d.data].en)
        tg.MainButton.offClick(unBook)
        mbbc = book
        tg.MainButton.setText(`Забронировать на ${coworkindDate}`)
        tg.MainButton.onClick(book)
    }).catch(err => {
        tg.showAlert(translations[err.data][tg.initDataUnsafe.user.language_code] || translations[err.data].en)
    })
}

function showCoworking(el) {
    showLoader();
    let p = preparePopup(`coworking`);
        p.append(ce('h2', false, 'header', `Коворкинг`))

    axios.get(`/auditoria/api/coworking?user=${userid}`)
        .then(data => {
            data = data.data;
            
            let dates = [];
            let shift = 0;
            while (shift<7){
                dates.push(new Date(+new Date()+shift*24*60*60*1000).toISOString().split('T')[0])
                shift++;
            }
            dates.forEach(date=>{
                let booked = data.filter(d=>d.date == date);
                let userBooked = booked.filter(r=>r.user == userid)[0]
                let c = ce('div',false,'day',false,{
                        onclick: ()=>{
                            coworkindDate = date;
                            coworkingRecord = userBooked ? userBooked.id : false;
                            if(userBooked){
                                tg.MainButton.setText('Снять бронь на ' + date)
                                tg.MainButton.show()
                                tg.MainButton.onClick(unBook)
                                mbbc = unBook
                            } else {
                                tg.MainButton.setText('Забронировать на ' + date)
                                tg.MainButton.show()
                                tg.MainButton.onClick(book)
                                mbbc = book
                            }
                        },
                        dataset:{
                            booked: userBooked ? true : false
                        }
                    })

                    c.append(ce('h3',false,false,drawDate(date)))
                    c.append(ce('p',false,false,`Свободных мест: ${coworkingCapacity-booked.length}`))
                p.append(c)
            })

        }).catch(handleError)
        .finally(hideLoader)
}

function showLoader() {
    document.body.append(ce('div', 'loader'))
}

function hideLoader() {
    document.querySelector('#loader').remove()
}

function showProfile() {
    showLoader();
    let p = preparePopup(`profile`);
    p.append(ce('h2', false, 'header', `Профиль`))

    axios.get(`/auditoria/api/profile?user=${userid}`)
        .then(data => {

            data = data.data

            p.append(ce('h3', false, false, `Ваши билеты:`))

            if (data.schedule.length) {

                let s = ce('table')
                p.append(s)
                data.schedule.sort((a, b) => b.date > a.date ? -1 : 1).filter(t => new Date(t.date) > new Date()).forEach(l => {
                    s.append(drawClassLine(l))
                })
            } else {
                p.append(ce('p', false, `bold`, `Тут (пока) пусто...`))
            }

            if (data.streams.length) {
                p.append(ce('h3', false, false, `Трансляции`))
                data.streams.forEach(s => p.append(drawClassLine(s)))
            }
        }).catch(err => handleError)
        .finally(hideLoader)
    axios.get(`/auditoria/api/subscriptions?user=${userid}`)
        .then(data => {
            subs = data.data;
            if (subs.subs.length) {
                p.append(ce('h3', false, false, `Подписки`))
                subs.subs.forEach(s => {
                    p.append(drawSubscriptionLine(s,subs))
                })
            }
        })
}

function drawMenuSection(section,sections,dishes,h){
    let c = ce('div')
    let t = ce((h||'h2'),false,false,section.category_name)
    console.log(section)
    c.append(t)
    let content = ce('div',false,[`hidden`,`inner`])
    c.append(content)
    t.onclick = ()=> content.classList.toggle('hidden')
    // +section.parent_category

    let dc = ce('div');
        dishes.filter(d=>(d.menu_category_id == section.category_id) && d.spots[0].visible == "1").forEach(d=>{
            let line = ce('tr',false,'dish')
                line.append(ce('td',false,'timing',`<span class="date">${cur(+d.price['1']/100,`GEL`)}</span>`))
                line.append(ce('td',false,false,d.product_name))
            dc.append(line)
        })
        content.append(dc)

    if(sections.filter(s=>s.parent_category == section.category_id).length){        
        sections.filter(s=>s.parent_category == section.category_id).forEach(s=>{
            content.append(drawMenuSection(s,sections,dishes,`h3`))
        })
        
    }
    //  else {
    //     let dc = ce('div');
    //     dishes.filter(d=>(d.menu_category_id == section.category_id) && d.spots[0].visible == "1").forEach(d=>{
    //         let line = ce('tr',false,'dish')
    //             line.append(ce('td',false,'timing',`<span class="date">${cur(+d.price['1']/100,`GEL`)}</span>`))
    //             line.append(ce('td',false,false,d.product_name))
    //         dc.append(line)
    //     })
    //     content.append(dc)
    // }

    return c
}

function drawMerchItem(item){
    let c = ce('div',false,[`item`,`merch`])
        c.append(ce('img',false,'logo',false,{
            src: `https://auditoria.joinposter.com/${item.photo}`
        }))
        c.append(ce('h2',false,false,`${item.product_name}, ${cur(+item.price['1']/100,'GEL')}`))
        // c.append(ce('p',false,'price',cur(+item.price['1']/100,'GEL')))
    return c

}

function showMerch(){
    showLoader()

    axios.get(`/${host}/api/menu?user=${userid}`)
        .then(data=>{
            let menu = data.data;
            let p = preparePopup(`schedule`);

            p.append(ce('h2', false, 'header', `Мерч`))

            menu.dishes.filter(d=>d.menu_category_id == '18').forEach(item=>{
                p.append(drawMerchItem(item))
            })

        }).catch(err=>{
            tg.showAlert(err.message)
        }).finally(hideLoader)
}

function showMenu(){
    showLoader()

    axios.get(`/${host}/api/menu?user=${userid}`)
        .then(data=>{
            let menu = data.data;
            let p = preparePopup(`schedule`);

            p.append(ce('h2', false, 'header', `Меню`))

            // p.append(ce('p', false, false, `Эти данные и правда берутся из poster, но пока что из моей тестовой учетной записи. Нам надо будет подружить существующую учетку с приложением (запрос в почте).`))

            let tt = ce('table')

            p.append(tt)

            let stopList = [
                `Coworking`,
                `Staff only`,
                'Events',
                `Bag shop (Max Sharoff)`,
                'Exhibition '
            ]

            menu.categories.forEach(cat=>{

                if(stopList.indexOf(cat.category_name) == -1 && !+cat.parent_category){
                   p.append(drawMenuSection(cat,menu.categories,menu.dishes))
                }

                // if(stopList.indexOf(cat.category_name) == -1){
                //     let h = ce('tr')
                // let title = ce('td',false,'catname',`<h3>${cat.category_name}</h3>`,{
                //     colspan: '2'
                // })

                // title.setAttribute('colspan','2')
                //     h.append(title)
                // tt.append(h)

                // menu.dishes.filter(d=>d.category_name == cat.category_name).forEach(d=>{
                //     console.log(d)
                //     let line = ce('tr',false,'dish')
                //         line.append(ce('td',false,'timing',`<span class="date">${cur(+d.price['1']/100,`GEL`)}</span>`))
                //         line.append(ce('td',false,false,d.product_name))
                //         tt.append(line)
                // })
                // }
                
            })
        }).catch(err=>{
            tg.showAlert(err.message)
        }).finally(hideLoader)
    
}

function showConcerts(){
    let p = preparePopup(`schedule`);

        p.append(ce('h2', false, 'header', `Концерты`))
        p.append(ce('p',false,false,`Это не рабочий раздел, а предложение сделать быстрые кнопки: Лекции / Концерты / Детям — чтобы можно было в один клик получить необходимое расписание.<br>К тому же каждый раздел может получить отдельное оформление: более академичное в первом случае — и с динозавриками в последнем...`))
}

function showKids(){
    let p = preparePopup(`kids`);
        p.append(ce('h2', false, 'header', `Детям`))
        showLoader();
        axios.get(`/auditoria/api/classes?kids=true&user=${userid}`)
        .then(classes => {


            let tt = ce('table')

            p.append(tt)

            classes.data.filter(c=>c.kids).sort((a,b)=>{
                if(b.date > a.date){
                    return -1
                } else if(b.date < a.date){
                    return 1
                } else {
                    if(b.time > a.time){
                        return -1
                    }
                    return 1
                }
            }).forEach(cl => {
                tt.append(drawClassLine(cl))
            });

        }).catch(err => handleError)
        .finally(hideLoader)
}

function showSchedule(el) {

    showLoader();

    axios.get(`/auditoria/api/classes?user=${userid}`)
        .then(classes => {

            let p = preparePopup(`schedule`);

            p.append(ce('h2', false, 'header', `Расписание`))

            let tt = ce('table')

            p.append(tt)

            classes.data.sort((a,b)=>{
                if(b.date > a.date){
                    return -1
                } else if(b.date < a.date){
                    return 1
                } else {
                    if(b.time > a.time){
                        return -1
                    }
                    return 1
                }
            }).forEach(cl => {
                tt.append(drawClassLine(cl))
            });

        }).catch(err => handleError)
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

let mbbc = null;


function drawDay(d) {
    console.log(d)
    let c = ce('div')
    c.append(ce('button', false, 'dateButton', new Date(d.date).toLocaleDateString(), {
        dataset: {
            booked: 1
        },
        onclick: function () {
            tg.BackButton.show();
            ``
            tg.onEvent('backButtonClicked', clearPopUp)
            mcb = clearPopUp

            let popup = ce('div', 'popup')
            document.body.append(popup)
            let content = ce('div')
            popup.append(content)

            let h = ce('div', false, 'header')
            h.append(ce('h3', false, false, `Переговорка`))
            h.append(ce('h5', false, false, d.date))
            popup.style.backgroundImage = `url(https://firebasestorage.googleapis.com/v0/b/auditoriastuff-620fa.appspot.com/o/coworking%2F2023-01-17%2009.58%201.jpg?alt=media&token=a1520476-d466-43e4-8c71-afa6c045b0ae)`
            content.append(h)
            let timing = ce('div', false, 'timing')
            d.slots.forEach(slot => {
                timing.append(ce('button', false, 'dateButton', slot.time + (slot.self ? ' (вы записаны)' : ''), {
                    dataset: {
                        booked: slot.available
                    },
                    onclick: () => {
                        mrDate = d.date,
                            mrTime = slot.time
                        mrSlot = slot.self

                        if (slot.self) {
                            tg.MainButton.setText(`Отказаться от слота на ${slot.time}`)
                            tg.MainButton.show()
                            tg.MainButton.onClick(unSlot)
                            mbbc = unSlot
                        } else if (slot.available) {
                            tg.MainButton.setText(`Занять слот на ${slot.time}`)
                            tg.MainButton.show()
                            tg.MainButton.onClick(slotme)
                            mbbc = slot
                        }
                    }
                }))
            })
            content.append(timing)


        }
    }))
    return c
}

function slotme() {
    axios.post(`/auditoria/api/mr/new?date=${mrDate}&time=${mrTime}&user=${userid}`).then(d => {
        if (d.data.success) {
            tg.MainButton.offClick(slotme)
            mbbc = unSlot
            tg.showAlert(translations.coworkingBookingConfirmed[tg.initDataUnsafe.user.language_code] || translations.coworkingBookingConfirmed.en)
            tg.MainButton.setText(translations.coworkingBookingCancel[[tg.initDataUnsafe.user.language_code]] || translations.coworkingBookingCancel.en)
            tg.MainButton.onClick(unSlot)
        } else {
            tg.MainButton.offClick(slotme)
            tg.MainButton.hide()
        }

    }).catch(err => {
        tg.showAlert(translations[err.data][tg.initDataUnsafe.user.language_code] || translations[err.data].en)
    })
}

function unSlot() {
    axios.delete(`/auditoria/api/mr/${mrSlot}?date=${mrDate}&time=${mrTime}&user=${userid}`).then(d => {

        if (d.data.success) {
            tg.MainButton.offClick(unSlot)
            mbbc = slot
            tg.MainButton.setText(translations.book[[tg.initDataUnsafe.user.language_code]] || translations.book.en)
            tg.MainButton.onClick(slotme)
        } else {
            tg.MainButton.offClick(unSlot)
            tg.MainButton.hide()
        }

    }).catch(err => {
        tg.showAlert(translations[err.data][tg.initDataUnsafe.user.language_code] || translations[err.data].en)
    })
}

function drawRoom(r) {
    let c = ce('div', false, 'class', false, {
        onclick: () => {
            tg.BackButton.show();
            tg.onEvent('backButtonClicked', clearPopUp)
            mcb = clearPopUp

            let popup = ce('div', 'popup')
            document.body.append(popup)
            let content = ce('div')
            popup.append(content)

            let h = ce('div', false, 'header')
            h.append(ce('h3', false, false, `${r.name}`))
            h.append(ce('h5', false, false, r.description || 'тут могло бы быть описание'))
            popup.style.backgroundImage = `url(${r.pics.split(',')[0] || 'https://firebasestorage.googleapis.com/v0/b/auditoriastuff-620fa.appspot.com/o/coworking%2F2023-01-17%2009.58%201.jpg?alt=media&token=a1520476-d466-43e4-8c71-afa6c045b0ae'})`
            content.append(h)

            axios.get(`/auditoria/api/coworking/${r.id}?user=${userid}`).then(dates => {
                dates.data.forEach((d, i) => {
                    setTimeout(function () {
                        content.append(ce('button', false, 'dateButton', `${d.date} (${d.booked ? 'вы записаны' : d.capacity})`, {
                            dataset: {
                                booked: d.booked
                            },
                            onclick: () => {


                                coworkingHall = r.id
                                coworkindDate = d.date
                                coworkingRecord = d.record

                                if (+d.booked) {


                                    tg.MainButton.setText('Снять бронь на ' + d.date)
                                    tg.MainButton.show()
                                    tg.MainButton.onClick(unBook)
                                    mbbc = unBook

                                } else {


                                    tg.MainButton.setText('Забронировать на ' + d.date)
                                    tg.MainButton.show()

                                    tg.MainButton.onClick(book)
                                    mbbc = book

                                }
                            }
                        }))
                    }, i * 150)
                })
            })


            // tg.MainButton.setText('ПРОВЕРИТЬ')
            // tg.MainButton.show()
            // tg.MainButton.onClick(sendOrder)

        }
    })
    c.append(ce('h3', false, false, r.name))
    c.append(ce('h3', false, false, r.floor + " floor, " + r.capacity + ' seats'))
    return c;
}


function drawDate(d, l, o) {
    let options = {
        weekday: 'short',
        month: 'short',
        day: '2-digit',
        timeZone: 'Asia/Tbilisi'
    }
    if (!o) o = {}
    if (o.time) {
        options.hour = '2-digit',
            options.minute = '2-digit'
    }
    if (o.year) options.year = '2-digit'

    return new Date(d).toLocaleDateString(`${l||'ru'}-RU`, options)
}

function drawCoursePopup(data, id) {

    axios.post(`/${host}/views/course/${id}`, {
        user: userid
    })

    let p = preparePopup(`course`)
    let a = data.course;

    p.append(ce('img', false, 'cover', false, {
        alt: a.name,
        src: a.pic || randomPic()
    }))

    p.append(ce('h1', false, false, a.name))

    if (a.description) p.append(ce('p', false, false, a.description))

    if (a.author) {
        if (a.authorId) {
            p.append(ce('a', false, `clickable`, `Автор: ${a.author}`, {
                onclick: () => {
                    showLoader();
                    axios.get(`/${host}/api/authors/${a.authorId}`)
                        .then(a => {
                            drawAuthorPopup(a.data, a.authorId)
                        })
                        .catch(err => {
                            tg.showAlert(err.message)
                        })
                        .finally(hideLoader)
                }
            }))
        }
    }

    if (data.subscriptions) {
        p.append(ce('p', false, false, `Следят за обновлениями: ${letterize(data.subscriptions,'человек')}`))
    }

    if (data.subscribed) {
        p.append(ce(`button`, false, false, `Отписаться от обновлений`, {
            onclick: function () {
                showLoader()
                axios.delete(`/${host}/api/subscriptions/${data.subscribed}?user=${userid}`)
                    .then(() => {
                        tg.showAlert(`Спасибо! Вы больше не будете получать уведомлений.`)
                        this.remove()
                    }).catch(err => {
                        tg.showAlert(err.message)
                    }).finally(() => {
                        hideLoader()
                    })
            }
        }))
    } else {
        p.append(ce('button', false, false, `Подписаться на обновления курса`, {
            onclick: function () {
                showLoader()
                axios.post(`/${host}/api/subscriptions/new`, {
                    type: `course`,
                    user: +userid,
                    id: id
                }).then(() => {
                    this.remove()
                    tg.showAlert(`Спасибо! Вы будете получать уведомления о новых событиях курса.`)
                }).catch(err => {
                    tg.showAlert(err.message)
                }).finally(() => {
                    hideLoader()
                })
            }
        }))
    }

    if(data.plans && data.plans.length){
        p.append(ce('h3',false,false,`Курс входит в абонемент`))
        data.plans.forEach(plan=>{
            p.append(ce('a',false,'clickable',`«${plan.name}»`,{
                onclick: () => {
                    drawPlanPopup(plan)
                }
            }))
        })
    }

    if (data.classes.length) {
        p.append(ce('h3', false, false, `Расписание`))
        data.classes.forEach(c => {
            p.append(drawClassLine(c))
        })
    }
}

function drawAuthorPopup(data, id) {

    axios.post(`/${host}/views/author/${id}`, {
        user: userid
    })

    let p = preparePopup(`author`)
    let a = data.author;

    p.append(ce('img', false, false, false, {
        alt: a.name,
        src: a.pic || randomPic()
    }))

    p.append(ce('h1', false, false, a.name))

    if (a.description) p.append(ce('p', false, false, a.description))

    if (data.subscriptions) {
        p.append(ce('p', false, false, `Следят за обновлениями: ${letterize(data.subscriptions,'человек')}`))
    }

    if (data.subscribed) {
        p.append(ce(`button`, false, false, `Отписаться от обновлений`, {
            onclick: function () {
                showLoader()
                axios.delete(`/${host}/api/subscriptions/${data.subscribed}?user=${userid}`)
                    .then(() => {
                        tg.showAlert(`Спасибо! Вы больше не будете получать уведомлений.`)
                        this.remove()
                    }).catch(err => {
                        tg.showAlert(err.message)
                    }).finally(() => {
                        hideLoader()
                    })
            }
        }))
    } else {
        p.append(ce('button', false, false, `Подписаться на обновления`, {
            onclick: function () {
                showLoader()
                axios.post(`/${host}/api/subscriptions/new`, {
                    type: `author`,
                    user: +userid,
                    id: id
                }).then(() => {
                    this.remove()
                    tg.showAlert(`Спасибо! Вы будете получать уведомления о новых событиях автора.`)
                }).catch(err => {
                    tg.showAlert(err.message)
                }).finally(() => {
                    hideLoader()
                })
            }
        }))
    }

    if (data.classes.length) {
        p.append(ce('h3', false, false, `Расписание`))
        data.classes.forEach(c => {
            p.append(drawClassLine(c))
        })
    }
}

function drawPlanPopup(plan,load){
    if(load){

    }

    let p = preparePopup(`plan`)
        p.append(ce('h1',false,false,plan.name))
        p.append(ce('p',false,false,plan.description))
        p.append(ce('p',false,false,`Продолжительность: ${plan.days} дней.`))
        p.append(ce('p',false,false,`Занятий: ${plan.visits}.`))
        p.append(ce('p',false,false,`Стоимость: ${cur(plan.price,'GEL')}.`))
}

function drawClassPopup(c, id) {

    axios.post(`/${host}/views/class/${id}`, {
        user: userid
    })

    let p = preparePopup(`class`)

    curLecture = c.id

    if (c.booked) {
        curRecord = c.booked
        if (c.stream) {
            curRecordStream = true
        } else {
            curRecordStream = false
        }
        tg.MainButton.setText('Отменить запись')
        tg.MainButton.show()
        tg.MainButton.onClick(delist)
        mbbc = delist

    } else {


        tg.MainButton.setText('Записаться')
        tg.MainButton.show()

        tg.MainButton.onClick(list)
        mbbc = list

    }


    p.append(ce('img', false, 'cover', false, {
        alt: c.name,
        src: c.pic || randomPic()
    }))

    

    if(c.booked){
            
        p.append(ce('img', false, 'qrSub', false, {
            alt: `ваш билет`,
            src: `/${host}/qr?id=${c.booked}&entity=userClasses`
        })) 
    }

    p.append(ce('h1', false, false, c.name))

    p.append(ce('p', false, 'timing', `<span class="date">${drawDate(c.date)}</span> <span class="time">${new Date(c.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit',timeZone: 'Asia/Tbilisi'})}</span>`))

    if (c.author) {
        if (c.authorId) {
            p.append(ce('a', false, `clickable`, c.author, {
                onclick: () => {
                    showLoader();
                    axios.get(`/${host}/api/authors/${c.authorId}`)
                        .then(a => {
                            drawAuthorPopup(a.data, c.authorId)
                        })
                        .catch(err => {
                            tg.showAlert(err.message)
                        })
                        .finally(hideLoader)
                }
            }))
        } else {
            p.append(ce('p', false, 'author', c.author))
        }

    }
    if (c.course) {
        p.append(ce('a', false, 'clickable', `Курс ${c.course}`, {
            onclick: () => {
                showLoader();
                axios.get(`/${host}/api/courses/${c.courseId}`)
                    .then(a => {
                        drawCoursePopup(a.data, c.courseId)
                    })
                    .catch(err => {
                        tg.showAlert(err.message)
                    })
                    .finally(hideLoader)
            }
        }))
    }

    p.append(ce('p', false, 'bold', c.descShort))

    if (c.descLong) {
        let long = ce('p', false, 'hidden', c.descLong)
        p.append(long)
        p.append(ce('a', false, 'clickable', `Подробнее`, {
            onclick: function () {
                this.remove();
                long.classList.toggle('hidden')
            }
        }))
    }

    if(c.plans && c.plans.length){
        c.plans.forEach(plan=>{
            p.append(ce('p',false,false,`Входит в абонемент «${plan.name}»`))
        })
        
    }

    if (!c.stream) {
        if (c.price) {

            if (!c.booked) {
                p.append(ce('p', false, `bold`, `Стоимость билетов: ${cur(c.price,`GEL`)}`))
                if (c.price2) {
                    p.append(ce('p', false, `bold`, `В день мероприятия: ${cur(c.price2,`GEL`)}`))
                }
                if (c.price3) {
                    p.append(ce('button', false, `bold`, `Доступ к прямой трансляции: ${cur(c.price3,`GEL`)}`, {
                        onclick: () => {
                            console.log(123)
                            tg.showConfirm(`Уверены?`, function (e) {
                                bookOnline(e, p)
                            })
                        }
                    }))
                    // p.append(ce())
                }
            } else {
                if (c.payed || c.isPayed) {
                    p.append(ce('p', false, 'bold', `Ваш билет оплачен.`))
                } else {
                    p.append(ce('p', false, 'bold', `Ваш билет еще не оплачен. Напоминаем, что в день мероприятия стоимость составит ${cur(c.price2 || c.price1 ,`GEL`)}.`))
                    p.append(ce(`p`, false, `bold`, `Чтобы оплатить билет заранее, переведите ${cur(c.price1 ,`GEL`)} на ${c.paymentDesc || `счет GE28TB7303145064400005`} — и скиньте боту скриншот с подтверждением платежа.`))
                }
            }

        } else {
            p.append(ce('h3', false, false, `Вход бесплатный!`))
        }
    } else {
        if (c.payed || c.isPayed) {
            p.append(ce('p', false, 'bold', `Ваша трансляция оплачена. Пароль и ссылку вы получите за полчаса до начала меропориятия`))
        } else {
            p.append(ce(`p`, false, `bold`, `Чтобы оплатить трансляцию, переведите ${cur(c.price1 ,`GEL`)} на ${c.paymentDesc || `счет GE28TB7303145064400005`} — и скиньте боту скриншот с подтверждением платежа.`))
        }
    }

}

function bookOnline(s, p) {
    console.log(s, p)
    if (s) {
        axios.post(`/${host}/api/online/${curLecture}?user=${userid}`)
            .then(r => {
                if (r.data.success) {
                    tg.showAlert(r.data.comment)
                } else {
                    tg.showAlert(translations[r.data.comment][tg.initDataUnsafe.user.language_code] || translations[r.data.comment].en)
                }
            }).catch(err => {
                tg.showAlert(err.message)
            })

    }
}



function randomPic() {
    let images = [
        '3b.png',
        'b1.png',
        'b2.png',
        'w1.png',
        'w2.png'
    ]

    return `/images/auditoria/${images[Math.floor(Math.random()*images.length)]}`
}

function cur(v, cur) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        currency: cur || 'RUB',
    }).format(Number(v || 0));
}

function drawSubscriptionLine(s, subs){
    let cl = ce('tr', false, 'class')
        cl.append(ce('td', false, 'timing', `<span class="date">${s.author ? `Автор` : `Курс`}</span>`))

        let desc = ce('td')

        cl.append(desc)

        if(s.author){
            let a = subs.authors.filter(a=>a.id == s.author)[0]
            desc.innerHTML = `<h4>${a.name}</h4>`
            cl.onclick = () => {
                showLoader();
                axios.get(`/${host}/api/authors/${a.id}`)
                    .then(a => {
                        a.data.subscribed = s.id;
                        drawAuthorPopup(a.data, s.author)
                    })
                    .catch(err => {
                        tg.showAlert(err.message)
                    })
                    .finally(hideLoader)
            }
        } else {
            let c = subs.courses.filter(a=>a.id == s.course)[0]
            desc.innerHTML = `<h4>${c.name}</h4>`
            cl.onclick = () => {
                showLoader();
                axios.get(`/${host}/api/courses/${c.id}`)
                    .then(a => {
                        a.data.subscribed = s.id;
                        drawCoursePopup(a.data, s.course)
                    })
                    .catch(err => {
                        tg.showAlert(err.message)
                    })
                    .finally(hideLoader)
            }
        }

        return cl;
}

function drawClassLine(c) {
    let cl = ce('tr', false, 'class')


    cl.append(ce('td', false, 'timing', `<span data-month="${new Date(c.date).getMonth()}" class="date">${new Date(c.date).getDate({timeZone: 'Asia/Tbilisi'})}</span><span class="time">${new Date(c.time).toLocaleTimeString([], {timeZone: 'Asia/Tbilisi',hour: '2-digit', minute:'2-digit'})}</span>`))

    let desc = ce('td')

    cl.append(desc)

    desc.append(ce('h4', false, false, `${c.name}`))

    if (c.author) {
        desc.append(ce('h5', false, false, `${c.author}`))
    } else if (c.descShort){
        desc.append(ce('h5', false, false, `${c.descShort}`))
    }



    cl.onclick = () => {
        drawClassPopup(c, c.id)
    }


    return cl

}