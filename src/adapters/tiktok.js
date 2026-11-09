const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

/**
 * TikTok Direct Message Adapter (Headless / Session-based)
 * Note: TikTok does not have an open public API for personal account DMs.
 * This adapter is designed to connect using session cookies (sessionid / msToken)
 * or a Playwright headless worker when enabled.
 */
class TikTokAdapter extends EventEmitter {
  constructor(cookiePath) {
    super();
    this.cookiePath = cookiePath || path.join(__dirname, '../../auth/tiktok_cookies.json');
    this.isConnected = false;
    this.chats = new Map();
  }

  async start() {
    if (!fs.existsSync(this.cookiePath)) {
      this.emit('status', {
        status: 'disabled',
        reason: 'TikTok cookies not found (add auth/tiktok_cookies.json to enable)'
      });
      return;
    }

    try {
      this.emit('status', {
        status: 'initializing',
        info: 'Reading session cookie for TikTok DM polling...'
      });
      // Future expansion: Playwright or direct TikTok Web IM API polling
      this.emit('status', {
        status: 'standby',
        info: 'TikTok adapter configured (standby mode)'
      });
    } catch (err) {
      this.emit('status', { status: 'error', reason: err.message });
    }
  }

  async sendMessage(userId, text) {
    throw new Error('TikTok DM requires authenticated session cookies. Configure auth/tiktok_cookies.json first.');
  }

  getChats() {
    return Array.from(this.chats.values());
  }
}

module.exports = TikTokAdapter;
