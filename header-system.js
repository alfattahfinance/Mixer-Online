/* ==========================================================================
   HEADER CONTROLLER & BRIDGE STATUS SYNC (OPTIMIZED PRO EDITION)
   ========================================================================== */
(function () {
  "use strict";

  // Cache state sebelumnya untuk mencegah DOM reflow/repaint berlebihan yang menyebabkan kedip
  let lastStateCache = {
    system: null,
    connected: null,
    transportName: null
  };

  // Helper untuk mendapatkan status transport aktif
  function getActiveTransportName(st) {
    const activeAdapter = window.MixerAdapters?.active;
    if (st.bluetoothConnected || activeAdapter?.transport === "bluetooth") {
      return "BLUETOOTH";
    }
    if (activeAdapter?.type === "simulator") {
      return "SIMULATOR";
    }
    return "ESP32";
  }

  // Fungsi utama untuk menyegarkan tampilan status di bagian header & topbar
  function refreshHeader() {
    const st = window.state || {};
    const system = !!st.system;
    
    // Deteksi koneksi dari State Global maupun Active Adapter
    const activeAdapter = window.MixerAdapters?.active;
    const connected = !!(st.connected || activeAdapter?.connected);
    const transportName = getActiveTransportName(st);

    // CEK OPTIMASI: Jika tidak ada perubahan status sama sekali, abaikan pembaruan DOM
    if (
      lastStateCache.system === system &&
      lastStateCache.connected === connected &&
      lastStateCache.transportName === transportName
    ) {
      return;
    }

    // Perbarui cache state saat ini
    lastStateCache = { system, connected, transportName };

    // 1. Update Tombol Power Utama
    const powerBtn = document.getElementById("power");
    if (powerBtn) {
      powerBtn.textContent = system ? "SYSTEM ON" : "SYSTEM OFF";
      powerBtn.classList.toggle("on", system);
    }

    // 2. Update Indikator Status Bridge / ESP32 Hardware / Bluetooth
    const bridgeStatusEl = document.getElementById("headerBridgeStatus") || document.getElementById("status");
    if (bridgeStatusEl) {
      if (connected) {
        bridgeStatusEl.textContent = `${transportName} ONLINE`;
        bridgeStatusEl.style.color = "#31e66b";
      } else if (system) {
        bridgeStatusEl.textContent = "WAITING HARDWARE...";
        bridgeStatusEl.style.color = "#ffd21c";
      } else {
        bridgeStatusEl.textContent = "OFFLINE";
        bridgeStatusEl.style.color = "#ff3b30";
      }
    }

    // 3. Update Lampu Indikator Bulat (Topbar & Device Panel)
    const statusLamp = document.getElementById("statusLamp");
    if (statusLamp) {
      statusLamp.className = connected ? "head-status live" : "head-status";
      const lampIcon = statusLamp.querySelector("i, .lamp");
      if (lampIcon) {
        lampIcon.className = connected ? "live green" : (system ? "yellow" : "red");
      }
    }

    const deviceLamp = document.getElementById("deviceLamp");
    if (deviceLamp) {
      deviceLamp.className = connected ? "lamp green" : "lamp red";
    }

    // 4. Update Elemen Pengaturan / Setup Pendukung
    const setupSystem = document.getElementById("setupSystem");
    if (setupSystem) setupSystem.textContent = system ? "ON" : "OFF";

    const setupTransport = document.getElementById("setupTransport") || document.getElementById("testTransportLabel");
    if (setupTransport) {
      setupTransport.textContent = connected ? `${transportName} ONLINE` : "DISCONNECTED";
    }

    // 5. Sync Label Tombol Connect di Berbagai Panel UI
    const btnConnect = document.getElementById("connectEsp");
    if (btnConnect) {
      btnConnect.textContent = connected ? `DISCONNECT ${transportName}` : "CONNECT ESP32";
      btnConnect.classList.toggle("on", connected);
    }

    const btnDevice = document.getElementById("deviceConnect");
    if (btnDevice) {
      btnDevice.textContent = connected ? "DISCONNECT" : "CONNECT HARDWARE";
      btnDevice.classList.toggle("on", connected);
    }

    const btnBluetooth = document.getElementById("btnBluetoothConnect") || document.getElementById("connectBluetooth");
    if (btnBluetooth) {
      const isBtActive = connected && transportName === "BLUETOOTH";
      btnBluetooth.textContent = isBtActive ? "BLUETOOTH CONNECTED" : "CONNECT BLUETOOTH";
      btnBluetooth.classList.toggle("on", isBtActive);
      btnBluetooth.classList.toggle("active", isBtActive);
    }

    // 6. Update Status Teks Footer
    const footerConn = document.getElementById("footerConnection");
    if (footerConn) {
      footerConn.textContent = connected
        ? `● ${transportName} BRIDGE ONLINE`
        : `● ${transportName} BRIDGE OFFLINE`;
    }
  }

  // Daftarkan fungsi ke scope global agar bisa dipanggil dari modul lain
  window.refreshHeaderStatus = refreshHeader;
  window.refreshSystemHeader = refreshHeader;

  // Interval dinaikkan ke 1000ms (1 detik) dengan proteksi cache agar aman dan ringan
  setInterval(refreshHeader, 1000);

  // Auto-bind Event Listener Data RX Hardware
  document.addEventListener("mixer:esp32-rx", refreshHeader);
  document.addEventListener("mixer:bluetooth-rx", refreshHeader);

  // Inisialisasi saat dokumen selesai dimuat
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshHeader, { once: true });
  } else {
    refreshHeader();
  }
})();
