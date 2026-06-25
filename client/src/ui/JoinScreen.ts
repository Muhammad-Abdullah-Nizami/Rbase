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
        <div class="title">Proximity</div>
        <div class="title-underline"></div>
        <div class="subtitle">A cozy little place to work together.</div>
        <div class="field-label">YOUR NAME</div>
        <input class="name-input" type="text" maxlength="20" placeholder="traveller" autocomplete="off" />
        <button class="enter" type="button">Enter the Space</button>
        <div class="error" hidden></div>
        <div class="foot">Walk close to people to hear them · move with WASD</div>
      </div>`;

    this.input = this.element.querySelector<HTMLInputElement>('.name-input')!;
    this.button = this.element.querySelector<HTMLButtonElement>('.enter')!;
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
    this.button.textContent = busy ? 'Entering…' : 'Enter the Space';
  }

  showError(message: string): void {
    this.error.textContent = message;
    this.error.hidden = false;
    this.setBusy(false);
  }

  show(): void {
    this.element.hidden = false;
    this.setBusy(false);
    this.input.focus();
  }

  hide(): void {
    this.element.hidden = true;
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
