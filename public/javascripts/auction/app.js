
const tg = window.Telegram.WebApp;
const host = `auction`
let mcb, mbbc, curLecture, curTicket, curAlert = null;
const helperTexts = {}



function helper(type){
    let c = ce(`div`,false,`containerHelp`,`?`,{
        onclick:()=>{
            let m = ce(`div`,false,[`modal`,(tg.colorScheme=='dark'?`reg`:`light`)])
                m.append(ce(`h2`,false,false,helperTexts[type].title,{
                    onclick:()=>m.remove()
                }))
            let sub = ce(`div`,false, `vScroll`)
                helperTexts[type].text.forEach(p=>{
                    sub.append(ce(`p`,false,`info`,p))
                })

                sub.append(ce(`button`,false,`thin`,`скрыть`,{
                    onclick:()=>m.remove()
                }))
                
            m.append(sub)
            document.body.append(m)
        }
    });
    
    return c;
}

function showLoad(){
    tg.MainButton.setParams({
        text:`загружаем`,
        is_visible: true
    })
    tg.MainButton.showProgress()
}




function preparePopup(type) {
    tg.BackButton.show();
    tg.onEvent('backButtonClicked', clearPopUp)

    if (document.querySelector(`[data-type="${type}"]`)) {
        document.querySelector(`[data-type="${type}"]`).remove()
    }

    let index = Math.floor(Math.random()*4)+1

    mcb = clearPopUp
    let popup = ce('div', false, 'popup', false, {
        dataset: {
            type: type
        }
    })

    
    document.body.append(popup)
    let content = ce('div')
    // content.style.backgroundImage = `url(/images/books/bg/xray${index}.png)`
    // content.style.animation = `bgRise 1s forwards`
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

function toast(txt){
    tg.MainButton.setParams({
        text: txt,
        is_visible: true
    })
    setTimeout(()=>{
        tg.MainButton.hide()
    },1500)
}


function shimmer(light){
    if(light) return tg.HapticFeedback.impactOccurred('light')
    tg.HapticFeedback.notificationOccurred('success')
}

let confirmed = false;

// if(authNeeded){
    console.log(`Нужна авторизация`)
    confirmed = axios.post(`/${host}/authWebApp?token=userToken`,tg.initData)
        .then(s=>{
            // confirmed = 
            console.log(`получили данные админа ${s.data}`)
            return s.data.admin;
        })
// }

let pageData;

function requestPayment(amount){
    axios.post(`/${host}/refill`,{
        amount: +amount
    }).then(s=>{
        tg.openInvoice(s.data.invoice)
    }).catch(handleError)
}


function userLoad(collection, id, extra) {
    return axios.get(`/${host}/api/${collection}${id?`/${id}`:''}${extra?`?${Object.keys(extra).map(k=>`${k}=${extra[k]}`).join(`&`)}`:''}`)
        .then(data => {
            return data.data
        })
        // .catch(err=>{
        //     console.log(err)
        //     return new Error()
        // })
}

Promise
    .resolve(confirmed)
    .then(user=>{

        console.log(`погнали`)
        
        tg.requestWriteAccess();

        // document.body.innerHTML = null;

        // document.body.append(ce(`img`,`logo`,tg.colorScheme == `light` ? false : `bright`,false,{
        //     src: `/images/books/logo.png`
        // }))

        let c = ce(`div`,false,`mobile`)
            document.body.append(c);
        let data = [];

        data.push(userLoad(`auctions`))        
        data.push(userLoad(`auctionsIterations`))
        data.push(userLoad(`profile`))
        
        Promise.all(data).then(data=>{
            pageData = new Page({
                auctions:   data[0],
                iterations: data[1],
                profile:    data[2]
            },tg,handleError,host,userLoad,drawDate)
            ko.applyBindings(pageData,document.querySelector(`#b`))
        })
        

        if(start) {
            start = start.split(`_`)
            switch(start[0]){
                
            }
        }
    })

    import {
        Page
    } from '/javascripts/auction/classes.js'
    