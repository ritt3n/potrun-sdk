import { MULTIPLIER_DENOMINATOR, OUTCOME_COUNT } from "./constants";
import { InvalidOutcomeError } from "./errors";
import {
  computeMaxPayout,
  computeRtp,
  computeWinChance,
} from "./format";
import { potrunPlayerAbi } from "./player-abi";
import type { PotrunClient } from "./client";
import type { Outcomes, PayoutPreview } from "./types";
import { toBigInt } from "./utils";

export class OutcomesModule {
  constructor(private readonly client: PotrunClient) {}

  async get(): Promise<Outcomes> {
    const [rawWeights, rawMultipliers, rawTotalWeight] =
      await this.client.publicClient.readContract({
        address: this.client.potrunAddress,
        abi: potrunPlayerAbi,
        functionName: "getOutcomes",
      });

    const weights = rawWeights.map(Number);
    const multipliers = rawMultipliers.map(Number);
    const totalWeight = Number(rawTotalWeight);

    const table = weights.map((weight, index) => {
      const multiplier = multipliers[index] ?? 0;
      const chance = totalWeight > 0 ? weight / totalWeight : 0;

      return {
        outcomeNumber: index + 1,
        multiplier,
        weight,
        chance,
        rtpContribution:
          chance * (multiplier / Number(MULTIPLIER_DENOMINATOR)),
      };
    });

    return {
      weights,
      multipliers,
      totalWeight,
      winChance: computeWinChance(weights, multipliers),
      rtp: computeRtp(weights, multipliers),
      table,
    };
  }

  async preview(
    poolId: bigint | number,
    outcomeNumber: number,
    amount: bigint,
  ): Promise<PayoutPreview> {
    if (
      !Number.isInteger(outcomeNumber) ||
      outcomeNumber < 1 ||
      outcomeNumber > OUTCOME_COUNT
    ) {
      throw new InvalidOutcomeError(outcomeNumber);
    }

    const [potentialPayout, multiplier, weight, totalWeight] =
      await this.client.publicClient.readContract({
        address: this.client.potrunAddress,
        abi: potrunPlayerAbi,
        functionName: "previewPayout",
        args: [toBigInt(poolId), outcomeNumber, amount],
      });

    return {
      potentialPayout,
      multiplier: Number(multiplier),
      weight: Number(weight),
      totalWeight: Number(totalWeight),
    };
  }

  async maxPayout(poolId: bigint | number): Promise<bigint> {
    const pool = await this.client.pools.get(poolId);
    return computeMaxPayout(pool.pot);
  }
}
