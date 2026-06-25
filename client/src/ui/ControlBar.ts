/** The in-room status line plus mute toggle. */
export class ControlBar {
  private readonly element: HTMLElement;
  private readonly status: HTMLElement;
  private readonly muteButton: HTMLButtonElement;
  private muted = false;
  private muteHandler: (muted: boolean) => void = () => {};

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'controlbar';
    this.element.innerHTML = `
      <span class="status">connecting…</span>
      <button class="button button--ghost" type="button">Mute</button>`;

    this.status = this.element.querySelector<HTMLElement>('.status')!;
    this.muteButton = this.element.querySelector<HTMLButtonElement>('.button')!;
    this.muteButton.addEventListener('click', () => this.toggleMute());
  }

  mount(parent: HTMLElement): void {
    parent.append(this.element);
  }

  onToggleMute(handler: (muted: boolean) => void): void {
    this.muteHandler = handler;
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    this.muteButton.textContent = this.muted ? 'Unmute' : 'Mute';
    this.muteButton.classList.toggle('is-active', this.muted);
    this.muteHandler(this.muted);
  }
}
