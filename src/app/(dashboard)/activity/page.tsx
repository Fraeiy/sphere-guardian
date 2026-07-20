"use client";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGuardian } from "@/hooks/use-guardian";

export default function ActivityPage() {
  const { state } = useGuardian();
  if (!state) return null;

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Guardian Activity</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Detected → Intent → Negotiation → Settlement → Diagnostics → Resolved.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Full timeline</CardTitle>
          <CardDescription>{state.activity.length} recorded decisions</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityFeed events={state.activity.slice(0, 80)} />
        </CardContent>
      </Card>
    </div>
  );
}
