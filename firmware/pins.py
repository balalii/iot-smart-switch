# ================== Konfigurasi hardware ==================
# Satu-satunya file yang mungkin perlu diubah kalau wiring-mu beda.
# WiFi, alamat server, ID & token TIDAK di sini, diisi lewat halaman setup
# (hotspot "Saklar-xxxx", buka 192.168.4.1).

FW_VERSION = "2.0.0"

# IN1..IN4 modul relay 4 channel
RELAY_PINS = (26, 27, 25, 33)

# tombol fisik (opsional), satu kaki ke pin ini, kaki lain ke GND.
# pakai pull-up internal. Isi None kalau nggak pakai tombol.
# hindari GPIO 34/35/36/39 karena nggak punya pull-up internal.
BUTTON_PINS = (32, 14, 13, 4)

# LED biru bawaan board, buat status
LED_PIN = 2

# tombol BOOT bawaan board. Tahan 5 detik saat ESP32 sudah jalan = masuk mode setup.
SETUP_PIN = 0
SETUP_HOLD_MS = 5000

# hotspot mode setup (WPA2 butuh minimal 8 karakter)
SETUP_AP_PASSWORD = "saklar123"

# jeda antara mematikan & menyalakan channel yang saling interlock (motor)
INTERLOCK_DEADTIME_MS = 300
