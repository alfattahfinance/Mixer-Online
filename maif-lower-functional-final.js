/* MAIF CONTROL EXPANSION v16 — DCA/MUTE/DCA GROUP 1-16 + HISTORY + LOCK + MAPPER.
   Scoped to the MAIF .dca panel only. */
(function(){
"use strict";
const Q=s=>document.querySelector(s), QA=s=>[...document.querySelectorAll(s)];
const panel=()=>Q(".dca"), state=()=>window.MixerOnline?.state;
const notify=(m,on=true)=>{try{window.mixerNotify?.(m)}catch{};document.dispatchEvent(new CustomEvent("mixer:notification",{detail:{message:m,on}}))};
const setOn=(b,on)=>{if(!b)return;b.classList.toggle("indicator-active",!!on);b.setAttribute("aria-pressed",on?"true":"false");b.dataset.on=on?"1":"0";let l=b.querySelector(":scope > .control-lamp");if(!l){l=document.createElement("i");l.className="control-lamp off";b.prepend(l)}l.classList.toggle("on",!!on);l.classList.toggle("off",!on)};
const send=(target,control,value)=>{try{return window.MixerControl?.setControl?.(target,control,value)}catch{return null}};
const isLocked=()=>!!window.__mixerLiveLocked;

function ensureSets(){
 const s=state();if(!s)return null;
 s.dcaSolo ||= new Set(); s.muteGroups ||= new Set(); s.dcaGroups ||= new Set();
 return s;
}
function channel(n){
 const s=state(); return s?.channels?.find(c=>Number(c.dataset.channel)===n)||Q('#channels .channel:nth-child('+n+')');
}
function refreshAudio(){
 const s=ensureSets();if(!s)return;
 const ds=s.dcaSolo, mg=s.muteGroups, dg=s.dcaGroups;
 (s.channels||[]).forEach(c=>{
   const n=Number(c.dataset.channel);
   const dcaSolo=ds.has(n);
   // This mixer has 16 channels: DCA/Mute/DCA Group N maps directly to CH N.
   const muted=mg.has(n)||c.classList.contains("muted");
   c.classList.toggle("dca-soloed",dcaSolo);
   c.classList.toggle("group-muted",mg.has(n));
   c.dataset.dcaGroup=dg.has(n)?"1":"0";
   if(c._gain){
     const anySolo=ds.size>0;
     const audible=(!muted)&&(!anySolo||dcaSolo);
     const f=Number(c.querySelector(".fader")?.value||0)/100;
     const g=Number(c.querySelector(".gainKnob")?.dataset.value||1)/2;
     c._gain.gain.value=audible?f*g:0;
   }
 });
}
function render(){
 const p=panel(),s=ensureSets();if(!p||!s)return;
 p.querySelectorAll(".dca-btn").forEach(b=>setOn(b,s.dcaSolo.has(Number(b.dataset.dca))));
 p.querySelectorAll(".mute-groups button").forEach(b=>setOn(b,s.muteGroups.has(Number(b.dataset.group))));
 p.querySelectorAll(".dca-groups button").forEach(b=>setOn(b,s.dcaGroups.has(Number(b.dataset.dcagroup))));
 const lock=p.querySelector(".lock-row button"); if(lock){lock.textContent=isLocked()?"🔓 UNLOCK":"🔒 LOCK";setOn(lock,isLocked())}
}
function make16(selector,attr,label){
 const p=panel(),box=p?.querySelector(selector);if(!box)return;
 box.replaceChildren();
 for(let i=1;i<=16;i++){
   const b=document.createElement("button");b.className=label;b.setAttribute(attr,String(i));b.type="button";
   if(label==="dca-btn")b.innerHTML="DCA "+i+"<br><span>SOLO</span><br><output>0.0</output>";
   else b.textContent=String(i);
   box.appendChild(b);
 }
}
function snapshot(){
 const s=ensureSets(),p=panel();if(!s||!p)return null;
 return {dca:[...s.dcaSolo],mute:[...s.muteGroups],groups:[...s.dcaGroups],
  mapped:(s.channels||[]).map(c=>({n:Number(c.dataset.channel),mute:c.classList.contains("muted"),solo:c.classList.contains("soloed"),dca:c.classList.contains("dca-soloed"),gm:c.classList.contains("group-muted")})),
  auto:{active:!!Q("#autoMixActive")?.classList.contains("indicator-active"),last:!!Q("#autoMixLastGate")?.classList.contains("indicator-active")},
  count:Number(p.querySelector(".mapper-row input[type=number]")?.value||s.channelCount||16)};
}
function restore(o){
 const s=ensureSets(),p=panel();if(!s||!o)return;
 s.dcaSolo=new Set(o.dca||[]);s.muteGroups=new Set(o.mute||[]);s.dcaGroups=new Set(o.groups||[]);
 (s.channels||[]).forEach(c=>{const v=o.mapped?.find(x=>x.n===Number(c.dataset.channel));if(v){c.classList.toggle("muted",!!v.mute);c.classList.toggle("soloed",!!v.solo)}});
 if(Q("#autoMixActive"))setOn(Q("#autoMixActive"),!!o.auto?.active);
 if(Q("#autoMixLastGate"))setOn(Q("#autoMixLastGate"),!!o.auto?.last);
 render();refreshAudio();
}
const history={undo:[],redo:[],busy:false};
function pushHistory(){
 if(history.busy)return;const o=snapshot();if(!o)return;
 history.undo.push(o);if(history.undo.length>50)history.undo.shift();history.redo.length=0;
}
function undo(){
 const current=snapshot(),o=history.undo.pop();if(!o){notify("HISTORY • UNDO KOSONG",false);return}
 history.busy=true;history.redo.push(current);restore(o);history.busy=false;notify("HISTORY • UNDO",true);
}
function redo(){
 const current=snapshot(),o=history.redo.pop();if(!o){notify("HISTORY • REDO KOSONG",false);return}
 history.busy=true;history.undo.push(current);restore(o);history.busy=false;notify("HISTORY • REDO",true);
}
function toggleDca(n,b){
 if(isLocked()){notify("LIVE PROTECTION • DCA "+n+" TERKUNCI",false);return}
 pushHistory();const s=ensureSets(),on=!s.dcaSolo.has(n);on?s.dcaSolo.add(n):s.dcaSolo.delete(n);
 setOn(b,on);send("DCA "+n,"solo",on?1:0);refreshAudio();notify("DCA "+n+" SOLO "+(on?"ON":"OFF"),on);
}
function toggleMute(n,b){
 if(isLocked()){notify("LIVE PROTECTION • MUTE GROUP "+n+" TERKUNCI",false);return}
 pushHistory();const s=ensureSets(),on=!s.muteGroups.has(n);on?s.muteGroups.add(n):s.muteGroups.delete(n);
 const c=channel(n);c?.classList.toggle("group-muted",on);c?.classList.toggle("muted",on);
 setOn(b,on);send("MUTE GROUP "+n,"mute",on?1:0);refreshAudio();notify("MUTE GROUP "+n+" "+(on?"ON":"OFF"),on);
}
function toggleDcaGroup(n,b){
 if(isLocked()){notify("LIVE PROTECTION • DCA GROUP "+n+" TERKUNCI",false);return}
 pushHistory();const s=ensureSets(),on=!s.dcaGroups.has(n);on?s.dcaGroups.add(n):s.dcaGroups.delete(n);
 const c=channel(n);if(c)c.dataset.dcaGroup=on?"1":"0";
 setOn(b,on);send("DCA GROUP "+n,"active",on?1:0);notify("DCA GROUP "+n+" "+(on?"ON":"OFF"),on);
}
function autoToggle(b){
 if(isLocked()){notify("LIVE PROTECTION • AUTO MIX TERKUNCI",false);return}
 pushHistory();const on=!b.classList.contains("indicator-active");setOn(b,on);
 send(b.id,"active",on?1:0);notify((b.id==="autoMixActive"?"AUTO MIX ACTIVE":"AUTO MIX LAST GATE")+" "+(on?"ON":"OFF"),on);
}
function mapper(){
 const p=panel(),input=p?.querySelector(".mapper-row input[type=number]");if(!p||!input)return;
 if(isLocked()){notify("LIVE PROTECTION • CHANNEL MAPPER TERKUNCI",false);return}
 const n=Math.max(1,Math.min(16,Number(input.value)||16));pushHistory();
 const ok=!!window.MixerOnline?.buildChannels?.(n);if(!ok){notify("AUTO CHANNEL MAPPER • GAGAL APPLY",false);return}
 state().channels.forEach((c,i)=>c.dataset.mapped="1");
 notify("AUTO CHANNEL MAPPER • "+n+" / 16 CHANNELS APPLIED",true);refreshAudio();
}
function autoMap(){
 const p=panel(),s=ensureSets();if(!p||!s)return;
 if(isLocked()){notify("LIVE PROTECTION • AUTO MAP TERKUNCI",false);return}
 pushHistory();s.channels.forEach((c,i)=>{c.dataset.mapped="1";c.dataset.autoMapped="1";c.querySelectorAll("input,select").forEach(x=>x.dataset.autoMapped="1")});
 setOn(p.querySelector(".mapper-row button:nth-of-type(2)"),true);notify("AUTO CHANNEL MAPPER • CONTROLS MAPPED",true);
}
function install(){
 const p=panel();if(!p||p.dataset.v16==="1")return;p.dataset.v16="1";
 make16(".dca-grid","data-dca","dca-btn");make16(".mute-groups","data-group","mute-btn");make16(".dca-groups","data-dcagroup","dca-group-btn");
 // Normalize classes so the existing CSS remains intact.
 QA(".mute-groups button").forEach(b=>b.classList.add("group-btn"));
 QA(".dca-groups button").forEach(b=>b.classList.add("group-btn"));
 render();
 p.addEventListener("click",e=>{
   const b=e.target.closest("button");if(!b||!p.contains(b))return;
   if(b.matches(".dca-btn")){e.preventDefault();e.stopImmediatePropagation();toggleDca(Number(b.dataset.dca),b);return}
   if(b.matches(".mute-groups button")){e.preventDefault();e.stopImmediatePropagation();toggleMute(Number(b.dataset.group),b);return}
   if(b.matches(".dca-groups button")){e.preventDefault();e.stopImmediatePropagation();toggleDcaGroup(Number(b.dataset.dcagroup),b);return}
   if(b.matches(".auto-option")){e.preventDefault();e.stopImmediatePropagation();autoToggle(b);return}
   const txt=b.textContent.trim();
   if(txt==="↶ UNDO"){e.preventDefault();e.stopImmediatePropagation();undo();return}
   if(txt==="↷ REDO"){e.preventDefault();e.stopImmediatePropagation();redo();return}
   if(b.matches(".lock-row button")){e.preventDefault();e.stopImmediatePropagation();const on=!isLocked();window.__mixerLiveLocked=on;document.body.classList.toggle("mixer-locked",on);try{localStorage.setItem("mixer-live-locked",on?"1":"0")}catch{}render();notify(on?"LIVE PROTECTION ON • CONTROLS LOCKED":"LIVE PROTECTION OFF • CONTROLS UNLOCKED",on);return}
   if(b.matches(".mapper-row button:nth-of-type(1)")){e.preventDefault();e.stopImmediatePropagation();mapper();return}
   if(b.matches(".mapper-row button:nth-of-type(2)")){e.preventDefault();e.stopImmediatePropagation();autoMap();return}
 },true);
 // Capture before normal changes so history has a real previous state.
 p.addEventListener("pointerdown",e=>{const b=e.target.closest("button");if(!b||!p.contains(b))return;if(b.matches(".dca-btn,.mute-groups button,.dca-groups button,.auto-option,.lock-row button,.mapper-row button"))return;},true);
 try{window.__mixerLiveLocked=localStorage.getItem("mixer-live-locked")==="1"}catch{}
 render();refreshAudio();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(install,180),{once:true});else setTimeout(install,180);
window.addEventListener("load",()=>setTimeout(install,180));
})();