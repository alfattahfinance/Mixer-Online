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

  // Helper Format Teks Knob
  function formatKnobVal(param, val) {
    const num = Number(val);
    if (param === "gain") return num.toFixed(2);
    if (param === "pan") return num === 0 ? "MID" : (num < 0 ? "L" + Math.round(Math.abs(num) * 100) : "R" + Math.round(num * 100));
    if (["high", "mid", "low"].includes(param)) return (num > 0 ? "+" : "") + num + "dB";
    return num;
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

  // Fungsi global untuk memperbarui lampu LED & VU Meter pada ke-14 channel
  window.updateAllChannelLeds = function() {
    for (let i = 1; i <= 14; i++) {
      const ch = window.state.channels[i - 1];
      const channelStrip = document.querySelector(`.new-channel-strip[data-ch="${i}"], .channel-strip[data-ch="${i}"]`);
      if (!channelStrip || !ch) continue;

      // 1. Update Lampu LED Indikator Status
      const ledEl = channelStrip.querySelector('.channel-led');
      if (ledEl) {
        if (ch.mute) {
          ledEl.className = "channel-led active red";
        } else if (Number(ch.fader) > 0 || Number(ch.gain) > 0) {
          ledEl.className = "channel-led active green";
        } else {
          ledEl.className = "channel-led";
        }
      }

      // 2. Update Isian VU Meter Mini (Hijau-Kuning-Merah)
      const topVuFill = channelStrip.querySelector('.ch-top-vu-fill');
      if (topVuFill) {
        if (ch.mute) {
          topVuFill.style.width = '0%';
        } else {
          const cGain = parseFloat(ch.gain ?? 1.0);
          const cFader = parseFloat(ch.fader ?? 75) / 100;
          const level = (cGain * cFader * 65);
          topVuFill.style.width = Math.min(100, Math.max(0, level)) + '%';
        }
      }
    }
  };

  // Helper fungsi untuk memperbarui readout di layar tengah secara instan
  function updateScreenReadoutsLive(chNum, param, val) {
    const screenInputEl = document.getElementById("screenInput");
    if (screenInputEl) screenInputEl.textContent = "CH " + (chNum < 10 ? "0" + chNum : chNum);

    if (param === "fader") {
      const el = document.getElementById("screenFader");
      if (el) el.textContent = Math.round(val) + "%";
    } else if (param === "gain") {
      const el = document.getElementById("screenGain");
      if (el) el.textContent = Number(val).toFixed(2);
    } else if (param === "pan") {
      const el = document.getElementById("screenPan");
      if (el) {
        el.textContent = val === 0 ? "CENTER" : (val < 0 ? "L " + Math.round(Math.abs(val) * 100) + "%" : "R " + Math.round(val * 100) + "%");
      }
    } else if (param === "mute" || param === "solo") {
      const el = document.getElementById("screenStatus");
      if (el) {
        el.textContent = val ? (param === "mute" ? "[MUTED]" : "[SOLO]") : "[ACTIVE]";
        el.style.color = val ? (param === "mute" ? "#e74c3c" : "#f1c40f") : "#2ecc71";
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

          // 2. Update posisi slider & teks di channel strip
          const channelStrip = document.querySelector(`.new-channel-strip[data-ch="${chNum}"], .channel-strip[data-ch="${chNum}"]`);
          if (channelStrip) {
            const targetElement = channelStrip.querySelector(`[data-k="${param}"], [data-param="${param}"]`);
            if (targetElement && parseFloat(targetElement.value) !== parseFloat(val)) {
              targetElement.value = val;
            }

            if (param === "fader") {
              const out = channelStrip.querySelector("output, .fader-val");
              if (out) out.textContent = Math.round(val) + "%";
            } else {
              const knobTxt = channelStrip.querySelector(`.knob-val[data-val="${param}"]`);
              if (knobTxt) knobTxt.textContent = formatKnobVal(param, val);
            }

            if (param === "mute" || param === "solo") {
              const btn = channelStrip.querySelector(`button[data-k="${param}"]`);
              if (btn) {
                btn.classList.toggle("on", Boolean(val));
                btn.classList.toggle("active", Boolean(val));
                btn.textContent = Boolean(val) ? (param === "mute" ? "UNMUTE" : "UNSOLO") : (param === "mute" ? "MUTE" : "SOLO");
              }
            }
          }

          // 3. Update layar tengah
          if (typeof window.selectScreenChannel === "function") {
            window.selectScreenChannel(chNum);
          }

          updateScreenReadoutsLive(chNum, param, val);
          window.updateAllChannelLeds();
        }
      }
    } catch (err) {
      console.error("Gagal memproses data masuk (RX) mixer:", err);
    }
  };

  // Penanganan input slider / knob langsung di web (TX)
  document.addEventListener("input", (e) => {
    const target = e.target;
    const param = target.dataset.param || target.dataset.k;
    const strip = target.closest(".new-channel-strip, .channel-strip");
    if (!strip || !param) return;

    const chNum = parseInt(strip.dataset.ch, 10);
    const val = parseFloat(target.value);

    if (isNaN(chNum) || isNaN(val)) return;

    // Update state
    if (window.state.channels[chNum - 1]) {
      window.state.channels[chNum - 1][param] = val;
    }

    // Update Teks Label
    if (param === "fader") {
      const out = strip.querySelector("output, .fader-val");
      if (out) out.textContent = Math.round(val) + "%";
    } else {
      const knobTxt = strip.querySelector(`.knob-val[data-val="${param}"]`);
      if (knobTxt) knobTxt.textContent = formatKnobVal(param, val);
    }

    if (typeof window.selectScreenChannel === "function") {
      window.selectScreenChannel(chNum);
    }

    updateScreenReadoutsLive(chNum, param, val);
    window.updateAllChannelLeds();
    window.sendChannelParamToHardware(chNum, param, val);
  });

  // Penanganan tombol Mute / Solo SUPER RESPONSIF (Instant UI)
  document.addEventListener("click", (e) => {
    const target = e.target.closest('button[data-k="mute"], button[data-k="solo"], [data-action="mute"], [data-action="solo"]');
    if (!target) return;

    const strip = target.closest(".new-channel-strip, .channel-strip");
    if (!strip) return;

    const chNum = parseInt(strip.dataset.ch, 10);
    const action = target.dataset.k || target.dataset.action;
    
    if (!isNaN(chNum) && (action === "mute" || action === "solo")) {
      e.stopPropagation(); // Hentikan bentrokan event listener lain

      const channel = window.state.channels[chNum - 1];
      if (!channel) return;

      // Toggle state lokal
      channel[action] = !channel[action];
      const nextState = channel[action];

      // Update UI Tombol Seketika
      target.classList.toggle("active", nextState);
      target.classList.toggle("on", nextState);
      target.textContent = nextState 
        ? (action === "mute" ? "UNMUTE" : "UNSOLO") 
        : (action === "mute" ? "MUTE" : "SOLO");

      // Update Teks Footer
      const statusSpan = strip.querySelector("footer span");
      if (statusSpan) {
        statusSpan.textContent = channel.mute ? "MUTED" : (channel.solo ? "SOLO" : "READY");
      }

      if (typeof window.selectScreenChannel === "function") {
        window.selectScreenChannel(chNum);
      }

      updateScreenReadoutsLive(chNum, action, nextState);
      window.updateAllChannelLeds();

      // Kirim ke ESP32 secara asynchronous
      window.sendChannelParamToHardware(chNum, action, nextState);
    }
  }, true); // High priority event capture

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
