/* MAIF lower panel — final functional controller.
   Capture-phase controller intentionally owns ONLY .dca controls listed in the
   lower-panel request. Existing channel/master code is untouched. */
(function(){
"use strict";
const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
const P=()=>q(".dca");
const st=()=>window.MixerOnline?.state;
const say=(m,on=true)=>{try{window.mixerNotify?.(m)}catch{};document.dispatchEvent(new CustomEvent("mixer:notification",{detail:{message:m,on}}))};
const lamp=(b,on)=>{if(!b)return;b.classList.toggle("indicator-active",!!on);b.setAttribute("aria-pressed",on?"true":"false");let l=b.querySelector(":scope > .control-lamp");if(!l){l=document.createElement("i");l.className="control-lamp off";b.prepend(l)}l.classList.toggle("on",!!on);l.classList.toggle("off",!on)};
const send=(target,control,value)=>{try{return window.MixerControl?.setControl?.(target,control,value)}catch{return null}};
const locked=()=>!!window.__mixerLiveLocked;
function audioRefresh(){
 const s=st();if(!s)return;
 const ds=s.dcaSolo||new Set(), ms=s.muteGroups||new Set(), ss=s.solo||new Set();
 const anyD=ds.size>0, anyS=ss.size>0;
 (s.channels||[]).forEach(c=>{
   const n=Number(c.dataset.channel),g=Math.floor((n-1)/4)+1;
   const f=Number(c.querySelector(".fader")?.value||0)/100;
   const gain=Number(c.querySelector(".gainKnob")?.dataset.value||1)/2;
   const mute=c.classList.contains("muted")||ms.has(g);
   const allowedD=!anyD||ds.has(g),allowedS=!anyS||c.classList.contains("soloed");
   if(c._gain)c._gain.gain.value=(mute||!allowedD||!allowedS)?0:f*gain;
   c.classList.toggle("dca-soloed",ds.has(g));
 });
}
function dca(n,b){
 const s=st();if(!s)return;
 s.dcaSolo=s.dcaSolo||new Set();const on=!s.dcaSolo.has(n);
 on?s.dcaSolo.add(n):s.dcaSolo.delete(n);
 lamp(b,on);
 const sp=b.querySelector("span");if(sp)sp.textContent=on?"SOLO ON":"SOLO";
 qa(".channel").forEach(c=>{const ch=Number(c.dataset.channel),g=Math.floor((ch-1)/4)+1;c.classList.toggle("dca-soloed",on&&g===n)});
 send("DCA "+n,"solo",on?1:0);audioRefresh();say("DCA "+n+" SOLO "+(on?"ON":"OFF"),on);
}
function muteGroup(n,b){
 const s=st();if(!s)return;s.muteGroups=s.muteGroups||new Set();const on=!s.muteGroups.has(n);
 on?s.muteGroups.add(n):s.muteGroups.delete(n);lamp(b,on);
 const a=(n-1)*4+1;
 (s.channels||[]).filter(c=>{const x=Number(c.dataset.channel);return x>=a&&x<a+4}).forEach(c=>{
   c.classList.toggle("group-muted",on);c.classList.toggle("muted",on);
   c.querySelectorAll(".mute,.topmute").forEach(x=>x.textContent=on?"UNMUTE":"MUTE");
 });
 send("MUTE GROUP "+n,"mute",on?1:0);audioRefresh();say("MUTE GROUP "+n+" "+(on?"ON":"OFF"),on);
}
function dcaGroup(n,b){
 const s=st();if(!s)return;s.dcaGroups=s.dcaGroups||new Set();const on=!s.dcaGroups.has(n);
 on?s.dcaGroups.add(n):s.dcaGroups.delete(n);lamp(b,on);send("DCA GROUP "+n,"active",on?1:0);say("DCA GROUP "+n+" "+(on?"ON":"OFF"),on);
}
function autoMix(b){
 const on=!b.classList.contains("indicator-active");lamp(b,on);send(b.id,"active",on?1:0);
 say((b.id==="autoMixActive"?"AUTO MIX ACTIVE":"AUTO MIX LAST GATE")+" "+(on?"ON":"OFF"),on);
}
function route(b){
 const was=b.classList.contains("indicator-active"),name=b.dataset.route||"ROUTE",on=!was;
 qa(".route-btn").forEach(x=>{if(x!==b)lamp(x,false)});
 lamp(b,on);const s=st();if(s)s.activeRoute=on?name:"MAIN L/R";
 send("ROUTING","route",on?name:"MAIN L/R");say(name+" "+(on?"ON":"OFF"),on);
}
function usb(b){
 const n=Number(b.dataset.usb);const on=!b.classList.contains("indicator-active");
 qa(".usb-route-btn").forEach(x=>{if(x!==b)lamp(x,false)});
 lamp(b,on);
 const ch=q("#musicChannel");if(ch&&on){ch.value="CH "+n;ch.dispatchEvent(new Event("change",{bubbles:true}))}
 send("USB "+n,"select",on?1:0);say("USB "+n+" "+(on?"ON":"OFF"),on);
}
function busFader(x,i){
 const v=Math.max(0,Math.min(100,Number(x.value)||0)),label=x.closest("label");label?.classList.toggle("active-level",v>0);
 let l=label?.querySelector(":scope > .control-lamp");if(label&&!l){l=document.createElement("i");l.className="control-lamp off";label.prepend(l)}
 l?.classList.toggle("on",v>0);l?.classList.toggle("off",v===0);
 if(!locked())send("BUS "+(i+1),"level",v);
}
function fx(id){
 const x=q("#"+id);if(!x)return;const v=Number(x.value)||0;const c=id.replace("fx","").toUpperCase();
 if(!locked())send("FX 1",c.toLowerCase(),v);
 say("FX 1 "+c+" "+(v>0?"ON":"OFF")+" • "+v,v>0);
}
const presets={VOCAL:{type:"reverb",delay:25,feedback:18,wet:35},"MC / SPEECH":{type:"delay",delay:18,feedback:12,wet:22},MUSIC:{type:"delay",delay:30,feedback:28,wet:30},HALL:{type:"reverb",delay:55,feedback:35,wet:48}};
function fxPreset(){
 const s=q("#fxPreset"),v=s?.value,p=presets[v];if(!p)return;
 const t=q("#fxType");if(t)t.value=p.type;
 [["fxDelay",p.delay],["fxFeedback",p.feedback],["fxWet",p.wet]].forEach(([id,n])=>{const x=q("#"+id);if(x){x.value=n;send("FX 1",id.slice(2).toLowerCase(),n)}});
 send("FX 1","preset",v);say("FX 1 PRESET "+v+" ON",true);
}
function output(s,i){
 const v=s.value,on=v!=="MAIN L/R";s.classList.toggle("indicator-active",on);s.setAttribute("aria-pressed",on?"true":"false");
 send("OUT "+(i+1),"route",v);say("OUT "+(i+1)+" "+(on?"ON":"OFF")+" → "+v,on);
}
function snapshot(){
 const s=st();return {channels:(s?.channels||[]).map(c=>({fader:Number(c.querySelector(".fader")?.value||0),gain:Number(c.querySelector(".gainKnob")?.dataset.value||1),muted:c.classList.contains("muted"),soloed:c.classList.contains("soloed")})),master:Number(q("#masterFader")?.value||80),dcaSolo:[...(s?.dcaSolo||[])],muteGroups:[...(s?.muteGroups||[])],dcaGroups:[...(s?.dcaGroups||[])],bus:qa(".bus-master input[type=range]").map(x=>Number(x.value)),fx:{preset:q("#fxPreset")?.value||"",type:q("#fxType")?.value||"delay",delay:Number(q("#fxDelay")?.value||0),feedback:Number(q("#fxFeedback")?.value||0),wet:Number(q("#fxWet")?.value||0)},routes:qa(".routing-block select").map(x=>x.value),activeRoute:s?.activeRoute||"MAIN L/R",savedAt:Date.now()};
}
function restore(o){
 const s=st();if(!o||!s)return false;s.dcaSolo=new Set(o.dcaSolo||[]);s.muteGroups=new Set(o.muteGroups||[]);s.dcaGroups=new Set(o.dcaGroups||[]);
 (s.channels||[]).forEach((c,i)=>{const v=o.channels?.[i];if(!v)return;const f=c.querySelector(".fader"),g=c.querySelector(".gainKnob");if(f){f.value=v.fader;f.dispatchEvent(new Event("input",{bubbles:true}))}if(g&&v.gain!=null){g.dataset.value=v.gain;g.dispatchEvent(new Event("input",{bubbles:true}))}c.classList.toggle("muted",!!v.muted);c.classList.toggle("soloed",!!v.soloed)});
 if(q("#masterFader")&&o.master!=null){q("#masterFader").value=o.master;q("#masterFader").dispatchEvent(new Event("input",{bubbles:true}))}
 qa(".dca-btn").forEach(b=>lamp(b,s.dcaSolo.has(Number(b.dataset.dca))));
 qa(".mute-groups button").forEach(b=>lamp(b,s.muteGroups.has(Number(b.dataset.group))));
 qa(".dca-groups button").forEach(b=>lamp(b,s.dcaGroups.has(Number(b.dataset.dcagroup))));
 qa(".bus-master input[type=range]").forEach((x,i)=>{if(o.bus?.[i]!=null)x.value=o.bus[i];busFader(x,i)});
 if(o.fx){if(q("#fxPreset"))q("#fxPreset").value=o.fx.preset||"";if(q("#fxType"))q("#fxType").value=o.fx.type||"delay";["fxDelay","fxFeedback","fxWet"].forEach((id,j)=>{const x=q("#"+id);if(x)x.value=[o.fx.delay,o.fx.feedback,o.fx.wet][j]??x.value})}
 qa(".routing-block select").forEach((x,i)=>{if(o.routes?.[i]!=null)x.value=o.routes[i];output(x,i)});
 audioRefresh();return true;
}
function scenes(){
 const p=P();if(!p||p.dataset.sceneFinal==="1")return;p.dataset.sceneFinal="1";
 const rows=[...p.querySelectorAll(".scene-row")],buttons=rows.flatMap(r=>[...r.querySelectorAll("button")]),input=p.querySelector(".scene-row input");
 const btn=t=>buttons.find(b=>b.textContent.trim()===t),name=()=>input?.value.trim()||"Scene";
 const undo=[],redo=[];
 btn("SAVE")?.addEventListener("click",e=>{e.stopImmediatePropagation();if(locked()){say("SCENE SAVE BLOCKED • LOCKED",false);return}localStorage.setItem("mixer-scene-"+name(),JSON.stringify(snapshot()));say("SCENE SAVED • "+name(),true)},true);
 btn("RECALL")?.addEventListener("click",e=>{e.stopImmediatePropagation();const n=name(),o=JSON.parse(localStorage.getItem("mixer-scene-"+n)||"null");if(!o){say("SCENE NOT FOUND • "+n,false);return}restore(o);say("SCENE RECALLED • "+n,true)},true);
 btn("RENAME")?.addEventListener("click",e=>{e.stopImmediatePropagation();const old=name(),n=prompt("Nama scene baru:",old);if(!n)return;const o=localStorage.getItem("mixer-scene-"+old);if(o)localStorage.setItem("mixer-scene-"+n,o);if(input)input.value=n;say("SCENE RENAMED • "+n,true)},true);
 btn("DUPLICATE")?.addEventListener("click",e=>{e.stopImmediatePropagation();const old=name(),n=old+" COPY",o=localStorage.getItem("mixer-scene-"+old);if(!o){say("SCENE NOT FOUND • "+old,false);return}localStorage.setItem("mixer-scene-"+n,o);if(input)input.value=n;say("SCENE DUPLICATED • "+n,true)},true);
 btn("DELETE")?.addEventListener("click",e=>{e.stopImmediatePropagation();const n=name();localStorage.removeItem("mixer-scene-"+n);say("SCENE DELETED • "+n,true)},true);
 btn("EXPORT")?.addEventListener("click",e=>{e.stopImmediatePropagation();const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name()+".json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);say("SCENE EXPORTED • "+name(),true)},true);
 let file=q("#mixerFinalImport");if(!file){file=document.createElement("input");file.type="file";file.accept=".json,application/json";file.hidden=true;file.id="mixerFinalImport";p.appendChild(file)}
 btn("IMPORT")?.addEventListener("click",e=>{e.stopImmediatePropagation();file.click()},true);
 file.addEventListener("change",async()=>{try{const o=JSON.parse(await file.files[0].text());restore(o);say("SCENE IMPORTED",true)}catch{say("IMPORT ERROR",false)}file.value=""});
 btn("↶ UNDO")?.addEventListener("click",e=>{e.stopImmediatePropagation();const o=undo.pop();if(!o){say("UNDO EMPTY",false);return}redo.push(snapshot());restore(o);say("UNDO ON",true)},true);
 btn("↷ REDO")?.addEventListener("click",e=>{e.stopImmediatePropagation();const o=redo.pop();if(!o){say("REDO EMPTY",false);return}undo.push(snapshot());restore(o);say("REDO ON",true)},true);
}
function install(){
 const p=P();if(!p||p.dataset.finalFunctional==="1")return;p.dataset.finalFunctional="1";
 // Capture phase stops the older toggle handlers from firing twice.
 p.addEventListener("click",e=>{
   const b=e.target.closest("button");if(!b||!p.contains(b))return;
   if(b.matches(".dca-btn")){e.preventDefault();e.stopImmediatePropagation();dca(Number(b.dataset.dca),b);return}
   if(b.matches(".mute-groups button")){e.preventDefault();e.stopImmediatePropagation();muteGroup(Number(b.dataset.group),b);return}
   if(b.matches(".auto-option")){e.preventDefault();e.stopImmediatePropagation();autoMix(b);return}
   if(b.matches(".dca-groups button")){e.preventDefault();e.stopImmediatePropagation();dcaGroup(Number(b.dataset.dcagroup),b);return}
   if(b.matches(".route-btn")){e.preventDefault();e.stopImmediatePropagation();route(b);return}
   if(b.matches(".usb-route-btn")){e.preventDefault();e.stopImmediatePropagation();usb(b);return}
 },true);
 p.addEventListener("input",e=>{const x=e.target;if(x.matches(".bus-master input[type=range]")){const i=qa(".bus-master input[type=range]").indexOf(x);busFader(x,i)}else if(["fxDelay","fxFeedback","fxWet"].includes(x.id))fx(x.id)},true);
 p.addEventListener("change",e=>{const x=e.target;if(x.id==="fxPreset"){e.stopImmediatePropagation();fxPreset()}else if(x.id==="fxType"){e.stopImmediatePropagation();send("FX 1","type",x.value);say("FX 1 TYPE "+String(x.value).toUpperCase()+" ON",true)}else if(x.matches(".routing-block select")){e.stopImmediatePropagation();output(x,qa(".routing-block select").indexOf(x))}},true);
 scenes();
 // Initial visual state.
 qa(".dca-btn,.mute-groups button,.dca-groups button,.route-btn,.usb-route-btn,.auto-option").forEach(b=>lamp(b,b.classList.contains("indicator-active")));
 qa(".bus-master input[type=range]").forEach((x,i)=>busFader(x,i));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(install,220),{once:true});else setTimeout(install,220);
window.addEventListener("load",()=>setTimeout(install,220));
})();