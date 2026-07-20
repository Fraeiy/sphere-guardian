import type { AgentMessage, ServiceOffer } from "@/domain/types";
import { logger } from "@/infrastructure/logging/logger";
import { ids } from "@/infrastructure/utils/id";
import { clock } from "@/infrastructure/utils/clock";
import {
  LiveSphereFacade,
  createLiveSphereFacade,
} from "@/infrastructure/sphere/live-sphere";

/**
 * Second live Sphere identity that provides diagnostics on testnet2.
 * Enables real agent-to-agent messaging + settlement without mock peers.
 */
export class LivePeerDiagnosticAgent {
  private readonly facade: LiveSphereFacade;
  private unsub: (() => void) | null = null;
  private started = false;
  private nametag: string;

  constructor(nametag: string) {
    this.nametag = nametag.replace(/^@/, "");
    this.facade = createLiveSphereFacade(this.nametag, {
      dataDir: process.env.SPHERE_PEER_DATA_DIR ?? ".data/sphere-peer-wallet",
      tokensDir: process.env.SPHERE_PEER_TOKENS_DIR ?? ".data/sphere-peer-tokens",
      deviceId:
        process.env.SPHERE_PEER_DEVICE_ID ?? "sphere-guardian-peer-device",
    });
  }

  getNametag(): string {
    return this.nametag;
  }

  getFacade(): LiveSphereFacade {
    return this.facade;
  }

  async start(): Promise<void> {
    if (this.started) return;
    const identity = await this.facade.identity.connect();
    this.nametag = identity.nametag ?? this.nametag;

    // Ensure peer can receive payments (mint if empty)
    const bal = await this.facade.wallet.getBalance("UCT");
    if (bal < 1 && this.facade.wallet.mintTestTokens) {
      await this.facade.wallet.mintTestTokens(10, "UCT");
    }

    // Publish service availability on market
    try {
      await this.facade.market.publishIntent({
        incidentId: "peer-catalog",
        description:
          "[Live Diagnostics Provider] Sphere Guardian Peer — performance audits & health diagnostics for testnet2 applications. Reliable autonomous fulfillment.",
        intentType: "service",
        category: "diagnostics",
        maxBudget: 3,
        currency: "UCT",
        priority: "medium",
        metadata: { seller: true, peer: true },
      });
    } catch (error) {
      logger.warn("Peer market publish failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.unsub = this.facade.messaging.onMessage(async (msg) => {
      await this.handleMessage(msg);
    });

    this.started = true;
    logger.info("Live peer diagnostic agent online", {
      nametag: this.nametag,
      address: identity.directAddress?.slice(0, 28),
    });
  }

  async stop(): Promise<void> {
    this.unsub?.();
    this.unsub = null;
    await this.facade.identity.disconnect();
    this.started = false;
  }

  /**
   * Create a firm offer for an intent (used when guardian RFPs this peer).
   */
  createOffer(intentId: string, maxBudget: number, currency: string): ServiceOffer {
    const price = Math.min(
      maxBudget,
      Math.max(0.5, Math.round(maxBudget * 0.55 * 100) / 100)
    );
    return {
      id: ids.generate("offer"),
      intentId,
      agentId: `peer_${this.nametag}`,
      agentNametag: this.nametag,
      price,
      currency,
      estimatedCompletionMs: 6_000,
      reliabilityScore: 0.95,
      message: `Live peer @${this.nametag} will deliver diagnostics on testnet2 for ${price} ${currency}.`,
      receivedAt: clock.nowIso(),
    };
  }

  private async handleMessage(msg: AgentMessage): Promise<void> {
    const payload = msg.payload ?? {};
    if (payload.kind !== "negotiation" && payload.kind !== "rfp") return;
    if (payload.direction === "offer") return;

    const intentId = String(payload.intentId ?? "unknown");
    const maxBudget = Number(payload.maxBudget ?? 5);
    const currency = String(payload.currency ?? "UCT");
    const offer = this.createOffer(intentId, maxBudget, currency);

    try {
      await this.facade.messaging.send(
        msg.peer,
        offer.message,
        {
          kind: "negotiation",
          direction: "offer",
          offerId: offer.id,
          intentId,
          price: offer.price,
          currency: offer.currency,
          estimatedCompletionMs: offer.estimatedCompletionMs,
          reliabilityScore: offer.reliabilityScore,
          agentNametag: this.nametag,
        }
      );
      logger.info("Peer sent live offer", {
        to: msg.peer,
        price: offer.price,
        intentId,
      });
    } catch (error) {
      logger.warn("Peer offer DM failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function createLivePeerAgent(): LivePeerDiagnosticAgent {
  const base =
    process.env.GUARDIAN_PEER_NAMETAG ??
    process.env.GUARDIAN_NAMETAG ??
    "sphere-guardian";
  // Distinct nametag for the provider wallet
  const peerTag = process.env.GUARDIAN_PEER_NAMETAG
    ? process.env.GUARDIAN_PEER_NAMETAG
    : `${base}-peer`;
  return new LivePeerDiagnosticAgent(peerTag);
}
