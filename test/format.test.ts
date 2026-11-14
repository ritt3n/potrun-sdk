import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import { NATIVE_ETH } from "../src/constants";
import {
  computeMaxPayout,
  computeRtp,
  computeWinChance,
  formatAmount,
  formatChance,
  formatMultiplier,
  isNativeToken,
  shortenAddress,
} from "../src/format";

const WEIGHTS = [537_000, 140_000, 140_000, 90_000, 60_000, 24_000, 8_000, 800, 200];
const MULTIPLIERS = [0, 5_000, 12_000, 15_000, 20_000, 50_000, 100_000, 1_000_000, 2_000_000];

describe("format helpers", () => {
  it("formats multipliers", () => {
    expect(formatMultiplier(0)).toBe("0x");
    expect(formatMultiplier(5_000)).toBe("0.5x");
    expect(formatMultiplier(12_000)).toBe("1.2x");
    expect(formatMultiplier(100_000)).toBe("10x");
    expect(formatMultiplier(2_000_000)).toBe("200x");
  });

  it("formats chances", () => {
    expect(formatChance(0.537)).toBe("53.70%");
    expect(formatChance(0.0002)).toBe("0.02%");
  });

  it("formats token amounts", () => {
    expect(formatAmount(parseEther("1.5"), 18)).toBe("1.5");
  });

  it("computes the win chance and RTP", () => {
    expect(computeWinChance(WEIGHTS, MULTIPLIERS)).toBeCloseTo(0.463, 6);
    expect(computeRtp(WEIGHTS, MULTIPLIERS)).toBeCloseTo(0.813, 6);
  });

  it("computes the live payout cap", () => {
    expect(computeMaxPayout(1_000n)).toBe(800n);
  });

  it("detects the native ETH sentinel", () => {
    expect(isNativeToken(NATIVE_ETH)).toBe(true);
    expect(isNativeToken(NATIVE_ETH.toLowerCase())).toBe(true);
    expect(isNativeToken("0x0000000000000000000000000000000000000001")).toBe(false);
  });

  it("shortens addresses", () => {
    expect(shortenAddress("0x1234567890abcdef")).toBe("0x1234...cdef");
  });
});
