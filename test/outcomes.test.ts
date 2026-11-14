import { describe, expect, it, vi } from "vitest";
import { OutcomesModule } from "../src/outcomes";
import { InvalidOutcomeError } from "../src/errors";
import type { PotrunClient } from "../src/client";

const WEIGHTS = [537_000, 140_000, 140_000, 90_000, 60_000, 24_000, 8_000, 800, 200];
const MULTIPLIERS = [0, 5_000, 12_000, 15_000, 20_000, 50_000, 100_000, 1_000_000, 2_000_000];

function createClient() {
  const readContract = vi.fn();
  const poolsGet = vi.fn();
  const client = {
    publicClient: { readContract },
    potrunAddress: "0x0000000000000000000000000000000000000001",
    pools: { get: poolsGet },
  } as unknown as PotrunClient;

  return { client, readContract, poolsGet, outcomes: new OutcomesModule(client) };
}

describe("OutcomesModule", () => {
  it("builds the outcome table with chances and RTP", async () => {
    const { readContract, outcomes } = createClient();
    readContract.mockResolvedValueOnce([WEIGHTS, MULTIPLIERS, 1_000_000]);

    const result = await outcomes.get();

    expect(result.weights).toEqual(WEIGHTS);
    expect(result.multipliers).toEqual(MULTIPLIERS);
    expect(result.totalWeight).toBe(1_000_000);
    expect(result.winChance).toBeCloseTo(0.463, 6);
    expect(result.rtp).toBeCloseTo(0.813, 6);
    expect(result.table).toHaveLength(9);
    expect(result.table[0]).toMatchObject({
      outcomeNumber: 1,
      multiplier: 0,
      chance: 0.537,
    });
    expect(result.table[8]).toMatchObject({
      outcomeNumber: 9,
      multiplier: 2_000_000,
      chance: 0.0002,
    });
  });

  it("previews a payout", async () => {
    const { readContract, outcomes } = createClient();
    readContract.mockResolvedValueOnce([1_000n, 2_000_000, 200, 1_000_000]);

    const result = await outcomes.preview(1n, 9, 100n);

    expect(result).toEqual({
      potentialPayout: 1_000n,
      multiplier: 2_000_000,
      weight: 200,
      totalWeight: 1_000_000,
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "previewPayout",
        args: [1n, 9, 100n],
      }),
    );
  });

  it("rejects invalid outcome numbers", async () => {
    const { outcomes } = createClient();

    await expect(outcomes.preview(1n, 10, 100n)).rejects.toBeInstanceOf(
      InvalidOutcomeError,
    );
  });

  it("computes the live max payout", async () => {
    const { poolsGet, outcomes } = createClient();
    poolsGet.mockResolvedValueOnce({ pot: 1_000n });

    await expect(outcomes.maxPayout(1n)).resolves.toBe(800n);
  });
});
