import {
  createPublicClient,
  formatUnits,
  http,
  type Address,
} from "viem";
import { subjectStakeAbi } from "../abi/SubjectStake";
import { CONTRACT_ADDRESSES, RPC_URL, USDC_DECIMALS, arc } from "../chain";
import { subjectId, type CanonicalSubject } from "./canonicalize";

export interface SubjectOnchain {
  exists: boolean;
  kind: string;
  canonical: string;
  supportTotal: string;
  challengeTotal: string;
  stakerCount: number;
  supportStakers: number;
  challengeStakers: number;
  parentId: `0x${string}`;
  statement: string;
  id: `0x${string}`;
}

export interface PositionOnchain {
  support: string;
  challenge: string;
  supportReason: string;
  challengeReason: string;
  staker: Address;
}

export interface UnbondOnchain {
  index: number;
  amount: string;
  side: 0 | 1;
  availableAt: number;
  claimed: boolean;
}

export interface ClaimSummary {
  id: `0x${string}`;
  statement: string;
  supportTotal: string;
  challengeTotal: string;
  supportStakers: number;
  challengeStakers: number;
}

const ZERO = "0x0000000000000000000000000000000000000000";
const ZERO_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export function vaultDeployed(): boolean {
  return CONTRACT_ADDRESSES.subjectStake.toLowerCase() !== ZERO;
}

function client() {
  return createPublicClient({
    chain: arc,
    transport: http(RPC_URL),
  });
}

function emptySubject(partial: Partial<SubjectOnchain> & { id: `0x${string}` }): SubjectOnchain {
  return {
    exists: false,
    kind: "",
    canonical: "",
    supportTotal: "0",
    challengeTotal: "0",
    stakerCount: 0,
    supportStakers: 0,
    challengeStakers: 0,
    parentId: ZERO_ID,
    statement: "",
    ...partial,
  };
}

function mapSubject(
  id: `0x${string}`,
  row: readonly [
    string,
    string,
    boolean,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    `0x${string}`,
    string,
  ]
): SubjectOnchain {
  return {
    id,
    kind: row[0],
    canonical: row[1],
    exists: row[2],
    supportTotal: formatUnits(row[3], USDC_DECIMALS),
    challengeTotal: formatUnits(row[4], USDC_DECIMALS),
    stakerCount: Number(row[5]),
    supportStakers: Number(row[6]),
    challengeStakers: Number(row[7]),
    parentId: row[8],
    statement: row[9],
  };
}

export async function readSubject(
  subject: CanonicalSubject
): Promise<SubjectOnchain> {
  const id = subjectId(subject.kind, subject.canonical);
  if (!vaultDeployed()) {
    return emptySubject({
      id,
      kind: subject.kind,
      canonical: subject.canonical,
    });
  }
  const c = client();
  const row = await c.readContract({
    address: CONTRACT_ADDRESSES.subjectStake,
    abi: subjectStakeAbi,
    functionName: "subjects",
    args: [id],
  });
  const mapped = mapSubject(id, row);
  if (!mapped.kind) mapped.kind = subject.kind;
  if (!mapped.canonical) mapped.canonical = subject.canonical;
  return mapped;
}

export async function readSubjectById(id: `0x${string}`): Promise<SubjectOnchain> {
  if (!vaultDeployed()) return emptySubject({ id });
  const c = client();
  const row = await c.readContract({
    address: CONTRACT_ADDRESSES.subjectStake,
    abi: subjectStakeAbi,
    functionName: "subjects",
    args: [id],
  });
  return mapSubject(id, row);
}

export async function readClaims(parentId: `0x${string}`): Promise<ClaimSummary[]> {
  if (!vaultDeployed()) return [];
  const c = client();
  const n = await c.readContract({
    address: CONTRACT_ADDRESSES.subjectStake,
    abi: subjectStakeAbi,
    functionName: "childClaimCount",
    args: [parentId],
  });
  const count = Number(n);
  const out: ClaimSummary[] = [];
  for (let i = 0; i < count; i++) {
    const claimId = await c.readContract({
      address: CONTRACT_ADDRESSES.subjectStake,
      abi: subjectStakeAbi,
      functionName: "childClaimAt",
      args: [parentId, BigInt(i)],
    });
    const row = await readSubjectById(claimId);
    out.push({
      id: claimId,
      statement: row.statement,
      supportTotal: row.supportTotal,
      challengeTotal: row.challengeTotal,
      supportStakers: row.supportStakers,
      challengeStakers: row.challengeStakers,
    });
  }
  return out;
}

export async function readPosition(
  id: `0x${string}`,
  staker: Address
): Promise<PositionOnchain> {
  if (!vaultDeployed()) {
    return {
      support: "0",
      challenge: "0",
      supportReason: "",
      challengeReason: "",
      staker,
    };
  }
  const c = client();
  const row = await c.readContract({
    address: CONTRACT_ADDRESSES.subjectStake,
    abi: subjectStakeAbi,
    functionName: "positions",
    args: [id, staker],
  });
  return {
    support: formatUnits(row[0], USDC_DECIMALS),
    challenge: formatUnits(row[1], USDC_DECIMALS),
    supportReason: row[2],
    challengeReason: row[3],
    staker,
  };
}

export async function readPositions(id: `0x${string}`): Promise<PositionOnchain[]> {
  if (!vaultDeployed()) return [];
  const c = client();
  const n = await c.readContract({
    address: CONTRACT_ADDRESSES.subjectStake,
    abi: subjectStakeAbi,
    functionName: "listedStakerCount",
    args: [id],
  });
  const count = Number(n);
  const out: PositionOnchain[] = [];
  for (let i = 0; i < count; i++) {
    const staker = await c.readContract({
      address: CONTRACT_ADDRESSES.subjectStake,
      abi: subjectStakeAbi,
      functionName: "listedStakerAt",
      args: [id, BigInt(i)],
    });
    out.push(await readPosition(id, staker));
  }
  return out;
}

export async function readUnbonds(
  id: `0x${string}`,
  staker: Address
): Promise<UnbondOnchain[]> {
  if (!vaultDeployed()) return [];
  const c = client();
  const count = await c.readContract({
    address: CONTRACT_ADDRESSES.subjectStake,
    abi: subjectStakeAbi,
    functionName: "pendingUnbondCount",
    args: [id, staker],
  });
  const n = Number(count);
  const out: UnbondOnchain[] = [];
  for (let i = 0; i < n; i++) {
    const u = await c.readContract({
      address: CONTRACT_ADDRESSES.subjectStake,
      abi: subjectStakeAbi,
      functionName: "getUnbond",
      args: [id, staker, BigInt(i)],
    });
    out.push({
      index: i,
      amount: formatUnits(u.amount, USDC_DECIMALS),
      side: u.side as 0 | 1,
      availableAt: Number(u.availableAt),
      claimed: u.claimed,
    });
  }
  return out;
}
