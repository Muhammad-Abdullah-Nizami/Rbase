import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeServerMessage,
  type ClientMessage,
  type PeerSnapshot,
  type ServerMessage,
} from '@proximity/shared';
import { SignalingService } from './SignalingService.js';
import { RoomRegistry } from './RoomRegistry.js';
import { StaticIceServersProvider } from '../turn/StaticIceServersProvider.js';
import { ConsoleLogger } from '../logger.js';
import type { Connection } from './Connection.js';

const silent = new ConsoleLogger({ level: 'error', sink: () => {} });
const ice = [{ urls: 'stun:stun.example:3478' }];
const at = (x: number, y: number) => ({ x, y });

/** In-memory Connection that validates every outbound message and lets a test drive inbound ones. */
class FakeConnection implements Connection {
  readonly sent: ServerMessage[] = [];
  private onMessageHandler: (data: string) => void = () => {};
  private onCloseHandler: () => void = () => {};

  send(data: string): void {
    const message = decodeServerMessage(JSON.parse(data));
    assert.ok(message, `server emitted an invalid message: ${data}`);
    this.sent.push(message);
  }
  close(): void {}
  onMessage(handler: (data: string) => void): void {
    this.onMessageHandler = handler;
  }
  onClose(handler: () => void): void {
    this.onCloseHandler = handler;
  }

  receive(message: ClientMessage): void {
    this.onMessageHandler(JSON.stringify(message));
  }
  disconnect(): void {
    this.onCloseHandler();
  }
  expect<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> {
    const found = [...this.sent].reverse().find((m) => m.type === type);
    if (!found) throw new Error(`expected a "${type}" message but none was sent`);
    return found as Extract<ServerMessage, { type: T }>;
  }
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`expected ${what} to be present`);
  return value;
}

function newRoom(): { service: SignalingService; rooms: RoomRegistry } {
  const rooms = new RoomRegistry();
  const service = new SignalingService({
    rooms,
    iceProvider: new StaticIceServersProvider(ice),
    logger: silent,
  });
  return { service, rooms };
}

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('SignalingService', () => {
  it('welcomes the first peer with an empty room and the ICE servers', async () => {
    const { service } = newRoom();
    const a = new FakeConnection();
    service.accept(a);
    a.receive({ type: 'join', room: 'main', name: 'Alice', position: at(10, 10) });
    await tick();

    const welcome = a.expect('welcome');
    assert.equal(welcome.peers.length, 0);
    assert.deepEqual(welcome.iceServers, ice);
  });

  it('lists existing peers to a newcomer and notifies the existing peer', async () => {
    const { service } = newRoom();
    const a = new FakeConnection();
    const b = new FakeConnection();
    service.accept(a);
    service.accept(b);

    a.receive({ type: 'join', room: 'main', name: 'Alice', position: at(10, 10) });
    await tick();
    b.receive({ type: 'join', room: 'main', name: 'Bob', position: at(20, 20) });
    await tick();

    assert.equal(must(b.expect('welcome').peers[0], 'Alice snapshot').name, 'Alice');
    assert.equal(a.expect('peer-joined').peer.name, 'Bob');
  });

  it('relays movement as peer-moved to others only', async () => {
    const { service } = newRoom();
    const a = new FakeConnection();
    const b = new FakeConnection();
    service.accept(a);
    service.accept(b);
    a.receive({ type: 'join', room: 'main', name: 'Alice', position: at(0, 0) });
    await tick();
    b.receive({ type: 'join', room: 'main', name: 'Bob', position: at(0, 0) });
    await tick();

    b.receive({ type: 'move', position: at(123, 45) });
    await tick();

    assert.deepEqual(a.expect('peer-moved').position, at(123, 45));
    assert.equal(
      b.sent.find((m) => m.type === 'peer-moved'),
      undefined,
      'sender must not receive its own move',
    );
  });

  it('relays a signaling payload to the addressed peer', async () => {
    const { service } = newRoom();
    const a = new FakeConnection();
    const b = new FakeConnection();
    service.accept(a);
    service.accept(b);
    a.receive({ type: 'join', room: 'main', name: 'Alice', position: at(0, 0) });
    await tick();
    b.receive({ type: 'join', room: 'main', name: 'Bob', position: at(0, 0) });
    await tick();

    const alice: PeerSnapshot = must(b.expect('welcome').peers[0], 'Alice snapshot');
    b.receive({
      type: 'signal',
      to: alice.id,
      payload: { kind: 'description', description: { type: 'offer', sdp: 'x' } },
    });
    await tick();

    assert.equal(a.expect('signal').payload.kind, 'description');
  });

  it('broadcasts peer-left and reaps the room on disconnect', async () => {
    const { service, rooms } = newRoom();
    const a = new FakeConnection();
    const b = new FakeConnection();
    service.accept(a);
    service.accept(b);
    a.receive({ type: 'join', room: 'main', name: 'Alice', position: at(0, 0) });
    await tick();
    b.receive({ type: 'join', room: 'main', name: 'Bob', position: at(0, 0) });
    await tick();

    const bobId = a.expect('peer-joined').peer.id;
    b.disconnect();
    assert.equal(a.expect('peer-left').id, bobId);

    a.disconnect();
    assert.equal(rooms.roomCount, 0);
  });
});
