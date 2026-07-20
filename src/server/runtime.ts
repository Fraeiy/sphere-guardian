import { GuardianAgent } from "@/application/agents/guardian-agent";
import { EcosystemHealthEngine } from "@/application/engines/health-engine";
import { LiveEcosystemHealthEngine } from "@/application/engines/live-health-engine";
import { AiDecisionEngine } from "@/application/engines/decision-engine";
import { NegotiationEngine } from "@/application/engines/negotiation-engine";
import { AutonomousSettlementEngine } from "@/application/engines/settlement-engine";
import { createDiagnosticService } from "@/application/engines/diagnostic-service";
import { resolveConfig } from "@/domain/config";
import type {
  HealthMonitorPort,
  SphereFacadePort,
  StateStorePort,
} from "@/domain/ports";
import { createAiProvider } from "@/infrastructure/ai/providers";
import { eventBus } from "@/infrastructure/events/event-bus";
import { StructuredLogger } from "@/infrastructure/logging/logger";
import { FileStateStore } from "@/infrastructure/persistence/file-store";
import { PostgresStateStore } from "@/infrastructure/persistence/postgres-store";
import { MockSphereFacade } from "@/infrastructure/sphere/mock-sphere";
import { createLiveSphereFacade } from "@/infrastructure/sphere/live-sphere";
import {
  createLivePeerAgent,
  type LivePeerDiagnosticAgent,
} from "@/infrastructure/sphere/live-peer-agent";
import { resolveSphereMode } from "@/infrastructure/sphere/public-config";
import { clock } from "@/infrastructure/utils/clock";
import { ids } from "@/infrastructure/utils/id";
import { rateLimiter } from "@/infrastructure/utils/rate-limiter";

const GLOBAL_KEY = "__sphere_guardian_runtime__" as const;

interface RuntimeHandle {
  agent: GuardianAgent;
  peer: LivePeerDiagnosticAgent | null;
  starting: Promise<void> | null;
  mode: "mock" | "live";
}

type GlobalRuntime = typeof globalThis & {
  [GLOBAL_KEY]?: RuntimeHandle;
};

function getGlobal(): GlobalRuntime {
  return globalThis as GlobalRuntime;
}

function createStore(): StateStorePort {
  if (process.env.DATABASE_URL) {
    return new PostgresStateStore(process.env.DATABASE_URL);
  }
  return new FileStateStore(process.env.GUARDIAN_DATA_DIR ?? ".data");
}

function createSphere(nametag: string, mode: "mock" | "live"): SphereFacadePort {
  if (mode === "live") {
    return createLiveSphereFacade(nametag);
  }
  return new MockSphereFacade({
    nametag,
    network: process.env.SPHERE_NETWORK ?? "testnet2",
    balance: Number(process.env.GUARDIAN_INITIAL_BALANCE ?? 100),
  });
}

async function buildAndStart(): Promise<{
  agent: GuardianAgent;
  peer: LivePeerDiagnosticAgent | null;
  mode: "mock" | "live";
}> {
  const mode = resolveSphereMode();
  const config = resolveConfig({ mode });
  const logger = new StructuredLogger("runtime");
  logger.info("Booting Sphere Guardian", {
    mode,
    network: config.network,
    nametag: config.nametag,
    currency: config.currency,
  });

  const sphere = createSphere(config.nametag, mode);

  let peer: LivePeerDiagnosticAgent | null = null;
  if (mode === "live" && process.env.GUARDIAN_ENABLE_PEER !== "false") {
    peer = createLivePeerAgent();
    try {
      await peer.start();
      logger.info("Live peer agent started for A2A settlement", {
        peer: peer.getNametag(),
      });
    } catch (error) {
      logger.error("Live peer failed to start — negotiation will use market only", {
        error: error instanceof Error ? error.message : String(error),
      });
      peer = null;
    }
  }

  let health: HealthMonitorPort;
  if (mode === "live") {
    health = new LiveEcosystemHealthEngine(
      config.anomalyThresholds,
      ids,
      clock,
      {
        getNetworkStats: async () => {
          try {
            const intents = await sphere.market.getMyIntents();
            const search = await sphere.market.searchServices("diagnostics service");
            return {
              activeAgents: Math.max(search.length, 1) + (peer ? 1 : 0),
              intentCount: intents.length + search.length,
              serviceRequests: search.length,
            };
          } catch {
            return { activeAgents: peer ? 2 : 1, intentCount: 0, serviceRequests: 0 };
          }
        },
      }
    );
  } else {
    health = new EcosystemHealthEngine(config.anomalyThresholds, ids, clock, {
      forceAnomalyEvery: Number(process.env.GUARDIAN_ANOMALY_EVERY ?? 4),
    });
  }

  const decision = new AiDecisionEngine(createAiProvider(), ids, clock);
  const negotiation = new NegotiationEngine(sphere.messaging, ids, clock, {
    mode,
    market: sphere.market,
    preferredPeers: peer ? [peer.getNametag()] : [],
    localPeerOffer: peer
      ? (intent) =>
          peer!.createOffer(intent.id, intent.maxBudget, intent.currency)
      : undefined,
  });
  const settlement = new AutonomousSettlementEngine(sphere.wallet, ids, clock);
  const diagnostics = createDiagnosticService(ids, clock, config.serviceCatalog);

  const agent = new GuardianAgent({
    config,
    sphere,
    health,
    decision,
    negotiation,
    settlement,
    diagnostics,
    store: createStore(),
    events: eventBus,
    ids,
    clock,
    logger,
    rateLimiter,
  });

  await agent.start();
  return { agent, peer, mode };
}

export function getRuntime(): RuntimeHandle | null {
  return getGlobal()[GLOBAL_KEY] ?? null;
}

let bootPromise: Promise<RuntimeHandle> | null = null;

export async function ensureAgentStarted(): Promise<GuardianAgent> {
  const existing = getGlobal()[GLOBAL_KEY];
  if (existing?.agent?.isRunning()) {
    return existing.agent;
  }

  if (!bootPromise) {
    bootPromise = (async () => {
      const { agent, peer, mode } = await buildAndStart();
      const handle: RuntimeHandle = {
        agent,
        peer,
        starting: null,
        mode,
      };
      getGlobal()[GLOBAL_KEY] = handle;
      return handle;
    })().finally(() => {
      bootPromise = null;
    });
  }

  const handle = await bootPromise;
  return handle.agent;
}

export async function stopRuntime(): Promise<void> {
  const handle = getGlobal()[GLOBAL_KEY];
  if (!handle) return;
  await handle.agent.stop();
  if (handle.peer) {
    await handle.peer.stop().catch(() => undefined);
  }
  getGlobal()[GLOBAL_KEY] = undefined;
}

export function getEventBus() {
  return eventBus;
}
