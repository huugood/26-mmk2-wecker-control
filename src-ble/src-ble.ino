/*
 * Wecker — XIAO nRF52840 firmware
 *
 * SEN-09673 (Interlink 406 FSR) wiring:
 *   3.3V ── FSR ── A2 (ADC)
 *
 * No external resistor needed — INPUT_PULLDOWN uses the internal ~11kΩ pull-down.
 * If you do have a 10kΩ handy, use INPUT instead and wire: FSR ──┬── A2, 10kΩ → GND.
 *
 * CALIBRATION_MODE: prints {"adc":NNN,"bed":X} every 100 ms over USB serial
 *   so you can find your threshold on a Mac with the Serial Monitor or:
 *     screen /dev/cu.usbmodemXXXX 115200
 *   Comment out the #define below to build the BLE-only production binary.
 */

#define CALIBRATION_MODE

#include <ArduinoBLE.h>
#include <Adafruit_TinyUSB.h>

// Tune this after reading calibration output
#define BED_THRESHOLD  100   // ADC counts (0–1023); raise if too sensitive

#define SERVICE_UUID        "12345678-1234-1234-1234-123456789abc"
#define CHAR_UUID           "12345678-1234-1234-1234-123456789abd"

BLEService bedService(SERVICE_UUID);
BLEByteCharacteristic bedChar(CHAR_UUID, BLERead | BLENotify);

int  lastBedState    = -1;
unsigned long lastHeartbeat = 0;

void setup() {
  Serial.begin(115200);

#ifndef CALIBRATION_MODE
  // Wait briefly for serial on cold boot, then proceed without it
  for (int i = 0; i < 20 && !Serial; i++) delay(100);

  if (!BLE.begin()) {
    // BLE init failed — blink the LED to signal error and halt
    pinMode(LED_BUILTIN, OUTPUT);
    while (true) { digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN)); delay(200); }
  }

  BLE.setLocalName("Wecker-Sensor");
  BLE.setAdvertisedService(bedService);
  bedService.addCharacteristic(bedChar);
  BLE.addService(bedService);
  bedChar.writeValue(0);
  BLE.advertise();
#endif

  analogReadResolution(10);  // 0–1023
  pinMode(A2, INPUT_PULLDOWN);  // internal ~11kΩ pull-down replaces external resistor
}

void loop() {
  int adc = analogRead(A2);
  int bedNow = (adc > BED_THRESHOLD) ? 1 : 0;

#ifdef CALIBRATION_MODE
  // Print raw ADC value so you can tune BED_THRESHOLD on a Mac
  Serial.print("{\"adc\":");
  Serial.print(adc);
  Serial.print(",\"bed\":");
  Serial.print(bedNow);
  Serial.println("}");
  delay(100);

#else
  // --- BLE production mode ---
  BLE.poll();

  bool changed = (bedNow != lastBedState);
  bool heartbeat = (millis() - lastHeartbeat >= 1000);

  if (changed || (heartbeat && lastBedState >= 0)) {
    bedChar.writeValue((uint8_t)bedNow);
    lastBedState = bedNow;
    lastHeartbeat = millis();
  }

  delay(50);
#endif
}
