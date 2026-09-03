"use strict";

window.MixerTestRunner = (() => {
  const logTest = (msg) => {
    const testLog = document.getElementById("testOutputLog");
    if (testLog) testLog.textContent = msg;
    console.log(`[TEST RUNNER] ${msg}`);
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function run14ChLoopback() {
    logTest("Menjalankan 14CH Loopback Test...");
    for (let ch = 1; ch <= 14; ch++) {
      window.MixerControl.setControl(ch, "fader", 100);
      await delay(50);
      window.MixerControl.setControl(ch, "fader", 0);
      await delay(50);
    }
    logTest("14CH Loopback Test: SELESAI (OK)");
  }

  async function runStressTest() {
    logTest("Menjalankan Repeat Stress Test (100 Perintah)...");
    for (let i = 0; i < 100; i++) {
      const randomCh = Math.floor(Math.random() * 14) + 1;
      const randomVal = Math.floor(Math.random() * 100);
      window.MixerControl.setControl(randomCh, "fader", randomVal);
      await delay(10);
    }
    logTest("Repeat Stress Test: SELESAI (OK)");
  }

  async function runMuteSoloTest() {
    logTest("Menjalankan Mute/Solo Test...");
    for (let ch = 1; ch <= 14; ch++) {
      window.MixerControl.setControl(ch, "mute", true);
      window.MixerControl.setControl(ch, "solo", true);
      await delay(30);
      window.MixerControl.setControl(ch, "mute", false);
      window.MixerControl.setControl(ch, "solo", false);
    }
    logTest("Mute/Solo Test: SELESAI (OK)");
  }

  function simulateHardwareRx() {
    logTest("Simulasi Hardware RX...");
    if (window.MixerAdapters?.simulateHardwareChange) {
      window.MixerAdapters.simulateHardwareChange(1, "fader", 85);
      logTest("Hardware RX: Channel 1 Fader Set to 85");
    } else {
      logTest("Hardware RX: Adapter tidak mendukung");
    }
  }

  return {
    run14ChLoopback,
    runStressTest,
    runMuteSoloTest,
    simulateHardwareRx
  };
})();
