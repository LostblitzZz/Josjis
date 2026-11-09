const blessed = require('blessed');
const { getRandomLog } = require('./panicLogs');

function createUI(hub) {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'journalctl -u ingress-telemetry.service -f',
    dockBorders: true,
    fullUnicode: true,
    cursor: {
      artificial: true,
      shape: 'line',
      blink: true,
      color: 'white'
    }
  });

  let isStealthMode = true;
  let isPanicMode = false;
  let panicInterval = null;
  let isReadingInput = false;

  // Subtle Header Bar (disguised as Kubernetes / systemd telemetry)
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
    content: ' [k8s-pod: ingress-gw-89f] [cluster: prod-sea-01] [CPU: 1.2% | MEM: 198MB] [UPTIME: 18d 04h]\n Hotkeys: [Esc] or :p = Panic | [F2] or :m = Mode | [Tab] = Switch Pane | [Ctrl+C] = Exit'
  });

  // Left Column: Channels / Sockets
  const channelList = blessed.list({
    parent: screen,
    top: 3,
    left: 0,
    width: '30%',
    height: '100%-3',
    border: { type: 'line' },
    label: ' Ingress Threads / Pods ',
    keys: true,
    vi: true,
    mouse: true,
    style: {
      border: { fg: 'gray' },
      selected: { bg: 'black', fg: 'yellow', bold: true },
      item: { fg: 'white' }
    },
    items: ['[Scanning sockets...]']
  });

  // Right Top: Logs / Event Stream
  const logBox = blessed.log({
    parent: screen,
    top: 3,
    left: '30%',
    width: '70%',
    height: '100%-6',
    border: { type: 'line' },
    label: ' journalctl -u ingress-worker.service -f (/var/log/syslog) ',
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

  // Right Bottom: Input Command Prompt
  const inputBox = blessed.textbox({
    parent: screen,
    bottom: 0,
    left: '30%',
    width: '70%',
    height: 3,
    border: { type: 'line' },
    label: ' rpc-exec [no target selected] ',
    style: {
      border: { fg: 'gray' },
      fg: 'white'
    }
  });

  // Panic Overlay Box (Fullscreen live compile stream)
  const panicBox = blessed.log({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    hidden: true,
    border: { type: 'line' },
    label: ' /usr/bin/cargo build --release --target x86_64-unknown-linux-gnu ',
    style: {
      border: { fg: 'green' },
      fg: 'green'
    }
  });

  function formatMessage(msg) {
    const d = new Date(msg.timestamp || Date.now());
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = String(d.getDate()).padStart(2, '0');
    const time = d.toTimeString().split(' ')[0];
    const timestampStr = `${month} ${day} ${time}`;

    const sender = msg.isMe ? 'You' : msg.sender;
    const prefix = msg.source === 'whatsapp' ? 'thread-wa' : (msg.source === 'discord' ? 'ingress-dc' : 'stream-tk');

    if (isStealthMode) {
      // 100% authentic Linux systemd / journald structured syslog format
      if (msg.isMe) {
        return `\x1b[90m${timestampStr} srv-01 gateway[8412]:\x1b[0m \x1b[32m[egress-gw/You]\x1b[0m dispatch_ack: "${msg.text}"`;
      } else {
        return `\x1b[90m${timestampStr} srv-01 gateway[8412]:\x1b[0m \x1b[36m[${prefix}/${sender}]\x1b[0m payload_data: "${msg.text}"`;
      }
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
      channelList.setItems(['[No connected sockets]']);
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
      if (isReadingInput) {
        isReadingInput = false;
        inputBox.cancel();
      }

      panicBox.show();
      panicBox.focus();
      header.hide();
      channelList.hide();
      logBox.hide();
      inputBox.hide();

      // Live compilation stream
      panicInterval = setInterval(() => {
        panicBox.log(getRandomLog());
        screen.render();
      }, 55);
    } else {
      clearInterval(panicInterval);
      panicInterval = null;

      panicBox.hide();
      header.show();
      channelList.show();
      logBox.show();
      inputBox.show();

      focusInput();
    }
    screen.render();
  }

  function toggleStealthMode() {
    isStealthMode = !isStealthMode;
    appendLog(`\x1b[90m[SYSTEM]\x1b[0m Telemetry format: ${isStealthMode ? 'STEALTH (journalctl)' : 'CLEAN (compact)'}`);
    header.setContent(` [k8s-pod: ingress-gw-89f] [cluster: prod-sea-01] [MODE: ${isStealthMode ? 'STEALTH-LOG' : 'CLEAN'}] [MEM: 198MB]\n Hotkeys: [Esc] or :p = Panic | [F2] or :m = Mode | [Tab] = Switch Pane | [Ctrl+C] = Exit`);
    screen.render();
  }

  function startInputLoop() {
    if (isReadingInput || isPanicMode) return;
    isReadingInput = true;

    inputBox.readInput(async (err, value) => {
      isReadingInput = false;

      if (err) return;

      const raw = (value || '').trim();
      inputBox.clearValue();
      screen.render();

      if (!raw) {
        if (!isPanicMode && inputBox.focused) {
          startInputLoop();
        }
        return;
      }

      // Built-in Stealth Commands
      if (raw === ':p' || raw === ':panic' || raw === '/panic') {
        togglePanic();
        return;
      }

      if (raw === ':m' || raw === ':mode') {
        toggleStealthMode();
        if (!isPanicMode) startInputLoop();
        return;
      }

      if (raw === ':clear' || raw === '/clear') {
        logBox.setContent('');
        appendLog('\x1b[90m[SYSTEM]\x1b[0m Buffer cleared.');
        if (!isPanicMode) startInputLoop();
        return;
      }

      if (raw === ':q' || raw === ':quit') {
        return process.exit(0);
      }

      // Normal message dispatch
      try {
        await hub.sendCurrent(raw);
      } catch (sendErr) {
        appendLog(`\x1b[31m[ERROR]\x1b[0m Egress dispatch failed: ${sendErr.message}`);
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
    if (isReadingInput) {
      isReadingInput = false;
      inputBox.cancel();
    }
    channelList.focus();
    screen.render();
  }

  // Intercept keys at the lowest driver level via screen.program
  // This guarantees keys fire even when inputBox is capturing input!
  screen.program.on('keypress', (ch, key) => {
    if (!key) return;

    // Panic Hotkeys: Escape, F3, Ctrl+P
    if (key.name === 'f3' || key.name === 'escape' || (key.ctrl && key.name === 'p')) {
      togglePanic();
      return;
    }

    // If panic mode is active, any other key exits panic mode
    if (isPanicMode) {
      if (key.name === 'space' || key.name === 'return' || key.name === 'enter' || ch === 'q') {
        togglePanic();
        return;
      }
      return;
    }

    // Toggle format mode: F2
    if (key.name === 'f2') {
      toggleStealthMode();
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
      return process.exit(0);
    }
  });

  // Hub Event Listeners
  hub.on('platform_status', (st) => {
    appendLog(`\x1b[90m[SYSTEM]\x1b[0m Service socket [${st.platform}] status: ${st.status} ${st.reason ? '(' + st.reason + ')' : ''}`);
  });

  hub.on('message', (msg) => {
    appendLog(formatMessage(msg));
  });

  hub.on('channels_updated', (channels) => {
    updateChannelList(channels);
  });

  hub.on('active_channel_changed', (channel) => {
    updateChannelList(hub.channels);
    inputBox.setLabel(` rpc-exec [target: ${channel.displayName}] (Enter: dispatch, :p: panic) `);
    screen.render();
  });

  hub.on('wa_qr', () => {
    appendLog(`\x1b[33m[NOTICE]\x1b[0m WhatsApp session required. Run 'npm run auth' or 'auth.bat' to link.`);
  });

  // List Selection
  channelList.on('select', (item, index) => {
    if (hub.channels && hub.channels[index]) {
      hub.setActiveChannel(hub.channels[index].id);
    }
    focusInput();
  });

  // Click on list
  channelList.on('click', () => {
    focusList();
  });

  // Click on input
  inputBox.on('click', () => {
    focusInput();
  });

  // Initial focus
  focusInput();

  return { screen, appendLog };
}

module.exports = { createUI };
