let host = `books`
let subHost = `admin`
let downLoadedUsers = {};
let botLink = `https://t.me/dimazvalibot`
let buttonStyle = []


function showCities(){
    showScreen(`Города`,`cities`,showCityLine,addCity)
}


start = start.split('_')

switch(start[0]){
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





function showCity(id){
    let p = preparePopupWeb(`cities_${id}`,false,false,true)
        load(`cities`,id).then(city=>{
            
            p.append(detailsContainer(city))

            p.append(ce(`h1`,false,false,city.name,{
                onclick:function(){
                    edit(`cities`,id,`name`,`text`,city.name,this)
                }
            }))

            p.append(ce(`p`,false,false,city.description||'добавьте описание',{
                onclick:function(){
                    edit(`cities`,id,`description`,`textarea`,city.description||`добавьте описание`,this)
                }
            }))

            let offers = ce(`div`)
                offers.append(ce(`h3`,false,false,`Предложения:`))
                load(`offers`,false,{city:id}).then(offersData=>{
                    offersData.length ? offers.append(ce(`p`,false,false,`пока нет`)) : offersData.forEach(o=>{
                        offers.append(showOfferLine(o))
                    })
                    offers.append(ce(`button`,false,false,`Добавить`,{
                        onclick:()=>addOffer({city:id})
                    }))
                })
            p.append(offers)

        })
}


function addCity(){
    addScreen(`cities`,`Новый город`,{
        name:           {placeholder: `Название`},
        description:    {placeholder: `Описание`,tag:`textarea`},
        currency:       {placeholder: `код валюты`},
    })
}

