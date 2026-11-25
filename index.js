require('dotenv').config();
const path = require('path');
const qrcode = require('qrcode-terminal');
const ChatHub = require('./src/hub');
const { startWebServer } = require('./src/server');
const { startTerminalClient } = require('./src/terminalClient');

const isCliMode = process.argv.includes('--cli');

async function main() {
  const port = process.env.PORT || 3821;

  const hub = new ChatHub({
    waAuthDir: path.join(__dirname, 'auth/wa_session'),
    discordToken: process.env.DISCORD_TOKEN,
    tiktokCookiePath: path.join(__dirname, 'auth/tiktok_cookies.json')
  });

  if (isCliMode) {
    hub.on('wa_qr', (qr) => {
      console.log('\n==================================================');
      console.log(' SCAN QR WHATSAPP DI HP:');
      console.log('==================================================\n');
      qrcode.generate(qr, { small: true });
    });
    startTerminalClient(hub);
  } else {
    console.log('================================================================');
    console.log('            Josjis Desktop Hub (Stealth Multi-Chat)             ');
    console.log('================================================================');
    console.log(`[systemd] Desktop backend active on port ${port}`);
  }

  try {
    await startWebServer(hub, port);
    if (!isCliMode) {
      console.log(`[systemd] Web / Desktop interface listening at http://localhost:${port}`);
    }
    await hub.init();
    if (!isCliMode) {
      console.log('[systemd] WhatsApp & communication services initialized.');
    }
  } catch (err) {
    console.error('Initialization error:', err.message);
  }
}

main().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
