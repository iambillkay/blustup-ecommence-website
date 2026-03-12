/* ================= PRODUCT CLASS ================= */

class Product {

constructor(name, price, oldPrice, image, discount){
this.name = name
this.price = price
this.oldPrice = oldPrice
this.image = image
this.discount = discount
}

render(){
return `

<div class="product">

<span class="discount">${this.discount}</span>

<img src="${this.image}" alt="${this.name}">

<p class="product-name">${this.name}</p>

<div class="price">
<span class="new-price">GH₵ ${this.price}</span><br>
<span class="old-price">GH₵ ${this.oldPrice}</span>
</div>

</div>

`
}

}


/* ================= PRODUCT DATA ================= */

const brandProducts = [

new Product("Oraimo maxi watch",2631.90,4900,"product-imgs/1.jpg","-47%"),
new Product("Oraimo Power Bank Lite",136.90,300,"product-imgs/magpower-15-opb-7102w-1.webp","-56%"),
new Product("Oraimo  Lite Earphones",126.98,240,"product-imgs/oraimo-BoomPop-Pro-OHP-917-wireless-headphones-GREY.webp","-47%"),
new Product("Oraimo CleanSip Faucet",217.00,400,"product-imgs/wireless-earphones-spacebuds-neo-plus-otw-323p-black.webp","-42%"),
new Product("Oraimo NutriFry Max Air Watch",1078.92,1800,"product-imgs/oraimo-watch-muse-OSW-831N-4.webp","-39%"),
new Product("Oraimo Smart Trimmer",183.89,350,"product-imgs/africa-en-galaxy-s26-ultra-s948-sm-s948bzvoafb-thumb-551361084.webp","-47%"),
new Product("Oraimo Wireless Charger",183.89,350,"product-imgs/AI-appliances_v21.avif","-47%"),

]
const brandProducts1 = [

new Product("Pepsodent Tooth Paste",2631.90,4900,"product-imgs/personal-care/36024a.jpg","-47%"),
new Product("Close Up Tooth Paste",136.90,300,"product-imgs/personal-care/67728a.jpg","-56%"),
new Product("Kel Mouth Wash",126.98,240,"product-imgs/personal-care/70100a.jpg","-47%"),
new Product("Oral B Tooth Brush",217.00,400,"product-imgs/personal-care/94947a.jpg","-42%"),
new Product("Teabag",1078.92,1800,"product-imgs/personal-care/l010a.jpg","-39%"),
new Product("Dove Soap",183.89,350,"product-imgs/personal-care/163944.png","-47%"),
new Product("Lifebuoy Soap",183.89,350,"product-imgs/personal-care/102276b.jpg","-47%"),
new Product("Lux Soap",183.89,350,"product-imgs/personal-care/154710.png","-47%")
]


/* ================= RENDER PRODUCTS ================= */

let rows = []

document.addEventListener("DOMContentLoaded", () => {
    // 1. Select your rows
    const row1 = document.getElementById("productRow1");
    const row2 = document.getElementById("productRow2");

    // 2. Render brandProducts (Oraimo) to Row 1
    if (row1) {
        brandProducts.forEach(product => {
            row1.innerHTML += product.render();
        });
        startCarousel(row1);
    }

    // 3. Render brandProducts1 (Pepsodent/Oral B) to Row 2
    if (row2) {
        brandProducts1.forEach(product => {
            row2.innerHTML += product.render();
        });
        startCarousel(row2);
    }

    startTimer();
});

/* ================= AUTO CAROUSEL ================= */

function startCarousel(row){

let autoScroll = setInterval(()=>{

row.scrollBy({
left:220,
behavior:"smooth"
})

},3000)

row.addEventListener("mouseenter",()=>{
clearInterval(autoScroll)
})

row.addEventListener("mouseleave",()=>{
startCarousel(row)
})

}


/* ================= BUTTON SCROLL ================= */

function scrollLeft(btn){

const row = btn.parentElement.querySelector(".product-row")

row.scrollBy({
left:-300,
behavior:"smooth"
})

}

function scrollRight(btn){

const row = btn.parentElement.querySelector(".product-row")

row.scrollBy({
left:300,
behavior:"smooth"
})

}


/* ================= MOUSE WHEEL ================= */

rows.forEach(row => {

if(!row) return

row.addEventListener("wheel",(e)=>{

e.preventDefault()
row.scrollLeft += e.deltaY

})

})


/* ================= TIMER ================= */

function startTimer() {
    let time = 6 * 60 * 60; // 6 hours in seconds
    
    // Select ALL timer elements
    const timers = document.querySelectorAll(".timer-display");

    setInterval(() => {
        let h = Math.floor(time / 3600);
        let m = Math.floor((time % 3600) / 60);
        let s = time % 60;

        // Format numbers to 00:00:00
        const hDisplay = h.toString().padStart(2, "0");
        const mDisplay = m.toString().padStart(2, "0");
        const sDisplay = s.toString().padStart(2, "0");

        const timeString = `Time Left: ${hDisplay}h : ${mDisplay}m : ${sDisplay}s`;

        // Loop through each timer element and update its text
        timers.forEach(timer => {
            timer.textContent = timeString;
        });

        if (time > 0) {
            time--;
        } else {
            // Optional: What happens when time hits zero?
            timers.forEach(timer => timer.textContent = "Offer Expired!");
        }

    }, 1000);
}


















// Array holding your different ad images and where they should link to
const track = document.querySelector(".hero-track")
const slides = document.querySelectorAll(".hero-slide")
const nextBtn = document.querySelector(".hero-btn.next")
const prevBtn = document.querySelector(".hero-btn.prev")
const dotsContainer = document.querySelector(".hero-dots")

let index = 0

/* create dots */

slides.forEach((_,i)=>{
const dot=document.createElement("span")
if(i===0) dot.classList.add("active")

dot.addEventListener("click",()=>{
index=i
updateCarousel()
})

dotsContainer.appendChild(dot)
})

const dots=document.querySelectorAll(".hero-dots span")

function updateCarousel(){

track.style.transform=`translateX(-${index*100}%)`

dots.forEach(d=>d.classList.remove("active"))
dots[index].classList.add("active")

}

/* buttons */

nextBtn.addEventListener("click",()=>{
index=(index+1)%slides.length
updateCarousel()
})

prevBtn.addEventListener("click",()=>{
index=(index-1+slides.length)%slides.length
updateCarousel()
})

/* auto slide */

setInterval(()=>{
index=(index+1)%slides.length
updateCarousel()
},5000)

/* swipe support */

let startX=0

track.addEventListener("touchstart",(e)=>{
startX=e.touches[0].clientX
})

track.addEventListener("touchend",(e)=>{

let endX=e.changedTouches[0].clientX

if(startX-endX>50){
index=(index+1)%slides.length
}

if(endX-startX>50){
index=(index-1+slides.length)%slides.length
}

updateCarousel()

})