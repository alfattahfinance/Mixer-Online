"use strict";

window.MixerAdapters = (() => {
  const PROTOCOL = "ESP32-MIXER/1";
  const CHANNEL_COUNT = 14;
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
    channels: Array.from({ length: CHANNEL_COUNT }, (_, i) => ({
      ch: i + 1, fader: 75, gain: 1, low: 0, mid: 0, high: 0,
      pan: 0, mute: false, solo: false, level: 0
    })),
    master: 75,
    effects: {
      selected: "FX1",
      fx1: { preset: "HALL 1", type: "REVERB", time: 2.45, preDelay: 32, decay: 65, level: -3.0, tapBpm: 120 },
      fx2: { preset: "ROOM", type: "REVERB", time: 1.60, preDelay: 24, decay: 55, level: -6.0, tapBpm: 120 },
      aux: { AUX1: 0.0, AUX2: 0.0, AUX3: 0.0, AUX4: 0.0 },
      fxReturn: { FX1: 0.45, FX2: 0.45 }
    }
  });

  function loadSimulatorState() {
    try {
      const raw = localStorage.getItem(SIM_KEY);
      if (!raw) return defaults();
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved.channels) || saved.channels.length !== CHANNEL_COUNT) return defaults();
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
        master: Number(saved.master ?? 75),
        effects: {
          selected: saved.effects?.selected || "FX1",
          fx1: { preset: saved.effects?.fx1?.preset || "HALL 1", type: saved.effects?.fx1?.type || "REVERB", time: Number(saved.effects?.fx1?.time ?? 2.45), preDelay: Number(saved.effects?.fx1?.preDelay ?? 32), decay: Number(saved.effects?.fx1?.decay ?? 65), level: Number(saved.effects?.fx1?.level ?? -3), tapBpm: Number(saved.effects?.fx1?.tapBpm ?? 120) },
          fx2: { preset: saved.effects?.fx2?.preset || "ROOM", type: saved.effects?.fx2?.type || "REVERB", time: Number(saved.effects?.fx2?.time ?? 1.6), preDelay: Number(saved.effects?.fx2?.preDelay ?? 24), decay: Number(saved.effects?.fx2?.decay ?? 55), level: Number(saved.effects?.fx2?.level ?? -6), tapBpm: Number(saved.effects?.fx2?.tapBpm ?? 120) },
          aux: { AUX1: Number(saved.effects?.aux?.AUX1 ?? 0), AUX2: Number(saved.effects?.aux?.AUX2 ?? 0), AUX3: Number(saved.effects?.aux?.AUX3 ?? 0), AUX4: Number(saved.effects?.aux?.AUX4 ?? 0) },
          fxReturn: { FX1: Number(saved.effects?.fxReturn?.FX1 ?? .45), FX2: Number(saved.effects?.fxReturn?.FX2 ?? .45) }
        }
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
        connected: false, type: "simulator", transport: "esp32",
        name: "ESP32 SIMULATOR", protocol: PROTOCOL, channels: CHANNEL_COUNT, pending: 0,
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
        value: command.value,
        ...(command.scope ? { scope: String(command.scope) } : {}),
        ...(command.target ? { target: String(command.target) } : {}),
        ...(command.fx ? { fx: String(command.fx) } : {}),
        ...(command.bus ? { bus: String(command.bus) } : {})
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
    stopMeterSimulation();
    active = null;
    emitStatus();
  }

  // Physical ESP32 bridge mapping. Values are normalized by protocol;
  // the actual GPIO/ADC/DAC implementation is isolated behind this mapper.
  const PHYSICAL_CHANNELS = CHANNEL_COUNT;
  const PHYSICAL_PARAMS = ["fader","gain","low","mid","high","pan","mute","solo"];

  function mapRemoteToHardware(packet) {
    if (!packet || !active?.bridge) return { ok:false, reason:"bridge-offline" };
    if (packet.type === "MASTER")
      return { ok:true,target:"MASTER",value:Math.max(0,Math.min(100,Number(packet.value))) };
    if (packet.type !== "CONTROL")
      return { ok:false, reason:"unsupported-command" };

    const scope = packet.scope ? String(packet.scope) : "CHANNEL";
    const param = String(packet.param);
    const ranges = {
      fader:[0,100], gain:[0,2], low:[-12,12], mid:[-12,12],
      high:[-12,12], pan:[-1,1],
      time:[0.1,10], preDelay:[0,200], decay:[0,100], level:[-20,6],
      tapBpm:[40,240], auxLevel:[0,1], returnLevel:[0,1]
    };

    if (scope === "FX") {
      const fx = String(packet.target || packet.fx || "FX1");
      if (!["FX1","FX2"].includes(fx)) return { ok:false, reason:"invalid-fx" };
      if (!["preset","type","time","preDelay","decay","level","tapBpm"].includes(param))
        return { ok:false, reason:"unsupported-fx-control" };
      let value=packet.value;
      if (ranges[param]) {
        value=Number(value);
        if (!Number.isFinite(value)) return { ok:false,reason:"invalid-value" };
        value=Math.max(ranges[param][0],Math.min(ranges[param][1],value));
      } else value=String(value);
      return { ok:true,target:fx,scope,param,value };
    }

    if (scope === "AUX") {
      const bus=String(packet.target || packet.bus || "AUX1");
      if (!["AUX1","AUX2","AUX3","AUX4"].includes(bus)) return { ok:false,reason:"invalid-aux" };
      const value=Number(packet.value);
      if (!Number.isFinite(value)) return { ok:false,reason:"invalid-value" };
      return { ok:true,target:bus,scope,param:"auxLevel",value:Math.max(0,Math.min(1,value)) };
    }

    if (scope === "FX_RETURN") {
      const fx=String(packet.target || packet.fx || "FX1");
      if (!["FX1","FX2"].includes(fx)) return { ok:false,reason:"invalid-fx-return" };
      const value=Number(packet.value);
      if (!Number.isFinite(value)) return { ok:false,reason:"invalid-value" };
      return { ok:true,target:fx,scope,param:"returnLevel",value:Math.max(0,Math.min(1,value)) };
    }

    const ch=Number(packet.ch);
    if (!Number.isInteger(ch)||ch<1||ch>PHYSICAL_CHANNELS)
      return { ok:false,reason:"physical-channel-out-of-range" };
    if (!PHYSICAL_PARAMS.includes(param))
      return { ok:false,reason:"unsupported-physical-control" };
    let value=packet.value;
    if (ranges[param]) {
      value=Number(value);
      if (!Number.isFinite(value)) return { ok:false,reason:"invalid-value" };
      value=Math.max(ranges[param][0],Math.min(ranges[param][1],value));
    } else value=!!value;
    return { ok:true,target:`CH${ch}`,channel:ch,param,value,scope:"CHANNEL" };
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
    const scope=String(packet.scope||"CHANNEL");
    if (scope==="FX") {
      if (!["FX1","FX2"].includes(String(packet.target||packet.fx||"FX1"))) return "invalid-fx";
      if (!["preset","type","time","preDelay","decay","level","tapBpm"].includes(packet.param)) return "unsupported-fx-control";
      return null;
    }
    if (scope==="AUX") return ["AUX1","AUX2","AUX3","AUX4"].includes(String(packet.target||packet.bus||"")) ? null : "invalid-aux";
    if (scope==="FX_RETURN") return ["FX1","FX2"].includes(String(packet.target||packet.fx||"")) ? null : "invalid-fx-return";
    const allowed=["fader","gain","low","mid","high","pan","mute","solo"];
    if(!Number.isInteger(packet.ch)||packet.ch<1||packet.ch>14) return "invalid-channel";
    if(!allowed.includes(packet.param)) return "unsupported-control";
    return null;
  }

  function applyPacketToSimulator(packet) {
    if(!active?.state||active.type!=="simulator") return false;
    if(packet.type==="CONTROL"){
      const error=validateControl(packet);
      if(error) return false;
      const scope=String(packet.scope||"CHANNEL");
      const effects=active.state.effects ||= defaults().effects;

      if(scope==="FX"){
        const fx=String(packet.target||packet.fx||"FX1").toLowerCase();
        const key=fx==="fx2"?"fx2":"fx1";
        const ranges={time:[.1,10],preDelay:[0,200],decay:[0,100],level:[-20,6],tapBpm:[40,240]};
        if(["preset","type"].includes(packet.param)) effects[key][packet.param]=String(packet.value);
        else {
          const r=ranges[packet.param], n=Number(packet.value);
          if(!r||!Number.isFinite(n)) return false;
          effects[key][packet.param]=Math.max(r[0],Math.min(r[1],n));
        }
        effects.selected=fx.toUpperCase();
        saveSimulatorState();
        return true;
      }
      if(scope==="AUX"){
        const bus=String(packet.target||packet.bus);
        const n=Number(packet.value);
        if(!["AUX1","AUX2","AUX3","AUX4"].includes(bus)||!Number.isFinite(n)) return false;
        effects.aux[bus]=Math.max(0,Math.min(1,n));
        saveSimulatorState(); return true;
      }
      if(scope==="FX_RETURN"){
        const fx=String(packet.target||packet.fx);
        const n=Number(packet.value);
        if(!["FX1","FX2"].includes(fx)||!Number.isFinite(n)) return false;
        effects.fxReturn[fx]=Math.max(0,Math.min(1,n));
        saveSimulatorState(); return true;
      }

      const c=active.state.channels[packet.ch-1];
      const ranges={fader:[0,100],gain:[0,2],low:[-12,12],mid:[-12,12],high:[-12,12],pan:[-1,1]};
      if(ranges[packet.param]){
        const n=Number(packet.value); if(!Number.isFinite(n)) return false;
        c[packet.param]=Math.max(ranges[packet.param][0],Math.min(ranges[packet.param][1],n));
      } else c[packet.param]=!!packet.value;
      saveSimulatorState(); return true;
    }
    if(packet.type==="MASTER"){
      const n=Number(packet.value); if(!Number.isFinite(n)) return false;
      active.state.master=Math.max(0,Math.min(100,n)); saveSimulatorState(); return true;
    }
    return false;
  }

  // Hardware -> bridge -> Mixer-Online feedback path.
  // Physical ESP32 will call this with values read from the analog mixer.
  function hardwareFeedback(ch, param, value, extra = {}) {
    if(!active?.connected||!active?.bridge) return {ok:false,reason:"bridge-offline"};
    const scope=String(extra.scope||"CHANNEL");
    const packet={
      protocol:PROTOCOL,type:"FEEDBACK",
      ...(scope==="CHANNEL"?{ch:Number(ch)}:{}),
      ...(extra.target?{target:String(extra.target)}:{}),
      ...(extra.fx?{fx:String(extra.fx)}:{}),
      ...(extra.bus?{bus:String(extra.bus)}:{}),
      scope,param:String(param),value,source:"hardware",
      device:"ESP32-BRIDGE",transport:active.transport,ts:Date.now(),
      ...extra
    };
    active.bridge.feedback=active.bridge.feedback||[];
    active.bridge.feedback.push(packet);
    if(active.bridge.feedback.length>100) active.bridge.feedback.shift();
    emitRx(packet); return {ok:true,packet};
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
    if(!active?.connected||active.type!=="simulator") return false;
    const mapped=bridgeApply(packet);
    const ok=mapped.ok&&applyPacketToSimulator(packet);
    const now=Date.now();
    const ack={protocol:PROTOCOL,type:"ACK",ack:packet.id,ok,ts:now,device:"ESP32-SIMULATOR",transport:"esp32",...(ok?{}:{error:mapped.reason||"simulator-rejected"})};
    active.ack.push(ack); active.lastAck=ack; active.pending.delete(packet.id); emitRx(ack);
    if(ok){
      const fb={
        protocol:PROTOCOL,type:"FEEDBACK",
        ...(packet.scope==="CHANNEL"||!packet.scope?{ch:packet.ch}:{}),
        ...(packet.scope&&packet.scope!=="CHANNEL"?{scope:packet.scope,target:packet.target||packet.fx||packet.bus}:{}),
        ...(packet.scope==="CHANNEL"?{scope:"CHANNEL"}:{}),
        param:packet.param,value:mapped.value??packet.value,
        source:"simulator",ack:packet.id,rev:packet.rev,ts:Date.now(),
        device:"ESP32-SIMULATOR",transport:"esp32"
      };
      emitRx(fb);
    }
    emitStatus(); return ok;
  }

  function getTransportStats(){if(!active)return {connected:false,transport:"none",tx:0,rx:0,ack:0,pending:0};return {connected:!!active.connected,transport:active.transport||active.type||"none",tx:active.tx?.length||0,rx:active.rx?.length||0,ack:active.ack?.length||0,pending:active.pending?.size||0};}\n\n  function sendMapped(command) {
    if(!active?.connected) return {ok:false,reason:"offline"};
    if(command.type!=="CONTROL"&&command.type!=="MASTER") return {ok:false,reason:"unsupported-type"};
    if(command.type==="CONTROL"){
      const candidate={
        ch:Number(command.ch??command.channel),
        param:String(command.param??command.control),
        scope:String(command.scope||"CHANNEL"),
        target:command.target||command.fx||command.bus
      };
      const error=validateControl(candidate);
      if(error) return {ok:false,reason:error};
    }
    const packet=makePacket({
      type:command.type,
      ch:Number(command.ch??command.channel),
      param:String(command.param??command.control),
      value:command.value,
      scope:command.scope,
      target:command.target,
      fx:command.fx,
      bus:command.bus,
      rev:command.rev??null
    });
    active.lastTx=packet; active.tx.push(packet); active.pending.set(packet.id,packet); emitStatus();
    if(active.type==="simulator"){const ok=receiveSimulator(packet);if(!ok)return {ok:false,reason:"simulator-rejected",transport:"esp32",tx:packet};return {ok:true,transport:"esp32",tx:packet};}
    if(active.type==="bluetooth") return sendBluetooth(packet);
    active.pending.delete(packet.id); return {ok:false,reason:"unsupported-transport"};
  }

  function sendBluetooth(packet) {
    if (!active?.write)
      return { ok: false, reason: "bluetooth-write-characteristic-unavailable" };

    const data = new TextEncoder().encode(JSON.stringify(packet) + "\n");
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

  let meterTimer = null;
  function stopMeterSimulation(){if(meterTimer){clearInterval(meterTimer);meterTimer=null;}}
  function startMeterSimulation(){
    stopMeterSimulation();
    meterTimer=setInterval(()=>{
      if(!active?.connected||active.type!=="simulator"){stopMeterSimulation();return;}
      const now=Date.now()/1000;
      active.state.channels.forEach((c,i)=>{
        const gate=c.mute?0:1;
        const base=(Number(c.fader)/100)*(Number(c.gain)/2);
        const wave=(Math.sin(now*5+i*.71)+1)/2;
        const level=Math.max(0,Math.min(2,base*(0.25+0.75*wave)*gate));
        c.level=Number(level.toFixed(3));
        emitRx({protocol:PROTOCOL,type:"METER",ch:i+1,level:c.level,source:"simulator",device:"ESP32-SIMULATOR",transport:"esp32",ts:Date.now()});
      });
      saveSimulatorState();
    },80);
  }

  async function connectESP32(options = {}) {
    const systemOn = options.systemOn ?? !!window.state?.system;
    if (!systemOn) return { ok:false, connected:false, reason:"SYSTEM_OFF", type:"simulator", transport:"esp32", protocol:PROTOCOL, channels:CHANNEL_COUNT };
    if (active?.type === "simulator" && active.connected) return {
      ok:true, connected:true, type:"simulator", transport:"esp32",
      name:"ESP32 SIMULATOR", channels:CHANNEL_COUNT, protocol:PROTOCOL
    };
    const result = await simulator();
    return result?.connected ? {
      ok:true, connected:true, type:"simulator", transport:"esp32",
      name:"ESP32 SIMULATOR", channels:CHANNEL_COUNT, protocol:PROTOCOL
    } : {ok:false,connected:false,reason:"esp32-simulator-offline"};
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
      bridge: { mode:"two-way", target:"analog-mixer", physicalChannels:CHANNEL_COUNT, commands:[], feedback:[] },
      startedAt: Date.now(),
      lastTx: null,
      lastRx: null,
      lastAck: null,
      lastError: null
    });
    startMeterSimulation();

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

      if (!write) {
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
          const lines = connection.buffer.split(/\r?\n/);
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
    connectESP32,
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