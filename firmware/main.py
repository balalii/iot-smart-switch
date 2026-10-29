# ================== Smart Switch ESP32 (MicroPython) ==================
# Satu file saja. Cara kerjanya:
#   1. ESP32 nyambung ke WiFi yang ditulis di bawah
#   2. tiap detik lapor ke server & ambil perintah (POST /api/device/sync)
#   3. relay dikontrol dari HP lewat portal web, nggak ada mode/tombol lain
#
# Timer, jadwal, dan skenario semua dihitung server. ESP32 cuma nurut, plus:
# - nyimpan state & config di flash, biar setelah listrik padam kondisinya balik
# - failsafe: opsional matikan semua kalau server lama nggak bisa dihubungi
# - watchdog: kalau program macet > 60 detik, ESP32 restart sendiri

# ================== ISI SEBELUM UPLOAD (beda tiap ESP32) ==================
# ID & token ada di halaman /admin -> Kelola -> Setup ESP32.
# Isi di salinan yang di-upload ke ESP32 saja, jangan di-commit ke git.
WIFI_SSID = "nama-wifi"
WIFI_PASSWORD = "password-wifi"
SERVER = "https://nama-proyek.vercel.app"  # tanpa / di akhir
DEVICE_ID = "sw01"
DEVICE_TOKEN = "token-dari-admin"

# ================== Hardware ==================
RELAY_PINS = (26, 27, 25, 33)  # IN1..IN4 modul relay 4 channel
LED_PIN = 2  # LED biru bawaan board, buat status
INTERLOCK_DEADTIME_MS = 300  # jeda antara mematikan & menyalakan channel interlock (motor)

FW_VERSION = "3.0.0"

import gc
import json
import time

import machine
import network
from machine import Pin

try:
    import requests
except ImportError:  # firmware MicroPython versi lama
    import urequests as requests

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

STATE_SAVE_DELAY_MS = 2000  # tunda simpan state biar flash nggak cepat aus


# ================== simpan / baca JSON di flash ==================


def load(name, default):
    try:
        with open(name) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def save(name, data):
    try:
        with open(name, "w") as f:
            json.dump(data, f)
    except OSError as e:
        print("Gagal menyimpan", name, e)


# ================== RelayBank ==================
# 4 relay jadi satu. Ngurus: modul active-LOW, interlock (channel yang nggak
# boleh nyala bareng), dan mode "tekan sesaat" (pulse) yang dihitung di sini
# biar durasinya presisi walau internet lemot.


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
        self.changed = False  # ditandai biar tahu kapan harus simpan ke flash

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


# ================== StatusLed ==================
# pola kedip:
#   config     = kedip cepat terus (isian di atas belum diganti)
#   connecting = kedip pelan
#   online     = kedip singkat tiap 3 detik
#   error      = kedip 2x tiap 2 detik (WiFi ada, server nggak jawab)


class StatusLed:
    PATTERNS = {
        "config": (100, 100),
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


# ================== WiFi ==================


class Wifi:
    def __init__(self, ssid, password, hostname):
        self.ssid = ssid
        self.password = password
        self.sta = network.WLAN(network.STA_IF)
        try:
            network.hostname(hostname)
        except (AttributeError, ValueError, OSError):
            pass

    def connect(self, timeout_ms=20000, tick=None):
        self.sta.active(True)
        if self.sta.isconnected():
            return True
        print("Menghubungkan ke WiFi", self.ssid)
        try:
            self.sta.connect(self.ssid, self.password)
        except OSError as e:
            print("WiFi error:", e)
        start = time.ticks_ms()
        while not self.sta.isconnected():
            if time.ticks_diff(time.ticks_ms(), start) > timeout_ms:
                print("WiFi gagal tersambung, cek WIFI_SSID & WIFI_PASSWORD")
                try:
                    self.sta.disconnect()
                except OSError:
                    pass
                return False
            if tick:
                tick()  # biar LED & pulse tetap jalan selama nunggu
            time.sleep_ms(50)
        print("Terhubung! IP:", self.ip())
        return True

    def is_connected(self):
        return self.sta.isconnected()

    def ip(self):
        try:
            return self.sta.ifconfig()[0]
        except OSError:
            return ""

    def rssi(self):
        try:
            return self.sta.status("rssi")
        except (OSError, ValueError, TypeError):
            return 0


# ================== Server ==================
# Satu request = lapor state + ambil perintah. Lihat app/api/device/sync/route.ts


class Cloud:
    def __init__(self, server, device_id, token, timeout=8):
        self.url = server.rstrip("/") + "/api/device/sync"
        self.headers = {
            "Content-Type": "application/json",
            "X-Device-Id": device_id,
            "X-Device-Token": token,
        }
        self.timeout = timeout

    def _post(self, data):
        try:
            return requests.post(self.url, data=data, headers=self.headers, timeout=self.timeout)
        except TypeError:  # urequests lama belum kenal timeout
            return requests.post(self.url, data=data, headers=self.headers)

    # balikin dict jawaban server, atau None kalau gagal
    def sync(self, body):
        gc.collect()
        response = None
        try:
            response = self._post(json.dumps(body))
            if response.status_code == 200:
                return response.json()
            if response.status_code == 401:
                print("Token / ID ditolak server, cek DEVICE_ID & DEVICE_TOKEN")
            else:
                print("Server membalas kode", response.status_code)
        except Exception as e:  # noqa: BLE001 — jaringan bisa gagal dengan banyak cara
            print("Gagal menghubungi server:", e)
        finally:
            if response is not None:
                try:
                    response.close()
                except Exception:  # noqa: BLE001
                    pass
            gc.collect()
        return None


# ================== SmartSwitch ==================


class SmartSwitch:
    def __init__(self):
        self.config = DEFAULT_CONFIG.copy()
        self.config.update(load("config.json", {}))

        self.relays = RelayBank(RELAY_PINS, bool(self.config["al"]), INTERLOCK_DEADTIME_MS)
        self.led = StatusLed(LED_PIN)
        self.wifi = Wifi(WIFI_SSID, WIFI_PASSWORD, "saklar-" + DEVICE_ID)
        self.cloud = Cloud(SERVER, DEVICE_ID, DEVICE_TOKEN)

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
        saved = load("state.json", {}).get("r", [0, 0, 0, 0])
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
            save("state.json", {"r": self.relays.as_list()})

    # dipanggil sesering mungkin: pulse, LED, simpan state, watchdog
    def tick(self):
        if self.wdt:
            self.wdt.feed()
        self.relays.tick()
        self.led.tick()
        self._maybe_save_state()

    # --- server ---

    def sync(self):
        reply = self.cloud.sync(
            {
                "r": self.relays.as_list(),
                "cv": self.config["cv"],
                "rssi": self.wifi.rssi(),
                "up": time.ticks_diff(time.ticks_ms(), self.boot_ms) // 1000,
                "ip": self.wifi.ip(),
                "fw": FW_VERSION,
            }
        )
        if reply is None:
            self.led.set("error")
            return False

        self.led.set("online")
        self.last_ok = time.ticks_ms()
        self.failsafe_done = False

        if "cfg" in reply:
            self.config.update(reply["cfg"])
            self.config["cv"] = reply.get("cv", 0)
            save("config.json", self.config)
            self._apply_config()
            print("Config baru dari server, versi", self.config["cv"])

        for channel, ms in reply.get("p", []):
            if 0 <= channel < self.relays.count:
                self.relays.pulse(channel, ms)

        # channel yang lagi pulse atau mode tekan-sesaat jangan ditimpa
        desired = []
        for i, value in enumerate(reply.get("r", [])[: self.relays.count]):
            if self.relays.is_pulsing(i) or self.relays.pulse_ms[i]:
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
        print("Smart Switch siap. ID:", DEVICE_ID, "server:", SERVER)

        while True:
            self.tick()
            self._failsafe()

            if not self.wifi.is_connected():
                # router mati sebentar? relay tetap di kondisi terakhir, coba nyambung lagi
                self.led.set("connecting")
                self.wifi.connect(timeout_ms=15000, tick=self.tick)
                continue

            if time.ticks_diff(time.ticks_ms(), self.last_sync) >= self.config["poll"]:
                self.last_sync = time.ticks_ms()
                self.sync()
                gc.collect()
            else:
                time.sleep_ms(20)


def config_filled():
    placeholders = ("nama-wifi", "nama-proyek.vercel.app", "token-dari-admin")
    values = (WIFI_SSID, SERVER, DEVICE_TOKEN)
    if any(p in v for p, v in zip(placeholders, values)):
        print("Isi dulu WIFI_SSID, WIFI_PASSWORD, SERVER, DEVICE_ID, DEVICE_TOKEN di main.py")
        return False
    if not SERVER.startswith("http"):
        print("SERVER harus diawali http:// atau https://")
        return False
    return True


if config_filled():
    SmartSwitch().run()
else:
    led = StatusLed(LED_PIN)
    led.set("config")
    while True:
        led.tick()
        time.sleep_ms(20)
