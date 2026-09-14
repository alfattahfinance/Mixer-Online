/* ==========================================================================
   WEB AUDIO ENGINE & MUSIC PLAYER ROUTING
   14 CHANNEL - NO AUTO MUSIC
   SAFE CHANNEL METER ENGINE
   ========================================================================== */

(function () {
  "use strict";

  let audioCtx = null;

  const CHANNEL_COUNT = 14;

  const channelNodes = {};
  const channelAudioElements = {};

  let masterNode = null;
  let meterAnimationStarted = false;

  /* ------------------------------------------------------------------------
     AUDIO CONTEXT
     ------------------------------------------------------------------------ */

  function initAudioEngine() {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        console.error(
          "[AUDIO ENGINE] Web Audio API tidak tersedia."
        );

        return false;
      }

      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    return true;
  }

  /* ------------------------------------------------------------------------
     MASTER
     ------------------------------------------------------------------------ */

  function ensureMaster() {
    if (!initAudioEngine()) {
      return null;
    }

    if (!masterNode) {
      masterNode = audioCtx.createGain();
      masterNode.gain.value = 0.75;

      const masterAnalyser = audioCtx.createAnalyser();

      masterAnalyser.fftSize = 64;
      masterAnalyser.smoothingTimeConstant = 0.75;

      masterNode.connect(masterAnalyser);
      masterAnalyser.connect(audioCtx.destination);

      masterNode._analyser = masterAnalyser;
    }

    return masterNode;
  }

  /* ------------------------------------------------------------------------
     CHANNEL AUDIO NODE
     ------------------------------------------------------------------------ */

  window.initChannelAudioNode = function (
    chNum,
    mediaStreamOrElement
  ) {
    const ch = Number(chNum);

    if (
      !Number.isInteger(ch) ||
      ch < 1 ||
      ch > CHANNEL_COUNT
    ) {
      console.warn(
        "[AUDIO ENGINE] Channel tidak valid:",
        chNum
      );

      return false;
    }

    if (!initAudioEngine()) {
      return false;
    }

    try {
      let sourceNode;
      let hasValidMedia = false;

      if (
        typeof MediaStream !== "undefined" &&
        mediaStreamOrElement instanceof MediaStream
      ) {
        sourceNode =
          audioCtx.createMediaStreamSource(
            mediaStreamOrElement
          );

        hasValidMedia = true;
      } else if (
        typeof HTMLMediaElement !== "undefined" &&
        mediaStreamOrElement instanceof HTMLMediaElement
      ) {
        sourceNode =
          audioCtx.createMediaElementSource(
            mediaStreamOrElement
          );

        hasValidMedia = true;
      } else {
        /*
         * Node kosong untuk channel yang belum memiliki input.
         * Gain 0 mencegah suara kosong masuk ke output.
         */
        sourceNode = audioCtx.createGain();
        sourceNode.gain.value = 0;
      }

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 1;

      const lowBq = audioCtx.createBiquadFilter();
      lowBq.type = "lowshelf";
      lowBq.frequency.value = 100;
      lowBq.gain.value = 0;

      const midBq = audioCtx.createBiquadFilter();
      midBq.type = "peaking";
      midBq.frequency.value = 1000;
      midBq.Q.value = 1;
      midBq.gain.value = 0;

      const highBq = audioCtx.createBiquadFilter();
      highBq.type = "highshelf";
      highBq.frequency.value = 8000;
      highBq.gain.value = 0;

      const pannerNode = audioCtx.createStereoPanner
        ? audioCtx.createStereoPanner()
        : null;

      const faderNode = audioCtx.createGain();
      faderNode.gain.value = 1;

      sourceNode.connect(gainNode);
      gainNode.connect(lowBq);
      lowBq.connect(midBq);
      midBq.connect(highBq);

      if (pannerNode) {
        highBq.connect(pannerNode);
        pannerNode.connect(faderNode);
      } else {
        highBq.connect(faderNode);
      }

      const analyserNode = audioCtx.createAnalyser();

      analyserNode.fftSize = 64;
      analyserNode.smoothingTimeConstant = 0.75;

      faderNode.connect(analyserNode);

      const master = ensureMaster();

      if (master) {
        faderNode.connect(master);
      }

      channelNodes[ch] = {
        source: sourceNode,
        gain: gainNode,
        low: lowBq,
        mid: midBq,
        high: highBq,
        pan: pannerNode,
        fader: faderNode,
        analyser: analyserNode,
        hasActiveMedia: hasValidMedia
      };

      console.log(
        `[AUDIO ENGINE] Jalur audio CH${ch} aktif.`
      );

      return true;
    } catch (error) {
      console.error(
        `[AUDIO ENGINE] Gagal menginisialisasi CH${ch}:`,
        error
      );

      return false;
    }
  };

  /* ------------------------------------------------------------------------
     LEVEL READER
     ------------------------------------------------------------------------ */

  function readAnalyserLevel(analyser) {
    if (!analyser) {
      return 0;
    }

    if (!analyser._meterBuffer) {
      analyser._meterBuffer = new Uint8Array(
        analyser.fftSize
      );
    }

    const data = analyser._meterBuffer;

    analyser.getByteTimeDomainData(data);

    let sum = 0;
    let peak = 0;

    for (let i = 0; i < data.length; i++) {
      const sample = (data[i] - 128) / 128;
      const absoluteSample = Math.abs(sample);

      sum += sample * sample;

      if (absoluteSample > peak) {
        peak = absoluteSample;
      }
    }

    const rms = Math.sqrt(sum / data.length);

    /*
     * Gabungan RMS dan peak agar gerakan indikator terlihat.
     */
    return Math.max(
      rms * 5,
      peak * 0.8
    );
  }

  /* ------------------------------------------------------------------------
     STATE LEVEL READER
     ------------------------------------------------------------------------ */

  function readStateLevel(channelState) {
    if (
      !channelState ||
      channelState.level === undefined ||
      channelState.level === null
    ) {
      return 0;
    }

    const value = Number(channelState.level);

    if (!Number.isFinite(value)) {
      return 0;
    }

    /*
     * Mendukung:
     * - format 0 sampai 1
     * - format 0 sampai 100
     */
    const normalized = value > 1
      ? value / 100
      : value;

    return Math.max(
      0,
      Math.min(1, normalized)
    );
  }

  /* ------------------------------------------------------------------------
     CHANNEL METERS
     ------------------------------------------------------------------------ */

  let lastMeterUpdate = 0;

  function updateChannelMeters(timestamp) {
    requestAnimationFrame(updateChannelMeters);

    /*
     * Batasi update sekitar 30 FPS agar ringan.
     */
    if (timestamp - lastMeterUpdate < 33) {
      return;
    }

    lastMeterUpdate = timestamp;

    for (let ch = 1; ch <= CHANNEL_COUNT; ch++) {
      const strip = document.querySelector(
        `.new-channel-strip[data-ch="${ch}"], ` +
        `.channel-strip[data-ch="${ch}"]`
      );

      if (!strip) {
        continue;
      }

      const sideVuFill = strip.querySelector(
        ".ch-side-vu-fill"
      );

      if (!sideVuFill) {
        continue;
      }

      const channelState =
        window.state?.channels?.[ch - 1] || {};

      const nodes = channelNodes[ch];

      const muted = Boolean(channelState.mute);

      const faderValue = Number(
        channelState.fader ?? 75
      );

      const faderScale = Math.max(
        0,
        Math.min(1, faderValue / 100)
      );

      /*
       * Prioritas pertama: analyser audio channel.
       */
      let inputLevel = readAnalyserLevel(
        nodes?.analyser
      );

      /*
       * Jika analyser belum menerima audio,
       * gunakan feedback level dari state/hardware.
       */
      if (inputLevel <= 0.001) {
        inputLevel = readStateLevel(
          channelState
        );
      }

      inputLevel = Math.max(
        0,
        Math.min(1, inputLevel)
      );

      /*
       * Mute atau fader 0 mematikan indikator channel
       * yang bersangkutan saja.
       */
      const outputLevel = muted
        ? 0
        : inputLevel * faderScale;

      const finalPercent = Math.round(
        Math.max(
          0,
          Math.min(1, outputLevel)
        ) * 100
      );

      /*
       * Hanya indikator channel ini yang diubah.
       */
      sideVuFill.style.setProperty(
        "height",
        `${finalPercent}%`,
        "important"
      );

      sideVuFill.style.setProperty(
        "opacity",
        finalPercent > 0 ? "1" : "0.25",
        "important"
      );
    }

    /* ----------------------------------------------------------------------
       MASTER L/R METERS
       ---------------------------------------------------------------------- */

    const master = ensureMaster();

    if (
      master &&
      master._analyser
    ) {
      const masterAnalyser = master._analyser;

      const masterLevel = readAnalyserLevel(
        masterAnalyser
      );

      const masterFader =
        document.getElementById("master");

      const masterScale = masterFader
        ? Math.max(
            0,
            Math.min(
              1,
              Number(masterFader.value) / 100
            )
          )
        : 0.75;

      const outputLevel =
        masterLevel * masterScale;

      const outPercent =
        Math.round(
          Math.max(
            0,
            Math.min(1, outputLevel)
          ) * 100
        ) + "%";

      const masterMeterL =
        document.getElementById("masterMeterL");

      const masterMeterR =
        document.getElementById("masterMeterR");

      if (masterMeterL) {
        masterMeterL.style.setProperty(
          "height",
          outPercent,
          "important"
        );
      }

      if (masterMeterR) {
        masterMeterR.style.setProperty(
          "height",
          outPercent,
          "important"
        );
      }
    }
  }

  /* ------------------------------------------------------------------------
     MASTER LIVE
     ------------------------------------------------------------------------ */

  window.updateMasterAudioLive = function (val) {
    const master = ensureMaster();

    if (!master || !audioCtx) {
      return;
    }

    const value = Math.max(
      0,
      Math.min(100, Number(val))
    );

    master.gain.setTargetAtTime(
      value / 100,
      audioCtx.currentTime,
      0.02
    );
  };

  /* ------------------------------------------------------------------------
     EQ VALUE
     ------------------------------------------------------------------------ */

  function parseEqGain(val) {
    const num = parseFloat(val);

    if (!Number.isFinite(num)) {
      return 0;
    }

    /*
     * Nilai 0 sampai 100 dikonversi menjadi -15 sampai +15 dB.
     */
    if (num >= 0 && num <= 100) {
      return ((num - 50) / 50) * 15;
    }

    return Math.max(
      -24,
      Math.min(24, num)
    );
  }

  /* ------------------------------------------------------------------------
     UPDATE CHANNEL AUDIO
     ------------------------------------------------------------------------ */

  window.updateAudioParamLive = function (
    chNum,
    param,
    val
  ) {
    const ch = Number(chNum);

    if (
      !Number.isInteger(ch) ||
      ch < 1 ||
      ch > CHANNEL_COUNT ||
      !channelNodes[ch] ||
      !audioCtx
    ) {
      return;
    }

    const nodes = channelNodes[ch];

    try {
      if (param === "fader") {
        nodes.fader.gain.setTargetAtTime(
          Math.max(
            0,
            Math.min(1, Number(val) / 100)
          ),
          audioCtx.currentTime,
          0.02
        );
      } else if (param === "gain") {
        nodes.gain.gain.setTargetAtTime(
          Math.max(
            0.1,
            Number(val)
          ),
          audioCtx.currentTime,
          0.02
        );
      } else if (
        param === "pan" &&
        nodes.pan
      ) {
        nodes.pan.pan.setTargetAtTime(
          Math.max(
            -1,
            Math.min(1, Number(val))
          ),
          audioCtx.currentTime,
          0.02
        );
      } else if (
        param === "low" &&
        nodes.low
      ) {
        nodes.low.gain.setTargetAtTime(
          parseEqGain(val),
          audioCtx.currentTime,
          0.02
        );
      } else if (
        param === "mid" &&
        nodes.mid
      ) {
        nodes.mid.gain.setTargetAtTime(
          parseEqGain(val),
          audioCtx.currentTime,
          0.02
        );
      } else if (
        param === "high" &&
        nodes.high
      ) {
        nodes.high.gain.setTargetAtTime(
          parseEqGain(val),
          audioCtx.currentTime,
          0.02
        );
      } else if (param === "mute") {
        nodes.fader.gain.setTargetAtTime(
          val ? 0 : 1,
          audioCtx.currentTime,
          0.01
        );
      }
    } catch (error) {
      console.error(
        "[AUDIO ENGINE] Error update audio:",
        error
      );
    }
  };

  /* ------------------------------------------------------------------------
     MEDIA ELEMENT CONNECTOR
     ------------------------------------------------------------------------ */

  window.connectMediaElementToChannel = function (
    chNum,
    mediaElement
  ) {
    if (!mediaElement) {
      return false;
    }

    const ch = Number(chNum);

    if (
      !Number.isInteger(ch) ||
      ch < 1 ||
      ch > CHANNEL_COUNT
    ) {
      return false;
    }

    try {
      return window.initChannelAudioNode(
        ch,
        mediaElement
      );
    } catch (error) {
      console.error(
        "[AUDIO ENGINE] Gagal menghubungkan input audio:",
        error
      );

      return false;
    }
  };

  /* ------------------------------------------------------------------------
     CUSTOM AUDIO CONNECTOR
     ------------------------------------------------------------------------ */

  window.connectCustomAudioToChannel = function (
    chNum,
    url
  ) {
    const ch = Number(chNum);

    if (
      !Number.isInteger(ch) ||
      ch < 1 ||
      ch > CHANNEL_COUNT
    ) {
      return false;
    }

    if (
      typeof url !== "string" ||
      !url.trim()
    ) {
      console.warn(
        `[AUDIO ENGINE] CH${ch}: tidak ada sumber audio.`
      );

      return false;
    }

    if (!initAudioEngine()) {
      return false;
    }

    try {
      if (channelAudioElements[ch]) {
        try {
          channelAudioElements[ch].pause();
          channelAudioElements[ch].removeAttribute("src");
          channelAudioElements[ch].load();
        } catch (_) {}
      }

      const audio = new Audio();

      audio.loop = false;
      audio.crossOrigin = "anonymous";
      audio.preload = "auto";
      audio.src = url.trim();

      channelAudioElements[ch] = audio;

      const initialized =
        window.initChannelAudioNode(
          ch,
          audio
        );

      if (!initialized) {
        return false;
      }

      audio
        .play()
        .then(() => {
          console.log(
            `[AUDIO ENGINE] Audio CH${ch} PLAY`
          );
        })
        .catch((error) => {
          console.warn(
            `[AUDIO ENGINE] CH${ch} menunggu interaksi user:`,
            error
          );
        });

      return true;
    } catch (error) {
      console.error(
        `[AUDIO ENGINE] Gagal memutar audio CH${ch}:`,
        error
      );

      return false;
    }
  };

  /* ------------------------------------------------------------------------
     STOP CHANNEL AUDIO
     ------------------------------------------------------------------------ */

  window.stopChannelAudio = function (chNum) {
    const ch = Number(chNum);

    const audio = channelAudioElements[ch];

    if (!audio) {
      return false;
    }

    try {
      audio.pause();
      audio.currentTime = 0;

      return true;
    } catch (error) {
      console.error(
        "[AUDIO ENGINE] Gagal stop audio:",
        error
      );

      return false;
    }
  };

  /* ------------------------------------------------------------------------
     CONNECT MUSIC PLAYER TO CHANNEL 1
     ------------------------------------------------------------------------ */

  window.connectPlayerToChannel1 = function (
    audioElementOrUrl
  ) {
    if (!audioElementOrUrl) {
      console.log(
        "[AUDIO ENGINE] MUSIC belum memiliki sumber audio."
      );

      return false;
    }

    if (
      typeof HTMLMediaElement !== "undefined" &&
      audioElementOrUrl instanceof HTMLMediaElement
    ) {
      return window.connectMediaElementToChannel(
        1,
        audioElementOrUrl
      );
    }

    if (
      typeof audioElementOrUrl === "string" &&
      audioElementOrUrl.trim()
    ) {
      return window.connectCustomAudioToChannel(
        1,
        audioElementOrUrl.trim()
      );
    }

    return false;
  };

  /* ------------------------------------------------------------------------
     EVENT LISTENER INPUT
     ------------------------------------------------------------------------ */

  document.addEventListener(
    "input",
    (event) => {
      const target = event.target;

      const param =
        target.dataset.param ||
        target.dataset.k;

      const strip = target.closest(
        ".new-channel-strip, .channel-strip"
      );

      if (!strip || !param) {
        return;
      }

      const chNum = parseInt(
        strip.dataset.ch,
        10
      );

      const value = parseFloat(
        target.value
      );

      if (
        !Number.isInteger(chNum) ||
        chNum < 1 ||
        chNum > CHANNEL_COUNT ||
        !Number.isFinite(value)
      ) {
        return;
      }

      initAudioEngine();

      if (!channelNodes[chNum]) {
        window.initChannelAudioNode(
          chNum,
          null
        );
      }

      window.updateAudioParamLive(
        chNum,
        param,
        value
      );
    },
    true
  );

  /* ------------------------------------------------------------------------
     EVENT LISTENER MUTE / SOLO
     ------------------------------------------------------------------------ */

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target.closest(
        'button[data-k="mute"], ' +
        'button[data-k="solo"], ' +
        '[data-action]'
      );

      if (!target) {
        return;
      }

      const strip = target.closest(
        ".new-channel-strip, .channel-strip"
      );

      if (!strip) {
        return;
      }

      const chNum = parseInt(
        strip.dataset.ch,
        10
      );

      const action =
        target.dataset.k ||
        target.dataset.action;

      if (
        !Number.isInteger(chNum) ||
        chNum < 1 ||
        chNum > CHANNEL_COUNT
      ) {
        return;
      }

      if (
        action !== "mute" &&
        action !== "solo"
      ) {
        return;
      }

      const channelState =
        window.state &&
        Array.isArray(window.state.channels)
          ? window.state.channels[chNum - 1]
          : null;

      if (
        channelState &&
        channelNodes[chNum]
      ) {
        const isMuted = Boolean(
          channelState.mute
        );

        window.updateAudioParamLive(
          chNum,
          "mute",
          isMuted
        );
      }
    },
    true
  );

  /* ------------------------------------------------------------------------
     AUDIO URL BUTTON
     ------------------------------------------------------------------------ */

  function setupAudioUrlButton() {
    const loadAudioBtn =
      document.getElementById(
        "screenLoadAudioBtn"
      );

    const audioInputUrl =
      document.getElementById(
        "screenAudioInputUrl"
      );

    if (
      !loadAudioBtn ||
      !audioInputUrl
    ) {
      return;
    }

    loadAudioBtn.addEventListener(
      "click",
      () => {
        const url =
          audioInputUrl.value.trim();

        if (!url) {
          return;
        }

        let targetCh = 1;

        const screenInputEl =
          document.getElementById(
            "screenInput"
          );

        if (
          screenInputEl &&
          screenInputEl.textContent
        ) {
          const matchNum = parseInt(
            screenInputEl.textContent.replace(
              /\D/g,
              ""
            ),
            10
          );

          if (
            Number.isInteger(matchNum) &&
            matchNum >= 1 &&
            matchNum <= CHANNEL_COUNT
          ) {
            targetCh = matchNum;
          }
        }

        window.connectCustomAudioToChannel(
          targetCh,
          url
        );
      }
    );
  }

  /* ------------------------------------------------------------------------
     SAFE DOM INITIALIZATION
     ------------------------------------------------------------------------ */

  function initializeAudioEngine() {
    setupAudioUrlButton();

    for (
      let i = 1;
      i <= CHANNEL_COUNT;
      i++
    ) {
      if (!channelNodes[i]) {
        window.initChannelAudioNode(
          i,
          null
        );
      }
    }
  }

  /* ------------------------------------------------------------------------
     START METERS LOOP ONLY ONCE
     ------------------------------------------------------------------------ */

  function startMetersLoop() {
    if (meterAnimationStarted) {
      return;
    }

    meterAnimationStarted = true;

    requestAnimationFrame(
      updateChannelMeters
    );
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        initializeAudioEngine();
        startMetersLoop();
      },
      {
        once: true
      }
    );
  } else {
    initializeAudioEngine();
    startMetersLoop();
  }
})();
