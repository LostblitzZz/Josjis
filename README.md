# Josjis - Terminal WhatsApp Split Client

Klien terminal WhatsApp yang tampilannya persis seperti **WhatsApp Web** (kontak di sebelah kiri, riwayat obrolan lengkap di sebelah kanan), namun berjalan **100% murni di dalam terminal** dengan fitur penyamaran (*stealth / ghost mode*).

---

## ⚡ Cara Menjalankan di Windows

### 1. Update ke Versi Terbaru
Buka terminal di folder `Josjis`:
```bat
git checkout . && git pull origin main
```

### 2. Tautkan WhatsApp (Cukup 1x)
Double-click **`auth.bat`** lalu scan QR dengan WhatsApp HP (`Perangkat Tertaut`).

### 3. Jalankan Terminal WhatsApp
Double-click **`start.bat`**.

---

## 📱 Tampilan Split Terminal (Persis WhatsApp)

* **Panel Kiri (Daftar Kontak & Grup):**  
  Menampilkan semua kontak dan grup yang disinkronkan langsung dari WhatsApp secara realtime.  
  Gunakan **Panah Atas / Bawah** untuk memilih chat, lalu tekan **Enter** untuk membuka.
* **Panel Kanan (Riwayat Chat Lengkap):**  
  Membuka dan menampilkan semua pesan obrolan sebelumnya dengan kontak tersebut secara runtut waktu.
* **Kotak Bawah (Input Pesan):**  
  Ketik pesanmu lalu tekan **Enter** untuk langsung mengirim.

---

## ⌨️ Kontrol & Hotkey

| Tombol / Perintah | Fungsi |
| :--- | :--- |
| **`Tab`** | Pindah fokus antara **Daftar Kontak (kiri)** dan **Kotak Ketik Pesan (bawah)** |
| **`Panah Atas / Bawah`** | Pilih kontak di panel kiri |
| **`Enter`** (di panel kiri) | Buka obrolan kontak tersebut |
| **`Enter`** (di kotak pesan) | Kirim pesan ke kontak yang sedang aktif |
| **`Esc`** atau **`F3`** | **Panic / Ghost Mode**. Seketika layar tertutup live fake compiler stream (`cargo build`). Tekan tombol apa saja untuk kembali |
| **`/c`** (di input pesan) | Ganti mode antara **Camouflage (disamarkan jadi log server)** dan **Format Chat biasa** |
| **`/to <nomor> <pesan>`** | Langsung kirim pesan ke nomor baru mana saja |
| **`Ctrl + C`** atau **`/q`** | Keluar dari aplikasi |
