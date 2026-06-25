/**
 * The wire protocol — the single source of truth for every message exchanged
 * between the signaling client and server.
 *
 * Schemas are defined with zod and the static types are *inferred* from them
 * (`z.infer`), so the validation logic and the TypeScript types can never drift
 * apart. Both ends decode untrusted input through these schemas.
 */

import { z } from 'zod';

export const MAX_NAME_LENGTH = 24;
export const MAX_ROOM_LENGTH = 64;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const vec2Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});
export type Vec2 = z.infer<typeof vec2Schema>;

export const peerIdSchema = z.string().min(1);
export type PeerId = z.infer<typeof peerIdSchema>;

export const peerSnapshotSchema = z.object({
  id: peerIdSchema,
  name: z.string(),
  position: vec2Schema,
});
export type PeerSnapshot = z.infer<typeof peerSnapshotSchema>;

export const iceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});
export type IceServer = z.infer<typeof iceServerSchema>;

// ---------------------------------------------------------------------------
// WebRTC signaling payload — relayed verbatim between two peers. We mirror the
// minimal shapes of RTCSessionDescriptionInit / RTCIceCandidateInit here so the
// shared package stays free of any DOM-lib dependency.
// ---------------------------------------------------------------------------

const sessionDescriptionSchema = z.object({
  type: z.enum(['offer', 'answer', 'pranswer', 'rollback']),
  sdp: z.string().optional(),
});

const iceCandidateSchema = z.object({
  candidate: z.string().optional(),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().nullable().optional(),
  usernameFragment: z.string().nullable().optional(),
});

export const signalPayloadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('description'), description: sessionDescriptionSchema }),
  z.object({ kind: z.literal('candidate'), candidate: iceCandidateSchema }),
]);
export type SignalPayload = z.infer<typeof signalPayloadSchema>;

// ---------------------------------------------------------------------------
// Client -> Server
// ---------------------------------------------------------------------------

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    room: z.string().min(1).max(MAX_ROOM_LENGTH),
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    position: vec2Schema,
  }),
  z.object({
    type: z.literal('move'),
    position: vec2Schema,
  }),
  z.object({
    type: z.literal('signal'),
    to: peerIdSchema,
    payload: signalPayloadSchema,
  }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('welcome'),
    self: peerIdSchema,
    peers: z.array(peerSnapshotSchema),
    iceServers: z.array(iceServerSchema),
  }),
  z.object({ type: z.literal('peer-joined'), peer: peerSnapshotSchema }),
  z.object({ type: z.literal('peer-left'), id: peerIdSchema }),
  z.object({ type: z.literal('peer-moved'), id: peerIdSchema, position: vec2Schema }),
  z.object({ type: z.literal('signal'), from: peerIdSchema, payload: signalPayloadSchema }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;

// ---------------------------------------------------------------------------
// Safe decoding helpers
// ---------------------------------------------------------------------------

/** Parse a JSON string without throwing; returns `undefined` on malformed input. */
export function parseJson(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return undefined;
  }
}

/** Decode + validate an inbound client message. Returns `null` if invalid. */
export function decodeClientMessage(raw: unknown): ClientMessage | null {
  const result = clientMessageSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Decode + validate an inbound server message. Returns `null` if invalid. */
export function decodeServerMessage(raw: unknown): ServerMessage | null {
  const result = serverMessageSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export const iceServersSchema = z.array(iceServerSchema);

/** Decode + validate a list of ICE servers (e.g. a TURN provider response). */
export function decodeIceServers(raw: unknown): IceServer[] | null {
  const result = iceServersSchema.safeParse(raw);
  return result.success ? result.data : null;
}
