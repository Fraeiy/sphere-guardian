# Sphere Guardian AI

**The Autonomous Network Operations Agent for Unicity Sphere**

Production-quality application for the Unicity Sphere Builder Campaign. Demonstrates deep integration with the Sphere SDK and a complete machine-to-machine economic loop:

**Monitor → Analyze → Decide → Publish Intent → Negotiate → Select Provider → Settle Payment → Receive Diagnostics → Update Knowledge → Expose Paid Services**

No manual approval after startup.

![Stack](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Sphere](https://img.shields.io/badge/Sphere_SDK-testnet2-cyan) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Why this wins Gold + Agentic bonus

| Capability | Implementation |
| --- | --- |
| Sphere Identity | Live SDK nametag + `DIRECT://` address; mock identity offline |
| Sphere Wallet | Balance, mint top-up, autonomous `send` settlement |
| Messaging | Agent-to-agent DMs for negotiation & status |
| Payment Requests | Wallet port for PR send/handle (live path) |
| Intent Market | `postIntent` / search / close for diagnostics & services |
| Autonomous Decision Making | AI Decision Engine with structured reasoning on every alert |
| Autonomous Settlement | No human gate after `start()` |
| Service Discovery | Catalog published to market; search adapters |
| Agent-to-Agent Interaction | Negotiation scoring (price · ETA · reliability) |

---

## Quick start (live Testnet v2 — default)

```bash
git clone <this-repo> sphere-guardian-ai
cd sphere-guardian-ai
npm install
cp .env.example .env.local
# Edit GUARDIAN_NAMETAG / GUARDIAN_PEER_NAMETAG to unique values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Default mode is live.** The Guardian:

1. Connects a real Sphere wallet on **testnet2**
2. Registers identity nametags
3. Probes live Unicity endpoints (gateway, wallet-api, market-api, …)
4. Publishes real intents to the Sphere Intent Market
5. Negotiates with a second live peer wallet (`GUARDIAN_PEER_NAMETAG`)
6. Settles **UCT** payments on-chain via Sphere Wallet
7. Streams activity over SSE to the dashboard

```bash
npm test          # unit + integration (mock peers in tests)
npm run build     # production build
```

### Offline / CI only

```bash
SPHERE_MODE=mock npm run dev
```

Adapters:

- `SPHERE_MODE=live` (default) → `LiveSphereFacade` + live health probes + peer agent
- `SPHERE_MODE=mock` → offline facades for CI

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Product modules

1. **Autonomous Guardian Agent** — continuous tick loop, zero human approval  
2. **Ecosystem Health Engine** — latency, uptime, storage, failures, agents, users  
3. **AI Decision Engine** — why / confidence / action / severity / impact on every alert  
4. **Intent Publisher** — Sphere Intent Market diagnostics intents with budget + priority  
5. **Negotiation Engine** — price · ETA · reliability scoring  
6. **Autonomous Settlement** — pay → confirm → ledger  
7. **Messaging System** — negotiation, status, completion, errors  
8. **Paid Diagnostic Service** — health, security, optimization, performance, analytics  
9. **Dashboard** — Overview, Projects, Incidents, Marketplace, Activity, Transactions, Services, Analytics, Settings  
10. **AI Reports** — daily / weekly / incident / health / recommendations (Markdown export)  
11. **Activity Timeline** — every autonomous decision  
12. **Analytics** — Recharts multi-series  

---

## Architecture

Clean architecture with SOLID ports & adapters:

```
src/
  domain/           # types, config, ports (no infra imports)
  application/      # guardian agent + engines (use-cases)
  infrastructure/   # Sphere (mock/live), AI, persistence, logging, retry
  server/           # process-local runtime singleton
  app/              # Next.js App Router UI + API
  components/       # reusable dashboard UI
  hooks/            # realtime client hooks (SSE + poll)
```

```
┌────────────┐   SSE/HTTP    ┌──────────────┐
│  Dashboard │◄─────────────►│  API routes  │
└────────────┘               └──────┬───────┘
                                    │
                             ┌──────▼───────┐
                             │ GuardianAgent│
                             │  (tick loop) │
                             └──────┬───────┘
                ┌─────────┬─────────┼─────────┬──────────┐
                ▼         ▼         ▼         ▼          ▼
             Health    Decision  Negotiate  Settlement  Sphere
             Engine    Engine    Engine     Engine      Facade
                                                         │
                                              ┌──────────┴──────────┐
                                              ▼                     ▼
                                           MockSphere           LiveSphere
                                           (offline)         (testnet2 SDK)
```

Full write-up: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)  
HTTP API: [docs/API.md](docs/API.md)

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16, TypeScript, Tailwind CSS 4, shadcn-style Radix UI |
| Backend | Node.js route handlers + in-process agent runtime |
| Realtime | Server-Sent Events (`/api/guardian/events`) + polling fallback |
| Charts | Recharts |
| Persistence | File JSON (default) or PostgreSQL via `DATABASE_URL` |
| Auth / payments / messaging / market | Sphere Identity · Wallet · Messaging · Intent Market |
| AI | Abstract `AiProviderPort` (OpenAI-compatible; optional) |

---

## Environment

See [`.env.example`](.env.example). **Never hardcode secrets.**

| Variable | Purpose |
| --- | --- |
| `SPHERE_MODE` | `mock` \| `live` |
| `SPHERE_ORACLE_API_KEY` | Testnet2 gateway key (live) |
| `GUARDIAN_NAMETAG` | Agent nametag |
| `DATABASE_URL` | Optional Postgres |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | Optional LLM enhancement |

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Vitest unit + integration suite |
| `npm run lint` | ESLint |

---

## Security & quality

- Strong TypeScript typing end-to-end  
- Zod validation on control API  
- Structured JSON logging  
- Exponential backoff retry (skips non-retryable Sphere codes)  
- In-process rate limiting (swap for Redis multi-instance)  
- Graceful tick recovery — errors never kill the agent  
- Secrets only via environment  
- Comprehensive unit + integration tests  

---

## Campaign mapping

Demonstrates the **future of autonomous machine-to-machine economies** on Unicity Sphere: agents discover issues, buy diagnostics, settle peer-to-peer, and sell their own services — without humans in the loop.

---

## License

MIT
