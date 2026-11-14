import { formatUnits } from "viem";
import {
  MAX_PAYOUT_POOL_PCT,
  MULTIPLIER_DENOMINATOR,
  NATIVE_ETH,
  PERCENT_DENOMINATOR,
} from "./constants";

export function formatAmount(value: bigint, decimals: number): string {
  return formatUnits(value, decimals);
}

export function formatMultiplier(rawMultiplier: number): string {
  if (rawMultiplier === 0) return "0x";

  const value = rawMultiplier / Number(MULTIPLIER_DENOMINATOR);
  const text = Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

  return `${text}x`;
}

export function formatChance(chance: number, digits = 2): string {
  return `${(chance * 100).toFixed(digits)}%`;
}

export function computeWinChance(
  weights: readonly number[],
  multipliers: readonly number[],
): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total === 0) return 0;

  const winningWeight = weights.reduce(
    (sum, weight, index) =>
      (multipliers[index] ?? 0) > 0 ? sum + weight : sum,
    0,
  );

  return winningWeight / total;
}

export function computeRtp(
  weights: readonly number[],
  multipliers: readonly number[],
): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total === 0) return 0;

  return weights.reduce((rtp, weight, index) => {
    const multiplier = (multipliers[index] ?? 0) / Number(MULTIPLIER_DENOMINATOR);
    return rtp + (weight / total) * multiplier;
  }, 0);
}

export function computeMaxPayout(pot: bigint): bigint {
  return (pot * MAX_PAYOUT_POOL_PCT) / PERCENT_DENOMINATOR;
}

export function isNativeToken(token: string): boolean {
  return token.toLowerCase() === NATIVE_ETH.toLowerCase();
}

export function shortenAddress(
  address: string,
  leading = 6,
  trailing = 4,
): string {
  if (address.length <= leading + trailing + 2) return address;
  return `${address.slice(0, leading)}...${address.slice(-trailing)}`;
}
