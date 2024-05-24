


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

function selector(col,placeholder,id,user,extra){
    let s = ce('select')
        s.append(ce('option',false,false,placeholder||`выберите`,{value:''}))
        let l = user ? userLoad(col) : load(col)
    l.then(options=>{
        console.log(options);
        options.filter(o=>o.active).forEach(o=>{
            s.append(ce(`option`,false,false,o.name,{
                value: o.id,
                selected: o.id == id
            }))
        })
        if(extra) extra.forEach(o=>{
            s.append(ce(`option`,false,false,o.name,{
                value: o.value,
            }))
        })
    })
    return s
}


function onTelegramAuth(user,host) {
    console.log(user)
    axios.post(`${host?`/${host}`:``}/auth`,user)
        .then(ok=>{
            window.location.pathname = `${host?`/${host}`:``}/web`
        }).catch(err=>{
            alert(err.message)
        })
  }



function shimmer(light){
    if(light) return tg.HapticFeedback.impactOccurred('light')
    tg.HapticFeedback.notificationOccurred('success')
}

function drawDate(d,l,o){
    let options = {
        weekday:    'short',
        month:      'short',
        day:        '2-digit',
        timeZone:   'Asia/Tbilisi'
    }
    
    if(!o) o = {}

    if(o.time){
        options.hour= '2-digit',
        options.minute= '2-digit'
    }


    if(o.year || (+new Date() - +new Date(d) > 300*24*60*60*1000)) options.year = '2-digit'
    
    return new Date(d).toLocaleDateString(`${l||'ru'}-RU`,options)
}



function ce(tag, id, classList, innerHTML, options, innerText) {
    var t = document.createElement(tag);
    if (id) {
        t.id = id;
    }
    if (innerHTML) {
        t[innerText ? 'innerText' : 'innerHTML'] =  innerHTML;
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

function clearTags(v) {
    if (!v) {
        v = ''
    }
    v = v.toString().replace(/<br>/, ' ')
    return v.toString().replace(/(\<(\/?[^>]+)>)/g, '').replace(/&nbsp;/g, ' ').replace(/&mdash/, '—')
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
    return `${u.admin? `админ` : (u.insider ? 'сотрудник' : (u.fellow ? 'fellow' : `гость`))} ${u.username ? `@${u.username}` : `id ${id}` } (${u.first_name||''} ${u.last_name||''})`
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

function handleError(err) {
    let teleAlert = false;
    console.log(err)
    try{
        tg.showAlert(err.response && err.response.data ? err.response.data : (err.data || err.message))
        teleAlert = true
    } catch(err){
        // alert(err.data || err.message)
    }
    if(!teleAlert) alert(err.response && err.response.data ? err.response.data : (err.data || err.message))
    console.warn(err)
    try{
        tg.MainButton.hideProgress()
        tg.MainButton.hide()
    } catch(err){
        console.log(err)
    }
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
    axios.get(`${host ? `/${host}` : ''}/admin/logs?id=${userid}${filter||''}`)
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

function viewScreen(collection,id,fields){
    let p = preparePopupWeb(`${collection}_${id}`,false,false,true)
    load(collection,id).then(data=>{
        p.append(ce('h1', false, false, data.name,{
            onclick:function(){
                edit(collection,id,`name`,`text`,data.name,this)
            }
        }))
        fields.forEach(f=>{
            p.append(ce(f.tag||`p`,false,false,`${f.name}: ${data[f.attr] || `добавить`}`,{
                onclick:function(){
                    edit(collection,id,f.attr,f.type||`text`,data[f.attr]||null,this)
                }
            }))
        })
        p.append(deleteButton(collection,id,!data.active))
    })
}


function cutMe(txt, limit) {
    let t = txt.split('. ')
    let r = t[0];
    let i = 1

    while ((r + '. ' + t[i]).length < limit && i < t.length) {
        r = r + '. ' + t[i]
        i++
    }
    if(r.length < txt.length) r=r+' ...'
    return r
}

function addScreen(collection,name,o){
    let p = preparePopupWeb(`${collection}_new`,false,false,true)
    
    p.append(ce('h1', false, false, name))

    let f = ce(`form`,false,false,false,{
        action: `${host ? `/${host}` : ``}/admin/${collection}`,
        method: `post`,
        enctype:`multipart/form-data`
    })
    
    p.append(f)

    Object.keys(o).forEach(k=>{
        let input = o[k]
        
        if(input.type == `file`){
            let c = ce(`div`)
                c.append(ce(`p`,false,`info`,input.placeholder || `Прикрепите файл с обложкой.`))
                c.append(ce(`input`,false,false,false,{
                    type:       `file`,
                    accept:     `image/png, image/jpeg`,
                    name:       input.name || `cover`,
                    required:   input.required
                }))
            f.append(c)
        } else if(input.line){
            let l = ce(input.tag||`p`,input.id||false,input.class||false,input.text||false,{
                onclick: input.callback ? input.callback : null
            })
            f.append(l)
        } else if(input.selector){
            let s = selector(input.selector,input.placeholder,input.id)
            s.name = k;
            s.required= input.required
            f.append(s)
        } else if(input.datalist){
            load(input.datalist).then(col=>{
                let inp = ce(`select`,false,false,false,{
                    placeholder: input.placeholder||`выберите вариант...`,
                    list: `${k}_list`,
                    name: k,
                    required: input.required
                })
                let datalist = ce(`datalist`,`${k}_list`)
                col.forEach(el=>{
                    datalist.append(ce(`option`,false,false,el.name,{
                        value: el.id
                    }))
                })
                inp.setAttribute(`list`,`${k}_list`)
                f.append(inp)
                f.append(datalist)

                    
            })
            // let s = selector(input.selector,input.placeholder,input.id)
            // s.name = k;
            
        } else if(input.bool){
            let c = ce(`div`)
            let yes = ce('label',false,false,input.placeholder)
            yes.append(ce(`input`,false,false,false,{
                checked: false,
                type: `checkbox`,
                name: k,
                value: true
            }))
            c.append(yes)
            f.append(c)
        } else {
            let el = ce(input.tag||`input`,false,false,false,{
                placeholder:    input.placeholder || null,
                type:           input.type || `text`,
                name:           k,
                required:       input.required
            })
            Object.keys(input).forEach(t=>{
                el[t] = input[t]
            })
            f.append(el)
        }
        
    })

    // f.append(selector())

    f.append(ce(`button`,false,false,`Сохранить`,{
        type: `submit`
    }))

    return p

}

function editable(e){
    return ce(e.tag||`p`,false,false,e.value||'добавьте буквы',{
        onclick:function(){
            edit(e.entity,e.id,e.attr,e.type||`text`,e.value||null,this)
        }
    })
}

function showScreen(name, collection, line, addButton, sort, help, cl, filterTypes, filterSelector){
    closeLeft()
    let p = preparePopupWeb(collection,false,false,true)
    p.append(ce('h2',false,false,`Загружаем...`))
    let c = ce('div')
    load(collection).then(docs=>{
        p.innerHTML = '';
        // p.append(ce('h1', false, `header2`, name))

        let h = ce(`h1`,false,false,name)
        p.append(h)

        if(help){
            load(`settings`,collection).then(d=>{
                if(d.help){
                    
                    h.classList.add(`infoBubble`)

                    h.onclick = () => showHelp(d.help,name)
                } else {
                    h.onclick = () => showHelp(d.help,name)
                }
            })
        }

        if(addButton) p.append(ce('button', false, cl||false, `Добавить`, {
            onclick: () => addButton()
        }))

        
        
        docs.forEach(a => {
            c.append(line(a))
        });

        let cc = ce('div',false,`controls`)

            let sortAble = [{
                attr: `name`,
                name: `По названию`
            },{
                attr: `views`,
                name: `По просмотрам`
            },{
                attr: `createdAt`,
                name: `По дате создания`
            }]

            if(sort) sort.forEach(t=>sortAble.push(t))

            cc.append(sortBlock(sortAble,c,docs,line,cl))
        
        p.append(cc)

        if(filterTypes){
            let filters = ce(`div`,false,`flex`)

            Object.keys(filterTypes).forEach(type => {
                filters.append(ce('button', false, type, filterTypes[type], {
                    onclick: function () {
                        filterUsers(type, c, this, filterSelector || `.userLine`)
                    }
                }))
            })
            p.append(filters)
        }
        

        p.append(c)

        p.append(archiveButton(c,cl))
    })
    return {
        container:  p,
        listing:    c
    }
}


function filterUsers(role,container,button, selector){
    let c = button.parentNode;
    c.querySelectorAll('button').forEach(b=>b.classList.remove('active'))
    c.querySelectorAll('button').forEach(b=>b.classList.add('passive'))
    button.classList.add('active')
    button.classList.remove('passive')
    container.querySelectorAll(selector || '.divided').forEach(user=>{
        if(!role) return user.classList.remove('hidden')
        
        if(user.dataset[role] == 'true') {
            user.classList.remove('hidden')
        } else {
            user.classList.add('hidden')
        }
    })
}

function copyLink(link, app, text){
    return ce('button',false,`thin`,text||`ссылка`,{
        onclick:function(){
            navigator.clipboard.writeText(`${app||appLinkAdmin}?startapp=${link}`).then(s=>{
                try {
                    tg.showAlert(`Ссылка на раздел скопирована`)    
                } catch (error) {
                    alert(`ссылка скопирована`)
                }
                
            }).catch(err=>{
                console.warn(err)
            })
        }    
    })
}

function copyWebLink(link, path, text){
    return ce('button',false,`thin`,text||`ссылка на веб`,{
        onclick:function(){
            navigator.clipboard.writeText(`${link}/${path.join(`/`)}`).then(s=>{
                try {
                    tg.showAlert(`Ссылка на раздел скопирована`)    
                } catch (error) {
                    alert(`ссылка скопирована`)
                }
                
            }).catch(err=>{
                console.warn(err)
            })
        }    
    })
}

function logButton(collection,id,credit){
    return ce(`button`,false,
    // [`dateButton`,`dark`,`slim`]
    `thin`,
    credit||`Логи`,{
        onclick:()=>{
            let p = preparePopupWeb(`logs_${collection}_${id}`)
                p.append(ce('h2',false,false,`Загружаем...`))
                load(`logs`,`${collection}_${id}`).then(logs=>{
                    p.innerHTML = null;
                    p.append(ce('h1',false,false,credit||`Логи`))
                    logs.forEach(l=>{
                        p.append(logLine(l))
                    })
                })
        }
    })
}

function shuffle(array) {
    let currentIndex = array.length,  randomIndex;
    // While there remain elements to shuffle.
    while (currentIndex > 0) {
      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
    return array;
  }
  

function toggleCheckBox(collection,id,attr,value,placeholder,passive, toastMe){
    let cd = ce(`div`,false,`hiddenInput`)

    let l = ce(`label`,false,`toggleLabel`,false,{
        for: attr
    })

    let cb = ce(`input`,attr,false,false,{
        type:`checkbox`,
        name: attr,
        checked: value ? true : false
    })

    cd.append(cb)
    cd.append(l)

    l.append(ce(`span`,false,`info`,placeholder))
    
    if(!passive) cb.onchange=function(){
        axios.put(`${host ? `/${host}` : ''}/api/${collection}/${id}`,{
            attr: attr,
            value: this.checked
        }).then(s=>{
            toastMe ? toast(s.data.comment || sudden.fine()) : handleSave(s) 
        }).catch(handleError)
    }
    

    l.setAttribute(`for`,attr)
    
    return cd
}

function toggleButton(collection, id, attr, value, ifYes, ifNo, cl, layer){
    let b = ce('button',false,cl||false,(value?ifYes:ifNo),{
        dataset:{on:value?1:0},
        onclick:function(){
            axios.put(`${host ? `/${host}` : ''}/${layer||`admin`}/${collection}/${id}`,{
                attr: attr,
                value: !(Number(this.dataset.on))
            }).then(s=>{
                let newState = !(Number(this.dataset.on)) ? 1 : 0
                this.dataset.on = newState
                this.innerHTML = newState ? ifYes : ifNo
                handleSave(s)
            }).catch(handleError)
        }
    })
    return b;
}

function logLine(l){
    let c = ce('div',false,`sDivided`)
        c.append(ce(`span`,false,`info`,drawDate(l.createdAt._seconds*1000)))
        c.append(ce('p',false,false,l.text))
        
        if(l.user){
            c.append(ce('button',false,[`dateButton`,`dark`,`inline`],`Открыть профиль`,{
                onclick:()=>showUser(false,l.user)
            }))
        }

        if(l.task){
            c.append(ce('button',false,[`dateButton`,`dark`,`inline`],`Открыть задание`,{
                onclick:()=>showTask(l.task)
            }))
        }

        if(l.tag){
            c.append(ce('button',false,[`dateButton`,`dark`,`inline`],`Открыть тег`,{
                onclick:()=>showTag(l.tag)
            }))
        }

        

    return c;
}


function labelButton(text,checked){
    let c = ce('label')
    let inp = ce('input',false,false,false,{
        checked: checked,
        type: `checkbox`
    })
    c.append(inp)
    c.innerHTML += text
    return c
}

function s(el){
   el.parentNode.childNodes.forEach(n=>{
    n.classList.remove(`selected`)
   }) 
   el.classList.add(`selected`)
}

function deleteButton(collection,id,reverse,cl,callback){
    return ce('button',false,(cl||false),reverse?`Активировать`:`Архивировать`,{
        onclick:()=>{
            let proof = confirm(`Вы уверены?`)
            if(proof) {
                if(reverse) {
                    axios.put(`${host ? `/${host}` : ''}/admin/${collection}/${id}`,{
                        attr: `active`,
                        value: true
                    })
                        .then(s=>{
                            handleSave(s)
                            if(callback) callback()
                        })
                        .catch(handleError)
                } else {
                    axios.delete(`${host ? `/${host}` : ''}/admin/${collection}/${id}`)
                        .then(s=>{
                            handleSave(s)
                            if(callback) callback()
                        })
                        .catch(handleError)
                }
            } 
        }
    })
}


// ЛОГИ


function logButton(collection,id,credit){
    return ce(`button`,false,[`dateButton`,`dark`,`slim`],credit||`Логи`,{
        onclick:()=>{
            let p = preparePopupWeb(`logs_${collection}_${id}`)
                p.append(ce('h2',false,false,`Загружаем...`))
                load(`logs`,`${collection}_${id}`).then(logs=>{
                    p.innerHTML = null;
                    p.append(ce('h1',false,false,credit||`Логи`))
                    logs.forEach(l=>{
                        p.append(logLine(l))
                    })
                })
        }
    })
}

function logLine(l){
    let c = ce('div',false,`sDivided`)
        c.append(ce(`span`,false,`info`,drawDate(l.createdAt._seconds*1000)))
        c.append(ce('p',false,false,l.text))
        
        if(l.user){
            c.append(ce('button',false,[`dateButton`,`dark`,`inline`],`Открыть профиль`,{
                onclick:()=>showUser(false,l.user)
            }))
        }

        if(l.task){
            c.append(ce('button',false,[`dateButton`,`dark`,`inline`],`Открыть задание`,{
                onclick:()=>showTask(l.task)
            }))
        }

        if(l.tag){
            c.append(ce('button',false,[`dateButton`,`dark`,`inline`],`Открыть тег`,{
                onclick:()=>showTag(l.tag)
            }))
        }

        

    return c;
}


function load(collection, id, extra, whereToLook) {
    if(whereToLook && whereToLook[id]) {
        console.log(id, `из кэша`)
        return Promise.resolve(whereToLook[id])
    } 
    return axios.get(`${host ? `/${host}` : ''}/admin/${collection}${id?`/${id}`:''}${extra?`?${Object.keys(extra).map(k=>`${k}=${extra[k]}`).join(`&`)}`:''}`).then(data => {
        if(whereToLook) whereToLook[id] = data.data
        return data.data
    })
}



function sortBlock(sortTypes,container,array,callback,style){
    let c = ce('div',false,[`controls`,`flex`])
    sortTypes.forEach(type=>{
        c.append(ce('button',false,style||false,type.name,{
            onclick:function(){
                c.querySelectorAll(`.active`).forEach(b=>b.classList.remove(`active`))
                this.classList.add(`active`)
                container.innerHTML = null;
                array.sort((a,b)=>{
                    switch(type.attr){
                        case `views`:{
                            return (b.views||0) - (a.views||0)
                        }
                        case 'name':{
                            return sortableText(b.name) > sortableText(a.name) ? -1 : 0
                        }
                        case 'createdAt':{
                            return (a.createdAt||{})._seconds||0 - (b.createdAt||{})._seconds||0 
                        }
                        case `price`:{
                            return (+b.price||0) - (+a.price||0)
                        }
                        default:{
                            return a[type.attr] < b[type.attr] ? 1 :-1
                        }
                    }
                }).forEach(r=>{
                    container.append(callback(r))
                })
            }
        }))
    })

    return c;
}

function line(){
    // console.log(this.args)
    console.log(arguments)
    
    let c = ce(`div`,false,[`flex`,'line'])
    
    for (let i = 0; i < arguments.length; i++) {
        c.append(arguments[i])
    }
    
    return c
}

function toast(text){
    let c = ce(`div`,false,`toast`)
        c.append(ce(`p`,false,false,text))
    document.body.append(c)
    setTimeout(()=>{
        c.remove()
    },5000)
}


function detailsContainer(e){
    let details = ce(`div`,false,[`details`,`flex`])
        details.append(ce('span',false,`info`,drawDate(e.createdAt._seconds*1000,false,{time:true})))
        if(e.edited) details.append(ce('span',false,`info`,`отредактировано ${drawDate(e.edited._seconds*1000)}`))
        if(e.deleted) details.append(ce('span',false,`info`,`удалено ${drawDate(e.deleted._seconds*1000)}`))
        details.append(ce('span',false,[`info`,(e.views?`reg`:`hidden`)],e.views?`просмотров: ${e.views}`:''))
        if(e.createdBy && Number(e.createdBy)) load(`users`,e.createdBy, false, downLoadedUsers ? downLoadedUsers : false).then(author=>details.append(ce('span',false,`info`,uname(author.user ? author.user : author, author.id))))
        if(e.by && Number(e.by)) load(`users`,e.by, false, downLoadedUsers ? downLoadedUsers : false).then(author=>details.append(ce('span',false,`info`,uname(author.user ? author.user : author, author.id))))
        if(e.user && Number(e.user)) load(`users`,e.user, false, downLoadedUsers ? downLoadedUsers : false).then(author=>details.append(ce('span',false,`info`,`кому: ${uname(author.user ? author.user : author, author.id)}`,{onclick:()=>showUser(false,e.user)})))
        if(e.audience) details.append(ce('span',false,`info`,`Аудитория: ${e.audience||`нрзб.`}`))
    
    return details;
}

function listContainer(e,detailed,extra,dataset,alerts){
    let c =  ce('div',false,[`sDivided`,e.active?`reg`:`hidden`],false,{dataset:{active:e.active}})
    let right = ce(`div`)
    
    if(e.pic) {
        c.classList.add(`flex`)
        let pc = ce(`div`,false,`previewContainer`)
        pc.append(ce(`img`,false,`preview`,false,{src:e.pic}))
        c.append(pc)
        c.append(right)
    }

    if(detailed){
        let details = ce('div',false,[`details`,`flex`])
            details.append(ce('span',false,`info`,drawDate(e.createdAt._seconds*1000,false,{time:true})))
            if(e.edited) details.append(ce('span',false,`info`,`отредактировано ${drawDate(e.edited._seconds*1000)}`))
            if(e.deleted) details.append(ce('span',false,`info`,`удалено ${drawDate(e.deleted._seconds*1000)}`))
            details.append(ce('span',false,[`info`,(e.views?`reg`:`hidden`)],e.views?`просмотров: ${e.views}`:''))
            if(e.createdBy && Number(e.createdBy)) load(`users`,e.createdBy, false, downLoadedUsers ? downLoadedUsers : false).then(author=>details.append(ce('span',false,`info`,uname(author.user ? author.user : author, author.id))))
            if(e.by && Number(e.by)) load(`users`,e.by, false, downLoadedUsers ? downLoadedUsers : false).then(author=>details.append(ce('span',false,`info`,uname(author.user ? author.user : author, author.id))))
            if(e.user && Number(e.user)) load(`users`,e.user, false, downLoadedUsers ? downLoadedUsers : false).then(author=>details.append(ce('span',false,`info`,`кому: ${uname(author.user ? author.user : author, author.id)}`,{onclick:()=>showUser(false,e.user)})))
                

            if(e.audience) details.append(ce('span',false,`info`,`Аудитория: ${e.audience||`нрзб.`}`))

            if(extra) Object.keys(extra).forEach(key=>{
                console.log(key, e[key])
                if(e[key]) details.append(ce('span',false,`info`,`${extra[key]}: ${e[key]._seconds ? drawDate(e[key]._seconds*1000) : e[key]}`))
                c.dataset[key] = e[key]
            })
            if(dataset) Object.keys(dataset).forEach(key=>{
                c.dataset[key] = dataset[key]
            })

        e.pic ? right.append(details) :  c.append(details)
    }

    if(alerts&&alerts.length){
        let alertsContainer = ce('div',false,[`details`,`flex`])
        
        alerts.forEach(a=>{
            alertsContainer.append(ce(`span`,false,[`info`,`alert`],a))
        })

        e.pic ? right.append(alertsContainer) : c.append(alertsContainer);
    }

    if(e.pic) c.append = (e) => right.append(e)
    return c
}

function archiveButton(container,cl){
    return ce('button',false,cl||false,`Показать архивные записи`,{
        onclick:()=>{
            container.querySelectorAll(`.hidden`).forEach(c=>{
                c.classList.toggle(`hidden`)
            })
        }
    })
    
}

function sortableText(t){
    if(!t) t = '';
    let txt = t.toString().replace(/\»/g,'').replace(/\«/g,'').toLowerCase().trim()
    console.log(txt)
    return txt
}

function preparePopupWeb(name, link,weblink,state,lb,fslink,header) {
    
    let c = ce('div', false, 'popupWeb')

    c.append(ce('span', false, `closeMe`, `✖`, {
        onclick: () => {
            c.classList.add(`slideBack`)
            setTimeout(function () {
                c.remove()
            }, 500)
        }
    }))

    if(link)        c.append(copyLink(link,appLink, `ссылка на приложение`))
    if(weblink)     c.append(copyWebLink(web,weblink))
    if(fslink)      c.append(ce(`a`,false,`thin`,`firestore`,{href: fsdb+fslink,target:'_blank'}))
    if(state)       window.history.pushState({}, "", `web?page=${name}`);
    if(lb)          c.append(lb)

    if(header){
        let h = ce(`h1`,false,false,header)
        c.append(h)
        load(`settings`,name).then(d=>{
            if(d.help){
                h.classList.add(`infoBubble`)
                h.onclick = () => showHelp(d.help,name)
            } else {
                h.onclick = () => showHelp(d.help,name)
            }
        })
    }
    
    // if(weblink)c.append(copyLink(link,appLink))

    document.body.append(c)
    let content = ce('div', false, `content`)
    c.append(content)
    return content;
}



function newAuthor() {
    let p = preparePopupWeb(`author_new`)

    let name = ce('input', false, false, false, {
        placeholder: `Имя`,
        type: `text`
    })
    let description = ce('textarea', false, false, false, {
        placeholder: `description`
    })
    let pic = ce('input', false, false, false, {
        placeholder: `ссылка на картинку`,
        type: `text`
    })
    p.append(name)
    p.append(pic)
    p.append(description)
    p.append(ce('button', false, false, `Сохранить`, {
        onclick: function () {
            if (name.value) {
                this.setAttribute(`disabled`, true)
                axios.post(`${host ? `/${host}` : ''}/admin/authors`, {
                        name:           name.value,
                        description:    description.value,
                        pic:            pic.value
                    }).then(handleSave)
                    .catch(handleError)
                    .finally(s => {
                        this.removeAttribute(`disabled`)
                    })

            }

        }
    }))
}

function modal(title){
    if(document.querySelectorAll(`.editWindow`)) {
        document.querySelectorAll(`.editWindow`).forEach(m=>m.remove())
    }
    let c = ce(`div`,false,[`editWindow`,`inpC`])
    
    if(title) c.append(ce(`h1`,false,false,title))
    
    document.body.append(c)

    return c
}

function showHelp(text, name){

    if(document.querySelector(`.editWindow`)) {
        document.querySelector(`.editWindow`).remove()
    } else {
        let container = modal()

        if(!text || !text.length){
            container.append(ce(`p`,false,[`story`,`dark`],`Тут может быть ваша подсказка`))
        } else {
            text.forEach(p=>{
                container.append(ce(`p`,false,[`story`,`dark`],p))
            })
        }

        container.append(ce('button',false,`thin`,`Редактировать`,{
            onclick:()=>{
                let h = modal()
                h.append(ce(`h2`,false,false,`Правим подсказку для ${name}`))
                let txt = ce(`textarea`,false,false,false,{
                    value: text ? text.join('\n') : ''
                })
                h.append(txt)
                h.append(ce(`button`,false,[`dark`,`dateButton`],`Сохранить`,{
                    onclick:()=>{
                        if(txt.value) axios[text?`put`:`post`](`${host ? `/${host}` : ''}/admin/settings/${name}`,{
                            attr: `help`,
                            value: txt.value.split('\n')
                        }).then(handleSave)
                        .catch(handleError)
                    }
                }))
            }
        }))
        
    }

    
}

function handleSave(s) {

    let ctx = `Ура! Пожалуй, стоит обновить страницу.`

    if (s.data.hasOwnProperty('success')){
        try {
            tg.showAlert(`${s.data.success ? sudden.fine() : sudden.sad()} ${s.data.comment || ''}` || ctx)
        } catch(err){
            alert(`${s.data.success ? sudden.fine() : sudden.sad()} ${s.data.comment || ''}` || ctx)
        }
        
    } else {
        alert(ctx)
    }

    try{
        tg.MainButton.hideProgress()
        tg.MainButton.hide()
    } catch(err){
        console.log(err)
    }
}

function unameShort(user){
    return `${user.username ? `@${user.username}` : (user.first_name+' '+user.last_name).trim() }`
}

var sudden = {
    good: [
        'грандиозно',
        'волшебно',
        'вот это да',
        'беллиссимо',
        'мажестик',
        'ура',
        'невероятно',
        'анкруаябль',
        'фантастиш',
        'воу',
        'кул',
        'найс',
        'роскошь'
    ],
    bad: [
        'о-оу',
        'ой',
        'оц',
        'уффф',
        'увых',
        'печаль',
        'все тлен',
        'никогда такого не было',
        'здрасьте, приехали',
        'штош',
        'печаль',
        'прости, командир'
    ],
    fine: function () {
        return this.good[Math.floor(Math.random() * this.good.length)]
    },
    sad: function () {
        return this.bad[Math.floor(Math.random() * this.bad.length)]
    },
}

function byDate(a,b){
    return b.date._seconds-a.date._seconds
}