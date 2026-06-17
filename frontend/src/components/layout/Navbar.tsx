"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { ConnectKitButton } from "connectkit";
import { cn } from "@/lib/utils";

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
  // Longest matching prefix wins so /docs/widget-integration highlights
  // "Widget" instead of both "Widget" and "Docs".
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
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [moreOpen, setMoreOpen] = useState<boolean>(false);
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

  return (
    <nav className="nav-bar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <Image
              src="/logo.png"
              alt="TrustGate logo"
              width={36}
              height={36}
              priority
              className="h-9 w-9 rounded-xl object-contain transition-transform duration-200 group-hover:scale-105"
            />

            <div className="flex flex-col">
              <span className="text-sm font-display font-bold text-text leading-tight">
                TrustGate
              </span>
              <span className="text-[9px] text-text-muted leading-tight tracking-wider uppercase">
                Arc Testnet
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {PRIMARY_LINKS.map((link) => {
              const isActive = isActiveLink(link.href, pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                    isActive
                      ? "text-text"
                      : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-accent rounded-full" />
                  )}
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
                  "relative inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                  moreActive
                    ? "text-text"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                More
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={cn(
                    "transition-transform duration-200",
                    moreOpen && "rotate-180"
                  )}
                />
                {moreActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-accent rounded-full" />
                )}
              </button>

              {moreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-bg-surface shadow-lg py-1 animate-slide-down"
                >
                  {MORE_LINKS.map((link) => {
                    const isActive = isActiveLink(link.href, pathname);
                    const itemClass = cn(
                      "block mx-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "text-text bg-bg-hover"
                        : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
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
              className="md:hidden p-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-4 border-t border-border mt-2 pt-4 space-y-1 animate-slide-down">
            {ALL_LINKS.map((link) => {
              const isActive = isActiveLink(link.href, pathname);
              const itemClass = cn(
                "block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "text-text bg-bg-surface"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
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
            <div className="pt-3">
              <ConnectKitButton />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
