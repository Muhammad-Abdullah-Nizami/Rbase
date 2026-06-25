// Thin wrapper over the WebSocket connection to the signaling server.
// Register handlers with .on(type, fn); send messages with .send(obj).

export class Signaling {
  constructor(url) {
    this.url = url;
    this.handlers = {};
    this.ws = null;
  }

  on(type, fn) {
    this.handlers[type] = fn;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onclose = () => this.handlers['close']?.();
      this.ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        this.handlers[msg.type]?.(msg);
      };
    });
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
