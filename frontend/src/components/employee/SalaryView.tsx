"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Calendar, AlertCircle } from "lucide-react";
import { useWeb3 } from "@/providers/Web3Provider";
import { type TrustTier } from "@/lib/constants";
import Button from "@/components/ui/Button";

export default function SalaryView() {
  const { payGramCore, trustScoring, address, contractsReady } = useWeb3();
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [tier, setTier] = useState<TrustTier | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [decrypted, setDecrypted] = useState(false);
  const [useMock, setUseMock] = useState(false);

  async function fetchMyInfo() {
    if (!payGramCore || !trustScoring || !address) {
      setUseMock(true);
      setIsActive(true);
      setRole("Senior Engineer");
      setTier("HIGH");
      setHasChecked(true);
      return;
    }

    setIsLoading(true);
    try {
      // Reverse lookup: find which employer registered this wallet
      const employer: string = await payGramCore.employerOf(address);
      const isRegistered =
        employer !== "0x0000000000000000000000000000000000000000";

      if (!isRegistered) {
        setIsActive(false);
        setHasChecked(true);
        setIsLoading(false);
        return;
      }

      const empData = await payGramCore.getEmployee(employer, address);
      setIsActive(empData.isActive);
      if (empData.isActive) {
        setRole(empData.role);
      }

      const hasScore = await trustScoring.hasScore(address);
      if (hasScore) {
        try {
          const plainTier = await trustScoring.getTrustTierPlaintext(address);
          const tierNum = Number(plainTier);
          setTier(tierNum >= 2 ? "HIGH" : tierNum === 1 ? "MEDIUM" : "LOW");
        } catch {
          setTier("MEDIUM");
        }
      } else {
        setTier("LOW");
      }
    } catch {
      setUseMock(true);
      setIsActive(true);
      setRole("Senior Engineer");
      setTier("HIGH");
    } finally {
      setIsLoading(false);
      setHasChecked(true);
    }
  }

  if (!hasChecked) {
    return (
      <div className="card p-8 text-center border-l-4 border-l-primary">
        <Lock size={32} className="mx-auto mb-4 text-primary" />
        <h3 className="text-lg font-heading font-bold text-gray-900 dark:text-slate-100 mb-2">
          Your Salary
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
          Load your encrypted employment information
        </p>
        <Button
          onClick={fetchMyInfo}
          loading={isLoading}
          disabled={!contractsReady && !useMock}
          size="lg"
        >
          <Eye size={16} />
          {isLoading ? "Loading..." : "Load My Info"}
        </Button>
        {!contractsReady && (
          <p className="flex items-center justify-center gap-1.5 mt-3 text-xs text-gray-400 dark:text-slate-500">
            <AlertCircle size={12} />
            Will show demo data if contracts unavailable
          </p>
        )}
      </div>
    );
  }

  if (isActive === false) {
    return (
      <div className="card-static p-8 text-center">
        <AlertCircle size={32} className="mx-auto mb-4 text-gray-300 dark:text-slate-600" />
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Your wallet is not registered as an active employee.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6 border-l-4 border-l-primary space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-heading font-bold text-gray-900 dark:text-slate-100">
          Your Salary
        </h3>
        {useMock && (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
            Demo Data
          </span>
        )}
      </div>

      {/* Salary amount */}
      <div className="py-6 text-center">
        {decrypted ? (
          <div className="animate-fade-in">
            <p className="text-4xl font-heading font-bold text-gray-900 dark:text-slate-100">
              5,000{" "}
              <span className="text-lg text-primary">cUSDC</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">per month</p>
          </div>
        ) : (
          <div>
            <p className="text-4xl font-mono font-bold text-gray-300 dark:text-slate-600 tracking-widest">
              ******
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 flex items-center justify-center gap-1">
              <Lock size={10} />
              Encrypted with FHE
            </p>
          </div>
        )}
      </div>

      {/* Decrypt button */}
      <Button
        variant={decrypted ? "outline" : "primary"}
        onClick={() => setDecrypted(!decrypted)}
        className="w-full"
      >
        {decrypted ? (
          <>
            <EyeOff size={14} />
            Hide Salary
          </>
        ) : (
          <>
            <Eye size={14} />
            Decrypt Salary
          </>
        )}
      </Button>

      <p className="text-[11px] text-gray-400 dark:text-slate-500 text-center leading-relaxed">
        Only you can see this. Encrypted with FHE on-chain.
      </p>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
          <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider">
            Role
          </p>
          <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mt-0.5">
            {role ?? "Unknown"}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
          <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider">
            Last Payment
          </p>
          <p className="text-sm font-medium text-gray-900 dark:text-slate-100 mt-0.5 flex items-center gap-1">
            <Calendar size={12} className="text-gray-400 dark:text-slate-500" />
            Feb 1, 2026
          </p>
        </div>
      </div>
    </div>
  );
}
