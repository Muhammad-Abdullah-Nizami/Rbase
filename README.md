# Proximity Room

A tiny 2D "spatial chat" room: walk your avatar around with the arrow keys / WASD,
and you hear other people louder the closer you stand to them. Audio is WebRTC
peer-to-peer (mesh) — good for ~5–6 people. Volume-by-distance only (not spatial
panning), kept deliberately simple.

## How it works

- **client/** — Vite app. 2D room (CSS-positioned avatars), movement, one
  `RTCPeerConnection` per peer, and a Web Audio `GainNode` per remote stream
  whose value is updated every frame from distance.
- **server/** — Node + `ws` signaling server. Tracks who's in the room, relays
  the WebRTC handshake (SDP/ICE), broadcasts positions, and mints Cloudflare
  TURN credentials. It never touches audio.

## Run locally

Two terminals:

```bash
# 1) signaling server
cd server
npm install
npm start          # listens on :8080

# 2) client
cd client
npm install
npm run dev        # http://localhost:5173
```

Open the client in two browser tabs, join with different names, and move around.
(For real audio testing use two devices / networks — see below.)

## Environment

Server reads `../.env` locally (see `.env.example`):

- `CLOUDFLARE_TURN_KEY_ID` / `CLOUDFLARE_TURN_KEY_SECRET` — from Cloudflare
  Realtime → TURN Server. Server-side only.
- `PORT` — defaults to 8080 (Render sets this automatically).

Client build-time var:

- `VITE_SIGNALING_URL` — `wss://…` URL of the deployed signaling server.
  Defaults to `ws://<host>:8080` in dev.

## Deploy (Render, free tier)

- **Signaling server** → Render Web Service, root dir `server`, start `npm start`,
  env vars `CLOUDFLARE_TURN_KEY_ID` + `CLOUDFLARE_TURN_KEY_SECRET`.
- **Client** → Render Static Site, root dir `client`, build `npm install && npm run build`,
  publish dir `dist`, env var `VITE_SIGNALING_URL` = the server's `wss://` URL.

> Note: Render's free web service sleeps after ~15 min idle; the first visitor
> waits ~30–60s for it to wake.
