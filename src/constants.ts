import type { Address } from "viem";

export const NATIVE_ETH =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const satisfies Address;

export const MULTIPLIER_DENOMINATOR = 10_000n;
export const PERCENT_DENOMINATOR = 100_000n;
export const MAX_PAYOUT_POOL_PCT = 80_000n;
export const OUTCOME_COUNT = 9;
export const DEFAULT_POLL_INTERVAL_MS = 3_000;
export const DEFAULT_POLL_TIMEOUT_MS = 300_000;
