/* 14CH test panel — one owner per button, no duplicate listeners. */
(function(){
"use strict";

const $ = id => document.getElementById(id);

// Peta tombol ke fungsi di MixerTestRunner atau window global
const map = {
  simulateRx: "simulateHardwareRx",
  runTest: "run14ChLoopback",
  runFaderTest: "run14ChLoopback",
  runStressTest: "runStressTest",
  runMuteSoloTest: "runMuteSoloTest",
  runMasterIsolationTest: "runMasterIsolationTest",
  runCombinationTest: "runCombinationTest",
  runBidirectionalSyncTest: "runBidirectionalSyncTest",
  runSaveRecallTest: "runSaveRecallTest"
};

// Helper aman untuk menampilkan pesan log di DOM
function log(msg) {
  const el = $("testResult") || $("testOutputLog");
  if (el) el.textContent = msg;
  console.log(`[TEST PANEL] ${msg}`);
}

async function ready() {
  if (!window.state) {
    // Inisialisasi state dasar jika belum ada
    window.state = { system: true, connected: false, channels: [] };
  }

  // Jika simulator offline, coba hubungkan secara otomatis
  if (!window.state.connected && window.MixerAdapters?.simulator) {
    try {
      const r = await window.MixerAdapters.simulator();
      if (r?.connected) {
        window.state.connected = true;
        if (window.state.sim) window.state.sim.online = true;
      }
    } catch (err) {
      log("WARNING: Simulator connection skipped (" + (err?.message || err) + ")");
    }
  }

  return true;
}

function install() {
  // Binding event handler untuk tombol-tombol pengujian
  Object.entries(map).forEach(([id, name]) => {
    const b = $(id);
    if (!b) return;

    b.onclick = async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();

      if (!(await ready())) return;

      // Cari fungsi di window.MixerTestRunner terlebih dahulu, lalu di window global
      const fn = window.MixerTestRunner?.[name] || window[name];

      if (typeof fn !== "function") {
        log("TEST ERROR: " + name + " NOT LOADED");
        return;
      }

      b.disabled = true;
      log("RUNNING: " + (b.textContent || name));

      try {
        await fn();
      } catch (err) {
        log("TEST ERROR: " + (err?.message || err));
      } finally {
        b.disabled = false;
      }
    };
  });

  // Binding event handler untuk tombol Preset Save & Recall
  const save = $("savePreset");
  const recall = $("recallPreset");

  if (save) {
    save.onclick = async (e) => {
      e.preventDefault();
      if (typeof window.savePreset === "function") {
        await window.savePreset("default");
        log("Preset Saved: default");
      } else {
        log("ERROR: savePreset function not found");
      }
    };
  }

  if (recall) {
    recall.onclick = async (e) => {
      e.preventDefault();
      if (typeof window.recallPreset === "function") {
        await window.recallPreset("default");
        log("Preset Recalled: default");
      } else {
        log("ERROR: recallPreset function not found");
      }
    };
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}
})();
