"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Shield,
  ShieldCheck,
  Clock,
  Lock,
  ArrowDownToLine,
  BarChart3,
  Send,
  Wallet,
  Users,
  BookOpen,
  Layers,
  Cpu,
  FileCode,
  Compass,
  Briefcase,
  UserCheck,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "architecture", label: "Architecture", icon: Layers },
  { id: "trust-scoring", label: "Trust Scoring", icon: Shield },
  { id: "payroll-flow", label: "Payroll Flow", icon: Send },
  { id: "contracts", label: "Contracts", icon: FileCode },
  { id: "getting-started", label: "Getting Started", icon: Compass },
  { id: "employer-guide", label: "Employer Guide", icon: Briefcase },
  { id: "employee-guide", label: "Employee Guide", icon: UserCheck },
  { id: "technology", label: "Technology", icon: Cpu },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="px-4 py-3 rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-mono text-gray-700 dark:text-slate-300 overflow-x-auto">
      {children}
    </pre>
  );
}

function SectionHeading({
  id,
  icon: Icon,
  children,
}: {
  id: string;
  icon: typeof BookOpen;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="flex items-center gap-3 text-xl font-heading font-bold text-gray-900 dark:text-slate-100 pt-12 pb-4 scroll-mt-24 border-b border-gray-200 dark:border-slate-700"
    >
      <Icon size={22} className="text-primary shrink-0" />
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-heading font-bold text-gray-900 dark:text-slate-100 mt-8 mb-3">
      {children}
    </h3>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
      {children}
    </p>
  );
}

function TierRow({
  range,
  label,
  flow,
  icon: Icon,
  color,
}: {
  range: string;
  label: string;
  flow: string;
  icon: typeof ShieldCheck;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald:
      "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400",
    amber:
      "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400",
    red: "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400",
  };
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border",
        colorMap[color]
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon size={16} />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs opacity-70 font-mono">{range}</span>
      </div>
      <span className="text-xs font-mono font-medium">{flow}</span>
    </div>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const sidebarContent = (
    <nav className="space-y-0.5">
      {SECTIONS.map((s) => {
        const Icon = s.icon;
        const isActive = activeSection === s.id;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
              isActive
                ? "bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700/50"
            )}
          >
            <Icon size={14} />
            {s.label}
          </a>
        );
      })}
    </nav>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 mb-6">
        <Link
          href="/"
          className="hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
        >
          Home
        </Link>
        <ChevronRight size={12} />
        <span className="text-gray-500 dark:text-slate-400">Docs</span>
      </div>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-slate-100">
          Documentation
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Everything you need to understand and use Trusted PayGram
        </p>
      </div>

      {/* Mobile sidebar toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden flex items-center gap-2 px-3 py-2 mb-4 rounded-lg text-sm text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
      >
        {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        {sidebarOpen ? "Close menu" : "Jump to section"}
      </button>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden card-static p-4 mb-6 animate-slide-down">
          {sidebarContent}
        </div>
      )}

      <div className="flex gap-10">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24">{sidebarContent}</div>
        </aside>

        {/* Content */}
        <article className="flex-1 min-w-0 max-w-3xl">
          {/* ── Overview ── */}
          <SectionHeading id="overview" icon={BookOpen}>
            Overview
          </SectionHeading>
          <Paragraph>
            Trusted PayGram is a confidential, trust-gated payroll system built
            on Zama&apos;s Fully Homomorphic Encryption (FHE) virtual machine.
            It enables employers to pay their teams using encrypted stablecoins
            while trust scores determine the payment routing for each employee.
          </Paragraph>
          <Paragraph>
            Salaries are encrypted on-chain using FHE -- only the employee and
            employer can decrypt their own values. Trust scores, computed using
            the EigenTrust algorithm, gate every payment flow. High-trust
            employees receive instant transfers, medium-trust employees face a
            24-hour delay, and low-trust employees go through milestone-based
            escrow.
          </Paragraph>
          <Paragraph>
            The system is deployed on both Ethereum Mainnet and Sepolia testnet,
            with the FHE coprocessor active on Sepolia for full encrypted
            computation.
          </Paragraph>

          {/* ── Architecture ── */}
          <SectionHeading id="architecture" icon={Layers}>
            Architecture
          </SectionHeading>
          <Paragraph>
            Trusted PayGram consists of three smart contracts that work together:
          </Paragraph>
          <div className="grid gap-4 mb-6">
            <div className="card-static p-4 border-l-4 border-l-primary">
              <p className="text-sm font-heading font-bold text-gray-900 dark:text-slate-100 mb-1">
                TrustScoring
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Manages encrypted trust scores using the EigenTrust algorithm.
                Scores are stored as FHE-encrypted values (euint64). Provides
                plaintext tier lookups for frontend display and encrypted tier
                comparisons for on-chain routing.
              </p>
            </div>
            <div className="card-static p-4 border-l-4 border-l-emerald-500">
              <p className="text-sm font-heading font-bold text-gray-900 dark:text-slate-100 mb-1">
                PayGramCore
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                The main payroll engine. Manages employees, executes batch
                payroll, and routes payments through trust-gated flows (instant,
                delayed, escrowed). Interacts with TrustScoring for tier lookups
                and PayGramToken for transfers.
              </p>
            </div>
            <div className="card-static p-4 border-l-4 border-l-amber-500">
              <p className="text-sm font-heading font-bold text-gray-900 dark:text-slate-100 mb-1">
                PayGramToken (cPAY)
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                ERC-7984 confidential token implementation. Supports encrypted
                balances, confidential transfers, and observer-based access
                control. Built on OpenZeppelin&apos;s confidential contracts.
              </p>
            </div>
          </div>
          <Paragraph>
            The contracts follow a clear separation of concerns:
            TrustScoring handles reputation, PayGramCore handles payroll logic,
            and PayGramToken handles the confidential token standard.
          </Paragraph>

          {/* ── Trust Scoring ── */}
          <SectionHeading id="trust-scoring" icon={Shield}>
            Trust Scoring
          </SectionHeading>
          <Paragraph>
            Trust scores are computed using the EigenTrust algorithm (Kamvar et
            al.), an iterative convergence algorithm originally designed for
            peer-to-peer reputation systems. Scores range from 0 to 100 and are
            encrypted on-chain using FHE.
          </Paragraph>

          <SubHeading>Trust Tiers</SubHeading>
          <div className="space-y-2 mb-6">
            <TierRow
              range="75-100"
              label="High Trust"
              flow="Instant Transfer"
              icon={ShieldCheck}
              color="emerald"
            />
            <TierRow
              range="40-74"
              label="Medium Trust"
              flow="24h Delayed Release"
              icon={Clock}
              color="amber"
            />
            <TierRow
              range="0-39"
              label="Low Trust"
              flow="Milestone Escrow"
              icon={Lock}
              color="red"
            />
          </div>

          <SubHeading>How Scores Work</SubHeading>
          <Paragraph>
            An oracle (the contract owner) submits trust scores for employees.
            Scores are encrypted using FHE before storage. The TrustScoring
            contract provides two interfaces: a plaintext tier lookup for
            frontend display (getTrustTierPlaintext) and encrypted tier
            comparisons for on-chain payroll routing.
          </Paragraph>
          <Paragraph>
            Scores include an expiry mechanism -- stale scores can be
            invalidated. The FHE ACL system ensures only authorized callers can
            access encrypted values, using allowTransient for cross-contract
            calls.
          </Paragraph>

          {/* ── Payroll Flow ── */}
          <SectionHeading id="payroll-flow" icon={Send}>
            Payroll Flow
          </SectionHeading>
          <Paragraph>
            The payroll process follows four steps:
          </Paragraph>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              {
                step: "01",
                title: "Wrap",
                desc: "Employer wraps USDC into confidential cPAY tokens",
                icon: ArrowDownToLine,
              },
              {
                step: "02",
                title: "Score",
                desc: "Trust scores are encrypted and stored on-chain via FHE",
                icon: BarChart3,
              },
              {
                step: "03",
                title: "Pay",
                desc: "Batch payroll routes payments by encrypted trust tiers",
                icon: Send,
              },
              {
                step: "04",
                title: "Claim",
                desc: "Employees decrypt and claim their confidential salary",
                icon: Wallet,
              },
            ].map((s) => (
              <div key={s.step} className="card-static p-4 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <s.icon size={18} className="text-primary" />
                </div>
                <p className="text-xs font-mono text-primary mb-1">
                  {s.step}
                </p>
                <p className="text-sm font-heading font-bold text-gray-900 dark:text-slate-100 mb-1">
                  {s.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>

          <SubHeading>Oblivious Routing</SubHeading>
          <Paragraph>
            Payment routing uses FHE.select for oblivious computation. For each
            scored employee, three payment records are created (one per tier),
            and FHE.select determines which one is &quot;real&quot; based on the
            encrypted trust score. This ensures the routing decision itself
            remains encrypted -- nobody learns which tier an employee falls into
            from on-chain data alone.
          </Paragraph>
          <Paragraph>
            Unscored employees bypass FHE routing entirely and go directly to
            escrow via a plain boolean check.
          </Paragraph>

          {/* ── Contracts ── */}
          <SectionHeading id="contracts" icon={FileCode}>
            Contracts
          </SectionHeading>

          <SubHeading>Sepolia Testnet</SubHeading>
          <div className="space-y-2 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 w-28 shrink-0">
                TrustScoring
              </span>
              <CodeBlock>0x195dc8309F1b26BF6f5c568024E4060029233596</CodeBlock>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 w-28 shrink-0">
                PayGramToken
              </span>
              <CodeBlock>0x18572E79806bc3caAEeE52d81c0A7A4D86faeD6f</CodeBlock>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 w-28 shrink-0">
                PayGramCore
              </span>
              <CodeBlock>0x370B4F9917b65f36CAe01754c14829408bfAf7fd</CodeBlock>
            </div>
          </div>

          <SubHeading>Ethereum Mainnet</SubHeading>
          <div className="space-y-2 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 w-28 shrink-0">
                TrustScoring
              </span>
              <CodeBlock>0xaa3ae25ebac250ff67f4d9e3195c4c7610055067</CodeBlock>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 w-28 shrink-0">
                PayGramToken
              </span>
              <CodeBlock>0x41fa55cefd625e50fa1ae08baea87ac5c8be0ad7</CodeBlock>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 w-28 shrink-0">
                PayGramCore
              </span>
              <CodeBlock>0xDC41FF140129846f7a2e63A5CcE73e9d767CB4e1</CodeBlock>
            </div>
          </div>
          <Paragraph>
            All contracts are verified on Etherscan. The Sepolia deployment has
            the Zama FHE coprocessor active, enabling full encrypted computation.
            The Mainnet deployment has FHE coprocessor unavailable, so
            PayGramToken was deployed with supply=0.
          </Paragraph>

          {/* ── Getting Started ── */}
          <SectionHeading id="getting-started" icon={Compass}>
            Getting Started
          </SectionHeading>
          <SubHeading>Prerequisites</SubHeading>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-slate-300 space-y-1.5 mb-6">
            <li>MetaMask or any EIP-1193 compatible wallet</li>
            <li>ETH on Sepolia testnet (for gas fees)</li>
            <li>
              Connected to either Ethereum Mainnet (chain ID: 1) or Sepolia
              (chain ID: 11155111)
            </li>
          </ul>

          <SubHeading>Connect Your Wallet</SubHeading>
          <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-slate-300 space-y-2 mb-6">
            <li>
              Click &quot;Connect Wallet&quot; in the top-right corner of the
              navbar
            </li>
            <li>
              Approve the connection in MetaMask
            </li>
            <li>
              If on the wrong network, use the network switcher to switch to
              Sepolia or Mainnet
            </li>
            <li>
              Once connected, you will see your address and network badge in the
              navbar
            </li>
          </ol>

          <SubHeading>Employer vs Employee</SubHeading>
          <Paragraph>
            The app has two views. The Employer Dashboard is accessible to the
            contract owner and provides full management capabilities. The
            Employee Portal is accessible to any connected wallet and shows
            employment details specific to that address. Non-owner wallets can
            still view the employer dashboard in read-only mode.
          </Paragraph>

          {/* ── Employer Guide ── */}
          <SectionHeading id="employer-guide" icon={Briefcase}>
            Employer Guide
          </SectionHeading>
          <SubHeading>Adding Employees</SubHeading>
          <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-slate-300 space-y-2 mb-6">
            <li>
              Navigate to the Employer Dashboard and select the
              &quot;Employees&quot; tab
            </li>
            <li>Click &quot;Add Employee&quot; to open the registration form</li>
            <li>
              Enter the employee&apos;s wallet address, monthly salary (in
              cUSDC), and role
            </li>
            <li>
              Submit the transaction -- the salary is encrypted on-chain via FHE
            </li>
          </ol>

          <SubHeading>Setting Trust Scores</SubHeading>
          <Paragraph>
            Trust scores are set by the oracle (contract owner) through the
            TrustScoring contract. Scores are submitted as plaintext values
            (0-100) and encrypted on-chain. The score determines which payment
            tier each employee falls into during payroll execution.
          </Paragraph>

          <SubHeading>Executing Payroll</SubHeading>
          <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-slate-300 space-y-2 mb-6">
            <li>Go to the &quot;Run Payroll&quot; tab</li>
            <li>Review the payroll summary showing active employees and trust tier routing</li>
            <li>Click &quot;Execute Payroll&quot; and confirm the transaction</li>
            <li>
              Payments are routed automatically: high-trust gets instant, medium-trust
              gets 24h delay, low-trust goes to escrow
            </li>
          </ol>

          <SubHeading>Payment History</SubHeading>
          <Paragraph>
            The &quot;Payment History&quot; tab shows all payment records with
            their status (Instant, Delayed, Escrowed, Released, Completed),
            employee address, creation date, and release time.
          </Paragraph>

          {/* ── Employee Guide ── */}
          <SectionHeading id="employee-guide" icon={UserCheck}>
            Employee Guide
          </SectionHeading>
          <SubHeading>Viewing Your Salary</SubHeading>
          <Paragraph>
            Navigate to the Employee Portal and click &quot;Load My Info&quot;
            to fetch your employment data. Your salary is encrypted on-chain --
            click &quot;Decrypt Salary&quot; to reveal your monthly amount. Only
            you can decrypt your own salary.
          </Paragraph>

          <SubHeading>Trust Score</SubHeading>
          <Paragraph>
            Your trust score is displayed on the right sidebar with a visual
            meter showing the three tiers. The score determines how quickly you
            receive payments. Higher trust means faster access to your salary.
          </Paragraph>

          <SubHeading>Payment History</SubHeading>
          <Paragraph>
            The payment history section shows all your payment records,
            including status, type (instant/delayed/escrowed), and timestamps.
            Payment amounts remain encrypted -- only the metadata is visible.
          </Paragraph>

          <SubHeading>Quick Actions</SubHeading>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-slate-300 space-y-1.5 mb-6">
            <li>
              <span className="font-medium">View on Explorer</span> -- Opens
              your address on Etherscan
            </li>
            <li>
              <span className="font-medium">Contact Employer</span> -- Reach
              out to the contract owner
            </li>
            <li>
              <span className="font-medium">Request Score Update</span> -- Ask
              for a trust score refresh
            </li>
          </ul>

          {/* ── Technology ── */}
          <SectionHeading id="technology" icon={Cpu}>
            Technology
          </SectionHeading>

          <SubHeading>Zama fhEVM</SubHeading>
          <Paragraph>
            The Fully Homomorphic Encryption Virtual Machine (fhEVM) by Zama
            enables computation on encrypted data directly within smart
            contracts. Operations like addition, comparison, and conditional
            selection happen on ciphertexts without decrypting them. This powers
            the confidential salary storage and oblivious payment routing.
          </Paragraph>

          <SubHeading>ERC-7984 Confidential Tokens</SubHeading>
          <Paragraph>
            PayGramToken implements the ERC-7984 standard for confidential
            tokens. Token balances are encrypted, transfers happen between
            ciphertexts, and an observer-based access control system (one
            observer per account) manages who can view balance information.
          </Paragraph>

          <SubHeading>EigenTrust Algorithm</SubHeading>
          <Paragraph>
            Trust scores are computed using EigenTrust, an iterative convergence
            algorithm designed for distributed reputation systems. It handles
            pre-trusted peers, sybil resistance, and converges to a global trust
            vector through iterative multiplication with a normalized trust
            matrix.
          </Paragraph>

          <div className="mt-12 mb-8 card-static p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              Ready to get started?
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/employer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors"
              >
                <Users size={16} />
                Employer Dashboard
              </Link>
              <Link
                href="/employee"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50 transition-colors"
              >
                <Wallet size={16} />
                Employee Portal
              </Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
