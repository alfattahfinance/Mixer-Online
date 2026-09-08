"use strict";

window.MixerControl = (() => {
  const listeners = new Set();
  const cmdListeners = new Set();

  const state = {
    connected: false,
    transport: "none",
    lastCommand: null,
    lastRx: null,
    _adapterBound: false,
    stats: { tx: 0, rx: 0 }
  };

  const emit = () => listeners.forEach(fn => fn({ ...state }));

  const onStatus = fn => {
    listeners.add(fn);
    fn({ ...state });
    return () => listeners.delete(fn);
  };

  const onCommand = fn => {
    cmdListeners.add(fn);
    return () => cmdListeners.delete(fn);
  };

  function setStatus(x) {
    Object.assign(state, x);

    if (window.state) {
      window.state.connected = !!state.connected;
      window.state.sim = window.state.sim || {};
      window.state.sim.online = !!state.connected;
    }

    updateUI(!!state.connected);
    emit();
  }

  function updateUI(isConnected) {
    const statusText = document.getElementById("status");
    const statusLamp = document.getElementById("statusLamp");
    const bridgeHead = document.getElementById("headerBridgeStatus");
    const deviceStatus = document.getElementById("deviceStatus");
    const deviceLamp = document.getElementById("deviceLamp");
    const footerConn = document.getElementById("footerConnection");
    const btnConnect = document.getElementById("connectEsp");
    const btnDevice = document.getElementById("deviceConnect");

    // UI Panel Test & Transpor
    const transportLabel = document.getElementById("testTransportLabel");
    const rxCount = document.getElementById("testRxCount");
    const txCount = document.getElementById("testTxCount");

    const transportName = (state.transport || "esp32").toUpperCase();

    if (statusText) {
      statusText.textContent = isConnected ? "ONLINE" : "OFFLINE";
      statusText.style.color = isConnected ? "#31e66b" : "";
    }
    if (statusLamp) statusLamp.className = isConnected ? "live" : "";
    if (bridgeHead) {
      bridgeHead.textContent = isConnected ? `${transportName} ONLINE` : "BRIDGE STANDBY";
    }
    if (deviceStatus) {
      deviceStatus.textContent = isConnected
        ? `🟢 ${transportName} BRIDGE ONLINE (ACTIVE)`
        : `🔴 ${transportName} BRIDGE OFFLINE`;
    }
    if (deviceLamp) deviceLamp.className = isConnected ? "lamp green" : "lamp red";
    if (footerConn) {
      footerConn.textContent = isConnected
        ? `● ${transportName} BRIDGE ONLINE`
        : `● ${transportName} BRIDGE OFFLINE`;
    }
    if (btnConnect) btnConnect.textContent = isConnected ? "DISCONNECT ESP32" : "CONNECT ESP32";
    if (btnDevice) btnDevice.textContent = isConnected ? "DISCONNECT" : "CONNECT ESP32";

    // Panel Connection/Test Updates
    if (transportLabel) {
      transportLabel.textContent = isConnected 
        ? `${transportName} BRIDGE ONLINE` 
        : "OFFLINE";
    }
    if (rxCount) rxCount.textContent = state.stats.rx;
    if (txCount) txCount.textContent = state.stats.tx;
  }

  async function connectESP32() {
    if (!window.state?.system) {
      alert("Nyalakan SYSTEM terlebih dahulu!");
      return { ok: false, connected: false, reason: "SYSTEM_OFF" };
    }

    const api = window.MixerAdapters;
    if (!api || typeof api.connectESP32 !== "function") {
      return { ok: false, connected: false, reason: "adapter-unavailable" };
    }

    try {
      return await api.connectESP32({ systemOn: true });
    } catch (e) {
      console.warn("Gagal memanggil MixerAdapters.connectESP32:", e);
      return { ok: false, connected: false, reason: e?.message || String(e) };
    }
  }

  function disconnectESP32() {
    const api = window.MixerAdapters;
    try {
      api?.disconnect?.();
    } finally {
      setStatus({ connected: false, transport: "none", stats: { tx: 0, rx: 0 } });
    }
    return { ok: true, connected: false };
  }

  // Handle event RX agar tidak terdaftar ganda (Cegah Memory Leak & Lag)
  const handleRxEvent = (e) => {
    if (e.detail) {
      applyRemote(e.detail);
    }
  };

  function bindAdapterStatus() {
    if (state._adapterBound) return;
    
    const api = window.MixerAdapters;
    if (!api || typeof api.onStatus !== "function") return;
    
    state._adapterBound = true;
    
    api.onStatus(s => {
      const stats = api.getTransportStats ? api.getTransportStats() : { tx: 0, rx: 0 };
      setStatus({
        connected: !!s?.connected,
        transport: s?.transport || (s?.connected ? "esp32" : "none"),
        lastRx: s?.lastRx || state.lastRx,
        stats: { tx: stats.tx || 0, rx: stats.rx || 0 }
      });
    });

    // Daftarkan listener sekali saja
    document.removeEventListener("mixer:esp32-rx", handleRxEvent);
    document.removeEventListener("mixer:bluetooth-rx", handleRxEvent);
    document.addEventListener("mixer:esp32-rx", handleRxEvent);
    document.addEventListener("mixer:bluetooth-rx", handleRxEvent);
  }

  // Inisialisasi aman terhadap kesiapan DOM
  if (typeof window !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindAdapterStatus);
    } else {
      bindAdapterStatus();
    }
  }

  function setControl(channel, control, value) {
    const ch = Number(channel);
    const command = {
      type: "CONTROL",
      channel: String(ch),
      ch,
      param: String(control),
      control: String(control),
      value: Number.isFinite(Number(value)) ? Number(value) : value,
      time: Date.now()
    };

    if (!Number.isInteger(ch) || ch < 1 || ch > 14) {
      return { ok: false, reason: "invalid-channel" };
    }

    state.lastCommand = command;
    cmdListeners.forEach(fn => fn({ ...command, direction: "TX" }));

    const api = window.MixerAdapters;
    if (!state.connected && !api?.active?.connected) {
      return { ok: false, reason: "esp32-offline" };
    }

    if (api && typeof api.sendMapped === "function") {
      return api.sendMapped(command);
    }

    return { ok: true, transport: "esp32" };
  }

  // Helper Format Teks Output Nilai Parameter
  function formatParamValue(param, val) {
    const n = Number(val);
    if (param === "gain") return n.toFixed(2);
    if (param === "pan") return n === 0 ? "CENTER" : (n < 0 ? "L " + Math.round(Math.abs(n) * 100) + "%" : "R " + Math.round(n * 100) + "%");
    if (["high", "mid", "low"].includes(param)) return (n > 0 ? "+" : "") + Math.round(n) + "dB";
    if (param === "fader") return Math.round(n) + "%";
    return val;
  }

  // Fungsi Penerimaan Data RX dari Hardware / Simulator ke Tampilan UI Mixer (Dioptimalkan)
  function applyRemote(message) {
    if (!message) return false;
    state.lastRx = message;

    // Ambil statistik TX/RX terbaru
    const api = window.MixerAdapters;
    if (api && typeof api.getTransportStats === "function") {
      const stats = api.getTransportStats();
      state.stats.rx = stats.rx || state.stats.rx;
      state.stats.tx = stats.tx || state.stats.tx;
    }

    // Perbarui Log Teks Panel Log
    const rxLogEl = document.getElementById("rx") || document.getElementById("bridgeLog");
    if (rxLogEl) {
      rxLogEl.textContent = `RX: ${JSON.stringify(message)}`;
    }

    // A. METER SIGNAL HANDLING (VU Meter 14 Channel)
    if (message.type === "METER" && message.ch) {
      const chNum = Number(message.ch);
      const levelPercent = Math.min(100, Math.max(0, (message.level || 0) * 50));

      if (window.state && window.state.channels && window.state.channels[chNum - 1]) {
        window.state.channels[chNum - 1].level = Number(message.level || 0);
      }

      const chStrip = document.querySelector(`.new-channel-strip[data-ch="${chNum}"], .channel-strip[data-ch="${chNum}"]`);
      if (chStrip) {
        const vuLongFill = chStrip.querySelector(".ch-long-vu-fill");
        const vuTopFill = chStrip.querySelector(".ch-top-vu-fill, .channel-meter-bar");
        if (vuLongFill) vuLongFill.style.height = `${levelPercent}%`;
        if (vuTopFill) vuTopFill.style.height = `${levelPercent}%`;
      }
    }

    // B. CONTROL / FEEDBACK HANDLING (Perubahan Parameter Fisik)
    if ((message.type === "FEEDBACK" || message.type === "CONTROL") && message.ch && message.param) {
      const chNum = Number(message.ch);
      const param = String(message.param);
      const val = message.value;

      // Update State Global
      if (window.state && window.state.channels && window.state.channels[chNum - 1]) {
        window.state.channels[chNum - 1][param] = val;
      }

      const chStrip = document.querySelector(`.new-channel-strip[data-ch="${chNum}"], .channel-strip[data-ch="${chNum}"]`);
      if (chStrip) {
        // Update Slider / Input Value (Hindari trigger event input loop)
        const inputElem = chStrip.querySelector(`input[data-k="${param}"], input[data-param="${param}"]`);
        if (inputElem && parseFloat(inputElem.value) !== parseFloat(val)) {
          inputElem.value = val;
        }

        // Update Label Output Teks Nilai
        const parent = inputElem?.parentElement;
        if (parent) {
          const out = parent.querySelector("output, .fader-val, .knob-val");
          if (out) out.textContent = formatParamValue(param, val);
        }

        // Update Button Mute & Solo UI
        if (param === "mute" || param === "solo") {
          const btn = chStrip.querySelector(`button[data-k="${param}"], button[data-action="${param}"]`);
          if (btn) {
            const isTrue = !!val;
            btn.classList.toggle("active", isTrue);
            btn.classList.toggle("on", isTrue);
            btn.textContent = isTrue ? (param === "mute" ? "UNMUTE" : "UNSOLO") : (param === "mute" ? "MUTE" : "SOLO");
          }
        }

        // Update Lampu LED Status Channel
        const led = chStrip.querySelector(".channel-led");
        if (led && window.state?.channels[chNum - 1]) {
          const ch = window.state.channels[chNum - 1];
          if (ch.mute) {
            led.className = "channel-led active red";
          } else {
            led.className = "channel-led green on";
          }
        }
      }

      // Update Layar Center Screen M32
      if (typeof window.selectScreenChannel === "function") {
        window.selectScreenChannel(chNum);
      }
    }

    // Panggil Listener Command Tambahan
    cmdListeners.forEach(fn => fn({ ...message, direction: "RX" }));
    
    // Perbarui Status Counter RX
    const rxCount = document.getElementById("testRxCount");
    if (rxCount) rxCount.textContent = state.stats.rx;

    return true;
  }

  return {
    state,
    onStatus,
    onCommand,
    setStatus,
    setControl,
    connectESP32,
    disconnectESP32,
    applyRemote
  };
})();
