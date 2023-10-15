

window.onload = ()=>{
    try{
        document.querySelector('#datadiv').innerHTML = `Привет, ${window.Telegram.WebApp.initDataUnsafe.user.first_name}!`
    } catch(err){

    }

    // window.Telegram.WebApp.showAlert(`Твой ид: ${window.Telegram.WebApp.initDataUnsafe.user.id}`)
    
    Telegram.WebApp.onEvent('backButtonClicked', function(){
        document.querySelector('.wd').remove()
    })

    try{
        axios.get(`/wine/user/${window.Telegram.WebApp.initDataUnsafe.user.id}`).then(u=>{
            if(!u.data.confirmed){
                window.Telegram.WebApp.showPopup({
                    title:'Фейс-контроль',
                    message: 'Вам точно есть 18 лет?..',
                    buttons: [{
                        id: 'ok',
                        type: 'default',
                        text: 'конечно'
                    },{
                        id: 'false',
                        type: 'destructive',
                        text: 'ноуп'
                    }]
                },function(val){
                    setConsigned(val)
                })
            } else {
                window.Telegram.WebApp.showAlert(`Вам больше 18. Сочувствуем`)
                showStart()
            }
        })
    } catch(err){
        showStart() 
    }
    
}

function showStart(){
    axios.get(`/wine/api/start/${window.Telegram.WebApp.initDataUnsafe.user ? window.Telegram.WebApp.initDataUnsafe.user.id : 144489840}`).then(r=>{
        r = r.data;
        start.append(ce('h2',false,false,`Привет, ${r.user.name}!`))
        start.append(ce('p',false,false,`Здесь будет приветствие, связанное со временем суток или количеством времени, прошедшего с момента последнего посещения...`))
        
        let nav = ce('div','nav')
        
            nav.append(ce('span',false,false,'Каталог',{
                onclick:function(){
                    showCatalogue(this)
                }
            }))

            nav.append(ce('span',false,false,'Подборки',{
                onclick:function(){
                    showBests(this)
                }
            }))

            nav.append(ce('span',false,false,'Закладки',{
                onclick:function(){
                    showFavs(this)
                }
            }))

        start.append(nav)

        let c = ce('div',false,'content')
        
        let newComers = ce('div',false,'block')
            newComers.append(ce('h3',false,false,'Новинки'))
        let line = ce('div',false,'line')

            r.wines.sort((a,b)=>b.createdAt._seconds - a.createdAt._seconds).slice(0,5).forEach(w=>{
                line.append(drawWine2(w))
            })
            newComers.append(line)
        c.append(newComers)

        let bests = ce('div','bests')

        r.bests.forEach(b=>{
            bests.append(bestTile(b))
        })

        c.append(bests)

        start.append(c)

        //     wines:  d[0],
        //     user:   d[1],
        //     cart:   d[2],
        //     bests:  d[3]
        
    })    
}

function bestTile(b){
    let bc = ce('div',false,'best')
        bc.append(ce('h4',false,false,b.name))
        bc.append(ce('span',false,'cnt',b.length))
    return bc
}

function drawWine2(wine){
    let wc = ce('div',false,'wine2')
    wc.append(ce('img',false,'vert',false,{
        src: wine.pic
    }))
    let d = ce('div',false,'details')
    d.append(ce('h4',false,false,wine.name))
    

    let tagLine = ce('p')
    
    let tagable = [
        'vintage',
        'sort',
        'sugar'
    ]
    let tags = [];
    tagable.forEach(t=>{
        if(wine[t]){
            tags.push(wine[t])
        }
    })
    tagLine.innerHTML = tags.join(', ')

    d.append(tagLine)
    
    d.append(ce('span',false,'price',wine.price))

    let bottom = ce('div',false,'bottom')
        let like = ce('span',false,'like')
        // like.append(ce('img',false,false,false,{
        //     src: `/images/ico_heart.png`
        // }))
        bottom.append(like)
        bottom.append(ce('span',false,'toCart','в корзину'))
    d.append(bottom)

    wc.append(d)
    return wc
}

let cart = []

function showDetails(wine){
    let wc = ce('div',false,'wd')
    wc.append(ce('img',false,false,false,{
        src:wine.pic||'/images/broken.jpg'  
    }))
    wc.append(ce('h2',false,false,wine.name))
    wc.append(ce('p',false,false,wine.description))
    wc.append(ce('button',false,'cart','Добавить',{
        onclick:()=>{
            cart.push(wine)
            window.Telegram.WebApp.MainButton.setText(`корзинка (${cart.length})`)
            window.Telegram.WebApp.MainButton.show()
            window.Telegram.WebApp.MainButton.onClick(()=>showCart())
        }
    }))
    window.Telegram.WebApp.BackButton.show()
    datadiv.append(wc)
}


function showCart(){
    let wc = ce('div',false,'wd')
    
    wc.append(ce('h2',false,false,`Что это тут у нас?..`))
    
    let unique = [...new Set(cart.map(wine=>wine.id))]

    unique.forEach(id=>{

        wc.append(drawWine(cart.filter(w=>w.id == id)[0]))
    })
    window.Telegram.WebApp.MainButton.setText(cart.reduce((a,b)=>a+b.price,0)+' GEL')
    // window.Telegram.WebApp.BackButton.show()
    datadiv.append(wc)

    window.Telegram.WebApp.BackButton.show()

    Telegram.WebApp.onEvent('backButtonClicked', function(){
        document.querySelector('.wd').remove()
        window.Telegram.WebApp.MainButton.setText(`корзинка (${cart.length})`)
        Telegram.WebApp.onEvent('backButtonClicked', function(){
            document.querySelector('.wd').remove()
        })
    })
}



function drawWine(wine){
    let wc = ce('div',false,'wine',false,{
        dataset:{
            id: wine.id
        },
        
    })
    wc.append(ce('img',false,false,false,{
        src:wine.pic||'/images/broken.jpg'  
    }))
    wc.append(ce('h2',false,false,wine.name,{
        onclick:()=>{
            showDetails(wine)
        }
    }))

    let bc = ce('div',false,'bc')

        bc.append(ce('button',false,'minus','-',{
            onclick:()=>{
                recalc(wine,false)
            }
        }))
        bc.append(ce('span',false,false,cart.filter(w=>w.id == wine.id).length))
        bc.append(ce('button',false,'plus','+',{
            onclick:()=>{
                recalc(wine,true)
            }
        }))
    wc.append(bc)
    // wc.append(ce('p',false,false,wine.description))
    return wc
}

function recalc(wine,add){
    if(add){
        cart.push(wine)
    } else {
        cart.splice(cart.map(w=>w.id).indexOf(wine.id),1)
    }
    refresh()
}

function refresh(){

    document.querySelectorAll('.wine').forEach(w=>{
        let cnt = cart.filter(wine=>wine.id == w.dataset.id).length
        if(!cnt && document.querySelector('.wd') && document.querySelector('.wd').querySelector('[data-id="'+w.dataset.id+'"]')){
            document.querySelector('.wd').querySelector('[data-id="'+w.dataset.id+'"]').remove()
        }
        console.log(w.dataset.id, cnt)
        w.dataset.count =  cnt;
        w.querySelector('span').innerHTML = cnt 
    })

    if(document.querySelector('.wd')){
        
        

        if(cart.length){
            window.Telegram.WebApp.MainButton.setText(cart.reduce((a,b)=>a+b.price,0)+' GEL')
        } else {
            window.Telegram.WebApp.MainButton.setText(`упс`)
        }
    } else {
        if(cart.length){
            
            window.Telegram.WebApp.MainButton.setText(`корзинка (${cart.length})`)
            window.Telegram.WebApp.MainButton.onClick(()=>showCart())
            window.Telegram.WebApp.MainButton.show()
        } else {
            window.Telegram.WebApp.MainButton.hide()
        }
    }
    
}

function setConsigned(val){
    window.Telegram.WebApp.showAlert(val)
    if(val == 'ok'){
        axios.put(`/wine/user/${window.Telegram.WebApp.initDataUnsafe.user.id}`,{
            confirmed: true
        }).then(()=>{
            window.Telegram.WebApp.showAlert(`Сочувствуем. Вопросов больше нет!`)
        })
    } else {
        window.Telegram.WebApp.showAlert(`Сорри, бро! тебя сюда нельзя...`)
    }
}

// JSON.stringify(window.Telegram.WebApp)
