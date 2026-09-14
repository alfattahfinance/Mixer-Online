/* ============================================================
   Mixer-Online — 14CH Channel Panel
   Clean Top Bar Layout + Safe Channel Meter (Fixed Layout)
   ============================================================ */

(function () {
  "use strict";

  /* ============================================================
     KONFIGURASI
     ============================================================ */

  const N = 14;
  const $ = (id) => document.getElementById(id);

  let standaloneMeterStarted = false;

  /* ============================================================
     CSS
     ============================================================ */

  if (!document.getElementById("mixer-channel-led-skin")) {
    const style = document.createElement("style");

    style.id = "mixer-channel-led-skin";

    style.textContent = `
      header,
      .top-bar,
      .mixer-header,
      div[style*="flex"] {
        box-sizing: border-box !important;
      }

      .top-controls,
      .header-panel,
      .mixer-top-panel,
      header .flex,
      div:has(> #systemBtn),
      div:has(> .system-btn) {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 6px !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      #channels,
      #channelsRight {
        display: grid !important;
        grid-template-columns: repeat(7, 1fr) !important;
        width: 100% !important;
        gap: 1px !important;
        align-items: stretch !important;
        box-sizing: border-box !important;
        padding: 2px !important;
      }

      .new-channel-strip {
        position: relative !important;
        width: 100% !important;
        min-width: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 2px 1px !important;
        border-right: 1px dashed var(--panel-border) !important;
        box-sizing: border-box !important;
      }

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
        line-height: 1.1 !important;
        color: #94a3b8 !important;
        margin-bottom: 1px !important;
        white-space: nowrap !important;
      }

      .new-channel-strip .new-channel-control input.new-knob {
        width: 100% !important;
        max-width: 60px !important;
        height: 12px !important;
        min-height: 12px !important;
        margin: 1px auto !important;
        display: block !important;
        cursor: pointer !important;
        touch-action: pan-x !important;
      }

      .new-channel-strip .new-channel-control .knob-val {
        display: block !important;
        font-size: 6px !important;
        line-height: 1.1 !important;
        font-weight: 600 !important;
        color: #ffffff !important;
        white-space: nowrap !important;
      }

      .new-channel-strip .fader-area {
        position: relative !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 3px !important;
        width: 100% !important;
        flex-grow: 1 !important;
        height: 195px !important;
        min-height: 195px !important;
        padding: 4px 1px 2px 1px !important;
        box-sizing: border-box !important;
      }

      .new-channel-strip input[type="range"] {
        touch-action: none !important;
      }

      .new-channel-strip .fader-area input.channel-fader,
      .new-channel-strip .fader-area input.new-fader {
        appearance: slider-vertical !important;
        -webkit-appearance: slider-vertical !important;
        writing-mode: vertical-lr !important;
        direction: rtl !important;
        width: 16px !important;
        height: 195px !important;
        min-height: 195px !important;
        position: relative !important;
        z-index: 2 !important;
        background: transparent !important;
        accent-color: var(--accent-color) !important;
        margin: 0 !important;
        cursor: ns-resize !important;
      }

      .new-channel-strip .ch-side-vu {
        position: relative !important;
        width: 7px !important;
        height: 195px !important;
        min-height: 195px !important;
        background: #040608 !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        border-radius: 2px !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column-reverse !important;
        z-index: 3 !important;
        flex-shrink: 0 !important;
      }

      .new-channel-strip .ch-side-vu .ch-side-vu-fill {
        width: 100% !important;
        height: 0% !important;
        background: linear-gradient(
          0deg,
          #2ecc71 0%,
          #2ecc71 65%,
          #f1c40f 66%,
          #f39c12 85%,
          #e74c3c 86%,
          #ff0000 100%
        ) !important;
        transition: height 0.04s ease-out !important;
        will-change: height;
      }

      .new-channel-strip .channel-led.active.green {
        opacity: 1 !important;
        background: linear-gradient(
          180deg,
          #8dffb7,
          #20d968 48%,
          #0a7135
        ) !important;
        box-shadow: 0 0 5px rgba(46, 255, 128, 0.6) !important;
      }

      .new-channel-strip .channel-led.active.red {
        opacity: 1 !important;
        background: linear-gradient(
          180deg,
          #ff918b,
          #ff3b30 48%,
          #8d120d
        ) !important;
        box-shadow: 0 0 5px rgba(255, 59, 48, 0.6) !important;
      }

      .new-channel-strip .fader-area label {
        position: absolute !important;
        top: 1px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        font-size: 5px !important;
        color: #94a3b8 !important;
        pointer-events: none !important;
      }

      .new-channel-strip .fader-area output.fader-val {
        position: absolute !important;
        bottom: 1px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        font-size: 6px !important;
        font-weight: bold !important;
        color: #2ecc71 !important;
        pointer-events: none !important;
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
        touch-action: manipulation !important;
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

      @media screen and (max-width: 768px),
             screen and (orientation: portrait) {

        html,
        body {
          width: 100% !important;
          overflow-x: hidden !important;
        }

        header.topbar,
        main.console,
        .bottom-nav {
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

        .channel-bank,
        aside.master-rack,
        .center-console {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 100% !important;
        }

        #channels,
        #channelsRight {
          display: grid !important;
          grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
          gap: 1px !important;
          width: 100% !important;
          overflow-x: hidden !important;
        }

        .new-channel-strip,
        .channel-strip {
          flex: 1 1 0 !important;
          min-width: 0 !important;
          padding: 1px 0 !important;
        }

        .new-channel-strip .fader-area input.channel-fader,
        .new-channel-strip .fader-area input.new-fader,
        .new-channel-strip .ch-side-vu,
        .new-channel-strip .fader-area {
          height: 140px !important;
          min-height: 140px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* ============================================================
     STATE
     ============================================================ */

  function ensureState() {
    if (!window.state) {
      window.state = {};
    }

    if (!Array.isArray(window.state.channels)) {
      window.state.channels = [];
    }

    for (let i = 0; i < N; i++) {
      if (!window.state.channels[i]) {
        window.state.channels[i] = {
          gain: 1,
          high: 0,
          mid: 0,
          low: 0,
          pan: 0,
          fader: 75,
          mute: false,
          solo: false,
          level: 0
        };
      } else {
        const ch = window.state.channels[i];

        if (ch.gain == null) ch.gain = 1;
        if (ch.high == null) ch.high = 0;
        if (ch.mid == null) ch.mid = 0;
        if (ch.low == null) ch.low = 0;
        if (ch.pan == null) ch.pan = 0;
        if (ch.fader == null) ch.fader = 75;
        if (ch.mute == null) ch.mute = false;
        if (ch.solo == null) ch.solo = false;
        if (ch.level == null) ch.level = 0;
      }
    }
  }

  /* ============================================================
     FORMAT NILAI
     ============================================================ */

  function formatVal(key, value) {
    const num = Number(value);

    if (!Number.isFinite(num)) {
      return "0";
    }

    if (key === "gain") {
      return num.toFixed(2);
    }

    if (key === "pan") {
      if (num === 0) return "MID";

      return num < 0
        ? "L" + Math.round(Math.abs(num) * 100)
        : "R" + Math.round(num * 100);
    }

    if (["high", "mid", "low"].includes(key)) {
      return (num > 0 ? "+" : "") + num + "dB";
    }

    return num;
  }

  /* ============================================================
     VISUAL CHANNEL (LED & METER)
     ============================================================ */

  function updateChannelVisuals(strip, channelData) {
    if (!strip || !channelData) return;

    const led = strip.querySelector(".channel-led");
    const vuFill = strip.querySelector(".ch-side-vu-fill");

    const systemOn = Boolean(window.state?.system);
    const muted = Boolean(channelData.mute);
    const level = Number(channelData.level || 0);

    if (led) {
      if (!systemOn) {
        led.className = "channel-led";
      } else if (muted) {
        led.className = "channel-led active red";
      } else if (level > 0) {
        led.className = "channel-led active green";
      } else {
        led.className = "channel-led";
      }
    }

    if (vuFill) {
      if (!systemOn || muted || level <= 0) {
        vuFill.style.height = "0%";
      } else {
        const percent = Math.min(100, Math.max(0, Math.round(level * 100))) + "%";
        vuFill.style.height = percent;
      }
    }
  }

  /* ============================================================
     MEMBUAT CHANNEL
     ============================================================ */

  function make(id) {
    ensureState();

    const channelData = window.state.channels[id - 1];

    const el = document.createElement("article");

    el.className = "new-channel-strip";
    el.dataset.ch = String(id);

    const muted = Boolean(channelData.mute);
    const solo = Boolean(channelData.solo);

    el.innerHTML = `
      <header class="new-channel-head">CH${id}</header>

      <div
        class="channel-led${muted ? " active red" : ""}"
        title="Channel Indicator"
      ></div>

      <div class="new-channel-control">
        <label>GAIN</label>
        <input
          class="new-knob"
          data-k="gain"
          type="range"
          min="0"
          max="2"
          step="0.01"
          value="${Number(channelData.gain ?? 1)}"
        >
        <span class="knob-val" data-val="gain">
          ${formatVal("gain", channelData.gain ?? 1)}
        </span>
      </div>

      <div class="new-channel-control">
        <label>HIGH</label>
        <input
          class="new-knob"
          data-k="high"
          type="range"
          min="-12"
          max="12"
          step="1"
          value="${Number(channelData.high ?? 0)}"
        >
        <span class="knob-val" data-val="high">
          ${formatVal("high", channelData.high ?? 0)}
        </span>
      </div>

      <div class="new-channel-control">
        <label>MID</label>
        <input
          class="new-knob"
          data-k="mid"
          type="range"
          min="-12"
          max="12"
          step="1"
          value="${Number(channelData.mid ?? 0)}"
        >
        <span class="knob-val" data-val="mid">
          ${formatVal("mid", channelData.mid ?? 0)}
        </span>
      </div>

      <div class="new-channel-control">
        <label>LOW</label>
        <input
          class="new-knob"
          data-k="low"
          type="range"
          min="-12"
          max="12"
          step="1"
          value="${Number(channelData.low ?? 0)}"
        >
        <span class="knob-val" data-val="low">
          ${formatVal("low", channelData.low ?? 0)}
        </span>
      </div>

      <div class="new-channel-control">
        <label>PAN</label>
        <input
          class="new-knob"
          data-k="pan"
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value="${Number(channelData.pan ?? 0)}"
        >
        <span class="knob-val" data-val="pan">
          ${formatVal("pan", channelData.pan ?? 0)}
        </span>
      </div>

      <div class="fader-area new-channel-fader">
        <label>VOL</label>

        <input
          class="new-fader channel-fader"
          data-k="fader"
          type="range"
          min="0"
          max="100"
          step="1"
          value="${Number(channelData.fader ?? 75)}"
          aria-label="Volume CH${id}"
        >

        <div class="ch-side-vu">
          <div class="ch-side-vu-fill"></div>
        </div>

        <output class="fader-val">
          ${Math.round(Number(channelData.fader ?? 75))}%
        </output>
      </div>

      <div class="new-channel-buttons">
        <button
          type="button"
          data-k="mute"
          class="${muted ? "on" : ""}"
        >
          ${muted ? "UNMUTE" : "MUTE"}
        </button>

        <button
          type="button"
          data-k="solo"
          class="${solo ? "on" : ""}"
        >
          ${solo ? "UNSOLO" : "SOLO"}
        </button>
      </div>

      <footer class="new-channel-source">
        CH${id} •
        <span>
          ${muted ? "MUTED" : solo ? "SOLO" : "READY"}
        </span>
      </footer>
    `;

    let ticking = false;

    function updateSmooth(key, value) {
      const ch = window.state?.channels?.[id - 1];

      if (!ch) return;

      if (key === "mute" || key === "solo") {
        ch[key] = Boolean(value);
      } else {
        if (!window.state?.system) {
          const result = $("testResult");

          if (result) {
            result.textContent = "CONTROL BLOCKED: SYSTEM OFF";
          }

          return;
        }

        const numberValue = Number(value);

        ch[key] = Number.isFinite(numberValue)
          ? numberValue
          : value;

        if (!ticking) {
          window.requestAnimationFrame(() => {
            if (key === "fader") {
              const output = el.querySelector(".fader-val");

              if (output) {
                output.textContent =
                  Math.round(numberValue) + "%";
              }
            } else {
              const valueLabel = el.querySelector(
                `.knob-val[data-val="${key}"]`
              );

              if (valueLabel) {
                valueLabel.textContent =
                  formatVal(key, numberValue);
              }
            }

            ticking = false;
          });

          ticking = true;
        }
      }

      if (typeof window.selectScreenChannel === "function") {
        window.selectScreenChannel(id);
      }

      updateChannelVisuals(el, ch);

      const sourceLabel = el.querySelector(
        ".new-channel-source span"
      );

      if (sourceLabel) {
        sourceLabel.textContent =
          ch.mute ? "MUTED" : ch.solo ? "SOLO" : "READY";
      }

      try {
        if (
          typeof window.MixerControl?.setControl === "function"
        ) {
          window.MixerControl.setControl(id, key, ch[key]);
        }
      } catch (error) {
        console.warn(
          "MixerControl sync warning:",
          error
        );
      }
    }

    el.querySelectorAll("input").forEach((input) => {
      input.addEventListener(
        "input",
        (event) => {
          updateSmooth(
            event.target.dataset.k,
            event.target.value
          );
        },
        { passive: true }
      );
    });

    el.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();

        if (!window.state?.system) {
          const result = $("testResult");

          if (result) {
            result.textContent = "CONTROL BLOCKED: SYSTEM OFF";
          }

          return;
        }

        const key = button.dataset.k;
        const ch = window.state.channels[id - 1];

        if (!ch) return;

        const nextValue = !Boolean(ch[key]);

        ch[key] = nextValue;

        button.classList.toggle("on", nextValue);

        button.textContent = nextValue
          ? key === "mute"
            ? "UNMUTE"
            : "UNSOLO"
          : key === "mute"
            ? "MUTE"
            : "SOLO";

        updateSmooth(key, nextValue);
      });
    });

    updateChannelVisuals(el, channelData);
    return el;
  }

  /* ============================================================
     SINKRONISASI
     ============================================================ */

  function sync() {
    ensureState();

    for (let id = 1; id <= N; id++) {
      const channelData = window.state.channels[id - 1];

      const el = document.querySelector(
        `.new-channel-strip[data-ch="${id}"]`
      );

      if (!channelData || !el) continue;

      el.querySelectorAll("input[data-k]").forEach((input) => {
        const key = input.dataset.k;

        if (!(key in channelData)) return;

        input.value = String(channelData[key]);

        if (key === "fader") {
          const output = el.querySelector(".fader-val");

          if (output) {
            output.textContent =
              Math.round(Number(channelData.fader ?? 75)) + "%";
          }
        } else {
          const valueLabel = el.querySelector(
            `.knob-val[data-val="${key}"]`
          );

          if (valueLabel) {
            valueLabel.textContent =
              formatVal(key, channelData[key]);
          }
        }
      });

      const muteButton = el.querySelector(
        'button[data-k="mute"]'
      );

      const soloButton = el.querySelector(
        'button[data-k="solo"]'
      );

      if (muteButton) {
        const muted = Boolean(channelData.mute);

        muteButton.classList.toggle("on", muted);
        muteButton.textContent = muted ? "UNMUTE" : "MUTE";
      }

      if (soloButton) {
        const solo = Boolean(channelData.solo);

        soloButton.classList.toggle("on", solo);
        soloButton.textContent = solo ? "UNSOLO" : "SOLO";
      }

      updateChannelVisuals(el, channelData);

      const sourceLabel = el.querySelector(
        ".new-channel-source span"
      );

      if (sourceLabel) {
        sourceLabel.textContent =
          channelData.mute
            ? "MUTED"
            : channelData.solo
              ? "SOLO"
              : "READY";
      }
    }
  }

  /* ============================================================
     BUILD PANEL (Diperbaiki ke Grid 7 Kolom)
     ============================================================ */

  function build() {
    ensureState();

    const left = $("channels");
    const right = $("channelsRight");

    if (left) {
      left.innerHTML = "";
    }

    if (right) {
      right.innerHTML = "";
    }

    if (left && !right) {
      for (let id = 1; id <= N; id++) {
        left.appendChild(make(id));
      }
      return;
    }

    if (!left && right) {
      for (let id = 1; id <= N; id++) {
        right.appendChild(make(id));
      }
      return;
    }

    if (left && right) {
      for (let id = 1; id <= N; id++) {
        if (id <= 7) {
          left.appendChild(make(id));
        } else {
          right.appendChild(make(id));
        }
      }
      return;
    }

    console.warn(
      "Panel channel tidak ditemukan: #channels dan #channelsRight tidak tersedia."
    );
  }

  /* ============================================================
     STANDALONE METER LOOP
     ============================================================ */

  function startStandaloneMeterLoop() {
    if (standaloneMeterStarted) return;

    standaloneMeterStarted = true;

    function frame() {
      ensureState();

      for (let id = 1; id <= N; id++) {
        const channelData =
          window.state?.channels?.[id - 1];

        if (!channelData) continue;

        const strip = document.querySelector(
          `.new-channel-strip[data-ch="${id}"]`
        );

        if (!strip) continue;

        updateChannelVisuals(strip, channelData);
      }

      window.requestAnimationFrame(frame);
    }

    window.requestAnimationFrame(frame);
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */

  window.buildNew14ChannelPanel = build;
  window.syncNew14ChannelPanel = sync;

  /* ============================================================
     PILIH CHANNEL DENGAN KLIK KARTU
     ============================================================ */

  document.addEventListener(
    "click",
    function (event) {
      if (
        event.target.closest(
          "input, button, .new-channel-buttons, .new-channel-control, .fader-area"
        )
      ) {
        return;
      }

      const card = event.target.closest(
        ".new-channel-strip"
      );

      if (
        card &&
        typeof window.selectScreenChannel === "function"
      ) {
        window.selectScreenChannel(
          Number(card.dataset.ch)
        );
      }
    },
    { passive: true }
  );

  /* ============================================================
     INITIALISASI
     ============================================================ */

  function initialize() {
    ensureState();

    window.requestAnimationFrame(() => {
      build();
      startStandaloneMeterLoop();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
