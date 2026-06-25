import type { Bounds, PeerId, Vec2 } from '@proximity/shared';
import type { RoomModel } from './RoomModel';

/** Renders the room and its avatars, kept in sync with RoomModel events. */
export class RoomView {
  private readonly avatars = new Map<PeerId, HTMLElement>();
  private readonly selfAvatar: HTMLElement;
  private readonly subscriptions: Array<() => void> = [];

  constructor(
    private readonly root: HTMLElement,
    model: RoomModel,
    bounds: Bounds,
  ) {
    root.classList.add('room');
    root.style.width = `${bounds.width}px`;
    root.style.height = `${bounds.height}px`;

    this.selfAvatar = this.createAvatar(model.self.name, true);
    this.place(this.selfAvatar, model.self.position);

    this.subscriptions.push(
      model.on('self-moved', (position) => this.place(this.selfAvatar, position)),
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
    this.root.replaceChildren();
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
    this.root.append(avatar);
    return avatar;
  }

  private place(element: HTMLElement, position: Vec2): void {
    element.style.transform = `translate(${position.x}px, ${position.y}px)`;
  }
}
