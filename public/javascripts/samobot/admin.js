
let dc = null


window.onload= ()=>{
    dc = document.querySelector('#dc')
}

function getCourse(id) {
    axios.get(`/samokat/api/course/${id}`,{
        headers:{
            admin: author
        }
    }).then(d=>{
        d = d.data;
        dc.innerHTML = '';
        
        dc.append(ce('h2',false,false,d.course.title))

        dc.append(ce('textarea',false,false,false,{
            placeholder: 'Описание (при желании)',
            value: d.course.description || null,
            onchange:function () {
                axios.put(`/samokat/api/course/${id}`,{
                    description: this.value || null
                },{
                    headers:{
                        admin: author
                    }
                }).then(()=>s()).catch(err=>alert(err.message))
            }
        }))

        dc.append(ce('button', false, false, 'активность: ', {
            dataset:{
                active: d.course.active
            },
            onclick:function(){
                axios.put(`/samokat/api/course/${id}`, {
                    active: this.dataset.active == 'true' ? false : true
                }, {
                    headers: {
                        admin: author
                    }
                }).then(() => {
                    this.dataset.active = this.dataset.active == 'true' ? false : true
                }).catch(err => alert(err.message))
            }
        }))

        let llc = ce('div');
            llc.append(ce('h3',false,false, 'Лекции'));
        dc.append(llc);

        d.lections.forEach(lr => {
            let lc = ce('div');

                axios.get(`/samokat/api/lection/${lr.lection}`,{
                    headers:{
                        admin: author
                    }
                }).then(l=>{
                    l = l.data
                    l.id = lr.lection
                    lc.append(ce('h4',false,false,l.title))
    
                    lc.append(ce('input',false,false,false,{
                        placeholder: 'ссылка на лекцию',
                        value: l.link,
                        onchange:function(){
                            if(!this.value) return alert('Ссылка обяательна!')
                            axios.put(`/samokat/api/lection/${l.id}`, {
                                link: this.value
                            }, {
                                headers: {
                                    admin: author
                                }
                            }).then(() => s()).catch(err => alert(err.message))
                        }
                    }))
    
                    lc.append(ce('textarea', false, false, false, {
                        placeholder: 'доступы (логины, пароли, ограничения)',
                        value: l.credentials,
                        onchange: function () {
                            axios.put(`/samokat/api/lection/${l.id}`, {
                                credentials: this.value || null
                            }, {
                                headers: {
                                    admin: author
                                }
                            }).then(() => s()).catch(err => alert(err.message))
                        }
                    }))
    
                    lc.append(ce('button', false, false, 'Отвязать', {
                        onclick: function () {
                            axios.delete(`/samokat/api/coursesLections/`, {
                                course: id,
                                lection: l.id
                            }, {
                                headers: {
                                    admin: author
                                }
                            }).then(() => {
                                lc.delete()
                            }).catch(err => alert(err.message))
                        }
                    }))
    
                    
                })
                

            llc.append(lc)
        });

        llc.append(ce('button', false, false, 'Добавить', {
            onclick: function () {
                let t = prompt('Как называться будет?')
                if (t) {
                    let l = prompt('ссылку в студию!')
                    if (l && t) {
                        axios.post(`/samokat/api/lection/`, {
                            title: t,
                            link: l,
                            course: id
                        },{
                            headers:{
                                admin: author
                            }
                        }).then(() => {
                            getCourse(id)
                        }).catch(err => alert(err.message))
                    }
                }
            }
        }))

    }).catch(err=>{
        alert(err.message)
    })
}





function s(txt) {
    if(!txt) txt = 'Обновились';
    let p = ce('div',false,'popup',txt);
    document.body.append(p);
    setTimeout(() => {
        p.remove()
    }, 1500);
}