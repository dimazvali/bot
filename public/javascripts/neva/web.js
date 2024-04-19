let host = ``
let downLoadedUsers = {};
let botLink = `https://t.me/dimazvalibot`

function closeLeft() {
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p => p.remove())
}

function showAuthors(){
    showScreen(`Ведущие`,`authors`,showAuthorLine,addAuthor)
}

function showPrograms(){
    showScreen(`Программы`,`programs`,showProgramLine,addProgram)
}


start = start.split('_')
switch(start[0]){
    case `shows`:{
        if(start[1]){
            showShow(start[1])
        } else {
            showShows()
        }
        break;
    }
    case `authors`:{
        if(start[1]){
            showAuthor(start[1])
        } else {
            showAuthors()
        }
        break;
    }
    case `programs`:{
        if(start[1]){
            showProgram(start[1])
        } else {
            showPrograms()
        }
        break;
    }
    
}

function showProgramLine(p){
    let c = listContainer(p,true,{shows:`выпусков`,played:`прослушано`})
        c.append(ce(`h2`,false,false,p.name,{
            onclick: ()=>showProgram(p.id)
        }))
        c.append(ce(`p`,false,false,p.description))
    return c;
}

function checkConsistency(type,data){
    let issues = [];
    switch(type){
        case `show`:{
            if(!data.date) issues.push(`нет даты публикации`);
            break;
        }
        case `author`:{
            if(!data.pic) issues.push(`нет фото`);
            if(!data.description) issues.push(`нет описания`);
            break;
        }
    }
    return issues
}

function showShowLine(s){
    let c = listContainer(s,true,{played:`прослушано`},{played:s.played||0},checkConsistency(`show`,s))
        c.append(ce(`h2`,false,false,s.name,{
            onclick: ()=>showShow(s.id)
        }))
        c.append(ce(`p`,false,false,s.description))
    return c
}

function showAuthorLine(a){
    let c = listContainer(a,true,false,false,checkConsistency(`author`,a))
        c.append(ce(`h2`,false,false,a.name,{
            onclick: ()=>showAuthor(a.id)
        }))
        c.append(ce(`p`,false,false,a.description))
    return c
}


function addAuthor(){
    addScreen(`authors`,`Новый автор`,{
        name:       {placeholder:`Название`},
        slug:       {placeholder: `slug`},
        description:{placeholder:`Описание`,type:`textarea`},
        pic:        {placeholder:`картинка`}
    })
}

function addProgram(){
    addScreen(`programs`,`Новая программа`,{
        name:       {placeholder:`Название`},
        slug:       {placeholder: `slug`},
        author:     {selector:`authors`,placeholder:`Автор`},
        description:{placeholder:`Описание`,type:`textarea`},
        pic:        {placeholder:`картинка`}
    })
}

function addShow(){
    addScreen(`shows`,`Новый выпуск`,{
        name:       {placeholder:`Название`},
        description:{placeholder:`Описание`,type:`textarea`},
        program:    {selector:'programs',placeholder: `Программ`},
        pic:        {placeholder:`картинка`},
        date:       {placeholder: `дата выпуска`,type:'date'}
    })
}

function showAuthor(id){
    let p = preparePopupWeb(`authors_${id}`,false,false,true)
    load(`authors`,id).then(s=>{
        
        p.append(ce(`h1`,false,false,s.name,{
            onclick:function(){
                edit(`tags`,id,`name`,`text`,s.name,this)
            }
        }))

        p.append(ce(`p`,false,false,s.description || `Добавьте описание`,{
            onclick:function(){
                edit(`tags`,id,`description`,`textarea`,s.description,this)
            }
        }))
        
        p.append(deleteButton(`tags`,id,!s.active))

    })
}


function showTag(id){
    let p = preparePopupWeb(`tags_${id}`,false,false,true)
    load(`tags`,id).then(s=>{
        
        p.append(ce(`h1`,false,false,s.name,{
            onclick:function(){
                edit(`tags`,id,`name`,`text`,s.name,this)
            }
        }))

        p.append(ce(`p`,false,false,s.description,{
            onclick:function(){
                edit(`tags`,id,`description`,`textarea`,s.description,this)
            }
        }))
        
        p.append(deleteButton(`tags`,id,!s.active))

        p.append(ce('textarea',false,false,false,{
            value: s.html
        }))

        tinymce.init({
            selector: 'textarea',
            plugins: 'anchor autolink charmap codesample emoticons image link lists media searchreplace table visualblocks wordcount checklist mediaembed casechange export formatpainter pageembed linkchecker a11ychecker tinymcespellchecker permanentpen powerpaste advtable advcode editimage advtemplate tableofcontents footnotes mergetags typography inlinecss',
            toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table mergetags | addcomment showcomments | spellcheckdialog a11ycheck typography | align lineheight | checklist numlist bullist indent outdent | emoticons charmap | removeformat',
            tinycomments_mode: 'embedded',
            tinycomments_author: 'Author name',
            mergetags_list: [
              { value: 'First.Name', title: 'First Name' },
              { value: 'Email', title: 'Email' },
            ],
            ai_request: (request, respondWith) => respondWith.string(() => Promise.reject("See docs to implement AI Assistant")),
          });

        p.append(ce(`button`,false,[`dark`,`dateButton`],`Сохранить правки в HTML`,{
            onclick:()=>{
                let html = tinymce.activeEditor.getContent("#html");
                axios.put(`/admin/tags/${s.id}`,{
                    attr: `html`,
                    value: html
                }).then(handleSave)
                .catch(handleError)
            }
        }))
    })
}

var marker = null;

var map;

function initMap(form,lat,lng) {
    var tbilisi = {
      lat: lat || 41.710950,
      lng: lng || 44.783232
    };
  
    map = new google.maps.Map(document.getElementById('map'), {
      zoom: 15,
      center: tbilisi,
      mapTypeId: 'terrain'
    });
  
    if(lat&&lng){
        addMarker({
            lat: lat,
            lng: lng
        })
    }
    // This event listener will call addMarker() when the map is clicked.
    map.addListener('click', function(event) {
      addMarker(event.latLng);
      console.log(event.latLng)

      if(form){
        
        if(form.querySelector('[name="lat"]')) form.querySelector('[name="lat"]').remove()
        if(form.querySelector('[name="lng"]')) form.querySelector('[name="lng"]').remove()
        
        form.append(ce(`input`,false,false,false,{
            type: `text`,
            name: `lat`,
            value: event.latLng.lat()
        }))

        form.append(ce(`input`,false,false,false,{
            type: `text`,
            name: `lng`,
            value: event.latLng.lng()
        }))
      }
    });
  
    // Adds a marker at the center of the map.
    // addMarker(haightAshbury);
  }
  
  // Adds a marker to the map and push to the array.
  function addMarker(location) {
    var marker = new google.maps.Marker({
      position: location,
      map: map
    });
    marker=marker;
}
  
function showShows(){
    showScreen(`Выпуски`,`shows`,showShowLine,false,[{
        attr: `played`,
        name: `По прослушиваниям`
    }])
}

function showShow(id){
    // closeLeft();
    let c = preparePopupWeb(`shows_${id}`,false,false,true)
        c.append(ce(`p`,false,false,`${botLink}?start=shows_${id}`))
    load(`shows`,id).then(s=>{
        let details = ce(`div`,false,`details`)
            details.append(ce('span',false,`info`,`создано ${drawDate(s.createdAt._seconds*1000)}`))
            if(s.updatedAt) details.append(ce('span',false,`info`,`обновлено ${drawDate(s.updatedAt._seconds*1000)}`))
            details.append(ce('span',false,`info`,`прослушано ${s.played||0}`))
        c.append(details)
        
        c.append(ce(`h1`,false,`editable`,s.name,{
            onclick:function(){
                edit(`shows`,id,`name`,`text`,s.name,this)
            }
        }))

        c.append(ce(`p`,false,`editable`,s.description || `Добавьте описание`,{
            onclick:function(){
                edit(`shows`,id,`description`,`textarea`,s.description,this)
            }
        }))

        c.append(ce(`p`,false,`editable`,s.date || `Добавьте дату выпуска`,{
            onclick:function(){
                edit(`shows`,id,`date`,`date`,s.date,this)
            }
        }))

        c.append(ce(`p`,false,false,`ссылка на файл: ${decodeURIComponent(s.url) || `не задана`}`,{
            onclick:function(){
                edit(`shows`,id,`url`,`text`,s.url||null,this)
            }
        }))
    })
}

function showProgram(id){
    // closeLeft();
    let c = preparePopupWeb(`programs_${id}`,false,false,true)
        c.append(ce(`p`,false,false,`${botLink}?start=programs_${id}`))
        c.append(ce(`a`,false,false,`rss`,{
            href: `/rss/${id}`,
        }))
    load(`programs`,id).then(p=>{
        let details = ce(`div`,false,`details`)
            details.append(ce('span',false,`info`,`создано ${drawDate(p.createdAt._seconds*1000)}`))
            if(p.updatedAt) details.append(ce('span',false,`info`,`обновлено ${drawDate(p.updatedAt._seconds*1000)}`))
            details.append(ce('span',false,`info`,`выпусков ${p.shows||0}`))
        c.append(details)

        if(p.pic) c.append(ce(`img`,false,`cover`,false,{src:p.pic}))

        c.append(ce(`p`,false,`editable`,p.pic||`задать картинку`,{
            onclick:function(){
                edit(`programs`,id,`pic`,`text`,p.pic||null,this)
            }
        }))

        c.append(ce(`h1`,false,`editable`,p.name,{
            onclick:function(){
                edit(`programs`,id,`name`,`text`,p.name,this)
            }
        }))

        c.append(ce(`p`,false,`editable`,p.description || `Добавьте описание`,{
            onclick:function(){
                edit(`programs`,id,`description`,`textarea`,p.description,this)
            }
        }))

        let showsContainer = ce(`div`);
        
        c.append(showsContainer)

        load(`shows`,false,{program:id}).then(shows=>{
            shows.forEach(s=>{
                showsContainer.append(showShowLine(s))
            })
        })

        c.append(deleteButton(`programs`,id,!p.active))
    })

}



function showUser(id){
    let p = preparePopupWeb(`users_${id}`,false,false,true)
    load(`users`,id).then(u=>{
        p.append(ce('h1', false, false, `${uname(u,u.id)} (${u.language_code})`))
        
        p.append(line(
            ce('p', false, false, `регистрация: ${drawDate(u.createdAt._seconds*1000)}`),
            // ce('p', false, false, `последний раз в приложении: ${u.appLastOpened ? drawDate(u.appLastOpened._seconds*1000) : `нет данных`}`)
        ))
        
        p.append(line(
            ce('p', false, false, `${u.first_name || `Имя не указано`}`, {
                onclick: function () {
                    edit(`users`, u.id, `first_name`, `text`, u.first_name, this)
                }
            }),
            ce('p', false, false, `${u.last_name || `Фамилия не указана`}`, {
                onclick: function () {
                    edit(`users`, u.id, `last_name`, `text`, u.last_name, this)
                }
            })
        ))
        
        p.append(line(
            ce('p', false, false, `email: ${u.email || `не указан`}`, {
                onclick: function () {
                    edit(`users`, u.id, `email`, `text`, u.email, this)
                }
            }),
            ce('p', false, false, `about: ${u.about || `о себе не рассказывал`}`, {
                onclick: function () {
                    edit(`users`, u.id, `about`, `textarea`, u.about, this)
                }
            }),
            ce('p', false, false, `occupation: ${u.occupation || `о себе не рассказывал`}`)

        ))

        let adminLinks = [{
            attr: `admin`,
            name: `сделать админом`,
            disname: `снять админство`
        }, {
            attr: `insider`,
            name: `сделать сотрудником`,
            disname: `убрать из сотрудников`
        }, {
            attr: `blocked`,
            name: `заблокировать`,
            disname: `разблокировать`
        }]

        let ac = ce(`div`,false,`flex`)
        p.append(ac)

        adminLinks.forEach(type => {
            ac.append(ce('button', false, [`dateButton`,`dark`], u[type.attr] ? type.disname : type.name, {
                onclick: () => {
                    axios.put(`/admin/users/${u.id}`, {
                        attr: type.attr,
                        value: !u[type.attr]
                    }).then(handleSave)
                    .catch(handleError)
                }
            }))
        })

        // let line = ce(`div`,false,`flex`)

        p.append(line(
            toggleButton(`users`,u.id,`blocked`,u.blocked||false,`Разблокировать`,`Заблокировать`,[`dateButton`,`dark`]),
            // toggleButton(`users`,u.id,`randomCoffee`,u.randomCoffee||false,`Убрать из randomCoffee`,`Добавить в randomCoffee`,[`dateButton`,`dark`]),
            // toggleButton(`users`,u.id,`noSpam`,u.noSpam||false,`Выключить новости`,`Включить новости`,[`dateButton`,`dark`])
        ))


        let messenger = ce('div')
        p.append(messenger)

        messenger.append(ce(`button`,false,[`dark`,`dateButton`],`Открыть переписку`,{
            onclick:function(){
                this.remove()
                messenger.append(ce(`h2`,false,false,`Переписка:`))
                load(`messages`,false,{user:+u.id}).then(messages=>{
                    let mc = ce(`div`,false,`messenger`)
                    messenger.append(mc)
                    messages.forEach(m=>{
                        mc.prepend(messageLine(m))
                    })
                    let txt = ce('textarea',false,false,false,`вам слово`)
                    messenger.append(txt)
                    messenger.append(ce(`button`,false,[`dark`,`dateButton`],`Отправить`,{
                        onclick:()=>{
                            if(txt.value){
                                axios.post(`/admin/messages`,{
                                    text: txt.value,
                                    user: u.id
                                }).then(s=>{
                                    
                                    alert(`ушло!`)
                                    
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

function showLandmark(id){
    let p = preparePopupWeb(`landmarks_${id}`,false,false,true)
    load(`landmarks`,id).then(s=>{
        

        let details = ce(`div`,false,`details`)
            details.append(ce('span',false,`info`,`создано ${drawDate(s.createdAt._seconds*1000)}`))
            if(s.updatedAt) details.append(ce('span',false,`info`,`обновлено ${drawDate(s.updatedAt._seconds*1000)}`))
            details.append(ce('span',false,`info`,`посещений ${s.visited||0}`))
            
        p.append(details)

        p.append(logButton(`landmarks`,id))

        p.append(ce(`h1`,false,false,s.name,{
            onclick:function(){
                edit(`landmarks`,id,`name`,`text`,s.name,this)
            }
        }))

        p.append(ce(`p`,false,false,s.address || `Добавьте адрес`,{
            onclick:function(){
                edit(`landmarks`,id,`address`,`text`,s.address || null,this)
            }
        }))

        if(s.pic){
            p.append(ce(`img`,false,`cover`,false,{
                src: s.pic,
                onclick:()=>{
                    edit(`landmarks`,id,`pic`,`text`,s.pic||null,this)   
                }
            }))
        } else {
            p.append(ce(`p`,false,false,`Добавить фото`,{
                onclick:function(){
                    edit(`landmarks`,id,`pic`,`text`,s.pic||null,this)
                }
            }))
        }

        // p.append(ce(`p`,false,false,s.voice?`Голосовое`:`Добавить голосовое`,{
        //     onclick:function(){
        //         edit(`landmarks`,id,`voice`,`text`,s.voice||null,this)
        //     }
        // }))
        

        p.append(ce(`p`,false,false,s.description ? `Описание: ${s.description}` : `Добавить описание`,{
            onclick:function(){
                edit(`landmarks`,id,`description`,`textarea`,s.description,this)
            }
        }))

        p.append(ce(`p`,false,false,s.greetings ? `Приветствие: ${s.greetings}` : `Добавить приветствие`,{
            onclick:function(){
                edit(`landmarks`,id,`greetings`,`textarea`,s.greetings||null,this)
            }
        }))

        p.append(ce(`p`,false,false,s.goodbyes ? `Прощание: ${s.goodbyes}` : `Добавить прощание`,{
            onclick:function(){
                edit(`landmarks`,id,`goodbyes`,`textarea`,s.goodbyes||null,this)
            }
        }))

        p.append(ce(`p`,false,false,s.voice ? `Голосовая заметка: ${s.voice}` : `Добавить голосовую заметку`,{
            onclick:function(){
                edit(`landmarks`,id,`voice`,`text`,s.voice||null,this)
            }
        }))

        p.append(ce(`div`,`map`,false))

        initMap(false,+s.lat,+s.lng);

        let visits = ce(`div`)
        p.append(visits)
            visits.append(ce(`h3`,false,false,`История посещений`))
            visits.append(ce(`button`,false,false,`Открыть`,{
                onclick:function(){
                    this.remove();
                    load(`usersLandMarks`,false,{landmark:id})
                        .then(visitsLog=>{
                            visitsLog.forEach(v=>{
                                visits.append(visitLine(v))
                            })
                            
                        })
                }
            }))

        p.append(deleteButton(`landmarks`,id,!s.active))
    })
}

function showSection(id){
    let p = preparePopupWeb(`sections_${id}`,false,false,true)
    load(`sections`,id).then(s=>{
        p.append(ce(`h1`,false,false,s.name,{
            onclick:function(){
                edit(`sections`,id,`name`,`text`,s.name,this)
            }
        }))
        p.append(ce(`p`,false,false,s.description,{
            onclick:function(){
                edit(`sections`,id,`description`,`textarea`,s.description,this)
            }
        }))
        p.append(deleteButton(`sections`,id,!s.active))

        p.append(ce('textarea',false,false,false,{
            value: s.html
        }))

        tinymce.init({
            selector: 'textarea',
            plugins: 'anchor autolink charmap codesample emoticons image link lists media searchreplace table visualblocks wordcount checklist mediaembed casechange export formatpainter pageembed linkchecker a11ychecker tinymcespellchecker permanentpen powerpaste advtable advcode editimage advtemplate tableofcontents footnotes mergetags typography inlinecss',
            toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table mergetags | addcomment showcomments | spellcheckdialog a11ycheck typography | align lineheight | checklist numlist bullist indent outdent | emoticons charmap | removeformat',
            tinycomments_mode: 'embedded',
            tinycomments_author: 'Author name',
            mergetags_list: [
              { value: 'First.Name', title: 'First Name' },
              { value: 'Email', title: 'Email' },
            ],
            ai_request: (request, respondWith) => respondWith.string(() => Promise.reject("See docs to implement AI Assistant")),
          });

        p.append(ce(`button`,false,[`dark`,`dateButton`],`Сохранить правки в HTML`,{
            onclick:()=>{
                let html = tinymce.activeEditor.getContent("#html");
                axios.put(`/admin/sections/${s.id}`,{
                    attr: `html`,
                    value: html
                }).then(handleSave)
                .catch(handleError)
            }
        }))
    })
}


function showCity(id){
    
    let p = preparePopupWeb(`cities_${id}`,false,false,true)
    
    load(`cities`,id).then(s=>{
        
        p.append(ce(`h1`,false,false,s.name,{
            onclick:function(){
                edit(`cities`,id,`name`,`text`,s.name,this)
            }
        }))

        p.append(ce(`p`,false,false,s.description,{
            onclick:function(){
                edit(`cities`,id,`description`,`textarea`,s.description,this)
            }
        }))

        p.append(deleteButton(`cities`,id,!s.active))
    })
}



function showPage(id){
    let p = preparePopupWeb(`pages_${id}`,false,false,true)
    load(`pages`,id).then(s=>{
        p.append(ce(`h1`,false,false,s.name,{
            onclick:function(){
                edit(`pages`,id,`name`,`text`,s.name,this)
            }
        }))
        p.append(ce(`p`,false,false,s.description,{
            onclick:function(){
                edit(`pages`,id,`description`,`textarea`,s.description,this)
            }
        }))

        p.append(ce('textarea',false,false,false,{
            value: s.html
        }))

        tinymce.init({
            selector: 'textarea',
            plugins: 'anchor autolink charmap codesample emoticons image link lists media searchreplace table visualblocks wordcount checklist mediaembed casechange export formatpainter pageembed linkchecker a11ychecker tinymcespellchecker permanentpen powerpaste advtable advcode editimage advtemplate tableofcontents footnotes mergetags typography inlinecss',
            toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table mergetags | addcomment showcomments | spellcheckdialog a11ycheck typography | align lineheight | checklist numlist bullist indent outdent | emoticons charmap | removeformat',
            tinycomments_mode: 'embedded',
            tinycomments_author: 'Author name',
            mergetags_list: [
              { value: 'First.Name', title: 'First Name' },
              { value: 'Email', title: 'Email' },
            ],
            ai_request: (request, respondWith) => respondWith.string(() => Promise.reject("See docs to implement AI Assistant")),
          });

        p.append(ce(`button`,false,[`dark`,`dateButton`],`Сохранить правки в HTML`,{
            onclick:()=>{
                let html = tinymce.activeEditor.getContent("#html");
                axios.put(`/admin/pages/${s.id}`,{
                    attr: `html`,
                    value: html
                }).then(handleSave)
                .catch(handleError)
            }
        }))

        p.append(deleteButton(`pages`,id,!s.active))
    })
}

window.addEventListener('keydown', (e) => {
    if (e.key == 'Escape') {
        if(document.querySelector('.editWindow')){
            document.querySelector('.editWindow').remove()
        } else if(document.querySelector('#hover')){
            document.querySelector('#hover').remove()
        } else if (document.querySelector('.popupWeb')){
            document.querySelectorAll('.popupWeb')[document.querySelectorAll('.popupWeb').length-1].remove()
        }}
    }
)

function edit(entity, id, attr, type, value, container) {

    let attrTypes = {
        description: `описание`,
        name: `название`,
        authorId: `автор`,
        courseId: `курс`,
        descShort: `краткое описание`,
        descLong: `развернутое пописание`
    }

    let entities = {
        authors: `автора`,
        courses: `курса`,
        classes: `мероприятия`,
        banks: `рекивзитов`,
    }

    let helps={
        voice: `Чтобы получить код голосовой заметки, просто начитайте ее боту, в ответ вы получите необходимую строку.`
    }

    let edit = modal();

    edit.append(ce('h2', false, false, `Правим поле ${attrTypes[attr]||attr} для ${entities[entity]||entity}#${id}`))
    
    if(helps[attr]) edit.append(ce(`p`,false,`info`,helps[attr]))
    
    let f = ce('input');
    if (type == `date`) {
        f.type = `date`
        edit.append(f)
    } else if (type == `textarea`) {
        f = ce('textarea', false, false, false, {
            value: value,
            type: type,
            placeholder: `Новое значение`
        })
        edit.append(f)
    } else {
        f = ce('input', false, false, false, {
            value:          value,
            type:           type,
            placeholder:    `Новое значение`
        })
        edit.append(f)
    }

    f.focus()

    edit.append(ce('button', false, false, `Сохранить`, {
        onclick: function () {
            if (f.value) {
                axios.put(`/admin/${entity}/${id}`, {
                        attr: attr,
                        value: type == `date` ? new Date(f.value) : f.value
                    }).then((d)=>{
                        handleSave(d);
                        edit.remove()
                        if(container) container.innerHTML = f.value
                    })
                    .catch(handleError)
            }
        }
    }))

    edit.append(ce('button', false, false, `Удалить`, {
        onclick: function () {
            let sure = confirm(`вы уверены?..`)
            if (sure) {
                axios.put(`/admin/${entity}/${id}`, {
                        attr:   attr,
                        value:  null
                    }).then((d)=>{
                        handleSave(d);
                        if(container) container.innerHTML = f.value
                    })
                    .catch(handleError)
            }
        }
    }))
    document.body.append(edit)
}
