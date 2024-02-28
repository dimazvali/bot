const appLink = `https://t.me/paperstuffbot/app`

window.onload = () =>{
    console.log(`проверка тележки`)
    if(!localStorage.noTg){
        showTG(window.location.pathname.split(`/`))
    }
}

function showTG(path){
    console.log(path,path.length)
    if(path.length == 5){
        switch(path[3]){
            case `classes`:{
                drawRedirectTab(`class_${path[4]}`)
            }
        }
    }
}

function drawRedirectTab(startApp){
    let tab = ce('div',false,`redirectTab`)
        tab.append(ce(`h2`,false,false,`Рады знакомству!`))
        
        tab.append(ce('span', false, `closeMe`, `✖`, {
            onclick: () => {
                localStorage.noTg = true;
                tab.remove()
            }
        }))
        tab.append(ce(`p`,false,`story`,`Удобнее всего следить за расписанием, бронировать места в коворкинге — да и просто общаться с нами — в телеграм-боте.`))
        tab.append(ce(`button`,false,['dateButton','dark'],`Открыть телеграм`,{
            onclick:()=>{
                window.open(`${appLink}?startapp=${startApp}`)
            }
        }))
    document.body.append(tab)
}
