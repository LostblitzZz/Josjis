# Josjis

Terminal-based stealth multi-chat client (WhatsApp, Discord, TikTok DM) disguised as a backend server systemd/journalctl daemon.

---

## 💻 Panduan Menjalankan di Windows

### 1. Prasyarat
* Install **Node.js** (v18 atau v20+) dari [nodejs.org](https://nodejs.org/).
* Clone repo ini:
  ```bat
  git clone https://github.com/LostblitzZz/Josjis.git
  cd Josjis
  npm install
  ```

### 2. Tautkan WhatsApp (Cukup Sekali)
Double-click file **`auth.bat`** (atau jalankan `npm run auth` di terminal).
Scan QR code yang muncul di layar dengan WhatsApp HP (`Perangkat Tertaut` / `Linked Devices`). Tunggu sampai muncul notifikasi sukses, lalu jendela akan tertutup otomatis.

### 3. Jalankan Mode Stealth
Double-click file **`start.bat`** (atau jalankan `npm start` di terminal).
Layar terminal otomatis menyamar sebagai `journalctl -u ingress-telemetry.service -f`.

---

## 💬 Cara Pakai Chat & Perintah Lengkap

Di layar prompt `rpc-exec > `, kamu bisa langsung gunakan perintah berikut:

| Perintah | Deskripsi | Contoh |
| :--- | :--- | :--- |
| **Ketik teks biasa + Enter** | Kirim pesan ke target yang sedang aktif | `Halo bro, lagi di mana?` |
| **`:to <nomor> <pesan>`** | Kirim pesan langsung ke nomor HP siapapun | `:to 08123456789 Halo bro` |
| **`:ls`** atau **`:list`** | Tampilkan daftar semua chat yang tersinkron | `:ls` |
| **`:use <angka/nama>`** | Ganti target chat aktif | `:use 1` atau `:use Budi` |
| **`:p`** atau tombol **`Esc`** | **Panic Button**. Layar langsung bersih dan memunculkan fake compiler log (`cargo build`). Tekan Enter untuk kembali. | `:p` |
| **`:m`** | Ganti mode format log backend vs format teks chat | `:m` |
| **`:clear`** | Bersihkan layar log | `:clear` |
| **`:help`** | Tampilkan panduan perintah | `:help` |
| **`:q`** | Keluar dari aplikasi | `:q` |

---

## ⚙️ Tambah Discord / TikTok (Opsional)
Salin `.env.example` menjadi `.env`:
* **Discord Bot**: Masukkan bot token di `DISCORD_TOKEN=...`.
* **TikTok DM**: Kerangka adapter tersedia di `src/adapters/tiktok.js`.
