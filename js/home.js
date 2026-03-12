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

new Product(
"Oraimo SpaceBox Max Wireless Speaker",
2631.90,
4900,
"product-imgs/1.jpg",
"-47%"
),

new Product(
"Oraimo SpaceBuds Lite",
136.90,
300,
"product-imgs/magpower-15-opb-7102w-1.webp",
"-56%"
),

new Product(
"Oraimo Necklace Lite Earphones",
126.98,
240,
"product-imgs/magpower-15-opb-7102w-1.webp",
"-47%"
),

new Product(
"Oraimo CleanSip Faucet",
217.00,
400,
"product-imgs/wireless-earphones-spacebuds-neo-plus-otw-323p-black.webp",
"-42%"
),

new Product(
"Oraimo NutriFry Max Air Fryer",
1078.92,
1800,
"product-imgs/oraimo-watch-muse-OSW-831N-4.webp",
"-39%"
),

new Product(
"Oraimo Smart Trimmer",
183.89,
350,
"product-imgs/africa-en-galaxy-s26-ultra-s948-sm-s948bzvoafb-thumb-551361084.webp",
"-47%"
)

]


/* ================= RENDER PRODUCTS ================= */

let row

document.addEventListener("DOMContentLoaded", () => {

row = document.getElementById("productRow")

if(!row) return

brandProducts.forEach(product => {

row.innerHTML += product.render()

})

startCarousel()
startTimer()

})



/* ================= AUTO CAROUSEL ================= */

let autoScroll

function startCarousel(){

autoScroll = setInterval(()=>{

row.scrollBy({
left:220,
behavior:"smooth"
})

},3000)


/* Pause on hover */

row.addEventListener("mouseenter",()=>{
clearInterval(autoScroll)
})

row.addEventListener("mouseleave",()=>{
startCarousel()
})

}



/* ================= BUTTON SCROLL ================= */

function scrollLeft(){

row.scrollBy({
left:-300,
behavior:"smooth"
})

}

function scrollRight(){

row.scrollBy({
left:300,
behavior:"smooth"
})

}



/* ================= MOUSE WHEEL SCROLL ================= */

document.addEventListener("DOMContentLoaded",()=>{

const row = document.getElementById("productRow")

if(!row) return

row.addEventListener("wheel",(e)=>{

e.preventDefault()
row.scrollLeft += e.deltaY

})

})



/* ================= TIMER ================= */

function startTimer(){

let time = 6*60*60

const timer = document.getElementById("timer")

setInterval(()=>{

let h=Math.floor(time/3600)
let m=Math.floor((time%3600)/60)
let s=time%60

h = h.toString().padStart(2,"0")
m = m.toString().padStart(2,"0")
s = s.toString().padStart(2,"0")

timer.textContent = `Time Left: ${h}h : ${m}m : ${s}s`

if(time>0) time--

},1000)

}