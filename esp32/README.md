# ESP32 Physical Mixer Bridge

## Protocol

**ESP32-MIXER/1**

### TX: Mixer-Online → ESP32

CONTROL:
`{"protocol":"ESP32-MIXER/1","id":"...","type":"CONTROL","ch":1,"param":"fader","value":30,"rev":1,"ts":0,"direction":"TX"}`

MASTER:
`{"protocol":"ESP32-MIXER/1","id":"...","type":"MASTER","value":75,"rev":2,"ts":0,"direction":"TX"}`

### RX: ESP32 → Mixer-Online

ACK:
`{"protocol":"ESP32-MIXER/1","type":"ACK","ack":"...","ok":true,"ts":0,"device":"ESP32"}`

FEEDBACK:
`{"protocol":"ESP32-MIXER/1","type":"FEEDBACK","ch":1,"param":"fader","value":30,"source":"hardware","ack":"...","rev":1,"ts":0,"device":"ESP32"}`

METER:
`{"protocol":"ESP32-MIXER/1","type":"METER","ch":1,"level":1.2,"ts":0,"device":"ESP32"}`

## Transport

Wi-Fi/HTTP is the initial physical-ESP32 transport. Bluetooth remains supported by Mixer-Online using the same JSON packet contract.

## Hardware safety

GPIO is **not** connected directly to the analog audio path. Final GPIO/ADC/DAC/digital-pot/VCA mapping must be selected after inspecting the mixer PCB and control voltages.

## Wokwi

The Wokwi files are retained as a future hardware-simulation option. The Mixer-Online internal ESP32 Simulator is the current protocol test target.