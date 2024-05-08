var axios = require('axios');

// const devlog = require('./common').devlog
// const alertMe = require('./common').alertMe;
function alertMe(m, ep) {
    if (!m.chat_id) {
        m.chat_id = dimazvali
    }
    return axios.post('https://api.telegram.org/bot' + process.env.papersToken + '/' + (ep ? ep : 'sendMessage'),
        m, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(success => {
        return true;
    }).catch(err => {
        console.log(err)
        return false;
    })
}

function devlog(v) {
    if (process.env.develop == 'true') {
        console.log(v)
    }
}

// const { devlog, alertMe } = require('./common');

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

function sendMessage2(m, ep, channel, messages, extra) {
    
    return axios.post('https://api.telegram.org/bot' + channel + '/' + (ep ? ep : 'sendMessage'), m, {
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(telres => {
        
        if(messages && telres.data.ok){

            devlog(telres.data)
            
            let toLog =  {
                createdAt:  new Date(),
                user:       +m.chat_id,
                text:       m.text || m.caption || null,
                isReply:    true,
                photo:      m.photo || null,
                messageId:  telres.data.result.message_id
            }

            if(extra) Object.keys(extra).forEach(f=>toLog[f]=extra[f])

            devlog(toLog)
            
            messages.add(toLog).then(()=>devlog(`logged ${(toLog.text || '').slice(0,10)} to ${toLog.user}`)).catch(err=>{
                alertMe({
                    text: `Ошибка логирования: ${err.message}`
                })
            })
        }
        
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

