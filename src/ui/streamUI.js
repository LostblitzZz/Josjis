const readline = require('readline');
const { getRandomLog } = require('./panicLogs');

function createStreamUI(hub) {
  let isStealthMode = true;
  let isPanicMode = false;
  let panicInterval = null;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: getPrompt()
  });

  function getTargetName() {
    return hub.activeChannel ? hub.activeChannel.displayName : 'no-target';
  }

  function getPrompt() {
    return `\x1b[36mrpc-exec\x1b[0m [\x1b[33m${getTargetName()}\x1b[0m] > `;
  }

  function updatePrompt() {
    rl.setPrompt(getPrompt());
  }

  function printHeader() {
    console.clear();
    const d = new Date().toISOString().replace('T', ' ').slice(0, 19);
    console.log(`\x1b[90m-- [systemd-journald] Live log stream started at ${d} UTC --\x1b[0m`);
    console.log(`\x1b[90m-- Cluster: prod-sea-01 | Host: srv-worker-02 | Service: ingress-gw.service --\x1b[0m`);
    console.log(`\x1b[90m--------------------------------------------------------------------------------\x1b[0m`);
    console.log(`Target: \x1b[33m${getTargetName()}\x1b[0m | Bantuan: \x1b[36m:help\x1b[0m | Daftar chat: \x1b[36m:ls\x1b[0m | Panic: \x1b[31m:p\x1b[0m atau \x1b[31mEsc\x1b[0m`);
    console.log(`\x1b[90m--------------------------------------------------------------------------------\x1b[0m\n`);
    rl.prompt();
  }

  function formatMessage(msg) {
    const d = new Date(msg.timestamp || Date.now());
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = String(d.getDate()).padStart(2, '0');
    const time = d.toTimeString().split(' ')[0];
    const timestampStr = `${month} ${day} ${time}`;

    const sender = msg.isMe ? 'You' : msg.sender;
    const prefix = msg.source === 'whatsapp' ? 'thread-wa' : (msg.source === 'discord' ? 'ingress-dc' : 'stream-tk');

    if (isStealthMode) {
      if (msg.isMe) {
        return `\x1b[90m${timestampStr} srv-01 gateway[8412]:\x1b[0m \x1b[32m[egress-gw/You]\x1b[0m dispatch_ack: "${msg.text}"`;
      } else {
        return `\x1b[90m${timestampStr} srv-01 gateway[8412]:\x1b[0m \x1b[36m[${prefix}/${sender}]\x1b[0m payload_data: "${msg.text}"`;
      }
    } else {
      const color = msg.isMe ? '\x1b[32m' : '\x1b[34m';
      return `\x1b[90m[${time}]\x1b[0m ${color}${sender}:\x1b[0m ${msg.text}`;
    }
  }

  function printLine(text) {
    if (isPanicMode) return;
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    console.log(text);
    rl.prompt(true);
  }

  function togglePanic() {
    isPanicMode = !isPanicMode;

    if (isPanicMode) {
      rl.pause();
      console.clear();
      console.log('\x1b[32m[cargo] Compiling release binaries target=x86_64-unknown-linux-gnu...\x1b[0m');

      panicInterval = setInterval(() => {
        console.log(getRandomLog());
      }, 50);
    } else {
      clearInterval(panicInterval);
      panicInterval = null;
      printHeader();
      rl.resume();
      rl.prompt();
    }
  }

  function printHelp() {
    console.log(`\n\x1b[33m=== Command & Shortcut Josjis ===\x1b[0m`);
    console.log(`  \x1b[36m:ls\x1b[0m atau \x1b[36m:list\x1b[0m              - Tampilkan daftar semua chat WhatsApp / Discord`);
    console.log(`  \x1b[36m:use <angka/nama>\x1b[0m         - Ganti chat aktif (contoh: :use 1 atau :use Budi)`);
    console.log(`  \x1b[36m:to <nomor> <pesan>\x1b[0m       - Kirim langsung ke nomor HP (contoh: :to 0812345678 Halo)`);
    console.log(`  \x1b[36m:p\x1b[0m atau \x1b[36m:panic\x1b[0m (atau \x1b[36mEsc\x1b[0m)    - Layar Panic (fake build stream). Tekan Enter buat kembali`);
    console.log(`  \x1b[36m:m\x1b[0m atau \x1b[36m:mode\x1b[0m             - Ganti format log backend vs format chat biasa`);
    console.log(`  \x1b[36m:clear\x1b[0m                    - Bersihkan layar terminal`);
    console.log(`  \x1b[36m:q\x1b[0m atau \x1b[36m:quit\x1b[0m             - Keluar aplikasi`);
    console.log(`  \x1b[90m(Ketik teks biasa lalu Enter untuk kirim pesan ke target yang aktif)\x1b[0m\n`);
  }

  function printList() {
    const channels = hub.channels;
    if (!channels || channels.length === 0) {
      console.log(`\n\x1b[33m[!] Belum ada riwayat chat yang tersinkron.\x1b[0m`);
      console.log(`Gunakan perintah: \x1b[36m:to <nomor_hp> <pesan>\x1b[0m untuk langsung chat ke nomor siapapun.`);
      console.log(`Contoh: \x1b[32m:to 08123456789 Halo bro\x1b[0m\n`);
      return;
    }

    console.log(`\n\x1b[33m=== Daftar Chat Terhubung (${channels.length}) ===\x1b[0m`);
    channels.slice(0, 25).forEach((c, idx) => {
      const isCurrent = hub.activeChannel && hub.activeChannel.id === c.id;
      const marker = isCurrent ? '\x1b[32m● (aktif)\x1b[0m' : ' ';
      console.log(`  [\x1b[36m${idx + 1}\x1b[0m] ${c.displayName} ${marker}`);
    });
    console.log(`\x1b[90mKetik ':use <angka>' untuk memilih chat (contoh: :use 1)\x1b[0m\n`);
  }

  // Intercept Esc key for Panic
  if (process.stdin.isTTY) {
    process.stdin.on('keypress', (ch, key) => {
      if (key && (key.name === 'escape' || (key.ctrl && key.name === 'p'))) {
        togglePanic();
      }
    });
  }

  // Listen to readline line submissions
  rl.on('line', async (line) => {
    if (isPanicMode) {
      togglePanic();
      return;
    }

    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === ':p' || input === ':panic' || input === '/panic') {
      togglePanic();
      return;
    }

    if (input === ':help' || input === '/help') {
      printHelp();
      rl.prompt();
      return;
    }

    if (input === ':ls' || input === ':list' || input === '/list') {
      printList();
      rl.prompt();
      return;
    }

    if (input === ':m' || input === ':mode') {
      isStealthMode = !isStealthMode;
      printLine(`\x1b[90m[systemd]\x1b[0m Format diubah ke: ${isStealthMode ? 'STEALTH (syslog)' : 'CLEAN (chat)'}`);
      rl.prompt();
      return;
    }

    if (input === ':clear' || input === '/clear') {
      printHeader();
      return;
    }

    if (input === ':q' || input === ':quit') {
      console.log('Terminating daemon...');
      process.exit(0);
    }

    // Command :use <number or name>
    if (input.startsWith(':use ') || input.startsWith('/use ')) {
      const arg = input.replace(/^(:use|\/use)\s+/, '').trim();
      let switched = null;
      if (/^\d+$/.test(arg)) {
        switched = hub.setActiveByIndex(arg);
      } else {
        switched = hub.setActiveByName(arg);
      }

      if (switched) {
        printLine(`\x1b[32m[systemd]\x1b[0m Target aktif berganti ke: \x1b[33m${switched.displayName}\x1b[0m`);
      } else {
        printLine(`\x1b[31m[!] Chat "${arg}" tidak ditemukan. Ketik :ls untuk lihat daftar.\x1b[0m`);
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    // Command :to <phone> <message>
    if (input.startsWith(':to ') || input.startsWith('/to ')) {
      const match = input.match(/^(:to|\/to)\s+(\S+)\s+(.+)$/);
      if (!match) {
        printLine(`\x1b[31m[!] Format salah. Gunakan: :to <nomor_hp> <pesan>\x1b[0m`);
        printLine(`Contoh: :to 08123456789 Halo lagi apa?`);
        rl.prompt();
        return;
      }

      const phone = match[2];
      const messageText = match[3];

      try {
        await hub.sendToNumber(phone, messageText);
        updatePrompt();
      } catch (err) {
        printLine(`\x1b[31m[ERROR]\x1b[0m Gagal kirim: ${err.message}`);
      }
      rl.prompt();
      return;
    }

    // Regular message to current active channel
    try {
      await hub.sendCurrent(input);
    } catch (err) {
      printLine(`\x1b[31m[ERROR]\x1b[0m ${err.message}`);
    }

    updatePrompt();
    rl.prompt();
  });

  // Hub Event Listeners
  hub.on('platform_status', (st) => {
    printLine(`\x1b[90m[systemd]\x1b[0m Socket [${st.platform}] status: ${st.status} ${st.reason ? '(' + st.reason + ')' : ''}`);
    if (st.platform === 'whatsapp' && st.status === 'connected') {
      printLine(`\x1b[32m[SUCCESS]\x1b[0m WhatsApp terhubung aktif! Ketik :ls untuk melihat chat atau :to <nomor> <pesan>`);
      updatePrompt();
      rl.prompt();
    }
  });

  hub.on('message', (msg) => {
    printLine(formatMessage(msg));
  });

  hub.on('channels_updated', () => {
    updatePrompt();
  });

  hub.on('active_channel_changed', (channel) => {
    updatePrompt();
  });

  hub.on('wa_qr', () => {
    printLine(`\x1b[33m[NOTICE]\x1b[0m WhatsApp belum tertaut. Jalankan auth.bat atau npm run auth untuk scan QR.`);
  });

  printHeader();

  return { rl, printLine };
}

module.exports = { createStreamUI };
