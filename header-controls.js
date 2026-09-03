/* Header status and system display controller */
(function () {
  "use strict";

  function refresh() {
    const st = window.state || {};
    const system = !!st.system;
    const connected = !!st.connected;

    // Power indicator
    const power = document.getElementById("power");
    if (power) {
      power.textContent = system ? "SYSTEM ON" : "SYSTEM OFF";
      power.classList.toggle("on", system);
    }

    // Bridge status text
    const hs = document.getElementById("headerBridgeStatus");
    if (hs) {
      hs.textContent = connected
        ? "BRIDGE ONLINE"
        : system
        ? "SYSTEM READY"
        : "BRIDGE STANDBY";
    }

    // Settings elements
    const setup = document.getElementById("setupSystem");
    if (setup) setup.textContent = system ? "ON" : "OFF";

    const transport = document.getElementById("setupTransport");
    if (transport) transport.textContent = connected ? "ONLINE" : "OFFLINE";
  }

  window.refreshHeaderStatus = refresh;
  window.refreshSystemHeader = refresh; // Backwards compatibility for old calls

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
})();
