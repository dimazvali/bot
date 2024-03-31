let host = `dimazvali`
let downLoadedUsers = {};

function closeLeft() {
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p => p.remove())
}

function showLandmarks(){
    showScreen(`Достопримечательности`,`landmarks`,showLandMarkLine,addLandMark)
}

function showTags(){
    showScreen(`Теги`,`tags`,showTagLine,addTag)
}

function showPages(){
    showScreen(`Страницы`,`pages`,showPageLine,addPage)
}

function showSections(){
    showScreen(`Разделы`,`sections`,showSectionLine,addSection)
}

function showTours(){
    showScreen(`Экскурсии`,`tours`,showTourLine,addTour)
}

start = start.split('_')
switch(start[0]){
    case `landmarks`:{
        showLandmarks()
        break;
    }
}

function showLandMarkLine(l){
    let c = listContainer(l,true)
        c.append(ce(`h2`,false,false,l.name,{
            onclick: ()=>showLandmark(l.id)
        }))
        c.append(ce(`p`,false,false,l.description))
    return c
}

function showTourLine(t){
    let c = listContainer(t,true,{steps:`шагов`})
        c.append(ce(`h2`,false,false,t.name,{
            onclick: ()=>showTour(t.id)
        }))
        c.append(ce(`p`,false,false,t.description))
    return c
}

function showSectionLine(s){
    let c = listContainer(s,true)
        c.append(ce(`h2`,false,false,s.name,{
            onclick: ()=>showSection(s.id)
        }))
        c.append(ce(`p`,false,false,s.description))
    return c
}

function showTagLine(p){
    let c = listContainer(p,true)
        c.append(ce(`h2`,false,false,p.name,{
            onclick: ()=>showTag(p.id)
        }))
        c.append(ce(`p`,false,false,p.description))
    return c
}

function showPageLine(p){
    let c = listContainer(p,true)
        c.append(ce(`h2`,false,false,p.name,{
            onclick: ()=>showPage(p.id)
        }))
        c.append(ce(`p`,false,false,p.description))
    return c
}

function showStepLine(p){
    let c = listContainer(p,true)
        c.append(ce(`h2`,false,false,p.landmarkName,{
            onclick: ()=>showLandmark(p.landmark)
        }))
        c.append(ce(`p`,false,false,`Добавить фото`,{
            onclick:function(){
                edit(`toursSteps`,p.id,`description`,`textarea`,p.description||`Добавьте пару слов от себя`,this)
            }
        }))
        c.append(deleteButton(`toursSteps`,p.id))
    return c
}

function addTour(){
    addScreen(`tours`,`Новый Тур`,{
        name:       {placeholder:`Название`},
        description:{placeholder:`Описание`,type:`textarea`},
        pic:        {placeholder:`картинка`}
    })
}

function addSection(){
    addScreen(`sections`,`Новый раздел`,{
        name:       {placeholder:`Название`},
        slug:       {placeholder: `slug`},
        description:{placeholder:`Описание`,type:`textarea`},
        pic:        {placeholder:`картинка`}
    })
}

function addPage(){
    addScreen(`pages`,`Новая страница`,{
        name:       {placeholder:`Название`},
        slug:       {placeholder: `slug`},
        description:{placeholder:`Описание`,type:`textarea`},
        pic:        {placeholder:`картинка`}
    })
}

function addTag(){
    addScreen(`tags`,`Новый тег`,{
        name:       {placeholder:`Название`},
        slug:       {placeholder: `slug`},
        description:{placeholder:`Описание`,type:`textarea`},
        pic:        {placeholder:`картинка`}
    })
}

function addLandMark(){
    let p = addScreen(`landmarks`,`Новая точка`,{
        name:       {placeholder:`название`},
        description:{placeholder:`описание`,type:`textarea`},
        greetings:  {placeholder:`текст приветствия`},
        goodbyes:   {placeholder:`текст прощания`},
        pic:        {placeholder:`картинка`},
        voice:      {placeholder:`голосовое`},
        proximity:  {placeholder:`дистанция`}
    })

    p.append(ce(`div`,`map`))
    
    initMap(p.querySelector(`form`))
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
                axios.put(`/${host}/admin/tags/${s.id}`,{
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
  
function showTour(id){
    closeLeft();
    let p = preparePopupWeb(`tours_${id}`,false,false,true)
    load(`tours`,id).then(t=>{
        let details = ce(`div`,false,`details`)
            details.append(ce('span',false,`info`,`создано ${drawDate(t.createdAt._seconds*1000)}`))
            if(t.updatedAt) details.append(ce('span',false,`info`,`обновлено ${drawDate(t.updatedAt._seconds*1000)}`))
            details.append(ce('span',false,`info`,`запусков ${t.started||0}`))
        p.append(details)

        p.append(logButton(`tours`,id))

        p.append(ce(`h1`,false,false,t.name,{
            onclick:function(){
                edit(`tours`,id,`name`,`text`,t.name,this)
            }
        }))

        if(t.pic){
            p.append(ce(`img`,false,`cover`,false,{
                src: t.pic,
                onclick:()=>{
                    edit(`tours`,id,`pic`,`text`,t.pic||null,this)   
                }
            }))
        } else {
            p.append(ce(`p`,false,false,`Добавить фото`,{
                onclick:function(){
                    edit(`tours`,id,`pic`,`text`,t.pic||null,this)
                }
            }))
        }

        p.append(ce(`p`,false,false,t.description ? `Описание: ${t.description}` : `Добавить описание`,{
            onclick:function(){
                edit(`tours`,id,`description`,`textarea`,t.description,this)
            }
        }))

        p.append(ce(`p`,false,false,t.voice ? `Голосовое: ${t.voice}` : `Добавить Голосовое`,{
            onclick:function(){
                edit(`tours`,id,`voice`,`text`,t.voice,this)
            }
        }))

        let steps = ce(`div`)
        
        p.append(steps)
        
        steps.append(ce(`h2`,false,false,`Точки`))

        let stepsListing = ce(`div`)
        steps.append(stepsListing)


        load(`toursSteps`,false,{tour:id}).then(steps=>{
            steps
                .filter(s=>s.tour == id)
                .sort((a,b)=>b.index-a.index)
                .forEach(step=>{
                    stepsListing.append(showStepLine(step))
                })

        })
        steps.append(ce(`button`,false,false,`Добавить`,{
            onclick:()=>{
                let c = modal()
                c.append(ce(`h3`,false,false,`Добавляем шаг`))
                let points = selector(`landmarks`,`Выберите точку`)
                c.append(points)
                c.append(ce(`button`,false,false,`Добавить`,{
                    onclick:()=>{
                        if(points.value) axios.post(`/${host}/admin/toursSteps`,{
                            tour:   id,
                            landmark: points.value
                        }).then(s=>{
                            handleSave(s)
                            showTour(id)
                        }).catch(handleError)
                    }
                }))
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
                axios.put(`/${host}/admin/sections/${s.id}`,{
                    attr: `html`,
                    value: html
                }).then(handleSave)
                .catch(handleError)
            }
        }))
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
                axios.put(`/${host}/admin/pages/${s.id}`,{
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
        f.type = `datetime-local`
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
                axios.put(`/${host}/admin/${entity}/${id}`, {
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
                axios.put(`/${host}/admin/${entity}/${id}`, {
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
