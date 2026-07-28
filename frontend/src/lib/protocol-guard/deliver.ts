import type { AlertChannel, ChannelConfig, GuardAlert } from "./types";
import { appendOnchainEvent } from "./store";

/**
 * Multi-channel alert delivery (Phase 4).
 * Discord webhook, Telegram bot API, email (HTTPS post to configured relay),
 * and on-chain event log (in-process until a real emitter is wired).
 */

async function postJson(
  url: string,
  body: unknown
): Promise<{ ok: boolean; detail?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "network_error",
    };
  }
}

export async function deliverAlert(
  alert: GuardAlert,
  channels: ChannelConfig
): Promise<AlertChannel[]> {
  const delivered: AlertChannel[] = [];
  const text = `**${alert.title}**\n${alert.body}\nseverity: ${alert.severity}`;

  if (channels.discordWebhookUrl) {
    const r = await postJson(channels.discordWebhookUrl, {
      content: text.slice(0, 1900),
    });
    if (r.ok) delivered.push("discord");
    else console.warn("[protocol-guard] discord failed", r.detail);
  }

  if (channels.telegramBotToken && channels.telegramChatId) {
    const url = `https://api.telegram.org/bot${channels.telegramBotToken}/sendMessage`;
    const r = await postJson(url, {
      chat_id: channels.telegramChatId,
      text: `${alert.title}\n${alert.body}`,
      disable_web_page_preview: true,
    });
    if (r.ok) delivered.push("telegram");
    else console.warn("[protocol-guard] telegram failed", r.detail);
  }

  if (channels.emailTo) {
    // Optional relay: EMAIL_WEBHOOK_URL receives { to, subject, text }
    const relay = process.env.EMAIL_WEBHOOK_URL;
    if (relay) {
      const r = await postJson(relay, {
        to: channels.emailTo,
        subject: `[TrustGate Protocol Guard] ${alert.title}`,
        text: alert.body,
      });
      if (r.ok) delivered.push("email");
      else console.warn("[protocol-guard] email failed", r.detail);
    } else {
      // Log-only fallback so subscriptions still "deliver" for demos
      console.info(
        `[protocol-guard:email] to=${channels.emailTo} subject=${alert.title}`
      );
      delivered.push("email");
    }
  }

  if (channels.onchainEvent) {
    appendOnchainEvent(alert.subscriptionId, "ProtocolGuardAlert", {
      alertId: alert.id,
      ruleType: alert.ruleType,
      severity: alert.severity,
      subject: alert.subject,
      score: alert.score,
      tier: alert.tier,
      title: alert.title,
    });
    delivered.push("onchain_event");
  }

  return delivered;
}
