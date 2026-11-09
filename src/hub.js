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
    this.messageHistory = [];
  }

  async init() {
    this.setupListeners();
    await this.wa.start();
    await this.discord.start();
    await this.tiktok.start();
  }

  setupListeners() {
    this.wa.on('status', (st) => this.emit('platform_status', { platform: 'whatsapp', ...st }));
    this.wa.on('qr', (qr) => this.emit('wa_qr', qr));
    this.wa.on('message', (msg) => this.handleIncomingMessage(msg));
    this.wa.on('contacts_updated', () => this.refreshChannels());

    this.discord.on('status', (st) => this.emit('platform_status', { platform: 'discord', ...st }));
    this.discord.on('message', (msg) => this.handleIncomingMessage(msg));
    this.discord.on('channels_updated', () => this.refreshChannels());

    this.tiktok.on('status', (st) => this.emit('platform_status', { platform: 'tiktok', ...st }));
    this.tiktok.on('message', (msg) => this.handleIncomingMessage(msg));
  }

  handleIncomingMessage(msg) {
    this.messageHistory.push(msg);
    if (this.messageHistory.length > 500) {
      this.messageHistory.shift();
    }

    this.refreshChannels();

    // If no active channel, or if incoming message is from a contact,
    // we can keep active channel synced or notify
    const targetChannel = this.channels.find((c) => c.rawId === msg.channelId);
    if (!this.activeChannel && targetChannel) {
      this.activeChannel = targetChannel;
      this.emit('active_channel_changed', targetChannel);
    }

    this.emit('message', msg);
  }

  refreshChannels() {
    const list = [];

    // WhatsApp chats
    const waChats = this.wa.getRecentChats();
    for (const chat of waChats) {
      list.push({
        id: `wa:${chat.jid}`,
        platform: 'whatsapp',
        rawId: chat.jid,
        displayName: `svc-wa/${chat.name || chat.jid.split('@')[0]}`,
        timestamp: chat.timestamp || 0
      });
    }

    // Discord channels
    const dcChannels = this.discord.getChannels();
    for (const ch of dcChannels) {
      list.push({
        id: `dc:${ch.id}`,
        platform: 'discord',
        rawId: ch.id,
        displayName: `svc-dc/${ch.name}`,
        timestamp: 0
      });
    }

    this.channels = list;

    if (!this.activeChannel && this.channels.length > 0) {
      this.activeChannel = this.channels[0];
      this.emit('active_channel_changed', this.activeChannel);
    }

    this.emit('channels_updated', this.channels);
  }

  setActiveChannel(channelId) {
    const found = this.channels.find((c) => c.id === channelId || c.rawId === channelId);
    if (found) {
      this.activeChannel = found;
      this.emit('active_channel_changed', found);
      return found;
    }
    return null;
  }

  setActiveByIndex(index) {
    const idx = parseInt(index, 10) - 1;
    if (this.channels[idx]) {
      this.activeChannel = this.channels[idx];
      this.emit('active_channel_changed', this.activeChannel);
      return this.activeChannel;
    }
    return null;
  }

  setActiveByName(query) {
    const q = query.toLowerCase().trim();
    const found = this.channels.find((c) =>
      c.displayName.toLowerCase().includes(q) ||
      c.rawId.toLowerCase().includes(q)
    );
    if (found) {
      this.activeChannel = found;
      this.emit('active_channel_changed', found);
      return found;
    }
    return null;
  }

  async sendToNumber(phoneNumber, text) {
    await this.wa.sendMessage(phoneNumber, text);
    const jid = WhatsAppAdapter.formatToJid ? WhatsAppAdapter.formatToJid(phoneNumber) : phoneNumber;
    const target = this.channels.find((c) => c.rawId === jid) || {
      id: `wa:${jid}`,
      platform: 'whatsapp',
      rawId: jid,
      displayName: `svc-wa/${phoneNumber}`
    };
    this.activeChannel = target;
    this.emit('active_channel_changed', target);

    const echoMsg = {
      source: 'whatsapp',
      channelId: jid,
      channelName: target.displayName,
      sender: 'You',
      isMe: true,
      text,
      timestamp: Date.now()
    };
    this.messageHistory.push(echoMsg);
    this.emit('message', echoMsg);
  }

  async sendCurrent(text) {
    if (!this.activeChannel) {
      if (this.channels.length > 0) {
        this.activeChannel = this.channels[0];
      } else {
        throw new Error('No target selected. Type ":to <nomor_hp> <pesan>" or ":use <nomor>" to start a chat.');
      }
    }

    const { platform, rawId } = this.activeChannel;

    if (platform === 'whatsapp') {
      await this.wa.sendMessage(rawId, text);
    } else if (platform === 'discord') {
      await this.discord.sendMessage(rawId, text);
    } else if (platform === 'tiktok') {
      await this.tiktok.sendMessage(rawId, text);
    }

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
}

module.exports = ChatHub;
