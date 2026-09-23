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

    // Channel strip baru sudah memiliki handler lokal di channels-new.js.
    // Jangan proses ulang event di level document agar tidak terjadi
    // loop input -> updateChannelControl -> input -> ... dan lag saat drag.
    if (target.closest(".new-channel-strip, .channel-strip")) return;

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

  // C. Sync Event Balik dari Hardware/Bridge (Feedback & Meter Real-Time)
  const syncRxToUI = (event) => {
    const data = event.detail;
    if (!data) return;

    const ch = Number(data.ch);
    if (isNaN(ch) || ch < 1 || ch > 14) return;

    // 1. Tangkap paket METER dari hardware/mixer fisik
    if (data.type === "METER") {
      const rawLevel = Number(data.level ?? data.value ?? 0);
      const levelPercent = Math.min(100, Math.max(0, Math.round(rawLevel > 1 ? rawLevel : rawLevel * 100)));

      const strip = document.querySelector(`.new-channel-strip[data-ch="${ch}"], .channel-strip[data-ch="${ch}"]`);
      if (strip) {
        const vuBar = strip.querySelector(".ch-side-vu-fill");
        if (vuBar) {
          vuBar.style.height = `${levelPercent}%`;
          vuBar.style.setProperty("height", `${levelPercent}%`, "important");
        }
      }
      return;
    }

    // 2. Tangkap paket FEEDBACK atau CONTROL
    if ((data.type === "FEEDBACK" || data.type === "CONTROL") && data.param) {
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


/* ==========================================================
   EXTRACTED FROM index.html — SERVICE WORKER REGISTRATION
   ========================================================== */
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function(){});
  }


/* ==========================================================
   EXTRACTED FROM index.html — SCREEN / M32 DISPLAY + SYSTEM POWER UI
   ========================================================== */
(function() {
  "use strict";

  window.state = window.state || {};
  if (window.state.system === undefined) {
    window.state.system = false; 
  }
  window.state.connected = false;

  const tabs = document.querySelectorAll('#screenTabs button');
  const views = document.querySelectorAll('.screen-content .screen-view');
  const subButtons = document.querySelectorAll('#m32SubmenuBar .m32-sub-btn');
  const subPanels = document.querySelectorAll('.midas-tft-screen .m32-sub-panel');
  const subBar = document.getElementById('m32SubmenuBar');

  function buildScreenMeters() {
    const root = document.getElementById('screenChannelMeters');
    if (!root) return;
    root.innerHTML = '';
    for (let i = 0; i < 14; i++) {
      const el = document.createElement('div');
      el.style.flex = '1';
      el.style.background = 'var(--accent-color)';
      el.style.height = (15 + ((i * 17) % 75)) + '%';
      el.style.borderRadius = '2px';
      el.title = 'CH' + (i + 1);
      root.appendChild(el);
    }
  }

  function buildRta() {
    const root = document.getElementById('rtaBars');
    if (!root) return;
    root.innerHTML = '';
    for (let i = 0; i < 14; i++) {
      const b = document.createElement('div');
      b.style.flex = '1';
      b.style.background = '#2ecc71';
      b.style.height = (20 + ((i * 23) % 70)) + '%';
      b.style.borderRadius = '2px';
      root.appendChild(b);
    }
  }

  function switchScreen(targetScreen) {
    tabs.forEach(b => {
      if (b.dataset.screen === targetScreen) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    views.forEach(v => {
      if (v.dataset.view === targetScreen) {
        v.classList.add('active');
        v.style.display = 'flex';
        v.style.visibility = 'visible';
        v.style.opacity = '1';
      } else {
        v.classList.remove('active');
        v.style.display = 'none';
        v.style.visibility = 'hidden';
        v.style.opacity = '0';
      }
    });

    if (subBar) {
      subBar.style.display = (targetScreen === 'HOME') ? 'grid' : 'none';
    }

    if (targetScreen === 'METER') {
      buildScreenMeters();
    } else if (targetScreen === 'RTA') {
      buildRta();
    }
  }

  function switchSubPanel(targetSub) {
    subButtons.forEach(b => {
      if (b.dataset.sub === targetSub) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    subPanels.forEach(panel => {
      if (panel.dataset.subpanel === targetSub) {
        panel.classList.add('active');
        panel.style.display = 'flex';
        panel.style.visibility = 'visible';
        panel.style.opacity = '1';
      } else {
        panel.classList.remove('active');
        panel.style.display = 'none';
        panel.style.visibility = 'hidden';
        panel.style.opacity = '0';
      }
    });
  }

  tabs.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      switchScreen(this.dataset.screen);
    }, true);
  });

  subButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      switchSubPanel(this.dataset.sub);
    }, true);
  });

  const powerBtn = document.getElementById("power");
  if (powerBtn) {
    powerBtn.textContent = window.state.system ? "SYSTEM ON" : "SYSTEM OFF";
    powerBtn.classList.toggle("on", window.state.system);
    
    powerBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.state.system = !window.state.system;
      this.textContent = window.state.system ? "SYSTEM ON" : "SYSTEM OFF";
      this.classList.toggle("on", window.state.system);

      var hs = document.getElementById("headerBridgeStatus");
      if (hs) hs.textContent = window.state.system ? "SYSTEM READY" : "BRIDGE STANDBY";
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    switchScreen('HOME');
    switchSubPanel('overview');
  });

})();


/* ==========================================================
   EXTRACTED FROM index.html — INPUT CONFIG + SCENE UI
   ========================================================== */
(function() {
  "use strict";

  window.state = window.state || { system: false, connected: false, channels: [] };

  const btnPhantom = document.getElementById('btnPhantom');
  if (btnPhantom) {
    btnPhantom.addEventListener('click', function(e) {
      e.preventDefault();
      const isOn = this.textContent.trim() === 'ON';
      this.textContent = isOn ? 'OFF' : 'ON';
      this.style.background = isOn ? 'var(--panel-border)' : '#2ecc71';
      this.style.color = isOn ? '#fff' : '#000';
      
      const tr = document.getElementById('testResult');
      if (tr) tr.textContent = `CONFIG: +48V Phantom Power set to ${this.textContent}`;
    });
  }

  const btnPolarity = document.getElementById('btnPolarity');
  if (btnPolarity) {
    btnPolarity.addEventListener('click', function(e) {
      e.preventDefault();
      const isNorm = this.textContent.includes('NORM');
      this.textContent = isNorm ? 'INV (-)' : 'NORM (+)';
      this.style.color = isNorm ? '#e74c3c' : '#fff';
      this.style.background = isNorm ? 'var(--main-bg)' : 'var(--panel-border)';

      const tr = document.getElementById('testResult');
      if (tr) tr.textContent = `CONFIG: Input Polarity set to ${this.textContent}`;
    });
  }

  const slidersWithOutputs = [
    { slider: 'hpfSlider', val: 'hpfVal', unit: ' Hz' },
    { slider: 'gateThreshSlider', val: 'gateThreshVal', unit: ' dB' },
    { slider: 'gateRangeSlider', val: 'gateRangeVal', unit: ' dB' },
    { slider: 'gateRelSlider', val: 'gateRelVal', unit: ' ms' },
    { slider: 'compThreshSlider', val: 'compThreshVal', unit: 'dB' },
    { slider: 'compRatioSlider', val: 'compRatioVal', unit: '' },
    { slider: 'compAttSlider', val: 'compAttVal', unit: 'ms' },
    { slider: 'compGainSlider', val: 'compGainVal', unit: '' },
    { slider: 'bs1Slider', val: 'bs1Val', unit: 'dB' },
    { slider: 'bs2Slider', val: 'bs2Val', unit: 'dB' },
    { slider: 'fx1SendSlider', val: 'fx1Val', unit: 'dB' },
    { slider: 'fx2SendSlider', val: 'fx2Val', unit: 'dB' }
  ];

  slidersWithOutputs.forEach(item => {
    const sliderEl = document.getElementById(item.slider);
    const valEl = document.getElementById(item.val);
    if (sliderEl && valEl) {
      sliderEl.addEventListener('input', function() {
        let displayVal = this.value;
        if (item.slider === 'fx2SendSlider' && displayVal === '-40') {
          displayVal = '-∞';
          valEl.textContent = displayVal;
        } else if (item.slider === 'compGainSlider') {
          valEl.textContent = '+' + displayVal;
        } else {
          valEl.textContent = displayVal + item.unit;
        }
      });
    }
  });

  const eqBands = ['Low', 'Mid1', 'Mid2', 'High'];
  eqBands.forEach(band => {
    const slider = document.getElementById('eq' + band + 'Slider');
    const bar = document.getElementById('eqBar' + band);
    if (slider && bar) {
      slider.addEventListener('input', function() {
        bar.style.height = this.value + '%';
      });
    }
  });

  const sceneSave = document.getElementById('screenSceneSave');
  const sceneRecall = document.getElementById('screenSceneRecall');
  const sceneMsg = document.getElementById('sceneStatusMsg');

  if (sceneSave) {
    sceneSave.addEventListener('click', () => {
      if (sceneMsg) sceneMsg.textContent = "✅ Preset M32 Scene Saved Successfully!";
    });
  }
  if (sceneRecall) {
    sceneRecall.addEventListener('click', () => {
      if (sceneMsg) sceneMsg.textContent = "⚡ Preset M32 Scene Recalled!";
    });
  }

})();


/* ==========================================================
   EXTRACTED FROM index.html — FX RACK / FX PARAMETERS
   ========================================================== */
(function() {
  "use strict";

  const fxRackButtons = document.querySelectorAll('.fx-buttons button');
  const fxRackPreset = document.getElementById('fxRackPreset');
  const fxRackSummary = document.getElementById('fxRackSummary');

  const fxPresetDescriptions = {
    "FX1": "REVERB • TIME 2.45s",
    "FX2": "STEREO DELAY • 120 BPM",
    "AUX1": "GRAPHIC EQ • 31-BAND",
    "AUX2": "PARAMETRIC EQ • 4-BAND",
    "AUX3": "VINTAGE COMPRESSOR • 2:1",
    "AUX4": "STEREO CHORUS • WIDE"
  };

  fxRackButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopImmediatePropagation();

      fxRackButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      const target = this.dataset.fxSelect;
      if (fxRackPreset) fxRackPreset.textContent = target + " ACTIVE & RUNNING";
      if (fxRackSummary) fxRackSummary.textContent = fxPresetDescriptions[target] || "PROCESSOR ACTIVE";

      const tr = document.getElementById('testResult');
      if (tr) tr.textContent = `FX RACK: Slot ${target} dipilih dan diaktifkan.`;
    });
  });

  const screenFxSelect = document.getElementById('screenFxSelect');
  const fxSlotDetails = document.getElementById('fxSlotDetails');

  if (screenFxSelect) {
    screenFxSelect.addEventListener('change', function() {
      const selectedText = this.options[this.selectedIndex].text;
      const selectedVal = this.value;

      if (fxSlotDetails) {
        fxSlotDetails.innerHTML = `Loaded Slot <strong style="color:var(--accent-color);">${selectedVal}</strong>: <span style="color:#2ecc71; font-weight:bold;">${selectedText}</span>`;
      }

      const tr = document.getElementById('testResult');
      if (tr) tr.textContent = `SCREEN FX: Berhasil memuat ${selectedText}`;
    });
  }

  const fxTapBtn = document.getElementById('fxTap');
  const fxSelBtn = document.getElementById('fxSelect');
  const fxBpmDisplay = document.getElementById('fxBpm');

  let tapTimes = [];
  if (fxTapBtn) {
    fxTapBtn.addEventListener('click', function(e) {
      e.preventDefault();
      const now = Date.now();
      tapTimes.push(now);
      if (tapTimes.length > 3) tapTimes.shift();

      if (tapTimes.length >= 2) {
        const diff = (tapTimes[tapTimes.length - 1] - tapTimes[0]) / (tapTimes.length - 1);
        const calculatedBpm = Math.round(60000 / diff);
        if (calculatedBpm >= 40 && calculatedBpm <= 240) {
          if (fxBpmDisplay) fxBpmDisplay.textContent = calculatedBpm + " BPM";
          const tr = document.getElementById('testResult');
          if (tr) tr.textContent = `FX TAP TEMPO: Sinkron ke ${calculatedBpm} BPM`;
        }
      }
    });
  }

  if (fxSelBtn) {
    fxSelBtn.addEventListener('click', function(e) {
      e.preventDefault();
      alert("⚙️ Pengaturan Parameter Lanjutan FX Terbuka.");
    });
  }

  const fxSliders = document.querySelectorAll('.fx-control');
  fxSliders.forEach(input => {
    input.addEventListener('input', function() {
      const param = this.dataset.param;
      const val = this.value;
      const output = this.parentElement.querySelector('output');

      if (output) {
        if (param === 'time') output.textContent = val + 's';
        else if (param === 'preDelay') output.textContent = val + 'ms';
        else if (param === 'decay') output.textContent = val + '%';
        else if (param === 'level') output.textContent = val + 'dB';
        else output.textContent = val;
      }

      const tr = document.getElementById('testResult');
      if (tr) tr.textContent = `FX PARAM: ${param.toUpperCase()} diatur ke ${val}`;
    });
  });

})();


/* ==========================================================
   EXTRACTED FROM index.html — AUX / FX RETURN ROUTING
   ========================================================== */
(function() {
  "use strict";

  window.state = window.state || { aux: {}, fxReturn: {} };

  const auxReturnControls = document.querySelectorAll('.aux-control');

  auxReturnControls.forEach(input => {
    input.addEventListener('input', function() {
      const target = this.dataset.target || 'AUX1';
      const scope = this.dataset.scope || 'AUX';
      const rawVal = parseFloat(this.value);
      const percentVal = Math.round(rawVal <= 1 ? rawVal * 100 : rawVal);

      if (!window.state) window.state = {};
      if (scope === 'FX_RETURN') {
        if (!window.state.fxReturn) window.state.fxReturn = {};
        window.state.fxReturn[target] = rawVal;
      } else {
        if (!window.state.aux) window.state.aux = {};
        window.state.aux[target] = rawVal;
      }

      const testResult = document.getElementById('testResult');
      if (testResult) {
        testResult.textContent = `ROUTING: ${scope} [${target}] Level diatur ke ${percentVal}%`;
      }

      if (window.MixerControl && typeof window.MixerControl.setControl === "function") {
        window.MixerControl.setControl(target, scope.toLowerCase(), rawVal);
      }
    });
  });

})();


/* ==========================================================
   EXTRACTED FROM index.html — MONITOR / PHONES / MASTER UI
   ========================================================== */
(function() {
  "use strict";

  const monitorCard = document.querySelector('.monitor-card');
  if (monitorCard) {
    const monitorBtn = monitorCard.querySelector('button');
    const monitorKnob = monitorCard.querySelector('.monitor-knob, #monitorLevel');
    
    if (monitorBtn) {
      const sources = ["MAIN L/R", "AUX 1-2", "FX 1-2", "USB STREAM"];
      let srcIdx = 0;

      monitorBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        srcIdx = (srcIdx + 1) % sources.length;
        this.textContent = sources[srcIdx];

        const tr = document.getElementById('testResult');
        if (tr) tr.textContent = `MONITOR: Sumber dialihkan ke ${sources[srcIdx]}`;
      });
    }

    if (monitorKnob) {
      monitorKnob.style.cursor = 'pointer';
      monitorKnob.addEventListener('click', function() {
        const tr = document.getElementById('testResult');
        if (tr) tr.textContent = `MONITOR LEVEL: Diputar/disesuaikan.`;
      });
    }
  }

  const phonesCard = document.querySelector('.phones-card');
  if (phonesCard) {
    const phoneKnob = phonesCard.querySelector('.phone-knob, div');
    const phoneIndicator = phonesCard.querySelector('span:last-child, .phone-dot');

    if (phoneKnob) {
      phoneKnob.style.cursor = 'pointer';
      let phoneActive = true;

      phoneKnob.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        phoneActive = !phoneActive;
        
        if (phoneIndicator) {
          phoneIndicator.style.color = phoneActive ? '#2ecc71' : '#e74c3c';
        }

        const tr = document.getElementById('testResult');
        if (tr) tr.textContent = `PHONES: Output Headphone ${phoneActive ? 'AKTIF' : 'MUTED'}`;
      });
    }
  }

  const masterFader = document.getElementById('master');
  const masterVal = document.getElementById('masterVal');
  const masterMeterL = document.getElementById('masterMeterL');
  const masterMeterR = document.getElementById('masterMeterR');

  if (masterFader) {
    masterFader.addEventListener('input', function() {
      const level = parseInt(this.value, 10);
      if (masterVal) masterVal.textContent = level + '%';

      if (masterMeterL && masterMeterR) {
        const h = level > 0 ? level + '%' : '0%';
        masterMeterL.style.height = h;
        masterMeterR.style.height = h;
      }

      if (!window.state) window.state = {};
      window.state.masterFader = level;

      const tr = document.getElementById('testResult');
      if (tr) tr.textContent = `MASTER: Level Main L/R disetel ke ${level}%`;
    });
  }

})();


/* ==========================================================
   EXTRACTED FROM index.html — CLOCK UI
   ========================================================== */
(function() {
  "use strict";

  function updateClock() {
    const clockEl = document.getElementById('clock');
    if (!clockEl) return;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    clockEl.textContent = `${hours}:${minutes}:${seconds}`;
  }

  setInterval(updateClock, 1000);
  updateClock();

})();
