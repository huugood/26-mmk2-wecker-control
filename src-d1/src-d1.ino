#include <Adafruit_TinyUSB.h>

int lastBedState = -1;
unsigned long lastHeartbeat = 0;

void setup() {
  Serial.begin(115200);
  pinMode(A2, INPUT_PULLUP);
}

void loop() {
  int bedNow = (digitalRead(A2) == LOW) ? 1 : 0;

  if (bedNow != lastBedState) {
    sendBedState(bedNow);
    lastBedState = bedNow;
  }

  if (millis() - lastHeartbeat >= 1000) {
    if (lastBedState >= 0) sendBedState(lastBedState);
    lastHeartbeat = millis();
  }

  delay(100);
}

void sendBedState(int bed) {
  Serial.print("{\"bed\":");
  Serial.print(bed);
  Serial.println("}");
}
