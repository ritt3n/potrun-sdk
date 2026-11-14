import type { Address, Hash, Hex, PublicClient, WalletClient } from "viem";
import type { PotrunNetwork, PotrunNetworkName } from "./networks";

export type PotrunClientConfig = {
  network?: PotrunNetworkName | PotrunNetwork;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
  address?: Address;
};

export type Pool = {
  poolId: bigint;
  token: Address;
  isNative: boolean;
  name: string;
  symbol: string;
  decimals: number;
  pot: bigint;
  totalSpins: bigint;
};

export type OutcomeRow = {
  outcomeNumber: number;
  multiplier: number;
  weight: number;
  chance: number;
  rtpContribution: number;
};

export type Outcomes = {
  weights: number[];
  multipliers: number[];
  totalWeight: number;
  winChance: number;
  rtp: number;
  table: OutcomeRow[];
};

export type PayoutPreview = {
  potentialPayout: bigint;
  multiplier: number;
  weight: number;
  totalWeight: number;
};

export type SpinRequest = {
  requestId: bigint;
  poolId: bigint;
  player: Address;
  amount: bigint;
  fulfilled: boolean;
  outcomeNumber: number;
  payoutAmount: bigint;
};

export type PreparedSpin = {
  pool: Pool;
  amount: bigint;
  isNative: boolean;
  needsApproval: boolean;
  allowance: bigint;
  maxPayout: bigint;
  jackpotPreview: bigint;
  platformFeePct: number;
};

export type SpinSent = {
  requestId: bigint;
  txHash: Hash;
  poolId: bigint;
  token: Address;
  amount: bigint;
};

export type SpinOutcome = {
  requestId: bigint;
  poolId: bigint;
  player: Address;
  amount: bigint;
  outcomeNumber: number;
  multiplier: number;
  payoutAmount: bigint;
  remainingPot: bigint;
  isWin: boolean;
};

export type SpinResult = SpinSent & SpinOutcome;

export type SpinApproveMode = boolean | "exact" | "max";

export type SpinArgs = {
  poolId: bigint | number;
  amount: bigint;
  approve?: SpinApproveMode;
  simulate?: boolean;
};

export type WaitOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

export type PlayArgs = SpinArgs & WaitOptions;

export type Payout = {
  token: Address;
  amount: bigint;
};

export type ClaimArgs = {
  token?: Address;
  simulate?: boolean;
};

export type EncodedTransaction = {
  chainId: number;
  to: Address;
  data: Hex;
  value?: bigint;
};

export type EncodeSpinArgs = {
  poolId: bigint | number;
  amount: bigint;
  token?: Address;
};

export type EncodeApproveArgs = {
  token: Address;
  amount: bigint;
  spender?: Address;
};

export type EncodeClaimArgs = {
  token?: Address;
};
