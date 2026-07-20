# Deployment Guide — Sphere Guardian AI

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Default **mock** mode needs no keys.

## Production build

```bash
npm run build
npm start
```

Listen port: `PORT` (default 3000).

## Environment checklist

| Variable | Required | Notes |
| --- | --- | --- |
| `SPHERE_MODE` | no | `mock` (default) or `live` |
| `SPHERE_ORACLE_API_KEY` | live only | Public testnet2 key OK in env |
| `GUARDIAN_NAMETAG` | recommended | Unique on network |
| `DATABASE_URL` | optional | Enables Postgres store (`pg` package) |
| `AI_API_KEY` | optional | Enhances decision/report narrative |
| `LOG_LEVEL` | optional | `info` default |

Install Postgres driver only if needed:

```bash
npm install pg
npm install -D @types/pg
```

## Deploy to a Node host (recommended for the agent)

The autonomous agent is an **in-process long-lived loop**. Prefer platforms that keep a Node server warm:

- Fly.io / Railway / Render / VPS / Docker
- Vercel **only** if you accept cold starts (agent restarts on new isolate)

### Docker (example)

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
```

Mount a volume for `.data` so wallet + state survive restarts:

```bash
docker run -p 3000:3000 \
  -e SPHERE_MODE=live \
  -e SPHERE_ORACLE_API_KEY=… \
  -e GUARDIAN_NAMETAG=my-guardian \
  -v guardian-data:/app/.data \
  sphere-guardian-ai
```

## Live Testnet v2 cutover

1. Set `SPHERE_MODE=live`
2. Provide `SPHERE_ORACLE_API_KEY` (testnet2 public key from Sphere SDK docs)
3. Set unique `GUARDIAN_NAMETAG`
4. Persist `SPHERE_DATA_DIR` / `SPHERE_TOKENS_DIR`
5. Restart process
6. Confirm identity in **Overview** / **Settings**
7. Optional: set `AI_*` for LLM reasoning

Mock → live is a **config change only**; application engines stay identical.

## Vercel notes

- Works for **UI + mock demos**
- Long-running tick intervals may reset on cold start
- For Gold-tier live autonomy demos, use a always-on Node host

## Health checks

- `GET /api/guardian/state` → `running: true`
- Dashboard Overview shows green autonomy indicator
- Activity timeline advances each tick

## Security

- Never commit `.env.local` or wallet mnemonics
- Rotate any mainnet keys (not used by default)
- Put reverse-proxy auth in front of public deployments
- Rate limits are process-local; use edge WAF for public internet

## Observability

- Structured JSON logs on stdout
- Activity timeline in UI
- Metrics series in Analytics
- Markdown reports via Analytics → Export
