const hor = [1,3,6,7,9,11,13,15,16];
const ver = [2,4,5,8,10,12,14,17];

let freeHor = [...hor];
let freeVer = [...ver];

const dataGals = [10,5,8,6,12,13,4,3,11,7,14,2,9,1,15,16,17,18];

const grid = 5;
const gap = 4;

const witemWidth = 60;
const itemHeight = 40;

function getRandomCard(type){
    switch (type){
        case `hor`:{
            let i = Math.floor(Math.random() * freeHor.length);
            let card = freeHor.splice(i,1);
            if(freeHor.length === 0) freeHor = [...hor];
            return card;
        }
        case `ver`:{
            let i = Math.floor(Math.random() * freeVer.length);
            let card = freeVer.splice(i,1); 
            if(freeVer.length === 0) freeVer = [...ver];
            return card;
        }
    }
}


let mouseDown = false;

let preventHor = false;

let coolantX = false;
let coolantY = false;

let cooldown = false;
let coolDownTimer = 30;

function cd(){
    if(!cooldown) {
        cooldown = true;
        setTimeout(()=>{
            cooldown = false;
            console.warn(`сняли кулдаун`)    
        },coolDownTimer)
        return true
    } else {
        console.warn(`cooldown`)
        return false
    }
}

function moovePage(x,y){


    document.querySelectorAll(`[data-type]`).forEach(el => {
        el.style.transform = `translate(${(+el.dataset.x||0) + (x/rem)}rem, ${(+el.dataset.y||0)+ (y/rem)}rem)`
        el.dataset.x = (+el.dataset.x||0) + (x/rem);
        el.dataset.y = (+el.dataset.y||0) + (y/rem);
    })

    let composition = [...document.querySelectorAll(`[data-type]`)];
    
    composition = composition.sort((a,b)=>{
        return a.getBoundingClientRect().x-b.getBoundingClientRect().x
    })
    // console.log(composition[0].getBoundingClientRect().x)

    if(composition[0].getBoundingClientRect().x > rem){
        
        // if(coolantX) return;
        // coolantX = true;

        let ps = new Number(composition[0].getBoundingClientRect().x/rem);

        console.log('движение влево')
        
        let offset = +composition[0].dataset.x; 
        
        composition.slice(-grid).forEach(el=>{
            let shift = -witemWidth+(offset)-gap;
            console.log(shift, ps)
            el.style.transform = `translate(-${shift}rem, ${+el.dataset.y}rem)`
            el.dataset.x = shift;
        })
        
    } else if (composition[composition.length-1].getBoundingClientRect().right < window.innerWidth){

        
        // if(coolantX) return;
        // coolantX = true;

        console.log(' движение вправо')
        
        let shift = +composition[composition.length-1].dataset.x + witemWidth + gap
        
        composition.slice(0,grid).forEach(el=>{
            el.style.transform = `translate(${shift}rem, ${+el.dataset.y}rem)`
            el.dataset.x = shift;
        })

    } else {

        let compositionY = [...document.querySelectorAll(`[data-type]`)];
    
        compositionY = compositionY.sort((a,b)=>{
            return a.getBoundingClientRect().y-b.getBoundingClientRect().y
        })

        console.log(compositionY[0].getBoundingClientRect().top,compositionY[compositionY.length-1].getBoundingClientRect().bottom)
        
        if(compositionY[0].getBoundingClientRect().top > 8){

            // if(coolantY) return;
            // coolantY = true;

            console.log('движение вверх')

            let offset = compositionY[0].getBoundingClientRect().top/rem;

            compositionY.slice(-grid).forEach(el=>{
                let shift = -itemHeight + (offset) - gap;
                el.style.transform = `translate(${+el.dataset.x}rem, ${shift}rem)`
                el.dataset.y = shift;
            })

        } else if (compositionY[compositionY.length-1].getBoundingClientRect().bottom < window.innerHeight){
          
            

            // if(coolantY) return;
            // coolantY = true;

            console.log('движение вниз')

            let shift = +(compositionY[compositionY.length-1].dataset.y) + itemHeight + gap

            console.log(grid,shift);

            compositionY.slice(0,grid).forEach((el,i)=>{
                console.log(i);

                el.style.transform = `translate(${+el.dataset.x}rem, ${shift}rem)`
                el.dataset.y = shift;
            })
        }
    }

    
}

document.onmousedown = (e) => {
    e.preventDefault();
    mouseDown = true;

}

document.onmouseover = (e) => {
    e.preventDefault()
}

document.onmouseup = (e) => {
    mouseDown = false;
    coolantX = false;
    coolantY = false;
}

previousTouch = {
    clientX: 0,
    clientY: 0
};

document.ontouchend = ()=>{
    coolantX = false;
    coolantY = false;   
}

document.ontouchstart = (e) =>{
    console.log(`touch`)
    e.preventDefault()
    previousTouch = e.touches[0];
    coolantX = false;
    coolantY = false;
}

document.ontouchmove = (e) => {
    
    const touch = e.touches[0];
    
    if (previousTouch) {
        moovePage(touch.clientX - previousTouch.clientX, touch.clientY - previousTouch.clientY);
    }
    previousTouch = e.touches[0]

}


let rem = parseInt(getComputedStyle(document.documentElement).fontSize)




const observer = new IntersectionObserver((entries) => {
    // If intersectionRatio is 0, the target is out of view
    // and we do not need to do anything.
    // if (entries[0].intersectionRatio <= 0) return;
  
    console.log(entries)

    console.log("Loaded new items");
  });
  // start observing

let col = 0;

while (col < grid) {
    let row = 0;
    while (row < grid) {
        let b = setBlock(`${col * (witemWidth + gap)}rem, ${row * (itemHeight + gap)}rem`);
        viewBox.append(b);
        b.dataset.x = col * (witemWidth + gap);
        b.dataset.y = row * (itemHeight + gap);
        row++;
    }
    col++;
}


window.onload = function() {

    // window.onkeyup=(e)=>{
    //     if(e.code == `ArrowLeft` || e.code == `ArrowRight`){
    //         keyScroll.x =clearInterval(keyScroll.x)
    //     }
    //     if(e.code == `ArrowUp` || e.code == `ArrowDown`){
    //         keyScroll.y = clearInterval(keyScroll.y)
    //     }
    // }
    let keyScroll = {
        y: null,
        x: null
    };

    window.onkeydown=(e)=>{
    
        const movement = 3;

        let scrolls = {
            'ArrowUp': {
                axis:       `y`,
                top:        movement,
            },
            'ArrowDown': {
                axis:       `y`,
                top:        -movement,
            },
            'ArrowLeft':{
                axis:       `x`,
                left:       movement,
            },
            'ArrowRight': {
                axis:       `x`,
                left:       -movement,
            }
    
        }
        

        requestAnimationFrame((event)=>{
            console.log(e.code,event);
            if(scrolls[e.code]) moovePage(scrolls[e.code].axis == `x` ? scrolls[e.code].left : 0, scrolls[e.code].axis == `y` ? scrolls[e.code].top : 0)
        })
        
        
    
        // if(scrolls[e.code]){
        //     if(!keyScroll[scrolls[e.code].axis]) keyScroll[scrolls[e.code].axis] = setInterval(()=>{
        //         moovePage(scrolls[e.code].axis == `x` ? scrolls[e.code].left : 0, scrolls[e.code].axis == `y` ? scrolls[e.code].top : 0)
        //     },10)
        // }
    }

    hover.style.filter = 'opacity(0)';

    document.onmousemove = (e) => {
        
        e.preventDefault();
        
        if (mouseDown) {
            moovePage(e.movementX, e.movementY);
        }
    }
    

    let f = document.querySelectorAll(`[data-type]`)[15];

    setTimeout(() => {
        window.scrollTo(f.getClientRects()[0].right/2-(window.innerWidth/2),f.getClientRects()[0].bottom/2-(window.innerHeight/2))
    }, 200);
    
    observer.observe(document.querySelector(`[data-type="0"]`));
    
    setTimeout(() => {
        hover.style.display = 'none';   
    }, 1000);
}

function setPicture(type){
    let picure = getRandomCard(type);
    let img = ce(`img`,false,[`g-card`,picure],false,{
        src: `/images/cards/${picure}.webp`,
        dataset:{
            gal: dataGals[picure]
        },
        onclick:()=>{
            // popup(img.src)
        }
    });
    return img;
}

function setBlock(translate){
    let type = Math.floor(Math.random() * 3);
    let block = ce(`div`,false,false,false,{
        dataset:{
            type: type
        },
    });
    if(translate) block.style.transform = `translate(${translate})`;
    switch(type){
        case 0:{
            block.append(setPicture(`hor`));
            break;
        }
        case 1:{
            let col = ce(`div`,false,`col`)
            col.append(setPicture(`ver`));
            block.append(col)
            let col2 = ce(`div`,false,[`col`,'c2'])
            col2.append(setPicture(`hor`));
            col2.append(setPicture(`hor`));
            block.append(col2)
            break;
        }
        case 2:{
            let col = ce(`div`,false,`col`)
            col.append(setPicture(`ver`));
            
            let col2 = ce(`div`,false,[`col`,'c2'])
            col2.append(setPicture(`hor`));
            col2.append(setPicture(`hor`));
            block.append(col2)
            block.append(col)
            break;
        }
    }
    return block;
}


function ce(tag, id, classList, innerHTML, options, innerText) {
    var t = document.createElement(tag);
    if (id) {
        t.id = id;
    }
    if (innerHTML) {
        t[innerText ? 'innerText' : 'innerHTML'] =  innerHTML;
    }
    if (classList) {
        if (typeof classList == 'object') {
            classList.forEach(cl => {
                t.classList.add(cl)
            })
        } else {
            t.classList.add(classList)
        }
    }
    if (options) {
        Object.keys(options).forEach(key => {
            if (key !== 'dataset') {
                t[key] = options[key]
            } else {
                Object.keys(options.dataset).forEach(d => {
                    t.dataset[d] = options.dataset[d];
                })
            }
        })
    }

    return t;
}
