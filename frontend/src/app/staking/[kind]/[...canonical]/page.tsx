"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StakePanel from "@/components/stake/StakePanel";
import { isSubjectKind } from "@/lib/stake/kinds";

export default function StakeSubjectPage() {
  const params = useParams<{ kind: string; canonical: string[] }>();
  const kind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const canonical = (params.canonical ?? []).join("/");

  const query = useMemo(() => {
    if (kind === "x") return `https://x.com/${canonical}`;
    if (kind === "github") return `https://github.com/${canonical}`;
    if (kind === "telegram") return `https://t.me/${canonical}`;
    if (kind === "website" || kind === "uri") return canonical;
    if (kind === "wallet" || kind === "token") {
      const addr = canonical.split(":").pop() ?? canonical;
      return addr;
    }
    return canonical;
  }, [kind, canonical]);

  return (
    <main className="min-h-screen bg-background text-text">
      <div className="mx-auto max-w-4xl px-5 py-16">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          <Link href="/staking" className="hover:text-text">
            Stake
          </Link>
          {" / "}
          {kind}
        </p>
        <h1 className="text-3xl font-semibold tracking-wide break-all">
          {canonical}
        </h1>
        <div className="mt-8">
          <StakePanel
            initialQuery={query}
            initialKind={isSubjectKind(kind) ? kind : undefined}
          />
        </div>
      </div>
    </main>
  );
}
