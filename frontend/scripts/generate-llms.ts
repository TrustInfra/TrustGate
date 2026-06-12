import fs from "fs";
import path from "path";

interface Route {
  path: string;
  description: string;
}

interface Config {
  title: string;
  description: string;
  baseUrl: string;
  routes: Route[];
}

const config: Config = {
  title: "TrustGate",
  description:
    "TrustGate is behavioral state infrastructure for onchain systems. Score any wallet, token, or contract by what it has actually done — not who it claims to be. Most trust systems analyze identity or static reputation. TrustGate models behavioral state over time. Trust builds slowly. Trust collapses quickly. TrustGate makes that asymmetry operational.",
  baseUrl: "https://trustgated.xyz",
  routes: [
    { path: "/", description: "Homepage -- product overview, trust-gated payment tiers, and live transaction stats" },
    { path: "/agents/live", description: "Live agent activity -- real-time feed of agent claims and payment routing" },
    { path: "/dashboard", description: "Depositor dashboard -- fund TrustGate with USDC, set per-agent allowances, and monitor claims" },
    { path: "/demo", description: "Interactive demo -- walk through a trust-gated payment flow end to end" },
    { path: "/oracle", description: "Trust oracle -- query behavioral trust scores for any wallet or agent address" },
    { path: "/token-shield", description: "Token Shield -- score any token or contract for deployer credibility and holder authenticity" },
    { path: "/docs", description: "Documentation index -- protocol overview, integration guides, and API reference" },
    { path: "/docs/how-it-works", description: "How TrustGate works -- register, deposit, score, claim flow explained" },
    { path: "/docs/trust-scoring", description: "Trust scoring model -- wallet and token scoring via formula-based analysis of direct on-chain behavioral signals" },
    { path: "/docs/trust-tiers", description: "Trust tiers -- HIGH (75-100) instant, MEDIUM (40-74) 24h lock, LOW (0-39) escrow" },
    { path: "/docs/payment-flow", description: "Payment flow -- USDC routing logic from deposit to agent claim by trust tier" },
    { path: "/docs/agent-registration", description: "Agent registration guide -- permissionlessly register an AI agent on AgentRegistry" },
    { path: "/docs/agent-loop", description: "Agent loop guide -- run the autonomous TypeScript agent that claims and uses USDC" },
    { path: "/docs/dashboard-guide", description: "Dashboard guide -- depositor walkthrough for funding, allowances, and approvals" },
    { path: "/docs/widget-integration", description: "DEX widget integration -- one script tag adds trust badges to any DEX token input" },
    { path: "/docs/integration", description: "Integration overview -- options for wallets, dApps, and DEXes to consume trust scores" },
    { path: "/docs/api-reference", description: "REST API reference -- endpoints for trust scores, oracle queries, and widget data" },
    { path: "/docs/contracts", description: "Smart contract reference -- AgentRegistry, TrustGate, and oracle contract addresses and ABIs" },
    { path: "/docs/oracle", description: "Oracle docs -- how trust scores are computed, signed, and published on-chain" },
    { path: "/docs/margin-analysis", description: "Margin analysis -- economic model and risk parameters for trust tiers" },
    { path: "/docs/local-setup", description: "Local setup -- clone, install, and run TrustGate against Arc testnet" },
  ],
};

function generate(): string {
  const lines: string[] = [
    `# ${config.title}`,
    ``,
    `> ${config.description}`,
    ``,
    `## Pages`,
    ``,
  ];

  for (const route of config.routes) {
    lines.push(`- [${route.description}](${config.baseUrl}${route.path})`);
  }

  lines.push(``);
  lines.push(`## Links`);
  lines.push(``);
  lines.push(`- [X / Twitter](https://x.com/TrustGated)`);
  lines.push(`- [Discord](https://discord.gg/kbx9RAGCmx)`);
  lines.push(``);
  lines.push(`## Notes`);
  lines.push(``);
  lines.push(`- Built by Ludarep`);
  lines.push(`- Last generated: ${new Date().toISOString().split("T")[0]}`);
  lines.push(``);

  return lines.join("\n");
}

const outPath = path.join(process.cwd(), "public", "llms.txt");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, generate(), "utf-8");
console.log(`llms.txt generated at ${outPath}`);
