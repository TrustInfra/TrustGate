import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { scoreAddress } from './scoring';
import { paymentRequirement, verifyPayment } from './payment';
import { recordQuery, publicStats } from './stats';
import { lookup as tokenLookup, startBackgroundRefresher } from './token-cache';

const PORT = Number(process.env.PORT || 3001);
const QUERY_PRICE = '0.001';
const BATCH_PRICE_PER_ADDRESS = 0.001;
const MAX_BATCH = 10;

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '64kb' }));

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate limit exceeded', limit: '100 requests per hour per IP' },
});
app.use(limiter);

// request logger
app.use((req, _res, next) => {
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      method: req.method,
      path: req.path,
      ip: req.ip,
    })
  );
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', version: '1.0.0', network: 'Arc Testnet' });
});

app.get('/oracle/stats', (_req: Request, res: Response) => {
  res.json(publicStats());
});

// Reads agent-status.json written by the agent-loop worker. Both services
// should have the same Railway volume mounted at /data so this is shared
// state. Falls back to local cwd file for dev.
app.get('/agent-status', (_req: Request, res: Response) => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const candidates = [
    process.env.STATUS_FILE,
    '/data/agent-status.json',
    path.join(process.cwd(), 'agent-status.json'),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        return res.json(JSON.parse(raw));
      }
    } catch {
      /* try next */
    }
  }
  return res.json({
    running: false,
    lastCycleAt: null,
    cycleCount: 0,
    cycleIntervalMs: 30000,
    threshold: 75,
    totalClaims: 0,
    totalUsdcMoved: '0',
    agents: [],
  });
});

function isHexAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

const TOKEN_PRICE = '0.001';

app.get('/oracle/token/:address', async (req: Request, res: Response) => {
  const { address } = req.params;
  if (!isHexAddress(address)) {
    return res.status(400).json({ error: 'invalid address' });
  }

  const paymentHeader = req.header('x-payment') || req.header('X-Payment');

  if (!paymentHeader) {
    return res.status(402).json({
      error: 'Payment required',
      ...paymentRequirement(TOKEN_PRICE, 'TrustGate Token Oracle query fee'),
    });
  }

  const payment = await verifyPayment(paymentHeader, TOKEN_PRICE);
  if (!payment.ok) {
    return res.status(402).json({
      error: 'Payment verification failed',
      reason: payment.reason,
      ...paymentRequirement(TOKEN_PRICE, 'TrustGate Token Oracle query fee'),
    });
  }

  try {
    const result = tokenLookup(address);
    if (result.kind === 'pending') {
      return res.status(202).json({ status: 'pending' });
    }
    // Public response intentionally limited to score and tier.
    // address/trend/timestamps are kept internally for cache management
    // but are not part of the public API surface.
    return res.json({
      score: result.data.score,
      tier: result.data.tier,
    });
  } catch (err) {
    console.error('[oracle] token scoring failed:', (err as Error).message);
    return res.status(500).json({ error: 'token scoring failed', detail: (err as Error).message });
  }
});

app.get('/oracle/:address', async (req: Request, res: Response) => {
  const { address } = req.params;
  if (!isHexAddress(address)) {
    return res.status(400).json({ error: 'invalid address' });
  }

  const paymentHeader = req.header('x-payment') || req.header('X-Payment');

  if (!paymentHeader) {
    return res.status(402).json({
      error: 'Payment required',
      ...paymentRequirement(QUERY_PRICE, 'TrustGate Oracle query fee'),
    });
  }

  const payment = await verifyPayment(paymentHeader, QUERY_PRICE);
  if (!payment.ok) {
    return res.status(402).json({
      error: 'Payment verification failed',
      reason: payment.reason,
      ...paymentRequirement(QUERY_PRICE, 'TrustGate Oracle query fee'),
    });
  }

  try {
    const result = await scoreAddress(address);
    recordQuery({
      address,
      score: result.score,
      tier: result.tier,
      paid: true,
      amountUsdc: payment.amountUsdc,
    });
    return res.json(result);
  } catch (err) {
    console.error('[oracle] scoring failed:', (err as Error).message);
    return res.status(500).json({ error: 'scoring failed', detail: (err as Error).message });
  }
});

app.post('/oracle/batch', async (req: Request, res: Response) => {
  const body = req.body as { addresses?: unknown };
  const addresses = Array.isArray(body.addresses) ? body.addresses : null;

  if (!addresses || addresses.length === 0) {
    return res.status(400).json({ error: 'addresses array required' });
  }
  if (addresses.length > MAX_BATCH) {
    return res.status(400).json({ error: `max ${MAX_BATCH} addresses per batch` });
  }
  for (const a of addresses) {
    if (typeof a !== 'string' || !isHexAddress(a)) {
      return res.status(400).json({ error: `invalid address: ${a}` });
    }
  }

  const expectedAmount = (BATCH_PRICE_PER_ADDRESS * addresses.length).toFixed(6);
  const paymentHeader = req.header('x-payment') || req.header('X-Payment');

  if (!paymentHeader) {
    return res.status(402).json({
      error: 'Payment required',
      ...paymentRequirement(expectedAmount, `TrustGate Oracle batch query (${addresses.length} addrs)`),
    });
  }

  const payment = await verifyPayment(paymentHeader, expectedAmount);
  if (!payment.ok) {
    return res.status(402).json({
      error: 'Payment verification failed',
      reason: payment.reason,
      ...paymentRequirement(expectedAmount, `TrustGate Oracle batch query (${addresses.length} addrs)`),
    });
  }

  try {
    const results = await Promise.all(
      (addresses as string[]).map(async (addr) => {
        try {
          const r = await scoreAddress(addr);
          recordQuery({
            address: addr,
            score: r.score,
            tier: r.tier,
            paid: true,
            amountUsdc: BATCH_PRICE_PER_ADDRESS,
          });
          return r;
        } catch (err) {
          return { address: addr, error: (err as Error).message };
        }
      })
    );
    return res.json({ count: results.length, results });
  } catch (err) {
    return res.status(500).json({ error: 'batch scoring failed', detail: (err as Error).message });
  }
});

// 404 + error handler — never crash, always return JSON
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'not found' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[oracle] unhandled:', err.message);
  res.status(500).json({ error: 'internal error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('[oracle] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[oracle] uncaughtException:', err.message);
});

app.listen(PORT, () => {
  console.log(`[oracle] TrustGate Oracle v1 listening on :${PORT}`);
  console.log(`[oracle] price per query: ${QUERY_PRICE} USDC`);
  startBackgroundRefresher();
});
