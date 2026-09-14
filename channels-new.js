/* ============================================================
   Mixer-Online — 14CH channel panel & Clean Top Bar Layout
   ============================================================ */
(function () {
  "use strict";

  /* ============================================================
     CSS PERBAIKAN BILAH ATAS & SCROLL CHANNEL HORIZONTAL
     ============================================================ */
  if (!document.getElementById("mixer-channel-led-skin")) {
    const style = document.createElement("style");
    style.id = "mixer-channel-led-skin";
    style.textContent = `
      /* PERBAIKAN BILAH ATAS (TOP BAR / HEADER KONTROL) */
      header, .top-bar, .mixer-header, div[style*="flex"] {
        box-sizing: border-box !important;
      }

      /* Merapikan kontainer tombol atas agar tersusun rapi & tidak bertumpuk */
      .top-controls, .header-panel, .mixer-top-panel, 
      header .flex, div:has(> #systemBtn), div:has(> .system-btn) {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 6px !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      /* Paksa kontainer pembungkus channel agar bisa di-scroll ke kanan & kiri dengan mulus */
      #channels, #channelsRight {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        gap: 8px !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        -webkit-overflow-scrolling: touch !important;
        width: 100% !important;
        max-width: 100% !important;
        height: 100% !important;
        box-sizing: border-box !important;
        padding: 4px 6px 2px 6px !important;
      }

       /* Ubah tinggi fader channel dari 175px menjadi sekitar 195px atau sesuaikan dengan tinggi layar */
  .new-channel-strip input.channel-fader, 
  .new-channel-strip input.new-fader,
  .channel-strip input.channel-fader {
    position: relative !important;
    z-index: 2 !important;
    background: transparent !important;
    height: 195px !important;
    min-height: 195px !important;
    width: 18px !important;
    accent-color: var(--accent-color) !important;
    margin: 0 !important;
    pointer-events: auto !important;
    touch-action: pan-y !important;
  }
  
  .new-channel-strip .ch-side-vu {
    height: 195px !important;
    min-height: 195px !important;
    width: 7px !important;
    background: #040608 !important;
    border: 1px solid var(--panel-border) !important;
    border-radius: 2px !important;
    overflow: hidden !important;
    display: flex !important;
    flex-direction: column-reverse !important;
    z-index: 2 !important;
  }


      .new-channel-strip .channel-led.active.green {
        opacity: 1 !important;
        background: linear-gradient(180deg,#8dffb7,#20d968 48%,#0a7135) !important;
        box-shadow: 0 0 5px rgba(46,255,128,.6) !important;
      }

      .new-channel-strip .channel-led.active.red {
        opacity: 1 !important;
        background: linear-gradient(180deg,#ff918b,#ff3b30 48%,#8d120d) !important;
        box-shadow: 0 0 5px rgba(255,59,48,.6) !important;
      }

      /* KONTROL / KNOB */
      .new-channel-strip .new-channel-control {
        width: 100% !important;
        padding: 1px 0 !important;
        margin-bottom: 1px !important;
        text-align: center !important;
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        flex-shrink: 0 !important;
      }

      .new-channel-strip .new-channel-control label {
        display: block !important;
        font-size: 6px !important;
        color: #94a3b8 !important;
        margin-bottom: 1px !important;
        white-space: nowrap !important;
      }

      .new-channel-strip .new-channel-control input.new-knob {
        width: 100% !important;
        max-width: 60px !important;
        height: 12px !important;
        margin: 1px auto !important;
        display: block !important;
        cursor: pointer !important;
      }

      .new-channel-strip .new-channel-control .knob-val {
        display: block !important;
        font-size: 6px !important;
        font-weight: 600 !important;
        color: #fff !important;
        white-space: nowrap !important;
      }

      /* FADER AREA & METERAN BERDAMPINGAN (DIPERPANJANG KE BAWAH) */
      .new-channel-strip .fader-area {
        position: relative !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 3px !important;
        width: 100% !important;
        flex-grow: 1 !important;
        height: 100% !important;
        min-height: 195px !important;
        padding: 4px 1px 2px 1px !important;
        box-sizing: border-box !important;
      }

      .new-channel-strip input[type="range"] {
        touch-action: none !important;
      }

      /* Slider Fader (Disesuaikan menjadi 195px agar pas mentok bawah) */
      .new-channel-strip .fader-area input.channel-fader, 
      .new-channel-strip .fader-area input.new-fader {
        width: 16px !important;
        height: 195px !important;
        min-height: 195px !important;
        position: relative !important;
        z-index: 2 !important;
        background: transparent !important;
        accent-color: var(--accent-color) !important;
        margin: 0 !important;
      }

      /* KOTAK LED METER VERTIKAL (Disesuaikan menjadi 195px) */
      .new-channel-strip .ch-side-vu {
        position: relative !important;
        width: 8px !important;
        height: 195px !important;
        min-height: 195px !important;
        background: #040608 !important;
        border: 1px solid rgba(255,255,255,0.3) !important;
        border-radius: 2px !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column-reverse !important;
        z-index: 3 !important;
        flex-shrink: 0 !important;
      }

      .new-channel-strip .ch-side-vu .ch-side-vu-fill {
        width: 100% !important;
        height: 0%;
        background: linear-gradient(0deg, #2ecc71 0%, #2ecc71 65%, #f1c40f 66%, #f39c12 85%, #e74c3c 86%, #ff0000 100%) !important;
        transition: height 0.04s ease-out !important;
        will-change: height;
      }

      .new-channel-strip .fader-area label {
        position: absolute !important;
        top: 1px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        font-size: 5px !important;
        color: #94a3b8 !important;
      }

      .new-channel-strip .fader-area output.fader-val {
        position: absolute !important;
        bottom: 1px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        font-size: 6px !important;
        font-weight: bold !important;
        color: #2ecc71 !important;
      }

      .new-channel-strip .new-channel-buttons {
        display: flex !important;
        flex-direction: column !important;
        gap: 2px !important;
        width: 100% !important;
        margin-top: 1px !important;
        flex-shrink: 0 !important;
      }

      .new-channel-strip .new-channel-buttons button {
        font-size: 6px !important;
        padding: 3px 1px !important;
        width: 100% !important;
        box-sizing: border-box !important;
        cursor: pointer !important;
      }

      .new-channel-strip .new-channel-head {
        font-size: 8px !important;
        font-weight: bold !important;
        padding: 1px !important;
        text-align: center !important;
        width: 100% !important;
        flex-shrink: 0 !important;
      }

      .new-channel-strip .new-channel-source {
        font-size: 5px !important;
        padding: 1px !important;
        text-align: center !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        width: 100% !important;
        flex-shrink: 0 !important;
      }

      /* PERBAIKAN TAMPILAN PORTRET & RESPONSIF LAYAR */
      @media screen and (max-width: 768px), (orientation: portrait) {
        html, body {
          width: 100% !important;
          overflow-x: hidden !important;
        }
        header.topbar, main.console, .bottom-nav {
          width: 100% !important;
          min-width: 100% !important;
          max-width: 100% !important;
        }
        header.topbar {
          flex-wrap: wrap !important;
          gap: 3px !important;
          padding: 4px !important;
        }
        main.console {
          flex-direction: column !important;
          align-items: stretch !important;
          padding: 2px !important;
          gap: 4px !important;
        }
        .channel-bank, aside.master-rack, .center-console {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 100% !important;
        }
        #channels, #channelsRight {
          display: grid !important;
          grid-template-columns: repeat(7, 1fr) !important;
          gap: 1px !important;
          width: 100% !important;
        }
        .new-channel-strip, .channel-strip {
          flex: 1 1 0 !important;
          min-width: 0 !important;
          padding: 1px 0px !important;
        }
        .new-channel-strip input.channel-fader, 
        .new-channel-strip input.new-fader,
        .channel-strip input.channel-fader,
        .new-channel-strip .ch-side-vu {
          height: 140px !important;
          min-height: 140px !important;
        }
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
    const hasSignal = Number(c.level) > 0;
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
        <label>VOL</label>
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
      const ch = window.state?.channels?.[id - 1];
      if (!ch) return;

      if (k === "mute" || k === "solo") {
        ch[k] = Boolean(value);
      } else {
        if (!window.state?.system) {
          const r = $("testResult"); 
          if (r) r.textContent = "CONTROL BLOCKED: SYSTEM OFF";
          return;
        }
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
        } else if (Number(ch.level) > 0) {
          ledEl.className = "channel-led active green";
        } else {
          ledEl.className = "channel-led";
        }
      }

      try {
        if (typeof window.MixerControl?.setControl === "function") {
          window.MixerControl.setControl(id, k, ch[k]);
        }
      } catch (err) {
        console.warn("MixerControl sync warning:", err);
      }
    };

    el.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", (e) => updateSmooth(e.target.dataset.k, e.target.value), { passive: true });
    });

    el.querySelectorAll("button").forEach(button => {
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!window.state?.system) {
          const r = $("testResult"); 
          if (r) r.textContent = "CONTROL BLOCKED: SYSTEM OFF";
          return;
        }
      
        const k = button.dataset.k;
        const ch = window.state.channels[id - 1];
        if (!ch) return;

        ch[k] = !ch[k];
        const nextValue = ch[k];
        
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

  function startStandaloneMeterLoop() {
  requestAnimationFrame(startStandaloneMeterLoop);

  if (!window.state || !window.state.channels) return;

  const strips = document.querySelectorAll(
    ".new-channel-strip[data-ch]"
  );

  if (!window.state.system) {
    strips.forEach((strip) => {
      const vuFill = strip.querySelector(".ch-side-vu-fill");
      const ledEl = strip.querySelector(".channel-led");

      if (vuFill) {
        vuFill.style.setProperty(
          "height",
          "0%",
          "important"
        );
      }

      if (ledEl) {
        ledEl.className = "channel-led";
      }
    });

    return;
  }

  strips.forEach((strip) => {
    const ch = Number(strip.dataset.ch);

    if (!Number.isInteger(ch) || ch < 1 || ch > N) {
      return;
    }

    const chData = window.state.channels[ch - 1];
    if (!chData) return;

    const vuFill = strip.querySelector(".ch-side-vu-fill");
    const ledEl = strip.querySelector(".channel-led");

    if (!vuFill) return;

    const muted = Boolean(chData.mute);
    const faderVal = Number(chData.fader ?? 75);

    let level = Number(chData.level);

    if (!Number.isFinite(level)) {
      level = 0;
    }

    /*
     * Mendukung dua format level:
     * - 0 sampai 1
     * - 0 sampai 100
     */
    if (level > 1) {
      level = level / 100;
    }

    level = Math.max(0, Math.min(1, level));

    const faderScale = Math.max(
      0,
      Math.min(1, faderVal / 100)
    );

    const visibleLevel = muted
      ? 0
      : level * faderScale;

    const percent = Math.round(
      visibleLevel * 100
    );

    vuFill.style.setProperty(
      "height",
      `${percent}%`,
      "important"
    );

    if (ledEl) {
      if (muted) {
        ledEl.className = "channel-led active red";
      } else if (percent > 0) {
        ledEl.className = "channel-led active green";
      } else {
        ledEl.className = "channel-led";
      }
    }
  });
}

    for (let i = 1; i <= N; i++) {
      const chData = window.state.channels[i - 1];
      if (!chData) continue;

      const strip = document.querySelector(`.new-channel-strip[data-ch="${i}"]`);
      if (!strip) continue;

      const vuFill = strip.querySelector(".ch-side-vu-fill");
      const ledEl = strip.querySelector(".channel-led");
      if (!vuFill) continue;

      const muted = Boolean(chData.mute);
      const faderVal = Number(chData.fader ?? 75);
      let lvl = Number(chData.level || 0);

      if (muted || faderVal === 0 || lvl <= 0) {
        vuFill.style.height = "0%";
        if (ledEl && !muted) {
          ledEl.className = "channel-led";
        }
        continue;
      }

      const percent = Math.min(100, Math.max(0, Math.round(lvl * 100))) + "%";
      vuFill.style.height = percent;

      if (ledEl && !muted) {
        ledEl.className = "channel-led active green";
      }
    }
  }

  window.buildNew14ChannelPanel = build;
  window.syncNew14ChannelPanel = sync;

  document.addEventListener("click", function(e) { 
    if (e.target.closest('input, button, .new-channel-buttons, .new-channel-control, .fader-area')) return;
    const card = e.target.closest(".new-channel-strip"); 
    if (card && typeof window.selectScreenChannel === "function") { 
      window.selectScreenChannel(Number(card.dataset.ch)); 
    }
  }, { passive: true });

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
