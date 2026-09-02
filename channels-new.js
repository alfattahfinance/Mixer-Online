/* ============================================================
   Mixer-Online — 16CH channel panel
   Owns channel DOM only. Uses the existing MixerControl adapter
   for commands; it does not replace the mixer engine.
   ============================================================ */
(function () {
  "use strict";
  const N = 16;
  const $ = id => document.getElementById(id);

  function make(id) {
    const c = window.state?.channels?.[id - 1] || {};
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
      <footer class="new-channel-source">CH${id} • <span>READY</span></footer>
    `;

    const update = (k, value) => {
      if (!window.state?.system) {
        const r = $("testResult"); if (r) r.textContent = "CONTROL BLOCKED: SYSTEM OFF";
        return;
      }
      const n = Number(value);
      const ch = window.state.channels[id - 1];
      if (!ch) return;
      ch[k] = Number.isFinite(n) && k !== "mute" && k !== "solo" ? n : value;
      if (k === "fader") el.querySelector("output").textContent = n + "%";
      const result = window.MixerControl?.setControl?.(id, k, value);
      const r = $("testResult");
      if (r) r.textContent = result?.ok ? "CH" + id + " " + k.toUpperCase() + " → SENT" : "CH" + id + " " + k.toUpperCase() + " → " + (result?.reason || "OFFLINE");
      el.querySelector("footer span").textContent = ch.mute ? "MUTED" : ch.solo ? "SOLO" : "READY";
    };

    el.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", () => update(input.dataset.k, input.value));
    });
    el.querySelectorAll("button").forEach(button => {
      button.addEventListener("click", () => {
        if (!window.state?.system) {
          const r = $("testResult"); if (r) r.textContent = "CONTROL BLOCKED: SYSTEM OFF";
          return;
        }
        const k = button.dataset.k;
        const value = !window.state.channels[id - 1][k];
        button.classList.toggle("on", value);
        button.textContent = value ? (k === "mute" ? "UNMUTE" : "UNSOLO") : (k === "mute" ? "MUTE" : "SOLO");
        update(k, value);
      });
    });
    return el;
  }

  function sync() {
    for (let id = 1; id <= N; id++) {
      const c = window.state?.channels?.[id - 1];
      const el = document.querySelector('.new-channel-strip[data-ch="'+id+'"]');
      if (!c || !el) continue;
      el.querySelectorAll("input[data-k]").forEach(x => { if (x.dataset.k in c) x.value = String(c[x.dataset.k]); });
      const o = el.querySelector("output"); if (o) o.textContent = Number(c.fader ?? 75) + "%";
      el.querySelectorAll("button[data-k]").forEach(b => { const on=!!c[b.dataset.k]; b.classList.toggle("on",on); b.textContent=on?(b.dataset.k==="mute"?"UNMUTE":"UNSOLO"):(b.dataset.k==="mute"?"MUTE":"SOLO"); });
      const status=el.querySelector("footer span"); if(status) status.textContent=c.mute?"MUTED":c.solo?"SOLO":"READY";
    }
  }

  function build() {
    const left = $("channels"), right = $("channelsRight");
    if (!left || !right) return;
    left.innerHTML = ""; right.innerHTML = "";
    for (let i = 1; i <= N; i++) (i <= 8 ? left : right).appendChild(make(i));
  }

  window.buildNew16ChannelPanel = build;
  window.syncNew16ChannelPanel = sync;
  document.addEventListener("click", function(e){ const card=e.target.closest(".new-channel-strip"); if(card && typeof window.selectScreenChannel==="function"){ window.selectScreenChannel(Number(card.dataset.ch)); } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build, { once: true });
  else build();
})();
