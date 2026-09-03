/* ==========================================================================
   ISOLATED CHANNEL PARAMETER BRIDGE (FIXING PARAMETER CROSS-CONTAMINATION)
   ========================================================================== */
(function () {
  "use strict";

  // Pastikan struktur state global tersedia untuk 14 channel
  if (!window.state) window.state = {};
  if (!window.state.channels) {
    window.state.channels = [];
    for (let i = 0; i < 14; i++) {
      window.state.channels.push({
        id: i + 1,
        fader: 75.0,
        gain: 1.00,
        pan: 0,
        mute: false,
        solo: false
      });
    }
  }

  // Fungsi pengiriman parameter ke hardware secara spesifik
  window.sendChannelParamToHardware = function(chNum, paramName, value) {
    const payload = {
      protocol: "ESP32-MIXER/1",
      id: "cmd-" + Date.now(),
      type: "CONTROL",
      ch: chNum,
      param: paramName, // Hanya mengirim parameter yang benar-benar diubah
      value: value,
      rev: 1,
      ts: Date.now(),
      direction: "TX"
    };

    if (window.MixerBluetooth && typeof window.MixerBluetooth.send === "function") {
      window.MixerBluetooth.send(payload);
    }
    if (window.MixerAdapters && typeof window.MixerAdapters.send === "function") {
      window.MixerAdapters.send(payload);
    }

    console.log(`[ISOLATED TX] CH${chNum} -> ${paramName}:`, value);
  };

  // EVENT LISTENER UI: STRICT ISOLATION BERDASARKAN ATTRIBUT data-param
  document.addEventListener("input", (e) => {
    const target = e.target;
    
    // Pastikan elemen memiliki data-ch DAN data-param secara eksplisit
    if (target && target.dataset && target.dataset.ch && target.dataset.param) {
      const chNum = parseInt(target.dataset.ch, 10);
      const param = target.dataset.param; // "fader", "gain", "pan", dll.
      const val = parseFloat(target.value);

      if (!isNaN(chNum) && param) {
        // Hanya update state untuk parameter yang spesifik diubah
        if (window.state.channels[chNum - 1]) {
          window.state.channels[chNum - 1][param] = val;
        }

        // Kirim hanya parameter tersebut ke hardware, tanpa menyentuh parameter lain
        window.sendChannelParamToHardware(chNum, param, val);
      }
    }
  });

  // EVENT LISTENER UNTUK MUTE / SOLO (TERISOLASI)
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (target.dataset && target.dataset.ch && (target.dataset.action === "mute" || target.dataset.action === "solo")) {
      const chNum = parseInt(target.dataset.ch, 10);
      const action = target.dataset.action;
      
      if (!isNaN(chNum)) {
        const currentState = window.state.channels[chNum - 1][action];
        const newState = !currentState;
        
        window.state.channels[chNum - 1][action] = newState;
        target.classList.toggle("active", newState);

        window.sendChannelParamToHardware(chNum, action, newState);
      }
    }
  });

})();
