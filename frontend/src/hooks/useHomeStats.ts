"use client";

import { useEffect, useState } from "react";

export interface TxStats {
  total_transactions: number;
  unique_callers: number | null;
}

export interface RecentQuery {
  addressMasked: string;
  score: number;
  tier: string;
  paid: boolean;
  at: string;
}

export interface OracleStats {
  totalQueries: number;
  totalUsdcEarned: string;
  uniqueAddressesScored: number;
  averageScore: number;
  tierDistribution: Record<string, number>;
  recentQueries: RecentQuery[];
}

const TX_STATS_URL = "/api/stats";
const ORACLE_STATS_URL = "/api/oracle/oracle/stats";
const POLL_MS = 15_000;

function isTxStats(value: unknown): value is TxStats {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.total_transactions !== "number") return false;
  return v.unique_callers === null || typeof v.unique_callers === "number";
}

function isOracleStats(value: unknown): value is OracleStats {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.totalQueries === "number" &&
    typeof v.totalUsdcEarned === "string" &&
    typeof v.uniqueAddressesScored === "number" &&
    typeof v.averageScore === "number" &&
    Array.isArray(v.recentQueries)
  );
}

export function useTxStats(): { stats: TxStats | null; failed: boolean } {
  const [stats, setStats] = useState<TxStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const tick = async (): Promise<void> => {
      try {
        const res = await fetch(TX_STATS_URL, { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setFailed(true);
          return;
        }
        const body: unknown = await res.json();
        if (!active) return;
        if (!isTxStats(body)) {
          setFailed(true);
          return;
        }
        setStats(body);
        setFailed(false);
      } catch {
        if (active) setFailed(true);
      }
    };

    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return { stats, failed };
}

export function useOracleStats(): {
  stats: OracleStats | null;
  failed: boolean;
} {
  const [stats, setStats] = useState<OracleStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const tick = async (): Promise<void> => {
      try {
        const res = await fetch(ORACLE_STATS_URL, { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setFailed(true);
          return;
        }
        const body: unknown = await res.json();
        if (!active) return;
        if (!isOracleStats(body)) {
          setFailed(true);
          return;
        }
        setStats(body);
        setFailed(false);
      } catch {
        if (active) setFailed(true);
      }
    };

    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return { stats, failed };
}