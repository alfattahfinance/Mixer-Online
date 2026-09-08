/* ==========================================================================
   WEB BLUETOOTH CONTROLLER FOR MIXER-ONLINE (OPTIMIZED PRO EDITION)
   ========================================================================== */
(function () {
  "use strict";

  let bluetoothDevice = null;
  let btWriteChar = null;
  let btNotifyChar = null;
  let rxBuffer = "";

  // UUID Service & Characteristic (HM-10 / CC2541 & Nordic UART Service untuk ESP32)
  const BLE_CONFIG = {
    HM_SERVICE: "0000ffe0-0000-1000-8000-00805f9b34fb",
    HM_CHAR: "0000ffe1-0000-1000-8000-00805f9b34fb",
    UART_SERVICE: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
    UART_RX: "6e400002-b5a3-f393-e0a9-e50e24dcca9e", // ESP32 write
    UART_TX: "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  // ESP32 notify
  };

  async function connectBluetoothMixer() {
    if (!navigator.bluetooth) {
      alert("Browser tidak mendukung Web Bluetooth API. Gunakan Chrome, Edge, atau Browser Android yang mendukung.");
      return { ok: false, reason: "web-bluetooth-unsupported" };
    }

    try {
      console.log("[BT] Membuka dialog pemindaian Bluetooth...");
      
      bluetoothDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [BLE_CONFIG.HM_SERVICE, BLE_CONFIG.UART_SERVICE]
      });

      console.log("[BT] Menghubungkan ke:", bluetoothDevice.name || "Perangkat Bluetooth");
      
      bluetoothDevice.addEventListener('gattserverdisconnected', handleDisconnect);

      const server = await bluetoothDevice.gatt.connect();
      let service = null;

      // Cari Service HM-10 atau UART Service
      try {
        service = await server.getPrimaryService(BLE_CONFIG.HM_SERVICE);
      } catch (e) {
        try {
          service = await server.getPrimaryService(BLE_CONFIG.UART_SERVICE);
        } catch (err) {}
      }

      if (!service) {
        // Dynamic Fallback Search Service
        const services = await server.getPrimaryServices();
        if (services.length > 0) service = services[0];
      }

      if (!service) throw new Error("Service GATT Bluetooth tidak ditemukan.");

      // Cari Characteristic Write & Notify secara cerdas berdasarkan UUID & Properti
      const characteristics = await service.getCharacteristics();
      
      for (const char of characteristics) {
        const uuid = char.uuid.toLowerCase();
        
        // Prioritas pencocokan berdasarkan UUID yang dikenal atau propertinya
        if (uuid.includes("ffe1") || uuid.includes("6e400002") || char.properties.write || char.properties.writeWithoutResponse) {
          if (!btWriteChar || uuid.includes("ffe1") || uuid.includes("6e400002")) {
            btWriteChar = char;
          }
        }
        
        if (uuid.includes("ffe1") || uuid.includes("6e400003") || char.properties.notify) {
          if (!btNotifyChar || uuid.includes("ffe1") || uuid.includes("6e400003")) {
            btNotifyChar = char;
          }
        }
      }

      // Fallback mutlak jika pencarian spesifik gagal
      if (!btWriteChar) {
        btWriteChar = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
      }
      if (!btNotifyChar) {
        btNotifyChar = characteristics.find(c => c.properties.notify);
      }

      if (!btWriteChar) {
        throw new Error("Characteristic WRITE tidak ditemukan pada modul Bluetooth ini.");
      }

      console.log("[BT] Koneksi Bluetooth Berhasil!");

      // Dengarkan Data Masuk (Feedback)
      if (btNotifyChar) {
        try {
          await btNotifyChar.startNotifications();
          btNotifyChar.addEventListener('characteristicvaluechanged', handleIncomingData);
        } catch (notifErr) {
          console.warn("[BT Warning] Gagal mengaktifkan notifications:", notifErr);
        }
      }

      // Sync State Global Aplikasi
      if (!window.state) window.state = {};
      window.state.connected = true;
      window.state.bluetoothConnected = true;

      if (window.MixerAdapters && typeof window.MixerAdapters.connectBluetooth === "function") {
        await window.MixerAdapters.connectBluetooth();
      }

      if (typeof window.refreshHeaderStatus === "function") {
        window.refreshHeaderStatus();
      }

      updateUIState(true);
      return { ok: true, name: bluetoothDevice.name };

    } catch (err) {
      console.error("[BT Error]:", err);
      updateUIState(false);
      alert("Koneksi Bluetooth gagal: " + err.message);
      return { ok: false, reason: err.message };
    }
  }

  // Fungsi Kirim Perintah
  async function sendBluetoothCommand(payload) {
    if (!btWriteChar || !bluetoothDevice?.gatt?.connected) {
      console.warn("[BT] Bluetooth belum terhubung!");
      return { ok: false, reason: "disconnected" };
    }

    try {
      const jsonString = typeof payload === "string" ? payload + "\n" : JSON.stringify(payload) + "\n";
      const encoder = new TextEncoder();
      const data = encoder.encode(jsonString);

      if (btWriteChar.writeValueWithoutResponse) {
        await btWriteChar.writeValueWithoutResponse(data);
      } else {
        await btWriteChar.writeValue(data);
      }

      return { ok: true };
    } catch (err) {
      console.error("[BT Tx Error]:", err);
      return { ok: false, reason: err.message };
    }
  }

  // Menerima Data Chunks & Buffer Parsing
  function handleIncomingData(event) {
    const value = event.target.value;
    const decoder = new TextDecoder();
    const chunk = decoder.decode(value);
    
    rxBuffer += chunk;
    const lines = rxBuffer.split(/\r?\n/);
    rxBuffer = lines.pop() || ""; // Simpan sisa string potongan terakhir

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line.trim());
        console.log("[BT Rx Received]:", data);

        // Pancarkan Event ke Aplikasi
        document.dispatchEvent(new CustomEvent("mixer:bluetooth-rx", { detail: data }));
      } catch (e) {
        console.log("[BT Raw Text]:", line);
      }
    }
  }

  // Handling Disconnect
  function handleDisconnect() {
    console.warn("[BT] Disconnected dari Perangkat.");
    btWriteChar = null;
    btNotifyChar = null;
    rxBuffer = "";

    if (window.state) {
      window.state.connected = false;
      window.state.bluetoothConnected = false;
    }

    if (typeof window.refreshHeaderStatus === "function") {
      window.refreshHeaderStatus();
    }

    updateUIState(false);
  }

  function disconnectBluetooth() {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
      bluetoothDevice.gatt.disconnect();
    }
    handleDisconnect();
  }

  // Sync UI Status Bluetooth
  function updateUIState(isConnected) {
    const btn = document.getElementById("connectBluetooth") || document.getElementById("btnBluetoothConnect");
    if (btn) {
      btn.textContent = isConnected ? "BLUETOOTH CONNECTED" : "CONNECT BLUETOOTH";
      btn.classList.toggle("on", isConnected);
      btn.classList.toggle("active", isConnected);
    }

    const statusElem = document.getElementById("headerBridgeStatus") || document.getElementById("status");
    if (statusElem && isConnected) {
      statusElem.textContent = "BLUETOOTH ONLINE";
    }
  }

  // Ekspor API
  window.MixerBluetooth = {
    connect: connectBluetoothMixer,
    disconnect: disconnectBluetooth,
    send: sendBluetoothCommand,
    isConnected: () => !!(bluetoothDevice && bluetoothDevice.gatt.connected)
  };

  // Auto-bind Event Listener
  document.addEventListener("DOMContentLoaded", () => {
    const btButtons = document.querySelectorAll("#connectBluetooth, #btnBluetoothConnect");
    btButtons.forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (window.MixerBluetooth.isConnected()) {
          disconnectBluetooth();
        } else {
          await connectBluetoothMixer();
        }
      });
    });
  });

})();
