import type {
  ClockPort,
  IdPort,
  NegotiationPort,
  SphereMarketPort,
  SphereMessagingPort,
} from "@/domain/ports";
import type {
  GuardianIntent,
  NegotiationScore,
  ServiceOffer,
} from "@/domain/types";
import { logger } from "@/infrastructure/logging/logger";

const MOCK_PEER_AGENTS = [
  { id: "agent_diag_nova", nametag: "diag-nova", reliability: 0.94 },
  { id: "agent_ops_helix", nametag: "ops-helix", reliability: 0.88 },
  { id: "agent_scan_orbit", nametag: "scan-orbit", reliability: 0.91 },
  { id: "agent_fix_pulse", nametag: "fix-pulse", reliability: 0.82 },
  { id: "agent_audit_zen", nametag: "audit-zen", reliability: 0.96 },
];

export interface NegotiationEngineOptions {
  mode: "mock" | "live";
  market?: SphereMarketPort;
  /** Live peer nametags to RFP on testnet2 */
  preferredPeers?: string[];
  /**
   * Optional: produce a firm local offer from an in-process live peer
   * when network DMs are slow (still a real Sphere identity).
   */
  localPeerOffer?: (
    intent: GuardianIntent
  ) => ServiceOffer | Promise<ServiceOffer | null> | null;
}

/**
 * Negotiation Engine — solicits offers from peer diagnostic agents,
 * scores by price / ETA / reliability, and selects the best provider.
 *
 * Live mode: real market search + Sphere DMs to preferred peers.
 * Mock mode: simulated peer mesh (tests / offline).
 */
export class NegotiationEngine implements NegotiationPort {
  private readonly inboundOffers = new Map<string, ServiceOffer[]>();
  private unsub: (() => void) | null = null;

  constructor(
    private readonly messaging: SphereMessagingPort,
    private readonly ids: IdPort,
    private readonly clock: ClockPort,
    private readonly options: NegotiationEngineOptions = { mode: "live" }
  ) {
    this.unsub = this.messaging.onMessage((msg) => {
      const payload = msg.payload ?? {};
      if (payload.kind !== "negotiation" || payload.direction !== "offer") {
        return;
      }
      const intentId = String(payload.intentId ?? "");
      if (!intentId) return;
      const offer: ServiceOffer = {
        id: String(payload.offerId ?? this.ids.generate("offer")),
        intentId,
        agentId: `agent_${payload.agentNametag ?? msg.peer}`,
        agentNametag: String(payload.agentNametag ?? msg.peer).replace(/^@/, ""),
        price: Number(payload.price ?? 0),
        currency: String(payload.currency ?? "UCT"),
        estimatedCompletionMs: Number(payload.estimatedCompletionMs ?? 8_000),
        reliabilityScore: Number(payload.reliabilityScore ?? 0.85),
        message: msg.content,
        receivedAt: this.clock.nowIso(),
      };
      const list = this.inboundOffers.get(intentId) ?? [];
      list.push(offer);
      this.inboundOffers.set(intentId, list);
    });
  }

  async solicitOffers(
    intent: GuardianIntent,
    windowMs: number
  ): Promise<ServiceOffer[]> {
    if (this.options.mode === "mock") {
      return this.solicitMockOffers(intent, windowMs);
    }
    return this.solicitLiveOffers(intent, windowMs);
  }

  private async solicitLiveOffers(
    intent: GuardianIntent,
    windowMs: number
  ): Promise<ServiceOffer[]> {
    const offers: ServiceOffer[] = [];
    const peers = new Set<string>();

    for (const p of this.options.preferredPeers ?? []) {
      peers.add(p.replace(/^@/, ""));
    }

    // Discover live service agents from Sphere Intent Market
    if (this.options.market) {
      try {
        const found = await this.options.market.searchServices(
          `diagnostics ${intent.metadata.projectName ?? ""} health`
        );
        for (const s of found) {
          if (s.agentNametag) peers.add(s.agentNametag.replace(/^@/, ""));
          if (s.price != null && s.agentNametag) {
            offers.push({
              id: this.ids.generate("offer"),
              intentId: intent.id,
              agentId: s.id,
              agentNametag: s.agentNametag.replace(/^@/, ""),
              price: Math.min(s.price, intent.maxBudget),
              currency: s.currency || intent.currency,
              estimatedCompletionMs: 10_000,
              reliabilityScore: 0.8,
              message: s.description.slice(0, 200),
              receivedAt: this.clock.nowIso(),
            });
          }
        }
      } catch (error) {
        logger.warn("Live market search failed during negotiation", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // RFP over Sphere DMs
    for (const peer of peers) {
      try {
        await this.messaging.send(
          `@${peer}`,
          `RFP: diagnostics for intent ${intent.id}. Max budget ${intent.maxBudget} ${intent.currency}. ${intent.description.slice(0, 240)}`,
          {
            kind: "rfp",
            intentId: intent.id,
            maxBudget: intent.maxBudget,
            currency: intent.currency,
            priority: intent.priority,
          }
        );
      } catch (error) {
        logger.warn("Live RFP DM failed", {
          peer,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // In-process live peer can return a firm offer immediately (real identity)
    if (this.options.localPeerOffer) {
      try {
        const local = await this.options.localPeerOffer(intent);
        if (local) offers.push(local);
      } catch (error) {
        logger.warn("Local peer offer failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const wait =
      process.env.NODE_ENV === "test" ? 10 : Math.min(windowMs, 15_000);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    const inbound = this.inboundOffers.get(intent.id) ?? [];
    this.inboundOffers.delete(intent.id);

    const merged = [...offers, ...inbound];
    // Dedupe by agent nametag (prefer inbound DM offers)
    const byAgent = new Map<string, ServiceOffer>();
    for (const o of merged) {
      byAgent.set(o.agentNametag, o);
    }
    const result = [...byAgent.values()];
    logger.info("Live negotiation offers collected", {
      intentId: intent.id,
      count: result.length,
      peers: result.map((o) => o.agentNametag),
    });
    return result;
  }

  private async solicitMockOffers(
    intent: GuardianIntent,
    windowMs: number
  ): Promise<ServiceOffer[]> {
    const responders = shuffle(MOCK_PEER_AGENTS).slice(
      0,
      3 + Math.floor(Math.random() * 2)
    );
    const offers: ServiceOffer[] = [];

    for (const peer of responders) {
      await this.messaging.send(
        `@${peer.nametag}`,
        `Soliciting diagnostics offer for intent ${intent.id}: ${intent.description}`,
        {
          kind: "negotiation",
          intentId: intent.id,
          maxBudget: intent.maxBudget,
          priority: intent.priority,
        }
      );

      const price = round2(
        clamp(
          intent.maxBudget * (0.35 + Math.random() * 0.7),
          0.5,
          intent.maxBudget * 1.15
        )
      );
      const estimatedCompletionMs = Math.round(4_000 + Math.random() * 20_000);
      const offer: ServiceOffer = {
        id: this.ids.generate("offer"),
        intentId: intent.id,
        agentId: peer.id,
        agentNametag: peer.nametag,
        price,
        currency: intent.currency,
        estimatedCompletionMs,
        reliabilityScore: clamp(
          peer.reliability + (Math.random() * 0.06 - 0.03),
          0.5,
          0.99
        ),
        message: `Can deliver diagnostics for ${intent.metadata.projectName ?? "target"} within ${(estimatedCompletionMs / 1000).toFixed(0)}s at ${price} ${intent.currency}.`,
        receivedAt: this.clock.nowIso(),
      };
      offers.push(offer);
    }

    const wait = Math.min(
      windowMs,
      process.env.NODE_ENV === "test" ? 10 : windowMs
    );
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return offers;
  }

  scoreOffers(offers: ServiceOffer[], maxBudget: number): NegotiationScore[] {
    if (!offers.length) return [];

    const minPrice = Math.min(...offers.map((o) => o.price));
    const maxPrice = Math.max(...offers.map((o) => o.price));
    const minTime = Math.min(...offers.map((o) => o.estimatedCompletionMs));
    const maxTime = Math.max(...offers.map((o) => o.estimatedCompletionMs));

    return offers.map((o) => {
      const overBudget = o.price > maxBudget;
      const priceScore =
        maxPrice === minPrice
          ? 1
          : 1 - (o.price - minPrice) / (maxPrice - minPrice || 1);
      const timeScore =
        maxTime === minTime
          ? 1
          : 1 -
            (o.estimatedCompletionMs - minTime) / (maxTime - minTime || 1);
      const reliabilityScore = o.reliabilityScore;

      let total =
        reliabilityScore * 0.4 + priceScore * 0.35 + timeScore * 0.25;
      if (overBudget) total *= 0.35;

      const rationale = overBudget
        ? `Over budget (${o.price} > ${maxBudget}); deprioritized despite reliability ${reliabilityScore.toFixed(2)}.`
        : `Balanced score — price ${o.price}, ETA ${(o.estimatedCompletionMs / 1000).toFixed(0)}s, reliability ${reliabilityScore.toFixed(2)}.`;

      return {
        offerId: o.id,
        totalScore: round2(total),
        priceScore: round2(priceScore),
        timeScore: round2(timeScore),
        reliabilityScore: round2(reliabilityScore),
        rationale,
      };
    });
  }

  selectBest(
    scores: NegotiationScore[],
    offers: ServiceOffer[]
  ): ServiceOffer | null {
    if (!scores.length || !offers.length) return null;
    const best = [...scores].sort((a, b) => b.totalScore - a.totalScore)[0];
    return offers.find((o) => o.id === best.offerId) ?? null;
  }
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
