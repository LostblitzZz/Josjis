const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

function formatToJid(target) {
  if (!target) return '';
  const trimmed = target.trim();
  if (trimmed.includes('@')) return trimmed;
  let clean = trimmed.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  return `${clean}@s.whatsapp.net`;
}

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
    return `[Audio: ${sec}s]`;
  }

  if (m.stickerMessage) {
    return '[Sticker]';
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
    return `[Poll: "${poll.name || 'poll'}"]`;
  }

  if (m.pollUpdateMessage) {
    return '[Poll vote recorded]';
  }

  if (m.protocolMessage) {
    if (m.protocolMessage.type === 0 || m.protocolMessage.type === 'REVOKE') {
      return '[Message deleted]';
    }
    return '[Protocol sync]';
  }

  for (const key of Object.keys(m)) {
    const val = m[key];
    if (val && typeof val === 'object') {
      if (typeof val.text === 'string' && val.text) return val.text;
      if (typeof val.caption === 'string' && val.caption) return val.caption;
      if (typeof val.displayName === 'string' && val.displayName) return val.displayName;
    }
  }

  return '[Notification]';
}

class WhatsAppAdapter extends EventEmitter {
  constructor(authDir) {
    super();
    this.authDir = authDir || path.join(__dirname, '../../auth/wa_session');
    this.cacheFile = path.join(this.authDir, 'contacts_cache.json');
    this.messagesFile = path.join(this.authDir, 'messages_store.json');
    this.sock = null;
    this.isConnected = false;
    this.contacts = new Map(); // jid -> { jid, name, lastMessage, timestamp }
    this.messages = new Map(); // jid -> [ array of messages ]
    this.saveTimer = null;

    this.loadContactsCache();
    this.loadMessagesStore();
  }

  loadContactsCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const raw = fs.readFileSync(this.cacheFile, 'utf8');
        const entries = JSON.parse(raw);
        for (const [jid, data] of entries) {
          this.contacts.set(jid, data);
        }
      }
    } catch {
      // ignore
    }
  }

  saveContactsCache() {
    try {
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }
      const data = JSON.stringify(Array.from(this.contacts.entries()), null, 2);
      fs.writeFileSync(this.cacheFile, data, 'utf8');
    } catch {
      // ignore
    }
  }

  loadMessagesStore() {
    try {
      if (fs.existsSync(this.messagesFile)) {
        const raw = fs.readFileSync(this.messagesFile, 'utf8');
        const entries = JSON.parse(raw);
        for (const [jid, list] of entries) {
          this.messages.set(jid, list);
        }
      }
    } catch {
      // ignore
    }
  }

  scheduleSaveMessages() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        if (!fs.existsSync(this.authDir)) {
          fs.mkdirSync(this.authDir, { recursive: true });
        }
        const data = JSON.stringify(Array.from(this.messages.entries()));
        fs.writeFileSync(this.messagesFile, data, 'utf8');
      } catch {
        // ignore
      }
    }, 1500);
  }

  storeMessage(msg) {
    if (!msg || !msg.channelId) return;
    if (!this.messages.has(msg.channelId)) {
      this.messages.set(msg.channelId, []);
    }
    const list = this.messages.get(msg.channelId);

    // Deduplicate
    const exists = list.some(
      (m) => m.timestamp === msg.timestamp && m.text === msg.text && m.isMe === msg.isMe
    );
    if (!exists) {
      list.push(msg);
      list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      if (list.length > 250) {
        list.shift();
      }
    }

    // Update contacts last message
    const existing = this.contacts.get(msg.channelId) || {};
    this.contacts.set(msg.channelId, {
      ...existing,
      jid: msg.channelId,
      name: existing.name || msg.channelName || msg.channelId.split('@')[0],
      lastMessage: msg.text,
      timestamp: Math.max(existing.timestamp || 0, msg.timestamp || 0)
    });

    this.saveContactsCache();
    this.scheduleSaveMessages();
  }

  getMessagesForJid(jid) {
    return this.messages.get(jid) || [];
  }

  async start() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      this.sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '124.0.0'],
        syncFullHistory: true
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
          this.emit('contacts_updated', Array.from(this.contacts.values()));

          // Fetch all groups actively upon connect
          setTimeout(async () => {
            try {
              if (this.sock && this.sock.groupFetchAllParticipating) {
                const groups = await this.sock.groupFetchAllParticipating();
                if (groups) {
                  for (const [id, meta] of Object.entries(groups)) {
                    const existing = this.contacts.get(id) || {};
                    this.contacts.set(id, {
                      ...existing,
                      jid: id,
                      name: meta.subject || `Group (${id.slice(0, 8)})`,
                      timestamp: existing.timestamp || Date.now()
                    });
                  }
                  this.saveContactsCache();
                  this.emit('contacts_updated', Array.from(this.contacts.values()));
                }
              }
            } catch {
              // ignore
            }
          }, 1000);
        }
      });

      // Synchronize full chat & message history from WhatsApp
      this.sock.ev.on('messaging-history.set', ({ chats, contacts, messages }) => {
        if (contacts && contacts.length) {
          for (const c of contacts) {
            if (!c.id) continue;
            const existing = this.contacts.get(c.id) || {};
            const name = c.notify || c.verifiedName || c.name || existing.name;
            if (name) {
              this.contacts.set(c.id, {
                ...existing,
                jid: c.id,
                name
              });
            }
          }
        }

        if (chats && chats.length) {
          for (const ch of chats) {
            if (!ch.id) continue;
            const existing = this.contacts.get(ch.id) || {};
            const resolvedName = ch.name || existing.name || ch.id.split('@')[0];
            const timestamp = Number(ch.conversationTimestamp) * 1000 || existing.timestamp || Date.now();
            this.contacts.set(ch.id, {
              ...existing,
              jid: ch.id,
              name: resolvedName,
              timestamp
            });
          }
        }

        // Unpack all historical messages synced from WhatsApp!
        if (messages && messages.length) {
          for (const msg of messages) {
            if (!msg.message) continue;
            const jid = msg.key.remoteJid;
            if (!jid || jid === 'status@broadcast') continue;

            const isMe = Boolean(msg.key.fromMe);
            const rawSender = msg.pushName || jid.split('@')[0];
            const senderName = isMe ? 'You' : rawSender;
            const text = extractMessageText(msg.message);
            const timestamp = Number(msg.messageTimestamp) * 1000 || Date.now();

            this.storeMessage({
              source: 'whatsapp',
              channelId: jid,
              channelName: this.contacts.get(jid)?.name || senderName,
              sender: senderName,
              isMe,
              text,
              timestamp
            });
          }
        }

        this.saveContactsCache();
        this.emit('contacts_updated', Array.from(this.contacts.values()));
      });

      // Handle chat additions
      this.sock.ev.on('chats.upsert', (newChats) => {
        for (const ch of newChats) {
          if (!ch.id) continue;
          const existing = this.contacts.get(ch.id) || {};
          const resolvedName = ch.name || existing.name || ch.id.split('@')[0];
          const timestamp = Number(ch.conversationTimestamp) * 1000 || existing.timestamp || Date.now();
          this.contacts.set(ch.id, {
            ...existing,
            jid: ch.id,
            name: resolvedName,
            timestamp
          });
        }
        this.saveContactsCache();
        this.emit('contacts_updated', Array.from(this.contacts.values()));
      });

      // Handle incoming messages
      this.sock.ev.on('messages.upsert', (m) => {
        if (!m.messages || !m.messages.length) return;

        for (const msg of m.messages) {
          if (!msg.message) continue;

          const jid = msg.key.remoteJid;
          if (!jid || jid === 'status@broadcast') continue;

          const isMe = Boolean(msg.key.fromMe);
          const rawSender = msg.pushName || jid.split('@')[0];
          const senderName = isMe ? 'You' : rawSender;

          const text = extractMessageText(msg.message);
          const timestamp = Number(msg.messageTimestamp) * 1000 || Date.now();

          const isGroup = jid.endsWith('@g.us');
          const existingContact = this.contacts.get(jid) || {};
          const chatDisplayName = isGroup
            ? (existingContact.name || `grp-${jid.slice(0, 8)}`)
            : (existingContact.name || (senderName !== 'You' ? senderName : jid.split('@')[0]));

          const packet = {
            source: 'whatsapp',
            channelId: jid,
            channelName: chatDisplayName,
            sender: senderName,
            isMe,
            isGroup,
            text,
            timestamp
          };

          this.storeMessage(packet);
          this.emit('message', packet);
        }
      });

      // Contact updates
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
        this.saveContactsCache();
        this.emit('contacts_updated', Array.from(this.contacts.values()));
      });

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
        this.saveContactsCache();
        this.emit('contacts_updated', Array.from(this.contacts.values()));
      });

    } catch (err) {
      this.emit('error', err);
    }
  }

  async sendMessage(target, text) {
    if (!this.sock || !this.isConnected) {
      throw new Error('WhatsApp socket not connected yet.');
    }
    const jid = formatToJid(target);
    await this.sock.sendMessage(jid, { text });

    const msgPacket = {
      source: 'whatsapp',
      channelId: jid,
      channelName: this.contacts.get(jid)?.name || jid.split('@')[0],
      sender: 'You',
      isMe: true,
      text,
      timestamp: Date.now()
    };

    this.storeMessage(msgPacket);
    this.emit('contacts_updated', Array.from(this.contacts.values()));
  }

  getRecentChats() {
    return Array.from(this.contacts.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }
}

module.exports = WhatsAppAdapter;
module.exports.formatToJid = formatToJid;
