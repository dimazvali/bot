let sizes = {
    x: 2399,
    y: 1627
}

let scrollBlockY, 
    scrollBlockX,
    removeLine,
    scrolling, 
    startRemoved  = false;


function toggleStart(){    
    startRemoved = true;
    start.remove()
    document.querySelectorAll(`.hidden`).forEach(i=>{
        i.classList.toggle(`hidden`)
    })

}

window.onload=()=>{

    hover.style.filter = 'opacity(0)'
    setTimeout(()=>{
        hover.remove()
    },300)
    
    sizes.y = viewBox.getBoundingClientRect().height/3
    sizes.x = viewBox.getBoundingClientRect().width/3

    let cpy = window.pageYOffset;
    let cpx = window.pageXOffset;

    window.scrollTo({
        left:   sizes.x + ((sizes.x-window.innerWidth)/2),
        top:    sizes.y + ((sizes.y-window.innerHeight)/2)
    })

    setTimeout(()=>{
        window.onscroll=(e)=>{

            if(!startRemoved){
                toggleStart()
            }
    
            scrolling = true;
            
        
        
            let left =  window.pageXOffset- sizes.x*2;
            let top =   window.pageYOffset - sizes.y*2;
            
            if(top < -1*(sizes.y/1) && !scrollBlockY){
                    
                scrollBlockY = true;
        
                let line = document.querySelector(`.line`)
                let newline = line.cloneNode(true);
                line.parentElement.prepend(newline);
        
                setTimeout(()=>{
                    scrollBlockY = false;
                },300)
                
            }
        
            if(top > 0 && !scrollBlockY){
                    
                scrollBlockY = true;
        
                let line = document.querySelector(`.line`)
                let newline = line.cloneNode(true);
                line.parentElement.append(newline);
        
                setTimeout(()=>{
                    scrollBlockY = false;
                },300)
                
            }
            
            if(left < -1*(sizes.x/2) && !scrollBlockX){
                
                scrollBlockX = true;

                let line = document.querySelector(`.tile`)

                let newline = [line.cloneNode(true),line.cloneNode(true),line.cloneNode(true)];
                
                document.querySelectorAll(`.fl`).forEach((c,i)=>c.prepend(newline[i]));
        
                setTimeout(()=>{
                    scrollBlockX = false;
                },300)
            }

            if(left > 0 && !scrollBlockX){
                scrollBlockX = true;

                let line = document.querySelector(`.tile`)

                let newline = [line.cloneNode(true),line.cloneNode(true),line.cloneNode(true)];
                
                document.querySelectorAll(`.fl`).forEach((c,i)=>c.append(newline[i]));
        
                setTimeout(()=>{
                    scrollBlockX = false;
                },300)
            }
        
            // document.querySelector(`#v`).innerHTML = `${window.pageXOffset}<br>${window.pageYOffset}<br>${sizes.y}`
        }
        setInterval(()=>{
            if(scrolling){
                if(cpy == window.pageYOffset){
                    scrollEnd();
                    scrolling = false;
                } else {
                    cpy = window.pageYOffset
                }
                if(cpx == window.pageXOffset){
                    scrollEnd();
                    scrolling = false;
                } else {
                    cpx = window.pageXOffset
                }
            }
        },300)
    },100)
    
}






function scrollEnd(){

    
    scrollBlockY = false;
    scrollBlockX = false;
    
    let left = window.pageXOffset- sizes.x*2;
    let top = window.pageYOffset - sizes.y*2;

    window.scrollTo({
        left:window.pageXOffset%sizes.x+sizes.x,
        top:window.pageYOffset%sizes.y+sizes.y
    })
        
    try {
        document.querySelectorAll(`.fl`).forEach((e,i)=>{
            e.querySelectorAll(`.tile`).forEach((t,i)=>{
                if(i>2) t.remove()
            })
        })    
    } catch (error) {
        // alert(error)
    }

    try {
        console.log(document.querySelectorAll(`.fl`).length)
        document.querySelectorAll(`.fl`).forEach((e,i)=>{
            console.log(i);
            if(i>2) e.remove();
        })    
    } catch (error) {
        // alert(error)
    }
}

