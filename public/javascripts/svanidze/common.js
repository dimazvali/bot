function checkMissing(type,data){
    let alerts = [];
    switch(type){
        case `books`:{
            if(!data.isbn) alerts.push(`Нет ISBN`)
            if(!data.author) alerts.push(`Нет автора`)
            if(!data.description) alerts.push(`Нет описания`)
        }
        default:{
            if(!data.name) alerts.push(`Нет названия!`)
        }
    }
    
    return alerts
}


if(userData){
    if(userData.address) localStorage.address = userData.address;
    if(userData.city) localStorage.city = userData.city;
} 

function showBooks(){
    showScreen(`Каталог`,`books`,showBookLine,addBook,[{
        attr: `year`,
        name: `По году выпуска`
    }],true)
}


window.addEventListener('keydown', (e) => {
    if (e.key == 'Escape') {
        if (document.querySelector('.editWindow')) {
            document.querySelector('.editWindow').remove()
        } else if (document.querySelectorAll(`.popupWeb`).length) {
            document.querySelectorAll(`.popupWeb`)[document.querySelectorAll(`.popupWeb`).length - 1].remove()
        } else if (document.querySelector('#hover')) {
            document.querySelector('#hover').remove()
        }
    }
})



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

function edit(entity, id, attr, type, value, container) {

    let attrTypes = {
        description:`описание`,
        name:       `название`,
        authorId:   `автор`,
        courseId:   `курс`,
        descShort:  `краткое описание`,
        descLong:   `развернутое пописание`
    }

    let entities = {
        authors:    `автора`,
        courses:    `курса`,
        classes:    `мероприятия`,
        banks:      `рекивзитов`,
    }

    let helps = {
        voice: `Чтобы получить код голосовой заметки, просто начитайте ее боту, в ответ вы получите необходимую строку.`
    }

    let edit = modal();

    edit.append(ce('h2', false, false, `Правим поле ${attrTypes[attr]||attr} для ${entities[entity]||entity}#${id}`))
    
    if(helps[attr]) edit.append(ce(`p`,false,`info`,helps[attr]))
    
    let f = ce('input');

    if (type == `city`){
        load(`cities`).then(authors => {
            f = ce('select')
            f.append(ce('option', false, false, `Выберите город`, {
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
    } else if (type == `date`) {
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
                axios.put(`/${host}/${subHost}/${entity}/${id}`, {
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
                axios.put(`/${subHost}/${entity}/${id}`, {
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


function picUpload(collection,id,label,callback){
    let f = ce(`form`,false,false,false,{
        method: `POST`,
        enctype: `multipart/form-data`,
        action: `/${host}/upload?collection=${collection}&id=${id}`,
        required: true,
    })
    f.append(ce(`input`,false,false,false,{
        type: `file`,
        name: `file`
    }))
    f.append(ce(`button`,false,false,label||`Загрузить`,{
        type: `submit`
    }))
    // f.onsubmit=(e)=>{
    //     // if(callback) {
    //     //     e.preventDefault()
    //     //     callback()
    //     // }
    // }
    return f;
}

function showBook(id){
    let p = preparePopupWeb(`book_${id}`,false,false,true)
        load(`books`,id).then(book=>{

            p.append(detailsContainer(book))

            if(book.pic) p.append(ce('img',false,`cover`,false,{
                src: book.pic
            }))

            p.append(picUpload(`books`,id,book.pic?`Заменить обложку`:`Загрузить обложку`,()=>showBook(id)))

            p.append(ce(`h1`,false,false,book.name,{
                onclick:function(){
                    edit(`books`,id,`name`,`text`,book.name,this)
                }
            }))



            p.append(ce(`p`,false,false,book.description||'добавьте описание',{
                onclick:function(){
                    edit(`books`,id,`description`,`textarea`,book.description||`добавьте описание`,this)
                }
            }))

            p.append(ce(`p`,false,false,book.author||'добавьте автора',{
                onclick:function(){
                    edit(`books`,id,`author`,`text`,book.author,this)
                }
            }))

            // p.append(ce(`p`,false,false,`${book.price ? cur(book.price) : `бесплатно?..` }`,{
            //     onclick:function(){
            //         edit(`books`,id,`author`,`number`,book.price,this)
            //     }
            // }))

            p.append(toggleButton(`books`,id,`kids`,book.kids,`Для детей`,`Для взрослых`))

            let offers = ce(`div`)
                offers.append(ce(`h3`,false,false,`Предложения:`))
                load(`offers`,false,{book:id}).then(offersData=>{
                    offersData.length ?  offersData.forEach(o=>{
                        offers.append(showOfferLine(o))
                    }) : offers.append(ce(`p`,false,false,`пока нет`)) 
                    offers.append(ce(`button`,false,false,`Добавить`,{
                        onclick:()=>addOffer({book:id})
                    }))
                })
            p.append(offers)
            
            if(adminAccess) p.append(deleteButton(`books`,id,!book.active,`active`,showBooks))
        })
}

function showCityLine(b){
    // if(!b.pic) b.pic = `/images/books/blank.png`
    let c = listContainer(b,true)
        c.onclick = () => showCity(b.id)
        c.append(ce(`h3`,false,false,b.name))
        c.append(ce(`p`,false,false,b.description? cutMe(b.description.toString(),100) : `без описания`))
        return c;
}

function showBookLine(b){
    if(!b.pic) b.pic = `/images/books/blank.png`
    let c = listContainer(b,true,{isbn:`ISBN`,pubDate:`год`},false,checkMissing(`books`,b))
        c.onclick = () => showBook(b.id)
        c.append(ce(`h3`,false,false,b.name))
        c.append(ce(`p`,false,false,b.description ? cutMe(b.description.toString(),100) : `без описания`))
        return c;
}

function showOfferLine(b){
    if(!b.pic) b.pic = b.bookPic || `/images/books/blank.png`
    let c = listContainer(b,true,{price:b.price},false,checkMissing(`offer`,b))
        c.onclick = () => showOffer(b.id)
        c.append(ce(`h3`,false,false,b.bookName))
        c.append(ce(`p`,false,false,b.description? cutMe(b.description.toString(),100) : `без описания`))
        return c;
}

function showDealLine(d){
    let c = listContainer(d,true,{price:d.price},false,checkMissing(`deal`,d))
        c.onclick = () => showDeal(d.id)
        c.append(ce(`h3`,false,false,d.bookName))
        c.append(ce(`p`,false,false,d.type))
    return c;
}


function closeLeft() {
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p => p.remove())
}

function addOffer(o){

    if(!o) o = {}

    addScreen(`offers`,`Новое предложение`,{
        book:           {selector:`books`, placeholder:`Название`,id:o.book},
        help:           {line:true,tag: `p`, class: `info`, text: `Не нашли нужную? Нажмите на кнопку ниже, чтобы добавить книгу.`},
        addBook:        {line:true,tag: `button`,text: `Добавить книгу`,callback:(e)=>{
            e.preventDefault();
            addBook();
        }},
        description:    {placeholder: `Описание`,tag:`textarea`},
        cover:          {placeholder:   `Обложка`, type: `file`},
        status:         {placeholder:   `Состояние`,selector: `bookState`},
        price:          {placeholder: `Стоимость`, type: `number`},
        rent:           {placeholder: `Можно взять почитать`, bool: true},
        address:        {placeholder: `Адрес`,value: localStorage.address || null},
        city:           {selector:`cities`, placeholder:`Город`,id:localStorage.city}
    })
}


function showOffer(id){
    let p = preparePopupWeb(`offers_${id}`,false,false,true)
    load(`offers`,id).then(o=>{
        p.append(ce(`h1`,false,false,o.bookName))
        p.append(detailsContainer(o))
        
        let addressDetails = ce(`div`);
            addressDetails.append(ce(`p`,false,false,o.city ? `город ${cities[o.city].name}` : `без города`,{
                onclick:function(){
                    edit(`offers`,id,`city`,`city`,this.city,this)
                }
            }))
            addressDetails.append(ce(`p`,false,false,o.address ? `адрес ${o.address}` : `без адреса`,{
                onclick:function(){
                    edit(`offers`,id,`address`,`text`,o.address||null,this)
                }
            }))

        p.append(addressDetails)

        let historyContainer = ce(`div`);
            historyContainer.append(ce(`h3`,false,false,`История`))
        p.append(historyContainer)

        load(`deals`,false,{offer:id}).then(deals=>{
            if(!deals.length) historyContainer.append(ce(`p`,false,`info`,`Никто еще не брал.`));
        })

        p.append(deleteButton(`offers`,id,!o.active))
    })
}

function addOfferCustomer(o){
    
    if(!o) o = {}

    addScreen(`offers`,`Новое предложение`,{
        book:           {datalist:`books`, placeholder:`Название`,id:o.book},
        description:    {placeholder: `Описание`,tag:`textarea`},
        // pic:            {placeholder: `Обложка`},
        cover:          {placeholder:   `Обложка`, type: `file`},
        new:            {placeholder: `Состояние`,selector: `bookState`},
        price:          {placeholder: `Стоимость`, type: `number`},
        rent:           {placeholder: `Можно взять почитать`, bool: true},
        address:        {placeholder: `Адрес`},
        city:           {selector:`cities`, placeholder:`Город`,id:localStorage.city}
    })
}

function addBook(){
    let screen = addScreen(`books`,`Новая книга`,{
        isbn:           {placeholder:   `ISBN`},
        name:           {placeholder:   `Название`, required: true},
        description:    {placeholder:   `Описание`,tag:`textarea`, required: true},
        lang:           {placeholder:   `Выберите язык`, selector:`langs`},
        author:         {placeholder:   `Автор`, required: true},
        cover:          {placeholder:   `Обложка`, type: `file`},
        publisher:      {placeholder:   `Издательство`, required: true},
        year:           {placeholder:   `Год издания`, type: `number`, required: true},
        // new:            {placeholder:   `Состояние`,selector: `bookState`},
        // price:          {placeholder:   `Стоимость`, type: `number`},
    })

    let searchButton = ce(`button`,false,false,`Заполнить по ISBN`,{
        onclick: function(click){
            click.preventDefault();
            
            let isbn = screen.querySelector(`[name="isbn"]`).value.replace(/-/g,'');
            
            console.log(`ISBN is ${isbn}`)
            
            if(isbn.length != 13 && isbn.length != 10) return toast(`Извините, это не похоже на ISBN`)
            
            if(!isbn) return alert(`ISBN не указан`)

            axios.get(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`).then(books=>{
                if(books.data && books.data.totalItems){
                    let b = books.data.items[0].volumeInfo
                    screen.querySelector(`[name="name"]`).value = b.title;
                    screen.querySelector(`[name="description"]`).value = b.description;
                    screen.querySelector(`[name="lang"]`).value = b.language;
                    screen.querySelector(`[name="author"]`).value = b.authors.join(', ');
                    
                    // screen.querySelector(`[name="pic"]`).value = b.imageLinks ? b.imageLinks.thumbnail : null;
                    
                    screen.querySelector(`[name="publisher"]`).value = b.publisher || null;
                    screen.querySelector(`[name="year"]`).value = b.publishedDate  || null;
                } else {
                    toast(`Простите, даже google не знает эту книгу. Придется заполнить вручную.`)
                }
            })

        }
    })
    
    screen.querySelector(`form`).insertBefore(searchButton, screen.querySelectorAll(`input`)[1])
}

function showOffers(){
    showScreen(`В продаже`,`offers`,showOfferLine,addOffer,[{
        attr: `price`,
        name: `По стоимости`
    }],true)
}

function showUserOffers(){
    showScreen(`Ваша полка`,`offersByUser`,showOfferLine,addOffer,[{
        attr: `price`,
        name: `По стоимости`
    }],true)
}

function uploadFile(file){
    axios.post(`/${host}/upload`,file)
}

function showUserDeals(){
    showScreen(`Сделки`, `dealsByUser`,showDealLine,false,false,true)
}