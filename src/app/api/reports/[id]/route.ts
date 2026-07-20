import { NextResponse } from "next/server";
import { ensureAgentStarted } from "@/server/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const agent = await ensureAgentStarted();
  const report = agent.getSnapshot().reports.find((r) => r.id === id);
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  return new NextResponse(report.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.type}-${id}.md"`,
    },
  });
}
