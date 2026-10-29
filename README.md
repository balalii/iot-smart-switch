# Smart Switch

Relay 4 channel ESP32 (MicroPython) untuk 12 orang, dikontrol dari HP lewat web Next.js.

Ke-12 perangkat memakai aplikasi dan fitur yang sama. Pembedanya hanya path URL
(`/perangkat-01`, `/kamar-andi`, `/kandang-pak-budi`, ...) dan pengaturan masing-masing.
Setiap pemilik bisa menyesuaikan kegunaannya sendiri (rumah, kandang, akuarium, kebun,
toko, gorden/motor, atau kustom) tanpa mengubah kode.

```
 HP pemilik ──► /kamar-andi ─┐
 HP pemilik ──► /kebun-sari ─┤   Next.js + SQLite        ESP32 #1..#12
 Admin      ──► /admin ──────┴─► (timer, jadwal,  ◄──────  polling tiap 1 dtk
                                  interlock, log)  ──────►  relay 4 channel
```

Timer, jadwal, dan skenario dihitung di server. ESP32 cukup melapor tiap detik dan
mengikuti jawaban server. Selain itu ESP32 tetap punya kecerdasan lokal: pulse yang
presisi, simpan kondisi setelah listrik padam, dan failsafe.

## Fitur

**Per perangkat (yang dibuka pemilik di HP)**

- 4 tile saklar dengan status sinkron ESP32 dan indikator jadwal/timer/interlock
- Nyalakan semua / matikan semua
- Timer per channel (5 menit sampai 24 jam, ditambah durasi bebas) dengan hitung mundur
- Jadwal per channel: banyak jadwal, pilih hari, bisa lewat tengah malam (22:00 → 05:00),
  dan **mode libur** untuk menjeda semua jadwal. Override manual tidak langsung ditimpa jadwal.
- Skenario: atur beberapa channel sekaligus ("Malam", "Pergi", "Buka toko")
- Energi: kWh dan biaya hari ini, grafik 7 hari per channel, perkiraan sebulan, tarif PLN bisa diatur
- Riwayat aktivitas dengan filter per channel dan sumbernya (aplikasi, jadwal, timer, tombol fisik, ESP32)
- Pengaturan:
  - nama, keterangan, dan 8 warna aksen
  - **template kegunaan** yang mengisi 4 channel sekaligus
  - per channel: nama, ikon (31 pilihan), watt, sembunyikan, mode **saklar biasa** atau
    **tekan sesaat** (bel/kunci pintu), **batas nyala maksimal** (pengaman pompa/pemanas),
    **interlock** (motor naik/turun tidak boleh bareng), dan kondisi saat ESP32 baru menyala
  - ganti path URL, ganti PIN, wajib/tidak wajib PIN
  - relay active-LOW, failsafe saat server mati, interval sinkron. Semua dikirim otomatis
    ke ESP32 tanpa upload ulang.
- Login PIN dengan keypad (5x salah = dikunci 5 menit). Ganti PIN = HP lain otomatis logout.
- Tema terang/gelap, mobile-first, bisa di-install ke layar utama (PWA)

**Admin (`/admin`)**

- Status 12 perangkat sekaligus: online/offline, sinyal, kondisi 4 channel
- Ubah nama, pemilik, dan path; reset PIN; wajib PIN
- Lihat atau buat ulang token ESP32, beserta nilai yang perlu diisi di `firmware/main.py`
- Tambah perangkat ke-13 dan seterusnya, atau hapus perangkat

## Kenapa nggak di Vercel

12 ESP32 × 1 request/detik = sekitar **31 juta request per bulan**, sedangkan Vercel Hobby hanya
memberi 1 juta. Karena itu aplikasi ini dirancang untuk jalan di **server yang selalu menyala**:

- VPS murah (1 vCPU / 1 GB sudah cukup), atau
- mini PC / laptop / Raspberry Pi di rumah + [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
  supaya bisa diakses dari internet dengan HTTPS, gratis.

Database-nya SQLite (satu file di `data/`), jadi tidak butuh server database terpisah.

## Jalanin server

Butuh Node.js 20.19 atau lebih baru.

```bash
npm install
```

```bash
cp .env.example .env
```

Isi `ADMIN_PASSWORD` di `.env`, lalu buat database beserta 12 perangkat:

```bash
npm run setup
```

PIN dan token tiap perangkat tercetak di terminal dan disimpan di `data/akun-perangkat.txt`.
Bagikan **path + PIN** ke masing-masing pemilik. Token cuma untuk ESP32.

Mode pengembangan:

```bash
npm run dev
```

Produksi (di VPS / server rumah):

```bash
npm run build && npm run start
```

Supaya tetap jalan setelah server restart, pakai `pm2` atau systemd. Contoh dengan pm2:

```bash
npx pm2 start npm --name saklar -- start
```

Buka `http://localhost:3000/admin`, login, lalu atur nama, pemilik, dan path tiap perangkat.

### Backup

Semua data ada di folder `data/` (`switch.db`, rahasia sesi, dan daftar akun). Cukup backup folder itu.

## Wiring

| Modul relay 4CH | ESP32 DevKit V1 |
| --------------- | --------------- |
| VCC             | VIN (5V)        |
| GND             | GND             |
| IN1             | GPIO26 (D26)    |
| IN2             | GPIO27 (D27)    |
| IN3             | GPIO25 (D25)    |
| IN4             | GPIO33 (D33)    |

Pin bisa diganti di bagian *Hardware* [firmware/main.py](firmware/main.py). Untuk beban 220V, pastikan
modul relay sesuai kapasitas arusnya, dan pasang di dalam box tertutup.

## Firmware ESP32

Firmware MicroPython ada di folder [firmware/](firmware/). Panduan *flash*, upload, dan setup
WiFi ada di [firmware/README.md](firmware/README.md).

Singkatnya, cukup **satu file `main.py`**. Sebelum upload, isi WiFi, alamat server, ID, dan token
di bagian atas file itu. ID dan token beda untuk tiap ESP32.

## API

| Endpoint                        | Method       | Dipakai  | Isi                                                        |
| ------------------------------- | ------------ | -------- | ---------------------------------------------------------- |
| `/api/device/sync`              | POST         | ESP32    | lapor state + tombol, ambil perintah, pulse, dan config    |
| `/api/devices/:id`              | GET          | UI       | seluruh state perangkat (dipolling tiap 1,5 detik)         |
| `/api/devices/:id/actions`      | POST         | UI       | `set`, `all`, `timer`, `scene-run`, `schedule-save`, ...   |
| `/api/devices/:id/login`        | POST/DELETE  | UI       | login / logout PIN                                         |
| `/api/admin/login`              | POST/DELETE  | admin    | login / logout admin                                       |
| `/api/admin/devices`            | GET/POST     | admin    | daftar & tambah perangkat                                  |
| `/api/admin/devices/:id`        | GET/PATCH/DELETE | admin | token, ubah identitas/PIN/token, hapus                     |

Format `/api/device/sync`:

```
Header : X-Device-Id: sw01, X-Device-Token: <token>
Kirim  : {"r":[0,1,0,0],"ev":[[2,1]],"cv":3,"rssi":-60,"up":120,"ip":"192.168.1.7","fw":"2.0.0"}
Balas  : {"r":[0,1,0,0],"cv":3,"t":1761000000,"p":[[3,3000]],"cfg":{...}}
```

`ev` = tombol fisik yang ditekan `[channel, state]`, `p` = pulse `[channel, ms]`,
`cfg` = config hardware (hanya dikirim kalau versinya beda).

## Struktur

| Path                     | Isi                                                                  |
| ------------------------ | -------------------------------------------------------------------- |
| `lib/engine.ts`          | otak sistem: timer, jadwal, interlock, statistik, sinkron ESP32      |
| `lib/catalog.ts`         | ikon, warna, dan **template kegunaan** (tambah template baru di sini) |
| `lib/auth.ts`            | sesi admin & PIN per perangkat, token ESP32                          |
| `prisma/schema.prisma`   | skema database                                                       |
| `prisma/seed.ts`         | bikin 12 perangkat awal                                              |
| `app/[slug]/page.tsx`    | halaman perangkat (sama untuk semua path)                            |
| `components/device/`     | tab Kontrol, Jadwal, Skenario, Energi, Riwayat, Pengaturan           |
| `components/admin/`      | dashboard admin                                                      |
| `firmware/`              | MicroPython untuk ESP32                                              |
