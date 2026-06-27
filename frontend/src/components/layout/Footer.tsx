import Image from "next/image";
import { EXPLORER_URL } from "@/lib/constants";

interface FooterLink {
  label: string;
  href: string | null;
  external?: boolean;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const COLUMNS: FooterColumn[] = [
  {
    title: "Network",
    links: [
      { label: "Arcscan", href: EXPLORER_URL, external: true },
      { label: "USDC Faucet", href: "https://faucet.circle.com", external: true },
      { label: "Chain ID 5042002", href: null },
    ],
  },
  {
    title: "Product",
    links: [
      { label: "Oracle", href: "/oracle" },
      { label: "Token Shield", href: "/token-shield" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Docs", href: "https://docs.trustgated.xyz", external: true },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "X", href: "https://x.com/TrustGated", external: true },
      { label: "Discord", href: "https://discord.gg/kbx9RAGCmx", external: true },
      { label: "TrustGate Sui", href: "https://sui.trustgated.xyz", external: true },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/logo.png"
                alt="TrustGate logo"
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
              />
              <span className="text-sm font-display font-semibold text-text">
                TrustGate
              </span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed max-w-[200px]">
              The trust layer for Web3
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-text-muted mb-4">
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href ? (
                      <a
                        href={link.href}
                        {...(link.external
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="text-xs text-text-muted hover:text-text transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <span className="text-xs text-text-muted font-mono">
                        {link.label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}