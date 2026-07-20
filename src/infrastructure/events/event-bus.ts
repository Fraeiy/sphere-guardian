import type { EventBusPort } from "@/domain/ports";
import type { ActivityEvent, GuardianStateSnapshot } from "@/domain/types";

type ActivityHandler = (event: ActivityEvent) => void;
type StateHandler = (snapshot: GuardianStateSnapshot) => void;

/**
 * In-process pub/sub for activity timeline + state fan-out (SSE/WebSocket bridges).
 */
export class InProcessEventBus implements EventBusPort {
  private readonly activityHandlers = new Set<ActivityHandler>();
  private readonly stateHandlers = new Set<StateHandler>();
  private lastState: GuardianStateSnapshot | null = null;

  publish(event: ActivityEvent): void {
    for (const handler of this.activityHandlers) {
      try {
        handler(event);
      } catch {
        // Subscriber errors must not break the agent loop.
      }
    }
  }

  subscribe(handler: ActivityHandler): () => void {
    this.activityHandlers.add(handler);
    return () => this.activityHandlers.delete(handler);
  }

  subscribeAll(handler: StateHandler): () => void {
    this.stateHandlers.add(handler);
    if (this.lastState) {
      try {
        handler(this.lastState);
      } catch {
        /* ignore */
      }
    }
    return () => this.stateHandlers.delete(handler);
  }

  emitState(snapshot: GuardianStateSnapshot): void {
    this.lastState = snapshot;
    for (const handler of this.stateHandlers) {
      try {
        handler(snapshot);
      } catch {
        /* ignore */
      }
    }
  }

  getLastState(): GuardianStateSnapshot | null {
    return this.lastState;
  }
}

export const eventBus = new InProcessEventBus();
