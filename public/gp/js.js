let sizes = {
    x: 0,
    y: 0
}

let scrollBlockY,
    scrollBlockX,
    removeLine,
    scrolling,
    startRemoved,
    scrolled,
    mouseDown = false;


function popup(e) {
    if (!scrolled) alert(e)
}

function toggleStart() {

    startRemoved = true;

    start.style.filter = 'opacity(0)';

    setTimeout(() => {

        start.remove();

        document.querySelectorAll(`.hidden`).forEach(i => {
            i.style.display = `initial`
        })

        setTimeout(() => {
            document.querySelectorAll(`.hidden`).forEach(i => {
                i.classList.toggle(`hidden`)
            })
        }, 100)

    }, 300)


}

window.onbeforeunload = function () {
    window.scrollTo({
        left: sizes.x + ((sizes.x - window.innerWidth) / 2),
        top: sizes.y + ((sizes.y - window.innerHeight) / 2)
    })
}

try {
    window.onpagehide = function () {
        window.scrollTo({
            left: sizes.x + ((sizes.x - window.innerWidth) / 2),
            top: sizes.y + ((sizes.y - window.innerHeight) / 2)
        })
    }
} catch (error) {
    
}

async function setdataurl() {
    for (let index = 0; index < 15; index++) {
        const element = index;
        await fetch('/images/cards/' + element + '.webp')
            .then((res) => res.blob())
            .then((blob) => {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    document.querySelectorAll(`.c${element}`).forEach(i => i.src = reader.result)
                };
            });

    }
}

// window.ontouchmove = (e) => {
//     e.preventDefault();
// }

setdataurl()

window.onload = () => {

    hover.style.filter = 'opacity(0)'
    



    sizes.y = viewBox.getBoundingClientRect().height / 3
    sizes.x = viewBox.getBoundingClientRect().width / 3

    
    setTimeout(()=>{
        window.scrollTo({
            behavior: 'smooth',
            left:   sizes.x + ((sizes.x - window.innerWidth) / 2),
            top:    sizes.y + ((sizes.y - window.innerHeight) / 2)
        })
    },1)

    setTimeout(() => {

        hover.remove();


        let keyScroll = {
            y: null,
            x: null
        };

        window.onkeyup=(e)=>{
            if(e.code == `ArrowLeft` || e.code == `ArrowRight`){
                keyScroll.x =clearInterval(keyScroll.x)
            }
            if(e.code == `ArrowUp` || e.code == `ArrowDown`){
                keyScroll.y = clearInterval(keyScroll.y)
            }
        }


        window.onscrollend = (e)=>{
            scrollEnd()
        }

        window.onkeydown=(e)=>{

            const movement = 3;
            
            let scrolls = {
                'ArrowUp': {
                    axis:       `y`,
                    top:        -movement,
                },
                'ArrowDown': {
                    axis:       `y`,
                    top:        movement,
                },
                'ArrowLeft':{
                    axis:       `x`,
                    left:       -movement,
                },
                'ArrowRight': {
                    axis:       `x`,
                    left:       movement,
                }

            }

            if(scrolls[e.code]){
                if(!keyScroll[scrolls[e.code].axis]) keyScroll[scrolls[e.code].axis] = setInterval(()=>{
                    window.scrollBy(scrolls[e.code])
                },10)
            }
        }

        let cpy = window.pageYOffset;
        let cpx = window.pageXOffset;



        document.onmousedown = (e) => {
            e.preventDefault();
            mouseDown = true;
        }

        document.onmouseover = (e) => {
            e.preventDefault()
        }

        document.onclick = (e) => {
            setTimeout(() => {
                scrolled = false;
            }, 300)

            e.cancelBubble = true;
            e.preventDefault();
            return false;
        }

        document.onmouseup = (e) => {
            mouseDown = false;
        }

        document.onmousemove = (e) => {
            e.preventDefault();
            if (mouseDown) {
                scrolled = true;
                window.scrollBy({
                    left: -e.movementX,
                    top: -e.movementY
                })
            }
        }

        let previousTouch = null;
        let curTouch = null;

        document.ontouchstart = (e) => {
            previousTouch = e.touches[0]
            mouseDown = true;
            e.preventDefault();
        }

        document.ontouchend = (e) => {
            // const touch = curTouch;
            // if (previousTouch) {
            //     console.log(touch.pageX - previousTouch.pageX)
            //     // window.scrollBy({
            //     //     left: -(touch.pageX - previousTouch.pageX),
            //     //     top: -(touch.pageY - previousTouch.pageY)
            //     // })
            //     console.log(`window.scrollTo({
            //         left: ${touch.pageX-touch.clientX},
            //         top: ${touch.pageY -touch.clientY}
            //     })`)
            //     window.scrollBy({
            //         behavior:   "smooth",
            //         left:   -(touch.clientX-previousTouch.clientX),
            //         top:    -(touch.clientY -previousTouch.clientY)
            //     })
            // }

            previousTouch = null;
            mouseDown = false;
            scrolled = false;
        }

        // document.ontouchmove = (e) => {
        //     e.preventDefault()
        //     curTouch = e.touches[0];
        //     try {
        //         console.log(mouseDown)
        //         if (mouseDown) {
        //             const touch = e.touches[0];
        //             scrolled = true;
        //             console.log(e.touches)
        //             if (previousTouch) {
        //                 console.log(touch.pageX - previousTouch.pageX)
        //                 // window.scrollBy({
        //                 //     left: -(touch.pageX - previousTouch.pageX),
        //                 //     top: -(touch.pageY - previousTouch.pageY)
        //                 // })
        //                 console.log(`window.scrollTo({
        //                     left: ${touch.pageX-touch.clientX},
        //                     top: ${touch.pageY -touch.clientY}
        //                 })`)
        //                 // alert(touch.clientX-previousTouch.clientX);
        //                 window.scrollBy({
        //                     // behavior:"smooth",
        //                     left: -(touch.clientX-previousTouch.clientX),
        //                     top: -  (touch.clientY -previousTouch.clientY)
        //                 })
        //             }


        //             previousTouch = touch;
        //         }
        //     } catch (err) {
        //         alert(err)
        //     }

        // }

        let lastY = 0;
        let lastX = 0;

        setTimeout(() => {
            window.onscroll = (e) => {
                // e.preventDefault();


                if (!startRemoved) {
                    toggleStart()
                }

                scrolling = true;


                let left = window.pageXOffset - sizes.x;
                let top = window.pageYOffset - sizes.y;


                if (window.pageYOffset / sizes.y < 1 && !scrollBlockY && (lastY && (lastY - window.pageYOffset) > 0)) {

                    // scrollBlockY = true;

                    let line = document.querySelector(`.line`)
                    let newline = line.cloneNode(true);
                    viewBox.prepend(newline);

                    setTimeout(() => {
                        scrollBlockY = false;
                    }, 500)

                } else if (top > (sizes.y / 2) && !scrollBlockY && (lastY && (lastY - window.pageYOffset) < 0)) {


                    // scrollBlockY = true;

                    let line = document.querySelector(`.line`)
                    let newline = line.cloneNode(true);
                    line.parentElement.append(newline);

                    setTimeout(() => {
                        scrollBlockY = false;
                    }, 500)

                }

                if (lastX) {
                    if (lastX > 0) {
                        if (left < -1 * (sizes.x / 2) && !scrollBlockX) {


                            // scrollBlockX = true;

                            let line = document.querySelector(`.tile`)

                            let newline = [line.cloneNode(true), line.cloneNode(true), line.cloneNode(true)];

                            document.querySelectorAll(`.fl`).forEach((c, i) => c.prepend(newline[i]));

                            setTimeout(() => {
                                scrollBlockX = false;
                            }, 500)
                        }
                    } else if (lastX < 0) {
                        if (left > 0 && !scrollBlockX) {

                            // scrollBlockX = true;

                            let line = document.querySelector(`.tile`)

                            let newline = [line.cloneNode(true), line.cloneNode(true), line.cloneNode(true)];

                            document.querySelectorAll(`.fl`).forEach((c, i) => c.append(newline[i]));

                            setTimeout(() => {
                                scrollBlockX = false;
                            }, 500)
                        }
                    }
                }

                lastY = window.pageYOffset;
                lastX = window.pageXOffset;

                // document.querySelector(`#v`).innerHTML = `${window.pageXOffset}<br>${window.pageYOffset}<br>${sizes.y}`
            }
            setInterval(() => {
                if (scrolling) {
                    if (cpy == window.pageYOffset && cpx == window.pageXOffset) {
                        scrollEnd();
                        scrolling = false;
                    } else {
                        cpy = window.pageYOffset;
                        cpx = window.pageXOffset;
                    }
                    // if (cpx == window.pageXOffset) {
                    //     scrollEnd();
                    //     scrolling = false;
                    // } else {
                    //     cpx = window.pageXOffset
                    // }
                }
            }, 500)
        }, 100)
    }, 1000)
}


function scrollEnd() {


    scrollBlockY = false;
    scrollBlockX = false;

    let left = window.pageXOffset - sizes.x * 2;
    let top = window.pageYOffset - sizes.y * 2;

    window.scrollTo({
        left: window.pageXOffset % sizes.x + sizes.x,
        top: window.pageYOffset % sizes.y + sizes.y
    })

    try {
        document.querySelectorAll(`.fl`).forEach((e, i) => {
            e.querySelectorAll(`.tile`).forEach((t, i) => {
                if (i > 2) t.remove()
            })
        })
    } catch (error) {
        // alert(error)
    }

    try {
        document.querySelectorAll(`.fl`).forEach((e, i) => {
            if (i > 2) e.remove();
        })
    } catch (error) {
        // alert(error)
    }

    // viewBox.style.opacity = `0.3`
    // setTimeout(()=>{
    //     viewBox.style.opacity = `1`
    // },200)
}