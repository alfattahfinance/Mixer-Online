/* ==========================================================================
   WEB AUDIO ENGINE & MUSIC PLAYER ROUTING (Full Integrated with Screen Input)
   ========================================================================== */
(function () {
  "use strict";

  let audioCtx = null;
  const channelNodes = {}; // Menyimpan node audio per channel (1-14)
  let backgroundMusicElement = null;
  const channelAudioElements = {};
  let masterNode = null;

  function ensureMaster() {
    initAudioEngine();
    if (!masterNode) {
      masterNode = audioCtx.createGain();
      masterNode.gain.value = 0.75;
      masterNode.connect(audioCtx.destination);
    }
    return masterNode;
  }

  // Inisialisasi Web Audio Context saat interaksi pertama (mengatasi kebijakan autoplay browser)
  function initAudioEngine() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  // Membuat jalur node audio untuk setiap channel
  window.initChannelAudioNode = function(chNum, mediaStreamOrElement) {
    initAudioEngine();
    if (!audioCtx) return;

    try {
      let sourceNode;
      if (mediaStreamOrElement instanceof MediaStream) {
        sourceNode = audioCtx.createMediaStreamSource(mediaStreamOrElement);
      } else if (mediaStreamOrElement instanceof HTMLMediaElement) {
        sourceNode = audioCtx.createMediaElementSource(mediaStreamOrElement);
      } else {
        sourceNode = audioCtx.createGain(); // Placeholder default
      }

      // Buat pemrosesan efek per channel: Gain -> EQ (Low/High) -> Panner -> Fader Volume -> Master Out
      const gainNode = audioCtx.createGain();
      
      const lowBq = audioCtx.createBiquadFilter();
      lowBq.type = "lowshelf";
      lowBq.frequency.value = 250;

      const highBq = audioCtx.createBiquadFilter();
      highBq.type = "highshelf";
      highBq.frequency.value = 4000;

      const pannerNode = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
      const faderNode = audioCtx.createGain();

      // Hubungkan rantai audio (Chain routing)
      sourceNode.connect(gainNode);
      gainNode.connect(lowBq);
      lowBq.connect(highBq);
      
      if (pannerNode) {
        highBq.connect(pannerNode);
        pannerNode.connect(faderNode);
      } else {
        highBq.connect(faderNode);
      }

      // Meter tap: baca sinyal SETELAH processing channel dan sebelum master.
      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.75;
      faderNode.connect(analyserNode);
      faderNode.connect(ensureMaster()); // Channel -> Master -> Audio Output

      channelNodes[chNum] = {
        source: sourceNode,
        gain: gainNode,
        low: lowBq,
        high: highBq,
        pan: pannerNode,
        fader: faderNode
      };

      console.log(`[AUDIO ENGINE] Jalur audio untuk CH${chNum} berhasil diaktifkan.`);
    } catch (e) {
      console.error(`Gagal menginisialisasi audio untuk CH${chNum}:`, e);
    }
  };

  function updateChannelMeters() {
    const strips = document.querySelectorAll(".new-channel-strip");
    strips.forEach(strip => {
      const ch = Number(strip.dataset.ch);
      const nodes = channelNodes[ch];
      const meter = strip.querySelector(".new-channel-meter");
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
      const count = Math.round(level * 12);
      meter.querySelectorAll("i[data-seg]").forEach((seg, i) => {
        seg.classList.toggle("active", i < count);
      });
      meter.classList.toggle("signal", count > 0);
    });

    if (masterNode) {
      // Master meter mengikuti sinyal yang benar-benar menuju output.
      if (!masterNode._analyser) {
        masterNode._analyser = audioCtx.createAnalyser();
        masterNode._analyser.fftSize = 256;
        masterNode.disconnect();
        masterNode.connect(masterNode._analyser);
        masterNode._analyser.connect(audioCtx.destination);
      }
    }
    requestAnimationFrame(updateChannelMeters);
  }

  window.updateMasterAudioLive = function(val) {
    ensureMaster();
    const n = Math.max(0, Math.min(100, Number(val)));
    masterNode.gain.setTargetAtTime(n / 100, audioCtx.currentTime, 0.02);
  };

  // Sinkronisasi perubahan parameter web ke Web Audio API secara real-time
  window.updateAudioParamLive = function(chNum, param, val) {
    if (!channelNodes[chNum]) return;
    const nodes = channelNodes[chNum];

    try {
      if (param === "fader") {
        nodes.fader.gain.setTargetAtTime(Math.max(0, Math.min(1, val / 100)), audioCtx.currentTime, 0.02);
      } else if (param === "gain") {
        nodes.gain.gain.setTargetAtTime(Math.max(0.1, val), audioCtx.currentTime, 0.02);
      } else if (param === "pan" && nodes.pan) {
        nodes.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, val)), audioCtx.currentTime, 0.02);
      } else if (param === "low") {
        nodes.low.gain.setTargetAtTime(val, audioCtx.currentTime, 0.02);
      } else if (param === "high") {
        nodes.high.gain.setTargetAtTime(val, audioCtx.currentTime, 0.02);
      } else if (param === "mute") {
        nodes.fader.gain.setTargetAtTime(val ? 0 : 1, audioCtx.currentTime, 0.01);
      }
    } catch (e) {
      console.error("Error updating audio param:", e);
    }
  };

  window.connectMediaElementToChannel = function(chNum, mediaElement) {
    initAudioEngine();
    if (!mediaElement) return false;
    try {
      window.initChannelAudioNode(chNum, mediaElement);
      return true;
    } catch (e) {
      console.error("[AUDIO ENGINE] Gagal menghubungkan input audio:", e);
      return false;
    }
  };

  // Fungsi untuk menghubungkan pemutar musik ke Channel tertentu
  window.connectCustomAudioToChannel = function(chNum, url) {
    initAudioEngine();
    const ch = Number(chNum);
    if (!Number.isInteger(ch) || ch < 1 || ch > 14) return false;

    // Setiap channel mempunyai sumber audio sendiri.
    if (channelAudioElements[ch]) {
      channelAudioElements[ch].pause();
      channelAudioElements[ch].src = "";
    }

    const audio = new Audio(url);
    audio.loop = false;
    audio.crossOrigin = "anonymous";
    channelAudioElements[ch] = audio;

    window.initChannelAudioNode(ch, audio);

    audio.play()
      .then(() => console.log(`[AUDIO ENGINE] Audio CH${ch} PLAY`))
      .catch(err => console.warn(`[AUDIO ENGINE] CH${ch} perlu klik PLAY lagi:`, err));
    return true;
  };

  window.stopChannelAudio = function(chNum) {
    const ch = Number(chNum);
    const audio = channelAudioElements[ch];
    if (!audio) return false;
    audio.pause();
    audio.currentTime = 0;
    return true;
  };

  window.connectPlayerToChannel1 = function(audioElementOrUrl) {
    window.connectCustomAudioToChannel(1, audioElementOrUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
  };

  // Integrasikan otomatis dengan event input slider/knob pada channel strip
  requestAnimationFrame(updateChannelMeters);\n\n  document.addEventListener("input", (e) => {
    const target = e.target;
    const param = target.dataset.param || target.dataset.k;
    const strip = target.closest(".new-channel-strip");
    if (!strip || !param) return;
    
    const chNum = parseInt(strip.dataset.ch, 10);
    const val = parseFloat(target.value);

    if (!isNaN(chNum) && !isNaN(val)) {
      initAudioEngine();
      if (!channelNodes[chNum]) {
        window.initChannelAudioNode(chNum, null);
      }
      window.updateAudioParamLive(chNum, param, val);
    }
  }, true);

  // Integrasikan klik Mute/Solo ke audio engine
  document.addEventListener("click", (e) => {
    const target = e.target.closest('button[data-k="mute"], button[data-k="solo"], [data-action]');
    if (!target) return;

    const strip = target.closest(".new-channel-strip");
    if (!strip) return;

    const chNum = parseInt(strip.dataset.ch, 10);
    const action = target.dataset.k || target.dataset.action;

    if (!isNaN(chNum) && (action === "mute" || action === "solo")) {
      const channelState = window.state && window.state.channels ? window.state.channels[chNum - 1] : null;
      if (channelState && channelNodes[chNum]) {
        const isMuted = Boolean(channelState.mute);
        window.updateAudioParamLive(chNum, "mute", isMuted);
      }
    }
  }, true);

  // Event Listener untuk Kotak Input URL Audio di Layar Tengah & Tombol Media Rack
  document.addEventListener("DOMContentLoaded", () => {
    // Tombol LOAD & PLAY di layar tengah
    const loadAudioBtn = document.getElementById("screenLoadAudioBtn");
    const audioInputUrl = document.getElementById("screenAudioInputUrl");

    if (loadAudioBtn && audioInputUrl) {
      loadAudioBtn.addEventListener("click", () => {
        const url = audioInputUrl.value.trim();
        if (!url) return;

        // Ambil nomor channel yang sedang aktif dari layar tengah (misal: "CH 03" -> 3)
        let targetCh = 1;
        const screenInputEl = document.getElementById("screenInput");
        if (screenInputEl && screenInputEl.textContent) {
          const matchNum = parseInt(screenInputEl.textContent.replace(/\D/g, ""), 10);
          if (!isNaN(matchNum) && matchNum >= 1 && matchNum <= 14) {
            targetCh = matchNum;
          }
        }

        window.connectCustomAudioToChannel(targetCh, url);
        console.log(`[SCREEN AUDIO] Memuat & memutar sumber audio ke jalur CH${targetCh}`);
      });
    }

    // Tombol musik bawaan di media rack
    const musicBtn = document.querySelector(".media-rack button:nth-child(3), .player button:nth-child(2)");
    if (musicBtn) {
      musicBtn.addEventListener("click", () => {
        window.connectPlayerToChannel1();
      });
    }
  });

})();
