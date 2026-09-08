/* ============================================================
   Mixer-Online — 14CH channel panel
   Owns channel DOM only. Uses the existing MixerControl adapter
   for commands; it does not replace the mixer engine.
   ============================================================ */
(function () {
  "use strict";

  /* ============================================================
     CHANNEL INDICATOR SKIN & VERTICAL FADER VU
     ============================================================ */
  if (!document.getElementById("mixer-channel-led-skin")) {
    const style = document.createElement("style");
    style.id = "mixer-channel-led-skin";
    style.textContent = `
      /* Lampu status kecil di bagian atas */
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

      .new-channel-strip .channel-led::before,
      .channel-strip .channel-led::before {
        content: "" !important;
        position: absolute !important;
        left: 3px !important;
        right: 3px !important;
        top: 1px !important;
        height: 2px !important;
        border-radius: 999px !important;
        background: rgba(255,255,255,.10) !important;
        pointer-events: none !important;
      }

      .new-channel-strip .channel-led::after,
      .channel-strip .channel-led::after {
        content: "" !important;
        position: absolute !important;
        left: 5px !important;
        top: 2px !important;
        width: 14px !important;
        height: 2px !important;
        border-radius: 999px !important;
        background: #39444d !important;
        pointer-events: none !important;
      }

      .new-channel-strip .channel-led.active.green,
      .channel-strip .channel-led.active.green {
        opacity: 1 !important;
        background: linear-gradient(180deg,#8dffb7,#20d968 48%,#0a7135) !important;
        border-color: rgba(46,255,128,.65) !important;
        box-shadow: 0 0 5px rgba(46,255,128,.55), inset 0 1px 1px rgba(255,255,255,.35) !important;
      }

      .new-channel-strip .channel-led.active.green::after,
      .channel-strip .channel-led.active.green::after {
        background: #caffdd !important;
        box-shadow: 0 0 5px #63ff9a !important;
      }

      .new-channel-strip .channel-led.active.red,
      .channel-strip .channel-led.active.red {
        opacity: 1 !important;
        background: linear-gradient(180deg,#ff918b,#ff3b30 48%,#8d120d) !important;
        border-color: rgba(255,82,73,.75) !important;
        box-shadow: 0 0 6px rgba(255,59,48,.65), inset 0 1px 1px rgba(255,255,255,.35) !important;
      }

      .new-channel-strip .channel-led.active.red::after,
      .channel-strip .channel-led.active.red::after {
        background: #ffe1df !important;
        box-shadow: 0 0 6px #ff6961 !important;
      }

      /* FADER AREA: Mengatur posisi relatif agar VU meter panjang berada tepat di dalam jalur fader */
      .new-channel-strip .fader-area {
        position: relative !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: flex-end !important;
        flex-grow: 1 !important;
        width: 100% !important;
      }

      /* LED BAR / VU PANJANG DI DALAM FADER */
      .new-channel-strip .ch-top-vu {
        position: absolute !important;
        top: 15px !important;
        bottom: 30px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        width: 6px !important;
        height: auto !important;
        background: #090e12 !important;
        border: 1px solid rgba(255,255,255,.16) !important;
        border-radius: 2px !important;
        box-shadow: inset 0 0 4px rgba(0,0,0,.95), 0 0 2px rgba(0,0,0,.6) !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column-reverse !important;
        z-index: 1 !important;
        pointer-events: none !important;
      }

      .new-channel-strip .ch-top-vu::before {
        content: "" !important;
        position: absolute !important;
        inset: 1px !important;
        background: repeating-linear-gradient(
          to bottom,
          rgba(255,255,255,.10) 0,
          rgba(255,255,255,.10) 2px,
          transparent 2px,
          transparent 6px
        ) !important;
        pointer-events: none !important;
        z-index: 2 !important;
      }

      .new-channel-strip .ch-top-vu .ch-top-vu-fill {
        position: absolute !important;
        left: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 0% !important;
        min-height: 0 !important;
        background: linear-gradient(0deg,
          #24e66b 0%,
          #24e66b 65%,
          #ffd21c 66%,
          #ff9f00 85%,
          #ff3b30 86%,
          #ff0000 100%
        ) !important;
        border-radius: 1px !important;
        box-shadow: 0 0 4px rgba(40,255,110,.45) !important;
        transition: height .06s linear !important;
        z-index: 1 !important;
      }

      /* Pastikan elemen fader dan output tampil di atas layer VU meter */
      .new-channel-strip .fader-area input[type="range"],
      .new-channel-strip .fader-area output,
      .new-channel-strip .fader-area label {
        position: relative !important;
        z-index: 2 !important;
      }

      /* Meter segmented lama disembunyikan */
      .new-channel-strip .new-channel-meter {
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
          gain: 1, high: 0, mid: 0, low: 0, pan: 0, fader: 75, mute: false, solo: false
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
      <div class="led-meter new-channel-meter" data-ch="${id}" role="meter" aria-label="CH${id} level"><span class="led-peak"></span><span class="led-segments">${"<i data-seg=\"0\"></i>".repeat(12)}</span></div>
      
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
        <!-- Indikator VU panjang vertikal di dalam jalur fader -->
        <div class="ch-top-vu"><div class="ch-top-vu-fill"></div></div>
        <label>VOLUME</label>
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
