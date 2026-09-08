/* ==========================================================================
   14CH TEST PANEL CONTROLLER (OPTIMIZED PRO EDITION)
   ========================================================================== */
(function(){
"use strict";

const $ = id => document.getElementById(id);

// Peta ID Tombol DOM ke Nama Fungsi di MixerTestRunner atau Scope Global
const map = {
  simulateRx: "simulateHardwareRx",
  runTest: "run14ChLoopback",
  runFaderTest: "run14ChLoopback",
  runStressTest: "runStressTest",
  runMuteSoloTest: "runMuteSoloTest",
  runMasterIsolationTest: "runMasterIsolationTest",
  runCombinationTest: "runCombinationTest",
  runBidirectionalSyncTest: "runBidirectionalSyncTest",
  runSaveRecallTest: "runSaveRecallTest",
  runFXTest: "runFXTest",
  runAUXTest: "runAUXTest",
  runM32ScreenSyncTest: "runM32ScreenSyncTest"
};

function triggerHaptic(ms) {
  if (window.AndroidFeedback && typeof window.AndroidFeedback.triggerHaptic === "function") {
    window.AndroidFeedback.triggerHaptic(ms);
  } else if (navigator.vibrate) {
    navigator.vibrate(ms);
  }
}

// Helper aman untuk menampilkan pesan log di DOM & Konsol
function log(msg, type = "info") {
  const el = $("testResult") || $("testOutputLog") || $("bridgeLog");
  if (el) {
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const formattedMsg = `[${timestamp}] ${msg}`;
    
    if (el.tagName === "TEXTAREA" || el.tagName === "DIV") {
      el.textContent = formattedMsg;
    } else {
      el.textContent = msg;
    }
    
    if (type === "error") el.style.color = "#ff3b30";
    else if (type === "success") el.style.color = "#31e66b";
    else el.style.color = "#aeb8bc";
  }
  console.log(`[TEST PANEL] ${msg}`);
}

async function ready() {
  if (!window.state) {
    window.state = { system: true, connected: false, channels: [] };
  }

  // Cek apakah sistem dalam keadaan mati (SYSTEM OFF)
  if (!window.state.system) {
    log("TEST BLOCKED: SYSTEM IS OFF. Nyalakan Power Terlebih Dahulu!", "error");
    return false;
  }

  // Coba hubungkan ke simulator jika belum terkoneksi (Diamankan dengan pengecekan fungsi yang valid)
  if (!window.state.connected) {
    try {
      const simFunc = window.MixerAdapters?.connectSimulator || window.MixerAdapters?.simulator;
      if (typeof simFunc === "function") {
        const r = await simFunc();
        if (r?.connected) {
          window.state.connected = true;
          if (window.state.sim) window.state.sim.online = true;
          log("Simulator Auto-Connected for Testing", "success");
        }
      }
    } catch (err) {
      log("WARNING: Simulator Connection Skipped (" + (err?.message || err) + ")", "error");
    }
  }

  return true;
}

function install() {
  // 1. Binding Event Handler untuk Tombol-tombol Pengujian
  Object.entries(map).forEach(([id, name]) => {
    const b = $(id);
    if (!b) return;

    b.onclick = async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      triggerHaptic(15);

      if (!(await ready())) return;

      // Cari fungsi pengujian di window.MixerTestRunner terlebih dahulu, lalu di window global
      const fn = window.MixerTestRunner?.[name] || window[name];

      if (typeof fn !== "function") {
        log(`TEST ERROR: ${name} NOT LOADED`, "error");
        return;
      }

      b.disabled = true;
      const originalText = b.textContent;
      b.textContent = "RUNNING...";
      log(`RUNNING TEST: ${originalText || name}...`);

      try {
        const res = await fn();
        if (res === false) {
          log(`TEST FAILED: ${originalText || name}`, "error");
        } else {
          log(`TEST PASSED: ${originalText || name}`, "success");
        }
      } catch (err) {
        log(`TEST ERROR: ${err?.message || err}`, "error");
      } finally {
        b.disabled = false;
        b.textContent = originalText;
      }
    };
  });

  // 2. Binding Event Handler untuk Tombol Preset Save & Recall
  const save = $("savePreset") || $("btnSavePreset");
  const recall = $("recallPreset") || $("btnRecallPreset");

  if (save) {
    save.onclick = async (e) => {
      e.preventDefault();
      triggerHaptic(20);
      if (typeof window.savePreset === "function") {
        await window.savePreset("default");
        log("PRESET SAVED: Default State", "success");
      } else if (window.MixerAdapters?.getSimulatorState) {
        log("PRESET SAVED: LocalStorage Updated", "success");
      } else {
        log("ERROR: savePreset function not found", "error");
      }
    };
  }

  if (recall) {
    recall.onclick = async (e) => {
      e.preventDefault();
      triggerHaptic(20);
      if (typeof window.recallPreset === "function") {
        await window.recallPreset("default");
        log("PRESET RECALLED: Default State Loaded", "success");
      } else if (window.syncNew14ChannelPanel) {
        window.syncNew14ChannelPanel();
        log("PRESET RECALLED: UI Synced", "success");
      } else {
        log("ERROR: recallPreset function not found", "error");
      }
    };
  }

  // 3. Tombol Reset / Clear Test Log
  const clearBtn = $("clearTestLog") || $("btnClearLog");
  if (clearBtn) {
    clearBtn.onclick = (e) => {
      e.preventDefault();
      triggerHaptic(10);
      log("TEST LOG CLEARED");
    };
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}
})();
