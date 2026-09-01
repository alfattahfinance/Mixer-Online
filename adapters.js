"use strict";

window.MixerAdapters = (() => {
  const PROTOCOL = "ESP32-MIXER/1";
  const SIM_KEY = "mixer_online_esp32_simulator_v1";
  const listeners = new Set();
  let active = null;
  let sequence = 0;

  const BLE = {
    UART_SERVICE: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
    UART_RX: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
    UART_TX: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
    HM_SERVICE: "0000ffe0-0000-1000-8000-00805f9b34fb",
    HM_CHAR: "0000ffe1-0000-1000-8000-00805f9b34fb"
  };

  const defaults = () => ({
    channels: Array.from({ length: 18 }, (_, i) => ({
      ch: i + 1, fader: 75, gain: 1, low: 0, mid: 0, high: 0,
      pan: 0, mute: false, solo: false, level: 0
    })),
    master: 75
  });

  function loadSimulatorState() {
    try {
      const raw = localStorage.getItem(SIM_KEY);
      if (!raw) return defaults();
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved.channels) || saved.channels.length !== 18) return defaults();
      return {
        channels: saved.channels.map((c, i) => ({
          ch: i + 1,
          fader: Number(c.fader ?? 75),
          gain: Number(c.gain ?? 1),
          low: Number(c.low ?? 0),
          mid: Number(c.mid ?? 0),
          high: Number(c.high ?? 0),
          pan: Number(c.pan ?? 0),
          mute: !!c.mute,
          solo: !!c.solo,
          level: Number(c.level ?? 0)
        })),
        master: Number(saved.master ?? 75)
      };
    } catch {
      return defaults();
    }
  }

  function saveSimulatorState() {
    if (!active?.state || active.type !== "simulator") return;
    try {
      localStorage.setItem(SIM_KEY, JSON.stringify(active.state));
    } catch {}
  }

  const emit = value => listeners.forEach(fn => {
    try { fn({ ...value }); } catch {}
  });

  function status() {
    if (!active) {
      return {
        connected: false, type: "none", transport: "none",
        name: "OFFLINE", protocol: "none", pending: 0,
        lastTx: null, lastRx: null, lastAck: null, lastError: null
      };
    }
    return {
      connected: !!active.connected,
      type: active.type,
      transport: active.transport,
      name: active.name,
      protocol: active.protocol || PROTOCOL,
      pending: active.pending?.size || 0,
      lastTx: active.lastTx || null,
      lastRx: active.lastRx || null,
      lastAck: active.lastAck || null,
      lastError: active.lastError || null
    };
  }

  const emitStatus = () => emit(status());

  function onStatus(fn) {
    listeners.add(fn);
    try { fn(status()); } catch {}
    return () => listeners.delete(fn);
  }

  function setActive(connection) {
    if (connection && !connection.pending) connection.pending = new Map();
    active = connection;
    emitStatus();
  }

  function makePacket(command) {
    const ts = Date.now();
    sequence = (sequence + 1) % 1000000;
    return {
      protocol: PROTOCOL,
      id: ts.toString(36) + "-" + sequence.toString(36),
      type: command.type,
      ...(command.type === "CONTROL" ? {
        ch: Number(command.ch),
        param: String(command.param),
        value: command.value
      } : {}),
      ...(command.type === "MASTER" ? {
        value: Number(command.value)
      } : {}),
      rev: command.rev ?? null,
      ts,
      direction: "TX"
    };
  }

  function disconnect() {
    try { active?.device?.gatt?.disconnect(); } catch {}
    active = null;
    emitStatus();
  }

  // Physical ESP32 bridge mapping. Values are normalized by protocol;
  // the actual GPIO/ADC/DAC implementation is isolated behind this mapper.
  const PHYSICAL_CHANNELS = 4;
  const PHYSICAL_PARAMS = ["fader","gain","low","mid","high","pan","mute","solo"];

  function mapRemoteToHardware(packet) {
    if (!packet || !active?.bridge) return { ok:false, reason:"bridge-offline" };
    if (packet.type === "MASTER")
      return { ok:true, target:"MASTER", value:Math.max(0,Math.min(100,Number(packet.value))) };

    if (packet.type !== "CONTROL")
      return { ok:false, reason:"unsupported-command" };

    const ch = Number(packet.ch);
    const param = String(packet.param);
    if (!Number.isInteger(ch) || ch < 1 || ch > PHYSICAL_CHANNELS)
      return { ok:false, reason:"physical-channel-out-of-range" };
    if (!PHYSICAL_PARAMS.includes(param))
      return { ok:false, reason:"unsupported-physical-control" };

    const range = {
      fader:[0,100], gain:[0,2], low:[-12,12], mid:[-12,12],
      high:[-12,12], pan:[-1,1]
    }[param];

    let value = packet.value;
    if (range) {
      value = Number(value);
      if (!Number.isFinite(value)) return { ok:false,reason:"invalid-value" };
      value = Math.max(range[0],Math.min(range[1],value));
    } else value = !!value;

    return { ok:true,target:`CH${ch}`,channel:ch,param,value };
  }

  function bridgeApply(packet) {
    const mapped = mapRemoteToHardware(packet);
    if (!mapped.ok) return mapped;
    // The simulator records the hardware-facing command. A future physical
    // ESP32 can consume exactly this command without changing Mixer-Online.
    active.bridge.commands.push({
      ...mapped,
      sourceId: packet.id,
      protocol: PROTOCOL,
      ts: Date.now()
    });
    return mapped;
  }

  function validateControl(packet) {
    const allowed = ["fader", "gain", "low", "mid", "high", "pan", "mute", "solo"];
    if (!Number.isInteger(packet.ch) || packet.ch < 1 || packet.ch > 18)
      return "invalid-channel";
    if (!allowed.includes(packet.param))
      return "unsupported-control";
    return null;
  }

  function applyPacketToSimulator(packet) {
    if (!active?.state || active.type !== "simulator") return false;

    if (packet.type === "CONTROL") {
      const error = validateControl(packet);
      if (error) return false;

      const c = active.state.channels[packet.ch - 1];
      const ranges = {
        fader: [0, 100], gain: [0, 2], low: [-12, 12],
        mid: [-12, 12], high: [-12, 12], pan: [-1, 1]
      };

      if (ranges[packet.param]) {
        const n = Number(packet.value);
        if (!Number.isFinite(n)) return false;
        c[packet.param] = Math.max(ranges[packet.param][0],
          Math.min(ranges[packet.param][1], n));
      } else {
        c[packet.param] = !!packet.value;
      }
      saveSimulatorState();
      return true;
    }

    if (packet.type === "MASTER") {
      const n = Number(packet.value);
      if (!Number.isFinite(n)) return false;
      active.state.master = Math.max(0, Math.min(100, n));
      saveSimulatorState();
      return true;
    }

    return false;
  }

  // Hardware -> bridge -> Mixer-Online feedback path.
  // Physical ESP32 will call this with values read from the analog mixer.
  function hardwareFeedback(ch, param, value, extra = {}) {
    if (!active?.connected || !active?.bridge)
      return { ok:false, reason:"bridge-offline" };

    const channel = Number(ch);
    const allowed = PHYSICAL_PARAMS;
    if (param !== "master" && (!Number.isInteger(channel) || channel < 1 || channel > PHYSICAL_CHANNELS))
      return { ok:false, reason:"physical-channel-out-of-range" };
    if (param !== "master" && !allowed.includes(param))
      return { ok:false, reason:"unsupported-physical-control" };

    const packet = {
      protocol: PROTOCOL,
      type: "FEEDBACK",
      ...(param === "master" ? {} : { ch: channel }),
      param: String(param),
      value,
      source: "hardware",
      device: "ESP32-BRIDGE",
      transport: active.transport,
      ts: Date.now(),
      ...extra
    };

    active.bridge.feedback = active.bridge.feedback || [];
    active.bridge.feedback.push(packet);
    if (active.bridge.feedback.length > 100) active.bridge.feedback.shift();
    emitRx(packet);
    return { ok:true, packet };
  }

  function simulateHardwareChange(ch, param, value) {
    if (!active?.state || active.type !== "simulator")
      return { ok:false, reason:"simulator-offline" };
    const packet = hardwareFeedback(ch, param, value, { simulated:true });
    if (!packet.ok) return packet;
    if (param === "master") active.state.master = Number(value);
    else {
      const c = active.state.channels[Number(ch)-1];
      if (c) c[param] = value;
    }
    saveSimulatorState();
    return packet;
  }

  function emitRx(packet) {
    if (!active?.connected) return false;
    active.rx.push(packet);
    active.lastRx = packet;
    emitStatus();

    document.dispatchEvent(new CustomEvent(
      active.type === "bluetooth" ? "mixer:bluetooth-rx" : "mixer:esp32-rx",
      { detail: packet }
    ));
    return true;
  }

  function receiveSimulator(packet) {
    if (!active?.connected || active.type !== "simulator") return false;

    const mapped = bridgeApply(packet);
    const ok = mapped.ok && applyPacketToSimulator(packet);
    const now = Date.now();

    const ack = {
      protocol: PROTOCOL,
      type: "ACK",
      ack: packet.id,
      ok,
      ts: now,
      device: "ESP32-SIMULATOR",
      transport: "esp32",
      ...(ok ? {} : { error: mapped.reason || "simulator-rejected" })
    };

    active.ack.push(ack);
    active.lastAck = ack;
    active.pending.delete(packet.id);
    emitRx(ack);

    if (ok && packet.type === "CONTROL") {
      emitRx({
        protocol: PROTOCOL,
        type: "FEEDBACK",
        ch: packet.ch,
        param: packet.param,
        value: active.state.channels[packet.ch - 1][packet.param],
        source: "simulator",
        ack: packet.id,
        rev: packet.rev,
        ts: Date.now(),
        device: "ESP32-SIMULATOR",
        transport: "esp32"
      });
    } else if (ok && packet.type === "MASTER") {
      emitRx({
        protocol: PROTOCOL,
        type: "FEEDBACK",
        param: "master",
        value: active.state.master,
        source: "simulator",
        ack: packet.id,
        rev: packet.rev,
        ts: Date.now(),
        device: "ESP32-SIMULATOR",
        transport: "esp32"
      });
    }

    emitStatus();
    return ok;
  }

  function sendMapped(command) {
    if (!active?.connected)
      return { ok: false, reason: "offline" };

    if (command.type !== "CONTROL" && command.type !== "MASTER")
      return { ok: false, reason: "unsupported-type" };

    if (command.type === "CONTROL") {
      const error = validateControl({
        ch: Number(command.ch ?? command.channel),
        param: String(command.param ?? command.control)
      });
      if (error) return { ok: false, reason: error };
    }

    const packet = makePacket({
      type: command.type,
      ch: Number(command.ch ?? command.channel),
      param: String(command.param ?? command.control),
      value: command.value,
      rev: command.rev ?? null
    });

    active.lastTx = packet;
    active.tx.push(packet);
    active.pending.set(packet.id, packet);
    emitStatus();

    if (active.type === "simulator") {
      queueMicrotask(() => receiveSimulator(packet));
      return { ok: true, transport: "esp32", tx: packet };
    }

    if (active.type === "bluetooth")
      return sendBluetooth(packet);

    active.pending.delete(packet.id);
    return { ok: false, reason: "unsupported-transport" };
  }

  function sendBluetooth(packet) {
    if (!active?.write)
      return { ok: false, reason: "bluetooth-write-characteristic-unavailable" };

    const data = new TextEncoder().encode(JSON.stringify(packet) + "
");
    const writer = active.write.writeValueWithoutResponse || active.write.writeValue;

    try {
      const result = writer.call(active.write, data);
      if (result?.catch) {
        result.catch(error => {
          if (!active) return;
          active.pending.delete(packet.id);
          active.lastError = error?.message || String(error);
          emitStatus();
        });
      }
      return { ok: true, transport: "bluetooth", tx: packet };
    } catch (error) {
      active.pending.delete(packet.id);
      active.lastError = error?.message || String(error);
      emitStatus();
      return { ok: false, reason: active.lastError };
    }
  }

  function handleBluetoothRx(packet) {
    if (!active?.connected) return false;
    if (packet.type === "ACK" && packet.ack)
      active.pending.delete(packet.ack);
    return emitRx(packet);
  }

  async function simulator() {
    if (active?.type === "simulator" && active.connected)
      return active;

    if (active?.connected) disconnect();

    const state = loadSimulatorState();

    setActive({
      type: "simulator",
      name: "ESP32 SIMULATOR",
      connected: true,
      transport: "esp32",
      protocol: PROTOCOL,
      state,
      tx: [],
      rx: [],
      ack: [],
      pending: new Map(),
      startedAt: Date.now(),
      lastTx: null,
      lastRx: null,
      lastAck: null,
      lastError: null
    });

    return active;
  }

  async function connectBluetooth() {
    if (!navigator.bluetooth)
      return { ok: false, reason: "web-bluetooth-unsupported" };

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [BLE.UART_SERVICE, BLE.HM_SERVICE]
      });
      const server = await device.gatt.connect();

      let service = null;
      let write = null;
      let notify = null;

      for (const uuid of [BLE.UART_SERVICE, BLE.HM_SERVICE]) {
        try {
          service = await server.getPrimaryService(uuid);
          if (service) break;
        } catch {}
      }

      if (service) {
        try { write = await service.getCharacteristic(BLE.UART_RX); } catch {}
        if (!write) try { write = await service.getCharacteristic(BLE.HM_CHAR); } catch {}
        try { notify = await service.getCharacteristic(BLE.UART_TX); } catch {}
      }

      if (!write || !notify) {
        try {
          for (const s of await server.getPrimaryServices()) {
            for (const c of await s.getCharacteristics()) {
              if (!write && (c.properties.write || c.properties.writeWithoutResponse)) write = c;
              if (!notify && c.properties.notify) notify = c;
            }
            if (write && notify) break;
          }
        } catch {}
      }

      if (!write)
        throw new Error("BLE tidak memiliki characteristic WRITE");

      const connection = {
        type: "bluetooth",
        name: device.name || "BLUETOOTH MIXER",
        connected: true,
        transport: "bluetooth",
        protocol: PROTOCOL,
        device, server, write, notify,
        buffer: "",
        pending: new Map(),
        tx: [], rx: [], ack: []
      };

      if (notify) {
        await notify.startNotifications();
        notify.addEventListener("characteristicvaluechanged", event => {
          const chunk = new TextDecoder().decode(event.target.value);
          connection.buffer += chunk;
          const lines = connection.buffer.split(/\r?
/);
          connection.buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              handleBluetoothRx({
                ...JSON.parse(line),
                direction: "RX",
                device: connection.name,
                transport: "bluetooth"
              });
            } catch {}
          }
        });
      }

      device.addEventListener("gattserverdisconnected", () => {
        if (active === connection) {
          connection.connected = false;
          connection.lastError = "Bluetooth device disconnected";
          emitStatus();
        }
      });

      setActive(connection);
      return { ok: true, transport: "bluetooth", name: connection.name, protocol: PROTOCOL };
    } catch (error) {
      return { ok: false, reason: error?.message || String(error) };
    }
  }

  return {
    simulator,
    disconnect,
    sendMapped,
    connectBluetooth,
    onStatus,
    get active() { return active; },
    get protocol() { return PROTOCOL; },
    supportsBluetooth: () => !!navigator.bluetooth,
    getSimulatorState: () => active?.type === "simulator" ? active.state : loadSimulatorState(),
    getBridgeStatus: () => active?.bridge ? { ...active.bridge, commands: active.bridge.commands.slice(-50), feedback: (active.bridge.feedback||[]).slice(-50) } : null,
    hardwareFeedback,
    simulateHardwareChange,
    resetSimulatorState: () => {
      try { localStorage.removeItem(SIM_KEY); } catch {}
      if (active?.type === "simulator") {
        active.state = defaults();
        emitStatus();
      }
    }
  };
})();