let userid = `foreigner`
const host = `auditoria`

function preparePopup(type) {
    // tg.BackButton.show();
    // tg.onEvent('backButtonClicked', clearPopUp)

    if (document.querySelector(`[data-type="${type}"]`)) {
        document.querySelector(`[data-type="${type}"]`).remove()
    }

    // mcb = clearPopUp
    let popup = ce('div', false, 'popup', false, {
        dataset: {
            type: type
        }
    })
    document.body.append(popup)
    let content = ce('div')
    popup.append(content)

    // tg.MainButton.hide()
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
        // if (!document.querySelectorAll('.popup').length) tg.BackButton.hide()

    }, 500)

    // if (mcb) {
    //     tg.MainButton.offClick(mcb)
    //     mcb = null;
    //     tg.MainButton.hide()
    // }

    // if (mbbc) {
    //     tg.MainButton.hide()
    //     tg.MainButton.offClick(mbbc)
    //     mbbc = null
    // }
}



const validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  
function submit(button,type,id){
    let mail = button.parentNode.querySelector(`input`).value;
    if(!mail) return alert(`укажите почту, пожалуйста`)
    if(!validateEmail(mail)) return alert(`простите, благородный дон, это не почта`)
    button.setAttribute(`disabled`,true)
    axios.post(`/${host}/api/subscribe`,{
        type: type,
        mail: mail,
        id: id
    }).then(s=>{
        alert(`Спасибо! Проверьте почту, пожалуйста.`)
    })
    .catch(err=>{
        alert(err.data)
    })
    .finally(s=>{
        button.removeAttribute(`disabled`)
    })
}