/* ============================================================
   Mixer-Online — 14CH channel panel
   Owns channel DOM only. Uses the existing MixerControl adapter
   for commands; it does not replace the mixer engine.
   ============================================================ */
(function () {
  "use strict";
  const N = 14;
  const $ = id => document.getElementById(id);

  // Safely ensure window.state and window.state.channels are initialized
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

  function make(id) {
    ensureState();
    const c = window.state.channels[id - 1];
    const el = document.createElement("article");
    el.className = "new-channel-strip";
    el.dataset.ch = String(id);
    el.innerHTML = `
      <header class="new-channel-head">CH${id}</header>
      <div class="led-meter new-channel-meter" data-ch="${id}" role="meter" aria-label="CH${id} level"><span class="led-peak"></span><span class="led-segments">${"<i data-seg=\"0\"></i>".repeat(12)}</span></div>
      <div class="new-channel-control"><label>GAIN</label><input class="new-knob" data-k="gain" type="range" min="0" max="2" step=".01" value="${Number(c.gain ?? 1)}"></div>
      <div class="new-channel-control"><label>HIGH</label><input class="new-knob" data-k="high" type="range" min="-12" max="12" step="1" value="${Number(c.high ?? 0)}"></div>
      <div class="new-channel-control"><label>MID</label><input class="new-knob" data-k="mid" type="range" min="-12" max="12" step="1" value="${Number(c.mid ?? 0)}"></div>
      <div class="new-channel-control"><label>LOW</label><input class="new-knob" data-k="low" type="range" min="-12" max="12" step="1" value="${Number(c.low ?? 0)}"></div>
      <div class="new-channel-control"><label>PAN</label><input class="new-knob" data-k="pan" type="range" min="-1" max="1" step=".01" value="${Number(c.pan ?? 0)}"></div>
      <div class="new-channel-fader"><label>VOLUME</label><input class="new-fader" data-k="fader" type="range" min="0" max="100" step="1" value="${Number(c.fader ?? 75)}"><output>${Number(c.fader ?? 75)}%</output></div>
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
        }
      }

      // GAIN dan VOLUME adalah kontrol terpisah.
      // Menggerakkan VOLUME tidak boleh mengubah GAIN.
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
        if (x.dataset.k in c) x.value = String(c[x.dataset.k]); 
      });

      const o = el.querySelector("output"); 
      if (o) o.textContent = Math.round(Number(c.fader ?? 75)) + "%";

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
    // 7 Channels di kiri (1-7), 7 Channels di kanan (8-14)
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
