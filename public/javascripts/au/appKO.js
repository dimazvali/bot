
let tg = window.Telegram.WebApp;

let coworkingHall, coworkindDate, coworkingRecord, curLecture, curRecord, curRecordStream = null

let userid = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : userId

const host = `auditoria`

const coworkingCapacity = 17;

let appData = undefined;

class auditoriaAppModel extends appModel {
    constructor(v){
        super(v)
        this.streams =  ko.observableArray(v.streams.map(s=>new auLecture(s)))
        this.schedule = ko.observableArray(v.schedule.map(l=>new auLecture(l)))
        
        this.scheduleVisible = ko.observable(false)
        this.showSchedule = () => this.scheduleVisible(true)
    }
}

class auLecture extends appLecture{
    constructor(l){
        super(l)
        this.price2 =   ko.observable(l.price2)
        this.price3 =   ko.observable(l.price3)
        this.name =     ko.observable(l.name)
    }
}


try {
    if (tg.initDataUnsafe.user.language_code != 'en' && translations.schedule[tg.initDataUnsafe.user.language_code]) {
        let lang = tg.initDataUnsafe.user.language_code
    }

} catch (err) {
    console.error(err)
}

const ready = [

]

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

        console.log(data)

        let p = document.querySelector('#schedule')

        appData = new auditoriaAppModel({
            schedule:   data.schedule,
            streams:    data.streams
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
        
            let classes = ce('h1',false,false,`Взрослым`,{
                dataset:{
                    bind: `click:showSchedule`
                }
            })

            links.append(classes)

            let classesContainer = ce(`div`,false,`popup`,false,{
                dataset:{
                    type: `classes`,
                    bind: `visible: scheduleVisible`
                }
            })

            links.append(classesContainer)

            let classLine = ce('div',false,false,false,{
                dataset:{
                    bind: `foreach: schedule`
                }
            })

            classesContainer.append(classLine)

            classLine.append(ce('div',false,false,false,{
                dataset:{
                    bind: `html: name`
                }
            }))


        ko.applyBindings(appData,document.querySelector('#links'))
    })

function handleError(err) {
    tg.showAlert(err.message)
}