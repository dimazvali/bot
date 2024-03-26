let host = `dimazvali`

function closeLeft() {
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p => p.remove())
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

    let edit = ce('div', false, `editWindow`)
    edit.append(ce('h2', false, false, `Правим поле ${attrTypes[attr]||attr} для ${entities[entity]||entity}#${id}`))
    let f = ce('input');
    if (type == `date`) {
        f.type = `datetime-local`
        edit.append(f)
    } else if (type == `bankId`) {
        load(`banks`).then(authors => {
            f = ce('select')
            f.append(ce('option', false, false, `Выберите реквизиты`, {
                value: ''
            }))
            authors
                .filter(a => a.active)
                .sort((a, b) => a.name < b.name ? -1 : 1)
                .forEach(a => f.append(ce('option', false, false, a.name, {
                    value: a.id
                })))
            edit.append(f)
        })
    } else if (type == `task`) {
        load(`tasks`).then(tasks => {
            f = ce('select')
            f.append(ce('option', false, false, `Выберите задание`, {
                value: ''
            }))
            tasks
                .filter(a => a.active)
                .sort((a, b) => a.name < b.name ? -1 : 1)
                .forEach(a => f.append(ce('option', false, false, a.name, {
                    value: a.id
                })))
            edit.append(f)
        })
    } else if (type == `authorId`) {
        load(`authors`).then(authors => {
            f = ce('select')
            f.append(ce('option', false, false, `Выберите автора`, {
                value: ''
            }))
            authors
                .filter(a => a.active)
                .sort((a, b) => a.name < b.name ? -1 : 1)
                .forEach(a => f.append(ce('option', false, false, a.name, {
                    value: a.id
                })))
            edit.append(f)
        })
    } else if (type == `courseId`) {
        load(`courses`).then(authors => {
            f = ce('select')
            f.append(ce('option', false, false, `Выберите курс`, {
                value: ''
            }))
            authors
                .filter(a => a.active)
                .sort((a, b) => a.name < b.name ? -1 : 1)
                .forEach(a => f.append(ce('option', false, false, a.name, {
                    value: a.id
                })))
            edit.append(f)
        })
    } else if (type == `textarea`) {
        f = ce('textarea', false, false, false, {
            value: value,
            type: type,
            placeholder: `Новое значение`
        })
        edit.append(f)
    } else {
        f = ce('input', false, false, false, {
            value: value,
            type: type,
            placeholder: `Новое значение`
        })
        edit.append(f)
    }

    edit.append(ce('button', false, false, `Сохранить`, {
        onclick: function () {
            if (f.value) {
                axios.put(`/${host}/admin/${entity}/${id}`, {
                        attr: attr,
                        value: type == `date` ? new Date(f.value) : f.value
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
