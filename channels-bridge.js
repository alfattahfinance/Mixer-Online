/* ==========================================================================
   COMPLETE CHANNEL PARAMETER BRIDGE (TWO-WAY SYNC: WEB <-> HARDWARE)
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

  // 1. KIRIM PERINTAH DARI WEB KE HARDWARE (TX)
  window.sendChannelParamToHardware = function(chNum, paramName, value) {
    const payload = {
      protocol: "ESP32-MIXER/1",
      id: "cmd-" + Date.now(),
      type: "CONTROL",
      ch: chNum,
      param: paramName, // "fader", "gain", "pan", "mute", "solo"
      value: value,
      rev: 1,
      ts: Date.now(),
      direction: "TX"
    };

    // Kirim via Bluetooth jika aktif
    if (window.MixerBluetooth && typeof window.MixerBluetooth.send === "function") {
      window.MixerBluetooth.send(payload);
    }

    // Kirim via ESP32 Bridge adapter jika aktif
    if (window.MixerAdapters && typeof window.MixerAdapters.send === "function") {
      window.MixerAdapters.send(payload);
    }

    console.log(`[PARAM TX] CH${chNum} -> ${paramName}:`, value);
  };

  // 2. TERIMA DATA DARI HARDWARE FISIK KE WEB (RX)
  window.handleIncomingHardwareData = function(incomingJsonString) {
    try {
      const data = JSON.parse(incomingJsonString);
      
      // Validasi protokol
      if (data.protocol !== "ESP32-MIXER/1") return;

      // Jika pesan berupa feedback kontrol dari hardware fisik
      if (data.type === "CONTROL" && data.direction === "RX") {
        const chNum = parseInt(data.ch, 10);
        const param = data.param; // "fader", "gain", "pan", "mute", "solo"
        const val = data.value;

        if (chNum >= 1 && chNum <= 14 && window.state && window.state.channels) {
          // Update state lokal web
          window.state.channels[chNum - 1][param] = val;

          // Update tampilan elemen UI di layar secara otomatis
          const targetElement = document.querySelector(`[data-ch="${chNum}"][data-param="${param}"]`);
          if (targetElement) {
            targetElement.value = val;
          }

          console.log(`[PHYSICAL RX] CH${chNum} ${param} updated to ${val} from hardware.`);
        }
      }
    } catch (err) {
      console.error("Gagal memparsing data masuk dari mixer fisik:", err);
    }
  };

  // 3. EVENT LISTENER UI: MENDETEKSI PERUBAHAN DARI LAYAR WEB
  document.addEventListener("input", (e) => {
    const target = e.target;
    if (target.dataset && target.dataset.ch) {
      const chNum = parseInt(target.dataset.ch, 10);
      const param = target.dataset.param;
      const val = parseFloat(target.value);

      if (!isNaN(chNum) && param) {
        if (window.state.channels[chNum - 1]) {
          window.state.channels[chNum - 1][param] = val;
        }
        window.sendChannelParamToHardware(chNum, param, val);
      }
    }
  });

  // 4. EVENT LISTENER UI: TOMBOL MUTE / SOLO
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (target.dataset && (target.dataset.action === "mute" || target.dataset.action === "solo")) {
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
