const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { PORT, HOST } = require("./config");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api", require("./routes/api")(io));

app.get("/api-docs", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "api-docs.html"));
});

// Serve dashboard for any other non-API route
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

require("./serialReader").start(io);

const audio = require("./audioPlayer");
audio.setIO(io);

const { state } = require("./state");
const led = require("./ledController");

io.on("connection", (socket) => {
  socket.on("set_led", (data) => {
    const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
    if (data.r !== undefined) state.led.r = clamp255(data.r);
    if (data.g !== undefined) state.led.g = clamp255(data.g);
    if (data.b !== undefined) state.led.b = clamp255(data.b);
    if (data.w !== undefined) state.led.w = clamp255(data.w);
    if (data.brightness !== undefined)
      state.led.brightness = Math.max(0, Math.min(1, parseFloat(data.brightness)));
    led.setColor(state.led);
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Wecker server running on http://${HOST}:${PORT}`);
});
