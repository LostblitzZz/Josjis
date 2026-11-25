const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode-terminal/vendor/QRCode');
const QRErrorCorrectLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

function renderQrSvg(text) {
  if (!text) return '';
  const qr = new QRCode(-1, QRErrorCorrectLevel.L);
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const pad = 2;
  const size = count + pad * 2;
  let rects = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        rects += `<rect x="${c + pad}" y="${r + pad}" width="1" height="1" fill="#0b0d10"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/>${rects}</svg>`;
}

function startWebServer(hub, port = 3821) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.static(path.join(__dirname, '../public')));
  app.use(express.json());

  // 1. REST API for Native C# Client & Web
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'running',
      waConnected: hub.wa ? hub.wa.isConnected : false,
      qr: hub.lastQR || null,
      discordConnected: hub.discord ? hub.discord.isConnected : false,
      activeChannel: hub.activeChannel,
      channels: hub.channels || []
    });
  });

  app.get('/api/channels', (req, res) => {
    res.json(hub.channels || []);
  });

  app.get('/api/messages', (req, res) => {
    const channelId = req.query.channelId || (hub.activeChannel ? hub.activeChannel.rawId : null);
    const msgs = hub.getMessagesForChannel(channelId);
    res.json(msgs || []);
  });

  app.post('/api/send', async (req, res) => {
    try {
      const text = (req.body.text || '').trim();
      if (!text) return res.status(400).json({ error: 'Text required' });
      await hub.sendCurrent(text);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/select', (req, res) => {
    const channelId = req.body.channelId;
    const found = hub.setActiveChannel(channelId);
    res.json({ success: Boolean(found), activeChannel: hub.activeChannel });
  });

  app.post('/api/sendto', async (req, res) => {
    try {
      const target = req.body.target;
      const text = req.body.text;
      await hub.sendToNumber(target, text);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/resync', async (req, res) => {
    try {
      if (hub.wa && hub.wa.resync) {
        await hub.wa.resync();
      }
      hub.refreshChannels();
      res.json({ success: true, count: (hub.channels || []).length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/qr.svg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-store');
    if (!hub.lastQR) {
      return res.status(404).send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>');
    }
    res.send(renderQrSvg(hub.lastQR));
  });

  app.post('/api/reauth', async (req, res) => {
    try {
      hub.lastQR = null;
      if (hub.wa && hub.wa.reauth) {
        await hub.wa.reauth();
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/clear_cache', (req, res) => {
    try {
      if (hub.wa && hub.wa.clearCache) {
        hub.wa.clearCache();
      }
      hub.refreshChannels();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 2. WebSocket for live push
  const clients = new Set();

  function broadcast(payload) {
    const raw = JSON.stringify(payload);
    for (const client of clients) {
      if (client.readyState === 1) { // OPEN
        client.send(raw);
      }
    }
  }

  hub.on('message', (msg) => {
    broadcast({ type: 'message', data: msg });
  });

  hub.on('channels_updated', (channels) => {
    broadcast({ type: 'channels_updated', data: channels });
  });

  hub.on('active_channel_changed', (channel) => {
    broadcast({ type: 'active_channel_changed', data: channel });
  });

  hub.on('platform_status', (st) => {
    broadcast({ type: 'platform_status', data: st });
  });

  hub.on('wa_qr', (qr) => {
    broadcast({ type: 'wa_qr', data: { qr } });
  });

  wss.on('connection', (ws) => {
    clients.add(ws);

    ws.send(JSON.stringify({
      type: 'init',
      data: {
        channels: hub.channels,
        activeChannel: hub.activeChannel,
        messages: hub.messageHistory,
        waStatus: hub.wa ? hub.wa.isConnected : false,
        qr: hub.lastQR || null
      }
    }));

    ws.on('message', async (raw) => {
      try {
        const action = JSON.parse(raw);
        if (action.type === 'send_message') {
          await hub.sendCurrent(action.text);
        } else if (action.type === 'select_channel') {
          hub.setActiveChannel(action.channelId);
        } else if (action.type === 'send_to_number') {
          await hub.sendToNumber(action.target, action.text);
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', error: err.message }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({ port, server });
    });
  });
}

module.exports = { startWebServer };
