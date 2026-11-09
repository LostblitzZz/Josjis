const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

let currentSock = null;

async function linkWhatsApp() {
  const authDir = path.join(__dirname, 'auth/wa_session');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  console.log('--------------------------------------------------');
  console.log('   WhatsApp Terminal Pairing Helper               ');
  console.log('--------------------------------------------------');
  console.log('Memeriksa versi WhatsApp & inisialisasi sesi...');

  if (currentSock) {
    try { currentSock.end(); } catch {}
    currentSock = null;
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1043857760] }));

  console.log(`Menggunakan WhatsApp Web Version: ${version.join('.')}`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.windows('Chrome'),
    syncFullHistory: true
  });
  currentSock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n==================================================');
      console.log(' SCAN QR CODE BERIKUT DENGAN WHATSAPP DI HP:');
      console.log(' (Buka WhatsApp -> Perangkat Tertaut -> Tautkan)');
      console.log('==================================================\n');
      qrcode.generate(qr, { small: true });
      console.log('\nMenunggu scan dari HP...');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        console.log('\n[!] Device logged out. Menghapus sesi lama...');
        try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
        setTimeout(() => linkWhatsApp(), 2000);
      } else {
        console.log(`\n[!] Koneksi ditutup (code: ${statusCode || 'unknown'}). Mencoba ulang...`);
        setTimeout(() => linkWhatsApp(), 3000);
      }
    } else if (connection === 'open') {
      console.log('\n==================================================');
      console.log(' [SUCCESS] WhatsApp berhasil ditautkan!');
      console.log(' Session tersimpan di: auth/wa_session/');
      console.log(' Riwayat chat sedang disinkronkan ke cache lokal.');
      console.log(' Kamu sekarang bisa jalankan: start.bat');
      console.log('==================================================\n');
      setTimeout(() => process.exit(0), 3000);
    }
  });
}

linkWhatsApp().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
