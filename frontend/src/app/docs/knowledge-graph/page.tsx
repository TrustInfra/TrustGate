import Link from "next/link";
import DocShell from "@/components/docs/DocShell";

export const metadata = { title: "Knowledge Graph — TrustGate Docs" };

function TierRow({
  tier,
  range,
  meaning,
  color,
}: {
  tier: string;
  range: string;
  meaning: string;
  color: string;
}) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2.5">
        <span className={`font-mono text-[12px] font-semibold ${color}`}>
          {tier}
        </span>
      </td>
      <td className="px-3 py-2.5 text-[12px] font-mono text-text">{range}</td>
      <td className="px-3 py-2.5 text-[12px] text-text-secondary">{meaning}</td>
    </tr>
  );
}

export default function KnowledgeGraphPage() {
  return (
    <DocShell
      eyebrow="Knowledge Graph"
      title="Intuition Attestation Trust"
      lede="TrustGate surfaces a second trust signal alongside behavioral scoring: what others have attested about an entity in the Intuition knowledge graph. Available on the Oracle and Token Shield score views only. Not exposed to integrators, the widget, or the public API."
    >
      <h2>Behavioral vs knowledge graph</h2>
      <p>
        TrustGate&apos;s default signal is <strong>behavioral</strong>: what an
        address has done onchain. The <strong>knowledge graph</strong> signal
        measures something different: what others have attested, endorsed, or
        connected to that entity in{" "}
        <a
          href="https://intuition.systems"
          target="_blank"
          rel="noopener noreferrer"
        >
          Intuition
        </a>
        .
      </p>
      <p>
        These are independent lenses on the same address. A wallet can score HIGH
        behaviorally and show sparse graph coverage, or the reverse. TrustGate
        does not blend them into a single score. The toggle exists so you can
        compare both and decide what weight each deserves.
      </p>

      <h2>Where it is available</h2>
      <p>
        The Knowledge Graph toggle appears on platform score views only:
      </p>
      <ul>
        <li>
          <Link href="/oracle">Oracle</Link> — wallet trust playground
        </li>
        <li>
          <Link href="/token-shield">Token Shield</Link> — token and contract
          scoring UI
        </li>
      </ul>
      <p>
        Integrators calling the oracle, widget endpoint, or REST proxy receive
        behavioral scores only. Graph trust is not published through those
        surfaces.
      </p>

      <h2>How results are resolved</h2>
      <p>
        When you switch to Knowledge Graph, trustgated.xyz queries Intuition
        through a server-side proxy at <code>/api/graph-trust</code>. The proxy
        calls the Intuition MCP and merges two result types:
      </p>

      <h3>1. Personalized path trust</h3>
      <p>
        When a trust path exists from the configured anchor set to the queried
        address, you get a path score, path count, linked source accounts, and
        top relationships. This is the strongest graph signal.
      </p>

      <h3>2. Global standing fallback</h3>
      <p>
        When no personalized path exists but the address has attestation history
        in the graph, TrustGate falls back to a global composite score,
        confidence percentage, and verdict from{" "}
        <code>explain_trust_score</code>. The UI labels this as global standing
        only and recommends caution.
      </p>

      <h3>3. Not found</h3>
      <p>
        When neither a path nor meaningful global standing exists, the UI shows
        an honest empty state: the graph has not indexed this address yet.
        Unknown is not the same as bad.
      </p>

      <pre><code>{`Query address
    │
    ├─ Personalized path exists? ──yes──► path score + relationships
    │
    └─ no
         │
         ├─ Global composite exists? ──yes──► global standing + verdict
         │
         └─ no ──► not_found (no graph data yet)`}</code></pre>

      <h2>Graph tier bands</h2>
      <p>
        Graph tiers use the same 0 to 100 scale as behavioral scoring but are
        derived from attestation confidence and path density, not onchain
        activity.
      </p>
      <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border bg-bg-surface">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 text-left font-medium">Tier</th>
              <th className="px-3 py-2 text-left font-medium">Score</th>
              <th className="px-3 py-2 text-left font-medium">Meaning</th>
            </tr>
          </thead>
          <tbody>
            <TierRow
              tier="HIGH"
              range="70 to 100"
              meaning="Strong attestation standing with sufficient confidence"
              color="text-tier-high"
            />
            <TierRow
              tier="MEDIUM"
              range="40 to 69"
              meaning="Reasonable graph standing, moderate confidence"
              color="text-tier-medium"
            />
            <TierRow
              tier="LOW"
              range="1 to 39"
              meaning="Limited attestation coverage"
              color="text-tier-low"
            />
            <TierRow
              tier="UNKNOWN"
              range="0 or sparse"
              meaning="Insufficient data to classify"
              color="text-text-muted"
            />
          </tbody>
        </table>
      </div>

      <h2>Coverage states</h2>
      <ul>
        <li>
          <strong>indexed</strong> — enough paths and sources for a reliable
          signal
        </li>
        <li>
          <strong>sparse</strong> — some data exists but confidence is low;
          treat as weak signal
        </li>
        <li>
          <strong>not_found</strong> — no meaningful graph data for this address
        </li>
      </ul>

      <h2>Architecture</h2>
      <p>
        Browser clients never call Intuition directly. The Next.js route at{" "}
        <code>src/app/api/graph-trust/route.ts</code> performs the MCP
        handshake, calls personalized trust and global explain tools, and
        returns a normalized <code>GraphTrust</code> payload for the UI.
      </p>
      <p>
        Default MCP endpoint:{" "}
        <code>https://mcp-trust.intuition.box/mcp</code>. Override with{" "}
        <code>INTUITION_MCP_URL</code> in server environment variables.
      </p>
      <p>
        Personalized paths use a default anchor address set. Override with{" "}
        <code>GRAPH_TRUST_ANCHOR_ADDRESSES</code> (comma-separated 0x
        addresses) when deploying.
      </p>

      <h2>What this is not</h2>
      <ul>
        <li>Not a replacement for behavioral TrustGate scoring</li>
        <li>Not available on the widget, oracle API, or integrator proxy</li>
        <li>Not identity verification or KYC</li>
        <li>Not a blended or averaged score with behavioral trust</li>
      </ul>

      <p>
        For behavioral scoring detail, see{" "}
        <Link href="/docs/trust-scoring">Trust Scoring</Link>. For public API
        surfaces integrators can call, see{" "}
        <Link href="/docs/api-reference">API Reference</Link>.
      </p>
    </DocShell>
  );
}