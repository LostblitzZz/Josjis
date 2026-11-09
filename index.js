require('dotenv').config();
const path = require('path');
const ChatHub = require('./src/hub');
const { startTerminalClient } = require('./src/terminalClient');

async function main() {
  const hub = new ChatHub({
    waAuthDir: path.join(__dirname, 'auth/wa_session'),
    discordToken: process.env.DISCORD_TOKEN,
    tiktokCookiePath: path.join(__dirname, 'auth/tiktok_cookies.json')
  });

  const { printLine } = startTerminalClient(hub);

  try {
    await hub.init();
  } catch (err) {
    printLine(`\x1b[31m[CRITICAL]\x1b[0m Init error: ${err.message}`);
  }
}

main().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
