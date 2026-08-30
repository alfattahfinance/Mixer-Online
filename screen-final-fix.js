/* MIXER ONLINE — FINAL SCREEN DOCK FIX
 * Fixes the legacy full-page/blank screen view.
 * Views are kept inside #digitalScreen .screen-body.
 * Does not modify audio, ESP32, player, channel controls, mute/solo or scenes.
 */
(function(){
  'use strict';

  function boot(){
    const screen = document.getElementById('digitalScreen');
    const body = screen?.querySelector('.screen-body');
    const tabs = screen?.querySelector('.screen-tabs');
    if(!screen || !body || !tabs) return;

    /* Remove the broken/legacy host created by the previous layout bridge.
       Keep its actual view panels so their existing control wiring survives. */
    const oldHost = screen.querySelector(':scope > .screen-view-host');
    const panels = oldHost ? Array.from(oldHost.querySelectorAll('.screen-view-panel')) : [];
    if(oldHost) oldHost.remove();

    /* If a previous run already moved the panels, collect them too. */
    const existingPanels = Array.from(screen.querySelectorAll('.screen-view-panel[data-screen]'));
    const allPanels = [...new Set([...panels, ...existingPanels])];

    let layer = body.querySelector('.final-screen-layer');
    if(!layer){
      layer = document.createElement('div');
      layer.className = 'final-screen-layer';
      body.appendChild(layer);
    }

    allPanels.forEach(panel => {
      if(!panel.dataset.screen) return;
      layer.appendChild(panel);
      panel.classList.remove('active');
      panel.hidden = true;
    });

    /* Replace tab buttons so the old mixer-final click handlers cannot
       hide the screen body or route the view outside the mixer. */
    const labels = ['HOME','METERS','EQ','EFFECT','ROUTING','SETUP'];
    const oldButtons = Array.from(tabs.querySelectorAll('button'));
    oldButtons.forEach((oldButton, i) => {
      const b = oldButton.cloneNode(true);
      b.textContent = labels[i] || oldButton.textContent;
      oldButton.replaceWith(b);
    });
    const buttons = Array.from(tabs.querySelectorAll('button'));

    const homeNodes = [
      body.querySelector('.spectrum'),
      body.querySelector('.reference-eq'),
      body.querySelector('.screen-source'),
      body.querySelector('.screen-readout'),
      body.querySelector('.screen-channels'),
      body.querySelector('.screen-meter')
    ].filter(Boolean);

    function show(name){
      body.style.display = 'block';
      body.classList.add('final-docked-screen');
      homeNodes.forEach(node => {
        node.style.display = name === 'home' ? '' : 'none';
      });
      allPanels.forEach(panel => {
        const active = panel.dataset.screen === name;
        panel.hidden = !active;
        panel.classList.toggle('active', active);
        panel.style.display = active ? 'block' : 'none';
      });
      buttons.forEach((b,i) => {
        const active = labels[i].toLowerCase() === name;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      /* Keep the display itself fixed inside the mixer. */
      screen.scrollTop = 0;
      body.scrollTop = 0;
    }

    buttons.forEach((b,i) => {
      b.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        show(labels[i].toLowerCase());
      }, false);
    });

    show('home');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 50), {once:true});
  }else{
    setTimeout(boot, 50);
  }

  window.MixerFinalScreenFix = { refresh: boot };
})();