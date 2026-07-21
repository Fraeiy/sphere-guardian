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
  background: "#12100e",
  border: "1px solid rgba(232,163,23,0.2)",
  borderRadius: 12,
  fontSize: 12,
  color: "#f7f1e8",
};

export function LatencyChart({ metrics }: { metrics: MetricSnapshot[] }) {
  const data = series(metrics);
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="lat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8a317" stopOpacity={0.4} />
              <stop offset="55%" stopColor="#e87a1a" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#c93a2a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(232,163,23,0.06)" vertical={false} />
          <XAxis dataKey="t" tick={{ fill: "#9a9084", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#9a9084", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="latency" stroke="#e8a317" fill="url(#lat)" strokeWidth={2} />
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
          <CartesianGrid stroke="rgba(232,163,23,0.06)" vertical={false} />
          <XAxis dataKey="t" tick={{ fill: "#9a9084", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#9a9084", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                agents: "market agents (live search)",
                payments: "unused",
                transactions: "targets probed",
                incidents: "unhealthy targets",
                serviceRequests: "market intents (live)",
                usage: "targets healthy",
              };
              return [value, labels[String(name)] ?? String(name)];
            }}
          />
          <Line type="monotone" dataKey="usage" stroke="#34d399" strokeWidth={2} dot={false} name="usage" />
          <Line type="monotone" dataKey="transactions" stroke="#e8a317" strokeWidth={2} dot={false} name="transactions" />
          <Line type="monotone" dataKey="incidents" stroke="#c93a2a" strokeWidth={2} dot={false} name="incidents" />
          <Line type="monotone" dataKey="serviceRequests" stroke="#e87a1a" strokeWidth={2} dot={false} name="serviceRequests" />
          <Line type="monotone" dataKey="agents" stroke="#f0c14d" strokeWidth={2} dot={false} name="agents" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
