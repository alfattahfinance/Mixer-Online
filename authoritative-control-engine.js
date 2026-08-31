/* Mixer Online — authoritative functional control engine.
   One source of truth for the lower control panel. 16 channels, real state,
   WebAudio gain/mute/solo application, adapter TX and notifications. */
(()=>{"use strict";
if(window.__authoritativeMixerControls)return;window.__authoritativeMixerControls=true;
const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
const st=()=>window.MixerOnline?.state;
const notify=(m,on=true)=>{try{window.mixerNotify?.(m)}catch{};try{window.dispatchEvent(new CustomEvent("mixer:notification",{detail:{message:m,on}}))}catch{};const e=q("#playerState");if(e&&/ON|OFF|LOCK|UNLOCK|ERROR|SAVED|RECALL|UNDO|REDO|MAPPER/.test(m))e.textContent=m};
const send=(ch,control,value)=>{try{return window.MixerControl?.setControl?.(ch,control,value)}catch(e){return{ok:false,reason:e.message}}};
const locked=()=>!!window.__mixerLiveLocked;
const lamp=(b,on)=>{if(!b)return;b.classList.toggle("indicator-active",!!on);b.setAttribute("aria-pressed",on?"true":"false");b.dataset.on=on?"1":"0";let l=b.querySelector(":scope > .control-lamp");if(!l){l=document.createElement("i");l.className="control-lamp off";b.prepend(l)}l.classList.toggle("on",!!on);l.classList.toggle("off",!on)};
const channel=n=>st()?.channels?.[n-1]||null;
const refresh=()=>{const s=st();if(!s)return;s.channels.forEach(c=>{const n=Number(c.dataset.channel);const f=Number(c.querySelector(".fader")?.value||0)/100,g=Number(c.querySelector(".gainKnob")?.dataset.value||1)/2;const mute=c.classList.contains("muted")||s.muteGroups?.has(n);const solo=c.classList.contains("soloed"),dca=s.dcaSolo?.has(n);const level=(mute||(s.solo?.size&& !solo)||(s.dcaSolo?.size&&!dca))?0:f*g;if(c._gain)c._gain.gain.value=level;c.classList.toggle("muted-by-group",!!s.muteGroups?.has(n));c.classList.toggle("dca-soloed",!!dca);c.querySelectorAll(".mute,.topmute").forEach(b=>{if(s.muteGroups?.has(n))b.textContent="UNMUTE"})});try{window.MixerOnline?.updateMeters?.()}catch{}};
function sets(s){s.dcaSolo??=new Set();s.muteGroups??=new Set();s.dcaGroups??=new Set();s.solo??=new Set()}
const hist={u:[],r:[],busy:false};
function snap(){const s=st();if(!s)return null;return {d:[...s.dcaSolo],m:[...s.muteGroups],g:[...s.dcaGroups],solo:[...s.solo],ch:s.channels.map(c=>({f:Number(c.querySelector(".fader")?.value||0),gain:Number(c.querySelector(".gainKnob")?.dataset.value||1),pan:Number(c.querySelector(".panKnob")?.dataset.value||0),mute:c.classList.contains("muted"),soloed:c.classList.contains("soloed")})),route:s.activeRoute||"MAIN L/R",autoActive:q("#autoMixActive")?.classList.contains("indicator-active"),lastGate:q("#autoMixLastGate")?.classList.contains("indicator-active")}};
function restore(o){const s=st();if(!s||!o)return;sets(s);s.dcaSolo=new Set(o.d||[]);s.muteGroups=new Set(o.m||[]);s.dcaGroups=new Set(o.g||[]);s.solo=new Set(o.solo||[]);s.channels.forEach((c,i)=>{const v=o.ch?.[i];if(!v)return;const f=c.querySelector(".fader"),g=c.querySelector(".gainKnob"),p=c.querySelector(".panKnob");if(f){f.value=v.f;f.dispatchEvent(new Event("input",{bubbles:true}))}if(g)g.dataset.value=v.gain;if(p)p.dataset.value=v.pan;c.classList.toggle("muted",!!v.mute);c.classList.toggle("soloed",!!v.soloed)});s.activeRoute=o.route||"MAIN L/R";if(q("#autoMixActive"))lamp(q("#autoMixActive"),!!o.autoActive);if(q("#autoMixLastGate"))lamp(q("#autoMixLastGate"),!!o.lastGate);qa(".dca-btn").forEach(b=>lamp(b,s.dcaSolo.has(Number(b.dataset.dca))));qa(".mute-groups button").forEach(b=>lamp(b,s.muteGroups.has(Number(b.dataset.group))));qa(".dca-groups button").forEach(b=>lamp(b,s.dcaGroups.has(Number(b.dataset.dcagroup))));refresh()}
function push(){if(hist.busy)return;const x=snap();if(x){hist.u.push(x);if(hist.u.length>50)hist.u.shift();hist.r=[]}}
function undo(){const x=hist.u.pop();if(!x){notify("HISTORY • UNDO KOSONG",false);return}const cur=snap();hist.r.push(cur);hist.busy=true;restore(x);hist.busy=false;notify("HISTORY • UNDO",true)}
function redo(){const x=hist.r.pop();if(!x){notify("HISTORY • REDO KOSONG",false);return}const cur=snap();hist.u.push(cur);hist.busy=true;restore(x);hist.busy=false;notify("HISTORY • REDO",true)}
function dca(n,b){const s=st();if(!s||n<1||n>16)return;if(locked()){notify("LIVE PROTECTION • DCA "+n+" TERKUNCI",false);return}sets(s);push();const on=!s.dcaSolo.has(n);on?s.dcaSolo.add(n):s.dcaSolo.delete(n);lamp(b,on);const c=channel(n);c?.classList.toggle("dca-soloed",on);send("CH "+n,"solo",on?1:0);refresh();notify("DCA "+n+" SOLO "+(on?"ON":"OFF"),on)}
function mute(n,b){const s=st();if(!s||n<1||n>16)return;if(locked()){notify("LIVE PROTECTION • MUTE GROUP "+n+" TERKUNCI",false);return}sets(s);push();const on=!s.muteGroups.has(n);on?s.muteGroups.add(n):s.muteGroups.delete(n);lamp(b,on);const c=channel(n);if(c){c.classList.toggle("muted",on);c.querySelectorAll(".mute,.topmute").forEach(x=>x.textContent=on?"UNMUTE":"MUTE")}send("CH "+n,"mute",on?1:0);refresh();notify("MUTE GROUP "+n+" "+(on?"ON":"OFF"),on)}
function dgroup(n,b){const s=st();if(!s||n<1||n>16)return;if(locked()){notify("LIVE PROTECTION • DCA GROUP "+n+" TERKUNCI",false);return}sets(s);push();const on=!s.dcaGroups.has(n);on?s.dcaGroups.add(n):s.dcaGroups.delete(n);lamp(b,on);send("CH "+n,"dcaGroup",on?1:0);notify("DCA GROUP "+n+" "+(on?"ON":"OFF"),on)}
function auto(b){if(locked()){notify("LIVE PROTECTION • AUTO MIX TERKUNCI",false);return}push();const on=!b.classList.contains("indicator-active");lamp(b,on);send(b.id,"active",on?1:0);notify((b.id==="autoMixActive"?"AUTO MIX ACTIVE":"AUTO MIX LAST GATE")+" "+(on?"ON":"OFF"),on)}
function route(b){if(locked()){notify("LIVE PROTECTION • ROUTING TERKUNCI",false);return}const on=!b.classList.contains("indicator-active");qa(".route-btn").forEach(x=>{if(x!==b)lamp(x,false)});lamp(b,on);const s=st();if(s)s.activeRoute=on?(b.dataset.route||"BUS 1"):"MAIN L/R";send("ROUTING","route",on?(b.dataset.route||"BUS 1"):"MAIN L/R");notify((b.dataset.route||"ROUTE")+" "+(on?"ON":"OFF"),on)}
function usb(b){if(locked()){notify("LIVE PROTECTION • USB TERKUNCI",false);return}const n=Number(b.dataset.usb),on=!b.classList.contains("indicator-active");qa(".usb-route-btn").forEach(x=>{if(x!==b)lamp(x,false)});lamp(b,on);if(on){const ch=q("#musicChannel");if(ch){ch.value="CH "+n;ch.dispatchEvent(new Event("change",{bubbles:true}))}}send("USB "+n,"select",on?1:0);notify("USB "+n+" "+(on?"ON":"OFF"),on)}
function lock(b){const on=!locked();window.__mixerLiveLocked=on;document.body.classList.toggle("mixer-locked",on);try{localStorage.setItem("mixer-online-live-lock",on?"1":"0")}catch{}lamp(b,on);b.textContent=on?"🔓 UNLOCK":"🔒 LOCK";notify(on?"LIVE PROTECTION ON • CONTROLS LOCKED":"LIVE PROTECTION OFF • CONTROLS UNLOCKED",on)}
function mapper(autoMap=false){if(locked()){notify("LIVE PROTECTION • AUTO CHANNEL MAPPER TERKUNCI",false);return}push();const s=st();if(!s)return;if(typeof window.MixerOnline?.buildChannels==="function")window.MixerOnline.buildChannels(16);if(autoMap)s.channels.forEach((c,i)=>{c.dataset.autoMapped="1";c.dataset.mapped="1"});const input=q(".mapper-row input[type=number]");if(input)input.value=16;notify("AUTO CHANNEL MAPPER • 16 CHANNELS "+(autoMap?"MAPPED":"APPLIED"),true)}
function scene(action){
 const input=q(".scene-row input"),name=input?.value?.trim()||"Scene",key="mixer-scene-"+name;
 if(action==="SAVE"){if(locked()){notify("SCENE SAVE BLOCKED • LOCKED",false);return}localStorage.setItem(key,JSON.stringify(snap()));notify("SCENE SAVED • "+name,true)}
 else if(action==="RECALL"){const x=JSON.parse(localStorage.getItem(key)||"null");if(!x){notify("SCENE NOT FOUND • "+name,false);return}restore(x);notify("SCENE RECALLED • "+name,true)}
 else if(action==="DUPLICATE"){const x=localStorage.getItem(key);if(!x){notify("SCENE NOT FOUND • "+name,false);return}const n=name+" COPY";localStorage.setItem("mixer-scene-"+n,x);if(input)input.value=n;notify("SCENE DUPLICATED • "+n,true)}
 else if(action==="DELETE"){localStorage.removeItem(key);notify("SCENE DELETED • "+name,true)}
 else if(action==="EXPORT"){const a=document.createElement("a"),u=URL.createObjectURL(new Blob([JSON.stringify(snap(),null,2)],{type:"application/json"}));a.href=u;a.download=name+".json";a.click();setTimeout(()=>URL.revokeObjectURL(u),500);notify("SCENE EXPORTED • "+name,true)}
}
function handle(e){const t=e.target,b=t.closest?.("button");if(!b)return;
 const p=b.closest(".dca");if(!p)return;
 let handled=false;
 if(b.matches(".dca-btn")){return}
 else if(b.matches(".mute-groups button")){mute(Number(b.dataset.group),b);handled=true}
 else if(b.matches(".dca-groups button")){dgroup(Number(b.dataset.dcagroup),b);handled=true}
 else if(b.matches(".auto-option")){auto(b);handled=true}
 else if(b.matches(".route-btn")){route(b);handled=true}
 else if(b.matches(".usb-route-btn")){usb(b);handled=true}
 else if(b.matches(".lock-row button")){lock(b);handled=true}
 else if(b.matches(".mapper-row button")){mapper(b.textContent.toUpperCase().includes("AUTO"));handled=true}
 else if(b.closest(".scene-row")){const a=b.textContent.trim().toUpperCase();if(["SAVE","RECALL","DUPLICATE","DELETE","EXPORT"].includes(a)){scene(a);handled=true}}
 else if(/^↶\s*UNDO$/i.test(b.textContent.trim())){undo();handled=true}
 else if(/^↷\s*REDO$/i.test(b.textContent.trim())){redo();handled=true}
 if(handled){e.preventDefault();e.stopImmediatePropagation()}}
function boot(){
 try{window.__mixerLiveLocked=localStorage.getItem("mixer-online-live-lock")==="1"}catch{}
 document.addEventListener("pointerup",handle,true);
 document.addEventListener("mixer:state-changed",refresh);
 const s=st();if(s)sets(s);
 qa(".dca-btn").forEach(b=>{
   const n=Number(b.dataset.dca);
   lamp(b,st()?.dcaSolo?.has(n));
   if(b.dataset.authoritativeDcaBound==="1") return;
   b.dataset.authoritativeDcaBound="1";
   b.addEventListener("click",e=>{
     e.preventDefault();
     e.stopPropagation();
     dca(n,b);
   });
 });
 qa(".mute-groups button").forEach(b=>lamp(b,st()?.muteGroups?.has(Number(b.dataset.group))));
 qa(".dca-groups button").forEach(b=>lamp(b,st()?.dcaGroups?.has(Number(b.dataset.dcagroup))));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,350),{once:true});else setTimeout(boot,350);
})();