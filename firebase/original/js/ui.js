document.addEventListener("DOMContentLoaded",()=>{

const menu=document.getElementById("sideMenu");
const overlay=document.getElementById("menuOverlay");
const toast=document.getElementById("toast");

function show(message){
 if(!toast)return;
 toast.textContent=message;
 toast.classList.add("show");
 clearTimeout(window.cappuToast);
 window.cappuToast=setTimeout(()=>toast.classList.remove("show"),2400);
}

document.getElementById("menuButton")?.addEventListener("click",()=>{
 menu?.classList.add("open"); overlay?.classList.add("show");
});
document.getElementById("closeMenu")?.addEventListener("click",close);
overlay?.addEventListener("click",close);
function close(){menu?.classList.remove("open");overlay?.classList.remove("show")}

document.getElementById("filterButton")?.addEventListener("click",()=>{
 document.getElementById("filterPanel")?.classList.toggle("visible");
});

document.querySelectorAll(".save").forEach(btn=>{
 btn.addEventListener("click",()=>{
  const saved=btn.classList.toggle("saved");
  btn.textContent=saved?"♥":"♡";
  show(saved?"História adicionada aos favoritos ♥":"História removida dos favoritos.");
 });
});

document.querySelectorAll(".see-all").forEach(btn=>{
 btn.addEventListener("click",()=>show("Abrindo todas as histórias..."));
});

document.getElementById("notificationButton")?.addEventListener("click",()=>{
 show("Você tem novas notificações.");
});

document.getElementById("profileButton")?.addEventListener("click",()=>{
 show("Abrindo seu perfil...");
});

document.getElementById("publishButton")?.addEventListener("click",()=>{
 show("Abrindo página para publicar sua história...");
 // Quando criar a página: window.location.href="publicar.html";
});

document.getElementById("darkModeButton")?.addEventListener("click",()=>{
 document.body.classList.toggle("dark-cappu");
 show(document.body.classList.contains("dark-cappu")?"Modo escuro ativado.":"Modo claro ativado.");
});

});