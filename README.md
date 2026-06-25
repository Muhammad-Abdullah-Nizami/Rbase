# Proximity Room

A 2D "spatial chat" room: walk your avatar around with the arrow keys / WASD and
you hear other people louder the closer you stand to them. Audio is WebRTC
peer-to-peer (full mesh), sized for ~5–6 people. Volume-by-distance only (no
spatial panning), kept deliberately focused.

## Architecture

A TypeScript monorepo (npm workspaces) with three packages:

```
packages/shared/   The wire protocol as a single source of truth: zod schemas
                   with inferred types, plus pure (unit-tested) geometry. Both
                   ends import it, so client and server can never disagree on a
                   message shape or the distance→volume curve.

server/            Signaling server. Layered and dependency-injected:
                     index.ts ............ composition root + graceful shutdown
                     config.ts ........... env parsing/validation (fail fast)
                     logger.ts ........... structured JSON logging
                     signaling/ .......... domain: Session, Room, RoomRegistry,
                                           Peer — all behind a Connection port
                     ws/ ................. WebSocket adapter + heartbeat gateway
                     turn/ ............... IceServersProvider port with
                                           Cloudflare + Static implementations
                   It never touches audio — only the SDP/ICE handshake, position
                   relay, and minting TURN credentials.

client/            Browser app. Layered:
                     signaling/ .......... typed WebSocket transport with
                                           auto-reconnect (capped backoff)
                     rtc/ ................ MeshController + PeerSession using the
                                           canonical "perfect negotiation" pattern
                     audio/ .............. AudioEngine (Web Audio graph) +
                                           ProximityController (distance→gain)
                     room/ ............... RoomModel (state) / RoomView (DOM) /
                                           MovementController (input)
                     ui/, app/ ........... JoinScreen, ControlBar, Application
```

Key design choices: every cross-cutting seam is an interface (`Connection`,
`IceServersProvider`, `Transport`) so the core is unit-testable with fakes; all
untrusted input is validated through the shared zod schemas; WebRTC uses perfect
negotiation (glare-safe) and the client reconnects automatically.

## Prerequisites

- Node ≥ 20
- A Cloudflare Realtime **TURN Server** key (optional — without it the server
  runs STUN-only, which still works on friendly networks).

## Run locally

```bash
npm install            # installs all workspaces
npm run build:shared   # the client/server depend on shared's built output

# terminal 1 — signaling server (reads ../.env, listens on :8080)
npm run dev:server

# terminal 2 — client (http://localhost:5173, also exposed on your LAN)
npm run dev:client
```

Open the client in two browser tabs (or two devices on your LAN), join with
different names, and move around. Real audio needs two separate devices — see
the deploy section.

## Scripts

```bash
npm run typecheck   # strict tsc across all packages
npm test            # unit tests (node:test) across all packages
npm run build       # shared (tsc) → server (tsc) → client (vite)
```

## Environment

The server reads `../.env` in dev (see `.env.example`); in production these are
real environment variables.

| Variable | Used by | Notes |
|---|---|---|
| `CLOUDFLARE_TURN_KEY_ID` | server | TURN key id (server-side only) |
| `CLOUDFLARE_TURN_KEY_SECRET` | server | TURN API token (server-side only) |
| `PORT` | server | defaults to 8080; Render sets this |
| `LOG_LEVEL` | server | `debug` \| `info` \| `warn` \| `error` (default `info`) |
| `VITE_SIGNALING_URL` | client build | `wss://…` of the deployed server |

## Deploy (Render, free tier)

Render clones the whole repo, so build commands run from the root and are
workspace-aware.

**Signaling server** → Web Service
- Build: `npm install && npm run build:shared && npm run build:server`
- Start: `node server/dist/index.js`
- Env: `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_KEY_SECRET`

**Client** → Static Site
- Build: `npm install && npm run build:shared && npm run build:client`
- Publish directory: `client/dist`
- Env: `VITE_SIGNALING_URL` = the server's `wss://` URL

> Render's free web service sleeps after ~15 min idle; the first visitor waits
> ~30–60s for it to wake.
