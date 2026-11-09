const { Client, GatewayIntentBits, Partials } = require('discord.js');
const EventEmitter = require('events');

class DiscordAdapter extends EventEmitter {
  constructor(token) {
    super();
    this.token = token || process.env.DISCORD_TOKEN;
    this.client = null;
    this.isConnected = false;
    this.channels = new Map(); // id -> { id, name, guildName }
  }

  async start() {
    if (!this.token || this.token.trim() === '') {
      this.emit('status', { status: 'disabled', reason: 'No DISCORD_TOKEN in .env' });
      return;
    }

    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.MessageContent
        ],
        partials: [Partials.Channel, Partials.Message]
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.cacheChannels();
        this.emit('status', {
          status: 'connected',
          user: this.client.user?.tag
        });
      });

      this.client.on('messageCreate', (message) => {
        // Ignore self bot messages if needed, or flag as isMe
        const isMe = message.author.id === this.client.user?.id;
        const channelName = message.channel.name ? `#${message.channel.name}` : `DM:${message.author.username}`;

        // Ensure channel is cached
        this.channels.set(message.channel.id, {
          id: message.channel.id,
          name: channelName,
          guildName: message.guild?.name || 'Direct Message'
        });

        this.emit('message', {
          source: 'discord',
          channelId: message.channel.id,
          channelName: `${message.guild ? '[' + message.guild.name + '] ' : ''}${channelName}`,
          sender: message.author.username,
          isMe,
          text: message.content || (message.attachments.size ? '[Attachment]' : ''),
          timestamp: message.createdTimestamp
        });
      });

      this.client.on('error', (err) => {
        this.emit('error', err);
      });

      await this.client.login(this.token);

    } catch (err) {
      this.isConnected = false;
      this.emit('status', { status: 'error', reason: err.message });
    }
  }

  cacheChannels() {
    if (!this.client) return;
    this.client.channels.cache.forEach((ch) => {
      if (ch.isTextBased()) {
        const name = ch.name ? `#${ch.name}` : `DM:${ch.id}`;
        this.channels.set(ch.id, {
          id: ch.id,
          name: `${ch.guild ? '[' + ch.guild.name + '] ' : ''}${name}`,
          guildName: ch.guild?.name || 'Direct Message'
        });
      }
    });
    this.emit('channels_updated', Array.from(this.channels.values()));
  }

  async sendMessage(channelId, text) {
    if (!this.client || !this.isConnected) {
      throw new Error('Discord not connected');
    }
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} not found or not text-based`);
    }
    await channel.send(text);
  }

  getChannels() {
    return Array.from(this.channels.values());
  }
}

module.exports = DiscordAdapter;
