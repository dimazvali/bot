
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



let reminderThemes = {
    '1': 'Позвонить клиенту',
    '2': 'Позвонить в ресторан',
    '3': 'Назначить встречу',
    '4': 'Взять отзыв',
    '5': 'Сумма счета',
    '6': 'Снять резервации',
    '7': 'Сменить дату',
    '8': 'Проверить заказ',
    '9': 'Подтвердить предварительный заказ'
}

let avOrders = [
    474,
    422,
    447,
    481,
    551,
    756,
    754
]

let avDayLoad = [
    0.0092,
    0.0044,
    0.0024,
    0.0012,
    0.0007,
    0.0008,
    0.0012,
    0.0035,
    0.0083,
    0.0188,
    0.0489,
    0.0683,
    0.0891,
    0.0898,
    0.0870,
    0.0862,
    0.0865,
    0.0841,
    0.0800,
    0.0724,
    0.0613,
    0.0463,
    0.0325,
    0.0172
]

function getUserName(operator) {
    if(operator === null){
        return 'без консультанта'
    }
    try {
        return users.filter(u => u.id == operator)[0].name
    } catch (error) {
        return operator
    }
}


function getWikiPages() {
    document.querySelectorAll('[data-wiki]').forEach(w=>{
        axios(window.location.origin + `/wiki/${w.dataset.project||'call'}/${w.dataset.wiki}`).then(d => {
            w.innerHTML = d.data.wiki_page.text
            w.append(ce('a',false,'info','открыть в вики',{
                href: `https://r.restorating.ru/projects/${w.dataset.project||'call'}/wiki/${w.dataset.wiki}`
            }))
        })
    })
}

function getUserStats(id,el) {
    axios(window.location.origin + `/edu/api/users/${id}/stats`).then(r=>{
        let statsDiv = ce('div');
        Object.keys(r.data).forEach(p=>{
            let pDiv = ce('div')
                pDiv.append(ce('h3',false,false,'Программа '+p))
                pDiv.append(ce('h5', false, false, 'Начинал(-а)'))
            r.data[p].attempts.sort().forEach(a=>{
                pDiv.append(ce('p',false,'info',new Date(a).toLocaleString()))
            })
            pDiv.append(ce('h5', false, false, 'Пройденные шаги:'))
            let s = [...new Set(r.data[p].steps.map(s => s.step))]
            console.log(s)
            console.log(r.data[p].steps.map(s => s.step))
            s.forEach(step=>{
                pDiv.append(ce('p', false, false, step))
                r.data[p].steps.filter(s=>s.step == step).sort().forEach(s=>{
                    pDiv.append(ce('span', false, 'info', new Date(s.time).toLocaleString()))
                })
            })
            statsDiv.append(pDiv)
        })
        el.parentNode.insertBefore(statsDiv,el)

    })
}

function updateUser(el,id) {
    let newSet = [];
        el.parentNode.querySelectorAll("input:checked").forEach(i => newSet.push(i.name))
    axios.put(window.location.origin + `/edu/api/users/${id}/update`,{departments:newSet}).then(r => {
        console.log(r.data)
    }).catch(err=>alert(err.message))
}

function updateProgrma(el, id) {
    let newSet = [];
    el.parentNode.querySelectorAll("input:checked").forEach(i => newSet.push(i.name))
    axios.put(window.location.origin + `/edu/api/programs/${id}/update`, {departments: newSet}).then(r => {
        console.log(r.data)
    }).catch(err => alert(err.message))
}

function activateProgram(slug,status,el) {
    axios.put(window.location.origin + `/edu/api/programs/${slug}/update`, {
        active: status
    }).then(r => {
        console.log(r.data)
        if (status) {
            el.parentNode.dataset.active = status
        } else {
            delete el.parentNode.dataset.active
        }
    }).catch(err => alert(err.message))
}

function activate(id, status, el) {
    axios.put(window.location.origin + `/edu/api/users/${id}/update`, {
        active: status
    }).then(r => {
        console.log(r.data)
        if(status){
            el.parentNode.dataset.active = status
        } else {
            delete el.parentNode.dataset.active
        }

    }).catch(err => alert(err.message))
}

function changeProgramName(slug,el) {
    let newName = prompt('Введите новое название')
    if (newName){
        axios.put(window.location.origin + `/edu/api/programs/${slug}/update`, {
            title: newName
        }).then(r => {
            console.log(r.data)
            el.innerHTML = newName

        }).catch(err => alert(err.message))
    }
}

function changeProgramDesc(slug, el) {
    let ta = ce('textarea',false,false,false,{
        placeholder: 'Новое описание',
        value: el.innerHTML
    })
    let sv = ce('button',false,false,'Сохранить',{
        onclick:()=>{
            if(ta.value){
                sv.setAttribute('disabled',true)
                axios.put(window.location.origin + `/edu/api/programs/${slug}/update`, {
                    description: ta.value
                }).then(r => {
                    el.innerHTML = ta.value;
                    ta.remove()
                    sv.remove()
                }).catch(err => {
                    alert(err.message)
                    sv.removeAttribute('disabled')
                })
            } else {
                alert('Я не вижу ваших букв')
            }
        }
    })
    el.parentNode.insertBefore(ta,el)
    el.parentNode.insertBefore(sv, el)
}

function addProgram(el) {
    let deps=[
        {
            code: 'ed',
            label: 'Редакция'
        },
        {
            code: 'cc',
            label: 'Кол-центр'
        },
        {
            code: 'sales',
            label: 'Отдел продаж'
        }, {
            code: 'admin',
            label: 'Админы КЦ'
        }
    ]
    
    let npc = ce('div')

    let slug = ce('input', false, false, false, {
        placeholder: 'slug'
    })

    let title = ce('input', false, false, false, {
        placeholder: 'Название'
    })
    let description = ce('textarea', false, false, false, {
        placeholder: 'Описание'
    })
    let departments = ce('select',false,false,false,{
        multiple: true
    })

    deps.forEach(d=>{
        departments.append(ce('option', false, false, d.label,{
            value: d.code
        }))
    })

    

    
    let sv = ce('button', false, false, 'Сохранить', {
        onclick: () => {
            if (slug.value && title.value && description.value && departments.value) {
                sv.setAttribute('disabled', true)
                axios.put(window.location.origin + `/edu/api/programs/${slug.value}/add`, {
                    title:title.value,
                    departments: [...departments.options].filter(x => x.selected).map(s => s.value),
                    description:description.value
                }).then(r => {
                    alert('Отлично! Обновите страницу, чтобы увидеть результат')
                    npc.remove()
                }).catch(err => {
                    alert(err.message)
                    sv.removeAttribute('disabled')
                })
            } else {
                alert('Я не вижу ваших букв')
            }
        }
    })
    
    npc.append(slug)
    npc.append(title)
    npc.append(description)
    npc.append(departments)
    npc.append(sv)

    el.parentNode.insertBefore(npc, el)
}

function showSteps(slug,button) {
    axios(window.location.origin + `/edu/api/programs/${slug}/steps`).then(r => {
        let sc = ce('div')
            r.data.forEach(step=>{
                sc.append(stepContainer(step, slug))
            })
            sc.append(stepContainer({}, slug))
        button.parentNode.insertBefore(sc,button)
        button.remove()
    }).catch(err => {
        alert(err.message)
    })
}

let stepContainer = (v,slug)=>{
    if(!v){
        v = {}
    }
    let stepC = ce('div')
        let h = ce('h4', false,false, 'Шаг #'+v.id)
        if (!v.id) {
            h.innerHTML = 'Новый шаг'
        }

        let index = ce('input', false, false, false, {
            placeholder: 'Порядковый номер',
            value: v.index || null
        })

        let l = ce('label')
            let active = ce('input', false, 'ci', false, {
                type: 'checkbox'
            })
            l.append(active);
        
        if(v.active){
            active.checked = true;
        }

        // l.innerHTML += ' Активность'

        let title = ce('input', false, false, false, {
            placeholder: 'Название шага',
            value: v.title || null
        })
        let description = ce('input', false, false, false, {
            placeholder: 'Описание шага',
            value: v.description || null
        })
        let beforeLabel = ce('p',false,false,'Укажите id предыдущего шага')
        let before = ce('input', false, false, false, {
            placeholder: 'что-то типа wJf0mp55W4a6pBEK7dFA',
            value: v.before || null
        })
        let afterLabel = ce('p',false,false,'Укажите id следующего шага')
        let next = ce('input', false, false, false, {
            placeholder: 'что-то типа wJf0mp55W4a6pBEK7dFA',
            value: v.next || null
        })
        
        stepC.append(h)
        stepC.append(index)
        stepC.append(title)
        stepC.append(l)
        stepC.append(description)
        stepC.append(beforeLabel)
        stepC.append(before)
        stepC.append(afterLabel)
        stepC.append(next)

        let sb = ce('button', false, (v.id ? 'gb' : 'bb'), (v.id ? 'обновить' : 'добавить'))

        if(v.id){
            sb.onclick = () => {
                sb.setAttribute('disabled',true)
                axios.put(window.location.origin + `/edu/api/steps/${v.id}/update`,{
                    index:+index.value || 0,
                    active: active.checked || false,
                    title:title.value || null,
                    description:description.value || null,
                    before:before.value || null,
                    next:next.value || null,
                }).then(()=>{
                    sb.removeAttribute('disabled')
                }).catch(err=>{
                    sb.removeAttribute('disabled')
                    alert(err.message)
                })
            }
        } else {
            sb.onclick = () => {
                sb.setAttribute('disabled', true)
                axios.post(window.location.origin + `/edu/api/${slug}`, {
                    index: index.value || null,
                    title: title.value || null,
                    description: description.value || null,
                    before: before.value || null,
                    next: next.value || null,
                },{
                    headers: {
                        user: adminKey
                    }
                }).then(result=>{
                    sb.removeAttribute('disabled')
                    sb.parentNode.parentNode.insertBefore(stepContainer(result.data), sb.parentNode)
                }).catch(err=>{
                    sb.removeAttribute('disabled')
                    alert(err.message)
                })
            }
        }

        stepC.append(sb)

        if(v.id){
            stepC.append(ce('button',false,'hb','Открыть контент',{
                onclick:()=>{
                    axios(window.location.origin + `/edu/api/steps/${v.id}/content`).then(steps=>{
                        let stepsContainer = ce('div');
                        steps.data.forEach(c=>{
                            stepsContainer.append(stepContentContainer(c, slug, v.id))
                        })
                        stepsContainer.append(stepContentContainer(null, slug, v.id))
                        stepC.append(stepsContainer)
                    })
                }
            }))
        }

        return stepC
}


function handleError(err){
    tg.showAlert(err.data || err.message)
}

let stepContentContainer = (v, slug,step) => {
    if (!v) {
        v = {}
    }
    let stepC = ce('div')
        
        let h = ce('h5', false, false, 'Блок #' + v.id)

        if(!v.id){
            h.innerHTML = 'Новый блок'
        }

        let index = ce('input', false, false, false, {
            placeholder: 'Порядковый номер',
            value: v.index || null
        })

        let l = ce('label')
        let active = ce('input', false, 'ci', false, {
            type: 'checkbox'
        })
        l.append(active);
        if (v.active) {
            active.checked = true;
        }


        let type = ce('select')

        let pt = [
            {
                code: 'wiki',
                label: 'вики'
            }, {
                code: 'HTML',
                label: 'html'
            }, {
                code: 'video',
                label: 'видео'
            }
        ]

        pt.forEach(t=>{
            let o = ce('option',false,false,t.label,{
                value: t.code
            })
            type.append(o)
        })
        if(v.type){
            type.value = v.type
        }
        

        let data = ce('textarea', false, false, false, {
            placeholder: 'контент',
            value: v.data || null
        })

        let project = ce('input',false,false,false,{
            value: v.project || null,
            placeholder: 'проект (применимо для блоков типа «вики»)'
        })

    stepC.append(h)
    stepC.append(index)
    stepC.append(l)
    stepC.append(type)
    stepC.append(data)
    stepC.append(project)

    let sb = ce('button', false, (v.id ? 'gb' : 'bb'), (v.id ? 'обновить' : 'добавить'))

    if (v.id) {
        sb.onclick = () => {
            sb.setAttribute('disabled', true)
            axios.put(window.location.origin + `/edu/api/stepsContent/${v.id}/update`, {
                index: +index.value || 0,
                type: type.value || null,
                active: active.checked || false,
                data: data.value || null,
                project: project.value || null
            }).then(() => {
                sb.removeAttribute('disabled')
            }).catch(err => {
                sb.removeAttribute('disabled')
                alert(err.message)
            })
        }
    } else {
        sb.onclick = () => {
            sb.setAttribute('disabled', true)
            axios.post(window.location.origin + `/edu/api/${slug}/${step}`, {
                type: type.value || null,
                data: data.value || null,
                project: project.value || null
            }, {
                headers: {
                    user: adminKey
                }
            }).then(result => {
                sb.removeAttribute('disabled')
                sb.parentNode.parentNode.insertBefore(stepContentContainer(result.data,slug,step), sb.parentNode)
                sb.parentNode.parentNode.append(stepContentContainer(null, slug, step))
                sb.parentNode.remove()
            }).catch(err => {
                sb.removeAttribute('disabled')
                alert(err.message)
            })
        }
    }

    stepC.append(sb)

    return stepC
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