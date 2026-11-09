# Josjis Desktop - Native Stealth Multi-Chat Workspace

Aplikasi percakapan stealth desktop **100% Native Windows (Josjis.exe)** tanpa membuka browser (Edge / Chrome) dan tanpa framework berat (Electron). 

---

## ⚡ Fitur Utama

1. **100% Native Windows GUI (`Josjis.exe`):**  
   Dibuat dan dikompilasi langsung menggunakan compiler bawaan Windows (`csc.exe` dari Microsoft .NET Framework). Ukuran sangat kecil, startup instan (< 1 detik), memori ringan.
2. **Stealth Auto-Dimming (Ghost Mode):**  
   Saat kursor mouse menjauh atau tidak aktif, jendela otomatis meredup transparan (default **20% opacity**). Begitu mouse digerakkan ke dalam jendela, aplikasi seketika kembali terang (100% opacity). Tingkat ghost opacity bisa diatur dengan slider (10% - 60%).
3. **Platform Hub Selector:**  
   Dashboard awal dengan pilihan:
   - **[WhatsApp]**: Terhubung langsung ke WhatsApp Multi-Device (personal chat, grup, bubble messages).
   - **[Discord]**: Bot gateway standby (masukkan token di `.env`).
   - **[TikTok DM]**: Headless direct message standby (sesi cookie di `auth/tiktok_cookies.json`).
4. **Panic Minimize (`Esc`):**  
   Tekan tombol `Esc` kapan saja untuk langsung me-minimize jendela ke taskbar.
5. **Mode Super Compact (`Mini`):**  
   Klik tombol **📐 Mini** atau perkecil jendela hingga 380px untuk menyembunyikan panel kontak dan hanya menyisakan jendela chat aktif di pojok monitor.
6. **Mulai Chat ke Nomor Apa Saja:**  
   Gunakan tombol **+ Nomor Baru** untuk langsung memulai obrolan dengan nomor HP baru tanpa harus menyimpan nomor di kontak ponsel terlebih dahulu.

---

## 🚀 Cara Menjalankan di Windows

1. Jalankan update di direktori `Josjis`:
   ```bat
   git checkout . && git pull origin main
   ```
2. Jalankan:
   ```bat
   start.bat
   ```
   Script otomatis mengompilasi `Josjis.cs` menjadi `Josjis.exe`, menyalakan backend di latar belakang, dan meluncurkan aplikasi native.

---

## 📱 Tentang Riwayat Chat WhatsApp (Full History Sync)

WhatsApp Multi-Device membagikan riwayat chat saat proses pairing awal (scan QR).
- Jika ingin menyinkronkan seluruh riwayat lama dari HP:
  Jalankan `reauth.bat` (atau `npm run reauth`), lalu scan QR Code. WhatsApp akan mengirimkan paket sinkronisasi riwayat pesan dan kontak lengkap.
- Kontak yang baru atau belum ada di list bisa langsung dibuka menggunakan tombol **+ Nomor Baru**.
