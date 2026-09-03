// MR18 ESP32 simulator scaffold: 14 channels, JSON serial protocol.
// Compatible with ArduinoJson v6 & v7
#include <ArduinoJson.h>

const uint8_t CHANNELS = 14;
float fader[CHANNELS];
bool muteState[CHANNELS];
bool soloState[CHANNELS];
float master = 75.0;

void setup() {
  Serial.begin(115200);
  for (uint8_t i = 0; i < CHANNELS; i++) {
    fader[i] = 75.0;
    muteState[i] = false;
    soloState[i] = false;
  }
  Serial.println("{\"type\":\"HELLO\",\"device\":\"MR18-ESP32-SIM\",\"channels\":14}");
}

void loop() {
  if (!Serial.available()) return;
  String s = Serial.readStringUntil('\n');
  s.trim();
  if (s.length() == 0) return;

  JsonDocument d;
  DeserializationError err = deserializeJson(d, s);
  if (err) return;

  const char* type = d["type"] | "";
  
  if (strcmp(type, "MASTER") == 0) {
    master = d["value"] | 75.0f;
    Serial.println(s);
    return;
  }
  
  if (strcmp(type, "CONTROL") != 0) return;

  int ch = (d["ch"] | 0) - 1;
  if (ch < 0 || ch >= CHANNELS) return;

  const char* p = d["param"] | "";
  if (strcmp(p, "fader") == 0) fader[ch] = d["value"] | 75.0f;
  else if (strcmp(p, "mute") == 0) muteState[ch] = d["value"] | false;
  else if (strcmp(p, "solo") == 0) soloState[ch] = d["value"] | false;

  Serial.println(s);
}
