
function showLoader() {
    document.body.append(ce('div', 'loader'))
}

function hideLoader() {
    document.querySelector('#loader').remove()
}

function drawMenuSection(section,sections,dishes,h){
    console.log(section,sections,dishes)
    if(!dishes) dishes =[]
    let c = ce('div')
    let t = ce((h||'h2'),false,false,section.category_name)
    console.log(section)
    c.append(t)
    let content = ce('div',false,[`hidden`,`inner`])
    c.append(content)
    t.onclick = ()=> content.classList.toggle('hidden')

    let dc = ce('div');
        dishes.filter(d=>(d.menu_category_id == section.category_id) && d.spots[0].visible == "1").forEach(d=>{
            let line = ce('tr',false,'dish')
                line.append(ce('td',false,'timing',`<span class="date">${cur(+d.price['1']/100,`GEL`)}</span>`))
                line.append(ce('td',false,false,d.product_name))
            dc.append(line)
            if(d.group_modifications && d.group_modifications[0] && d.group_modifications[0].modifications){
                let mods = d.group_modifications && d.group_modifications[0] && d.group_modifications[0].modifications;
                mods.forEach(m=>{
                    let line = ce('tr',false,['dish','mod'])
                        line.append(ce('td',false,'timing',`<span class="date">+${cur(+m.price,`GEL`)}</span>`))
                        line.append(ce('td',false,false,m.name))
                    dc.append(line)
                })
            }
        })
        content.append(dc)

    if(sections.filter(s=>s.parent_category == section.category_id).length){        
        sections.filter(s=>s.parent_category == section.category_id).forEach(s=>{
            content.append(drawMenuSection(s,sections,dishes,`h3`))
        })
        
    }

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



function showMenu(menu){
    showLoader()

    if(!menu){
        menu = axios.get(`/${host}/api/menu?user=${userid}`).then(data=>data.data)
    }

    Promise.resolve(menu).then(menu=>{
        hideLoader()
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
    })
    
}

// function showSchedule() {
//     closeLeft()
//     mc.innerHTML = '<h1>Загружаем...</h1>'
//     axios.get(`/${host}/admin/classes`)
//         .then(data => {
//             console.log(data.data)
//             mc.innerHTML = '';
//             mc.append(ce('h1', false, `header2`, `Расписание`))
//             mc.append(drawSchedule(data.data))
//             let c = ce('div')

//             data.data.forEach(cl => {

//                 c.append(showClassLine(cl))
//             });
//             c.append(addClass())
//             mc.append(c)


//         })
//         .catch(err => {
//             alert(err.message)
//         })
// }


function showSchedule(el) {

    showLoader();

    if(!clas)
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

function drawClassLine(c) {
    let cl = ce('tr', false, 'class')


    cl.append(ce('td', false, 'timing', `<span data-month="${new Date(c.date._seconds*1000).getMonth()}" class="date">${new Date(c.date._seconds*1000).getDate({timeZone: 'Asia/Tbilisi'})}</span><span class="time">${new Date(c.date._seconds*1000).toLocaleTimeString([], {timeZone: 'Asia/Tbilisi',hour: '2-digit', minute:'2-digit'})}</span>`))

    let desc = ce('td')

    cl.append(desc)

    desc.append(ce('h4', false, false, `${c.name}`))

    if (c.author) {
        desc.append(ce('h5', false, false, `${c.author}`))
    } else if (c.descShort){
        desc.append(ce('h5', false, false, `${c.descShort}`,false,true))
    }

    cl.onclick = () => {
        drawClassPopup(c, c.id)
    }

    return cl

}

function drawClassPopup(c, id) {

    axios.post(`/${host}/views/class/${id}`, {
        user: userid
    })

    let p = preparePopup(`class`)



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

    p.append(ce('p', false, 'timing', `<span class="date">${drawDate(c.date._seconds*1000)}</span> <span class="time">${new Date(c.date._seconds*1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit',timeZone: 'Asia/Tbilisi'})}</span>`))

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
                        // tg.showAlert(err.message)
                    })
                    .finally(hideLoader)
            }
        }))
    }

    p.append(ce('p', false, 'bold', c.descShort))

    if(c.status == 'used') {
        content.append(drawLectureQuestion(c))
    }


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
                            // tg.showConfirm(`Уверены?`, function (e) {
                            //     bookOnline(e, p)
                            // })
                        }
                    }))
                    // p.append(ce())
                }
            } else {
                // if (c.payed || c.isPayed) {
                //     p.append(ce('p', false, 'bold', `Ваш билет оплачен.`))
                // } else {
                //     p.append(ce('p', false, 'bold', `Ваш билет еще не оплачен. Напоминаем, что в день мероприятия стоимость составит ${cur(c.price2 || c.price ,`GEL`)}.`))
                //     p.append(ce(`p`, false, `bold`, `Чтобы оплатить билет заранее, переведите ${cur(c.price ,`GEL`)} на ${c.paymentDesc || c.bankCreds || `счет GE28TB7303145064400005`} — и скиньте боту скриншот с подтверждением платежа.`))
                // }
            }

        } else {
            p.append(ce('h3', false, false, `Вход бесплатный!`))
        }
    } else {
        if (c.payed || c.isPayed) {
            p.append(ce('p', false, 'bold', `Ваша трансляция оплачена. Пароль и ссылку вы получите за полчаса до начала меропориятия`))
        } else if (c.price1) {
            p.append(ce(`p`, false, `bold`, `Чтобы оплатить трансляцию, переведите ${cur(c.price1 ,`GEL`)} на ${c.paymentDesc || c.bankCreds  || `счет GE28TB7303145064400005`} — и скиньте боту скриншот с подтверждением платежа.`))
        }
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
