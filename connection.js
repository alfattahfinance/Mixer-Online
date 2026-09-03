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

  // FUNGSI LAYER CONTROL/UI — hanya meneruskan ke MixerAdapters.
  // Nama method publik tetap connectESP32 agar index.html tidak perlu diubah.
  async function connectESP32() {
    if (!window.state?.system) {
      return { ok: false, connected: false, reason: "SYSTEM_OFF" };
    }

    const api = window.MixerAdapters;
    if (!api || typeof api.connectESP32 !== "function") {
      setStatus({ connected: false, transport: "esp32" });
      return { ok: false, connected: false, reason: "adapter-unavailable" };
    }

    try {
      const adapterResult = await api.connectESP32({ systemOn: true });
      const isConnected = adapterResult?.connected === true;

      setStatus({
        connected: isConnected,
        transport: adapterResult?.transport || (isConnected ? "esp32" : "none")
      });

      return adapterResult || {
        ok: isConnected,
        connected: isConnected,
        transport: isConnected ? "esp32" : "none"
      };
    } catch (e) {
      console.warn("Gagal memanggil MixerAdapters.connectESP32:", e);
      setStatus({ connected: false, transport: "esp32" });
      return { ok: false, connected: false, reason: e?.message || String(e) };
    }
  }

  function disconnectESP32() {
    const api = window.MixerAdapters;
    try { api?.disconnect?.(); } finally {
      setStatus({ connected: false, transport: "none" });
    }
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

  // Tombol UI ditangani oleh index.html agar tidak ada listener ganda.\n
