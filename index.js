require('dotenv').config();
const path = require('path');
const ChatHub = require('./src/hub');
const { createSplitUI } = require('./src/ui/splitUI');

async function main() {
  const hub = new ChatHub({
    waAuthDir: path.join(__dirname, 'auth/wa_session'),
    discordToken: process.env.DISCORD_TOKEN,
    tiktokCookiePath: path.join(__dirname, 'auth/tiktok_cookies.json')
  });

  createSplitUI(hub);

  try {
    await hub.init();
  } catch (err) {
    console.error('Initialization error:', err.message);
  }
}

main().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
