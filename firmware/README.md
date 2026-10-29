# Firmware ESP32 (MicroPython)

Cukup **satu file: `main.py`**. Cara kerjanya:

1. ESP32 menyambung ke WiFi yang ditulis di `main.py`.
2. Tiap detik ESP32 melapor ke server dan mengambil perintah.
3. Relay dikontrol dari HP lewat portal web. Tidak ada hotspot setup atau tombol fisik.

Yang beda di tiap ESP32 hanya 5 baris di bagian atas `main.py`: WiFi, password, server, ID, dan token.

## 1. Flash MicroPython ke ESP32 (sekali per board)

Lewat **Thonny** ([thonny.org](https://thonny.org)):

1. Colok ESP32 ke laptop.
2. Thonny → **Tools → Options → Interpreter** → pilih *MicroPython (ESP32)*.
3. Klik **Install or update MicroPython (esptool)**, pilih port USB-nya, variant
   *Espressif • ESP32 / WROOM*, lalu **Install**.

Kalau board tidak terdeteksi, install driver USB CP210x atau CH340 sesuai chip di board-nya.
Saat proses install, tahan tombol **BOOT** kalau diminta.

## 2. Isi pengaturan & upload

1. Di Thonny, buka `firmware/main.py`.
2. Ganti 5 baris di bagian **ISI SEBELUM UPLOAD**:

   ```python
   WIFI_SSID = "WiFi-Rumah"                      # WiFi 2.4 GHz, bukan 5 GHz
   WIFI_PASSWORD = "password-wifi"
   SERVER = "https://nama-proyek.vercel.app"     # tanpa / di akhir
   DEVICE_ID = "sw01"                            # dari /admin -> Kelola
   DEVICE_TOKEN = "..."                          # dari /admin -> Kelola
   ```

3. **File → Save copy…** → pilih **MicroPython device** → simpan dengan nama `main.py`.
4. Tekan tombol **EN/RST** di board.

Isian WiFi & token cukup ada di ESP32. Jangan simpan isian itu ke file di laptop
(tutup tab tanpa menyimpan), biar token tidak ikut ter-commit ke git.

Di panel *Shell* akan muncul `Terhubung! IP: ...` lalu `Smart Switch siap`. Di halaman
admin, perangkatnya berubah jadi **Online**.

Ulangi langkah 2 untuk tiap ESP32 dengan `DEVICE_ID` dan `DEVICE_TOKEN` masing-masing.

**Pindah WiFi atau ganti token:** ulangi langkah 2, lalu timpa `main.py` di ESP32.

**Upgrade dari firmware lama (yang banyak file):** hapus dulu file lama di ESP32 lewat panel
*Files* Thonny (`app.py`, `inputs.py`, `net.py`, `pins.py`, `portal.py`, `relays.py`,
`storage.py`, `settings.json`). `boot.py`, `config.json`, dan `state.json` boleh dibiarkan.

## Arti LED biru

| Pola                          | Artinya                                              |
| ----------------------------- | ---------------------------------------------------- |
| kedip cepat terus             | isian di bagian atas `main.py` belum diganti         |
| kedip pelan (1 detik)         | sedang menyambung ke WiFi                            |
| kedip singkat tiap 3 detik    | normal, tersambung ke server                         |
| kedip 2x tiap 2 detik         | WiFi tersambung, tapi server tidak menjawab          |

## Perilaku penting

- **Listrik padam:** kondisi relay disimpan di flash. Saat menyala lagi, tiap channel mengikuti
  pengaturan "Saat ESP32 baru menyala" (seperti terakhir / selalu mati / selalu nyala),
  bahkan sebelum ada internet.
- **Internet putus:** relay tetap di kondisi terakhir, ESP32 terus mencoba menyambung lagi.
  Kalau failsafe diset "Matikan semua", relay dimatikan setelah N detik tanpa server.
- **Tekan sesaat (pulse):** durasinya dihitung oleh ESP32 sendiri, jadi tetap presisi walau internet lambat.
- **Interlock:** ESP32 mematikan dulu channel lawannya dan memberi jeda 300 ms sebelum
  menyalakan, aman untuk motor dua arah.
- **Watchdog:** kalau program macet lebih dari 60 detik, ESP32 restart sendiri.

## Troubleshooting

Buka panel *Shell* di Thonny, lalu tekan EN/RST untuk melihat log.

| Pesan                                        | Solusi                                                   |
| -------------------------------------------- | -------------------------------------------------------- |
| `Isi dulu WIFI_SSID, ...`                    | 5 baris di atas `main.py` belum diganti                  |
| `WiFi gagal tersambung`                      | nama/password WiFi salah, atau WiFi-nya 5 GHz            |
| `Token / ID ditolak server`                  | token salah atau sudah dibuat ulang di admin             |
| `Gagal menghubungi server`                   | cek `SERVER`, coba buka alamat itu dari HP               |
| Relay nyala/mati terbalik                    | Pengaturan → Perangkat keras → matikan "Relay aktif LOW" |
