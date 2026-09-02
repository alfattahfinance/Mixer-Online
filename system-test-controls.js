/* 14CH test panel — one owner per button, no duplicate listeners. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const map={
 simulateRx:"simulateHardwareRx",runTest:"runTest",runStressTest:"runStressTest",
 runMuteSoloTest:"runMuteSoloTest",runMasterIsolationTest:"runMasterIsolationTest",
 runFaderTest:"runFaderTest",runCombinationTest:"runCombinationTest",
 runBidirectionalSyncTest:"runBidirectionalSyncTest",runSaveRecallTest:"runSaveRecallTest"
};
async function ready(){
 if(!window.state)return false;
 if(!window.state.system){$("testResult").textContent="TEST BLOCKED: SYSTEM OFF";return false}
 if(!window.state.connected){
   const r=await window.MixerAdapters?.simulator?.();
   if(!r?.connected){$("testResult").textContent="TEST BLOCKED: ESP32 SIMULATOR OFFLINE";return false}
   window.state.connected=true;window.state.sim.online=true;
 }
 return true;
}
function install(){
 Object.entries(map).forEach(([id,name])=>{
   const b=$(id);if(!b)return;
   b.onclick=async e=>{
     e.preventDefault();e.stopImmediatePropagation();
     if(!(await ready()))return;
     const fn=window[name];
     if(typeof fn!=="function"){$("testResult").textContent="TEST ERROR: "+name+" NOT LOADED";return}
     b.disabled=true;$("testResult").textContent="RUNNING: "+b.textContent;
     try{await fn()}catch(err){$("testResult").textContent="TEST ERROR: "+(err?.message||err)}
     finally{b.disabled=false}
   };
 });
 const save=$("savePreset"),recall=$("recallPreset");
 if(save)save.onclick=e=>{e.preventDefault();if(window.savePreset)window.savePreset("default")};
 if(recall)recall.onclick=e=>{e.preventDefault();if(window.recallPreset)window.recallPreset("default")};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();
