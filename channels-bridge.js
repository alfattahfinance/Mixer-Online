/* ==========================================================================
   GAIN MOTION SHIELD BRIDGE (Mengunci pergerakan visual khusus untuk Gain)
   ========================================================================== */
(function () {
  "use strict";

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

  // Simpan nilai asli Gain per channel agar tidak bisa diubah kecuali disentuh langsung
  const lockedGainValues = {};
  for (let i = 1; i <= 14; i++) {
    lockedGainValues[i] = 1.00;
  }

  document.addEventListener("input", (e) => {
    const target = e.target;
    if (!target || !target.dataset || !target.dataset.ch || !target.dataset.param) {
      return;
    }

    const chNum = parseInt(target.dataset.ch, 10);
    const param = target.dataset.param;
    const val = parseFloat(target.value);

    if (isNaN(chNum) || !param || isNaN(val)) return;

    // PENGAMAN KHUSUS GAIN: Jika yang bergerak adalah Gain tapi pengguna sedang tidak menyentuh Gain, 
    // atau jika parameter lain sedang digeser tapi Gain ikut bergerak, paksa kunci Gain ke posisi terakhirnya!
    if (param === "gain") {
      // Tandai bahwa gain sedang disentuh langsung
      window._isUserDraggingGain = true;
      lockedGainValues[chNum] = val;
    } else {
      // Jika parameter lain (seperti fader/pan) yang digeser, pastikan elemen input gain dipaksa diam pada nilai aslinya
      const gainInput = document.querySelector(`input[data-ch="${chNum}"][data-param="gain"]`);
      if (gainInput && parseFloat(gainInput.value) !== lockedGainValues[chNum]) {
        gainInput.value = lockedGainValues[chNum];
      }
    }

    // Hentikan perambatan agar render utama tidak mencemari parameter lain
    e.stopImmediatePropagation();

    if (window.state.channels[chNum - 1]) {
      window.state.channels[chNum - 1][param] = val;
    }

    window.sendChannelParamToHardware(chNum, param, val);
  }, true);

  document.addEventListener("mouseup", () => { window._isUserDraggingGain = false; }, true);
  document.addEventListener("touchend", () => { window._isUserDraggingGain = false; }, true);

  // Mute / Solo handler
  document.addEventListener("click", (e) => {
    const target = e.target.closest('[data-action]');
    if (!target || !target.dataset || !target.dataset.ch) return;

    const chNum = parseInt(target.dataset.ch, 10);
    const action = target.dataset.action;
    
    if (!isNaN(chNum) && (action === "mute" || action === "solo")) {
      e.stopImmediatePropagation();
      const channel = window.state.channels[chNum - 1];
      if (!channel) return;

      channel[action] = !channel[action];
      target.classList.toggle("active", channel[action]);

      window.sendChannelParamToHardware(chNum, action, channel[action]);
    }
  }, true);

})();
