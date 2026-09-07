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
