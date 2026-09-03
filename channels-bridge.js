/* ==========================================================================
   ISOLATED CHANNEL PARAMETER BRIDGE (STRICT EVENT FILTERING)
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
        low: 0,
        mid: 0,
        high: 0,
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

    console.log(`[STRICT TX] CH${chNum} -> ${paramName}:`, value);
  };

  // EVENT LISTENER INPUT: STRICT TARGET CHECK (Mencegah parameter lain ikut terseret)
  document.addEventListener("input", (e) => {
    const target = e.target;
    
    // Validasi ketat: pastikan target adalah elemen input/slider yang memiliki data-ch dan data-param
    if (!target || !target.dataset || !target.dataset.ch || !target.dataset.param) {
      return;
    }

    const chNum = parseInt(target.dataset.ch, 10);
    const param = target.dataset.param; // Contoh: "fader", "gain", "pan", "low", "high"
    const val = parseFloat(target.value);

    if (isNaN(chNum) || !param || isNaN(val)) return;

    // Cegah event merembet ke elemen lain
    e.stopPropagation();

    // Update state lokal HANYA untuk parameter tersebut
    if (window.state.channels[chNum - 1]) {
      window.state.channels[chNum - 1][param] = val;
    }

    // Kirim perubahan parameter secara mandiri
    window.sendChannelParamToHardware(chNum, param, val);
  }, true /* Menggunakan capture phase agar lebih spesifik */);

  // EVENT LISTENER TOMBOL MUTE / SOLO
  document.addEventListener("click", (e) => {
    const target = e.target.closest('[data-action]');
    if (!target || !target.dataset || !target.dataset.ch) return;

    const chNum = parseInt(target.dataset.ch, 10);
    const action = target.dataset.action; // "mute" atau "solo"
    
    if (!isNaN(chNum) && (action === "mute" || action === "solo")) {
      const currentState = !!window.state.channels[chNum - 1][action];
      const newState = !currentState;
      
      window.state.channels[chNum - 1][action] = newState;
      target.classList.toggle("active", newState);

      window.sendChannelParamToHardware(chNum, action, newState);
    }
  });

})();
