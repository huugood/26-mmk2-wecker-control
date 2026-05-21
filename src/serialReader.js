const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const { SERIAL_PORT, SERIAL_BAUD } = require("./config");
const { state, toJSON } = require("./state");

function start(io) {
  function connect() {
    let port;
    try {
      port = new SerialPort({ path: SERIAL_PORT, baudRate: SERIAL_BAUD });
    } catch (err) {
      console.warn("[Serial] Could not open port:", err.message, "— retrying in 3s");
      setTimeout(connect, 3000);
      return;
    }

    const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

    parser.on("data", (line) => {
      try {
        const { bed } = JSON.parse(line);
        if (typeof bed !== "number") return;
        const occupied = bed === 1;
        if (state.bedSimulated) return;
        if (state.bedOccupied !== occupied) {
          state.bedOccupied = occupied;
          state.lastSensorTs = Date.now();
          io.emit("state_update", toJSON());
        }
      } catch {
        // ignore malformed lines
      }
    });

    port.on("error", (err) => {
      console.warn("[Serial] Error:", err.message, "— reconnecting in 3s");
      setTimeout(connect, 3000);
    });

    port.on("close", () => {
      console.warn("[Serial] Port closed — reconnecting in 3s");
      setTimeout(connect, 3000);
    });

    console.log(`[Serial] Listening on ${SERIAL_PORT} at ${SERIAL_BAUD} baud`);
  }

  connect();
}

module.exports = { start };
