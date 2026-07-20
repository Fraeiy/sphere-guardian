/**
 * Live testnet2 smoke: identity + mint + market intent.
 * Run: npx tsx scripts/smoke-live.ts
 */
import { createLiveSphereFacade } from "../src/infrastructure/sphere/live-sphere";
import { resolveOracleApiKey } from "../src/infrastructure/sphere/public-config";

async function main() {
  console.log("oracle key present", Boolean(resolveOracleApiKey()));
  const tag = `sg-smoke-${Date.now().toString(36).slice(-6)}`;
  const facade = createLiveSphereFacade(tag, {
    dataDir: ".data/smoke-wallet",
    tokensDir: ".data/smoke-tokens",
    deviceId: "smoke-device",
  });

  const id = await facade.identity.connect();
  console.log(
    JSON.stringify(
      {
        mode: id.mode,
        network: id.network,
        nametag: id.nametag,
        address: id.directAddress?.slice(0, 48),
        connected: id.connected,
      },
      null,
      2
    )
  );

  const bal = await facade.wallet.getBalance("UCT");
  console.log("balance before mint", bal);
  if (facade.wallet.mintTestTokens) {
    const mint = await facade.wallet.mintTestTokens(5, "UCT");
    console.log("mint", mint);
  }
  console.log("balance after mint", await facade.wallet.getBalance("UCT"));

  try {
    const pub = await facade.market.publishIntent({
      incidentId: "smoke",
      description: "Sphere Guardian smoke test intent — live testnet2",
      intentType: "service",
      category: "diagnostics",
      maxBudget: 1,
      currency: "UCT",
      priority: "low",
      metadata: { smoke: true },
    });
    console.log("intent published", pub);
  } catch (e) {
    console.error("intent publish error", e instanceof Error ? e.message : e);
  }

  await facade.identity.disconnect();
  console.log("SMOKE_OK");
}

main().catch((e) => {
  console.error("SMOKE_FAIL", e);
  process.exit(1);
});
