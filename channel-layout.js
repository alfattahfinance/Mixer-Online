/* Mixer-Online — dedicated 16CH channel layout bootstrap.
   This file only ensures the channel DOM is rendered into its two visual banks.
   It does not own or modify mixer state, controls, transport, or engine logic. */
(function(){
  "use strict";

  function placeChannels(){
    const left=document.getElementById("channels");
    const right=document.getElementById("channelsRight");
    if(!left||!right)return;

    /* Use the existing mixer renderer; do not recreate channel controls here. */
    if(typeof window.renderMixerChannels==="function"){
      window.renderMixerChannels();
    }

    /* Defensive placement: only DOM placement, never channel values/state. */
    const cards=document.querySelectorAll(".channel-bank .channel");
    cards.forEach(card=>{
      const ch=Number(card.dataset.ch);
      const target=ch>=1&&ch<=8?left:ch>=9&&ch<=16?right:null;
      if(!target)return;
      if(card.parentElement!==target)target.appendChild(card);
    });
  }

  function boot(){
    placeChannels();
    requestAnimationFrame(placeChannels);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot,{once:true});
  }else{
    boot();
  }
  window.addEventListener("pageshow",placeChannels);
})();
