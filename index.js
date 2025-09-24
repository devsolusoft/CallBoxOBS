// index.js - servidor mínimo para CallBox
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  console.log('WS client connected:', req.socket.remoteAddress);
  ws.send(JSON.stringify({ type: 'HELLO', msg: 'connected' }));
});

function broadcast(obj) {
  const payload = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

app.post('/api/broadcast', (req, res) => {
  const body = req.body;
  if (!body) return res.status(400).json({ ok: false, error: 'No body' });
  broadcast({ type: 'PATIENT_CALL', data: body });
  res.json({ ok: true });
});

app.post('/api/sound-enable', (req, res) => {
  broadcast({ type: 'SOUND_ENABLE', data: req.body || {} });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening http://localhost:${PORT}`));
