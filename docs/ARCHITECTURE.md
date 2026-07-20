# Architecture — Sphere Guardian AI

## Goals

- Production-grade autonomous NOC agent for Unicity Sphere
- Clean architecture + SOLID for long-term extensibility
- Easy swap between **mock** and **live testnet2** Sphere backends
- Observable, testable, deployable

## Layers

### Domain (`src/domain`)

Pure types and ports. No framework, no SDK, no I/O.

- `types.ts` — entities & value objects (Incident, Intent, Offer, Settlement, …)
- `ports.ts` — interfaces (Dependency Inversion)
- `config.ts` — default thresholds, service catalog

### Application (`src/application`)

Use-cases and orchestration.

| Component | Responsibility |
| --- | --- |
| `GuardianAgent` | Autonomous tick loop & remediation pipeline |
| `EcosystemHealthEngine` | Telemetry collection + anomaly detection |
| `AiDecisionEngine` | Structured reasoning; optional LLM |
| `NegotiationEngine` | Offer solicitation & multi-criteria scoring |
| `AutonomousSettlementEngine` | Payment execution with retry |
| `DiagnosticServiceEngine` | Consume peer diagnostics; fulfill paid catalog |

### Infrastructure (`src/infrastructure`)

Adapters implementing ports.

| Adapter | Notes |
| --- | --- |
| `MockSphereFacade` | Full offline identity/wallet/messaging/market |
| `LiveSphereFacade` | `@unicitylabs/sphere-sdk` + wallet-api rails |
| `FileStateStore` / `PostgresStateStore` | Durable snapshots |
| `OpenAiCompatibleProvider` / `NoopAiProvider` | AI abstraction |
| `StructuredLogger` | JSON logs |
| `withRetry` / `InMemoryRateLimiter` | Resilience |

### Presentation

- Next.js App Router dashboard (dark, Linear/Datadog-inspired)
- REST + SSE APIs under `src/app/api`

### Runtime

`src/server/runtime.ts` holds a process-singleton `GuardianAgent` so all API routes share one autonomous loop.

## Autonomous remediation pipeline

```
tick()
  collectProjects()
  collectMetrics()
  detectAnomalies()
  for each actionable anomaly:
    decision.analyze() → DecisionReasoning
    if shouldAct:
      market.publishIntent(budget, priority)
      negotiation.solicitOffers()
      negotiation.scoreOffers(price, time, reliability)
      selectBest()
      settlement.settle()  // no human approval
      diagnostics.requestDiagnostics()
      closeIntent()
      mark resolved
```

## Sphere integration map

| PRD requirement | Code path |
| --- | --- |
| Identity | `SphereIdentityPort` → live `Sphere.init` + nametag |
| Wallet | `SphereWalletPort.sendPayment` / `getBalance` / mint |
| Messaging | `SphereMessagingPort` → NIP-17 DMs |
| Payment Requests | live `payments.sendPaymentRequest` / handlers |
| Intent Market | `SphereMarketPort` → `market.postIntent` / search / close |
| Service discovery | Catalog intents + search |
| Settlement | Wallet send with CERTIFICATION_UNCONFIRMED safety (no blind re-send) |

## Data flow (realtime)

```
GuardianAgent ──emitState──► EventBus ──SSE──► Dashboard (EventSource)
                     │
                     └── File/Postgres store (durability)
```

## Extensibility

1. **New AI models** — implement `AiProviderPort`
2. **New monitors** — implement `HealthMonitorPort` (wire real APM)
3. **Multi-instance** — replace rate limiter + event bus with Redis/NATS
4. **Custody** — live adapter can switch to own-storage wallet-api preset

## Threat model notes

- Control API rate-limited
- No secrets in source
- Mock mode for untrusted CI
- Live mnemonic never logged (only word count on create)
- Tick failures isolated; loop continues

## Quality attributes

| Attribute | Approach |
| --- | --- |
| Reliability | Retry + graceful tick recovery + resumeOpenIntents (live) |
| Observability | Structured logs + activity timeline + metrics series |
| Testability | Ports allow pure unit tests; integration uses MockSphere |
| Deployability | Standard Next.js node runtime; optional Postgres |
