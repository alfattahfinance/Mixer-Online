"use strict";

window.MixerControl = (() => {
  const listeners = new Set();
  const cmdListeners = new Set();

  const state = {
    connected: false,
    transport: "none",
    lastCommand: null,
    lastRx: null,
    _adapterBound: false
  };

  const emit = () => listeners.forEach(fn => {
    try { fn({ ...state }); } catch (e) { console.warn("MixerControl status listener:", e); }
  });

  const onStatus = fn => {
    listeners.add(fn);
    fn({ ...state });
    return () => listeners.delete(fn);
  };

  const onCommand = fn => {
    cmdListeners.add(fn);
    return () => cmdListeners.delete(fn);
  };

  // SINGLE SOURCE FOR CONTROL-LAYER CONNECTION STATE.
  function setStatus(x = {}) {
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

    if (statusText) {
      statusText.textContent = isConnected ? "ONLINE" : "OFFLINE";
      statusText.style.color = isConnected ? "#31e66b" : "";
    }
    if (statusLamp) statusLamp.className = isConnected ? "live" : "";
  }

  // CONTROL/UI LAYER:
  // This function NEVER implements simulator/hardware logic itself.
  // It delegates exactly once to MixerAdapters.connectESP32().
  async function connectESP32() {
    if (!window.state?.system) {
      setStatus({ connected: false, transport: "none" });
      return { ok: false, connected: false, reason: "SYSTEM_OFF" };
    }

    const api = window.MixerAdapters;
    if (!api || typeof api.connectESP32 !== "function") {
      setStatus({ connected: false, transport: "none" });
      return { ok: false, connected: false, reason: "adapter-unavailable" };
    }

    try {
      const adapterResult = await api.connectESP32({ systemOn: true });
      const isConnected = adapterResult?.connected === true;

      setStatus({
        connected: isConnected,
        transport: adapterResult?.transport || (isConnected ? "esp32" : "none"),
        lastRx: adapterResult?.lastRx || state.lastRx
      });

      return adapterResult || {
        ok: isConnected,
        connected: isConnected,
        transport: isConnected ? "esp32" : "none"
      };
    } catch (e) {
      console.warn("Gagal memanggil MixerAdapters.connectESP32:", e);
      setStatus({ connected: false, transport: "none" });
      return {
        ok: false,
        connected: false,
        reason: e?.message || String(e)
      };
    }
  }

  function disconnectESP32() {
    const api = window.MixerAdapters;
    try {
      if (api && typeof api.disconnect === "function") api.disconnect();
    } finally {
      setStatus({ connected: false, transport: "none" });
    }
    return { ok: true, connected: false };
  }

  // connection.js loads before adapters.js in index.html.
  // Bind after the adapter exists, and bind only once.
  function bindAdapterStatus() {
    const api = window.MixerAdapters;
    if (!api || typeof api.onStatus !== "function") return;
    if (state._adapterBound) return;

    state._adapterBound = true;
    api.onStatus(s => {
      const connected = !!s?.connected;
      setStatus({
        connected,
        transport: s?.transport || (connected ? "esp32" : "none"),
        lastRx: s?.lastRx || state.lastRx
      });
    });
  }

  bindAdapterStatus();
  window.addEventListener("load", bindAdapterStatus);

  function setControl(channel, control, value) {
    const ch = Number(channel);

    if (!Number.isInteger(ch) || ch < 1 || ch > 14) {
      return { ok: false, reason: "invalid-channel" };
    }

    const command = {
      type: "CONTROL",
      channel: String(ch),
      ch,
      param: String(control),
      control: String(control),
      value: Number.isFinite(Number(value)) ? Number(value) : value,
      time: Date.now()
    };

    state.lastCommand = command;
    cmdListeners.forEach(fn => {
      try { fn({ ...command, direction: "TX" }); } catch (e) {}
    });

    const api = window.MixerAdapters;
    if (!api?.active?.connected) {
      setStatus({
        connected: false,
        transport: "none"
      });
      return { ok: false, reason: "esp32-offline" };
    }

    if (typeof api.sendMapped !== "function") {
      return { ok: false, reason: "adapter-send-unavailable" };
    }

    const result = api.sendMapped(command);

    if (result?.ok) {
      setStatus({
        connected: true,
        transport: result.transport || "esp32"
      });
    }

    return result || { ok: false, reason: "adapter-rejected" };
  }

  function applyRemote(message) {
    state.lastRx = message;
    cmdListeners.forEach(fn => {
      try { fn({ ...message, direction: "RX" }); } catch (e) {}
    });
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