require('dotenv').config();
const path = require('path');
const ChatHub = require('./src/hub');
const { createStreamUI } = require('./src/ui/streamUI');

async function main() {
  const hub = new ChatHub({
    waAuthDir: path.join(__dirname, 'auth/wa_session'),
    discordToken: process.env.DISCORD_TOKEN,
    tiktokCookiePath: path.join(__dirname, 'auth/tiktok_cookies.json')
  });

  const { printLine } = createStreamUI(hub);

  printLine('\x1b[90m[systemd]\x1b[0m Starting Ingress Telemetry Worker Daemon...');

  try {
    await hub.init();
  } catch (err) {
    printLine(`\x1b[31m[CRITICAL]\x1b[0m Initialization error: ${err.message}`);
  }
}

main().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
