# ================== SetupPortal ==================
# Mode setup: ESP32 jadi hotspot "Saklar-xxxx". Sambungkan HP ke hotspot itu,
# halaman setup biasanya muncul sendiri (captive portal). Kalau nggak, buka
# http://192.168.4.1 di browser. Isi WiFi, server, ID, dan token, lalu simpan.

import socket
import time

import machine
import network

try:
    import select
except ImportError:
    import uselect as select

import storage

AP_IP = "192.168.4.1"


def unquote_plus(text):
    text = text.replace("+", " ")
    parts = text.split("%")
    out = bytearray(parts[0].encode())
    for part in parts[1:]:
        try:
            out.append(int(part[:2], 16))
            out.extend(part[2:].encode())
        except ValueError:
            out.extend(("%" + part).encode())
    return out.decode()


def parse_form(body):
    data = {}
    for pair in body.split("&"):
        if "=" in pair:
            key, value = pair.split("=", 1)
            data[unquote_plus(key)] = unquote_plus(value).strip()
    return data


def escape(text):
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


# jawab semua pertanyaan DNS dengan IP ESP32, biar HP menganggap ini captive portal
def dns_reply(data):
    if len(data) < 12:
        return None
    i = 12
    while i < len(data) and data[i] != 0:
        i += data[i] + 1
    end = i + 5
    if end > len(data):
        return None
    header = data[:2] + b"\x81\x80" + data[4:6] + data[4:6] + b"\x00\x00\x00\x00"
    answer = b"\xc0\x0c\x00\x01\x00\x01\x00\x00\x00\x3c\x00\x04" + bytes(int(x) for x in AP_IP.split("."))
    return header + data[12:end] + answer


STYLE = """
*{box-sizing:border-box}body{margin:0;font:16px/1.45 system-ui,sans-serif;background:#f5f3ef;color:#1d1f24}
main{max-width:420px;margin:0 auto;padding:24px 18px 40px}h1{font-size:22px;margin:8px 0 2px}
p{color:#666;margin:0 0 18px}label{display:block;font-weight:600;font-size:14px;margin:14px 0 6px}
input,select{width:100%;height:46px;border:1px solid #ddd8ce;border-radius:12px;padding:0 12px;font:inherit;background:#fff}
small{display:block;color:#777;margin-top:6px;font-size:12px}
button{margin-top:22px;width:100%;height:50px;border:0;border-radius:14px;background:#f2b33d;font:600 16px system-ui;color:#1d1f24}
.box{background:#fff;border:1px solid #e5e1d8;border-radius:16px;padding:6px 16px 16px;margin-top:14px}
a{color:#1d1f24}
"""


class SetupPortal:
    def __init__(self, device_id="", timeout_ms=None, wdt=None):
        self.settings = storage.load("settings.json", {})
        self.device_id = device_id or self.settings.get("id", "")
        self.timeout_ms = timeout_ms
        self.wdt = wdt
        self.networks = []
        self.done = False

    def _ap_name(self):
        if self.device_id:
            return "Saklar-" + self.device_id
        mac = network.WLAN(network.AP_IF).config("mac")
        return "Saklar-%02x%02x" % (mac[-2], mac[-1])

    def scan(self):
        sta = network.WLAN(network.STA_IF)
        sta.active(True)
        try:
            found = sta.scan()
        except OSError:
            found = []
        names = []
        for item in sorted(found, key=lambda n: -n[3]):
            name = item[0].decode("utf-8", "ignore")
            if name and name not in names:
                names.append(name)
        self.networks = names[:20]

    def page(self, message=""):
        s = self.settings
        options = "".join(
            '<option value="%s"%s>%s</option>' % (escape(n), " selected" if n == s.get("ssid") else "", escape(n))
            for n in self.networks
        )
        return """<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Setup Saklar</title><style>%s</style></head>
<body><main><h1>Setup Saklar %s</h1><p>Isi sekali saja. Setelah disimpan, ESP32 restart dan tersambung otomatis.</p>%s
<form method="post" action="/save">
<div class="box"><label>Pilih WiFi</label><select name="ssid_pick"><option value="">— ketik manual di bawah —</option>%s</select>
<small><a href="/?scan=1">Pindai ulang</a></small>
<label>Atau ketik nama WiFi</label><input name="ssid" value="%s" placeholder="Nama WiFi">
<label>Password WiFi</label><input name="password" type="password" placeholder="%s"></div>
<div class="box"><label>Alamat server</label><input name="server" value="%s" placeholder="https://saklar.domainmu.com" inputmode="url">
<small>Tanpa garis miring di akhir.</small>
<label>ID perangkat</label><input name="id" value="%s" placeholder="sw01" autocapitalize="none">
<label>Token</label><input name="token" value="%s" placeholder="dari halaman admin" autocapitalize="none">
<small>ID & token ada di halaman admin, menu Kelola.</small></div>
<button>Simpan &amp; restart</button></form></main></body></html>""" % (
            STYLE,
            escape(self.device_id),
            ('<p style="color:#b4231b"><b>%s</b></p>' % escape(message)) if message else "",
            options,
            escape(s.get("ssid", "")),
            "kosongkan kalau tidak berubah" if s.get("password") else "Password WiFi",
            escape(s.get("server", "")),
            escape(s.get("id", "")),
            escape(s.get("token", "")),
        )

    def save(self, form):
        ssid = form.get("ssid_pick") or form.get("ssid", "")
        settings = {
            "ssid": ssid,
            "password": form.get("password") or self.settings.get("password", ""),
            "server": form.get("server", "").rstrip("/"),
            "id": form.get("id", "").lower(),
            "token": form.get("token", ""),
        }
        missing = [k for k in ("ssid", "server", "id", "token") if not settings[k]]
        if missing:
            self.settings.update(settings)
            return "Belum lengkap: " + ", ".join(missing)
        if not settings["server"].startswith("http"):
            self.settings.update(settings)
            return "Alamat server harus diawali http:// atau https://"
        storage.save("settings.json", settings)
        storage.remove("setup.flag")
        self.done = True
        return None

    def _send(self, client, status, body, content_type="text/html; charset=utf-8", extra=""):
        data = body.encode()
        client.send(
            "HTTP/1.1 %s\r\nContent-Type: %s\r\nContent-Length: %d\r\nConnection: close\r\n%s\r\n"
            % (status, content_type, len(data), extra)
        )
        for i in range(0, len(data), 1024):
            client.send(data[i : i + 1024])

    def handle(self, client):
        client.settimeout(3)
        request = b""
        while b"\r\n\r\n" not in request and len(request) < 4096:
            chunk = client.recv(512)
            if not chunk:
                break
            request += chunk
        head, _, body = request.partition(b"\r\n\r\n")
        lines = head.decode("utf-8", "ignore").split("\r\n")
        method, path = (lines[0].split(" ") + ["", ""])[:2]
        length = 0
        for line in lines[1:]:
            if line.lower().startswith("content-length:"):
                length = int(line.split(":", 1)[1].strip() or 0)
        while len(body) < length:
            chunk = client.recv(512)
            if not chunk:
                break
            body += chunk

        if method == "POST" and path.startswith("/save"):
            error = self.save(parse_form(body.decode("utf-8", "ignore")))
            if error:
                self._send(client, "200 OK", self.page(error))
            else:
                self._send(
                    client,
                    "200 OK",
                    "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>"
                    "<body style='font:18px system-ui;padding:32px;text-align:center'><h2>Tersimpan ✓</h2>"
                    "<p>ESP32 restart dan menyambung ke WiFi. Hotspot ini akan hilang.</p></body>",
                )
            return

        if "scan=1" in path:
            self.scan()
        self._send(client, "200 OK", self.page())

    def run(self):
        print("=== MODE SETUP ===")
        sta = network.WLAN(network.STA_IF)
        sta.active(True)
        self.scan()

        ap = network.WLAN(network.AP_IF)
        ap.active(True)
        from pins import SETUP_AP_PASSWORD

        name = self._ap_name()
        try:
            ap.config(essid=name, password=SETUP_AP_PASSWORD, authmode=3)
        except (OSError, ValueError):
            ap.config(essid=name)
        ap.ifconfig((AP_IP, "255.255.255.0", AP_IP, AP_IP))
        print("Sambungkan HP ke WiFi", name, "password", SETUP_AP_PASSWORD, "lalu buka http://" + AP_IP)

        dns = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        dns.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        dns.bind(("0.0.0.0", 53))
        web = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        web.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        web.bind(("0.0.0.0", 80))
        web.listen(3)

        poller = select.poll()
        poller.register(dns, select.POLLIN)
        poller.register(web, select.POLLIN)

        from inputs import StatusLed
        from pins import LED_PIN

        led = StatusLed(LED_PIN)
        led.set("setup")
        start = time.ticks_ms()

        while not self.done:
            if self.wdt:
                self.wdt.feed()
            led.tick()
            if self.timeout_ms and time.ticks_diff(time.ticks_ms(), start) > self.timeout_ms:
                print("Mode setup habis waktunya, restart")
                break
            for sock, _ in poller.poll(100):
                try:
                    if sock is dns:
                        data, addr = dns.recvfrom(512)
                        reply = dns_reply(data)
                        if reply:
                            dns.sendto(reply, addr)
                    else:
                        client, _ = web.accept()
                        try:
                            self.handle(client)
                        finally:
                            client.close()
                except OSError as e:
                    print("Portal error:", e)

        time.sleep_ms(1500)  # kasih waktu halaman "Tersimpan" terkirim
        dns.close()
        web.close()
        ap.active(False)
        machine.reset()
