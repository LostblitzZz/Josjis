const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const EventEmitter = require('events');

function unwrapMessage(msg) {
  if (!msg) return {};
  let current = msg;
  while (current) {
    if (current.ephemeralMessage) {
      current = current.ephemeralMessage.message;
    } else if (current.viewOnceMessage) {
      current = current.viewOnceMessage.message;
    } else if (current.viewOnceMessageV2) {
      current = current.viewOnceMessageV2.message;
    } else if (current.viewOnceMessageV2Extension) {
      current = current.viewOnceMessageV2Extension.message;
    } else if (current.documentWithCaptionMessage) {
      current = current.documentWithCaptionMessage.message;
    } else if (current.editedMessage) {
      current = current.editedMessage.message?.protocolMessage?.editedMessage || current.editedMessage.message;
    } else {
      break;
    }
  }
  return current || {};
}

function extractMessageText(rawMsg) {
  if (!rawMsg) return '[Empty payload]';
  const m = unwrapMessage(rawMsg);

  if (m.conversation) {
    return m.conversation;
  }

  if (m.extendedTextMessage) {
    const text = m.extendedTextMessage.text || '';
    const quote = m.extendedTextMessage.contextInfo?.quotedMessage;
    if (quote) {
      const qText = extractMessageText(quote);
      const cleanQuote = qText.replace(/\n/g, ' ').slice(0, 24);
      return `[quote: "${cleanQuote}${qText.length > 24 ? '...' : ''}"] ${text}`;
    }
    return text || '[Text payload]';
  }

  if (m.imageMessage) {
    return m.imageMessage.caption ? `[Image: "${m.imageMessage.caption}"]` : '[Media: Image]';
  }

  if (m.videoMessage) {
    return m.videoMessage.caption ? `[Video: "${m.videoMessage.caption}"]` : '[Media: Video]';
  }

  if (m.audioMessage) {
    const sec = m.audioMessage.seconds || 0;
    return `[Audio payload: ${sec}s]`;
  }

  if (m.stickerMessage) {
    return '[Sticker asset]';
  }

  if (m.documentMessage) {
    const fn = m.documentMessage.fileName || 'file';
    return `[Document: ${fn}]`;
  }

  if (m.reactionMessage) {
    return `[Reaction: ${m.reactionMessage.text || 'emoji'}]`;
  }

  if (m.contactMessage) {
    return `[Contact: ${m.contactMessage.displayName || 'card'}]`;
  }

  if (m.contactsArrayMessage) {
    return `[Contacts: ${m.contactsArrayMessage.contacts?.length || 0} cards]`;
  }

  if (m.locationMessage) {
    return `[Location: ${m.locationMessage.degreesLatitude?.toFixed(4)}, ${m.locationMessage.degreesLongitude?.toFixed(4)}]`;
  }

  if (m.pollCreationMessage || m.pollCreationMessageV2 || m.pollCreationMessageV3) {
    const poll = m.pollCreationMessage || m.pollCreationMessageV2 || m.pollCreationMessageV3;
    return `[Poll created: "${poll.name || 'poll'}"]`;
  }

  if (m.pollUpdateMessage) {
    return '[Poll vote recorded]';
  }

  if (m.protocolMessage) {
    if (m.protocolMessage.type === 0 || m.protocolMessage.type === 'REVOKE') {
      return '[Message revoked / deleted]';
    }
    return '[System protocol sync]';
  }

  // Fallback scan for string properties in case of future WA message formats
  for (const key of Object.keys(m)) {
    const val = m[key];
    if (val && typeof val === 'object') {
      if (typeof val.text === 'string' && val.text) return val.text;
      if (typeof val.caption === 'string' && val.caption) return val.caption;
      if (typeof val.displayName === 'string' && val.displayName) return val.displayName;
    }
  }

  return '[System notification]';
}

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
          if (!jid || jid === 'status@broadcast') continue; // ignore status stories

          const isMe = Boolean(msg.key.fromMe);
          const rawSender = msg.pushName || jid.split('@')[0];
          const senderName = isMe ? 'You' : rawSender;

          const text = extractMessageText(msg.message);
          const timestamp = Number(msg.messageTimestamp) * 1000 || Date.now();

          // If group chat, remoteJid is @g.us
          const isGroup = jid.endsWith('@g.us');
          const existingContact = this.contacts.get(jid) || {};
          const chatDisplayName = isGroup
            ? (existingContact.name || `grp-${jid.slice(0, 8)}`)
            : (existingContact.name || senderName);

          // Update contacts cache
          this.contacts.set(jid, {
            jid,
            name: chatDisplayName,
            lastMessage: text,
            timestamp
          });

          this.emit('message', {
            source: 'whatsapp',
            channelId: jid,
            channelName: chatDisplayName,
            sender: senderName,
            isMe,
            isGroup,
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
          const resolvedName = c.notify || c.verifiedName || c.name || existing.name || c.id.split('@')[0];
          this.contacts.set(c.id, {
            ...existing,
            jid: c.id,
            name: resolvedName
          });
        }
        this.emit('contacts_updated', Array.from(this.contacts.values()));
      });

      // Group metadata updates for group names
      this.sock.ev.on('groups.update', (updates) => {
        for (const g of updates) {
          if (g.id && g.subject) {
            const existing = this.contacts.get(g.id) || {};
            this.contacts.set(g.id, {
              ...existing,
              jid: g.id,
              name: g.subject
            });
          }
        }
        this.emit('contacts_updated', Array.from(this.contacts.values()));
      });

    } catch (err) {
      this.emit('error', err);
    }
  }

  async sendMessage(jid, text) {
    if (!this.sock || !this.isConnected) {
      throw new Error('WhatsApp socket not connected');
    }
    await this.sock.sendMessage(jid, { text });
  }

  getRecentChats() {
    return Array.from(this.contacts.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }
}

module.exports = WhatsAppAdapter;
