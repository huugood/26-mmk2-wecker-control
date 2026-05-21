import board
import neopixel
import sys

NUM_PIXELS = 15
# Use a DMA-capable PWM pin — GPIO18 (pin 12) is the standard choice
pixels = neopixel.NeoPixel(
    board.D21,
    NUM_PIXELS,
    brightness=0.5,
    pixel_order=neopixel.GRBW  # Match your strip
)

def set_color(r, g, b, w=0):
    pixels.fill((r, g, b, w))

for line in sys.stdin:
    cmd = line.strip()
    if cmd == "R":
        set_color(255, 0, 0)
    elif cmd == "G":
        set_color(0, 255, 0)
    elif cmd == "B":
        set_color(0, 0, 255)
    elif cmd == "W":
        set_color(0, 0, 0, 255)
    else:
        set_color(0, 0, 0)
    