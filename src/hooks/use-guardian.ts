"use client";

import { useCallback, useEffect, useState } from "react";
import type { GuardianStateSnapshot } from "@/domain/types";

export function useGuardian(pollMs = 4000) {
  const [state, setState] = useState<GuardianStateSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/guardian/state", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GuardianStateSnapshot;
      setState(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  useEffect(() => {
    const es = new EventSource("/api/guardian/events");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as GuardianStateSnapshot;
        setState(data);
        setLoading(false);
      } catch {
        /* ignore malformed */
      }
    };
    es.onerror = () => {
      // Fall back to polling; EventSource will retry.
    };
    return () => es.close();
  }, []);

  const start = async () => {
    await fetch("/api/guardian/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    await refresh();
  };

  const stop = async () => {
    await fetch("/api/guardian/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    });
    await refresh();
  };

  const tick = async () => {
    await fetch("/api/guardian/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "tick" }),
    });
    await refresh();
  };

  return { state, error, loading, refresh, start, stop, tick };
}
