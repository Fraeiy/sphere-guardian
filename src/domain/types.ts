/**
 * Domain types for Sphere Guardian AI.
 * Pure TypeScript — no infrastructure dependencies.
 */

export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type Priority = "low" | "medium" | "high" | "critical";
export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";
export type IncidentStatus =
  | "detected"
  | "analyzing"
  | "intent_published"
  | "negotiating"
  | "provider_selected"
  | "payment_pending"
  | "payment_settled"
  | "diagnostics_received"
  | "resolved"
  | "failed"
  | "cancelled";

export type ActivityKind =
  | "anomaly_detected"
  | "analysis_complete"
  | "intent_published"
  | "negotiation_started"
  | "offer_received"
  | "provider_selected"
  | "payment_settled"
  | "message_sent"
  | "message_received"
  | "diagnostics_received"
  | "issue_resolved"
  | "service_request"
  | "service_fulfilled"
  | "agent_started"
  | "agent_tick"
  | "error"
  | "system";

export type ServiceKind =
  | "health_report"
  | "security_scan"
  | "optimization_report"
  | "performance_audit"
  | "ecosystem_analytics";

export type TransactionKind =
  | "outbound_settlement"
  | "inbound_service"
  | "mint"
  | "refund";

export type TransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "delivery_pending";

export interface EcosystemProject {
  id: string;
  name: string;
  slug: string;
  url?: string;
  status: HealthStatus;
  apiLatencyMs: number;
  storageUtilizationPct: number;
  responseTimeMs: number;
  uptimePct: number;
  failureRatePct: number;
  txFailureRatePct: number;
  messagingFailureRatePct: number;
  paymentFailureRatePct: number;
  activeUsers: number;
  activeAgents: number;
  lastCheckedAt: string;
  tags: string[];
}

export interface MetricSnapshot {
  id: string;
  timestamp: string;
  projectId?: string;
  latencyMs: number;
  usage: number;
  payments: number;
  transactions: number;
  incidents: number;
  activeAgents: number;
  serviceRequests: number;
  uptimePct: number;
  storageUtilizationPct: number;
}

export interface DecisionReasoning {
  whyAbnormal: string;
  confidence: number; // 0–1
  suggestedAction: string;
  severity: Severity;
  expectedImpact: string;
  evidence: string[];
  model?: string;
}

export interface Anomaly {
  id: string;
  projectId: string;
  projectName: string;
  metric: string;
  observedValue: number;
  baselineValue: number;
  threshold: number;
  direction: "above" | "below";
  detectedAt: string;
  reasoning: DecisionReasoning;
}

export interface GuardianIntent {
  id: string;
  sphereIntentId?: string;
  incidentId: string;
  description: string;
  intentType: "service" | "buy" | "other";
  category: string;
  maxBudget: number;
  currency: string;
  priority: Priority;
  status: "draft" | "published" | "closed" | "expired" | "filled";
  publishedAt?: string;
  expiresAt?: string;
  metadata: Record<string, unknown>;
}

export interface ServiceOffer {
  id: string;
  intentId: string;
  agentId: string;
  agentNametag: string;
  price: number;
  currency: string;
  estimatedCompletionMs: number;
  reliabilityScore: number; // 0–1
  message: string;
  receivedAt: string;
}

export interface SettlementRecord {
  id: string;
  incidentId: string;
  offerId: string;
  recipient: string;
  amount: number;
  currency: string;
  transferId?: string;
  status: TransactionStatus;
  settledAt: string;
  confirmation?: string;
  error?: string;
}

export interface AgentMessage {
  id: string;
  direction: "inbound" | "outbound";
  peer: string;
  kind:
    | "negotiation"
    | "status"
    | "job_completion"
    | "error"
    | "service_request"
    | "diagnostic";
  content: string;
  payload?: Record<string, unknown>;
  timestamp: string;
  read: boolean;
}

export interface DiagnosticResult {
  id: string;
  incidentId: string;
  provider: string;
  serviceKind: ServiceKind | string;
  summary: string;
  findings: string[];
  recommendations: string[];
  rawReportMarkdown: string;
  receivedAt: string;
  score?: number;
}

export interface Incident {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  status: IncidentStatus;
  severity: Severity;
  anomaly: Anomaly;
  intentId?: string;
  selectedOfferId?: string;
  settlementId?: string;
  diagnosticId?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  timeline: string[]; // activity event ids
}

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  severity?: Severity;
  incidentId?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface TransactionRecord {
  id: string;
  kind: TransactionKind;
  amount: number;
  currency: string;
  counterparty: string;
  status: TransactionStatus;
  transferId?: string;
  memo?: string;
  incidentId?: string;
  serviceKind?: ServiceKind;
  createdAt: string;
}

export interface ServiceListing {
  kind: ServiceKind;
  name: string;
  description: string;
  price: number;
  currency: string;
  estimatedMs: number;
  available: boolean;
}

export interface ServiceRequest {
  id: string;
  kind: ServiceKind;
  requester: string;
  price: number;
  currency: string;
  status: "pending" | "paid" | "fulfilling" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
  reportMarkdown?: string;
  paymentRequestId?: string;
  transferId?: string;
}

export interface AiReport {
  id: string;
  type: "daily" | "weekly" | "incident" | "health" | "recommendations";
  title: string;
  markdown: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  incidentId?: string;
}

export interface GuardianIdentity {
  nametag?: string;
  directAddress?: string;
  chainPubkey?: string;
  mode: "mock" | "live";
  network: string;
  connected: boolean;
}

export interface GuardianConfig {
  agentName: string;
  nametag: string;
  mode: "mock" | "live";
  network: string;
  tickIntervalMs: number;
  negotiationWindowMs: number;
  maxBudgetDefault: number;
  currency: string;
  autoSettle: boolean;
  maxConcurrentIncidents: number;
  anomalyThresholds: AnomalyThresholds;
  serviceCatalog: ServiceListing[];
}

export interface AnomalyThresholds {
  apiLatencyMs: number;
  storageUtilizationPct: number;
  responseTimeMs: number;
  uptimePctMin: number;
  failureRatePct: number;
  txFailureRatePct: number;
  messagingFailureRatePct: number;
  paymentFailureRatePct: number;
}

export interface GuardianStateSnapshot {
  identity: GuardianIdentity;
  config: GuardianConfig;
  running: boolean;
  startedAt?: string;
  lastTickAt?: string;
  tickCount: number;
  projects: EcosystemProject[];
  incidents: Incident[];
  intents: GuardianIntent[];
  offers: ServiceOffer[];
  settlements: SettlementRecord[];
  messages: AgentMessage[];
  diagnostics: DiagnosticResult[];
  activity: ActivityEvent[];
  transactions: TransactionRecord[];
  serviceRequests: ServiceRequest[];
  metrics: MetricSnapshot[];
  reports: AiReport[];
  walletBalance: number;
  walletCurrency: string;
}

export interface NegotiationScore {
  offerId: string;
  totalScore: number;
  priceScore: number;
  timeScore: number;
  reliabilityScore: number;
  rationale: string;
}
