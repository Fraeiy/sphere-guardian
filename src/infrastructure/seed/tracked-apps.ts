/**
 * Live application URLs monitored by Sphere Guardian.
 *
 * Override / extend via env:
 *   GUARDIAN_TRACKED_APPS=https://sphere-2048.vercel.app,https://my-app.vercel.app
 *   GUARDIAN_TRACKED_APPS_JSON=[{"name":"My App","url":"https://...","tags":["game"]}]
 *   GUARDIAN_INCLUDE_INFRA=true|false  (default true — also probe Unicity core APIs)
 */

export interface TrackedApp {
  id: string;
  name: string;
  slug: string;
  url: string;
  tags: string[];
  /** app = product surface; infra = protocol dependency */
  kind: "app" | "infra";
}

/** Your live Sphere product deployments (verified public URLs). */
export const DEFAULT_TRACKED_APPS: TrackedApp[] = [
  {
    id: "app_sphere_2048",
    name: "Sphere 2048",
    slug: "sphere-2048",
    url: "https://sphere-2048.vercel.app",
    tags: ["game", "sphere", "app", "live"],
    kind: "app",
  },
  {
    id: "app_sphereflow",
    name: "SphereFlow",
    slug: "sphereflow",
    url: "https://sphereflow-psi.vercel.app",
    tags: ["treasury", "agent", "sphere", "app", "live"],
    kind: "app",
  },
  {
    id: "app_sphere_serve",
    name: "SphereServe",
    slug: "sphere-serve",
    url: "https://sphere-serve.vercel.app",
    tags: ["marketplace", "agents", "sphere", "app", "live"],
    kind: "app",
  },
  {
    id: "app_sverdict",
    name: "Sverdict",
    slug: "sverdict",
    url: "https://sverdict.vercel.app",
    tags: ["prediction", "markets", "sphere", "app", "live"],
    kind: "app",
  },
  {
    id: "app_sphere_perps",
    name: "Sphere Perps",
    slug: "sphere-perps",
    url: "https://sphere-perps.vercel.app",
    tags: ["perps", "trading", "sphere", "app", "live"],
    kind: "app",
  },
  {
    id: "app_sphere_swarm",
    name: "Sphere Swarm",
    slug: "sphere-swarm",
    url: "https://sphere-swarm.vercel.app",
    tags: ["swarm", "agents", "sphere", "app", "live"],
    kind: "app",
  },
  {
    id: "app_sphere_guardian",
    name: "Sphere Guardian",
    slug: "sphere-guardian",
    url: "https://sphere-guardian.vercel.app",
    tags: ["noc", "ops", "sphere", "app", "live"],
    kind: "app",
  },
];

function slugFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/\.vercel\.app$/i, "");
    return host || "app";
  } catch {
    return "app";
  }
}

function nameFromUrl(url: string): string {
  const slug = slugFromUrl(url);
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function parseEnvApps(): TrackedApp[] {
  const json = process.env.GUARDIAN_TRACKED_APPS_JSON?.trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as Array<{
        name?: string;
        url: string;
        tags?: string[];
        id?: string;
        slug?: string;
      }>;
      return parsed
        .filter((a) => a?.url)
        .map((a, i) => {
          const url = a.url.startsWith("http") ? a.url : `https://${a.url}`;
          const slug = a.slug ?? slugFromUrl(url);
          return {
            id: a.id ?? `app_env_${slug.replace(/[^a-z0-9]+/gi, "_")}_${i}`,
            name: a.name ?? nameFromUrl(url),
            slug,
            url,
            tags: a.tags ?? ["app", "live", "custom"],
            kind: "app" as const,
          };
        });
    } catch {
      /* fall through to CSV */
    }
  }

  const csv = process.env.GUARDIAN_TRACKED_APPS?.trim();
  if (!csv) return [];

  return csv
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw, i) => {
      const url = raw.startsWith("http") ? raw : `https://${raw}`;
      const slug = slugFromUrl(url);
      return {
        id: `app_env_${slug.replace(/[^a-z0-9]+/gi, "_")}_${i}`,
        name: nameFromUrl(url),
        slug,
        url,
        tags: ["app", "live", "custom"],
        kind: "app" as const,
      };
    });
}

/**
 * Merge defaults + env overrides.
 * If GUARDIAN_TRACKED_APPS / _JSON is set, those URLs are added (deduped by hostname).
 * Set GUARDIAN_TRACKED_APPS_ONLY=true to skip built-in defaults and use only env list.
 */
export function resolveTrackedApps(): TrackedApp[] {
  const onlyEnv = process.env.GUARDIAN_TRACKED_APPS_ONLY === "true";
  const fromEnv = parseEnvApps();
  const base = onlyEnv ? [] : [...DEFAULT_TRACKED_APPS];

  const byHost = new Map<string, TrackedApp>();
  for (const app of [...base, ...fromEnv]) {
    try {
      const host = new URL(app.url).hostname.toLowerCase();
      byHost.set(host, app);
    } catch {
      /* skip bad url */
    }
  }
  return [...byHost.values()];
}
