
function play(el,url,id){
    let cur = el.parentNode
    cur.append(ce(`audio`,false,false,false,{
        controls:true,
        src: url,
        autoplay: true,
        onended: ()=>{
            cur.nextSibling.querySelector(`div`).click()
        }
    }))
    axios.get(`/dimazvali/api/showstarted/${id}`)
    el.remove()
}