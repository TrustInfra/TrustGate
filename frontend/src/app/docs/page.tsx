import Link from "next/link";
import { ArrowRight } from "lucide-react";
import DocShell from "@/components/docs/DocShell";

export const metadata = { title: "Overview — TrustGate Docs" };

function QuickLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="card p-4 flex items-start justify-between gap-3 hover:border-border-hover"
    >
      <div>
        <p className="text-sm font-display font-bold text-text">{label}</p>
        <p className="mt-0.5 text-[12px] text-text-muted">{description}</p>
      </div>
      <ArrowRight size={14} className="text-accent shrink-0 mt-0.5" />
    </Link>
  );
}

export default function DocsOverview() {
  return (
    <DocShell
      eyebrow="Overview"
      title="TrustGate"
      lede="Trust-gated USDC payment infrastructure for AI agents. Onchain trust scoring on Arc routes every payment through instant settlement, a 24-hour time-lock, or escrow — picked automatically from the agent's tier."
    >
      <h2>What it is</h2>
      <p>
        TrustGate is a payment layer purpose-built for autonomous agents.
        Depositors fund a pooled USDC balance, set per-agent allowances, and
        delegate routing to an onchain trust score. Agents claim against those
        allowances directly, and the contract picks instant transfer,
        time-lock, or escrow based on the agent&apos;s tier — no off-chain
        approvals, no human in the loop.
      </p>

      <h2>The problem</h2>
      <p>
        Mainstream L1 gas fees ($2 – $5 per transaction) make sub-cent agent
        micropayments economically unviable. ERC-20{" "}
        <code>approve()</code> is also all-or-nothing — once granted, an agent
        has unlimited spending authority until revocation. There is no
        primitive that lets reputation shape the settlement path, so any
        agent-to-agent commerce inherits the worst trust assumptions of the
        network.
      </p>

      <h2>The solution</h2>
      <p>
        TrustGate combines two pieces of infrastructure that did not exist
        together before:
      </p>
      <ul>
        <li>
          <strong>Onchain trust scoring on Arc</strong> — the score is
          computed deterministically from real Arc activity (transactions,
          USDC balance, contract interactions, deployments). No oracle, no
          human input.
        </li>
        <li>
          <strong>Circle Nanopayments for sub-cent USDC settlement</strong> —
          Arc uses USDC as native gas, so the same asset that settles the
          payment also pays for the transaction. Per-claim cost is roughly
          $0.0008 versus $2 – $5 on traditional L1s.
        </li>
      </ul>
      <p>
        On top, <strong>tier-routed payments</strong> turn a single trust
        score into a concrete settlement decision: HIGH tiers receive USDC
        instantly, MEDIUM tiers wait through a 24-hour cancellation window,
        LOW tiers stay in escrow until the depositor approves, and BLOCKED
        wallets are rejected outright.
      </p>

      <h2>Quick links</h2>
      <div className="not-prose grid gap-3 my-4">
        <QuickLink
          href="/docs/how-it-works"
          label="How It Works"
          description="The four-step flow from deposit to claim, and why each step exists."
        />
        <QuickLink
          href="/docs/trust-scoring"
          label="Trust Scoring"
          description="The full scoring formula, tier mapping, and how scores are derived from Arc activity."
        />
        <QuickLink
          href="/docs/contracts"
          label="Contracts"
          description="Deployed addresses on Arc Testnet and the role of each contract."
        />
        <QuickLink
          href="/docs/api-reference"
          label="API Reference"
          description="Public oracle endpoints and the x402 payment standard."
        />
      </div>
    </DocShell>
  );
}
