"use client";

import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Lock, Calendar, AlertCircle, RefreshCw } from "lucide-react";
import { useWeb3 } from "@/providers/Web3Provider";
import { type TrustTier } from "@/lib/constants";
import { formatTimestamp } from "@/lib/contracts";
import Button from "@/components/ui/Button";

export default function SalaryView() {
  const { payGramCore, trustScoring, address, contractsReady } = useWeb3();
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [tier, setTier] = useState<TrustTier | null>(null);
  const [salary, setSalary] = useState<string | null>(null);
  const [lastPayDate, setLastPayDate] = useState<string>("Never");
  const [hasChecked, setHasChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [decrypted, setDecrypted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMyInfo = useCallback(async () => {
    if (!payGramCore || !trustScoring || !address) return;

    setIsLoading(true);
    setError(null);
    try {
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
        setLastPayDate(formatTimestamp(empData.lastPayDate));
        try {
          const rawSalary: bigint = await payGramCore.getPlaintextSalary(
            employer,
            address
          );
          if (rawSalary > 0n) {
            setSalary(Number(rawSalary).toLocaleString());
          } else {
            setSalary("Encrypted");
          }
        } catch {
          setSalary("Encrypted");
        }
      }

      const hasScore = await trustScoring.hasScore(address);
      if (hasScore) {
        try {
          const plainTier = await trustScoring.getTrustTierPlaintext(address);
          const tierNum = Number(plainTier);
          setTier(tierNum >= 2 ? "HIGH" : tierNum === 1 ? "MEDIUM" : "LOW");
        } catch {
          setTier(null);
        }
      } else {
        setTier("LOW");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("SalaryView fetch error:", msg);
      setError(msg.length > 120 ? msg.slice(0, 120) + "..." : msg);
    } finally {
      setIsLoading(false);
      setHasChecked(true);
    }
  }, [payGramCore, trustScoring, address]);

  // Auto-fetch when contracts and wallet are ready
  useEffect(() => {
    if (contractsReady && payGramCore && trustScoring && address && !hasChecked) {
      fetchMyInfo();
    }
  }, [contractsReady, payGramCore, trustScoring, address, hasChecked, fetchMyInfo]);

  // Not connected or contracts not ready yet
  if (!contractsReady || !address) {
    return (
      <div className="card p-8 text-center border-l-4 border-l-primary">
        <Lock size={32} className="mx-auto mb-4 text-primary" />
        <h3 className="text-lg font-heading font-bold text-gray-900 dark:text-slate-100 mb-2">
          Your Salary
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
          Connect your wallet on Sepolia to view your salary
        </p>
        <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
          <AlertCircle size={12} />
          Waiting for wallet connection
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading || !hasChecked) {
    return (
      <div className="card p-8 text-center border-l-4 border-l-primary">
        <Lock size={32} className="mx-auto mb-4 text-primary animate-pulse" />
        <h3 className="text-lg font-heading font-bold text-gray-900 dark:text-slate-100 mb-2">
          Your Salary
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Loading your on-chain employment data...
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="card p-8 text-center border-l-4 border-l-red-400">
        <AlertCircle size={32} className="mx-auto mb-4 text-red-400" />
        <h3 className="text-lg font-heading font-bold text-gray-900 dark:text-slate-100 mb-2">
          Failed to Load
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
          {error}
        </p>
        <Button onClick={fetchMyInfo} size="sm">
          <RefreshCw size={14} />
          Retry
        </Button>
      </div>
    );
  }

  // Not registered
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
        <button
          type="button"
          onClick={fetchMyInfo}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Salary amount */}
      <div className="py-6 text-center">
        {decrypted ? (
          <div className="animate-fade-in">
            <p className="text-4xl font-heading font-bold text-gray-900 dark:text-slate-100">
              {salary ?? "---"}{" "}
              <span className="text-lg text-primary">cPAY</span>
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
            {lastPayDate}
          </p>
        </div>
      </div>
    </div>
  );
}
