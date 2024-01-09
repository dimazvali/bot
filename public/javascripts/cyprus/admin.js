let tg = window.Telegram.WebApp;

let userid = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : userId
let userLang = tg.initDataUnsafe.user.language_code

let host = `cyprus`


function startApp(){
   axios
    .get(`/${host}/admin/check?id=${userid}`)
    .then(d=>{
        if(d.data){
            
        } else {
            tg.showAlert(`Вам сюда нельзя.`)
        }
    })
}