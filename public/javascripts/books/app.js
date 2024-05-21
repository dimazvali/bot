
let tg = window.Telegram.WebApp;
const host = `books`
const adminka = `https://dimazvali-a43369e5165f.herokuapp.com/books`;
let mcb, mbbc, curLecture, curTicket = null;

const dummyBook = `/images/${host}/blank.png`

function shimmer(light){
    if(light) return tg.HapticFeedback.impactOccurred('light')
    tg.HapticFeedback.notificationOccurred('success')
}

let confirmed = false;

// if(authNeeded){
    console.log(`Нужна авторизация`)
    confirmed = axios.post(`/${host}/authWebApp?token=userToken`,tg.initData)
        .then(s=>{
            // confirmed = 
            console.log(`получили данные админа ${s.data}`)
            return s.data.admin;
        })
// }

function userLoad(collection, id, extra) {
    return axios.get(`/${host}/api/${collection}${id?`/${id}`:''}${extra?`?${Object.keys(extra).map(k=>`${k}=${extra[k]}`).join(`&`)}`:''}`).then(data => {
        return data.data
    })
}

function listOfferBox(o){
    let book = ce(`div`,`offer_${o.id}`,[`listBox`,`flex`],false,{
        dataset:{
            offer: o.id,
            active: o.active ? (o.blocked ? false : true) : false
        },
        onclick:()=>showOffer(o.id)
    })

    book.append(ce(`img`,false,`bookCover`, false,{src: o.pic || o.bookPic || dummyBook}))
    let details = ce(`div`)
    book.append(details)
    details.append(ce(`p`,false,`mtopless`, o.bookName))
    details.append(ce(`p`,false,`info`, o.description ? cutMe(o.description,100) : (cutMe(o.bookDescription,100) || `без описания`)))

    return book
}

function offerBox(o,options){
    
    if(!options) options = {};

    let book = ce(`div`,`offer_${o.id}`,`box`,false,{
        dataset:{
            offer: o.id,
            active: o.active ? (o.blocked ? false : true) : false
        },
        onclick:()=>{

            if(!options.foreign){
                let buttons = []

                if(o.active) {
                    buttons.push({
                        text:   `Снять`,
                        type:   `destructive`,
                        id:     `delete`
                    })
                } else {
                    buttons.push({
                        text:   `Вернуть`,
                        type:   `default`,
                        id:     `set`
                    })
                }

                buttons.push({
                    text:   `Отредактировать`,
                    id:     `edit`
                })


                tg.showPopup({
                    title:      `Присмотримся`,
                    message:    `Здесь вы можете снять книгку с полки (сделать невидимой для других пользователей) — или отредактировать ее`,
                    buttons:    buttons
                },(e)=>{
                    if(e == `delete`){
                        axios.delete(`/${host}/api/offers/${o.id}`)
                            .then(handleSave,book.remove())
                            .catch(handleError)
                    } else if(e == `edit`){
                        tg.openLink(`${adminka}/web?page=offers_${o.id}`)
                    } else if(e == `set`){
                        axios.put(`/${host}/api/offers/${o.id}`,{attr: `active`,value: true})
                            .then(handleSave,book.dataset.active = true)
                            .catch(handleError)
                    }
                })
            } else {
                showOffer(o.id)
            }
            
        }
    })

    if(options.date) book.append(ce(`span`,false,[`info`,`mb`],drawDate(o.createdAt._seconds*1000),{dataset:{margin:`10px`}}))
    if(!options.butPicure) book.append(ce(`img`,false,`bookCover`, false,{src: o.pic || o.bookPic || dummyBook}))
    if(!options.address) {
        book.append(ce(`p`,false,false, o.bookName))
    } else {
        book.append(ce(`p`,false,false, `${cities[o.city].name}, ${o.address}.`))
    }

    return book
}


function showLoad(){
    tg.MainButton.setParams({
        text:`загружаем`,
        is_visible: true
    })
    tg.MainButton.showProgress()
}


function book(){

    showLoad();

    axios.post(`/${host}/api/deals`,{
        offer: curOffer
    }).then((s)=>{
        handleSave(s)
        tg.MainButton.offClick(book);
        // curTicket = s.data.id
    })
    .catch(err=>{
        handleError(err)
        tg.MainButton.offClick(book)
    })
}

function showOffer(id){
    
    let p = preparePopup(`offer_${id}`)

    curOffer = id;



    userLoad(`offers`,id).then(offer=>{
        if(offer.pic || offer.bookPic) p.append(ce(`img`,false,`coverS`,false,{
            src: offer.pic || offer.bookPic,
            dataset:{
                views: offer.views
            },
            alt: `обложка ${offer.bookName}`
        })) 

        

        tg.MainButton.setText(`Взять почитать`)
        tg.MainButton.show()
        tg.MainButton.onClick(book)
        
        mbbc = book

        let slidingContainer = ce(`div`,false,`bgc`)
        
        p.append(slidingContainer)

        slidingContainer.append(line(
            ce(`span`,false,`info`,offer.views||`вы первый`,{
                dataset:{type:`views`}
            }),
            ce(`span`,false,`info`,offer.turns||`вы первый`,{
                dataset:{type:`turns`}
            }),
        ))

        slidingContainer.append(ce(`h1`,false,false,`<span class="info">книга:</span> ${offer.bookName}`))
        
        slidingContainer.append(ce(`h2`,false,false,`<span class="info">автор:</span> ${offer.author || `автор не указан`}`))

        slidingContainer.append(ce(`h3`,false,false,`<span class="info">адрес:</span> ${cities[offer.city].name}, ${offer.address}.`))
        
        if(offer.description) slidingContainer.append(ce(`p`,false,`info`,offer.description))

        if(offer.bookDescription) {
            let bc = ce(`p`,false,[`info`,`hidden`],offer.bookDescription)
            slidingContainer.append(ce(`button`,false,`thin`,`подробнее о книге`,{
                onclick:function(){
                    this.remove();
                    bc.classList.toggle(`hidden`)
                }
            }))
            slidingContainer.append(bc)
        }

        slidingContainer.append(ce(`button`,false,`thin`,`Добавить свою копию`,{
            onclick:()=>addOffer(offer.book)
        }))

        userLoad(`offers`,false,{book:offer.book}).then(options=>{
            options = options.filter(o=>o.id !== id)

            if(options.length){
                slidingContainer.append(ce(`h3`,false,false,`Другие предложения:`))
                options.forEach(o=>{
                    slidingContainer.append(offerBox(o,{
                        foreign: true,
                        address: true
                    }))
                })
            }
            
        })


    })
}

function updateFresh(){
    c = document.querySelector(`#fresh`);
    c.innerHTML = null;
    c.append(ce(`h2`,false,false,`Свежие поступления`))
    c.append(ce(`p`,false,`info`,`Это новые книги, доступные в вашем городе.`))
    userLoad(`offers`)
        .then(offers=>{

            let nearest = ce(`div`,false,`h40`)
                c.append(nearest)
            let scrollable = ce(`div`,false,`scrollable`)
                nearest.append(scrollable)

            offers.forEach(o=>{
                scrollable.append(offerBox(o,{
                    date:       true,
                    foreign:    true
                }))
            })

            c.append(ce(`button`,false,false,`Открыть каталог`,{
                onclick:function(){
                    // this.classList.add(`pushed`)
                    showCatalogue()
                }
            }))
        })
}

function refreshCatalogue(booksContainer, options){
    if(!options) options = {};
    booksContainer.innerHTML = null;

    console.log(options);
    
    userLoad(`offers`,false,{
        // limit:  limit,
        // offset: offset,
        // sort:   false,
        city:   options.city || localStorage.city
    }).then(books=>{
        
        console.log(options.onlyAvailable);

        if(options.onlyAvailable) books = books.filter(o=>!o.blocked)
        
        books.forEach(o=>{
            booksContainer.append(listOfferBox(o))
        })
    })
}

function addOffer(bookId){
    let p = preparePopup(`newOffer`);
        userLoad(`books`,bookId).then(b=>{
            p.append(ce(`h1`,false,false,`Ваш экземпляр книги ${b.name}`))
            let f = ce(`form`,false,false,false,{
                enctype:`multipart/form-data`,
                action: `/${host}/api/offers`,
                method: `POST`,
                // onsubmit:(e)=>e.preventDefault()
            })

            let description = ce(`textarea`,false,false,false,{
                placeholder:    `Добавьте пару слов от себя.`,
                name:           `description`
            })

            f.append(description)


            f.append(ce(`input`,false,false,false,{
                type: `hidden`,
                name: `book`,
                value: bookId
            }))

            f.append(ce(`input`,false,false,false,{
                placeholder:    `Место проживания книги.`,
                name:           `address`,
                value:          localStorage.address
            }))

            f.append(ce(`input`,false,false,false,{
                type: `file`,
                name: `cover`
            }))

            f.append(toggleCheckBox(false,false,`rent`,true,`Можно взять почитать`,true))

            f.append(ce(`input`,false,false,false,{
                type: `number`,
                name: `price`,
                placeholder: `Стоимость`
            }))

            f.append(ce(`button`,false,false,`Сохранить`,{
                type: `submit`
            }))

            p.append(f)
        })
}

function addBook(){
    let p = preparePopup(`newBook`)
        p.append(ce(`h1`,false,false,`Добавляем книгу`))
        p.append(ce(`p`,false,`info`,`Человеческое вам спасибо.`))
        p.append(ce(`p`,false,`info`,`Для начала попробуем найти данные по ISBN — так будет быстрее.`))

    let isbn = ce(`input`,false,false,false,{
        placeholder: `ISBN`
    })

    p.append(isbn)

    
    p.append(ce(`button`,false,false,`Проверить`,{
        onclick:function(){
            
            if(!isbn.value) {
                setWarning(isbn)
                return tg.showAlert(`Укажите ISBN`)
            }

            isbnData = isbn.value.replace(/-/g,'')

            if(isbnData.length != 13 && isbnData.length != 10) {
                setWarning(isbn)
                return tg.showAlert(`Извините, это не похоже на ISBN`)
            }

            this.remove();
            
            userLoad(`isbn`,isbn.value)
                .then(data=>{

                    if(data.id){
                        tg.showAlert(`Отлично, такая книга уже есть в каталоге.\nПродолжим...`)
                    } else {
                        let name = ce(`input`,false,false,false,{
                            placeholder: `Название книги`,
                            type: `text`,
                            value: data.name || null
                        })
                        
                        let description = ce(`textarea`,false,false,false,{
                            placeholder: `Описание`,
                            value: data.description || null
                        })
                        
                        let lang = selector(`languages`,`язык`,data.lang,true)

                        lang.placeholder = `язык`

                        let publisher = ce(`input`,false,false,false,{
                            placeholder: `Издательство`,
                            type: `text`,
                            value: data.publisher || null
                        })
    
                        let year = ce(`input`,false,false,false,{
                            placeholder:    `Год издания`,
                            type:           `number`,
                            min:            0,
                            value: data.year || null
                        })
                        
                        let inputs = [name,description,lang,publisher,year]
                        
                        inputs.forEach(i=>p.append(i));

                        p.append(ce(`button`,false,false,`Добавиь книгу`,{
                            onclick:()=>{
                                let passed = true;
                                let missed = []
                                inputs.forEach(i=>{
                                    if(!i.value) {
                                        passed = false;
                                        setWarning(i)
                                        missed.push(i.placeholder)
                                    }
                                })
                                if(!passed) return tg.showAlert(`Вы пропустили поля: ${missed.join(', ')}.`)
                                
                                axios.post(`/${host}/api/books`,{
                                    isbn:           isbnData,
                                    name:           name.value,
                                    description:    description.value,
                                    lang:           lang.value,
                                    publisher:      publisher.value,
                                    year:           year.value
                                }).then(s=>{
                                    p.remove();
                                    addOffer(s.data.id)
                                }).catch(handleError)
                            }    
                        }))
                    }
                    

                }).catch(handleError)
        }
    }))

}

function setWarning(inp){
    inp.classList.add('warning')
    setTimeout(()=>{
        inp.classList.remove(`warning`)  
    },1500)
}

function showCatalogue(){
    
    let city = localStorage.city;

    let p = preparePopup(`catalogue`)
        p.append(ce(`h1`,false,false,`Каталог`))
        
        let filters = ce(`div`)
        let booksContainer = ce(`div`);
        let onlyNew = toggleCheckBox(false,false,`onlyNew`,false,`только свободные`,true)
        
        onlyNew.querySelector(`input`).onchange = ()=>{
            refreshCatalogue(booksContainer,{
                city:           cityC.value,
                onlyAvailable:  onlyNew.querySelector(`input`).checked ? true : false
            })
        }

        let cityC = selector(`cities`,`город`,city, true);
            filters.append(cityC)
            cityC.onchange = () => {
                refreshCatalogue(booksContainer,{
                    city: cityC.value,
                    onlyAvailable: onlyNew.querySelector(`input`).checked ? true : false
                })
            }
        
        filters.append(onlyNew)
        p.append(filters);
        
        let limit = 100;
        let offset = 0;
        

        

        p.append(booksContainer);

        refreshCatalogue(booksContainer)

        
}

Promise
    .resolve(confirmed)
    .then(admin=>{

        console.log(`погнали`)

        document.body.innerHTML = null;

        // document.body.append(ce(`img`,`logo`,tg.colorScheme == `light` ? false : `bright`,false,{
        //     src: `/images/books/logo.png`
        // }))

        let c = ce(`div`,false,`mobile`)
        document.body.append(c);

        let profile = ce(`div`,`profile`,[`container`])

        c.append(profile)

        userLoad(`profile`).then(data=>{

            localStorage.city = data.user.city || null;
            localStorage.address = data.user.address || null;

            let uname = `${data.user.first_name||''} ${data.user.last_name||''}`.trim();
            if(!uname) uname = data.user.username ? `@${data.user.username}` : data.user.id

            profile.append(ce(`h3`,false,false,uname));

            profile.append(ce(`p`,false,`info`,`Место отображения статуса и регалий.`))
            
            let tagsContainer = ce(`div`)
            
            profile.append(tagsContainer)
            
            profile.append(ce(`div`,false,`upRight`,`⚙️`,{
                onclick:()=>showSettings(data.user)
            }))

            let fresh = ce(`div`,`fresh`,`container`,[`container`,`left`])
            c.append(fresh)
            // fresh.append(ce(`h2`,false,false,`Новые поступления`))

            updateFresh()


            let offers = ce(`div`,`offers`,[`container`,`left`])

                offers.append(ce(`h2`,false,false,`Ваша полка:`))

                offers.append(ce(`p`,false,`info`,`Это книги, которые вы предлагаете купить или взять почитать.`))

                setTimeout(()=>offers.classList.remove(`left`),300)
                
                c.append(offers);

                let nearest = ce(`div`,false,`h40`)
                    offers.append(nearest)
                let scrollable = ce(`div`,false,`scrollable`)
                    nearest.append(scrollable)

                let visible = data.offers.filter(o=>o.active);
                let invisible = data.offers.filter(o=>!o.active)

                visible.forEach(o=>{
                    scrollable.append(offerBox(o))
                })

                if(invisible.length){
                    scrollable.append(ce(`div`,false,`box`,`Показать скрытые`,{
                        onclick:function(){
                            this.remove()
                            invisible.forEach(o=>{
                                scrollable.append(offerBox(o))
                            })
                        }
                    }))
                }
            
                offers.append(ce(`button`,false,false,`Добавить книгу`,{
                    // onclick:()=>tg.openLink(`${adminka}/web`)
                    onclick:()=>addBook()
                }))
                
                let inRent = data.deals.filter(d=>d.buyer == +data.user.id && d.type == `rent`);
                let rented = data.deals.filter(d=>d.seller == +data.user.id && d.type == `rent`);
                
                if(rented.length) {
                    let container = ce(`div`,false,`container`)
                        container.append(ce(`h3`,false,false,`У вас взяли почитать`))
                    
                    let nearest = ce(`div`,false,`h40`)
                        container.append(nearest)
                    let scrollable = ce(`div`,false,`scrollable`)
                        nearest.append(scrollable)
                    rented.forEach(o=>{
                        let book = ce(`div`,false,`box`,false,{
                            onclick:()=>{
                                tg.showPopup({
                                    title: `Хотите вернуть?`,
                                    message: `Свяжитесь с другой стороной, чтобы вернуть ее или попросить еще немного времени. Ему/ей надо будет подтвердить передачу.`,
                                    buttons: [{
                                        text: `Связаться`,
                                        id: o.id
                                    },]
                                },(e)=>{
                                    if(e) axios.get(`/${host}/api/requestBuyer/${e}`).then(handleSave).catch(handleError);
                                })
                            }
                        })
                            scrollable.append(book)

                        book.append(ce(`span`,false,`info`,drawDate(o.buyerConfirmed._seconds*1000)))
                        book.append(ce(`p`,false,false, o.bookName))
                    })
                    c.append(container)
                } 
                if(inRent.length) {
                    let container = ce(`div`,false,`container`)
                    container.append(ce(`h3`,false,false,`Вы взяли почитать::`))
                    
                    let nearest = ce(`div`,false,`h40`)
                        container.append(nearest)
                    let scrollable = ce(`div`,false,`scrollable`)
                        nearest.append(scrollable)
                    inRent.forEach(o=>{
                        let book = ce(`div`,false,`box`,false,{
                            onclick:()=>{
                                tg.showPopup({
                                    title: `Хотите вернуть?`,
                                    message: `Свяжитесь с другой стороной, чтобы вернуть ее или попросить еще немного времени. Ему/ей надо будет подтвердить передачу.`,
                                    buttons: [{
                                        text: `Связаться`,
                                        id: o.id
                                    },]
                                },(e)=>{
                                    if(e) axios.get(`/${host}/api/requestSeller/${e}`).then(handleSave).catch(handleError);
                                })
                            }
                        })
                            scrollable.append(book)

                        book.append(ce(`span`,false,`info`,drawDate(o.sellerConfirmed._seconds*1000)))
                        book.append(ce(`p`,false,false, o.bookName))
                    })
                    c.append(container)
                } 
            



        }).catch(err=>{
            tg.showAlert(`Изините, вам тут не рады.`)
            console.log(err)
        })

        if(start) {
            start = start.split(`_`)
            switch(start[0]){
                
            }
        }
        
        
        
    })


    
function showSettings(profile){
    shimmer(true)
    let p = preparePopup(`profile`)
    
    p.append(ce(`h1`,false,false,`Настройки`))

    p.append(ce(`p`,false,`info`,`Краткая информация о том, что тут можно делать...`))

    let city = selector(`cities`,`Выберите город`,profile.city,true)

    city.onchange = ()=>{
        axios.put(`/${host}/api/profile/${profile.id}`,{
            attr: `city`,
            value: city.value
        }).then(()=>{
            updateFresh()
        })
    }

    p.append(city)

    p.append(ce(`input`,false,false,false,{
        placeholder: `Адрес`,
        type: `text`,
        name: `address`,
        value: profile.address || null,
        onchange:function(){
            if(this.value){
                localStorage.address = this.value
                axios.put(`/${host}/api/profie/${profile.id}`,{
                    attr: `address`,
                    value: this.value
                })
            }
        }
    }))

    p.append(toggleCheckBox(`profile`,
        profile.id,
        `news`,
        profile.news,
        `Получать новости`
    ))
}



function preparePopup(type) {
    tg.BackButton.show();
    tg.onEvent('backButtonClicked', clearPopUp)

    if (document.querySelector(`[data-type="${type}"]`)) {
        document.querySelector(`[data-type="${type}"]`).remove()
    }

    mcb = clearPopUp
    let popup = ce('div', false, 'popup', false, {
        dataset: {
            type: type
        }
    })
    document.body.append(popup)
    let content = ce('div')
    popup.append(content)

    tg.MainButton.hide()
    return content
}


function clearPopUp() {
    let length = document.querySelectorAll('.popup').length;

    console.log(length)

    let p = document.querySelectorAll('.popup')[length - 1]

    console.log(p)

    p.classList.add('sb')

    setTimeout(function () {
        p.remove()
        if (!document.querySelectorAll('.popup').length) tg.BackButton.hide()
    }, 500)

    if (mcb) {
        tg.MainButton.offClick(mcb)
        mcb = null;
        tg.MainButton.hide()
    }

    if (mbbc) {
        tg.MainButton.hide()
        tg.MainButton.offClick(mbbc)
        mbbc = null
    }
}