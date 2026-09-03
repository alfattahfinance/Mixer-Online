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

    // UI Panel Test
    const transportLabel = document.getElementById("testTransportLabel");
    const rxCount = document.getElementById("testRxCount");
    const txCount = document.getElementById("testTxCount");

    if (statusText) {
      statusText.textContent = isConnected ? "ONLINE" : "OFFLINE";
      statusText.style.color = isConnected ? "#31e66b" : "";
    }
    if (statusLamp) statusLamp.className = isConnected ? "live" : "";
    if (bridgeHead) {
      bridgeHead.textContent = isConnected ? "BRIDGE ONLINE" : "BRIDGE STANDBY";
    }
    if (deviceStatus) {
      deviceStatus.textContent = isConnected
        ? "🟢 ESP32 SIMULATOR ONLINE (ACTIVE)"
        : "🔴 ESP32 SIMULATOR OFFLINE";
    }
    if (deviceLamp) deviceLamp.className = isConnected ? "lamp green" : "lamp red";
    if (footerConn) {
      footerConn.textContent = isConnected
        ? "● ESP32 SIMULATOR ONLINE"
        : "● ESP32 SIMULATOR OFFLINE";
    }
    if (btnConnect) btnConnect.textContent = isConnected ? "DISCONNECT ESP32" : "CONNECT ESP32";
    if (btnDevice) btnDevice.textContent = isConnected ? "DISCONNECT" : "CONNECT ESP32";

    // Panel Connection/Test Updates
    if (transportLabel) {
      transportLabel.textContent = isConnected 
        ? `ESP32 BRIDGE ${state.transport.toUpperCase()} ONLINE` 
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

  function bindAdapterStatus() {
    const api = window.MixerAdapters;
    if (!api || typeof api.onStatus !== "function") return;
    if (state._adapterBound) return;
    
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
  }

  bindAdapterStatus();
  if (typeof window !== "undefined") {
    window.addEventListener("load", bindAdapterStatus);
    document.addEventListener("DOMContentLoaded", bindAdapterStatus);
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

  function applyRemote(message) {
    state.lastRx = message;
    cmdListeners.forEach(fn => fn({ ...message, direction: "RX" }));
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
