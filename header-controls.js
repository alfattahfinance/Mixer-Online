/* HEADER SYSTEM — functional UI bridge
   This file is intentionally independent of the mixer engine internals.
   It only changes the public state and calls the existing adapter APIs. */
(function(){
  "use strict";
  const $=id=>document.getElementById(id);

  function status(msg){
    const e=$("testResult"); if(e) e.textContent=msg;
  }
  function refresh(){
    const st=window.state;
    if(!st)return;
    const active=window.MixerAdapters?.active;
    const live=!!active?.connected;
    st.connected=live;
    st.sim.online=live && active?.transport==="esp32";

    const p=$("power");
    if(p){p.textContent=st.system?"SYSTEM ON":"SYSTEM OFF";p.classList.toggle("on",st.system);}

    const s=$("status");
    if(s){s.textContent=live?"ONLINE":"OFFLINE";s.classList.toggle("online",live);}

    const lamp=$("statusLamp");
    if(lamp)lamp.classList.toggle("live",live);

    const transport=$("transportStatus");
    if(transport){
      transport.textContent=live
        ? (active.transport==="bluetooth"?"BLUETOOTH: "+(active.name||"MIXER"):"ESP32 BRIDGE: "+(active.name||"ESP32"))
        :"OFFLINE";
      transport.classList.toggle("online",live);
    }

    const hs=$("headerBridgeStatus");
    if(hs)hs.textContent=live?"PERMANENT BRIDGE ACTIVE":st.system?"SYSTEM READY":"BRIDGE STANDBY";

    const esp=$("connectEsp");
    if(esp)esp.textContent=live&&active.transport==="esp32"?"DISCONNECT ESP32":"CONNECT ESP32";
    const ble=$("connectBluetooth");
    if(ble)ble.textContent=live&&active.transport==="bluetooth"?"DISCONNECT BLUETOOTH":"CONNECT BLUETOOTH";
  }

  async function system(){
    if(!window.state)return;
    window.state.system=!window.state.system;
    if(!window.state.system){
      try{window.MixerAdapters?.disconnect?.()}catch{}
      window.state.connected=false;
      window.state.sim.online=false;
      status("SYSTEM OFF");
    }else{
      status("SYSTEM ON • READY");
    }
    refresh();
  }

  async function esp(){
    if(!window.state?.system){status("SYSTEM OFF — TURN SYSTEM ON FIRST");return}
    try{
      const a=window.MixerAdapters?.active;
      if(a?.connected && a.transport==="esp32"){
        window.MixerAdapters.disconnect();
        status("ESP32 DISCONNECTED");
      }else{
        if(a?.connected)window.MixerAdapters.disconnect();
        const r=await window.MixerAdapters?.simulator?.();
        if(!r?.connected)throw new Error("ESP32 simulator unavailable");
        window.state.connected=true;window.state.sim.online=true;
        status("ESP32 SIMULATOR ONLINE • 16CH");
      }
    }catch(e){status("ESP32 ERROR: "+(e?.message||e))}
    refresh();
  }

  async function bluetooth(){
    if(!window.state?.system){status("SYSTEM OFF — TURN SYSTEM ON FIRST");return}
    try{
      const a=window.MixerAdapters?.active;
      if(a?.connected && a.transport==="bluetooth"){
        window.MixerAdapters.disconnect();
        status("BLUETOOTH DISCONNECTED");
      }else{
        if(a?.connected)window.MixerAdapters.disconnect();
        if(!window.MixerAdapters?.supportsBluetooth?.())throw new Error("Bluetooth not supported by this browser/device");
        const r=await window.MixerAdapters.connectBluetooth();
        if(!r?.ok)throw new Error(r?.reason||"Bluetooth connection failed");
        window.state.connected=true;window.state.sim.online=false;
        status("BLUETOOTH ONLINE • "+(r.name||"MIXER"));
      }
    }catch(e){status("BLUETOOTH: "+(e?.message||e))}
    refresh();
  }

  function bind(){
    $("power")?.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();system()},{capture:true});
    $("connectEsp")?.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();esp()},{capture:true});
    $("connectBluetooth")?.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();bluetooth()},{capture:true});
    refresh();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});
  else bind();
})();
