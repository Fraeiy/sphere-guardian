/**
 * Public testnet2 configuration.
 * The oracle API key below is the published testnet2 gateway key from the
 * Sphere SDK docs — it is NOT a secret (mainnet keys are secrets).
 */
import path from "path";
import { tmpdir } from "os";

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

/**
 * Vercel / serverless only allow writes under /tmp.
 * Locally we keep data under the project `.data` directory.
 */
export function isServerlessRuntime(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.AWS_LAMBDA_FUNCTION_NAME != null ||
    process.env.FUNCTION_NAME != null
  );
}

export function resolveDataRoot(): string {
  if (process.env.GUARDIAN_DATA_DIR) return process.env.GUARDIAN_DATA_DIR;
  if (isServerlessRuntime()) {
    return path.join(tmpdir(), "sphere-guardian");
  }
  return path.join(process.cwd(), ".data");
}

export function resolveWalletDataDir(): string {
  if (process.env.SPHERE_DATA_DIR) return process.env.SPHERE_DATA_DIR;
  return path.join(resolveDataRoot(), "sphere-wallet");
}

export function resolveTokensDir(): string {
  if (process.env.SPHERE_TOKENS_DIR) return process.env.SPHERE_TOKENS_DIR;
  return path.join(resolveDataRoot(), "sphere-tokens");
}

export function resolvePeerWalletDataDir(): string {
  if (process.env.SPHERE_PEER_DATA_DIR) return process.env.SPHERE_PEER_DATA_DIR;
  return path.join(resolveDataRoot(), "sphere-peer-wallet");
}

export function resolvePeerTokensDir(): string {
  if (process.env.SPHERE_PEER_TOKENS_DIR)
    return process.env.SPHERE_PEER_TOKENS_DIR;
  return path.join(resolveDataRoot(), "sphere-peer-tokens");
}
