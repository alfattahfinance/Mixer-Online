/* ==========================================================================
   WEB AUDIO ENGINE & MUSIC PLAYER ROUTING (Full Integrated 3-Band EQ)
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

      const masterAnalyser = audioCtx.createAnalyser();
      masterAnalyser.fftSize = 256;
      masterAnalyser.smoothingTimeConstant = 0.75;
      masterNode.connect(masterAnalyser);
      masterAnalyser.connect(audioCtx.destination);
      masterNode._analyser = masterAnalyser;
    }
    return masterNode;
  }

  // Inisialisasi Web Audio Context
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

      // Buat pemrosesan per channel: Gain -> EQ (Low -> Mid -> High) -> Panner -> Fader Volume -> Master Out
      const gainNode = audioCtx.createGain();
      
      // 1. Low EQ Filter (Low-shelf 100Hz)
      const lowBq = audioCtx.createBiquadFilter();
      lowBq.type = "lowshelf";
      lowBq.frequency.value = 100;
      lowBq.gain.value = 0; // Flat (0dB)

      // 2. Mid EQ Filter (Peaking 1000Hz) - TAMBAHAN FIX
      const midBq = audioCtx.createBiquadFilter();
      midBq.type = "peaking";
      midBq.frequency.value = 1000;
      midBq.Q.value = 1.0;
      midBq.gain.value = 0; // Flat (0dB)

      // 3. High EQ Filter (High-shelf 8000Hz)
      const highBq = audioCtx.createBiquadFilter();
      highBq.type = "highshelf";
      highBq.frequency.value = 8000;
      highBq.gain.value = 0; // Flat (0dB)

      const pannerNode = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
      const faderNode = audioCtx.createGain();

      // Hubungkan rantai audio (Chain routing): Source -> Gain -> Low -> Mid -> High -> Panner -> Fader
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

      // Meter tap: baca sinyal SETELAH processing channel
      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.75;
      faderNode.connect(analyserNode);
      faderNode.connect(ensureMaster()); // Channel -> Master -> Output

      channelNodes[chNum] = {
        source: sourceNode,
        gain: gainNode,
        low: lowBq,
        mid: midBq,   // Simpan reference filter Mid
        high: highBq,
        pan: pannerNode,
        fader: faderNode,
        analyser: analyserNode
      };

      console.log(`[AUDIO ENGINE] Jalur audio CH${chNum} (Gain -> Low -> Mid -> High) aktif.`);
    } catch (e) {
      console.error(`Gagal menginisialisasi audio untuk CH${chNum}:`, e);
    }
  };

  function updateChannelMeters() {
    const strips = document.querySelectorAll(".new-channel-strip, .channel-strip");
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
        meter.querySelectorAll("i[data-seg]").forEach((seg, i) => {
          seg.classList.toggle("active", i < count);
        });
        meter.classList.toggle("signal", count > 0);
      }
    });

    requestAnimationFrame(updateChannelMeters);
  }

  window.updateMasterAudioLive = function(val) {
    ensureMaster();
    const n = Math.max(0, Math.min(100, Number(val)));
    masterNode.gain.setTargetAtTime(n / 100, audioCtx.currentTime, 0.02);
  };

  // Helper konversi nilai slider/knob (0-100 atau -15 sampai +15) ke dB Gain Filter
  function parseEqGain(val) {
    let num = parseFloat(val);
    if (isNaN(num)) return 0;
    // Jika slider mengirim rentang 0..100 (di mana 50 adalah flat/0dB)
    if (num >= 0 && num <= 100) {
      return ((num - 50) / 50) * 15; // Menghasilkan rentang -15dB s/d +15dB
    }
    return Math.max(-24, Math.min(24, num));
  }

  // Sinkronisasi pemrosesan kontrol audio secara real-time
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
      .catch(err => console.warn(`[AUDIO ENGINE] CH${ch} perlu interaksi user untuk PLAY:`, err));
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

  requestAnimationFrame(updateChannelMeters);

  // Integrasikan otomatis dengan event input slider/knob pada channel strip
  document.addEventListener("input", (e) => {
    const target = e.target;
    const param = target.dataset.param || target.dataset.k;
    const strip = target.closest(".new-channel-strip, .channel-strip");
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

    const strip = target.closest(".new-channel-strip, .channel-strip");
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

  // Event Listener UI
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
          if (!isNaN(matchNum) && matchNum >= 1 && matchNum <= 14) {
            targetCh = matchNum;
          }
        }

        window.connectCustomAudioToChannel(targetCh, url);
        console.log(`[SCREEN AUDIO] Memuat audio ke jalur CH${targetCh}`);
      });
    }

    const musicBtn = document.querySelector(".media-rack button:nth-child(3), .player button:nth-child(2)");
    if (musicBtn) {
      musicBtn.addEventListener("click", () => {
        window.connectPlayerToChannel1();
      });
    }
  });

})();
