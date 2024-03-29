const { default: axios } = require("axios");

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
  

function letterize2(v,word){

    let options = {
        'месте':[
            'первом',
            'втором',
            'третьем'
        ],
        'строке':[
            'первой',
            'второй',
            'третьей'
        ],
        'позиции':[
            'первой',
            'второй',
            'третьей'
        ]
    }

    let r =Object.keys(options)[Math.floor(Math.random()*Object.keys(options).length)]
    return options[r][v]+' '+r
}

function handleQuery(col,byDate,byName){
    let res = col.docs.map(q => {
        let f = q.data();
        f.id = q.id
        return f
    })
    if(byDate){
        res = res.sort((a,b)=>b.createdAt._seconds-a.createdAt._seconds)
    }
    if(byName){
        res = res.sort((a,b)=>sortableText(b.name) > sortableText(a.name) ? -1 : 0)
    }
    devlog(res)
    return res
}

function sortableText(t){
    if(!t) t = '';
    let txt = t.toString().replace(/\»/g,'').replace(/\«/g,'').toLowerCase().trim()
    console.log(txt)
    return txt
}

function handleDoc(d){
    
    if(!d.exists) return false;

    let t = d.data();
        t.id = d.id;
    return t;
}



function getNewUsers(udb,period){
    
    let since = new Date(+new Date()-(period||7)*24*60*60*1000)
    
    return udb
        .where('createdAt','>=',since)
        .get()
        .then(col=>{
            return col.docs.length
        })
}


function letterize(v, word) {
    switch (word) {
        case 'позиция':{
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
        
        case 'ходка':{
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

        case 'строка':{
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
        case 'место':{
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

    return v+' '+word;
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


function devlog(v) {
    if (process.env.develop == 'true') {
        console.log(v)
    }
}

function clearTags(v) {
    if (!v) {
        v = ''
    }
    v = v.toString().replace(/<br>/, ' ')
    return v.toString().replace(/(\<(\/?[^>]+)>)/g, '').replace(/&nbsp;/g, ' ').replace(/&mdash/, '—')
}


function cur(v,cur) {
    devlog(v)
    devlog(cur)
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        currency: cur || 'RUB',
    }).format(Number(v||0));
}

const dimazvali = 144489840

function uname(u,id){
    return `${u.admin? `админ` : (u.insider ? 'сотрудник' : (u.fellow ? 'fellow' : (u.known ? 'гость' : 'пионер')))} ${u.username ? `@${u.username}` : `id ${id}` } (${u.first_name||''} ${u.last_name||''})`
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


const emotions = {
    lost: () => {
        let e = [
            'Куда вас, сударь, к черту занесло?..',
            'Оглянитесь вокруг, где это вы?..',
            'Бегите оттуда!',
            'Вот это поворот!'
        ]
        return e[Math.floor(Math.random() * e.length)]
    },
    confirm: (name) => {
        let e = [
            `Будет исполнено, ${name}!`,
            `Так точно, ${name}!`,
            `Roger that.`,
            `Есть!`
        ]
        return e[Math.floor(Math.random() * e.length)]
    },
    error: () => {
        let e = [
            `Увы!`,
            `Позор джунглям!`,
            `Вот никогда же так не было, и вот... опять...`,
            `Упс...`,
            `Оуч!`,
            `Ай-яй-яй...`,
            `Оц.`
        ]
        return e[Math.floor(Math.random() * e.length)]
    }
}

function deleteMessage(mid, pro, user) {
    axios.post('https://api.telegram.org/bot' + (pro ? pro : process.env.token) + '/deleteMessage', {
        chat_id: user.id,
        message_id: mid
    }, {
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(success => {
        return true;
    }).catch(err => {
        return false;
    })
}



function checkObscene(v) {
    let fWords = ['хуй', 'пизда', 'ебан', 'ебать', 'fuck']
    let clear = true;
    try {
        fWords.forEach(w => {
            if (v.toLowerCase().indexOf(w) > -1) {
                clear = false;
            }
        })
    } catch (err) {
        console.log(err)
    }
    return clear
}

async function getDoc(col,id){
    if(typeof id == 'number') id = id.toString()
    if(!id) return {}
    return col.doc(id).get().then(doc=>handleDoc(doc)) 
}


function handleError(err,res){
    console.log(err)
    if(res) res.status(500).send(err.message)
    alertMe({
        text: `Ошибка! ${err.message}`
    })
}


module.exports = {
    clearTags,handleError,shuffle,getDoc,handleDoc,sudden,deleteMessage,checkObscene,emotions,alertMe,letterize,letterize2,dimazvali,greeting,cur,handleQuery,uname,drawDate,devlog,getNewUsers
};

