/* Header status display for Physical ESP32 Bridge & Multi-Transport */
(function () {
  "use strict";

  function refresh() {
    const st = window.state || {};
    const system = !!st.system;
    
    // Deteksi koneksi aktif dari Adapter / MixerControl
    const activeAdapter = window.MixerAdapters?.active;
    const connected = !!(st.connected || activeAdapter?.connected);
    
    // Ambil jenis transport aktif
    let transportName = "ESP32";
    if (st.bluetoothConnected || activeAdapter?.transport === "bluetooth") {
      transportName = "BLUETOOTH";
    } else if (activeAdapter?.type === "simulator") {
      transportName = "SIMULATOR";
    }

    // 1. Indikator Tombol Power utama
    const power = document.getElementById("power");
    if (power) {
      power.textContent = system ? "SYSTEM ON" : "SYSTEM OFF";
      power.classList.toggle("on", system);
    }

    // 2. Status Teks Header Utama (Bridge Status)
    const hs = document.getElementById("headerBridgeStatus") || document.getElementById("status");
    if (hs) {
      if (connected) {
        hs.textContent = `${transportName} ONLINE`;
        hs.style.color = "#31e66b";
      } else if (system) {
        hs.textContent = "WAITING HARDWARE";
        hs.style.color = "#ffd21c";
      } else {
        hs.textContent = "OFFLINE";
        hs.style.color = "#ff3b30";
      }
    }

    // 3. Lampu Indikator Status Bulat (Topbar & Device Panel)
    const statusLamp = document.getElementById("statusLamp");
    if (statusLamp) {
      statusLamp.className = connected ? "head-status live" : "head-status";
      const lampIcon = statusLamp.querySelector("i, .lamp");
      if (lampIcon) {
        lampIcon.className = connected ? "live green" : "red";
      }
    }

    const deviceLamp = document.getElementById("deviceLamp");
    if (deviceLamp) {
      deviceLamp.className = connected ? "lamp green" : "lamp red";
    }

    // 4. Pengaturan Teks Panel Setup & Detail Transport
    const setup = document.getElementById("setupSystem");
    if (setup) setup.textContent = system ? "ON" : "OFF";

    const transport = document.getElementById("setupTransport") || document.getElementById("testTransportLabel");
    if (transport) {
      transport.textContent = connected ? `${transportName} ONLINE` : "DISCONNECTED";
    }

    // 5. Sync Label Tombol Connect di Berbagai Tempat
    const btnConnect = document.getElementById("connectEsp");
    if (btnConnect) {
      btnConnect.textContent = connected ? `DISCONNECT ${transportName}` : "CONNECT ESP32";
    }

    const btnDevice = document.getElementById("deviceConnect");
    if (btnDevice) {
      btnDevice.textContent = connected ? "DISCONNECT" : "CONNECT HARDWARE";
    }

    const btnBluetooth = document.getElementById("btnBluetoothConnect") || document.getElementById("connectBluetooth");
    if (btnBluetooth) {
      const isBt = connected && transportName === "BLUETOOTH";
      btnBluetooth.textContent = isBt ? "BLUETOOTH CONNECTED" : "CONNECT BLUETOOTH";
      btnBluetooth.classList.toggle("on", isBt);
      btnBluetooth.classList.toggle("active", isBt);
    }

    // 6. Teks Footer Sync
    const footerConn = document.getElementById("footerConnection");
    if (footerConn) {
      footerConn.textContent = connected
        ? `● ${transportName} BRIDGE ONLINE`
        : `● ${transportName} BRIDGE OFFLINE`;
    }
  }

  window.refreshHeaderStatus = refresh;
  window.refreshSystemHeader = refresh;

  // Jalankan interval berkala untuk sinkronisasi tampilan
  setInterval(refresh, 500);

  // Hook event listener jika ada perubahan koneksi / penerimaan data
  document.addEventListener("mixer:esp32-rx", refresh);
  document.addEventListener("mixer:bluetooth-rx", refresh);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
})();
