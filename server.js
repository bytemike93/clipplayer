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
const ALLOW_WS_NO_SIG = String(process.env.ALLOW_WS_NO_SIG ?? 'false').toLowerCase() === 'true';
const OVERLAY_CLIP_SECRET = process.env.OVERLAY_CLIP_SECRET || '';
const WS_ALLOWED_ORIGINS = (process.env.WS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const CLIP_DURATION_MIN = Math.max(1, Number(process.env.CLIP_DURATION_MIN ?? 1));
const CLIP_DURATION_MAX = Math.max(CLIP_DURATION_MIN, Number(process.env.CLIP_DURATION_MAX ?? 120));

if (!OVERLAY_CLIP_SECRET) {
  console.error('OVERLAY_CLIP_SECRET ist erforderlich – Server startet nicht.');
  process.exit(1);
}
if (!WS_SECRET) {
  console.error('WS_SECRET ist erforderlich – Server startet nicht.');
  process.exit(1);
}

function clampDuration(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n)) return CLIP_DURATION_MIN;
  return Math.min(CLIP_DURATION_MAX, Math.max(CLIP_DURATION_MIN, n));
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function originAllowed(origin) {
  if (!origin || WS_ALLOWED_ORIGINS.length === 0) return true;
  try {
    const o = new URL(origin).origin;
    return WS_ALLOWED_ORIGINS.includes(o);
  } catch {
    return false;
  }
}

// --- WebSocket Auth (Sig optional) ---
wss.on('connection', (ws, req) => {
  try {
    const origin = req.headers.origin;
    if (!originAllowed(origin)) {
      console.warn(`WS reject: origin not allowed (${origin || 'none'})`);
      ws.close();
      return;
    }

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
      if (sig) ok = safeEqual(sig, expected);
      else     ok = ALLOW_WS_NO_SIG; // bewusst nur via Env freischaltbar
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

    if (OVERLAY_CLIP_SECRET) {
      const auth = req.get('authorization') || '';
      const expected = `Bearer ${OVERLAY_CLIP_SECRET}`;
      if (!safeEqual(auth, expected)) return res.status(401).json({ error: 'unauthorized' });
    }

    if (!uid || !clipUrl || typeof clipUrl !== 'string') {
      return res.status(400).json({ error: 'uid und clipUrl sind erforderlich' });
    }

    const dur = clampDuration(duration);
    sendClipToClient(String(uid), clipUrl, dur, { streamer, clipType });
    return res.json({ success: true });
  } catch (err) {
    console.error('POST /api/clip failed:', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// Debug/Health (optional)
app.get('/debug/clients', (req, res) => {
  const auth = req.get('authorization') || '';
  const expected = `Bearer ${OVERLAY_CLIP_SECRET}`;
  if (!safeEqual(auth, expected)) return res.status(401).json({ error: 'unauthorized' });
  return res.json({ clients: listClients() });
});
app.get('/health', (_req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, 'public')));

server.listen(PORT, () => {
  console.log(`Overlay Server läuft auf http://localhost:${PORT}`);
  console.log(`ALLOW_WS_NO_SIG=${ALLOW_WS_NO_SIG} (WS_SECRET ${WS_SECRET ? 'gesetzt' : 'nicht gesetzt'})`);
});
