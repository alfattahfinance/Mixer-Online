/* Functional test-panel controller.
   Makes the visible hardware/sync test controls operational in 16CH simulator mode. */
(function(){
 "use strict";
 const $=id=>document.getElementById(id);
 const tests={
  simulateRx:"simulateHardwareRx",
  runTest:"runTest",
  runStressTest:"runStressTest",
  runMuteSoloTest:"runMuteSoloTest",
  runMasterIsolationTest:"runMasterIsolationTest",
  runFaderTest:"runFaderTest",
  runCombinationTest:"runCombinationTest",
  runBidirectionalSyncTest:"runBidirectionalSyncTest",
  runSaveRecallTest:"runSaveRecallTest"
 };
 async function ensureReady(){
  if(!window.state)return false;
  if(!window.state.system && typeof window.toggleSystem==="function") window.toggleSystem();
  if(!window.state.connected){
   if(typeof window.handleEspConnect==="function") await window.handleEspConnect();
   else if(window.MixerAdapters?.simulator){
    const r=await window.MixerAdapters.simulator();
    if(r?.connected){window.state.connected=true;window.state.sim.online=true}
   }
  }
  if(typeof window.syncHeader==="function")window.syncHeader();
  return !!window.state.connected;
 }
 function bind(){
  Object.entries(tests).forEach(([id,fn])=>{
   const b=$(id); if(!b)return;
   b.onclick=null;
   b.addEventListener("click",async e=>{
    e.preventDefault();e.stopImmediatePropagation();
    const out=$("testResult");
    if(out)out.textContent="STARTING: "+b.textContent;
    try{
     if(fn==="simulateHardwareRx"){
      const ok=await ensureReady();
      const r=typeof window.simulateHardwareRx==="function"&&window.simulateHardwareRx();
      if(out)out.textContent=r?"SIMULATE HARDWARE RX: PASSED":"SIMULATE HARDWARE RX: FAILED";
      return;
     }
     if(!(await ensureReady())){if(out)out.textContent="TEST FAILED: SIMULATOR UNAVAILABLE";return}
     const f=window[fn];
     if(typeof f!=="function"){if(out)out.textContent="TEST ERROR: "+fn+" NOT FOUND";return}
     await f();
    }catch(err){if(out)out.textContent="TEST ERROR: "+(err?.message||err)}
   },{capture:true});
  });
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
