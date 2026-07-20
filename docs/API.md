# API Documentation — Sphere Guardian AI

Base URL: `http://localhost:3000` (development)

All guardian routes use the Node.js runtime and share a process-local agent singleton.

## Authentication

Dashboard is open for campaign demos. Production deployments should put the app behind:

- Vercel deployment protection / SSO, or
- Sphere Connect identity gate (extension wallet)

Agent economic identity is **Sphere Identity** (nametag + chain pubkey), not cookie sessions.

---

## `GET /api/guardian/state`

Returns full `GuardianStateSnapshot` JSON.

**Response 200**

```json
{
  "identity": {
    "nametag": "sphere-guardian",
    "directAddress": "DIRECT://…",
    "mode": "mock",
    "network": "testnet2",
    "connected": true
  },
  "running": true,
  "tickCount": 12,
  "walletBalance": 92.5,
  "walletCurrency": "TEST",
  "projects": [],
  "incidents": [],
  "intents": [],
  "offers": [],
  "settlements": [],
  "messages": [],
  "diagnostics": [],
  "activity": [],
  "transactions": [],
  "serviceRequests": [],
  "metrics": [],
  "reports": [],
  "config": {}
}
```

Auto-starts the agent on first request if not running.

---

## `GET /api/guardian/events`

Server-Sent Events stream of `GuardianStateSnapshot`.

```
Content-Type: text/event-stream

data: { …snapshot… }

: ping
```

Client example:

```ts
const es = new EventSource("/api/guardian/events");
es.onmessage = (ev) => {
  const snapshot = JSON.parse(ev.data);
};
```

---

## `POST /api/guardian/control`

Validated with Zod. Rate limited (60 req/min/process).

### Body

```ts
{
  action: "start" | "stop" | "tick" | "report" | "purchase";
  reportType?: "daily" | "weekly" | "incident" | "health" | "recommendations";
  incidentId?: string;
  serviceKind?: "health_report" | "security_scan" | "optimization_report"
             | "performance_audit" | "ecosystem_analytics";
  requester?: string;
}
```

### Actions

| Action | Effect |
| --- | --- |
| `start` | Ensure autonomous loop running |
| `stop` | Halt loop; disconnect Sphere |
| `tick` | Force one monitor/remediate cycle |
| `report` | Generate Markdown AI report |
| `purchase` | Simulate inbound paid service purchase |

**Example — generate daily report**

```bash
curl -X POST http://localhost:3000/api/guardian/control \
  -H 'Content-Type: application/json' \
  -d '{"action":"report","reportType":"daily"}'
```

**Example — purchase health report**

```bash
curl -X POST http://localhost:3000/api/guardian/control \
  -H 'Content-Type: application/json' \
  -d '{"action":"purchase","serviceKind":"health_report","requester":"@peer-agent"}'
```

**Errors**

| Status | Meaning |
| --- | --- |
| 400 | Validation failure |
| 429 | Rate limit |
| 500 | Agent/runtime error |

---

## `GET /api/reports/:id`

Download a generated report as Markdown.

```bash
curl -OJ http://localhost:3000/api/reports/report_abc123
```

Headers:

- `Content-Type: text/markdown; charset=utf-8`
- `Content-Disposition: attachment; filename="…"`

---

## Domain event kinds (activity timeline)

| Kind | Meaning |
| --- | --- |
| `anomaly_detected` | Health breach + reasoning |
| `intent_published` | Market intent live |
| `negotiation_started` | Offers solicited |
| `offer_received` | Peer bid |
| `provider_selected` | Best score wins |
| `payment_settled` | Autonomous transfer |
| `diagnostics_received` | Job complete |
| `issue_resolved` | Incident closed |
| `service_fulfilled` | Inbound paid service done |

---

## Incident reasoning shape

Every incident embeds:

```ts
{
  whyAbnormal: string;
  confidence: number;      // 0–1
  suggestedAction: string;
  severity: "info"|"low"|"medium"|"high"|"critical";
  expectedImpact: string;
  evidence: string[];
  model?: string;
}
```
