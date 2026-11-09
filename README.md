# Josjis

Terminal-based stealth multi-chat client (WhatsApp, Discord, TikTok DM) disguised as a backend server syslog daemon.

---

## 💻 Panduan Menjalankan di Windows

### 1. Prasyarat
* Install **Node.js** (v18 atau v20+) dari [nodejs.org](https://nodejs.org/).
* Clone atau download repo ini ke komputer Windows kamu.

### 2. Setup Awal (Terminal / PowerShell / CMD)
Buka folder `Josjis` di terminal:
```bat
npm install
```

### 3. Tautkan WhatsApp (Cukup 1x)
Double-click file **`auth.bat`** (atau jalankan `npm run auth` di terminal).
Scan QR code yang muncul di layar dengan WhatsApp HP (`Perangkat Tertaut` / `Linked Devices`).

### 4. Jalankan Mode Stealth
Double-click file **`start.bat`** (atau jalankan `npm start` di terminal).
Layar terminal otomatis menyamar sebagai `syslog-daemon`.

---

## 🐧 Panduan Menjalankan di Linux

```bash
cd Josjis
npm install
npm run auth    # scan QR sekali
npm start       # jalankan stealth client
```

---

## ⌨️ Hotkeys & Stealth Controls

| Tombol / Perintah | Aksi |
| :--- | :--- |
| **`Esc`** / **`F3`** / **`Ctrl + P`** | **Tombol Darurat (Panic)**. Layar langsung berganti jadi live fake build stream (`cargo build`/`webpack`). Tekan tombol apa saja (`Esc`/`Space`/`Enter`) untuk kembali. Bekerja meski sedang mengetik pesan! |
| **`:p`** (di input) | Alternatif memicu layar Panic lewat perintah teks. |
| **`F2`** atau **`:m`** | Ganti mode format antara **Ultra Stealth Syslog** (`Nov 09 14:52:10 srv-01 gateway[8412]: [thread-wa/Budi] payload_data: ...`) dan **Clean Chat**. |
| **`Tab`** | Pindah fokus antara daftar sockets/threads (kiri) dan prompt input (bawah). |
| **`Enter`** | Pilih target socket (di panel kiri) / Kirim payload (di kotak input). |
| **`:clear`** | Bersihkan layar log stream. |
| **`Ctrl + C`** atau **`:q`** | Keluar dari aplikasi. |

---

## ⚙️ Konfigurasi Tambahan (Opsional)

Copy `.env.example` menjadi `.env`:
* **Discord Bot**: Masukkan token bot di `DISCORD_TOKEN=...`.
* **TikTok DM**: Kerangka adapter tersedia di `src/adapters/tiktok.js`.
