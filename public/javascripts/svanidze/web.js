let host = `svanidze`
let subHost = `admin`
let downLoadedUsers = {};
let botLink = `https://t.me/dimazvalibot`
let buttonStyle = []



function uname(u,id){
    return `${u.admin? `admin` : (u.insider ? 'associate' : (u.fellow ? 'fellow' : `user`))} ${u.username ? `@${u.username}` : `id ${id}` } (${u.first_name||''} ${u.last_name||''})`
}

if(start){
    switch(start[0]){
        case `users`:{
            if(start[1]){
                showUser(start[1])
            } else {
                showUsers()
            }
        }
    }
}

function showPayments(){
    showScreen(`Subscriptions`,`payments`,paymentLine)
}

function showUsers(){
    showScreen(`Users`,`users`,showUserLine,false)
}

function checkUser(u){
    let alerts = [];
    if(!u.payed) alerts.push(`not subscribed`)
    if(u.blocked) alerts.push(`blocked`)
    return alerts
}

function showUserLine(u){
    let c = listContainer(u,true,{language_code:`lang`,payed: `subscription`},false,checkUser(u));
        c.append(ce(`h3`,false,false,uname(u, u.id),{
            onclick:()=>showUser(u.id)
        }))
    return c;
}


function checkPayment(p){
    let alerts = [];
    
    if(p.till > new Date().toISOString()) {
        if(+new Date(p.till) - +new Date() < 7*24*60*60*1000) alerts.push(`expires in a week`)
    } 
    return alerts
}

function paymentLine(p){
    let c = listContainer(p,true,{till:`till`},false,checkPayment(p));
        if(p.active) c.append(ce(`button`,false,`deleteButton`,`Withdraw`,{
            onclick: () =>{
                axios.delete(`/${host}/admin/payments/${p.id}`)
                    .then(s=>{
                        c.dataset.active = false;
                    })
                    .catch(handleError)
            }
        }))
    return c;
}

function messageLine(m){
    
    m.active = m.hasOwnProperty(`deleted`) ? false : true
    
    let c = listContainer(m,true,false,{
        isReply:        m.isReply,
        isIncoming:     !m.isReply,
        user:           m.user,
        reply:          m.isReply?true:false,
        incoming:       !m.isReply?true:false,
    })

    if(!m.active) c.classList.remove(`hidden`)

    c.append(ce(`p`,false,false,m.text || `w/o text`))

    if(m.textInit) c.append(ce(`p`,false,false,`original text: ${m.textInit}`))

    let bc = ce(`div`,false,`flex`)
        c.append(bc)

    if(m.messageId && !m.deleted  && (+new Date() - new Date(m.createdAt._seconds*1000 < 48*60*60*1000))){
        bc.append(deleteButton(`messages`,m.id,false,[`active`,`dark`,`dateButton`],()=>message.remove()))
        if(!m.edited) bc.append(ce(`button`,false,buttonStyle,`edit`,{
            onclick:()=>{
                let ew = modal()
                    let txt = ce(`textarea`,false,false,false,{
                        placeholder: `write something`,
                        value: m.text || null
                    })
                     
                    ew.append(txt);

                    ew.append(ce(`button`,false,false,`Save`,{
                        onclick:()=>{
                            if(txt.value) axios.put(`/${host}/admin/messages/${m.id}`,{
                                attr: `text`,
                                value: txt.value
                            }).then(handleSave)
                            .catch(handleError)
                        }
                    }))
            }
        }))
    }

    if(!m.isReply){
        bc.append(ce(`button`,false,buttonStyle,`Answer`,{
            onclick:()=>{
                let b = modal()
                let txt = ce(`textarea`,false,false,false,{placeholder: `Write something`})
                    b.append(txt)
                    b.append(ce(`button`,false,buttonStyle,`Send`,{
                        onclick:function(){
                            if(!txt.value) return alert(`No letters provided`)
                            this.setAttribute(`disabled`,true)
                            axios.post(`/${host}/admin/messages`,{
                                text: txt.value,
                                user: m.user
                            }).then(handleSave)
                            .catch(handleError)
                            .finally(()=>{
                                txt.value = null;
                                this.removeAttribute(`disabled`)
                            })
                        }
                    }))
            }
        }))
    }

    return c
}


function showUser(id){
    let p = preparePopupWeb(`user_${id}`,false,false,true)
    load(`users`,id).then(u=>{
        
        p.append(ce(`h1`,false,false,uname(u, u.id)))

        p.append(line(
            toggleButton(`users`,u.id,`blocked`,u.blocked||false,`Unblock`,`Block`,[`dateButton`,`dark`]),
            toggleButton(`users`,u.id,`admin`,u.admin||false,`Withdrow admin rights`,`Make an admin`,[`dateButton`,`dark`]),
            toggleButton(`users`,u.id,`payed`,u.payed||false,`Withdraw payed status`,`Mark as payed`,[`dateButton`,`dark`]),
        ))
        
        let payments = ce(`div`)
        p.append(payments)
        payments.append(ce(`h2`,false,false,`Payments`))
        load(`payments`,false,{user: id}).then(list=>{
            payments.append(ce(`button`,false,false,`Register payment`,{
                onclick: ()=>addPayment(id)
            }))
            list.forEach(l=>{
                payments.append(paymentLine(l))
            })
        })


        
            let messenger = ce('div')
            
            p.append(messenger)
    
            messenger.append(ce(`button`,false,buttonStyle,`Open chat`,{
                onclick:function(){
                    this.remove()
                    messenger.append(ce(`h2`,false,false,`Chat:`))
                    load(`messages`,false,{user:id}).then(messages=>{
                        let mc = ce(`div`,false,`messenger`)
                        messenger.append(mc)
                        messages.forEach(m=>{
                            mc.prepend(messageLine(m))
                        })
                        let txt = ce('textarea',false,false,false,`Write something`)
                        messenger.append(txt)
                        messenger.append(ce(`button`,false,buttonStyle,`Send`,{
                            onclick:()=>{
                                if(txt.value){
                                    axios.post(`/${host}/admin/messages`,{
                                        text: txt.value,
                                        user: u.id
                                    }).then(s=>{
                                        
                                        alert(`sent!`)
                                        let message = ce('div',false,false,false,{dataset:{reply:true}})
                                            message.append(ce(`span`,false,`info`,drawDate(new Date(),false,{time:true})))
                                            message.append(ce(`p`,false,false,txt.value))
                                            txt.value = null;
                                        mc.prepend(message)
                                    }).catch(err=>{
                                        alert(err.message)
                                    })
                                }
                            }
                        }))
                    })
                }
            }))
        
    })
}

start = start.split('_')

switch(start[0]){
    case `newOffer`:{
        console.log(`newOffer_${start[1]}`)
        if(start[1]){
            addOffer({book:start[1]})
        } else {
            addOffer()
        }
        break;
    }

    case `books`:{
        if(start[1]){
            if(start[1] == `new`) {
                addBook()
            } else {
                showBook(start[1])
            }
            
        } else {
            showBooks()
        }
        break;
    }

    case `offers`:{
        if(start[1]){
            showOffer(start[1])
        } else {
            showOffers()
        }
        break;
    }

    case `deals`:{
        if(start[1]){
            showDeal(start[1])
        } else {
            showDeals()
        }
        break;
    }
}


function showDeals(){
    showScreen(`Сделки`, `deals`,showDealLine,false,false,true)
}




function addPayment(id){
    addScreen(`payments`,`Payment for the user ${id}`,{
        user:           {type: `hidden`,hidden:true,value: id},
        till:           {type: `date`},
    })
}