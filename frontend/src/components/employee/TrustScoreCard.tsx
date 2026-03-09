"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Clock, Lock, AlertCircle } from "lucide-react";
import { useWeb3 } from "@/providers/Web3Provider";
import TrustBadge from "@/components/ui/TrustBadge";
import Card from "@/components/ui/GlassCard";

type TierKey = "high" | "medium" | "low" | "unscored";

export default function TrustScoreCard() {
  const { trustScoring, payGramCore, address, contractsReady } = useWeb3();
  const [tier, setTier] = useState<TierKey | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchTrust = useCallback(async () => {
    if (!trustScoring || !payGramCore || !address) return;

    try {
      // Check if this wallet is a registered employee
      const employer: string = await payGramCore.employerOf(address);
      const isRegistered =
        employer !== "0x0000000000000000000000000000000000000000";

      if (!isRegistered) {
        setTier("unscored");
        setLoaded(true);
        return;
      }

      const hasScoreResult = await trustScoring.hasScore(address);
      if (!hasScoreResult) {
        setTier("unscored");
        setLoaded(true);
        return;
      }

      // Read plaintext tier
      try {
        const plainTier = await trustScoring.getTrustTierPlaintext(address);
        const tierNum = Number(plainTier);
        if (tierNum >= 2) {
          setTier("high");
          setScore(85); // approximate display — exact score is encrypted
        } else if (tierNum === 1) {
          setTier("medium");
          setScore(55);
        } else {
          setTier("low");
          setScore(25);
        }
      } catch {
        setTier("unscored");
      }
    } catch (err) {
      console.error("TrustScoreCard fetch error:", err);
      setTier(null);
    } finally {
      setLoaded(true);
    }
  }, [trustScoring, payGramCore, address]);

  useEffect(() => {
    if (contractsReady && trustScoring && address && !loaded) {
      fetchTrust();
    }
  }, [contractsReady, trustScoring, address, loaded, fetchTrust]);

  // Compute indicator position from score
  const indicatorPos = score !== null ? `${score}%` : "50%";

  return (
    <Card className="p-6 border-l-4 border-l-primary" hover={false}>
      <h3 className="text-sm font-heading font-bold text-gray-900 dark:text-slate-100 mb-4">
        Trust Score
      </h3>

      <div className="text-center py-4">
        {!loaded ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500">
            Loading...
          </span>
        ) : tier ? (
          <TrustBadge tier={tier} size="lg" />
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
            <AlertCircle size={14} />
            Unable to load
          </span>
        )}
      </div>

      {/* Score meter */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500">
          <span>0</span>
          <span>40</span>
          <span>75</span>
          <span>100</span>
        </div>
        <div className="relative h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-[40%] bg-red-200 rounded-l-full" />
          <div className="absolute inset-y-0 left-[40%] w-[35%] bg-amber-200" />
          <div className="absolute inset-y-0 left-[75%] w-[25%] bg-emerald-200 rounded-r-full" />
          {loaded && score !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-white shadow-md transition-all duration-500"
              style={{ left: indicatorPos }}
            />
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2 text-xs text-gray-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck size={12} className="text-emerald-600" />
          <span>75-100: Instant encrypted transfer</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-amber-600" />
          <span>40-74: 24-hour delayed release</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock size={12} className="text-red-600" />
          <span>0-39: Milestone-gated escrow</span>
        </div>
      </div>
    </Card>
  );
}
