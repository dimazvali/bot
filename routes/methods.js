var axios = require('axios');

function sendMessage(m, ep, channel) {
    
    return axios.post('https://api.telegram.org/bot' + channel + '/' + (ep ? ep : 'sendMessage'), m, {
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(telres => {
        return telres.data;
    }).catch(err => {
        console.log(err)
        // res.sendStatus(500);
        throw new Error(err);
    })
}

function sendMessage2(m, ep, channel,messages) {
    
    return axios.post('https://api.telegram.org/bot' + channel + '/' + (ep ? ep : 'sendMessage'), m, {
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(telres => {
        return telres.data;
        
    }).catch(err => {
        console.log(err)
        return false
        
        // res.sendStatus(500);
        // throw new Error(err);
    })
}


function getUser(id,udb){
    return udb.doc(id.toString()).get().then(u=>{
        let t = u.data()
            t.id = u.id;
        return t
    }).catch(err=>{})
}


function greeting() {
    let time = new Date().getHours();
    let response = 'Доброй ночи'
    time < 6 ? response = 'Доброй ночи' :
        time < 12 ? response = 'Доброе утро' :
        time < 18 ? response = 'Добрый день' :
        time < 23 ? response = 'Добрый вечер' :
        response = 'Доброй ночи'
    return response;
}

module.exports = {sendMessage,greeting,getUser,sendMessage2};

