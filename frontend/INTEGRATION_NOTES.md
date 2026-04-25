# Frontend integration notes

The following two changes need to be made manually since I don't have the
exact existing component code. Both are tiny.

## 1. Navbar — add Oracle and Live Agents links

Find your existing nav component (likely `frontend/src/components/Navbar.tsx`
or similar — wherever the existing top-level links live). Add two entries:

```tsx
<Link href="/oracle" className="hover:text-emerald-400 transition">
  Oracle
</Link>
<Link href="/agents/live" className="hover:text-emerald-400 transition">
  Live Agents
</Link>
```

Match the styling of your existing links — the `className` above is just a
placeholder.

## 2. Homepage stats — three new tiles

On your homepage stats section, add tiles for the three live counters. Use
this client component to keep it simple (drop it in
`frontend/src/components/LiveTrustGateStats.tsx`):

```tsx
'use client';

import { useEffect, useState } from 'react';

const ORACLE_BASE =
  process.env.NEXT_PUBLIC_ORACLE_URL || 'https://trustgate-oracle.up.railway.app';

export default function LiveTrustGateStats() {
  const [oracleQueries, setOracleQueries] = useState<number | null>(null);
  const [autonomousTxs, setAutonomousTxs] = useState<number | null>(null);
  const [usdcMoved, setUsdcMoved] = useState<string | null>(null);

  useEffect(() => {
    const tick = async () => {
      try {
        const [statsRes, statusRes] = await Promise.all([
          fetch(`${ORACLE_BASE}/oracle/stats`, { cache: 'no-store' }),
          fetch('/api/agent-status', { cache: 'no-store' }),
        ]);
        if (statsRes.ok) {
          const s = await statsRes.json();
          setOracleQueries(s.totalQueries);
        }
        if (statusRes.ok) {
          const s = await statusRes.json();
          setAutonomousTxs(s.totalClaims);
          setUsdcMoved(s.totalUsdcMoved);
        }
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Tile label="Oracle queries served" value={oracleQueries ?? '—'} />
      <Tile label="Autonomous transactions" value={autonomousTxs ?? '—'} />
      <Tile label="Total USDC moved" value={usdcMoved ?? '—'} />
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
```

Then drop `<LiveTrustGateStats />` into your homepage stats section.

## 3. Vercel env var

Add to the existing TrustGate frontend Vercel project (Settings → Environment
Variables):

```
NEXT_PUBLIC_ORACLE_URL=https://trustgate-oracle.up.railway.app
```

Replace with your actual Railway URL once the oracle is deployed.
