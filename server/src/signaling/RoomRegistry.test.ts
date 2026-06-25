import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RoomRegistry } from './RoomRegistry.js';
import { Peer } from './Peer.js';
import type { Connection } from './Connection.js';

const noopConnection: Connection = {
  send() {},
  close() {},
  onMessage() {},
  onClose() {},
};

describe('RoomRegistry', () => {
  it('returns the same room instance for a given name', () => {
    const registry = new RoomRegistry();
    assert.equal(registry.getOrCreate('main'), registry.getOrCreate('main'));
    assert.equal(registry.roomCount, 1);
  });

  it('reaps a room only once it is empty', () => {
    const registry = new RoomRegistry();
    const room = registry.getOrCreate('main');
    room.add(new Peer('p1', noopConnection));

    registry.removeIfEmpty('main');
    assert.equal(registry.roomCount, 1, 'non-empty room is kept');

    room.remove('p1');
    registry.removeIfEmpty('main');
    assert.equal(registry.roomCount, 0, 'empty room is removed');
  });
});
