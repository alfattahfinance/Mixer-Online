/* ==========================================================================
   WEB BLUETOOTH CONTROLLER FOR MIXER-ONLINE
   ========================================================================== */
(function () {
  "use strict";

  let bluetoothDevice = null;
  let btCharacteristic = null;

  // UUID standar untuk modul Serial Bluetooth (seperti HC-05 atau ESP32 SPP Service)
  const SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb";
  const CHARACTERISTIC_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb";

  async function connectBluetoothMixer() {
    try {
      console.log("Mencari perangkat Bluetooth...");
      
      // Membuka dialog pemindaian Bluetooth di browser (Chrome/Edge)
      bluetoothDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SERVICE_UUID]
      });

      console.log("Menghubungkan ke:", bluetoothDevice.name);
      const server = await bluetoothDevice.gatt.connect();
      
      const service = await server.getPrimaryService(SERVICE_UUID);
      btCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

      console.log("Koneksi Bluetooth Berhasil!");

      // Update state global aplikasi web
      if (!window.state) window.state = {};
      window.state.connected = true;
      
      if (typeof window.refreshHeaderStatus === "function") {
        window.refreshHeaderStatus();
      }

      // Mendengarkan data masuk dari ESP32 (jika ada feedback)
      await btCharacteristic.startNotifications();
      btCharacteristic.addEventListener('characteristicvaluechanged', handleIncomingData);

    } catch (err) {
      console.error("Gagal terhubung via Bluetooth:", err);
      alert("Koneksi Bluetooth gagal: " + err.message);
    }
  }

  // Fungsi untuk mengirim perintah kontrol ke hardware via Bluetooth
  async function sendBluetoothCommand(payload) {
    if (!btCharacteristic) {
      console.warn("Bluetooth belum terhubung!");
      return;
    }

    try {
      const jsonString = JSON.stringify(payload) + "\n";
      const encoder = new TextEncoder();
      await btCharacteristic.writeValue(encoder.encode(jsonString));
    } catch (err) {
      console.error("Gagal mengirim data Bluetooth:", err);
    }
  }

  // Menerima data umpan balik (feedback/ACK) dari hardware
  function handleIncomingData(event) {
    const value = event.target.value;
    const decoder = new TextDecoder();
    const rxString = decoder.decode(value);
    
    try {
      const data = JSON.parse(rxString.trim());
      console.log("[BT-ACK Received]:", data);
    } catch (e) {
      // Mengabaikan baris teks mentah non-json
    }
  }

  // Ekspor fungsi agar bisa dipicu dari tombol di UI web
  window.MixerBluetooth = {
    connect: connectBluetoothMixer,
    send: sendBluetoothCommand
  };

  // Auto-bind ke tombol dengan ID #btnBluetoothConnect jika ada di HTML
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btnBluetoothConnect");
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        connectBluetoothMixer();
      });
    }
  });

})();
