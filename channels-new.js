/* ============================================================
   Mixer-Online — 14CH channel panel
   Owns channel DOM only. Uses the existing MixerControl adapter
   for commands; it does not replace the mixer engine.
   ============================================================ */
(function () {
  "use strict";

  /* ============================================================
     CHANNEL INDICATOR SKIN & LAYOUT OVERRIDE
     ============================================================ */
  if (!document.getElementById("mixer-channel-led-skin")) {
    const style = document.createElement("style");
    style.id = "mixer-channel-led-skin";
    style.textContent = `
      /* 1. Strip Channel Container */
      .new-channel-strip,
      .channel-strip {
        position: relative !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: space-between !important;
        background: var(--strip-bg, #121619) !important;
        border-right: 1px dashed var(--panel-border, #2a323d) !important;
        padding: 8px 3px 0px 3px !important;
        box-sizing: border-box !important;
        height: 100% !important;
        margin-bottom: 0 !important;
      }

      /* 2. Lampu LED Status Atas (Hijau / Merah) */
      .new-channel-strip .channel-led,
      .channel-strip .channel-led {
        position: relative !important;
        z-index: 2 !important;
        display: block !important;
        width: 10px !important;
        height: 10px !important;
        margin: 2px auto 4px auto !important;
        border-radius: 50% !important;
        border: 1px solid rgba(255,255,255,.2) !important;
        background: #182127 !important;
        box-shadow: inset 0 1px 2px rgba(0,0,0,.9) !important;
      }

      .new-channel-strip .channel-led.active.green,
      .channel-strip .channel-led.active.green,
      .channel-led.green.on {
        background: #31e66b !important;
        border-color: #31e66b !important;
        box-shadow: 0 0 8px #31e66b, inset 0 1px 1px rgba(255,255,255,.5) !important;
      }

      .new-channel-strip .channel-led.active.red,
      .channel-strip .channel-led.active.red {
        background: #ff3b30 !important;
        border-color: #ff3b30 !important;
        box-shadow: 0 0 8px #ff3b30, inset 0 1px 1px rgba(255,255,255,.5) !important;
      }

      /* 3. Indikator VU Meter Vertikal Panjang (Latar Belakang Knob) */
      .new-channel-strip .ch-top-vu,
      .channel-strip .ch-top-vu,
      .ch-long-vu {
        position: absolute !important;
        z-index: 1 !important; /* Di belakang knob agar tidak menghalangi sentuhan */
        pointer-events: none !important;
        width: 6px !important;
        top: 26px !important;
        bottom: 250px !important;
        margin: 0 auto !important;
        border: 1px solid rgba(255,255,255,.1) !important;
        border-radius: 2px !important;
        background: #080a0c !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column-reverse !important;
      }

      .new-channel-strip .ch-top-vu-fill,
      .channel-strip .ch-top-vu-fill,
      .ch-long-vu-fill {
        width: 100% !important;
        height: 0%;
        background: linear-gradient(to top, #31e66b 65%, #ffd21c 85%, #ff3b30 100%) !important;
        transition: height .05s linear !important;
      }

      /* 4. Kelompok Knob Gain, High, Mid, Low, Pan (Diturunkan & Responsif) */
      .new-channel-control,
      .ch-controls-group {
        position: relative !important;
        z-index: 2 !important; /* Memastikan Knob di atas VU meter */
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        gap: 4px !important;
        width: 100% !important;
        margin-top: 6px !important;
      }

      .new-channel-strip input[type="range"].new-knob {
        position: relative !important;
        z-index: 3 !important;
        touch-action: none !important;
        cursor: pointer !important;
        width: 100% !important;
      }

      .knob-val {
        font-size: 8px !important;
        color: var(--accent-cyan, #00e5ff) !important;
        font-weight: bold !important;
        display: block !important;
        text-align: center !important;
        margin-top: 1px !important;
      }

      /* 5. Teks Volume & Slider Fader Vertikal (Ditata Pas Sampai Dasar) */
      .volume-label-text,
      .new-channel-fader label {
        position: relative !important;
        z-index: 2 !important;
        font-size: 8px !important;
        font-weight: bold !important;
        color: var(--text-dim, #8b949e) !important;
        text-transform: uppercase !important;
        margin: 8px 0 2px 0 !important;
        text-align: center !important;
      }

      .fader-area,
      .new-channel-fader {
        position: relative !important;
        z-index: 2 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: flex-end !important;
        flex-grow: 1 !important;
        width: 100% !important;
        margin-top: auto !important;
        padding-bottom: 0px !important;
      }

      .new-channel-strip input[type="range"].new-fader,
      .channel-fader {
        -webkit-appearance: slider-vertical !important;
        -moz-appearance: slider-vertical !important;
        appearance: slider-vertical !important;
        writing-mode: bt-lr !important;
        width: 18px !important;
        height: 230px !important; /* Menutup celah kosong bagian bawah */
        background: #080a0b !important;
        border: 1px solid var(--panel-border, #2a323d) !important;
        border-radius: 3px !important;
        margin: 0 auto !important;
        accent-color: var(--accent-color, #00e5ff) !important;
        touch-action: none !important;
        cursor: pointer !important;
      }

      /* 6. Tombol Mute & Solo */
      .new-channel-buttons {
        position: relative !important;
        z-index: 2 !important;
        width: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 2px !important;
        margin-top: 4px !important;
      }

      .new-channel-buttons button[data-k="mute"].on,
      .btn-mute.active {
        background: linear-gradient(180deg, #ef4444, #991b1b) !important;
        border-color: #f87171 !important;
        color: #fff !important;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.6) !important;
      }

      .new-channel-buttons button[data-k="solo"].on,
      .btn-solo.active {
        background: linear-gradient(180deg, #eab308, #854d0e) !important;
        border-color: #fde047 !important;
        color: #fff !important;
        box-shadow: 0 0 8px rgba(234, 179, 8, 0.6) !important;
      }

      /* Sembunyikan meter segmented lama */
      .new-channel-strip .new-channel-meter {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  const N = 14;
  const $ = id => document.getElementById(id);

  function triggerHaptic(ms) {
    if (window.AndroidFeedback && typeof window.AndroidFeedback.triggerHaptic === "function") {
      window.AndroidFeedback.triggerHaptic(ms);
    } else if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }

  function ensureState() {
    if (!window.state) window.state = {};
    if (!Array.isArray(window.state.channels)) window.state.channels = [];
    for (let i = 0; i < N; i++) {
      if (!window.state.channels[i]) {
        window.state.channels[i] = {
          gain: 1.0, high: 0, mid: 0, low: 0, pan: 0, fader: 75, mute: false, solo: false, level: 0
        };
      }
    }
  }

  // Format teks tampilan nilai knob
  function formatVal(k, val) {
    const num = Number(val);
    if (k === "gain") return num.toFixed(2);
    if (k === "pan") return num === 0 ? "MID" : (num < 0 ? "L" + Math.round(Math.abs(num) * 100) : "R" + Math.round(num * 100));
    if (["high", "mid", "low"].includes(k)) return (num > 0 ? "+" : "") + Math.round(num) + "dB";
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
      <div class="ch-top-vu"><div class="ch-top-vu-fill"></div></div>
      
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

      <div class="volume-label-text">VOLUME</div>
      <div class="fader-area new-channel-fader">
        <input class="new-fader channel-fader" data-k="fader" type="range" min="0" max="100" step="1" value="${Number(c.fader ?? 75)}">
        <output class="fader-val">${Math.round(Number(c.fader ?? 75))}%</output>
      </div>
      <div class="new-channel-buttons">
        <button type="button" data-k="mute" class="${c.mute ? "on" : ""}">${c.mute ? "UNMUTE" : "MUTE"}</button>
        <button type="button" data-k="solo" class="${c.solo ? "on" : ""}">${c.solo ? "UNSOLO" : "SOLO"}</button>
      </div>
      <footer class="new-channel-source">CH${id} • <span>${c.mute ? "MUTED" : c.solo ? "SOLO" : "READY"}</span></footer>
    `;

    const update = (k, value) => {
      triggerHaptic(10);
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
        
        if (k === "fader") {
          const out = el.querySelector("output");
          if (out) out.textContent = Math.round(n) + "%";
        } else {
          const knobTxt = el.querySelector(`.knob-val[data-val="${k}"]`);
          if (knobTxt) knobTxt.textContent = formatVal(k, n);
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

      const result = window.MixerControl?.setControl?.(id, k, ch[k]);
      const r = $("testResult");
      if (r) {
        r.textContent = result?.ok 
          ? "CH" + id + " " + k.toUpperCase() + " → SENT" 
          : "CH" + id + " " + k.toUpperCase() + " → " + (result?.reason || "OFFLINE");
      }

      const statusSpan = el.querySelector("footer span");
      if (statusSpan) {
        statusSpan.textContent = ch.mute ? "MUTED" : ch.solo ? "SOLO" : "READY";
      }
    };

    el.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", () => update(input.dataset.k, input.value));
    });

    el.querySelectorAll("button").forEach(button => {
      button.addEventListener("click", () => {
        triggerHaptic(20);
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
          
        update(k, nextValue);
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

      const ledEl = el.querySelector(".channel-led");
      if (ledEl) {
        if (c.mute) {
          ledEl.className = "channel-led active red";
        } else if (Number(c.fader) > 0 || Number(c.gain) > 0) {
          ledEl.className = "channel-led active green";
        } else {
          ledEl.className = "channel-led";
        }
      }

      el.querySelectorAll("button[data-k]").forEach(b => { 
        const k = b.dataset.k;
        const on = !!c[k]; 
        b.classList.toggle("on", on); 
        b.textContent = on ? (k === "mute" ? "UNMUTE" : "UNSOLO") : (k === "mute" ? "MUTE" : "SOLO"); 
      });

      const status = el.querySelector("footer span"); 
      if (status) status.textContent = c.mute ? "MUTED" : c.solo ? "SOLO" : "READY";
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

  window.buildNew14ChannelPanel = build;
  window.syncNew14ChannelPanel = sync;

  document.addEventListener("click", function(e) { 
    const card = e.target.closest(".new-channel-strip"); 
    if (card && typeof window.selectScreenChannel === "function") { 
      window.selectScreenChannel(Number(card.dataset.ch)); 
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build, { once: true });
  } else {
    build();
  }
})();
