"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGuardian } from "@/hooks/use-guardian";
import { relativeTime } from "@/lib/utils";

export default function TransactionsPage() {
  const { state } = useGuardian();
  if (!state) return null;

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Autonomous settlements and inbound paid service revenue.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-white/[0.06]">
                <th className="pb-3 pr-3 font-medium">Time</th>
                <th className="pb-3 pr-3 font-medium">Kind</th>
                <th className="pb-3 pr-3 font-medium">Counterparty</th>
                <th className="pb-3 pr-3 font-medium">Amount</th>
                <th className="pb-3 pr-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Transfer</th>
              </tr>
            </thead>
            <tbody>
              {state.transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-500">
                    No transactions yet.
                  </td>
                </tr>
              )}
              {state.transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-white/[0.04]">
                  <td className="py-3 pr-3 text-zinc-400">{relativeTime(tx.createdAt)}</td>
                  <td className="py-3 pr-3">
                    <Badge tone="neutral">{tx.kind.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="py-3 pr-3 text-zinc-200">{tx.counterparty}</td>
                  <td className="py-3 pr-3 font-medium text-zinc-100">
                    {tx.amount} {tx.currency}
                  </td>
                  <td className="py-3 pr-3">
                    <Badge
                      tone={
                        tx.status === "completed"
                          ? "success"
                          : tx.status === "failed"
                            ? "danger"
                            : "warn"
                      }
                    >
                      {tx.status}
                    </Badge>
                  </td>
                  <td className="py-3 font-mono text-xs text-zinc-500">
                    {tx.transferId ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {state.settlements.map((s) => (
          <Card key={s.id}>
            <CardContent className="space-y-2 p-5 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-zinc-100">{s.recipient}</span>
                <span className="text-[var(--primary-bright)]">
                  {s.amount} {s.currency}
                </span>
              </div>
              <div className="text-xs text-zinc-500">
                {s.status} · {s.confirmation ?? s.error ?? "—"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
