const state = {
  bedOccupied: false,
  bedSimulated: false,
  bedSimValue: false,
  lastSensorTs: Date.now(),
  led: { r: 0, g: 0, b: 0, w: 0, brightness: 0.5 },
  screen: { brightness: 128, on: true },
  audio: { playing: false, filename: null, error: null },
  volume: 75,
  alarmStatus: "IDLE",
};

function toJSON() {
  return JSON.parse(JSON.stringify(state));
}

module.exports = { state, toJSON };
