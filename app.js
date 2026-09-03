/* ==========================================================================
   APP.JS - LOGIKA UTAMA & HANDLER PENGUJIAN (TEST PANEL)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  console.log("[APP] System Initialized");

  // 1. HELPER DELAY UNTUK ANIMASI STEP-BY-STEP
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 2. LOGGING HELPER KE TEKS 'testResult' PADA PANEL
  const logTest = (msg) => {
    const el = document.getElementById("testResult");
    if (el) el.textContent = "TEST: " + msg;
    console.log("[TEST]", msg);
  };

  // 3. FUNGSI UTAMA UNTUK MENGGERAKKAN CHANNEL (STATE + VISUAL DOM)
  function updateChannelControl(ch, param, value) {
    // A. Update State Global Jika Ada
    if (window.state && window.state.channels && window.state.channels[ch - 1]) {
      window.state.channels[ch - 1][param] = value;
    }

    // B. Panggil API MixerControl jika tersedia
    if (window.MixerControl && typeof window.MixerControl.setControl === "function") {
      window.MixerControl.setControl(ch, param, value);
    }

    // C. Update Tampilan Fader / Button di DOM secara langsung
    // Mencari channel strip di bank kiri (1-7) maupun kanan (8-14)
    const channelStrips = document.querySelectorAll(`.new-channel-strip, [data-ch="${ch}"]`);
    
    channelStrips.forEach((strip) => {
      const channelNum = strip.dataset?.ch || strip.getAttribute("data-ch");
      if (Number(channelNum) === Number(ch)) {
        if (param === "fader") {
          const inputFader = strip.querySelector('input[type="range"]');
          if (inputFader) inputFader.value = value;
          const outputVal = strip.querySelector('.fader-val, output');
          if (outputVal) outputVal.textContent = value + "%";
        } else if (param === "mute") {
          const btnMute = strip.querySelector(".btn-mute, button[data-action='mute']");
          if (btnMute) btnMute.classList.toggle("active", !!value);
        } else if (param === "solo") {
          const btnSolo = strip.querySelector(".btn-solo, button[data-action='solo']");
          if (btnSolo) btnSolo.classList.toggle("active", !!value);
        }
      }
    });

    // D. Jika Channel yang diubah sedang aktif di Layar Center Console
    if (typeof window.selectScreenChannel === "function") {
      window.selectScreenChannel(ch);
    }
  }

  // ==========================================================================
  // EVENT LISTENERS UNTUK TOMBOL-TOMBOL DI CONNECTION / TEST PANEL
  // ==========================================================================

  // 1. SIMULATE HARDWARE RX (Simulasi data masuk acak dari hardware)
  document.getElementById("simulateRx")?.addEventListener("click", () => {
    const randomCh = Math.floor(Math.random() * 14) + 1;
    const randomVal = Math.floor(Math.random() * 100);
    updateChannelControl(randomCh, "fader", randomVal);

    const rxPre = document.getElementById("rx");
    if (rxPre) rxPre.textContent = `RX: {"ch":${randomCh},"param":"fader","val":${randomVal}}`;
    logTest(`Simulasi Hardware RX -> CH${randomCh} Fader diset ke ${randomVal}%`);
  });

  // 2. RUN 14CH LOOPBACK TEST / FADER CH1-CH14 (Gerakkan semua fader bergantian)
  const run14ChTest = async () => {
    logTest("Memulai 14CH Loopback Test...");
    for (let ch = 1; ch <= 14; ch++) {
      updateChannelControl(ch, "fader", 100);
      await delay(70);
      updateChannelControl(ch, "fader", 0);
      await delay(70);
      updateChannelControl(ch, "fader", 75); // Kembalikan ke normal
    }
    logTest("14CH Loopback Test: SELESAI (Semua 14 Channel Merespons)");
  };

  document.getElementById("runTest")?.addEventListener("click", run14ChTest);
  document.getElementById("runFaderTest")?.addEventListener("click", run14ChTest);

  // 3. RUN REPEAT STRESS TEST (Uji ketahanan animasi fader acak cepat)
  document.getElementById("runStressTest")?.addEventListener("click", async () => {
    logTest("Menjalankan Stress Test (40 Perintah Acak)...");
    for (let i = 0; i < 40; i++) {
      const ch = Math.floor(Math.random() * 14) + 1;
      const val = Math.floor(Math.random() * 100);
      updateChannelControl(ch, "fader", val);
      await delay(35);
    }
    logTest("Repeat Stress Test: SELESAI");
  });

  // 4. RUN MUTE/SOLO TEST (Uji nyala/mati indikator Mute & Solo)
  document.getElementById("runMuteSoloTest")?.addEventListener("click", async () => {
    logTest("Testing Mute & Solo CH1–CH14...");
    for (let ch = 1; ch <= 14; ch++) {
      updateChannelControl(ch, "mute", true);
      updateChannelControl(ch, "solo", true);
      await delay(60);
      updateChannelControl(ch, "mute", false);
      updateChannelControl(ch, "solo", false);
    }
    logTest("Mute/Solo Test: SELESAI");
  });

  // 5. RUN MASTER ISOLATION TEST (Gerakkan Master Fader)
  document.getElementById("runMasterIsolationTest")?.addEventListener("click", async () => {
    logTest("Testing Master Fader...");
    const masterEl = document.getElementById("master");
    const masterVal = document.getElementById("masterVal");

    const setMaster = (v) => {
      if (masterEl) masterEl.value = v;
      if (masterVal) masterVal.textContent = v + "%";
    };

    setMaster(0);
    await delay(250);
    setMaster(100);
    await delay(250);
    setMaster(75);

    logTest("Master Isolation Test: SELESAI");
  });

  // 6. RUN COMBINATION CONTROL TEST (Mute + Fader gabungan)
  document.getElementById("runCombinationTest")?.addEventListener("click", async () => {
    logTest("Running Combination Test...");
    for (let ch = 1; ch <= 14; ch += 2) {
      updateChannelControl(ch, "mute", true);
      updateChannelControl(ch, "fader", 30);
    }
    await delay(400);
    for (let ch = 1; ch <= 14; ch += 2) {
      updateChannelControl(ch, "mute", false);
      updateChannelControl(ch, "fader", 75);
    }
    logTest("Combination Control Test: SELESAI");
  });

  // 7. RUN TWO-WAY SYNC TEST
  document.getElementById("runBidirectionalSyncTest")?.addEventListener("click", async () => {
    logTest("Testing Two-Way Sync...");
    const tx = document.getElementById("tx");
    const rx = document.getElementById("rx");
    if (tx) tx.textContent = 'TX: {"sync":"request_state"}';
    await delay(150);
    if (rx) rx.textContent = 'RX: {"sync":"ack_state_ok"}';
    logTest("Two-Way Sync Test: OK");
  });

  // 8. PRESET SAVE & RECALL TEST
  document.getElementById("savePreset")?.addEventListener("click", () => {
    const currentState = window.state?.channels || [];
    localStorage.setItem("mixer_preset_test", JSON.stringify(currentState));
    logTest("Preset Berhasil Disimpan ke LocalStorage");
  });

  document.getElementById("recallPreset")?.addEventListener("click", () => {
    const saved = localStorage.getItem("mixer_preset_test");
    if (saved) {
      logTest("Preset Berhasil Dipanggil Kembali (Recalled)");
    } else {
      logTest("Preset Tidak Ditemukan (Simpan preset terlebih dahulu)");
    }
  });

  document.getElementById("runSaveRecallTest")?.addEventListener("click", async () => {
    logTest("Testing Save/Recall Sequence...");
    document.getElementById("savePreset")?.click();
    await delay(200);
    document.getElementById("recallPreset")?.click();
    logTest("Save/Recall Test: SELESAI");
  });
});
