/* ==========================================================================
   PHONE MUSIC PLAYER INTEGRATION FOR MIXER-ONLINE
   LIGHT / LOW-CPU EDITION
   ========================================================================== */
(function () {
  "use strict";

  let audioElement = null;
  let audioContext = null;
  let audioSourceNode = null;
  let analyserNode = null;

  let playlist = [];
  let currentTrackIndex = 0;
  let currentObjectURL = null;

  let rtaFrame = null;
  let rtaRunning = false;
  let lastRtaUpdate = 0;

  const RTA_INTERVAL = 50; // ±20 FPS

  /* ------------------------------------------------------------------------
     AUDIO CONTEXT
     ------------------------------------------------------------------------ */

  function initAudioContext() {
    if (!audioContext) {
      const AudioCtx =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioCtx) {
        console.warn("[Phone Player] Web Audio API tidak tersedia.");
        return false;
      }

      try {
        audioContext = new AudioCtx();

        analyserNode = audioContext.createAnalyser();

        // FFT kecil = lebih ringan untuk mixer live
        analyserNode.fftSize = 64;
        analyserNode.smoothingTimeConstant = 0.75;

        if (audioElement && !audioSourceNode) {
          audioSourceNode =
            audioContext.createMediaElementSource(audioElement);

          audioSourceNode.connect(analyserNode);
          analyserNode.connect(audioContext.destination);
        }

      } catch (error) {
        console.error(
          "[Phone Player] Gagal membuat AudioContext:",
          error
        );

        audioContext = null;
        analyserNode = null;

        return false;
      }
    }

    if (
      audioContext &&
      audioContext.state === "suspended"
    ) {
      audioContext.resume().catch(() => {});
    }

    return !!audioContext;
  }

  /* ------------------------------------------------------------------------
     PLAYER INITIALIZATION
     ------------------------------------------------------------------------ */

  function initPlayerBridge() {
    if (!audioElement) {
      audioElement = document.createElement("audio");

      audioElement.id = "phoneMusicPlayer";
      audioElement.preload = "metadata";
      audioElement.style.display = "none";

      document.body.appendChild(audioElement);

      audioElement.addEventListener(
        "ended",
        playNextTrack
      );

      audioElement.addEventListener(
        "play",
        function () {
          updatePlayButtonUI(true);
          startRtaSpectrumLoop();
        }
      );

      audioElement.addEventListener(
        "pause",
        function () {
          updatePlayButtonUI(false);
          stopRtaSpectrumLoop();
        }
      );

      audioElement.addEventListener(
        "error",
        function (event) {
          console.warn(
            "[Phone Player] Audio error:",
            event
          );

          stopRtaSpectrumLoop();
        }
      );
    }

    /*
     * Hanya tangani tombol yang memang berada di media rack.
     * Jangan gunakan document.addEventListener("click", ...)
     * untuk seluruh halaman karena dapat mengganggu kontrol mixer.
     */
    document.addEventListener(
      "click",
      handlePlayerClick,
      false
    );
  }

  /* ------------------------------------------------------------------------
     PLAYER BUTTON HANDLER
     ------------------------------------------------------------------------ */

  function handlePlayerClick(event) {
    const btn = event.target.closest(
      ".media-rack button, button[data-action='play'], button[data-action='music'], button[data-action='file'], button[data-action='record']"
    );

    if (!btn) return;

    const text =
      (btn.textContent || "")
        .trim()
        .toUpperCase();

    const action =
      (btn.dataset.action || "")
        .trim()
        .toLowerCase();

    /*
     * MUSIC / FILE
     */
    if (
      action === "music" ||
      action === "file" ||
      text === "MUSIC" ||
      text === "FILE"
    ) {
      event.preventDefault();
      event.stopPropagation();

      openPhoneMusicSelector();
      return;
    }

    /*
     * PLAY / PAUSE
     */
    if (
      action === "play" ||
      text.includes("PLAY") ||
      text.includes("PAUSE")
    ) {
      event.preventDefault();
      event.stopPropagation();

      togglePlayPause();
      return;
    }

    /*
     * RECORD
     */
    if (
      action === "record" ||
      text === "REC" ||
      text.includes("REC")
    ) {
      event.preventDefault();
      event.stopPropagation();

      toggleRecord(btn);
    }
  }

  /* ------------------------------------------------------------------------
     FILE SELECTOR
     ------------------------------------------------------------------------ */

  function openPhoneMusicSelector() {
    const fileInput =
      document.createElement("input");

    fileInput.type = "file";
    fileInput.accept = "audio/*";
    fileInput.multiple = true;
    fileInput.style.display = "none";

    fileInput.addEventListener(
      "change",
      function (event) {
        const files =
          Array.from(
            event.target.files || []
          );

        if (!files.length) {
          fileInput.remove();
          return;
        }

        playlist = files;
        currentTrackIndex = 0;

        loadAndPlayTrack(
          playlist[currentTrackIndex]
        );

        fileInput.remove();
      },
      { once: true }
    );

    document.body.appendChild(fileInput);

    fileInput.click();
  }

  /* ------------------------------------------------------------------------
     LOAD TRACK
     ------------------------------------------------------------------------ */

  function loadAndPlayTrack(file) {
    if (!file || !audioElement) return;

    /*
     * Lepaskan object URL sebelumnya supaya memori tidak menumpuk.
     */
    if (currentObjectURL) {
      URL.revokeObjectURL(currentObjectURL);
      currentObjectURL = null;
    }

    if (!initAudioContext()) {
      console.warn(
        "[Phone Player] AudioContext tidak tersedia."
      );
    }

    currentObjectURL =
      URL.createObjectURL(file);

    audioElement.src = currentObjectURL;
    audioElement.load();

    const cleanTitle =
      file.name.replace(
        /\.[^/.]+$/,
        ""
      );

    updateTrackTitle(cleanTitle);

    /*
     * Play setelah source siap.
     */
    const playPromise =
      audioElement.play();

    if (playPromise) {
      playPromise
        .then(function () {
          updatePlayButtonUI(true);
          startRtaSpectrumLoop();
        })
        .catch(function (error) {
          console.warn(
            "[Phone Player] Play membutuhkan interaksi pengguna:",
            error
          );

          updatePlayButtonUI(false);
        });
    }

    console.log(
      "[Phone Player] Memutar track:",
      cleanTitle
    );
  }

  /* ------------------------------------------------------------------------
     TRACK TITLE
     ------------------------------------------------------------------------ */

  function updateTrackTitle(title) {
    const elements =
      document.querySelectorAll(
        ".player strong, #screenTrackTitle, .media-rack small"
      );

    elements.forEach(function (el) {
      el.textContent = title;
    });
  }

  /* ------------------------------------------------------------------------
     PLAY / PAUSE
     ------------------------------------------------------------------------ */

  function togglePlayPause() {
    if (
      !audioElement ||
      !audioElement.src
    ) {
      openPhoneMusicSelector();
      return;
    }

    initAudioContext();

    if (audioElement.paused) {
      const promise =
        audioElement.play();

      if (promise) {
        promise
          .then(function () {
            updatePlayButtonUI(true);
            startRtaSpectrumLoop();
          })
          .catch(function (error) {
            console.warn(
              "[Phone Player] Tidak dapat memutar:",
              error
            );
          });
      }

    } else {
      audioElement.pause();
    }
  }

  /* ------------------------------------------------------------------------
     NEXT TRACK
     ------------------------------------------------------------------------ */

  function playNextTrack() {
    stopRtaSpectrumLoop();

    if (
      playlist.length > 0 &&
      currentTrackIndex <
        playlist.length - 1
    ) {
      currentTrackIndex++;

      loadAndPlayTrack(
        playlist[currentTrackIndex]
      );

    } else {
      updatePlayButtonUI(false);
    }
  }

  /* ------------------------------------------------------------------------
     PLAY BUTTON UI
     ------------------------------------------------------------------------ */

  function updatePlayButtonUI(isPlaying) {
    const playBtns =
      document.querySelectorAll(
        ".media-rack button, button[data-action='play']"
      );

    playBtns.forEach(function (btn) {
      const text =
        (btn.textContent || "")
          .trim()
          .toUpperCase();

      if (
        text.includes("PLAY") ||
        text.includes("PAUSE")
      ) {
        btn.textContent =
          isPlaying
            ? "⏸ PAUSE"
            : "▶ PLAY";

        btn.classList.toggle(
          "on",
          isPlaying
        );

        btn.classList.toggle(
          "active",
          isPlaying
        );
      }
    });
  }

  /* ------------------------------------------------------------------------
     RECORD
     ------------------------------------------------------------------------ */

  function toggleRecord(btn) {
    const isRecording =
      btn.classList.toggle(
        "active"
      );

    btn.classList.toggle(
      "on",
      isRecording
    );

    btn.style.color =
      isRecording
        ? "#ff3b30"
        : "";

    console.log(
      "[Phone Player] Status Rekam:",
      isRecording
        ? "RECORDING..."
        : "STOPPED"
    );
  }

  /* ------------------------------------------------------------------------
     RTA SPECTRUM
     ------------------------------------------------------------------------ */

  function startRtaSpectrumLoop() {
    if (
      !analyserNode ||
      !audioElement ||
      audioElement.paused
    ) {
      return;
    }

    if (rtaRunning) {
      return;
    }

    rtaRunning = true;

    const dataArray =
      new Uint8Array(
        analyserNode.frequencyBinCount
      );

    function renderSpectrum(timestamp) {
      /*
       * Hentikan loop sepenuhnya ketika musik berhenti.
       */
      if (
        !rtaRunning ||
        !audioElement ||
        audioElement.paused
      ) {
        rtaRunning = false;
        rtaFrame = null;
        return;
      }

      /*
       * Batasi update RTA sekitar 20 FPS.
       * Ini mengurangi beban CPU/DOM secara signifikan.
       */
      if (
        timestamp - lastRtaUpdate >=
        RTA_INTERVAL
      ) {
        lastRtaUpdate = timestamp;

        analyserNode.getByteFrequencyData(
          dataArray
        );

        const spectrumBars =
          document.querySelectorAll(
            ".spectrum .bars i, .rta-bars i"
          );

        if (spectrumBars.length > 0) {
          spectrumBars.forEach(
            function (bar, index) {
              const value =
                dataArray[
                  index %
                    dataArray.length
                ] || 0;

              const heightPct =
                Math.min(
                  100,
                  Math.max(
                    5,
                    (value / 255) *
                      100
                  )
                );

              bar.style.height =
                heightPct + "%";
            }
          );
        }
      }

      rtaFrame =
        requestAnimationFrame(
          renderSpectrum
        );
    }

    lastRtaUpdate =
      performance.now();

    rtaFrame =
      requestAnimationFrame(
        renderSpectrum
      );
  }

  /* ------------------------------------------------------------------------
     STOP RTA
     ------------------------------------------------------------------------ */

  function stopRtaSpectrumLoop() {
    rtaRunning = false;

    if (rtaFrame !== null) {
      cancelAnimationFrame(
        rtaFrame
      );

      rtaFrame = null;
    }
  }

  /* ------------------------------------------------------------------------
     CLEANUP
     ------------------------------------------------------------------------ */

  window.addEventListener(
    "beforeunload",
    function () {
      stopRtaSpectrumLoop();

      if (currentObjectURL) {
        URL.revokeObjectURL(
          currentObjectURL
        );

        currentObjectURL = null;
      }

      if (audioContext) {
        audioContext.close()
          .catch(function () {});
      }
    }
  );

  /* ------------------------------------------------------------------------
     INITIALIZE
     ------------------------------------------------------------------------ */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initPlayerBridge,
      { once: true }
    );
  } else {
    initPlayerBridge();
  }

  /* ------------------------------------------------------------------------
     PUBLIC API
     ------------------------------------------------------------------------ */

  window.MixerPhonePlayer = {
    openSelector:
      openPhoneMusicSelector,

    togglePlay:
      togglePlayPause,

    isPlaying:
      function () {
        return !!(
          audioElement &&
          !audioElement.paused
        );
      },

    stopRta:
      stopRtaSpectrumLoop
  };

})();


/* ==========================================================
   EXTRACTED FROM index.html — PLAYER UI + MIXER SKIN
   ========================================================== */
(function(){
  const musicBtn = document.getElementById('btnPlayerMusic');
  const fileBtn = document.getElementById('btnPlayerFile');
  const liveInBtn = document.getElementById('btnPhysicalAudioInput');
  const fileInput = document.getElementById('localAudioLoader');
  const targetLabel = document.getElementById('activePlayerTarget');
  const playPauseBtn = document.getElementById('btnPlayPauseAudio');
  const trackInfo = document.getElementById('playerTrackInfo');
  const modeBtn = document.getElementById('btnPlayerMode');
  const modeText = document.getElementById('modeText');

  const masterMeterL = document.getElementById('masterMeterL');
  const masterMeterR = document.getElementById('masterMeterR');
  const masterFader = document.getElementById('master');
  const masterValElem = document.getElementById('masterVal');

  let audioCtx = null;
  let sourceNode = null;
  let gainNode = null;
  let panNode = null;
  let analyserNode = null;
  let currentAudioElement = null;
  let liveMicStreamNode = null;

  let playlist = [];
  let currentTrackIndex = 0;
  let isShuffle = false;
  let lockedMusicChannel = null;

  if (masterFader) {
    masterFader.addEventListener('input', function() {
      const val = parseInt(this.value, 10);
      if (masterValElem) masterValElem.textContent = val + '%';

      if (audioCtx && gainNode) {
        const masterScale = val / 100;
        gainNode.gain.setValueAtTime(masterScale, audioCtx.currentTime);
      }

      if (!window.state) window.state = {};
      window.state.masterFader = val;

      if (val === 0) {
        if (masterMeterL) masterMeterL.style.height = '0%';
        if (masterMeterR) masterMeterR.style.height = '0%';
      }
    });
  }

  function initAudioEngine(elementOrStream) {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (!gainNode) {
      gainNode = audioCtx.createGain();
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 64;

      if (audioCtx.createStereoPanner) {
        panNode = audioCtx.createStereoPanner();
        gainNode.connect(panNode);
        panNode.connect(analyserNode);
      } else {
        gainNode.connect(analyserNode);
      }
      analyserNode.connect(audioCtx.destination);
    }

    if (elementOrStream instanceof MediaStream) {
      if (sourceNode) sourceNode.disconnect();
      liveMicStreamNode = audioCtx.createMediaStreamSource(elementOrStream);
      liveMicStreamNode.connect(gainNode);
    } else if (elementOrStream instanceof HTMLMediaElement) {
      if (!sourceNode) {
        sourceNode = audioCtx.createMediaElementSource(elementOrStream);
        sourceNode.connect(gainNode);
      }
    }
  }

  async function startPhysicalAudioStream() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Browser/APK tidak mendukung pengambilan audio fisik.");
        return;
      }

      const constraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000
        },
        video: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
      }

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      if (liveMicStreamNode) {
        liveMicStreamNode.disconnect();
      }

      liveMicStreamNode = audioCtx.createMediaStreamSource(stream);

      if (!gainNode) {
        gainNode = audioCtx.createGain();
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 64;

        if (audioCtx.createStereoPanner) {
          panNode = audioCtx.createStereoPanner();
          gainNode.connect(panNode);
          panNode.connect(analyserNode);
        } else {
          gainNode.connect(analyserNode);
        }
        analyserNode.connect(audioCtx.destination);
      }

      liveMicStreamNode.connect(gainNode);

      const activeInputStr = document.getElementById('screenInput')?.textContent || "CH 1";
      lockedMusicChannel = parseInt(activeInputStr.replace(/\D/g, ''), 10) || 1;

      if (trackInfo) trackInfo.textContent = `[LIVE PHYSICAL MIXER IN] CH ${lockedMusicChannel}`;
      alert(`✅ SUARA FISIK TERHUBUNG! Cobalah bicara di Mic Mixer Anda.`);

      if (window.AndroidFeedback && typeof window.AndroidFeedback.triggerHaptic === 'function') {
        window.AndroidFeedback.triggerHaptic(50);
      } else if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (err) {
      alert("Gagal mengambil suara mixer fisik: " + err.message + "\n\nPastikan kabel Aux TRRS / OTG Soundcard sudah tersambung ke HP.");
    }
  }

  function playTrack(index) {
    if (playlist.length === 0 || index < 0 || index >= playlist.length) return;

    currentTrackIndex = index;
    const file = playlist[currentTrackIndex];
    const fileObjectURL = URL.createObjectURL(file);

    if (!currentAudioElement) {
      currentAudioElement = document.createElement('audio');
      currentAudioElement.loop = false;
      document.body.appendChild(currentAudioElement);

      currentAudioElement.addEventListener('ended', playNextTrack);
    }

    currentAudioElement.src = fileObjectURL;
    currentAudioElement.play().then(() => {
      initAudioEngine(currentAudioElement);
      
      if (trackInfo) {
        trackInfo.textContent = `[${currentTrackIndex + 1}/${playlist.length}] ${file.name}`;
      }
      if (playPauseBtn) {
        playPauseBtn.textContent = '⏸ PAUSE';
        playPauseBtn.style.background = '#e74c3c';
      }
      const tr = document.getElementById('testResult');
      if(tr) tr.textContent = `PLAYER: Memutar "${file.name}" terkunci di Channel ${lockedMusicChannel}`;
    }).catch(err => console.error("Gagal memutar audio:", err));
  }

  function playNextTrack() {
    if (playlist.length === 0) return;

    if (isShuffle) {
      let nextIndex = Math.floor(Math.random() * playlist.length);
      if (playlist.length > 1 && nextIndex === currentTrackIndex) {
        nextIndex = (currentTrackIndex + 1) % playlist.length;
      }
      playTrack(nextIndex);
    } else {
      let nextIndex = currentTrackIndex + 1;
      if (nextIndex < playlist.length) {
        playTrack(nextIndex);
      } else {
        playTrack(0);
      }
    }
  }

  function updateIndicators() {
    requestAnimationFrame(updateIndicators);

    const activeInput = document.getElementById('screenInput');
    const screenGain = document.getElementById('screenGain');
    const screenFader = document.getElementById('screenFader');
    const screenPan = document.getElementById('screenPan');

    if (targetLabel) {
      if (lockedMusicChannel !== null) {
        targetLabel.textContent = "[CH " + lockedMusicChannel + " LOCKED]";
      } else if (activeInput) {
        targetLabel.textContent = "[" + activeInput.textContent.trim() + "]";
      }
    }

    const currentChannelStr = activeInput?.textContent || "CH 1";
    const screenChNum = parseInt(currentChannelStr.replace(/\D/g, ''), 10) || 1;
    const chNum = (lockedMusicChannel !== null) ? lockedMusicChannel : screenChNum;

    if (window.state && window.state.channels) {
      const chData = window.state.channels[chNum - 1] || {};
      const screenData = window.state.channels[screenChNum - 1] || {};

      if (screenData) {
        if (screenGain) screenGain.textContent = Number(screenData.gain || 1.0).toFixed(2);
        if (screenFader) screenFader.textContent = Math.round(screenData.fader !== undefined ? screenData.fader : 75) + '%';
        if (screenPan) {
          const panVal = screenData.pan || 0;
          screenPan.textContent = panVal === 0 ? 'CENTER' : (panVal < 0 ? 'L ' + Math.round(Math.abs(panVal) * 100) + '%' : 'R ' + Math.round(panVal * 100) + '%');
        }
      }

      if (analyserNode && ((currentAudioElement && !currentAudioElement.paused) || liveMicStreamNode)) {
        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(dataArray);

        const barCols = document.querySelectorAll('.pro-mini-spectrum .bar-col, .rta-bars div');
        barCols.forEach((bar, idx) => {
          const val = dataArray[idx % dataArray.length] || 10;
          bar.style.height = Math.max(10, Math.min(100, (val / 255) * 100)) + '%';
        });

        let avgLevel = 0;
        for (let i = 0; i < dataArray.length; i++) {
          avgLevel += dataArray[i];
        }
        avgLevel = (avgLevel / dataArray.length) / 255;

        const masterFaderElem = document.getElementById('master');
        const masterVolumeScale = masterFaderElem ? (parseInt(masterFaderElem.value, 10) || 0) / 100 : 0.75;
        const channelFaderScale = ((chData.fader !== undefined ? chData.fader : 75)) / 100;

        const panVal = chData.pan || 0;
        const leftPan = panVal <= 0 ? 1 : 1 - panVal;
        const rightPan = panVal >= 0 ? 1 : 1 + panVal;

        const leftHeight = masterVolumeScale === 0 ? 0 : Math.min(100, avgLevel * 100 * channelFaderScale * masterVolumeScale * leftPan);
        const rightHeight = masterVolumeScale === 0 ? 0 : Math.min(100, avgLevel * 100 * channelFaderScale * masterVolumeScale * rightPan);

        if (masterMeterL) masterMeterL.style.height = leftHeight + '%';
        if (masterMeterR) masterMeterR.style.height = rightHeight + '%';

        if (gainNode) {
          const gainVal = (parseFloat(chData.gain) || 1.0) * channelFaderScale * masterVolumeScale;
          gainNode.gain.setValueAtTime(Math.max(0, Math.min(2.0, gainVal)), audioCtx.currentTime);
        }

        if (panNode && typeof chData.pan !== 'undefined') {
          panNode.pan.setValueAtTime(Math.max(-1.0, Math.min(1.0, chData.pan)), audioCtx.currentTime);
        }
      } else {
        if (masterMeterL) masterMeterL.style.height = '0%';
        if (masterMeterR) masterMeterR.style.height = '0%';
      }
    }
  }

  requestAnimationFrame(updateIndicators);

  if(musicBtn) musicBtn.addEventListener('click', () => fileInput?.click());
  if(fileBtn) fileBtn.addEventListener('click', () => fileInput?.click());
  if(liveInBtn) liveInBtn.addEventListener('click', startPhysicalAudioStream);

  if(modeBtn) {
    modeBtn.addEventListener('click', () => {
      isShuffle = !isShuffle;
      if (modeText) modeText.textContent = isShuffle ? 'SHUFFLE' : 'SEQ';
      modeBtn.style.borderColor = isShuffle ? 'var(--accent-color)' : 'var(--panel-border)';
    });
  }

  if(playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if(!currentAudioElement || playlist.length === 0) {
        fileInput?.click();
        return;
      }
      if(currentAudioElement.paused) {
        currentAudioElement.play();
        playPauseBtn.textContent = '⏸ PAUSE';
        playPauseBtn.style.background = '#e74c3c';
      } else {
        currentAudioElement.pause();
        playPauseBtn.textContent = '▶️ PLAY';
        playPauseBtn.style.background = 'var(--accent-color)';
      }
    });
  }

  if(fileInput) {
    fileInput.addEventListener('change', function(e) {
      const files = Array.from(e.target.files);
      if(files.length === 0) return;
      
      playlist = files;
      const currentChannelStr = document.getElementById('screenInput')?.textContent || "CH 1";
      lockedMusicChannel = parseInt(currentChannelStr.replace(/\D/g, ''), 10) || 1;

      playTrack(0);
    });
  }
})();

(function() {
  const skinSelect = document.getElementById('skinSelect');
  
  const savedSkin = localStorage.getItem('mixer_theme') || 'theme-midas';
  document.body.className = savedSkin;
  if (skinSelect) skinSelect.value = savedSkin;

  if (skinSelect) {
    skinSelect.addEventListener('change', function() {
      const selectedTheme = this.value;
      document.body.className = selectedTheme;
      localStorage.setItem('mixer_theme', selectedTheme);
    });
  }
})();


/* ==========================================================
   EXTRACTED FROM index.html — AUDIO RECORDER UI
   ========================================================== */
(function(){
  const recBtn = document.getElementById('btnPlayerRec');
  const trackInfo = document.getElementById('playerTrackInfo');

  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;

  if (recBtn) {
    recBtn.addEventListener('click', async function() {
      if (!isRecording) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream);
          recordedChunks = [];

          mediaRecorder.ondataavailable = function(e) {
            if (e.data.size > 0) recordedChunks.push(e.data);
          };

          mediaRecorder.onstop = function() {
            const blob = new Blob(recordedChunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `M32_REC_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }, 100);

            if (trackInfo) trackInfo.textContent = "RECORDING SAVED & DOWNLOADED";
          };

          mediaRecorder.start();
          isRecording = true;
          recBtn.style.background = "#e74c3c";
          recBtn.style.color = "#ffffff";
          recBtn.innerHTML = "🔴 <small>STOP</small>";
          if (trackInfo) trackInfo.textContent = "🎙 RECORDING LIVE AUDIO...";

        } catch (err) {
          alert("Gagal mengakses mikrofon untuk merekam: " + err.message);
        }
      } else {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
        isRecording = false;
        recBtn.style.background = "var(--main-bg)";
        recBtn.style.color = "var(--text-main)";
        recBtn.innerHTML = "🎙 <small>REC</small>";
      }
    });
  }
})();
