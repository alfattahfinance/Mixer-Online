/*
 Mixer Online ESP32 BLE bridge
 Protocol: one JSON object per line.
 Example RX: {"type":"mixer-control","channel":"CH 1","control":"fader","value":75}
 TX feedback: {"type":"mixer-feedback","channel":"CH 1","control":"fader","value":75}
 Uses the standard Nordic UART Service UUIDs expected by the web app.
 This bridge keeps control state; actual DAC/PWM/audio hardware mapping is
 intentionally isolated in applyControl().
*/
#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

static const char* SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
static const char* RX_UUID      = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
static const char* TX_UUID      = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

BLECharacteristic* txChar = nullptr;
String lineBuffer;
float faderState[17];
float gainState[17];
float panState[17];
bool muteState[17];
bool soloState[17];

int channelFrom(String s) {
  int p=s.indexOf("CH"); if(p<0) return 1;
  int n=s.substring(p+2).toInt();
  return constrain(n,1,16);
}
float numberField(const String& s,const char* key,float fallback=0) {
  String k=String(""")+key+""";
  int p=s.indexOf(k); if(p<0) return fallback;
  p=s.indexOf(':',p); if(p<0) return fallback;
  int e=s.indexOf(',',p); if(e<0) e=s.indexOf('}',p);
  if(e<0) return fallback;
  return s.substring(p+1,e).toFloat();
}
String stringField(const String& s,const char* key) {
  String k=String(""")+key+""";
  int p=s.indexOf(k); if(p<0) return "";
  p=s.indexOf(':',p); if(p<0) return "";
  int a=s.indexOf('"',p+1), b=s.indexOf('"',a+1);
  return (a>=0&&b>a)?s.substring(a+1,b):"";
}
void sendFeedback(int ch,const String& control,float value) {
  if(!txChar) return;
  String out="{"type":"mixer-feedback","channel":"CH "+String(ch)+"","control":""+control+"","value":"+String(value,3)+"}\n";
  txChar->setValue(out.c_str()); txChar->notify();
}
void applyControl(const String& json) {
  int ch=channelFrom(stringField(json,"channel"));
  String control=stringField(json,"control");
  float value=numberField(json,"value",0);
  if(control=="fader") faderState[ch]=constrain(value,0,100);
  else if(control=="gain") gainState[ch]=constrain(value,0,2);
  else if(control=="pan") panState[ch]=constrain(value,-1,1);
  else if(control=="mute") muteState[ch]=value>0;
  else if(control=="solo") soloState[ch]=value>0;
  else return;
  sendFeedback(ch,control,value);
  // Add physical mixer/DAC/PWM code here without changing BLE protocol.
}
class RxCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    std::string v=c->getValue();
    for(char ch:v) {
      if(ch=='\n' || ch=='\r') { if(lineBuffer.length()){applyControl(lineBuffer);lineBuffer="";} }
      else if(lineBuffer.length()<512) lineBuffer+=ch;
    }
  }
};
class ServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer*) override {}
  void onDisconnect(BLEServer*) override { BLEDevice::startAdvertising(); }
};
void setup() {
  Serial.begin(115200);
  for(int i=0;i<=16;i++){faderState[i]=0;gainState[i]=1;panState[i]=0;muteState[i]=false;soloState[i]=false;}
  BLEDevice::init("MIXER-ONLINE-ESP32");
  BLEServer* server=BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService* service=server->createService(SERVICE_UUID);
  txChar=service->createCharacteristic(TX_UUID,BLECharacteristic::PROPERTY_NOTIFY);
  txChar->addDescriptor(new BLE2902());
  BLECharacteristic* rx=service->createCharacteristic(RX_UUID,BLECharacteristic::PROPERTY_WRITE|BLECharacteristic::PROPERTY_WRITE_NR);
  rx->setCallbacks(new RxCallbacks());
  service->start();
  BLEAdvertising* adv=BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("MIXER-ONLINE ESP32 BLE READY");
}
void loop(){ delay(5); }