/** The pre-join overlay: collects a display name and reports it via onJoin. */
export class JoinScreen {
  private readonly element: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly button: HTMLButtonElement;
  private readonly error: HTMLElement;
  private joinHandler: (name: string) => void = () => {};

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'join';
    this.element.innerHTML = `
      <div class="card">
        <h1>Proximity Room</h1>
        <p class="muted">Walk close to people to hear them.</p>
        <input class="input" type="text" maxlength="24" placeholder="Your name" autocomplete="off" />
        <button class="button" type="button">Join Room</button>
        <p class="error" hidden></p>
        <p class="hint">Move with arrow keys or WASD.</p>
      </div>`;

    this.input = this.element.querySelector<HTMLInputElement>('.input')!;
    this.button = this.element.querySelector<HTMLButtonElement>('.button')!;
    this.error = this.element.querySelector<HTMLElement>('.error')!;

    this.button.addEventListener('click', () => this.submit());
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.submit();
    });

    parent.append(this.element);
    this.input.focus();
  }

  onJoin(handler: (name: string) => void): void {
    this.joinHandler = handler;
  }

  setBusy(busy: boolean): void {
    this.button.disabled = busy;
    this.button.textContent = busy ? 'Joining…' : 'Join Room';
  }

  showError(message: string): void {
    this.error.textContent = message;
    this.error.hidden = false;
    this.setBusy(false);
  }

  remove(): void {
    this.element.remove();
  }

  private submit(): void {
    const name = this.input.value.trim();
    if (!name) {
      this.input.focus();
      return;
    }
    this.error.hidden = true;
    this.joinHandler(name);
  }
}
