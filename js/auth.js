/* SIGNUP */

const signupForm = document.getElementById("signupForm")

if(signupForm){

signupForm.addEventListener("submit",(e)=>{

e.preventDefault()

const name = document.getElementById("signupName").value
const email = document.getElementById("signupEmail").value
const password = document.getElementById("signupPassword").value

const user = {name,email,password}

localStorage.setItem("blustupUser",JSON.stringify(user))

alert("Account created successfully!")

showPage("login")

})

}


/* LOGIN */

const loginForm = document.getElementById("loginForm")

if(loginForm){

loginForm.addEventListener("submit",(e)=>{

e.preventDefault()

const email = document.getElementById("loginEmail").value
const password = document.getElementById("loginPassword").value

const savedUser = JSON.parse(localStorage.getItem("blustupUser"))

if(!savedUser){
alert("No account found. Please sign up.")
return
}

if(email===savedUser.email && password===savedUser.password){

localStorage.setItem("loggedIn","true")

updateLoginUI(savedUser.name)

showPage("home")

}else{
alert("Invalid email or password")
}

})

}


/* UPDATE NAV UI */

function updateLoginUI(name){

const btn=document.getElementById("loginBtn")

if(btn){
btn.textContent=name
btn.onclick=logout
}

}


/* LOGOUT */

function logout(){

localStorage.removeItem("loggedIn")

location.reload()

}


/* AUTO LOGIN */

document.addEventListener("DOMContentLoaded",()=>{

const loggedIn=localStorage.getItem("loggedIn")

const user=JSON.parse(localStorage.getItem("blustupUser"))

if(loggedIn && user){
updateLoginUI(user.name)
}

})