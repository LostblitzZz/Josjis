require('dotenv').config();
const path = require('path');
const ChatHub = require('./src/hub');
const { startWebServer } = require('./src/server');

async function main() {
  const port = process.env.PORT || 3821;

  const hub = new ChatHub({
    waAuthDir: path.join(__dirname, 'auth/wa_session'),
    discordToken: process.env.DISCORD_TOKEN,
    tiktokCookiePath: path.join(__dirname, 'auth/tiktok_cookies.json')
  });

  console.log('================================================================');
  console.log('   Josjis - Stealth Multi-Chat (WhatsApp Web & Discord Client)   ');
  console.log('================================================================');
  console.log(`[systemd] Live Web UI ready at: http://localhost:${port}`);
  console.log(`[systemd] Buka http://localhost:${port} di browser kamu`);
  console.log('----------------------------------------------------------------');

  try {
    await startWebServer(hub, port);
    console.log(`[systemd] HTTP/WebSocket Server listening on port ${port}`);

    await hub.init();
    console.log('[systemd] Communication channels initialized.');
  } catch (err) {
    console.error('[CRITICAL] Initialization error:', err.message);
  }
}

main().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
