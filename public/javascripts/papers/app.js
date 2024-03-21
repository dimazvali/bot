let tg = window.Telegram.WebApp;

let coworkingHall, coworkindDate, coworkingRecord, curLecture, curLectureAppointment = null

let userid = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : userId
let userLang = tg.initDataUnsafe.user.language_code

let host = `paper`

function shimmer(light){
    if(light) return tg.HapticFeedback.impactOccurred('light')
    tg.HapticFeedback.notificationOccurred('success')
}

try{
    if(tg.initDataUnsafe.user.language_code != 'en' && translations.schedule[tg.initDataUnsafe.user.language_code]){
        let lang = tg.initDataUnsafe.user.language_code
            classes.querySelector('h2').innerHTML = translations.schedule[lang]
            coworking.querySelector('h2').innerHTML = translations.coworking[lang]
            mr.querySelector('h2').innerHTML = translations.mr[lang]
            profile.querySelector('h2').innerHTML = translations.profile[lang]
            contacts.querySelector('h2').innerHTML = translations.contacts[lang] 
            plans.querySelector('h2').innerHTML = translations.tariffs[lang] 
        
    }

} catch(err){
    console.error(err)
}

translations.bookOn = (d)=>{
    return {
        ru: `Забронировать на ${d}`,
        en: `Book on ${d}`
    }
}
translations.unbookOn = (d)=>{
    return {
        ru: `Снять бронь на ${d}`,
        en: `Cancel on ${d}`
    }
}

if(start){
    switch(start){

        case `tariffs`:{
            showTariffs()
            break;
        }

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

        default:{
            if(!start.indexOf(`class_`)){
                axios
                    .get(`/${host}/api/classes/${start.split(`_`)[1]}?user=${userid}`)
                    .then(data=>{
                        data.data.id = start.split(`_`)[1]
                        drawLecturePopup(data.data)
                    }).catch(err=>{
                        tg.showAlert(err.message)
                    })
            }

            if(!start.indexOf(`invite`)){
                console.log(`Переход по пришлашению`)
                let id = start.split('_')[1];
                axios
                    .get(`/${host}/api/invite/${id}?user=${userid}`)
                    .then(data=>{
                        
                        data = data.data
                        console.log(data)
                        if(data.success){
                            showCoworking(coworking.querySelector('h2'))
                            if(data.plans){
                                axios.put(`/${host}/api/plans/${data.plans}?user=${userid}`)
                                .then(tg.showAlert(`Спасибо! Ваш запрос отправлен администратору. Он свяжется с вами, чтобы внести оплату.`))
                                .catch(err=>{
                                    tg.showAlert(err.message)
                                })
                            }
                            
                                
                            // showCoworkingIntro(data.plans)
                        } else {
                            tg.showAlert(data.comment)
                        }
                    }).catch(handleError)
            }
        }
    }
}


function toggleStart(el){
    let i = +el.dataset.count;
    if(i==startSteps.length-1){
        i = 0
    } else {
        i++
    }
    console.log('new',i)

    let start = document.querySelector('#start')

    start.innerHTML = ''

    // let oldLength = start.children.length;
    // while (oldLength>=0){
    //     let l = start.children[oldLength]
        
    //     oldLength--;
        
    //     setTimeout(function(){
    //         l.classList.add('fade')
    //     },oldLength*100)

    //     setTimeout(function(){
    //         l.remove()
    //     },(oldLength*100)+100)

    // }

    let newData = startSteps[i]
    newData.forEach(line=>{
        start.append(ce(line[0],line[1],line[2],line[3],line[4]))
    })


    start.dataset.count = i

    console.log(i)
}

let startSteps = [
    [
        [`h1`,false,false,'what is Papers?'],
        ['img',false,'cs',false,{
            src:'/images/papers/cs.png'
        }],
        ['img',false,'bpc',false,{
            src:'/images/papers/bpc.svg'
        }]
    ],
    [[
        'p',false,false,`Papers is a space for media, science and IT industry professionals that combines coworking, an event space and bar.`
    ],['img',false,'cs',false,{
        src:'/images/papers/cs.png'
    }],
    ['img',false,'bpc',false,{
        src:'/images/papers/bpc.svg'
    }]],[
        ['h2',false,false,`Our mission`],
        ['p',false,false,`It is to help professionals from different countries get together, integrate into the local community and engage in dialogue. Everything we do is aimed at the community, networking, the idea of cooperation and support and mutual assistance. `]
    ],[
        ['h2',false,false,'In Papers you can:'],
        ['li',false,false,'rent a place to work for yourself or your team;'],
        ['li',false,false,'come to networking, entertainment and educational events or hold your own;'],
        ['li',false,false,'act as a speaker or host a master class;'],
        ['li',false,false,'get the help of a lawyer, designer, public speaking coach, as well as everything you need for paperwork: printer, scanner, copier.'],
    ]
    
]

tg.MainButton.setParams({
    color:`#9EEF27`,
    text_color: `#075B3F`
})


let user = {};

axios.get(`/paper/api/user?id=${userid}`).then(u => {
    
    user = u.data;

    if(u.data.warning){
        if(u.data.warning == 'noUser'){
            axios.post(`/paper/api/user/${tg.initDataUnsafe.user.id}`,tg.initDataUnsafe.user)
        }
        tg.showAlert(translations[u.data.warning][userLang] || translations[u.data.warning].en)
        if(u.data.warning == 'dataMissing') showProfile()
        console.log(u.data.fellow)    
    }

    if(u.data.fellow){
        document.querySelector('#fellows').append(ce('h2',false,false,'Fellows',{
            onclick:function(){
                showFellows(this, u.data.questions, u.data.answers)
            }
        }))
    }

    if(u.data.admin){
        let m = document.querySelector('.mobile')
        m.insertBefore(ce('h2',false,false,'Открыть админку',{
            onclick:()=>{
                shimmer(true)
                window.open('http://t.me/paperstuffbot/admin')
            }
        }),m.querySelectorAll('div')[1]) 
        
    }

    if(u.data.coworking.length){
        document.querySelector('#coworking').querySelector('h2').dataset.count = u.data.coworking.length;
    }

    if(u.data.mr.length){
        document.querySelector('#mr').querySelector('h2').dataset.count = u.data.mr.length;
    }

    if(u.data.userClasses.length){
        let tobe = u.data.classes.map(c=>c.id)
        console.log(tobe)
        console.log(u.data.userClasses.map(c=>c.id))
       let toCome =  u.data.userClasses.filter(c=>tobe.indexOf(c.class)>-1)
       console.log(toCome)
       if(toCome.length){
        document.querySelector('#classes').querySelector('h2').dataset.count = toCome.length
       }
    }

}).catch(err=>{
    console.log(err)
})

function handleError(err){
    tg.showAlert(err.message)
}

function list(){
    axios.post(`/paper/api/classes/${curLecture}?&user=${userid}&intention=book`).then(d=>{
        tg.showAlert(translations[d.data.text][tg.initDataUnsafe.user.language_code] || translations[d.data.text].en)
        shimmer(true)
        // mcb = clearPopUp;
        // clearPopUp()

        if(d.data.success){
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

function delist(){
    // tg.showAlert(`not ready yet. you should use /myclasses command instead`)
    axios.delete(`/paper/api/classes/${curLectureAppointment}?user=${userid}`).then(d=>{
        if(d.data.success){
            shimmer(true)
            tg.showAlert(translations[d.data.text][tg.initDataUnsafe.user.language_code] || translations[d.data.text].en)


            // mcb = clearPopUp;
            // clearPopUp()
            
            tg.MainButton.offClick(delist)
            mbbc = list
            tg.MainButton.setText(translations.book[[tg.initDataUnsafe.user.language_code]] || translations.book.en)
            tg.MainButton.onClick(list)

        } else {
            tg.showAlert(translations[d.data.text][tg.initDataUnsafe.user.language_code] || translations[d.data.text].en)
            tg.MainButton.offClick(delist)
            tg.MainButton.hide()
        }
    })
}

function showContacts(el){
    
    tg.BackButton.show();

    tg.onEvent('backButtonClicked',clearPopUp)
    
    mcb = clearPopUp

    let popup = ce('div',false,'popup')
        document.body.append(popup)
    let content = ce('div')
        popup.append(content)

    content.append(ce('h3',false,'light',(translations.address[userLang] || translations.address.en),{
        onclick:()=>{
            axios.post('/paper/sendMe/address',{
                user: userid
            })
            tg.close()
        }
    }))

    content.append(ce('p',false,'story',translations.iliani[userLang] || translations.iliani.en,{
        onclick:()=>{
            axios.post('/paper/sendMe/address',{
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

function showProfile(el){

    shimmer(true)

    tg.BackButton.show();

    tg.onEvent('backButtonClicked',clearPopUp)
    
    mcb = clearPopUp

    let popup = ce('div',false,'popup')
        document.body.append(popup)
    let content = ce('div')
        popup.append(content)

    content.append(ce('h2',false,'light',translations.profile[userLang]||translations.profile.en))

    content.append(ce('p',false,'info',translations.profileSubTitle[userLang]||translations.profileSubTitle.en))

    let loader = ce('p',false,false,translations.loading[userLang]||translations.loading.en)

    content.append(loader)
    
    mainButton(true)
    
    axios
        .get(`/paper/api/userData?user=${userid}`)
        .then(d=>{
            
            loader.remove()
            shimmer(true)

            let ud = d.data;

            content.append(ce('input',false,'hollow',false,{
                placeholder: translations.name[userLang] || translations.name.en,
                value: ud.first_name || null,
                onchange:function(){
                    if(this.value) axios.put(`/paper/api/profile/${userid}`,{
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
                    if(this.value) axios.put(`/paper/api/profile/${userid}`,{
                        last_name: this.value
                    }).then(s=>{
                        // tg.showAlert(translations.saved[userLang] || translations.saved.en)
                    })
                }
            }))

            content.append(ce('input',false,'hollow',false,{
                placeholder: translations.email[userLang] || translations.email.en,
                value: ud.email || null,
                onchange:function(){
                    if(this.value) axios.put(`/paper/api/profile/${userid}`,{
                        email: this.value
                    }).then(s=>{
                        // tg.showAlert(translations.saved[userLang] || translations.saved.en)
                    })
                }
            }))

            content.append(ce('textarea',false,'hollow',false,{
                placeholder: translations.about[userLang] || translations.about.en,
                value: ud.about || null,
                onchange:function(){
                    if(this.value) axios.put(`/paper/api/profile/${userid}`,{
                        about: this.value
                    }).then(s=>{
                        // tg.showAlert(translations.saved[userLang] || translations.saved.en)
                    })
                }
            }))

            let occupation = ce('select',false,false,false,{
                onchange:function(){
                    if(this.value){
                        axios.put(`/paper/api/profile/${userid}`,{
                            occupation: this.value
                        }).then(s=>{
                            // tg.showAlert(translations.saved[userLang] || translations.saved.en)
                        })
                    }
                }
            })

            content.append(occupation)

            let lcode = ce('select',false,false,false,{
                onchange:function(){
                    if(this.value){
                        axios.put(`/paper/api/profile/${userid}`,{
                            language_code: this.value
                        }).then(s=>{
                            // tg.showAlert(translations.saved[userLang] || translations.saved.en)
                        })
                    }
                }
            })

            lcode.append(ce('option',false,false,'en',{
                value: 'en',
                selected: ud.language_code == 'en' ? true : false
            }))

            lcode.append(ce('option',false,false,'ru',{
                value: 'ru',
                selected: ud.language_code == 'ru' ? true : false
            }))

            lcode.append(ce('option',false,false,'ka',{
                value: 'ka',
                selected: ud.language_code == 'ka' ? true : false
            }))

            content.append(lcode)

            let sublabel = ce('label',false,false,translations.notifications[userLang] || translations.notifications.en,{
                dataset:{
                    chekable: true,
                    checked: !user.noSpam
                },
                onclick: function(){
                    axios.put(`/paper/api/profile/${userid}`,{
                        noSpam: !user.noSpam
                    }).then(()=>{
                        user.noSpam = !user.noSpam;
                        this.dataset.checked = !user.noSpam;
                        shimmer(true)
                    }).catch(err=>{
                        shimmer()
                        tg.showAlert(err.message)
                    })
                }
            })

            let rclabel = ce('label',false,false,`Random Coffee`,{
                dataset:{
                    chekable: true,
                    checked: !user.randomCoffee
                },
                onclick: function(){
                    axios.put(`/paper/api/profile/${userid}`,{
                        randomCoffee: !user.randomCoffee
                    }).then(()=>{
                        user.randomCoffee = !user.randomCoffee;
                        this.dataset.checked = !user.randomCoffee;
                        shimmer(true)
                    }).catch(err=>{
                        shimmer()
                        tg.showAlert(err.message)
                    })
                }
            })
            
            

            content.append(sublabel)
            content.append(rclabel)

            content.append(ce('button',false,'dateButton',translations.save[userLang] || translations.save.en,{
                onclick:()=>{
                    mcb = clearPopUp;
                    clearPopUp()
                }
            }))

            occupation.append(ce('option',false,false,translations.occupation[userLang] || translations.occupation.en))
            
            occupation.append(ce('option',false,false,translations.media[userLang] || translations.media.en,{
                value: 'media',
                selected: ud.occupation == 'media' ? true : false
            }))

            occupation.append(ce('option',false,false,translations.lawyer[userLang] || translations.lawyer.en,{
                value: 'lawyer',
                selected: ud.occupation == 'lawyer' ? true : false

            }))

            occupation.append(ce('option',false,false,translations.advertisement[userLang] || translations.advertisement.en,{
                value: 'advertisement',
                selected: ud.occupation == 'advertisement' ? true : false

            }))

            occupation.append(ce('option',false,false,translations.it[userLang] || translations.it.en,{
                value: 'it',
                selected: ud.occupation == 'it' ? true : false

            }))

            occupation.append(ce('option',false,false,translations.other[userLang] || translations.other.en,{
                value: 'other',
                selected: ud.occupation == 'other' ? true : false

            }))


        }).catch(err=>{
            handleError
        }).finally(()=>{
            mainButton(false)
        })

}

function showMR(el){
    
    shimmer(true)

    if(el.className.indexOf('switched')>-1){
        el.classList.remove('switched')    
        el.parentNode.classList.remove('open')
        el.parentNode.querySelectorAll('.dateButton').forEach(c=>c.remove())
    } else {
        mainButton(true)
        el.classList.add('switched')    
        el.parentNode.classList.add('open')
        axios.get(`/paper/api/mr?user=${userid}`).then(data=>{
            data.data.forEach(date=>{
                el.parentNode.append(drawDay(date))
            })
        }).catch(err=>{
            tg.showAlert(err.data)
        }).finally(()=>{
            mainButton(false)
        })
    }
}

function book(){
    tg.MainButton.showProgress()
    axios.post(`/paper/api/coworking/${coworkingHall}?date=${coworkindDate}&user=${userid}`).then(d=>{
        switch(d.data.success){
            case true:{
                tg.showAlert(translations[d.data.text][tg.initDataUnsafe.user.language_code] || translations[d.data.text].en)
                
                mcb = clearPopUp;
                clearPopUp()

                showCoworking(coworking.querySelector('h2'))
                
                // coworkingRecord = d.data.record
                // tg.MainButton.offClick(book)
                // mbbc = unBook
                // document.querySelector(`[data-date="${coworkindDate}"]`).dataset.booked = 1;
                // document.querySelector(`[data-date="${coworkindDate}"]`).innerHTML += ` (${translations.enlisted[userLang] || translations.enlisted.en})`
                // tg.MainButton.setText(translations.unbookOn(coworkindDate)[userLang] || translations.unbookOn(coworkindDate).en)
                // tg.MainButton.onClick(unBook)
            }
            default:
                tg.showAlert(translations[d.data.text][tg.initDataUnsafe.user.language_code] || translations[d.data.text].en)
        }
        
    }).catch(err=>{
        tg.showAlert(translations[err.data][tg.initDataUnsafe.user.language_code] || translations[err.data].en)
    }).finally(()=>{
        tg.MainButton.hideProgress()
    })
}

function unBook(){
    tg.MainButton.showProgress()
    axios.delete(`/paper/api/coworking/${coworkingRecord}?date=${coworkindDate}&user=${userid}`).then(d=>{
        tg.showAlert(translations[d.data][tg.initDataUnsafe.user.language_code] || translations[d.data].en)
        
        mcb = clearPopUp;
        
        clearPopUp()
        
        showCoworking(coworking.querySelector('h2'))
        // tg.MainButton.offClick(unBook)
        // mbbc = book
        // document.querySelector(`[data-date="${coworkindDate}"]`).dataset.booked = 0;
        // document.querySelector(`[data-date="${coworkindDate}"]`).innerHTML = document.querySelector(`[data-date="${coworkindDate}"]`).innerHTML.replace((translations.enlisted[userLang] || translations.enlisted.en),'')
        // tg.MainButton.setText(translations.bookOn(coworkindDate)[userLang] || translations.bookOn(coworkindDate).en)
        // tg.MainButton.onClick(book)
    }).catch(err=>{
        tg.showAlert(translations[err.data][tg.initDataUnsafe.user.language_code] || translations[err.data].en)
    }).finally(()=>{
        tg.MainButton.hideProgress()
    })
}


function showQuestions(el,q,a){
    tg.BackButton.show();

    tg.onEvent('backButtonClicked',clearPopUp)
    mcb = clearPopUp

    let popup = ce('div',false,'popup')
    document.body.append(popup)
    let content = ce('div')
    popup.append(content)

    q.forEach(q=>{

        let answer = a.filter(answer => answer.q == q.id)[0]
        
        let qc = ce('div',false,['short',answer?'answered':'tobeanswered'])
            qc.append(ce('h3',false,'light',q.name,{
                onclick:()=> qc.classList.toggle('short')
            }))
            qc.append(ce('p',false,false,q.text))
            let ans = ce('textarea',false,false,false,{
                placeholder: `Вам слово.`,
                value:  answer ? answer.text : null
            })
            qc.append(ans)
            qc.append(ce('button',false,'dateButton','Отправить',{
                onclick:function(){
                    
                    if(ans.value){
                        ans.setAttribute('disabled',true)
                        this.setAttribute('disabled',true)
                        
                        axios.post(`/paper/api/polls/${q.id}`,{
                            text: ans.value,
                            fellow: userid
                        }).then(()=>{
                            tg.showAlert('Спасибо!')
                        }).catch(err=>{
                            tg.showAlert(err.message)
                        }).finally(()=>{
                            ans.removeAttribute('disabled')
                            this.removeAttribute('disabled')
                        })
                    }
                    
                }
            }))
            qc.append()
        content.append(qc)
    })
}



function showFellows(el, questions, answers){    

    el.scrollIntoView({block: "start", behavior: "smooth"})

    if(el.className.indexOf('switched')>-1){
        el.classList.remove('switched')    
        el.parentNode.classList.remove('open')
        el.parentNode.querySelectorAll('.class').forEach(c=>c.remove())
    } else {
        mainButton(true)
        el.classList.add('switched')    
        el.parentNode.classList.add('open')
        
        if(questions){
            el.parentNode.append(ce('h3',false,false,'Есть вопросы',{
                onclick:function(){
                    showQuestions(this, questions, answers)
                }
            }))
        }
        
        
        axios.get(`/paper/api/usersList?user=${userid}&type=fellow`).then(data=>{
            data.data.sort((a,b)=>b.username < a.username?1:-1).forEach(user=>{
                el.parentNode.append(drawUser(user))
            })
        }).catch(err=>{
            tg.showAlert(err.data)
        }).finally(()=>{
            mainButton(false)
        })
    }

}

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

function showTariffs(){
    let p = preparePopup(`tariffs`)
        p.append(ce(`h1`,false,false,translations.tariffs[userLang]||translations.tariffs.en))
        userLoad(`tariffs`).then(list=>{
            list.forEach(t=>{
                p.append(ce(`h3`,false,`light`,t.name,{
                    onclick:()=>{
                        showTariff(t.id)     
                    }
                }))
            })
        })
}


function showTariff(id){
    let c = preparePopup(`tariffs`)
        userLoad(`tariffs`,id).then(p=>{
            c.append(ce(`h1`,false,false,p.name))
            c.append(ce(`div`,false,false,p.description.replace(/\\n/i,'<br>')))
            c.append(ce(`p`,false,false,`Стоимость: ${cur(p.price,`GEL`)}.`))
            if(p.inUse && p.inUse.to){
                c.append(ce(`p`,false,false,`valid till: ${drawDate(p.inUse.to._seconds*1000,userLang)}`))
            } else {
                tg.MainButton.setText(translations.book[userLang] || translations.book.en)
                tg.MainButton.show()
                tg.MainButton.onClick(()=>requestPlan(p.id))
            }
        })
}

function showStatic(id){
    let p = preparePopup(`static`)
        userLoad(`static`,id).then(page=>{
            p.append(ce('h1',false,false,page.name))
            if(page.pic) p.append(ce('img',false,`cover`,false,{
                src: page   .pic
            }))
            p.append(ce(`div`,false,false,page.description))
        })
}


function userLoad(collection, id) {
    return axios.get(`/${host}/api/${collection}${id?`/${id}`:''}${userid?`?id=${userid}`:''}`).then(data => {
        return data.data
    })
}

function showCoworking(el){

    el.scrollIntoView({block: "start", behavior: "smooth"})

    shimmer(true)

    if(el.className.indexOf('switched')>-1){
        el.classList.remove('switched')    
        el.parentNode.classList.remove('open')
        el.parentNode.querySelectorAll('.class').forEach(c=>c.remove())
    } else {
        mainButton(true)
        el.classList.add('switched')    
        el.parentNode.classList.add('open')

        if(!user.admin && !user.fellow && !user.insider && !user.known){
            el.parentNode.append(ce('p',false,false,translations.toKnow[userLang] || translations.toKnow.en))
        }

        axios.get(`/paper/api/coworking?user=${userid}`).then(data=>{
            data.data.sort((a,b)=>b.name.toString()<a.name.toString()?1:-1).forEach(room=>{
                el.parentNode.append(drawRoom(room))
            })
        }).catch(err=>{
            tg.showAlert(err.data)
        }).finally(()=>{
            mainButton(false)
        })
    }
}

function showSchedule(el){
    
    shimmer(true)

    if(el.className.indexOf('switched')>-1){
        el.classList.remove('switched')    
        el.parentNode.classList.remove('open')
        el.parentNode.querySelectorAll('.class').forEach(c=>c.remove())
    } else {
        mainButton(true)
        el.classList.add('switched')    
        el.parentNode.classList.add('open')
        axios.get(`/paper/api/classes?user=${userid}`).then(classes=>{

            classes.data.forEach(cl => {
                el.parentNode.querySelector('.data').append(drawLecture(cl))
            });

            if(!classes.data.length){
                el.parentNode.querySelector('.data').append(ce('p',false,false,translations.noSchedule[tg.initDataUnsafe.user.language_code] || translations.noSchedule.en))
            }
        })
        .catch(err=>handleError)
        .finally(()=>{
            mainButton(false)
        })
    }
    
}

function requestPlan(id){
    tg.MainButton.showProgress()
    axios.post(`/${host}/api/tariffs/${id}?id=${userid}`,{
        user: userid
    }).then(s=>{
        if(s.data.success){
            
            mcb = clearPopUp;
            tg.showAlert(s.data.comment)
        }
    }).catch(err=>{
        tg.showAlert(err.message)
    }).finally(()=>{
        tg.MainButton.hideProgress()
        tg.MainButton.hide()
    })
}

function clearPopUp(){
    let p = document.querySelector('.popup')
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
let mbbc = null;

function showCoworkingIntro(plans){
    let p = preparePopup();
    p.append(ce('h2',false,'light', `Тарифные планы`))
    plans.forEach(plan=>{
        let c = ce('div')
        c.append(ce('h3',false,'light',plan.name))
        if(plan.description){
            c.append(ce('p',false,false,plan.description.replace(/\\n/i,'<br>')))
            c.append(ce('button',false,'dateButton',cur(plan.price,'GEL'),{
                onclick:function(){
                    shimmer(true)
                    this.setAttribute(`disabled`,true)
                    axios.put(`/${host}/api/plans/${plan.id}?user=${userid}`)
                        .then(tg.showAlert(`Спасибо! Ваш запрос отправлен администратору. Он свяжется с вами, чтобы внести оплату.`))
                        .catch(err=>{
                            tg.showAlert(err.message)
                        })
                        .finally(()=>{
                            this.removeAttribute(`disabled`)
                        })
                }
            }))
        }
        p.append(c)
    })
}

function showBar(){
    let p = preparePopup()

    p.append(ce('h2',false,'light',`Papers Bar`))

    let loader = ce('p',false,false,`Разливаем меню...`)

    p.append(loader)

    axios.get(`/paper/api/menu`).then(data=>{
        // console.log(data.data)
        loader.innerHTML = `Бар в саду<br>(или в подвале — как кому нравится).`
        let menu = data.data;
        menu.menu.data.filter(m=>m.language == `english`)[0].sections.forEach(s=>{
            p.append(ce('h3',false,'light',s.name.toUpperCase()))
            if(s.title) p.append(ce('p',false,false,s.title))
            s.dishes.filter(d=>!d.stopList).forEach(d=>{
                p.append(ce('p',false,false,`<span class="story">${d.name}</span> <span class="price">${cur(d.price,`GEL`)}<span>`))
            })
        })
    })
}

// function preparePopup(){
//     tg.BackButton.show();
//     tg.onEvent('backButtonClicked',clearPopUp)
//     mcb = clearPopUp
//     let popup = ce('div',false,'popup')
//         document.body.append(popup)
//     let content = ce('div')
//         popup.append(content)
//     return content    
// }

function drawDay(d){
    console.log(d)
    let c = ce('div')
    c.append(ce('button',false,['dateButton',(d.slots.filter(s=>s.self).length?'occupied':null)],drawDate(d.date,userLang),{
        dataset:{
            booked: 1
        },
        onclick:function(){
            
            shimmer(true)

            tg.BackButton.show();
            tg.onEvent('backButtonClicked',clearPopUp)
            mcb = clearPopUp

            let popup = ce('div',false,'popup')
                document.body.append(popup)
            let content = ce('div')
                popup.append(content)

            let h = ce('div',false,'header')
                h.append(ce('h3',false,false,(translations.mr[userLang] ||translations.mr.en)))
                h.append(ce('h5',false,false,d.date))
                popup.style.backgroundImage = `url(https://firebasestorage.googleapis.com/v0/b/paperstuff-620fa.appspot.com/o/coworking%2F2023-01-17%2009.58%201.jpg?alt=media&token=a1520476-d466-43e4-8c71-afa6c045b0ae)`
            content.append(h)
            let timing = ce('div',false,'timing')
            d.slots.forEach(slot=>{
                timing.append(ce('button',false,'dateButton',slot.time+(slot.self?` (${translations.enlisted[userLang] || translations.enlisted.en})` :''),{
                    dataset:{
                        booked: !slot.available,
                        time: slot.time,
                        self: slot.self ? true : false
                    },
                    onclick:()=>{
                        
                        shimmer(true)

                        mrDate = d.date,
                        mrTime = slot.time
                        mrSlot = slot.self

                        if(slot.self){
                            tg.MainButton.setText(translations.unbookOn(slot.time)[userLang] || translations.unbookOn(slot.time).en)
                            tg.MainButton.show()
                            tg.MainButton.onClick(unSlot)
                            mbbc = unSlot
                        } else if (slot.available){
                            tg.MainButton.setText(translations.bookOn(slot.time)[userLang] || translations.bookOn(slot.time).en)
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

function slotme(){
    tg.MainButton.showProgress()
    axios.post(`/paper/api/mr/new?date=${mrDate}&time=${mrTime}&user=${userid}`).then(d=>{
        if(d.data.success){

            mcb = clearPopUp;
            clearPopUp()

            showMR(mr.querySelector('h2'))

            // mrSlot = d.data.id;
            // tg.MainButton.offClick(slotme)
            // mbbc = unSlot
            // document.querySelector(`[data-time="${mrTime}"]`).dataset.booked = true;
            // document.querySelector(`[data-time="${mrTime}"]`).innerHTML+=`<br>(${translations.enlisted[userLang] || translations.enlisted.en})`
            // document.querySelector(`[data-time="${mrTime}"]`).dataset.self = true;
            // tg.showAlert(translations.coworkingBookingConfirmed[tg.initDataUnsafe.user.language_code] || translations.coworkingBookingConfirmed.en)
            // tg.MainButton.setText(translations.coworkingBookingCancel[[tg.initDataUnsafe.user.language_code]] || translations.coworkingBookingCancel.en)
            // tg.MainButton.onClick(unSlot)
        } else {
            tg.showAlert(translations[d.data.text][tg.initDataUnsafe.user.language_code] || translations[d.data.text].en)
            tg.MainButton.offClick(slotme)
            tg.MainButton.hide()
        }
        
    }).catch(err=>{
        tg.showAlert(translations[err.data][tg.initDataUnsafe.user.language_code] || translations[err.data].en)
    }).finally(()=>{
        tg.MainButton.hideProgress()
    })
}

function unSlot(){
    tg.MainButton.showProgress()
    axios.delete(`/paper/api/mr/${mrSlot}?date=${mrDate}&time=${mrTime}&user=${userid}`).then(d=>{
        
        if(d.data.success){
            tg.showAlert(translations[d.data.text][tg.initDataUnsafe.user.language_code] || translations[d.data.text].en)
            
            mcb = clearPopUp;
            clearPopUp()

            showMR(mr.querySelector('h2'))

            // document.querySelector(`[data-time="${mrTime}"]`).dataset.booked = false;
            // document.querySelector(`[data-time="${mrTime}"]`).innerHTML= `${mrTime}`
            
            // tg.MainButton.offClick(unSlot)
            // mbbc = slotme
            // tg.MainButton.setText(translations.book[[tg.initDataUnsafe.user.language_code]] || translations.book.en)
            // tg.MainButton.onClick(slotme)
        } else {
            tg.showAlert(translations[d.data.text][tg.initDataUnsafe.user.language_code] || translations[d.data.text].en)
            tg.MainButton.offClick(unSlot)
            tg.MainButton.hide()
        }
    
    }).catch(err=>{
        tg.showAlert(translations[err.data][tg.initDataUnsafe.user.language_code] || translations[err.data].en)
    }).finally(()=>{
        tg.MainButton.hideProgress()
    })
}

function drawRoom(r){
    let c = ce('div',false,'class',false,{
        onclick:()=>{

            shimmer(true)

            tg.BackButton.show();
            tg.onEvent('backButtonClicked',clearPopUp)
            mcb = clearPopUp

            let popup = ce('div',false,'popup')
            document.body.append(popup)
            let content = ce('div')
            popup.append(content)

            let h = ce('div',false,'header')
                    h.append(ce('h3',false,false,`${(translations.room[userLang] || translations.room.en)} ${r.name}`))
                    h.append(ce('h5',false,false,r.description || 'тут могло бы быть описание'))
                    h.append(ce('h6',false,'pointer',(translations.coworkingRules[tg.initDataUnsafe.user.language_code] ||translations.coworkingRules.en),{
                        onclick:()=>{
                            shimmer(true)
                            tg.showAlert((coworkingRules[tg.initDataUnsafe.user.language_code] || coworkingRules.en ).join('\n'))
                        }
                    }))
                    popup.style.backgroundImage = `url('${r.pics.split(',')[0] || 'https://firebasestorage.googleapis.com/v0/b/paperstuff-620fa.appspot.com/o/coworking%2F2023-01-17%2009.58%201.jpg?alt=media&token=a1520476-d466-43e4-8c71-afa6c045b0ae'}')`
                content.append(h)
            
                axios.get(`/paper/api/coworking/${r.id}?user=${userid}`).then(dates=>{
                    dates.data.forEach((d,i)=>{
                        setTimeout(function(){
                            content.append(ce('button',false,'dateButton',`${drawDate(d.date,userLang)} ${d.booked ? `<br>(${translations.enlisted[userLang] || translations.enlisted.en})` : `(${d.capacity} ${translations.seats[userLang] || translations.seats.en})`}`,{
                                dataset:{
                                    booked: d.booked,
                                    date: d.date
                                },
                                onclick:()=>{
                                    shimmer(true)
                                    
                                    coworkingHall = r.id
                                    coworkindDate = d.date
                                    coworkingRecord= d.record

                                    if(+d.booked){


                                        tg.MainButton.setText(translations.unbookOn(d.date)[userLang] || translations.unbookOn(d.date).en)
                                        tg.MainButton.show()
                                        tg.MainButton.onClick(unBook)
                                        mbbc = unBook

                                    } else {
                                        
                                        
                                        tg.MainButton.setText(translations.bookOn(d.date)[userLang] || translations.bookOn(d.date).en)
                                        tg.MainButton.show()
                                        
                                        tg.MainButton.onClick(book)
                                        mbbc = book
                                        
                                    }
                                }
                            }))
                        },i*150)
                    })
                })


                // tg.MainButton.setText('ПРОВЕРИТЬ')
                // tg.MainButton.show()
                // tg.MainButton.onClick(sendOrder)

        }
    })
        c.append(ce('h3',false,false,(translations.room[userLang] || translations.room.en)+' '+r.name))
        c.append(ce('h3',false,false,r.floor+" "+(translations.floor[userLang] || translations.floor.en)+", "+r.capacity+' '+(translations.seats[userLang] || translations.seats.en)))
    return c;
}

function uname(u,id){
    return `${u.username ? `@${u.username}` : `id ${id}` } (${u.first_name||''} ${u.last_name||''})`
}

function drawUser(u){
    let cl = ce('div',false,'class')
        cl.append(ce('h4',false,'mtop20',uname(u,u.id),{
            onclick:()=>{
                shimmer(true)
                tg.openTelegramLink(`https://t.me/${u.username}`)
            }
        }))
    if(u.about) cl.append(ce('p',false,'story',u.about))
    return cl
}


function rateClass(cl,rate,container){
    axios.post(`/${host}/api/classes/review?intention=rate`,{
        className: cl.name,
        class:  cl.id,
        ticket: cl.appointmentId,
        rate:   rate 
    }).then(s=>{
        tg.showAlert(translations.thanks[userLang] || translations.thanks.en)
        container.remove();        
    }).catch(err=>{
        tg.showAlert(err.message)
    })
       
}

function drawLectureReview(cl){
    let c = ce('div')

    c.append(ce('h2',false,'light', translations.review[userLang] || translations.review.en))
    let numContainer = ce('div',false,`flex`)
    let i = 1
    while(i<6){
        numContainer.append(ce('button',false,`num`,i,{
            onclick:()=>rateClass(cl,i,numContainer)
        }))
        i++
    }
    c.append(numContainer)

    let txt = ce('textarea',false,false,false,{
        placeholder: translations.askForReview[userLang] || translations.askForReview.en
    })

    c.append(txt)

    c.append(ce('button',false,`dateButton`,`Отправить`,{
        onclick:function(){
            if(!txt.value) return tg.showAlert(translations.askForReview[userLang] || translations.askForReview.en)
            axios.post(`/${host}/api/classes/review?intention=review`,{
                className: cl.name,
                class: cl.id,
                ticket: cl.appointmentId,
                text:   txt.value 
            }).then(s=>{
                tg.showAlert(translations.thanks[userLang] || translations.thanks.en)
                this.remove();
                c.append(ce('p',false,false,txt.value))
                
                txt.remove()
            }).catch(err=>{
                tg.showAlert(err.message)
            })
        }
    }))

    return c;
}


function drawLectureQuestion(cl){
    let c = ce('div')

    c.append(ce('button',false,'dateButton',`Задать вопрос`,{
        onclick:function(){
            shimmer(true)
            this.innerHTML = `Загружаем`
            this.setAttribute(`disabled`,true)
            axios.get(`/${host}/api/q/?class=${cl.id}`).then(data=>{
                if(data.data.length){
                    let before = ce('ul')
                        c.prepend(before);
                        c.prepend(ce(`h4`,false,'light',`Что успели спросить?`))
                    data.data.sort((a,b)=>b.createdAt._seconds-a.createdAt._seconds).forEach(q=>{
                        before.prepend(ce(`li`,false,'story',q.text))
                    })
                } else {
                    c.prepend(ce(`p`,false,'story',`Кажется, ваш вопрос будет первым`))
                }
                let txt = ce('textarea',false,false,false,{
                    placeholder: `Вам слово`,
                    oninput: () => this.removeAttribute(`disabled`)
                })
                c.insertBefore(txt,this)
                this.innerHTML = `Отправить`
                this.onclick = ()=>{
                    shimmer(true)
                    axios.post(`/${host}/api/q/new`,{
                        class:  cl.id,
                        user:   userid,
                        text:   txt.value
                    }).then(s=>{
                        
                        txt.remove()
                        this.remove()
                        tg.showAlert(s.data.comment)
                    }).catch(err=>{
                        tg.showAlert(err.message)
                    })
                }
            })
        }
    }))

    return c;
}

function drawLecturePopup(c){

        console.log(c);

        shimmer(true)

        curLecture = c.id

        if(c.appointmentId) curLectureAppointment = c.appointmentId
        
        tg.BackButton.show();
        tg.onEvent('backButtonClicked',clearPopUp);
        
        mcb = clearPopUp

        if(!c.noRegistration && !c.used){
            if(c.booked){
                tg.MainButton.setText(translations.coworkingBookingCancel[userLang] || translations.coworkingBookingCancel.en)
                tg.MainButton.show()
                tg.MainButton.onClick(delist)
                mbbc = delist

            } else {
                tg.MainButton.setText(translations.book[userLang] || translations.book.en)
                tg.MainButton.show()
                
                tg.MainButton.onClick(list)
                mbbc = list
                
            }
        }

        let popup = ce('div',false,'popup')
            let content = ce('div')
            let h = ce('div',false,'header')
                h.append(ce('h3',false,false,`${drawDate(c.date)}<br>${new Date(c.date).toLocaleTimeString('ru-RU', {timeZone: 'Asia/Tbilisi', hour: '2-digit', minute:'2-digit'})}`))
                h.append(ce('h5',false,false,c.author))
                h.append(ce('h5',false,false,`@${c.hallName}`))

                if(c.price){
                    h.append(ce('h5',false,false,cur(c.price,'GEL')))
                }

                if(c.pic){
                    h.append(ce('img',false,false,false,{
                        src: c.clearPic || c.pic 
                    }))
                }
            content.append(h)
            content.append(ce('h1',false,'viv',c.name))
            
            let desc = ce('div')
            
            c.description.split('\n').filter(p=>p).forEach(p=>{
                desc.append(ce('p',false,'story',p))
            })

            content.append(desc)

            if(c.status == 'used') {
                content.append(drawLectureQuestion(c))
                content.append(drawLectureReview(c))
            }
            popup.append(content)
            document.body.append(popup)
}

function drawLecture(c){
    let cl = ce('div',false,'class')


        // cl.append(ce('h3',false,false,`${new Date(c.date._seconds*1000).toLocaleDateString('ru-RU',{day: '2-digit',month: '2-digit'})} / ${new Date(c.date._seconds*1000).toLocaleTimeString('ru-RU', {timeZone: 'Asia/Tbilisi',hour: '2-digit', minute:'2-digit'})}`))
        
        cl.append(ce('h3',false,false,`${drawDate(c.date,userLang)} / ${new Date(c.date).toLocaleTimeString('ru-RU', {timeZone: 'Asia/Tbilisi',hour: '2-digit', minute:'2-digit'})}`))
        
        cl.append(ce('h4',false,(c.fellows?'fellows':null),`${c.name}`))
        
        if(c.subTitle) cl.append(ce('h4',false,false,`${c.subTitle}`))
        
        cl.append(ce('h5',false,false,`${c.author}`))
        
        cl.onclick = () => drawLecturePopup(c)
        
        

    
    return cl

}