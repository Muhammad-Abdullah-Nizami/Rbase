import { Room } from './Room.js';

/** Owns the collection of active rooms, creating and reaping them on demand. */
export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();

  get roomCount(): number {
    return this.rooms.size;
  }

  getOrCreate(name: string): Room {
    let room = this.rooms.get(name);
    if (!room) {
      room = new Room(name);
      this.rooms.set(name, room);
    }
    return room;
  }

  get(name: string): Room | undefined {
    return this.rooms.get(name);
  }

  removeIfEmpty(name: string): void {
    const room = this.rooms.get(name);
    if (room?.isEmpty) this.rooms.delete(name);
  }
}
