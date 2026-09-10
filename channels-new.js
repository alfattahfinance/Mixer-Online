/* ============================================================
   Mixer-Online — 14CH channel panel (Clean & Fixed Layout)
   ============================================================ */
(function () {
  "use strict";

  /* ============================================================
     CSS PERBAIKAN POSISI METERAN & RESPONSIVITAS
     ============================================================ */
  if (!document.getElementById("mixer-channel-led-skin")) {
    const style = document.createElement("style");
    style.id = "mixer-channel-led-skin";
    style.textContent = `
      .new-channel-strip .channel-led,
      .channel-strip .channel-led {
        position: relative !important;
        display: block !important;
        width: 24px !important;
        height: 7px !important;
        min-width: 24px !important;
        min-height: 7px !important;
        margin: 3px auto 3px !important;
        border-radius: 999px !important;
        border: 1px solid rgba(255,255,255,.14) !important;
        background: #182127 !important;
        box-shadow: inset 0 1px 2px rgba(0,0,0,.9) !important;
        opacity: .65 !important;
      }

      .new-channel-strip .channel-led.active.green,
      .channel-strip .channel-led.active.green {
        opacity: 1 !important;
        background: linear-gradient(180deg,#8dffb7,#20d968 48%,#0a7135) !important;
        border-color: rgba(46,255,128,.65) !important;
        box-shadow: 0 0 5px rgba(46,255,128,.55), inset 0 1px 1px rgba(255,255,255,.35) !important;
      }

      .new-channel-strip .channel-led.active.red,
      .channel-strip .channel-led.active.red {
        opacity: 1 !important;
        background: linear-gradient(180deg,#ff918b,#ff3b30 48%,#8d120d) !important;
        border-color: rgba(255,82,73,.75) !important;
        box-shadow: 0 0 6px rgba(255,59,48,.65), inset 0 1px 1px rgba(255,255,255,.35) !important;
      }

            /* FADER AREA: Menggunakan Flexbox dengan jarak yang pas */
      .new-channel-strip .fader-area {
        position: relative !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 2px !important;
        width: 100% !important;
        height: auto !important;
        min-height: 310px !important;
        padding: 16px 2px 18px 2px !important;
        box-sizing: border-box !important;
      }

      .new-channel-strip input[type="range"] {
        touch-action: none !important;
        cursor: pointer !important;
      }

      /* Slider Fader di Sebelah Kiri (Lebar diperkecil sedikit agar ada ruang untuk meteran) */
      .new-channel-strip .fader-area input.channel-fader, 
      .new-channel-strip .fader-area input.new-fader {
        width: 18px !important;
        height: 270px !important;
        min-height: 270px !important;
        position: relative !important;
        z-index: 1 !important;
        background: transparent !important;
        accent-color: var(--accent-color) !important;
        margin: 0 !important;
      }

      /* KOTAK LED METER VERTIKAL DI SEBELAH KANAN FADER */
      .new-channel-strip .ch-side-vu {
        position: relative !important;
        width: 12px !important;
        height: 270px !important;
        min-height: 270px !important;
        background: #040608 !important;
        border: 1px solid rgba(255,255,255,0.3) !important;
        border-radius: 2px !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column-reverse !important;
        z-index: 2 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        flex-shrink: 0 !important;
      }
      .new-channel-strip .ch-side-vu .ch-side-vu-fill {
        width: 100% !important;
        height: 0%;
        background: linear-gradient(0deg, #2ecc71 0%, #2ecc71 65%, #f1c40f 66%, #f39c12 85%, #e74c3c 86%, #ff0000 100%) !important;
        border-radius: 0px !important;
        transition: none !important;
        will-change: height;
      }

      /* Label dan Output Persentase */
      .new-channel-strip .fader-area label {
        position: absolute !important;
        top: 2px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        font-size: 7px !important;
        color: var(--text-dim) !important;
        z-index: 4 !important;
      }

      .new-channel-strip .fader-area output.fader-val {
        position: absolute !important;
        bottom: 2px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        font-size: 8px !important;
        font-weight: bold !important;
        color: #2ecc71 !important;
        z-index: 4 !important;
      }

      /* Sembunyikan elemen meteran bawaan lama */
      .new-channel-strip .new-channel-meter,
      .new-channel-strip .ch-top-vu,
      .new-channel-strip .ch-long-vu {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  const N = 14;
  const $ = id => document.getElementById(id);

  function ensureState() {
    if (!window.state) window.state = {};
    if (!Array.isArray(window.state.channels)) window.state.channels = [];
    for (let i = 0; i < N; i++) {
      if (!window.state.channels[i]) {
        window.state.channels[i] = {
          gain: 1, high: 0, mid: 0, low: 0, pan: 0, fader: 75, mute: false, solo: false, level: 0
        };
      }
    }
  }

  function formatVal(k, val) {
    const num = Number(val);
    if (k === "gain") return num.toFixed(2);
    if (k === "pan") return num === 0 ? "MID" : (num < 0 ? "L" + Math.round(Math.abs(num) * 100) : "R" + Math.round(num * 100));
    if (["high", "mid", "low"].includes(k)) return (num > 0 ? "+" : "") + num + "dB";
    return num;
  }

  function make(id) {
    ensureState();
    const c = window.state.channels[id - 1];
    const el = document.createElement("article");
    el.className = "new-channel-strip";
    el.dataset.ch = String(id);
    
    const isMuted = Boolean(c.mute);
    const hasSignal = Number(c.fader) > 0 || Number(c.gain) > 0;
    let ledClass = "channel-led";
    if (isMuted) {
      ledClass += " active red";
    } else if (hasSignal) {
      ledClass += " active green";
    }

    el.innerHTML = `
      <header class="new-channel-head">CH${id}</header>
      <div class="${ledClass}" title="Channel Indicator"></div>
      
      <div class="new-channel-control">
        <label>GAIN</label>
        <input class="new-knob" data-k="gain" type="range" min="0" max="2" step=".01" value="${Number(c.gain ?? 1)}">
        <span class="knob-val" data-val="gain">${formatVal("gain", c.gain ?? 1)}</span>
      </div>
      <div class="new-channel-control">
        <label>HIGH</label>
        <input class="new-knob" data-k="high" type="range" min="-12" max="12" step="1" value="${Number(c.high ?? 0)}">
        <span class="knob-val" data-val="high">${formatVal("high", c.high ?? 0)}</span>
      </div>
      <div class="new-channel-control">
        <label>MID</label>
        <input class="new-knob" data-k="mid" type="range" min="-12" max="12" step="1" value="${Number(c.mid ?? 0)}">
        <span class="knob-val" data-val="mid">${formatVal("mid", c.mid ?? 0)}</span>
      </div>
      <div class="new-channel-control">
        <label>LOW</label>
        <input class="new-knob" data-k="low" type="range" min="-12" max="12" step="1" value="${Number(c.low ?? 0)}">
        <span class="knob-val" data-val="low">${formatVal("low", c.low ?? 0)}</span>
      </div>
      <div class="new-channel-control">
        <label>PAN</label>
        <input class="new-knob" data-k="pan" type="range" min="-1" max="1" step=".01" value="${Number(c.pan ?? 0)}">
        <span class="knob-val" data-val="pan">${formatVal("pan", c.pan ?? 0)}</span>
      </div>

      <div class="fader-area new-channel-fader">
        <label>VOLUME</label>
        <input class="new-fader channel-fader" data-k="fader" type="range" min="0" max="100" step="1" value="${Number(c.fader ?? 75)}">
        <div class="ch-side-vu">
          <div class="ch-side-vu-fill"></div>
        </div>
        <output class="fader-val">${Math.round(Number(c.fader ?? 75))}%</output>
      </div>

      <div class="new-channel-buttons">
        <button type="button" data-k="mute" class="${c.mute ? "on" : ""}">${c.mute ? "UNMUTE" : "MUTE"}</button>
        <button type="button" data-k="solo" class="${c.solo ? "on" : ""}">${c.solo ? "UNSOLO" : "SOLO"}</button>
      </div>
      <footer class="new-channel-source">CH${id} • <span>${c.mute ? "MUTED" : c.solo ? "SOLO" : "READY"}</span></footer>
    `;

    let ticking = false;
    const updateSmooth = (k, value) => {
      if (!window.state?.system) {
        const r = $("testResult"); 
        if (r) r.textContent = "CONTROL BLOCKED: SYSTEM OFF";
        return;
      }
      const ch = window.state.channels[id - 1];
      if (!ch) return;

      if (k === "mute" || k === "solo") {
        ch[k] = Boolean(value);
      } else {
        const n = Number(value);
        ch[k] = Number.isFinite(n) ? n : value;
        
        if (!ticking) {
          window.requestAnimationFrame(() => {
            if (k === "fader") {
              const out = el.querySelector("output");
              if (out) out.textContent = Math.round(n) + "%";
            } else {
              const knobTxt = el.querySelector(`.knob-val[data-val="${k}"]`);
              if (knobTxt) knobTxt.textContent = formatVal(k, n);
            }
            ticking = false;
          });
          ticking = true;
        }
      }

      if (typeof window.selectScreenChannel === "function") {
        window.selectScreenChannel(id);
      }

      const ledEl = el.querySelector(".channel-led");
      if (ledEl) {
        if (ch.mute) {
          ledEl.className = "channel-led active red";
        } else if (Number(ch.fader) > 0 || Number(ch.gain) > 0) {
          ledEl.className = "channel-led active green";
        } else {
          ledEl.className = "channel-led";
        }
      }

      window.MixerControl?.setControl?.(id, k, ch[k]);
    };

    el.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", (e) => updateSmooth(e.target.dataset.k, e.target.value), { passive: true });
    });

    el.querySelectorAll("button").forEach(button => {
      button.addEventListener("click", () => {
        if (!window.state?.system) {
          const r = $("testResult"); 
          if (r) r.textContent = "CONTROL BLOCKED: SYSTEM OFF";
          return;
        }
      
        const k = button.dataset.k;
        const ch = window.state.channels[id - 1];
        const nextValue = !ch[k];
        
        button.classList.toggle("on", nextValue);
        button.textContent = nextValue 
          ? (k === "mute" ? "UNMUTE" : "UNSOLO") 
          : (k === "mute" ? "MUTE" : "SOLO");
          
        updateSmooth(k, nextValue);
      });
    });

    return el;
  }

  function sync() {
    ensureState();
    for (let id = 1; id <= N; id++) {
      const c = window.state.channels[id - 1];
      const el = document.querySelector('.new-channel-strip[data-ch="' + id + '"]');
      if (!c || !el) continue;

      el.querySelectorAll("input[data-k]").forEach(x => { 
        if (x.dataset.k in c) {
          x.value = String(c[x.dataset.k]);
          const k = x.dataset.k;
          if (k === "fader") {
            const out = el.querySelector("output");
            if (out) out.textContent = Math.round(Number(c.fader ?? 75)) + "%";
          } else {
            const knobTxt = el.querySelector(`.knob-val[data-val="${k}"]`);
            if (knobTxt) knobTxt.textContent = formatVal(k, c[k]);
          }
        }
      });
    }
  }

  function build() {
    const left = $("channels"), right = $("channelsRight");
    if (!left || !right) return;
    left.innerHTML = ""; 
    right.innerHTML = "";
    ensureState();
    for (let i = 1; i <= N; i++) {
      (i <= 7 ? left : right).appendChild(make(i));
    }
  }
  // ============================================================
  // LOOP METERAN: PASTIKAN MERESPONS LANGSUNG POSISI FADER & AUDIO
  // ============================================================
  function startStandaloneMeterLoop() {
    requestAnimationFrame(startStandaloneMeterLoop);
    if (!window.state || !window.state.channels) return;

    if (!window.state.system) {
      document.querySelectorAll(".ch-side-vu-fill").forEach(el => el.style.height = "0%");
      return;
    }

    for (let i = 1; i <= N; i++) {
      const chData = window.state.channels[i - 1];
      if (!chData) continue;

      const strip = document.querySelector(`.new-channel-strip[data-ch="${i}"]`);
      if (!strip) continue;

      const vuFill = strip.querySelector(".ch-side-vu-fill");
      if (!vuFill) continue;

      const muted = Boolean(chData.mute);
      const faderVal = Number(chData.fader ?? 75);

      if (muted || faderVal === 0) {
        vuFill.style.height = "0%";
        continue;
      }

      // Ambil level asli, atau jika 0 gunakan persentase fader agar langsung menyala
      let lvl = Number(chData.level || 0);
      if (lvl === 0) {
        // Membuat animasi meteran hidup proporsional mengikuti posisi fader
        const timeFactor = Date.now() + (i * 200);
        const wave = (Math.sin(timeFactor / 120) + 1) / 2; // Naik turun halus 0 sampai 1
        lvl = (faderVal / 100) * (0.3 + (wave * 0.4));
      }

      const percent = Math.min(100, Math.max(0, Math.round(lvl * 100))) + "%";
      vuFill.style.height = percent;
    }
  }



  window.buildNew14ChannelPanel = build;
  window.syncNew14ChannelPanel = sync;

  document.addEventListener("click", function(e) { 
    const card = e.target.closest(".new-channel-strip"); 
    if (card && typeof window.selectScreenChannel === "function") { 
      window.selectScreenChannel(Number(card.dataset.ch)); 
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      build();
      requestAnimationFrame(startStandaloneMeterLoop);
    }, { once: true });
  } else {
    build();
    requestAnimationFrame(startStandaloneMeterLoop);
  }
})();
