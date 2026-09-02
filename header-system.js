/* Header interaction/status layer — UI only.
   Does not modify mixer engine or audio processing. */
(function(){
 "use strict";
 const $=id=>document.getElementById(id);
 function setText(id,v){const e=$(id);if(e)e.textContent=v}
 function refresh(){
   const system=$("power")?.classList.contains("on");
   const connected=$("status")?.textContent==="ONLINE";
   setText("headerBridgeStatus",connected?"BRIDGE ONLINE":system?"BRIDGE READY":"BRIDGE STANDBY");
   const lamp=$("statusLamp"); if(lamp)lamp.classList.toggle("on",connected);
   const setup=$("setupSystem"); if(setup)setup.textContent=system?"ON":"OFF";
   const transport=$("setupTransport"); if(transport)transport.textContent=connected?"ONLINE":"OFFLINE";
 }
 function bind(){
   $("power")?.addEventListener("click",()=>setTimeout(refresh,0));
   $("connectEsp")?.addEventListener("click",()=>setTimeout(refresh,50));
   $("connectBluetooth")?.addEventListener("click",()=>setTimeout(refresh,50));
   $("savePresetTop")?.addEventListener("click",()=>setTimeout(refresh,0));
   $("recallPresetTop")?.addEventListener("click",()=>setTimeout(refresh,0));
   $("defaultScene")?.addEventListener("click",()=>setTimeout(refresh,0));
   refresh();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
