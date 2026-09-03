/* ==========================================================================
   ISOLATED CHANNEL PARAMETER BRIDGE (GAIN-LOCK & INDEPENDENT STATE)
   ========================================================================== */
(function () {
  "use strict";

  // Pastikan struktur state global tersedia untuk 14 channel dengan parameter terisolasi
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
      param: paramName, 
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

    console.log(`[INDEPENDENT TX] CH${chNum} -> ${paramName}:`, value);
  };

  // Mencegah gangguan silang (cross-talk/gain-following) pada tingkat DOM input
  document.addEventListener("input", (e) => {
    const target = e.target;
    
    // Validasi ketat elemen yang diubah
    if (!target || !target.dataset || !target.dataset.ch || !target.dataset.param) {
      return;
    }

    const chNum = parseInt(target.dataset.ch, 10);
    const param = target.dataset.param; // "gain", "fader", "pan", "low", "high", dll.
    const val = parseFloat(target.value);

    if (isNaN(chNum) || !param || isNaN(val)) return;

    // Hentikan perambatan agar script render bawaan channel tidak salah tangkap
    e.stopImmediatePropagation();

    // Pastikan HANYA parameter yang dimaksud saja yang nilainya berubah di state
    if (window.state.channels[chNum - 1]) {
      window.state.channels[chNum - 1][param] = val;
    }

    // Kirim data parameter spesifik tersebut
    window.sendChannelParamToHardware(chNum, param, val);

  }, true); // Gunakan fase tangkap (capture) terdepan

  // Handler terpisah untuk tombol Mute/Solo
  document.addEventListener("click", (e) => {
    const target = e.target.closest('[data-action]');
    if (!target || !target.dataset || !target.dataset.ch) return;

    const chNum = parseInt(target.dataset.ch, 10);
    const action = target.dataset.action;
    
    if (!isNaN(chNum) && (action === "mute" || action === "solo")) {
      e.stopImmediatePropagation();
      const currentState = !!window.state.channels[chNum - 1][action];
      const newState = !currentState;
      
      window.state.channels[chNum - 1][action] = newState;
      target.classList.toggle("active", newState);

      window.sendChannelParamToHardware(chNum, action, newState);
    }
  }, true);

})();
