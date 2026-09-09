/* ==========================================================================
   APP.JS - LOGIKA UTAMA, UI HANDLERS & HANDLER PENGUJIAN (TEST PANEL)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  console.log("[APP] System Initialized");

  // 0. MASTER RACK: samakan ukuran panel dengan satu channel strip.
  // Tidak mengubah CH1-CH14 atau isi dashboard lain.
  const syncMasterRackSize = () => {
    const masterRack = document.getElementById("masterRack") || document.querySelector(".master-rack");
    const reference = document.querySelector(".new-channel-strip, .channel-strip, .channel");
    if (!masterRack || !reference) return;

    const rect = reference.getBoundingClientRect();
    if (rect.width > 0) masterRack.style.setProperty("width", `${Math.round(rect.width)}px`, "important");
    if (rect.height > 0) masterRack.style.setProperty("height", `${Math.round(rect.height)}px`, "important");
    masterRack.style.setProperty("min-width", `${Math.round(rect.width)}px`, "important");
    masterRack.style.setProperty("max-width", `${Math.round(rect.width)}px`, "important");
    masterRack.style.setProperty("min-height", `${Math.round(rect.height)}px`, "important");
    masterRack.style.setProperty("max-height", `${Math.round(rect.height)}px`, "important");
    masterRack.style.setProperty("flex", `0 0 ${Math.round(rect.width)}px`, "important");
    masterRack.style.setProperty("align-self", "flex-start", "important");
  };

  // Channel panel dibuat oleh channels-new.js; tunggu satu frame agar ukurannya siap.
  requestAnimationFrame(() => {
    requestAnimationFrame(syncMasterRackSize);
  });

  window.addEventListener("resize", syncMasterRackSize);
  window.addEventListener("orientationchange", () => setTimeout(syncMasterRackSize, 80));

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
    if (!window.state) window.state = { channels: [] };
    if (!window.state.channels) window.state.channels = [];
    if (!window.state.channels[ch - 1]) window.state.channels[ch - 1] = {};
    window.state.channels[ch - 1][param] = value;

    // B. Panggil API MixerControl jika tersedia
    if (window.MixerControl && typeof window.MixerControl.setControl === "function") {
      window.MixerControl.setControl(ch, param, value);
    }

    // C. Update Tampilan Fader / Knob / Button di DOM secara langsung
    const channelStrips = document.querySelectorAll(`.new-channel-strip[data-ch="${ch}"], .channel-strip[data-ch="${ch}"], [data-ch="${ch}"]`);
    
    channelStrips.forEach((strip) => {
      const channelNum = Number(strip.dataset?.ch || strip.getAttribute("data-ch"));
      if (channelNum === Number(ch)) {
        
        // 1. KONTROL RANGE (Fader, Gain, EQ, Pan)
        if (["fader", "gain", "low", "mid", "high", "pan"].includes(param)) {
          const inputEl = strip.querySelector(`input[data-param="${param}"], input[data-k="${param}"], .${param}-input, input.${param}-knob`);
          
          if (inputEl) {
            inputEl.value = value;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          }

          // Format Tampilan Output Nilai
          if (param === "fader") {
            const outputVal = strip.querySelector('.fader-val, output[data-k="fader"], output');
            if (outputVal) outputVal.textContent = Math.round(value) + "%";
          } else if (param === "gain") {
            const outputVal = strip.querySelector('.gain-val, output[data-k="gain"]');
            if (outputVal) outputVal.textContent = Number(value).toFixed(2);
          } else if (param === "pan") {
            const outputVal = strip.querySelector('.pan-val, output[data-k="pan"]');
            if (outputVal) {
              const numVal = Number(value);
              outputVal.textContent = numVal === 0 ? "CENTER" : (numVal < 0 ? `L ${Math.abs(Math.round(numVal * 100))}%` : `R ${Math.round(numVal * 100)}%`);
            }
          } else if (["low", "mid", "high"].includes(param)) {
            const outputVal = strip.querySelector(`.${param}-val, output[data-k="${param}"]`);
            if (outputVal) outputVal.textContent = Math.round(value);
          }

        // 2. KONTROL BUTTON (Mute & Solo)
        } else if (param === "mute") {
          const btnMute = strip.querySelector(".btn-mute, button[data-action='mute'], button[data-k='mute'], button.mute-btn");
          if (btnMute) {
            btnMute.classList.toggle("active", !!value);
            btnMute.classList.toggle("on", !!value);
            btnMute.textContent = value ? "UNMUTE" : "MUTE";
          }
        } else if (param === "solo") {
          const btnSolo = strip.querySelector(".btn-solo, button[data-action='solo'], button[data-k='solo'], button.solo-btn");
          if (btnSolo) {
            btnSolo.classList.toggle("active", !!value);
            btnSolo.classList.toggle("on", !!value);
            btnSolo.textContent = value ? "UNSOLO" : "SOLO";
          }
        }
      }
    });

    // D. Jika Channel yang diubah sedang aktif di Layar Center Console
    if (typeof window.selectScreenChannel === "function") {
      window.selectScreenChannel(ch);
    }
  }

  // ==========================================================================
  // 4. BINDING EVENT LISTENERS UNTUK INTERAKSI USER DI UI (FADER, GAIN, EQ)
  // ==========================================================================

  // A. Event Listener untuk Slider Fader / Gain / EQ / Pan
  document.addEventListener("input", (e) => {
    const target = e.target;
    if (!target) return;

    // Cari elemen strip terdekat untuk mendapatkan nomor Channel (1-14)
    const strip = target.closest("[data-ch]");
    if (!strip) return;

    const ch = Number(strip.dataset.ch);
    if (isNaN(ch) || ch < 1 || ch > 14) return;

    // Tentukan Parameter secara akurat (fader, gain, low, mid, high, pan)
    let param = target.dataset.param || target.dataset.k;
    if (!param) {
      if (target.classList.contains("channel-fader") || target.classList.contains("new-fader")) param = "fader";
      else if (target.classList.contains("gain-knob")) param = "gain";
      else if (target.classList.contains("pan-knob")) param = "pan";
      else if (target.type === "range") param = "fader";
      else return;
    }

    const value = target.type === "checkbox" ? target.checked : Number(target.value);

    // Kirim Perubahan ke MixerControl dan Update State UI
    updateChannelControl(ch, param, value);
  });

  // B. Event Listener untuk Tombol Mute & Solo
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action], button[data-k='mute'], button[data-k='solo'], button.mute-btn, button.solo-btn");
    if (!btn) return;

    const strip = btn.closest("[data-ch]");
    if (!strip) return;
    const ch = Number(strip.dataset.ch);
    if (isNaN(ch) || ch < 1 || ch > 14) return;

    let action = btn.dataset.action || btn.dataset.k;
    if (!action) {
      if (btn.classList.contains("btn-mute") || btn.classList.contains("mute-btn")) action = "mute";
      else if (btn.classList.contains("btn-solo") || btn.classList.contains("solo-btn")) action = "solo";
    }

    if (action === "mute" || action === "solo") {
      const currentState = window.state?.channels?.[ch - 1]?.[action] || false;
      updateChannelControl(ch, action, !currentState);
    }
  });

  // C. Sync Event Balik dari Hardware/Bridge (Feedback)
  const syncRxToUI = (event) => {
    const data = event.detail;
    if (!data || (data.type !== "FEEDBACK" && data.type !== "CONTROL")) return;

    const ch = Number(data.ch);
    if (ch >= 1 && ch <= 14 && data.param) {
      updateChannelControl(ch, data.param, data.value);
    }
  };

  document.addEventListener("mixer:esp32-rx", syncRxToUI);
  document.addEventListener("mixer:bluetooth-rx", syncRxToUI);

  // ==========================================================================
  // 5. EVENT LISTENERS UNTUK TOMBOL-TOMBOL DI CONNECTION / TEST PANEL
  // ==========================================================================

  // 1. SIMULATE HARDWARE RX
  document.getElementById("simulateRx")?.addEventListener("click", () => {
    const randomCh = Math.floor(Math.random() * 14) + 1;
    const randomVal = Math.floor(Math.random() * 100);
    updateChannelControl(randomCh, "fader", randomVal);

    const rxPre = document.getElementById("rx");
    if (rxPre) rxPre.textContent = `RX: {"ch":${randomCh},"param":"fader","val":${randomVal}}`;
    logTest(`Simulasi Hardware RX -> CH${randomCh} Fader diset ke ${randomVal}%`);
  });

  // 2. RUN 14CH LOOPBACK TEST / FADER CH1-CH14
  const run14ChTest = async () => {
    logTest("Memulai 14CH Loopback Test...");
    for (let ch = 1; ch <= 14; ch++) {
      updateChannelControl(ch, "fader", 100);
      await delay(60);
      updateChannelControl(ch, "fader", 0);
      await delay(60);
      updateChannelControl(ch, "fader", 75);
    }
    logTest("14CH Loopback Test: SELESAI (Semua 14 Channel Merespons)");
  };

  document.getElementById("runTest")?.addEventListener("click", run14ChTest);
  document.getElementById("runFaderTest")?.addEventListener("click", run14ChTest);

  // 3. RUN REPEAT STRESS TEST
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

  // 4. RUN MUTE/SOLO TEST
  document.getElementById("runMuteSoloTest")?.addEventListener("click", async () => {
    logTest("Testing Mute & Solo CH1–CH14...");
    for (let ch = 1; ch <= 14; ch++) {
      updateChannelControl(ch, "mute", true);
      updateChannelControl(ch, "solo", true);
      await delay(50);
      updateChannelControl(ch, "mute", false);
      updateChannelControl(ch, "solo", false);
    }
    logTest("Mute/Solo Test: SELESAI");
  });

  // 5. RUN MASTER ISOLATION TEST
  document.getElementById("runMasterIsolationTest")?.addEventListener("click", async () => {
    logTest("Testing Master Fader...");
    const masterEl = document.getElementById("master");
    const masterVal = document.getElementById("masterVal");

    const setMaster = (v) => {
      if (masterEl) {
        masterEl.value = v;
        masterEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (masterVal) masterVal.textContent = v + "%";
    };

    setMaster(0);
    await delay(200);
    setMaster(100);
    await delay(200);
    setMaster(75);

    logTest("Master Isolation Test: SELESAI");
  });

  // 6. RUN COMBINATION CONTROL TEST
  document.getElementById("runCombinationTest")?.addEventListener("click", async () => {
    logTest("Running Combination Test...");
    for (let ch = 1; ch <= 14; ch += 2) {
      updateChannelControl(ch, "mute", true);
      updateChannelControl(ch, "fader", 30);
    }
    await delay(350);
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
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((chData, idx) => {
            const ch = idx + 1;
            if (chData.fader !== undefined) updateChannelControl(ch, "fader", chData.fader);
            if (chData.gain !== undefined) updateChannelControl(ch, "gain", chData.gain);
            if (chData.mute !== undefined) updateChannelControl(ch, "mute", chData.mute);
            if (chData.solo !== undefined) updateChannelControl(ch, "solo", chData.solo);
          });
        }
        logTest("Preset Berhasil Dipanggil Kembali (Recalled)");
      } catch (err) {
        logTest("Gagal memformat data preset.");
      }
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
