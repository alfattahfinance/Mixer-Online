/* ==========================================================================
   HEADER CONTROLLER & BRIDGE STATUS SYNC
   ========================================================================== */
(function () {
  "use strict";

  // Fungsi utama untuk menyegarkan tampilan status di bagian header
  function refreshHeader() {
    const st = window.state || {};
    const system = !!st.system;
    const connected = !!st.connected;

    // 1. Update Tombol Power Utama
    const powerBtn = document.getElementById("power");
    if (powerBtn) {
      powerBtn.textContent = system ? "SYSTEM ON" : "SYSTEM OFF";
      powerBtn.classList.toggle("on", system);
    }

    // 2. Update Indikator Status Bridge / ESP32 Hardware
    const bridgeStatusEl = document.getElementById("headerBridgeStatus");
    if (bridgeStatusEl) {
      if (connected) {
        bridgeStatusEl.textContent = "ESP32 BRIDGE ONLINE";
        bridgeStatusEl.style.color = "#7ee787";
      } else if (system) {
        bridgeStatusEl.textContent = "WAITING HARDWARE...";
        bridgeStatusEl.style.color = "#f1c40f";
      } else {
        bridgeStatusEl.textContent = "OFFLINE";
        bridgeStatusEl.style.color = "#e74c3c";
      }
    }

    // 3. Update Elemen Pengaturan / Setup Pendukung (jika ada di DOM)
    const setupSystem = document.getElementById("setupSystem");
    if (setupSystem) setupSystem.textContent = system ? "ON" : "OFF";

    const setupTransport = document.getElementById("setupTransport");
    if (setupTransport) setupTransport.textContent = connected ? "ONLINE" : "OFFLINE";
  }

  // Daftarkan fungsi ke scope global agar bisa dipanggil dari modul lain (seperti boot/adapter)
  window.refreshHeaderStatus = refreshHeader;
  window.refreshSystemHeader = refreshHeader;

  // Inisialisasi saat dokumen selesai dimuat
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshHeader, { once: true });
  } else {
    refreshHeader();
  }
})();
