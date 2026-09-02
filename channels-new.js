/* ============================================================
   Mixer-Online — NEW 16 CHANNEL PANEL
   Visual channel layer only.
   This file owns the channel DOM/skin. It does NOT replace or
   modify mixer state, audio, ESP32, Bluetooth, or control engine.
   ============================================================ */
(function () {
  "use strict";

  const CHANNELS = 16;

  function channelTemplate(id) {
    return `
      <article class="new-channel-strip" data-channel="${id}" data-ch="${id}">
        <header class="new-channel-head">CH${id}</header>

        <div class="new-channel-meter" aria-label="CH${id} level">
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
        </div>

        <div class="new-channel-control">
          <label>GAIN</label>
          <input type="range" class="knob gain" min="0" max="2" step="0.01" value="1" aria-label="CH${id} Gain">
        </div>

        <div class="new-channel-control">
          <label>HIGH</label>
          <input type="range" class="knob high" min="-12" max="12" step="0.1" value="0" aria-label="CH${id} High">
        </div>

        <div class="new-channel-control">
          <label>MID</label>
          <input type="range" class="knob mid" min="-12" max="12" step="0.1" value="0" aria-label="CH${id} Mid">
        </div>

        <div class="new-channel-control">
          <label>LOW</label>
          <input type="range" class="knob low" min="-12" max="12" step="0.1" value="0" aria-label="CH${id} Low">
        </div>

        <div class="new-channel-control">
          <label>PAN</label>
          <input type="range" class="knob pan" min="-1" max="1" step="0.01" value="0" aria-label="CH${id} Pan">
        </div>

        <div class="new-channel-fader">
          <label>FADER</label>
          <input type="range" class="fader" min="0" max="100" step="1" value="75" aria-label="CH${id} Fader">
        </div>

        <div class="new-channel-buttons">
          <button type="button" class="mute">MUTE</button>
          <button type="button" class="solo">SOLO</button>
        </div>

        <footer class="new-channel-source">CH${id}</footer>
      </article>`;
  }

  function build() {
    const left = document.getElementById("channels");
    const right = document.getElementById("channelsRight");
    if (!left || !right) return;

    left.innerHTML = "";
    right.innerHTML = "";

    for (let id = 1; id <= CHANNELS; id++) {
      const box = document.createElement("div");
      box.innerHTML = channelTemplate(id);
      const channel = box.firstElementChild;

      if (id <= 8) left.appendChild(channel);
      else right.appendChild(channel);
    }
  }

  window.buildNew16ChannelPanel = build;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build, { once: true });
  } else {
    build();
  }
})();
