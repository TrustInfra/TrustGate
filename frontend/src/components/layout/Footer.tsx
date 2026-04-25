import Image from "next/image";
import { EXPLORER_URL } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="TrustGate logo"
              width={24}
              height={24}
              className="h-6 w-6 rounded-md object-contain"
            />

            <span className="text-sm font-display font-semibold text-text">
              TrustGate
            </span>
            <span className="text-xs text-text-muted">
              Trust-gated USDC for AI agents
            </span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-text-muted hover:text-text transition-colors"
            >
              Arcscan
            </a>
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-text-muted hover:text-text transition-colors"
            >
              USDC Faucet
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}