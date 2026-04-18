"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { Wallet, Bot, FileText, Shield } from "lucide-react";
import Tabs from "@/components/ui/Tabs";
import DepositorPanel from "@/components/dashboard/DepositorPanel";
import AgentPanel from "@/components/dashboard/AgentPanel";
import ClaimsPanel from "@/components/dashboard/ClaimsPanel";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "depositor", label: "Depositor", icon: <Wallet size={16} /> },
  { id: "agents", label: "Agents", icon: <Bot size={16} /> },
  { id: "claims", label: "Claims", icon: <FileText size={16} /> },
];

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const [activeTab, setActiveTab] = useState("depositor");

  if (!isConnected) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-muted flex items-center justify-center mx-auto mb-6">
            <Shield size={28} className="text-accent" />
          </div>
          <h1 className="text-xl font-display font-bold text-text mb-2">
            Connect Wallet
          </h1>
          <p className="text-sm text-text-muted mb-8">
            Connect your wallet to access the TrustGate dashboard.
            Make sure you are on Arc Testnet.
          </p>
          <ConnectKitButton />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">
            Dashboard
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Manage deposits, agents, and claims on TrustGate
          </p>
        </div>
        <ConnectKitButton />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={TABS}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="mb-8"
      />

      {/* Panel */}
      <div className="animate-fade-in" key={activeTab}>
        {activeTab === "depositor" && <DepositorPanel />}
        {activeTab === "agents" && <AgentPanel />}
        {activeTab === "claims" && <ClaimsPanel />}
      </div>
    </div>
  );
}
