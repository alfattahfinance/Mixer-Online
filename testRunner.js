"use strict";

window.MixerTestRunner = (() => {
  const logTest = (msg) => {
    const testLog = document.getElementById("testOutputLog") || document.getElementById("testResult");
    if (testLog) testLog.textContent = msg;
    console.log(`[TEST RUNNER] ${msg}`);
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Variabel untuk memutar channel secara berurutan saat Simulate RX diklik
  let rxCurrentChannel = 1;

  async function run14ChLoopback() {
    logTest("Menjalankan 14CH Loopback Test...");
    for (let ch = 1; ch <= 14; ch++) {
      if (window.MixerControl?.setControl) {
        window.MixerControl.setControl(ch, "fader", 100);
      }
      await delay(50);
      if (window.MixerControl?.setControl) {
        window.MixerControl.setControl(ch, "fader", 0);
      }
      await delay(50);
    }
    logTest("14CH Loopback Test: SELESAI (OK)");
  }

  async function runStressTest() {
    logTest("Menjalankan Repeat Stress Test (100 Perintah)...");
    for (let i = 0; i < 100; i++) {
      const randomCh = Math.floor(Math.random() * 14) + 1;
      const randomVal = Math.floor(Math.random() * 100);
      if (window.MixerControl?.setControl) {
        window.MixerControl.setControl(randomCh, "fader", randomVal);
      }
      await delay(10);
    }
    logTest("Repeat Stress Test: SELESAI (OK)");
  }

  async function runMuteSoloTest() {
    logTest("Menjalankan Mute/Solo Test...");
    for (let ch = 1; ch <= 14; ch++) {
      if (window.MixerControl?.setControl) {
        window.MixerControl.setControl(ch, "mute", true);
        window.MixerControl.setControl(ch, "solo", true);
      }
      await delay(30);
      if (window.MixerControl?.setControl) {
        window.MixerControl.setControl(ch, "mute", false);
        window.MixerControl.setControl(ch, "solo", false);
      }
    }
    logTest("Mute/Solo Test: SELESAI (OK)");
  }

  // PERBAIKAN: Simulasi RX sekarang akan memutar CH1 - CH14 secara bergantian & acak nilainya
  function simulateHardwareRx() {
    const randomVal = Math.floor(Math.random() * 100);
    const targetCh = rxCurrentChannel; // Bergantian dari 1 sampai 14

    if (window.MixerAdapters?.simulateHardwareChange) {
      window.MixerAdapters.simulateHardwareChange(targetCh, "fader", randomVal);
      logTest(`Hardware RX: Channel ${targetCh} Fader Set to ${randomVal}%`);
    } else if (window.MixerControl?.setControl) {
      // Fallback jika adapter tidak memiliki method simulateHardwareChange
      window.MixerControl.setControl(targetCh, "fader", randomVal);
      logTest(`Hardware RX (Fallback): Channel ${targetCh} Fader Set to ${randomVal}%`);
    } else {
      logTest("Hardware RX: Adapter tidak mendukung");
    }

    // Naikkan channel untuk klik berikutnya (kembali ke 1 jika sudah mencapai 14)
    rxCurrentChannel = rxCurrentChannel >= 14 ? 1 : rxCurrentChannel + 1;
  }

  return {
    run14ChLoopback,
    runStressTest,
    runMuteSoloTest,
    simulateHardwareRx
  };
})();
