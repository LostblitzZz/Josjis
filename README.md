# Josjis Desktop - Stealth Multi-Chat Workspace (WhatsApp Native)

Aplikasi percakapan desktop **100% Native Windows Borderless (`dist/josjis-wa.exe`)** berbasis Rust (`tao` + `wry` WebView2), super ringan (~600 KB), tanpa border Windows, tanpa instalasi, dan mendukung **Ghost Mode**, **Boss Key (`Alt + Q`)**, serta **Panic Key (`Esc`)**.

---

## ⚡ Fitur Utama (`josjis-wa.exe`)

1. **True Borderless / Frameless Window (Tanpa Bingkai Windows):**
   - Menghilangkan total border & titlebar putih bawaan Windows OS (`with_decorations: false`).
   - Dilengkapi top bar stealth ramping (30px, warna dark `#111b21`) yang bisa di-drag untuk memindahkan jendela.
2. **Bebas Loop QR & 100% Sinkronisasi WhatsApp:**
   - Menggunakan engine WebView2 resmi dengan profil persisten di `%LOCALAPPDATA%\JosjisWhatsAppNativeProfile`.
   - Cukup scan QR WhatsApp **1 kali** di dalam aplikasi — seluruh chat lama, grup, nama kontak, foto, dokumen, dan voice note tersinkronisasi penuh dan tidak pernah loop/logout sendiri.
3. **Kontrol Stealth Lengkap di Bar Atas:**
   - **Switch Platform**: Klik **`WA`**, **`DC`**, atau **`TikTok`** langsung di header atas.
   - **`Ghost: ON/OFF`**: Otomatis meredup (14% opacity) saat kursor keluar dari jendela dan kembali 100% saat disentuh.
   - **`Pin`**: Mengunci jendela selalu di atas (*Always on Top*).
   - **`Mini`**: Mengecilkan jendela ke ukuran compact melayang (`430x660`).
   - **`Hide (Alt+Q)`** / Boss Key **`Alt + Q`**: Menyembunyikan jendela seketika dari layar & taskbar.
   - **Panic Key `Esc`**: Langsung minimize jendela saat aplikasi aktif.

---

## 🚀 Cara Menjalankan di Windows

### Opsi A (Langsung Pakai — Download .exe)
Download [`dist/josjis-wa.exe`](dist/josjis-wa.exe) lalu double-click langsung di Windows.

### Opsi B (Dari Folder Repo Git)
```bat
git pull origin main
start.bat
```

---

## 🛠️ Catatan Perbaikan Mode Terminal / Baileys (`auth-wa.js`)
Jika masih menggunakan mode Node/Baileys (`auth.bat` / `reauth.bat`):
- Memperbaiki bug loop QR / reconnect berulang (penanganan kode `515 restartRequired`, pencegahan socket ganda & orphan listeners, blokir loop saat bentrok sesi `440`, serta menunggu penyimpanan penuh `creds.json` & kunci LID sebelum keluar).
