/* Header system controls — binds visible header buttons to existing engine APIs. */
(function(){
 "use strict";
 const $=id=>document.getElementById(id);
 function result(t){const e=$("testResult");if(e)e.textContent=t}
 function sync(){if(typeof window.syncHeader==="function")window.syncHeader();else{
   const active=window.MixerAdapters?.active;
   const live=!!active?.connected;
   const p=$("power"); if(p){p.textContent=window.state?.system?"SYSTEM ON":"SYSTEM OFF";p.classList.toggle("on",!!window.state?.system)}
   const st=$("status");if(st)st.textContent=live?"ONLINE":"OFFLINE";
 }}
 function bind(){
   $("power")?.addEventListener("click",e=>{e.preventDefault();if(typeof window.toggleSystem==="function")window.toggleSystem();sync()});
   $("connectEsp")?.addEventListener("click",async e=>{e.preventDefault();if(typeof window.handleEspConnect==="function")await window.handleEspConnect(e);sync()});
   $("connectBluetooth")?.addEventListener("click",async e=>{e.preventDefault();if(typeof window.handleBluetoothConnect==="function")await window.handleBluetoothConnect(e);sync()});
   $("savePresetTop")?.addEventListener("click",e=>{e.preventDefault();if(typeof window.savePreset==="function"){window.savePreset("default");result("PRESET SAVED: default")}});
   $("recallPresetTop")?.addEventListener("click",e=>{e.preventDefault();if(typeof window.recallPreset==="function"){const ok=window.recallPreset("default");result(ok?"PRESET RECALLED: default":"NO PRESET SAVED")}});
   $("defaultScene")?.addEventListener("click",e=>{e.preventDefault();if(typeof window.resetScene==="function"){window.resetScene();result("DEFAULT SCENE LOADED")}else if(window.state?.channels){window.state.channels.forEach(c=>{c.gain=1;c.low=0;c.mid=0;c.high=0;c.pan=0;c.fader=75;c.mute=false;c.solo=false});window.state.master=75;if(typeof window.renderMixerChannels==="function")window.renderMixerChannels();result("DEFAULT SCENE LOADED") }});
   sync();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
