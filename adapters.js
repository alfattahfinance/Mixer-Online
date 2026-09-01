"use strict";
window.MixerAdapters=(()=>{
  let active=null;
  const listeners=new Set();
  const emit=s=>listeners.forEach(fn=>fn({...s}));
  const BLE={
    UART_SERVICE:"6e400001-b5a3-f393-e0a9-e50e24dcca9e",
    UART_RX:"6e400002-b5a3-f393-e0a9-e50e24dcca9e",
    UART_TX:"6e400003-b5a3-f393-e0a9-e50e24dcca9e",
    HM_SERVICE:"0000ffe0-0000-1000-8000-00805f9b34fb",
    HM_CHAR:"0000ffe1-0000-1000-8000-00805f9b34fb"
  };
  const emitStatus=()=>emit(active?{
    connected:active.connected,type:active.type,transport:active.transport,
    name:active.name,protocol:active.protocol
  }:{
    connected:false,type:"none",transport:"none",name:"OFFLINE",protocol:"none"
  });
  const onStatus=fn=>(listeners.add(fn),emitStatus(),()=>listeners.delete(fn));
  function setConnected(a){active=a;emitStatus()}

  // Internal ESP32 simulator: no Wokwi, no external server.
  // It mirrors the protocol that the future physical ESP32 will use.
  async function simulator(){
    if(active?.type==="simulator"&&active.connected)return active;
    if(active?.connected)disconnect();
    const channels=Array.from({length:18},(_,i)=>({
      ch:i+1,fader:75,gain:1,low:0,mid:0,high:0,pan:0,mute:false,solo:false,level:0
    }));
    setConnected({
      type:"simulator",
      name:"ESP32 SIMULATOR",
      connected:true,
      transport:"esp32",
      protocol:"ESP32-JSON",
      tx:[],
      rx:[],
      state:{channels,master:75},
      startedAt:Date.now()
    });
    return active;
  }

  function disconnect(){
    try{active?.device?.gatt?.disconnect()}catch{}
    active=null;
    emitStatus();
  }

  function echoSimulator(packet){
    if(!active?.connected||active.type!=="simulator")return;
    const p={...packet,direction:"RX",device:"ESP32-SIMULATOR",transport:"esp32"};
    active.rx.push(p);
    if(p.type==="CONTROL"&&p.ch>=1&&p.ch<=18){
      const c=active.state.channels[p.ch-1];
      if(c&&p.param in c)c[p.param]=p.value;
    }else if(p.type==="MASTER"){
      active.state.master=p.value;
    }
    window.MixerControl?.applyRemote?.(p);
    document.dispatchEvent(new CustomEvent("mixer:esp32-rx",{detail:p}));
    emitStatus();
  }

  function sendMapped(command){
    if(!active?.connected)return{ok:false,reason:"offline"};
    const normalized=command.type==="CONTROL"
      ?{type:"CONTROL",ch:command.ch??command.channel,param:command.param??command.control,value:command.value}
      :command.type==="MASTER"
      ?{type:"MASTER",value:command.value}
      :command;
    const packet={...normalized,direction:"TX",time:Date.now()};

    if(active.type==="simulator"){
      active.tx.push(packet);
      if(packet.type==="CONTROL"&&packet.ch>=1&&packet.ch<=18){
        const c=active.state.channels[packet.ch-1];
        if(c&&packet.param in c)c[packet.param]=packet.value;
      }else if(packet.type==="MASTER"){
        active.state.master=packet.value;
      }
      queueMicrotask(()=>echoSimulator(packet));
      emitStatus();
      return{ok:true,transport:"esp32",tx:packet};
    }
    if(active.type==="bluetooth")return sendBluetooth(packet);
    return{ok:false,reason:"unsupported-transport"};
  }

  function sendBluetooth(packet){
    if(!active?.write)return{ok:false,reason:"bluetooth-write-characteristic-unavailable"};
    const text=JSON.stringify(packet)+"\n";
    const bytes=new TextEncoder().encode(text);
    const write=active.write.writeValueWithoutResponse||active.write.writeValue;
    const result=write.call(active.write,bytes);
    if(result?.then)result.catch(err=>{
      active.lastError=err?.message||String(err);emitStatus();
    });
    emit({connected:true,type:"bluetooth",transport:"bluetooth",name:active.name,protocol:active.protocol,lastTx:packet});
    return{ok:true,transport:"bluetooth",tx:packet};
  }

  async function connectBluetooth(){
    if(!navigator.bluetooth)return{ok:false,reason:"web-bluetooth-unsupported"};
    try{
      const device=await navigator.bluetooth.requestDevice({
        acceptAllDevices:true,optionalServices:[BLE.UART_SERVICE,BLE.HM_SERVICE]
      });
      const server=await device.gatt.connect();
      let service=null,write=null,notify=null;
      for(const uuid of [BLE.UART_SERVICE,BLE.HM_SERVICE]){
        try{service=await server.getPrimaryService(uuid);if(service)break}catch{}
      }
      if(service){
        try{write=await service.getCharacteristic(BLE.UART_RX)}catch{}
        if(!write)try{write=await service.getCharacteristic(BLE.HM_CHAR)}catch{}
        try{notify=await service.getCharacteristic(BLE.UART_TX)}catch{}
      }
      if(!write||!notify){
        try{
          const services=await server.getPrimaryServices();
          for(const s of services){
            const chars=await s.getCharacteristics();
            for(const c of chars){
              if(!write&&(c.properties.write||c.properties.writeWithoutResponse))write=c;
              if(!notify&&c.properties.notify)notify=c;
            }
            if(write&&notify)break;
          }
        }catch{}
      }
      if(!write)throw new Error("BLE tidak memiliki characteristic WRITE");
      const a={
        type:"bluetooth",name:device.name||"BLUETOOTH MIXER",connected:true,
        transport:"bluetooth",protocol:"BLE-JSON",device,server,write,notify,buffer:""
      };
      if(notify){
        await notify.startNotifications();
        notify.addEventListener("characteristicvaluechanged",e=>{
          const data=new TextDecoder().decode(e.target.value);
          a.buffer+=data;
          const lines=a.buffer.split(/\r?\n/);
          a.buffer=lines.pop()||"";
          for(const line of lines){
            if(!line.trim())continue;
            try{
              const rx={...JSON.parse(line),direction:"RX",device:a.name,transport:"bluetooth"};
              a.lastRx=rx;
              window.MixerControl?.applyRemote?.(rx);
              document.dispatchEvent(new CustomEvent("mixer:bluetooth-rx",{detail:rx}));
            }catch{}
          }
        });
      }
      device.addEventListener("gattserverdisconnected",()=>{
        if(active===a){a.connected=false;emitStatus()}
      });
      setConnected(a);
      return{ok:true,transport:"bluetooth",name:a.name,protocol:a.protocol};
    }catch(e){
      return{ok:false,reason:e?.message||String(e)};
    }
  }

  return{
    simulator,disconnect,sendMapped,connectBluetooth,onStatus,
    get active(){return active},
    supportsBluetooth:()=>!!navigator.bluetooth
  };
})();