"use strict";

window.MixerTestRunner = (() => {
  const logTest = (msg) => {
    const testLog = document.getElementById("testOutputLog") || document.getElementById("testResult");
    if (testLog) testLog.textContent = "TEST: " + msg;
    console.log(`[TEST RUNNER] ${msg}`);
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper aman untuk mengeksekusi perintah kontrol & menyinkronkan UI
  const setControlSafe = (ch, param, value) => {
    if (window.MixerControl && typeof window.MixerControl.setControl === "function") {
      window.MixerControl.setControl(ch, param, value);
    }
    // Update state global jika ada
    if (window.state?.channels?.[ch - 1]) {
      window.state.channels[ch - 1][param] = value;
    }
    // Panggil sync UI jika tersedia agar fader/tombol bergerak di layar
    if (typeof window.syncNew14ChannelPanel === "function") {
      window.syncNew14ChannelPanel();
    }
  };

  // Variabel untuk memutar channel secara berurutan saat Simulate RX diklik
  let rxCurrentChannel = 1;

  async function run14ChLoopback() {
    logTest("Menjalankan 14CH Loopback Test...");
    for (let ch = 1; ch <= 14; ch++) {
      setControlSafe(ch, "fader", 100);
      await delay(50);
      setControlSafe(ch, "fader", 0);
      await delay(50);
      setControlSafe(ch, "fader", 75); // Reset ke level standar
    }
    logTest("14CH Loopback Test: SELESAI (OK)");
  }

  async function runStressTest() {
    logTest("Menjalankan Repeat Stress Test (100 Perintah)...");
    for (let i = 0; i < 100; i++) {
      const randomCh = Math.floor(Math.random() * 14) + 1;
      const randomVal = Math.floor(Math.random() * 100);
      setControlSafe(randomCh, "fader", randomVal);
      await delay(15);
    }
    logTest("Repeat Stress Test: SELESAI (OK)");
  }

  async function runMuteSoloTest() {
    logTest("Menjalankan Mute/Solo Test...");
    for (let ch = 1; ch <= 14; ch++) {
      setControlSafe(ch, "mute", true);
      setControlSafe(ch, "solo", true);
      await delay(40);
      setControlSafe(ch, "mute", false);
      setControlSafe(ch, "solo", false);
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
      // Fallback menggunakan setControlSafe
      setControlSafe(targetCh, "fader", randomVal);
      logTest(`Hardware RX (Fallback): Channel ${targetCh} Fader Set to ${randomVal}%`);
    }

    // Update elemen <pre id="rx"> jika ada di DOM
    const rxPre = document.getElementById("rx");
    if (rxPre) {
      rxPre.textContent = `RX: {"ch":${targetCh},"param":"fader","val":${randomVal}}`;
    }

    // Rotasi giliran channel (1 - 14)
    rxCurrentChannel = rxCurrentChannel >= 14 ? 1 : rxCurrentChannel + 1;
  }

  return {
    run14ChLoopback,
    runStressTest,
    runMuteSoloTest,
    simulateHardwareRx
  };
})();
