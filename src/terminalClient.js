const readline = require('readline');
const { getRandomLog } = require('./ui/panicLogs');

function startTerminalClient(hub) {
  let isCamouflage = true; // Default to camouflage so user is safe immediately
  let isGhostMode = false;
  let ghostInterval = null;
  let lastSender = null;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: getPrompt()
  });

  function getActiveName() {
    if (!hub.activeChannel) return 'no-target';
    return hub.activeChannel.displayName.replace(/^svc-(wa|dc)\//, '');
  }

  function getPrompt() {
    if (isCamouflage) {
      return `\x1b[90mdaemon-exec[\x1b[36m${getActiveName()}\x1b[90m]>\x1b[0m `;
    } else {
      return `\x1b[32m[${getActiveName()}]\x1b[0m > `;
    }
  }

  function updatePrompt() {
    rl.setPrompt(getPrompt());
  }

  function printHeader() {
    console.clear();
    const cols = process.stdout.columns || 60;
    const divider = '-'.repeat(Math.min(cols, 60));

    console.log(`\x1b[90m${divider}\x1b[0m`);
    console.log(`\x1b[32m[JOSJIS GHOST CLIENT]\x1b[0m \x1b[90mStatus: Realtime Stream\x1b[0m`);
    console.log(`Target: \x1b[33m${getActiveName()}\x1b[0m | Mode: \x1b[36m${isCamouflage ? 'Camouflage (Server Log)' : 'Normal Chat'}\x1b[0m`);
    console.log(`Bantuan: \x1b[36m/help\x1b[0m | Ghost: \x1b[31mEsc\x1b[0m atau \x1b[31m/g\x1b[0m | Ganti mode: \x1b[36m/c\x1b[0m`);
    console.log(`\x1b[90m${divider}\x1b[0m\n`);

    printRecentChats();
    rl.prompt();
  }

  function printRecentChats() {
    const list = hub.channels || [];
    if (list.length === 0) {
      console.log(`\x1b[90m(Menunggu sinkronisasi kontak WA... atau ketik /to <nomor> <pesan>)\x1b[0m\n`);
      return;
    }

    console.log(`\x1b[33m--- Daftar Chat WhatsApp Terbaru --- \x1b[0m`);
    list.slice(0, 10).forEach((c, idx) => {
      const cleanName = c.displayName.replace(/^svc-(wa|dc)\//, '');
      const isCurrent = hub.activeChannel && hub.activeChannel.id === c.id;
      const marker = isCurrent ? '\x1b[32m● (aktif)\x1b[0m' : '';
      console.log(`  \x1b[36m/${idx + 1}\x1b[0m : ${cleanName} ${marker}`);
    });
    console.log(`\x1b[90mKetik /1, /2, dst untuk langsung chat ke orang tersebut.\x1b[0m\n`);
  }

  function formatMessage(msg) {
    const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const sender = msg.isMe ? 'You' : msg.sender;

    if (isCamouflage) {
      // Disguised as real backend log
      if (msg.isMe) {
        return `\x1b[90m[${time}]\x1b[0m \x1b[32m[ACK]\x1b[0m  \x1b[33m[dispatch]\x1b[0m payload: "${msg.text}"`;
      } else {
        return `\x1b[90m[${time}]\x1b[0m \x1b[36m[INFO]\x1b[0m \x1b[35m[sys/${sender}]\x1b[0m payload: "${msg.text}"`;
      }
    } else {
      // Clean chat style
      const color = msg.isMe ? '\x1b[32m' : '\x1b[36m';
      return `\x1b[90m[${time}]\x1b[0m ${color}${sender}:\x1b[0m ${msg.text}`;
    }
  }

  function printLine(text) {
    if (isGhostMode) return;
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    console.log(text);
    rl.prompt(true);
  }

  // Ghost Mode (Panic Screen)
  function toggleGhost() {
    isGhostMode = !isGhostMode;

    if (isGhostMode) {
      rl.pause();
      console.clear();
      console.log('\x1b[90m-- [k8s-pod] Container health probe active (PID 1824) --\x1b[0m');

      ghostInterval = setInterval(() => {
        const ms = (Math.random() * 0.8 + 0.1).toFixed(3);
        const seq = Math.floor(Date.now() / 1000) % 9999;
        console.log(`\x1b[90m64 bytes from 10.244.0.1: icmp_seq=${seq} ttl=64 time=${ms} ms\x1b[0m`);
      }, 750);
    } else {
      clearInterval(ghostInterval);
      ghostInterval = null;
      printHeader();
      rl.resume();
      rl.prompt();
    }
  }

  function printHelp() {
    console.log(`\n\x1b[33m=== Shortcut & Command Terminal Ghost ===\x1b[0m`);
    console.log(`  \x1b[36m/1, /2, /3 ...\x1b[0m        - Langsung pilih chat nomor 1, 2, dst`);
    console.log(`  \x1b[36m/r\x1b[0m                     - Balas ke orang terakhir yang kirim pesan`);
    console.log(`  \x1b[36m/ls\x1b[0m                    - Tampilkan ulang daftar chat WhatsApp`);
    console.log(`  \x1b[36m/to <nomor> <pesan>\x1b[0m    - Kirim langsung ke nomor HP baru (contoh: /to 0812345678 Halo)`);
    console.log(`  \x1b[36m/c\x1b[0m                     - Toggle Camouflage Mode (ubah tampilan jadi log server / chat biasa)`);
    console.log(`  \x1b[36m/g\x1b[0m atau tombol \x1b[31mEsc\x1b[0m     - Ghost Mode (layar ping dummy). Tekan Enter / Esc buat balik`);
    console.log(`  \x1b[36m/clear\x1b[0m                 - Bersihkan layar`);
    console.log(`  \x1b[36m/q\x1b[0m                     - Keluar aplikasi`);
    console.log(`  \x1b[90m(Ketik teks biasa lalu Enter untuk kirim chat ke target yang aktif)\x1b[0m\n`);
  }

  // Intercept Esc key globally
  if (process.stdin.isTTY) {
    process.stdin.on('keypress', (ch, key) => {
      if (key && (key.name === 'escape' || (key.ctrl && key.name === 'p'))) {
        toggleGhost();
      }
    });
  }

  rl.on('line', async (raw) => {
    if (isGhostMode) {
      toggleGhost();
      return;
    }

    const input = raw.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Shortcut numbers: /1, /2, /3...
    if (/^\/\d+$/.test(input)) {
      const num = input.slice(1);
      const switched = hub.setActiveByIndex(num);
      if (switched) {
        printLine(`\x1b[32m[✓]\x1b[0m Target aktif: \x1b[33m${switched.displayName.replace(/^svc-(wa|dc)\//, '')}\x1b[0m`);
      } else {
        printLine(`\x1b[31m[!] Chat nomor /${num} tidak ditemukan. Ketik /ls untuk lihat daftar.\x1b[0m`);
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    // Ghost trigger
    if (input === '/g' || input === '/ghost' || input === ':p') {
      toggleGhost();
      return;
    }

    // Toggle camouflage mode
    if (input === '/c' || input === '/mode') {
      isCamouflage = !isCamouflage;
      printLine(`\x1b[90m[system]\x1b[0m Mode diubah ke: ${isCamouflage ? 'Camouflage (Server Log)' : 'Normal Chat'}`);
      updatePrompt();
      rl.prompt();
      return;
    }

    // Help
    if (input === '/help' || input === '/h') {
      printHelp();
      rl.prompt();
      return;
    }

    // List chats
    if (input === '/ls' || input === '/list') {
      printRecentChats();
      rl.prompt();
      return;
    }

    // Reply to last sender
    if (input === '/r' || input === '/reply') {
      if (lastSender) {
        hub.setActiveChannel(lastSender.channelId);
        printLine(`\x1b[32m[✓]\x1b[0m Target aktif: \x1b[33m${getActiveName()}\x1b[0m`);
      } else {
        printLine(`\x1b[31m[!] Belum ada pesan masuk terbaru.\x1b[0m`);
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    // Clear
    if (input === '/clear' || input === '/cls') {
      printHeader();
      return;
    }

    // Quit
    if (input === '/q' || input === '/quit') {
      console.log('Terminating ghost daemon...');
      process.exit(0);
    }

    // Send to specific number: /to <phone> <message>
    if (input.startsWith('/to ')) {
      const match = input.match(/^\/to\s+(\S+)\s+(.+)$/);
      if (!match) {
        printLine(`\x1b[31m[!] Format salah. Gunakan: /to 08123456789 Halo bro\x1b[0m`);
        rl.prompt();
        return;
      }
      try {
        await hub.sendToNumber(match[1], match[2]);
        updatePrompt();
      } catch (err) {
        printLine(`\x1b[31m[ERROR]\x1b[0m Gagal kirim: ${err.message}`);
      }
      rl.prompt();
      return;
    }

    // Normal message to active target
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
    if (st.platform === 'whatsapp') {
      if (st.status === 'connected') {
        printLine(`\x1b[32m[SUCCESS]\x1b[0m WhatsApp TERHUBUNG & REALTIME!`);
        printRecentChats();
        updatePrompt();
      } else {
        printLine(`\x1b[90m[WA]\x1b[0m Status: ${st.status} ${st.reason ? '(' + st.reason + ')' : ''}`);
      }
    }
  });

  hub.on('message', (msg) => {
    if (!msg.isMe) {
      lastSender = msg;
    }
    printLine(formatMessage(msg));
  });

  hub.on('channels_updated', () => {
    updatePrompt();
  });

  hub.on('active_channel_changed', () => {
    updatePrompt();
  });

  printHeader();

  return { rl, printLine };
}

module.exports = { startTerminalClient };
