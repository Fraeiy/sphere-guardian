/**
 * Ports (interfaces) — dependency inversion for clean architecture.
 */

import type {
  ActivityEvent,
  AgentMessage,
  AiReport,
  Anomaly,
  DecisionReasoning,
  DiagnosticResult,
  EcosystemProject,
  GuardianConfig,
  GuardianIdentity,
  GuardianIntent,
  GuardianStateSnapshot,
  MetricSnapshot,
  NegotiationScore,
  ServiceKind,
  ServiceOffer,
  ServiceRequest,
  SettlementRecord,
  TransactionRecord,
} from "./types";

export interface ClockPort {
  now(): Date;
  nowIso(): string;
  sleep(ms: number): Promise<void>;
}

export interface IdPort {
  generate(prefix?: string): string;
}

export interface LoggerPort {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface EventBusPort {
  publish(event: ActivityEvent): void;
  subscribe(handler: (event: ActivityEvent) => void): () => void;
  subscribeAll(handler: (snapshot: GuardianStateSnapshot) => void): () => void;
  emitState(snapshot: GuardianStateSnapshot): void;
}

export interface StateStorePort {
  load(): Promise<GuardianStateSnapshot | null>;
  save(state: GuardianStateSnapshot): Promise<void>;
  appendActivity(event: ActivityEvent): Promise<void>;
}

export interface HealthMonitorPort {
  collectProjects(): Promise<EcosystemProject[]>;
  collectMetrics(projects: EcosystemProject[]): Promise<MetricSnapshot[]>;
  detectAnomalies(
    projects: EcosystemProject[],
    history: MetricSnapshot[]
  ): Promise<Anomaly[]>;
}

export interface DecisionEnginePort {
  analyze(anomaly: Anomaly, context: DecisionContext): Promise<DecisionReasoning>;
  shouldAct(reasoning: DecisionReasoning, config: GuardianConfig): boolean;
  summarizeIncident(input: ReportContext): Promise<string>;
  generateReport(input: ReportContext): Promise<AiReport>;
}

export interface DecisionContext {
  projects: EcosystemProject[];
  recentIncidents: number;
  walletBalance: number;
}

export interface ReportContext {
  type: AiReport["type"];
  projects: EcosystemProject[];
  incidents: GuardianStateSnapshot["incidents"];
  metrics: MetricSnapshot[];
  activity: ActivityEvent[];
  periodStart: string;
  periodEnd: string;
  incidentId?: string;
}

export interface SphereIdentityPort {
  connect(): Promise<GuardianIdentity>;
  getIdentity(): GuardianIdentity;
  disconnect(): Promise<void>;
}

export interface SphereWalletPort {
  getBalance(currency?: string): Promise<number>;
  sendPayment(input: {
    recipient: string;
    amount: number;
    currency: string;
    memo?: string;
  }): Promise<{ transferId: string; status: string; deliveryPending?: boolean }>;
  mintTestTokens?(amount: number, currency: string): Promise<{ success: boolean; error?: string }>;
  onPaymentRequest?(
    handler: (req: {
      id: string;
      amount: string;
      coinId: string;
      message?: string;
      senderNametag?: string;
    }) => Promise<void>
  ): () => void;
  sendPaymentRequest?(
    recipient: string,
    request: { amount: string; coinId: string; message?: string }
  ): Promise<{ success: boolean; requestId?: string; error?: string }>;
}

export interface SphereMessagingPort {
  send(peer: string, content: string, payload?: Record<string, unknown>): Promise<AgentMessage>;
  onMessage(handler: (msg: AgentMessage) => void): () => void;
}

export interface SphereMarketPort {
  publishIntent(intent: Omit<GuardianIntent, "id" | "status" | "publishedAt"> & {
    description: string;
  }): Promise<{ intentId: string; sphereIntentId?: string; expiresAt?: string }>;
  searchServices(query: string): Promise<
    Array<{
      id: string;
      description: string;
      agentNametag?: string;
      agentPublicKey: string;
      price?: number;
      currency: string;
    }>
  >;
  closeIntent(intentId: string): Promise<void>;
  getMyIntents(): Promise<Array<{ id: string; status: string }>>;
}

export interface NegotiationPort {
  solicitOffers(intent: GuardianIntent, windowMs: number): Promise<ServiceOffer[]>;
  scoreOffers(
    offers: ServiceOffer[],
    maxBudget: number
  ): NegotiationScore[];
  selectBest(
    scores: NegotiationScore[],
    offers: ServiceOffer[]
  ): ServiceOffer | null;
}

export interface SettlementPort {
  settle(input: {
    offer: ServiceOffer;
    incidentId: string;
  }): Promise<SettlementRecord>;
}

export interface DiagnosticServicePort {
  requestDiagnostics(input: {
    offer: ServiceOffer;
    incidentId: string;
    project: EcosystemProject;
    anomaly: Anomaly;
  }): Promise<DiagnosticResult>;
  fulfillServiceRequest(request: ServiceRequest, projects: EcosystemProject[]): Promise<{
    reportMarkdown: string;
  }>;
  getCatalog(): ServiceListingPort[];
}

export type ServiceListingPort = {
  kind: ServiceKind;
  name: string;
  description: string;
  price: number;
  currency: string;
  estimatedMs: number;
  available: boolean;
};

export interface RateLimiterPort {
  tryAcquire(key: string, limit: number, windowMs: number): boolean;
}

export interface AiProviderPort {
  complete(input: {
    system: string;
    prompt: string;
    temperature?: number;
  }): Promise<{ text: string; model: string }>;
  isAvailable(): boolean;
}

export interface SphereFacadePort {
  identity: SphereIdentityPort;
  wallet: SphereWalletPort;
  messaging: SphereMessagingPort;
  market: SphereMarketPort;
  mode: "mock" | "live";
}
