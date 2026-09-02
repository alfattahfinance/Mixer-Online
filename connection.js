"use strict";window.MixerControl=(()=>{const listeners=new Set(),cmdListeners=new Set();const state={connected:false,transport:"none",lastCommand:null,lastRx:null};const emit=()=>listeners.forEach(fn=>fn({...state}));const onStatus=fn=>(listeners.add(fn),fn({...state}),()=>listeners.delete(fn));const onCommand=fn=>(cmdListeners.add(fn),()=>cmdListeners.delete(fn));function setStatus(x){Object.assign(state,x);emit()}function setControl(channel,control,value){const command={type:"mixer-control",channel:String(channel),control:String(control),value:Number.isFinite(Number(value))?Number(value):value,time:Date.now()};state.lastCommand=command;cmdListeners.forEach(fn=>fn({...command,direction:"TX"}));const result=window.MixerAdapters?.sendMapped(command);if(result?.ok)setStatus({connected:true,transport:result.transport||"unknown"});return result||{ok:false,reason:"adapter-unavailable"}}function applyRemote(message){state.lastRx=message;cmdListeners.forEach(fn=>fn({...message,direction:"RX"}));return true}return{state,onStatus,onCommand,setStatus,setControl,applyRemote}})();
/* Single ESP32 simulator UI connection owner. */
(function(){
  "use strict";
  function paint(online){
    const b=document.getElementById("connectEsp");
    const st=document.getElementById("status");
    const lamp=document.getElementById("statusLamp");
    const hs=document.getElementById("headerBridgeStatus");
    if(b)b.textContent=online?"DISCONNECT ESP32":"CONNECT ESP32";
    if(st)st.textContent=online?"ONLINE":"OFFLINE";
    if(lamp)lamp.classList.toggle("live",online);
    if(hs)hs.textContent=online?"BRIDGE ONLINE":"BRIDGE STANDBY";
  }
  function install(){
    const b=document.getElementById("connectEsp");
    if(!b)return;
    b.addEventListener("click",async function(e){
      e.preventDefault(); e.stopPropagation();
      const out=document.getElementById("testResult");
      const M=window.MixerAdapters;
      if(!M||typeof M.simulator!=="function"){
        if(out)out.textContent="DEVICE CONNECTION FAILED: ADAPTER NOT LOADED";
        return;
      }
      try{
        if(M.active?.connected){
          M.disconnect();
          window.state.connected=false;
          if(window.state.sim)window.state.sim.online=false;
          paint(false);
          if(out)out.textContent="DEVICE DISCONNECTED: ESP32 SIMULATOR";
          return;
        }
        const r=await M.simulator();
        if(!r?.connected)throw new Error(r?.reason||"Simulator gagal aktif");
        window.state.connected=true;
        window.state.sim=window.state.sim||{};
        window.state.sim.online=true;
        paint(true);
        if(out)out.textContent="DEVICE CONNECTED: ESP32 SIMULATOR • 16CH • TWO-WAY";
      }catch(err){
        window.state.connected=false;
        if(window.state.sim)window.state.sim.online=false;
        paint(false);
        if(out)out.textContent="DEVICE CONNECTION FAILED: "+(err?.message||String(err));
      }
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
  else install();
})();