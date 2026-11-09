# Josjis Desktop - Stealth Multi-Chat App

Aplikasi chat desktop stealth khusus kantor yang bisa dibuat kecil di sudut layar, punya fitur **auto-dimming opacity** (meredup gelap otomatis saat kursor mouse tidak menyentuh), dan pilihan platform (**WhatsApp**, placeholder **Discord**, placeholder **TikTok**).

---

## 🚀 Cara Menjalankan di Windows

### 1. Update ke Versi Desktop
Buka folder `Josjis`:
```bat
git checkout . && git pull origin main
```

### 2. Tautkan WhatsApp (Cukup 1x)
Double-click **`auth.bat`** lalu scan QR dengan WhatsApp HP (`Perangkat Tertaut`).

### 3. Jalankan Desktop App
Double-click **`start.bat`**.
* Aplikasi akan terbuka otomatis sebagai **Desktop Window mandiri** (tanpa tab atau address bar browser).
* Ukuran jendela compact (440x680) dan bisa kamu tarik sudutnya untuk diperkecil sesuai selera.

---

## ✨ Fitur Utama Josjis Desktop

1. **Menu Awal Pemilih Platform:**
   * Di awal, kamu bisa memilih mau membuka **WhatsApp**, **Discord** (placeholder bot gateway), atau **TikTok DM** (placeholder headless cookie).
   * Tombol `⮌ Pilih Platform` di pojok kiri atas untuk berganti platform kapan saja.
2. **Auto-Dimming Opacity (Super Stealth):**
   * Saat kursor mouse keluar dari jendela atau diam selama beberapa detik, **jendela otomatis meredup gelap & transparan (default 20%)**.
   * Dari belakang orang hanya melihat jendela gelap samar.
   * Begitu mouse digerakkan ke jendela, **langsung seketika terang 100%**.
   * Slider slider `👻 Auto-Dim` di kanan atas bisa diatur dari 10% sampai 90%.
3. **WhatsApp Desktop Lengkap:**
   * Filter chat: `Semua`, `Pribadi`, `Grup`.
   * Kolom pencarian kontak cepat.
   * Riwayat obrolan lengkap dengan balon chat WhatsApp dan pengiriman pesan instan (Enter).
4. **Panic Mode (`Esc`):**
   * Tekan tombol **`Esc`** kapan saja: seketika seluruh aplikasi tertutup **Visual Studio Code** palsu. Tekan `Esc` lagi untuk kembali.
