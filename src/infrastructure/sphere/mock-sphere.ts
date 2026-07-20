import type {
  SphereFacadePort,
  SphereIdentityPort,
  SphereMarketPort,
  SphereMessagingPort,
  SphereWalletPort,
} from "@/domain/ports";
import type { AgentMessage, GuardianIdentity } from "@/domain/types";
import { clock } from "@/infrastructure/utils/clock";
import { ids } from "@/infrastructure/utils/id";

/**
 * Full mock of Sphere Identity, Wallet, Messaging, and Intent Market.
 * Enables complete autonomous economic loops offline and in CI.
 * Flip SPHERE_MODE=live to use LiveSphereFacade against testnet2.
 */
export class MockSphereFacade implements SphereFacadePort {
  readonly mode = "mock" as const;
  readonly identity: SphereIdentityPort;
  readonly wallet: SphereWalletPort;
  readonly messaging: SphereMessagingPort;
  readonly market: SphereMarketPort;

  private balance: number;
  private identityState: GuardianIdentity;
  private readonly messageHandlers = new Set<(msg: AgentMessage) => void>();
  private readonly intents = new Map<string, { id: string; status: string }>();

  constructor(options?: { nametag?: string; network?: string; balance?: number }) {
    const nametag = options?.nametag ?? "sphere-guardian";
    this.balance = options?.balance ?? 100;
    this.identityState = {
      nametag,
      directAddress: `DIRECT://mock${Buffer.from(nametag).toString("hex").slice(0, 40)}`,
      chainPubkey: `02${Buffer.from(nametag.padEnd(32, "0")).toString("hex").slice(0, 64)}`,
      mode: "mock",
      network: options?.network ?? "testnet2",
      connected: false,
    };

    this.identity = {
      connect: async () => {
        this.identityState = { ...this.identityState, connected: true };
        return { ...this.identityState };
      },
      getIdentity: () => ({ ...this.identityState }),
      disconnect: async () => {
        this.identityState = { ...this.identityState, connected: false };
      },
    };

    this.wallet = {
      getBalance: async () => this.balance,
      sendPayment: async ({ recipient, amount, memo }) => {
        if (amount > this.balance) {
          throw new Error("INSUFFICIENT_BALANCE");
        }
        this.balance = round2(this.balance - amount);
        const transferId = ids.generate("tx");
        return {
          transferId,
          status: "completed",
          deliveryPending: false,
          memo,
          recipient,
        };
      },
      mintTestTokens: async (amount) => {
        this.balance = round2(this.balance + amount);
        return { success: true };
      },
      sendPaymentRequest: async () => ({
        success: true,
        requestId: ids.generate("preq"),
      }),
      onPaymentRequest: (handler) => {
        // Mock peer service purchases can be injected externally if needed.
        void handler;
        return () => undefined;
      },
    };

    this.messaging = {
      send: async (peer, content, payload) => {
        const msg: AgentMessage = {
          id: ids.generate("msg"),
          direction: "outbound",
          peer,
          kind: (payload?.kind as AgentMessage["kind"]) ?? "status",
          content,
          payload,
          timestamp: clock.nowIso(),
          read: true,
        };
        // Simulate peer echo for negotiation traffic
        if (payload?.kind === "negotiation" && payload.direction !== "inbound_sim") {
          const echo: AgentMessage = {
            id: ids.generate("msg"),
            direction: "inbound",
            peer,
            kind: "negotiation",
            content: `ACK: ${content.slice(0, 120)}`,
            payload: { ...payload, ack: true },
            timestamp: clock.nowIso(),
            read: false,
          };
          queueMicrotask(() => {
            for (const h of this.messageHandlers) h(echo);
          });
        }
        return msg;
      },
      onMessage: (handler) => {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
      },
    };

    this.market = {
      publishIntent: async (intent) => {
        const sphereIntentId = ids.generate("mint");
        this.intents.set(sphereIntentId, { id: sphereIntentId, status: "active" });
        return {
          intentId: sphereIntentId,
          sphereIntentId,
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        };
      },
      searchServices: async (query) => [
        {
          id: ids.generate("svc"),
          description: `Mock service matching: ${query}`,
          agentNametag: "diag-nova",
          agentPublicKey: "02mockpublickeydiagnova",
          price: 2.5,
          currency: "TEST",
        },
      ],
      closeIntent: async (intentId) => {
        const existing = this.intents.get(intentId);
        if (existing) this.intents.set(intentId, { ...existing, status: "closed" });
      },
      getMyIntents: async () => [...this.intents.values()],
    };
  }

  /** Test helper */
  credit(amount: number): void {
    this.balance = round2(this.balance + amount);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
