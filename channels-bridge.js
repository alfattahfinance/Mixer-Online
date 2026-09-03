/* ==========================================================================
   CHANNELS BRIDGE - FULL INSTANT UI, HARDWARE & LED SYNC (TX & RX)
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

  // Fungsi global untuk memperbarui lampu indikator LED pada ke-14 channel
  window.updateAllChannelLeds = function() {
    for (let i = 1; i <= 14; i++) {
      const ch = window.state.channels[i - 1];
      const channelStrip = document.querySelector(`.new-channel-strip[data-ch="${i}"]`);
      if (!channelStrip || !ch) continue;

      const ledEl = channelStrip.querySelector('.channel-led');
      if (!ledEl) continue;

      if (ch.mute) {
        ledEl.className = "channel-led active red";
      } else if (Number(ch.fader) > 0 || Number(ch.gain) > 0) {
        ledEl.className = "channel-led active green";
      } else {
        ledEl.className = "channel-led";
      }
    }
  };

  // Helper fungsi untuk memperbarui readout di layar tengah secara instan dan menyeluruh
  function updateScreenReadoutsLive(chNum, param, val) {
    const screenInputEl = document.getElementById("screenInput");
    if (screenInputEl) screenInputEl.textContent = "CH" + chNum;

    if (param === "fader") {
      const el = document.getElementById("screenFader");
      if (el) el.textContent = val + "%";
    } else if (param === "gain") {
      const el = document.getElementById("screenGain");
      if (el) el.textContent = Number(val).toFixed(2);
    } else if (param === "pan") {
      const el = document.getElementById("screenPan");
      if (el) {
        el.textContent = val === 0 ? "CENTER" : (val < 0 ? "L " + Math.round(Math.abs(val) * 100) + "%" : "R " + Math.round(val * 100) + "%");
      }
    } else if (param === "mute" || param === "solo") {
      const el = document.getElementById("screenStatusBadge");
      if (el) {
        el.textContent = val ? (param === "mute" ? "MUTED" : "SOLO") : "READY";
      }
    }
  }

  // ==========================================================================
  // PENERIMAAN INPUT/OUTPUT DARI HARDWARE (RX SYNC)
  // ==========================================================================
  window.handleIncomingHardwareData = function(incomingJsonString) {
    try {
      const data = typeof incomingJsonString === "string" ? JSON.parse(incomingJsonString) : incomingJsonString;
      if (!data || data.protocol !== "ESP32-MIXER/1") return;

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

          // 4. Perbarui readout layar & lampu LED secara live
          updateScreenReadoutsLive(chNum, param, val);
          window.updateAllChannelLeds();

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
    const param = target.dataset.param || target.dataset.k;
    const strip = target.closest(".new-channel-strip");
    if (!strip || !param) return;

    const chNum = parseInt(strip.dataset.ch, 10);
    const val = parseFloat(target.value);

    if (isNaN(chNum) || isNaN(val)) return;

    e.stopImmediatePropagation();

    // 1. Update state lokal
    if (window.state.channels[chNum - 1]) {
      window.state.channels[chNum - 1][param] = val;
    }

    // 2. Pilih channel otomatis di layar
    if (typeof window.selectScreenChannel === "function") {
      window.selectScreenChannel(chNum);
    }

    // 3. Perbarui readout teks layar tengah & lampu LED secara instan
    updateScreenReadoutsLive(chNum, param, val);
    window.updateAllChannelLeds();

    // 4. Kirim perubahan ke hardware
    window.sendChannelParamToHardware(chNum, param, val);
  }, true);

  // Penanganan tombol Mute / Solo
  document.addEventListener("click", (e) => {
    const target = e.target.closest('[data-action], button[data-k="mute"], button[data-k="solo"]');
    if (!target) return;

    const strip = target.closest(".new-channel-strip");
    if (!strip) return;

    const chNum = parseInt(strip.dataset.ch, 10);
    const action = target.dataset.action || target.dataset.k;
    
    if (!isNaN(chNum) && (action === "mute" || action === "solo")) {
      e.stopImmediatePropagation();
      const channel = window.state.channels[chNum - 1];
      if (!channel) return;

      channel[action] = !channel[action];
      target.classList.toggle("active", channel[action]);
      target.classList.toggle("on", channel[action]);

      if (typeof window.selectScreenChannel === "function") {
        window.selectScreenChannel(chNum);
      }

      updateScreenReadoutsLive(chNum, action, channel[action]);
      window.updateAllChannelLeds();
      window.sendChannelParamToHardware(chNum, action, channel[action]);
    }
  }, true);

  // Inisialisasi awal lampu LED saat halaman selesai dimuat
  setTimeout(() => {
    if (typeof window.updateAllChannelLeds === "function") {
      window.updateAllChannelLeds();
    }
  }, 100);

})();

/* ==========================================================================
   GLOBAL SYSTEM & DEVICE LIGHTS SYNC
   ========================================================================== */
(function () {
  "use strict";

  function updateAllSystemLights() {
    const isSystemOn = window.state && window.state.system === true;
    const adapter = window.MixerAdapters?.active;
    const isConnected = !!(adapter && adapter.connected);

    // 1. Lampu Status Utama di Topbar (statusLamp)
    const statusLamp = document.getElementById("statusLamp");
    if (statusLamp) {
      statusLamp.classList.toggle("on", isConnected);
      statusLamp.classList.toggle("live", isConnected);
    }

    // 2. Lampu Indikator Koneksi Perangkat (deviceLamp)
    const deviceLamp = document.getElementById("deviceLamp");
    if (deviceLamp) {
      deviceLamp.classList.toggle("green", isConnected);
      deviceLamp.classList.toggle("red", !isConnected);
    }

    // 3. Status Teks Bridge & Transport
    const headerStatus = document.getElementById("headerBridgeStatus");
    if (headerStatus) {
      headerStatus.textContent = isConnected ? "BRIDGE READY" : (isSystemOn ? "SYSTEM READY" : "BRIDGE STANDBY");
    }
  }

  // Jalankan pengecekan status lampu secara berkala dan real-time
  setInterval(updateAllSystemLights, 300);

  // Hook ke perubahan status adapter jika tersedia
  if (window.MixerAdapters && typeof window.MixerAdapters.onStatus === "function") {
    window.MixerAdapters.onStatus(() => {
      updateAllSystemLights();
    });
  }
})();

