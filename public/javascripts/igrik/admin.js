
function movetotop(){
    
        footer.style.bottom = 'initial'
        footer.style.top = '10px';
    
}

function sendReply(id){
    let txt =document.querySelector(`#response`) 
    if(txt.value){
        window.Telegram.WebApp.MainButton.showProgress()
        axios.post(`/igrik/api/postMessage`,{
            user:   id,
            text:   txt.value,
            admin:  window.Telegram.WebApp.initDataUnsafe.user.id
        }).then(()=>{
            
            let c = ce('div',false,false,false,{
                dataset:{
                    answer:true
                }
            })

            c.append(ce('span',false,'info',new Date().toLocaleString()))
            c.append(ce('p',false,false,txt.value))
            messages.prepend(c)

            txt.value = null

        }).catch(err=>{
            window.Telegram.WebApp.showAlert(err.message)    
        })
    } else {
        window.Telegram.WebApp.showAlert(`Я не вижу ваших букв!`)
    }
    
}

let tg =window.Telegram.WebAppж

window.onload =()=>{
    window.Telegram.WebApp.BackButton.show();
    window.Telegram.WebApp.onEvent('backButtonClicked',showStart)
}

function showStart(){
    window.location.search = `?action=start`
}

function publish(pub){
    axios.patch(`/igrik/api/news/${pub}`,{
        admin: window.Telegram.WebApp.initDataUnsafe.user.id,
        update:{
            active: true
        }
    }).then(()=>{
        tg.showAlert(`ok`)
        window.location.reload()
    }).catch(err=>{
        tg.showAlert(err.message)
    })
}

function postNews(pub){
    axios.post(`/igrik/api/news/${pub}`,{
        admin: window.Telegram.WebApp.initDataUnsafe.user.id,
        update:{
            active: true
        }
    }).then(()=>{
        tg.showAlert(`ok`)
        window.location.reload()
    }).catch(err=>{
        tg.showAlert(err.message)
    })
}

function checkUser(){
    axios.get(`/igrik/api/checkUser?admin=${window.Telegram.WebApp.initDataUnsafe.user.id}`).then(s=>{
        let main = document.querySelector('.mobile');  
        main.innerHTML = ``;

        let c = ce('div',false,'container')
        main.append(c)
        let users = ce('div')
            users.append(ce('button',false,false,'Открыть пользователей',{
                onclick:()=>showUsers(users, s.data.users)
            }))
        let news = ce('div')
            news.append(ce('button',false,false,'Открыть новости',{
                onclick:()=>showNews(news, s.data.news)
            }))
        let qr = ce('div')
            qr.append(ce('button',false,false,'Открыть QR',{
                onclick:()=>showQR(qr)
            }))
        
        c.append(users)
        c.append(news)
        c.append(qr)

    }).catch(err=>{
        document.querySelector(`#starter`).innerHTML = 'Простите, вам сюда нельзя.'
    })
}

function updateUser(user,field,el){
    if(el.value){
        axios.patch(`/igrik/api/user`,{
            user: user,
            admin: window.Telegram.WebApp.initDataUnsafe.user.id,
            update:{
                [field]:el.value
            }
        }).then(()=>{
            tg.showAlert(`ok`)
        }).catch(err=>{
            tg.showAlert(`упс: ${err.message}`)
        })
    }
}

function showUsers(c, users){
    c.innerHTML = '';

    c.append(ce('input',false,false,false,{
        placeholder: `поиск по имени`,
        oninput:function(){
            if(!this.value){
                c.querySelectorAll('button').forEach(u=>u.classList.remove('hidden'))
            } else {
                c.querySelectorAll('button').forEach(u=>{
                    if(u.innerHTML.indexOf(this.value)>-1){
                        u.classList.remove('hidden')
                    } else {
                        u.classList.add('hidden')
                    }
                })
            }
        }
    }))

    c.append(ce('p',false,'info',`всего ${users.length} юзеров`))

    users.sort((a,b)=>(b.recentMessage ? b.recentMessage._seconds : null) < (a.recentMessage? a.recentMessage._seconds : null) ? -1 : 1).forEach(u => {
        c.append(ce('button',false,false,(u.recentMessage ? drawDate(u.recentMessage._seconds*1000) : '')+(u.first_name||'')+' '+(u.last_name||'')+(u.username?` @${u.username} `:'')+(u.phone?`<br>${u.phone}`:'📵'),{
            onclick: () => window.location.search = `?action=messenger&user=${u.id}`
        }))
    });
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

function showQR(c){
    c.innerHTML = '';
    c.append(ce('p',false,false,`Здесь вы можете сгенерировать ссылку и qr-код, проходя по которым пользователи будут получать тот или иной тег.`))
    c.append(ce('p',false,false,`(очень полезно для оценки эффективности маркетинговых кампаний)`))
    let tag = ce('input',false,false,false,{
        placeholder: `введите тег`
    })
    let b = ce('button',false,false,'Сгенерировать',{
        onclick:()=>{
            if(!tag.value) return tg.showAlert(`Вы не указали тег`)

            c.append(ce('input',false,false,`ссылка на бот`,{
                value: `https://t.me/igrikyobot?start=campaign_${tag.value}`
            }))
            c.append(ce('a',false,false,`ссылка QR-код`,{
                // href: `/igrik/qr?tag=${tag.value}`,
                onclick:()=> tg.openLink(`/igrik/qr?tag=${tag.value}`)
            }))
            c.append(ce('img',false,false,false,{
                src: `/igrik/qr?tag=${tag.value}`,
                style: `width: 100%;`
            }))
        }
    })
    c.append(tag)
    c.append(b)

}

function showNews(c,news){
    c.innerHTML = '';
    c.append(ce('button',false,false,'Добавить новость',{
        onclick:()=>newPub(c)
    }))
    news.forEach(n=>{
        c.append(ce('p',false,false,n.title,{
            onclick:()=> window.location.search = `?action=news&publication=${n.id}`
        }))
    })
}

function newPub(c){
    c.innerHTML = '';
    let h = ce('input',false,false,false,{
        placeholder: `Заголовок`
    })
    
    let pic = ce('input',false,false,false,{
        placeholder: `id картинки`
    })

    let vid = ce('input',false,false,false,{
        placeholder: `id видео`
    })
    c.append(h)
    c.append(pic)
    c.append(vid)
    c.append(ce('span',false,false,'Чтобы получить id картинки или видео, просто отправьте боту фото или видео.'))

    let txt = ce('textarea',false,false,false,{
        placeholder: 'текст новости'
    })
    c.append(txt)
    c.append(ce('button',false,false,'Сохранить',{
        onclick:()=>pushNews(h.value,vid.value,txt.value, pic.value)
    }))

    c.append(ce('p',false,false,`Сначала вам нужно сохранить публикацию. Потом вы сможете ее перепроверить и "опубликовать". После этого публикация станет доступна в разделе "Новости" в приложении. Ранее опубликованное сообщение можно еще и разослать (сообщение уйдет всем гостям).`))
}

function pushNews(h,v,t,p){
    if (!h) return tg.showAlert(`Без заголовка никак нельзя`)
    if ((!v && !t) || (!v && !p && !t)) return tg.showAlert(`Либо текст, либо видео, либо картинку — в студию`)

    axios.post(`/igrik/api/news`,{
        admin: window.Telegram.WebApp.initDataUnsafe.user.id,
        title: h,
        text: t,
        video: v,
        photo: p
    }).then(s=>{
        window.location.search=`?action=news&publication=${s.data}`
    }).catch(err=>{
        tg.showAlert(err.message)
    })
}