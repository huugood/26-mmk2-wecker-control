const fs = require("fs");
const path = require("path");
const { BACKLIGHT_MAX } = require("./config");

const BACKLIGHT_ROOT = "/sys/class/backlight";

function _discover() {
  try {
    const entries = fs.readdirSync(BACKLIGHT_ROOT);
    if (entries.length === 0) return null;
    const dir = path.join(BACKLIGHT_ROOT, entries[0]);
    console.log(`[Screen] Using backlight: ${dir}`);
    return {
      brightness: path.join(dir, "brightness"),
      power:      path.join(dir, "bl_power"),
      maxFile:    path.join(dir, "max_brightness"),
    };
  } catch {
    console.warn("[Screen] /sys/class/backlight not found — screen control unavailable");
    return null;
  }
}

const bl = _discover();

// Read the display's own max_brightness so we scale correctly
let maxBrightness = BACKLIGHT_MAX;
if (bl) {
  try {
    maxBrightness = parseInt(fs.readFileSync(bl.maxFile, "utf8").trim(), 10);
    console.log(`[Screen] max_brightness = ${maxBrightness}`);
  } catch {
    // keep the config default
  }
}

let _currentBrightness = 128;
let _fadeTimer = null;

function _write(filePath, value) {
  if (!bl) return;
  fs.writeFile(filePath, String(value), (err) => {
    if (err) console.warn(`[Screen] Write to ${filePath} failed:`, err.message);
  });
}

function setBrightness(value) {
  // value arrives as 0–255 from the API; scale to the display's actual range
  const scaled = Math.round((value / 255) * maxBrightness);
  const clamped = Math.max(0, Math.min(maxBrightness, scaled));
  _currentBrightness = value;
  _write(bl.brightness, clamped);
}

function fadeBrightness(target, durationMs = 1000) {
  clearInterval(_fadeTimer);
  const TICK = 30;
  const steps = Math.max(1, Math.round(durationMs / TICK));
  let step = 0;
  const from = _currentBrightness;

  _fadeTimer = setInterval(() => {
    step++;
    const t = step / steps;
    const cur = Math.round(from + (target - from) * t);
    setBrightness(cur);
    if (step >= steps) clearInterval(_fadeTimer);
  }, TICK);
}

// bl_power is inverted: 0 = on, 1 = blanked
function setPower(on) {
  _write(bl.power, on ? "0" : "1");
}

module.exports = { setBrightness, fadeBrightness, setPower };
