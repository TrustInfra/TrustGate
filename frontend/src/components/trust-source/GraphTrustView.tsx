"use client";

import type { GraphTrust, GraphTier } from "@/lib/graph-trust/types";

const GOLD = "#f5c842";

const TIER_STYLES: Record<
  GraphTier,
  { border: string; bg: string; text: string; label: string }
> = {
  HIGH: {
    border: "border-[#c8f135]/40",
    bg: "bg-[#c8f135]/10",
    text: "text-[#c8f135]",
    label: "HIGH",
  },
  MEDIUM: {
    border: "border-[#f5c842]/40",
    bg: "bg-[#f5c842]/10",
    text: "text-[#f5c842]",
    label: "MEDIUM",
  },
  LOW: {
    border: "border-orange-500/40",
    bg: "bg-orange-500/10",
    text: "text-orange-300",
    label: "LOW",
  },
  UNKNOWN: {
    border: "border-dashed border-zinc-600",
    bg: "bg-zinc-800/40",
    text: "text-zinc-400",
    label: "UNKNOWN",
  },
};

interface GraphTrustViewProps {
  data: GraphTrust;
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-[#1f1f1f] bg-[#111111] px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-100">
        {value}
      </p>
    </div>
  );
}

function ExplainerLine({ text }: { text: string }) {
  return (
    <p className="rounded border border-[#1f1f1f] bg-[#111111] px-4 py-3 font-mono text-sm leading-relaxed text-zinc-300">
      {text}
    </p>
  );
}

export default function GraphTrustView({ data }: GraphTrustViewProps) {
  const tierStyle = TIER_STYLES[data.graphTier];

  if (data.resultType === "not_found") {
    return (
      <div className="space-y-4">
        <ExplainerLine text={data.explainer} />
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#111111] px-6 py-8 text-center">
          <p className="font-mono text-sm font-medium text-zinc-400">
            No graph data for this entity yet
          </p>
        </div>
      </div>
    );
  }

  const showScore = data.graphTier !== "UNKNOWN" && data.graphScore > 0;
  const isGlobalOnly = data.resultType === "global_only";

  return (
    <div className="space-y-5">
      <p className="font-mono text-xs text-zinc-500">
        Knowledge graph trust reflects what others have attested about this entity,
        not its on-chain behavior.
      </p>

      <ExplainerLine text={data.explainer} />

      {isGlobalOnly && (
        <div className="rounded border border-[#f5c842]/30 bg-[#f5c842]/5 px-4 py-3">
          <p className="font-mono text-xs text-[#f5c842]">
            Global standing only. No personalized trust path from the anchor set.
          </p>
        </div>
      )}

      {data.state === "sparse" && !isGlobalOnly && (
        <div className="rounded border border-[#f5c842]/30 bg-[#f5c842]/5 px-4 py-3">
          <p className="font-mono text-xs text-[#f5c842]">
            Sparse graph coverage. Few attestations indexed. Treat this signal
            as low confidence.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        {showScore ? (
          <p
            className="text-5xl font-bold tabular-nums"
            style={{ color: GOLD }}
          >
            {data.graphScore}
          </p>
        ) : (
          <p className="font-mono text-3xl font-bold text-zinc-500">—</p>
        )}
        <span
          className={`rounded border px-2.5 py-1 font-mono text-xs font-semibold tracking-wide ${tierStyle.border} ${tierStyle.bg} ${tierStyle.text}`}
        >
          {tierStyle.label}
        </span>
        {isGlobalOnly && data.globalStanding && (
          <span className="font-mono text-xs text-zinc-500">
            {data.globalStanding.verdict}
          </span>
        )}
        {data.graphTier === "UNKNOWN" && !isGlobalOnly && (
          <span className="font-mono text-xs text-zinc-500">
            Insufficient attestation data to classify
          </span>
        )}
      </div>

      {isGlobalOnly && data.globalStanding ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatItem
            label="Global composite"
            value={`${data.globalStanding.composite}/100`}
          />
          <StatItem
            label="Confidence"
            value={`${data.globalStanding.confidence}%`}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatItem label="Attestations" value={data.attestationCount} />
          <StatItem label="Endorsements" value={data.endorsements} />
          <StatItem label="Connected entities" value={data.connectedEntities} />
        </div>
      )}

      {data.topRelationships && data.topRelationships.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Top trust relationships
          </p>
          <ul className="space-y-2">
            {data.topRelationships.map((rel, i) => (
              <li
                key={`${rel.entity}-${i}`}
                className="flex flex-wrap items-center gap-2 rounded border border-[#1f1f1f] bg-[#111111] px-3 py-2 font-mono text-xs"
              >
                <span className="text-zinc-300">{rel.entity}</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-500">{rel.relation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}