/* MIXER ONLINE — FINAL SCREEN DOCK / RESPONSIVE LAYOUT BRIDGE
 * Layout only. Does not touch audio, ESP32, player, mute/solo or scene state.
 */
(function(){
  'use strict';

  function screenBody(){
    return document.querySelector('#digitalScreen .screen-body');
  }

  function dockScreenViews(){
    const body = screenBody();
    if(!body) return;

    const views = Array.from(document.querySelectorAll('.screen-view-host, .screen-view-panel'));
    views.forEach(view => {
      if(!view || body.contains(view)) return;
      /* Never move a real mixer/rack control by accident. */
      if(view.closest('.channel-rack, .master-side-dock, #musicPlayer')) return;
      body.appendChild(view);
    });

    body.querySelectorAll('.screen-view-host').forEach(view => {
      view.classList.add('screen-view-panel');
      view.dataset.screenDocked = '1';
    });
  }

  function refresh(){
    dockScreenViews();
  }

  refresh();
  window.addEventListener('load', refresh, {once:true});
  window.addEventListener('resize', refresh, {passive:true});

  const observer = new MutationObserver(() => {
    if(window.__mixerScreenDockQueued) return;
    window.__mixerScreenDockQueued = true;
    requestAnimationFrame(() => {
      window.__mixerScreenDockQueued = false;
      refresh();
    });
  });
  observer.observe(document.body, {childList:true, subtree:true});

  window.MixerFinalLayout = { refresh, dockScreenViews };
})();