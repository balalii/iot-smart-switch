# ================== SmartSwitch ==================
# Gabungan semua bagian jadi satu alat:
#   RelayBank   -> 4 relay + interlock + pulse         (relays.py)
#   Buttons     -> tombol fisik opsional               (inputs.py)
#   StatusLed   -> LED status                          (inputs.py)
#   WifiManager -> konek & reconnect WiFi              (net.py)
#   CloudSync   -> lapor state, ambil perintah server  (net.py)
#   SetupPortal -> hotspot untuk isi WiFi/server/token (portal.py)
#
# Timer, jadwal, dan skenario semua dihitung server. ESP32 cuma nurut, plus:
# - nyimpan state & config di flash, biar setelah listrik padam kondisinya balik
# - tombol fisik tetap jalan walau internet putus
# - failsafe: opsional matikan semua kalau server lama nggak bisa dihubungi

import gc
import time

import machine

import storage
from inputs import Buttons, HoldButton, StatusLed
from net import CloudSync, WifiManager
from pins import (
    BUTTON_PINS,
    FW_VERSION,
    INTERLOCK_DEADTIME_MS,
    LED_PIN,
    RELAY_PINS,
    SETUP_HOLD_MS,
    SETUP_PIN,
)
from relays import RelayBank

# config bawaan sebelum pernah dapat config dari server
DEFAULT_CONFIG = {
    "cv": 0,
    "al": 1,  # relay active LOW
    "poll": 1000,  # ms antar sinkron
    "fs": "keep",  # failsafe: keep | off
    "fss": 60,  # detik tanpa server sebelum failsafe
    "il": [0, 0, 0, 0],  # grup interlock
    "bs": ["last", "last", "last", "last"],  # state saat boot
    "pl": [0, 0, 0, 0],  # durasi pulse (ms), 0 = saklar biasa
}

SETUP_TIMEOUT_MS = 300_000  # mode setup dari tombol BOOT otomatis tutup setelah 5 menit
STATE_SAVE_DELAY_MS = 2000  # tunda simpan state biar flash nggak cepat aus


class SmartSwitch:
    def __init__(self, settings):
        self.settings = settings
        self.config = DEFAULT_CONFIG.copy()
        self.config.update(storage.load("config.json", {}))

        self.relays = RelayBank(RELAY_PINS, bool(self.config["al"]), INTERLOCK_DEADTIME_MS)
        self.buttons = Buttons(BUTTON_PINS)
        self.setup_button = HoldButton(SETUP_PIN, SETUP_HOLD_MS)
        self.led = StatusLed(LED_PIN)
        self.wifi = WifiManager(settings["ssid"], settings["password"], "saklar-" + settings["id"])
        self.cloud = CloudSync(settings["server"], settings["id"], settings["token"])

        self.events = []  # tekanan tombol yang belum dilaporkan ke server
        self.boot_ms = time.ticks_ms()
        self.last_sync = time.ticks_ms()  # percobaan sinkron terakhir
        self.last_ok = None  # sinkron sukses terakhir
        self.failsafe_done = False
        self.save_at = None
        self.wdt = None

        self._apply_config()
        self._restore_state()

    # --- config & state di flash ---

    def _apply_config(self):
        c = self.config
        self.relays.set_active_low(bool(c["al"]))
        self.relays.interlock = list(c["il"])[: self.relays.count]
        self.relays.pulse_ms = list(c["pl"])[: self.relays.count]

    def _restore_state(self):
        saved = storage.load("state.json", {}).get("r", [0, 0, 0, 0])
        desired = []
        for i in range(self.relays.count):
            mode = self.config["bs"][i]
            if self.relays.pulse_ms[i]:
                on = False  # channel tekan-sesaat nggak pernah nyala sendiri pas boot
            elif mode == "on":
                on = True
            elif mode == "off":
                on = False
            else:
                on = bool(saved[i]) if i < len(saved) else False
            desired.append(on)
        self.relays.apply(desired)
        self.relays.changed = False
        print("State awal:", self.relays.as_list())

    def _maybe_save_state(self):
        if self.relays.changed:
            self.relays.changed = False
            self.save_at = time.ticks_add(time.ticks_ms(), STATE_SAVE_DELAY_MS)
        if self.save_at is not None and time.ticks_diff(time.ticks_ms(), self.save_at) >= 0:
            self.save_at = None
            storage.save("state.json", {"r": self.relays.as_list()})

    # --- input lokal ---

    def _handle_buttons(self):
        for i in self.buttons.take():
            if i >= self.relays.count:
                continue
            if self.relays.pulse_ms[i]:
                self.relays.pulse(i, self.relays.pulse_ms[i])
                on = True
            else:
                on = self.relays.toggle(i)
            print("Tombol CH%d ditekan" % (i + 1))
            self.events.append([i, 1 if on else 0])
        if len(self.events) > 20:
            self.events = self.events[-20:]

    # dipanggil sesering mungkin: pulse, tombol, LED, simpan state, watchdog
    def tick(self):
        if self.wdt:
            self.wdt.feed()
        self.relays.tick()
        self._handle_buttons()
        self.led.tick()
        self._maybe_save_state()
        if self.setup_button.held():
            print("Tombol BOOT ditahan, masuk mode setup")
            storage.save("setup.flag", {"reason": "button"})
            time.sleep_ms(300)
            machine.reset()

    # --- server ---

    def sync(self):
        sent = self.events[:]
        body = {
            "r": self.relays.as_list(),
            "cv": self.config["cv"],
            "rssi": self.wifi.rssi(),
            "up": time.ticks_diff(time.ticks_ms(), self.boot_ms) // 1000,
            "ip": self.wifi.ip(),
            "fw": FW_VERSION,
        }
        if sent:
            body["ev"] = sent

        reply = self.cloud.sync(body)
        if reply is None:
            self.led.set("error")
            return False

        self.led.set("online")
        self.last_ok = time.ticks_ms()
        self.failsafe_done = False
        self.events = self.events[len(sent) :]

        if "cfg" in reply:
            self.config.update(reply["cfg"])
            self.config["cv"] = reply.get("cv", 0)
            storage.save("config.json", self.config)
            self._apply_config()
            print("Config baru dari server, versi", self.config["cv"])

        for channel, ms in reply.get("p", []):
            if 0 <= channel < self.relays.count:
                self.relays.pulse(channel, ms)

        # channel yang tombolnya baru ditekan & belum terlapor, atau lagi pulse, jangan ditimpa
        busy = [e[0] for e in self.events]
        desired = []
        for i, value in enumerate(reply.get("r", [])[: self.relays.count]):
            if i in busy or self.relays.is_pulsing(i) or self.relays.pulse_ms[i]:
                desired.append(None)
            else:
                desired.append(bool(value))
        while len(desired) < self.relays.count:
            desired.append(None)
        self.relays.apply(desired)
        return True

    def _failsafe(self):
        if self.config["fs"] != "off" or self.failsafe_done:
            return
        since = self.last_ok if self.last_ok is not None else self.boot_ms
        if time.ticks_diff(time.ticks_ms(), since) > self.config["fss"] * 1000:
            print("Server tidak bisa dihubungi, failsafe: semua relay dimatikan")
            self.relays.all_off()
            self.failsafe_done = True

    # --- loop utama ---

    def run(self):
        self.led.set("connecting")
        self.wifi.connect(tick=self.tick)

        # watchdog: kalau program macet > 60 detik, ESP32 restart sendiri
        self.wdt = machine.WDT(timeout=60000)
        print("Smart Switch siap. ID:", self.settings["id"])

        while True:
            self.tick()
            self._failsafe()

            if not self.wifi.is_connected():
                # sengaja nggak otomatis masuk mode setup: kalau router cuma mati sebentar,
                # relay harus tetap jalan. Salah password WiFi? Tahan tombol BOOT 5 detik.
                self.led.set("connecting")
                self.wifi.connect(timeout_ms=15000, tick=self.tick)
                continue

            if time.ticks_diff(time.ticks_ms(), self.last_sync) >= self.config["poll"]:
                self.last_sync = time.ticks_ms()
                self.sync()
                gc.collect()
            else:
                time.sleep_ms(20)


def run():
    settings = storage.load("settings.json", {})
    complete = all(settings.get(k) for k in ("ssid", "server", "id", "token"))
    flag = storage.load("setup.flag", None)

    if not complete or flag is not None:
        from portal import SetupPortal

        # dibuka lewat tombol BOOT -> tutup sendiri setelah 5 menit biar nggak nyangkut
        timeout = SETUP_TIMEOUT_MS if complete else None
        storage.remove("setup.flag")
        SetupPortal(settings.get("id", ""), timeout_ms=timeout).run()
        return

    SmartSwitch(settings).run()
