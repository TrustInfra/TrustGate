import DocShell from "@/components/docs/DocShell";

export const metadata = { title: "Margin Analysis — TrustGate Docs" };

function Cell({ children, mono = true }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      className={`px-3 py-2.5 text-xs text-text tabular-nums ${mono ? "font-mono" : ""}`}
    >
      {children}
    </td>
  );
}

export default function MarginAnalysis() {
  return (
    <DocShell
      eyebrow="Margin Analysis"
      title="The Settlement Cost Delta"
      lede="Agent workloads generate large numbers of small transactions. The gas cost per transaction, not the notional, dominates. TrustGate routes those claims through a path where most state writes collapse."
    >
      <h2>The baseline</h2>
      <p>
        A direct ERC-20 <code>transfer</code> on Ethereum mainnet costs
        roughly 65,000 gas. At 30 gwei and $3,000 per ETH, that settles near{" "}
        <strong>$5.85</strong> per transfer. We use a conservative{" "}
        <strong>$2.50</strong> benchmark in the margin panel — typical of L1
        at average gas prices.
      </p>

      <h2>TrustGate path</h2>
      <p>
        A single TrustGate claim on Arc Testnet is cheap natively (Arc is a
        low-cost chain) but the real win is architectural: the allowance
        model collapses the per-claim state surface. For HIGH tier, a claim
        is one SSTORE to decrement the per-agent allowance plus one ERC-20
        transfer. For MEDIUM/LOW tier, the USDC does not move until release
        — and release can be batched per depositor.
      </p>
      <p>
        At a reference cost of <strong>$0.0008</strong> per claim, the cost
        delta vs L1 at scale is the margin the demo streams in real time:
      </p>

      <div className="overflow-x-auto my-6">
        <table className="min-w-full card-static">
          <thead className="bg-bg-surface">
            <tr className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 text-left">Volume</th>
              <th className="px-3 py-2 text-right">L1 cost</th>
              <th className="px-3 py-2 text-right">TrustGate</th>
              <th className="px-3 py-2 text-right">Saved</th>
              <th className="px-3 py-2 text-right">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            <tr>
              <Cell>100 tx</Cell>
              <Cell>$250.00</Cell>
              <Cell>$0.08</Cell>
              <Cell>$249.92</Cell>
              <Cell>99.97%</Cell>
            </tr>
            <tr>
              <Cell>1,000 tx</Cell>
              <Cell>$2,500.00</Cell>
              <Cell>$0.80</Cell>
              <Cell>$2,499.20</Cell>
              <Cell>99.97%</Cell>
            </tr>
            <tr>
              <Cell>10,000 tx</Cell>
              <Cell>$25,000.00</Cell>
              <Cell>$8.00</Cell>
              <Cell>$24,992.00</Cell>
              <Cell>99.97%</Cell>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>When TrustGate does not win</h2>
      <p>
        The comparison assumes stablecoin transfer volume, not L1 settlement
        guarantees. For one-off high-value transfers where L1 finality is
        itself the product — treasury movements, large OTC trades — the gas
        cost is a rounding error on the notional, and the margin collapses.
        TrustGate is for workloads where <strong>per-transaction cost
        matters more than per-transaction finality</strong>.
      </p>

      <h2>Live demo</h2>
      <p>
        The <a href="/demo">Nanopayment Stream</a> page simulates 56 agents
        firing bursty claims. It tracks running session cost on both paths and
        exposes the delta as the primary readout. Numbers are simulated;
        methodology is identical to the table above.
      </p>
    </DocShell>
  );
}
