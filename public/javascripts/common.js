
function line(tag, values,cb) {
    let l = ce('tr');
    values.forEach(v => {
        let td = ce(tag, false, false, v)
        if(cb){
            td.onclick = cb
        }
        l.append(td);
    })
    return l
}



function shimmer(light){
    if(light) return tg.HapticFeedback.impactOccurred('light')
    tg.HapticFeedback.notificationOccurred('success')
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



function ce(tag, id, classList, innerHTML, options) {
    var t = document.createElement(tag);
    if (id) {
        t.id = id;
    }
    if (innerHTML) {
        t.innerHTML = innerHTML;
    }
    if (classList) {
        if (typeof classList == 'object') {
            classList.forEach(cl => {
                t.classList.add(cl)
            })
        } else {
            t.classList.add(classList)
        }
    }
    if (options) {
        Object.keys(options).forEach(key => {
            if (key !== 'dataset') {
                t[key] = options[key]
            } else {
                Object.keys(options.dataset).forEach(d => {
                    t.dataset[d] = options.dataset[d];
                })
            }
        })
    }

    return t;
}


function cur(v,cur) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        currency: cur||'RUB',
    }).format(Number(v));
}

function subscribe(id){
    let s = document.querySelector('#subs')
    if(s.value){
        axios.put(window.location.origin,{
            email: s.value,
            list: id || 2,
            status: 'subscribe'
        }).then(()=>{
            alert('Ура! все получилось')
        }).catch(err=>alert(err.message))
    } else {
        alert('Вы забыли указать почту')
    }
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

function uname(u,id){
    return `${u.admin? `админ` : (u.insider ? 'сотрудник' : (u.fellow ? 'fellow' : (u.known ? 'гость' : 'пионер')))} ${u.username ? `@${u.username}` : `id ${id}` } (${u.first_name||''} ${u.last_name||''})`
}


function preparePopup(type) {
    tg.BackButton.show();
    tg.onEvent('backButtonClicked', clearPopUp)

    tg.HapticFeedback.notificationOccurred('success')

    if (document.querySelector(`[data-type="${type}"]`)) {
        document.querySelector(`[data-type="${type}"]`).remove()
    }

    mcb = clearPopUp
    let popup = ce('div', false, 'popup', false, {
        dataset: {
            type: type
        }
    })
    

    document.body.append(popup)
    let content = ce('div')
    popup.append(content)

    popup.addEventListener('scroll', function(){
        if(content.getClientRects()[0].y<0){
            popup.querySelector('.header').classList.add('small')  
        } else {
            popup.querySelector('.header').classList.remove('small')  
        }
    });

    tg.MainButton.hide()
    return content
}



function handleError(err){
    tg.showAlert(err.data || err.message)
}





function showLoader(){
    document.body.append(ce('div','loader'))
}

function hideLoader(){
    document.querySelector('#loader').remove()
}



function letterize(v, word) {
    switch (word) {
        case 'билет':{
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' билетов';
                }
                if (l > 1) {
                    return v + ' билета';
                }
                if (l == 1) {
                    return v + ' билет';
                }
            }
            return v + ' билетов';
        }
        case 'балл':{
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' баллов';
                }
                if (l > 1) {
                    return v + ' балла';
                }
                if (l == 1) {
                    return v + ' балл';
                }
            }
            return v + ' баллов';
        }
        case 'человек': {
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' человек';
                }
                if (l > 1) {
                    return v + ' человека';
                }
                if (l == 1) {
                    return v + ' человек';
                }
            }
            return v + ' человек';
        }
        case 'позиция': {
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' позиций';
                }
                if (l > 1) {
                    return v + ' позиции';
                }
                if (l == 1) {
                    return v + ' позицию';
                }
            }
            return v + ' позиций';
        }

        case 'ходка': {
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' ходок';
                }
                if (l > 1) {
                    return v + ' ходки';
                }
                if (l == 1) {
                    return v + ' ходка';
                }
            }
            return v + ' ходок';
        }

        case 'строка': {
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' строк';
                }
                if (l > 1) {
                    return v + ' строки';
                }
                if (l == 1) {
                    return v + ' строку';
                }
            }
            return v + ' строк';
        }
        case 'место': {
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' мест';
                }
                if (l > 1) {
                    return v + ' места';
                }
                if (l == 1) {
                    return v + ' место';
                }
            }
            return v + ' мест';
        }
        case 'раз':
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' раз';
                }
                if (l > 1) {
                    return v + ' раза';
                }
                if (l == 1) {
                    return v + ' раз';
                }
            }
            return v + ' раз';
        case 'комментарий':
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' комментариев';
                }
                if (l > 1) {
                    return v + ' комментария';
                }
                if (l == 1) {
                    return v + ' комментарий';
                }
            }
            return v + ' комментариев'
        case 'предложение':
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' предложений';
                }
                if (l > 1) {
                    return v + ' предложения';
                }
                if (l == 1) {
                    return v + ' предложение';
                }
            }

            return v + ' предложений';
        case 'блюдо':
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' блюд';
                }
                if (l > 1) {
                    return v + ' блюда';
                }
                if (l == 1) {
                    return v + ' блюдо';
                }
            }

            return v + ' блюд';
        case 'день':
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' дней';
                }
                if (l > 1) {
                    return v + ' дня';
                }
                if (l == 1) {
                    return v + ' день';
                }
            }
            return v + ' дней'
        case 'ресторан':
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' ресторанов';
                }
                if (l > 1) {
                    return v + ' ресторана';
                }
                if (l == 1) {
                    return v + ' ресторан';
                }
            }
            return v + ' ресторанов'
        case 'район':
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' районов';
                }
                if (l > 1) {
                    return v + ' района';
                }
                if (l == 1) {
                    return v + ' район';
                }
            }
            return v + ' районов'
        case 'раздел':
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' разделов';
                }
                if (l > 1) {
                    return v + ' раздела';
                }
                if (l == 1) {
                    return v + ' раздел';
                }
            }
            return v + ' разделов'

        case 'гость':
            if (v < 11 || v > 14) {
                var l = v.toString().slice(-1);
                if (l > 4) {
                    return v + ' гостей';
                }
                if (l > 1) {
                    return v + ' гостя';
                }
            }
            return v + ' гостей'

        case 'дата':
            if (v > 4 && v < 21) {
                return v + ' дат';
            } else {
                var ll = +v.toString().slice(-1);
                if (ll == 1) {
                    return v + ' дата';
                } else if (ll > 1 && ll < 5) {
                    return v + ' даты';
                }
                return v + ' дат';
            }
            case 'правка':
                if (v > 4 && v < 21) {
                    return v + ' правок';
                } else {
                    var ll = +v.toString().slice(-1);
                    if (ll == 1) {
                        return v + ' правка';
                    } else if (ll > 1 && ll < 5) {
                        return v + ' правки';
                    }
                    return v + ' правок';
                }
                case 'заведение':
                    if (v > 4 && v < 21) {
                        return v + ' заведений';
                    } else {
                        switch (v.toString().slice(-1)) {
                            case '1':
                                return v + ' заведениe';
                            case '2':
                                return v + ' заведения';
                            case '3':
                                return v + ' заведения';
                            case '4':
                                return v + ' заведения';
                            default:
                                return v + ' заведений';
                        }
                    }
    }

    return word;
}

function showLogs(filter,description) {
    showLoader();
    axios.get(`/${host}/admin/logs?id=${userid}${filter||''}`)
        .then(data => {
            let p = preparePopup(filter?'log':'logs')
            p.append(ce('h1', false, `header`, 'Логи'+(description||'')))
            data.data.forEach(record => {
                let lc = ce('div',false,'divided')
                    lc.append(ce('span', false, 'info', drawDate(record.createdAt._seconds * 1000),{
                        dataset:{ctx: `🕒`},
                    }))
                    lc.append(ce('p', false, false, record.text))
                    if(record.admin){
                        lc.append(ce('a',false,'clickable',`по админу`,{
                            onclick:()=>showLogs(`&by=admin&value=${record.admin}`,` по админу ${record.admin}`)
                        }))
                    }
                    if(record.user){
                        lc.append(ce('a',false,'clickable',`по пользователю`,{
                            onclick:()=>showLogs(`&by=user&value=${record.user}`, ` по пользователю ${record.user}`)
                        }))
                    }
                    if(record.event){
                        lc.append(ce('a',false,'clickable',`по событию`,{
                            onclick:()=>showLogs(`&by=event&value=${record.event}`, ` по событию ${record.event}`)
                        }))
                    }
                    if(record.chain){
                        lc.append(ce('a',false,'clickable',`по сетке`,{
                            onclick:()=>showLogs(`&by=chain&value=${record.chain}`, ` по сетке ${record.chain}`)
                        }))
                    }
                p.append(lc)
            });
        })
        .catch(handleError)
        .finally(hideLoader)
}

function copyLink(link,app, text){
    return ce('button',false,`thin`,text||`ссылка`,{
        onclick:function(){
            navigator.clipboard.writeText(`${app||appLinkAdmin}?startapp=${link}`).then(s=>{
                tg.showAlert(`Ссылка на раздел скопирована`)
            }).catch(err=>{
                console.warn(err)
            })
        }    
    })
}
