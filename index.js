require('dotenv').config();
const path = require('path');
const ChatHub = require('./src/hub');
const { createUI } = require('./src/ui/screen');

async function main() {
  const hub = new ChatHub({
    waAuthDir: path.join(__dirname, 'auth/wa_session'),
    discordToken: process.env.DISCORD_TOKEN,
    tiktokCookiePath: path.join(__dirname, 'auth/tiktok_cookies.json')
  });

  const { appendLog } = createUI(hub);

  appendLog('\x1b[90m[SYSTEM]\x1b[0m Initializing Unified Communication Daemon...');
  appendLog('\x1b[90m[SYSTEM]\x1b[0m Hotkeys: [Tab] Switch Pane | [F2] Toggle Syslog/Chat | [F3] Panic Screen | [Ctrl+C] Exit');

  try {
    await hub.init();
  } catch (err) {
    appendLog(`\x1b[31m[CRITICAL]\x1b[0m Initialization error: ${err.message}`);
  }
}

main().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
