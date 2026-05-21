const { spawn } = require("child_process");
const path = require("path");

class LEDController {
  constructor() {
    this._proc = null;
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
  }

  off() {
    this.setColor({ r: 0, g: 0, b: 0, w: 0 });
  }
}

module.exports = new LEDController();
