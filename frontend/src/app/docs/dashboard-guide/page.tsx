import Link from "next/link";
import DocShell from "@/components/docs/DocShell";

export const metadata = { title: "Dashboard Guide — TrustGate Docs" };

export default function DashboardGuidePage() {
  return (
    <DocShell
      eyebrow="Dashboard Guide"
      title="Using the Dashboard"
      lede="A walk-through of the three dashboard tabs — Depositor, Agents, Claims — and the exact contract calls each one issues. The dashboard is a thin wagmi/viem wrapper over the deployed contracts."
    >
      <h2>Connecting</h2>
      <p>
        The dashboard at <Link href="/dashboard">/dashboard</Link> requires
        a wallet on Arc Testnet (Chain ID <code>5042002</code>). Use
        ConnectKit&apos;s wallet button in the top right; the app will prompt
        to switch networks if a different chain is active. Get testnet USDC
        from{" "}
        <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">
          faucet.circle.com
        </a>
        .
      </p>

      <h2>Depositor tab</h2>
      <p>
        For the wallet funding agents. Three actions:
      </p>
      <ul>
        <li>
          <strong>Deposit USDC</strong> — first call approves USDC to the{" "}
          <code>TrustGate</code> address, second call invokes{" "}
          <code>deposit(amount)</code> to credit your pooled balance.
        </li>
        <li>
          <strong>Set agent allowance</strong> — calls{" "}
          <code>setAgentAllowance(agent, maxSpend)</code>. The cap applies
          per (depositor, agent) pair and can be raised or lowered at any
          time.
        </li>
        <li>
          <strong>Withdraw USDC</strong> — pulls funds back from your pooled
          balance via <code>withdraw(amount)</code>. Allowances are not
          cleared automatically — they remain set against future deposits.
        </li>
      </ul>

      <h2>Agents tab</h2>
      <p>
        For agent owners — the wallet that controls (or speaks for) one or
        more agent addresses.
      </p>

      <h3>Register agent</h3>
      <p>
        Defaults to your connected wallet so most users register their own
        address as an agent. Override with any address; the call is
        permissionless. Preflight checks block obvious failures before they
        cost gas:
      </p>
      <ul>
        <li>
          <strong>Already registered</strong> — read from{" "}
          <code>AgentRegistry.getAgent(address)</code>.
        </li>
        <li>
          <strong>Insufficient gas</strong> — read from native USDC balance.
          Below 0.01 USDC the submit button stays disabled.
        </li>
        <li>
          <strong>Revert decoding</strong> — any failure is mapped from the
          ABI&apos;s custom errors (<code>AgentAlreadyRegistered</code>,{" "}
          <code>ZeroAddress</code>, etc.) to plain English in the UI.
        </li>
      </ul>

      <h3>Calculate Score</h3>
      <p>
        Each agent card has a <strong>Calculate Score</strong> button that
        runs the Arc onchain activity formula automatically. The flow is:
      </p>
      <ol>
        <li>
          <em>Querying Arc RPC</em> — the dashboard hits{" "}
          <code>/api/arc-score/[address]</code>, which fetches transaction
          count, USDC balance, contract interactions, and deployments
          server-side.
        </li>
        <li>
          <em>Awaiting wallet</em> — the computed score is submitted onchain
          via <code>TrustScoring.setTrustScore()</code>.
        </li>
        <li>
          <em>Confirming on Arc</em> — the breakdown panel renders as soon as
          the score is computed; tier and badge update once the tx confirms.
        </li>
      </ol>
      <p>
        The breakdown panel shows every line item — transaction points, USDC
        balance points, contract interaction points, deployment bonus — plus
        the cap status. See <Link href="/docs/trust-scoring">Trust Scoring</Link> for
        the formula behind each row.
      </p>

      <h3>Claim Payment (agent view)</h3>
      <p>
        When the connected wallet is an active agent, the same tab shows a{" "}
        <strong>Claim Payment</strong> form. Enter the depositor address and
        amount; the dashboard calls <code>TrustGate.claim()</code>. The
        routing detail (instant / time-locked / escrowed) is derived from
        the agent&apos;s tier and is not user-selectable.
      </p>

      <h2>Claims tab</h2>
      <p>
        A list of every claim involving the connected wallet, on either side.
        Status comes directly from <code>TrustGate.getClaim(claimId)</code>.
      </p>
      <ul>
        <li>
          <strong>Pending</strong> — MEDIUM tier claim awaiting its 24-hour
          window. Shows a countdown to <code>releaseTime</code>. The agent
          presses <em>Release</em> after expiry to finalise.
        </li>
        <li>
          <strong>Escrowed</strong> — LOW tier claim awaiting depositor
          approval. The depositor sees an <em>Approve</em> button; the agent
          waits.
        </li>
        <li>
          <strong>Released</strong> — terminal state. USDC has moved to the
          agent.
        </li>
        <li>
          <strong>Cancelled</strong> — depositor pulled back funds before
          release.
        </li>
      </ul>
      <p>
        The depositor can call <code>cancel(claimId)</code> on any Pending or
        Escrowed claim, returning the USDC to their pooled balance.
      </p>

      <h2>What the dashboard does not do</h2>
      <ul>
        <li>
          It does not custody funds — every action is a direct contract call
          from your wallet.
        </li>
        <li>
          It does not run a trust algorithm offchain — the Arc RPC reads
          happen server-side only to dodge browser CORS, and the resulting
          score is written onchain through your signature.
        </li>
        <li>
          It does not keep a session — all state is read live from the chain
          on every render.
        </li>
      </ul>
    </DocShell>
  );
}
