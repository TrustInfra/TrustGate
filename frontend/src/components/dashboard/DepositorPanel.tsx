"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { ArrowDownToLine, ArrowUpFromLine, Settings2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/GlassCard";
import { CONTRACT_ADDRESSES } from "@/lib/constants";
import { trustGateAbi } from "@/lib/abi/TrustGate";
import { erc20Abi } from "@/lib/abi/ERC20";
import { formatUsdc, parseUsdc } from "@/lib/utils";

export default function DepositorPanel() {
  const { address } = useAccount();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [allowanceAgent, setAllowanceAgent] = useState("");
  const [allowanceAmount, setAllowanceAmount] = useState("");

  // Read depositor's balance in TrustGate
  const { data: depositBalance, refetch: refetchDeposit } = useReadContract({
    address: CONTRACT_ADDRESSES.trustGate,
    abi: trustGateAbi,
    functionName: "deposits",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read USDC balance
  const { data: usdcBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read USDC approval for TrustGate
  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACT_ADDRESSES.trustGate] : undefined,
    query: { enabled: !!address },
  });

  // Write hooks
  const { writeContract: approve, data: approveTxHash, isPending: isApproving } =
    useWriteContract();
  const { writeContract: deposit, data: depositTxHash, isPending: isDepositing } =
    useWriteContract();
  const { writeContract: withdraw, data: withdrawTxHash, isPending: isWithdrawing } =
    useWriteContract();
  const { writeContract: setAllowance, data: setAllowanceTxHash, isPending: isSettingAllowance } =
    useWriteContract();

  // Wait for confirmations
  const { isLoading: isConfirmingApprove } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });
  const { isLoading: isConfirmingDeposit } = useWaitForTransactionReceipt({
    hash: depositTxHash,
  });
  const { isLoading: isConfirmingWithdraw } = useWaitForTransactionReceipt({
    hash: withdrawTxHash,
  });
  const { isLoading: isConfirmingAllowance } = useWaitForTransactionReceipt({
    hash: setAllowanceTxHash,
  });

  const handleDeposit = () => {
    if (!depositAmount || !address) return;
    const amount = parseUsdc(depositAmount);

    // Check if we need to approve first
    if (!usdcAllowance || usdcAllowance < amount) {
      approve({
        address: CONTRACT_ADDRESSES.usdc,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACT_ADDRESSES.trustGate, amount],
      }, {
        onSuccess: () => {
          refetchUsdcAllowance();
          // After approval, do the deposit
          setTimeout(() => {
            deposit({
              address: CONTRACT_ADDRESSES.trustGate,
              abi: trustGateAbi,
              functionName: "deposit",
              args: [amount],
            }, {
              onSuccess: () => {
                setDepositAmount("");
                refetchDeposit();
              },
            });
          }, 2000);
        },
      });
    } else {
      deposit({
        address: CONTRACT_ADDRESSES.trustGate,
        abi: trustGateAbi,
        functionName: "deposit",
        args: [amount],
      }, {
        onSuccess: () => {
          setDepositAmount("");
          refetchDeposit();
        },
      });
    }
  };

  const handleWithdraw = () => {
    if (!withdrawAmount) return;
    withdraw({
      address: CONTRACT_ADDRESSES.trustGate,
      abi: trustGateAbi,
      functionName: "withdraw",
      args: [parseUsdc(withdrawAmount)],
    }, {
      onSuccess: () => {
        setWithdrawAmount("");
        refetchDeposit();
      },
    });
  };

  const handleSetAllowance = () => {
    if (!allowanceAgent || !allowanceAmount) return;
    setAllowance({
      address: CONTRACT_ADDRESSES.trustGate,
      abi: trustGateAbi,
      functionName: "setAllowance",
      args: [allowanceAgent as `0x${string}`, parseUsdc(allowanceAmount)],
    }, {
      onSuccess: () => {
        setAllowanceAgent("");
        setAllowanceAmount("");
      },
    });
  };

  const formattedDeposit = depositBalance ? formatUsdc(depositBalance as bigint) : "0";
  const formattedWallet = usdcBalance ? formatUsdc(usdcBalance as bigint) : "0";

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card hover={false} className="p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
            Wallet USDC
          </p>
          <p className="text-2xl font-display font-bold text-text">
            {formattedWallet}
            <span className="text-sm font-body text-text-muted ml-1">USDC</span>
          </p>
        </Card>
        <Card hover={false} className="p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
            Deposited in TrustGate
          </p>
          <p className="text-2xl font-display font-bold text-accent">
            {formattedDeposit}
            <span className="text-sm font-body text-text-muted ml-1">USDC</span>
          </p>
        </Card>
      </div>

      {/* Deposit / Withdraw */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card hover={false} className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowDownToLine size={16} className="text-tier-high" />
            <h3 className="text-sm font-display font-semibold text-text">
              Deposit USDC
            </h3>
          </div>
          <div className="space-y-3">
            <Input
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              hint={`Available: ${formattedWallet} USDC`}
            />
            <Button
              onClick={handleDeposit}
              loading={isApproving || isDepositing || isConfirmingApprove || isConfirmingDeposit}
              disabled={!depositAmount || !address}
              className="w-full"
            >
              {isApproving || isConfirmingApprove ? "Approving..." : "Deposit"}
            </Button>
          </div>
        </Card>

        <Card hover={false} className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpFromLine size={16} className="text-tier-medium" />
            <h3 className="text-sm font-display font-semibold text-text">
              Withdraw USDC
            </h3>
          </div>
          <div className="space-y-3">
            <Input
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              hint={`Available: ${formattedDeposit} USDC`}
            />
            <Button
              variant="outline"
              onClick={handleWithdraw}
              loading={isWithdrawing || isConfirmingWithdraw}
              disabled={!withdrawAmount || !address}
              className="w-full"
            >
              Withdraw
            </Button>
          </div>
        </Card>
      </div>

      {/* Set Allowance */}
      <Card hover={false} className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 size={16} className="text-accent" />
          <h3 className="text-sm font-display font-semibold text-text">
            Set Agent Allowance
          </h3>
        </div>
        <p className="text-xs text-text-muted mb-4">
          Define the maximum USDC an agent can claim from your deposit. Trust tier
          determines payment routing: instant, time-locked, or escrowed.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Agent Address"
            placeholder="0x..."
            value={allowanceAgent}
            onChange={(e) => setAllowanceAgent(e.target.value)}
          />
          <Input
            label="Allowance (USDC)"
            placeholder="0.00"
            type="number"
            step="0.01"
            min="0"
            value={allowanceAmount}
            onChange={(e) => setAllowanceAmount(e.target.value)}
          />
        </div>
        <Button
          onClick={handleSetAllowance}
          loading={isSettingAllowance || isConfirmingAllowance}
          disabled={!allowanceAgent || !allowanceAmount || !address}
          className="mt-4"
        >
          Set Allowance
        </Button>
      </Card>
    </div>
  );
}
