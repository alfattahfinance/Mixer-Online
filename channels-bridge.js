/* ==========================================================================
   CHANNELS BRIDGE - INSTANT REAL-TIME RESPONSIVE SYNC + RX HANDLER
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

  // Fungsi pengiriman parameter ke hardware (TX)
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

  // ==========================================================================
  // FITUR BARU: VERIFIKASI & PENERIMAAN INPUT/OUTPUT DARI HARDWARE (RX SYNC)
  // ==========================================================================
  window.handleIncomingHardwareData = function(incomingJsonString) {
    try {
      const data = typeof incomingJsonString === "string" ? JSON.parse(incomingJsonString) : incomingJsonString;
      if (!data || data.protocol !== "ESP32-MIXER/1") return;

      // Jika data bertipe kontrol dan arahnya dari hardware (RX / FEEDBACK)
      if (data.type === "CONTROL" && (data.direction === "RX" || data.direction === "FEEDBACK")) {
        const chNum = parseInt(data.ch, 10);
        const param = data.param; 
        const val = data.value;

        if (chNum >= 1 && chNum <= 14 && window.state && window.state.channels) {
          // 1. Update state lokal
          window.state.channels[chNum - 1][param] = val;

          // 2. Update posisi slider / kontrol fisik di web secara otomatis
          const targetElement = document.querySelector(`[data-ch="${chNum}"][data-param="${param}"]`);
          if (targetElement && parseFloat(targetElement.value) !== parseFloat(val)) {
            targetElement.value = val;
          }

          // 3. Update layar tengah jika channel tersebut sedang aktif dilihat
          if (typeof window.selectScreenChannel === "function") {
            window.selectScreenChannel(chNum);
          }

          console.log(`[INPUT/OUTPUT RX SYNC] CH${chNum} [${param}] di-update dari hardware ke -> ${val}`);
        }
      }
    } catch (err) {
      console.error("Gagal memproses data masuk (RX) mixer:", err);
    }
  };

  // Penanganan input langsung di web yang super responsif (TX)
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

    if (window.state.channels[chNum - 1]) {
      window.state.channels[chNum - 1][param] = val;
    }

    if (typeof window.selectScreenChannel === "function") {
      window.selectScreenChannel(chNum);
    }

    if (param === "fader") {
      const screenFaderEl = document.getElementById("screenFader");
      const screenInputEl = document.getElementById("screenInput");
      if (screenFaderEl) screenFaderEl.textContent = val + "%";
      if (screenInputEl) screenInputEl.textContent = "CH" + chNum;
    } else if (param === "gain") {
      const screenGainEl = document.getElementById("screenGain");
      if (screenGainEl) screenGainEl.textContent = val.toFixed(2);
    }

    window.sendChannelParamToHardware(chNum, param, val);
  }, true);

  // Penanganan tombol Mute / Solo
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
