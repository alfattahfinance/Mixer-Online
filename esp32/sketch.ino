#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

/*
  Mixer-Online <-> ESP32 physical bridge
  Protocol: ESP32-MIXER/1

  WEB -> ESP32
  CONTROL: {protocol,id,type,ch,param,value,rev,ts,direction:"TX"}
  MASTER : {protocol,id,type,value,rev,ts,direction:"TX"}

  ESP32 -> WEB
  ACK:      {protocol,type:"ACK",ack,ok,ts,device}
  FEEDBACK: {protocol,type:"FEEDBACK",ch,param,value,source:"hardware",ack,rev,ts,device}
  METER:    {protocol,type:"METER",ch,level,ts,device}

  This firmware is the hardware blueprint. GPIO/interface mapping is
  intentionally not hard-coded until the analog mixer circuit is inspected.
*/

const char* ssid = "Wokwi-GUEST";
const char* password = "";

WebServer server(80);

void sendJson(JsonDocument& doc) {
  String out;
  serializeJson(doc, out);
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

void handleHealth() {
  JsonDocument doc;
  doc["protocol"] = "ESP32-MIXER/1";
  doc["device"] = "ESP32";
  doc["status"] = WiFi.status() == WL_CONNECTED ? "online" : "offline";
  doc["channels"] = 14;
  doc["ip"] = WiFi.localIP().toString();
  sendJson(doc);
}

void handleFeedback() {
  if (server.method() != HTTP_POST) {
    server.send(405, "text/plain", "POST only");
    return;
  }
  JsonDocument in;
  DeserializationError err = deserializeJson(in, server.arg("plain"));
  if (err) {
    sendAck("", false, "invalid-json");
    return;
  }
  const char* protocol = in["protocol"] | "";
  if (strcmp(protocol, "ESP32-MIXER/1") != 0) {
    sendAck(in["id"] | "", false, "unsupported-protocol");
    return;
  }
  const char* type = in["type"] | "";
  if (strcmp(type, "METER") != 0 && strcmp(type, "FEEDBACK") != 0 && strcmp(type, "LEVEL") != 0) {
    sendAck(in["id"] | "", false, "unsupported-feedback");
    return;
  }
  int ch = in["ch"] | 0;
  if (ch < 1 || ch > 14) {
    sendAck(in["id"] | "", false, "invalid-channel");
    return;
  }
  float level = in["level"] | (in["value"] | 0.0f);
  if (!isfinite(level) || level < 0.0f || level > 2.0f) {
    sendAck(in["id"] | "", false, "invalid-level");
    return;
  }
  // This endpoint is the physical-mixer -> ESP32 bridge ingress.
  // A hardware driver can post ADC/DSP measurements here; the same
  // ESP32-MIXER/1 packet can then be forwarded to the web transport.
  sendAck(in["id"] | "", true);
}

void handleControl() {
  if (server.method() != HTTP_POST) {
    server.send(405, "text/plain", "POST only");
    return;
  }

  JsonDocument in;
  DeserializationError err = deserializeJson(in, server.arg("plain"));
  if (err) {
    sendAck("", false, "invalid-json");
    return;
  }

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

    // TODO: apply the control to the physical mixer interface here.
    // Do NOT connect GPIO directly to an audio path.
    sendAck(id, true);

    // Hardware feedback will be generated after the mixer interface is known.
    return;
  }

  if (strcmp(type, "MASTER") == 0) {
    float value = in["value"] | 0.0f;

    if (value < 0.0f || value > 100.0f) {
      sendAck(id, false, "invalid-master");
      return;
    }

    // TODO: apply MASTER through the physical mixer interface.
    sendAck(id, true);
    return;
  }

  sendAck(id, false, "unsupported-type");
}

void setup() {
  Serial.begin(115200);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(100);
  }

  server.on("/health", HTTP_GET, handleHealth);
  server.on("/api/v1/health", HTTP_GET, handleHealth);
  server.on("/control", HTTP_POST, handleControl);
  server.on("/api/v1/control", HTTP_POST, handleControl);
  server.on("/feedback", HTTP_POST, handleFeedback);
  server.on("/api/v1/feedback", HTTP_POST, handleFeedback);

  server.begin();

  Serial.println("ESP32 MIXER PROTOCOL v1 READY");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  server.handleClient();
}