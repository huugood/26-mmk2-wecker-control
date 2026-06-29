#!/usr/bin/env bash
# Usage:
#   ./compile-upload.sh                 # upload to default port /dev/ttyACM0
#   ./compile-upload.sh /dev/ttyUSB1    # specify port explicitly
#
# On macOS the port will look like /dev/cu.usbmodemXXXX
# Find it with: ls /dev/cu.usbmodem*
#
# Required arduino-cli setup:
#   arduino-cli core install Seeeduino:nrf52
#   arduino-cli lib install ArduinoBLE

PORT="${1:-/dev/ttyACM0}"

arduino-cli compile \
  --fqbn Seeeduino:nrf52:xiaonRF52840Sense \
  --upload \
  --port "$PORT" \
  "$(dirname "$0")"
