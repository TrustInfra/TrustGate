import { envNumber } from "./env-number";

/**
 * Client IP for spend limits.
 * Prefer platform-owned headers. Never take the first X-Forwarded-For hop —
 * that value is attacker-controlled.
 */
export function resolveClientIp(headers: {
  get(name: string): string | null;
}): string {
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "unknown";
}

export interface RateSlot {
  ok: boolean;
  retryAfter: number;
}

export interface WindowCounter {
  take(): RateSlot;
  peek(): { count: number; resetAt: number };
}

export function createWindowCounter(
  windowMs: number,
  max: number
): WindowCounter {
  let count = 0;
  let resetAt = 0;
  return {
    take(): RateSlot {
      const now = Date.now();
      if (resetAt <= now) {
        count = 0;
        resetAt = now + windowMs;
      }
      if (count >= max) {
        return {
          ok: false,
          retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
        };
      }
      count += 1;
      return { ok: true, retryAfter: 0 };
    },
    peek() {
      return { count, resetAt };
    },
  };
}

export function createKeyedWindowCounter(windowMs: number, max: number) {
  const buckets = new Map<string, WindowCounter>();
  return {
    take(key: string): RateSlot {
      let c = buckets.get(key);
      if (!c) {
        c = createWindowCounter(windowMs, max);
        buckets.set(key, c);
      }
      return c.take();
    },
  };
}

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60_000;

export function widgetIpLimitPerMinute(): number {
  return Math.max(1, envNumber("WIDGET_IP_MAX_PER_MINUTE", 8));
}

export function widgetPaymentsPerHour(): number {
  return Math.max(1, envNumber("WIDGET_MAX_PAYMENTS_PER_HOUR", 40));
}

export function widgetPaymentsPerDay(): number {
  return Math.max(1, envNumber("WIDGET_MAX_PAYMENTS_PER_DAY", 200));
}

const ipLimiter = createKeyedWindowCounter(MINUTE_MS, widgetIpLimitPerMinute());
const hourPayments = createWindowCounter(HOUR_MS, widgetPaymentsPerHour());
const dayPayments = createWindowCounter(24 * HOUR_MS, widgetPaymentsPerDay());

export function takeWidgetIpSlot(ip: string): RateSlot {
  return ipLimiter.take(ip);
}

export class WidgetSpendLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super("widget_spend_limited");
    this.name = "WidgetSpendLimitError";
    this.retryAfter = retryAfter;
  }
}

/** Consume a hot-wallet payment slot. Call before broadcasting USDC. */
export function takeWidgetPaymentSlot(): RateSlot {
  const hour = hourPayments.take();
  if (!hour.ok) return hour;
  const day = dayPayments.take();
  if (!day.ok) return day;
  return { ok: true, retryAfter: 0 };
}

export function assertWidgetPaymentBudget(): void {
  const slot = takeWidgetPaymentSlot();
  if (!slot.ok) throw new WidgetSpendLimitError(slot.retryAfter);
}
