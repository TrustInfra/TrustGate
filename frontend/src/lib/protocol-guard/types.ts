export type AlertChannel = "discord" | "telegram" | "email" | "onchain_event";

export type GuardRuleType =
  | "lending_low_trust_borrow"
  | "dao_coordinated_vote"
  | "wallet_score_floor"
  | "token_flag_watch";

export interface ChannelConfig {
  discordWebhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  emailTo?: string;
  /** When true, also append to on-chain event log store */
  onchainEvent?: boolean;
}

export interface GuardRule {
  id: string;
  type: GuardRuleType;
  enabled: boolean;
  /** Minimum score required (inclusive) for allow; below triggers alert */
  minScore?: number;
  /** Minimum confidence 0-100 */
  minConfidence?: number;
  /** For DAO vote clustering */
  voteClusterThreshold?: number;
  /** Optional watched token */
  tokenAddress?: string;
}

export interface ProtocolSubscription {
  id: string;
  protocolName: string;
  contactEmail?: string;
  /**
   * Always free for protocol integrations.
   * Kept as 0 for API compatibility; never charged.
   */
  monthlyUsdc: number;
  /** Free tier is always active. cancelled only if protocol opts out. */
  status: "active" | "cancelled";
  /** Explicit free product flag */
  pricing: "free";
  channels: ChannelConfig;
  rules: GuardRule[];
  createdAt: string;
  updatedAt: string;
  lastAlertAt?: string;
  alertsSent: number;
}

export interface GuardAlert {
  id: string;
  subscriptionId: string;
  ruleType: GuardRuleType;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  subject?: string;
  score?: number;
  tier?: string;
  payload: Record<string, unknown>;
  channelsAttempted: AlertChannel[];
  delivered: AlertChannel[];
  createdAt: string;
}

export interface CheckRequest {
  /** Optional free registration id. Omit for anonymous free check. */
  subscriptionId?: string;
  /** wallet being checked */
  wallet: string;
  context:
    | "borrow"
    | "vote"
    | "generic"
    | "dex_swap"
    | "api_execution"
    | "treasury_control"
    | "governance_vote";
  /** proposed borrow amount / vote power / economic reach (USD proxy) */
  amount?: number;
  economicReachUsd?: number;
  capitalAccess?: number;
  minScore?: number;
  minConfidence?: number;
  voteClusterThreshold?: number;
  proposalId?: string;
  /** recent voters for coordination check */
  recentVoters?: string[];
}

export interface CheckResult {
  allowed: boolean;
  alerts: GuardAlert[];
  walletScore?: number;
  walletTier?: string;
  confidence?: number;
  flags?: string[];
  trustSurfaceArea?: {
    surfaceArea: number;
    priority: "monitor" | "review" | "immediate";
    factors: Record<string, number>;
  };
  contextualThreshold?: {
    action: string;
    minTier: string;
    minScore: number;
    minConfidence: number;
    description: string;
  };
  reasons: string[];
}
