const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const EventEmitter = require('events');

class WhatsAppAdapter extends EventEmitter {
  constructor(authDir) {
    super();
    this.authDir = authDir || path.join(__dirname, '../../auth/wa_session');
    this.sock = null;
    this.isConnected = false;
    this.contacts = new Map(); // jid -> { name, lastMessage, timestamp }
  }

  async start() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      this.sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '124.0.0']
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.emit('qr', qr);
        }

        if (connection === 'close') {
          this.isConnected = false;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          this.emit('status', {
            status: 'disconnected',
            reconnecting: shouldReconnect,
            reason: statusCode
          });

          if (shouldReconnect) {
            setTimeout(() => this.start(), 3000);
          }
        } else if (connection === 'open') {
          this.isConnected = true;
          this.emit('status', { status: 'connected' });
        }
      });

      this.sock.ev.on('messages.upsert', (m) => {
        if (!m.messages || !m.messages.length) return;

        for (const msg of m.messages) {
          if (!msg.message) continue;

          const jid = msg.key.remoteJid;
          if (jid === 'status@broadcast') continue; // ignore WA status stories

          const isMe = Boolean(msg.key.fromMe);
          const senderName = isMe ? 'You' : (msg.pushName || jid.split('@')[0]);

          const text = msg.message?.conversation ||
                       msg.message?.extendedTextMessage?.text ||
                       msg.message?.imageMessage?.caption ||
                       (msg.message?.imageMessage ? '[Photo]' : null) ||
                       (msg.message?.audioMessage ? '[Voice Note]' : null) ||
                       (msg.message?.videoMessage ? '[Video]' : null) ||
                       (msg.message?.documentMessage ? '[Document]' : null) ||
                       '[Unsupported message]';

          const timestamp = Number(msg.messageTimestamp) * 1000 || Date.now();

          // update contacts cache
          this.contacts.set(jid, {
            jid,
            name: senderName !== 'You' ? senderName : (this.contacts.get(jid)?.name || jid.split('@')[0]),
            lastMessage: text,
            timestamp
          });

          this.emit('message', {
            source: 'whatsapp',
            channelId: jid,
            channelName: this.contacts.get(jid)?.name || jid.split('@')[0],
            sender: senderName,
            isMe,
            text,
            timestamp
          });
        }
      });

      // Track incoming chat list updates
      this.sock.ev.on('contacts.upsert', (newContacts) => {
        for (const c of newContacts) {
          if (!c.id) continue;
          const existing = this.contacts.get(c.id) || {};
          this.contacts.set(c.id, {
            ...existing,
            jid: c.id,
            name: c.notify || c.verifiedName || c.name || existing.name || c.id.split('@')[0]
          });
        }
        this.emit('contacts_updated', Array.from(this.contacts.values()));
      });

    } catch (err) {
      this.emit('error', err);
    }
  }

  async sendMessage(jid, text) {
    if (!this.sock || !this.isConnected) {
      throw new Error('WhatsApp not connected');
    }
    await this.sock.sendMessage(jid, { text });
  }

  getRecentChats() {
    return Array.from(this.contacts.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }
}

module.exports = WhatsAppAdapter;
