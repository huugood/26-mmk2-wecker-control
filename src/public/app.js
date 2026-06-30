import { createApp, ref, reactive, computed, onMounted } from "/vendor/vue.esm-browser.min.js";

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Fires immediately, then at most once per `ms`, with a trailing call on release
function throttle(fn, ms) {
  let last = 0, timer;
  return (...args) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    clearTimeout(timer);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      timer = setTimeout(() => { last = Date.now(); fn(...args); }, remaining);
    }
  };
}

createApp({
  setup() {
    const connected = ref(false);
    const state = reactive({
      bedOccupied: false,
      bedSimulated: false,
      lastSensorTs: 0,
      led: { r: 0, g: 0, b: 0, w: 0, brightness: 0.5 },
      screen: { brightness: 128, on: true },
      audio: { playing: false, filename: null, error: null },
      volume: 75,
    });

    const led = reactive({ r: 0, g: 0, b: 0, w: 0 });
    const ledBrightnessPct = ref(50);
    const ledHex = ref("#000000");
    const screen = reactive({ brightness: 128, on: true });
    const simEnabled = ref(false);
    const audioFile = ref(null);
    const volume = ref(75);

    const bedOccupied = computed(() => state.bedOccupied);
    const lastSensorTime = computed(() => {
      if (!state.lastSensorTs) return "—";
      return new Date(state.lastSensorTs).toLocaleTimeString();
    });

    function applyState(data) {
      Object.assign(state, data);
      Object.assign(led, data.led);
      ledBrightnessPct.value = Math.round((data.led?.brightness ?? 0.5) * 100);
      rgbToHex();
      if (data.screen) Object.assign(screen, data.screen);
      simEnabled.value = data.bedSimulated ?? false;
      if (data.volume !== undefined) volume.value = data.volume;
    }

    function rgbToHex() {
      const toHex = (v) => Math.max(0, Math.min(255, Math.round(v)))
        .toString(16).padStart(2, "0");
      ledHex.value = `#${toHex(led.r)}${toHex(led.g)}${toHex(led.b)}`;
    }
    function hexToRgb() {
      const hex = ledHex.value.replace("#", "");
      led.r = parseInt(hex.slice(0, 2), 16);
      led.g = parseInt(hex.slice(2, 4), 16);
      led.b = parseInt(hex.slice(4, 6), 16);
    }

    // Color picker input: decompose hex → RGB, then send
    function onColorPick() {
      hexToRgb();
      debouncedApplyLed();
    }
    // RGB slider input: recompose hex, then send
    function onRgbSlider() {
      rgbToHex();
      debouncedApplyLed();
    }

    async function post(url, body) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    }

    function sendLed() {
      socket.emit("set_led", {
        r: led.r, g: led.g, b: led.b, w: led.w,
        brightness: ledBrightnessPct.value / 100,
      });
    }
    const debouncedApplyLed = throttle(sendLed, 30);

    async function ledOff() {
      led.r = led.g = led.b = led.w = 0;
      ledBrightnessPct.value = 0;
      rgbToHex();
      await post("/api/led", { r: 0, g: 0, b: 0, w: 0, brightness: 0 });
    }

    async function applyScreen() {
      await post("/api/screen", { brightness: screen.brightness, on: screen.on });
    }

    async function applySimulate() {
      await post("/api/sensor/simulate", {
        enabled: simEnabled.value,
        value: state.bedOccupied,
      });
    }

    async function simulateBed(occupied) {
      await post("/api/sensor/simulate", { enabled: true, value: occupied });
    }

    async function applyVolume() {
      await post("/api/volume", { volume: volume.value });
    }
    const debouncedApplyVolume = debounce(applyVolume, 150);

    async function playAudio() {
      const file = audioFile.value?.files?.[0];
      if (!file) return alert("Select an audio file first.");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/audio/play", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) alert("Error: " + data.error);
    }

    async function stopAudio() {
      await fetch("/api/audio/stop", { method: "POST" });
    }

    const pcBackendUrl = ref("");
    const pcUrlSaved = ref(false);

    async function savePcUrl() {
      await post("/api/settings", { pc_backend_url: pcBackendUrl.value });
      pcUrlSaved.value = true;
      setTimeout(() => { pcUrlSaved.value = false; }, 2000);
    }

    const socket = window.io();
    socket.on("connect", () => { connected.value = true; });
    socket.on("disconnect", () => { connected.value = false; });
    socket.on("state_update", applyState);

    onMounted(async () => {
      const [stateRes, settingsRes] = await Promise.all([
        fetch("/api/state"),
        fetch("/api/settings"),
      ]);
      applyState(await stateRes.json());
      const settings = await settingsRes.json();
      pcBackendUrl.value = settings.pc_backend_url || "";
    });

    return {
      connected, state, led, ledBrightnessPct, ledHex, screen,
      simEnabled, audioFile, volume, bedOccupied, lastSensorTime,
      pcBackendUrl, pcUrlSaved,
      onColorPick, onRgbSlider, debouncedApplyLed,
      ledOff, applyScreen, applySimulate, simulateBed,
      debouncedApplyVolume, playAudio, stopAudio, savePcUrl,
    };
  },
}).mount("#app");
