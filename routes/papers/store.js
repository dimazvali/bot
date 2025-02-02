//@ts-check

const { default: axios } = require("axios");
const { ifBefore, devlog, handleDoc } = require("../common");
const { sendMessage2 } = require("../methods");
const { logs, udb } = require("./cols");
let token =         process.env.papersToken;
let ngrok =     process.env.ngrok;


let coworkingPrice =    30;

function localTime(plusMinutes,date){
    return (date || new Date(+new Date()+(plusMinutes||0)*60*1000)).toLocaleTimeString(false,{timeZone:'Asia/Tbilisi',hour:`2-digit`,minute:`2-digit`})
}


function cba(req,txt){
    sendMessage2({
        callback_query_id: req.body.callback_query.id,
        show_alert: true,
        text:       txt
    }, 'answerCallbackQuery', token)
}


const langs = [{
    id: `en`,
    name: `Английский`,
    active:true
},{
    id: `ka`,
    name: `Грузинский`,
    active:true
},{
    id: `ru`,
    name: `Русский`,
    active:true
}]

function log(o) {

    o.createdAt = new Date()

    logs.add(o).then(r => {

        if(!o.silent){
            alertAdmins({
                filter: o.filter||null,
                text:   o.text,
                type:   (o.class && o.user) ? 'class' : 'logRecord',
                id:     o.class,
                user:   o.user || o.user_id || null,
                ticket: o.ticket
            })
        }
        
    })
}

let admins = [];

ifBefore(udb, {admin:true}).then(d=>admins = d)

function interprete(field, value) {
    switch (field) {
        case 'admin': {
            return value ? `делает админом` : `снимает админство с`
        }
        case 'insider':
            return value ? `делает сотрудником` : `убирает из сотрудников`
        case 'blocked':
            return value ? `добавляет в ЧС` : `убирает из бана`
        case 'fellow':
            return value ? `включает в программу fellows` : `убирает из fellows`
        default:
            return `делает что-то необычно: поле ${field} становится ${value}`
    }
}

function alertAdmins(mess) {
    let message = {
        text: mess.text
    }

    let slack = []
    
    if (mess.type == 'incoming') {
        slack.push({
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": `Что-то непонятное`,
                "emoji": true
            }
        })

        slack.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: mess.text
            }
        })

        slack.push({
            "dispatch_action": true,
            "type": "input",
            "element": {
                "type": "plain_text_input",
                "action_id": "message_" + mess.user_id
            },
            "label": {
                "type": "plain_text",
                "text": "Быстрый ответ",
                "emoji": true
            }
        })

        slack.push({
            "type": "actions",
            "elements": [{
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Заблокировать",
                    "emoji": true
                },
                "value": mess.user_id.toString(),
                "action_id": "user_block"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": `открыть профиль`,
                    "emoji": true
                },
                "value": mess.user_id.toString(),
                "action_id": "userDetails"
            }]
        })


        axios.post(process.env.papersHook, {
            blocks: slack
        }).then(s => {
            if (process.env.develop == 'true') console.log(s.data)
        }).catch(err => {
            console.log(`ошибка отправки сообщения в слак`)
            console.log(err)
        })
    } else if (mess.type == 'newUser') {
        slack.push({
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": `Новый пользователь!`,
                "emoji": true
            }
        })

        slack.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: mess.text
            }
        })

        slack.push({
            "dispatch_action": true,
            "type": "input",
            "element": {
                "type": "plain_text_input",
                "action_id": "message_" + mess.user_id
            },
            "label": {
                "type": "plain_text",
                "text": "Быстрый ответ",
                "emoji": true
            }
        })

        slack.push({
            "type": "actions",
            "elements": [{
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Заблокировать",
                    "emoji": true
                },
                "value": mess.user_id.toString(),
                "style": "danger",
                "action_id": "user_block"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Сделать сотрудником",
                    "emoji": true
                },
                "value": mess.user_id.toString(),
                "action_id": "user_insider"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Сделать админом",
                    "emoji": true
                },
                "style": "primary",
                "value": mess.user_id.toString(),
                "action_id": "user_admin"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Сделать fellows",
                    "emoji": true
                },
                "value": mess.user_id.toString(),
                "style": "primary",
                "action_id": "user_fellow"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Сделать знакомым",
                    "emoji": true
                },
                "value": mess.user_id.toString(),
                "style": "primary",
                "action_id": "user_known"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Снять бонус на коворкинг",
                    "emoji": true
                },
                "value": mess.user_id.toString(),
                "action_id": "user_unBonus"
            }]
        })


        axios.post(process.env.papersHook, {
            blocks: slack
        }).then(s => {
            if (process.env.develop == 'true') console.log(s.data)
        }).catch(err => {
            console.log(err)
        })

        message.reply_markup = {
            inline_keyboard: [
                [{
                    text: 'Заблокировать',
                    callback_data: `user_block_${mess.user_id}`
                }],
                [{
                    text: `Включить в fellows`,
                    callback_data: `user_fellow_${mess.user_id}`
                }],
                [{
                    text: `Сделать сотрудником`,
                    callback_data: `user_insider_${mess.user_id}`
                }],
                [{
                    text: `Сделать админом`,
                    callback_data: `user_admin_${mess.user_id}`
                }],
                [{
                    text: `Снять бонус на коворкинг`,
                    callback_data: `user_bonus_${mess.user_id}`
                }]
            ]
        }
    } else if (mess.type == 'logRecord') {

        slack.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: mess.text
            }
        })

        if (mess.user) {
            slack.push({
                "dispatch_action": true,
                "type": "input",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "message_" + mess.user
                },
                "label": {
                    "type": "plain_text",
                    "text": "Быстрый ответ",
                    "emoji": true
                }
            })

            slack.push({
                "type": "actions",
                "elements": [{
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": `открыть профиль`,
                        "emoji": true
                    },
                    "value": mess.user.toString(),
                    "action_id": "userDetails"
                }]
            })
        }


        axios.post(process.env.papersHook, {
            blocks: slack
        }).then(s => {
            if (process.env.develop == 'true') console.log(s.data)
        }).catch(err => {
            console.log(err)
        })

        message.reply_markup = {
            inline_keyboard: [
                [{
                    text: 'Отписаться от уведомлений',
                    callback_data: `admin_log_unsubscribe`
                }]
            ]
        }
    } else if (mess.type == 'class') {
        slack.push({
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": `Занятия`,
                "emoji": true
            }
        })
        slack.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: mess.text
            }
        })

        slack.push({
            "type": "actions",
            "elements": [{
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Открыть лекцию",
                    "emoji": true
                },
                "value": mess.id.toString(),
                "style": "primary",
                "action_id": "lectureDetails"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": `открыть профиль`,
                    "emoji": true
                },
                "value": mess.user.toString(),
                "action_id": "userDetails"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": `открыть билет`,
                    "emoji": true
                },
                "value": mess.ticket,
                "action_id": "ticketDetails"
            }]
        })


        axios.post(process.env.papersHook, {
            blocks: slack
        }).then(s => {
            if (process.env.develop == 'true') console.log(s.data)
        }).catch(err => {
            console.log(err)
        })g
    }

    let audience = JSON.parse(JSON.stringify(admins))
    
    if(mess.filter) audience = audience.filter(a=>a.alert && a.alert[mess.filter])

    audience.forEach(a => {
        message.chat_id = a.id
        if(mess.type == `newUser`){
            message.photo = `${ngrok}/images/papers/ava/${Math.floor(Math.random()*61)+1}.jpg`
            message.caption = message.text
        }
        if (mess.type != 'stopLog' || !a.data().stopLog) sendMessage2(message, message.photo?`sendPhoto`:false, token)
    })
}


function log(o) {

    o.createdAt = new Date()

    logs.add(o).then(r => {

        if(!o.silent){
            alertAdmins({
                filter: o.filter||null,
                text:   o.text,
                type:   (o.class && o.user) ? 'class' : 'logRecord',
                id:     o.class,
                user:   o.user || o.user_id || null,
                ticket: o.ticket
            })
        }
        
    })
}

module.exports = {
    langs,
    coworkingPrice,
    log,
    alertAdmins,
    interprete,
    localTime,
    cba,
}