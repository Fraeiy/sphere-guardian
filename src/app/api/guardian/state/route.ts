import { NextResponse } from "next/server";
import { ensureAgentStarted } from "@/server/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const agent = await ensureAgentStarted();
    return NextResponse.json(agent.getSnapshot());
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get state",
      },
      { status: 500 }
    );
  }
}
