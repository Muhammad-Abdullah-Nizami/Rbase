const MIC_SVG = `
<svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true">
  <rect x="5" y="1" width="6" height="9" rx="3" fill="#fff8ec"/>
  <path d="M2 8 a6 6 0 0 0 12 0" stroke="#fff8ec" stroke-width="2" fill="none"/>
  <rect x="7" y="14" width="2" height="3" fill="#fff8ec"/>
  <line class="slash" x1="1" y1="2" x2="15" y2="16" stroke="#fff8ec" stroke-width="2"/>
</svg>`;

/** The in-room control bar: connection status, mic toggle, and leave. */
export class ControlBar {
  private readonly element: HTMLElement;
  private readonly statusText: HTMLElement;
  private readonly micLabel: HTMLElement;
  private muted = false;
  private muteHandler: (muted: boolean) => void = () => {};
  private leaveHandler: () => void = () => {};

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'controlbar';
    this.element.innerHTML = `
      <div class="cb-status"><span class="dot"></span><span class="text">Connecting…</span></div>
      <div class="cb-divider"></div>
      <button class="mic" type="button">${MIC_SVG}<span class="mic-label">MIC ON</span></button>
      <button class="leave" type="button">LEAVE</button>`;

    this.statusText = this.element.querySelector<HTMLElement>('.cb-status .text')!;
    this.micLabel = this.element.querySelector<HTMLElement>('.mic-label')!;
    this.element.querySelector<HTMLButtonElement>('.mic')!.addEventListener('click', () => this.toggle());
    this.element.querySelector<HTMLButtonElement>('.leave')!.addEventListener('click', () => this.leaveHandler());
  }

  mount(parent: HTMLElement): void {
    parent.append(this.element);
  }

  destroy(): void {
    this.element.remove();
  }

  onToggleMute(handler: (muted: boolean) => void): void {
    this.muteHandler = handler;
  }

  onLeave(handler: () => void): void {
    this.leaveHandler = handler;
  }

  setStatus(text: string): void {
    this.statusText.textContent = text;
  }

  private toggle(): void {
    this.muted = !this.muted;
    this.element.classList.toggle('muted', this.muted);
    this.micLabel.textContent = this.muted ? 'MUTED' : 'MIC ON';
    this.muteHandler(this.muted);
  }
}
