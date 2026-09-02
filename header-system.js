/* Header system display only. The single SYSTEM handler lives in index.html. */
(function(){
 "use strict";
 function refresh(){
   const st=window.state||{};
   const p=document.getElementById("power");
   if(p){p.textContent=st.system?"SYSTEM ON":"SYSTEM OFF";p.classList.toggle("on",!!st.system);}
 }
 window.refreshSystemHeader=refresh;
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",refresh,{once:true});else refresh();
})();
