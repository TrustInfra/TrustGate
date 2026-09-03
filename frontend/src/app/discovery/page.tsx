"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BatchScore } from "@/lib/discovery/types";
import { scoreBatch } from "@/lib/discovery/client";
import { TrustBadge } from "@/lib/discovery/TrustBadge";
import { TrustFlags } from "@/lib/discovery/TrustFlags";
import { reorderByTrust } from "@/lib/discovery/reorder";
import { rankGroupsByTrust } from "@/lib/discovery/group-rank";
import { LIVE_TOKENS } from "@/lib/discovery/live-tokens";

type ScoreMap = Record<string, BatchScore>;

export default function DiscoveryPage() {
  const [scores, setScores] = useState<ScoreMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderByTrust, setOrderByTrust] = useState(false);
  const [groupByTicker, setGroupByTicker] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    scoreBatch(LIVE_TOKENS.map((t) => t.address))
      .then((results) => {
        if (!live) return;
        const map: ScoreMap = {};
        for (const r of results) map[r.address.toLowerCase()] = r;
        setScores(map);
      })
      .catch((err: unknown) => {
        if (!live) return;
        setScores(null);
        setError(err instanceof Error ? err.message : "batch scoring failed");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const list = useMemo(() => {
    if (!orderByTrust || !scores) return LIVE_TOKENS;
    if (groupByTicker) {
      return rankGroupsByTrust(
        LIVE_TOKENS,
        (t) => t.address,
        (t) => t.symbol,
        scores
      );
    }
    return reorderByTrust(LIVE_TOKENS, (t) => t.address, scores);
  }, [orderByTrust, groupByTicker, scores]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent mb-4">
          Arc Testnet
        </p>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-text tracking-tight">
          Trust-ordered discovery
        </h1>
        <p className="mt-4 text-sm text-text-secondary leading-relaxed max-w-xl">
          Live Arc Testnet tokens. Three contracts share the ticker USDC —
          one Circle issuer and two others. TrustGate scores the list in one
          batch call. Ordering by that score is a choice, not a default.
        </p>

        <div className="mt-8 flex flex-col gap-3 px-4 py-3 border border-border bg-bg-raised sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <label className="inline-flex items-center gap-2 font-mono text-xs text-text cursor-pointer">
            <input
              type="checkbox"
              checked={orderByTrust}
              onChange={(e) => setOrderByTrust(e.target.checked)}
            />
            Order by trust
          </label>
          <label
            className={`inline-flex items-center gap-2 font-mono text-xs ${
              orderByTrust ? "text-text cursor-pointer" : "text-text-muted"
            }`}
          >
            <input
              type="checkbox"
              checked={groupByTicker}
              disabled={!orderByTrust}
              onChange={(e) => setGroupByTicker(e.target.checked)}
            />
            Group same ticker
          </label>
          <span className="font-mono text-[11px] text-text-muted sm:flex-1">
            {orderByTrust
              ? groupByTicker
                ? "Within each ticker, high trust rises. Low and blocked stay visible at the bottom."
                : "Global reorder by trust. Low and blocked stay visible at the bottom."
              : "Launch order. Nothing reordered."}
          </span>
        </div>

        {error && (
          <p className="mt-4 font-mono text-xs text-tier-low">
            Could not score tokens. {error}
          </p>
        )}

        <ul className="mt-6 grid gap-2">
          {list.map((token) => {
            const score = scores?.[token.address.toLowerCase()];
            return (
              <li
                key={token.address}
                className="flex flex-col gap-3 px-4 py-4 border border-border bg-bg-raised sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="min-w-0 sm:flex-1">
                  <p className="font-display font-bold text-sm text-text leading-tight">
                    {token.name}{" "}
                    <span className="font-mono text-[11px] font-medium text-text-muted">
                      {token.symbol}
                    </span>
                  </p>
                  <Link
                    href={`/token-shield?address=${token.address}`}
                    className="mt-1 inline-block font-mono text-[11px] text-text-muted hover:text-accent whitespace-nowrap"
                  >
                    {shorten(token.address)}
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:max-w-[18rem]">
                  {loading || !score ? (
                    <span className="inline-block w-24 h-5 bg-bg-surface" />
                  ) : score.error ? (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      Unavailable
                    </span>
                  ) : (
                    <>
                      <TrustBadge score={score} />
                      <TrustFlags flags={score.flags} size="sm" />
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
