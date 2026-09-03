#include "BluetoothSerial.h"
#include <ArduinoJson.h>

// Inisialisasi Bluetooth Serial (ESP32 Classic)
BluetoothSerial ESP_BT;

const uint8_t CHANNELS = 14;

// Variabel status lokal mixer fisik
float fader[CHANNELS];
bool muteState[CHANNELS];
bool soloState[CHANNELS];
float masterLevel = 75.0f;

void setup() {
  Serial.begin(115200);

  // Inisialisasi nilai default 14 channel
  for (uint8_t i = 0; i < CHANNELS; i++) {
    fader[i] = 75.0f;
    muteState[i] = false;
    soloState[i] = false;
  }

  // Nama perangkat yang akan muncul saat di-pairing dari HP/PC
  ESP_BT.begin("ESP32-Mixer-Bridge"); 
  Serial.println("Bluetooth Bridge Ready. Waiting for connection...");
}

void loop() {
  // Mengecek apakah ada data masuk dari koneksi Bluetooth
  if (ESP_BT.available()) {
    String incomingPacket = ESP_BT.readStringUntil('\n');
    incomingPacket.trim();
    
    if (incomingPacket.length() == 0) return;

    // Parsing JSON menggunakan ArduinoJson (Mendukung v6 & v7)
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, incomingPacket);
    
    if (err) {
      // Kirim balik respon error jika format JSON salah
      ESP_BT.println("{\"type\":\"ACK\",\"ok\":false,\"error\":\"invalid-json\"}");
      return;
    }

    const char* type = doc["type"] | "";
    const char* id = doc["id"] | "";

    // 1. Kontrol Channel (Fader, Mute, Solo, Gain)
    if (strcmp(type, "CONTROL") == 0) {
      int ch = (doc["ch"] | 0) - 1; // Konversi channel 1-14 ke index 0-13
      const char* param = doc["param"] | "";
      float val = doc["value"] | 0.0f;

      if (ch >= 0 && ch < CHANNELS && strlen(param) > 0) {
        if (strcmp(param, "fader") == 0) {
          fader[ch] = val;
          // TODO: Masukkan logika hardware (misal: PWM / Digital Potentiometer ke channel ch)
        } else if (strcmp(param, "mute") == 0) {
          muteState[ch] = doc["value"] | false;
        } else if (strcmp(param, "solo") == 0) {
          soloState[ch] = doc["value"] | false;
        }

        // Debugging di Serial Monitor komputer
        Serial.printf("[BT-RX] CH %d | %s -> %.1f\n", ch + 1, param, val);

        // Kirim ACK sukses kembali ke Web/Remote
        ESP_BT.printf("{\"type\":\"ACK\",\"ack\":\"%s\",\"ok\":true}\n", id);
      } else {
        ESP_BT.printf("{\"type\":\"ACK\",\"ack\":\"%s\",\"ok\":false,\"error\":\"invalid-channel\"}\n", id);
      }
      return;
    }

    // 2. Kontrol Master Output
    if (strcmp(type, "MASTER") == 0) {
      masterLevel = doc["value"] | 75.0f;
      Serial.printf("[BT-RX] MASTER -> %.1f\n", masterLevel);
      
      ESP_BT.printf("{\"type\":\"ACK\",\"ack\":\"%s\",\"ok\":true}\n", id);
      return;
    }
  }
}
