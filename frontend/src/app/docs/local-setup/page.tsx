import DocShell from "@/components/docs/DocShell";

export const metadata = { title: "Local Setup — TrustGate Docs" };

export default function LocalSetupPage() {
  return (
    <DocShell
      eyebrow="Local Setup"
      title="Running TrustGate Locally"
      lede="Clone the repo, install dependencies, and run the frontend, contracts, and oracle pages against Arc testnet."
    >
      <h2>Prerequisites</h2>
      <ul>
        <li>
          <strong>Node.js 18+</strong> and a recent npm.
        </li>
        <li>
          <strong>Git</strong>.
        </li>
        <li>
          <strong>An Arc testnet wallet</strong> with at least 0.05 USDC for
          gas. Faucet:{" "}
          <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">
            faucet.circle.com
          </a>
          .
        </li>
        <li>
          <strong>WalletConnect Project ID</strong> (optional, only needed for
          mobile wallet support). Free at{" "}
          <a
            href="https://cloud.walletconnect.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            cloud.walletconnect.com
          </a>
          .
        </li>
      </ul>

      <h2>Clone</h2>
      <pre><code>{`cd TrustGate`}</code></pre>

      <h2>Contracts</h2>
      <p>
        Hardhat workspace lives at the repo root. Install once at the top
        level:
      </p>
      <pre><code>{`npm install
npx hardhat compile
npm test`}</code></pre>
      <p>
        The test suite is 142 tests across registration, allowance, claim
        routing, lifecycle, and full integration scenarios — all passing on
        a vanilla Hardhat node. The 36 FHE-dependent TrustScoring tests are
        marked pending because the Zama coprocessor is not available on
        Arc.
      </p>

      <h2>Frontend</h2>
      <pre><code>{`cd frontend
npm install
cp .env.example .env.local   # then edit .env.local
npm run dev`}</code></pre>
      <p>
        The dev server starts on <code>http://localhost:3000</code>.
      </p>

      <h3>Environment variables</h3>
      <pre><code>{`# Required
NEXT_PUBLIC_ORACLE_URL=https://oracle.trustgated.xyz

# Optional — enables WalletConnect mobile flows
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id`}</code></pre>
      <p>
        Both variables are read at build time. Without{" "}
        <code>NEXT_PUBLIC_ORACLE_URL</code>, the oracle and live agents
        pages still render but cannot fetch live stats.
      </p>

      <h2>Deploy your own contracts</h2>
      <p>
        The default frontend points at the canonical TrustGate deployment.
        To deploy fresh contracts to Arc testnet:
      </p>
      <pre><code>{`# at repo root
cp .env.example .env
# add PRIVATE_KEY=<your deployer key>

npx hardhat run scripts/deploy-arc.ts --network arcTestnet`}</code></pre>
      <p>
        The script deploys{" "}
        <code>TrustScoringPlaintext</code>, <code>AgentRegistry</code>, and{" "}
        <code>TrustGate</code>, then wires them together. Update{" "}
        <code>frontend/src/lib/constants.ts</code> with the new addresses.
      </p>

      <h2>Verify on Arcscan</h2>
      <pre><code>{`ETHERSCAN_API_KEY=arcscan npx hardhat verify \\
  --network arcTestnet <ADDRESS> <...CTOR_ARGS>`}</code></pre>
      <p>
        Arcscan accepts any non-empty API key. If verification fails on the
        first attempt, retry with <code>--force</code> — the explorer
        sometimes lags one block behind a fresh deployment.
      </p>

      <h2>Repository layout</h2>
      <pre><code>{`TrustGate/
├── contracts/          Solidity sources (TrustGate, AgentRegistry, TrustScoring)
├── deploy/             hardhat-deploy scripts
├── scripts/            One-shot deploy + verification scripts
├── test/               Hardhat tests (142 passing)
├── frontend/           Next.js 14 app (dashboard, oracle, docs, demo)
│   ├── src/app/        Routes (App Router)
│   └── src/lib/        Wagmi config, ABIs, constants
└── docs/               Long-form architecture notes`}</code></pre>

      <h2>Common issues</h2>
      <ul>
        <li>
          <strong>Wrong network</strong> — the dashboard prompts a network
          switch automatically. If a wallet refuses, add Arc Testnet
          manually with chain ID <code>5042002</code> and RPC{" "}
          <code>https://rpc.testnet.arc.network</code>.
        </li>
        <li>
          <strong>Insufficient gas</strong> — Arc uses USDC as native gas.
          The Register Agent and Calculate Score buttons stay disabled
          below 0.01 USDC; refill via faucet.
        </li>
        <li>
          <strong>Score returns 0</strong> — the wallet has zero Arc
          transactions and is BLOCKED by the formula. Send any tx to leave
          the BLOCKED tier.
        </li>
      </ul>
    </DocShell>
  );
}
