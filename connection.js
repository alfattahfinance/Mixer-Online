"use strict";

window.MixerControl = (() => {
  const listeners = new Set();
  const cmdListeners = new Set();

  const state = {
    connected: false,
    transport: "none",
    lastCommand: null,
    lastRx: null
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

  // SINKRONISASI STATUS KONEKSI KE WINDOW.STATE & UI
  function setStatus(x) {
    Object.assign(state, x);
    
    // Pastikan window.state ikut terupdate
    if (window.state) {
      window.state.connected = !!state.connected;
      window.state.sim = window.state.sim || {};
      window.state.sim.online = !!state.connected;
    }

    // Perbarui UI secara langsung
    updateUI(!!state.connected);
    emit();
  }

  // FUNGSI UPDATE TAMPILAN (UI)
  function updateUI(isConnected) {
    const statusText = document.getElementById("status");
    const statusLamp = document.getElementById("statusLamp");
    const bridgeHead = document.getElementById("headerBridgeStatus");
    const deviceStatus = document.getElementById("deviceStatus");
    const deviceLamp = document.getElementById("deviceLamp");
    const footerConn = document.getElementById("footerConnection");

    if (statusText) {
      statusText.textContent = isConnected ? "ONLINE" : "OFFLINE";
      statusText.style.color = isConnected ? "#31e66b" : "";
    }
    if (statusLamp) {
      statusLamp.className = isConnected ? "live" : "";
    }
    if (bridgeHead) {
      bridgeHead.textContent = isConnected ? "BRIDGE ONLINE" : "BRIDGE STANDBY";
    }
    if (deviceStatus) {
      deviceStatus.textContent = isConnected 
        ? "🟢 ESP32 SIMULATOR ONLINE (ACTIVE)" 
        : "🔴 ESP32 SIMULATOR OFFLINE";
    }
    if (deviceLamp) {
      deviceLamp.className = isConnected ? "lamp green" : "lamp red";
    }
    if (footerConn) {
      footerConn.textContent = isConnected 
        ? "● ESP32 SIMULATOR ONLINE" 
        : "● ESP32 SIMULATOR OFFLINE";
    }
  }

  // FUNGSI CONNECT ESP32 (TOGGLE DIRECT & ADAPTER)
  function connectESP32() {
    // 1. Cek apakah System Utama (Power) sudah ON
    if (!window.state?.system) {
      alert("Nyalakan SYSTEM terlebih dahulu!");
      return { ok: false, reason: "SYSTEM_OFF" };
    }

    const nextState = !state.connected;
    const api = window.MixerAdapters;

    // 2. Cobalah hubungkan via MixerAdapters jika tersedia
    if (api && typeof api.connectESP32 === "function") {
      try {
        const result = api.connectESP32({ systemOn: true });
        if (result && typeof result.then === "function") {
          return result.then(r => {
            setStatus({ connected: !!r?.connected, transport: r?.transport || "esp32" });
            return r;
          });
        }
      } catch (e) {
        console.warn("Adapter connect error, switching to direct simulator:", e);
      }
    }

    // 3. Fallback Simulator Langsung (Memastikan ESP32 BISA ON meskipun adapter tidak merespon)
    setStatus({
      connected: nextState,
      transport: nextState ? "esp32-simulator" : "none"
    });

    if (api && api.active) {
      api.active.connected = nextState;
      api.active.transport = nextState ? "esp32-simulator" : "none";
    }

    return { ok: true, connected: nextState };
  }

  function disconnectESP32() {
    window.MixerAdapters?.disconnect?.();
    setStatus({ connected: false, transport: "none" });
    return { ok: true, connected: false };
  }

  // DENGARKAN STATUS DARI ADAPTER JIKA ADA UPDATE
  window.MixerAdapters?.onStatus?.(s => {
    state.connected = !!s?.connected;
    state.transport = s?.transport || "none";
    state.lastRx = s?.lastRx || state.lastRx;
    setStatus({ connected: state.connected, transport: state.transport });
  });

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
      const result = api.sendMapped(command);
      if (result?.ok) {
        setStatus({ connected: true, transport: result.transport || "esp32" });
      }
      return result || { ok: true, transport: "esp32-simulator" };
    }

    return { ok: true, transport: "esp32-simulator" };
  }

  function applyRemote(message) {
    state.lastRx = message;
    cmdListeners.forEach(fn => fn({ ...message, direction: "RX" }));
    return true;
  }

  // OTOMATIS HUBUNGKAN EVENT LISTENER TOMBOL KETIKA DOM SIAP
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      const btnTop = document.getElementById("connectEsp");
      const btnDevice = document.getElementById("deviceConnect");

      const handleConnect = (e) => {
        if (e) e.preventDefault();
        connectESP32();
      };

      if (btnTop) btnTop.addEventListener("click", handleConnect);
      if (btnDevice) btnDevice.addEventListener("click", handleConnect);
    });
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
