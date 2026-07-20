import { ensureAgentStarted, getEventBus } from "@/server/runtime";
import type { GuardianStateSnapshot } from "@/domain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events stream for real-time dashboard updates.
 * Complements WebSocket-capable deployments; works on standard Node Next.js hosts.
 */
export async function GET() {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (snapshot: GuardianStateSnapshot) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`)
          );
        } catch {
          /* closed */
        }
      };

      try {
        const agent = await ensureAgentStarted();
        send(agent.getSnapshot());
      } catch {
        /* agent may still start */
      }

      const bus = getEventBus();
      cleanup = bus.subscribeAll(send);

      // Heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      const originalCleanup = cleanup;
      cleanup = () => {
        clearInterval(heartbeat);
        originalCleanup();
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
