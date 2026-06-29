const { spawn } = require("child_process");
const path = require("path");

class LEDController {
  constructor() {
    this._proc = null;
    this._fadeTimer = null;
    this._current = { r: 0, g: 0, b: 0, w: 0, brightness: 0 };
    this._start();
  }

  _start() {
    const helperPath = path.join(__dirname, "led_helper.py");
    this._proc = spawn("python3", [helperPath]);
    this._proc.stderr.on("data", (d) =>
      console.warn("[LED]", d.toString().trim())
    );
    this._proc.on("exit", (code) => {
      console.warn(`[LED] led_helper.py exited (code ${code}), restarting in 3s`);
      this._proc = null;
      setTimeout(() => this._start(), 3000);
    });
  }

  setColor({ r = 0, g = 0, b = 0, w = 0, brightness } = {}) {
    if (!this._proc) return;
    const cmd = { r, g, b, w };
    if (brightness !== undefined) cmd.brightness = brightness;
    this._proc.stdin.write(JSON.stringify(cmd) + "\n");
    this._current = { r, g, b, w, brightness: brightness ?? this._current.brightness };
  }

  fadeTo({ r = 0, g = 0, b = 0, w = 0, brightness = 0 } = {}, durationMs = 1000) {
    clearInterval(this._fadeTimer);
    const TICK = 30;
    const steps = Math.max(1, Math.round(durationMs / TICK));
    let step = 0;
    const from = { ...this._current };
    const lerp = (a, b, t) => a + (b - a) * t;

    this._fadeTimer = setInterval(() => {
      step++;
      const t = step / steps;
      const cur = {
        r: Math.round(lerp(from.r, r, t)),
        g: Math.round(lerp(from.g, g, t)),
        b: Math.round(lerp(from.b, b, t)),
        w: Math.round(lerp(from.w, w, t)),
        brightness: lerp(from.brightness, brightness, t),
      };
      this.setColor(cur);
      if (step >= steps) clearInterval(this._fadeTimer);
    }, TICK);
  }

  off() {
    this.fadeTo({ r: 0, g: 0, b: 0, w: 0, brightness: 0 }, 500);
  }
}

module.exports = new LEDController();
