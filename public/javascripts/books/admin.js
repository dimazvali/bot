let host = `books`
let downLoadedUsers = {};
let botLink = `https://t.me/dimazvalibot`
let buttonStyle = []
let subHost = `api`

function closeLeft() {
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p => p.remove())
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