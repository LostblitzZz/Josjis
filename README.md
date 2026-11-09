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

| Tombol | Aksi |
| :--- | :--- |
| **`F3`** / **`Panic`** | **Tombol Darurat**. Layar langsung berganti jadi live fake build stream (`cargo build`/`webpack`). Tekan `Esc` atau `F3` lagi untuk kembali ke chat. |
| **`F2`** | Ganti mode format antara **Stealth Syslog** (`[INFO] <wa-worker::Budi> ...`) dan **Clean Chat** biasa. |
| **`Tab`** | Pindah fokus antara panel daftar chat (kiri) dan kolom input pesan (bawah). |
| **`Enter`** | Pilih chat aktif (di panel kiri) / Kirim pesan (di kotak input). |
| **`Ctrl + C`** | Keluar dari aplikasi. |

---

## ⚙️ Konfigurasi Tambahan (Opsional)

Copy `.env.example` menjadi `.env`:
* **Discord Bot**: Masukkan token bot di `DISCORD_TOKEN=...`.
* **TikTok DM**: Kerangka adapter tersedia di `src/adapters/tiktok.js`.
