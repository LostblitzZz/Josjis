const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
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
    this.contacts = new Map(); // jid -> { jid, name, lastMessage, timestamp, isGroup }
    this.messages = new Map(); // jid -> [ array of messages ]
    this.saveTimer = null;

    // Load stored messages FIRST to establish true historical timestamps
    this.loadMessagesStore();
    this.loadContactsCache();
  }

  loadMessagesStore() {
    try {
      if (fs.existsSync(this.messagesFile)) {
        const raw = fs.readFileSync(this.messagesFile, 'utf8');
        const entries = JSON.parse(raw);
        for (const [jid, list] of entries) {
          this.messages.set(jid, list);
          if (list && list.length > 0) {
            const last = list[list.length - 1];
            const existing = this.contacts.get(jid) || {};
            const isGroup = jid.endsWith('@g.us');
            this.contacts.set(jid, {
              ...existing,
              jid,
              name: existing.name || last.channelName || jid.split('@')[0],
              lastMessage: last.text,
              timestamp: Math.max(existing.timestamp || 0, last.timestamp || 0),
              isGroup
            });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  loadContactsCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const raw = fs.readFileSync(this.cacheFile, 'utf8');
        const entries = JSON.parse(raw);
        for (const [jid, data] of entries) {
          const isGroup = jid.endsWith('@g.us');
          const storedMsgs = this.messages.get(jid) || [];

          // Cleanse poisoned fake timestamps from earlier bugs:
          // Groups with no messages get timestamp = 0 so they don't bury personal chats!
          let realTimestamp = 0;
          if (storedMsgs.length > 0) {
            realTimestamp = storedMsgs[storedMsgs.length - 1].timestamp || 0;
          } else if (!isGroup && data.timestamp) {
            realTimestamp = data.timestamp;
          }

          this.contacts.set(jid, {
            ...data,
            timestamp: realTimestamp,
            isGroup
          });
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

    const existing = this.contacts.get(msg.channelId) || {};
    const isGroup = msg.channelId.endsWith('@g.us');
    this.contacts.set(msg.channelId, {
      ...existing,
      jid: msg.channelId,
      name: existing.name || msg.channelName || msg.channelId.split('@')[0],
      lastMessage: msg.text,
      timestamp: Math.max(existing.timestamp || 0, msg.timestamp || 0),
      isGroup
    });

    this.saveContactsCache();
    this.scheduleSaveMessages();
  }

  getMessagesForJid(jid) {
    return this.messages.get(jid) || [];
  }

  async start() {
    try {
      if (this.sock) {
        try { this.sock.end(); } catch {}
        this.sock = null;
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1043857760] }));

      this.sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.windows('Chrome'),
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
          this.emit('contacts_updated', this.getRecentChats());

          // 1. Force WhatsApp server to push all app state patches (recent chats & contacts)
          setTimeout(async () => {
            try {
              if (this.sock && this.sock.resyncAppState) {
                await this.sock.resyncAppState(
                  ['critical_block', 'critical_unblock_low', 'regular_high', 'regular_low', 'regular'],
                  false
                );
              }
            } catch {
              // ignore
            }
          }, 500);

          // 2. Fetch group metadata (KEEP timestamp = 0 if no message history!)
          setTimeout(async () => {
            try {
              if (this.sock && this.sock.groupFetchAllParticipating) {
                const groups = await this.sock.groupFetchAllParticipating();
                if (groups) {
                  for (const [id, meta] of Object.entries(groups)) {
                    const existing = this.contacts.get(id) || {};
                    const storedMsgs = this.messages.get(id) || [];
                    const ts = storedMsgs.length > 0
                      ? (storedMsgs[storedMsgs.length - 1].timestamp || 0)
                      : (existing.timestamp || 0);

                    this.contacts.set(id, {
                      ...existing,
                      jid: id,
                      name: meta.subject || existing.name || `Grup (${id.slice(0, 8)})`,
                      timestamp: ts,
                      isGroup: true
                    });
                  }
                  this.saveContactsCache();
                  this.emit('contacts_updated', this.getRecentChats());
                }
              }
            } catch {
              // ignore
            }
          }, 1500);
        }
      });

      // Synchronize full chat & message history from WhatsApp
      this.sock.ev.on('messaging-history.set', ({ chats, contacts, messages }) => {
        // 1. Address book contacts
        if (contacts && contacts.length) {
          for (const c of contacts) {
            if (!c.id) continue;
            const existing = this.contacts.get(c.id) || {};
            const name = c.notify || c.verifiedName || c.name || existing.name;
            if (name) {
              this.contacts.set(c.id, {
                ...existing,
                jid: c.id,
                name,
                isGroup: c.id.endsWith('@g.us')
              });
            }
          }
        }

        // 2. Chats (both private and group)
        if (chats && chats.length) {
          for (const ch of chats) {
            if (!ch.id) continue;
            const existing = this.contacts.get(ch.id) || {};
            const isGroup = ch.id.endsWith('@g.us');
            const resolvedName = ch.name || existing.name || ch.id.split('@')[0];
            const timestamp = Number(ch.conversationTimestamp) * 1000 || existing.timestamp || 0;
            this.contacts.set(ch.id, {
              ...existing,
              jid: ch.id,
              name: resolvedName,
              timestamp,
              isGroup
            });
          }
        }

        // 3. Historical messages
        if (messages && messages.length) {
          for (const msg of messages) {
            if (!msg.message) continue;
            const jid = msg.key.remoteJid;
            if (!jid || jid === 'status@broadcast') continue;

            const isMe = Boolean(msg.key.fromMe);
            const rawSender = msg.pushName || jid.split('@')[0];
            const senderName = isMe ? 'You' : rawSender;
            const text = extractMessageText(msg.message);
            const timestamp = Number(msg.messageTimestamp) * 1000 || 0;

            const isGroup = jid.endsWith('@g.us');
            const existing = this.contacts.get(jid) || {};
            const resolvedName = isGroup
              ? (existing.name || `Grup (${jid.slice(0, 8)})`)
              : (existing.name || (senderName !== 'You' ? senderName : jid.split('@')[0]));

            this.contacts.set(jid, {
              ...existing,
              jid,
              name: resolvedName,
              lastMessage: text,
              timestamp: Math.max(existing.timestamp || 0, timestamp),
              isGroup
            });

            this.storeMessage({
              source: 'whatsapp',
              channelId: jid,
              channelName: resolvedName,
              sender: senderName,
              isMe,
              isGroup,
              text,
              timestamp
            });
          }
        }

        this.saveContactsCache();
        this.emit('contacts_updated', this.getRecentChats());
      });

      // Handle chat additions/updates
      this.sock.ev.on('chats.upsert', (newChats) => {
        for (const ch of newChats) {
          if (!ch.id) continue;
          const existing = this.contacts.get(ch.id) || {};
          const isGroup = ch.id.endsWith('@g.us');
          const resolvedName = ch.name || existing.name || ch.id.split('@')[0];
          const timestamp = Number(ch.conversationTimestamp) * 1000 || existing.timestamp || 0;
          this.contacts.set(ch.id, {
            ...existing,
            jid: ch.id,
            name: resolvedName,
            timestamp,
            isGroup
          });
        }
        this.saveContactsCache();
        this.emit('contacts_updated', this.getRecentChats());
      });

      // Incoming messages
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
            ? (existingContact.name || `Grup (${jid.slice(0, 8)})`)
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
          this.emit('contacts_updated', this.getRecentChats());
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
            name: resolvedName,
            isGroup: c.id.endsWith('@g.us')
          });
        }
        this.saveContactsCache();
        this.emit('contacts_updated', this.getRecentChats());
      });

      this.sock.ev.on('groups.update', (updates) => {
        for (const g of updates) {
          if (g.id && g.subject) {
            const existing = this.contacts.get(g.id) || {};
            this.contacts.set(g.id, {
              ...existing,
              jid: g.id,
              name: g.subject,
              isGroup: true
            });
          }
        }
        this.saveContactsCache();
        this.emit('contacts_updated', this.getRecentChats());
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
    this.emit('contacts_updated', this.getRecentChats());
  }

  getRecentChats() {
    // 1. Active chats with messages (timestamp > 0) strictly descending
    // 2. Personal contacts (isGroup === false) alphabetical
    // 3. Inactive groups at the very bottom
    const list = Array.from(this.contacts.values());
    list.sort((a, b) => {
      const aTime = a.timestamp || 0;
      const bTime = b.timestamp || 0;
      if (aTime > 0 && bTime > 0) return bTime - aTime;
      if (aTime > 0) return -1;
      if (bTime > 0) return 1;
      if (!a.isGroup && b.isGroup) return -1;
      if (a.isGroup && !b.isGroup) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    return list;
  }

  async resync() {
    if (!this.sock || !this.isConnected) return false;
    try {
      if (this.sock.resyncAppState) {
        await this.sock.resyncAppState(
          ['critical_block', 'critical_unblock_low', 'regular_high', 'regular_low', 'regular'],
          false
        );
      }
      if (this.sock.groupFetchAllParticipating) {
        const groups = await this.sock.groupFetchAllParticipating();
        if (groups) {
          for (const [id, meta] of Object.entries(groups)) {
            const existing = this.contacts.get(id) || {};
            const storedMsgs = this.messages.get(id) || [];
            const ts = storedMsgs.length > 0
              ? (storedMsgs[storedMsgs.length - 1].timestamp || 0)
              : (existing.timestamp || 0);

            this.contacts.set(id, {
              ...existing,
              jid: id,
              name: meta.subject || existing.name || `Grup (${id.slice(0, 8)})`,
              timestamp: ts,
              isGroup: true
            });
          }
        }
      }
      this.saveContactsCache();
      this.emit('contacts_updated', this.getRecentChats());
      return true;
    } catch {
      return false;
    }
  }

  clearCache() {
    this.contacts.clear();
    this.messages.clear();
    try {
      if (fs.existsSync(this.cacheFile)) fs.unlinkSync(this.cacheFile);
      if (fs.existsSync(this.messagesFile)) fs.unlinkSync(this.messagesFile);
    } catch {
      // ignore
    }
    this.emit('contacts_updated', []);
  }
}

module.exports = WhatsAppAdapter;
module.exports.formatToJid = formatToJid;
