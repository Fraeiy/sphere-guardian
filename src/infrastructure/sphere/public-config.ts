/**
 * Public testnet2 configuration.
 * The oracle API key below is the published testnet2 gateway key from the
 * Sphere SDK docs — it is NOT a secret (mainnet keys are secrets).
 */

export const TESTNET2_PUBLIC_ORACLE_API_KEY =
  "sk_ddc3cfcc001e4a28ac3fad7407f99590";

export const TESTNET2_ENDPOINTS = {
  network: "testnet2" as const,
  gateway: "https://gateway.testnet2.unicity.network",
  walletApi: "https://wallet-api.unicity.network",
  marketApi: "https://market-api.unicity.network",
  nostrRelay: "wss://nostr-relay.testnet.unicity.network",
  sphereRelay: "wss://sphere-relay.unicity.network",
  tokenRegistry:
    "https://raw.githubusercontent.com/unicitynetwork/unicity-ids/refs/heads/main/unicity-ids.testnet2.json",
  sphereDashboard: "https://sphere.unicity.network",
};

export function resolveOracleApiKey(): string {
  return (
    process.env.SPHERE_ORACLE_API_KEY ??
    process.env.UNICITY_ORACLE_API_KEY ??
    TESTNET2_PUBLIC_ORACLE_API_KEY
  );
}

export function resolveSphereMode(): "mock" | "live" {
  const raw = (process.env.SPHERE_MODE ?? "live").toLowerCase();
  return raw === "mock" ? "mock" : "live";
}
