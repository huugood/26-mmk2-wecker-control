const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const { state, toJSON } = require("../state");
const led = require("../ledController");
const screen = require("../screenController");
const audio = require("../audioPlayer");
const { ALSA_CONTROL, ALARM_SOUND_PATH, PC_BACKEND_URL } = require("../config");
const http = require("http");

function _pushToPc(path, body) {
  if (!PC_BACKEND_URL) return;
  const data = JSON.stringify(body);
  const url = new URL(path, PC_BACKEND_URL);
  const req = http.request(
    { hostname: url.hostname, port: url.port || 80, path: url.pathname, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
    () => {}
  );
  req.on("error", (e) => console.warn("[PC push] Failed:", e.message));
  req.write(data);
  req.end();
}

// multer stores to memory so we can rename with a timestamp before saving
const upload = multer({ storage: multer.memoryStorage() });

module.exports = function apiRouter(io) {
  const router = express.Router();

  function emit() {
    io.emit("state_update", toJSON());
  }

  let _idleTimer = null;

  function _applyAlarmState(status) {
    clearTimeout(_idleTimer);
    if (status === "RINGING") {
      screen.fadeBrightness(255, 800);
      led.fadeTo({ r: 255, g: 60, b: 0, w: 0, brightness: 1.0 }, 800);
    } else if (status === "GUARD") {
      screen.fadeBrightness(60, 1500);
      led.fadeTo({ r: 180, g: 100, b: 0, w: 0, brightness: 0.3 }, 1500);
    } else {
      // IDLE or SNOOZED — dim after a short grace period
      _idleTimer = setTimeout(() => {
        screen.fadeBrightness(30, 2000);
        led.fadeTo({ r: 0, g: 0, b: 0, w: 0, brightness: 0 }, 2000);
      }, 10000);
    }
  }

  // GET /api/state
  router.get("/state", (_req, res) => {
    res.json(toJSON());
  });

  // POST /api/led  body: {r, g, b, w, brightness} — all optional
  router.post("/led", (req, res) => {
    const { r, g, b, w, brightness } = req.body ?? {};

    if (r !== undefined) state.led.r = Math.max(0, Math.min(255, Math.round(r)));
    if (g !== undefined) state.led.g = Math.max(0, Math.min(255, Math.round(g)));
    if (b !== undefined) state.led.b = Math.max(0, Math.min(255, Math.round(b)));
    if (w !== undefined) state.led.w = Math.max(0, Math.min(255, Math.round(w)));
    if (brightness !== undefined) {
      const br = parseFloat(brightness);
      if (isNaN(br) || br < 0 || br > 1)
        return res.status(400).json({ ok: false, error: "brightness must be 0.0–1.0" });
      state.led.brightness = br;
    }

    led.setColor(state.led);
    emit();
    res.json({ ok: true, led: { ...state.led } });
  });

  // POST /api/screen  body: {brightness, on}
  router.post("/screen", (req, res) => {
    const { brightness, on } = req.body ?? {};

    if (brightness !== undefined)
      state.screen.brightness = Math.max(0, Math.min(255, Math.round(brightness)));
    if (on !== undefined)
      state.screen.on = Boolean(on);

    screen.setBrightness(state.screen.brightness);
    screen.setPower(state.screen.on);
    emit();
    res.json({ ok: true, screen: { ...state.screen } });
  });

  // POST /api/audio/play  multipart: field "file"
  router.post("/audio/play", upload.single("file"), (req, res) => {
    if (!req.file)
      return res.status(400).json({ ok: false, error: "No file uploaded" });

    if (!audio.validateExt(req.file.originalname))
      return res.status(400).json({ ok: false, error: "Unsupported file type" });

    const destPath = audio.uploadPath(req.file.originalname);
    fs.writeFile(destPath, req.file.buffer, (err) => {
      if (err)
        return res.status(500).json({ ok: false, error: "Failed to save file" });
      audio.play(destPath);
      emit();
      res.json({ ok: true, filename: path.basename(destPath) });
    });
  });

  // POST /api/audio/stop
  router.post("/audio/stop", (_req, res) => {
    audio.stop();
    emit();
    res.json({ ok: true });
  });

  // POST /api/volume  body: {volume} — 0–100
  router.post("/volume", (req, res) => {
    const { volume } = req.body ?? {};
    const v = Math.max(0, Math.min(100, Math.round(Number(volume))));
    if (isNaN(v))
      return res.status(400).json({ ok: false, error: "volume must be 0–100" });

    state.volume = v;
    execFile("amixer", ["set", ALSA_CONTROL, `${v}%`], (err) => {
      if (err) console.warn("[Volume] amixer error:", err.message);
    });
    emit();
    res.json({ ok: true, volume: v });
  });

  // POST /api/audio/alarm/play  — play the configured alarm sound in a loop
  router.post("/audio/alarm/play", (_req, res) => {
    audio.playLooped(ALARM_SOUND_PATH);
    emit();
    res.json({ ok: true, path: ALARM_SOUND_PATH });
  });

  // POST /api/audio/alarm/stop  — stop looped alarm playback
  router.post("/audio/alarm/stop", (_req, res) => {
    audio.stop();
    emit();
    res.json({ ok: true });
  });

  // POST /api/sensor/data  body: {bed: 0|1}  — real hardware sensor data
  router.post("/sensor/data", (req, res) => {
    const { bed } = req.body ?? {};
    if (typeof bed !== "number")
      return res.status(400).json({ ok: false, error: "bed must be 0 or 1" });
    const occupied = bed === 1;
    const changed = occupied !== state.bedOccupied;
    state.bedOccupied = occupied;
    state.lastSensorTs = Date.now();
    emit();
    if (changed) _pushToPc("/api/alarm-session/pressure", { is_pressed: occupied });
    res.json({ ok: true, bedOccupied: occupied });
  });

  // POST /api/alarm/state  body: {status: "IDLE"|"RINGING"|"GUARD"|"SNOOZED"}
  router.post("/alarm/state", (req, res) => {
    const { status } = req.body ?? {};
    const valid = ["IDLE", "RINGING", "GUARD", "SNOOZED"];
    if (!valid.includes(status))
      return res.status(400).json({ ok: false, error: `status must be one of: ${valid.join(", ")}` });

    state.alarmStatus = status;
    _applyAlarmState(status);
    emit();
    res.json({ ok: true, status });
  });

  // POST /api/sensor/simulate  body: {enabled, value}
  router.post("/sensor/simulate", (req, res) => {
    const { enabled, value } = req.body ?? {};

    state.bedSimulated = Boolean(enabled);
    state.bedSimValue = Boolean(value);
    if (state.bedSimulated) {
      state.bedOccupied = state.bedSimValue;
      state.lastSensorTs = Date.now();
    }

    emit();
    res.json({
      ok: true,
      bedSimulated: state.bedSimulated,
      bedOccupied: state.bedOccupied,
    });
  });

  return router;
};
