"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Menu, X } from "lucide-react";
import { ConnectKitButton } from "connectkit";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/demo", label: "Demo" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="nav-bar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <Shield
              size={22}
              className="text-accent transition-colors group-hover:text-accent-hover"
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
            {NAV_LINKS.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
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
            {NAV_LINKS.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "text-text bg-bg-surface"
                      : "text-text-muted hover:text-text-secondary hover:bg-bg-hover"
                  )}
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
