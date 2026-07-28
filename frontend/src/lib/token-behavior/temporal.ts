import "server-only";

/**
 * Temporal Token Shield signals (Phase 3 — INTERNAL_ROADMAP).
 * Hold duration, exit ratio (% sold back), wash trading, honeypot
 * (sell≈0 vs buy after distribution), coordinated long-hold exit (sync of sells).
 */

const ARCSCAN_API = "https://testnet.arcscan.app";
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// Env-tunable (neutral defaults if missing — still functional heuristics)
const SHORT_HOLD_HOURS = Number(process.env.SCORING_TEMPORAL_SHORT_HOLD_HOURS ?? 6);
const EXIT_MAJORITY_PCT = Number(process.env.SCORING_TEMPORAL_EXIT_MAJORITY_PCT ?? 70);
const EXIT_WINDOW_MS = Number(
  process.env.SCORING_TEMPORAL_EXIT_WINDOW_MS ?? 3 * DAY_MS
);
const HONEYPOT_SELL_BUY_RATIO = Number(
  process.env.SCORING_TEMPORAL_HONEYPOT_SELL_BUY_RATIO ?? 0.05
);
const DIST_PERIOD_MS = Number(
  process.env.SCORING_TEMPORAL_DIST_PERIOD_MS ?? 2 * DAY_MS
);

export interface TemporalTokenResult {
  flags: string[];
  observations: string[];
  scoreDelta: number;
  exitParticipants: string[];
  metrics: {
    holderCount: number;
    topHolderPct: number;
    medianHoldHours: number | null;
    averageHoldHours: number | null;
    /** Mean fraction of acquired tokens later sold (0–1) among wallets with sells */
    meanExitRatio: number | null;
    /** Wallets that sold >= EXIT_MAJORITY_PCT of acquired amount */
    majorityExitWalletCount: number;
    buyVolumeSample: number;
    sellVolumeSample: number;
    sellToBuyRatio: number | null;
    transferSample: number;
    washPairCount: number;
  };
}

interface HolderItem {
  address?: { hash?: string } | string | null;
  value?: string | null;
}

interface HoldersPage {
  items?: HolderItem[] | null;
}

interface TransferItem {
  timestamp?: string | null;
  from?: { hash?: string | null } | string | null;
  to?: { hash?: string | null } | string | null;
  total?: { value?: string | null } | null;
  type?: string | null;
}

interface TransfersPage {
  items?: TransferItem[] | null;
}

interface TokenInfo {
  holders?: string | number | null;
  holders_count?: string | number | null;
}

async function arcscanGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${ARCSCAN_API}${path}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function addrOf(
  field: { hash?: string | null } | string | null | undefined
): string {
  if (!field) return "";
  if (typeof field === "string") return field.toLowerCase();
  return (field.hash ?? "").toLowerCase();
}

function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

interface WalletFlow {
  bought: number;
  sold: number;
  firstIn: number | null;
  lastOut: number | null;
  buyCount: number;
  sellCount: number;
}

export async function analyzeTokenTemporal(
  tokenAddress: string
): Promise<TemporalTokenResult> {
  const address = tokenAddress.toLowerCase();
  const flags: string[] = [];
  const observations: string[] = [];
  let scoreDelta = 0;
  const exitParticipants: string[] = [];

  const [tokenInfo, holdersPage, transfersPage] = await Promise.all([
    arcscanGet<TokenInfo>(`/api/v2/tokens/${address}`),
    arcscanGet<HoldersPage>(`/api/v2/tokens/${address}/holders?limit=50`),
    arcscanGet<TransfersPage>(
      `/api/v2/tokens/${address}/transfers?limit=100&type=token_transfer`
    ),
  ]);

  const holders = holdersPage?.items ?? [];
  const transfers = (transfersPage?.items ?? [])
    .map((t) => {
      const ts = t.timestamp ? Date.parse(t.timestamp) : NaN;
      return {
        from: addrOf(t.from),
        to: addrOf(t.to),
        amount: parseAmount(t.total?.value ?? undefined),
        ts: Number.isFinite(ts) ? ts : 0,
      };
    })
    .filter((t) => t.from && t.to)
    .sort((a, b) => a.ts - b.ts);

  const holderCount = Math.max(
    holders.length,
    Number(tokenInfo?.holders ?? tokenInfo?.holders_count ?? 0) || 0
  );

  const balances = holders
    .map((h) => parseAmount(h.value ?? undefined))
    .filter((n) => n > 0);
  const totalBal = balances.reduce((a, b) => a + b, 0);
  const topHolderPct =
    totalBal > 0 && balances.length > 0
      ? (Math.max(...balances) / totalBal) * 100
      : 0;

  if (holderCount > 0 && holderCount < 15) {
    flags.push("LOW_HOLDER_QUALITY");
    observations.push("Very small holder base");
    scoreDelta -= 6;
  }
  if (topHolderPct >= 45) {
    flags.push("HOLDER_CONCENTRATION");
    observations.push("Supply heavily concentrated in top holders");
    scoreDelta -= 8;
  }

  // Per-wallet buy/sell flows for exit ratio and hold duration
  const flows = new Map<string, WalletFlow>();
  const ensure = (w: string): WalletFlow => {
    let f = flows.get(w);
    if (!f) {
      f = {
        bought: 0,
        sold: 0,
        firstIn: null,
        lastOut: null,
        buyCount: 0,
        sellCount: 0,
      };
      flows.set(w, f);
    }
    return f;
  };

  let buyVolumeSample = 0;
  let sellVolumeSample = 0;
  const firstTransferTs = transfers.length > 0 ? transfers[0].ts : 0;

  for (const t of transfers) {
    const amt = t.amount > 0 ? t.amount : 1;
    const toF = ensure(t.to);
    const fromF = ensure(t.from);
    toF.bought += amt;
    toF.buyCount += 1;
    if (toF.firstIn === null || t.ts < toF.firstIn) toF.firstIn = t.ts;
    fromF.sold += amt;
    fromF.sellCount += 1;
    if (fromF.lastOut === null || t.ts > fromF.lastOut) fromF.lastOut = t.ts;

    // After initial distribution window, classify volume
    if (firstTransferTs && t.ts >= firstTransferTs + DIST_PERIOD_MS) {
      // Heuristic: transfers from dense early holders toward new wallets = sells
      // We accumulate both legs; honeypot uses aggregate sell vs buy after dist
      buyVolumeSample += amt;
      sellVolumeSample += amt * 0.5; // refined below using unique patterns
    }
  }

  // Better buy/sell volume after distribution: first half of timeline ≈ dist,
  // second half measure direction from early holders
  const midTs =
    firstTransferTs && transfers.length
      ? firstTransferTs + DIST_PERIOD_MS
      : 0;
  let postDistBuy = 0;
  let postDistSell = 0;
  if (midTs) {
    const earlyRecipients = new Set<string>();
    for (const t of transfers) {
      if (t.ts < midTs) earlyRecipients.add(t.to);
    }
    for (const t of transfers) {
      if (t.ts < midTs) continue;
      const amt = t.amount > 0 ? t.amount : 1;
      if (earlyRecipients.has(t.from)) postDistSell += amt;
      if (!earlyRecipients.has(t.to) || earlyRecipients.has(t.from) === false) {
        postDistBuy += amt;
      }
      if (!earlyRecipients.has(t.to)) postDistBuy += amt * 0.25;
    }
  }
  buyVolumeSample = postDistBuy || buyVolumeSample;
  sellVolumeSample = postDistSell || sellVolumeSample;

  // Exit ratio: sold / bought per wallet
  const exitRatios: number[] = [];
  let majorityExitWalletCount = 0;
  const majorityExitEvents: Array<{ wallet: string; ts: number }> = [];

  for (const [wallet, f] of flows) {
    if (f.bought <= 0 || f.sold <= 0) continue;
    const ratio = Math.min(1, f.sold / f.bought);
    exitRatios.push(ratio);
    if (ratio * 100 >= EXIT_MAJORITY_PCT && f.lastOut != null) {
      majorityExitWalletCount += 1;
      majorityExitEvents.push({ wallet, ts: f.lastOut });
    }
  }

  const meanExitRatio =
    exitRatios.length > 0
      ? exitRatios.reduce((a, b) => a + b, 0) / exitRatios.length
      : null;

  if (
    meanExitRatio !== null &&
    meanExitRatio >= EXIT_MAJORITY_PCT / 100 &&
    exitRatios.length >= 4
  ) {
    observations.push(
      `High mean exit ratio (${Math.round(meanExitRatio * 100)}% of acquired tokens sold back)`
    );
    scoreDelta -= 8;
  }

  if (majorityExitWalletCount >= 4) {
    // Cluster majority exits in rolling window → pump/dump coordination
    majorityExitEvents.sort((a, b) => a.ts - b.ts);
    let best = 1;
    let bestRange: [number, number] = [0, 0];
    let j = 0;
    for (let i = 0; i < majorityExitEvents.length; i++) {
      while (
        majorityExitEvents[i].ts - majorityExitEvents[j].ts >
        EXIT_WINDOW_MS
      ) {
        j += 1;
      }
      const size = i - j + 1;
      if (size > best) {
        best = size;
        bestRange = [j, i];
      }
    }
    if (best >= 4) {
      flags.push("EXIT_SYNC");
      observations.push(
        "Multiple wallets sold majority positions in a synchronized window"
      );
      scoreDelta -= 12;
      for (let i = bestRange[0]; i <= bestRange[1]; i++) {
        exitParticipants.push(majorityExitEvents[i].wallet);
      }
    }
  }

  // Hold duration
  const holdHours: number[] = [];
  for (const f of flows.values()) {
    if (f.firstIn == null || f.lastOut == null || f.lastOut <= f.firstIn) {
      continue;
    }
    holdHours.push((f.lastOut - f.firstIn) / HOUR_MS);
  }
  holdHours.sort((a, b) => a - b);
  const medianHoldHours =
    holdHours.length > 0
      ? holdHours[Math.floor(holdHours.length / 2)]
      : null;
  const averageHoldHours =
    holdHours.length > 0
      ? holdHours.reduce((a, b) => a + b, 0) / holdHours.length
      : null;

  if (
    averageHoldHours !== null &&
    averageHoldHours < SHORT_HOLD_HOURS &&
    holdHours.length >= 5
  ) {
    observations.push(
      `Abnormally short average hold (${averageHoldHours.toFixed(1)}h)`
    );
    scoreDelta -= 7;
    if (!flags.includes("COORDINATED_BUY")) {
      // Short holds across many wallets often co-occur with pumps
      flags.push("COORDINATED_BUY");
    }
  } else if (medianHoldHours !== null && medianHoldHours >= 24 * 14) {
    observations.push("Median completed hold spans multiple weeks");
    scoreDelta += 3;
  }

  // Wash trading: bilateral pairs + same wallet rapid buy/sell
  const pairCounts = new Map<string, number>();
  let washWallets = 0;
  for (const t of transfers) {
    const a = t.from < t.to ? t.from : t.to;
    const b = t.from < t.to ? t.to : t.from;
    const key = `${a}|${b}`;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }
  let circularPairs = 0;
  for (const c of pairCounts.values()) {
    if (c >= 4) circularPairs += 1;
  }
  for (const f of flows.values()) {
    if (f.buyCount >= 3 && f.sellCount >= 3) washWallets += 1;
  }
  if (
    circularPairs >= 2 ||
    (transfers.length >= 20 && circularPairs >= 1) ||
    washWallets >= 3
  ) {
    flags.push("WASH_TRADING");
    observations.push("Circular or repeated buy/sell loops suggest wash activity");
    scoreDelta -= 10;
  }

  // Coordinated buy: many first receives in tight window
  const receiveTimes = [...flows.values()]
    .map((f) => f.firstIn)
    .filter((t): t is number => t != null)
    .sort((a, b) => a - b);
  if (receiveTimes.length >= 8) {
    let maxCluster = 1;
    let j = 0;
    for (let i = 0; i < receiveTimes.length; i++) {
      while (receiveTimes[i] - receiveTimes[j] > 2 * DAY_MS) j++;
      maxCluster = Math.max(maxCluster, i - j + 1);
    }
    if (maxCluster >= 8) {
      if (!flags.includes("COORDINATED_BUY")) flags.push("COORDINATED_BUY");
      observations.push("Cluster of first-time receivers in a short window");
      scoreDelta -= 7;
    }
  }

  // Honeypot: sell volume near zero vs buy after distribution
  const sellToBuyRatio =
    buyVolumeSample > 0 ? sellVolumeSample / buyVolumeSample : null;
  if (
    sellToBuyRatio !== null &&
    buyVolumeSample > 0 &&
    sellToBuyRatio <= HONEYPOT_SELL_BUY_RATIO &&
    transfers.length >= 10
  ) {
    flags.push("HONEYPOT_PATTERN");
    observations.push(
      "Sell volume near zero relative to buy volume after distribution"
    );
    scoreDelta -= 14;
  }

  // Also: wallets that buy but almost never can sell (sold << bought across many)
  if (
    meanExitRatio !== null &&
    meanExitRatio < 0.02 &&
    flows.size >= 10 &&
    transfers.length >= 15 &&
    !flags.includes("HONEYPOT_PATTERN")
  ) {
    // Could be strong holds OR honeypot — only flag if sell sample tiny
    if (sellVolumeSample < buyVolumeSample * HONEYPOT_SELL_BUY_RATIO) {
      flags.push("HONEYPOT_PATTERN");
      observations.push("Almost no sell-side flow after acquisition period");
      scoreDelta -= 12;
    }
  }

  const uniqueFlags = [...new Set(flags)];
  scoreDelta = Math.max(-25, Math.min(5, scoreDelta));

  return {
    flags: uniqueFlags,
    observations: observations.slice(0, 6),
    scoreDelta,
    exitParticipants: [...new Set(exitParticipants)],
    metrics: {
      holderCount,
      topHolderPct: Math.round(topHolderPct * 10) / 10,
      medianHoldHours:
        medianHoldHours === null
          ? null
          : Math.round(medianHoldHours * 10) / 10,
      averageHoldHours:
        averageHoldHours === null
          ? null
          : Math.round(averageHoldHours * 10) / 10,
      meanExitRatio:
        meanExitRatio === null
          ? null
          : Math.round(meanExitRatio * 1000) / 1000,
      majorityExitWalletCount,
      buyVolumeSample,
      sellVolumeSample,
      sellToBuyRatio:
        sellToBuyRatio === null
          ? null
          : Math.round(sellToBuyRatio * 1000) / 1000,
      transferSample: transfers.length,
      washPairCount: circularPairs,
    },
  };
}
