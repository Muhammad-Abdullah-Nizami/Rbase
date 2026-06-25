export type Listener<T> = (payload: T) => void;

/**
 * A tiny strongly-typed event emitter. `Events` maps each event name to its
 * payload type, so `on`/`emit` are fully type-checked and there are no string
 * typos or `any` payloads.
 */
export class TypedEventEmitter<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => this.off(event, listener);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<never>);
  }

  protected emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // Copy so a listener that unsubscribes mid-dispatch can't corrupt iteration.
    for (const listener of [...set]) (listener as Listener<Events[K]>)(payload);
  }
}
