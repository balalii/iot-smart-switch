# ================== RelayBank ==================
# 4 relay jadi satu. Ngurus: modul active-LOW, interlock (channel yang nggak
# boleh nyala bareng), dan mode "tekan sesaat" (pulse) yang dihitung di sini
# biar durasinya presisi walau internet lemot.

import time
from machine import Pin


class RelayBank:
    def __init__(self, pins, active_low=True, deadtime_ms=300):
        self.pins = [Pin(p, Pin.OUT) for p in pins]
        self.count = len(pins)
        self.active_low = active_low
        self.deadtime_ms = deadtime_ms
        self.states = [False] * self.count
        self.interlock = [0] * self.count  # 0 = bebas, 1/2 = grup
        self.pulse_ms = [0] * self.count  # > 0 = channel ini mode tekan sesaat
        self.pulse_until = [None] * self.count
        self.changed = False  # ditandai biar app tahu kapan harus simpan ke flash

        # pastikan semua mati dulu pas boot, jangan sampai nyala sendiri
        for i in range(self.count):
            self._write(i, False)

    def _write(self, i, on):
        level = (0 if on else 1) if self.active_low else (1 if on else 0)
        self.pins[i].value(level)

    def set_active_low(self, active_low):
        if active_low == self.active_low:
            return
        self.active_low = active_low
        for i in range(self.count):
            self._write(i, self.states[i])

    def set(self, i, on):
        if self.states[i] == on:
            return
        self.states[i] = on
        self._write(i, on)
        self.changed = True
        print("CH%d -> %s" % (i + 1, "ON" if on else "OFF"))

    # matikan channel lain di grup interlock yang sama, balikin True kalau ada yang dimatikan
    def _release_group(self, i):
        group = self.interlock[i]
        released = False
        if group == 0:
            return False
        for j in range(self.count):
            if j != i and self.interlock[j] == group and self.states[j]:
                self.pulse_until[j] = None
                self.set(j, False)
                released = True
        return released

    def turn_on(self, i):
        if self._release_group(i):
            time.sleep_ms(self.deadtime_ms)  # kasih jeda biar motor nggak dihantam arah sebaliknya
        self.set(i, True)

    def toggle(self, i):
        if self.states[i]:
            self.set(i, False)
        else:
            self.turn_on(i)
        return self.states[i]

    def pulse(self, i, ms):
        self.turn_on(i)
        self.pulse_until[i] = time.ticks_add(time.ticks_ms(), ms)

    def is_pulsing(self, i):
        return self.pulse_until[i] is not None

    # dipanggil terus dari loop utama, buat mengakhiri pulse tepat waktu
    def tick(self):
        now = time.ticks_ms()
        for i in range(self.count):
            end = self.pulse_until[i]
            if end is not None and time.ticks_diff(now, end) >= 0:
                self.pulse_until[i] = None
                self.set(i, False)

    # terapkan state dari server. None = channel itu jangan disentuh.
    # urutannya: matikan dulu semua, baru nyalakan, biar interlock aman.
    def apply(self, desired):
        turned_off = False
        for i in range(self.count):
            if desired[i] is False and self.states[i]:
                self.set(i, False)
                turned_off = True
        for i in range(self.count):
            if desired[i] is True and not self.states[i]:
                if turned_off and self.interlock[i]:
                    time.sleep_ms(self.deadtime_ms)
                    turned_off = False
                self.turn_on(i)

    def all_off(self):
        for i in range(self.count):
            self.pulse_until[i] = None
            self.set(i, False)

    def as_list(self):
        return [1 if s else 0 for s in self.states]
