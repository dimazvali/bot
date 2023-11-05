// const { default: axios } = require("axios")
let host = `paper`

let mc = document.querySelector(`#main`)

function closeLeft(){
    document.querySelector(`#left`).classList.remove('active')
}

function showSchedule(){
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    axios.get(`/${host}/admin/classes`)
        .then(data=>{
            console.log(data.data)
            mc.innerHTML = '';
            mc.append(ce('h1',false,`header2`,`Расписание`))
            let c = ce('div')
            data.data.forEach(cl => {
                c.append(drawClassLine(cl))
            });
            mc.append(c)


        })
        .catch(err=>{
            alert(err.message)
        })
}

function drawClassLine(cl){
    let c = ce('div',false,'divided',false,{
        dataset:{
            active: cl.active
        }
    })
    c.append(ce('h2',false,false,cl.name))
    c.append(ce('p',false,false,`${drawDate(cl.date)} @ ${cl.hallName}`))
    return c
}

function showLogs(){
    window.location.reload()
}

function showUsers(){
    closeLeft()
    mc.innerHTML = '<h1>Загружаем...</h1>'
    axios.get(`/${host}/admin/users`)
        .then(data=>{
            console.log(data.data)
            mc.innerHTML = '';
            mc.append(ce('h1',false,`header2`,`Пользователи`))
            let c = ce('div')
            data.data.users.forEach(cl => {
                c.append(drawUserLine(cl))
            });
            mc.append(c)
        })
        .catch(err=>{
            alert(err.message)
        })
}


function drawUserLine(u){
    let c = ce(`div`,false,`divided`,false,{
        dataset:{active:u.active}
    })

    c.append(ce('h3',false,false,uname(u,u.id),{
        onclick:()=>{
            showUser(u)
        }
    }))

    return c;
}


function showUser(u){
    let p = preparePopupWeb(`user${u.id}`)
        p.append(ce('h1',false,false,`${uname(u,u.id)} (${u.language_code})`))
        p.append(ce('p',false,false,`Регистрация: ${drawDate(u.createdAt._seconds*1000)}`))
        p.append(ce('p',false,false,`email: ${u.email || `не указан`}`))
        p.append(ce('p',false,false,`about: ${u.about || `о себе не рассказывал`}`))
        p.append(ce('p',false,false,`occupation: ${u.occupation || `о себе не рассказывал`}`))
}


function preparePopupWeb(name){
    let c = ce('div',false,'popupWeb')
    c.append(ce('span',false,`closeMe`,`✖`,{
        onclick:()=>{
            c.classList.add(`slideBack`)
            // setTimeout(function(){
            //     c.remove()
            // },500)
        }
    }))
    document.body.append(c)
    return c;
}