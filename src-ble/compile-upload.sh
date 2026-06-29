#!/usr/bin/env bash
# Usage:
#   ./compile-upload.sh                 # upload to default port /dev/ttyACM0
#   ./compile-upload.sh /dev/ttyUSB1    # specify port explicitly
#
# On macOS the port will look like /dev/cu.usbmodemXXXX
# Find it with: ls /dev/cu.usbmodem*
#
# Required arduino-cli setup:
#   arduino-cli config add board_manager.additional_urls https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json
#   arduino-cli core update-index
#   arduino-cli core install Seeeduino:nrf52
#
# No extra BLE library needed — bluefruit.h ships with the Seeeduino:nrf52 core.
# (ArduinoBLE does NOT work on this board: it targets the mbed-based nRF52 core
# and fails to link against Adafruit's SoftDevice-based core used here.)

PORT="${1:-/dev/ttyACM0}"

# The Seeeduino:nrf52 core's UF2 post-build step shells out to "python" (not
# "python3"), which doesn't exist on current macOS. Shim it locally instead of
# touching any global PATH/symlinks.
SHIM_DIR="$(mktemp -d)"
ln -s "$(command -v python3)" "$SHIM_DIR/python"
trap 'rm -rf "$SHIM_DIR"' EXIT

PATH="$SHIM_DIR:$PATH" arduino-cli compile \
  --fqbn Seeeduino:nrf52:xiaonRF52840Sense \
  --upload \
  --port "$PORT" \
  "$(dirname "$0")"
