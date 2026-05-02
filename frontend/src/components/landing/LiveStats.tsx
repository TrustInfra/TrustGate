"use client";

import { useEffect, useRef, useState } from "react";

interface StatsPayload {
  total_transactions: number;
  unique_callers: number | null;
}

const numberFormatter = new Intl.NumberFormat("en-US");
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_DURATION_MS = 60000;

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full bg-bg-raised border border-border text-[11px] text-text-muted font-mono">
      {children}
    </span>
  );
}

function Skeleton() {
  return (
    <span className="inline-block h-[22px] w-[120px] rounded-full bg-bg-raised border border-border animate-pulse" />
  );
}

function isStatsPayload(value: unknown): value is StatsPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.total_transactions !== "number") return false;
  return v.unique_callers === null || typeof v.unique_callers === "number";
}

export default function LiveStats() {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }

    const tick = async (): Promise<void> => {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setFailed(true);
          return;
        }
        const body: unknown = await res.json();
        if (!active) return;
        if (!isStatsPayload(body)) {
          setFailed(true);
          return;
        }
        setStats(body);

        if (body.unique_callers !== null) return;

        const startedAt = startedAtRef.current ?? Date.now();
        if (Date.now() - startedAt >= POLL_MAX_DURATION_MS) return;

        timer = setTimeout(() => {
          void tick();
        }, POLL_INTERVAL_MS);
      } catch {
        if (active) setFailed(true);
      }
    };

    void tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (failed) return null;

  const callers = stats?.unique_callers ?? null;

  return (
    <div className="mt-8 flex items-center justify-center gap-2 text-text-muted">
      {stats !== null ? (
        <Pill>
          {numberFormatter.format(stats.total_transactions)} transactions
        </Pill>
      ) : (
        <Skeleton />
      )}
      <span aria-hidden className="text-text-muted text-xs">
        &bull;
      </span>
      {callers !== null ? (
        <Pill>{numberFormatter.format(callers)} unique wallets</Pill>
      ) : (
        <Skeleton />
      )}
    </div>
  );
}
