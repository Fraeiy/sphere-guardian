import type {
  ClockPort,
  IdPort,
  SettlementPort,
  SphereWalletPort,
} from "@/domain/ports";
import type { SettlementRecord, ServiceOffer } from "@/domain/types";
import { withRetry } from "@/infrastructure/utils/retry";
import { logger } from "@/infrastructure/logging/logger";

/**
 * Autonomous Settlement — approve, transfer, confirm, record.
 * No human interaction after agent start.
 */
export class AutonomousSettlementEngine implements SettlementPort {
  constructor(
    private readonly wallet: SphereWalletPort,
    private readonly ids: IdPort,
    private readonly clock: ClockPort
  ) {}

  async settle(input: {
    offer: ServiceOffer;
    incidentId: string;
  }): Promise<SettlementRecord> {
    const { offer, incidentId } = input;
    const recipient = offer.agentNametag.startsWith("@")
      ? offer.agentNametag
      : `@${offer.agentNametag}`;

    try {
      const result = await withRetry(
        () =>
          this.wallet.sendPayment({
            recipient,
            amount: offer.price,
            currency: offer.currency,
            memo: `guardian-settlement:${incidentId}:${offer.id}`,
          }),
        { attempts: 3, label: "autonomous-settlement", logger }
      );

      return {
        id: this.ids.generate("settle"),
        incidentId,
        offerId: offer.id,
        recipient,
        amount: offer.price,
        currency: offer.currency,
        transferId: result.transferId,
        status: result.deliveryPending ? "delivery_pending" : "completed",
        settledAt: this.clock.nowIso(),
        confirmation: `status=${result.status}`,
      };
    } catch (error) {
      return {
        id: this.ids.generate("settle"),
        incidentId,
        offerId: offer.id,
        recipient,
        amount: offer.price,
        currency: offer.currency,
        status: "failed",
        settledAt: this.clock.nowIso(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
