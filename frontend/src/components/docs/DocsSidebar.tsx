"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Workflow,
  ShieldCheck,
  FileCode2,
  Cable,
  LayoutDashboard,
  Boxes,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const DOC_SECTIONS = [
  { href: "/docs", label: "Overview", icon: BookOpen },
  { href: "/docs/how-it-works", label: "How It Works", icon: Workflow },
  { href: "/docs/trust-scoring", label: "Trust Scoring", icon: ShieldCheck },
  { href: "/docs/contracts", label: "Contracts", icon: FileCode2 },
  { href: "/docs/api-reference", label: "API Reference", icon: Cable },
  { href: "/docs/dashboard-guide", label: "Dashboard Guide", icon: LayoutDashboard },
  { href: "/docs/integration", label: "Integration", icon: Boxes },
  { href: "/docs/local-setup", label: "Local Setup", icon: Terminal },
] as const;

export default function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:block w-60 shrink-0 sticky top-16 self-start h-[calc(100vh-4rem)] overflow-y-auto py-10 pr-4 border-r border-border">
      <p className="px-3 mb-3 text-[10px] font-mono uppercase tracking-wider text-text-muted">
        Documentation
      </p>
      <nav className="flex flex-col gap-0.5">
        {DOC_SECTIONS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/docs" ? pathname === "/docs" : pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                isActive
                  ? "bg-bg-surface text-text"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-surface/50"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-accent" />
              )}
              <Icon size={14} className={cn(isActive ? "text-accent" : "")} />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
