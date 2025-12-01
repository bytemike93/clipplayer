# Clipplayer Overlay Server

Node.js service that pushes Twitch clips to browser overlays via WebSockets. Clients (e.g. OBS browser sources) connect with a `uid`; HTTP requests send clips to the matching clients.

## Requirements

- Node.js 18+
- `.env` with at least `PORT` (optional), `WS_SECRET` (optional), `OVERLAY_CLIP_SECRET`

## Setup

```bash
npm install
node server.js        # starts HTTP + WS on PORT (default 3003)
```

## Environment

| Variable              | Description |
| --------------------- | ----------- |
| `PORT`                | HTTP/WS port (default 3003) |
| `WS_SECRET`           | **Required** shared secret for signed WS connections (`sig` query) |
| `ALLOW_WS_NO_SIG`     | Allow WS connections without `sig` (`true`/`false`, default `false`) – nur für Dev nutzen |
| `WS_ALLOWED_ORIGINS`  | Comma-separated Origin-Whitelist for WS handshakes (optional; empty = allow all) |
| `OVERLAY_CLIP_SECRET` | **Required** Bearer token required for `POST /api/clip` & `/debug/clients` |
| `CLIP_DURATION_MIN`   | Minimal duration (seconds) accepted from API (default 1) |
| `CLIP_DURATION_MAX`   | Maximal duration (seconds) accepted from API (default 120) |
| `TWITCH_CLIENT_ID`    | Optional: Twitch OAuth client id (used in `config.js`) |
| `TWITCH_CLIENT_SECRET`| Optional: Twitch OAuth client secret |
| `TWITCH_REDIRECT_URI` | Optional: Twitch redirect URI |

## API

- WebSocket: `ws://host:PORT?uid=<id>[&sig=<hmac(uid)>]`
- `POST /api/clip` – body `{ uid, clipUrl, duration?, streamer?, clipType? }`; forwards to all WS clients with that `uid` (auth via `Authorization: Bearer OVERLAY_CLIP_SECRET` when set)
- `GET /debug/clients` – list active WS clients
- `GET /health` – health check

Static files in `public/` are served by the same server (can host the overlay assets there).

Statische Assets fuer das Overlay liegen in `public/`.

## Deployment Hinweis

Mit PM2 kann `ecosystem.config.js` eingesetzt werden:

```bash
pm2 start ecosystem.config.js
```

## Lizenz

ISC laut `package.json`.
