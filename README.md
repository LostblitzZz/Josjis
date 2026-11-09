# Josjis Desktop - Stealth Multi-Chat Workspace

Aplikasi percakapan desktop **100% Native Windows (`Josjis.exe`)** yang ringan, compact, dan dilengkapi dengan **Auto-Dimming Ghost Mode (OS-Level Transparency)** serta **100% Akses Seluruh Riwayat Chat & Kontak**.

---

## ⚡ Fitur Utama

1. **100% Seluruh Chat & Kontak Lengkap:**  
   Menggunakan engine web resmi dalam mode aplikasi mandiri (*Borderleess App Window*). Seluruh riwayat chat lama bertahun-tahun, kontak dengan nama dari buku telepon ponsel, media, foto, dan voice note tersinkronisasi 100%.
2. **Stealth Auto-Dimming (Ghost Mode Tingkat OS):**  
   Saat kursor mouse keluar dari jendela chat, jendela otomatis memudar halus menjadi transparan (default **20% opacity**). Saat mouse menyentuh jendela, seketika kembali terang (100%).
3. **Pilihan Platform di Awal (Dashboard Menu):**  
   * **[WhatsApp Desktop]**: Chat pribadi, grup, voice note, dan media lengkap.
   * **[Discord Web]**: Server channels dan direct messages.
   * **[TikTok DM]**: Direct messages dan percakapan TikTok.
4. **Panic Minimize (`Esc`):**  
   Tekan tombol **`Esc`** kapan saja saat jendela chat aktif untuk langsung menyembunyikannya ke taskbar seketika.
5. **Ukuran Compact & Resizable:**  
   Ukuran jendela ramping (440x680), bisa digeser ke sudut monitor, dan mendukung Always on Top.
6. **0 MB Install / Tanpa Node Server:**  
   Dikompilasi langsung menjadi file `.exe` mandiri menggunakan compiler bawaan Windows (`csc.exe`).

---

## 🚀 Cara Menjalankan di Windows

Cukup buka terminal di folder proyek (`D:\Porto Project\Josjis2\Josjis`):

```bat
git checkout . && git pull origin main
```

Lalu jalankan:
```bat
start.bat
```

1. Jendela **Josjis Desktop Hub** akan terbuka.
2. Klik tombol **`🚀 Buka WhatsApp`** (atau Discord / TikTok).
3. Login WhatsApp sekali lewat scan QR di jendela tersebut (sesi tersimpan permanen di profil lokal).
4. Selesai! Semua chatmu ada lengkap dan auto-opacity stealth langsung aktif.
