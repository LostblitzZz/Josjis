# Josjis Desktop - Black Discord-Style WhatsApp Corner Widget & CLI

Client WhatsApp stealth super ringan (**~600 KB**) dengan tampilan **hitam minimalis ala Discord**, posisi otomatis **kecil di pojok kanan bawah layar**, **Ghost Mode transparan asli 20% (tembus pandang ke jendela di belakangnya)**, dan dukungan penuh **CLI terminal mode**.

---

## ⚡ Fitur Utama (`dist/josjis-wa.exe`)

1. **Tampilan Hitam Minimalis ala Discord (Chat dari WhatsApp)**:
   - Sidebar kontak kompak (`# kontak`, `& grup`), filter `All / DM / Grp`, pencarian cepat, kirim ke nomor baru (`+ Nomor`), serta format pesan datar ala Discord (bukan bubble hijau WhatsApp).
   - **Scan QR Langsung di Dalam Jendela**: Jika belum tertaut, QR muncul otomatis di jendela hitam tanpa perlu membuka terminal terpisah.
2. **Kecil di Pojok Layar (`395x560`) & Borderless**:
   - Otomatis muncul di pojok kanan bawah di atas taskbar, *Always on Top* (`Pin`), tanpa bingkai putih bawaan Windows.
3. **Ghost Mode Transparansi Asli OS (`20%` Opacity)**:
   - Menggunakan Win32 Layered Alpha (*bukan sekadar redup hitam*): jendela menjadi **20% tembus pandang** saat kursor menjauh, dan kembali `100%` terang & responsif saat kursor menyentuh jendela. Level opacity bisa diganti (`20% / 35% / 50% / 12%`).
4. **Hotkey & Samaran**:
   - **`Alt + Q`**: Boss Key (sembunyikan seketika dari layar & taskbar).
   - **`Esc`**: Panic Key (minimize ke taskbar).
   - **`F1`** / tombol **`Code`**: Overlay samaran editor VS Code (`metrics-worker.ts`).

---

## 🚀 Cara Pakai di Windows (`D:\Porto Project\Josjis2\Josjis`)

1. Update ke versi terbaru:
   ```bat
   git pull origin main
   ```
2. Pilih mode yang diinginkan:
   - **Mode Corner Widget Hitam ala Discord** → jalankan **`start.bat`** (atau langsung klik `dist\josjis-wa.exe`).
   - **Mode Terminal CLI Murni** → jalankan **`cli.bat`** (atau `npm run cli`).
