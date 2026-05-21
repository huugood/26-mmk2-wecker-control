import sys
import json

try:
    import board
    import neopixel

    pixels = neopixel.NeoPixel(
        board.D21, 15, brightness=0.5,
        pixel_order=neopixel.GRBW, auto_write=False
    )
    hw_available = True
except Exception as e:
    print(f"LED hardware unavailable: {e}", file=sys.stderr)
    hw_available = False

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        cmd = json.loads(line)
        if not hw_available:
            continue
        if "brightness" in cmd:
            pixels.brightness = max(0.0, min(1.0, float(cmd["brightness"])))
        r = max(0, min(255, int(cmd.get("r", 0))))
        g = max(0, min(255, int(cmd.get("g", 0))))
        b = max(0, min(255, int(cmd.get("b", 0))))
        w = max(0, min(255, int(cmd.get("w", 0))))
        pixels.fill((r, g, b, w))
        pixels.show()
    except Exception as e:
        print(f"LED command error: {e}", file=sys.stderr)
