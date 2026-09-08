/* Header status display for Physical ESP32 Bridge */
(function () {
  "use strict";

  function refresh() {
    const st = window.state || {};
    const system = !!st.system;
    const connected = !!st.connected;

    // Indikator Tombol Power utama
    const power = document.getElementById("power");
    if (power) {
      power.textContent = system ? "SYSTEM ON" : "SYSTEM OFF";
      power.classList.toggle("on", system);
    }

    // Status Koneksi Hardware ESP32
    const hs = document.getElementById("headerBridgeStatus");
    if (hs) {
      hs.textContent = connected
        ? "ESP32 ONLINE"
        : system
        ? "WAITING HARDWARE"
        : "OFFLINE";
    }

    // Pengaturan Panel Opsional
    const setup = document.getElementById("setupSystem");
    if (setup) setup.textContent = system ? "ON" : "OFF";

    const transport = document.getElementById("setupTransport");
    if (transport) transport.textContent = connected ? "HTTP/SERIAL ONLINE" : "DISCONNECTED";
  }

  window.refreshHeaderStatus = refresh;
  window.refreshSystemHeader = refresh;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
})();
