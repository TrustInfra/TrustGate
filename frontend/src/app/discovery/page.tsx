"use client";

import { useEffect, useMemo, useState } from "react";
import type { BatchScore } from "@/lib/discovery/types";
import { scoreBatch } from "@/lib/discovery/client";
import { TrustBadge } from "@/lib/discovery/TrustBadge";
import { TrustFlags } from "@/lib/discovery/TrustFlags";
import { reorderByTrust } from "@/lib/discovery/reorder";

// ============================================================================
// /discovery: our own reference surface for Phase 2b. It is NOT a partner UI.
// It shows the opt-in kit working end to end against the mock: batch scoring,
// badges, flags, both token states, and the optional reorder.
//
// The "Order by trust" toggle is OFF by default on purpose. The page first
// shows the list in plain launch order, and only reorders when you opt in.
// That is the whole non-invasive principle made visible: we provide the
// signal, the choice to order by it is the user's.
//
// If your path alias is not "@/", swap the imports above for relative paths
// like ../../lib/discovery/client.
// ============================================================================

interface TokenItem {
  name: string;
  symbol: string;
  address: string;
}

// Demo list. Several entries are named YOSHI with different addresses: the
// exact situation this feature is for. Same name, different token, no way to
// tell which is real from the name. Tiers here come from the mock; once Nald's
// batch endpoint is wired, they come from the oracle with no page changes.
const MOCK_TOKENS: TokenItem[] = [
  { name: "Yoshi", symbol: "YOSHI", address: "0xa1b2c3d4e5f60000000000000000000000000001" },
  { name: "Yoshi", symbol: "YOSHI", address: "0xb2c3d4e5f6a700000000000000000000000000a2" },
  { name: "Yoshi", symbol: "YOSHI", address: "0xc3d4e5f6a7b800000000000000000000000000b3" },
  { name: "Yoshi", symbol: "YOSHI", address: "0xd4e5f6a7b8c900000000000000000000000000c4" },
  { name: "PepeArc", symbol: "PEPEA", address: "0xe5f6a7b8c9da00000000000000000000000000d5" },
  { name: "PepeArc", symbol: "PEPEA", address: "0xf6a7b8c9daeb0000000000000000000000000e60" },
  { name: "ArcInu", symbol: "AINU", address: "0xa7b8c9daebfc00000000000000000000000000f7" },
  { name: "ArcInu", symbol: "AINU", address: "0xb8c9daebfcad00000000000000000000000000a8" },
];

type ScoreMap = Record<string, BatchScore>;

export default function DiscoveryPage() {
  const [scores, setScores] = useState<ScoreMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderByTrust, setOrderByTrust] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    scoreBatch(MOCK_TOKENS.map((t) => t.address))
      .then((results) => {
        if (!live) return;
        const map: ScoreMap = {};
        for (const r of results) map[r.address.toLowerCase()] = r;
        setScores(map);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const list = useMemo(() => {
    if (!orderByTrust || !scores) return MOCK_TOKENS;
    return reorderByTrust(MOCK_TOKENS, (t) => t.address, scores);
  }, [orderByTrust, scores]);

  return (
    <main style={styles.page}>
      <div style={styles.inner}>
        <header style={styles.header}>
          <h1 style={styles.h1}>Trust-Ordered Discovery</h1>
          <p style={styles.sub}>
            A reference surface. The same name can hide many different tokens.
            TrustGate gives the signal. Ordering by it is a choice, not a default.
          </p>
        </header>

        <div style={styles.controls}>
          <label style={styles.toggle}>
            <input
              type="checkbox"
              checked={orderByTrust}
              onChange={(e) => setOrderByTrust(e.target.checked)}
            />
            <span>Order by trust</span>
          </label>
          <span style={styles.hint}>
            {orderByTrust
              ? "Reordered by trust. Low and blocked sink to the bottom, marked not hidden."
              : "Plain launch order. Nothing reordered."}
          </span>
        </div>

        <ul style={styles.list}>
          {list.map((token) => {
            const score = scores?.[token.address.toLowerCase()];
            return (
              <li key={token.address} style={styles.row}>
                <div style={styles.tokenMeta}>
                  <span style={styles.tokenName}>
                    {token.name}{" "}
                    <span style={styles.symbol}>{token.symbol}</span>
                  </span>
                  <span style={styles.addr}>{shorten(token.address)}</span>
                </div>

                <div style={styles.signal}>
                  {loading || !score ? (
                    <span style={styles.skeleton} />
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
    </main>
  );
}

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0A0F1E",
    color: "#E6EAF2",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    padding: "48px 20px",
  },
  inner: { maxWidth: 760, margin: "0 auto" },
  header: { marginBottom: 28 },
  h1: { fontSize: 26, fontWeight: 700, margin: "0 0 8px" },
  sub: { fontSize: 14, lineHeight: 1.5, color: "#9AA4B8", margin: 0 },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: "12px 14px",
    borderRadius: 10,
    background: "#0F1626",
    border: "1px solid #1E2A41",
    marginBottom: 18,
  },
  toggle: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  hint: { fontSize: 12.5, color: "#7C879E" },
  list: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "12px 14px",
    borderRadius: 10,
    background: "#0F1626",
    border: "1px solid #1E2A41",
  },
  tokenMeta: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  tokenName: { fontSize: 15, fontWeight: 600 },
  symbol: { fontSize: 12, fontWeight: 500, color: "#7C879E" },
  addr: { fontSize: 12, color: "#7C879E", fontFamily: "ui-monospace, monospace" },
  signal: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  skeleton: {
    display: "inline-block",
    width: 96,
    height: 24,
    borderRadius: 8,
    background: "#1A2336",
  },
};
