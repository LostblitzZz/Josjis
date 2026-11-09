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
  console.log('            Josjis Desktop Hub (Stealth Multi-Chat)             ');
  console.log('================================================================');
  console.log(`[systemd] Desktop backend active on port ${port}`);

  try {
    await startWebServer(hub, port);
    console.log(`[systemd] Web / Desktop interface listening at http://localhost:${port}`);

    await hub.init();
    console.log('[systemd] WhatsApp & communication services initialized.');
  } catch (err) {
    console.error('Initialization error:', err.message);
  }
}

main().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
