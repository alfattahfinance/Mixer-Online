#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

const char* ssid = "Wokwi-GUEST";
const char* password = "";

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
  doc["device"] = "ESP32";
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
  doc["device"] = "ESP32";
  doc["status"] = WiFi.status() == WL_CONNECTED ? "online" : "offline";
  doc["channels"] = 14;
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
    int ch = in["ch"] | 0;
    const char* param = in["param"] | "";
    if (ch < 1 || ch > 14 || strlen(param) == 0) {
      sendAck(id, false, "invalid-control");
      return;
    }
    sendAck(id, true);
    return;
  }

  if (strcmp(type, "MASTER") == 0) {
    float value = in["value"] | 0.0f;
    if (value < 0.0f || value > 100.0f) {
      sendAck(id, false, "invalid-master");
      return;
    }
    sendAck(id, true);
    return;
  }

  sendAck(id, false, "unsupported-type");
}

void setup() {
  Serial.begin(115200);

  WiFi.begin(ssid, password);
  uint8_t retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(200);
    retries++;
  }

  // Health
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/api/v1/health", HTTP_GET, handleHealth);

  // Control
  server.on("/control", HTTP_POST, handleControl);
  server.on("/control", HTTP_OPTIONS, handleCORS);
  server.on("/api/v1/control", HTTP_POST, handleControl);
  server.on("/api/v1/control", HTTP_OPTIONS, handleCORS);

  server.begin();
  Serial.println("ESP32 MIXER PROTOCOL v1 READY");
}

void loop() {
  server.handleClient();
}
