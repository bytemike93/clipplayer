require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { register, sendClipToClient, listClients } = require('./ws-handler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3003;
const WS_SECRET = process.env.WS_SECRET || '';
const ALLOW_WS_NO_SIG = String(process.env.ALLOW_WS_NO_SIG ?? 'true').toLowerCase() === 'true';
const OVERLAY_CLIP_SECRET = process.env.OVERLAY_CLIP_SECRET || '';

// --- WebSocket Auth (Sig optional) ---
wss.on('connection', (ws, req) => {
  try {
    const q = req.url.includes('?') ? req.url.split('?')[1] : '';
    const params = new URLSearchParams(q);
    const uid = params.get('uid');
    const sig = params.get('sig');

    if (!uid) {
      console.warn('WS reject: missing uid');
      ws.close();
      return;
    }

    let ok = true;
    if (WS_SECRET) {
      const expected = crypto.createHmac('sha256', WS_SECRET).update(uid).digest('hex');
      if (sig) ok = (sig === expected);
      else     ok = ALLOW_WS_NO_SIG; // <<— hier erlauben wir OBS ohne sig
    }

    if (!ok) {
      console.warn(`WS reject: auth failed for uid=${uid}`);
      ws.close();
      return;
    }

    console.log(`WS connected for uid=${uid}${sig ? ' (signed)' : ' (no-sig)'}`);
    register(ws, uid, sig, req);
  } catch (e) {
    console.error('WS connection error:', e);
    try { ws.close(); } catch {}
  }
});

app.use(express.json());

// --- HTTP API ---
app.post('/api/clip', (req, res) => {
  try {
    const { uid, clipUrl, duration, streamer, clipType } = req.body || {};
    if (!uid || !clipUrl) {
      return res.status(400).json({ error: 'uid und clipUrl sind erforderlich' });
    }

    if (OVERLAY_CLIP_SECRET) {
      const auth = req.get('authorization') || '';
      const expected = `Bearer ${OVERLAY_CLIP_SECRET}`;
      if (auth !== expected) return res.status(401).json({ error: 'unauthorized' });
    }

    sendClipToClient(String(uid), clipUrl, duration, { streamer, clipType });
    return res.json({ success: true });
  } catch (err) {
    console.error('POST /api/clip failed:', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Debug/Health (optional)
app.get('/debug/clients', (_req, res) => res.json({ clients: listClients() }));
app.get('/health', (_req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, 'public')));

server.listen(PORT, () => {
  console.log(`Overlay Server läuft auf http://localhost:${PORT}`);
  console.log(`ALLOW_WS_NO_SIG=${ALLOW_WS_NO_SIG} (WS_SECRET ${WS_SECRET ? 'gesetzt' : 'nicht gesetzt'})`);
});
