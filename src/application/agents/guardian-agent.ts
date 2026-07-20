import type {
  ClockPort,
  DecisionEnginePort,
  DiagnosticServicePort,
  EventBusPort,
  HealthMonitorPort,
  IdPort,
  LoggerPort,
  NegotiationPort,
  RateLimiterPort,
  SettlementPort,
  SphereFacadePort,
  StateStorePort,
} from "@/domain/ports";
import type {
  ActivityEvent,
  ActivityKind,
  GuardianConfig,
  GuardianStateSnapshot,
  Incident,
  Severity,
  TransactionRecord,
} from "@/domain/types";
import { resolveConfig } from "@/domain/config";

export interface GuardianAgentDeps {
  config?: Partial<GuardianConfig>;
  sphere: SphereFacadePort;
  health: HealthMonitorPort;
  decision: DecisionEnginePort;
  negotiation: NegotiationPort;
  settlement: SettlementPort;
  diagnostics: DiagnosticServicePort;
  store: StateStorePort;
  events: EventBusPort;
  ids: IdPort;
  clock: ClockPort;
  logger: LoggerPort;
  rateLimiter: RateLimiterPort;
}

/**
 * Autonomous Guardian Agent
 *
 * Loop: monitor → analyze → decide → publish intent → negotiate →
 * select provider → settle payment → receive diagnostics → learn → continue.
 *
 * No manual approval after startup.
 */
export class GuardianAgent {
  private state: GuardianStateSnapshot;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickInFlight = false;
  private readonly config: GuardianConfig;
  private unsubMessages: (() => void) | null = null;

  constructor(private readonly deps: GuardianAgentDeps) {
    this.config = resolveConfig(deps.config);
    this.state = this.emptyState();
  }

  getSnapshot(): GuardianStateSnapshot {
    return structuredClone(this.state);
  }

  isRunning(): boolean {
    return this.state.running;
  }

  async start(): Promise<void> {
    if (this.state.running) return;

    const persisted = await this.deps.store.load();
    if (persisted) {
      this.state = {
        ...persisted,
        config: this.config,
        running: false,
      };
      // Keep identity mode in sync with current facade
      this.state.identity.mode = this.deps.sphere.mode;
    } else {
      this.state = this.emptyState();
    }

    const identity = await this.deps.sphere.identity.connect();
    this.state.identity = identity;
    this.state.walletBalance = await this.deps.sphere.wallet.getBalance(
      this.config.currency
    );

    // Best-effort top-up in mock / live testnet
    if (this.state.walletBalance < this.config.maxBudgetDefault * 2) {
      if (this.deps.sphere.wallet.mintTestTokens) {
        const mint = await this.deps.sphere.wallet.mintTestTokens(
          50,
          this.config.currency
        );
        if (mint.success) {
          this.state.walletBalance = await this.deps.sphere.wallet.getBalance(
            this.config.currency
          );
          this.recordActivity("system", "Wallet topped up", `Balance ${this.state.walletBalance} ${this.config.currency}`);
        }
      }
    }

    this.unsubMessages = this.deps.sphere.messaging.onMessage((msg) => {
      this.state.messages = [msg, ...this.state.messages].slice(0, 200);
      this.recordActivity(
        "message_received",
        "Message received",
        `${msg.peer}: ${msg.content.slice(0, 120)}`,
        { severity: "info" }
      );
      this.emit();
    });

    this.state.running = true;
    this.state.startedAt = this.deps.clock.nowIso();
    this.recordActivity(
      "agent_started",
      "Guardian started",
      `Mode=${this.deps.sphere.mode} network=${this.config.network} autoSettle=${this.config.autoSettle}`,
      { severity: "info" }
    );

    // Publish service availability on the market
    await this.publishServiceCatalog();

    await this.persistAndEmit();

    // Immediate first tick, then interval
    void this.safeTick();
    this.timer = setInterval(() => {
      void this.safeTick();
    }, this.config.tickIntervalMs);

    this.deps.logger.info("Guardian agent running", {
      mode: this.deps.sphere.mode,
      tickMs: this.config.tickIntervalMs,
    });
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.unsubMessages) {
      this.unsubMessages();
      this.unsubMessages = null;
    }
    this.state.running = false;
    this.recordActivity("system", "Guardian stopped", "Agent loop halted");
    await this.deps.sphere.identity.disconnect();
    await this.persistAndEmit();
  }

  async forceTick(): Promise<GuardianStateSnapshot> {
    await this.safeTick();
    return this.getSnapshot();
  }

  async generateReport(
    type: "daily" | "weekly" | "incident" | "health" | "recommendations",
    incidentId?: string
  ) {
    const end = this.deps.clock.nowIso();
    const start = new Date(
      Date.now() - (type === "weekly" ? 7 : 1) * 86_400_000
    ).toISOString();
    const report = await this.deps.decision.generateReport({
      type,
      projects: this.state.projects,
      incidents: this.state.incidents,
      metrics: this.state.metrics,
      activity: this.state.activity,
      periodStart: start,
      periodEnd: end,
      incidentId,
    });
    this.state.reports = [report, ...this.state.reports].slice(0, 50);
    this.recordActivity("system", "Report generated", report.title);
    await this.persistAndEmit();
    return report;
  }

  async purchaseService(
    kind: import("@/domain/types").ServiceKind,
    requester = "@external-agent"
  ) {
    const listing = this.config.serviceCatalog.find((s) => s.kind === kind);
    if (!listing || !listing.available) {
      throw new Error(`Service ${kind} unavailable`);
    }

    const request: import("@/domain/types").ServiceRequest = {
      id: this.deps.ids.generate("sreq"),
      kind,
      requester,
      price: listing.price,
      currency: listing.currency,
      status: "paid",
      createdAt: this.deps.clock.nowIso(),
    };

    // Credit guardian wallet (buyer pays)
    this.state.walletBalance = round2(this.state.walletBalance + listing.price);
    request.status = "fulfilling";

    const { reportMarkdown } = await this.deps.diagnostics.fulfillServiceRequest(
      request,
      this.state.projects
    );
    request.status = "completed";
    request.completedAt = this.deps.clock.nowIso();
    request.reportMarkdown = reportMarkdown;

    this.state.serviceRequests = [request, ...this.state.serviceRequests].slice(0, 100);
    this.pushTx({
      id: this.deps.ids.generate("tx"),
      kind: "inbound_service",
      amount: listing.price,
      currency: listing.currency,
      counterparty: requester,
      status: "completed",
      serviceKind: kind,
      memo: `Paid ${kind}`,
      createdAt: this.deps.clock.nowIso(),
    });

    this.recordActivity(
      "service_fulfilled",
      "Service fulfilled",
      `${kind} sold to ${requester} for ${listing.price} ${listing.currency}`
    );
    await this.persistAndEmit();
    return request;
  }

  private async safeTick(): Promise<void> {
    if (this.tickInFlight || !this.state.running) return;
    this.tickInFlight = true;
    try {
      await this.tick();
    } catch (error) {
      this.deps.logger.error("Tick failed — recovering", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.recordActivity(
        "error",
        "Tick error (recovered)",
        error instanceof Error ? error.message : String(error),
        { severity: "high" }
      );
      await this.persistAndEmit();
    } finally {
      this.tickInFlight = false;
    }
  }

  private async tick(): Promise<void> {
    if (!this.deps.rateLimiter.tryAcquire("guardian:tick", 30, 60_000)) {
      this.deps.logger.warn("Tick rate limited");
      return;
    }

    this.state.tickCount += 1;
    this.state.lastTickAt = this.deps.clock.nowIso();

    // 1. Monitor ecosystem
    const projects = await this.deps.health.collectProjects();
    this.state.projects = projects;

    // 2. Collect metrics
    const metrics = await this.deps.health.collectMetrics(projects);
    this.state.metrics = [...metrics, ...this.state.metrics].slice(0, 500);

    // 3. Detect anomalies
    const anomalies = await this.deps.health.detectAnomalies(
      projects,
      this.state.metrics
    );

    const openCount = this.state.incidents.filter(
      (i) => i.status !== "resolved" && i.status !== "failed" && i.status !== "cancelled"
    ).length;

    for (const anomaly of anomalies) {
      if (openCount + this.countOpen() >= this.config.maxConcurrentIncidents) break;

      // Dedupe: skip if open incident already for same project+metric
      const existing = this.state.incidents.find(
        (i) =>
          i.projectId === anomaly.projectId &&
          i.anomaly.metric === anomaly.metric &&
          i.status !== "resolved" &&
          i.status !== "failed" &&
          i.status !== "cancelled"
      );
      if (existing) continue;

      // 4. AI analysis
      const reasoning = await this.deps.decision.analyze(anomaly, {
        projects,
        recentIncidents: openCount,
        walletBalance: this.state.walletBalance,
      });
      anomaly.reasoning = reasoning;

      if (!this.deps.decision.shouldAct(reasoning, this.config)) {
        this.recordActivity(
          "analysis_complete",
          "Anomaly noted (no action)",
          `${anomaly.projectName}: ${reasoning.whyAbnormal}`,
          { severity: reasoning.severity, projectId: anomaly.projectId }
        );
        continue;
      }

      const incident = this.createIncident(anomaly);
      this.state.incidents = [incident, ...this.state.incidents].slice(0, 100);

      this.recordActivity(
        "anomaly_detected",
        "Guardian detected anomaly",
        `${anomaly.projectName} · ${anomaly.metric} · confidence ${(reasoning.confidence * 100).toFixed(0)}%`,
        {
          severity: reasoning.severity,
          incidentId: incident.id,
          projectId: anomaly.projectId,
        }
      );

      // Full autonomous remediation pipeline
      await this.remediate(incident);
    }

    // Refresh balance periodically
    if (this.state.tickCount % 3 === 0) {
      this.state.walletBalance = await this.deps.sphere.wallet.getBalance(
        this.config.currency
      );
    }

    // Periodic health report
    if (this.state.tickCount % 15 === 0) {
      await this.generateReport("health");
    }

    this.recordActivity(
      "agent_tick",
      "Guardian tick",
      `tick=#${this.state.tickCount} projects=${projects.length} anomalies=${anomalies.length}`,
      { severity: "info" }
    );

    await this.persistAndEmit();
  }

  private async remediate(incident: Incident): Promise<void> {
    const project = this.state.projects.find((p) => p.id === incident.projectId);
    if (!project) return;

    // 5. Publish intent
    this.updateIncident(incident.id, { status: "intent_published" });
    const description = [
      `Need diagnostics for ${project.name}.`,
      `Anomaly: ${incident.anomaly.metric}=${incident.anomaly.observedValue.toFixed(2)} (threshold ${incident.anomaly.threshold}).`,
      `Severity: ${incident.severity}.`,
      `Reasoning: ${incident.anomaly.reasoning.whyAbnormal}`,
      `Maximum budget: ${this.config.maxBudgetDefault} ${this.config.currency}`,
      `Priority: ${severityToPriority(incident.severity)}`,
    ].join(" ");

    const intentLocalId = this.deps.ids.generate("intent");
    let sphereIntentId: string | undefined;
    let expiresAt: string | undefined;

    try {
      const published = await this.deps.sphere.market.publishIntent({
        incidentId: incident.id,
        description,
        intentType: "service",
        category: "diagnostics",
        maxBudget: this.config.maxBudgetDefault,
        currency: this.config.currency,
        priority: severityToPriority(incident.severity),
        metadata: {
          projectId: project.id,
          projectName: project.name,
          metric: incident.anomaly.metric,
          severity: incident.severity,
        },
      });
      sphereIntentId = published.sphereIntentId ?? published.intentId;
      expiresAt = published.expiresAt;
    } catch (error) {
      this.deps.logger.error("Intent publish failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.updateIncident(incident.id, { status: "failed" });
      this.recordActivity(
        "error",
        "Intent publish failed",
        error instanceof Error ? error.message : String(error),
        { incidentId: incident.id, severity: "high" }
      );
      return;
    }

    const intent = {
      id: intentLocalId,
      sphereIntentId,
      incidentId: incident.id,
      description,
      intentType: "service" as const,
      category: "diagnostics",
      maxBudget: this.config.maxBudgetDefault,
      currency: this.config.currency,
      priority: severityToPriority(incident.severity),
      status: "published" as const,
      publishedAt: this.deps.clock.nowIso(),
      expiresAt,
      metadata: {
        projectId: project.id,
        projectName: project.name,
      },
    };
    this.state.intents = [intent, ...this.state.intents].slice(0, 100);
    this.updateIncident(incident.id, { intentId: intent.id });

    this.recordActivity(
      "intent_published",
      "Intent published",
      `Need diagnostics for ${project.name}. Max ${intent.maxBudget} ${intent.currency}. Priority ${intent.priority}.`,
      { incidentId: incident.id, projectId: project.id }
    );

    // 6. Negotiate
    this.updateIncident(incident.id, { status: "negotiating" });
    this.recordActivity(
      "negotiation_started",
      "Negotiation started",
      `Soliciting offers for intent ${intent.id}`,
      { incidentId: incident.id }
    );

    const offers = await this.deps.negotiation.solicitOffers(
      intent,
      this.config.negotiationWindowMs
    );
    this.state.offers = [...offers, ...this.state.offers].slice(0, 200);
    for (const o of offers) {
      this.recordActivity(
        "offer_received",
        "Offer received",
        `@${o.agentNametag} bid ${o.price} ${o.currency} · ETA ${(o.estimatedCompletionMs / 1000).toFixed(0)}s · reliability ${(o.reliabilityScore * 100).toFixed(0)}%`,
        { incidentId: incident.id }
      );
    }

    const scores = this.deps.negotiation.scoreOffers(offers, intent.maxBudget);
    const best = this.deps.negotiation.selectBest(scores, offers);
    if (!best) {
      this.updateIncident(incident.id, { status: "failed" });
      this.recordActivity(
        "error",
        "No provider selected",
        "Negotiation yielded no acceptable offers",
        { incidentId: incident.id, severity: "medium" }
      );
      return;
    }

    this.updateIncident(incident.id, {
      status: "provider_selected",
      selectedOfferId: best.id,
    });
    this.recordActivity(
      "provider_selected",
      "Provider selected",
      `@${best.agentNametag} selected at ${best.price} ${best.currency}`,
      { incidentId: incident.id }
    );

    // 7. Autonomous settlement
    this.updateIncident(incident.id, { status: "payment_pending" });
    const settlement = await this.deps.settlement.settle({
      offer: best,
      incidentId: incident.id,
    });
    this.state.settlements = [settlement, ...this.state.settlements].slice(0, 100);

    if (settlement.status === "failed") {
      this.updateIncident(incident.id, { status: "failed", settlementId: settlement.id });
      this.recordActivity(
        "error",
        "Settlement failed",
        settlement.error ?? "unknown",
        { incidentId: incident.id, severity: "high" }
      );
      return;
    }

    this.state.walletBalance = round2(this.state.walletBalance - settlement.amount);
    this.updateIncident(incident.id, {
      status: "payment_settled",
      settlementId: settlement.id,
    });
    this.pushTx({
      id: this.deps.ids.generate("tx"),
      kind: "outbound_settlement",
      amount: settlement.amount,
      currency: settlement.currency,
      counterparty: settlement.recipient,
      status: settlement.status,
      transferId: settlement.transferId,
      incidentId: incident.id,
      memo: `Diagnostics settlement for ${project.name}`,
      createdAt: settlement.settledAt,
    });
    this.recordActivity(
      "payment_settled",
      "Payment settled",
      `${settlement.amount} ${settlement.currency} → ${settlement.recipient} · tx ${settlement.transferId ?? "n/a"}`,
      { incidentId: incident.id }
    );

    // 8. Receive diagnostics
    const diagnostic = await this.deps.diagnostics.requestDiagnostics({
      offer: best,
      incidentId: incident.id,
      project,
      anomaly: incident.anomaly,
    });
    this.state.diagnostics = [diagnostic, ...this.state.diagnostics].slice(0, 100);
    this.updateIncident(incident.id, {
      status: "diagnostics_received",
      diagnosticId: diagnostic.id,
    });
    this.recordActivity(
      "diagnostics_received",
      "Diagnostics received",
      diagnostic.summary,
      { incidentId: incident.id }
    );

    // 9. Resolve
    this.updateIncident(incident.id, {
      status: "resolved",
      resolvedAt: this.deps.clock.nowIso(),
    });
    if (intent.sphereIntentId) {
      try {
        await this.deps.sphere.market.closeIntent(intent.sphereIntentId);
        const idx = this.state.intents.findIndex((i) => i.id === intent.id);
        if (idx >= 0) {
          this.state.intents[idx] = { ...this.state.intents[idx], status: "filled" };
        }
      } catch {
        /* best effort */
      }
    }
    this.recordActivity(
      "issue_resolved",
      "Issue resolved",
      `${project.name} incident closed after autonomous remediation`,
      { incidentId: incident.id, projectId: project.id, severity: "info" }
    );
  }

  private async publishServiceCatalog(): Promise<void> {
    for (const service of this.config.serviceCatalog.filter((s) => s.available)) {
      try {
        await this.deps.sphere.market.publishIntent({
          incidentId: "catalog",
          description: `[Guardian Service] ${service.name}: ${service.description} Price: ${service.price} ${service.currency}`,
          intentType: "service",
          category: service.kind,
          maxBudget: service.price,
          currency: service.currency,
          priority: "medium",
          metadata: { serviceKind: service.kind, seller: true },
        });
      } catch (error) {
        this.deps.logger.warn("Service catalog publish failed", {
          kind: service.kind,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    this.recordActivity(
      "system",
      "Service catalog published",
      `${this.config.serviceCatalog.length} paid diagnostic services available on Sphere market`
    );
  }

  private createIncident(
    anomaly: import("@/domain/types").Anomaly
  ): Incident {
    const id = this.deps.ids.generate("inc");
    const now = this.deps.clock.nowIso();
    return {
      id,
      projectId: anomaly.projectId,
      projectName: anomaly.projectName,
      title: `${anomaly.projectName}: ${anomaly.metric} anomaly`,
      status: "detected",
      severity: anomaly.reasoning.severity,
      anomaly,
      createdAt: now,
      updatedAt: now,
      timeline: [],
    };
  }

  private updateIncident(id: string, patch: Partial<Incident>): void {
    const idx = this.state.incidents.findIndex((i) => i.id === id);
    if (idx < 0) return;
    this.state.incidents[idx] = {
      ...this.state.incidents[idx],
      ...patch,
      updatedAt: this.deps.clock.nowIso(),
    };
  }

  private countOpen(): number {
    return this.state.incidents.filter(
      (i) => !["resolved", "failed", "cancelled"].includes(i.status)
    ).length;
  }

  private recordActivity(
    kind: ActivityKind,
    title: string,
    detail: string,
    extra?: {
      severity?: Severity;
      incidentId?: string;
      projectId?: string;
      metadata?: Record<string, unknown>;
    }
  ): void {
    const event: ActivityEvent = {
      id: this.deps.ids.generate("act"),
      kind,
      title,
      detail,
      severity: extra?.severity,
      incidentId: extra?.incidentId,
      projectId: extra?.projectId,
      metadata: extra?.metadata,
      timestamp: this.deps.clock.nowIso(),
    };
    this.state.activity = [event, ...this.state.activity].slice(0, 500);
    if (extra?.incidentId) {
      const idx = this.state.incidents.findIndex((i) => i.id === extra.incidentId);
      if (idx >= 0) {
        this.state.incidents[idx].timeline = [
          event.id,
          ...this.state.incidents[idx].timeline,
        ].slice(0, 50);
      }
    }
    this.deps.events.publish(event);
  }

  private pushTx(tx: TransactionRecord): void {
    this.state.transactions = [tx, ...this.state.transactions].slice(0, 200);
  }

  private async persistAndEmit(): Promise<void> {
    this.emit();
    try {
      await this.deps.store.save(this.state);
    } catch (error) {
      this.deps.logger.error("Persist failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private emit(): void {
    this.deps.events.emitState(this.getSnapshot());
  }

  private emptyState(): GuardianStateSnapshot {
    return {
      identity: {
        nametag: this.config.nametag,
        mode: this.deps.sphere.mode,
        network: this.config.network,
        connected: false,
      },
      config: this.config,
      running: false,
      tickCount: 0,
      projects: [],
      incidents: [],
      intents: [],
      offers: [],
      settlements: [],
      messages: [],
      diagnostics: [],
      activity: [],
      transactions: [],
      serviceRequests: [],
      metrics: [],
      reports: [],
      walletBalance: 0,
      walletCurrency: this.config.currency,
    };
  }
}

function severityToPriority(
  s: Severity
): import("@/domain/types").Priority {
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  return "low";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
