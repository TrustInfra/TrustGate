import {
  Bot,
  ArrowDownToLine,
  Shield,
  Wallet,
} from "lucide-react";

const STEPS = [
  {
    number: "01",
    title: "Register",
    description:
      "Register your AI agent permissionlessly on AgentRegistry.",
    icon: Bot,
  },
  {
    number: "02",
    title: "Deposit",
    description:
      "Depositors fund TrustGate with USDC and set per-agent allowances.",
    icon: ArrowDownToLine,
  },
  {
    number: "03",
    title: "Score",
    description:
      "Trust scores classify agents into HIGH, MEDIUM, or LOW tiers.",
    icon: Shield,
  },
  {
    number: "04",
    title: "Claim",
    description:
      "Agents claim USDC routed instantly, delayed, or escrowed by tier.",
    icon: Wallet,
  },
] as const;

export default function StepTimeline() {
  return (
    <div className="relative">
      <div
        className="hidden lg:block absolute top-[18px] left-[12%] right-[12%] h-px bg-border"
        aria-hidden
      />

      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.number} className="relative flex flex-col">
              <div className="flex items-center gap-3 mb-5">
                <span className="font-mono text-[10px] font-bold text-accent tracking-wider">
                  {step.number}
                </span>
                <div className="hidden lg:block flex-1 h-px bg-border" />
              </div>

              <div className="inline-flex p-2.5 w-fit bg-accent-muted border border-accent/10 mb-4">
                <Icon size={18} className="text-accent" />
              </div>

              <h3 className="text-sm font-display font-bold text-text mb-2">
                {step.title}
              </h3>
              <p className="text-xs text-text-muted leading-relaxed max-w-[220px]">
                {step.description}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}