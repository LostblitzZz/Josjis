const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

async function linkWhatsApp() {
  const authDir = path.join(__dirname, 'auth/wa_session');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  console.log('--------------------------------------------------');
  console.log('   WhatsApp Terminal Pairing Helper               ');
  console.log('--------------------------------------------------');
  console.log('Initializing WhatsApp session...');

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '124.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\nScan QR Code berikut di WhatsApp HP:');
      console.log('(Buka WhatsApp -> Pengaturan / Titik 3 -> Perangkat Tertaut -> Tautkan Perangkat)\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        console.log('\n[!] Device logged out. Hapus folder auth/wa_session dan scan ulang.');
        process.exit(1);
      } else {
        console.log(`[!] Koneksi terputus (code: ${statusCode}). Mencoba reconnect...`);
        linkWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('\n==================================================');
      console.log(' [SUCCESS] WhatsApp berhasil ditautkan!');
      console.log(' Session tersimpan di: auth/wa_session/');
      console.log(' Kamu sekarang bisa jalankan: npm start');
      console.log('==================================================\n');
      setTimeout(() => process.exit(0), 1500);
    }
  });
}

linkWhatsApp().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
