import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatUnits, parseUnits } from "viem";
import { USDC_DECIMALS } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatUsdc(amount: bigint): string {
  return formatUnits(amount, USDC_DECIMALS);
}

export function parseUsdc(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}

export function formatTimestamp(ts: bigint | number): string {
  const num = typeof ts === "bigint" ? Number(ts) : ts;
  if (num === 0) return "Never";
  return new Date(num * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function tierLabel(tier: number): string {
  if (tier === 2) return "HIGH";
  if (tier === 1) return "MEDIUM";
  return "LOW";
}

export function statusLabel(status: number): string {
  const labels: Record<number, string> = {
    0: "None",
    1: "Pending",
    2: "Released",
    3: "Cancelled",
  };
  return labels[status] ?? "Unknown";
}

export function agentStatusLabel(status: number): string {
  const labels: Record<number, string> = {
    0: "None",
    1: "Active",
    2: "Suspended",
    3: "Deactivated",
  };
  return labels[status] ?? "Unknown";
}

export function timeRemaining(releaseTime: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(releaseTime) - now;
  if (diff <= 0) return "Ready";
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
