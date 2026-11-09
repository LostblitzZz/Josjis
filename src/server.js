const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

function startWebServer(hub, port = 3821) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.static(path.join(__dirname, '../public')));
  app.use(express.json());

  // API info
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'running',
      channels: hub.channels,
      activeChannel: hub.activeChannel
    });
  });

  const clients = new Set();

  function broadcast(payload) {
    const raw = JSON.stringify(payload);
    for (const client of clients) {
      if (client.readyState === 1) { // OPEN
        client.send(raw);
      }
    }
  }

  // Hub listeners to broadcast to all open web clients
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
    broadcast({ type: 'wa_qr', data: qr });
  });

  wss.on('connection', (ws) => {
    clients.add(ws);

    // Initial state push
    ws.send(JSON.stringify({
      type: 'init',
      data: {
        channels: hub.channels,
        activeChannel: hub.activeChannel,
        messages: hub.messageHistory,
        waStatus: hub.wa ? hub.wa.isConnected : false,
        discordStatus: hub.discord ? hub.discord.isConnected : false
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
        ws.send(JSON.stringify({
          type: 'error',
          error: err.message
        }));
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
