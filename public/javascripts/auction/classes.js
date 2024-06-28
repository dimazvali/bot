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
    equalTo,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


let app = initializeApp(firebaseConfig);
let db = getDatabase(app)

class Page{
    constructor(d,tg,handleError,host,userLoad,drawDate){
        this.showAlert = (txt) => tg.showAlert(txt);
        this.active =       ko.observable(`lobby`)
        this.sactive= (v)=> {
            this.active(v)
            if(v == `profile`){
                this.transactions([])
                userLoad(`transactions`).then(transactions=>{
                    transactions.forEach(t => {
                        this.transactions.push({
                            comment:    t.comment || 'обновление',
                            amount:     t.amount,
                            date:       drawDate(t.createdAt._seconds*1000,false,{time:true})
                        })    
                    });
                    
                })
            }
        }
        this.transactions =  ko.observableArray([])
        this.auctions =     ko.observableArray(d.auctions.map(a=>new Auction(a)))
        this.balance =      ko.observable(d.profile.score)
        // this.iterations =   ko.observableArray(d.iterations.map(i=>new Iteration(i,tg,this.balance())))
        this.iterations =   ko.observableArray([])
        this.username =     ko.observable(d.profile.username)
        this.avatar =       ko.observable(d.profile.photo_url)
        this.hash =         ko.observable(d.profile.hash)
        
        this.requestPayment = (amount) =>{
            axios.post(`/${host}/api/refill`,{
                amount: +amount
            }).then(s=>{
                
                tg.openInvoice(s.data.invoice);

            }).catch(handleError)
        }

        this.stake = (i) => {
            i.active(false)
            axios
                .post(`/${host}/api/stake/${i.id}`)
                .then(s=>{
                    tg.showAlert(s.data)
                })
                .catch(err=>{
 
                    if(err.response.data.invoice){
                        console.log(`УДАЛИТЬ инвойс`)
                        tg.showAlert(err.response.data.comment)
                        tg.openInvoice(err.response.data.invoice)
                    } else {
                        tg.showAlert(err.message)
                    }
                })
                .finally(i.active(true))
        }

        onValue(ref(db,`auction/users/${d.profile.hash}`),a=>{
            console.log(`обновился юзер`)
            a = a.val();
            if(a){
                this.balance(a.score)
            }
        })

        onChildAdded(
            query(ref(db,`auction/iterations`), orderByChild(`active`),equalTo(true)),
            a=>{
                console.log(a.val())
                let n = new Iteration(a.val(),tg,this.balance())
                if(this.iterations.indexOf(n)==-1){
                    this.iterations.push(n)
                }
            }
        )

        
    }
}

function requestPayment(amount){
    axios.post(`/${host}/refill`,{
        amount: +amount
    }).then(s=>{
        tg.openInvoice(s.data.invoice)
    }).catch(handleError)
}

function z(v){
    if(v<10) return '0'+v
    return v
}

function time2(v){
    let h = Math.floor(v / (60*60*1000))
    let hs = h*60*60*1000
    let m = Math.floor((v-hs) / (60*1000))
    let ms = m*60*1000
    let s = Math.floor((v-hs-ms) / 1000)
    return `${h?`${h}:`:''}${z(m)}:${z(s)}`
}

class Iteration{
    constructor (a,tg,balance){
        
        this.id =           a.id
        this.name =         ko.observable(a.auctionName),
        this.active =       ko.observable(a.active),
        this.base =         ko.observable(a.base),
        this.stake =        ko.observable(a.stake),
        this.stakeHolder =  ko.observable(a.stakeHolder),
        this.timer =        ko.observable(a.timer._seconds ? a.timer._seconds*1000 : a.timer)
        this.left =         ko.observable(time2(+new Date(a.timer._seconds ? a.timer._seconds*1000 : a.timer) - new Date()))
        
        this.ava =          ko.observable(null);

        this.pushStake = (v) =>{
            console.log(balance)
            console.log(+this.base())
            
            if(balance > +this.base()){
                tg.showAlert(`ставлю`)
            } else {
                tg.showAlert(`нет денег`)
            }
        }

        this.setAva = (pic) => {
            this.ava(pic)
            // setTimeout(()=>{
            //     this.ava(null)
            // },1000)
        }

        setInterval(()=>{
            this.left(time2(+new Date(this.timer()) - new Date()))
        },1000)  

        onValue(ref(db,`auction/iterations/${a.id}`),a=>{
            
            console.log(`обновилась итерация аукциона ${this.name()}`)
            
            a = a.val();
            
            console.log(a)
            
            if(a){
                this.name(a.auctionName)
                this.active(a.active || false)
                this.base(a.base)
                this.stake(a.stake)
                this.stakeHolder(a.stakeHolder)
                this.setAva(a.stakeHolderAva || null)
                this.timer(a.timer)
            }
            
            
        })
    }
}
class Auction{
    constructor (a){

        this.id =       a.id
        this.name =     ko.observable(a.name),
        this.active =   ko.observable(a.active),
        this.base =     ko.observable(a.base)
        
        onValue(ref(db,`auction/auction/${a.id}`),a=>{
            console.log(`обновился аукцион ${this.name()}`)
            a = a.val();
            if(a){
                this.name(a.name)
                this.active(a.active)
            }
            
        })
    }
    
}

export {
    Page
}