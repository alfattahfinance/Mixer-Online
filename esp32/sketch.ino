#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

// Konfigurasi Wi-Fi Akses Poin / Router
const char* ssid = "NAMA_WIFI_KAMU";
const char* password = "PASSWORD_WIFI_KAMU";

const uint8_t CHANNELS = 14;
float fader[CHANNELS];
bool muteState[CHANNELS];
bool soloState[CHANNELS];
float masterLevel = 75.0;

WebServer server(80);

void sendJson(JsonDocument& doc) {
  String out;
  serializeJson(doc, out);
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", out);
}

void sendAck(const char* id, bool ok, const char* error = nullptr) {
  JsonDocument doc;
  doc["protocol"] = "ESP32-MIXER/1";
  doc["type"] = "ACK";
  doc["ack"] = id ? id : "";
  doc["ok"] = ok;
  doc["ts"] = millis();
  doc["device"] = "ESP32-PHYSICAL";
  if (error) doc["error"] = error;
  sendJson(doc);
}

void handleCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.send(204);
}

void handleHealth() {
  JsonDocument doc;
  doc["protocol"] = "ESP32-MIXER/1";
  doc["device"] = "ESP32-PHYSICAL";
  doc["status"] = (WiFi.status() == WL_CONNECTED) ? "online" : "offline";
  doc["channels"] = CHANNELS;
  doc["ip"] = WiFi.localIP().toString();
  sendJson(doc);
}

void handleControl() {
  if (server.method() == HTTP_OPTIONS) { handleCORS(); return; }
  if (server.method() != HTTP_POST) { server.send(405, "text/plain", "POST only"); return; }

  JsonDocument in;
  DeserializationError err = deserializeJson(in, server.arg("plain"));
  if (err) { sendAck("", false, "invalid-json"); return; }

  const char* protocol = in["protocol"] | "";
  const char* id = in["id"] | "";
  const char* type = in["type"] | "";

  if (strcmp(protocol, "ESP32-MIXER/1") != 0) {
    sendAck(id, false, "unsupported-protocol");
    return;
  }

  if (strcmp(type, "CONTROL") == 0) {
    int ch = (in["ch"] | 0) - 1;
    const char* param = in["param"] | "";

    if (ch < 0 || ch >= CHANNELS || strlen(param) == 0) {
      sendAck(id, false, "invalid-channel-or-param");
      return;
    }

    if (strcmp(param, "fader") == 0) fader[ch] = in["value"] | 75.0f;
    else if (strcmp(param, "mute") == 0) muteState[ch] = in["value"] | false;
    else if (strcmp(param, "solo") == 0) soloState[ch] = in["value"] | false;

    // Echo log ke Serial Monitor untuk debugging hardware
    Serial.printf("[RX-HTTP] CH %d %s -> %.1f\n", ch + 1, param, (float)(in["value"] | 0));

    sendAck(id, true);
    return;
  }

  if (strcmp(type, "MASTER") == 0) {
    masterLevel = in["value"] | 75.0f;
    Serial.printf("[RX-HTTP] MASTER -> %.1f\n", masterLevel);
    sendAck(id, true);
    return;
  }

  sendAck(id, false, "unsupported-type");
}

void processSerialInput() {
  if (!Serial.available()) return;
  String s = Serial.readStringUntil('\n');
  s.trim();
  if (s.length() == 0) return;

  JsonDocument d;
  if (deserializeJson(d, s)) return;

  const char* type = d["type"] | "";
  if (strcmp(type, "CONTROL") == 0) {
    int ch = (d["ch"] | 0) - 1;
    if (ch >= 0 && ch < CHANNELS) {
      const char* p = d["param"] | "";
      if (strcmp(p, "fader") == 0) fader[ch] = d["value"] | 75.0f;
      else if (strcmp(p, "mute") == 0) muteState[ch] = d["value"] | false;
      else if (strcmp(p, "solo") == 0) soloState[ch] = d["value"] | false;
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Inisialisasi nilai awal 14 Channel
  for (uint8_t i = 0; i < CHANNELS; i++) {
    fader[i] = 75.0f;
    muteState[i] = false;
    soloState[i] = false;
  }

  WiFi.begin(ssid, password);
  uint8_t timeout = 0;
  while (WiFi.status() != WL_CONNECTED && timeout < 20) {
    delay(250);
    timeout++;
  }

  server.on("/health", HTTP_GET, handleHealth);
  server.on("/api/v1/health", HTTP_GET, handleHealth);
  server.on("/control", HTTP_POST, handleControl);
  server.on("/control", HTTP_OPTIONS, handleCORS);
  server.on("/api/v1/control", HTTP_POST, handleControl);
  server.on("/api/v1/control", HTTP_OPTIONS, handleCORS);

  server.begin();

  Serial.println("{\"type\":\"HELLO\",\"device\":\"ESP32-HARDWARE-READY\",\"channels\":14}");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  }
}

void loop() {
  server.handleClient();
  processSerialInput();
}
