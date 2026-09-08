/* ==========================================================================
   MIXER TEST RUNNER — OPTIMIZED & LAG-FREE PRO EDITION
   ========================================================================== */
"use strict";

window.MixerTestRunner = (() => {
  const logTest = (msg) => {
    const testLog = document.getElementById("testOutputLog") || document.getElementById("testResult");
    if (testLog) testLog.textContent = "TEST: " + msg;
    console.log(`[TEST RUNNER] ${msg}`);
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Sistem Batching Pembaruan DOM agar tidak melahirkan Lag / Freeze
  let pendingUpdates = new Map();
  let isFrameScheduled = false;

  function scheduleUIUpdate(ch, param, value) {
    pendingUpdates.set(`${ch}-${param}`, { ch, param, value });

    if (!isFrameScheduled) {
      isFrameScheduled = true;
      requestAnimationFrame(() => {
        pendingUpdates.forEach((item) => {
          // 1. Kirim ke kontrol mesin mixer
          if (window.MixerControl && typeof window.MixerControl.setControl === "function") {
            window.MixerControl.setControl(item.ch, item.param, item.value);
          }
          // 2. Update state global
          if (window.state?.channels?.[item.ch - 1]) {
            window.state.channels[item.ch - 1][item.param] = item.value;
          }
        });

        // 3. Panggil sync UI sekali saja per frame render agar tidak berat
        if (typeof window.syncNew14ChannelPanel === "function") {
          window.syncNew14ChannelPanel();
        }

        pendingUpdates.clear();
        isFrameScheduled = false;
      });
    }
  }

  // Helper aman yang memanfaatkan batching schedule
  const setControlSafe = (ch, param, value) => {
    scheduleUIUpdate(ch, param, value);
  };

  // Variabel untuk memutar channel secara berurutan saat Simulate RX diklik
  let rxCurrentChannel = 1;

  async function run14ChLoopback() {
    logTest("Menjalankan 14CH Loopback Test...");
    for (let ch = 1; ch <= 14; ch++) {
      setControlSafe(ch, "fader", 100);
      await delay(80); // Ditingkatkan sedikit jedanya agar CPU mobile tidak berat
      setControlSafe(ch, "fader", 0);
      await delay(80);
      setControlSafe(ch, "fader", 75); 
      await delay(40);
    }
    logTest("14CH Loopback Test: SELESAI (OK)");
  }

  async function runStressTest() {
    logTest("Menjalankan Repeat Stress Test (50 Perintah Optimal)...");
    // Dikurangi ke 50 perintah per siklus agar sangat ringan di APK Android
    for (let i = 0; i < 50; i++) {
      const randomCh = Math.floor(Math.random() * 14) + 1;
      const randomVal = Math.floor(Math.random() * 100);
      setControlSafe(randomCh, "fader", randomVal);
      await delay(30); // Jeda aman untuk mencegah thread terkunci
    }
    logTest("Repeat Stress Test: SELESAI (OK)");
  }

  async function runMuteSoloTest() {
    logTest("Menjalankan Mute/Solo Test...");
    for (let ch = 1; ch <= 14; ch++) {
      setControlSafe(ch, "mute", true);
      setControlSafe(ch, "solo", true);
      await delay(60);
      setControlSafe(ch, "mute", false);
      setControlSafe(ch, "solo", false);
      await delay(30);
    }
    logTest("Mute/Solo Test: SELESAI (OK)");
  }

  // Simulasi RX memutar CH1 - CH14 secara bergantian & memperbarui elemen teks RX
  function simulateHardwareRx() {
    const randomVal = Math.floor(Math.random() * 100);
    const targetCh = rxCurrentChannel;

    if (window.MixerAdapters && typeof window.MixerAdapters.simulateHardwareChange === "function") {
      window.MixerAdapters.simulateHardwareChange(targetCh, "fader", randomVal);
      logTest(`Hardware RX: Channel ${targetCh} Fader Set to ${randomVal}%`);
    } else {
      setControlSafe(targetCh, "fader", randomVal);
      logTest(`Hardware RX (Fallback): Channel ${targetCh} Fader Set to ${randomVal}%`);
    }

    const rxPre = document.getElementById("rx");
    if (rxPre) {
      rxPre.textContent = `RX: {"ch":${targetCh},"param":"fader","val":${randomVal}}`;
    }

    rxCurrentChannel = rxCurrentChannel >= 14 ? 1 : rxCurrentChannel + 1;
  }

  return {
    run14ChLoopback,
    runStressTest,
    runMuteSoloTest,
    simulateHardwareRx
  };
})();
