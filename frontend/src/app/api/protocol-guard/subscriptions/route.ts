import { NextRequest, NextResponse } from "next/server";
import {
  getSubscription,
  listAlerts,
  listOnchainEvents,
  listSubscriptions,
  updateSubscription,
} from "@/lib/protocol-guard/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function publicSubscription(
  sub: NonNullable<ReturnType<typeof getSubscription>>,
  includeManageToken = false
) {
  const { manageToken, ...rest } = sub;
  return {
    ...rest,
    channels: {
      hasDiscord: Boolean(sub.channels.discordWebhookUrl),
      hasTelegram: Boolean(sub.channels.telegramBotToken),
      hasEmail: Boolean(sub.channels.emailTo),
      onchainEvent: Boolean(sub.channels.onchainEvent),
    },
    ...(includeManageToken ? { manageToken } : {}),
  };
}

function readManageToken(req: NextRequest, bodyToken?: string): string {
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  return (bodyToken || bearer || req.nextUrl.searchParams.get("token") || "").trim();
}

/** GET /api/protocol-guard/subscriptions?id=sub_... */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const sub = getSubscription(id);
    if (!sub) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const token = readManageToken(req);
    if (!sub.manageToken || token !== sub.manageToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      {
        subscription: publicSubscription(sub),
        recentAlerts: listAlerts(id, 20),
        onchainEvents: listOnchainEvents(id, 20),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // List is intentionally thin (ids + names) — no channel secrets dump
  const subs = listSubscriptions().map((s) => ({
    id: s.id,
    protocolName: s.protocolName,
    status: s.status,
    pricing: s.pricing ?? "free",
    monthlyUsdc: 0,
    alertsSent: s.alertsSent,
    lastAlertAt: s.lastAlertAt,
    createdAt: s.createdAt,
  }));
  return NextResponse.json(
    {
      count: subs.length,
      subscriptions: subs,
      pricing: "free",
      note: "Protocol Guard registrations are free. No subscription fee.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** PATCH /api/protocol-guard/subscriptions — update channels / rules / status */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as {
    id?: string;
    manageToken?: string;
    protocolName?: string;
    contactEmail?: string;
    status?: "active" | "cancelled";
    channels?: Parameters<typeof updateSubscription>[1]["channels"];
    rules?: Parameters<typeof updateSubscription>[1]["rules"];
  };
  if (!b.id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }
  const existing = getSubscription(b.id);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const token = readManageToken(req, b.manageToken);
  if (!existing.manageToken || token !== existing.manageToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const updated = updateSubscription(b.id, {
    protocolName: b.protocolName,
    contactEmail: b.contactEmail,
    status: b.status,
    channels: b.channels,
    rules: b.rules,
  });
  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(
    { subscription: publicSubscription(updated) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
