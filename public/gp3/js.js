const hor = [1,3,6,7,9,11,13,15,16];
const ver = [2,4,5,8,10,12,14,17];

let freeHor = [...hor];
let freeVer = [...ver];

const dataGals = [10,5,8,6,12,13,4,3,11,7,14,2,9,1,15,16,17,18];

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
        
        let ps = new Number(composition[0].getBoundingClientRect().x/rem);

        if(!preventHor){
            preventHor = true;
            console.log('движение влево')
            
            let cols = [... new Set(composition.map(el=>el.getBoundingClientRect().x))].sort((a,b)=>b-a);
            
            // console.log(cols);
            let offset = +composition.filter(el=>el.getBoundingClientRect().x === cols[3])[0].dataset.x; 
            composition.filter(el=>el.getBoundingClientRect().x === cols[0]).forEach(el=>{
                let shift = -60+(offset)-2;    
                console.log(shift, ps)
                el.style.transform = `translate(-${shift}rem, ${+el.dataset.y}rem)`
                el.dataset.x = shift;
            })
            preventHor = false;
        }
        
    } else if (composition[composition.length-1].getBoundingClientRect().right < window.innerWidth){
        console.log(' движение вправо')
        let cols = [... new Set(composition.map(el=>el.getBoundingClientRect().x))].sort((a,b)=>a-b);
        
        composition.filter(el=>el.getBoundingClientRect().x === cols[0]).forEach(el=>{
            el.style.transform = `translate(${composition[composition.length-1].getBoundingClientRect().right/rem + 2}rem, ${+el.dataset.y}rem)`
            el.dataset.x = composition[composition.length-1].getBoundingClientRect().right/rem + 2;
        })
    }

    let compositionY = [...document.querySelectorAll(`[data-type]`)];
    
    compositionY = compositionY.sort((a,b)=>{
        return a.getBoundingClientRect().y-b.getBoundingClientRect().y
    })

    

    
    if(compositionY[0].getBoundingClientRect().top > 8){
        console.log('движение вверх')
        let cols = [... new Set(compositionY.map(el=>el.getBoundingClientRect().y))].sort((a,b)=>b-a);

        console.log(cols)
        let offset = +composition.filter(el=>el.getBoundingClientRect().y === cols[3])[0].dataset.y; 

        compositionY.slice(-4).forEach(el=>{
            let shift = -40+(offset)-2;
            el.style.transform = `translate(${+el.dataset.x}rem, -${shift}rem)`
            el.dataset.y = shift;
        })
    } else if(compositionY[compositionY.length-1].getBoundingClientRect().bottom < window.innerHeight){
        console.log('движение вниз')

        let cols = [... new Set(compositionY.map(el=>el.getBoundingClientRect().y))].sort((a,b)=>a-b);
        
        compositionY.filter(el=>el.getBoundingClientRect().y === cols[0]).forEach(el=>{
            el.style.transform = `translate(${+el.dataset.x}rem, ${(compositionY[compositionY.length-1].getBoundingClientRect().bottom/rem) + 2}rem)`
            el.dataset.y = (compositionY[compositionY.length-1].getBoundingClientRect().bottom/rem) + 2;
        })
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
}

previousTouch ={
    clientX: 0,
    clientY: 0
};

document.ontouchmove = (e) => {
    e.preventDefault()

    const touch = e.touches[0];

    if (previousTouch) {
        moovePage(touch.clientX - previousTouch.clientX, touch.clientY - previousTouch.clientY);
    }

    previousTouch = touch;

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

while (col < 4) {
    let row = 0;
    while (row < 4) {
        let b = setBlock(`${col * 62}rem, ${row * 42}rem`);
        viewBox.append(b);
        b.dataset.x = col * 62;
        b.dataset.y = row * 42;
        row++;
    }
    col++;
}


window.onload = function() {

    window.onkeyup=(e)=>{
        if(e.code == `ArrowLeft` || e.code == `ArrowRight`){
            keyScroll.x =clearInterval(keyScroll.x)
        }
        if(e.code == `ArrowUp` || e.code == `ArrowDown`){
            keyScroll.y = clearInterval(keyScroll.y)
        }
    }
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
    
        if(scrolls[e.code]){
            if(!keyScroll[scrolls[e.code].axis]) keyScroll[scrolls[e.code].axis] = setInterval(()=>{
                moovePage(scrolls[e.code].axis == `x` ? scrolls[e.code].left : 0, scrolls[e.code].axis == `y` ? scrolls[e.code].top : 0)
            },10)
        }
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
