/* ==========================================================================
   CHANNELS BRIDGE - INSTANT FADER & SCREEN SYNC
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

  // Listener input dengan sinkronisasi layar instan otomatis
  document.addEventListener("input", (e) => {
    const target = e.target;
    if (!target || !target.dataset || !target.dataset.ch || !target.dataset.param) {
      return;
    }

    const chNum = parseInt(target.dataset.ch, 10);
    const param = target.dataset.param;
    const val = parseFloat(target.value);

    if (isNaN(chNum) || !param || isNaN(val)) return;

    e.stopImmediatePropagation();

    // 1. Update state lokal
    if (window.state.channels[chNum - 1]) {
      window.state.channels[chNum - 1][param] = val;
    }

    // 2. OTOMATIS PILIH CHANNEL DAN UPDATE LAYAR TENGAH SECARA INSTAN
    if (typeof window.selectScreenChannel === "function") {
      window.selectScreenChannel(chNum);
    }

    // Pastikan nilai fader langsung ter-update di readout layar
    if (param === "fader") {
      const screenFaderEl = document.getElementById("screenFader");
      const screenInputEl = document.getElementById("screenInput");
      if (screenFaderEl) screenFaderEl.textContent = val + "%";
      if (screenInputEl) screenInputEl.textContent = "CH" + chNum;
    }

    // 3. Kirim ke hardware
    window.sendChannelParamToHardware(chNum, param, val);
  }, true);

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

      if (typeof window.selectScreenChannel === "function") {
        window.selectScreenChannel(chNum);
      }

      window.sendChannelParamToHardware(chNum, action, channel[action]);
    }
  }, true);

})();
