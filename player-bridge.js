/* ==========================================================================
   PHONE MUSIC PLAYER INTEGRATION FOR MIXER-ONLINE (FINAL PRO EDITION)
   ========================================================================== */
(function () {
  "use strict";

  let audioElement = null;
  let audioContext = null;
  let audioSourceNode = null;
  let analyserNode = null;
  let playlist = [];
  let currentTrackIndex = 0;

  function initAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 64;

        if (audioElement && !audioSourceNode) {
          audioSourceNode = audioContext.createMediaElementSource(audioElement);
          audioSourceNode.connect(analyserNode);
          analyserNode.connect(audioContext.destination);
          startRtaSpectrumLoop();
        }
      }
    }
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume();
    }
  }

  function initPlayerBridge() {
    // 1. Buat elemen audio tersembunyi untuk memutar musik dari HP
    if (!audioElement) {
      audioElement = document.createElement("audio");
      audioElement.id = "phoneMusicPlayer";
      audioElement.style.display = "none";
      document.body.appendChild(audioElement);

      audioElement.addEventListener("ended", playNextTrack);
      audioElement.addEventListener("play", () => updatePlayButtonUI(true));
      audioElement.addEventListener("pause", () => updatePlayButtonUI(false));
    }

    // 2. Kaitkan tombol "MUSIC", "FILE", "PLAY", "REC" di UI Media Player
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const btnText = btn.textContent.trim().toUpperCase();

      if (btnText.includes("MUSIC") || btnText.includes("FILE")) {
        e.preventDefault();
        openPhoneMusicSelector();
      } else if (btnText.includes("PLAY") || btnText.includes("PAUSE")) {
        e.preventDefault();
        togglePlayPause();
      } else if (btnText.includes("REC")) {
        e.preventDefault();
        toggleRecord(btn);
      }
    });
  }

  // Membuka jendela pilih file audio dari HP
  function openPhoneMusicSelector() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "audio/*";
    fileInput.multiple = true;

    fileInput.onchange = (event) => {
      const files = Array.from(event.target.files);
      if (files.length > 0) {
        playlist = files;
        currentTrackIndex = 0;
        loadAndPlayTrack(playlist[currentTrackIndex]);
      }
    };

    fileInput.click();
  }

  function loadAndPlayTrack(file) {
    if (!file || !audioElement) return;

    initAudioContext();
    const fileURL = URL.createObjectURL(file);
    audioElement.src = fileURL;

    audioElement.play().then(() => {
      updatePlayButtonUI(true);
    }).catch(err => {
      console.warn("Autoplay terhalang browser, klik tombol PLAY:", err);
    });

    // Update Teks Judul Track di Layar Konsol M32
    const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
    const trackTitleElems = document.querySelectorAll(".player strong, #screenTrackTitle, .media-rack small");
    trackTitleElems.forEach(el => {
      el.textContent = cleanTitle;
    });

    console.log("[Phone Player] Memutar track:", cleanTitle);
  }

  function togglePlayPause() {
    if (!audioElement || !audioElement.src) {
      openPhoneMusicSelector();
      return;
    }

    initAudioContext();
    if (audioElement.paused) {
      audioElement.play();
      updatePlayButtonUI(true);
    } else {
      audioElement.pause();
      updatePlayButtonUI(false);
    }
  }

  function playNextTrack() {
    if (playlist.length > 0 && currentTrackIndex < playlist.length - 1) {
      currentTrackIndex++;
      loadAndPlayTrack(playlist[currentTrackIndex]);
    } else {
      updatePlayButtonUI(false);
    }
  }

  function updatePlayButtonUI(isPlaying) {
    const playBtns = document.querySelectorAll('.media-rack button, button[data-action="play"]');
    playBtns.forEach(btn => {
      if (btn.textContent.includes("PLAY") || btn.textContent.includes("PAUSE")) {
        btn.textContent = isPlaying ? "⏸ PAUSE" : "▶ PLAY";
        btn.classList.toggle("on", isPlaying);
        btn.classList.toggle("active", isPlaying);
      }
    });
  }

  function toggleRecord(btn) {
    const isRecording = btn.classList.toggle("active");
    btn.classList.toggle("on", isRecording);
    btn.style.color = isRecording ? "#ff3b30" : "";
    console.log("[Phone Player] Status Rekam:", isRecording ? "RECORDING..." : "STOPPED");
  }

  // Animasi RTA Spectrum Analyzer saat Musik Diputar
  function startRtaSpectrumLoop() {
    if (!analyserNode) return;

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    const spectrumBars = document.querySelectorAll(".spectrum .bars i, .rta-bars i");

    function renderSpectrum() {
      if (!audioElement.paused && spectrumBars.length > 0) {
        analyserNode.getByteFrequencyData(dataArray);

        spectrumBars.forEach((bar, index) => {
          const val = dataArray[index % dataArray.length] || 0;
          const heightPct = Math.min(100, Math.max(5, (val / 255) * 100));
          bar.style.height = `${heightPct}%`;
        });
      }
      requestAnimationFrame(renderSpectrum);
    }

    renderSpectrum();
  }

  // Inisialisasi saat DOM siap
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPlayerBridge, { once: true });
  } else {
    initPlayerBridge();
  }

  // Ekspor API
  window.MixerPhonePlayer = {
    openSelector: openPhoneMusicSelector,
    togglePlay: togglePlayPause,
    isPlaying: () => !!(audioElement && !audioElement.paused)
  };

})();
