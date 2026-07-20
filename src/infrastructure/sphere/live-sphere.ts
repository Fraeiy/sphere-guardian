import type {
  SphereFacadePort,
  SphereIdentityPort,
  SphereMarketPort,
  SphereMessagingPort,
  SphereWalletPort,
} from "@/domain/ports";
import type { AgentMessage, GuardianIdentity } from "@/domain/types";
import { logger } from "@/infrastructure/logging/logger";
import { withRetry } from "@/infrastructure/utils/retry";
import { clock } from "@/infrastructure/utils/clock";
import { ids } from "@/infrastructure/utils/id";
import {
  resolveOracleApiKey,
  resolveTokensDir,
  resolveWalletDataDir,
  TESTNET2_ENDPOINTS,
} from "@/infrastructure/sphere/public-config";

/**
 * Live Sphere SDK adapter for Unicity Testnet v2.
 * Default mode for production campaign demos.
 * Oracle key resolves from env, falling back to the public testnet2 key.
 */
export class LiveSphereFacade implements SphereFacadePort {
  readonly mode = "live" as const;
  readonly identity: SphereIdentityPort;
  readonly wallet: SphereWalletPort;
  readonly messaging: SphereMessagingPort;
  readonly market: SphereMarketPort;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sphere: any = null;
  private identityState: GuardianIdentity;
  private readonly messageHandlers = new Set<(msg: AgentMessage) => void>();
  private unsubDm: (() => void) | null = null;

  constructor(
    private readonly options: {
      nametag: string;
      network: string;
      dataDir: string;
      tokensDir: string;
      deviceId: string;
      walletApiUrl: string;
      oracleApiKey: string;
    }
  ) {
    this.identityState = {
      nametag: options.nametag,
      mode: "live",
      network: options.network,
      connected: false,
    };

    this.identity = {
      connect: async () => {
        await this.ensureSphere();
        this.identityState = {
          nametag: this.sphere.identity?.nametag ?? this.options.nametag,
          directAddress: this.sphere.identity?.directAddress,
          chainPubkey: this.sphere.identity?.chainPubkey,
          mode: "live",
          network: this.options.network,
          connected: true,
        };
        return { ...this.identityState };
      },
      getIdentity: () => ({ ...this.identityState }),
      disconnect: async () => {
        if (this.unsubDm) this.unsubDm();
        if (this.sphere?.destroy) await this.sphere.destroy();
        this.sphere = null;
        this.identityState = { ...this.identityState, connected: false };
      },
    };

    this.wallet = {
      getBalance: async () => {
        await this.ensureSphere();
        try {
          const assets = await this.sphere.payments.getAssets();
          const uct =
            assets?.find(
              (a: { symbol?: string }) => a.symbol?.toUpperCase() === "UCT"
            ) ?? assets?.[0];
          if (!uct) return 0;
          const decimals = Number(uct.decimals ?? 8);
          const raw = BigInt(uct.confirmedAmount || uct.totalAmount || "0");
          return Number(raw) / 10 ** decimals;
        } catch (error) {
          logger.warn("Live balance fetch failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          return 0;
        }
      },
      sendPayment: async ({ recipient, amount, currency, memo }) => {
        await this.ensureSphere();
        const symbol = normalizeCoinSymbol(currency);
        return withRetry(
          async () => {
            const assets = await this.sphere.payments.getAssets();
            const asset =
              assets?.find(
                (a: { symbol?: string }) =>
                  a.symbol?.toUpperCase() === symbol
              ) ??
              assets?.find(
                (a: { symbol?: string }) => a.symbol?.toUpperCase() === "UCT"
              ) ??
              assets?.[0];
            const decimals = Number(asset?.decimals ?? 8);
            const base = BigInt(Math.round(amount * 10 ** decimals)).toString();
            const result = await this.sphere.payments.send({
              recipient: recipient.startsWith("@")
                ? recipient
                : recipient.startsWith("DIRECT://")
                  ? recipient
                  : `@${recipient}`,
              amount: base,
              coinId: asset?.coinId ?? asset?.symbol ?? "UCT",
              memo,
            });
            return {
              transferId: result.id,
              status: result.status,
              deliveryPending: result.deliveryPending,
            };
          },
          { attempts: 3, label: "sphere.payments.send", logger }
        );
      },
      mintTestTokens: async (amount, currency) => {
        await this.ensureSphere();
        try {
          const { TokenRegistry } = await import("@unicitylabs/sphere-sdk");
          const registry = TokenRegistry.getInstance();
          const symbol = normalizeCoinSymbol(currency);
          const coinId =
            registry.getCoinIdBySymbol(symbol) ??
            registry.getCoinIdBySymbol("UCT");
          if (!coinId) return { success: false, error: "Unknown coin" };
          const decimals =
            registry.getDefinitionBySymbol(symbol)?.decimals ??
            registry.getDefinitionBySymbol("UCT")?.decimals ??
            8;
          const base = BigInt(Math.round(amount * 10 ** decimals));
          const res = await this.sphere.payments.mintFungibleToken(coinId, base);
          return res.success
            ? { success: true }
            : { success: false, error: res.error };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
      sendPaymentRequest: async (recipient, request) => {
        await this.ensureSphere();
        return this.sphere.payments.sendPaymentRequest(recipient, request);
      },
      onPaymentRequest: (handler) => {
        if (!this.sphere) return () => undefined;
        return this.sphere.payments.onPaymentRequest(handler);
      },
    };

    this.messaging = {
      send: async (peer, content, payload) => {
        await this.ensureSphere();
        const body = payload
          ? JSON.stringify({ text: content, payload })
          : content;
        await withRetry(
          () => this.sphere.communications.sendDM(normalizePeer(peer), body),
          { attempts: 2, label: "sphere.communications.sendDM", logger }
        );
        return {
          id: ids.generate("msg"),
          direction: "outbound",
          peer,
          kind: (payload?.kind as AgentMessage["kind"]) ?? "status",
          content,
          payload,
          timestamp: clock.nowIso(),
          read: true,
        };
      },
      onMessage: (handler) => {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
      },
    };

    this.market = {
      publishIntent: async (intent) => {
        await this.ensureSphere();
        if (!this.sphere.market) {
          throw new Error("Market module not enabled on Sphere instance");
        }
        const result = await withRetry(
          () =>
            this.sphere.market.postIntent({
              description: intent.description,
              intentType: intent.intentType,
              category: intent.category,
              price: intent.maxBudget,
              currency: intent.currency,
              contactHandle: this.identityState.nametag
                ? `@${this.identityState.nametag}`
                : undefined,
              expiresInDays: 1,
            }) as Promise<{ intentId: string; expiresAt?: string }>,
          { attempts: 3, label: "sphere.market.postIntent", logger }
        );
        return {
          intentId: result.intentId,
          sphereIntentId: result.intentId,
          expiresAt: result.expiresAt,
        };
      },
      searchServices: async (query) => {
        await this.ensureSphere();
        if (!this.sphere.market) return [];
        const res = await this.sphere.market.search(query, {
          filters: { intentType: "service" },
          limit: 10,
        });
        return (res.intents ?? []).map(
          (i: {
            id: string;
            description: string;
            agentNametag?: string;
            agentPublicKey: string;
            price?: number;
            currency: string;
          }) => ({
            id: i.id,
            description: i.description,
            agentNametag: i.agentNametag,
            agentPublicKey: i.agentPublicKey,
            price: i.price,
            currency: i.currency,
          })
        );
      },
      closeIntent: async (intentId) => {
        await this.ensureSphere();
        if (this.sphere.market) await this.sphere.market.closeIntent(intentId);
      },
      getMyIntents: async () => {
        await this.ensureSphere();
        if (!this.sphere.market) return [];
        const list = await this.sphere.market.getMyIntents();
        return list.map((i: { id: string; status: string }) => ({
          id: i.id,
          status: i.status,
        }));
      },
    };
  }

  private async ensureSphere(): Promise<void> {
    if (this.sphere) return;

    const { Sphere } = await import("@unicitylabs/sphere-sdk");
    const { createNodeProviders } = await import(
      "@unicitylabs/sphere-sdk/impl/nodejs"
    );
    const { createWalletApiProviders } = await import(
      "@unicitylabs/sphere-sdk/impl/shared/wallet-api"
    );

    const network = this.options.network === "testnet" ? "testnet" : "testnet2";

    const base = createNodeProviders({
      network,
      dataDir: this.options.dataDir,
      tokensDir: this.options.tokensDir,
      oracle: {
        apiKey: this.options.oracleApiKey,
      },
    });

    const providers = createWalletApiProviders(base, {
      baseUrl: this.options.walletApiUrl,
      network: "testnet2",
      deviceId: this.options.deviceId,
    });

    const { sphere, created, generatedMnemonic } = await Sphere.init({
      ...providers,
      network: "testnet2",
      autoGenerate: true,
      market: true,
    });

    if (created && generatedMnemonic) {
      logger.warn("NEW LIVE WALLET CREATED — persist mnemonic securely offline", {
        nametag: this.options.nametag,
        // Never log the mnemonic itself.
        mnemonicWords: generatedMnemonic.split(" ").length,
      });
    }

    // Register nametag best-effort (first-seen-wins on Nostr binding)
    const desired = this.options.nametag.replace(/^@/, "");
    if (desired && sphere.identity?.nametag !== desired) {
      try {
        const available = await sphere.isNametagAvailable?.(desired);
        if (available !== false) {
          await sphere.registerNametag(desired);
          logger.info("Registered Sphere nametag", { nametag: desired });
        } else if (!sphere.identity?.nametag) {
          // Collision — try unique suffix so agent still has a live identity handle
          const fallback = `${desired}-${Date.now().toString(36).slice(-4)}`;
          await sphere.registerNametag(fallback);
          logger.warn("Nametag taken; registered fallback", {
            desired,
            fallback,
          });
        }
      } catch (error) {
        logger.warn("Nametag registration skipped", {
          nametag: desired,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.sphere = sphere;

    // Resume open payment intents (money-safety)
    try {
      await sphere.payments.resumeOpenIntents?.();
    } catch (error) {
      logger.warn("resumeOpenIntents failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.unsubDm = sphere.communications.onDirectMessage(
      (msg: {
        id: string;
        senderNametag?: string;
        senderPubkey: string;
        content: string;
        timestamp: number;
      }) => {
        let content = msg.content;
        let payload: Record<string, unknown> | undefined;
        try {
          const parsed = JSON.parse(msg.content) as {
            text?: string;
            payload?: Record<string, unknown>;
          };
          if (parsed.text) {
            content = parsed.text;
            payload = parsed.payload;
          }
        } catch {
          /* plain text */
        }
        const agentMsg: AgentMessage = {
          id: msg.id || ids.generate("msg"),
          direction: "inbound",
          peer: msg.senderNametag
            ? `@${msg.senderNametag}`
            : msg.senderPubkey.slice(0, 12),
          kind: (payload?.kind as AgentMessage["kind"]) ?? "status",
          content,
          payload,
          timestamp: new Date(msg.timestamp * 1000 || Date.now()).toISOString(),
          read: false,
        };
        for (const h of this.messageHandlers) h(agentMsg);
      }
    );

    logger.info("Live Sphere connected", {
      nametag: sphere.identity?.nametag,
      address: sphere.identity?.directAddress?.slice(0, 24),
    });
  }
}

function normalizePeer(peer: string): string {
  if (peer.startsWith("@") || peer.startsWith("DIRECT://")) return peer;
  return `@${peer}`;
}

/** TEST is a campaign label; on testnet2 the fungible coin is UCT. */
function normalizeCoinSymbol(currency: string): string {
  const c = currency.toUpperCase();
  if (c === "TEST" || c === "ALPHA") return "UCT";
  return c;
}

export function createLiveSphereFacade(
  nametag: string,
  overrides?: Partial<{
    dataDir: string;
    tokensDir: string;
    deviceId: string;
    walletApiUrl: string;
    oracleApiKey: string;
    network: string;
  }>
): LiveSphereFacade {
  const oracleApiKey = overrides?.oracleApiKey ?? resolveOracleApiKey();

  return new LiveSphereFacade({
    nametag: nametag.replace(/^@/, ""),
    network: overrides?.network ?? process.env.SPHERE_NETWORK ?? "testnet2",
    dataDir: overrides?.dataDir ?? resolveWalletDataDir(),
    tokensDir: overrides?.tokensDir ?? resolveTokensDir(),
    deviceId:
      overrides?.deviceId ??
      process.env.SPHERE_DEVICE_ID ??
      "sphere-guardian-ai-device",
    walletApiUrl:
      overrides?.walletApiUrl ??
      process.env.SPHERE_WALLET_API_URL ??
      TESTNET2_ENDPOINTS.walletApi,
    oracleApiKey,
  });
}
