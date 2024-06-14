
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getDatabase,
    ref,
    onChildAdded,
    query,
    orderByChild,
    onChildChanged,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let mask = {
    createdAt:(v)=>drawDate(v,false,{time:true}),
    url:(v,d)=>`<a href="${v}"><img src="${d.imageUrl}"></a>`,
    // pairAddress: p.pairAddress,
    address:(v)=>v,
    symbol:(v)=>v,
    bfb:(v)=>v,
    mintAuthority:(v)=>v,
    freezeAuthority:(v)=>v,
    totalSupply:(v)=>v,
    exist:(v)=>v,
    liquiditySupply:(v)=>v,
    liquiditySupplyPercent:(v)=>v,
    pooledSol:(v)=>v,
    initialSolPrice:(v)=>v,
    solRate:(v)=>v,
    directRate:(v)=>v,
    singleTransactionBuyRate:(v)=>v,
    buyersTransferRate:(v)=>v,
    cexTransferRate:(v)=>v,
    priceNative:(v)=>v,
    priceUsd:(v)=>cur(v,`USD`),
    difPriceNative:(v)=>v,
    difPriceusd:(v)=>v,
    priceCompare:(v)=>v,
    volume_h24:(v)=>v,
    volume_h6:(v)=>v,
    volume_h1:(v)=>v,
    volume_m5:(v)=>v,
    priceChange_m5:(v)=>v,
    priceChange_h1:(v)=>v,
    priceChange_h6:(v)=>v,
    priceChange_h24:(v)=>v,
    liquidity_usd:(v)=>v,
    liquidity_base:(v)=>v,
}


function cur(v,cur) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        currency: cur||'RUB',
    }).format(Number(v));
}

const firebaseConfig = {
    apiKey: "AIzaSyDPz4F30B7qzxR1ZpGybHuZJeOTVAv4XxE",
    authDomain: "dimazvalimisc.firebaseapp.com",
    // databaseURL: "https://dimazvalimisc-default-rtdb.europe-west1.firebasedatabase.app",
    databaseURL: "https://dimazvalimisc-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "dimazvalimisc",
    storageBucket: "dimazvalimisc.appspot.com",
    messagingSenderId: "1033227630983",
    appId: "1:1033227630983:web:804a29311cb28a93e93b22"
};

let app = initializeApp(firebaseConfig);
let db = getDatabase(app)

let inc = query(ref(db, 'autoshell/pairs'),orderByChild('createdAt'))





setHTML(document.querySelector('#test'));

ko.applyBindings(dataM, document.querySelector('#test'));

onChildAdded(inc, pair => {
    console.log(pair.val())

    let l = ref(db,`autoshell/pairs/${pair.key}`)
    // let line = pairLine(pair.val())
    
    // document.querySelector(`#table`).append(line);
    
    let v = new autoPair(pair.val())

    dataM.add(v);

    onValue(l,pair=>{
        
        console.log(`обновилось`)
        
        v.update(pair.val())

        // document.querySelector(`#table`).insertBefore(pairLine(pair.val()),line)
        // line.remove()
    })
    
})


function setHTML(c){
    
    let filters = ce(`div`)
    Object.keys(mask2).forEach(k=>{
        filters.append(ce(`button`,false,false,k,{
            dataset:{
                bind: `event:{click:function(){toggleHidden("${k}")}},attr:{'data-hidden':hidden.indexOf("${k}")>-1}`
            }
        }))
    })
    c.append(filters)

    let table = ce(`table`,false,false,false)

    let header = ce(`thead`)

    let h = ce(`tr`)
        Object.keys(mask2).forEach(k=>{
            h.append(ce(`th`,false,false,k,{
                dataset:{
                    bind: `click:sort("${k}"),visible:hidden.indexOf("${k}")==-1`
                }
            }))
        })
    header.append(h)


    
    table.append(header)

    let tbody = ce(`tbody`,false,false,false,{dataset:{bind: `foreach:pairs`}})
    table.append(tbody)

    let line = ce(`tr`)
    Object.keys(mask2).forEach(k=>{
        line.append(ce(`td`,false,false,false,{
            dataset:{
                bind: `html:${k},visible:$parent.hidden.indexOf("${k}")==-1`
            }
        }))
    })
    tbody.append(line)
    c.append(table)    
}

let fb = ce(`div`,`header`)

document.body.prepend(fb);

let hl = ce(`tr`)

// Object.keys(mask).forEach(k=>{
//     hl.append(ce(`th`,false,false,k,{dataset:{
//         [k]: mask[k](line[k])
//     }}))
//     fb.append(ce(`button`,false,false,k,{
//         onclick:function(){
//             this.classList.toggle(`active`);

//             document.querySelectorAll(`[data-${k}]`).forEach(i=>{
//                 i.classList.toggle(`hidden`)
//             })
//         }
//     }))
// })

document.querySelector(`#table`).append(hl)

function pairLine(line) {
    let row = ce(`tr`);
    Object.keys(mask2).forEach(t=>{
        row.append(ce(`td`, false, false, mask[t](line[t]),{
            dataset:{
                [t]: mask[t](line[t])
            }
        }))
    })
    return row;
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


