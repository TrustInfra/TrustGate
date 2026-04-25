/**
 * TrustGate Autonomous Agent Payment Loop
 *
 * Runs on Railway as a worker. Every CYCLE_INTERVAL_MS:
 *   1. For each agent in agents.json:
 *      - Fetch trust score from /api/arc-score/[address]
 *      - If score >= HIGH_THRESHOLD, call TrustGate.claimPayment()
 *      - Log result + Arcscan link
 *   2. Print live summary table
 *
 * Designed never to crash: every per-agent failure is isolated.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  getAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ---------- config ----------

const ARC_RPC_URL = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
const TRUSTGATE_CONTRACT = (process.env.TRUSTGATE_CONTRACT ||
  '0x52E17bC482d00776d73811680CbA9914e83E33CC') as `0x${string}`;
const SCORE_API_BASE =
  process.env.SCORE_API_BASE || 'https://trustgated.vercel.app/api/arc-score';
const ARCSCAN_BASE = process.env.ARCSCAN_BASE || 'https://testnet.arcscan.app';

const CYCLE_INTERVAL_MS = Number(process.env.CYCLE_INTERVAL_MS || 30_000);
const PER_AGENT_COOLDOWN_MS = Number(process.env.PER_AGENT_COOLDOWN_MS || 60_000);
const HIGH_THRESHOLD = Number(process.env.HIGH_THRESHOLD || 75);
const CHAIN_ID = 5042002;

const arcTestnet = {
  id: CHAIN_ID,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: { http: [ARC_RPC_URL] },
    public: { http: [ARC_RPC_URL] },
  },
} as const;

const publicClient = createPublicClient({
  chain: arcTestnet as any,
  transport: http(ARC_RPC_URL),
});

// ---------- TrustGate ABI (claimPayment) ----------

const TRUSTGATE_ABI = [
  {
    inputs: [
      { name: 'depositor', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'claimPayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'depositor', type: 'address' },
      { name: 'recipient', type: 'address' },
    ],
    name: 'claimableAmount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ---------- agent config ----------

interface AgentConfig {
  address: string;
  privateKeyEnv: string;
  label: string;
  depositorAddress: string;
  claimAmount: string;
}

interface AgentRuntime {
  cfg: AgentConfig;
  privateKey: `0x${string}`;
  lastClaimAt: number; // ms epoch, 0 = never
  lastTxHash: string | null;
  lastScore: number | null;
  lastTier: string | null;
  totalClaims: number;
  totalUsdcEarned: number; // in USDC units
}

function loadAgents(): AgentRuntime[] {
  const file = path.join(__dirname, 'agents.json');
  const raw = fs.readFileSync(file, 'utf8');
  const cfgs = JSON.parse(raw) as AgentConfig[];
  const out: AgentRuntime[] = [];

  for (const cfg of cfgs) {
    const keyName = cfg.privateKeyEnv || `AGENT_${out.length + 1}_KEY`;
    const pk = process.env[keyName];
    if (!pk) {
      console.warn(`[agent-loop] skipping ${cfg.label}: ${keyName} not set`);
      continue;
    }
    const normalized = pk.startsWith('0x') ? pk : `0x${pk}`;
    out.push({
      cfg,
      privateKey: normalized as `0x${string}`,
      lastClaimAt: 0,
      lastTxHash: null,
      lastScore: null,
      lastTier: null,
      totalClaims: 0,
      totalUsdcEarned: 0,
    });
  }
  return out;
}

// ---------- score fetch ----------

interface ScoreResponse {
  score: number;
  tier?: string;
  recommendation?: string;
}

async function fetchScore(address: string): Promise<ScoreResponse | null> {
  try {
    const url = `${SCORE_API_BASE}/${address}`;
    const res = await axios.get<ScoreResponse>(url, { timeout: 10_000 });
    return res.data;
  } catch (err) {
    console.error(`[agent-loop] score fetch failed for ${address}:`, (err as Error).message);
    return null;
  }
}

// ---------- claim ----------

async function claimFor(agent: AgentRuntime): Promise<{ ok: boolean; txHash?: string; error?: string }> {
  const account = privateKeyToAccount(agent.privateKey);

  const wallet = createWalletClient({
    account,
    chain: arcTestnet as any,
    transport: http(ARC_RPC_URL),
  });

  const amount = parseUnits(agent.cfg.claimAmount, 6);
  const depositor = getAddress(agent.cfg.depositorAddress) as `0x${string}`;

  // Pre-check: does the agent actually have a claim available?
  try {
    const claimable = (await publicClient.readContract({
      address: TRUSTGATE_CONTRACT,
      abi: TRUSTGATE_ABI,
      functionName: 'claimableAmount',
      args: [depositor, account.address],
    })) as bigint;

    if (claimable < amount) {
      return {
        ok: false,
        error: `claimable ${formatUnits(claimable, 6)} < requested ${agent.cfg.claimAmount}`,
      };
    }
  } catch (err) {
    // Pre-check failed — log but try the claim anyway, contract will revert if invalid
    console.warn(
      `[agent-loop] claimable pre-check failed for ${agent.cfg.label}:`,
      (err as Error).message
    );
  }

  try {
    const txHash = await wallet.writeContract({
      address: TRUSTGATE_CONTRACT,
      abi: TRUSTGATE_ABI,
      functionName: 'claimPayment',
      args: [depositor, amount],
      chain: arcTestnet as any,
      account,
    });

    // wait for inclusion (don't block too long)
    try {
      await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });
    } catch {
      // tx submitted but not confirmed yet — still return the hash
    }

    return { ok: true, txHash };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ---------- summary table ----------

function formatTable(agents: AgentRuntime[]): string {
  const headers = ['Label', 'Address', 'Score', 'Tier', 'Last Claim', 'Total USDC', 'Claims'];
  const rows = agents.map((a) => [
    a.cfg.label,
    a.cfg.address.slice(0, 6) + '…' + a.cfg.address.slice(-4),
    a.lastScore === null ? '-' : String(a.lastScore),
    a.lastTier || '-',
    a.lastClaimAt === 0 ? 'never' : new Date(a.lastClaimAt).toISOString().slice(11, 19),
    a.totalUsdcEarned.toFixed(4),
    String(a.totalClaims),
  ]);

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length))
  );

  const fmt = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i])).join('  ');

  const sep = widths.map((w) => '-'.repeat(w)).join('  ');
  return [fmt(headers), sep, ...rows.map(fmt)].join('\n');
}

// ---------- status export (for /api/agent-status) ----------

function writeStatus(agents: AgentRuntime[], cycleCount: number) {
  const status = {
    running: true,
    lastCycleAt: new Date().toISOString(),
    cycleCount,
    cycleIntervalMs: CYCLE_INTERVAL_MS,
    threshold: HIGH_THRESHOLD,
    totalClaims: agents.reduce((s, a) => s + a.totalClaims, 0),
    totalUsdcMoved: agents.reduce((s, a) => s + a.totalUsdcEarned, 0).toFixed(6),
    agents: agents.map((a) => ({
      label: a.cfg.label,
      address: a.cfg.address,
      score: a.lastScore,
      tier: a.lastTier,
      lastClaimAt: a.lastClaimAt === 0 ? null : new Date(a.lastClaimAt).toISOString(),
      lastTxHash: a.lastTxHash,
      lastTxUrl: a.lastTxHash ? `${ARCSCAN_BASE}/tx/${a.lastTxHash}` : null,
      totalUsdcEarned: a.totalUsdcEarned.toFixed(6),
      totalClaims: a.totalClaims,
    })),
  };

  const candidates = [
    process.env.STATUS_FILE,
    '/data/agent-status.json',
    path.join(process.cwd(), 'agent-status.json'),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, JSON.stringify(status, null, 2));
      return;
    } catch {
      // try next path
    }
  }
}

// ---------- main loop ----------

async function runCycle(agents: AgentRuntime[], cycleCount: number) {
  const now = Date.now();

  for (const agent of agents) {
    try {
      const score = await fetchScore(agent.cfg.address);
      if (!score) continue;

      agent.lastScore = score.score;
      agent.lastTier = score.tier || null;

      console.log(
        `[agent-loop] ${agent.cfg.label} ${agent.cfg.address} score=${score.score} tier=${score.tier || '?'}`
      );

      if (score.score < HIGH_THRESHOLD) continue;

      // cooldown
      if (now - agent.lastClaimAt < PER_AGENT_COOLDOWN_MS) {
        console.log(`[agent-loop] ${agent.cfg.label} on cooldown, skipping claim`);
        continue;
      }

      const result = await claimFor(agent);
      if (result.ok && result.txHash) {
        agent.lastClaimAt = Date.now();
        agent.lastTxHash = result.txHash;
        agent.totalClaims += 1;
        agent.totalUsdcEarned += Number(agent.cfg.claimAmount);
        console.log(
          `[agent-loop] ✓ ${agent.cfg.label} claimed ${agent.cfg.claimAmount} USDC tx=${result.txHash}`
        );
        console.log(`[agent-loop]   ${ARCSCAN_BASE}/tx/${result.txHash}`);
      } else {
        console.log(`[agent-loop] ✗ ${agent.cfg.label} claim failed: ${result.error}`);
      }
    } catch (err) {
      console.error(
        `[agent-loop] cycle error for ${agent.cfg.label}:`,
        (err as Error).message
      );
    }
  }

  console.log(
    `\n=== TrustGate Agent Loop — cycle ${cycleCount} @ ${new Date().toISOString()} ===`
  );
  console.log(formatTable(agents));
  console.log('');

  writeStatus(agents, cycleCount);
}

async function main() {
  const agents = loadAgents();
  if (agents.length === 0) {
    console.error('[agent-loop] no agents loaded — set AGENT_*_KEY env vars and populate agents.json');
    process.exit(1);
  }

  console.log(`[agent-loop] starting with ${agents.length} agents, interval ${CYCLE_INTERVAL_MS}ms`);
  console.log(`[agent-loop] HIGH threshold = ${HIGH_THRESHOLD}, cooldown = ${PER_AGENT_COOLDOWN_MS}ms`);
  console.log(`[agent-loop] TrustGate contract: ${TRUSTGATE_CONTRACT}`);

  let cycle = 0;
  // run immediately, then on interval
  await runCycle(agents, ++cycle);
  setInterval(() => {
    runCycle(agents, ++cycle).catch((err) => {
      console.error('[agent-loop] runCycle threw:', (err as Error).message);
    });
  }, CYCLE_INTERVAL_MS);
}

process.on('unhandledRejection', (reason) => {
  console.error('[agent-loop] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[agent-loop] uncaughtException:', err.message);
});

main().catch((err) => {
  console.error('[agent-loop] fatal:', err);
  process.exit(1);
});
