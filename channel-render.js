/* Dedicated 14CH channel renderer. UI/layout & DOM synchronization. */
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
      fader: 75, gain: 1.0, low: 0, mid: 0, high: 0, pan: 0,
      mute: false, solo: false, level: 0
    });
  }
  st.channels.length = N;
}

function triggerHaptic(ms) {
  if (window.AndroidFeedback && typeof window.AndroidFeedback.triggerHaptic === "function") {
    window.AndroidFeedback.triggerHaptic(ms);
  } else if (navigator.vibrate) {
    navigator.vibrate(ms);
  }
}

function make(id) {
  const c = state().channels[id - 1];
  const el = document.createElement("article");
  el.className = "new-channel-strip";
  el.dataset.ch = String(id);

  el.innerHTML = 
    '<header class="new-channel-head">CH' + id + '</header>' +
    '<div class="channel-led ' + (c.mute ? 'red' : 'green on') + '"></div>' +
    '<div class="ch-controls-group">' +
      '<div class="new-channel-control"><label>GAIN</label><input class="new-knob gain-knob" data-k="gain" data-param="gain" type="range" min="0" max="2" step=".01" value="' + c.gain + '"><output class="gain-val">' + Number(c.gain).toFixed(2) + '</output></div>' +
      '<div class="new-channel-control"><label>HIGH</label><input class="new-knob high-knob" data-k="high" data-param="high" type="range" min="-12" max="12" step="1" value="' + c.high + '"><output class="high-val">' + c.high + '</output></div>' +
      '<div class="new-channel-control"><label>MID</label><input class="new-knob mid-knob" data-k="mid" data-param="mid" type="range" min="-12" max="12" step="1" value="' + c.mid + '"><output class="mid-val">' + c.mid + '</output></div>' +
      '<div class="new-channel-control"><label>LOW</label><input class="new-knob low-knob" data-k="low" data-param="low" type="range" min="-12" max="12" step="1" value="' + c.low + '"><output class="low-val">' + c.low + '</output></div>' +
      '<div class="new-channel-control"><label>PAN</label><input class="new-knob pan-knob" data-k="pan" data-param="pan" type="range" min="-1" max="1" step=".01" value="' + c.pan + '"><output class="pan-val">' + (c.pan == 0 ? 'CENTER' : (c.pan < 0 ? 'L ' + Math.abs(Math.round(c.pan * 100)) + '%' : 'R ' + Math.round(c.pan * 100) + '%')) + '</output></div>' +
    '</div>' +
    '<div class="volume-label-text">VOLUME</div>' +
    '<div class="fader-area">' +
      '<div class="ch-long-vu" aria-hidden="true"><div class="ch-long-vu-fill"></div></div>' +
      '<input class="new-fader channel-fader" data-k="fader" data-param="fader" type="range" min="0" max="100" step="1" value="' + c.fader + '">' +
      '<output class="fader-val">' + Math.round(c.fader) + '%</output>' +
    '</div>' +
    '<div class="new-channel-buttons">' +
      '<button type="button" class="btn-mute ' + (c.mute ? 'active on' : '') + '" data-k="mute" data-action="mute">' + (c.mute ? 'UNMUTE' : 'MUTE') + '</button>' +
      '<button type="button" class="btn-solo ' + (c.solo ? 'active on' : '') + '" data-k="solo" data-action="solo">' + (c.solo ? 'UNSOLO' : 'SOLO') + '</button>' +
    '</div>' +
    '<footer class="new-channel-source">CH' + id + ' • <span>' + (c.mute ? 'MUTED' : c.solo ? 'SOLO' : 'READY') + '</span></footer>';

  // Force the meter into the fader area so it is visible beside the fader.
  const meter = el.querySelector('.ch-long-vu');
  if (meter) {
    meter.style.setProperty('position', 'absolute', 'important');
    meter.style.setProperty('top', '0px', 'important');
    meter.style.setProperty('bottom', 'auto', 'important');
    meter.style.setProperty('right', '7px', 'important');
    meter.style.setProperty('left', 'auto', 'important');
    meter.style.setProperty('width', '7px', 'important');
    meter.style.setProperty('height', '230px', 'important');
    meter.style.setProperty('z-index', '10', 'important');
    meter.style.setProperty('display', 'flex', 'important');
    meter.style.setProperty('background', '#050708', 'important');
    meter.style.setProperty('border', '1px solid #30383e', 'important');
    meter.style.setProperty('border-radius', '3px', 'important');
    meter.style.setProperty('overflow', 'hidden', 'important');
  }
  const meterFill = el.querySelector('.ch-long-vu-fill');
  if (meterFill) {
    meterFill.style.setProperty('width', '100%', 'important');
    meterFill.style.setProperty('height', '0%', 'important');
    meterFill.style.setProperty('background', 'linear-gradient(to top, #31e66b 0%, #31e66b 65%, #ffd21c 82%, #ff3b30 100%)', 'important');
    meterFill.style.setProperty('transition', 'height .05s linear', 'important');
  }

  el.addEventListener("click", (e) => {
    if (!e.target.matches('input, button')) {
      if (typeof window.selectScreenChannel === "function") window.selectScreenChannel(id);
    }
  });

  el.querySelectorAll("input[data-k]").forEach(x => {
    x.addEventListener("input", () => {
      triggerHaptic(10);
      const k = x.dataset.k;
      const v = Number(x.value);
      state().channels[id - 1][k] = v;
      const parentControl = x.parentElement;
      if (parentControl) {
        const out = parentControl.querySelector("output");
        if (out) {
          if (k === "fader") out.textContent = Math.round(v) + "%";
          else if (k === "gain") out.textContent = Number(v).toFixed(2);
          else if (k === "pan") out.textContent = v === 0 ? 'CENTER' : (v < 0 ? 'L ' + Math.abs(Math.round(v * 100)) + '%' : 'R ' + Math.round(v * 100) + '%');
          else if (["low", "mid", "high"].includes(k)) out.textContent = Math.round(v);
        }
      }
      if (typeof window.selectScreenChannel === "function") window.selectScreenChannel(id);
      if (window.MixerControl && typeof window.MixerControl.setControl === "function") window.MixerControl.setControl(id, k, v);
    });
  });

  el.querySelectorAll("button[data-k]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerHaptic(20);
      const k = b.dataset.k;
      const v = !state().channels[id - 1][k];
      state().channels[id - 1][k] = v;
      b.classList.toggle("active", v);
      b.classList.toggle("on", v);
      b.textContent = k === "mute" ? (v ? "UNMUTE" : "MUTE") : (v ? "UNSOLO" : "SOLO");
      const led = el.querySelector(".channel-led");
      if (led) led.className = state().channels[id - 1].mute ? "channel-led red active" : "channel-led green on";
      if (window.MixerControl && typeof window.MixerControl.setControl === "function") window.MixerControl.setControl(id, k, v);
      const statusSpan = el.querySelector("footer span");
      if (statusSpan) statusSpan.textContent = state().channels[id - 1].mute ? "MUTED" : state().channels[id - 1].solo ? "SOLO" : "READY";
      if (typeof window.selectScreenChannel === "function") window.selectScreenChannel(id);
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
  for (let i = 1; i <= N; i++) (i <= 7 ? l : r).appendChild(make(i));
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
    const oF = el.querySelector('.fader-val, .fader-area output');
    if (f) f.value = c.fader;
    if (oF) oF.textContent = Math.round(c.fader) + "%";
    const meter = el.querySelector('.ch-long-vu-fill');
    if (meter) meter.style.height = Math.max(0, Math.min(100, Number(c.level) || 0)) + "%";
    ["gain", "high", "mid", "low", "pan"].forEach(k => {
      const x = el.querySelector('[data-k="' + k + '"]');
      if (x) x.value = c[k];
      const parent = x?.parentElement;
      if (parent) {
        const out = parent.querySelector("output");
        if (out) {
          if (k === "gain") out.textContent = Number(c[k]).toFixed(2);
          else if (k === "pan") out.textContent = c[k] === 0 ? 'CENTER' : (c[k] < 0 ? 'L ' + Math.abs(Math.round(c[k] * 100)) + '%' : 'R ' + Math.round(c[k] * 100) + '%');
          else out.textContent = Math.round(c[k]);
        }
      }
    });
    ["mute", "solo"].forEach(k => {
      const b = el.querySelector('[data-k="' + k + '"]');
      if (b) {
        const val = !!c[k];
        b.classList.toggle("active", val);
        b.classList.toggle("on", val);
        b.textContent = k === "mute" ? (val ? "UNMUTE" : "MUTE") : (val ? "UNSOLO" : "SOLO");
      }
    });
    const led = el.querySelector(".channel-led");
    if (led) led.className = c.mute ? "channel-led red active" : "channel-led green on";
    const statusSpan = el.querySelector("footer span");
    if (statusSpan) statusSpan.textContent = c.mute ? "MUTED" : c.solo ? "SOLO" : "READY";
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