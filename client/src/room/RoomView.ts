import { cameraOffset, type PeerId, type Size, type Vec2, type WorldMap } from '@proximity/shared';
import type { RoomModel } from './RoomModel';

/**
 * Renders the world (walls, labels, avatars) inside a fixed viewport and runs a
 * follow-camera: the world layer is translated each time the local avatar moves
 * so you stay centered, clamped so the world never shows empty space past its
 * edges.
 */
export class RoomView {
  private readonly layer: HTMLElement;
  private readonly avatars = new Map<PeerId, HTMLElement>();
  private readonly selfAvatar: HTMLElement;
  private readonly subscriptions: Array<() => void> = [];
  private readonly viewport: Size;
  private readonly worldSize: Size;
  private readonly avatarSize: number;

  constructor(
    viewportEl: HTMLElement,
    model: RoomModel,
    world: WorldMap,
    viewport: Size,
    avatarSize: number,
  ) {
    this.viewport = viewport;
    this.worldSize = { width: world.width, height: world.height };
    this.avatarSize = avatarSize;

    viewportEl.classList.add('viewport');
    viewportEl.style.width = `${viewport.width}px`;
    viewportEl.style.height = `${viewport.height}px`;

    this.layer = document.createElement('div');
    this.layer.className = 'world';
    this.layer.style.width = `${world.width}px`;
    this.layer.style.height = `${world.height}px`;
    viewportEl.append(this.layer);

    this.renderRoomLabels(world.rooms);
    this.renderWalls(world.walls);

    this.selfAvatar = this.createAvatar(model.self.name, true);
    this.place(this.selfAvatar, model.self.position);
    this.centerOn(model.self.position);

    this.subscriptions.push(
      model.on('self-moved', (position) => {
        this.place(this.selfAvatar, position);
        this.centerOn(position);
      }),
      model.on('peer-added', (peer) => {
        const avatar = this.createAvatar(peer.name, false);
        this.avatars.set(peer.id, avatar);
        this.place(avatar, peer.position);
      }),
      model.on('peer-moved', (peer) => {
        const avatar = this.avatars.get(peer.id);
        if (avatar) this.place(avatar, peer.position);
      }),
      model.on('peer-removed', (id) => {
        this.avatars.get(id)?.remove();
        this.avatars.delete(id);
      }),
    );
  }

  destroy(): void {
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.layer.replaceChildren();
  }

  private centerOn(self: Vec2): void {
    const offset = cameraOffset(self, this.avatarSize, this.viewport, this.worldSize);
    this.layer.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
  }

  private renderWalls(walls: WorldMap['walls']): void {
    for (const wall of walls) {
      const element = document.createElement('div');
      element.className = 'wall';
      element.style.transform = `translate(${wall.x}px, ${wall.y}px)`;
      element.style.width = `${wall.width}px`;
      element.style.height = `${wall.height}px`;
      this.layer.append(element);
    }
  }

  private renderRoomLabels(rooms: WorldMap['rooms']): void {
    for (const room of rooms) {
      const element = document.createElement('div');
      element.className = 'room-label';
      element.textContent = room.name;
      element.style.transform = `translate(${room.at.x}px, ${room.at.y}px)`;
      this.layer.append(element);
    }
  }

  private createAvatar(name: string, isSelf: boolean): HTMLElement {
    const avatar = document.createElement('div');
    avatar.className = isSelf ? 'avatar avatar--self' : 'avatar';

    const dot = document.createElement('div');
    dot.className = 'avatar__dot';

    const label = document.createElement('div');
    label.className = 'avatar__label';
    label.textContent = name;

    avatar.append(dot, label);
    this.layer.append(avatar);
    return avatar;
  }

  private place(element: HTMLElement, position: Vec2): void {
    element.style.transform = `translate(${position.x}px, ${position.y}px)`;
  }
}
