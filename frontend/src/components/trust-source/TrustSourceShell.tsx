"use client";

import { useCallback, useEffect, useState } from "react";
import { getGraphTrust } from "@/lib/graph-trust";
import type { GraphTrust } from "@/lib/graph-trust/types";
import TrustSourceToggle, { type TrustSource } from "./TrustSourceToggle";
import GraphTrustView from "./GraphTrustView";

interface TrustSourceShellProps {
  address: string;
  children: React.ReactNode;
  className?: string;
}

function GraphSpinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-[#f5c842]"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export default function TrustSourceShell({
  address,
  children,
  className,
}: TrustSourceShellProps) {
  const [source, setSource] = useState<TrustSource>("behavioral");
  const [graphData, setGraphData] = useState<GraphTrust | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGraphTrust = useCallback(async (addr: string) => {
    setLoading(true);
    setError(null);
    setGraphData(null);
    try {
      const data = await getGraphTrust(addr);
      setGraphData(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load graph trust";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSource("behavioral");
    setGraphData(null);
    setError(null);
    setLoading(false);
  }, [address]);

  useEffect(() => {
    if (source !== "graph") return;
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return;
    void loadGraphTrust(address);
  }, [source, address, loadGraphTrust]);

  const handleSourceChange = (next: TrustSource) => {
    setSource(next);
    if (next === "behavioral") {
      setError(null);
    }
  };

  return (
    <div className={className}>
      <TrustSourceToggle value={source} onChange={handleSourceChange} />

      <div className="mt-5">
        {source === "behavioral" ? (
          children
        ) : (
          <div>
            {loading && (
              <div className="flex items-center gap-3 rounded-lg border border-[#1f1f1f] bg-[#111111] px-5 py-8">
                <GraphSpinner />
                <p className="font-mono text-sm text-zinc-400">
                  Loading knowledge graph trust...
                </p>
              </div>
            )}

            {!loading && error && (
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-5 py-6">
                <p className="font-mono text-sm text-orange-200">
                  Could not load graph trust
                </p>
                <p className="mt-1 font-mono text-xs text-zinc-500">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadGraphTrust(address)}
                  className="mt-4 rounded border border-[#333] px-3 py-1.5 font-mono text-xs text-zinc-300 transition hover:border-[#f5c842]/50 hover:text-[#f5c842]"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && graphData && (
              <GraphTrustView data={graphData} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}