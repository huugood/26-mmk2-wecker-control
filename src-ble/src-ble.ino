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
 *
 * BLE: uses Adafruit's bundled Bluefruit library (bluefruit.h), not ArduinoBLE.
 * The XIAO's Seeeduino:nrf52 board core is Adafruit's nRF52 core, which ships
 * its own SoftDevice-based BLE stack — ArduinoBLE expects the mbed-based nRF52
 * core (Nano 33 BLE) and fails to link (`undefined reference to HCITransport`)
 * on this board. bluefruit.h needs no extra library install.
 */

//#define CALIBRATION_MODE

#include <bluefruit.h>

// Tune this after reading calibration output
#define BED_THRESHOLD  100   // ADC counts (0–1023); raise if too sensitive

// 12345678-1234-1234-1234-123456789abc / ...abd, written byte-for-byte in the
// same order as the human-readable UUID string (Adafruit's convention).
uint8_t serviceUuid[16] = { 0x12, 0x34, 0x56, 0x78, 0x12, 0x34, 0x12, 0x34,
                             0x12, 0x34, 0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC };
uint8_t charUuid[16]    = { 0x12, 0x34, 0x56, 0x78, 0x12, 0x34, 0x12, 0x34,
                             0x12, 0x34, 0x12, 0x34, 0x56, 0x78, 0x9A, 0xBD };

#ifndef CALIBRATION_MODE
BLEService        bedService(serviceUuid);
BLECharacteristic bedChar(charUuid);
#endif

int  lastBedState    = -1;
unsigned long lastHeartbeat = 0;

void setup() {
  Serial.begin(115200);

#ifndef CALIBRATION_MODE
  // Wait briefly for serial on cold boot, then proceed without it
  for (int i = 0; i < 20 && !Serial; i++) delay(100);

  Bluefruit.begin();
  Bluefruit.setTxPower(4);
  Bluefruit.setName("Wecker-Sensor");

  bedService.begin();

  bedChar.setProperties(CHR_PROPS_READ | CHR_PROPS_NOTIFY);
  bedChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  bedChar.setFixedLen(1);
  bedChar.begin();
  uint8_t initVal = 0;
  bedChar.write(&initVal, 1);

  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();
  Bluefruit.Advertising.addService(bedService);
  Bluefruit.Advertising.addName();

  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.setInterval(32, 244); // in units of 0.625ms
  Bluefruit.Advertising.setFastTimeout(30);   // seconds in fast mode
  Bluefruit.Advertising.start(0);             // 0 = advertise forever
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
  bool changed = (bedNow != lastBedState);
  bool heartbeat = (millis() - lastHeartbeat >= 1000);

  if (changed || (heartbeat && lastBedState >= 0)) {
    uint8_t v = (uint8_t)bedNow;
    bedChar.write(&v, 1);
    bedChar.notify(&v, 1);
    lastBedState = bedNow;
    lastHeartbeat = millis();
  }

  delay(50);
#endif
}
