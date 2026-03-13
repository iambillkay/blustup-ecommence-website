document.addEventListener("DOMContentLoaded",()=>{

const loginForm=document.getElementById("loginForm")

if(loginForm){

loginForm.addEventListener("submit",(e)=>{

e.preventDefault()

alert("Login successful!")

showPage("home")

})

}

})