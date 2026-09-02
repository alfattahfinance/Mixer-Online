/* Dedicated 16CH channel renderer. UI/layout only; mixer engine untouched. */
(function(){
"use strict";
const N=16;
function state(){return window.state||(window.state={system:false,connected:false,channels:[]});}
function ensureChannels(){
 const st=state();
 while(st.channels.length<N) st.channels.push({id:st.channels.length+1,fader:75,gain:1,low:0,mid:0,high:0,pan:0,mute:false,solo:false,level:0});
 st.channels.length=N;
}
function make(id){
 const c=state().channels[id-1];
 const el=document.createElement("article"); el.className="new-channel-strip"; el.dataset.ch=String(id);
 el.innerHTML='<header class="new-channel-head">CH'+id+'</header>'+
 '<div class="led-meter new-channel-meter" data-ch="'+id+'"><span class="led-peak"></span><span class="led-segments">'+Array.from({length:12},()=>'<i></i>').join("")+'</span></div>'+
 '<div class="new-channel-control"><label>GAIN</label><input class="new-knob" data-k="gain" type="range" min="0" max="2" step=".01" value="'+c.gain+'"></div>'+
 '<div class="new-channel-control"><label>HIGH</label><input class="new-knob" data-k="high" type="range" min="-12" max="12" step="1" value="'+c.high+'"></div>'+
 '<div class="new-channel-control"><label>MID</label><input class="new-knob" data-k="mid" type="range" min="-12" max="12" step="1" value="'+c.mid+'"></div>'+
 '<div class="new-channel-control"><label>LOW</label><input class="new-knob" data-k="low" type="range" min="-12" max="12" step="1" value="'+c.low+'"></div>'+
 '<div class="new-channel-control"><label>PAN</label><input class="new-knob" data-k="pan" type="range" min="-1" max="1" step=".01" value="'+c.pan+'"></div>'+
 '<div class="new-channel-fader"><label>VOLUME</label><input class="new-fader" data-k="fader" type="range" min="0" max="100" step="1" value="'+c.fader+'"><output>'+c.fader+'%</output></div>'+
 '<div class="new-channel-buttons"><button type="button" data-k="mute">MUTE</button><button type="button" data-k="solo">SOLO</button></div>'+
 '<footer class="new-channel-source">CH'+id+' • <span>READY</span></footer>';
 el.querySelectorAll("input[data-k]").forEach(x=>x.addEventListener("input",()=>{const k=x.dataset.k,v=Number(x.value);state().channels[id-1][k]=v;if(k==="fader")el.querySelector("output").textContent=v+"%";if(window.MixerControl?.setControl && state().system)window.MixerControl.setControl(id,k,v);}));
 el.querySelectorAll("button[data-k]").forEach(b=>b.addEventListener("click",()=>{if(!state().system)return;const k=b.dataset.k,v=!state().channels[id-1][k];state().channels[id-1][k]=v;b.classList.toggle("on",v);b.textContent=v?(k==="mute"?"UNMUTE":"UNSOLO"):(k==="mute"?"MUTE":"SOLO");if(window.MixerControl?.setControl)window.MixerControl.setControl(id,k,v);el.querySelector("footer span").textContent=state().channels[id-1].mute?"MUTED":state().channels[id-1].solo?"SOLO":"READY";}));
 return el;
}
function build(){
 ensureChannels();
 const l=document.getElementById("channels"),r=document.getElementById("channelsRight");
 if(!l||!r)return false;
 l.replaceChildren();r.replaceChildren();
 for(let i=1;i<=N;i++)(i<=8?l:r).appendChild(make(i));
 return true;
}
window.buildNew16ChannelPanel=build;
window.syncNew16ChannelPanel=function(){ensureChannels();document.querySelectorAll(".new-channel-strip").forEach(el=>{const id=+el.dataset.ch,c=state().channels[id-1];if(!c)return;const f=el.querySelector('[data-k="fader"]'),o=el.querySelector("output");if(f)f.value=c.fader;if(o)o.textContent=c.fader+"%";["gain","high","mid","low","pan"].forEach(k=>{const x=el.querySelector('[data-k="'+k+'"]');if(x)x.value=c[k]});["mute","solo"].forEach(k=>{const b=el.querySelector('[data-k="'+k+'"]');if(b){b.classList.toggle("on",!!c[k]);b.textContent=c[k]?(k==="mute"?"UNMUTE":"UNSOLO"):(k==="mute"?"MUTE":"SOLO")}});});};
function boot(){build();window.syncNew16ChannelPanel();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();