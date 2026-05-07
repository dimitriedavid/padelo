export type LiveEvent = {
  type: "tournament_updated";
  data: Record<string, unknown>;
};

export type LiveEventListener = (event: LiveEvent) => void;

export class EventHub {
  private readonly listeners = new Map<string, Set<LiveEventListener>>();

  subscribe(roomCode: string, listener: LiveEventListener): () => void {
    const key = roomCode.toUpperCase();
    const listeners = this.listeners.get(key) ?? new Set<LiveEventListener>();
    listeners.add(listener);
    this.listeners.set(key, listeners);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  publish(roomCode: string, event: LiveEvent): void {
    const listeners = this.listeners.get(roomCode.toUpperCase());

    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener(event);
    }
  }
}

