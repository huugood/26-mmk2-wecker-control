# Wecker

A smart alarm clock that detects whether you're still in bed via a pressure sensor, and only rings until you actually get up. Built around a Raspberry Pi and a Seeed Xiao nRF52840.

## Hardware

| Component | Role |
|-----------|------|
| Raspberry Pi | Web server, LED strip, display, audio output |
| Seeed Xiao nRF52840 | Sensor controller (pressure sensor / test switch) |
| WS2812B LED strip | 15 pixels, GRBW, connected to Pi GPIO D21 |
| Display | DSI or HDMI screen with backlight control |
| Speakers | 3.5mm audio out |

**Test setup:** a momentary switch between GND and A2/D2 on the Xiao stands in for the pressure sensor. Switch closed = person in bed.

**Communication:** USB serial (Xiao → Pi) now; wireless later.

---

## Software Stack

- **Backend:** Node.js + Express + Socket.IO
- **Frontend:** Vue 3 (CDN, no build step)
- **LED control:** Python subprocess (`led_helper.py`) using Adafruit CircuitPython neopixel
- **Serial:** `serialport` npm package

---

## Setup

### 1. Raspberry Pi — server

```bash
cd src
npm install
sudo node app.js
```

> Must run as root for neopixel DMA (GPIO) and backlight sysfs writes.

Access the dashboard at `http://<pi-ip>:5000` and the API docs at `http://<pi-ip>:5000/api-docs`.

**Python dependencies** (for LED strip):

```bash
pip install adafruit-blinka adafruit-circuitpython-neopixel rpi_ws281x
```

**Audio dependencies** (for non-WAV formats):

```bash
sudo apt install ffmpeg
```

### 2. Xiao nRF52840 — firmware

```bash
cd src-d1
./compile-upload.sh
```

Requires `arduino-cli` with the `Seeeduino:nrf52` platform installed.

---

## Configuration

All tuneable values are in [`src/config.js`](src/config.js):

| Key | Default | Description |
|-----|---------|-------------|
| `SERIAL_PORT` | `/dev/ttyACM0` | Serial port the Xiao is on |
| `SERIAL_BAUD` | `115200` | Baud rate |
| `NUM_PIXELS` | `15` | Number of LEDs on the strip |
| `BACKLIGHT_BRIGHTNESS_PATH` | `/sys/class/backlight/rpi_backlight/brightness` | Sysfs path for screen brightness |
| `BACKLIGHT_POWER_PATH` | `/sys/class/backlight/rpi_backlight/bl_power` | Sysfs path for screen power |
| `BACKLIGHT_MAX` | `255` | Maximum backlight value |
| `ALSA_CONTROL` | `PCM` | ALSA mixer control name (check with `amixer`) |
| `UPLOAD_DIR` | `uploads` | Directory for uploaded audio files |
| `PORT` | `5000` | HTTP server port |

---

## Project Structure

```
control/
├── src-d1/
│   ├── src-d1.ino          # Xiao firmware
│   └── compile-upload.sh   # Build + flash script
└── src/
    ├── app.js              # Entry point
    ├── config.js           # Configuration
    ├── state.js            # Shared application state
    ├── led_helper.py       # Python subprocess for neopixel
    ├── ledController.js    # Spawns led_helper.py, sends JSON commands
    ├── screenController.js # Writes to sysfs backlight paths
    ├── audioPlayer.js      # Spawns aplay/ffplay, manages uploads
    ├── serialReader.js     # Reads Xiao serial, updates bed state
    ├── routes/
    │   └── api.js          # All REST endpoints
    └── public/
        ├── index.html      # Dashboard (Vue 3)
        ├── app.js          # Dashboard logic
        ├── style.css       # Dashboard styles
        └── api-docs.html   # Interactive API docs (Swagger UI)
```

---

## API

Full interactive docs with try-it-out at `http://<pi-ip>:5000/api-docs`.

### Quick reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/state` | Full system state |
| `POST` | `/api/led` | Set LED color and brightness |
| `POST` | `/api/screen` | Set screen brightness / power |
| `POST` | `/api/audio/play` | Upload and play an audio file |
| `POST` | `/api/audio/stop` | Stop playback |
| `POST` | `/api/volume` | Set system volume (0–100) |
| `POST` | `/api/sensor/simulate` | Override bed sensor state for testing |

### Real-time updates

Connect to the Socket.IO server at `ws://<pi-ip>:5000`. The server emits `state_update` with the full state object whenever anything changes.

```js
const socket = io("http://<pi-ip>:5000");
socket.on("state_update", (state) => console.log(state));
```

---

## Sensor Protocol (Xiao → Pi)

The Xiao sends newline-delimited JSON over USB serial at 115200 baud:

```json
{"bed":1}   // person in bed (switch closed, pin LOW)
{"bed":0}   // no person (switch open, pin HIGH)
```

Messages are sent immediately on state change and as a heartbeat every 1 second.
