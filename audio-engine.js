/* ==========================================================================
   WEB AUDIO ENGINE & MUSIC PLAYER ROUTING
   16 CHANNEL - NO AUTO MUSIC (OPTIMIZED FOR PERFORMANCE)
   ========================================================================== */
(function () {
  "use strict";

  let audioCtx = null;

  // Mixer menggunakan 16 channel
  const channelNodes = {};
  const channelAudioElements = {};
  let masterNode = null;

  /* ------------------------------------------------------------------------
     AUDIO CONTEXT
     ------------------------------------------------------------------------ */

  function initAudioEngine() {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        console.error("[AUDIO ENGINE] Web Audio API tidak tersedia.");
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
    if (!initAudioEngine()) return null;

    if (!masterNode) {
      masterNode = audioCtx.createGain();
      masterNode.gain.value = 0.75;

      const masterAnalyser = audioCtx.createAnalyser();
      masterAnalyser.fftSize = 64; // Diturunkan dari 256 agar lebih ringan
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

  window.initChannelAudioNode = function (chNum, mediaStreamOrElement) {
    const ch = Number(chNum);

    if (!Number.isInteger(ch) || ch < 1 || ch > 16) {
      console.warn("[AUDIO ENGINE] Channel tidak valid:", chNum);
      return false;
    }

    if (!initAudioEngine()) return false;

    try {
      let sourceNode;

      if (mediaStreamOrElement instanceof MediaStream) {
        sourceNode = audioCtx.createMediaStreamSource(mediaStreamOrElement);
      } else if (mediaStreamOrElement instanceof HTMLMediaElement) {
        sourceNode = audioCtx.createMediaElementSource(mediaStreamOrElement);
      } else {
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
      midBq.Q.value = 1.0;
      midBq.gain.value = 0;

      const highBq = audioCtx.createBiquadFilter();
      highBq.type = "highshelf";
      highBq.frequency.value = 8000;
      highBq.gain.value = 0;

      const pannerNode = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
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
      analyserNode.fftSize = 64; // Dioptimalkan ke 64 agar tidak berat di CPU
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
        analyser: analyserNode
      };

      console.log(`[AUDIO ENGINE] Jalur audio CH${ch} aktif.`);
      return true;

    } catch (e) {
      console.error(`[AUDIO ENGINE] Gagal menginisialisasi CH${ch}:`, e);
      return false;
    }
  };

  /* ------------------------------------------------------------------------
     CHANNEL METERS (OPTIMIZED WITH THROTTLING & CACHING)
     ------------------------------------------------------------------------ */

  let lastMeterUpdate = 0;
  let cachedStrips = null;

  function getCachedStrips() {
    if (!cachedStrips) {
      cachedStrips = Array.from(document.querySelectorAll(".new-channel-strip, .channel-strip"));
    }
    return cachedStrips;
  }

  // Refresh cache berkala jika elemen DOM berubah
  window.refreshAudioDOMCache = function() {
    cachedStrips = null;
  };

  function updateChannelMeters(timestamp) {
    requestAnimationFrame(updateChannelMeters);

    // Batasi frame rate meter ke ~30 FPS (setiap 33ms) untuk mencegah lag pada HP/browser
    if (timestamp - lastMeterUpdate < 33) return;
    lastMeterUpdate = timestamp;

    const strips = getCachedStrips();

    strips.forEach(strip => {
      const ch = Number(strip.dataset.ch);
      const nodes = channelNodes[ch];
      const meter = strip.querySelector(".new-channel-meter, .ch-top-vu-fill");

      if (!nodes?.analyser || !meter) return;

      const data = new Uint8Array(nodes.analyser.fftSize);
      nodes.analyser.getByteTimeDomainData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }

      const rms = Math.sqrt(sum / data.length);
      const level = Math.max(0, Math.min(1, rms * 3.5));

      if (meter.classList.contains("ch-top-vu-fill")) {
        meter.style.height = (level * 100) + "%";
      } else {
        const count = Math.round(level * 12);
        const segs = meter.querySelectorAll("i[data-seg]");
        
        segs.forEach((seg, i) => {
          seg.classList.toggle("active", i < count);
        });

        meter.classList.toggle("signal", count > 0);
      }
    });
  }

  /* ------------------------------------------------------------------------
     MASTER LIVE
     ------------------------------------------------------------------------ */

  window.updateMasterAudioLive = function (val) {
    const master = ensureMaster();
    if (!master || !audioCtx) return;

    const n = Math.max(0, Math.min(100, Number(val)));
    master.gain.setTargetAtTime(n / 100, audioCtx.currentTime, 0.02);
  };

  /* ------------------------------------------------------------------------
     EQ VALUE
     ------------------------------------------------------------------------ */

  function parseEqGain(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return 0;

    if (num >= 0 && num <= 100) {
      return ((num - 50) / 50) * 15;
    }

    return Math.max(-24, Math.min(24, num));
  }

  /* ------------------------------------------------------------------------
     UPDATE CHANNEL AUDIO
     ------------------------------------------------------------------------ */

  window.updateAudioParamLive = function (chNum, param, val) {
    const ch = Number(chNum);

    if (!Number.isInteger(ch) || ch < 1 || ch > 16 || !channelNodes[ch] || !audioCtx) {
      return;
    }

    const nodes = channelNodes[ch];

    try {
      if (param === "fader") {
        nodes.fader.gain.setTargetAtTime(
          Math.max(0, Math.min(1, Number(val) / 100)),
          audioCtx.currentTime,
          0.02
        );
      } else if (param === "gain") {
        nodes.gain.gain.setTargetAtTime(
          Math.max(0.1, Number(val)),
          audioCtx.currentTime,
          0.02
        );
      } else if (param === "pan" && nodes.pan) {
        nodes.pan.pan.setTargetAtTime(
          Math.max(-1, Math.min(1, Number(val))),
          audioCtx.currentTime,
          0.02
        );
      } else if (param === "low" && nodes.low) {
        nodes.low.gain.setTargetAtTime(parseEqGain(val), audioCtx.currentTime, 0.02);
      } else if (param === "mid" && nodes.mid) {
        nodes.mid.gain.setTargetAtTime(parseEqGain(val), audioCtx.currentTime, 0.02);
      } else if (param === "high" && nodes.high) {
        nodes.high.gain.setTargetAtTime(parseEqGain(val), audioCtx.currentTime, 0.02);
      } else if (param === "mute") {
        nodes.fader.gain.setTargetAtTime(val ? 0 : 1, audioCtx.currentTime, 0.01);
      }
    } catch (e) {
      console.error("[AUDIO ENGINE] Error update audio:", e);
    }
  };

  /* ------------------------------------------------------------------------
     MEDIA ELEMENT & CUSTOM AUDIO CONNECTORS
     ------------------------------------------------------------------------ */

  window.connectMediaElementToChannel = function (chNum, mediaElement) {
    if (!mediaElement) return false;
    const ch = Number(chNum);
    if (!Number.isInteger(ch) || ch < 1 || ch > 16) return false;

    try {
      return window.initChannelAudioNode(ch, mediaElement);
    } catch (e) {
      console.error("[AUDIO ENGINE] Gagal menghubungkan input audio:", e);
      return false;
    }
  };

  window.connectCustomAudioToChannel = function (chNum, url) {
    const ch = Number(chNum);
    if (!Number.isInteger(ch) || ch < 1 || ch > 16) return false;

    if (typeof url !== "string" || !url.trim()) {
      console.warn(`[AUDIO ENGINE] CH${ch}: tidak ada sumber audio.`);
      return false;
    }

    if (!initAudioEngine()) return false;

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

      const initialized = window.initChannelAudioNode(ch, audio);
      if (!initialized) return false;

      audio.play().then(() => {
        console.log(`[AUDIO ENGINE] Audio CH${ch} PLAY`);
      }).catch(err => {
        console.warn(`[AUDIO ENGINE] CH${ch} menunggu interaksi user:`, err);
      });

      return true;
    } catch (e) {
      console.error(`[AUDIO ENGINE] Gagal memutar audio CH${ch}:`, e);
      return false;
    }
  };

  window.stopChannelAudio = function (chNum) {
    const ch = Number(chNum);
    const audio = channelAudioElements[ch];
    if (!audio) return false;

    try {
      audio.pause();
      audio.currentTime = 0;
      return true;
    } catch (e) {
      console.error("[AUDIO ENGINE] Gagal stop audio:", e);
      return false;
    }
  };

  window.connectPlayerToChannel1 = function (audioElementOrUrl) {
    if (!audioElementOrUrl) {
      console.log("[AUDIO ENGINE] MUSIC belum memiliki sumber audio.");
      return false;
    }

    if (audioElementOrUrl instanceof HTMLMediaElement) {
      return window.connectMediaElementToChannel(1, audioElementOrUrl);
    }

    if (typeof audioElementOrUrl === "string" && audioElementOrUrl.trim()) {
      return window.connectCustomAudioToChannel(1, audioElementOrUrl.trim());
    }

    return false;
  };

  /* ------------------------------------------------------------------------
     EVENT LISTENERS (INPUT & UI)
     ------------------------------------------------------------------------ */

  document.addEventListener("input", (e) => {
    const target = e.target;
    const param = target.dataset.param || target.dataset.k;
    const strip = target.closest(".new-channel-strip, .channel-strip");

    if (!strip || !param) return;

    const chNum = parseInt(strip.dataset.ch, 10);
    const val = parseFloat(target.value);

    if (!Number.isInteger(chNum) || chNum < 1 || chNum > 16 || isNaN(val)) return;

    initAudioEngine();

    if (!channelNodes[chNum]) {
      window.initChannelAudioNode(chNum, null);
    }

    window.updateAudioParamLive(chNum, param, val);
  }, true);

  document.addEventListener("click", (e) => {
    const target = e.target.closest('button[data-k="mute"], button[data-k="solo"], [data-action]');
    if (!target) return;

    const strip = target.closest(".new-channel-strip, .channel-strip");
    if (!strip) return;

    const chNum = parseInt(strip.dataset.ch, 10);
    const action = target.dataset.k || target.dataset.action;

    if (!Number.isInteger(chNum) || chNum < 1 || chNum > 16) return;
    if (action !== "mute" && action !== "solo") return;

    const channelState = window.state && window.state.channels ? window.state.channels[chNum - 1] : null;

    if (channelState && channelNodes[chNum]) {
      const isMuted = Boolean(channelState.mute);
      window.updateAudioParamLive(chNum, "mute", isMuted);
    }
  }, true);

  document.addEventListener("DOMContentLoaded", () => {
    const loadAudioBtn = document.getElementById("screenLoadAudioBtn");
    const audioInputUrl = document.getElementById("screenAudioInputUrl");

    if (loadAudioBtn && audioInputUrl) {
      loadAudioBtn.addEventListener("click", () => {
        const url = audioInputUrl.value.trim();
        if (!url) return;

        let targetCh = 1;
        const screenInputEl = document.getElementById("screenInput");

        if (screenInputEl && screenInputEl.textContent) {
          const matchNum = parseInt(screenInputEl.textContent.replace(/\D/g, ""), 10);
          if (!isNaN(matchNum) && matchNum >= 1 && matchNum <= 16) {
            targetCh = matchNum;
          }
        }

        window.connectCustomAudioToChannel(targetCh, url);
      });
    }
  });

  /* ------------------------------------------------------------------------
     START METERS LOOP
     ------------------------------------------------------------------------ */

  requestAnimationFrame(updateChannelMeters);

})();
