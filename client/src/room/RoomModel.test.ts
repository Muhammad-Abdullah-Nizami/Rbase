import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RoomModel } from './RoomModel';

describe('RoomModel', () => {
  it('emits self-moved and updates state', () => {
    const model = new RoomModel('me', { x: 0, y: 0 });
    const seen: Array<{ x: number; y: number }> = [];
    model.on('self-moved', (p) => seen.push(p));

    model.setSelfPosition({ x: 5, y: 6 });

    assert.deepEqual(seen, [{ x: 5, y: 6 }]);
    assert.deepEqual(model.self.position, { x: 5, y: 6 });
  });

  it('adds peers idempotently and emits once', () => {
    const model = new RoomModel('me', { x: 0, y: 0 });
    const added: string[] = [];
    model.on('peer-added', (p) => added.push(p.id));

    model.addPeer({ id: 'a', name: 'Alice', position: { x: 1, y: 1 } });
    model.addPeer({ id: 'a', name: 'Alice', position: { x: 1, y: 1 } });

    assert.deepEqual(added, ['a']);
  });

  it('moves and removes peers with events', () => {
    const model = new RoomModel('me', { x: 0, y: 0 });
    const removed: string[] = [];
    model.on('peer-removed', (id) => removed.push(id));
    model.addPeer({ id: 'a', name: 'Alice', position: { x: 1, y: 1 } });

    model.setPeerPosition('a', { x: 9, y: 9 });
    assert.deepEqual([...model.peers()][0]?.position, { x: 9, y: 9 });

    model.removePeer('a');
    assert.deepEqual(removed, ['a']);
    assert.equal([...model.peers()].length, 0);
  });

  it('clear removes every peer', () => {
    const model = new RoomModel('me', { x: 0, y: 0 });
    model.addPeer({ id: 'a', name: 'A', position: { x: 0, y: 0 } });
    model.addPeer({ id: 'b', name: 'B', position: { x: 0, y: 0 } });
    model.clear();
    assert.equal([...model.peers()].length, 0);
  });
});
