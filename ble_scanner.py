#!/usr/bin/env python3
"""
Pi-side BLE scanner for the XIAO nRF52840 bed-sensor.

Scans for the sensor by its service UUID, subscribes to notifications,
and forwards every update to the local wecker-control Node server via HTTP.

Run on the Pi alongside the Node server:
    pip install bleak requests
    python3 ble_scanner.py

The scanner reconnects automatically if the BLE connection drops.
"""

import asyncio
import logging
import sys

import requests
from bleak import BleakClient, BleakScanner

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [BLE] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

DEVICE_NAME  = "Wecker"          # prefix match — truncated to "Wecke" in some scans
SERVICE_UUID = "12345678-1234-1234-1234-123456789abc"
CHAR_UUID    = "12345678-1234-1234-1234-123456789abd"

CONTROL_API  = "http://localhost:5000/api/sensor/data"
RECONNECT_DELAY = 5  # seconds between reconnect attempts


def _post_bed_state(bed: int) -> None:
    try:
        requests.post(CONTROL_API, json={"bed": bed}, timeout=2)
    except Exception as exc:
        log.warning("Failed to POST sensor data: %s", exc)


def _on_notify(_handle: int, data: bytearray) -> None:
    bed = data[0] if data else 0
    log.info("bed=%d", bed)
    _post_bed_state(bed)


async def _run_once() -> None:
    log.info("Scanning for sensor (name prefix '%s')…", DEVICE_NAME)
    device = await BleakScanner.find_device_by_filter(
        lambda d, adv: (d.name or "").startswith(DEVICE_NAME),
        timeout=30.0,
    )
    if device is None:
        log.warning("Sensor not found within 30 s — retrying")
        return

    log.info("Found sensor: %s (%s)", device.name, device.address)
    async with BleakClient(device) as client:
        log.info("Connected")
        # Read current value immediately so the server has an initial state
        data = await client.read_gatt_char(CHAR_UUID)
        _post_bed_state(data[0] if data else 0)

        await client.start_notify(CHAR_UUID, _on_notify)
        log.info("Subscribed to notifications — waiting for events…")
        # Keep the connection alive until it drops
        while client.is_connected:
            await asyncio.sleep(1)

    log.info("Disconnected")


async def main() -> None:
    while True:
        try:
            await _run_once()
        except Exception as exc:
            log.error("Error: %s", exc)
        log.info("Reconnecting in %d s…", RECONNECT_DELAY)
        await asyncio.sleep(RECONNECT_DELAY)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
