/* ==========================================================================
   WEB AUDIO ENGINE & MUSIC PLAYER ROUTING (Full Integrated)
   ========================================================================== */
(function () {
  "use strict";

  let audioCtx = null;
  const channelNodes = {}; // Menyimpan node audio per channel (1-14)
  let backgroundMusicElement = null;

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

      faderNode.connect(audioCtx.destination); // Sambungkan ke Output Speaker / Audio Out

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

  // Fungsi untuk menghubungkan pemutar musik ke Channel 1 sebagai jalur utama
  window.connectPlayerToChannel1 = function(audioElementOrUrl) {
    initAudioEngine();
    if (!backgroundMusicElement) {
      if (audioElementOrUrl instanceof HTMLAudioElement) {
        backgroundMusicElement = audioElementOrUrl;
      } else {
        backgroundMusicElement = new Audio(audioElementOrUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
        backgroundMusicElement.loop = true;
        backgroundMusicElement.crossOrigin = "anonymous";
      }
    }
    window.initChannelAudioNode(1, backgroundMusicElement);
    backgroundMusicElement.play().catch(err => console.log("Autoplay dicegah browser:", err));
  };

  // Integrasikan otomatis dengan event input slider/knob pada channel strip
  document.addEventListener("input", (e) => {
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

  // Hubungkan tombol pemutar musik otomatis ke CH1
  document.addEventListener("DOMContentLoaded", () => {
    const musicBtn = document.querySelector(".media-rack button:nth-child(3), .player button:nth-child(2)");
    if (musicBtn) {
      musicBtn.addEventListener("click", () => {
        window.connectPlayerToChannel1();
      });
    }
  });

})();
