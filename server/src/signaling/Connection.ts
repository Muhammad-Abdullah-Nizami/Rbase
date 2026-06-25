/**
 * Transport-agnostic bidirectional message channel. The signaling domain talks
 * only to this interface, so WebSockets are just one adapter (`ws/`) and tests
 * can drive the domain with an in-memory fake.
 */
export interface Connection {
  send(data: string): void;
  close(): void;
  onMessage(handler: (data: string) => void): void;
  onClose(handler: () => void): void;
}
