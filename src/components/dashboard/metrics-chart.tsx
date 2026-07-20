"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricSnapshot } from "@/domain/types";

function series(metrics: MetricSnapshot[]) {
  return [...metrics]
    .filter((m) => !m.projectId)
    .slice(0, 40)
    .reverse()
    .map((m) => ({
      t: new Date(m.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      latency: Math.round(m.latencyMs),
      agents: m.activeAgents,
      payments: m.payments,
      transactions: m.transactions,
      incidents: m.incidents,
      usage: m.usage,
      serviceRequests: m.serviceRequests,
    }));
}

const tooltipStyle = {
  background: "#111218",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  fontSize: 12,
};

export function LatencyChart({ metrics }: { metrics: MetricSnapshot[] }) {
  const data = series(metrics);
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="lat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="latency" stroke="#22d3ee" fill="url(#lat)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MultiMetricChart({ metrics }: { metrics: MetricSnapshot[] }) {
  const data = series(metrics);
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="agents" stroke="#a78bfa" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="payments" stroke="#34d399" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="transactions" stroke="#fbbf24" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="incidents" stroke="#fb7185" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="serviceRequests" stroke="#22d3ee" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
