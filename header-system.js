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


/* ==========================================================
   EXTRACTED FROM index.html — POWER + SYSTEM / DEVICE TRANSPORT UI
   ========================================================== */
(function(){
  function install(){
    var p = document.getElementById("power");
    if(!p) return;
    if(!window.state) window.state = {system:false, connected:false, channels:[], sim:{online:false}};
    
    function paint(){
      var on = !!window.state.system;
      var adapter = window.MixerAdapters?.active;
      var espOnline = !!adapter?.connected && (adapter.type === "simulator" || adapter.transport === "esp32");
      
      window.state.connected = espOnline;
      window.state.sim = window.state.sim || {};
      window.state.sim.online = espOnline;
      p.textContent = on ? "SYSTEM ON" : "SYSTEM OFF";
      p.classList.toggle("on", on);
      var hs = document.getElementById("headerBridgeStatus");
      if(hs) hs.textContent = espOnline ? "BRIDGE READY" : (on ? "SYSTEM READY" : "BRIDGE STANDBY");
      var esp = document.getElementById("connectEsp");
      if(esp) {
        esp.textContent = espOnline ? "ESP32 CONNECTED" : "CONNECT ESP32";
        esp.classList.toggle("on", espOnline);
      }
    }

    var deviceConnect = document.getElementById("deviceConnect") || document.getElementById("connectEsp");
    var deviceDisconnect = document.getElementById("deviceDisconnect");
    var transportSelect = document.getElementById("transportSelect");

    function paintDevice(st){
      st = st || window.MixerAdapters?.status?.() || {};
      var online = !!st.connected;
      var espMode = st.transport === "esp32" || st.type === "simulator";
      var lamp = document.getElementById("deviceLamp");
      var ds = document.getElementById("deviceStatus");
      var dp = document.getElementById("deviceProtocol");
      var ts = document.getElementById("transportStatus");
      var bridge = document.getElementById("bridgeState");
      var bt = document.getElementById("bridgeTransport");
      var bp = document.getElementById("bridgeProtocol");
      var footer = document.getElementById("footerConnection");

      if (lamp) {
        lamp.classList.toggle("green", online);
        lamp.classList.toggle("red", !online);
      }
      if (ds) ds.textContent = online ? "🟢 ESP32 SIMULATOR ONLINE" : "🔴 ESP32 SIMULATOR OFFLINE";
      if (dp) dp.textContent = "Protocol: " + (st.protocol || "ESP32-MIXER/1");
      if (ts) ts.textContent = online ? "ESP32 BRIDGE ONLINE" : "OFFLINE";
      if (bridge) bridge.textContent = online ? "ONLINE" : "OFFLINE";
      if (bt) bt.textContent = online ? "TRANSPORT: ESP32 BRIDGE" : "TRANSPORT: —";
      if (bp) bp.textContent = "PROTOCOL: " + (st.protocol || "ESP32-MIXER/1");
      if (footer) footer.textContent = online ? "🟢 ESP32 SIMULATOR ONLINE" : "🔴 ESP32 SIMULATOR OFFLINE";
      if (deviceConnect) {
        deviceConnect.disabled = false;
        deviceConnect.textContent = online ? "ESP32 CONNECTED" : "CONNECT ESP32";
        deviceConnect.classList.toggle("on", online);
      }
      if (deviceDisconnect) deviceDisconnect.disabled = !online;
      if (transportSelect) transportSelect.value = espMode ? "esp32" : (st.transport === "bluetooth" ? "bluetooth" : "esp32");
    }

    if (deviceDisconnect) deviceDisconnect.addEventListener("click", function(e){
      e.preventDefault(); e.stopImmediatePropagation();
      window.MixerAdapters?.disconnect?.();
      paintDevice({connected:false,transport:"esp32",type:"simulator",protocol:"ESP32-MIXER/1"});
    });

    if (transportSelect) transportSelect.addEventListener("change", async function(){
      if (this.value === "esp32") paintDevice({connected:false,transport:"esp32",type:"simulator",protocol:"ESP32-MIXER/1"});
      else paintDevice({connected:false,transport:"bluetooth",type:"bluetooth",protocol:"ESP32-MIXER/1"});
    });

    window.MixerAdapters?.onStatus?.(paintDevice);
    paintDevice();

    var esp = document.getElementById("connectEsp");
    var bt = document.getElementById("connectBluetooth");

    function paintConnection(st){
      if(!window.state) window.state = {system:false, connected:false, channels:[], sim:{online:false}};
      var connected = !!st?.connected;
      var isEsp = connected && (st?.type === "simulator" || st?.transport === "esp32");
      window.state.connected = connected;
      window.state.sim = window.state.sim || {};
      window.state.sim.online = isEsp;
      var status = document.getElementById("status");
      var lamp = document.getElementById("statusLamp");
      var bridgeState = document.getElementById("bridgeState");
      var bridgeTransport = document.getElementById("bridgeTransport");
      var bridgeProtocol = document.getElementById("bridgeProtocol");
      var stats = window.MixerAdapters?.getTransportStats?.();

      if(status) status.textContent = connected ? "ONLINE" : "OFFLINE";
      if(lamp) lamp.classList.toggle("on", connected);
      if(esp){
        esp.textContent = isEsp ? "ESP32 CONNECTED" : "CONNECT ESP32";
        esp.classList.toggle("on", isEsp);
      }
      if(bridgeState) bridgeState.textContent = isEsp ? "ONLINE" : "OFFLINE";
      if(bridgeTransport) bridgeTransport.textContent = isEsp ? "TRANSPORT: ESP32" : "TRANSPORT: —";
      if(bridgeProtocol) bridgeProtocol.textContent = st?.protocol || "PROTOCOL: ESP32-MIXER/1";
      
      var tx=document.getElementById("bridgeTx"), rx=document.getElementById("bridgeRx"), ack=document.getElementById("bridgeAck");
      if(tx && stats) tx.textContent=stats.tx;
      if(rx && stats) rx.textContent=stats.rx;
      if(ack && stats) ack.textContent=stats.ack;

      var txPanel = document.getElementById("tx");
      var rxPanel = document.getElementById("rx");
      if (txPanel && st?.lastTx) txPanel.textContent = "TX: " + JSON.stringify(st.lastTx);
      if (rxPanel && st?.lastRx) rxPanel.textContent = "RX: " + JSON.stringify(st.lastRx);

      paint();
    }

    if(window.MixerAdapters?.onStatus) window.MixerAdapters.onStatus(paintConnection);

    if(esp) esp.addEventListener("click", async function(e){
      e.preventDefault();
      e.stopImmediatePropagation();

      var api = window.MixerAdapters;
      window.state = window.state || {system:false, connected:false, channels:[], sim:{online:false}};

      if(!window.state.system){
        paintConnection({connected:false,type:"simulator",transport:"esp32",protocol:"ESP32-MIXER/1",lastError:"SYSTEM_OFF"});
        return;
      }

      if(api?.active?.connected && (api.active.type === "simulator" || api.active.transport === "esp32")){
        api.disconnect();
        window.state.connected = false;
        window.state.sim.online = false;
        paintConnection({connected:false,type:"simulator",transport:"esp32",protocol:"ESP32-MIXER/1"});
        return;
      }

      esp.disabled = true;
      esp.textContent = "CONNECTING...";
      try {
        if(!api?.connectESP32) throw new Error("ESP32 adapter tidak tersedia");
        var control = window.MixerControl;
        if(!control?.connectESP32) throw new Error("MixerControl belum siap");
        
        var result = await control.connectESP32();
        if(!result?.ok || result.connected !== true) throw new Error(result?.reason || "ESP32 bridge gagal");

        const live = api.active?.connected ? api.active : result;
        window.state.connected = true;
        window.state.sim.online = true;
        paintConnection(live);
        paintDevice(live);
        paint();
      } catch(error) {
        window.state.connected = false;
        window.state.sim.online = false;
        paintConnection({connected:false,type:"simulator",transport:"esp32",protocol:"ESP32-MIXER/1",lastError:error?.message || String(error)});
        paintDevice({connected:false,type:"simulator",transport:"esp32",protocol:"ESP32-MIXER/1"});
      } finally {
        esp.disabled = false;
      }
    });

    if(bt) bt.addEventListener("click", async function(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      bt.disabled = true;
      try {
        const result = await window.MixerAdapters?.connectBluetooth?.();
        if(!result?.ok){
          var status = document.getElementById("status");
          if(status) status.textContent = "OFFLINE";
        }
      } finally {
        bt.disabled = false;
      }
    });

    p.addEventListener("click", function(){
      window.state.system = !window.state.system;

      if(!window.state.system && window.MixerAdapters?.active?.connected){
        window.MixerAdapters.disconnect();
        window.state.connected = false;
        window.state.sim = window.state.sim || {};
        window.state.sim.online = false;
      }
      paintConnection(window.MixerAdapters?.status?.() || {
        connected:false,type:"none",transport:"none",protocol:"none"
      });
      paintDevice(window.MixerAdapters?.status?.());
      paint();
    });
    paint();
  }

  if(document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
