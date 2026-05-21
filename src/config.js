module.exports = {
  SERIAL_PORT: "/dev/ttyACM0",
  SERIAL_BAUD: 115200,

  NUM_PIXELS: 15,
  LED_PIN: "D21",

  BACKLIGHT_BRIGHTNESS_PATH: "/sys/class/backlight/rpi_backlight/brightness",
  BACKLIGHT_POWER_PATH: "/sys/class/backlight/rpi_backlight/bl_power",
  BACKLIGHT_MAX: 255,

  UPLOAD_DIR: "uploads",
  ALLOWED_AUDIO_EXTS: [".wav", ".mp3", ".ogg", ".flac"],

  ALSA_CONTROL: "PCM",

  PORT: 5000,
  HOST: "0.0.0.0",
};
