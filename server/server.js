// Proximity Room — signaling server.
// Jobs: (1) track who is in each room, (2) relay WebRTC handshake (SDP/ICE)
// between peers, (3) broadcast position updates, (4) hand clients fresh
// Cloudflare TURN credentials. It NEVER touches audio — media is peer-to-peer.

import http from 'http';
import { WebSocketServer } from 'ws';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Local dev reads ../.env; on Render these come from the dashboard env vars.
config({ path: resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 8080;
const TURN_KEY_ID = process.env.CLOUDFLARE_TURN_KEY_ID;
const TURN_KEY_SECRET = process.env.CLOUDFLARE_TURN_KEY_SECRET;

// ---------- TURN credential minting (cached) ----------
// Cloudflare hands out short-lived creds; we mint once and reuse for 12h.
const STUN_FALLBACK = [{ urls: 'stun:stun.l.google.com:19302' }];
const ICE_TTL_MS = 12 * 60 * 60 * 1000; // reuse good creds for 12h
const FALLBACK_TTL_MS = 60 * 1000;      // but retry a broken endpoint sooner
let cachedIce = null;
let cachedAt = 0;
let cachedTtl = ICE_TTL_MS;

async function getIceServers() {
  if (!TURN_KEY_ID || !TURN_KEY_SECRET) {
    console.warn('[turn] no Cloudflare creds set — STUN only (strict NAT may fail)');
    return STUN_FALLBACK;
  }
  const now = Date.now();
  if (cachedIce && now - cachedAt < cachedTtl) return cachedIce;
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TURN_KEY_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 86400 }),
        // Don't let a slow/hanging TURN endpoint stall joins.
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) throw new Error(`Cloudflare TURN HTTP ${res.status}`);
    const data = await res.json();
    cachedIce = Array.isArray(data.iceServers) && data.iceServers.length
      ? data.iceServers
      : STUN_FALLBACK;
    cachedAt = now;
    cachedTtl = ICE_TTL_MS;
    console.log('[turn] minted fresh ICE servers');
    return cachedIce;
  } catch (err) {
    console.error('[turn] mint failed:', err.message, '— STUN-only for now');
    // Cache the fallback briefly so a broken endpoint doesn't slow every join.
    cachedIce = STUN_FALLBACK;
    cachedAt = now;
    cachedTtl = FALLBACK_TTL_MS;
    return cachedIce;
  }
}

// ---------- HTTP (Render health check) ----------
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('proximity-room signaling server ok');
});

// ---------- WebSocket signaling ----------
const wss = new WebSocketServer({ server });

// rooms: Map<roomName, Map<id, {ws, name, x, y}>>
const rooms = new Map();
let nextId = 1;

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}
function broadcast(room, msg, exceptId) {
  const peers = rooms.get(room);
  if (!peers) return;
  for (const [id, peer] of peers) {
    if (id !== exceptId) send(peer.ws, msg);
  }
}

wss.on('connection', (ws) => {
  ws.id = String(nextId++);
  ws.room = null;

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join') {
      const room = String(msg.room || 'main');
      ws.room = room;
      ws.name = String(msg.name || 'Anon').slice(0, 24);
      ws.x = Number(msg.x) || 400;
      ws.y = Number(msg.y) || 300;
      if (!rooms.has(room)) rooms.set(room, new Map());
      const peers = rooms.get(room);

      // Snapshot existing peers for the newcomer BEFORE adding them.
      const peerList = [...peers].map(([id, p]) => ({ id, name: p.name, x: p.x, y: p.y }));
      peers.set(ws.id, { ws, name: ws.name, x: ws.x, y: ws.y });

      const iceServers = await getIceServers();
      send(ws, { type: 'welcome', id: ws.id, peers: peerList, iceServers });
      // Existing peers learn about the newcomer; the newcomer initiates the calls.
      broadcast(room, { type: 'peer-joined', id: ws.id, name: ws.name, x: ws.x, y: ws.y }, ws.id);
      console.log(`[room:${room}] ${ws.name} (${ws.id}) joined — ${peers.size} present`);
      return;
    }

    if (!ws.room) return;
    const peers = rooms.get(ws.room);
    if (!peers) return;

    if (msg.type === 'move') {
      const me = peers.get(ws.id);
      if (!me) return;
      me.x = Number(msg.x) || 0;
      me.y = Number(msg.y) || 0;
      broadcast(ws.room, { type: 'move', id: ws.id, x: me.x, y: me.y }, ws.id);
      return;
    }

    if (msg.type === 'signal') {
      // Relay a WebRTC offer/answer/ICE candidate to one specific peer.
      const target = peers.get(String(msg.to));
      if (target) send(target.ws, { type: 'signal', from: ws.id, data: msg.data });
      return;
    }
  });

  ws.on('close', () => {
    if (ws.room && rooms.has(ws.room)) {
      const peers = rooms.get(ws.room);
      peers.delete(ws.id);
      broadcast(ws.room, { type: 'peer-left', id: ws.id });
      if (peers.size === 0) rooms.delete(ws.room);
      console.log(`[room:${ws.room}] ${ws.name || ws.id} left`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[signaling] listening on :${PORT}`);
});
