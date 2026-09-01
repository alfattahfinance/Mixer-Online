#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

const char* ssid = "Wokwi-GUEST";
const char* password = "";
WebServer server(80);

void handleHealth(){ server.send(200,"application/json","{\"device\":\"ESP32-WOKWI\",\"status\":\"online\",\"channels\":18}"); }

void handleControl(){
  if(server.method()!=HTTP_POST){ server.send(405,"text/plain","POST only"); return; }
  Serial.println(server.arg("plain"));
  server.send(200,"application/json","{\"ok\":true,\"direction\":\"RX\",\"device\":\"ESP32-WOKWI\"}");
}

void setup(){
  Serial.begin(115200);
  WiFi.begin(ssid,password);
  while(WiFi.status()!=WL_CONNECTED) delay(100);
  server.on("/health",HTTP_GET,handleHealth);
  server.on("/control",HTTP_POST,handleControl);
  server.begin();
  Serial.println("ESP32 WOKWI READY");
}
void loop(){ server.handleClient(); }
