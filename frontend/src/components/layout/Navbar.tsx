"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { ConnectKitButton } from "connectkit";
import { cn } from "@/lib/utils";
import StatusDot from "@/components/ui/StatusDot";

type NavLink = { href: string; label: string; external?: boolean };

const PRIMARY_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/oracle", label: "Oracle" },
  { href: "/token-shield", label: "Token Shield" },
];

const MORE_LINKS: NavLink[] = [
  { href: "https://docs.trustgated.xyz", label: "Docs", external: true },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/demo", label: "Demo" },
  { href: "/discovery", label: "Discovery" },
  { href: "/agents/live", label: "Live Agents" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/docs/widget-integration", label: "Widget" },
];

const ALL_LINKS: NavLink[] = [...PRIMARY_LINKS, ...MORE_LINKS];
const ALL_HREFS = ALL_LINKS.map((l) => l.href);

function isActiveLink(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (!pathname.startsWith(href)) return false;
  if (pathname !== href && pathname.charAt(href.length) !== "/") return false;
  for (const other of ALL_HREFS) {
    if (other === href || other === "/") continue;
    if (other.length <= href.length) continue;
    if (!pathname.startsWith(other)) continue;
    if (pathname !== other && pathname.charAt(other.length) !== "/") continue;
    return false;
  }
  return true;
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const moreRef = useRef<HTMLDivElement | null>(null);

  const moreActive = MORE_LINKS.some((link) =>
    isActiveLink(link.href, pathname)
  );

  useEffect(() => {
    if (!moreOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (moreRef.current && target && !moreRef.current.contains(target)) {
        setMoreOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [moreOpen]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const linkBase =
    "relative px-3 py-2 font-mono text-xs tracking-wide transition-colors duration-200";

  return (
    <nav className="nav-bar sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <Image
              src="/logo.png"
              alt="TrustGate logo"
              width={32}
              height={32}
              priority
              className="h-8 w-8 object-contain"
            />
            <div className="flex flex-col">
              <span className="text-sm font-display font-bold text-text leading-tight">
                TrustGate
              </span>
              <span className="flex items-center gap-1.5 text-[9px] font-mono text-text-muted leading-tight uppercase tracking-wider">
                <StatusDot status="active" />
                Live
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center">
            {PRIMARY_LINKS.map((link) => {
              const isActive = isActiveLink(link.href, pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    linkBase,
                    "border-l-2",
                    isActive
                      ? "border-accent text-text pl-3"
                      : "border-transparent text-text-muted hover:text-text-secondary"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            <div ref={moreRef} className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                className={cn(
                  linkBase,
                  "inline-flex items-center gap-1 border-l-2",
                  moreActive
                    ? "border-accent text-text pl-3"
                    : "border-transparent text-text-muted hover:text-text-secondary"
                )}
              >
                More
                <ChevronDown
                  size={12}
                  aria-hidden="true"
                  className={cn(
                    "transition-transform duration-200",
                    moreOpen && "rotate-180"
                  )}
                />
              </button>

              {moreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1 w-44 border border-border bg-bg-raised py-1 animate-slide-down"
                >
                  {MORE_LINKS.map((link) => {
                    const isActive = isActiveLink(link.href, pathname);
                    const itemClass = cn(
                      "block mx-1 px-3 py-2 font-mono text-xs transition-colors",
                      isActive
                        ? "text-text bg-bg-hover border-l-2 border-accent"
                        : "text-text-muted hover:text-text-secondary hover:bg-bg-hover border-l-2 border-transparent"
                    );
                    if (link.external) {
                      return (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          role="menuitem"
                          onClick={() => setMoreOpen(false)}
                          className={itemClass}
                        >
                          {link.label}
                        </a>
                      );
                    }
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        role="menuitem"
                        onClick={() => setMoreOpen(false)}
                        className={itemClass}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <ConnectKitButton />
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-4 border-t border-border pt-3 space-y-0.5 animate-slide-down">
            {ALL_LINKS.map((link) => {
              const isActive = isActiveLink(link.href, pathname);
              const itemClass = cn(
                "block px-3 py-2.5 font-mono text-xs transition-colors border-l-2",
                isActive
                  ? "text-text bg-bg-surface border-accent"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-hover border-transparent"
              );
              if (link.external) {
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className={itemClass}
                  >
                    {link.label}
                  </a>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={itemClass}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-3 px-1">
              <ConnectKitButton />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}