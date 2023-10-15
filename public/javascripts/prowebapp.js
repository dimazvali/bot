

function toggleStatus(reservation, type, before){
    document.querySelector('.buttonsContainer').style.display = 'none';
    let comment = ce('textarea','comment',false,false,{
        placeholder: (type=='accept'?
        'При желании вы можете указать ограничения и условия посадки — они будут переданы клиенту.':
        'Пожалуйста, назовите причину. Нет мест? Или что-то иное?..')
    })
    start.append(comment)
    window.Telegram.WebApp.MainButton.setText(type=='accept'?'Принять':'Отклонить')
    window.Telegram.WebApp.MainButton.onClick(()=>sendfeebback(reservation,type,comment,before))
    window.Telegram.WebApp.BackButton.show()
    window.Telegram.WebApp.BackButton.onClick(()=>{
        window.Telegram.WebApp.MainButton.hide()
        window.Telegram.WebApp.BackButton.hide()
        document.querySelector('.buttonsContainer').style.display = 'block';
        document.querySelector('#comment').remove()
    })
    
}

function sendfeebback(r,t,c,b){
    window.Telegram.WebApp.MainButton.showProgress()
    
        axios.post(`/pro/toggleOrder`,{
            reservation: r,
            action:     t,
            user:       window.Telegram.WebApp.initDataUnsafe.user.first_name+' / '+window.Telegram.WebApp.initDataUnsafe.user.id,
            comment:    c.value,
            place:      pid,
            before:     b
        }).then(s=>{
            start.append(ce('p',false,false,s.data))
        }).catch(err=>{
            start.append(ce('p',false,false,err.message))
        }).finally(()=>{
            window.Telegram.WebApp.MainButton.hide();
            c.remove();
        })
    }
    
