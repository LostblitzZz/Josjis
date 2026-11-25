const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

let currentSock = null;
let reconnectTimer = null;
let finishTimer = null;
let isConnecting = false;
let isFinished = false;
let lastCredsUpdate = 0;

function cleanupSocket() {
  if (currentSock) {
    try { currentSock.ev.removeAllListeners(); } catch {}
    try { currentSock.end(); } catch {}
    currentSock = null;
  }
}

function scheduleReconnect(delayMs) {
  if (isFinished) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    linkWhatsApp().catch((err) => {
      console.error('Reconnect error:', err);
      scheduleReconnect(3000);
    });
  }, delayMs);
}

function scheduleSafeExit(authDir) {
  if (finishTimer) clearTimeout(finishTimer);
  const startWait = Date.now();

  const checkReady = () => {
    if (isFinished) return;
    const elapsedSinceCreds = Date.now() - lastCredsUpdate;
    const totalElapsed = Date.now() - startWait;
    const hasCreds = fs.existsSync(path.join(authDir, 'creds.json'));

    // Tunggu sampai penulisan creds/pre-keys selesai (minimal 4 detik stabil, maksimal 12 detik)
    if (hasCreds && ((elapsedSinceCreds >= 2500 && totalElapsed >= 4500) || totalElapsed >= 12000)) {
      isFinished = true;
      cleanupSocket();
      console.log('✓ Sesi & kredensial WhatsApp berhasil disimpan penuh. Aman untuk digunakan!');
      process.exit(0);
    } else {
      finishTimer = setTimeout(checkReady, 500);
    }
  };

  finishTimer = setTimeout(checkReady, 2500);
}

async function linkWhatsApp() {
  if (isConnecting || isFinished) return;
  isConnecting = true;

  try {
    const authDir = path.join(__dirname, 'auth/wa_session');
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    console.log('--------------------------------------------------');
    console.log('   WhatsApp Terminal Pairing Helper               ');
    console.log('--------------------------------------------------');
    console.log('Memeriksa versi WhatsApp & inisialisasi sesi...');

    cleanupSocket();

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1043857760] }));

    console.log(`Menggunakan WhatsApp Web Version: ${version.join('.')}`);

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Windows', 'Desktop', '10.0.22631'],
      syncFullHistory: true
    });
    currentSock = sock;

    sock.ev.on('creds.update', async () => {
      lastCredsUpdate = Date.now();
      await saveCreds();
    });

    sock.ev.on('connection.update', (update) => {
      if (isFinished || sock !== currentSock) return;
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
        cleanupSocket();
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession) {
          console.log(`\n[!] Sesi ditolak / logged out (code: ${statusCode}). Menghapus sesi lama & buat QR baru...`);
          try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}
          scheduleReconnect(2000);
        } else if (statusCode === DisconnectReason.connectionReplaced) {
          console.log('\n[!] Koneksi bentrok (code: 440 - connectionReplaced).');
          console.log('    Ada proses WhatsApp/Node lain yang memakai sesi yang sama.');
          console.log('    Tutup semua Node/terminal lain lalu jalankan ulang.');
          isFinished = true;
          process.exit(1);
        } else if (statusCode === DisconnectReason.restartRequired) {
          console.log('\n[~] QR berhasil discan! Menyelesaikan handshake WhatsApp (code: 515)...');
          scheduleReconnect(800);
        } else {
          console.log(`\n[!] Koneksi ditutup (code: ${statusCode || 'unknown'}). Menghubungkan ulang...`);
          scheduleReconnect(3000);
        }
      } else if (connection === 'open') {
        lastCredsUpdate = Date.now();
        console.log('\n==================================================');
        console.log(' [SUCCESS] WhatsApp berhasil ditautkan!');
        console.log(' Session tersimpan di: auth/wa_session/');
        console.log(' Menyelesaikan penyimpanan kunci & sinkronisasi...');
        console.log('==================================================\n');
        scheduleSafeExit(authDir);
      }
    });
  } finally {
    isConnecting = false;
  }
}

linkWhatsApp().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
