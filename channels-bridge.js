/* ==========================================================================
   STRICT INDEPENDENT PARAMETER ISOLATION BRIDGE
   ========================================================================== */
(function () {
  "use strict";

  // Pastikan state global terstruktur untuk 14 channel dengan memori yang benar-benar terpisah
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
  };

  // PENGAMAN UTAMA: Mencegah event input merembet atau memicu parameter lain
  document.addEventListener("input", (e) => {
    const target = e.target;
    
    // Pastikan target adalah elemen input yang memiliki atribut data-ch dan data-param secara spesifik
    if (!target || !target.dataset || !target.dataset.ch || !target.dataset.param) {
      return;
    }

    const chNum = parseInt(target.dataset.ch, 10);
    const param = target.dataset.param; // Contoh: "fader", "gain", "pan", "low", "high"
    const val = parseFloat(target.value);

    if (isNaN(chNum) || !param || isNaN(val)) return;

    // Hentikan penjalaran event secara total agar file render lain tidak ikut mengubah parameter tetangga
    e.stopImmediatePropagation();
    e.stopPropagation();

    // Update HANYA properti spesifik yang sedang disentuh
    if (window.state.channels && window.state.channels[chNum - 1]) {
      window.state.channels[chNum - 1][param] = val;
    }

    // Kirim data mandiri ke hardware
    window.sendChannelParamToHardware(chNum, param, val);
  }, true); // Gunakan capture phase agar disadap paling awal

  // PENGAMAN TOMBOL MUTE / SOLO
  document.addEventListener("click", (e) => {
    const target = e.target.closest('[data-action]');
    if (!target || !target.dataset || !target.dataset.ch) return;

    const chNum = parseInt(target.dataset.ch, 10);
    const action = target.dataset.action;
    
    if (!isNaN(chNum) && (action === "mute" || action === "solo")) {
      e.stopImmediatePropagation();
      e.stopPropagation();

      const channel = window.state.channels[chNum - 1];
      if (!channel) return;

      channel[action] = !channel[action];
      target.classList.toggle("active", channel[action]);

      window.sendChannelParamToHardware(chNum, action, channel[action]);
    }
  }, true);

})();
