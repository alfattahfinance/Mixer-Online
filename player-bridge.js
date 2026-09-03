/* ==========================================================================
   PHONE MUSIC PLAYER INTEGRATION FOR MIXER-ONLINE
   ========================================================================== */
(function () {
  "use strict";

  let audioElement = null;
  let audioContext = null;
  let audioSourceNode = null;

  function initPlayerBridge() {
    // 1. Buat elemen audio tersembunyi untuk memutar musik lokal dari HP
    if (!audioElement) {
      audioElement = document.createElement('audio');
      audioElement.id = 'phoneMusicPlayer';
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);
    }

    // 2. Kaitkan tombol "MUSIC" yang dilingkari di antarmuka
    const musicButtons = document.querySelectorAll('.media-rack button, .player button');
    musicButtons.forEach(btn => {
      if (btn.textContent.includes('MUSIC')) {
        btn.addEventListener('click', () => {
          openPhoneMusicSelector();
        });
      }
    });
  }

  // Membuka jendela pilih file/audio dari penyimpanan ponsel
  function openPhoneMusicSelector() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.multiple = true; // Bisa pilih banyak lagu

    fileInput.onchange = (event) => {
      const files = event.target.files;
      if (files.length > 0) {
        const selectedFile = files[0];
        const fileURL = URL.createObjectURL(selectedFile);
        
        audioElement.src = fileURL;
        audioElement.play();
        
        // Update teks judul track di layar mixer
        const trackTitleEl = document.querySelector('.player strong, #screenTrackTitle');
        if (trackTitleEl) {
          trackTitleEl.textContent = selectedFile.name.replace(/\.[^/.]+$/, "");
        }

        console.log("Memutar musik dari ponsel:", selectedFile.name);
      }
    };

    fileInput.click();
  }

  // Jalankan inisialisasi saat DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlayerBridge);
  } else {
    initPlayerBagian(); // Fallback
    initPlayerBridge();
  }

})();
