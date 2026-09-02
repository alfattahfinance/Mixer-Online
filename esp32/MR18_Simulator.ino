// MR18 ESP32 simulator scaffold: 14 channels, JSON serial protocol.
// Receives CONTROL/MASTER packets and echoes them as feedback.
#include <ArduinoJson.h>
const uint8_t CHANNELS=14;
float fader[CHANNELS]; bool muteState[CHANNELS]; bool soloState[CHANNELS]; float master=75;
void setup(){ Serial.begin(115200); for(uint8_t i=0;i<CHANNELS;i++){fader[i]=75;muteState[i]=false;soloState[i]=false;} Serial.println("{\"type\":\"HELLO\",\"device\":\"MR18-ESP32-SIM\",\"channels\":14}"); }
void loop(){ if(!Serial.available()) return; String s=Serial.readStringUntil('\n'); StaticJsonDocument<512> d; if(deserializeJson(d,s)) return; const char* type=d["type"]|""; if(!strcmp(type,"MASTER")){ master=d["value"]|75.0; Serial.println(s); return; } if(strcmp(type,"CONTROL")) return; int ch=(d["ch"]|0)-1; if(ch<0||ch>=CHANNELS)return; const char* p=d["param"]|""; if(!strcmp(p,"fader"))fader[ch]=d["value"]|75.0; else if(!strcmp(p,"mute"))muteState[ch]=d["value"]|false; else if(!strcmp(p,"solo"))soloState[ch]=d["value"]|false; Serial.println(s); }