const blessed = require('blessed');
const { getRandomLog } = require('./panicLogs');

function createSplitUI(hub) {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'syslog-worker - /var/log/cluster.log',
    fullUnicode: true,
    dockBorders: false
  });

  let isCamouflage = true;
  let isPanicMode = false;
  let panicInterval = null;
  let isReading = false;

  // Left Column: Contact List (WhatsApp style)
  const contactList = blessed.list({
    parent: screen,
    top: 0,
    left: 0,
    width: '32%',
    height: '100%',
    border: { type: 'line' },
    label: ' Chats ',
    keys: true,
    vi: true,
    mouse: true,
    style: {
      border: { fg: 'gray' },
      selected: { bg: 'blue', fg: 'white', bold: true },
      item: { fg: 'white' }
    },
    items: ['[Memuat kontak WhatsApp...]']
  });

  // Right Top: Active Conversation Thread
  const chatBox = blessed.log({
    parent: screen,
    top: 0,
    left: '32%',
    width: '68%',
    height: '100%-3',
    border: { type: 'line' },
    label: ' Obrolan: [Pilih Kontak] ',
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: '│',
      style: { fg: 'gray' }
    },
    style: {
      border: { fg: 'gray' },
      fg: 'white'
    }
  });

  // Right Bottom: Message Input Box
  const inputBox = blessed.textbox({
    parent: screen,
    bottom: 0,
    left: '32%',
    width: '68%',
    height: 3,
    border: { type: 'line' },
    label: ' Pesan (Enter: kirim | Tab: pilih kontak | Esc: panic) ',
    style: {
      border: { fg: 'gray' },
      fg: 'white'
    }
  });

  // Fullscreen Panic Overlay Box
  const panicBox = blessed.log({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    hidden: true,
    border: { type: 'line' },
    label: ' /usr/bin/cargo build --release -j 8 ',
    style: {
      border: { fg: 'green' },
      fg: 'green'
    }
  });

  function getCleanName(raw) {
    if (!raw) return 'Unknown';
    return raw.replace(/^svc-(wa|dc)\//, '');
  }

  function formatMessage(msg) {
    const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sender = msg.isMe ? 'You' : (msg.sender || 'Sender');

    if (isCamouflage) {
      if (msg.isMe) {
        return `\x1b[90m[${time}]\x1b[0m \x1b[32m[ACK]\x1b[0m  \x1b[33m[dispatch]\x1b[0m payload: "${msg.text}"`;
      } else {
        return `\x1b[90m[${time}]\x1b[0m \x1b[36m[INFO]\x1b[0m \x1b[35m[sys/${sender}]\x1b[0m payload: "${msg.text}"`;
      }
    } else {
      const color = msg.isMe ? '\x1b[32m' : '\x1b[36m';
      return `\x1b[90m[${time}]\x1b[0m ${color}${sender}:\x1b[0m ${msg.text}`;
    }
  }

  function renderActiveConversation() {
    chatBox.setContent('');
    if (!hub.activeChannel) {
      chatBox.log('\x1b[90mGunakan panah atas/bawah lalu tekan Enter di panel kiri untuk memilih chat.\x1b[0m');
      screen.render();
      return;
    }

    const cleanName = getCleanName(hub.activeChannel.displayName);
    chatBox.setLabel(` Obrolan: [${cleanName}] `);
    inputBox.setLabel(` Kirim ke [${cleanName}] (Enter: kirim, Tab: daftar) `);

    const relevant = hub.getMessagesForChannel(hub.activeChannel.rawId);
    if (!relevant || relevant.length === 0) {
      chatBox.log(`\x1b[90mBelum ada pesan sebelumnya dengan ${cleanName}. Ketik pesan di bawah untuk mulai kirim.\x1b[0m`);
    } else {
      for (const m of relevant) {
        chatBox.log(formatMessage(m));
      }
    }
    screen.render();
  }

  function updateContactsList(channels) {
    if (!channels || channels.length === 0) {
      contactList.setItems(['[Menunggu sinkronisasi kontak...]']);
    } else {
      const items = channels.map((c) => {
        const isCurrent = hub.activeChannel && hub.activeChannel.id === c.id;
        const name = getCleanName(c.displayName);
        return `${isCurrent ? '● ' : '  '}${name}`;
      });
      contactList.setItems(items);
    }
    screen.render();
  }

  function togglePanic() {
    isPanicMode = !isPanicMode;
    if (isPanicMode) {
      if (isReading) {
        isReading = false;
        inputBox.cancel();
      }
      panicBox.show();
      panicBox.focus();
      contactList.hide();
      chatBox.hide();
      inputBox.hide();

      panicInterval = setInterval(() => {
        panicBox.log(getRandomLog());
        screen.render();
      }, 55);
    } else {
      clearInterval(panicInterval);
      panicInterval = null;
      panicBox.hide();
      contactList.show();
      chatBox.show();
      inputBox.show();
      focusInput();
    }
    screen.render();
  }

  function startInputLoop() {
    if (isReading || isPanicMode) return;
    isReading = true;

    inputBox.readInput(async (err, value) => {
      isReading = false;
      if (err) return;

      const text = (value || '').trim();
      inputBox.clearValue();
      screen.render();

      if (!text) {
        if (!isPanicMode && inputBox.focused) {
          startInputLoop();
        }
        return;
      }

      // Built-in commands
      if (text === '/g' || text === ':p' || text === '/panic') {
        togglePanic();
        return;
      }

      if (text === '/c' || text === '/mode') {
        isCamouflage = !isCamouflage;
        renderActiveConversation();
        if (!isPanicMode) startInputLoop();
        return;
      }

      if (text.startsWith('/to ')) {
        const match = text.match(/^\/to\s+(\S+)\s+(.+)$/);
        if (match) {
          try {
            await hub.sendToNumber(match[1], match[2]);
            renderActiveConversation();
          } catch (e) {
            chatBox.log(`\x1b[31m[ERROR]\x1b[0m ${e.message}`);
          }
        }
        if (!isPanicMode) startInputLoop();
        return;
      }

      if (text === '/q' || text === ':q') {
        process.exit(0);
      }

      // Send to active channel
      try {
        await hub.sendCurrent(text);
        renderActiveConversation();
      } catch (sendErr) {
        chatBox.log(`\x1b[31m[ERROR]\x1b[0m ${sendErr.message}`);
      }

      if (!isPanicMode) {
        startInputLoop();
      }
    });
  }

  function focusInput() {
    inputBox.focus();
    startInputLoop();
    screen.render();
  }

  function focusList() {
    if (isReading) {
      isReading = false;
      inputBox.cancel();
    }
    contactList.focus();
    screen.render();
  }

  // Intercept keys at the lowest driver level via screen.program
  screen.program.on('keypress', (ch, key) => {
    if (!key) return;

    // Panic Hotkeys: Escape, F3, Ctrl+P
    if (key.name === 'f3' || key.name === 'escape' || (key.ctrl && key.name === 'p')) {
      togglePanic();
      return;
    }

    if (isPanicMode) {
      if (key.name === 'space' || key.name === 'return' || key.name === 'enter' || ch === 'q') {
        togglePanic();
      }
      return;
    }

    // Switch pane: Tab
    if (key.name === 'tab') {
      if (inputBox.focused) {
        focusList();
      } else {
        focusInput();
      }
      return;
    }

    // Quit: Ctrl+C
    if (key.ctrl && key.name === 'c') {
      process.exit(0);
    }
  });

  // When a contact is selected from the list
  contactList.on('select', (item, index) => {
    if (hub.channels && hub.channels[index]) {
      hub.setActiveChannel(hub.channels[index].id);
      updateContactsList(hub.channels);
      renderActiveConversation();
    }
    focusInput();
  });

  // Hub Event Listeners
  hub.on('platform_status', (st) => {
    if (st.platform === 'whatsapp' && st.status === 'connected') {
      chatBox.log(`\x1b[32m[SUCCESS]\x1b[0m WhatsApp TERHUBUNG & SINKRON!`);
      updateContactsList(hub.channels);
      renderActiveConversation();
    }
  });

  hub.on('message', (msg) => {
    if (hub.activeChannel && msg.channelId === hub.activeChannel.rawId) {
      chatBox.log(formatMessage(msg));
      screen.render();
    } else {
      // Incoming message from other contact: update contact list snippet
      updateContactsList(hub.channels);
    }
  });

  hub.on('channels_updated', (channels) => {
    updateContactsList(channels);
  });

  hub.on('active_channel_changed', () => {
    updateContactsList(hub.channels);
    renderActiveConversation();
  });

  // Initial setup
  updateContactsList(hub.channels);
  renderActiveConversation();
  focusInput();

  return { screen };
}

module.exports = { createSplitUI };
