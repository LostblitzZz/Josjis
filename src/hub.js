const EventEmitter = require('events');
const WhatsAppAdapter = require('./adapters/whatsapp');
const DiscordAdapter = require('./adapters/discord');
const TikTokAdapter = require('./adapters/tiktok');

class ChatHub extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.wa = new WhatsAppAdapter(config.waAuthDir);
    this.discord = new DiscordAdapter(config.discordToken);
    this.tiktok = new TikTokAdapter(config.tiktokCookiePath);

    this.channels = []; // unified list of { id, displayName, platform, rawId }
    this.activeChannel = null;
    this.messageHistory = []; // { id, platform, sender, text, timestamp, isMe, channelId }
  }

  async init() {
    this.setupListeners();
    await this.wa.start();
    await this.discord.start();
    await this.tiktok.start();
  }

  setupListeners() {
    // WhatsApp events
    this.wa.on('status', (st) => this.emit('platform_status', { platform: 'whatsapp', ...st }));
    this.wa.on('qr', (qr) => this.emit('wa_qr', qr));
    this.wa.on('message', (msg) => this.handleIncomingMessage(msg));
    this.wa.on('contacts_updated', () => this.refreshChannels());

    // Discord events
    this.discord.on('status', (st) => this.emit('platform_status', { platform: 'discord', ...st }));
    this.discord.on('message', (msg) => this.handleIncomingMessage(msg));
    this.discord.on('channels_updated', () => this.refreshChannels());

    // TikTok events
    this.tiktok.on('status', (st) => this.emit('platform_status', { platform: 'tiktok', ...st }));
    this.tiktok.on('message', (msg) => this.handleIncomingMessage(msg));
  }

  handleIncomingMessage(msg) {
    this.messageHistory.push(msg);
    if (this.messageHistory.length > 500) {
      this.messageHistory.shift();
    }

    this.refreshChannels();
    this.emit('message', msg);
  }

  refreshChannels() {
    const list = [];

    // Add WhatsApp chats
    const waChats = this.wa.getRecentChats();
    for (const chat of waChats) {
      list.push({
        id: `wa:${chat.jid}`,
        platform: 'whatsapp',
        rawId: chat.jid,
        displayName: `[WA] ${chat.name || chat.jid.split('@')[0]}`,
        timestamp: chat.timestamp || 0
      });
    }

    // Add Discord channels
    const dcChannels = this.discord.getChannels();
    for (const ch of dcChannels) {
      list.push({
        id: `dc:${ch.id}`,
        platform: 'discord',
        rawId: ch.id,
        displayName: `[DC] ${ch.name}`,
        timestamp: 0
      });
    }

    // Sort: most recent chats first
    this.channels = list;
    if (!this.activeChannel && this.channels.length > 0) {
      this.activeChannel = this.channels[0];
    }

    this.emit('channels_updated', this.channels);
  }

  setActiveChannel(channelId) {
    const found = this.channels.find((c) => c.id === channelId);
    if (found) {
      this.activeChannel = found;
      this.emit('active_channel_changed', found);
    }
  }

  async sendCurrent(text) {
    if (!this.activeChannel) {
      throw new Error('No active channel selected. Select a channel from the left panel first.');
    }

    const { platform, rawId } = this.activeChannel;

    if (platform === 'whatsapp') {
      await this.wa.sendMessage(rawId, text);
    } else if (platform === 'discord') {
      await this.discord.sendMessage(rawId, text);
    } else if (platform === 'tiktok') {
      await this.tiktok.sendMessage(rawId, text);
    }

    // Local echo
    const echoMsg = {
      source: platform,
      channelId: rawId,
      channelName: this.activeChannel.displayName,
      sender: 'You',
      isMe: true,
      text,
      timestamp: Date.now()
    };

    this.messageHistory.push(echoMsg);
    this.emit('message', echoMsg);
  }

  getMessagesForChannel(channelId) {
    if (!channelId) return this.messageHistory;
    return this.messageHistory.filter((m) => m.channelId === channelId);
  }
}

module.exports = ChatHub;
