var common = require('./common.js')
let modals = { 
    omniSuccess: function (modalId, text) {
        return {
            "view_id": modalId,
            "view": {
                "type": "modal",
                "title": {
                    "type": "plain_text",
                    "text": "Ура, товарищ!"
                },
                "blocks": [{
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": text
                    }
                }]
            }
        }
    },
    coworkingDetails: (modal, days, cabinet, users, blocks, start_date) => {
        let ud = {};
        users.forEach(u => {
            ud[u.id] = u
        })

        let view = {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": `Кабинет ${cabinet.name}`
            },
            "submit": {
                "type": "plain_text",
                "text": "Сохранить"
            },
            "blocks": [{
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "Зал"
                },
                "block_id": "hall",
                "accessory": {
                    "type": "external_select",
                    "initial_option": {
                        "text": {
                            "type": "plain_text",
                            "text": cabinet.name.toString(),
                            "emoji": true
                        },
                        "value": cabinet.id
                    },
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Начните вводить название",
                        "emoji": true
                    },
                    "action_id": "coworkingHall"
                }
            }, {
                "type": "input",
                "block_id": "date",
                dispatch_action: true,
                "element": {
                    "type": "datepicker",
                    "initial_date": start_date || new Date().toISOString().split('T')[0],
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select a date",
                        "emoji": true
                    },
                    "action_id": "coworking_" + cabinet.id + "_date"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Дата",
                    "emoji": true
                }
            }, {
                "type": "context",
                "elements": [{
                    "type": "plain_text",
                    "text": `Приглядимся:`,
                    "emoji": true
                }]
            }]
        }
        Object.keys(days).forEach(d => {
            view.blocks.push({
                type: 'divider'
            })
            view.blocks.push({
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": `${common.drawDate(d)}: ${days[d].length}/${cabinet.capacity}`,
                    "emoji": true
                }
            })
            if (!days[d].length) {
                view.blocks.push({
                    "type": "context",
                    "elements": [{
                        "type": "plain_text",
                        "text": `Пока никого не ждем.`,
                        "emoji": true
                    }]
                })
            } else {
                days[d].forEach(u => {
                    view.blocks.push({
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": `${common.uname(ud[u.user],u.user)} ${u.active ? (u.status == 'used'?'✅':'🚷') : '👻'}; запись от ${common.drawDate(u.createdAt._seconds*1000,'ru',{time:true})}`
                        },
                        // "accessory": {
                        //     "type": "button",
                        //     "text": {
                        //         "type": "plain_text",
                        //         "text": common.drawDate(u.createdAt._seconds*1000,'ru',{time:true}),
                        //         "emoji": true
                        //     },
                        //     "value":        u.user.toString(),
                        //     "action_id":    "userDetails"
                        // }
                    })
                    view.blocks.push({
                        "type": "actions",
                        "elements": [{
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": `Открыть профиль`,
                                "emoji": true
                            },
                            "value": u.user.toString(),
                            "action_id": "userDetails"
                        }, {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Гость пришел",
                                "emoji": true
                            },
                            "value": u.user.toString(),
                            "action_id": `coworkingMess_confirmBooking_${u.id}`
                        },{
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Отменить запись",
                                "emoji": true
                            },
                            "style": "danger",
                            "value": u.user.toString(),
                            "action_id": `coworkingMess_cancelBooking_${u.id}`
                        }]
                    })
                })
            }
            view.blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "Статус даты"
                },
                "block_id": `${cabinet.id}_${d}`,

                "accessory": {
                    "type": "radio_buttons",
                    "initial_option": blocks.filter(b => b.date == d).length ? {
                        "text": {
                            "type": "plain_text",
                            "text": "Дата закрыта",
                            "emoji": true
                        },
                        "value": "0"
                    } : {
                        "text": {
                            "type": "plain_text",
                            "text": "Дата свободна",
                            "emoji": true
                        },
                        "value": "1"
                    },
                    "options": [{
                            "text": {
                                "type": "plain_text",
                                "text": "Дата свободна",
                                "emoji": true
                            },
                            "value": "1"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "Дата закрыта",
                                "emoji": true
                            },
                            "value": "0"
                        }
                    ],
                    "action_id": "closeRoom"
                }
            })



        })
        if (modal) {
            return {
                "view_id": modal,
                "view": view
            }
        } else {
            return view
        }
    },
    coworking: (halls) => {
        let view = {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "Коворкинг"
            },
            "blocks": [{
                "type": "context",
                "elements": [{
                    "type": "plain_text",
                    "text": `Выберите кабинет для детализации:`,
                    "emoji": true
                }]
            }]
        }
        halls.forEach(h => {
            view.blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `Кабинет ${h.name} (${h.floor} этаж) _${h.description}_`
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": `открыть`,
                        "emoji": true
                    },
                    "value": h.id,
                    "action_id": `coworking_${h.id}`
                }
            })
        })
        return view;
    },
    mrDate: (modal, date, records, users) => {
        let ud = {};
        if (users) {
            users.forEach(u => {
                ud[u.id] = u
            })
        }
        let view = {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": `Переговорка`
            },
            "submit": {
                "type": "plain_text",
                "text": "Сохранить"
            },
            "blocks": [{
                "type": "context",
                "elements": [{
                    "type": "plain_text",
                    "text": `Выберите дату ниже:`,
                    "emoji": true
                }]
            }, {
                "type": "input",
                "block_id": "date",
                dispatch_action: true,
                "element": {
                    "type": "datepicker",
                    "initial_date": date || new Date().toISOString().split('T')[0],
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select a date",
                        "emoji": true
                    },
                    "action_id": "mr_date"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Дата",
                    "emoji": true
                }
            }, {
                type: 'divider'
            }]
        }

        if (records) {
            records.sort((a, b) => b.time > a.time ? -1 : 1).forEach(r => {
                view.blocks.push({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `${common.uname(ud[r.user],r.user)} ${r.active ? (r.status == 'used'?'✅':'🚷') : '👻'}`
                    },
                    "accessory": {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": r.time,
                            "emoji": true
                        },
                        "value": r.user.toString(),
                        "action_id": "userDetails"
                    }
                })
            })
            if (!records.length) {
                view.blocks.push({
                    "type": "context",
                    "elements": [{
                        "type": "plain_text",
                        "text": `Тут еще пусто!`,
                        "emoji": true
                    }]
                })
            }
        }

        if (modal) {
            return {
                "view_id": modal,
                "view": view
            }
        } else {
            return view
        }

    },
    coworkingReport: (toBePayed, payed, free, halls, users) => {
        let temp = [{
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": `Записи в коворкинг`,
                "emoji": true
            }
        }];

        if (payed.length) {
            temp.push({
                "type": "context",
                "elements": [{
                    "type": "plain_text",
                    "text": `Уже оплачены: ${payed.length}`,
                    "emoji": true
                }]
            })
            payed.forEach(record => {
                temp.push({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `${common.uname(users[record.user], record.user)}: зал ${halls[record.hall].name}`
                    },
                    "accessory": {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": `${common.drawDate(record.createdAt._seconds*1000)}`,
                            "emoji": true
                        },
                        "value": record.id,
                        "action_id": `coworkingRecord`
                    }
                })
            })
        }

        if (toBePayed.length) {
            temp.push({
                "type": "context",
                "elements": [{
                    "type": "plain_text",
                    "text": `Еще не оплачены: ${toBePayed.length}`,
                    "emoji": true
                }]
            })
            toBePayed.forEach(record => {
                temp.push({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `${common.uname(users[record.user], record.user)}: зал ${halls[record.hall].name}`
                    },
                    "accessory": {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": `${common.drawDate(record.createdAt._seconds*1000)}`,
                            "emoji": true
                        },
                        "value": record.id,
                        "action_id": `coworkingRecord`
                    }
                })
            })
        }

        if (free.length) {
            temp.push({
                "type": "context",
                "elements": [{
                    "type": "plain_text",
                    "text": `Бесплатно: ${free.length}`,
                    "emoji": true
                }]
            })
            free.forEach(record => {
                temp.push({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `${common.uname(users[record.user], record.user)}: зал ${halls[record.hall].name}`
                    },
                    "accessory": {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": `${common.drawDate(record.createdAt._seconds*1000)}`,
                            "emoji": true
                        },
                        "value": record.id,
                        "action_id": `coworkingRecord`
                    }
                })
            })
        }



        temp.push({
            type: 'divider'
        })

        temp.push({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `Ожидаемый доход: ${common.cur(payed.length*30+toBePayed.length*30,'GEL')}`
            }
        })

        return temp;
    },
    tags: (tags) => {
        let view = {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "Теги пользователей"
            },
            "blocks": [{
                "type": "context",
                "elements": [{
                    "type": "plain_text",
                    "text": `Выберите любой:`,
                    "emoji": true
                }]
            }]
        }
        tags.forEach(h => {
            view.blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `#${h.id}`
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": `${common.letterize(Object.keys(h).length,'строка')}`,
                        "emoji": true
                    },
                    "value": h.id,
                    "action_id": `tag_${h.id}`
                }
            })
        })
        return view;
    },
    mr: () => {
        let view = {
            "callback_id": `mr`,
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": `Переговорка`
            },
            "blocks": []
        }

        let i = 0;
        let days = [];

        while (i < 7) {
            days.push(new Date(+new Date() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            i++
        }

        days.forEach(d => {
            view.blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `${common.drawDate(d)}`
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": `открыть`,
                        "emoji": true
                    },
                    "value": d,
                    "action_id": `mr_${d}`
                }
            })
        })
        return view
    },
    tagDetails(modal, tag, users) {
        let uid = tag.id;
        tag = tag.data();
        let ud = {};
        users.forEach(u => {
            ud[u.id] = u
        })

        console.log(ud);

        let view = {
            "callback_id": uid.toString(),
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": tag.name || uid
            },
            "blocks": [{
                "type": "context",
                "elements": [{
                    "type": "plain_text",
                    "text": `Использован ${Object.keys(tag).length} раз`,
                    "emoji": true
                }]
            }, {
                "dispatch_action": true,
                "type": "input",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "tagMessage_" + uid
                },
                "label": {
                    "type": "plain_text",
                    "text": "Написать пользователям",
                    "emoji": true
                }
            }]
        }
        Object.keys(tag).forEach(u => {
            if (u != 'name') {
                console.log(ud[u])
                if (ud[u]) view.blocks.push({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": common.uname(ud[u], u)
                    },
                    "accessory": {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": common.drawDate(tag[u]._seconds * 1000),
                            "emoji": true
                        },
                        "value": u.toString(),
                        "action_id": "userDetails"
                    }
                })
            }

        });

        if (modal) {
            return {
                "view_id": modal,
                "view": view
            }
        } else {
            return view
        }

    },
    err: function (modalId, text) {
        return {
            "view_id": modalId,
            "view": {
                "type": "modal",
                "title": {
                    "type": "plain_text",
                    "text": "Все плохо!"
                },
                "blocks": [{
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": text
                    }
                }]
            }
        }
    },
    qDetails(modal,id,poll,answers,users){
        let view = {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": poll.name
            },
            "blocks": [{
                "type": "context",
                "elements": [{
                    "type": "plain_text",
                    "text": `Создан ${common.drawDate(poll.createdAt._seconds*1000,'ru',{year:true})}`,
                    "emoji": true
                }, {
                    "type": "plain_text",
                    "text": `Всего ответов: ${answers.length}`,
                    "emoji": true
                }, {
                    "type": "plain_text",
                    "text": `Контекст: ${poll.text}`,
                    "emoji": true
                }]
            }]
        }

        answers.forEach(a=>{
            let u = users.filter(u=>u.id == a.user)[0]
            view.blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `${common.uname(u, u.id)}, ${common.drawDate(a.createdAt._seconds*1000)}:\n${a.text}`
                },
            })
        })
        
        if (modal) {
            return {
                "view_id": modal,
                "view": view
            }
        } else {
            return view
        }
    },
    userDetails(modal, user, classes, messages) {
        let uid = user.id;
        user = user.data();
        let view = {
            "submit": {
                "type": "plain_text",
                "text": "Сохранить"
            },
            "callback_id": user.id.toString(),
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": ((user.admin ? 'админ' : (user.insider ? 'сотрудник' : (user.fellow ? 'fellow' : 'юзер'))) + ' ' + (user.username ? '@' + user.username : user.id)).slice(0, 24)
            },
            "blocks": [{
                "type": "context",
                "elements": [{
                    "type": "plain_text",
                    "text": `Регистрация ${common.drawDate(user.createdAt._seconds*1000,'ru',{year:true})}`,
                    "emoji": true
                }, {
                    "type": "plain_text",
                    "text": `${user.is_premium ? `Платный` : 'Бесплатный'} аккаунт`,
                    "emoji": true
                }, {
                    "type": "plain_text",
                    "text": `${user.email ? user.email : 'без почты'}`,
                    "emoji": true
                }, {
                    "type": "plain_text",
                    "text": `${user.occupation ? user.occupation : 'без работы'}`,
                    "emoji": true
                },{
                    "type": "plain_text",
                    "text": `Депозит: ${common.cur(user.deposit,'GEL')}`,
                    "emoji": true
                }]
            }, {
                "dispatch_action": true,
                "type": "input",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "message_" + user.id
                },
                "label": {
                    "type": "plain_text",
                    "text": "Написать пользователю",
                    "emoji": true
                }
            },{
                type: 'divider'
            },{
                "dispatch_action": true,
                "type": "input",
                "element": {
                    "action_id": "deposit_" + user.id,
                    "initial_value": '0',
                    "type": "number_input",
                    "is_decimal_allowed": false
                },
                "label": {
                    "type": "plain_text",
                    "text": "Внести депозит",
                    "emoji": true
                }
            },{
                "dispatch_action": true,
                "type": "input",
                "element": {
                    "action_id": "undeposit_" + user.id,
                    "initial_value": '0',
                    "type": "number_input",
                    "is_decimal_allowed": false
                },
                "label": {
                    "type": "plain_text",
                    "text": "Списать депозит",
                    "emoji": true
                }
            }, {
                type: 'divider'
            },{
                "type": "actions",
                "elements": [{
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": user.blocked ? 'Разблокировать' : "Заблокировать",
                            "emoji": true
                        },
                        "value": user.id.toString(),
                        "style": "danger",
                        "action_id": "user_block"+(user.blocked? '_false':'')
                    },{
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Сделать сотрудником",
                            "emoji": true
                        },
                        "value": user.id.toString(),
                        "action_id": "user_insider"
                    },{
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Сделать админом",
                            "emoji": true
                        },
                        "style": "primary",
                        "value": user.id.toString(),
                        "action_id": "user_admin"
                    },{
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Сделать fellows",
                            "emoji": true
                        },
                        "value": user.id.toString(),
                        "style": "primary",
                        "action_id": "user_fellow"
                    },{
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Сделать знакомым",
                            "emoji": true
                        },
                        "value": user.id.toString(),
                        "style": "primary",
                        "action_id": "user_known"
                    },{
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Снять бонус на коворкинг",
                            "emoji": true
                        },
                        "value": user.id.toString(),
                        "action_id": "user_unBonus"
                    }
                ]
            },{
                "type": "input",
                "block_id": "first_name",
                "dispatch_action": true,
                "element": {

                    "type": "plain_text_input",
                    "action_id": "updateUser",
                    "initial_value": user.first_name || '',
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Иван"
                    }
                },
                "label": {
                    "type": "plain_text",
                    "text": "Имя"
                }
            }, {
                "type": "input",
                "block_id": "last_name",
                "dispatch_action": true,
                "element": {

                    "type": "plain_text_input",
                    "action_id": "updateUser",
                    "initial_value": user.last_name || '',
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Петров"
                    }
                },
                "label": {
                    "type": "plain_text",
                    "text": "Фамилия"
                }
            }, {
                "type": "input",
                "block_id": "about",
                "dispatch_action": true,
                "element": {
                    "type": "plain_text_input",
                    "initial_value": user.about || '',
                    "multiline": true,
                    "action_id": "updateUser"
                },
                "label": {
                    "type": "plain_text",
                    "text": "О себе",
                    "emoji": true
                }
            },{
                type: 'divider'
            }, {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": `Записи`,
                    "emoji": true
                }
            }]
        }


        classes.forEach(u => {
            view.blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `${u.className} ${u.active ? (u.status == 'used'?'✅':'🚷') : '👻'}`
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": common.drawDate(u.createdAt._seconds * 1000, 'ru', {
                            time: true
                        }),
                        "emoji": true
                    },
                    "value": u.id,
                    "action_id": "ticketDetails"
                }
            })
        })

        view.blocks.push({
            type: 'divider'
        })

        view.blocks.push({
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": `Крайние сообщения`,
                "emoji": true
            }
        })




        messages.forEach(m => {
            view.blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": m.text
                }
            })
        })

        view.blocks.push({
            type: 'divider'
        })

        if (user.tags) {
            view.blocks.push({
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": `Теги`,
                    "emoji": true
                }
            })

            Object.keys(user.tags).forEach(tag => {
                view.blocks.push({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `#${tag}`
                    },
                    "accessory": {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": `${common.drawDate(user.tags[tag]._seconds*1000)}`,
                            "emoji": true
                        },
                        "value": tag,
                        "action_id": `tag_${tag}`
                    }
                })
            })

            view.blocks.push({
                type: 'divider'
            })
        }

        // view.blocks.push()

        if (modal) {
            return {
                "view_id": modal,
                "view": view
            }
        } else {
            return view
        }

    },
    qList:(polls)=>{
        let v = {
            "title": {
                "type": "plain_text",
                "text": "Вопросы к fellows"
            },
            // "callback_id": "newQ",
            "submit": {
                "type": "plain_text",
                "text": "Отправить"
            },
            "type": "modal",
            "blocks": []
        }
        polls.forEach(p=>{
            v.blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": p.name
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": common.drawDate(p.createdAt._seconds*1000, 'ru'),
                        "emoji": true
                    },
                    "value": p.id,
                    "action_id": "pollDetails"
                }
            })
        })
        return v
    },
    newQ:{
        "title": {
            "type": "plain_text",
            "text": "Вопрос к fellows"
        },
        "callback_id": "newQ",
        "submit": {
            "type": "plain_text",
            "text": "Отправить"
        },
        "type": "modal",
        "blocks": [{
                "type": "input",
                "block_id": "name",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "name",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Вопрос"
                    }
                },
                "label": {
                    "type": "plain_text",
                    "text": "будет отображаться в списке вопросов"
                }
            },
            {
                "type": "input",
                "block_id": "text",
                "element": {
                    "type": "plain_text_input",
                    "multiline": true,
                    "action_id": "text"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Описание",
                    "emoji": true
                }
            }
        ],
    },
    campaign: {
        "title": {
            "type": "plain_text",
            "text": "Новая рассылка"
        },
        "callback_id": "newCampaign",
        "submit": {
            "type": "plain_text",
            "text": "Отправить"
        },
        "type": "modal",
        "blocks": [{
                "type": "input",
                "block_id": "name",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "name",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Название"
                    }
                },
                "label": {
                    "type": "plain_text",
                    "text": "Служебное название (для идентификации в админках)"
                }
            },
            {
                "type": "input",
                "block_id": "type",
                "element": {
                    "type": "static_select",
                    "action_id": "type",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select an item",
                        "emoji": true
                    },
                    "options": [{
                            "text": {
                                "type": "plain_text",
                                "text": "всем",
                                "emoji": true
                            },
                            "value": "all"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "админам",
                                "emoji": true
                            },
                            "value": "admin"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "сотрудникам",
                                "emoji": true
                            },
                            "value": "insider"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "fellows",
                                "emoji": true
                            },
                            "value": "fellows"
                        },

                    ]
                },
                "label": {
                    "type": "plain_text",
                    "text": "Кому отправить?..",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "text",
                "element": {
                    "type": "plain_text_input",
                    "multiline": true,
                    "action_id": "text"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Описание",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "extras",
                "optional": true,
                "element": {
                    "type": "checkboxes",
                    "options": [{
                        "text": {
                            "type": "plain_text",
                            "text": "Отправить уведомления",
                            "emoji": true
                        },
                        "value": "alert"
                    }],
                    "action_id": "extras"
                },
                "label": {
                    "type": "plain_text",
                    "text": "А также:",
                    "emoji": true
                }
            }
        ],
    },
    newLecture: {
        "title": {
            "type": "plain_text",
            "text": "Создание новой лекции"
        },
        "callback_id": "newClass",
        "submit": {
            "type": "plain_text",
            "text": "Сохранить"
        },
        "blocks": [{
                "type": "input",
                "block_id": "name",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "name",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Название"
                    }
                },
                "label": {
                    "type": "plain_text",
                    "text": "Название мероприятия"
                }
            },
            {
                "type": "input",
                "block_id": "author",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "author",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Автор"
                    }
                },
                "label": {
                    "type": "plain_text",
                    "text": "Как зовут кумира?"
                }
            },
            {
                "type": "input",
                "block_id": "type",
                "element": {
                    "type": "static_select",
                    "action_id": "type",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select an item",
                        "emoji": true
                    },
                    "options": [{
                            "text": {
                                "type": "plain_text",
                                "text": "лекция",
                                "emoji": true
                            },
                            "value": "lecture"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "концерт",
                                "emoji": true
                            },
                            "value": "concert"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "мероприятие",
                                "emoji": true
                            },
                            "value": "event"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "игра",
                                "emoji": true
                            },
                            "value": "game"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "вечер по интересам",
                                "emoji": true
                            },
                            "value": "evening"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "встреча",
                                "emoji": true
                            },
                            "value": "meeting"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "вечер",
                                "emoji": true
                            },
                            "value": "evening"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "квартирник",
                                "emoji": true
                            },
                            "value": "show"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "дегустация",
                                "emoji": true
                            },
                            "value": "degustation"
                        }
                    ]
                },
                "label": {
                    "type": "plain_text",
                    "text": "Тип мероприятия",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "description",
                "element": {
                    "type": "plain_text_input",
                    "multiline": true,
                    "action_id": "description"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Описание",
                    "emoji": true
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "Зал"
                },
                "block_id": "hall",
                "accessory": {
                    "type": "external_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Начните вводить название",
                        "emoji": true
                    },
                    "action_id": "hall"
                }
            },
            {
                "type": "input",
                "block_id": "price",
                "element": {
                    "initial_value": '0',
                    "type": "number_input",
                    "action_id": "price",
                    "is_decimal_allowed": false
                },
                "label": {
                    "type": "plain_text",
                    "text": "Стоимость",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "duration",

                "element": {
                    "initial_value": '60',
                    "type": "number_input",
                    "action_id": "duration",
                    "is_decimal_allowed": false
                },
                "label": {
                    "type": "plain_text",
                    "text": "Продолжительность",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "capacity",

                "element": {
                    "initial_value": '0',
                    "type": "number_input",
                    "action_id": "capacity",
                    "is_decimal_allowed": false
                },
                "label": {
                    "type": "plain_text",
                    "text": "Количество мест",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "date",
                "element": {
                    "type": "datepicker",
                    "initial_date": new Date().toISOString().split('T')[0],
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select a date",
                        "emoji": true
                    },
                    "action_id": "date"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Дата",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "time",
                "element": {
                    "type": "timepicker",
                    "initial_time": "18:00",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select time",
                        "emoji": true
                    },
                    "action_id": "time"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Время начала",
                    "emoji": true
                }
            },
            {
                "type": "input",
                "block_id": "pic",
                "optional": true,
                "element": {
                    "type": "url_text_input",
                    "action_id": "pic",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "url"
                    }
                },
                "label": {
                    "type": "plain_text",
                    "text": "ссылка на фото"
                }
            },
            {
                "type": "input",
                "block_id": "extras",
                "optional": true,
                "element": {
                    "type": "checkboxes",
                    "options": [{
                            "text": {
                                "type": "plain_text",
                                "text": "Отправить уведомления",
                                "emoji": true
                            },
                            "value": "alert"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "Только для fellows",
                                "emoji": true
                            },
                            "value": "fellows"
                        }, {
                            "text": {
                                "type": "plain_text",
                                "text": "Только для админов",
                                "emoji": true
                            },
                            "value": "admins"
                        },{
                            "text": {
                                "type": "plain_text",
                                "text": "Без регистрации",
                                "emoji": true
                            },
                            "value": "noRegistration"
                        },
                    ],
                    "action_id": "extras"
                },
                "label": {
                    "type": "plain_text",
                    "text": "А также:",
                    "emoji": true
                }
            }
        ],
        "type": "modal"
    },
    lectures: {
        "title": {
            "type": "plain_text",
            "text": "Погнали?"
        },
        "callback_id": "lectures",
        "submit": {
            "type": "plain_text",
            "text": "Отправить"
        },
        "type": "modal",
        "blocks": [{
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Лекция"
            },
            "block_id": "lectures",
            "accessory": {
                "type": "external_select",
                "placeholder": {
                    "type": "plain_text",
                    "text": "Начните вводить название",
                    "emoji": true
                },
                "action_id": "lectures"
            }
        }]
    },
    lectureUpdate: (modal, l, id) => {
        let view = {
            "title": {
                "type": "plain_text",
                "text": `Редактируем лекцию`
            },
            "type": "modal",
            "callback_id": `lectureUpdate_${id}`,
            "submit": {
                "type": "plain_text",
                "text": "Сохранить"
            },
            blocks: [{
                    "type": "input",
                    "block_id": "name",

                    "element": {
                        initial_value: l.name.toString(),
                        "type": "plain_text_input",
                        "action_id": "name",

                        "placeholder": {
                            "type": "plain_text",
                            "text": "Название"
                        }
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Название мероприятия"
                    }
                },
                {
                    "type": "input",
                    "block_id": "author",

                    "element": {
                        initial_value: l.author.toString(),
                        "type": "plain_text_input",
                        "action_id": "author",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Автор"
                        }
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Как зовут кумира?"
                    }
                },
                {
                    "type": "input",
                    "block_id": "description",
                    "element": {
                        initial_value: l.description ? l.description.toString() : 'без описания',
                        "type": "plain_text_input",
                        "multiline": true,
                        "action_id": "description"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Описание",
                        "emoji": true
                    }
                },
                {
                    "type": "input",
                    "block_id": "price",
                    "element": {
                        "initial_value": l.price ? l.price.toString() : '0',
                        "type": "number_input",
                        "action_id": "price",
                        "is_decimal_allowed": false
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Стоимость",
                        "emoji": true
                    }
                },
                {
                    "type": "input",
                    "block_id": "duration",
                    "element": {
                        "initial_value": l.duration ? l.duration.toString() : '0',
                        "type": "number_input",
                        "action_id": "duration",
                        "is_decimal_allowed": false
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Продолжительность",
                        "emoji": true
                    }
                },{
                    "type": "input",
                    "block_id": "capacity",
    
                    "element": {
                        "initial_value": l.capacity ? l.capacity.toString() : '0',
                        "type": "number_input",
                        "action_id": "capacity",
                        "is_decimal_allowed": false
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Количество мест",
                        "emoji": true
                    }
                }, {
                    "type": "input",
                    "block_id": "date",
                    "element": {
                        "type": "datepicker",
                        "initial_date": new Date(l.date || +new Date()).toISOString().split('T')[0],
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Select a date",
                            "emoji": true
                        },
                        "action_id": "date"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Дата",
                        "emoji": true
                    }
                },
                {
                    "type": "input",
                    "block_id": "time",
                    "element": {
                        "type": "timepicker",
                        "initial_time":  new Date(l.date).toLocaleString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Tbilisi'
                        }),
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Select time",
                            "emoji": true
                        },
                        "action_id": "time"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Время начала",
                        "emoji": true
                    }
                },{
                    "type": "input",
                    "block_id": "pic",
                    "optional": true,
                    
                    "element": {
                        "initial_value": l.pic || process.env.ngrok+'/images/papers/cs.png',
                        "type": "url_text_input",
                        "action_id": "pic",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "url"
                        }
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "ссылка на фото"
                    }
                },{
                    "type": "input",
                    "block_id": "extras",
                    "optional": true,
                    "element": {
                        "type": "checkboxes",
                        "options": [
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "Только для fellows",
                                    "emoji": true
                                },
                                "value": "fellows"
                            }, {
                                "text": {
                                    "type": "plain_text",
                                    "text": "Только для админов",
                                    "emoji": true
                                },
                                "value": "admins"
                            },{
                                "text": {
                                    "type": "plain_text",
                                    "text": "Без регистрации",
                                    "emoji": true
                                },
                                "value": "noRegistration"
                            },
                        ],
                        "action_id": "extras"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "А также:",
                        "emoji": true
                    }
                }
            ]
        }
        return {
            "view_id": modal,
            "view": view
        }
    },
    lecture: (l) => {
        return {
            "title": {
                "type": "plain_text",
                "text": l.name
            },
            "callback_id": `classEdit_${l.id}`,
            "submit": {
                "type": "plain_text",
                "text": "Сохранить"
            },
            "blocks": [{
                    "type": "input",
                    "block_id": "name",
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "name",
                        "initial_value": l.name,
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Название"
                        }
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Название мероприятия"
                    }
                },
                {
                    "type": "input",
                    "block_id": "author",
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "author",
                        "initial_value": l.author,
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Автор"
                        }
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Как зовут кумира?"
                    }
                },
                {
                    "type": "input",
                    "block_id": "type",
                    "element": {
                        "type": "static_select",
                        "initial_value": l.type,
                        "action_id": "type",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Select an item",
                            "emoji": true
                        },
                        "options": [{
                                "text": {
                                    "type": "plain_text",
                                    "text": "лекция",
                                    "emoji": true
                                },
                                "value": "lecture"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "концерт",
                                    "emoji": true
                                },
                                "value": "concert"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "мероприятие",
                                    "emoji": true
                                },
                                "value": "event"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "игра",
                                    "emoji": true
                                },
                                "value": "game"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "вечер по интересам",
                                    "emoji": true
                                },
                                "value": "evening"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "встреча",
                                    "emoji": true
                                },
                                "value": "meeting"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "вечер",
                                    "emoji": true
                                },
                                "value": "evening"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "квартирник",
                                    "emoji": true
                                },
                                "value": "show"
                            },
                            {
                                "text": {
                                    "type": "plain_text",
                                    "text": "дегустация",
                                    "emoji": true
                                },
                                "value": "degustation"
                            }
                        ]
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Тип мероприятия",
                        "emoji": true
                    }
                },
                {
                    "type": "input",
                    "block_id": "description",
                    "initial_value": l.description,
                    "element": {
                        "type": "plain_text_input",
                        "multiline": true,
                        "action_id": "description"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Описание",
                        "emoji": true
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "Зал"
                    },
                    "block_id": "hall",
                    "initial_value": l.hall,
                    "accessory": {
                        "type": "external_select",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Начните вводить название",
                            "emoji": true
                        },
                        "action_id": "hall"
                    }
                },
                {
                    "type": "input",
                    "block_id": "price",
                    "initial_value": l.price,
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "price"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Стоимость",
                        "emoji": true
                    }
                },
                {
                    "type": "input",
                    "block_id": "duration",
                    "initial_value": l.duration,
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "duration"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Продолжительность",
                        "emoji": true
                    }
                },
                {
                    "type": "input",
                    "block_id": "date",
                    "initial_date": l.date,
                    "element": {
                        "type": "datepicker",
                        "initial_date": "2023-04-07",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Select a date",
                            "emoji": true
                        },
                        "action_id": "date"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Дата",
                        "emoji": true
                    }
                },
                {
                    "type": "input",
                    "block_id": "time",
                    "element": {
                        "type": "timepicker",
                        "initial_time": "18:00",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Select time",
                            "emoji": true
                        },
                        "action_id": "time"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Время начала (указывать по Киеву)",
                        "emoji": true
                    }
                },
                {
                    "type": "input",
                    "block_id": "pic",
                    "optional": true,
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "pic",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "url"
                        }
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "ссылка на фото"
                    }
                },
                {
                    "type": "input",
                    "block_id": "extras",
                    "optional": true,
                    "element": {
                        "type": "checkboxes",
                        "options": [{
                            "text": {
                                "type": "plain_text",
                                "text": "Отправить уведомления",
                                "emoji": true
                            },
                            "value": "alert"
                        }],
                        "action_id": "extras"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "А также:",
                        "emoji": true
                    }
                }
            ],
            "type": "modal"
        }
    },
    inprogress: {
        "response_action": "update",
        "view": {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "секундочку..."
            },
            "blocks": [{
                "type": "section",
                "text": {
                    "type": "plain_text",
                    "text": "...мы задумались...\n(это еще не конец)"
                }
            }]
        }
    },
    lecturesList: (l) => {
        let view = {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "Камо, друже"
            },
            "blocks": [{
                "type": "context",
                "elements": [{
                    "type": "plain_text",
                    "text": `Перед вами список из ${l.length} мероприятий в пространстве Papers:`,
                    "emoji": true
                }]
            }]
        }

        l.forEach(lecture => {
            view.blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": lecture.name
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": common.drawDate(lecture.date, 'ru'),
                        "emoji": true
                    },
                    "value": lecture.id.toString(),
                    "action_id": "lectureDetails"
                }
            })
        });
        return view;
    },
    filteredUsers: (modal, u, filter) => {
        let recent = u.sort((a, b) => a.createdAt._seconds - b.createdAt._seconds)
        let view = {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "Кто все эти люди?.."
            },
            "submit": {
                "type": "plain_text",
                "text": "ok"
            },
            "blocks": [{
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `Ниже вы найдете всех пользователей с флагом ${filter}: ${recent.length} шт.`
                }
            }, {
                "type": "input",
                "block_id": filter,
                "dispatch_action": true,
                "element": {
                    "type": "static_select",
                    "action_id": "usersPaginator",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select an item",
                        "emoji": true
                    },
                    "options": [{
                            "text": {
                                "type": "plain_text",
                                "text": "первые 50",
                                "emoji": true
                            },
                            "value": "0_50"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "51-100",
                                "emoji": true
                            },
                            "value": "50_50"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "101-150",
                                "emoji": true
                            },
                            "value": "100_50"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "151-200",
                                "emoji": true
                            },
                            "value": "150_50"
                        }, {
                            "text": {
                                "type": "plain_text",
                                "text": "201-250",
                                "emoji": true
                            },
                            "value": "200_50"
                        }, {
                            "text": {
                                "type": "plain_text",
                                "text": "251-300",
                                "emoji": true
                            },
                            "value": "250_50"
                        },

                    ]
                },
                "label": {
                    "type": "plain_text",
                    "text": "Пагинация",
                    "emoji": true
                }
            }]
        }


        recent.forEach(u => {
            view.blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": common.uname(u, u.id)
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": common.drawDate(u.createdAt._seconds * 1000, 'ru'),
                        "emoji": true
                    },
                    "value": u.id.toString(),
                    "action_id": "userDetails"
                }
            })
        });
        return {
            "view_id": modal,
            "view": view
        }
    },
    users: (u) => {
        let recent = u.sort((a, b) => b.createdAt._seconds - a.createdAt._seconds).slice(0, 5)
        let view = {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": "Кто все эти люди?.."
            },
            "blocks": [{
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `Ниже вы найдете 5 (из ${u.length}) самых новых пользователей бота — или сможете посмотреть списочный состав отдельных групп.`
                }
            }]
        }
        recent.forEach(u => {
            view.blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": common.uname(u, u.id)
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": common.drawDate(u.createdAt._seconds * 1000, 'ru'),
                        "emoji": true
                    },
                    "value": u.id.toString(),
                    "action_id": "userDetails"
                }
            })
        });

        view.blocks.push({
            "type": "actions",
            "elements": [{
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Показать всех",
                    "emoji": true
                },
                "action_id": "users_filtered_all"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "только админов",
                    "emoji": true
                },
                "value": 'admin',
                "action_id": "users_filtered_admin"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "только сотрудников",
                    "emoji": true
                },
                "value": 'insider',
                "action_id": "users_filtered_insider"
            }, {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "только fellows",
                    "emoji": true
                },
                "value": 'fellow',
                "action_id": "users_filtered_fellow"
            }]
        })
        return view
    },
    coworkingRecord: (modal, record, id, user, hall) => {
        let view = {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": `Запись в коворкинг`
            },
            blocks: [{
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": `Кабинет ${hall.name} @ ${record.date}`,
                    "emoji": true
                }
            }, {
                "type": "context",
                "elements": [{
                        "type": "mrkdwn",
                        "text": `*Кто*: ${common.uname(user,record.user)}`,
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Когда записался*: ${common.drawDate(record.createdAt._seconds*1000)}`,
                    },
                    {
                        "type": "mrkdwn",
                        "text": `*Статус*: ${record.active?(record.status == 'used' ? 'использована' : 'ждет'):'Отмена'}`,
                    }, {
                        "type": "mrkdwn",
                        "text": `*Статус оплаты*: ${record.paymentNeeded ? (record.payed ? 'оплачена' : 'не оплачена') : 'бесплатно'}`,
                    }
                ]
            }, {
                "dispatch_action": true,
                "type": "input",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "message_" + record.user
                },
                "label": {
                    "type": "plain_text",
                    "text": "Написать пользователю",
                    "emoji": true
                }
            }, {
                "type": "actions",
                "elements": [{
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Открыть гостя",
                        "emoji": true
                    },
                    "value": record.user.toString(),
                    "action_id": `userDetails`
                }, {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Отменить запись",
                        "emoji": true
                    },
                    "value": id,
                    "style": "danger",
                    "action_id": `coworkingRecord_cancel`
                }, {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Сделать бесплатным",
                        "emoji": true
                    },
                    "value": id,
                    "style": "danger",
                    "action_id": `coworkingRecord_free`
                }]
            }]
        }
        if (modal) {
            return {
                "view_id": modal,
                "view": view
            }
        }
        return view
    },
    ticketDetails: (modal, ticket, user, lecture, admin) => {
        let view = {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": `#${ticket.id}`
            },
            "blocks": [{
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": lecture.name,
                        "emoji": true
                    }
                },
                {
                    "type": "context",
                    "elements": [{
                            "type": "mrkdwn",
                            "text": `Зарегистрирован ${common.drawDate(ticket.createdAt._seconds*1000,false,{time:true})}`,
                        },
                        {
                            "type": "mrkdwn",
                            "text": ticket.active ? (ticket.status == 'used' ? 'использован' : 'активен') : 'заблокирован',
                        },
                        {
                            "type": "mrkdwn",
                            "text": ticket.iPayed ? 'оплачен' : (lecture.price ? 'не оплачен' : 'оплата не требуется'),
                        }
                    ]
                },
                {
                    "type": "divider"
                },
                {
                    "type": "context",
                    "elements": [{
                        "type": "plain_text",
                        "text": common.uname(user, ticket.user),
                        "emoji": true
                    }]
                },
                {
                    "type": "divider"
                },
                {
                    "dispatch_action": true,
                    "type": "input",
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "message_" + ticket.user
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Написать пользователю",
                        "emoji": true
                    }
                }, {
                    "type": "input",
                    "block_id": ticket.id,
                    "dispatch_action": true,
                    "element": {
                        "type": "plain_text_input",
                        "initial_value": ticket.comment || '',
                        "multiline": true,
                        "action_id": "ticket_comment"
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Добавить примечание для контролера",
                        "emoji": true
                    }
                },
                {
                    "type": "divider"
                }, {
                    "type": "actions",
                    "elements": [{
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Открыть мероприятие",
                            "emoji": true
                        },
                        "value": ticket.class,
                        "action_id": `lectureDetails`
                    }, {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Открыть гостя",
                            "emoji": true
                        },
                        "value": ticket.user.toString(),
                        "action_id": `userDetails`
                    }, {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Отменить запись",
                            "emoji": true
                        },
                        "value": ticket.id,
                        "style": "danger",
                        "action_id": `ticket_cancel`
                    }, {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Сделать бесплатным",
                            "emoji": true
                        },
                        "value": ticket.id,
                        "style": "danger",
                        "action_id": `ticket_free`
                    },{
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Гость пришел",
                            "emoji": true
                        },
                        "value": ticket.id,
                        "action_id": `ticket_used`
                    }]
                }
            ]
        }
        if (modal) {
            return {
                "view_id": modal,
                "view": view
            }
        }
        return view
    },
    lectureDetails: (modal, lecture, records) => {
        let view = {
            "type": "modal",
            "title": {
                "type": "plain_text",
                "text": common.drawDate(lecture.date, 'ru', {
                    time: true
                })
            },
            "blocks": [

                {
                    "type": "image",
                    "title": {
                        "type": "plain_text",
                        "text": "Приглашение на мероприятие.",
                        "emoji": true
                    },
                    "image_url": process.env.ngrok + "/paper/qr?class=" + lecture.id,
                    "alt_text": "Отсканируй и стартуй"
                },
                {
                    "type": "context",
                    "elements": [{
                        "type": "mrkdwn",
                        "text": `Ссылка на событие в боте https://telegram.me/paperstuffbot?start=class_${lecture.id}.`,
                    }]
                },
                {
                    "type": "context",
                    "elements": [{
                        "type": "mrkdwn",
                        "text": `Ссылка на событие в приложении https://telegram.me/paperstuffbot/app?startapp=class_${lecture.id}.`,
                    }]
                },
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": lecture.name,
                        "emoji": true
                    }
                }, {
                    "type": "divider"
                }, {
                    "type": "context",
                    "elements": [{
                        "type": "plain_text",
                        "text": lecture.hallName,
                        "emoji": true
                    }, {
                        "type": "plain_text",
                        "text": `Ведущий: ${lecture.author}`,
                        "emoji": true
                    }, {
                        "type": "plain_text",
                        "text": `Записались: ${[...new Set(records.map(r=>r.user))].length}`,
                        "emoji": true
                    }, {
                        "type": "plain_text",
                        "text": `Идут: ${records.filter(r=>r.active).length}`,
                        "emoji": true
                    }, {
                        "type": "plain_text",
                        "text": `Пришли: ${records.filter(r=>r.active && r.status == 'used').length}`,
                        "emoji": true
                    }]
                }, {
                    "type": "divider"
                }, {
                    "type": "context",
                    "elements": [{
                        "type": "plain_text",
                        "text": lecture.description || 'без описания',
                        "emoji": true
                    }]
                }, {
                    "type": "divider"
                }, {
                    "dispatch_action": true,
                    "type": "input",
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "lecture_announce_" + lecture.id
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Написать всем участникам",
                        "emoji": true
                    }
                }, {
                    "dispatch_action": true,
                    "type": "input",
                    "element": {
                        "type": "plain_text_input",
                        "action_id": "lecture_announceNoShow_" + lecture.id
                    },
                    "label": {
                        "type": "plain_text",
                        "text": "Написать всем, кто еще не пришел",
                        "emoji": true
                    }
                }, {
                    "type": "actions",
                    "elements": [{
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": `Изменить`,
                            "emoji": true
                        },
                        "value": lecture.id,
                        "action_id": `lecture_update_${lecture.id}`
                    },{
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": `тест админам`,
                            "emoji": true
                        },
                        "value": lecture.id,
                        "action_id": `lecture_alert_admins_${lecture.id}`
                    },{
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": `разослать уведомления`,
                            "emoji": true
                        },
                        "value": lecture.id,
                        "action_id": `lecture_alert_all_${lecture.id}`
                    }, {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Отменить",
                            "emoji": true
                        },
                        "value": lecture.id,
                        "style": "danger",
                        "action_id": `lecture_cancel_${lecture.id}`
                    }]
                }
            ]
        }
        
        // TBD сделать пагинацию пользователей

        records.sort((a, b) => b.createdAt < a.createdAt ? 1 : -1).slice(0,70).forEach(u => {
            view.blocks.push({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `${u.userName} ${u.active ? (u.status == 'used'?'✅':'🚷') : '👻'}`
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": common.drawDate(u.createdAt._seconds * 1000, 'ru', {
                            time: true
                        }),
                        "emoji": true
                    },
                    "value": u.id,
                    "action_id": "ticketDetails"
                }
            })
        })

        if (modal) {
            return {
                "view_id": modal,
                "view": view
            }
        }
        return view

    }
}

module.exports = {
    modals
};