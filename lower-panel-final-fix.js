/* Mixer Online — lower MAIF/DCA → USB/Audio panel reliability patch.
   Scoped only to .dca. Does not replace channel rack or master logic. */
(function(){
"use strict";
function panel(){return document.querySelector(".dca")}
function notify(message,on){try{window.mixerNotify?.(message);document.dispatchEvent(new CustomEvent("mixer:notification",{detail:{message,on:on!==false}}))}catch{}}
function setLamp(el,on){if(!el)return;el.classList.toggle("indicator-active",!!on);el.setAttribute("aria-pressed",on?"true":"false");let l=el.querySelector(":scope > .control-lamp");if(!l){l=document.createElement("i");l.className="control-lamp off";el.prepend(l)}l.classList.toggle("on",!!on);l.classList.toggle("off",!on)}
function tx(target,control,value){try{return window.MixerControl?.setControl?.(target,control,value)}catch(e){return null}}
function locked(){return !!window.__mixerLiveLocked}
function dcaChannels(n){
 const s=(n-1)*4+1,chs=window.MixerOnline?.state?.channels||[];
 return chs.filter(c=>{const x=Number(c.dataset.channel);return x>=s&&x<s+4})
}
function applyAudio(){
 const st=window.MixerOnline?.state;if(!st)return;
 const dcaSolo=st.dcaSolo||new Set(), muteGroups=st.muteGroups||new Set(), chSolo=st.solo||new Set();
 const anyDca=dcaSolo.size>0, anySolo=chSolo.size>0;
 (st.channels||[]).forEach(c=>{
   const n=Number(c.dataset.channel);
   const dca=Math.floor((n-1)/4)+1;
   const f=Number(c.querySelector(".fader")?.value||0)/100;
   const g=Number(c.querySelector(".gainKnob")?.dataset.value||1)/2;
   const muted=c.classList.contains("muted")||muteGroups.has(Math.floor((n-1)/4)+1);
   const soloed=c.classList.contains("soloed");
   const dcaAllowed=!anyDca||dcaSolo.has(dca);
   const soloAllowed=!anySolo||soloed;
   if(c._gain)c._gain.gain.value=(muted||!dcaAllowed||!soloAllowed)?0:f*g;
 });
}
function syncState(){
 const p=panel();if(!p)return;
 p.querySelectorAll(".dca-btn").forEach(b=>{const on=b.classList.contains("indicator-active");setLamp(b,on)});
 p.querySelectorAll(".mute-groups button,.dca-groups button,.auto-option").forEach(b=>setLamp(b,b.classList.contains("indicator-active")));
 p.querySelectorAll(".route-btn,.usb-route-btn").forEach(b=>setLamp(b,b.classList.contains("indicator-active")));
 const det=p.querySelector("#detectUsbAudio");if(det&&window.MixerOnline?.state?.usbStream?.active)setLamp(det,true);
}
function install(){
 const p=panel();if(!p||p.dataset.lowerFixV2==="1")return;
 p.dataset.lowerFixV2="1";
 p.querySelectorAll("button").forEach(b=>{if(!b.querySelector(".control-lamp")&&!b.matches(".scene-row input")){const l=document.createElement("i");l.className="control-lamp off";b.prepend(l)}});

 // DCA SOLO: existing mixer handler owns the ON/OFF state; this patch makes it affect audio too.
 p.querySelectorAll(".dca-btn").forEach(b=>b.addEventListener("click",()=>{setTimeout(()=>{
   const n=Number(b.dataset.dca),on=b.classList.contains("indicator-active");
   applyAudio();setLamp(b,on);notify("DCA "+n+" SOLO "+(on?"ON":"OFF"),on);
   tx("DCA "+n,"solo",on?1:0);
 },0)));

 // MUTE GROUPS / DCA GROUPS / AUTO MIX: keep state and notification synchronized.
 p.querySelectorAll(".mute-groups button").forEach(b=>b.addEventListener("click",()=>setTimeout(()=>{
   const n=Number(b.dataset.group),on=b.classList.contains("indicator-active");setLamp(b,on);applyAudio();notify("MUTE GROUP "+n+" "+(on?"ON":"OFF"),on);
 },0)));
 p.querySelectorAll(".dca-groups button").forEach(b=>b.addEventListener("click",()=>setTimeout(()=>{
   const n=Number(b.dataset.dcagroup),on=b.classList.contains("indicator-active");setLamp(b,on);notify("DCA GROUP "+n+" "+(on?"ON":"OFF"),on);
 },0)));
 p.querySelectorAll(".auto-option").forEach(b=>b.addEventListener("click",()=>setTimeout(()=>{
   const name=(b.querySelector("span")?.textContent||b.id).trim(),on=b.classList.contains("indicator-active");setLamp(b,on);notify(name+" "+(on?"ON":"OFF"),on);
 },0)));

 // BUS sliders: always keep visible ON/OFF state and hardware value in sync.
 p.querySelectorAll(".bus-master input[type=range]").forEach((x,i)=>{
   const update=()=>{const v=Number(x.value)||0,label=x.closest("label");label?.classList.toggle("active-level",v>0);if(label){let l=label.querySelector(".control-lamp");if(!l){l=document.createElement("i");l.className="control-lamp off";label.prepend(l)}l.classList.toggle("on",v>0);l.classList.toggle("off",v<=0)}if(!locked())tx("BUS "+(i+1),"level",v)};
   x.addEventListener("input",update);x.addEventListener("change",()=>{update();notify("BUS "+(i+1)+" "+(Number(x.value)>0?"ON":"OFF")+" • "+x.value+"%",Number(x.value)>0)});update();
 });

 // Routing buttons: first click selects, second click turns the selected route OFF.
 p.querySelectorAll(".route-btn").forEach(b=>{
   b.addEventListener("click",e=>setTimeout(()=>{
     const on=b.classList.contains("indicator-active");
     if(e.detail===0)return;
     const was=b.dataset.lowerWasActive==="1";
     if(was){
       b.classList.remove("indicator-active");b.setAttribute("aria-pressed","false");setLamp(b,false);
       window.MixerOnline&&(window.MixerOnline.state.activeRoute="MAIN L/R");
       tx("ROUTING","route","MAIN L/R");notify((b.dataset.route||"ROUTE")+" OFF",false);
     }else notify((b.dataset.route||"ROUTE")+" ON",true);
     b.dataset.lowerWasActive=on?"1":"0";
   },0));
   b.addEventListener("pointerdown",()=>{b.dataset.lowerWasActive=b.classList.contains("indicator-active")?"1":"0"});
 });
 p.querySelectorAll(".usb-route-btn").forEach(b=>{
   b.addEventListener("click",e=>setTimeout(()=>{
     const n=Number(b.dataset.usb),was=b.dataset.lowerUsbActive==="1";
     if(was){
       b.classList.remove("indicator-active");b.setAttribute("aria-pressed","false");setLamp(b,false);
       tx("USB "+n,"select",0);notify("USB "+n+" OFF",false);
     }else notify("USB "+n+" ON",true);
     b.dataset.lowerUsbActive=b.classList.contains("indicator-active")?"1":"0";
   },0));
   b.addEventListener("pointerdown",()=>{b.dataset.lowerUsbActive=b.classList.contains("indicator-active")?"1":"0"});
 });

 // FX controls: values are transmitted continuously; zero is OFF.
 ["fxDelay","fxFeedback","fxWet"].forEach(id=>{
   const x=p.querySelector("#"+id);if(!x)return;
   x.addEventListener("change",()=>{const v=Number(x.value)||0;notify("FX 1 "+id.replace("fx","").toUpperCase()+" "+(v>0?"ON":"OFF")+" • "+v,v>0)});
 });
 ["fxType","fxPreset"].forEach(id=>p.querySelector("#"+id)?.addEventListener("change",()=>notify("FX 1 "+id.replace("fx","").toUpperCase()+" ON",true)));

 // Output routing: MAIN L/R = OFF, other destinations = ON.
 p.querySelectorAll(".routing-block select").forEach((s,i)=>s.addEventListener("change",()=>{
   const on=s.value!=="MAIN L/R";s.classList.toggle("indicator-active",on);notify("OUT "+(i+1)+" "+(on?"ON":"OFF")+" → "+s.value,on);
 }));

 // Scenes: add deterministic notification feedback without changing existing save/recall implementation.
 p.querySelectorAll(".scene-row button").forEach(b=>b.addEventListener("click",()=>setTimeout(()=>{
   const t=b.textContent.trim();if(t==="SAVE"||t==="RECALL"||t==="RENAME"||t==="DUPLICATE"||t==="DELETE"||t==="EXPORT"||t==="IMPORT"||t.includes("UNDO")||t.includes("REDO"))notify("SCENE "+t.replace("↶ ","").replace("↷ ","").toUpperCase(),true);
 },0)));

 // Lock: visual state and notification.
 p.querySelector(".lock-row button")?.addEventListener("click",()=>setTimeout(()=>{
   const on=document.body.classList.contains("mixer-locked"),b=p.querySelector(".lock-row button");setLamp(b,on);notify(on?"LIVE PROTECTION ON • CONTROLS LOCKED":"LIVE PROTECTION OFF • CONTROLS UNLOCKED",on);
 },0));

 // Device connection: synchronize both buttons and status labels.
 p.querySelector("#deviceConnect")?.addEventListener("click",()=>setTimeout(()=>{
   const on=window.MixerAdapters?.active?.connected===true;
   setLamp(p.querySelector("#deviceConnect"),on);setLamp(p.querySelector("#deviceDisconnect"),!on);
   const line=p.querySelector(".device-online");if(line)line.innerHTML=(on?"● ESP32 SIMULATOR — RX/TX AKTIF":"● ESP32 SIMULATOR — OFFLINE");
   notify(on?"ESP32 CONNECTED • RX/TX ACTIVE":"ESP32 OFF",on);
 },30));
 p.querySelector("#deviceDisconnect")?.addEventListener("click",()=>setTimeout(()=>{setLamp(p.querySelector("#deviceConnect"),false);setLamp(p.querySelector("#deviceDisconnect"),true);notify("ESP32 DISCONNECTED",false)},30));

 // Mapper buttons: actual build is owned by app.js; this only confirms the resulting state.
 p.querySelector(".mapper-row button:nth-of-type(1)")?.addEventListener("click",()=>setTimeout(()=>notify("CHANNELS APPLIED • "+(p.querySelector(".mapper-row input")?.value||16),true),30));
 p.querySelector(".mapper-row button:nth-of-type(2)")?.addEventListener("click",()=>setTimeout(()=>notify("CONTROLS AUTO MAPPED",true),30));

 // Hardware test / simulator / USB audio.
 p.querySelector(".hardware-test button")?.addEventListener("click",()=>setTimeout(()=>notify("HARDWARE TEST SENT",true),30));
 p.querySelector("#restartSimulator")?.addEventListener("click",()=>setTimeout(()=>{
   const on=window.MixerAdapters?.active?.type==="simulator"&&window.MixerAdapters?.active?.connected===true;
   setLamp(p.querySelector("#restartSimulator"),on);notify(on?"ESP32 SIMULATOR ON • TX/RX READY":"ESP32 SIMULATOR OFF",on);
 },60));
 p.querySelector("#detectUsbAudio")?.addEventListener("click",()=>setTimeout(()=>{
   const on=!!window.MixerOnline?.state?.usbStream?.active;setLamp(p.querySelector("#detectUsbAudio"),on);
   const st=p.querySelector("#usbAudioStatus"),dt=p.querySelector("#usbAudioDetail");
   if(st)st.textContent=on?"● ONLINE":"● OFFLINE";
   if(dt&&!on)dt.textContent="USB audio input/output bridge • stopped";
   notify(on?"USB AUDIO ON • INPUT ACTIVE":"USB AUDIO OFF",on);
 },80));

 // Re-apply DCA audio whenever a channel level/gain changes.
 p.addEventListener("input",e=>{if(e.target.closest(".channel"))applyAudio()});
 document.addEventListener("mixer:notification",()=>syncState());
 syncState();applyAudio();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(install,120),{once:true});
else setTimeout(install,120);
window.addEventListener("load",()=>setTimeout(install,120));
})();