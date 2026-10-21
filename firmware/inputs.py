# ================== Buttons & StatusLed ==================

import time
from machine import Pin

DEBOUNCE_MS = 250


class Buttons:
    # Tombol fisik pakai interrupt, jadi tekanan tetap tercatat walau ESP32
    # lagi sibuk nunggu jawaban server. Handler-nya cuma nyatet, eksekusinya di loop.

    def __init__(self, pins):
        self.pressed = []
        self.last = {}
        self.pins = []
        for index, number in enumerate(pins or ()):
            if number is None:
                continue
            pin = Pin(number, Pin.IN, Pin.PULL_UP)
            pin.irq(trigger=Pin.IRQ_FALLING, handler=self._make_handler(index))
            self.pins.append(pin)

    def _make_handler(self, index):
        def handler(pin):
            now = time.ticks_ms()
            if time.ticks_diff(now, self.last.get(index, now - DEBOUNCE_MS - 1)) > DEBOUNCE_MS:
                self.last[index] = now
                if len(self.pressed) < 10:
                    self.pressed.append(index)

        return handler

    def take(self):
        if not self.pressed:
            return []
        pressed, self.pressed = self.pressed, []
        return pressed


class HoldButton:
    # tombol BOOT: tahan lama = masuk mode setup
    def __init__(self, number, hold_ms):
        self.pin = Pin(number, Pin.IN, Pin.PULL_UP)
        self.hold_ms = hold_ms
        self.since = None

    def held(self):
        if self.pin.value() == 0:
            if self.since is None:
                self.since = time.ticks_ms()
            return time.ticks_diff(time.ticks_ms(), self.since) >= self.hold_ms
        self.since = None
        return False


class StatusLed:
    # pola kedip:
    #   setup      = kedip cepat terus
    #   connecting = kedip pelan
    #   online     = kedip singkat tiap 3 detik
    #   error      = kedip 2x tiap 2 detik (WiFi ada, server nggak jawab)
    PATTERNS = {
        "setup": (100, 100),
        "connecting": (500, 500),
        "online": (40, 2960),
        "error": (80, 150, 80, 1690),
    }

    def __init__(self, number):
        self.pin = Pin(number, Pin.OUT) if number is not None else None
        self.mode = "connecting"
        self.start = time.ticks_ms()

    def set(self, mode):
        if mode != self.mode:
            self.mode = mode
            self.start = time.ticks_ms()

    def tick(self):
        if self.pin is None:
            return
        pattern = self.PATTERNS[self.mode]
        t = time.ticks_diff(time.ticks_ms(), self.start) % sum(pattern)
        on = True
        for step in pattern:
            if t < step:
                break
            t -= step
            on = not on
        self.pin.value(1 if on else 0)
