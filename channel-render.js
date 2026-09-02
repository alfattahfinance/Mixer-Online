/* Dedicated channel renderer entry point.
   app.js owns the mixer engine and exposes renderMixerChannels().
   This file only triggers that existing renderer AFTER app.js is loaded. */
(function(){
  "use strict";
  function renderChannels(){
    if(typeof window.renderMixerChannels==="function"){
      window.renderMixerChannels();
    }
  }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",renderChannels,{once:true});
  }else{
    renderChannels();
  }
  requestAnimationFrame(renderChannels);
  window.addEventListener("pageshow",renderChannels);
})();
