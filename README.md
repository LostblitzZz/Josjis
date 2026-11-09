# Josjis - Terminal Ghost Client (WhatsApp Realtime)

Klien terminal ringan & realtime untuk WhatsApp (dan Discord) khusus di kantor. Bisa dikecilkan di sudut layar monitor, dan punya fitur **Ghost Mode & Camouflage** agar tidak ketahuan sedang chat.

---

## ⚡ Cara Menjalankan di Windows

### 1. Update ke Versi Ghost Client
Di folder `Josjis`:
```bat
git checkout . && git pull origin main
```

### 2. Tautkan WhatsApp (Cukup 1x)
Double-click **`auth.bat`** lalu scan QR dengan WhatsApp HP (`Perangkat Tertaut`). Begitu sukses, jendela akan tertutup sendiri.

### 3. Jalankan Terminal Ghost
Double-click **`start.bat`**.
* Tidak perlu buka browser sama sekali! Semua berjalan 100% di jendela konsol kecil ini.
* Kamu bisa ubah ukuran jendela terminal jadi kecil dan geser ke pojok monitor.

---

## ⌨️ Navigasi & Shortcut Praktis

| Perintah | Fungsi | Contoh |
| :--- | :--- | :--- |
| **Ketik teks + Enter** | Kirim pesan ke chat yang sedang aktif | `Halo bro, lagi di mana?` |
| **`/1`, `/2`, `/3`, ...** | Langsung ganti ke chat nomor 1, 2, dst | `/1` |
| **`/r`** | Balas langsung ke orang terakhir yang mengirim pesan | `/r` |
| **`/ls`** | Tampilkan daftar 10 chat terbaru dari WhatsApp | `/ls` |
| **`/to <nomor> <pesan>`** | Kirim pesan ke nomor baru mana saja | `/to 08123456789 Halo bro` |
| **`Esc`** atau **`/g`** | **Ghost Mode**. Layar seketika jadi ping server dummy. Tekan Enter / Esc lagi untuk kembali. | `/g` |
| **`/c`** | Ganti mode antara **Camouflage (tampilan log server)** dan **Normal Chat** | `/c` |
| **`/clear`** | Bersihkan layar | `/clear` |
| **`/q`** | Keluar | `/q` |
