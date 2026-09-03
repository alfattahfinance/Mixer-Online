/* Dedicated 14CH channel renderer. UI/layout only; mixer engine untouched. */
(function(){
"use strict";
const N = 14;

function state() {
  return window.state || (window.state = { system: true, connected: false, channels: [] });
}

function ensureChannels() {
  const st = state();
  while(st.channels.length < N) {
    st.channels.push({
      id: st.channels.length + 1,
      fader: 75, gain: 1, low: 0, mid: 0, high: 0, pan: 0,
      mute: false, solo: false, level: 0
    });
  }
  st.channels.length = N;
}

function make(id) {
  const c = state().channels[id - 1];
  const el = document.createElement("article");
  el.className = "new-channel-strip";
  el.dataset.ch = String(id);

  el.innerHTML = 
    '<header class="new-channel-head">CH' + id + '</header>' +
    '<div class="led-meter new-channel-meter" data-ch="' + id + '">' +
      '<span class="led-peak"></span>' +
      '<span class="led-segments">' + Array.from({length: 12}, () => '<i></i>').join("") + '</span>' +
    '</div>' +
    '<div class="new-channel-control"><label>GAIN</label><input class="new-knob" data-k="gain" data-param="gain" type="range" min="0" max="2" step=".01" value="' + c.gain + '"></div>' +
    '<div class="new-channel-control"><label>HIGH</label><input class="new-knob" data-k="high" data-param="high" type="range" min="-12" max="12" step="1" value="' + c.high + '"></div>' +
    '<div class="new-channel-control"><label>MID</label><input class="new-knob" data-k="mid" data-param="mid" type="range" min="-12" max="12" step="1" value="' + c.mid + '"></div>' +
    '<div class="new-channel-control"><label>LOW</label><input class="new-knob" data-k="low" data-param="low" type="range" min="-12" max="12" step="1" value="' + c.low + '"></div>' +
    '<div class="new-channel-control"><label>PAN</label><input class="new-knob" data-k="pan" data-param="pan" type="range" min="-1" max="1" step=".01" value="' + c.pan + '"></div>' +
    '<div class="new-channel-fader"><label>VOLUME</label><input class="new-fader" data-k="fader" data-param="fader" type="range" min="0" max="100" step="1" value="' + c.fader + '"><output class="fader-val">' + c.fader + '%</output></div>' +
    '<div class="new-channel-buttons">' +
      '<button type="button" class="btn-mute ' + (c.mute ? 'active on' : '') + '" data-k="mute" data-action="mute">MUTE</button>' +
      '<button type="button" class="btn-solo ' + (c.solo ? 'active on' : '') + '" data-k="solo" data-action="solo">SOLO</button>' +
    '</div>' +
    '<footer class="new-channel-source">CH' + id + ' • <span>' + (c.mute ? 'MUTED' : c.solo ? 'SOLO' : 'READY') + '</span></footer>';

  // Handler Event Slider / Knob Input
  el.querySelectorAll("input[data-k]").forEach(x => {
    x.addEventListener("input", () => {
      const k = x.dataset.k;
      const v = Number(x.value);
      state().channels[id - 1][k] = v;

      if (k === "fader") {
        const out = el.querySelector("output");
        if (out) out.textContent = v + "%";
      }

      // Kirim langsung ke MixerControl tanpa terhalang state.system
      if (window.MixerControl && typeof window.MixerControl.setControl === "function") {
        window.MixerControl.setControl(id, k, v);
      }
    });
  });

  // Handler Event Button Mute / Solo
  el.querySelectorAll("button[data-k]").forEach(b => {
    b.addEventListener("click", () => {
      const k = b.dataset.k;
      const v = !state().channels[id - 1][k];
      state().channels[id - 1][k] = v;

      // Toggle class 'active' dan 'on' untuk fleksibilitas styling CSS
      b.classList.toggle("active", v);
      b.classList.toggle("on", v);

      if (window.MixerControl && typeof window.MixerControl.setControl === "function") {
        window.MixerControl.setControl(id, k, v);
      }

      const statusSpan = el.querySelector("footer span");
      if (statusSpan) {
        statusSpan.textContent = state().channels[id - 1].mute ? "MUTED" : state().channels[id - 1].solo ? "SOLO" : "READY";
      }
    });
  });

  return el;
}

function build() {
  ensureChannels();
  const l = document.getElementById("channels");
  const r = document.getElementById("channelsRight");
  if (!l || !r) return false;

  l.replaceChildren();
  r.replaceChildren();

  for (let i = 1; i <= N; i++) {
    (i <= 7 ? l : r).appendChild(make(i));
  }
  return true;
}

window.buildNew14ChannelPanel = build;

window.syncNew14ChannelPanel = function() {
  ensureChannels();
  document.querySelectorAll(".new-channel-strip").forEach(el => {
    const id = +el.dataset.ch;
    const c = state().channels[id - 1];
    if (!c) return;

    const f = el.querySelector('[data-k="fader"]');
    const o = el.querySelector("output");
    if (f) f.value = c.fader;
    if (o) o.textContent = c.fader + "%";

    ["gain", "high", "mid", "low", "pan"].forEach(k => {
      const x = el.querySelector('[data-k="' + k + '"]');
      if (x) x.value = c[k];
    });

    ["mute", "solo"].forEach(k => {
      const b = el.querySelector('[data-k="' + k + '"]');
      if (b) {
        b.classList.toggle("active", !!c[k]);
        b.classList.toggle("on", !!c[k]);
      }
    });

    const statusSpan = el.querySelector("footer span");
    if (statusSpan) {
      statusSpan.textContent = c.mute ? "MUTED" : c.solo ? "SOLO" : "READY";
    }
  });
};

function boot() {
  build();
  window.syncNew14ChannelPanel();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
})();
