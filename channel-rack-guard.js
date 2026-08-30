/* Channel rack emergency boot guard.
   This file never replaces a working rack. It only restores CH1-CH16 if the
   main controller failed to initialize the dynamic rack. */
(function(){
  "use strict";
  function send(ch,control,value){
    try{
      const r=window.MixerControl?.setControl?.("CH "+ch,control,value);
      if(r?.then)r.catch(()=>{});
    }catch(e){}
  }
  function buildFallback(){
    const box=document.getElementById("channels");
    if(!box || box.querySelector(".channel")) return;
    const frag=document.createDocumentFragment();
    for(let n=1;n<=16;n++){
      const c=document.createElement("article");
      c.className="channel";
      c.dataset.channel=n;
      const initial=n===1?80:0;
      c.innerHTML='<div class="ch-head"><span>CH '+n+'</span><i></i></div>'+
        '<button class="ch-btn topmute">MUTE</button><button class="ch-btn solo">SOLO</button>'+
        '<output class="value">'+initial+'%</output>'+
        '<div class="knobs"><div><div class="knob gainKnob" data-value="1"></div><small>GAIN</small></div>'+
        '<div><div class="knob panKnob" data-value="0"></div><small>PAN</small></div></div>'+
        '<div class="fader-wrap"><div class="scale-y"><span>10</span><span>5</span><span>0</span><span>-5</span><span>-10</span><span>-20</span><span>-30</span><span>-40</span><span>-60</span><span>-∞</span></div>'+
        '<input class="fader ch-fader" type="range" min="0" max="100" value="'+initial+'"><div class="ch-lamp"></div></div>'+
        '<div class="ch-bottom"><button class="ch-btn mute">MUTE</button><div class="label">CH '+n+'</div><div class="status">'+(n===1?'LIVE':'READY')+'</div></div>';
      const f=c.querySelector(".fader");
      f.addEventListener("input",()=>{c.querySelector(".value").textContent=Math.round(f.value)+"%";send(n,"fader",Number(f.value));});
      c.querySelectorAll(".mute,.topmute").forEach(b=>b.addEventListener("click",()=>{
        const on=!c.classList.contains("muted");c.classList.toggle("muted",on);
        c.querySelectorAll(".mute,.topmute").forEach(x=>x.textContent=on?"UNMUTE":"MUTE");
        send(n,"mute",on?1:0);
      }));
      c.querySelector(".solo").addEventListener("click",()=>{
        const on=!c.classList.contains("soloed");c.classList.toggle("soloed",on);send(n,"solo",on?1:0);
      });
      frag.appendChild(c);
    }
    box.appendChild(frag);
  }
  function repair(){
    try{
      if(window.MixerOnline?.ensureChannels) window.MixerOnline.ensureChannels();
      if(!document.querySelector("#channels .channel")) buildFallback();
    }catch(e){
      buildFallback();
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",repair,{once:true});
  else repair();
  window.addEventListener("load",repair);
  setTimeout(repair,250);
  setTimeout(repair,1000);
})();
