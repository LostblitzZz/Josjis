const blessed = require('blessed');
const { getRandomLog } = require('./panicLogs');

function createUI(hub) {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'syslogd - /var/log/cluster/service.log',
    dockBorders: true,
    fullUnicode: true
  });

  let isStealthMode = true;
  let isPanicMode = false;
  let panicInterval = null;

  // Header Bar
  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    border: { type: 'line' },
    style: {
      border: { fg: 'gray' },
      fg: 'white'
    },
    content: ' [SYS-MONITOR v3.1] Node: prod-node-02 | Mode: STEALTH [F2] | [F3] Panic Build | [Tab] Switch Pane | [Ctrl+C] Exit'
  });

  // Left Column: Channels
  const channelList = blessed.list({
    parent: screen,
    top: 3,
    left: 0,
    width: '32%',
    height: '100%-3',
    border: { type: 'line' },
    label: ' Active Services / Channels ',
    keys: true,
    vi: true,
    mouse: true,
    style: {
      border: { fg: 'blue' },
      selected: { bg: 'blue', fg: 'white', bold: true },
      item: { fg: 'white' }
    },
    items: ['[Waiting for connections...]']
  });

  // Right Top: Messages / Event Stream
  const logBox = blessed.log({
    parent: screen,
    top: 3,
    left: '32%',
    width: '68%',
    height: '100%-6',
    border: { type: 'line' },
    label: ' Stream Inspector (/dev/pts/1) ',
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: '│',
      style: { fg: 'gray' }
    },
    style: {
      border: { fg: 'green' },
      fg: 'white'
    }
  });

  // Right Bottom: Input Command Box
  const inputBox = blessed.textbox({
    parent: screen,
    bottom: 0,
    left: '32%',
    width: '68%',
    height: 3,
    border: { type: 'line' },
    label: ' Command / Message Input (Press Enter to Dispatch) ',
    inputOnFocus: true,
    style: {
      border: { fg: 'cyan' },
      fg: 'white'
    }
  });

  // Panic Overlay Box (Hidden by default)
  const panicBox = blessed.log({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    hidden: true,
    border: { type: 'line' },
    label: ' cargo build --release --target x86_64-unknown-linux-gnu ',
    style: {
      border: { fg: 'green' },
      fg: 'green'
    }
  });

  function formatMessage(msg) {
    const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString();
    const sender = msg.isMe ? 'You' : msg.sender;
    const tag = msg.source === 'whatsapp' ? 'wa-worker' : (msg.source === 'discord' ? 'dc-gateway' : 'tk-im');

    if (isStealthMode) {
      // Looks 100% like backend syslog / debug traces
      const level = msg.isMe ? 'ACK' : 'INFO';
      return `\x1b[90m[${time}]\x1b[0m \x1b[36m[${level}]\x1b[0m \x1b[33m<${tag}::${sender}>\x1b[0m payload: "${msg.text}"`;
    } else {
      // Clean chat mode
      const color = msg.isMe ? '\x1b[32m' : '\x1b[34m';
      return `\x1b[90m[${time}]\x1b[0m ${color}${sender}:\x1b[0m ${msg.text}`;
    }
  }

  function appendLog(line) {
    logBox.log(line);
    screen.render();
  }

  function updateChannelList(channels) {
    if (!channels || channels.length === 0) {
      channelList.setItems(['[No active chats yet]']);
    } else {
      const items = channels.map((c) => {
        const isCurrent = hub.activeChannel && hub.activeChannel.id === c.id;
        return `${isCurrent ? '● ' : '  '}${c.displayName}`;
      });
      channelList.setItems(items);
    }
    screen.render();
  }

  // Panic Mode Toggle
  function togglePanic() {
    isPanicMode = !isPanicMode;
    if (isPanicMode) {
      panicBox.show();
      panicBox.focus();
      header.hide();
      channelList.hide();
      logBox.hide();
      inputBox.hide();

      panicInterval = setInterval(() => {
        panicBox.log(getRandomLog());
        screen.render();
      }, 70);
    } else {
      clearInterval(panicInterval);
      panicInterval = null;
      panicBox.hide();
      header.show();
      channelList.show();
      logBox.show();
      inputBox.show();
      inputBox.focus();
    }
    screen.render();
  }

  // Hub Event Listeners
  hub.on('platform_status', (st) => {
    appendLog(`\x1b[90m[SYSTEM]\x1b[0m Service [${st.platform}] status changed: ${st.status} ${st.reason ? '(' + st.reason + ')' : ''}`);
  });

  hub.on('message', (msg) => {
    appendLog(formatMessage(msg));
  });

  hub.on('channels_updated', (channels) => {
    updateChannelList(channels);
  });

  hub.on('active_channel_changed', (channel) => {
    updateChannelList(hub.channels);
    appendLog(`\x1b[90m[SYSTEM]\x1b[0m Switched active stream to: \x1b[33m${channel.displayName}\x1b[0m`);
    inputBox.setLabel(` Send to [${channel.displayName}] (Press Enter) `);
    screen.render();
  });

  hub.on('wa_qr', () => {
    appendLog(`\x1b[33m[NOTICE]\x1b[0m WhatsApp session required. Run 'npm run auth' in terminal to link device.`);
  });

  // Handle Input Submission
  inputBox.on('submit', async (value) => {
    const text = (value || '').trim();
    inputBox.clearValue();
    inputBox.focus();

    if (!text) {
      screen.render();
      return;
    }

    try {
      await hub.sendCurrent(text);
    } catch (err) {
      appendLog(`\x1b[31m[ERROR]\x1b[0m Failed to send: ${err.message}`);
    }
    screen.render();
  });

  // Handle Channel Selection
  channelList.on('select', (item, index) => {
    if (hub.channels && hub.channels[index]) {
      hub.setActiveChannel(hub.channels[index].id);
      inputBox.focus();
    }
  });

  // Keyboard Shortcuts
  screen.key(['tab'], () => {
    if (channelList.focused) {
      inputBox.focus();
    } else {
      channelList.focus();
    }
    screen.render();
  });

  screen.key(['f2'], () => {
    isStealthMode = !isStealthMode;
    appendLog(`\x1b[90m[SYSTEM]\x1b[0m Display format switched to: ${isStealthMode ? 'STEALTH (syslog)' : 'CLEAN (chat)'}`);
    header.setContent(` [SYS-MONITOR v3.1] Node: prod-node-02 | Mode: ${isStealthMode ? 'STEALTH' : 'CLEAN'} [F2] | [F3] Panic | [Tab] Switch Pane | [Ctrl+C] Exit`);
    screen.render();
  });

  screen.key(['f3'], () => {
    togglePanic();
  });

  panicBox.key(['escape', 'f3', 'space', 'q'], () => {
    if (isPanicMode) {
      togglePanic();
    }
  });

  screen.key(['C-c'], () => {
    return process.exit(0);
  });

  // Initial focus
  inputBox.focus();
  screen.render();

  return { screen, appendLog };
}

module.exports = { createUI };
