"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_SECTIONS } from "./DocsSidebar";
import { cn } from "@/lib/utils";

interface DocShellProps {
  title: string;
  eyebrow: string;
  lede: string;
  children: React.ReactNode;
}

export default function DocShell({ title, eyebrow, lede, children }: DocShellProps) {
  const pathname = usePathname();
  const idx = DOC_SECTIONS.findIndex((s) => s.href === pathname);
  const prev = idx > 0 ? DOC_SECTIONS[idx - 1] : null;
  const next = idx >= 0 && idx < DOC_SECTIONS.length - 1 ? DOC_SECTIONS[idx + 1] : null;

  return (
    <article className="max-w-2xl">
      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-wider text-accent mb-3">
          {eyebrow}
        </p>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-text">
          {title}
        </h1>
        <p className="mt-4 text-base text-text-secondary leading-relaxed">
          {lede}
        </p>
      </header>

      <div className="docs-prose">{children}</div>

      <nav className="mt-16 pt-6 border-t border-border flex items-center justify-between gap-4">
        {prev ? (
          <Link
            href={prev.href}
            className={cn(
              "group flex-1 card p-4 flex flex-col gap-0.5",
              "hover:border-border-hover"
            )}
          >
            <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-text-muted">
              <ArrowLeft size={10} /> Previous
            </span>
            <span className="text-sm text-text font-medium">{prev.label}</span>
          </Link>
        ) : (
          <span className="flex-1" />
        )}

        {next ? (
          <Link
            href={next.href}
            className={cn(
              "group flex-1 card p-4 flex flex-col gap-0.5 text-right",
              "hover:border-border-hover"
            )}
          >
            <span className="flex items-center justify-end gap-1.5 text-[10px] font-mono uppercase tracking-wider text-text-muted">
              Next <ArrowRight size={10} />
            </span>
            <span className="text-sm text-text font-medium">{next.label}</span>
          </Link>
        ) : (
          <span className="flex-1" />
        )}
      </nav>
    </article>
  );
}
