/* Universal Mixer Control Engine
   Layer for future USB / MIDI / WebSocket / Bluetooth adapters.
   Browser Bluetooth support is device/protocol dependent; audio Bluetooth
   is not treated as mixer control. */

window.MixerControl = (() => {
  const listeners = new Set();
  const state = { connected:false, transport:"none", deviceName:"Belum terhubung", protocol:"none" };
  function emit(){ listeners.forEach(fn=>fn({...state})); }
  function onStatus(fn){ listeners.add(fn); fn({...state}); return ()=>listeners.delete(fn); }
  function setStatus(patch){ Object.assign(state,patch); emit(); }
  async function connectWebBluetooth(){
    if(!navigator.bluetooth) throw new Error("Web Bluetooth tidak didukung browser ini");
    // Discovery is intentionally not hard-coded to a brand/model.
    const device = await navigator.bluetooth.requestDevice({acceptAllDevices:true, optionalServices:[]});
    setStatus({connected:true,transport:"bluetooth",deviceName:device.name||"Bluetooth device",protocol:"pending"});
    device.addEventListener?.("gattserverdisconnected",()=>setStatus({connected:false,transport:"none",deviceName:"Terputus",protocol:"none"}));
    return device;
  }
  function disconnect(){ setStatus({connected:false,transport:"none",deviceName:"Belum terhubung",protocol:"none"}); }
  function sendControl(message){ 
    if(!state.connected) return {ok:false,error:"Belum ada perangkat kontrol terhubung"};
    return {ok:false,error:"Adapter protokol perangkat belum dipilih",message};
  }
  return {get state(){return {...state}},onStatus,connectWebBluetooth,disconnect,sendControl};
})();