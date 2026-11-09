# Josjis - Stealth Multi-Chat Hub (WhatsApp Web & Discord)

Aplikasi chat stealth khusus kantor yang tampil persis **WhatsApp Web** dan **Discord**, namun disamarkan sebagai **GitHub Pull Request & Visual Studio Code**.

---

## 🚀 Cara Menjalankan di Windows

### 1. Update ke Versi Terbaru
Buka folder `Josjis` di terminal:
```bat
git pull origin main
npm install
```

### 2. Tautkan WhatsApp (Cukup 1x)
Double-click **`auth.bat`** lalu scan QR dengan WhatsApp HP (`Perangkat Tertaut`).

### 3. Jalankan Aplikasi
Double-click **`start.bat`**.
* Browser akan otomatis terbuka ke: **`http://localhost:3821`**
* Terminal di latar belakang menyamar sebagai log service `journalctl`.

---

## 🛡️ Fitur Stealth & Penyamaran Kantor

1. **Tampilan Tab Browser:**
   * Judul tab otomatis menyamar jadi: `PR #412: Optimize database connection pool · Pull Request #412`
   * Ikon tab (favicon) menggunakan logo resmi GitHub.
2. **Panic Key (`Esc`):**
   * Tekan tombol **`Esc`** di keyboard kapan saja. Layar seketika berubah 100% jadi **Visual Studio Code** lengkap dengan kode backend TypeScript dan file explorer.
   * Tekan **`Esc`** lagi untuk kembali ke WhatsApp Web.
3. **Point-and-Click User Friendly:**
   * Tampilan chat bubble persis WhatsApp Web asli (balon hijau untuk pesanmu, balon abu-abu untuk kontak).
   * Tombol **`+ Chat`** untuk langsung kirim pesan ke nomor HP mana saja.
   * Tab switch di atas untuk berpindah antara **WhatsApp** dan **Discord**.
