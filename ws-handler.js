// ws-handler.js
const WebSocket = require('ws');

// Mehrere Clients pro UID erlauben
// Map<uidKey, Set<WebSocket>>
const clients = new Map();

const keyOf = v => String(v).trim().toLowerCase();

function register(ws, uid, _sig, _req) {
  const key = keyOf(uid);
  if (!clients.has(key)) clients.set(key, new Set());
  const set = clients.get(key);
  set.add(ws);
  ws.on('close', () => {
    set.delete(ws);
    if (set.size === 0) clients.delete(key);
  });
}

function sendClipToClient(uid, clipUrl, duration = 30, extras = {}) {
  const key = keyOf(uid);
  const set = clients.get(key);
  if (!set || set.size === 0) {
    console.warn(`❌ Kein aktiver Client für UID: ${uid}`);
    return;
  }
  let delivered = 0;
  for (const ws of set) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ clipUrl, duration, ...extras }));
        delivered++;
      }
    } catch (err) {
      console.error(`❌ sendClipToClient Fehler (${uid}):`, err);
    }
  }
  if (delivered === 0) {
    console.warn(`❌ Kein offener WS für UID: ${uid} (alle geschlossen?)`);
  } else {
    console.log(`➡ Clip an ${delivered} Client(s) für UID ${uid} gesendet.`);
  }
}

// Ping (optional)
setInterval(() => {
  for (const set of clients.values()) {
    for (const ws of set) {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.ping(); } catch {}
      }
    }
  }
}, 30000).unref?.();

function listClients() {
  const out = {};
  for (const [k, set] of clients) out[k] = set.size;
  return out;
}

module.exports = { register, sendClipToClient, listClients };
