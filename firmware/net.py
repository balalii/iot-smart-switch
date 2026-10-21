# ================== WifiManager & CloudSync ==================

import gc
import json
import time

import network

try:
    import requests
except ImportError:  # firmware MicroPython versi lama
    import urequests as requests


class WifiManager:
    def __init__(self, ssid, password, hostname="saklar"):
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
                print("WiFi gagal tersambung")
                try:
                    self.sta.disconnect()
                except OSError:
                    pass
                return False
            if tick:
                tick()  # biar LED & tombol tetap jalan selama nunggu
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


class CloudSync:
    # Satu request = lapor state + ambil perintah. Lihat app/api/device/sync/route.ts
    def __init__(self, server, device_id, token, timeout=8):
        self.url = server.rstrip("/") + "/api/device/sync"
        self.headers = {
            "Content-Type": "application/json",
            "X-Device-Id": device_id,
            "X-Device-Token": token,
        }
        self.timeout = timeout
        self.last_status = None  # buat ditampilkan di serial monitor

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
            self.last_status = response.status_code
            if response.status_code == 200:
                return response.json()
            if response.status_code == 401:
                print("Token / ID ditolak server. Cek lagi lewat mode setup.")
            else:
                print("Server membalas kode", response.status_code)
        except Exception as e:  # noqa: BLE001 — jaringan bisa gagal dengan banyak cara
            self.last_status = None
            print("Gagal menghubungi server:", e)
        finally:
            if response is not None:
                try:
                    response.close()
                except Exception:  # noqa: BLE001
                    pass
            gc.collect()
        return None
