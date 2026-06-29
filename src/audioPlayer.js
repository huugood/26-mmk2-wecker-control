const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { state, toJSON } = require("./state");
const { UPLOAD_DIR, ALLOWED_AUDIO_EXTS } = require("./config");

class AudioPlayer {
  constructor() {
    this._proc = null;
    this._io = null;
    this._uploadDir = path.join(__dirname, UPLOAD_DIR);
    fs.mkdirSync(this._uploadDir, { recursive: true });
  }

  setIO(io) {
    this._io = io;
  }

  play(filepath) {
    this.stop();
    this._looping = false;
    this._spawn(filepath);
  }

  playLooped(filepath) {
    this.stop();
    this._looping = true;
    this._loopFile = filepath;
    this._spawn(filepath);
  }

  _spawn(filepath) {
    const ext = path.extname(filepath).toLowerCase();
    const [cmd, args] =
      ext === ".wav"
        ? ["aplay", [filepath]]
        : ["ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", filepath]];

    this._proc = spawn(cmd, args);

    this._proc.on("error", (err) => {
      console.error(`[Audio] spawn failed (${cmd}): ${err.message}`);
      this._proc = null;
      state.audio = { playing: false, filename: null, error: err.message };
      this._io?.emit("state_update", toJSON());
    });

    this._proc.stderr.on("data", (d) =>
      console.warn(`[Audio]`, d.toString().trim())
    );

    state.audio = { playing: true, filename: path.basename(filepath), error: null };

    this._proc.on("exit", () => {
      this._proc = null;
      if (this._looping && this._loopFile) {
        // Restart immediately for looped alarm playback
        this._spawn(this._loopFile);
      } else {
        state.audio = { playing: false, filename: null, error: null };
        this._io?.emit("state_update", toJSON());
      }
    });
  }

  stop() {
    this._looping = false;
    this._loopFile = null;
    if (this._proc) {
      this._proc.kill();
      this._proc = null;
      state.audio = { playing: false, filename: null, error: null };
    }
  }

  get isPlaying() {
    return this._proc !== null;
  }

  validateExt(filename) {
    return ALLOWED_AUDIO_EXTS.includes(
      path.extname(filename).toLowerCase()
    );
  }

  uploadPath(filename) {
    const ts = Date.now();
    const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    return path.join(this._uploadDir, `${ts}_${safe}`);
  }
}

module.exports = new AudioPlayer();
