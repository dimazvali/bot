
let tg = window.Telegram.WebApp;

let userid = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : userId
let userLang = tg.initDataUnsafe.user.language_code

let host = `cyprus`

let mbbc = null;
function shimmer(light){
    if(light) return tg.HapticFeedback.impactOccurred('light')
    tg.HapticFeedback.notificationOccurred('success')
}

if(start){
    switch(start){

        // case 'news': {
        //     showNews()
        //     break;
        // }
    }
}

let user = {};

let news = document.querySelector(`#news`)

axios.get(`/${host}/api/news?user=${userid}`).then(u => {

    tg.MainButton.setText(`Предложить новость`)
    tg.MainButton.show()
    tg.MainButton.onClick(() => newPub())

    // news.append(ce('button',false,false,`Добавить новость`,{
    //     onclick:()=>newPub()
    // }))

    if(u.data.length){
        u.data.forEach(pub=>{
            news.append(newsLine(pub))
        })
    } else {
        news.append(ce(`h3`,false,false,`Вы еще не присылали новости. Давайте начем!`))
    }
}).catch(err=>{
    console.log(err)
})

function handleError(err){
    tg.showAlert(err.message)
}

function newsLine(pub){
    
    let c = ce('div',false,`divided`,false,{
        dataset:{
            active: pub.active,
            status: pub.status
        }
    })

    c.append(ce('span',false,`info`,drawDate(pub.createdAt._seconds*1000)))
    c.append(ce('h3',false,false,pub.title,{
        onclick:()=>showNews(pub)
    }))

    if(pub.status == `new`) c.append(ce(`p`,false,false,`На модерации`))

    // if(pub.published) c.append(ce(`a`,false,false,`Опубликовано`,{
    //     href: pub.link
    // }))

    if(pub.published) c.append(ce(`a`,false,false,`Опубликовано`))

    return c
}

function newPub(){
    let p = preparePopup(`newPub`)
    
    let title = ce('input',false,false,false,{
        placeholder: `Название`,
        type: `text`
    }) 
    p.append(title)

    let media = ce('input',false,false,false,{
        placeholder:    `id фото или видео`,
        type:           `text`
    })
    p.append(media)

    p.append(ce(`p`,false,`info`,`Чтобы получить id медиафайла, просто отправьте его боту. Это самый быстрый, удобный и безопасный способ.`))

    let txt = ce('textarea',false,false,false,{
        placeholder: `текст новости`
    })
    p.append(txt)

    tg.MainButton.hide()
    

    p.append(ce(`button`,false,false,`Отправить`,{
        onclick:function(){
            if(!title.value) return tg.showAlert(`Укажите название`)
            // if(!media.value) return tg.showAlert(`Добавьте фото или видео`)
            if(!txt.value) return tg.showAlert(`Я не вижу ваших букв!`)

            this.setAttribute(`disabled`,true)

            axios.post(`/${host}/api/news?user=${userid}`,{
                title:  title.value,
                text:   txt.value,
                media:  media.value
            }).then(s=>{
                if(s.data.success)  return tg.showAlert(`Спасибо! Ждите подтверждения от редакции.`)
                tg.showAlert(s.data.comment).then(()=>{
                    location.reload()
                })
                
            }).catch(handleError)
            .finally(()=>{
                this.removeAttribute(`disabled`)
            })
        }
    }))

}

