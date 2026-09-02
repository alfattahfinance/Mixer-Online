/* Dedicated 16CH visual render safeguard.
   Layout/DOM only. It delegates channel creation to the existing mixer renderer. */
(function(){
  "use strict";
  function ensure(){
    const left=document.getElementById("channels");
    const right=document.getElementById("channelsRight");
    if(!left||!right)return;
    const cards=document.querySelectorAll("#channels .channel,#channelsRight .channel");
    if(cards.length!==16 && typeof window.renderMixerChannels==="function"){
      window.renderMixerChannels();
    }
    const all=document.querySelectorAll(".channel-bank-left .channel,.channel-bank-right .channel");
    all.forEach(card=>{
      const ch=Number(card.dataset.ch);
      const target=ch<=8?left:ch<=16?right:null;
      if(target && card.parentElement!==target)target.appendChild(card);
    });
  }
  function boot(){
    ensure();
    requestAnimationFrame(ensure);
    setTimeout(ensure,100);
    setTimeout(ensure,500);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
