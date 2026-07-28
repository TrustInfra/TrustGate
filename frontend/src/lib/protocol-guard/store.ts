import { randomBytes } from "crypto";
import { getStore, storeValues } from "@/lib/store/memory-store";
import type {
  GuardAlert,
  GuardRule,
  ProtocolSubscription,
  ChannelConfig,
} from "./types";

const SUB_NS = "protocol-guard-subs";
const ALERT_NS = "protocol-guard-alerts";
const EVENT_NS = "protocol-guard-onchain-events";

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

const DEFAULT_RULES: GuardRule[] = [
  {
    id: "rule_lending",
    type: "lending_low_trust_borrow",
    enabled: true,
    minScore: 40,
    minConfidence: 40,
  },
  {
    id: "rule_dao_vote",
    type: "dao_coordinated_vote",
    enabled: true,
    minScore: 30,
    voteClusterThreshold: 5,
  },
  {
    id: "rule_floor",
    type: "wallet_score_floor",
    enabled: true,
    minScore: 25,
  },
];

/** Free protocol registration — channels + rules only, never billed. */
export function createSubscription(input: {
  protocolName: string;
  contactEmail?: string;
  monthlyUsdc?: number; // ignored; always free
  channels?: ChannelConfig;
  rules?: GuardRule[];
}): ProtocolSubscription {
  const now = new Date().toISOString();
  const sub: ProtocolSubscription = {
    id: id("sub"),
    protocolName: input.protocolName.trim().slice(0, 80),
    contactEmail: input.contactEmail?.trim().slice(0, 120),
    monthlyUsdc: 0,
    status: "active",
    pricing: "free",
    channels: input.channels ?? {},
    rules: input.rules ?? DEFAULT_RULES.map((r) => ({ ...r, id: id("rule") })),
    createdAt: now,
    updatedAt: now,
    alertsSent: 0,
  };
  getStore<ProtocolSubscription>(SUB_NS).set(sub.id, sub);
  return sub;
}

/** Ephemeral free config for one-off checks without registration. */
export function freeAnonymousConfig(protocolName = "anonymous-protocol"): ProtocolSubscription {
  return {
    id: "free_anon",
    protocolName,
    monthlyUsdc: 0,
    status: "active",
    pricing: "free",
    channels: { onchainEvent: true },
    rules: DEFAULT_RULES.map((r) => ({ ...r })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    alertsSent: 0,
  };
}

export function getSubscription(id: string): ProtocolSubscription | null {
  return getStore<ProtocolSubscription>(SUB_NS).get(id) ?? null;
}

export function listSubscriptions(): ProtocolSubscription[] {
  return storeValues<ProtocolSubscription>(SUB_NS);
}

export function updateSubscription(
  id: string,
  patch: Partial<
    Pick<
      ProtocolSubscription,
      "protocolName" | "contactEmail" | "status" | "channels" | "rules"
    >
  >
): ProtocolSubscription | null {
  const store = getStore<ProtocolSubscription>(SUB_NS);
  const existing = store.get(id);
  if (!existing) return null;
  const next: ProtocolSubscription = {
    ...existing,
    ...patch,
    // Never reintroduce paid pricing
    monthlyUsdc: 0,
    pricing: "free",
    updatedAt: new Date().toISOString(),
  };
  store.set(id, next);
  return next;
}

export function saveAlert(alert: GuardAlert): void {
  getStore<GuardAlert>(ALERT_NS).set(alert.id, alert);
  const sub = getSubscription(alert.subscriptionId);
  if (sub) {
    sub.alertsSent += 1;
    sub.lastAlertAt = alert.createdAt;
    sub.updatedAt = alert.createdAt;
    getStore<ProtocolSubscription>(SUB_NS).set(sub.id, sub);
  }
}

export function listAlerts(subscriptionId?: string, limit = 50): GuardAlert[] {
  const all = storeValues<GuardAlert>(ALERT_NS).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
  const filtered = subscriptionId
    ? all.filter((a) => a.subscriptionId === subscriptionId)
    : all;
  return filtered.slice(0, limit);
}

export function newAlertId(): string {
  return id("alert");
}

export interface OnchainEventLog {
  id: string;
  subscriptionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export function appendOnchainEvent(
  subscriptionId: string,
  eventType: string,
  payload: Record<string, unknown>
): OnchainEventLog {
  const ev: OnchainEventLog = {
    id: id("evt"),
    subscriptionId,
    eventType,
    payload,
    createdAt: new Date().toISOString(),
  };
  getStore<OnchainEventLog>(EVENT_NS).set(ev.id, ev);
  return ev;
}

export function listOnchainEvents(subscriptionId?: string, limit = 50): OnchainEventLog[] {
  const all = storeValues<OnchainEventLog>(EVENT_NS).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
  return (subscriptionId
    ? all.filter((e) => e.subscriptionId === subscriptionId)
    : all
  ).slice(0, limit);
}
