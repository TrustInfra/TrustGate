// Trust signal types for Phase 2b batch token discovery.
//
// This mirrors the batch oracle response shape agreed with Nald.
// The wire format is owned by the oracle. This file is the frontend's
// single view of it: if a field name changes on Nald's side, change it
// here once and every component stays in sync.

export type Tier = "BLOCKED" | "LOW" | "MEDIUM" | "HIGH" | "ELITE" | "VERIFIED";

export type TokenState = "graduated" | "mining";

// Flag codes the oracle can return. The known ones get rendered with
// plain language in the display layer. The string fallback means an
// unrecognized flag never breaks the UI, it just shows raw until we
// add a label for it.
export type KnownFlag =
  | "HONEYPOT_PATTERN"
  | "COORDINATED_BUY"
  | "EXIT_SYNC"
  | "LOW_HOLDER_QUALITY";

// eslint-disable-next-line @typescript-eslint/ban-types
export type FlagCode = KnownFlag | (string & {});

// Confidence may arrive as a label ("low") or a number (0-100).
// Kept tolerant so a shape tweak on Nald's side stays non-breaking.
export type Confidence = string | number;

export interface BatchScore {
  address: string;
  score: number;
  tier: Tier;
  confidence: Confidence;
  flags: FlagCode[];
  state: TokenState;
  // Present only when the oracle could not score this address as a token
  // (for example it is a wallet, not a token). When set, the frontend
  // skips or marks the entry instead of rendering a token badge.
  error?: string;
}
