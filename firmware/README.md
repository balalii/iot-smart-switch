# Firmware ESP32 (MicroPython)

Kode yang sama dipasang di 12 ESP32. Yang membedakan tiap ESP32 hanya isian
di halaman setup (WiFi, server, ID, token), dan isian itu disimpan di flash ESP32.

| File          | Isi                                                            |
| ------------- | -------------------------------------------------------------- |
| `pins.py`     | **konfigurasi hardware**: pin relay, tombol, LED               |
| `app.py`      | class `SmartSwitch`, menggabungkan semua bagian                |
| `relays.py`   | class `RelayBank`: 4 relay, active-LOW, interlock, pulse       |
| `inputs.py`   | class `Buttons`, `HoldButton`, `StatusLed`                     |
| `net.py`      | class `WifiManager` & `CloudSync`                              |
| `portal.py`   | class `SetupPortal`: hotspot + halaman setup                   |
| `storage.py`  | baca/tulis JSON di flash                                       |
| `main.py`     | titik masuk                                                    |
| `boot.py`     | dijalankan sebelum `main.py`                                   |

## 1. Flash MicroPython ke ESP32 (sekali per board)

Cara termudah adalah lewat **Thonny** ([thonny.org](https://thonny.org)):

1. Colok ESP32 ke laptop.
2. Thonny → **Tools → Options → Interpreter** → pilih *MicroPython (ESP32)*.
3. Klik **Install or update MicroPython (esptool)**, pilih port USB-nya, variant
   *Espressif • ESP32 / WROOM*, lalu **Install**.

Kalau board tidak terdeteksi, install driver USB CP210x atau CH340 sesuai chip di board-nya.
Saat proses install, tahan tombol **BOOT** kalau diminta.

## 2. Upload kode

**Thonny:** buka folder `firmware/` di panel *Files*. Pilih semua file `.py`, klik kanan,
lalu pilih **Upload to /**. Setelah itu tekan tombol **EN/RST** di board.

**Atau pakai terminal (mpremote):**

```bash
pip install mpremote
```

```bash
cd firmware && mpremote cp *.py : && mpremote reset
```

Ulangi untuk ke-12 ESP32. Kodenya sama semua, tidak ada yang perlu diedit.

## 3. Setup WiFi & identitas (dari HP)

ESP32 yang belum di-setup otomatis masuk **mode setup** (LED biru kedip cepat).

1. Di HP, sambungkan ke WiFi **`Saklar-xxxx`**, password **`saklar123`**.
2. Halaman setup biasanya muncul sendiri. Kalau tidak, buka **http://192.168.4.1**.
3. Isi:
   - **WiFi** dan password di lokasi pemasangan
   - **Alamat server**, misal `https://saklar.domainmu.com` (tanpa `/` di akhir)
   - **ID perangkat** dan **Token**, dari halaman **Admin → Kelola**
4. Tekan **Simpan & restart**.

ESP32 akan restart dan tersambung. Di halaman admin, perangkatnya berubah jadi **Online**.

Untuk pindah WiFi atau mengganti token: **tahan tombol BOOT 5 detik** saat ESP32 menyala,
maka ESP32 masuk mode setup lagi. Isian lama tetap terisi, dan mode ini menutup sendiri
setelah 5 menit kalau tidak ada yang disimpan.

## Arti LED biru

| Pola                          | Artinya                                         |
| ----------------------------- | ----------------------------------------------- |
| kedip cepat terus             | mode setup, sambungkan HP ke hotspot `Saklar-…` |
| kedip pelan (1 detik)         | sedang menyambung ke WiFi                       |
| kedip singkat tiap 3 detik    | normal, tersambung ke server                    |
| kedip 2x tiap 2 detik         | WiFi tersambung, tapi server tidak menjawab     |

## Perilaku penting

- **Listrik padam:** kondisi relay disimpan di flash. Saat menyala lagi, tiap channel mengikuti
  pengaturan "Saat ESP32 baru menyala" (seperti terakhir / selalu mati / selalu nyala),
  bahkan sebelum ada internet.
- **Internet putus:** relay tetap di kondisi terakhir, dan tombol fisik tetap berfungsi. Tekanan
  tombol dilaporkan ke server begitu tersambung lagi. Kalau failsafe diset "Matikan semua",
  relay dimatikan setelah N detik tanpa server.
- **Tekan sesaat (pulse):** durasinya dihitung oleh ESP32 sendiri, jadi tetap presisi walau internet lambat.
- **Interlock:** ESP32 mematikan dulu channel lawannya dan memberi jeda 300 ms sebelum
  menyalakan, aman untuk motor dua arah.
- **Watchdog:** kalau program macet lebih dari 60 detik, ESP32 restart sendiri.

## Troubleshooting

Buka **Serial Monitor** di Thonny (panel *Shell*), lalu tekan EN/RST untuk melihat log.

| Pesan                                        | Solusi                                                   |
| -------------------------------------------- | -------------------------------------------------------- |
| `WiFi gagal tersambung`                      | password WiFi salah: tahan BOOT 5 dtk, setup ulang        |
| `Token / ID ditolak server`                  | token salah atau sudah dibuat ulang di admin             |
| `Gagal menghubungi server`                   | cek alamat server, coba buka alamat itu dari HP          |
| Relay nyala/mati terbalik                    | Pengaturan → Perangkat keras → matikan "Relay aktif LOW" |
